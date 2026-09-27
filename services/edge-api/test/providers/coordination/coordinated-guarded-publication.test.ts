/**
 * Coordinated publication through the guarded sequencer, end to end (ADR 0023
 * D11 as amended; ADR 0026 D12 items 10, 12 and 13; D14-D16).
 *
 * Every case runs the production path - the real coordinator,
 * `assembleSeasonSource`, the integrity preflight, `generateSnapshotSet`,
 * `CoordinatedSeasonPublication` and the real `SequencedPublicationService` -
 * over both supported sequencer transports: the in-process sequencer and the
 * Durable Object client over a faithful in-memory namespace. The data is the
 * synthetic split season (`split-participation-support.ts`); nothing here is
 * provider data and nothing reaches a network.
 *
 * The predecessor is always a release the sequencer committed or was seeded
 * with. It is read as a guard only: no test expects any of its rows to reach a
 * candidate.
 */

import { describe, expect, it } from 'vitest';

import type {
  RaceResultEntry,
  SeasonDriverSummary,
} from '../../../src/contract/types';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  type CoordinatedPublicationOutcome,
} from '../../../src/providers/coordination';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { handlePublicRequest } from '../../../src/public/router';
import { deriveParticipationGuard } from '../../../src/publication/guard/participation-guard';
import { readPredecessorGuard } from '../../../src/publication/guard/predecessor';
import type { PublicationResult } from '../../../src/publication/publisher';
import { SequencedPublicationService } from '../../../src/publication/sequenced/service';
import { generateSnapshotSet } from '../../../src/snapshots/generator';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import {
  SEED_VERSION,
  generatedSet,
  portWith,
  sequencerTransports,
  type SequencerTransport,
} from '../../publication/sequenced/support';
import {
  FIXED_NOW,
  SEASON,
  FakePort,
  attempt,
  completePort,
  fullPlan,
  metadataFor,
  publicationHarness,
  seasonFixture,
  testOnlyProvisionalBound,
  type PublicationHarness,
} from './support';
import { splitRow, splitSeasonFixture } from './split-participation-support';

/** Candidate ordering inputs, all later than the seed's. */
const FIRST_AT = '2026-07-18T12:00:00.000Z';
const SECOND_AT = '2026-07-18T13:00:00.000Z';

/** Every identifier the synthetic season carries; none may reach a log line. */
const FORBIDDEN_IN_LOGS = [
  'max-verstappen',
  'liam-lawson',
  'isack-hadjar',
  'yuki-tsunoda',
  'lando-norris',
  'red-bull',
  'racing-bulls',
  'mclaren',
  'sha256:',
  'jolpica-',
  'openf1-',
  '"entries"',
  '"driverId"',
];

/**
 * The split season with a final race classification at `classified` only.
 * Every other round is `unavailable` and keeps the mock calendar's own
 * non-completed status, so it is a future round rather than a gap.
 */
async function splitSeason(
  classified: readonly number[] = [1, 11, 12, 13],
): Promise<ProviderSeasonSource> {
  const split = await splitSeasonFixture();
  const mock = await seasonFixture();
  const kept = new Set(classified);
  return {
    ...split,
    calendar: split.calendar.map((event, index) =>
      kept.has(event.round)
        ? event
        : { ...event, status: mock.calendar[index]!.status, hasResults: false },
    ),
    results: split.results.map((result) =>
      kept.has(result.round)
        ? result
        : { ...result, status: 'unavailable' as const, entries: [] },
    ),
  };
}

/** `source` with one round's race rows mapped. */
function withRows(
  source: ProviderSeasonSource,
  round: number,
  map: (entries: readonly RaceResultEntry[]) => RaceResultEntry[],
): ProviderSeasonSource {
  return {
    ...source,
    results: source.results.map((result) =>
      result.round === round && result.sessionType === 'race'
        ? { ...result, entries: map(result.entries) }
        : result,
    ),
  };
}

function coordinate(source: ProviderSeasonSource) {
  return new MultiSourceCoordinator({
    ports: [completePort('jolpica', source)],
    logger: new CapturingLogger(),
  }).coordinate({ plan: fullPlan(source) });
}

/** What coordination would publish for `source`: the seed of a predecessor. */
async function assembled(
  source: ProviderSeasonSource,
): Promise<ProviderSeasonSource> {
  const assembly = assembleSeasonSource(
    await coordinate(source),
    metadataFor(source),
  );
  if (!assembly.complete) {
    throw new Error(`fixture does not assemble: ${assembly.gap}`);
  }
  return assembly.source;
}

async function publishThrough(
  harness: PublicationHarness,
  source: ProviderSeasonSource,
  sourceUpdatedAt = FIRST_AT,
): Promise<CoordinatedPublicationOutcome> {
  return new CoordinatedSeasonPublication({
    commands: harness.commands,
    logger: harness.logger,
  }).publish(
    await coordinate(source),
    { ...metadataFor(source), sourceUpdatedAt },
    FIXED_NOW,
    'caller-version',
  );
}

function resultOf(outcome: CoordinatedPublicationOutcome): PublicationResult {
  expect(outcome.outcome).toBe('published');
  if (outcome.outcome !== 'published') throw new Error('unreachable');
  return outcome.result;
}

/** A version's guard sets, read the way the sequenced service reads them. */
async function guardOf(harness: PublicationHarness, version: string) {
  const read = await readPredecessorGuard(harness.storage, SEASON, version);
  if (read.kind !== 'read') throw new Error(`guard not readable: ${read.kind}`);
  return {
    rounds: [...read.guard.classifiedRounds],
    facts: read.guard.facts.map(
      ([round, driver, constructor]) => `${round}|${driver}|${constructor}`,
    ),
  };
}

async function seasonDrivers(
  harness: PublicationHarness,
): Promise<SeasonDriverSummary[]> {
  const document = await harness.activeDocument('drivers');
  if (document === null) throw new Error('no active drivers document');
  return document.data as SeasonDriverSummary[];
}

function spansOf(drivers: readonly SeasonDriverSummary[], driverId: string) {
  return drivers
    .filter((summary) => summary.driverId === driverId)
    .map(({ constructorId, startRound, endRound }) => ({
      constructorId,
      startRound,
      endRound,
    }));
}

/** The first set the bridge handed to guarded publication. */
function firstHanded(harness: PublicationHarness) {
  const handed = harness.handed[0];
  if (handed === undefined) throw new Error('nothing was handed over');
  return handed;
}

/** Nothing but the seed was ever written, and the seed still serves. */
async function expectSeedOnly(harness: PublicationHarness): Promise<void> {
  expect(await harness.storage.listVersions(SEASON)).toEqual([SEED_VERSION]);
  expect(await harness.storage.getActiveVersion(SEASON)).toBe(SEED_VERSION);
}

function expectBoundedLogs(harness: PublicationHarness): void {
  const serialized = harness.logger.serialized();
  for (const forbidden of FORBIDDEN_IN_LOGS) {
    expect(serialized, forbidden).not.toContain(forbidden);
  }
}

describe.each(sequencerTransports)(
  'coordinated publication over the %s sequencer transport',
  (transport: SequencerTransport) => {
    async function harnessFor(
      predecessor: readonly number[],
    ): Promise<PublicationHarness> {
      return publicationHarness({
        transport,
        seedSource: await assembled(await splitSeason(predecessor)),
      });
    }

    describe('a valid candidate publishes through the guarded sequencer', () => {
      it('commits exactly the generated candidate and never the legacy publisher', async () => {
        const harness = await harnessFor([1, 11, 12]);
        const before = await guardOf(harness, SEED_VERSION);

        const result = resultOf(
          await publishThrough(harness, await splitSeason()),
        );

        expect(result).toMatchObject({
          status: 'applied',
          previousVersion: SEED_VERSION,
          reason: null,
        });
        expect(harness.publishCalls).toBe(1);
        expect(harness.legacyPublishCalls).toBe(0);
        expect(harness.activeVersion()).toBe(result.version);
        // The legacy pointer is not what guarded publication moves.
        expect(await harness.storage.getActiveVersion(SEASON)).toBe(
          SEED_VERSION,
        );

        // The active version holds exactly the candidate the bridge generated.
        const { set, copy } = firstHanded(harness);
        const inventory = await harness.storage.readVersionInventory(
          SEASON,
          result.version,
        );
        expect([...(inventory ?? [])].sort()).toEqual(
          set.documents.map((document) => document.documentName).sort(),
        );
        for (const document of set.documents) {
          const stored = await harness.activeDocument(document.documentName);
          expect(stored, document.documentName).not.toBeNull();
          if (document.documentName === 'home') continue;
          // Only `prepare`-assigned timestamps differ; the data is verbatim.
          expect(stored!.data, document.documentName).toEqual(document.data);
        }
        // Guard evaluation read the candidate without altering it.
        expect(set).toEqual(copy);

        // A wider candidate: a new classified round and its facts; every
        // predecessor fact in an earlier round is still present.
        const after = await guardOf(harness, result.version);
        expect(before.rounds).toEqual([1, 11, 12]);
        expect(after.rounds).toEqual([1, 11, 12, 13]);
        expect(after.facts).toEqual(expect.arrayContaining(before.facts));
        expect(after.facts.length).toBeGreaterThan(before.facts.length);
        expectBoundedLogs(harness);
      });

      it('runs the standard post-commit metadata and cache path exactly once', async () => {
        const harness = await harnessFor([1, 11, 12]);
        const purgedBefore = harness.purger.purgedUrls.length;

        const result = resultOf(
          await publishThrough(harness, await splitSeason()),
        );

        expect(result.status).toBe('applied');
        expect(result.pointerMaintenance).toBe('succeeded');
        expect(result.cachePurge).toBe('succeeded');
        const committed = harness.logger.events.filter(
          (event) => event.operation === 'publication.sequencer.committed',
        );
        expect(committed).toHaveLength(1);
        expect(committed[0]).toMatchObject({
          season: SEASON,
          releaseVersion: result.version,
          publicationStatus: 'ordinary-publication',
        });
        const bridge = harness.logger.events.filter(
          (event) => event.operation === 'provider.coordination.publication',
        );
        expect(bridge).toHaveLength(1);
        expect(bridge[0]).toMatchObject({
          coordinationOutcome: 'published',
          publicationStatus: 'applied',
        });
        expect(harness.purger.purgedUrls.length).toBeGreaterThan(purgedBefore);
        expect(await harness.storage.getCurrentSeason()).toBe(SEASON);
      });

      it('lets a later round close a span by absence and keeps earlier facts', async () => {
        const harness = await harnessFor([1, 11, 12]);
        const before = await guardOf(harness, SEED_VERSION);
        const candidate = withRows(await splitSeason(), 13, (rows) =>
          rows.filter((row) => row.driverId !== 'yuki-tsunoda'),
        );

        const result = resultOf(await publishThrough(harness, candidate));

        expect(result.status).toBe('applied');
        expect(spansOf(await seasonDrivers(harness), 'yuki-tsunoda')).toEqual([
          { constructorId: 'racing-bulls', startRound: 12, endRound: 12 },
        ]);
        const after = await guardOf(harness, result.version);
        expect(after.facts).toEqual(expect.arrayContaining(before.facts));
      });

      it('derives the split spans from the published classifications', async () => {
        const harness = await harnessFor([1, 11, 12]);

        resultOf(await publishThrough(harness, await splitSeason()));

        const drivers = await seasonDrivers(harness);
        expect(spansOf(drivers, 'liam-lawson')).toEqual([
          { constructorId: 'racing-bulls', startRound: null, endRound: 11 },
          { constructorId: 'red-bull', startRound: 12, endRound: null },
        ]);
        expect(spansOf(drivers, 'isack-hadjar')).toEqual([
          { constructorId: 'red-bull', startRound: null, endRound: 11 },
        ]);
        expect(spansOf(drivers, 'yuki-tsunoda')).toEqual([
          { constructorId: 'racing-bulls', startRound: 12, endRound: null },
        ]);
      });
    });

    describe('there is no legacy fallback', () => {
      for (const cutover of ['none', 'seeded'] as const) {
        it(`refuses a season whose cutover is ${cutover === 'none' ? 'uninitialized' : 'seeded but not active'}`, async () => {
          // The harness's legacy publisher is real and usable: it published
          // the seed, and ordinary publication below still reaches it.
          const harness = await publicationHarness({ transport, cutover });

          const result = resultOf(
            await publishThrough(harness, await seasonFixture()),
          );

          expect(result).toMatchObject({
            status: 'failed',
            reason: 'guard-authority-not-sequenced',
            previousVersion: null,
            cachePurge: 'not-required',
            pointerMaintenance: 'not-required',
            purgedUrls: [],
          });
          expect(harness.legacyPublishCalls).toBe(0);
          expect(harness.activeVersion()).toBeNull();
          await expectSeedOnly(harness);
          expect(
            harness.logger.events.find(
              (event) => event.operation === 'publication.guard.rejected',
            ),
          ).toMatchObject({
            level: 'warn',
            failureCategory: 'guard-authority-not-sequenced',
          });
          expect(
            harness.logger.events.find(
              (event) =>
                event.operation === 'provider.coordination.publication',
            ),
          ).toMatchObject({
            level: 'warn',
            publicationStatus: 'failed',
            failureCategory: 'guard-authority-not-sequenced',
          });

          // Ordinary (non-coordinated) publication keeps its fallback.
          const ordinary = await harness.context.service.publish(
            await generatedSet(harness.context.clock, 'v-ordinary', {
              sourceUpdatedAt: FIRST_AT,
              contentVersion: '2026.07.18.9',
            }),
          );
          expect(ordinary.status).toBe('applied');
          expect(ordinary.reason).not.toBe('guard-authority-not-sequenced');
          expect(harness.legacyPublishCalls).toBe(1);
          expect(await harness.storage.getActiveVersion(SEASON)).toBe(
            'v-ordinary',
          );
        });
      }

      it('fails an unreachable sequencer closed, without the legacy publisher', async () => {
        const harness = await publicationHarness({ transport });
        const { context } = harness;
        let commands = harness.commands;
        if (context.transport !== null) {
          // The Durable Object binding answers nothing at all.
          context.transport.intercept = async () => {
            throw new Error('binding unreachable');
          };
        } else {
          const service = new SequencedPublicationService({
            port: portWith(context.port, {
              readAuthority: async () => {
                throw new Error('sequencer unreachable');
              },
            }),
            fallback: context.legacy,
            storage: context.storage,
            validator: runtimeSnapshotValidator,
            purger: context.purger,
            logger: context.logger,
            clock: context.clock,
          });
          commands = {
            publishGuarded: async (set) => {
              harness.publishCalls += 1;
              return service.publishGuarded(set);
            },
          };
        }

        const outcome = await new CoordinatedSeasonPublication({
          commands,
          logger: harness.logger,
        }).publish(
          await coordinate(await seasonFixture()),
          { ...metadataFor(await seasonFixture()), sourceUpdatedAt: FIRST_AT },
          FIXED_NOW,
          'caller-version',
        );

        expect(resultOf(outcome)).toMatchObject({
          status: 'failed',
          reason: 'sequencer-authority-unavailable',
        });
        expect(harness.publishCalls).toBe(1);
        expect(harness.legacyPublishCalls).toBe(0);
        await expectSeedOnly(harness);
        expect(harness.logger.serialized()).not.toContain('unreachable');
      });

      it('fails an authority that answers unavailable closed', async () => {
        const harness = await publicationHarness({ transport });
        const { context } = harness;
        const service = new SequencedPublicationService({
          port: portWith(context.port, {
            readAuthority: async () => ({
              cutoverState: 'unavailable',
              authoritative: false,
            }),
          }),
          fallback: context.legacy,
          storage: context.storage,
          validator: runtimeSnapshotValidator,
          purger: context.purger,
          logger: context.logger,
          clock: context.clock,
        });

        const outcome = await new CoordinatedSeasonPublication({
          commands: service,
          logger: harness.logger,
        }).publish(
          await coordinate(await seasonFixture()),
          { ...metadataFor(await seasonFixture()), sourceUpdatedAt: FIRST_AT },
          FIXED_NOW,
          'caller-version',
        );

        expect(resultOf(outcome).reason).toBe(
          'sequencer-authority-unavailable',
        );
        expect(harness.legacyPublishCalls).toBe(0);
        expect(harness.activeVersion()).toBe(SEED_VERSION);
        await expectSeedOnly(harness);
      });
    });

    describe('D14: a classified round never disappears', () => {
      it('rejects a candidate missing a published classified round', async () => {
        const harness = await harnessFor([1, 11, 12, 13]);

        const result = resultOf(
          await publishThrough(harness, await splitSeason([1, 11, 12])),
        );

        expect(result).toMatchObject({
          status: 'rejected',
          reason: 'guard-round-coverage-regression',
          previousVersion: SEED_VERSION,
        });
        // The authoritative release stays active and publicly readable.
        expect(harness.activeVersion()).toBe(SEED_VERSION);
        await expectSeedOnly(harness);
        const response = await handlePublicRequest(
          new Request(
            `https://api.gridview.local/v1/seasons/${SEASON}/grand-prix/13/results`,
          ),
          harness.storage,
          'req',
          { mode: 'sequencer', port: harness.context.port },
        );
        expect(response.response.status).toBe(200);
        const body = (await response.response.json()) as {
          data: { status: string; entries: unknown[] };
        };
        expect(body.data.status).toBe('final');
        expect(body.data.entries.length).toBeGreaterThan(0);

        // Nothing of the predecessor reached the candidate: its round 13 is
        // still the unclassified document assembly produced.
        const { set } = firstHanded(harness);
        const candidate = deriveParticipationGuard(SEASON, set.documents);
        expect(candidate).toMatchObject({
          kind: 'valid',
          guard: { classifiedRounds: [1, 11, 12] },
        });
        const round13 = set.documents.find(
          (document) => document.documentName === 'grand-prix:13:results',
        );
        expect(round13?.data).toMatchObject({
          status: 'unavailable',
          entries: [],
        });
        expectBoundedLogs(harness);
      });
    });

    describe('D15: a published participation fact never regresses', () => {
      it('rejects a removed (round, driver, constructor) fact', async () => {
        const harness = await harnessFor([1, 11, 12, 13]);
        const candidate = withRows(await splitSeason(), 12, (rows) =>
          rows.filter((row) => row.driverId !== 'yuki-tsunoda'),
        );

        const result = resultOf(await publishThrough(harness, candidate));

        expect(result).toMatchObject({
          status: 'rejected',
          reason: 'guard-participation-fact-removed',
        });
        expect(harness.activeVersion()).toBe(SEED_VERSION);
        await expectSeedOnly(harness);
        expectBoundedLogs(harness);
      });

      it('rejects a replaced constructor for an existing (round, driver)', async () => {
        const harness = await harnessFor([1, 11, 12, 13]);
        const candidate = withRows(await splitSeason(), 13, (rows) =>
          rows.map((row) =>
            row.driverId === 'liam-lawson'
              ? { ...row, constructorId: 'racing-bulls' }
              : row,
          ),
        );

        const result = resultOf(await publishThrough(harness, candidate));

        expect(result).toMatchObject({
          status: 'rejected',
          reason: 'guard-constructor-replaced',
        });
        expect(harness.activeVersion()).toBe(SEED_VERSION);
        await expectSeedOnly(harness);
        expectBoundedLogs(harness);
      });

      it('accepts changed positions, points, status, order and fastest lap', async () => {
        const harness = await harnessFor([1, 11, 12, 13]);
        const before = await guardOf(harness, SEED_VERSION);
        let candidate = await splitSeason();
        for (const round of [12, 13]) {
          candidate = withRows(candidate, round, (rows) =>
            [...rows].reverse().map((row, index) => ({
              ...row,
              position: index + 1,
              points: 10 - index,
              status: index === rows.length - 1 ? 'dnf' : 'finished',
              fastestLap: index === 0,
            })),
          );
        }
        candidate = {
          ...candidate,
          results: candidate.results.map((result) =>
            result.round === 13
              ? {
                  ...result,
                  fastestLap: {
                    driverId: 'yuki-tsunoda',
                    timeMillis: 81234,
                    lap: 40,
                  },
                }
              : result,
          ),
        };

        const result = resultOf(await publishThrough(harness, candidate));

        expect(result.status).toBe('applied');
        const after = await guardOf(harness, result.version);
        expect(after).toEqual(before);
      });

      it('accepts a driver added to a new and to an existing classified round', async () => {
        const harness = await harnessFor([1, 11, 12]);
        const before = await guardOf(harness, SEED_VERSION);
        let candidate = await splitSeason();
        for (const round of [12, 13]) {
          candidate = withRows(candidate, round, (rows) => [
            ...rows,
            splitRow('lando-norris', 'mclaren', rows.length + 1),
          ]);
        }

        const result = resultOf(await publishThrough(harness, candidate));

        expect(result.status).toBe('applied');
        const after = await guardOf(harness, result.version);
        expect(after.facts).toEqual(expect.arrayContaining(before.facts));
        expect(after.facts).toEqual(
          expect.arrayContaining([
            '12|lando-norris|mclaren',
            '13|lando-norris|mclaren',
          ]),
        );
      });
    });

    describe('the coordination constraints still hold before publication', () => {
      it('withholds a season whose classified race was selected from OpenF1', async () => {
        const source = await splitSeason();
        const round13 = source.results.find((result) => result.round === 13)!;
        const jolpica = completePort('jolpica', source);
        const reconciled = new FakePort('jolpica', (request) =>
          request.resource.kind === 'session-classification' &&
          request.resource.round === 13
            ? {
                outcome: 'failed',
                attempts: [attempt('j-13', 'failed')],
                reason: 'provider-unavailable',
              }
            : jolpica.fetchResource(request),
        );
        const openf1 = new FakePort('openf1', (request) =>
          request.resource.kind === 'session-classification' &&
          request.resource.round === 13
            ? {
                outcome: 'candidate',
                attempts: [attempt('o-13')],
                payload: {
                  kind: 'session-classification',
                  result: { ...round13, status: 'provisional' },
                },
              }
            : {
                outcome: 'failed',
                attempts: [attempt(`o-${request.resource.kind}`, 'failed')],
                reason: 'provider-unavailable',
              },
        );
        const run = await new MultiSourceCoordinator({
          ports: [reconciled, openf1],
          logger: new CapturingLogger(),
          provisionalSessionEndBound: testOnlyProvisionalBound,
        }).coordinate({ plan: fullPlan(source) });
        const harness = await harnessFor([1, 11, 12]);

        const outcome = await new CoordinatedSeasonPublication({
          commands: harness.commands,
          logger: harness.logger,
        }).publish(run, metadataFor(source), FIXED_NOW, 'caller-version');

        expect(outcome).toMatchObject({
          outcome: 'withheld',
          gap: 'inconsistent-references',
          relations: ['result-entry-span'],
        });
        expect(harness.publishCalls).toBe(0);
        await expectSeedOnly(harness);
      });

      it('publishes a Jolpica selection when an OpenF1 candidate was only considered', async () => {
        const source = await splitSeason();
        const openf1 = completePort('openf1', source);
        const run = await new MultiSourceCoordinator({
          ports: [completePort('jolpica', source), openf1],
          logger: new CapturingLogger(),
          provisionalSessionEndBound: testOnlyProvisionalBound,
        }).coordinate({ plan: fullPlan(source) });
        const selections = run.resources
          .filter(
            (resource) => resource.resource.kind === 'session-classification',
          )
          .map((resource) => resource.selection);
        expect(selections.length).toBeGreaterThan(0);
        // The provisional source was genuinely consulted, and lost.
        expect(openf1.requests.length).toBeGreaterThan(0);
        for (const selection of selections) {
          expect(selection).toMatchObject({
            outcome: 'selected',
            source: 'jolpica',
          });
        }
        const harness = await harnessFor([1, 11, 12]);

        const outcome = await new CoordinatedSeasonPublication({
          commands: harness.commands,
          logger: harness.logger,
        }).publish(
          run,
          { ...metadataFor(source), sourceUpdatedAt: FIRST_AT },
          FIXED_NOW,
          'caller-version',
        );

        expect(resultOf(outcome).status).toBe('applied');
      });

      it('withholds a missing classified calendar round before publication', async () => {
        // Round 11 is completed but unclassified while round 12 is classified.
        const source = await splitSeason();
        const gapped: ProviderSeasonSource = {
          ...source,
          results: source.results.map((result) =>
            result.round === 11
              ? { ...result, status: 'unavailable' as const, entries: [] }
              : result,
          ),
        };
        const harness = await harnessFor([1]);

        const outcome = await publishThrough(harness, gapped);

        expect(outcome).toMatchObject({
          outcome: 'withheld',
          gap: 'missing-round-classification',
        });
        expect(harness.publishCalls).toBe(0);
        await expectSeedOnly(harness);
      });
    });

    describe('every guarded failure maps onto the coordinated outcome', () => {
      it('reports a later candidate against the committed release, not the seed', async () => {
        const harness = await harnessFor([1, 11, 12]);
        const wide = resultOf(
          await publishThrough(harness, await splitSeason()),
        );
        expect(wide.status).toBe('applied');

        const narrow = resultOf(
          await publishThrough(
            harness,
            await splitSeason([1, 11, 12]),
            SECOND_AT,
          ),
        );

        expect(narrow).toMatchObject({
          status: 'rejected',
          reason: 'guard-round-coverage-regression',
          previousVersion: wide.version,
        });
        expect(harness.activeVersion()).toBe(wide.version);
        expect(harness.legacyPublishCalls).toBe(0);
        expectBoundedLogs(harness);
      });
    });
  },
);

describe('guard-authority-not-sequenced belongs to the guarded entry point', () => {
  it('is never produced by ordinary publication, which keeps its fallback', async () => {
    const harness = await publicationHarness({ cutover: 'none' });
    const set = await generatedSet(harness.context.clock, 'v-ordinary', {
      sourceUpdatedAt: FIRST_AT,
      contentVersion: '2026.07.18.9',
    });

    const ordinary = await harness.context.service.publish(set);
    const guarded = await harness.context.service.publishGuarded(set);

    expect(ordinary.status).toBe('applied');
    expect(ordinary.reason).toBeNull();
    expect(guarded.reason).toBe('guard-authority-not-sequenced');
    expect(harness.legacyPublishCalls).toBe(1);
  });

  it('refuses identically whatever the ordinary path would have done', async () => {
    // Active season: the two entry points share one guarded path, so a
    // regression is refused with the same reason by both.
    const narrow = await assembled(await splitSeason([1, 11, 12]));
    for (const entry of ['publish', 'publishGuarded'] as const) {
      const harness = await publicationHarness({
        seedSource: await assembled(await splitSeason()),
      });
      const set = generateSnapshotSet(
        { ...narrow, sourceUpdatedAt: FIRST_AT },
        FIXED_NOW,
        'v-narrow',
      );

      const result = await harness.context.service[entry](set);

      expect(result, entry).toMatchObject({
        status: 'rejected',
        reason: 'guard-round-coverage-regression',
      });
      expect(harness.legacyPublishCalls, entry).toBe(0);
    }
  });
});
