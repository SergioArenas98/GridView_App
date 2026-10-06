/**
 * The ledger's `rotateVerifications` operation and the verification
 * generation (PR-E4), in process and through the Durable Object client over
 * the same host.
 *
 * A rotation clears one round's full verification history, raises its
 * generation by one and records a bounded receipt, and writes nothing else.
 * A verification formed against another generation is refused before
 * anything is matched, so a resend from before a rotation is never executed.
 */

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { MemorySequencerHost } from '../../../../src/publication/sequencer/hosts';
import {
  DurableObjectReconciliationLedger,
  LEASE_TTL_MS,
  LocalReconciliationLedger,
  MAXIMUM_VERIFICATIONS,
  ReconciliationLedger,
  ReconciliationLedgerStore,
  type ClassificationRecord,
  type LeaseToken,
  type VerificationObservation,
  type VerificationRecord,
  type VerificationRotationRequest,
} from '../../../../src/sync/coordinated/ledger';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import { decodeClassificationRecord } from '../../../../src/sync/coordinated/ledger/records';
import { verificationHistoryDigest } from '../../../../src/sync/coordinated/ledger/verification';
import { MutableClock } from '../../../publication/sequencer/support';
import { changedFields, durableStateOver } from '../observation/support';
import {
  SEASON,
  START,
  commitRequest,
  committedBytes,
  plantClassification,
  rev,
  seasonRecord,
  stagedClassification,
  write,
} from './support';

const ROUND = 3;
const OTHER_ROUND = 4;
const STAGED = rev('staged-3');
const B = rev('candidate-b');
const HOLD = '0f1e2d3c-4b5a-4968-8776-655443322110';
const ROTATION = [
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  'c3d4e5f6-a7b8-4c9d-ae0f-2a3b4c5d6e7f',
] as const;
const LATER = '2026-09-27T12:02:00.000Z';

const transports = ['local', 'durable-object'] as const;

/** A distinct lowercase UUID v4 per generation and index. */
const opId = (index: number, generation = 0): string =>
  `${index.toString(16).padStart(8, '0')}-${generation
    .toString(16)
    .padStart(4, '0')}-4000-8000-000000000000`;

const observed = (revision: string): VerificationObservation => ({
  status: 'observed',
  revision,
});

/** The documented canonical digest, computed independently of the store. */
function digestOf(history: readonly VerificationRecord[]): string {
  const entries = history.map((entry) => ({
    operationId: entry.operationId,
    at: entry.at,
    authMethod: entry.authMethod,
    stagedRevision: entry.stagedRevision,
    transition: entry.transition,
  }));
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(entries), 'utf8')
    .digest('hex')}`;
}

describe.each(transports)(
  'rotateVerifications over the %s ledger transport',
  (transport) => {
    async function setup(options: { readonly hold?: boolean } = {}) {
      const host = new MemorySequencerHost();
      const clock = new MutableClock(new Date(START));
      // A fresh object per client: every call after the first is a restart.
      const client = (): ReconciliationLedgerPort => {
        if (transport === 'local') {
          return new LocalReconciliationLedger(
            new ReconciliationLedgerStore(host, { clock }),
          );
        }
        const object = new ReconciliationLedger(durableStateOver(host), {
          clock,
        });
        return new DurableObjectReconciliationLedger({
          idFromName: (name) => name,
          get: () => ({
            fetch: (url: string, init: RequestInit) =>
              object.fetch(new Request(url, init)),
          }),
        });
      };
      const ledger = client();
      const acquired = await ledger.acquireLease(SEASON);
      if (acquired.outcome !== 'acquired') throw new Error('lease refused');
      const token: LeaseToken = { season: SEASON, fence: acquired.lease.fence };
      const seeded = await ledger.commit(
        commitRequest(token, {
          seasonRecord: write(seasonRecord()),
          classifications: [write(stagedClassification(ROUND, STAGED))],
          backlogInsertions: [{ round: ROUND, revision: STAGED }],
        }),
      );
      if (seeded.outcome !== 'committed') throw new Error('seed refused');
      if (options.hold ?? true) {
        const held = await ledger.operate({
          lease: token,
          action: 'hold',
          operationId: HOLD,
          authMethod: 'shared-admin-token',
          expectedVersion: 1,
        });
        if (held.outcome !== 'applied') throw new Error('hold refused');
      }
      return { host, clock, client, ledger, token };
    }

    type Fixture = Awaited<ReturnType<typeof setup>>;

    async function stored(fixture: Fixture, round = ROUND) {
      const read = await fixture.client().readSeason(SEASON);
      if (read.outcome !== 'read') throw new Error('read refused');
      const entry = read.snapshot.classifications.find(
        (candidate) => candidate.record.round === round,
      );
      if (entry === undefined) throw new Error('no record');
      return entry;
    }

    async function verify(
      fixture: Fixture,
      observation: VerificationObservation,
      operationId: string,
      generation: number,
      round = ROUND,
    ) {
      const entry = await stored(fixture, round);
      return fixture.client().verify({
        lease: fixture.token,
        round,
        operationId,
        authMethod: 'shared-admin-token',
        expected: {
          recordVersion: entry.version,
          stagedRevision: STAGED,
          verificationGeneration: generation,
        },
        observation,
      });
    }

    /**
     * A first sighting of B (the candidate) unless another `sighting` is
     * named, then failed verifications up to a full history, all in
     * `generation`.
     */
    async function fill(
      fixture: Fixture,
      generation = 0,
      sighting: VerificationObservation = observed(B),
    ) {
      const first = await verify(
        fixture,
        sighting,
        opId(0, generation),
        generation,
      );
      expect(first.outcome).toBe('applied');
      for (let index = 1; index < MAXIMUM_VERIFICATIONS; index += 1) {
        const outcome = await verify(
          fixture,
          { status: 'failed' },
          opId(index, generation),
          generation,
        );
        expect(outcome.outcome).toBe('applied');
      }
      return stored(fixture);
    }

    /** The request an operator forms from an inspection of `entry`. */
    function rotation(
      fixture: Fixture,
      entry: { version: number; record: ClassificationRecord },
      operationId: string,
      overrides: Partial<VerificationRotationRequest['expected']> = {},
    ): VerificationRotationRequest {
      return {
        lease: fixture.token,
        round: entry.record.round,
        operationId,
        authMethod: 'shared-admin-token',
        expected: {
          recordVersion: entry.version,
          verificationGeneration: entry.record.verificationGeneration,
          historyDigest: digestOf(entry.record.verifications),
          ...overrides,
        },
      };
    }

    function others(fixture: Fixture): string {
      return JSON.stringify(
        fixture.host
          .committedKeys()
          .filter((key) => key !== `classification:${SEASON}:${ROUND}`)
          .map((key) => [key, fixture.host.peek(key)]),
      );
    }

    it('clears a full history into the next generation, writing exactly the history, the generation and the receipt', async () => {
      const fixture = await setup();
      const before = await fill(fixture);
      expect(before.record.candidateRevision).toBe(B);
      // The documented canonical digest is the store's own.
      expect(await verificationHistoryDigest(before.record.verifications)).toBe(
        digestOf(before.record.verifications),
      );
      const untouched = others(fixture);
      fixture.clock.set(LATER);

      const outcome = await fixture
        .client()
        .rotateVerifications(rotation(fixture, before, ROTATION[0]));

      expect(outcome.outcome).toBe('applied');
      const after = await stored(fixture);
      expect(after.version).toBe(before.version + 1);
      expect(changedFields(before.record, after.record)).toEqual([
        'lastVerificationReset',
        'verificationGeneration',
        'verifications',
      ]);
      expect(after.record).toMatchObject({
        verifications: [],
        verificationGeneration: 1,
        lastVerificationReset: {
          operationId: ROTATION[0],
          at: LATER,
          authMethod: 'shared-admin-token',
          fromGeneration: 0,
          clearedCount: MAXIMUM_VERIFICATIONS,
          clearedDigest: digestOf(before.record.verifications),
        },
        // Kept: the pending candidate, the staged slot and everything else.
        candidateRevision: B,
        stagedCorrection: before.record.stagedCorrection,
      });
      // No season record, backlog entry, lease or other key changed.
      expect(others(fixture)).toBe(untouched);
    });

    it('refuses any verification formed against the earlier generation, before anything is matched, and verifies in the new one', async () => {
      const fixture = await setup();
      const before = await fill(fixture);
      await fixture
        .client()
        .rotateVerifications(rotation(fixture, before, ROTATION[0]));
      const bytes = committedBytes(fixture.host);

      // The resend of the candidate's first sighting, and a new ID, from
      // generation 0, and a generation that does not exist yet.
      for (const [operationId, generation] of [
        [opId(0), 0],
        [opId(40), 0],
        [opId(41), 2],
      ] as const) {
        expect(
          await verify(fixture, observed(B), operationId, generation),
        ).toEqual({
          outcome: 'rejected',
          reason: 'verification-generation-mismatch',
        });
      }
      expect(committedBytes(fixture.host)).toBe(bytes);

      // In generation 1, a later, distinct sighting corroborates the kept
      // candidate (T11b): two provider responses, never one counted twice.
      expect((await verify(fixture, observed(B), opId(0, 1), 1)).outcome).toBe(
        'applied',
      );
      const after = (await stored(fixture)).record;
      expect(after).toMatchObject({
        candidateRevision: null,
        competingCorrection: { revision: B, uncorroborated: false },
        markers: ['review_locked', 'staged'],
        verificationGeneration: 1,
      });
      expect(after.verifications.map((entry) => entry.transition)).toEqual([
        'candidate-corroborated',
      ]);
    });

    it('answers a resent rotation after a lost answer as already-applied, even after the record moved on, and never rotates twice', async () => {
      const fixture = await setup();
      const before = await fill(fixture);
      const request = rotation(fixture, before, ROTATION[0]);
      expect(
        (await fixture.client().rotateVerifications(request)).outcome,
      ).toBe('applied');
      // The record moves on in generation 1.
      expect(
        (await verify(fixture, { status: 'failed' }, opId(0, 1), 1)).outcome,
      ).toBe('applied');
      const bytes = committedBytes(fixture.host);

      expect(
        (await fixture.client().rotateVerifications(request)).outcome,
      ).toBe('already-applied');
      expect(committedBytes(fixture.host)).toBe(bytes);
      expect((await stored(fixture)).record.verificationGeneration).toBe(1);

      // The same ID naming another history is not a resend.
      expect(
        await fixture.client().rotateVerifications({
          ...request,
          expected: { ...request.expected, historyDigest: rev('other') },
        }),
      ).toEqual({ outcome: 'rejected', reason: 'operation-id-reused' });
      expect(committedBytes(fixture.host)).toBe(bytes);
    });

    it('refuses an older rotation resent after a later one as a generation mismatch, and writes nothing', async () => {
      const fixture = await setup();
      const first = rotation(fixture, await fill(fixture), ROTATION[0]);
      await fixture.client().rotateVerifications(first);
      const full = await fill(fixture, 1, { status: 'failed' });
      expect(
        (
          await fixture
            .client()
            .rotateVerifications(rotation(fixture, full, ROTATION[1]))
        ).outcome,
      ).toBe('applied');
      const bytes = committedBytes(fixture.host);

      expect(await fixture.client().rotateVerifications(first)).toEqual({
        outcome: 'rejected',
        reason: 'verification-generation-mismatch',
      });
      expect(committedBytes(fixture.host)).toBe(bytes);
      expect((await stored(fixture)).record).toMatchObject({
        verificationGeneration: 2,
        lastVerificationReset: { operationId: ROTATION[1], fromGeneration: 1 },
      });
    });

    it('keeps the generation across an object restart over the same storage', async () => {
      const fixture = await setup();
      const before = await fill(fixture);
      await fixture
        .client()
        .rotateVerifications(rotation(fixture, before, ROTATION[0]));

      // `client()` builds a new object over the same host every call.
      const restarted = fixture.client();
      const entry = await stored(fixture);
      const old = await restarted.verify({
        lease: fixture.token,
        round: ROUND,
        operationId: opId(0),
        authMethod: 'shared-admin-token',
        expected: {
          recordVersion: entry.version,
          stagedRevision: STAGED,
          verificationGeneration: 0,
        },
        observation: observed(B),
      });
      expect(old).toEqual({
        outcome: 'rejected',
        reason: 'verification-generation-mismatch',
      });
      expect(
        (
          await restarted.rotateVerifications(
            rotation(fixture, before, ROTATION[0]),
          )
        ).outcome,
      ).toBe('already-applied');
    });

    it.each([
      ['a stale record version', { recordVersion: 1 }, 'version-conflict'],
      [
        'another generation',
        { verificationGeneration: 1 },
        'verification-generation-mismatch',
      ],
      [
        'a digest of another history',
        { historyDigest: rev('not-the-archived-history') },
        'verification-history-digest-mismatch',
      ],
    ] as const)(
      'refuses %s and writes nothing',
      async (_, overrides, reason) => {
        const fixture = await setup();
        const before = await fill(fixture);
        const bytes = committedBytes(fixture.host);

        expect(
          await fixture
            .client()
            .rotateVerifications(
              rotation(fixture, before, ROTATION[0], overrides),
            ),
        ).toEqual({ outcome: 'rejected', reason });
        expect(committedBytes(fixture.host)).toBe(bytes);
      },
    );

    it('refuses a history that is not full: rotation is never a routine reset', async () => {
      const fixture = await setup();
      await verify(fixture, observed(B), opId(0), 0);
      const entry = await stored(fixture);
      const bytes = committedBytes(fixture.host);

      expect(
        await fixture
          .client()
          .rotateVerifications(rotation(fixture, entry, ROTATION[0])),
      ).toEqual({
        outcome: 'rejected',
        reason: 'verification-history-not-full',
      });
      expect(committedBytes(fixture.host)).toBe(bytes);
    });

    it('refuses without an operator hold', async () => {
      const fixture = await setup({ hold: false });
      const before = await fill(fixture);
      const bytes = committedBytes(fixture.host);

      expect(
        await fixture
          .client()
          .rotateVerifications(rotation(fixture, before, ROTATION[0])),
      ).toEqual({ outcome: 'rejected', reason: 'operator-hold-required' });
      expect(committedBytes(fixture.host)).toBe(bytes);
    });

    it('refuses a record locked for review: T12 resolves it first', async () => {
      const fixture = await setup();
      const before = await fill(fixture);
      // A competing correction with a full history, planted: only `verify`
      // creates one, and it cannot with a full history.
      plantClassification(
        fixture.host,
        {
          ...before.record,
          candidateRevision: null,
          candidateFirstSeenAt: null,
          competingCorrection: {
            revision: B,
            firstSeenAt: START,
            uncorroborated: false,
          },
          markers: ['review_locked', 'staged'],
        },
        before.version,
      );
      const entry = await stored(fixture);
      const bytes = committedBytes(fixture.host);

      expect(
        await fixture
          .client()
          .rotateVerifications(rotation(fixture, entry, ROTATION[0])),
      ).toEqual({ outcome: 'rejected', reason: 'review-locked' });
      expect(committedBytes(fixture.host)).toBe(bytes);
    });

    it('refuses to raise a generation that is already the largest safe integer', async () => {
      const fixture = await setup();
      const full = await fill(fixture);
      plantClassification(
        fixture.host,
        {
          ...full.record,
          verificationGeneration: Number.MAX_SAFE_INTEGER,
          lastVerificationReset: {
            operationId: ROTATION[2],
            at: START,
            authMethod: 'shared-admin-token',
            fromGeneration: Number.MAX_SAFE_INTEGER - 1,
            clearedCount: MAXIMUM_VERIFICATIONS,
            clearedDigest: rev('earlier'),
          },
        },
        full.version,
      );
      const entry = await stored(fixture);
      const bytes = committedBytes(fixture.host);

      expect(
        await fixture
          .client()
          .rotateVerifications(rotation(fixture, entry, ROTATION[0])),
      ).toEqual({
        outcome: 'rejected',
        reason: 'verification-generation-exhausted',
      });
      expect(committedBytes(fixture.host)).toBe(bytes);
    });

    it('keeps one operation-ID namespace across rounds and between verification and rotation', async () => {
      const fixture = await setup();
      const before = await fill(fixture);
      // Round 4: staged, with a backlog entry, planted.
      plantClassification(
        fixture.host,
        stagedClassification(OTHER_ROUND, STAGED),
      );
      fixture.host.transactionSync((store) =>
        store.put(`backlog:${SEASON}:${OTHER_ROUND}`, {
          schemaVersion: 1,
          kind: 'backlog-entry',
          season: SEASON,
          round: OTHER_ROUND,
          revision: STAGED,
          enteredAt: START,
        }),
      );
      let bytes = committedBytes(fixture.host);

      // A verification ID of this generation cannot name a rotation.
      expect(
        await fixture
          .client()
          .rotateVerifications(rotation(fixture, before, opId(5))),
      ).toEqual({ outcome: 'rejected', reason: 'operation-id-reused' });
      expect(committedBytes(fixture.host)).toBe(bytes);

      await fixture
        .client()
        .rotateVerifications(rotation(fixture, before, ROTATION[0]));
      bytes = committedBytes(fixture.host);

      // The rotation's ID cannot name a verification, on this round or
      // another one.
      for (const round of [ROUND, OTHER_ROUND]) {
        const generation = round === ROUND ? 1 : 0;
        expect(
          await verify(fixture, observed(B), ROTATION[0], generation, round),
        ).toEqual({ outcome: 'rejected', reason: 'operation-id-reused' });
      }
      // Nor another round's rotation.
      const other = await stored(fixture, OTHER_ROUND);
      expect(
        await fixture
          .client()
          .rotateVerifications(rotation(fixture, other, ROTATION[0])),
      ).toEqual({ outcome: 'rejected', reason: 'operation-id-reused' });
      expect(committedBytes(fixture.host)).toBe(bytes);

      // The stated limit: a cleared generation's IDs are no longer known, so
      // reusing one in the new generation is a new verification. Its old
      // resend, naming generation 0, is still refused.
      expect(
        (await verify(fixture, { status: 'failed' }, opId(5), 1)).outcome,
      ).toBe('applied');
    });

    it('refuses an unrecorded round, a lease that is not held, and invalid requests, writing nothing', async () => {
      const fixture = await setup();
      const before = await fill(fixture);
      const request = rotation(fixture, before, ROTATION[0]);
      const bytes = committedBytes(fixture.host);

      expect(
        await fixture.client().rotateVerifications({ ...request, round: 9 }),
      ).toEqual({
        outcome: 'rejected',
        reason: 'operator-precondition-failed',
      });
      for (const change of [
        { extra: true },
        { operationId: 'not-a-uuid' },
        { authMethod: 'Bearer local-test-token' },
        { expected: { ...request.expected, historyDigest: 'P1 VER' } },
        { expected: { ...request.expected, verificationGeneration: -1 } },
        { expected: { ...request.expected, recordVersion: 0 } },
        { expected: { ...request.expected, cleared: [] } },
      ]) {
        expect(
          await fixture.client().rotateVerifications({
            ...request,
            ...change,
          } as VerificationRotationRequest),
          JSON.stringify(change),
        ).toEqual({ outcome: 'rejected', reason: 'invalid-request' });
      }
      expect(committedBytes(fixture.host)).toBe(bytes);

      fixture.clock.set(
        new Date(Date.parse(START) + LEASE_TTL_MS + 1).toISOString(),
      );
      expect(await fixture.client().rotateVerifications(request)).toEqual({
        outcome: 'rejected',
        reason: 'lease-expired',
      });
      expect(committedBytes(fixture.host)).toBe(bytes);
    });

    it('lets no commit change the generation or its receipt', async () => {
      const fixture = await setup();
      const before = await fill(fixture);
      await fixture
        .client()
        .rotateVerifications(rotation(fixture, before, ROTATION[0]));
      const entry = await stored(fixture);
      const bytes = committedBytes(fixture.host);

      for (const change of [
        { verificationGeneration: 0, lastVerificationReset: null },
        { verificationGeneration: 2 },
        {
          lastVerificationReset: {
            ...entry.record.lastVerificationReset!,
            clearedDigest: rev('forged'),
          },
        },
      ]) {
        expect(
          await fixture.client().commit(
            commitRequest(fixture.token, {
              classifications: [
                write({ ...entry.record, ...change }, entry.version),
              ],
            }),
          ),
          JSON.stringify(change),
        ).toMatchObject({ outcome: 'rejected' });
      }
      // A first write cannot start in a later generation either.
      expect(
        await fixture.client().commit(
          commitRequest(fixture.token, {
            classifications: [
              write({
                ...stagedClassification(9, STAGED),
                stagedCorrection: null,
                markers: [],
                verificationGeneration: 1,
                lastVerificationReset: entry.record.lastVerificationReset,
              }),
            ],
          }),
        ),
      ).toEqual({ outcome: 'rejected', reason: 'staged-correction-immutable' });
      expect(committedBytes(fixture.host)).toBe(bytes);
    });
  },
);

describe('the stored verification generation', () => {
  const reset = {
    operationId: ROTATION[0],
    at: START,
    authMethod: 'shared-admin-token',
    fromGeneration: 0,
    clearedCount: MAXIMUM_VERIFICATIONS,
    clearedDigest: rev('cleared'),
  };
  const record = stagedClassification(ROUND, STAGED, SEASON, {
    verificationGeneration: 1,
    lastVerificationReset: reset,
  });

  it('is decoded strictly, with its receipt', () => {
    expect(decodeClassificationRecord(record)).toMatchObject({ ok: true });
    expect(
      decodeClassificationRecord(stagedClassification(ROUND, STAGED)),
    ).toMatchObject({ ok: true });

    for (const change of [
      // The generation and the receipt must agree.
      { verificationGeneration: 0 },
      { verificationGeneration: 2 },
      { lastVerificationReset: null },
      { verificationGeneration: -1 },
      { verificationGeneration: 1.5 },
      { verificationGeneration: Number.MAX_SAFE_INTEGER + 1 },
      // A closed, bounded receipt, never the cleared entries.
      { lastVerificationReset: { ...reset, cleared: [] } },
      { lastVerificationReset: { ...reset, clearedCount: 31 } },
      { lastVerificationReset: { ...reset, clearedDigest: 'P1 VER' } },
      { lastVerificationReset: { ...reset, operationId: 'not-a-uuid' } },
      { lastVerificationReset: { ...reset, authMethod: 'local-test-token' } },
      // The rotation ID is never also a verification ID of the generation.
      {
        verifications: [
          {
            operationId: ROTATION[0],
            at: START,
            authMethod: 'shared-admin-token',
            stagedRevision: STAGED,
            transition: 'check-failed',
          },
        ],
      },
    ]) {
      expect(
        decodeClassificationRecord({ ...record, ...change }),
        JSON.stringify(change),
      ).toEqual({ ok: false, reason: 'invalid-record' });
    }
    const missing: Record<string, unknown> = { ...record };
    delete missing.verificationGeneration;
    expect(decodeClassificationRecord(missing)).toEqual({
      ok: false,
      reason: 'invalid-record',
    });
  });
});
