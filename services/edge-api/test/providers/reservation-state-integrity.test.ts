import { describe, expect, it } from 'vitest';

import {
  ReservationCoordinator,
  type ReservationHost,
  type ReservationOutcome,
} from '../../src/providers/http/provider-rate-limiter';
import type { RealProviderSourceId } from '../../src/providers/http/reservation-engine';

const base = Date.parse('2026-07-20T12:00:00.000Z');
const ledgerKey = 'reservation-ledger';

class Host implements ReservationHost {
  readonly values = new Map<string, unknown>();
  private queue: Promise<unknown> = Promise.resolve();
  putCount = 0;

  storage = {
    get: async <T>(key: string): Promise<T | undefined> =>
      this.values.get(key) as T | undefined,
    put: async <T>(key: string, value: T): Promise<void> => {
      this.putCount += 1;
      this.values.set(key, structuredClone(value));
    },
  };

  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    const next = this.queue.then(callback);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

async function reserveWith(
  stored: unknown,
  sourceId: RealProviderSourceId,
): Promise<{ outcome: ReservationOutcome; host: Host; before: string }> {
  const host = new Host();
  if (stored !== undefined) host.values.set(ledgerKey, stored);
  // Snapshot presence AND value, so a stored `null` is distinguishable from an
  // absent key when asserting the record was left untouched.
  const before = JSON.stringify({
    present: host.values.has(ledgerKey),
    value: host.values.get(ledgerKey) ?? null,
  });
  const outcome = await new ReservationCoordinator(
    host,
    () => new Date(base),
  ).reserve(sourceId);
  return { outcome, host, before };
}

/**
 * Persisted limiter state must distinguish **absent** from **invalid**.
 *
 * Missing state means a genuinely new source and may start with full capacity.
 * State that exists but cannot be trusted must fail closed: silently dropping
 * an unreadable entry reduces the active count and hands back capacity whose
 * safety cannot be established, and adopting a record written for another
 * source would let one budget be spent as another's.
 *
 * Nothing here repairs, deletes, resets or relabels the stored value.
 */
describe('corrupt or foreign persisted state fails closed', () => {
  const corrupt: [string, unknown, RealProviderSourceId][] = [
    [
      'an OpenF1 ledger stored in the Jolpica object',
      { sourceId: 'openf1', timestamps: [base] },
      'jolpica',
    ],
    [
      'a Jolpica ledger stored in the OpenF1 object',
      { sourceId: 'jolpica', timestamps: [base] },
      'openf1',
    ],
    [
      'a NaN timestamp',
      { sourceId: 'openf1', timestamps: [base, Number.NaN] },
      'openf1',
    ],
    [
      'a positive infinity timestamp',
      { sourceId: 'openf1', timestamps: [base, Number.POSITIVE_INFINITY] },
      'openf1',
    ],
    [
      'a negative infinity timestamp',
      { sourceId: 'openf1', timestamps: [base, Number.NEGATIVE_INFINITY] },
      'openf1',
    ],
    [
      'a negative timestamp',
      { sourceId: 'openf1', timestamps: [base, -1] },
      'openf1',
    ],
    [
      'a non-integer timestamp',
      { sourceId: 'openf1', timestamps: [base, base + 0.5] },
      'openf1',
    ],
    [
      'a non-number timestamp',
      { sourceId: 'openf1', timestamps: [base, '1784548800000'] },
      'openf1',
    ],
    // A stored `null` is a value that is PRESENT and unusable. It says nothing
    // about prior usage, so treating it as absence would hand back capacity
    // that may already have been spent.
    ['an explicitly stored null', null, 'openf1'],
    ['a malformed top-level value', 'not-an-object', 'openf1'],
    ['a numeric top-level value', 42, 'openf1'],
    [
      'a malformed timestamp collection',
      { sourceId: 'openf1', timestamps: 'nope' },
      'openf1',
    ],
    ['a missing source id', { timestamps: [base] }, 'openf1'],
  ];

  it.each(corrupt)(
    'refuses to reserve with %s',
    async (_label, stored, source) => {
      const { outcome, host, before } = await reserveWith(stored, source);

      expect(outcome.outcome).toBe('unavailable');
      expect(outcome.outcome === 'unavailable' && outcome.reason).toBe(
        'state-corrupt',
      );
      // The record is left exactly as found: not overwritten, relabelled,
      // reset or deleted. Repair is deliberately out of band.
      expect(
        JSON.stringify({
          present: host.values.has(ledgerKey),
          value: host.values.get(ledgerKey) ?? null,
        }),
      ).toBe(before);
      expect(host.putCount).toBe(0);
    },
  );

  it('keeps a source blocked until its state is repaired', async () => {
    const host = new Host();
    host.values.set(ledgerKey, { sourceId: 'jolpica', timestamps: [base] });
    const coordinator = new ReservationCoordinator(host, () => new Date(base));

    // Repeated attempts stay closed and never drift into allowing.
    for (let index = 0; index < 3; index += 1) {
      expect((await coordinator.reserve('openf1')).outcome).toBe('unavailable');
    }
    expect(host.putCount).toBe(0);

    // Once the record genuinely belongs to this source, it works again.
    host.values.set(ledgerKey, { sourceId: 'openf1', timestamps: [] });
    expect((await coordinator.reserve('openf1')).outcome).toBe('allowed');
  });

  it('keeps a stored null unavailable and untouched across repeated attempts', async () => {
    const host = new Host();
    host.values.set(ledgerKey, null);
    const coordinator = new ReservationCoordinator(host, () => new Date(base));

    for (let index = 0; index < 3; index += 1) {
      const outcome = await coordinator.reserve('openf1');
      expect(outcome.outcome).toBe('unavailable');
      expect(outcome.outcome === 'unavailable' && outcome.reason).toBe(
        'state-corrupt',
      );
    }

    // Present, still null, never written, never deleted.
    expect(host.values.has(ledgerKey)).toBe(true);
    expect(host.values.get(ledgerKey)).toBeNull();
    expect(host.putCount).toBe(0);
  });

  it('does not let corruption in one source affect the other', async () => {
    const jolpicaHost = new Host();
    jolpicaHost.values.set(ledgerKey, { sourceId: 'openf1', timestamps: [] });
    const openF1Host = new Host();

    expect(
      (
        await new ReservationCoordinator(
          jolpicaHost,
          () => new Date(base),
        ).reserve('jolpica')
      ).outcome,
    ).toBe('unavailable');
    expect(
      (
        await new ReservationCoordinator(
          openF1Host,
          () => new Date(base),
        ).reserve('openf1')
      ).outcome,
    ).toBe('allowed');
  });
});

describe('valid persisted state is still evaluated normally', () => {
  it('starts a genuinely new source with full capacity', async () => {
    const { outcome, host } = await reserveWith(undefined, 'openf1');

    expect(outcome.outcome).toBe('allowed');
    expect(host.putCount).toBe(1);
  });

  it('counts valid duplicate timestamps independently', async () => {
    // Three identical instants fill OpenF1's 3-per-second window.
    const { outcome } = await reserveWith(
      { sourceId: 'openf1', timestamps: [base, base, base] },
      'openf1',
    );

    expect(outcome.outcome).toBe('deferred');
  });

  it('sorts a valid unsorted ledger without losing or inventing entries', async () => {
    const { outcome } = await reserveWith(
      { sourceId: 'openf1', timestamps: [base + 2, base, base + 1] },
      'openf1',
    );

    // All three are preserved, so the window is still full.
    expect(outcome.outcome).toBe('deferred');
  });

  it('keeps a future timestamp active, which is the conservative direction', async () => {
    const { outcome } = await reserveWith(
      {
        sourceId: 'openf1',
        timestamps: [base + 900_000, base + 900_001, base + 900_002],
      },
      'openf1',
    );

    // A clock regression must not expire capacity early.
    expect(outcome.outcome).toBe('deferred');
  });

  it('prunes genuinely expired timestamps', async () => {
    const { outcome, host } = await reserveWith(
      { sourceId: 'openf1', timestamps: [base - 900_000, base - 900_001] },
      'openf1',
    );

    expect(outcome.outcome).toBe('allowed');
    const stored = host.values.get(ledgerKey) as { timestamps: number[] };
    expect(stored.timestamps).toEqual([base]);
  });

  it('accepts an empty timestamp list as valid, not corrupt', async () => {
    const { outcome } = await reserveWith(
      { sourceId: 'openf1', timestamps: [] },
      'openf1',
    );

    expect(outcome.outcome).toBe('allowed');
  });
});
