/**
 * The ledger's `verify` operation (Provider Evaluation §10.4.1 T11-T11c, with
 * T5 and T6; PR-E3), in process and through the Durable Object client over
 * the same host.
 *
 * A verification writes only the verified classification record, and only
 * its candidate, competing, attempt and verification fields. Every refusal
 * writes nothing. A resent operation ID is never a second sighting.
 */

import { describe, expect, it } from 'vitest';

import { MemorySequencerHost } from '../../../../src/publication/sequencer/hosts';
import {
  DurableObjectReconciliationLedger,
  LocalReconciliationLedger,
  ReconciliationLedger,
  ReconciliationLedgerStore,
  type ClassificationRecord,
  type LeaseToken,
  type VerificationObservation,
  type VerificationRequest,
} from '../../../../src/sync/coordinated/ledger';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import { decodeClassificationRecord } from '../../../../src/sync/coordinated/ledger/records';
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

const OP = [
  '5f6a7b8c-9d0e-4f1a-8b2c-4d5e6f7a8b9c',
  '6a7b8c9d-0e1f-4a2b-9c3d-5e6f7a8b9c0d',
  '7b8c9d0e-1f2a-4b3c-ad4e-6f7a8b9c0d1e',
  '8c9d0e1f-2a3b-4c4d-be5f-7a8b9c0d1e2f',
] as const;

const ROUND = 3;
const STAGED = rev('staged-3');
const ACCEPTED = rev('content-3');
const OLD = rev('superseded-3');
const B = rev('candidate-b');
const C = rev('candidate-c');
// Within one lease (`LEASE_TTL_MS`), so the fixture's lease stays valid.
const LATER = '2026-09-27T12:02:00.000Z';
const LATEST = '2026-09-27T12:04:00.000Z';

const transports = ['local', 'durable-object'] as const;

const observed = (revision: string): VerificationObservation => ({
  status: 'observed',
  revision,
});

describe.each(transports)(
  'verify over the %s ledger transport',
  (transport) => {
    async function setup(
      overrides: Partial<Record<keyof ClassificationRecord, unknown>> = {},
    ) {
      const host = new MemorySequencerHost();
      const clock = new MutableClock(new Date(START));
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
          seasonRecord: write(
            seasonRecord({
              publicationDisposition: {
                state: 'blocked',
                since: START,
                reason: 'classification-staged',
              },
            }),
          ),
          classifications: [
            write(
              stagedClassification(ROUND, STAGED, SEASON, {
                supersededRevisions: [OLD],
                ...overrides,
              }),
            ),
          ],
          backlogInsertions: [{ round: ROUND, revision: STAGED }],
        }),
      );
      if (seeded.outcome !== 'committed') {
        throw new Error(`seed refused: ${JSON.stringify(seeded)}`);
      }
      return { host, clock, ledger, client, token };
    }

    type Fixture = Awaited<ReturnType<typeof setup>>;

    async function stored(fixture: Fixture) {
      const read = await fixture.client().readSeason(SEASON);
      if (read.outcome !== 'read') throw new Error('read refused');
      const entry = read.snapshot.classifications.find(
        (candidate) => candidate.record.round === ROUND,
      );
      if (entry === undefined) throw new Error('no record');
      return { entry, snapshot: read.snapshot };
    }

    async function verify(
      fixture: Fixture,
      observation: VerificationObservation,
      operationId: string,
      overrides: Partial<VerificationRequest> = {},
    ) {
      const { entry } = await stored(fixture);
      return fixture.ledger.verify({
        lease: fixture.token,
        round: ROUND,
        operationId,
        authMethod: 'shared-admin-token',
        expected: { recordVersion: entry.version, stagedRevision: STAGED },
        observation,
        ...overrides,
      });
    }

    /** Every committed key but the verified record: none may change. */
    function others(fixture: Fixture): string {
      return JSON.stringify(
        fixture.host
          .committedKeys()
          .filter((key) => key !== `classification:${SEASON}:${ROUND}`)
          .map((key) => [key, fixture.host.peek(key)]),
      );
    }

    async function applied(
      fixture: Fixture,
      observation: VerificationObservation,
      operationId: string,
    ) {
      const before = (await stored(fixture)).entry.record;
      const untouched = others(fixture);
      const outcome = await verify(fixture, observation, operationId);
      expect(outcome.outcome).toBe('applied');
      const after = (await stored(fixture)).entry.record;
      // No season record, backlog entry or other record is ever written.
      expect(others(fixture)).toBe(untouched);
      // The staged slot, the accepted and published revisions and the history
      // are never touched.
      for (const field of [
        'stagedCorrection',
        'contentRevision',
        'publishedRevision',
        'supersededRevisions',
        'reviewState',
        'sourceObservedAt',
        'lastDisposition',
      ] as const) {
        expect(after[field], field).toEqual(before[field]);
      }
      return { before, after };
    }

    it('T11: records a first sighting of another revision as the candidate only', async () => {
      const fixture = await setup();

      const { before, after } = await applied(fixture, observed(B), OP[0]);

      expect(changedFields(before, after)).toEqual([
        'candidateFirstSeenAt',
        'candidateRevision',
        'lastAttemptedAt',
        'lastSuccessfulObservationAt',
        'lastVerification',
        'markers',
      ]);
      expect(after).toMatchObject({
        candidateRevision: B,
        candidateFirstSeenAt: START,
        competingCorrection: null,
        markers: ['pending', 'staged'],
        lastVerification: {
          operationId: OP[0],
          at: START,
          authMethod: 'shared-admin-token',
          stagedRevision: STAGED,
          transition: 'candidate-observed',
        },
      });
    });

    it('T11b: a second verification of the same revision corroborates it and locks the record', async () => {
      const fixture = await setup();
      await applied(fixture, observed(B), OP[0]);
      fixture.clock.set(LATER);

      const { after } = await applied(fixture, observed(B), OP[1]);

      expect(after).toMatchObject({
        candidateRevision: null,
        candidateFirstSeenAt: null,
        // First seen at the first sighting, as T3 uses T2's time.
        competingCorrection: {
          revision: B,
          firstSeenAt: START,
          uncorroborated: false,
        },
        markers: ['review_locked', 'staged'],
        lastVerification: {
          operationId: OP[1],
          transition: 'candidate-corroborated',
        },
      });

      // T11d: a locked record is refused, and nothing is written.
      const bytes = committedBytes(fixture.host);
      fixture.clock.set(LATEST);
      expect(await verify(fixture, observed(C), OP[2])).toEqual({
        outcome: 'rejected',
        reason: 'review-locked',
      });
      expect(committedBytes(fixture.host)).toBe(bytes);
    });

    it('T11c: a third revision replaces the candidate, and the staged or accepted revision discards it', async () => {
      const fixture = await setup();
      await applied(fixture, observed(B), OP[0]);
      fixture.clock.set(LATER);

      const replaced = await applied(fixture, observed(C), OP[1]);
      expect(replaced.after).toMatchObject({
        candidateRevision: C,
        candidateFirstSeenAt: LATER,
        competingCorrection: null,
        lastVerification: { transition: 'candidate-replaced' },
      });

      fixture.clock.set(LATEST);
      const discarded = await applied(fixture, observed(STAGED), OP[2]);
      expect(discarded.after).toMatchObject({
        candidateRevision: null,
        candidateFirstSeenAt: null,
        competingCorrection: null,
        markers: ['staged'],
        lastVerification: { transition: 'candidate-discarded' },
      });

      await applied(fixture, observed(B), OP[3]);
      const accepted = await applied(fixture, observed(ACCEPTED), OP[0]);
      expect(accepted.after).toMatchObject({
        candidateRevision: null,
        lastVerification: { transition: 'candidate-discarded' },
      });
    });

    it.each([
      ['staged-seen', STAGED],
      ['accepted-seen', ACCEPTED],
    ] as const)(
      'T11 %s: the staged or accepted revision again changes nothing durable',
      async (transition, revision) => {
        const fixture = await setup();

        const { before, after } = await applied(
          fixture,
          observed(revision),
          OP[0],
        );

        expect(changedFields(before, after)).toEqual([
          'lastAttemptedAt',
          'lastSuccessfulObservationAt',
          'lastVerification',
        ]);
        expect(after.lastVerification?.transition).toBe(transition);
        expect(after.consecutiveConfirmations).toBe(
          before.consecutiveConfirmations,
        );
      },
    );

    it('T5: a superseded revision is never tracked, and discards a pending candidate', async () => {
      const fixture = await setup({ consecutiveConfirmations: 3 });
      await applied(fixture, observed(B), OP[0]);

      const { after } = await applied(fixture, observed(OLD), OP[1]);

      expect(after).toMatchObject({
        candidateRevision: null,
        candidateFirstSeenAt: null,
        competingCorrection: null,
        consecutiveConfirmations: 0,
        lastVerification: { transition: 'superseded-rejected' },
      });
    });

    it('T6: a failed request records the attempt and changes no candidate or slot', async () => {
      const fixture = await setup({ limiterDeferralUntil: START });
      await applied(fixture, observed(B), OP[0]);
      fixture.clock.set(LATER);

      const { before, after } = await applied(
        fixture,
        { status: 'failed' },
        OP[1],
      );

      expect(changedFields(before, after)).toEqual([
        'lastAttemptedAt',
        'lastVerification',
      ]);
      expect(after).toMatchObject({
        candidateRevision: B,
        candidateFirstSeenAt: START,
        competingCorrection: null,
        lastAttemptedAt: LATER,
        lastSuccessfulObservationAt: START,
        lastVerification: { operationId: OP[1], transition: 'check-failed' },
      });
    });

    it('records a limiter deferral as the existing deferral rule, and not as a verification', async () => {
      const fixture = await setup();

      const { before, after } = await applied(
        fixture,
        { status: 'deferred', retryAt: LATER },
        OP[0],
      );

      expect(changedFields(before, after)).toEqual(['limiterDeferralUntil']);
      expect(after.limiterDeferralUntil).toBe(LATER);
      expect(after.lastVerification).toBeNull();

      // The same operation, sent again once the limiter allows it, verifies.
      fixture.clock.set(LATER);
      const retried = await applied(fixture, observed(B), OP[0]);
      expect(retried.after).toMatchObject({
        candidateRevision: B,
        limiterDeferralUntil: null,
        lastVerification: { operationId: OP[0] },
      });
    });

    it('answers a resent operation ID without a second sighting, and refuses it for another target', async () => {
      const fixture = await setup();
      await applied(fixture, observed(B), OP[0]);
      const bytes = committedBytes(fixture.host);
      fixture.clock.set(LATER);

      const resent = await verify(fixture, observed(B), OP[0]);
      expect(resent.outcome).toBe('already-applied');
      // One response is never counted as two: still only a candidate.
      expect(committedBytes(fixture.host)).toBe(bytes);
      expect((await stored(fixture)).entry.record).toMatchObject({
        candidateRevision: B,
        competingCorrection: null,
      });

      expect(
        await verify(fixture, observed(B), OP[0], {
          expected: { recordVersion: 2, stagedRevision: rev('other-staged') },
        }),
      ).toEqual({ outcome: 'rejected', reason: 'operation-id-reused' });
      expect(committedBytes(fixture.host)).toBe(bytes);
    });

    it.each([
      [
        'a stale staged target',
        { expected: { recordVersion: 1, stagedRevision: rev('stale') } },
        'operator-precondition-failed',
      ],
      [
        'a stale record version',
        { expected: { recordVersion: 7, stagedRevision: STAGED } },
        'version-conflict',
      ],
      ['an unrecorded round', { round: 9 }, 'operator-precondition-failed'],
    ] as const)(
      'refuses %s and writes nothing',
      async (_, overrides, reason) => {
        const fixture = await setup();
        const bytes = committedBytes(fixture.host);

        expect(
          await verify(
            fixture,
            observed(B),
            OP[0],
            overrides as Partial<VerificationRequest>,
          ),
        ).toEqual({ outcome: 'rejected', reason });
        expect(committedBytes(fixture.host)).toBe(bytes);
      },
    );

    it('refuses a record with nothing staged, or a staged slot without its backlog entry', async () => {
      const fixture = await setup();
      // Round 4: settled, nothing staged. Round 5: staged, with no backlog
      // entry - a state only corruption could produce, planted directly.
      plantClassification(
        fixture.host,
        stagedClassification(4, STAGED, SEASON, {
          stagedCorrection: null,
          markers: [],
        }),
      );
      plantClassification(fixture.host, stagedClassification(5, STAGED));
      const bytes = committedBytes(fixture.host);

      for (const [round, reason] of [
        [4, 'operator-precondition-failed'],
        [5, 'backlog-entry-missing'],
      ] as const) {
        expect(
          await fixture.ledger.verify({
            lease: fixture.token,
            round,
            operationId: OP[0],
            authMethod: 'shared-admin-token',
            expected: { recordVersion: 1, stagedRevision: STAGED },
            observation: observed(B),
          }),
        ).toEqual({ outcome: 'rejected', reason });
      }
      expect(committedBytes(fixture.host)).toBe(bytes);
    });

    it('refuses a released or superseded lease, and writes nothing', async () => {
      const fixture = await setup();
      await fixture.ledger.releaseLease(fixture.token);
      const bytes = committedBytes(fixture.host);

      expect(await verify(fixture, observed(B), OP[0])).toEqual({
        outcome: 'rejected',
        reason: 'lease-not-held',
      });
      const next = await fixture.ledger.acquireLease(SEASON);
      expect(next.outcome).toBe('acquired');
      const afterAcquire = committedBytes(fixture.host);
      expect(await verify(fixture, observed(B), OP[0])).toEqual({
        outcome: 'rejected',
        reason: 'lease-superseded',
      });
      expect(committedBytes(fixture.host)).toBe(afterAcquire);
      expect(afterAcquire).not.toBe(bytes);
    });

    it.each([
      ['an unknown key', { extra: true }],
      ['an unknown observation', { observation: { status: 'maybe' } }],
      [
        'an observation with a value',
        { observation: { status: 'failed', reason: 'upstream body' } },
      ],
      [
        'a revision that is not a hash',
        { observation: { status: 'observed', revision: 'P1 VER' } },
      ],
      ['a malformed operation ID', { operationId: 'not-a-uuid' }],
      ['a token as the auth method', { authMethod: 'Bearer local-test-token' }],
      [
        'record version 0',
        { expected: { recordVersion: 0, stagedRevision: STAGED } },
      ],
    ])('refuses a request with %s', async (_, change) => {
      const fixture = await setup();
      const { entry } = await stored(fixture);
      const bytes = committedBytes(fixture.host);

      const outcome = await fixture.ledger.verify({
        lease: fixture.token,
        round: ROUND,
        operationId: OP[0],
        authMethod: 'shared-admin-token',
        expected: { recordVersion: entry.version, stagedRevision: STAGED },
        observation: observed(B),
        ...(change as object),
      } as VerificationRequest);

      expect(outcome).toEqual({
        outcome: 'rejected',
        reason: 'invalid-request',
      });
      expect(committedBytes(fixture.host)).toBe(bytes);
    });
  },
);

describe('the stored verification record', () => {
  it('is decoded strictly, and carries no value', () => {
    const record = stagedClassification(ROUND, STAGED, SEASON, {
      lastVerification: {
        operationId: OP[0],
        at: START,
        authMethod: 'shared-admin-token',
        stagedRevision: STAGED,
        transition: 'candidate-observed',
      },
    });
    expect(decodeClassificationRecord(record)).toMatchObject({ ok: true });

    for (const lastVerification of [
      { ...record.lastVerification, transition: 'published' },
      { ...record.lastVerification, stagedRevision: 'P1 VER' },
      { ...record.lastVerification, comparison: { changed: 1 } },
      { ...record.lastVerification, authMethod: 'local-test-token' },
    ]) {
      expect(
        decodeClassificationRecord({ ...record, lastVerification }),
      ).toEqual({ ok: false, reason: 'invalid-record' });
    }
  });
});
