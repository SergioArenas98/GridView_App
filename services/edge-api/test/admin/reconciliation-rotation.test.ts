/**
 * The verification-history recovery path (PR-E4) through the real Worker
 * entry point: `GET /internal/admin/reconciliation/verification-history`,
 * `POST /internal/admin/reconciliation/verification-rotation`, and the
 * verification route's generation check - over the real sequencer, guarded
 * sequenced publication and ledger, in process and through both Durable
 * Object clients, with only the resolver's answer injected (`vi.mock`).
 *
 * Every request builds a fresh ledger object over the same storage, as a
 * fresh isolate would, so each is also a restart. The staged correction is
 * reached through the real state machine, as in the verification tests.
 * Every provider answer comes from the local Jolpica double, and a global
 * `fetch` stub fails the test if any real request is attempted.
 */

import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../../src/index';
import { CapturingLogger, type LogEvent } from '../../src/logging/logger';
import { MemorySnapshotStorage } from '../../src/storage/local';
import {
  MAXIMUM_VERIFICATIONS,
  type ClassificationRecord,
  type VerificationRecord,
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
const ROTATION_OPERATION = 'reconciliation.verification-rotation';
const ROTATION = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d';
const OTHER_ROTATION = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e';
const LEDGER_METHODS = [
  'readSeason',
  'acquireLease',
  'releaseLease',
  'commit',
  'reconcilePublishedRevisions',
  'operate',
  'dispose',
  'verify',
  'rotateVerifications',
] as const;

/** The only fields a rotation audit line may carry. */
const rotationAuditKeys = new Set([
  'level',
  'operation',
  'requestId',
  'season',
  'round',
  'operatorAction',
  'operationId',
  'operatorAuthMethod',
  'operatorOutcome',
  'ledgerRejection',
  'verificationGenerationFrom',
  'verificationGenerationTo',
  'verificationClearedCount',
  'leaseRelease',
]);

/** A distinct planted operation ID per index. */
const planted = (index: number): string =>
  `${index.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;

/** `sha256:` of the compact JSON of the archived `entries`, as documented. */
function digestOf(entries: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(entries), 'utf8')
    .digest('hex')}`;
}

describe.each(sequencerTransports)(
  'the verification-history recovery path over the %s transport',
  (transport) => {
    interface Staged {
      readonly harness: ObservationHarness;
      readonly env: Env;
      readonly logger: CapturingLogger;
      readonly staged: string;
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
      harness.server.results.set(1, 'C');
      harness.server.results.set(2, 'A');
      await harness.run(tickAfter(2, 5));
      await harness.run(tickAfter(2, 9));
      const record = await harness.record(1);
      if (record?.stagedCorrection == null) throw new Error('nothing staged');

      const ledgerCalls: string[] = [];
      injected.ledger = () => {
        const base = harness.freshLedger();
        const wrapped = Object.create(base) as Record<string, unknown>;
        for (const method of LEDGER_METHODS) {
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
        ledgerCalls,
      };
    }

    const at = (minutes: number) =>
      new Date(
        Date.parse(tickAfter(2, 10)) + minutes * 60 * 1000,
      ).toISOString();

    async function verify(
      setup: Staged,
      minutes: number,
      operationId: string,
      generation: number,
    ) {
      setup.harness.clock.set(at(minutes));
      return call(setup.env, 'POST', paths.verification, {
        season: SEASON,
        round: 1,
        operationId,
        expectedStagedRevision: setup.staged,
        expectedVerificationGeneration: generation,
      });
    }

    /**
     * Appends planted failed verifications until the round's history is
     * full, at the record's current version: 32 real requests are not needed
     * to reach the state, only to prove the bound, which the store tests do.
     */
    async function fillHistory(setup: Staged): Promise<void> {
      const snapshot = await setup.harness.snapshot();
      const entry = snapshot.classifications.find(
        (candidate) => candidate.record.round === 1,
      )!;
      const extra: VerificationRecord[] = [];
      for (
        let index = entry.record.verifications.length;
        index < MAXIMUM_VERIFICATIONS;
        index += 1
      ) {
        extra.push({
          operationId: planted(index),
          at: at(1),
          authMethod: 'shared-admin-token',
          stagedRevision: setup.staged,
          transition: 'check-failed',
        });
      }
      plantClassification(
        setup.harness.host,
        {
          ...entry.record,
          verifications: [...entry.record.verifications, ...extra],
        },
        entry.version,
      );
    }

    async function hold(setup: Staged, minutes: number): Promise<void> {
      setup.harness.clock.set(at(minutes));
      const inspected = await call(setup.env, 'GET', paths.inspect(SEASON));
      const answer = await call(setup.env, 'POST', paths.hold, {
        season: SEASON,
        expectedSeasonRecordVersion: inspected.body.data?.seasonRecordVersion,
        operationId: OP[4],
      });
      expect(answer.body.data?.status).toBe('applied');
    }

    async function history(setup: Staged) {
      const answer = await call(
        setup.env,
        'GET',
        paths.verificationHistory(SEASON, 1),
      );
      expect(answer.status).toBe(200);
      return answer.body.data as {
        readonly recordVersion: number;
        readonly verificationGeneration: number;
        readonly historyDigest: string;
        readonly count: number;
        readonly entries: unknown[];
      };
    }

    async function rotate(
      setup: Staged,
      minutes: number,
      operationId: string,
      archived: Awaited<ReturnType<typeof history>>,
      overrides: Record<string, unknown> = {},
    ) {
      setup.harness.clock.set(at(minutes));
      return call(setup.env, 'POST', paths.verificationRotation, {
        season: SEASON,
        round: 1,
        operationId,
        expected: {
          recordVersion: archived.recordVersion,
          verificationGeneration: archived.verificationGeneration,
          historyDigest: archived.historyDigest,
        },
        historyArchived: true,
        ...overrides,
      });
    }

    /** What a rotation never changes: everything but round 1's history. */
    async function untouched(setup: Staged) {
      const { harness } = setup;
      const snapshot = await harness.snapshot();
      const round = snapshot.classifications.find(
        (entry) => entry.record.round === 1,
      )!.record;
      // Everything but the three fields a rotation writes.
      const kept = Object.fromEntries(
        Object.entries(round).filter(
          ([key]) =>
            ![
              'verifications',
              'verificationGeneration',
              'lastVerificationReset',
            ].includes(key),
        ),
      );
      return JSON.stringify({
        season: snapshot.seasonRecord,
        backlog: snapshot.backlog,
        otherRounds: snapshot.classifications.filter(
          (entry) => entry.record.round !== 1,
        ),
        published: snapshot.published,
        kept,
        authority: await harness.sequencer.readAuthority(SEASON),
        activeVersion: harness.activeVersion(),
        releases: harness.releases(),
        publishCalls: harness.publishGuarded.mock.calls.length,
        kvWrites: (harness.storage as MemorySnapshotStorage).writeLog.length,
        purged: harness.context.purger.purgedUrls.length,
      });
    }

    function rotationLines(logger: CapturingLogger): LogEvent[] {
      return logger.events.filter(
        (event) => event.operation === ROTATION_OPERATION,
      );
    }

    it('archives, rotates and refuses the earlier generation before any provider access, keeping the candidate for a later corroboration', async () => {
      const setup = await staged();
      const { harness } = setup;
      // A real first sighting of B in generation 0: the pending candidate.
      harness.server.results.set(1, 'B');
      const first = await verify(setup, 0, OP[0], 0);
      expect(first.body.data).toMatchObject({
        status: 'verified',
        transition: 'candidate-observed',
      });
      await fillHistory(setup);
      await hold(setup, 2);

      // A full history refuses verification, before any request.
      const requests = harness.server.requests.length;
      expect((await verify(setup, 3, OP[1], 0)).body.data).toMatchObject({
        status: 'precondition-failed',
        reason: 'verification-history-full',
        providerRequests: 0,
      });

      // The read-only archive: every entry, and a recomputable digest.
      const before = (await harness.record(1))!;
      const archived = await history(setup);
      expect(archived).toMatchObject({
        status: 'read',
        season: SEASON,
        round: 1,
        verificationGeneration: 0,
        count: MAXIMUM_VERIFICATIONS,
        lastVerificationReset: null,
      });
      expect(archived.entries).toHaveLength(MAXIMUM_VERIFICATIONS);
      expect(archived.entries[0]).toEqual({
        operationId: OP[0],
        at: at(0),
        authMethod: 'shared-admin-token',
        stagedRevision: setup.staged,
        transition: 'candidate-observed',
      });
      expect(archived.historyDigest).toBe(digestOf(archived.entries));
      const unchanged = await untouched(setup);
      const reservations = harness.limiter.reservations.length;

      const rotated = await rotate(setup, 4, ROTATION, archived);

      expect(rotated.status).toBe(200);
      expect(rotated.cacheControl).toBe('no-store');
      expect(rotated.body.data).toMatchObject({
        status: 'applied',
        action: 'rotate-verifications',
        operationId: ROTATION,
        season: SEASON,
        round: 1,
        receipt: {
          operationId: ROTATION,
          at: at(4),
          authMethod: 'shared-admin-token',
          fromGeneration: 0,
          toGeneration: 1,
          clearedCount: MAXIMUM_VERIFICATIONS,
          clearedDigest: archived.historyDigest,
        },
        state: {
          round: {
            verificationGeneration: 1,
            verificationCount: 0,
            lastVerification: null,
            candidateRevision: before.candidateRevision,
          },
        },
        leaseRelease: 'released',
      });
      // The answer never returns the cleared entries.
      expect(JSON.stringify(rotated.body)).not.toContain(planted(5));
      expect(await untouched(setup)).toBe(unchanged);
      expect(harness.server.requests.length).toBe(requests);
      expect(harness.limiter.reservations.length).toBe(reservations);

      // One bounded audit line: counters and closed values, no digest,
      // revision or cleared operation ID.
      const [line, ...rest] = rotationLines(setup.logger);
      expect(rest).toEqual([]);
      for (const key of Object.keys(line!)) {
        expect(rotationAuditKeys.has(key), key).toBe(true);
      }
      expect(line).toMatchObject({
        level: 'warn',
        operatorAction: 'rotate-verifications',
        operatorOutcome: 'applied',
        operationId: ROTATION,
        operatorAuthMethod: 'shared-admin-token',
        verificationGenerationFrom: 0,
        verificationGenerationTo: 1,
        verificationClearedCount: MAXIMUM_VERIFICATIONS,
        leaseRelease: 'released',
      });
      const text = JSON.stringify(setup.logger.events);
      expect(text).not.toContain('sha256:');
      expect(text).not.toContain(planted(5));
      expect(text).not.toContain(ADMIN_TOKEN);

      // The generation-0 resend: refused under the lease before the limiter
      // or the transport, and nothing is written.
      const state = harness.observationState();
      setup.ledgerCalls.length = 0;
      const replay = await verify(setup, 5, OP[0], 0);
      expect(replay.status).toBe(409);
      expect(replay.body.data).toEqual({
        status: 'precondition-failed',
        action: 'verify',
        operationId: OP[0],
        season: SEASON,
        round: 1,
        providerRequests: 0,
        reason: 'verification-generation-mismatch',
        leaseRelease: 'released',
      });
      expect(setup.ledgerCalls).toEqual(['acquireLease', 'releaseLease']);
      expect(harness.server.requests.length).toBe(requests);
      expect(harness.limiter.reservations.length).toBe(reservations);
      expect(harness.observationState()).toBe(state);

      // The rotation's ID can never name a verification.
      const reused = await verify(setup, 6, ROTATION, 1);
      expect(reused.body.data).toMatchObject({
        status: 'precondition-failed',
        reason: 'operation-id-reused',
        providerRequests: 0,
      });
      expect(harness.server.requests.length).toBe(requests);

      // A new verification in generation 1 is a second, distinct response:
      // the kept candidate is corroborated (T11b).
      const second = await verify(setup, 7, OP[2], 1);
      expect(second.body.data).toMatchObject({
        status: 'verified',
        providerRequests: 1,
        transition: 'candidate-corroborated',
        record: { markers: ['review_locked', 'staged'] },
      });
      expect(harness.server.requests.length).toBe(requests + 1);

      // The archive now shows generation 1 and its receipt.
      expect(await history(setup)).toMatchObject({
        verificationGeneration: 1,
        count: 1,
        lastVerificationReset: { operationId: ROTATION, toGeneration: 1 },
      });
    });

    it('reports a lost rotation answer as outcome-unknown, and the resend settles it without a second rotation', async () => {
      let lose = true;
      const setup = await staged({
        ledger: (base) =>
          Object.assign(Object.create(base) as ReconciliationLedgerPort, {
            rotateVerifications: async (request: never) => {
              const outcome = await base.rotateVerifications(request);
              return lose ? { outcome: 'uncertain' } : outcome;
            },
          }),
      });
      await fillHistory(setup);
      await hold(setup, 0);
      const archived = await history(setup);

      const lost = await rotate(setup, 1, ROTATION, archived);
      expect(lost.status).toBe(503);
      expect(lost.body.data).toMatchObject({
        status: 'outcome-unknown',
        leaseRelease: 'released',
      });
      const afterLost = setup.harness.observationState();

      lose = false;
      const resent = await rotate(setup, 2, ROTATION, archived);
      expect(resent.status).toBe(200);
      expect(resent.body.data).toMatchObject({
        status: 'already-applied',
        receipt: { fromGeneration: 0, toGeneration: 1 },
      });
      expect(setup.harness.observationState()).toBe(afterLost);
      expect((await setup.harness.record(1))!.verificationGeneration).toBe(1);

      // A new rotation ID with the stale archive is refused: no second
      // rotation, whatever the operator resends.
      const again = await rotate(setup, 3, OTHER_ROTATION, archived);
      expect(again.body.data).toMatchObject({
        status: 'refused',
        reason: 'verification-generation-mismatch',
      });
      expect(setup.harness.observationState()).toBe(afterLost);
    });

    it.each([
      ['no operator hold', 'operator-hold-required'],
      ['a stale history digest', 'verification-history-digest-mismatch'],
      ['a stale record version', 'version-conflict'],
      ['a record locked for review', 'review-locked'],
      ['a history that is not full', 'verification-history-not-full'],
    ] as const)(
      'refuses %s, writing nothing and reaching no provider',
      async (situation, reason) => {
        const setup = await staged();
        const { harness } = setup;
        if (situation !== 'a history that is not full')
          await fillHistory(setup);
        if (situation !== 'no operator hold') await hold(setup, 0);
        if (situation === 'a record locked for review') {
          const snapshot = await harness.snapshot();
          const entry = snapshot.classifications.find(
            (candidate) => candidate.record.round === 1,
          )!;
          const locked: ClassificationRecord = {
            ...entry.record,
            competingCorrection: {
              revision: `sha256:${'e'.repeat(64)}`,
              firstSeenAt: at(0),
              uncorroborated: false,
            },
            markers: ['review_locked', 'staged'],
          };
          plantClassification(harness.host, locked, entry.version);
        }
        const archived = await history(setup);
        const stale =
          situation === 'a stale history digest'
            ? { ...archived, historyDigest: `sha256:${'f'.repeat(64)}` }
            : situation === 'a stale record version'
              ? { ...archived, recordVersion: archived.recordVersion + 1 }
              : archived;
        const state = harness.observationState();
        const requests = harness.server.requests.length;

        const answer = await rotate(setup, 1, ROTATION, stale);

        expect(answer.status).toBe(409);
        expect(answer.body.data).toEqual({
          status: 'refused',
          action: 'rotate-verifications',
          operationId: ROTATION,
          season: SEASON,
          round: 1,
          reason,
          leaseRelease: 'released',
        });
        expect(harness.observationState()).toBe(state);
        expect(harness.server.requests.length).toBe(requests);
        expect(rotationLines(setup.logger).at(-1)).toMatchObject({
          operatorOutcome: 'refused',
          ledgerRejection: reason,
        });
      },
    );

    it('answers run-in-progress while the lease is held', async () => {
      const setup = await staged();
      await fillHistory(setup);
      await hold(setup, 0);
      const archived = await history(setup);
      setup.harness.clock.set(at(1));
      const held = await setup.harness.freshLedger().acquireLease(SEASON);
      expect(held.outcome).toBe('acquired');
      const state = setup.harness.observationState();

      const answer = await rotate(setup, 2, ROTATION, archived);

      expect(answer.status).toBe(409);
      expect(answer.body.data).toMatchObject({ status: 'run-in-progress' });
      expect(setup.harness.observationState()).toBe(state);
    });

    it('refuses before the ledger: a missing or wrong token, a wrong method, a bad body or query, an unacknowledged archive, or a non-coordinated mode', async () => {
      const setup = await staged();
      const { harness } = setup;
      const state = harness.observationState();
      const requests = harness.server.requests.length;
      const body = {
        season: SEASON,
        round: 1,
        operationId: ROTATION,
        expected: {
          recordVersion: 1,
          verificationGeneration: 0,
          historyDigest: `sha256:${'a'.repeat(64)}`,
        },
        historyArchived: true,
      };

      for (const token of [null, 'wrong-token']) {
        for (const [method, path, payload] of [
          ['POST', paths.verificationRotation, body],
          ['GET', paths.verificationHistory(SEASON, 1), undefined],
        ] as const) {
          const answer = await call(setup.env, method, path, payload, token);
          expect(answer.status).toBe(401);
        }
      }
      const get = await call(setup.env, 'GET', paths.verificationRotation);
      expect(get.status).toBe(405);
      expect(get.allow).toBe('POST');
      const post = await call(
        setup.env,
        'POST',
        paths.verificationHistory(SEASON, 1),
        {},
      );
      expect(post.status).toBe(405);
      expect(post.allow).toBe('GET');

      for (const [bad, problem] of [
        [{ ...body, extra: true }, 'invalid-body'],
        [{ ...body, operationId: 'not-a-uuid' }, 'invalid-body'],
        [{ ...body, historyArchived: 'yes' }, 'invalid-body'],
        [
          { ...body, expected: { ...body.expected, historyDigest: 'C' } },
          'invalid-body',
        ],
        [
          { ...body, expected: { ...body.expected, cleared: [] } },
          'invalid-body',
        ],
        [
          {
            season: SEASON,
            round: 1,
            operationId: ROTATION,
            expected: body.expected,
          },
          'invalid-body',
        ],
        [
          { ...body, historyArchived: false },
          'history-archive-not-acknowledged',
        ],
      ] as const) {
        const answer = await call(
          setup.env,
          'POST',
          paths.verificationRotation,
          bad,
        );
        expect(answer.status, JSON.stringify(bad)).toBe(400);
        expect(answer.body.error).toMatchObject({
          code: 'INVALID_PARAMETER',
          message: problem,
        });
      }
      for (const [query, problem] of [
        [`?season=${SEASON}`, 'invalid-season'],
        [`?season=${SEASON}&round=1&extra=1`, 'invalid-season'],
        [`?season=${SEASON}&round=0`, 'invalid-round'],
        [`?season=${SEASON}&round=101`, 'invalid-round'],
        [`?season=${SEASON}&round=01`, 'invalid-round'],
      ] as const) {
        const answer = await call(
          setup.env,
          'GET',
          `/internal/admin/reconciliation/verification-history${query}`,
        );
        expect(answer.status, query).toBe(400);
        expect(answer.body.error?.message).toBe(problem);
      }

      for (const [method, path, payload] of [
        ['POST', paths.verificationRotation, body],
        ['GET', paths.verificationHistory(SEASON, 1), undefined],
      ] as const) {
        const mock = await call(
          { ...setup.env, PROVIDER_MODE: 'mock' },
          method,
          path,
          payload,
        );
        expect(mock.status).toBe(503);
        expect(mock.body.data).toEqual({
          status: 'reconciliation-unavailable',
          reasons: ['provider-mode-not-coordinated'],
        });
      }

      // None of these read the ledger or reached the provider.
      expect(setup.ledgerCalls).toEqual([]);
      expect(harness.server.requests.length).toBe(requests);
      expect(harness.observationState()).toBe(state);

      // An unrecorded round is read, and answered as such.
      const unrecorded = await call(
        setup.env,
        'GET',
        paths.verificationHistory(SEASON, 9),
      );
      expect(unrecorded.status).toBe(404);
      expect(unrecorded.body.data).toEqual({
        status: 'not-recorded',
        season: SEASON,
        round: 9,
      });
      expect(setup.ledgerCalls).toEqual(['readSeason']);
    });
  },
);
