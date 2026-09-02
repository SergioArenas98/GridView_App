/**
 * A transport attempt and a candidate payload are the last two adapter-shaped
 * values the outcome boundary still accepts loosely.
 *
 * The outcome *variant* is shape-closed, but the attempt record nested inside
 * it is not: it is admitted on the strength of two fields, so an adapter can
 * hang extra enumerable, non-enumerable or symbol-keyed properties on the one
 * value the run's whole accounting is keyed by. And a `candidate` is admitted
 * on `typeof payload === 'object'`, which is true of `null` and of an array,
 * so both reach resource validation as if they could be payloads.
 *
 * Neither is a payload contract check - deep normalization stays with the
 * adapter. Both are the boundary refusing to carry a value it cannot vouch
 * for.
 */

import { describe, expect, it } from 'vitest';

import {
  isWellFormedOutcome,
  payloadMatchesResource,
  transportReferenceMaxLength,
  type CoordinatedResource,
} from '../../../src/providers/coordination';
import { SEASON } from './support';

const resource: CoordinatedResource = {
  kind: 'season-calendar',
  season: SEASON,
};

function candidateWith(attempt: unknown): unknown {
  return {
    outcome: 'candidate',
    attempt,
    payload: { kind: 'season-calendar', events: [] },
  };
}

describe('a transport attempt is a closed runtime shape', () => {
  it('accepts exactly the declared attempt', () => {
    expect(
      isWellFormedOutcome(
        candidateWith({ reference: 'a-1', outcome: 'successful' }),
      ),
    ).toBe(true);
  });

  it('rejects an undeclared enumerable property', () => {
    expect(
      isWellFormedOutcome(
        candidateWith({
          reference: 'a-1',
          outcome: 'successful',
          url: 'https://provider.invalid/secret',
        }),
      ),
    ).toBe(false);
  });

  it('rejects a non-enumerable property', () => {
    const attempt = Object.defineProperty(
      { reference: 'a-1', outcome: 'successful' },
      'url',
      { value: 'https://provider.invalid/secret', enumerable: false },
    );

    expect(isWellFormedOutcome(candidateWith(attempt))).toBe(false);
  });

  it('rejects a symbol-keyed property', () => {
    const attempt: Record<string | symbol, unknown> = {
      reference: 'a-1',
      outcome: 'successful',
    };
    attempt[Symbol('smuggled')] = 'value';

    expect(isWellFormedOutcome(candidateWith(attempt))).toBe(false);
  });

  it('rejects a required field reachable only through the prototype', () => {
    const attempt = Object.create({ outcome: 'successful' }) as Record<
      string,
      unknown
    >;
    attempt.reference = 'a-1';

    expect(isWellFormedOutcome(candidateWith(attempt))).toBe(false);
  });

  it('rejects an array and a null attempt', () => {
    expect(isWellFormedOutcome(candidateWith([]))).toBe(false);
    expect(isWellFormedOutcome(candidateWith(null))).toBe(false);
  });

  it('coerces nothing', () => {
    expect(
      isWellFormedOutcome(
        candidateWith({ reference: 1, outcome: 'successful' }),
      ),
    ).toBe(false);
    expect(
      isWellFormedOutcome(
        candidateWith({
          reference: { toString: () => 'a-1' },
          outcome: 'successful',
        }),
      ),
    ).toBe(false);
  });

  it('contains a throwing reference accessor', () => {
    const attempt = Object.defineProperty(
      { outcome: 'successful' },
      'reference',
      {
        enumerable: true,
        get() {
          throw new Error('reference getter exploded');
        },
      },
    );

    expect(() => isWellFormedOutcome(candidateWith(attempt))).not.toThrow();
    expect(isWellFormedOutcome(candidateWith(attempt))).toBe(false);
  });

  it('rejects a reference far beyond the declared bound', () => {
    const huge = 'x'.repeat(5_000_000);

    expect(
      isWellFormedOutcome(
        candidateWith({ reference: huge, outcome: 'successful' }),
      ),
    ).toBe(false);
  });

  it('bounds by code points, so an all-astral reference at the bound is valid', () => {
    // Each of these is two UTF-16 units, so a length-based short circuit has
    // to allow twice the bound before it may decide anything.
    const astral = '\u{1F3CE}'.repeat(transportReferenceMaxLength);
    expect([...astral]).toHaveLength(transportReferenceMaxLength);
    expect(astral.length).toBe(transportReferenceMaxLength * 2);

    expect(
      isWellFormedOutcome(
        candidateWith({ reference: astral, outcome: 'successful' }),
      ),
    ).toBe(true);
    expect(
      isWellFormedOutcome(
        candidateWith({
          reference: astral + '\u{1F3CE}',
          outcome: 'successful',
        }),
      ),
    ).toBe(false);
  });

  it('still accepts a reference at the declared bound', () => {
    const exact = 'x'.repeat(transportReferenceMaxLength);

    expect(
      isWellFormedOutcome(
        candidateWith({ reference: exact, outcome: 'successful' }),
      ),
    ).toBe(true);
  });

  it('preserves every valid attempt-bearing outcome', () => {
    const attempt = { reference: 'a-1', outcome: 'successful' } as const;
    expect(
      isWellFormedOutcome({
        outcome: 'failed',
        attempt,
        reason: 'invalid-payload',
      }),
    ).toBe(true);
    expect(
      isWellFormedOutcome({
        outcome: 'failed',
        attempt: { reference: 'a-2', outcome: 'rate-limited' },
        reason: 'provider-rate-limited',
      }),
    ).toBe(true);
    expect(isWellFormedOutcome({ outcome: 'mapping-failure', attempt })).toBe(
      true,
    );
  });
});

describe('a candidate payload must be an object before resource validation', () => {
  it('rejects a null payload at the outcome boundary', () => {
    expect(
      isWellFormedOutcome({
        outcome: 'candidate',
        attempt: { reference: 'a-1', outcome: 'successful' },
        payload: null,
      }),
    ).toBe(false);
  });

  it('rejects an array payload at the outcome boundary', () => {
    expect(
      isWellFormedOutcome({
        outcome: 'candidate',
        attempt: { reference: 'a-1', outcome: 'successful' },
        payload: [],
      }),
    ).toBe(false);
  });

  it('rejects an array from resource validation as well', () => {
    const array: unknown[] = [];
    (array as unknown as Record<string, unknown>).kind = 'season-calendar';
    (array as unknown as Record<string, unknown>).events = [];

    expect(payloadMatchesResource(resource, array)).toBe(false);
    expect(payloadMatchesResource(resource, null)).toBe(false);
  });

  it('leaves a valid payload accepted', () => {
    expect(
      payloadMatchesResource(resource, { kind: 'season-calendar', events: [] }),
    ).toBe(true);
  });
});
