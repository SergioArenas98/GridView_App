/**
 * `prepare`: admission, identity allocation and per-key timestamp assignment
 * (ADR 0025 D4).
 *
 * Everything here happens inside one authoritative transition. Nothing in this
 * file reads Workers KV, and nothing proves anything about Cloudflare platform
 * behaviour - every assertion is over this component's own durable state.
 */

import { describe, expect, it } from 'vitest';

import {
  epochOfCandidateVersion,
  versionNamespace,
} from '../../../src/publication/sequencer';
import {
  OTHER_SEASON,
  SEASON,
  SEED_ACTIVE_VERSION,
  SEED_HIGH_WATER_MARK,
  SEED_ORDERING_INPUT,
  activeSequencer,
  commitment,
  keyRevision,
  keyState,
  makeSequencer,
  prepareRequest,
  rev,
  seedFor,
} from './support';

function preparedOrThrow(
  outcome: ReturnType<
    ReturnType<typeof activeSequencer>['sequencer']['prepare']
  >,
) {
  if (outcome.outcome !== 'prepared') {
    throw new Error(`expected prepared, got ${JSON.stringify(outcome)}`);
  }
  return outcome;
}

describe('prepare: allocation and identity', () => {
  it('allocates the candidate version itself and accepts none from the caller', () => {
    const { sequencer } = activeSequencer();
    const request = prepareRequest();
    // The request type has no `candidateVersion` member at all, and the
    // allocated value is in the reserved namespace bound to this epoch.
    expect('candidateVersion' in request).toBe(false);
    const prepared = preparedOrThrow(sequencer.prepare(request));
    expect(versionNamespace(prepared.candidateVersion)).toBe(
      'sidecar-required',
    );
    expect(epochOfCandidateVersion(prepared.candidateVersion)).toBe(
      prepared.operationEpoch,
    );
  });

  it('allocates strictly increasing epochs and never reuses a candidate version', () => {
    const { sequencer } = activeSequencer();
    const versions = new Set<string>();
    const epochs: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const prepared = preparedOrThrow(
        sequencer.prepare(
          prepareRequest({
            perKeyRevisions: [
              keyRevision('calendar', rev(`calendar-${index}`)),
            ],
          }),
        ),
      );
      epochs.push(prepared.operationEpoch);
      expect(versions.has(prepared.candidateVersion)).toBe(false);
      versions.add(prepared.candidateVersion);
      // Retire the operation so the next one is admissible. Cancelled epochs
      // are included deliberately: a retired epoch's version must never be
      // reachable again.
      sequencer.cancel({
        season: SEASON,
        operationEpoch: prepared.operationEpoch,
        operationToken: prepared.operationToken,
      });
    }
    expect(epochs).toEqual([1, 2, 3, 4, 5]);
    expect(versions.size).toBe(5);
  });

  it('allocates nothing while a live prepared operation exists', () => {
    const { sequencer, host } = activeSequencer();
    const first = preparedOrThrow(sequencer.prepare(prepareRequest()));
    const before = host.peek('authority');

    const retry = sequencer.prepare(prepareRequest());
    expect(retry.outcome).toBe('rejected');
    if (retry.outcome !== 'rejected') throw new Error('unreachable');
    expect(retry.reason).toBe('operation-in-progress');
    // The live identity comes back so a caller that lost its response knows
    // which epoch and version it is waiting on. The token never does: it is the
    // authorization handle for `finalize`.
    expect(retry.liveOperation).toEqual({
      operationEpoch: first.operationEpoch,
      candidateVersion: first.candidateVersion,
    });
    expect(retry).not.toHaveProperty('operationToken');
    // No epoch was consumed and no version was minted.
    expect(host.peek('authority')).toEqual(before);
  });

  it('gives a genuinely new prepare a new epoch and a different version', () => {
    const { sequencer } = activeSequencer();
    const first = preparedOrThrow(sequencer.prepare(prepareRequest()));
    sequencer.cancel({
      season: SEASON,
      operationEpoch: first.operationEpoch,
      operationToken: first.operationToken,
    });
    const second = preparedOrThrow(sequencer.prepare(prepareRequest()));
    expect(second.operationEpoch).toBe(first.operationEpoch + 1);
    expect(second.candidateVersion).not.toBe(first.candidateVersion);
    expect(second.operationToken).not.toBe(first.operationToken);
  });

  it('admits a replacement once the live operation has expired', () => {
    const harness = activeSequencer({ preparationTtlMs: 60_000 });
    const first = preparedOrThrow(harness.sequencer.prepare(prepareRequest()));
    expect(harness.sequencer.prepare(prepareRequest()).outcome).toBe(
      'rejected',
    );
    harness.clock.advance(60_001);
    const replacement = preparedOrThrow(
      harness.sequencer.prepare(prepareRequest()),
    );
    expect(replacement.operationEpoch).toBe(first.operationEpoch + 1);
  });
});

describe('prepare: source-ordering admission', () => {
  it('rejects an ordinary candidate strictly older than the committed input', () => {
    const { sequencer } = activeSequencer();
    const outcome = sequencer.prepare(
      prepareRequest({ sourceOrderingInput: '2026-08-31T23:59:59.999Z' }),
    );
    expect(outcome).toEqual({
      outcome: 'rejected',
      reason: 'older-source-ordering-input',
    });
  });

  it('admits an ordinary candidate equal to the committed input', () => {
    // Exactly as strict as the pre-sequencer publisher: only `<` is rejected.
    const { sequencer } = activeSequencer();
    expect(
      sequencer.prepare(
        prepareRequest({ sourceOrderingInput: '2026-09-01T00:00:00.000Z' }),
      ).outcome,
    ).toBe('prepared');
  });

  it('admits an ordinary candidate newer than the committed input', () => {
    const { sequencer } = activeSequencer();
    expect(
      sequencer.prepare(
        prepareRequest({ sourceOrderingInput: '2026-09-05T00:00:00.000Z' }),
      ).outcome,
    ).toBe('prepared');
  });

  it('never evaluates the staleness predicate for a rollback republication', () => {
    const { sequencer } = activeSequencer();
    const rollback = sequencer.prepare(
      prepareRequest({
        operationKind: 'rollback-republication',
        sourceOrderingInput: '2020-01-01T00:00:00.000Z',
      }),
    );
    expect(rollback.outcome).toBe('prepared');
  });

  it('changes admission only, never the per-key transition semantics', () => {
    // The exemption affects whether a candidate is admitted. Steps 6-8 of the
    // rollback model - comparison against the *currently active* revision and
    // the two-case timestamp assignment - apply to a rollback candidate exactly
    // as they apply to any other candidate.
    const ordinary = activeSequencer({ now: '2026-10-01T12:00:00.000Z' });
    const rollback = activeSequencer({ now: '2026-10-01T12:00:00.000Z' });
    const perKeyRevisions = [
      keyRevision('calendar', rev('calendar-1')),
      keyRevision('standings:drivers', rev('standings-CHANGED')),
    ];
    const ordinaryPrepared = preparedOrThrow(
      ordinary.sequencer.prepare(
        prepareRequest({
          sourceOrderingInput: '2026-10-01T00:00:00.000Z',
          perKeyRevisions,
        }),
      ),
    );
    const rollbackPrepared = preparedOrThrow(
      rollback.sequencer.prepare(
        prepareRequest({
          operationKind: 'rollback-republication',
          sourceOrderingInput: '2020-01-01T00:00:00.000Z',
          perKeyRevisions,
        }),
      ),
    );
    expect(rollbackPrepared.assignedTimestamps).toEqual(
      ordinaryPrepared.assignedTimestamps,
    );
  });

  it('scopes the exemption to the operation kind, not to the ordering value', () => {
    const older = '2020-01-01T00:00:00.000Z';
    const ordinary = activeSequencer().sequencer.prepare(
      prepareRequest({
        operationKind: 'ordinary-publication',
        sourceOrderingInput: older,
      }),
    );
    const rollback = activeSequencer().sequencer.prepare(
      prepareRequest({
        operationKind: 'rollback-republication',
        sourceOrderingInput: older,
      }),
    );
    expect(ordinary.outcome).toBe('rejected');
    expect(rollback.outcome).toBe('prepared');
  });
});

describe('prepare: the two-case per-key timestamp rule', () => {
  const unchangedRevision = rev('calendar-1');

  it('retains an unchanged, currently active key’s timestamp even when another key changes', () => {
    const { sequencer } = activeSequencer();
    const prepared = preparedOrThrow(
      sequencer.prepare(
        prepareRequest({
          perKeyRevisions: [
            keyRevision('calendar', unchangedRevision),
            keyRevision('standings:drivers', rev('standings-CHANGED')),
          ],
        }),
      ),
    );
    const byName = new Map(
      prepared.assignedTimestamps.map((state) => [state.documentName, state]),
    );
    expect(byName.get('calendar')?.observedAt).toBe(SEED_HIGH_WATER_MARK);
    expect(byName.get('standings:drivers')?.observedAt).not.toBe(
      SEED_HIGH_WATER_MARK,
    );
  });

  it('treats a changed key as a fresh activation floored by the high-water mark', () => {
    // The clock is deliberately *behind* the seeded floor, so the floor is what
    // decides the value rather than wall time.
    const harness = activeSequencer({ now: '2026-08-01T00:00:00.000Z' });
    const prepared = preparedOrThrow(
      harness.sequencer.prepare(
        prepareRequest({
          sourceOrderingInput: '2026-09-01T00:00:00.000Z',
          perKeyRevisions: [keyRevision('calendar', rev('calendar-CHANGED'))],
        }),
      ),
    );
    expect(prepared.assignedTimestamps[0]?.observedAt).toBe(
      '2026-09-01T00:00:00.001Z',
    );
  });

  it('treats a key with no currently active revision as a fresh activation', () => {
    const harness = activeSequencer({ now: '2026-08-01T00:00:00.000Z' });
    const prepared = preparedOrThrow(
      harness.sequencer.prepare(
        prepareRequest({
          perKeyRevisions: [keyRevision('driver:new', rev('driver-new'))],
        }),
      ),
    );
    expect(prepared.assignedTimestamps[0]?.observedAt).toBe(
      '2026-09-01T00:00:00.001Z',
    );
  });

  it('gives every fresh activation in one call the same value', () => {
    const { sequencer } = activeSequencer();
    const prepared = preparedOrThrow(
      sequencer.prepare(
        prepareRequest({
          perKeyRevisions: [
            keyRevision('calendar', rev('calendar-CHANGED')),
            keyRevision('circuits', rev('circuits-NEW')),
          ],
        }),
      ),
    );
    const [first, second] = prepared.assignedTimestamps;
    expect(first?.observedAt).toBe(second?.observedAt);
  });

  it('uses wall time when it already exceeds the floor', () => {
    const harness = activeSequencer({ now: '2026-10-01T12:00:00.000Z' });
    const prepared = preparedOrThrow(
      harness.sequencer.prepare(
        prepareRequest({
          sourceOrderingInput: '2026-10-01T00:00:00.000Z',
          perKeyRevisions: [keyRevision('calendar', rev('calendar-CHANGED'))],
        }),
      ),
    );
    expect(prepared.assignedTimestamps[0]?.observedAt).toBe(
      '2026-10-01T12:00:00.000Z',
    );
  });
});

describe('prepare: bounded input and state-specific authority', () => {
  it('refuses to publish from an uninitialized season', () => {
    const { sequencer } = makeSequencer();
    expect(sequencer.prepare(prepareRequest())).toEqual({
      outcome: 'rejected',
      reason: 'authority-not-active',
    });
  });

  it('refuses to publish from a seeded but not yet activated season', () => {
    // `seeded` is a pre-activation state: legacy pointers remain the declared
    // authority and this season's mutators stay paused.
    const { sequencer } = makeSequencer();
    expect(sequencer.seedCutover(seedFor()).outcome).toBe('seeded');
    expect(sequencer.prepare(prepareRequest())).toEqual({
      outcome: 'rejected',
      reason: 'authority-not-active',
    });
  });

  it('never answers for another season', () => {
    const { sequencer } = activeSequencer();
    expect(sequencer.prepare(prepareRequest({ season: OTHER_SEASON }))).toEqual(
      { outcome: 'rejected', reason: 'season-mismatch' },
    );
  });

  it('keeps unrelated seasons independent', () => {
    const first = activeSequencer();
    const second = activeSequencer(
      {},
      seedFor({
        season: OTHER_SEASON,
        cutoverFingerprint: 'cutover-2025-a1',
        activeVersion: '20250901T000000000-bbbbbbbb',
        perKeyState: [
          keyState('calendar', rev('calendar-2025'), SEED_HIGH_WATER_MARK),
        ],
      }),
    );
    preparedOrThrow(first.sequencer.prepare(prepareRequest()));
    // The second season has its own storage and its own epoch space: the first
    // season's live operation neither blocks it nor advances its epoch.
    const other = preparedOrThrow(
      second.sequencer.prepare(prepareRequest({ season: OTHER_SEASON })),
    );
    expect(other.operationEpoch).toBe(1);
    expect(second.sequencer.readAuthority(OTHER_SEASON)).toMatchObject({
      activeVersion: '20250901T000000000-bbbbbbbb',
    });
    expect(first.sequencer.readAuthority(SEASON)).toMatchObject({
      activeVersion: '20260901T000000000-aaaaaaaa',
    });
  });

  it('rejects malformed input with a bounded reason and allocates nothing', () => {
    const { sequencer, host } = activeSequencer();
    const before = host.peek('authority');
    const cases: [Parameters<typeof prepareRequest>[0], string][] = [
      [{ season: 12 }, 'invalid-season'],
      [
        { operationKind: 'sideways-publication' as never },
        'invalid-operation-kind',
      ],
      [{ perKeyRevisions: [] }, 'invalid-per-key-revisions'],
      [
        { perKeyRevisions: [keyRevision('calendar', 'not-a-revision')] },
        'invalid-per-key-revisions',
      ],
      [
        {
          perKeyRevisions: [
            keyRevision('calendar', rev('a')),
            keyRevision('calendar', rev('b')),
          ],
        },
        'invalid-per-key-revisions',
      ],
      [{ sourceOrderingInput: 'yesterday' }, 'invalid-source-ordering-input'],
      [{ expectedManifestCommitment: 'nope' }, 'invalid-manifest-commitment'],
    ];
    for (const [overrides, reason] of cases) {
      expect(sequencer.prepare(prepareRequest(overrides))).toEqual({
        outcome: 'rejected',
        reason,
      });
    }
    expect(host.peek('authority')).toEqual(before);
  });

  it('rejects a manifest larger than the bounded maximum', () => {
    const { sequencer } = activeSequencer();
    const perKeyRevisions = Array.from({ length: 2001 }, (_, index) =>
      keyRevision(`driver:${index}`, rev(`driver-${index}`)),
    );
    expect(sequencer.prepare(prepareRequest({ perKeyRevisions }))).toEqual({
      outcome: 'rejected',
      reason: 'manifest-too-large',
    });
  });

  it('accepts the manifest commitment as an input and records it verbatim', () => {
    // `prepare` never computes or derives the commitment: it stores exactly
    // what the caller enumerated before a destination version existed, and
    // `finalize` compares the later attestation against that stored value.
    const { sequencer, host } = activeSequencer();
    const supplied = commitment('a-caller-computed-manifest');
    preparedOrThrow(
      sequencer.prepare(
        prepareRequest({ expectedManifestCommitment: supplied }),
      ),
    );
    expect(host.peek('operation')).toMatchObject({
      expectedManifestCommitment: supplied,
    });
  });

  it('records the operation kind durably rather than inferring it later', () => {
    const { sequencer, host } = activeSequencer();
    preparedOrThrow(
      sequencer.prepare(
        prepareRequest({
          operationKind: 'rollback-republication',
          sourceOrderingInput: '2020-01-01T00:00:00.000Z',
        }),
      ),
    );
    expect(host.peek('operation')).toMatchObject({
      operationKind: 'rollback-republication',
      phase: 'prepared',
    });
  });

  it('commits nothing about the active release', () => {
    const { sequencer, host } = activeSequencer();
    preparedOrThrow(
      sequencer.prepare(
        prepareRequest({
          sourceOrderingInput: '2026-09-09T00:00:00.000Z',
          perKeyRevisions: [keyRevision('calendar', rev('calendar-CHANGED'))],
        }),
      ),
    );
    // A prepared operation changes neither the active pair, the committed
    // ordering input nor the high-water mark. Its proposed timestamps are
    // visible only in its own record until `finalize` commits them.
    expect(sequencer.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'active',
      activeVersion: SEED_ACTIVE_VERSION,
      previousVersion: null,
    });
    expect(host.peek('authority')).toMatchObject({
      committedSourceOrderingInput: SEED_ORDERING_INPUT,
      seasonSnapshotObservedAtHighWaterMark: SEED_HIGH_WATER_MARK,
    });
  });
});
