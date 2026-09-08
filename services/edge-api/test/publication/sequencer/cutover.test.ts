/**
 * The inert cutover-state mechanism: `uninitialized`, `seeded`, `active`
 * (ADR 0025 D12).
 *
 * The mechanism accepts an **already validated, complete** seed supplied by a
 * future migration caller. It never enumerates or reads legacy Workers KV
 * pointers itself, and nothing here implements the migration runner, operator
 * authentication, KV convergence checks or a production cutover.
 *
 * Steps 10 and 11 are deliberately two separate durable transitions. A crash
 * between them is a real, distinguishable state, so these tests assert the
 * exact resulting `cutoverState` in each case rather than treating the pair as
 * effectively atomic.
 */

import { describe, expect, it } from 'vitest';

import {
  FINGERPRINT,
  OTHER_SEASON,
  SEASON,
  SEED_ACTIVE_VERSION,
  SEED_HIGH_WATER_MARK,
  SEED_ORDERING_INPUT,
  keyState,
  makeSequencer,
  prepareRequest,
  rev,
  seedFor,
} from './support';

describe('cutover: seeding', () => {
  it('starts uninitialized, with no seed and no authority', () => {
    const { sequencer } = makeSequencer();
    expect(sequencer.readAuthority(SEASON)).toEqual({
      cutoverState: 'uninitialized',
      authoritative: false,
    });
  });

  it('commits the complete seed atomically and reports seeded', () => {
    const { sequencer, host } = makeSequencer();
    expect(sequencer.seedCutover(seedFor())).toEqual({ outcome: 'seeded' });
    expect(host.peek('authority')).toEqual({
      season: SEASON,
      cutoverState: 'seeded',
      activeVersion: SEED_ACTIVE_VERSION,
      previousVersion: null,
      committedSourceOrderingInput: SEED_ORDERING_INPUT,
      seasonSnapshotObservedAtHighWaterMark: SEED_HIGH_WATER_MARK,
      lastOperationEpoch: 0,
      cutoverFingerprint: FINGERPRINT,
    });
    expect(host.peek('committed/calendar')).toMatchObject({
      revision: rev('calendar-1'),
      observedAt: SEED_HIGH_WATER_MARK,
    });
  });

  it('accepts an optional validated previous version, and a null one', () => {
    const withPrevious = makeSequencer();
    expect(
      withPrevious.sequencer.seedCutover(
        seedFor({ previousVersion: '20260801T000000000-cccccccc' }),
      ),
    ).toEqual({ outcome: 'seeded' });
    expect(withPrevious.sequencer.readAuthority(SEASON)).toMatchObject({
      previousVersion: '20260801T000000000-cccccccc',
    });

    const withoutPrevious = makeSequencer();
    withoutPrevious.sequencer.seedCutover(seedFor());
    expect(withoutPrevious.sequencer.readAuthority(SEASON)).toMatchObject({
      previousVersion: null,
    });
  });

  it('is idempotent for the identical seed and fingerprint', () => {
    const { sequencer, host } = makeSequencer();
    sequencer.seedCutover(seedFor());
    const before = host.committedKeys().map((key) => [key, host.peek(key)]);
    expect(sequencer.seedCutover(seedFor())).toEqual({
      outcome: 'already-seeded',
    });
    expect(host.committedKeys().map((key) => [key, host.peek(key)])).toEqual(
      before,
    );
  });

  it('is idempotent for the identical seed against an already-active season', () => {
    const { sequencer } = makeSequencer();
    sequencer.seedCutover(seedFor());
    sequencer.activateCutover({
      season: SEASON,
      cutoverFingerprint: FINGERPRINT,
    });
    expect(sequencer.seedCutover(seedFor())).toEqual({
      outcome: 'already-active',
    });
  });

  it('fails closed on a different fingerprint for the same season', () => {
    const { sequencer, host } = makeSequencer();
    sequencer.seedCutover(seedFor());
    const before = host.peek('authority');
    expect(
      sequencer.seedCutover(seedFor({ cutoverFingerprint: 'cutover-2026-b2' })),
    ).toEqual({ outcome: 'rejected', reason: 'conflicting-cutover-seed' });
    expect(host.peek('authority')).toEqual(before);
  });

  it('fails closed on the same fingerprint carrying a different seed', () => {
    const { sequencer } = makeSequencer();
    sequencer.seedCutover(seedFor());
    for (const conflicting of [
      seedFor({ activeVersion: '20260901T000000000-dddddddd' }),
      seedFor({ previousVersion: '20260801T000000000-cccccccc' }),
      seedFor({ committedSourceOrderingInput: '2026-09-02T00:00:00.000Z' }),
      seedFor({
        seasonSnapshotObservedAtHighWaterMark: '2026-09-02T00:00:00.000Z',
      }),
      seedFor({
        perKeyState: [
          keyState('calendar', rev('calendar-DIFFERENT'), SEED_HIGH_WATER_MARK),
          keyState(
            'standings:drivers',
            rev('standings-1'),
            SEED_HIGH_WATER_MARK,
          ),
        ],
      }),
      seedFor({
        perKeyState: [
          keyState('calendar', rev('calendar-1'), SEED_HIGH_WATER_MARK),
        ],
      }),
    ]) {
      expect(sequencer.seedCutover(conflicting)).toEqual({
        outcome: 'rejected',
        reason: 'conflicting-cutover-seed',
      });
    }
  });

  it('rejects a malformed seed with a bounded reason and writes nothing', () => {
    const { sequencer, host } = makeSequencer();
    const cases: [Parameters<typeof seedFor>[0], string][] = [
      [{ season: 12 }, 'invalid-season'],
      [{ cutoverFingerprint: '' }, 'invalid-cutover-fingerprint'],
      [{ activeVersion: 'has:colons' }, 'invalid-seed'],
      [{ committedSourceOrderingInput: 'yesterday' }, 'invalid-seed'],
      [{ seasonSnapshotObservedAtHighWaterMark: 'later' }, 'invalid-seed'],
      [{ perKeyState: [] }, 'invalid-per-key-revisions'],
      [
        {
          perKeyState: [
            keyState('calendar', 'not-a-revision', SEED_HIGH_WATER_MARK),
          ],
        },
        'invalid-per-key-revisions',
      ],
    ];
    for (const [overrides, reason] of cases) {
      expect(sequencer.seedCutover(seedFor(overrides))).toEqual({
        outcome: 'rejected',
        reason,
      });
    }
    expect(host.committedKeys()).toEqual([]);
  });

  it('never answers for another season once seeded', () => {
    const { sequencer } = makeSequencer();
    sequencer.seedCutover(seedFor());
    expect(sequencer.readAuthority(OTHER_SEASON)).toEqual({
      cutoverState: 'unavailable',
      authoritative: false,
    });
    expect(sequencer.seedCutover(seedFor({ season: OTHER_SEASON }))).toEqual({
      outcome: 'rejected',
      reason: 'season-mismatch',
    });
  });
});

describe('cutover: activation', () => {
  it('refuses activation for a season holding no seed', () => {
    const { sequencer } = makeSequencer();
    expect(
      sequencer.activateCutover({
        season: SEASON,
        cutoverFingerprint: FINGERPRINT,
      }),
    ).toEqual({ outcome: 'rejected', reason: 'cutover-not-seeded' });
  });

  it('requires the exact seeded fingerprint', () => {
    const { sequencer } = makeSequencer();
    sequencer.seedCutover(seedFor());
    expect(
      sequencer.activateCutover({
        season: SEASON,
        cutoverFingerprint: 'cutover-2026-b2',
      }),
    ).toEqual({ outcome: 'rejected', reason: 'cutover-fingerprint-mismatch' });
    // The season stays seeded, unchanged.
    expect(sequencer.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'seeded',
      authoritative: false,
    });
  });

  it('rejects a missing or malformed confirmation', () => {
    const { sequencer } = makeSequencer();
    sequencer.seedCutover(seedFor());
    expect(
      sequencer.activateCutover({
        season: SEASON,
        cutoverFingerprint: '' as string,
      }),
    ).toEqual({ outcome: 'rejected', reason: 'invalid-cutover-fingerprint' });
    expect(
      sequencer.activateCutover({
        season: 12,
        cutoverFingerprint: FINGERPRINT,
      }),
    ).toEqual({ outcome: 'rejected', reason: 'invalid-season' });
    expect(
      sequencer.activateCutover({
        season: OTHER_SEASON,
        cutoverFingerprint: FINGERPRINT,
      }),
    ).toEqual({ outcome: 'rejected', reason: 'season-mismatch' });
  });

  it('activates on the matching fingerprint, and is idempotent afterwards', () => {
    const { sequencer } = makeSequencer();
    sequencer.seedCutover(seedFor());
    expect(
      sequencer.activateCutover({
        season: SEASON,
        cutoverFingerprint: FINGERPRINT,
      }),
    ).toEqual({ outcome: 'activated' });
    expect(
      sequencer.activateCutover({
        season: SEASON,
        cutoverFingerprint: FINGERPRINT,
      }),
    ).toEqual({ outcome: 'already-active' });
    expect(sequencer.readAuthority(SEASON)).toEqual({
      cutoverState: 'active',
      authoritative: true,
      activeVersion: SEED_ACTIVE_VERSION,
      previousVersion: null,
      cutoverFingerprint: FINGERPRINT,
    });
  });

  it('resumes as seeded after a crash between the two transitions', () => {
    // A crash after step 10 commits and before step 11 runs is distinguishable
    // from both `uninitialized` and `active` by the durable value itself, never
    // inferred from whether other state happens to be present.
    const first = makeSequencer();
    first.sequencer.seedCutover(seedFor());
    const restarted = makeSequencer({ host: first.host.restart() });
    expect(restarted.sequencer.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'seeded',
      authoritative: false,
    });
    expect(
      restarted.sequencer.activateCutover({
        season: SEASON,
        cutoverFingerprint: FINGERPRINT,
      }),
    ).toEqual({ outcome: 'activated' });
  });
});

describe('cutover: state-specific authority', () => {
  it('reports and admits differently in each of the three states', () => {
    const { sequencer } = makeSequencer();

    // uninitialized: no seed, not authoritative, mutators refused.
    expect(sequencer.readAuthority(SEASON)).toEqual({
      cutoverState: 'uninitialized',
      authoritative: false,
    });
    expect(sequencer.prepare(prepareRequest())).toEqual({
      outcome: 'rejected',
      reason: 'authority-not-active',
    });

    // seeded: the pair is answerable, but it is not the authoritative switch
    // and this season's mutators stay paused.
    sequencer.seedCutover(seedFor());
    expect(sequencer.readAuthority(SEASON)).toEqual({
      cutoverState: 'seeded',
      authoritative: false,
      activeVersion: SEED_ACTIVE_VERSION,
      previousVersion: null,
      cutoverFingerprint: FINGERPRINT,
    });
    expect(sequencer.prepare(prepareRequest())).toEqual({
      outcome: 'rejected',
      reason: 'authority-not-active',
    });

    // active: authoritative, and mutators resume.
    sequencer.activateCutover({
      season: SEASON,
      cutoverFingerprint: FINGERPRINT,
    });
    expect(sequencer.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'active',
      authoritative: true,
    });
    expect(sequencer.prepare(prepareRequest()).outcome).toBe('prepared');
  });

  it('never conflates seeded with a post-activation legacy fallback', () => {
    // `seeded` is a pre-activation state in which legacy pointers remain the
    // declared authority by design. It reports `authoritative: false`, which is
    // the only signal any authority-sensitive caller reads.
    const { sequencer } = makeSequencer();
    sequencer.seedCutover(seedFor());
    const seeded = sequencer.readAuthority(SEASON);
    expect(seeded.authoritative).toBe(false);
    expect(seeded.cutoverState).toBe('seeded');
  });
});
