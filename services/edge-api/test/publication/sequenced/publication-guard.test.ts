/**
 * The D14/D15 guard bound to the authoritative predecessor (D16), through the
 * real sequenced publication service, over both the in-process sequencer and
 * the Durable Object client with a serialized transport
 * (ADR 0026 D14-D16; ADR 0025 D4, D8, D9).
 *
 * The seeded predecessor is a real mock release: round 12 is classified with
 * five facts. Every candidate here is that generator's output with only its
 * results documents reshaped, so contract validation passes and the guard is
 * what decides.
 */

import { describe, expect, it } from 'vitest';

import type { RaceResult } from '../../../src/contract/types';
import { readPredecessorGuard } from '../../../src/publication/guard/predecessor';
import {
  revisionInputForDocument,
  snapshotRevision,
} from '../../../src/publication/snapshot-revision';
import type { SeasonPublicationSequencerPort } from '../../../src/publication/sequencer';
import { SequencedPublicationService } from '../../../src/publication/sequenced/service';
import type { GeneratedSnapshotSet } from '../../../src/snapshots/generator';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../../src/storage/types';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import { MutableClock } from '../sequencer/support';
import {
  SEASON,
  SEED_VERSION,
  SidecarReadFailingStorage,
  generatedSet,
  portWith,
  recording,
  sequencedContext,
  sequencerTransports,
  type SequencedContext,
  type SequencerTransport,
} from './support';

const LATER_ORDERING = '2026-07-20T00:00:00.000Z';
const CLASSIFIED_ROUND = 12;
const OPEN_ROUND = 13;
const FIXTURE_IDENTIFIERS = [
  'max-verstappen',
  'lando-norris',
  'oscar-piastri',
  'charles-leclerc',
  'lewis-hamilton',
  'george-russell',
  'red-bull',
  'mclaren',
  'ferrari',
  'mercedes',
];

// --- candidates -------------------------------------------------------------

function resultsName(round: number): SnapshotDocumentName {
  return `grand-prix:${round}:results` as SnapshotDocumentName;
}

function withResults(
  set: GeneratedSnapshotSet,
  round: number,
  change: (result: RaceResult) => RaceResult,
): GeneratedSnapshotSet {
  const name = resultsName(round);
  if (!set.documents.some((document) => document.documentName === name)) {
    throw new Error(`no results document for round ${round}`);
  }
  return {
    ...set,
    documents: set.documents.map((document) =>
      document.documentName === name
        ? { ...document, data: change(document.data as RaceResult) }
        : document,
    ),
  };
}

function resultOf(set: GeneratedSnapshotSet, round: number): RaceResult {
  const document = set.documents.find(
    (item) => item.documentName === resultsName(round),
  );
  if (!document) throw new Error(`no results document for round ${round}`);
  return document.data as RaceResult;
}

/** Classifies the open round with the classified round's five drivers. */
function widened(set: GeneratedSnapshotSet): GeneratedSnapshotSet {
  const template = resultOf(set, CLASSIFIED_ROUND).entries;
  return withResults(set, OPEN_ROUND, (result) => ({
    ...result,
    status: 'final',
    entries: template.map((row) => ({ ...row })),
  }));
}

function withoutRound(set: GeneratedSnapshotSet): GeneratedSnapshotSet {
  return withResults(set, CLASSIFIED_ROUND, (result) => ({
    ...result,
    status: 'unavailable',
    entries: [],
    fastestLap: null,
  }));
}

function withoutDriver(
  set: GeneratedSnapshotSet,
  driverId: string,
): GeneratedSnapshotSet {
  return withResults(set, CLASSIFIED_ROUND, (result) => ({
    ...result,
    entries: result.entries.filter((row) => row.driverId !== driverId),
  }));
}

function withConstructor(
  set: GeneratedSnapshotSet,
  driverId: string,
  constructorId: string,
): GeneratedSnapshotSet {
  return withResults(set, CLASSIFIED_ROUND, (result) => ({
    ...result,
    entries: result.entries.map((row) =>
      row.driverId === driverId ? { ...row, constructorId } : row,
    ),
  }));
}

function withExtraDriver(set: GeneratedSnapshotSet): GeneratedSnapshotSet {
  return withResults(set, CLASSIFIED_ROUND, (result) => ({
    ...result,
    entries: [
      ...result.entries,
      {
        ...result.entries[0]!,
        driverId: 'george-russell',
        constructorId: 'mercedes',
        position: 6,
        gridPosition: 6,
        points: 8,
        fastestLap: false,
      },
    ],
  }));
}

/** Everything the guard ignores, changed at once. */
function reshuffled(set: GeneratedSnapshotSet): GeneratedSnapshotSet {
  return withResults(set, CLASSIFIED_ROUND, (result) => ({
    ...result,
    status: 'provisional',
    entries: [...result.entries].reverse().map((row, index) => ({
      ...row,
      position: index + 1,
      gridPosition: 20 - index,
      points: 30 - index,
      status: index === 4 ? 'dnf' : 'finished',
      dnfReason: index === 4 ? 'Hydraulics (mock)' : null,
      lapsBehind: null,
      fastestLap: index === 0,
    })),
    fastestLap: {
      driverId: result.entries.at(-1)!.driverId,
      timeMillis: 90123,
      lap: 7,
    },
  }));
}

async function laterSet(ctx: SequencedContext): Promise<GeneratedSnapshotSet> {
  return generatedSet(ctx.clock, 'ignored-by-sequencer', {
    sourceUpdatedAt: LATER_ORDERING,
    contentVersion: '2026.07.20.2',
  });
}

// --- wiring -----------------------------------------------------------------

function serviceWith(
  ctx: SequencedContext,
  overrides: {
    port?: SeasonPublicationSequencerPort;
    storage?: SnapshotStorage;
  },
): SequencedPublicationService {
  return new SequencedPublicationService({
    port: overrides.port ?? ctx.port,
    fallback: ctx.legacy,
    storage: overrides.storage ?? ctx.storage,
    validator: runtimeSnapshotValidator,
    purger: ctx.purger,
    logger: ctx.logger,
    clock: ctx.clock,
    purgeOrigin: 'https://api.gridview.local',
  });
}

async function activeVersion(ctx: SequencedContext): Promise<string> {
  const authority = await ctx.port.readAuthority(SEASON);
  if (authority.cutoverState !== 'active') throw new Error('not active');
  return authority.activeVersion;
}

/** Log events carry only bounded categories: no IDs, facts or revisions. */
function expectBoundedLogs(ctx: SequencedContext): void {
  const serialized = ctx.logger.serialized();
  for (const identifier of FIXTURE_IDENTIFIERS) {
    expect(serialized).not.toContain(identifier);
  }
  expect(serialized).not.toContain('sha256:');
  expect(serialized).not.toMatch(/\[\s*\d+\s*,/);
  for (const event of ctx.logger.events) {
    if (event.operation !== 'publication.guard.rejected') continue;
    expect(Object.keys(event).sort()).toEqual([
      'failureCategory',
      'level',
      'operation',
      'publicationStatus',
      'season',
    ]);
  }
}

function guardEvents(ctx: SequencedContext): unknown[] {
  return ctx.logger.events
    .filter((event) => event.operation === 'publication.guard.rejected')
    .map((event) => event.failureCategory);
}

/** Writes a historical legacy-format release: the seed's documents, reshaped. */
async function historicalRelease(
  ctx: SequencedContext,
  version: string,
  change: (set: GeneratedSnapshotSet) => GeneratedSnapshotSet,
): Promise<void> {
  const set = change(ctx.seedSet);
  for (const document of set.documents) {
    await ctx.storage.writeVersionedDocument(SEASON, version, document);
  }
  await ctx.storage.writeVersionInventory(
    SEASON,
    version,
    set.documents.map((document) => document.documentName),
  );
}

// --- the suite, over both transports --------------------------------------

describe.each(sequencerTransports)(
  'the publication guard over the %s transport',
  (transport: SequencerTransport) => {
    const context = (options: Parameters<typeof sequencedContext>[0] = {}) =>
      sequencedContext({ ...options, transport });

    describe('ordinary publication: D14 and D15', () => {
      it('publishes an exactly equivalent candidate', async () => {
        const ctx = await context();
        const result = await ctx.service.publish(await laterSet(ctx));
        expect(result).toMatchObject({
          status: 'applied',
          previousVersion: SEED_VERSION,
        });
        expectBoundedLogs(ctx);
      });

      it('publishes added rounds and added facts', async () => {
        const ctx = await context();
        const result = await ctx.service.publish(
          withExtraDriver(widened(await laterSet(ctx))),
        );
        expect(result.status).toBe('applied');
        expectBoundedLogs(ctx);
      });

      it('publishes changed positions, points, statuses, order and fastest lap', async () => {
        const ctx = await context();
        const result = await ctx.service.publish(
          reshuffled(await laterSet(ctx)),
        );
        expect(result.status).toBe('applied');
      });

      it('publishes a first classification over a zero-classified predecessor', async () => {
        const ctx = await context({ seedTransform: withoutRound });
        const predecessor = await readPredecessorGuard(
          ctx.storage,
          SEASON,
          SEED_VERSION,
        );
        expect(predecessor).toMatchObject({
          kind: 'read',
          guard: { classifiedRounds: [], facts: [] },
        });
        const result = await ctx.service.publish(await laterSet(ctx));
        expect(result.status).toBe('applied');
      });

      const regressions: Array<
        [string, (set: GeneratedSnapshotSet) => GeneratedSnapshotSet, string]
      > = [
        [
          'a previously classified round',
          withoutRound,
          'guard-round-coverage-regression',
        ],
        [
          'a published participation fact',
          (set) => withoutDriver(set, 'lewis-hamilton'),
          'guard-participation-fact-removed',
        ],
        [
          'a published constructor',
          (set) => withConstructor(set, 'lewis-hamilton', 'mclaren'),
          'guard-constructor-replaced',
        ],
      ];

      it.each(regressions)(
        'withholds a candidate that loses %s, before prepare, with nothing written',
        async (_label, change, reason) => {
          const ctx = await context();
          const { port, calls } = recording(ctx.port);
          const service = serviceWith(ctx, { port });
          ctx.logger.events.length = 0;
          ctx.storage.writeLog.length = 0;

          const result = await service.publish(change(await laterSet(ctx)));

          expect(result).toMatchObject({
            status: 'rejected',
            reason,
            previousVersion: SEED_VERSION,
          });
          expect(calls).toEqual(['readAuthority']);
          expect(ctx.storage.writeLog).toEqual([]);
          expect(await activeVersion(ctx)).toBe(SEED_VERSION);
          expect(await ctx.storage.listVersions(SEASON)).toEqual([
            SEED_VERSION,
          ]);
          expect(guardEvents(ctx)).toEqual([reason]);
          expectBoundedLogs(ctx);
        },
      );

      it('withholds a candidate whose own results are invalid', async () => {
        const ctx = await context();
        const duplicated = withResults(
          await laterSet(ctx),
          CLASSIFIED_ROUND,
          (result) => ({
            ...result,
            entries: [
              ...result.entries,
              { ...result.entries[0]!, position: 9 },
            ],
          }),
        );
        ctx.logger.events.length = 0;
        const result = await ctx.service.publish(duplicated);
        expect(result).toMatchObject({
          status: 'rejected',
          reason: 'guard-candidate-invalid',
        });
        expect(await activeVersion(ctx)).toBe(SEED_VERSION);
        expectBoundedLogs(ctx);
      });

      it('writes exactly the candidate, never predecessor content', async () => {
        const ctx = await context();
        const candidate = reshuffled(widened(await laterSet(ctx)));
        const result = await ctx.service.publish(candidate);
        expect(result.status).toBe('applied');

        const expectedNames = candidate.documents
          .map((document) => document.documentName)
          .sort();
        expect(
          await ctx.storage.readVersionInventory(SEASON, result.version),
        ).toEqual(expectedNames);
        for (const document of candidate.documents) {
          const written = await ctx.storage.readVersionedDocument(
            SEASON,
            result.version,
            document.documentName,
          );
          // Every document's stable content is the candidate's: only the
          // sequencer-assigned volatile timestamps are baked in (ADR 0025 D4),
          // and those are outside the revision. Results documents carry none,
          // so they are compared byte for byte.
          expect(
            await snapshotRevision(revisionInputForDocument(written!)),
          ).toBe(await snapshotRevision(revisionInputForDocument(document)));
          if (String(document.documentName).endsWith(':results')) {
            expect(written?.data).toEqual(document.data);
          }
        }
        // The classified round differs from the predecessor's, and the
        // candidate's own bytes are what was committed.
        const committed = await ctx.storage.readVersionedDocument(
          SEASON,
          result.version,
          resultsName(CLASSIFIED_ROUND),
        );
        const predecessor = await ctx.storage.readVersionedDocument(
          SEASON,
          SEED_VERSION,
          resultsName(CLASSIFIED_ROUND),
        );
        expect(committed?.data).not.toEqual(predecessor?.data);
        expect(committed?.data).toEqual(resultOf(candidate, CLASSIFIED_ROUND));
      });
    });

    describe('the predecessor is read and verified, never assumed', () => {
      it('fails closed when the predecessor inventory is unreadable', async () => {
        const ctx = await context();
        const storage = new SidecarReadFailingStorage(ctx.storage);
        storage.unreadableInventories.add(SEED_VERSION);
        const { port, calls } = recording(ctx.port);
        ctx.logger.events.length = 0;
        const result = await serviceWith(ctx, { port, storage }).publish(
          await laterSet(ctx),
        );
        expect(result).toMatchObject({
          status: 'failed',
          reason: 'guard-predecessor-unavailable',
        });
        expect(calls).toEqual(['readAuthority']);
        expectBoundedLogs(ctx);
      });

      it('fails closed when a predecessor results document reads as absent', async () => {
        const ctx = await context();
        const storage = new SidecarReadFailingStorage(ctx.storage);
        storage.hiddenDocuments.add(
          `${SEED_VERSION}|${resultsName(CLASSIFIED_ROUND)}`,
        );
        const result = await serviceWith(ctx, { storage }).publish(
          // A candidate that drops the round: an absent predecessor document
          // must not read as "nothing was classified".
          withoutRound(await laterSet(ctx)),
        );
        expect(result).toMatchObject({
          status: 'failed',
          reason: 'guard-predecessor-unavailable',
        });
        expect(await activeVersion(ctx)).toBe(SEED_VERSION);
      });

      it('fails closed when a predecessor results document is malformed', async () => {
        const ctx = await context();
        const original = await ctx.storage.readVersionedDocument(
          SEASON,
          SEED_VERSION,
          resultsName(CLASSIFIED_ROUND),
        );
        await ctx.storage.writeVersionedDocument(SEASON, SEED_VERSION, {
          ...original!,
          data: { ...(original!.data as object), entries: 'corrupted' },
        });
        const result = await ctx.service.publish(await laterSet(ctx));
        expect(result).toMatchObject({
          status: 'failed',
          reason: 'guard-predecessor-invalid',
        });
        expect(await activeVersion(ctx)).toBe(SEED_VERSION);
      });

      it('refuses predecessor content that is not what the sequencer committed', async () => {
        // Tampered KV: the predecessor now appears to lack one driver, so a
        // candidate that drops the same driver passes the Worker's comparison.
        // Only the sequencer's committed revisions reveal the tampering.
        const ctx = await context();
        const original = await ctx.storage.readVersionedDocument(
          SEASON,
          SEED_VERSION,
          resultsName(CLASSIFIED_ROUND),
        );
        const tampered: StoredSnapshot = {
          ...original!,
          data: {
            ...(original!.data as RaceResult),
            entries: (original!.data as RaceResult).entries.filter(
              (row) => row.driverId !== 'lewis-hamilton',
            ),
          },
        };
        await ctx.storage.writeVersionedDocument(
          SEASON,
          SEED_VERSION,
          tampered,
        );
        ctx.logger.events.length = 0;

        const result = await ctx.service.publish(
          withoutDriver(await laterSet(ctx), 'lewis-hamilton'),
        );

        expect(result).toMatchObject({
          status: 'failed',
          reason: 'guard-predecessor-invalid',
        });
        expect(await activeVersion(ctx)).toBe(SEED_VERSION);
        expect(await ctx.storage.listVersions(SEASON)).toEqual([SEED_VERSION]);
        expectBoundedLogs(ctx);
      });
    });

    describe('D16: overlapping candidates cannot publish a regression', () => {
      it('makes a candidate stale when the authority moves between comparison and prepare', async () => {
        const ctx = await context();
        const wide = widened(await laterSet(ctx));
        const narrow = await laterSet(ctx);
        let raced = false;
        const racingPort = portWith(ctx.port, {
          prepare: async (request) => {
            if (!raced) {
              raced = true;
              // The narrow run already compared against the seed. The wide run
              // commits first.
              expect((await ctx.service.publish(wide)).status).toBe('applied');
            }
            return ctx.port.prepare(request);
          },
        });

        const { port, calls } = recording(racingPort);
        const first = await serviceWith(ctx, { port }).publish(narrow);
        expect(first).toMatchObject({
          status: 'failed',
          reason: 'guard-predecessor-stale',
        });
        // Refused by the compare-and-swap at `prepare` itself: no operation
        // was admitted, so nothing was written, finalized or cleaned up.
        expect(calls).toEqual(['readAuthority', 'prepare']);
        const wideVersion = await activeVersion(ctx);
        expect(wideVersion).not.toBe(SEED_VERSION);

        // Rerun: compared against the wide release now, the narrow candidate is
        // a regression and is withheld.
        const rerun = await ctx.service.publish(narrow);
        expect(rerun).toMatchObject({
          status: 'rejected',
          reason: 'guard-round-coverage-regression',
        });
        expect(await activeVersion(ctx)).toBe(wideVersion);
        expectBoundedLogs(ctx);
      });

      it('refuses a second candidate as in progress while the first is prepared', async () => {
        const ctx = await context();
        const narrow = await laterSet(ctx);
        const wide = widened(await laterSet(ctx));
        let overlapped: Awaited<ReturnType<typeof ctx.service.publish>> | null =
          null;
        const overlappingPort = portWith(ctx.port, {
          finalize: async (request) => {
            if (overlapped === null) {
              overlapped = await ctx.service.publish(wide);
            }
            return ctx.port.finalize(request);
          },
        });

        const first = await serviceWith(ctx, { port: overlappingPort }).publish(
          narrow,
        );
        expect(overlapped).toMatchObject({
          status: 'failed',
          reason: 'sequencer-prepare-rejected',
        });
        expect(first.status).toBe('applied');

        // The wide candidate is a superset of what committed, so its rerun
        // publishes; the order of arrival never produced a regression.
        const rerun = await ctx.service.publish(wide);
        expect(rerun).toMatchObject({
          status: 'applied',
          previousVersion: first.version,
        });
      });

      it('never lets a displaced, expired operation finalize', async () => {
        const sequencerClock = new MutableClock(
          new Date('2026-07-20T12:00:00.000Z'),
        );
        const ctx = await context({ sequencerClock });
        const narrow = await laterSet(ctx);
        const wide = widened(await laterSet(ctx));
        let displaced = false;
        const slowPort = portWith(ctx.port, {
          finalize: async (request) => {
            if (!displaced) {
              displaced = true;
              sequencerClock.advance(16 * 60 * 1000);
              expect((await ctx.service.publish(wide)).status).toBe('applied');
            }
            return ctx.port.finalize(request);
          },
        });

        const result = await serviceWith(ctx, { port: slowPort }).publish(
          narrow,
        );

        expect(result).toMatchObject({
          status: 'failed',
          reason: 'sequencer-operation-superseded',
        });
        const guard = await readPredecessorGuard(
          ctx.storage,
          SEASON,
          await activeVersion(ctx),
        );
        expect(guard).toMatchObject({
          kind: 'read',
          guard: { classifiedRounds: [CLASSIFIED_ROUND, OPEN_ROUND] },
        });
      });
    });

    describe('failure recovery', () => {
      it('keeps the predecessor active after a failed write, and a retry binds to it', async () => {
        const storage = new MemorySnapshotStorage();
        const ctx = await context({ storage });
        storage.setWriteFailure((key) => key.includes(':calendar'));
        const failed = await ctx.service.publish(await laterSet(ctx));
        expect(failed).toMatchObject({
          status: 'failed',
          reason: 'storage-write',
        });
        expect(await activeVersion(ctx)).toBe(SEED_VERSION);

        storage.setWriteFailure(null);
        const retried = await ctx.service.publish(await laterSet(ctx));
        expect(retried).toMatchObject({
          status: 'applied',
          previousVersion: SEED_VERSION,
        });
      });

      it('re-drives a finalize whose answer was lost, once, and reports the commit', async () => {
        const ctx = await context();
        const { port, calls } = recording(losingFinalizeAnswers(ctx, 1));
        ctx.logger.events.length = 0;

        const result = await serviceWith(ctx, { port }).publish(
          widened(await laterSet(ctx)),
        );

        expect(result).toMatchObject({
          status: 'applied',
          previousVersion: SEED_VERSION,
        });
        expect(await activeVersion(ctx)).toBe(result.version);
        expect(calls.filter((call) => call === 'finalize')).toHaveLength(2);
        expect(calls).not.toContain('cancel');
        expect(calls).not.toContain('authorizeCleanup');
        expect(ctx.logger.events.map((event) => event.operation)).toContain(
          'publication.sequencer.finalize_uncertain',
        );
        expectBoundedLogs(ctx);
      });

      // Two uncertain `finalize` answers, and the one authority read that
      // follows them, are covered in `uncertain-finalize.test.ts`.

      it('reports a lost prepare answer as unavailable, never retries it, and cleans nothing', async () => {
        const sequencerClock = new MutableClock(
          new Date('2026-07-20T12:00:00.000Z'),
        );
        const ctx = await context({ sequencerClock });
        const { port, calls } = recording(losingPrepareAnswer(ctx));
        ctx.logger.events.length = 0;

        const result = await serviceWith(ctx, { port }).publish(
          await laterSet(ctx),
        );

        expect(result).toMatchObject({
          status: 'failed',
          reason: 'sequencer-authority-unavailable',
        });
        expect(calls).toEqual(['readAuthority', 'prepare']);
        expect(ctx.logger.events.map((event) => event.operation)).toContain(
          'publication.sequencer.prepare_uncertain',
        );
        expect(await activeVersion(ctx)).toBe(SEED_VERSION);

        // The operation it may have prepared holds the season until its TTL...
        expect(await ctx.service.publish(await laterSet(ctx))).toMatchObject({
          status: 'failed',
          reason: 'sequencer-prepare-rejected',
        });
        // ...and the existing expiry path recovers it.
        sequencerClock.advance(16 * 60 * 1000);
        expect(await ctx.service.publish(await laterSet(ctx))).toMatchObject({
          status: 'applied',
          previousVersion: SEED_VERSION,
        });
        expectBoundedLogs(ctx);
      });

      it('reports a prepare that never arrived exactly like a lost answer', async () => {
        const ctx = await context();
        const { port, calls } = recording(prepareNeverArrives(ctx));
        const result = await serviceWith(ctx, { port }).publish(
          await laterSet(ctx),
        );
        expect(result).toMatchObject({
          status: 'failed',
          reason: 'sequencer-authority-unavailable',
        });
        expect(calls).toEqual(['readAuthority', 'prepare']);
        expect(await activeVersion(ctx)).toBe(SEED_VERSION);
      });
    });

    describe('rollback is guarded exactly like publication', () => {
      it('commits a non-regressive rollback', async () => {
        const ctx = await context();
        const published = await ctx.service.publish(
          reshuffled(await laterSet(ctx)),
        );
        expect(published.status).toBe('applied');

        const rolledBack = await ctx.service.rollback(SEASON);
        expect(rolledBack).toMatchObject({
          status: 'applied',
          previousVersion: published.version,
        });
      });

      const regressive: Array<
        [string, (set: GeneratedSnapshotSet) => GeneratedSnapshotSet, string]
      > = [
        [
          'loses a classified round',
          widened,
          'guard-round-coverage-regression',
        ],
        [
          'removes a participation fact',
          withExtraDriver,
          'guard-participation-fact-removed',
        ],
      ];

      it.each(regressive)(
        'rejects a rollback that %s',
        async (_label, advance, reason) => {
          const ctx = await context();
          const published = await ctx.service.publish(
            advance(await laterSet(ctx)),
          );
          expect(published.status).toBe('applied');
          ctx.logger.events.length = 0;

          const rolledBack = await ctx.service.rollback(SEASON);

          expect(rolledBack).toMatchObject({ status: 'rejected', reason });
          expect(await activeVersion(ctx)).toBe(published.version);
          expect(guardEvents(ctx)).toEqual([reason]);
          expect(
            ctx.logger.events.find(
              (event) => event.operation === 'publication.guard.rejected',
            ),
          ).toMatchObject({ publicationStatus: 'rollback-republication' });
          expectBoundedLogs(ctx);
        },
      );

      it('rejects a rollback that would replace a published constructor', async () => {
        const ctx = await context();
        await historicalRelease(ctx, 'v-historical-swap', (set) =>
          withConstructor(set, 'lewis-hamilton', 'mclaren'),
        );
        const rolledBack = await ctx.service.rollback(
          SEASON,
          'v-historical-swap',
        );
        expect(rolledBack).toMatchObject({
          status: 'rejected',
          reason: 'guard-constructor-replaced',
        });
        expect(await activeVersion(ctx)).toBe(SEED_VERSION);
        expectBoundedLogs(ctx);
      });

      it('anchors the next publication on a committed rollback’s own revisions', async () => {
        const ctx = await context();
        await historicalRelease(ctx, 'v-historical-wide', widened);

        const rolledBack = await ctx.service.rollback(
          SEASON,
          'v-historical-wide',
        );
        expect(rolledBack).toMatchObject({
          status: 'applied',
          previousVersion: SEED_VERSION,
        });
        const anchor = await readPredecessorGuard(
          ctx.storage,
          SEASON,
          rolledBack.version,
        );
        const target = await readPredecessorGuard(
          ctx.storage,
          SEASON,
          'v-historical-wide',
        );
        if (anchor.kind !== 'read' || target.kind !== 'read') {
          throw new Error('expected readable releases');
        }
        expect(anchor.guardDocuments).toEqual(target.guardDocuments);

        // The seed-shaped candidate is now a regression against the rollback.
        expect(await ctx.service.publish(await laterSet(ctx))).toMatchObject({
          status: 'rejected',
          reason: 'guard-round-coverage-regression',
        });
        expect(
          await ctx.service.publish(widened(await laterSet(ctx))),
        ).toMatchObject({
          status: 'applied',
          previousVersion: rolledBack.version,
        });
      });
    });

    // --- transport-specific loss --------------------------------------------

    /** Executes finalize for real, then loses its first `lost` answers. */
    function losingFinalizeAnswers(
      ctx: SequencedContext,
      lost: number,
    ): SeasonPublicationSequencerPort {
      let remaining = lost;
      if (transport === 'durable-object') {
        ctx.transport!.intercept = async (command, run) => {
          const response = await run();
          if (command === 'finalize' && remaining > 0) {
            remaining -= 1;
            throw new Error('response lost after the object committed');
          }
          return response;
        };
        return ctx.port;
      }
      return portWith(ctx.port, {
        finalize: async (request) => {
          const answer = await ctx.port.finalize(request);
          if (remaining > 0) {
            remaining -= 1;
            throw new Error('response lost after the sequencer committed');
          }
          return answer;
        },
      });
    }

    /** Executes one prepare for real, then loses its answer. */
    function losingPrepareAnswer(
      ctx: SequencedContext,
    ): SeasonPublicationSequencerPort {
      let lost = false;
      if (transport === 'durable-object') {
        ctx.transport!.intercept = async (command, run) => {
          const response = await run();
          if (command === 'prepare' && !lost) {
            lost = true;
            return new Response('<html>gateway timeout</html>', {
              status: 504,
            });
          }
          return response;
        };
        return ctx.port;
      }
      return portWith(ctx.port, {
        prepare: async (request) => {
          const answer = await ctx.port.prepare(request);
          if (!lost) {
            lost = true;
            throw new Error('response lost after the sequencer prepared');
          }
          return answer;
        },
      });
    }

    /** A prepare that fails before reaching the sequencer at all. */
    function prepareNeverArrives(
      ctx: SequencedContext,
    ): SeasonPublicationSequencerPort {
      if (transport === 'durable-object') {
        ctx.transport!.intercept = async (command, run) => {
          if (command === 'prepare') throw new Error('binding unavailable');
          return run();
        };
        return ctx.port;
      }
      return portWith(ctx.port, {
        prepare: async () => {
          throw new Error('binding unavailable');
        },
      });
    }
  },
);
