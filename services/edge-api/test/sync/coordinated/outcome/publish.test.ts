/**
 * The publication half of the coordinated orchestration, end to end, over the
 * real C2 policy, the real C1 store, the real composition, the real bridge,
 * the real guarded sequenced publication (D14-D16 guard, prepare, candidate
 * write, finalize) and the real sequencer - in process, and through both
 * Durable Object clients (the sequencer's and the ledger's). Only the
 * transport, the limiter double and the clock are synthetic, and every run
 * builds a fresh ledger client, so each one restarts from committed state.
 *
 * Every case pins the provider requests, the guarded publications, the
 * releases committed, the lease release and the durable writes each run made.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readStoredPublicationMetadata } from '../../../../src/publication/publication-metadata';
import { LEASE_TTL_MS } from '../../../../src/sync/coordinated/ledger';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import {
  observeCoordinatedSeason,
  type CoordinatedObservationOutcome,
} from '../../../../src/sync/coordinated/observation';
import { checkTime } from '../../../../src/sync/coordinated/policy';
import { envelope, fullSeasonRaces } from '../../../providers/jolpica/support';
import { sequencerTransports } from '../../../publication/sequenced/support';
import {
  HOUR,
  ObservationHarness,
  PRE_SEASON,
  SEASON,
  anchorOf,
  paced,
  paths,
  seasonPaths,
  tickAfter,
} from '../observation/support';

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(globalFetch).not.toHaveBeenCalled();
});

const MINUTE = 60 * 1000;
const SEED = 'v-seed-legacy';
const SHA = /^sha256:[0-9a-f]{64}$/;
const later = (at: string, millis: number) =>
  new Date(Date.parse(at) + millis).toISOString();

/** The first publication run: six season-level requests, one hour in. */
const FIRST_PUBLICATION = later(PRE_SEASON, HOUR);

/** The durable writes of a run that published: observation, reservation, outcome. */
const publishingRun = [
  'acquireLease',
  'reconcilePublishedRevisions',
  'commit',
  'commit',
  'commit',
  'releaseLease',
  // The attention read every scheduled run ends with (PR-E2).
  'readSeason',
];
/** A publication run that never reserved: observation and outcome commits. */
const settlingRun = [
  'acquireLease',
  'reconcilePublishedRevisions',
  'commit',
  'commit',
  'releaseLease',
  'readSeason',
];
const idleRun = [
  'acquireLease',
  'reconcilePublishedRevisions',
  'releaseLease',
  'readSeason',
];

/** `target` with some methods replaced; the rest still reach `target`. */
function overriding<T extends object>(target: T, methods: Partial<T>): T {
  return Object.assign(Object.create(target) as T, methods);
}

/** A ledger whose `n`th commit is replaced by `fault`. */
function faultyCommit(
  harness: ObservationHarness,
  n: number,
  fault: (
    base: ReconciliationLedgerPort,
    request: Parameters<ReconciliationLedgerPort['commit']>[0],
  ) => ReturnType<ReconciliationLedgerPort['commit']>,
  extra: Partial<ReconciliationLedgerPort> = {},
): ReconciliationLedgerPort {
  const base = harness.freshLedger();
  let commits = 0;
  return harness.recorded(
    overriding(base, {
      commit: async (request) => {
        commits += 1;
        return commits === n ? fault(base, request) : base.commit(request);
      },
      ...extra,
    }),
  );
}

describe.each(sequencerTransports)(
  'coordinated publication over the %s transport',
  (transport) => {
    async function bootstrapped(
      seed: 'mock' | 'unclassified' = 'unclassified',
    ): Promise<ObservationHarness> {
      const harness = await ObservationHarness.create({ transport, seed });
      await harness.run(PRE_SEASON);
      return harness;
    }

    /** Bootstrapped, with the pre-season release published. */
    async function prePublished(): Promise<{
      harness: ObservationHarness;
      release: string;
    }> {
      const harness = await bootstrapped();
      await harness.run(FIRST_PUBLICATION);
      const [release] = harness.releases();
      if (release === undefined) throw new Error('nothing was published');
      return { harness, release };
    }

    it('publishes one release, records it and only then releases the lease', async () => {
      const harness = await bootstrapped();

      const run = await harness.run(FIRST_PUBLICATION);

      const [release] = harness.releases();
      const observed = paced(FIRST_PUBLICATION, 6);
      expect(run.outcome).toEqual({
        season: SEASON,
        trigger: 'scheduled',
        status: 'observed',
        plan: 'publication',
        coordination: 'completed',
        providerRequests: 6,
        committed: true,
        events: { 'refresh.first-observation': 4, 'refresh.unchanged': 1 },
        publication: {
          outcome: 'published',
          releaseVersion: release,
          reason: null,
          publishCalls: 1,
          next: 'completed',
        },
        leaseRelease: 'released',
      });
      expect(run.requests).toEqual(seasonPaths);
      expect(run.reservations).toBe(6);
      expect(run.publishCalls).toBe(1);
      expect(harness.releases()).toEqual([release]);
      expect(release).toMatch(/^pm1-/);
      expect(harness.activeVersion()).toBe(release);
      expect(run.ledgerCalls).toEqual(publishingRun);

      const season = await harness.season();
      expect(season.publicationDueAt).toBeNull();
      expect(season.publicationDisposition).toBeNull();
      // O-13: the release-wide ordering input is the observation instant.
      expect(season.lastOrderingInput).toBe(observed);
      expect(season.lastPublication).toEqual({
        digest: expect.stringMatching(SHA),
        activeVersion: release,
        publishedAt: observed,
        confirmedAt: observed,
      });
      expect(
        await readStoredPublicationMetadata(harness.storage, SEASON, release!),
      ).toMatchObject({
        kind: 'record',
        record: { sourceOrderingInput: observed },
      });

      // O-14: curated metadata, never a provider value.
      const manifest = await harness.storage.readVersionedDocument(
        SEASON,
        release!,
        'content:manifest',
      );
      expect(manifest?.data).toMatchObject({
        contentVersion: '2026.09.29.1',
        mediaVersion: null,
        attributionVersion: 'data-sources-v1',
      });
      const seasonDocument = await harness.storage.readVersionedDocument(
        SEASON,
        release!,
        'season',
      );
      expect(seasonDocument?.data).toMatchObject({
        label: '2026 FIA Formula One World Championship',
      });
    });

    it('confirms an identical candidate without calling the guarded publisher', async () => {
      const { harness, release } = await prePublished();
      const before = await harness.season();

      // A manual run is a forced publication run over the same content.
      const at = later(PRE_SEASON, 2 * HOUR);
      const run = await harness.run(at, { trigger: 'manual' });

      expect(run.outcome).toMatchObject({
        status: 'observed',
        plan: 'publication',
        providerRequests: 6,
        publication: {
          outcome: 'unchanged',
          publishCalls: 0,
          next: 'completed',
        },
        leaseRelease: 'released',
      });
      expect(run.publishCalls).toBe(0);
      expect(harness.releases()).toEqual([release]);
      expect(harness.activeVersion()).toBe(release);
      // No reservation: the outcome commit is the only durable write after
      // the observations. A manual run makes no attention read.
      expect(run.ledgerCalls).toEqual(settlingRun.slice(0, -1));
      const after = await harness.season();
      expect(after.lastOrderingInput).toBe(before.lastOrderingInput);
      expect(after.lastPublication).toEqual({
        ...before.lastPublication,
        confirmedAt: paced(at, 6),
      });
      expect(after.publicationDisposition).toBeNull();
    });

    it('publishes changed content, and holds an uncorroborated change for its next cadence check', async () => {
      const { harness, release: preSeason } = await prePublished();
      const digests = [(await harness.season()).lastPublication!.digest];

      harness.server.results.set(1, 'A');
      const first = await harness.run(tickAfter(1, 5));
      expect(first.outcome).toMatchObject({
        providerRequests: 7,
        publication: { outcome: 'published', publishCalls: 1 },
      });
      expect(first.requests).toEqual([...seasonPaths, paths.results(1)]);
      digests.push((await harness.season()).lastPublication!.digest);

      // The same classification again: confirmed, and unchanged.
      const confirming = await harness.run(tickAfter(1, 9));
      expect(confirming.outcome).toMatchObject({
        publication: { outcome: 'unchanged', publishCalls: 0 },
      });

      // A changed classification is pending until corroborated, so the run
      // withholds and the publication waits for the next cadence check -
      // not an hourly retry.
      harness.server.results.set(1, 'B');
      const pending = await harness.run(tickAfter(1, 15));
      expect(pending.outcome).toMatchObject({
        publication: {
          outcome: 'withheld',
          cause: 'classification-pending',
          publishCalls: 0,
          next: 'cadence',
        },
      });
      expect(pending.publishCalls).toBe(0);
      expect(pending.ledgerCalls).toEqual(settlingRun);
      expect((await harness.season()).publicationDueAt).toBe(
        checkTime(anchorOf(1).toISOString(), 4).toISOString(),
      );

      const corroborated = await harness.run(tickAfter(1, 24));
      expect(corroborated.outcome).toMatchObject({
        events: { 'classification.overwrite': 1 },
        publication: { outcome: 'published', publishCalls: 1 },
      });
      digests.push((await harness.season()).lastPublication!.digest);

      expect(harness.releases()).toHaveLength(3);
      expect(harness.releases()[0]).toBe(preSeason);
      expect(new Set(digests).size).toBe(3);
      expect(harness.activeVersion()).toBe(harness.releases()[2]);

      // The next run reconciles the published revision from the authority.
      await harness.run(tickAfter(1, 25));
      const record = await harness.record(1);
      expect(record?.publishedRevision).toBe(record?.contentRevision);
    });

    it('republishes an identical candidate once another writer replaced the release', async () => {
      const { harness, release } = await prePublished();
      const digest = (await harness.season()).lastPublication!.digest;

      // Nothing is due an hour later.
      const quiet = await harness.run(later(PRE_SEASON, 2 * HOUR));
      expect(quiet.outcome).toMatchObject({ status: 'nothing-due' });

      // An operator rollback: another writer, and another active version.
      const rolledBack = await harness.context.service.rollback(SEASON);
      expect(rolledBack.status).toBe('applied');
      expect(harness.activeVersion()).toBe(rolledBack.version);

      const run = await harness.run(later(PRE_SEASON, 3 * HOUR));

      // Only the version change made a publication due; the digest is the
      // same, and the skip is refused because the version is not.
      expect(run.outcome).toMatchObject({
        plan: 'publication',
        providerRequests: 6,
        publication: { outcome: 'published', publishCalls: 1 },
      });
      expect(run.publishCalls).toBe(1);
      const republished = harness.releases().at(-1)!;
      expect([release, rolledBack.version]).not.toContain(republished);
      expect(harness.activeVersion()).toBe(republished);
      expect((await harness.season()).lastPublication).toMatchObject({
        digest,
        activeVersion: republished,
      });

      // Recorded again, the drift is gone.
      const settled = await harness.run(later(PRE_SEASON, 4 * HOUR));
      expect(settled.outcome).toMatchObject({ status: 'nothing-due' });
    });

    it('finds a version change that raced a no-change decision at the next tick', async () => {
      const { harness, release } = await prePublished();

      // The writer lands after the fresh authority read confirmed the
      // recorded release, and before the outcome commit.
      let rolledBack: string | null = null;
      const racing = faultyCommit(harness, 2, async (base, request) => {
        const result = await harness.context.service.rollback(SEASON);
        rolledBack = result.version;
        return base.commit(request);
      });
      const run = await harness.run(later(PRE_SEASON, 2 * HOUR), {
        trigger: 'manual',
        ledger: racing,
      });
      expect(run.outcome).toMatchObject({
        publication: { outcome: 'unchanged', publishCalls: 0 },
      });
      expect(harness.activeVersion()).toBe(rolledBack);
      expect((await harness.season()).lastPublication?.activeVersion).toBe(
        release,
      );

      // Not lost: the next scheduled tick sees the drift and republishes.
      const next = await harness.run(later(PRE_SEASON, 3 * HOUR));
      expect(next.outcome).toMatchObject({
        plan: 'publication',
        publication: { outcome: 'published', publishCalls: 1 },
      });
      expect(harness.activeVersion()).toBe(harness.releases().at(-1));
      expect(harness.releases()).toHaveLength(2);
    });

    it('keeps the lease through publication: an overlapping run sends nothing', async () => {
      const harness = await bootstrapped();
      const overlapping: CoordinatedObservationOutcome[] = [];
      const requestsBefore = harness.server.requests.length;
      harness.onPublish = async () => {
        overlapping.push(
          await observeCoordinatedSeason(
            { season: SEASON, trigger: 'manual' },
            harness.dependencies({ ledger: harness.freshLedger() }),
          ),
        );
      };

      const run = await harness.run(FIRST_PUBLICATION);

      expect(overlapping).toEqual([
        {
          season: SEASON,
          trigger: 'manual',
          status: 'run-in-progress',
          providerRequests: 0,
        },
      ]);
      expect(harness.server.requests.length - requestsBefore).toBe(6);
      expect(run.publishCalls).toBe(1);
      expect(harness.releases()).toHaveLength(1);
      expect(run.outcome).toMatchObject({
        publication: { outcome: 'published' },
        leaseRelease: 'released',
      });
      expect(run.ledgerCalls).toEqual(publishingRun);
    });

    it('holds a staged correction for an operator instead of retrying every hour', async () => {
      const { harness } = await prePublished();
      harness.server.results.set(1, 'A');
      await harness.run(tickAfter(1, 5));
      harness.server.results.set(1, 'B');
      for (const hours of [9, 15, 24]) await harness.run(tickAfter(1, hours));
      expect((await harness.record(1))?.reviewState).toBe('settled');
      const releases = harness.releases().length;

      // A late correction is sighted by a reread, then staged.
      harness.server.results.set(1, 'C');
      harness.server.results.set(2, 'A');
      const sighting = await harness.run(tickAfter(2, 5));
      expect(sighting.outcome).toMatchObject({
        publication: {
          outcome: 'withheld',
          cause: 'classification-pending',
          next: 'cadence',
        },
      });
      const stagedAt = tickAfter(2, 9);
      const staging = await harness.run(stagedAt);
      expect(staging.outcome).toMatchObject({
        events: { 'classification.staged-correction': 1 },
        publication: {
          outcome: 'withheld',
          cause: 'classification-staged',
          publishCalls: 0,
          next: 'blocked',
        },
      });
      const blocked = await harness.season();
      expect(blocked.publicationDueAt).toBeNull();
      expect(blocked.publicationDisposition).toEqual({
        state: 'blocked',
        since: paced(stagedAt, 8),
        reason: 'classification-staged',
      });
      const warned = harness.logger.events.at(-1);
      expect(warned).toMatchObject({
        level: 'warn',
        publicationNextDue: 'blocked',
        publicationReason: 'classification-staged',
      });

      // No hourly retry: the next ticks send nothing.
      for (const hours of [10, 11, 12, 13, 14]) {
        const tick = await harness.run(tickAfter(2, hours));
        expect(tick.outcome).toMatchObject({ status: 'nothing-due' });
        expect(tick.requests).toEqual([]);
      }
      // A cadence check still observes, and is still held, since unchanged.
      const cadence = await harness.run(tickAfter(2, 15));
      expect(cadence.outcome).toMatchObject({
        publication: { cause: 'classification-staged', next: 'blocked' },
      });
      expect((await harness.season()).publicationDisposition).toEqual(
        blocked.publicationDisposition,
      );
      expect(harness.releases()).toHaveLength(releases);
    });

    it('holds a D14 refusal for an operator', async () => {
      // The mock baseline classifies round 12; a pre-season candidate cannot.
      const harness = await bootstrapped('mock');

      const run = await harness.run(FIRST_PUBLICATION);

      expect(run.outcome).toMatchObject({
        publication: {
          outcome: 'not-applied',
          publicationStatus: 'rejected',
          reason: 'guard-round-coverage-regression',
          publishCalls: 1,
          next: 'blocked',
        },
      });
      expect(run.ledgerCalls).toEqual(publishingRun);
      expect(harness.releases()).toEqual([]);
      expect(harness.activeVersion()).toBe(SEED);
      const season = await harness.season();
      expect(season.publicationDueAt).toBeNull();
      expect(season.publicationDisposition).toMatchObject({
        state: 'blocked',
        reason: 'guard-round-coverage-regression',
      });
      // The reserved ordering input stays consumed; nothing was published.
      expect(season.lastOrderingInput).toBe(paced(FIRST_PUBLICATION, 6));
      expect(season.lastPublication).toBeNull();

      for (const hours of [2, 3, 4, 5]) {
        const tick = await harness.run(later(PRE_SEASON, hours * HOUR));
        expect(tick.outcome).toMatchObject({ status: 'nothing-due' });
        expect(tick.publishCalls).toBe(0);
      }
    });

    it('keeps a D14 block through a manual retry that did not decide it', async () => {
      const harness = await bootstrapped('mock');
      await harness.run(FIRST_PUBLICATION);
      const held = (await harness.season()).publicationDisposition;
      expect(held).toMatchObject({
        state: 'blocked',
        reason: 'guard-round-coverage-regression',
      });

      // An operator retries by hand, and the run is cancelled.
      const controller = new AbortController();
      harness.server.onRequest = (path) => {
        if (path === paths.drivers) controller.abort();
      };
      const manual = await harness.run(later(PRE_SEASON, 2 * HOUR), {
        trigger: 'manual',
        signal: controller.signal,
      });
      expect(manual.outcome).toMatchObject({
        coordination: 'cancelled',
        publication: { outcome: 'withheld', cause: 'cancelled', next: 'retry' },
      });
      expect(manual.publishCalls).toBe(0);
      const after = await harness.season();
      // Still held for an operator, and still visible: not silently forgotten.
      expect(after.publicationDisposition).toEqual(held);
      expect(after.publicationDueAt).toBeNull();

      harness.server.onRequest = () => {};
      const tick = await harness.run(later(PRE_SEASON, 3 * HOUR));
      expect(tick.outcome).toMatchObject({ status: 'nothing-due' });
      expect((await harness.season()).publicationDisposition).toEqual(held);
      expect(harness.releases()).toEqual([]);
    });

    it('holds a D15 refusal for an operator, and asks again only at a cadence check', async () => {
      const { harness } = await prePublished();
      harness.server.results.set(1, 'A');
      await harness.run(tickAfter(1, 5));
      const releases = harness.releases().length;

      // Jolpica drops a classified driver, and keeps doing so.
      harness.server.results.set(1, 'D');
      await harness.run(tickAfter(1, 9));
      const refusedAt = tickAfter(1, 15);
      const refused = await harness.run(refusedAt);
      expect(refused.outcome).toMatchObject({
        events: { 'classification.overwrite': 1 },
        publication: {
          outcome: 'not-applied',
          publicationStatus: 'rejected',
          reason: 'guard-participation-fact-removed',
          publishCalls: 1,
          next: 'blocked',
        },
      });
      const held = await harness.season();
      expect(held.publicationDueAt).toBeNull();
      expect(held.publicationDisposition).toMatchObject({
        state: 'blocked',
        reason: 'guard-participation-fact-removed',
      });

      for (const hours of [16, 17, 18]) {
        const tick = await harness.run(tickAfter(1, hours));
        expect(tick.outcome).toMatchObject({ status: 'nothing-due' });
      }
      const cadence = await harness.run(tickAfter(1, 24));
      expect(cadence.publishCalls).toBe(1);
      expect(cadence.outcome).toMatchObject({
        publication: { reason: 'guard-participation-fact-removed' },
      });
      expect((await harness.season()).publicationDisposition).toEqual(
        held.publicationDisposition,
      );
      expect(harness.releases()).toHaveLength(releases);
    });

    it('retries a cancelled publication at the next tick, not never', async () => {
      const { harness } = await prePublished();
      // The calendar's next observation finds the last race moved, which
      // makes a publication due at the next tick and nothing else.
      const races = [...fullSeasonRaces()];
      races[22] = { ...races[22], time: '14:00:00Z' };
      harness.server.answers.set(paths.calendar, () => ({
        kind: 'json',
        body: envelope(races),
      }));
      const observation = await harness.run(later(PRE_SEASON, 8 * HOUR));
      expect(observation.outcome).toMatchObject({
        plan: 'observation',
        events: { 'refresh.overwrite': 1 },
        publication: 'not-attempted',
      });

      const controller = new AbortController();
      harness.server.onRequest = (path) => {
        if (path === paths.drivers) controller.abort();
      };
      const run = await harness.run(later(PRE_SEASON, 9 * HOUR), {
        signal: controller.signal,
      });

      expect(run.outcome).toMatchObject({
        status: 'observed',
        plan: 'publication',
        coordination: 'cancelled',
        publication: {
          outcome: 'withheld',
          cause: 'cancelled',
          publishCalls: 0,
          next: 'retry',
        },
      });
      expect(run.publishCalls).toBe(0);
      expect(run.ledgerCalls).toEqual(settlingRun);
      const settledAt = harness.clock.now().toISOString();
      const season = await harness.season();
      // The observation commit cleared the due publication; the outcome
      // commit set it again.
      expect(season.publicationDueAt).toBe(later(settledAt, HOUR));
      expect(season.publicationDisposition).toBeNull();

      harness.server.onRequest = () => {};
      const early = await harness.run(later(settledAt, 30 * MINUTE));
      expect(early.outcome).toMatchObject({ status: 'nothing-due' });
      const retry = await harness.run(later(settledAt, HOUR));
      expect(retry.outcome).toMatchObject({
        plan: 'publication',
        publication: { outcome: 'published', publishCalls: 1 },
      });
      expect(harness.releases()).toHaveLength(2);
    });

    it('resolves a committed release whose finalize answer was lost, without publishing again', async () => {
      const harness = await bootstrapped();
      let lost = false;
      harness.portHooks.set('finalize', async (run) => {
        await run();
        lost = true;
        throw new Error('answer lost');
      });
      harness.portHooks.set('readAuthority', async (run) => {
        if (lost) throw new Error('unreachable');
        return run();
      });

      const run = await harness.run(FIRST_PUBLICATION);

      expect(run.outcome).toMatchObject({
        status: 'observed',
        publication: {
          outcome: 'not-applied',
          publicationStatus: 'failed',
          reason: 'sequencer-authority-unavailable',
          publishCalls: 1,
          next: 'resolve',
        },
      });
      // The reservation is the durable decision: no outcome commit.
      expect(run.ledgerCalls).toEqual([
        'acquireLease',
        'reconcilePublishedRevisions',
        'commit',
        'commit',
        'releaseLease',
        'readSeason',
      ]);
      const committed = harness.activeVersion();
      expect(committed).not.toBe(SEED);
      expect(harness.releases()).toEqual([]);
      const pending = await harness.season();
      expect(pending.publicationDisposition).toEqual({
        state: 'publishing',
        since: paced(FIRST_PUBLICATION, 6),
        digest: expect.stringMatching(SHA),
        orderingInput: paced(FIRST_PUBLICATION, 6),
      });
      expect(pending.lastPublication).toBeNull();

      harness.portHooks.clear();
      const next = await harness.run(later(PRE_SEASON, 2 * HOUR));

      expect(next.outcome).toMatchObject({ status: 'nothing-due' });
      expect(next.requests).toEqual([]);
      expect(next.publishCalls).toBe(0);
      expect(next.ledgerCalls).toEqual([
        'acquireLease',
        'reconcilePublishedRevisions',
        'commit',
        'releaseLease',
        'readSeason',
      ]);
      const resolved = await harness.season();
      expect(resolved.publicationDisposition).toBeNull();
      expect(resolved.lastPublication).toMatchObject({
        digest:
          pending.publicationDisposition!.state === 'publishing'
            ? pending.publicationDisposition!.digest
            : null,
        activeVersion: committed,
      });
      expect(harness.activeVersion()).toBe(committed);
    });

    it('publishes afresh when a lost finalize never reached the sequencer', async () => {
      const harness = await bootstrapped();
      harness.portHooks.set('finalize', async () => {
        throw new Error('never arrived');
      });

      const run = await harness.run(FIRST_PUBLICATION);

      expect(run.outcome).toMatchObject({
        publication: {
          reason: 'sequencer-authority-unavailable',
          next: 'resolve',
        },
      });
      expect(harness.activeVersion()).toBe(SEED);

      harness.portHooks.clear();
      const next = await harness.run(later(PRE_SEASON, 2 * HOUR));

      // The unfinished publication is found not committed and made due, and
      // the same run publishes a fresh candidate through every guard.
      expect(next.outcome).toMatchObject({
        plan: 'publication',
        providerRequests: 6,
        publication: { outcome: 'published', publishCalls: 1 },
      });
      expect(next.ledgerCalls).toEqual([
        'acquireLease',
        'reconcilePublishedRevisions',
        'commit',
        'commit',
        'commit',
        'commit',
        'releaseLease',
        'readSeason',
      ]);
      expect(harness.releases()).toHaveLength(1);
      expect(harness.activeVersion()).toBe(harness.releases()[0]);
      expect(harness.publishGuarded).toHaveBeenCalledTimes(2);
    });

    it('reports a failed outcome commit as a failure, and the next run recognizes the release', async () => {
      const harness = await bootstrapped();
      const failing = faultyCommit(harness, 3, async () => ({
        outcome: 'unavailable',
      }));

      const run = await harness.run(FIRST_PUBLICATION, { ledger: failing });

      const [release] = harness.releases();
      expect(run.outcome).toEqual({
        season: SEASON,
        trigger: 'scheduled',
        status: 'failed',
        stage: 'outcome',
        failure: 'ledger-unavailable',
        ledgerRejection: null,
        providerRequests: 6,
        leaseRelease: 'released',
        publication: {
          outcome: 'published',
          releaseVersion: release,
          reason: null,
          publishCalls: 1,
          next: 'completed',
        },
      });
      expect(harness.logger.events.at(-1)).toMatchObject({
        level: 'warn',
        coordinationStatus: 'failed',
        observationStage: 'outcome',
      });
      expect((await harness.season()).publicationDisposition).toMatchObject({
        state: 'publishing',
        digest: expect.stringMatching(SHA),
      });

      const next = await harness.run(later(PRE_SEASON, 2 * HOUR));
      expect(next.outcome).toMatchObject({ status: 'nothing-due' });
      expect(next.publishCalls).toBe(0);
      expect(harness.releases()).toEqual([release]);
      expect((await harness.season()).lastPublication?.activeVersion).toBe(
        release,
      );
    });

    it('reports an uncertain outcome commit as a failure, without a second release', async () => {
      const harness = await bootstrapped();
      const uncertain = faultyCommit(harness, 3, async (base, request) => {
        await base.commit(request);
        return { outcome: 'uncertain' };
      });

      const run = await harness.run(FIRST_PUBLICATION, { ledger: uncertain });

      expect(run.outcome).toMatchObject({
        status: 'failed',
        stage: 'outcome',
        failure: 'ledger-uncertain',
        publication: { outcome: 'published' },
      });
      const next = await harness.run(later(PRE_SEASON, 2 * HOUR));
      expect(next.outcome).toMatchObject({ status: 'nothing-due' });
      expect(next.ledgerCalls).toEqual(idleRun);
      expect(harness.releases()).toHaveLength(1);
    });

    it('recognizes a release committed before a crash lost the outcome commit', async () => {
      const harness = await bootstrapped();
      const crashing = faultyCommit(
        harness,
        3,
        async () => {
          throw new Error('isolate evicted');
        },
        {
          releaseLease: async () => {
            throw new Error('isolate evicted');
          },
        },
      );

      await expect(
        harness.run(FIRST_PUBLICATION, { ledger: crashing }),
      ).rejects.toThrow('isolate evicted');
      const [release] = harness.releases();
      expect(harness.activeVersion()).toBe(release);

      // The crashed run's lease still holds the season.
      const blocked = await harness.run(later(FIRST_PUBLICATION, MINUTE));
      expect(blocked.outcome).toMatchObject({ status: 'run-in-progress' });
      expect(blocked.requests).toEqual([]);

      const resumed = await harness.run(later(FIRST_PUBLICATION, LEASE_TTL_MS));
      expect(resumed.outcome).toMatchObject({ status: 'nothing-due' });
      expect(resumed.publishCalls).toBe(0);
      expect(harness.releases()).toEqual([release]);
      expect(await harness.season()).toMatchObject({
        publicationDisposition: null,
        lastPublication: { activeVersion: release },
      });
    });

    it('publishes nothing without its reservation on record', async () => {
      const harness = await bootstrapped();
      const failing = faultyCommit(harness, 2, async () => ({
        outcome: 'unavailable',
      }));

      const run = await harness.run(FIRST_PUBLICATION, { ledger: failing });

      expect(run.outcome).toMatchObject({
        status: 'failed',
        stage: 'intent',
        failure: 'ledger-unavailable',
        publication: null,
      });
      expect(harness.publishGuarded).not.toHaveBeenCalled();
      expect(harness.activeVersion()).toBe(SEED);
      expect((await harness.season()).publicationDisposition).toMatchObject({
        state: 'publishing',
        digest: null,
      });

      // The publication it owed is due at the next run, which publishes it.
      const next = await harness.run(later(PRE_SEASON, 2 * HOUR));
      expect(next.outcome).toMatchObject({
        plan: 'publication',
        publication: { outcome: 'published' },
      });
      expect(next.requests).toEqual(seasonPaths);
      expect(harness.releases()).toHaveLength(1);
    });

    it('orders a release after the last one even when the clock went backwards (O-13)', async () => {
      const { harness } = await prePublished();
      const last = (await harness.season()).lastOrderingInput!;
      await harness.context.service.rollback(SEASON);

      // Earlier than the last reservation, and than the last release.
      const run = await harness.run(later(PRE_SEASON, 30 * MINUTE));

      expect(run.outcome).toMatchObject({
        publication: { outcome: 'published' },
      });
      const expected = later(last, 1);
      const release = harness.releases().at(-1)!;
      expect((await harness.season()).lastOrderingInput).toBe(expected);
      expect(
        await readStoredPublicationMetadata(harness.storage, SEASON, release),
      ).toMatchObject({ record: { sourceOrderingInput: expected } });
    });
  },
);
