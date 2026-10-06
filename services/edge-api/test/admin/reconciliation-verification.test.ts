/**
 * `POST /internal/admin/reconciliation/verification` (PR-E3; T11-T11c, OD-7)
 * through the real Worker entry point, over the real sequencer, guarded
 * sequenced publication and ledger - in process and through both Durable
 * Object clients - with only the resolver's answer injected (`vi.mock`).
 *
 * The staged correction is reached through the real state machine: round 1
 * is first published as variant A, settles on it, and a later variant C is
 * sighted and staged by two publication runs. Every provider answer comes
 * from the local Jolpica double; a global `fetch` stub fails the test if any
 * real request is attempted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../../src/index';
import { CapturingLogger, type LogEvent } from '../../src/logging/logger';
import { MemorySnapshotStorage } from '../../src/storage/local';
import {
  LEDGER_SCHEMA_VERSION,
  MAXIMUM_VERIFICATIONS,
  ledgerKeys,
  type ClassificationRecord,
} from '../../src/sync/coordinated/ledger';
import type { ReconciliationLedgerPort } from '../../src/sync/coordinated/ledger-port';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import { sequencerTransports } from '../publication/sequenced/support';
import {
  HOUR,
  ObservationHarness,
  PRE_SEASON,
  SEASON,
  tickAfter,
} from '../sync/coordinated/observation/support';
import { plantClassification } from '../sync/coordinated/ledger/support';
import {
  ADMIN_TOKEN,
  OP,
  PUBLIC_BASE_URL,
  call,
  paths,
} from './reconciliation-support';

const injected = vi.hoisted(() => ({
  ledger: null as null | (() => unknown),
}));

vi.mock('../../src/sync/coordinated/ledger-port', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../src/sync/coordinated/ledger-port')
    >();
  return {
    ...actual,
    resolveReconciliationLedger: () =>
      (injected.ledger?.() ?? null) as ReconciliationLedgerPort | null,
  };
});

// Each test first drives the real state machine to a staged correction.
vi.setConfig({ testTimeout: 30_000 });

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  injected.ledger = null;
  vi.unstubAllGlobals();
  expect(globalFetch).not.toHaveBeenCalled();
});

const FIRST_PUBLICATION = new Date(Date.parse(PRE_SEASON) + HOUR).toISOString();
const RESULTS = '/1/results/';
const VERIFICATION_OPERATION = 'reconciliation.verification';
const OPS = [
  ...OP,
  '9d0e1f2a-3b4c-4d5e-8f6a-0b1c2d3e4f5a',
  'ae1f2a3b-4c5d-4e6f-9a7b-1c2d3e4f5a6b',
] as const;

/** Every key path of a value, with array items as `[]`. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => keyPaths(item, `${prefix}[]`));
  }
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return [path, ...keyPaths(child, path)];
  });
}

/** Every key path a verified answer may carry. Nothing else, ever. */
const verifiedKeys = new Set([
  'status',
  'action',
  'operationId',
  'season',
  'round',
  'providerRequests',
  'transition',
  'match',
  'record',
  'record.recordVersion',
  'record.reviewState',
  'record.markers',
  'comparison',
  'comparison.base',
  'comparison.status',
  'comparison.reason',
  'comparison.publishedIsAccepted',
  'comparison.counts',
  'comparison.counts.observedEntries',
  'comparison.counts.publishedEntries',
  'comparison.counts.added',
  'comparison.counts.removed',
  'comparison.counts.changed',
  'comparison.drivers',
  'comparison.drivers.added',
  'comparison.drivers.removed',
  'comparison.drivers.changed',
  'comparison.resultFields',
  'comparison.entryFields',
  'leaseRelease',
]);

/** The only fields a verification audit line may carry. */
const auditKeys = new Set([
  'level',
  'operation',
  'requestId',
  'season',
  'round',
  'operatorAction',
  'operationId',
  'operatorAuthMethod',
  'operatorOutcome',
  'providerOperationCallCount',
  'verificationTransition',
  'verificationMatch',
  'verificationComparison',
  'providerRetryAt',
  'ledgerRejection',
  'failureCategory',
  'coordinationMissingDependencies',
  'leaseRelease',
]);

describe.each(sequencerTransports)(
  'the verification route over the %s transport',
  (transport) => {
    interface Staged {
      readonly harness: ObservationHarness;
      readonly env: Env;
      readonly logger: CapturingLogger;
      readonly staged: string;
      readonly published: ClassificationRecord;
      readonly ledgerCalls: string[];
    }

    /** Round 1 published as A, settled on it, and C staged by two reruns. */
    async function staged(
      options: {
        readonly ledger?: (
          base: ReconciliationLedgerPort,
        ) => ReconciliationLedgerPort;
      } = {},
    ): Promise<Staged> {
      const harness = await ObservationHarness.create({
        transport,
        seed: 'unclassified',
      });
      await harness.run(PRE_SEASON);
      await harness.run(FIRST_PUBLICATION);
      harness.server.results.set(1, 'A');
      for (const hours of [5, 9, 15, 24]) {
        await harness.run(tickAfter(1, hours));
      }
      expect(await harness.record(1)).toMatchObject({
        reviewState: 'settled',
        stagedCorrection: null,
      });
      // A late correction, sighted by two publication runs: staged (T8, T9).
      harness.server.results.set(1, 'C');
      harness.server.results.set(2, 'A');
      await harness.run(tickAfter(2, 5));
      await harness.run(tickAfter(2, 9));
      const record = await harness.record(1);
      if (record?.stagedCorrection == null) throw new Error('nothing staged');
      expect((await harness.snapshot()).backlog.count).toBe(1);

      const ledgerCalls: string[] = [];
      injected.ledger = () => {
        const base = harness.freshLedger();
        const wrapped = Object.create(base) as Record<string, unknown>;
        for (const method of [
          'readSeason',
          'acquireLease',
          'releaseLease',
          'commit',
          'reconcilePublishedRevisions',
          'operate',
          'dispose',
          'verify',
          'rotateVerifications',
        ] as const) {
          wrapped[method] = (request: never) => {
            ledgerCalls.push(method);
            return (base[method] as (request: never) => unknown).call(
              base,
              request,
            );
          };
        }
        const recorded = wrapped as unknown as ReconciliationLedgerPort;
        return options.ledger?.(recorded) ?? recorded;
      };
      const logger = new CapturingLogger();
      const env: Env = {
        ENVIRONMENT: 'staging',
        PROVIDER_MODE: 'coordinated',
        PUBLIC_BASE_URL,
        ADMIN_TOKEN,
        SEASON_PUBLICATION_AUTHORITY: 'sequencer',
        SEASON_PUBLICATION_CUTOVER_CONTROL: `activate:${SEASON}`,
        __SEASON_PUBLICATION_SEQUENCER: harness.sequencer,
        __LOCAL_STORAGE: harness.storage,
        __CACHE_PURGER: harness.context.purger,
        __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
        __CLOCK: harness.clock,
        __LOGGER: logger,
        __PROVIDER_RATE_LIMITER: harness.limiter,
        __PROVIDER_TRANSPORT: harness.server.transport,
      };
      return {
        harness,
        env,
        logger,
        staged: record.stagedCorrection.revision,
        published: record,
        ledgerCalls,
      };
    }

    /** One verification of round `round` at `at`, through the Worker. */
    async function verify(
      setup: Staged,
      at: string,
      operationId: string,
      overrides: Record<string, unknown> = {},
    ) {
      setup.harness.clock.set(at);
      return call(setup.env, 'POST', paths.verification, {
        season: SEASON,
        round: 1,
        operationId,
        expectedStagedRevision: setup.staged,
        expectedVerificationGeneration: 0,
        ...overrides,
      });
    }

    /** Everything a verification must never change, for comparison. */
    async function untouched(setup: Staged) {
      const { harness } = setup;
      const snapshot = await harness.snapshot();
      const round = snapshot.classifications.find(
        (entry) => entry.record.round === 1,
      )!.record;
      return JSON.stringify({
        season: snapshot.seasonRecord,
        backlog: snapshot.backlog,
        otherRounds: snapshot.classifications.filter(
          (entry) => entry.record.round !== 1,
        ),
        published: snapshot.published,
        staged: round.stagedCorrection,
        accepted: round.contentRevision,
        publishedRevision: round.publishedRevision,
        history: round.supersededRevisions,
        reviewState: round.reviewState,
        sourceObservedAt: round.sourceObservedAt,
        lastDisposition: round.lastDisposition,
        authority: await harness.sequencer.readAuthority(SEASON),
        activeVersion: harness.activeVersion(),
        releases: harness.releases(),
        publishCalls: harness.publishGuarded.mock.calls.length,
        kvWrites: (harness.storage as MemorySnapshotStorage).writeLog.length,
        purged: harness.context.purger.purgedUrls.length,
      });
    }

    /** The published document's classification, as the release serves it. */
    async function publishedEntries(setup: Staged) {
      const version = setup.harness.activeVersion()!;
      const document = await setup.harness.storage.readVersionedDocument(
        SEASON,
        version,
        'grand-prix:1:results',
      );
      return (document!.data as { entries: Record<string, unknown>[] }).entries;
    }

    function verificationLines(logger: CapturingLogger): LogEvent[] {
      return logger.events.filter(
        (event) => event.operation === VERIFICATION_OPERATION,
      );
    }

    const at = (minutes: number) =>
      new Date(
        Date.parse(tickAfter(2, 10)) + minutes * 60 * 1000,
      ).toISOString();

    it('tracks a second revision as the candidate, corroborates it on a later verification and locks the record, changing nothing else', async () => {
      const setup = await staged();
      const { harness } = setup;
      const before = await untouched(setup);
      const requests = harness.server.requests.length;
      const reservations = harness.limiter.reservations.length;
      setup.harness.server.results.set(1, 'B');

      const first = await verify(setup, at(0), OPS[0]);

      expect(first.status).toBe(200);
      expect(first.cacheControl).toBe('no-store');
      expect(first.body.data).toMatchObject({
        status: 'verified',
        action: 'verify',
        operationId: OPS[0],
        season: SEASON,
        round: 1,
        providerRequests: 1,
        transition: 'candidate-observed',
        match: 'other',
        record: { reviewState: 'settled', markers: ['pending', 'staged'] },
        comparison: { base: 'published', status: 'compared' },
        leaseRelease: 'released',
      });
      // One request, through the limiter, for exactly that round.
      expect(harness.server.requests.slice(requests)).toEqual([RESULTS]);
      expect(harness.limiter.reservations.length - reservations).toBe(1);
      // The read-only inspection shows the last verification, closed values only.
      const inspected = await call(setup.env, 'GET', paths.inspect(SEASON));
      const rounds = inspected.body.data?.rounds as Record<string, unknown>[];
      expect(rounds.find((round) => round.round === 1)).toMatchObject({
        markers: ['pending', 'staged'],
        lastVerification: {
          operationId: OPS[0],
          at: at(0),
          authMethod: 'shared-admin-token',
          stagedRevision: setup.staged,
          transition: 'candidate-observed',
        },
      });

      const second = await verify(setup, at(5), OPS[1]);

      expect(second.status).toBe(200);
      expect(second.body.data).toMatchObject({
        status: 'verified',
        providerRequests: 1,
        transition: 'candidate-corroborated',
        match: 'candidate',
        record: { markers: ['review_locked', 'staged'] },
      });
      expect((await harness.record(1))!.competingCorrection).toMatchObject({
        firstSeenAt: at(0),
        uncorroborated: false,
      });

      // T11d: refused before any request, and nothing is written.
      const state = harness.observationState();
      const locked = await verify(setup, at(10), OPS[2]);
      expect(locked.status).toBe(409);
      expect(locked.body.data).toEqual({
        status: 'precondition-failed',
        action: 'verify',
        operationId: OPS[2],
        season: SEASON,
        round: 1,
        providerRequests: 0,
        reason: 'review-locked',
        leaseRelease: 'released',
      });
      expect(harness.server.requests.slice(requests)).toHaveLength(2);
      expect(harness.observationState()).toBe(state);

      // No acceptance, rejection, hold, block, publication or KV write.
      expect(await untouched(setup)).toBe(before);
    });

    it('shows the OD-7 comparison against the published document, and no value', async () => {
      const setup = await staged();
      const entries = await publishedEntries(setup);
      const winner = entries[0]!.driverId as string;
      const last = entries.at(-1)!.driverId as string;

      // The staged revision again (T11): it changed the winner's points.
      setup.harness.server.results.set(1, 'C');
      const stagedSeen = await verify(setup, at(0), OPS[0]);
      expect(stagedSeen.body.data).toMatchObject({
        status: 'verified',
        transition: 'staged-seen',
        match: 'staged',
        comparison: {
          base: 'published',
          status: 'compared',
          publishedIsAccepted: true,
          counts: { added: 0, removed: 0, changed: 1 },
          drivers: { added: [], removed: [], changed: [winner] },
          resultFields: ['entries'],
          entryFields: ['points'],
        },
      });

      // A third revision without the last classified driver.
      setup.harness.server.results.set(1, 'D');
      const removed = await verify(setup, at(1), OPS[1]);
      expect(removed.body.data).toMatchObject({
        transition: 'candidate-observed',
        comparison: {
          status: 'compared',
          counts: { removed: 1, added: 0 },
          drivers: { removed: [last], added: [] },
        },
      });

      // The accepted revision: nothing differs from what is published.
      setup.harness.server.results.set(1, 'A');
      const accepted = await verify(setup, at(2), OPS[2]);
      expect(accepted.body.data).toMatchObject({
        transition: 'candidate-discarded',
        match: 'accepted',
        comparison: {
          status: 'compared',
          counts: { added: 0, removed: 0, changed: 0 },
          drivers: { added: [], removed: [], changed: [] },
          resultFields: [],
          entryFields: [],
        },
      });

      // The boundary: closed keys only, no revision, and no field value of
      // the published or observed classification, in answers or log lines.
      const values = new Set<string>();
      for (const entry of entries) {
        for (const [key, value] of Object.entries(entry)) {
          if (key === 'driverId' || value === null) continue;
          if (typeof value === 'string') values.add(value);
        }
      }
      expect(values.size).toBeGreaterThan(0);
      for (const answer of [stagedSeen, removed, accepted]) {
        for (const path of keyPaths(answer.body.data)) {
          expect(verifiedKeys.has(path), path).toBe(true);
        }
        const text = JSON.stringify(answer.body);
        expect(text).not.toContain('sha256:');
        for (const value of values) expect(text, value).not.toContain(value);
      }
      const lines = verificationLines(setup.logger);
      expect(lines).toHaveLength(3);
      for (const line of lines) {
        for (const key of Object.keys(line)) {
          expect(auditKeys.has(key), key).toBe(true);
        }
        const text = JSON.stringify(line);
        expect(text).not.toContain('sha256:');
        expect(text).not.toContain(winner);
        expect(text).not.toContain(last);
        expect(text).not.toContain('points');
        expect(text).not.toContain(ADMIN_TOKEN);
      }
      expect(lines[0]).toMatchObject({
        level: 'warn',
        operatorAction: 'verify',
        operatorOutcome: 'verified',
        operationId: OPS[0],
        operatorAuthMethod: 'shared-admin-token',
        providerOperationCallCount: 1,
        verificationTransition: 'staged-seen',
        verificationMatch: 'staged',
        verificationComparison: 'compared',
        leaseRelease: 'released',
      });
    });

    it('answers a resent operation ID from the ledger: no request, no second sighting', async () => {
      const setup = await staged();
      const { harness } = setup;
      harness.server.results.set(1, 'B');
      await verify(setup, at(0), OPS[0]);
      const state = harness.observationState();
      const requests = harness.server.requests.length;

      const resent = await verify(setup, at(5), OPS[0]);

      expect(resent.status).toBe(200);
      expect(resent.body.data).toMatchObject({
        status: 'already-applied',
        providerRequests: 0,
        transition: 'candidate-observed',
        comparison: { status: 'unavailable', reason: 'not-repeated' },
      });
      expect(harness.server.requests.length).toBe(requests);
      expect(harness.observationState()).toBe(state);
      expect(await harness.record(1)).toMatchObject({
        candidateRevision: expect.any(String),
        competingCorrection: null,
      });

      // The same ID for another target is refused, before any request.
      const reused = await verify(setup, at(6), OPS[0], {
        expectedStagedRevision: `sha256:${'c'.repeat(64)}`,
      });
      expect(reused.status).toBe(409);
      expect(reused.body.data).toMatchObject({
        status: 'precondition-failed',
        reason: 'operation-id-reused',
        providerRequests: 0,
      });
      expect(harness.server.requests.length).toBe(requests);
      expect(harness.observationState()).toBe(state);
    });

    it('recognizes an older operation ID after a later verification: its resend sends nothing and never corroborates', async () => {
      const setup = await staged();
      const { harness } = setup;
      // Operation A sees B first; a later operation records a failure.
      harness.server.results.set(1, 'B');
      await verify(setup, at(0), OPS[0]);
      harness.server.answers.set(RESULTS, () => ({
        kind: 'status',
        status: 503,
      }));
      expect((await verify(setup, at(1), OPS[1])).status).toBe(502);
      harness.server.answers.delete(RESULTS);
      const state = harness.observationState();
      const requests = harness.server.requests.length;

      // A is retried while upstream still serves B.
      const resent = await verify(setup, at(2), OPS[0]);

      expect(resent.status).toBe(200);
      expect(resent.body.data).toMatchObject({
        status: 'already-applied',
        providerRequests: 0,
        transition: 'candidate-observed',
      });
      expect(harness.server.requests.length).toBe(requests);
      expect(harness.observationState()).toBe(state);
      expect(await harness.record(1)).toMatchObject({
        competingCorrection: null,
        markers: ['pending', 'staged'],
      });
    });

    it('refuses a round whose verification history is full, before any request', async () => {
      const setup = await staged();
      const { harness } = setup;
      const snapshot = await harness.snapshot();
      const entry = snapshot.classifications.find(
        (candidate) => candidate.record.round === 1,
      )!;
      plantClassification(
        harness.host,
        {
          ...entry.record,
          verifications: Array.from(
            { length: MAXIMUM_VERIFICATIONS },
            (_, index) => ({
              operationId: `${index.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`,
              at: at(0),
              authMethod: 'shared-admin-token' as const,
              stagedRevision: setup.staged,
              transition: 'check-failed' as const,
            }),
          ),
        },
        entry.version,
      );
      const state = harness.observationState();
      const requests = harness.server.requests.length;

      const answer = await verify(setup, at(1), OPS[0]);

      expect(answer.status).toBe(409);
      expect(answer.body.data).toMatchObject({
        status: 'precondition-failed',
        reason: 'verification-history-full',
        providerRequests: 0,
      });
      expect(harness.server.requests.length).toBe(requests);
      expect(harness.observationState()).toBe(state);
    });

    it.each([
      [
        'a stale staged revision',
        { expectedStagedRevision: `sha256:${'c'.repeat(64)}` },
        'staged-revision-mismatch',
      ],
      ['a round with nothing staged', { round: 2 }, 'not-staged'],
      ['an unrecorded round', { round: 9 }, 'not-staged'],
    ])(
      'refuses %s before any request, and writes nothing',
      async (_, overrides, reason) => {
        const setup = await staged();
        const state = setup.harness.observationState();
        const requests = setup.harness.server.requests.length;

        const answer = await verify(setup, at(0), OPS[0], overrides);

        expect(answer.status).toBe(409);
        expect(answer.body.data).toMatchObject({
          status: 'precondition-failed',
          reason,
          providerRequests: 0,
          leaseRelease: 'released',
        });
        expect(setup.harness.server.requests.length).toBe(requests);
        expect(setup.harness.observationState()).toBe(state);
        expect(setup.ledgerCalls).toEqual(['acquireLease', 'releaseLease']);
      },
    );

    it('refuses a round before its earliest verification time, before any request', async () => {
      const setup = await staged();
      const { harness } = setup;
      // Round 20 is staged with an anchor still in the future: a state no
      // run can produce, planted so only the eligibility check stands.
      const record = (await harness.record(1))!;
      plantClassification(harness.host, {
        ...record,
        round: 20,
        anchor: '2026-12-01T12:00:00.000Z',
      });
      harness.host.transactionSync((store) =>
        store.put(ledgerKeys.backlog(SEASON, 20), {
          schemaVersion: LEDGER_SCHEMA_VERSION,
          kind: 'backlog-entry',
          season: SEASON,
          round: 20,
          revision: setup.staged,
          enteredAt: at(0),
        }),
      );
      const state = harness.observationState();
      const requests = harness.server.requests.length;

      const answer = await verify(setup, at(0), OPS[0], { round: 20 });

      expect(answer.status).toBe(409);
      expect(answer.body.data).toMatchObject({
        status: 'precondition-failed',
        reason: 'not-eligible',
        providerRequests: 0,
      });
      expect(harness.server.requests.length).toBe(requests);
      expect(harness.observationState()).toBe(state);
    });

    it.each([
      ['an upstream error', { kind: 'status', status: 503 } as const],
      ['an upstream 429', { kind: 'status', status: 429 } as const],
      ['a network failure', { kind: 'network' } as const],
      ['an invalid payload', { kind: 'json', body: { MRData: {} } } as const],
    ])(
      'records %s as T6: the attempt only, with the candidate kept',
      async (_, failure) => {
        const setup = await staged();
        const { harness } = setup;
        harness.server.results.set(1, 'B');
        await verify(setup, at(0), OPS[0]);
        const before = (await harness.record(1))!;
        const unchanged = await untouched(setup);
        harness.server.answers.set(RESULTS, () => failure);

        const answer = await verify(setup, at(5), OPS[1]);

        expect(answer.status).toBe(502);
        expect(answer.body.data).toMatchObject({
          status: 'provider-failed',
          providerRequests: 1,
          transition: 'check-failed',
          match: null,
          comparison: { status: 'unavailable', reason: 'no-observation' },
          leaseRelease: 'released',
        });
        const after = (await harness.record(1))!;
        expect(after).toMatchObject({
          candidateRevision: before.candidateRevision,
          candidateFirstSeenAt: before.candidateFirstSeenAt,
          competingCorrection: null,
          lastAttemptedAt: at(5),
          lastSuccessfulObservationAt: before.lastSuccessfulObservationAt,
        });
        expect(after.verifications.at(-1)).toMatchObject({
          operationId: OPS[1],
          transition: 'check-failed',
        });
        expect(await untouched(setup)).toBe(unchanged);
      },
    );

    it('records a limiter deferral as a deferral, sends nothing, and verifies once the limiter allows', async () => {
      const setup = await staged();
      const { harness } = setup;
      const retryAt = at(30);
      harness.limiter.script = () => ({ deferredUntil: retryAt });
      const requests = harness.server.requests.length;
      const unchanged = await untouched(setup);

      const deferred = await verify(setup, at(0), OPS[0]);

      expect(deferred.status).toBe(429);
      expect(deferred.body.data).toMatchObject({
        status: 'deferred',
        retryAt,
        providerRequests: 0,
        leaseRelease: 'released',
      });
      expect(harness.server.requests.length).toBe(requests);
      expect(await harness.record(1)).toMatchObject({
        limiterDeferralUntil: retryAt,
        verifications: [],
        candidateRevision: null,
      });
      expect(await untouched(setup)).toBe(unchanged);

      // Not a completed check: the same operation runs once allowed.
      harness.limiter.script = () => 'allowed';
      harness.server.results.set(1, 'B');
      const retried = await verify(setup, retryAt, OPS[0]);
      expect(retried.body.data).toMatchObject({
        status: 'verified',
        providerRequests: 1,
        transition: 'candidate-observed',
      });
      expect(await harness.record(1)).toMatchObject({
        limiterDeferralUntil: null,
      });
    });

    it('records nothing when the limiter cannot answer', async () => {
      const setup = await staged();
      const { harness } = setup;
      harness.limiter.script = () => 'unavailable';
      const state = harness.observationState();
      const requests = harness.server.requests.length;

      const answer = await verify(setup, at(0), OPS[0]);

      expect(answer.status).toBe(503);
      expect(answer.body.data).toMatchObject({
        status: 'not-attempted',
        providerRequests: 0,
        reason: null,
      });
      expect(harness.server.requests.length).toBe(requests);
      expect(harness.observationState()).toBe(state);
    });

    it('answers run-in-progress while the lease is held, and sends nothing', async () => {
      const setup = await staged();
      const { harness } = setup;
      harness.clock.set(at(0));
      const held = await harness.freshLedger().acquireLease(SEASON);
      expect(held.outcome).toBe('acquired');
      const state = harness.observationState();
      const requests = harness.server.requests.length;

      const answer = await verify(setup, at(1), OPS[0]);

      expect(answer.status).toBe(409);
      expect(answer.body.data).toMatchObject({
        status: 'run-in-progress',
        providerRequests: 0,
      });
      expect(harness.server.requests.length).toBe(requests);
      expect(harness.observationState()).toBe(state);
      expect(setup.ledgerCalls).toEqual(['acquireLease']);
    });

    it('reports a lost write answer as outcome-unknown, and a resend settles it without a second request', async () => {
      let lose = true;
      const setup = await staged({
        ledger: (base) =>
          Object.assign(Object.create(base) as ReconciliationLedgerPort, {
            verify: async (request: never) => {
              const outcome = await base.verify(request);
              return lose ? { outcome: 'uncertain' } : outcome;
            },
          }),
      });
      const { harness } = setup;
      harness.server.results.set(1, 'B');

      const lost = await verify(setup, at(0), OPS[0]);
      expect(lost.status).toBe(503);
      expect(lost.body.data).toMatchObject({
        status: 'outcome-unknown',
        providerRequests: 1,
        leaseRelease: 'released',
      });

      lose = false;
      const requests = harness.server.requests.length;
      const resent = await verify(setup, at(1), OPS[0]);
      expect(resent.status).toBe(200);
      expect(resent.body.data).toMatchObject({
        status: 'already-applied',
        providerRequests: 0,
        transition: 'candidate-observed',
      });
      expect(harness.server.requests.length).toBe(requests);
    });

    it('reports an unreachable ledger, and sends nothing', async () => {
      const setup = await staged({
        ledger: (base) =>
          Object.assign(Object.create(base) as ReconciliationLedgerPort, {
            acquireLease: async () => ({ outcome: 'unavailable' }),
          }),
      });
      const requests = setup.harness.server.requests.length;

      const answer = await verify(setup, at(0), OPS[0]);

      expect(answer.status).toBe(503);
      expect(answer.body.data).toMatchObject({
        status: 'ledger-unavailable',
        providerRequests: 0,
        leaseRelease: null,
      });
      expect(setup.harness.server.requests.length).toBe(requests);
    });

    it('refuses before the ledger: a missing or wrong token, a bad body, a non-coordinated mode or a runtime that cannot compose', async () => {
      const setup = await staged();
      const { harness } = setup;
      const state = harness.observationState();
      const requests = harness.server.requests.length;
      const body = {
        season: SEASON,
        round: 1,
        operationId: OPS[0],
        expectedStagedRevision: setup.staged,
        expectedVerificationGeneration: 0,
      };

      for (const token of [null, 'wrong-token']) {
        const answer = await call(
          setup.env,
          'POST',
          paths.verification,
          body,
          token,
        );
        expect(answer.status).toBe(401);
      }
      const get = await call(setup.env, 'GET', paths.verification);
      expect(get.status).toBe(405);
      expect(get.allow).toBe('POST');
      for (const bad of [
        { ...body, extra: true },
        { ...body, operationId: 'not-a-uuid' },
        { ...body, expectedStagedRevision: 'C' },
        { ...body, round: 0 },
        { season: SEASON, round: 1, operationId: OPS[0] },
        'not json',
      ]) {
        const answer = await call(setup.env, 'POST', paths.verification, bad);
        expect(answer.status, JSON.stringify(bad)).toBe(400);
        expect(answer.body.error?.code).toBe('INVALID_PARAMETER');
      }

      const mock = await call(
        { ...setup.env, PROVIDER_MODE: 'mock' },
        'POST',
        paths.verification,
        body,
      );
      expect(mock.status).toBe(503);
      expect(mock.body.data).toEqual({
        status: 'reconciliation-unavailable',
        reasons: ['provider-mode-not-coordinated'],
      });

      const unbound = await call(
        { ...setup.env, __PROVIDER_RATE_LIMITER: undefined },
        'POST',
        paths.verification,
        body,
      );
      expect(unbound.status).toBe(503);
      expect(unbound.body.data).toMatchObject({
        status: 'coordinated-runtime-unavailable',
        reasons: ['limiter-unbound'],
        providerRequests: 0,
      });

      // None of these read the ledger or reached the provider.
      expect(setup.ledgerCalls).toEqual([]);
      expect(harness.server.requests.length).toBe(requests);
      expect(harness.limiter.reservations.length).toBeGreaterThan(0);
      expect(harness.observationState()).toBe(state);
    });
  },
);
