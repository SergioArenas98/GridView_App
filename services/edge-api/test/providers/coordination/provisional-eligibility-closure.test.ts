/**
 * The provisional gate is the one boundary that can unlock a policy-locked
 * source, and it was the last one still admitting a value on a property count.
 *
 * `sourceSelectable` is `sourceUnlockedByPolicy(source) || eligibility.eligible`,
 * so for OpenF1 - the only source declared `unlockedByPolicy: false` - the
 * decoded bound is the *sole* gate. Admitting it on `Object.keys(value).length`
 * meant the check could see neither the names of the properties it counted nor
 * where they lived: two arbitrary own keys over a prototype carrying `kind` and
 * `boundSeconds` counted as two, and a symbol-keyed or non-enumerable extra was
 * invisible to a count that only walks own enumerable string keys.
 *
 * These are the same closure rules `resource.ts`, `port.ts` and `coordinator.ts`
 * already apply, plus one this boundary needs and they do not: an accessor for
 * either declared field is refused rather than executed, so a getter on the
 * value that decides whether a locked source may be driven never runs at all.
 *
 * Nothing here records, approves or implies a maximum-session-duration bound.
 * `recordedProvisionalSessionEndBound` is still `null` and OpenF1 is still
 * locked in production; the fixture below exists only to exercise the accepting
 * half of the gate offline (ADR 0020 D5.5).
 */

import { describe, expect, it } from 'vitest';

import {
  decideProvisionalEligibility,
  recordedProvisionalSessionEndBound,
  sourceSelectable,
  sourceUnlockedByPolicy,
} from '../../../src/providers/coordination';
import { testOnlyProvisionalBound } from './support';

const LOCKED = { eligible: false, reason: 'bound-unavailable' } as const;
const ELIGIBLE = { eligible: true, boundSeconds: 7200 } as const;

/** The two declared fields, with values the numeric domain accepts. */
function validFields(): { kind: string; boundSeconds: number } {
  return { kind: 'session-end-bound-recorded', boundSeconds: 7200 };
}

describe('the provisional bound is an exact own-shape boundary', () => {
  it('accepts exactly the two declared own data properties', () => {
    expect(decideProvisionalEligibility(validFields())).toEqual(ELIGIBLE);
    expect(decideProvisionalEligibility(testOnlyProvisionalBound)).toEqual(
      ELIGIBLE,
    );
  });

  it('accepts a null-prototype record carrying exactly the two fields', () => {
    // A legitimate way to build a record without inheriting anything at all.
    const record = Object.assign(Object.create(null), validFields());
    expect(Object.getPrototypeOf(record)).toBeNull();
    expect(decideProvisionalEligibility(record)).toEqual(ELIGIBLE);
  });

  it('accepts a frozen record carrying exactly the two fields', () => {
    const record = Object.freeze(validFields());
    expect(decideProvisionalEligibility(record)).toEqual(ELIGIBLE);
  });

  it('refuses required fields reachable only through a prototype', () => {
    // The count-based check saw two own keys and read `kind` and
    // `boundSeconds` straight off the prototype chain.
    const record = Object.create(validFields(), {
      alpha: { value: 1, enumerable: true },
      beta: { value: 2, enumerable: true },
    });
    expect(Object.hasOwn(record, 'kind')).toBe(false);
    expect(Object.hasOwn(record, 'boundSeconds')).toBe(false);
    expect(decideProvisionalEligibility(record)).toEqual(LOCKED);
  });

  it('refuses a mixed record whose bound is inherited', () => {
    const bare = Object.create(
      { boundSeconds: 7200 },
      { kind: { value: 'session-end-bound-recorded', enumerable: true } },
    ) as object;
    expect(decideProvisionalEligibility(bare)).toEqual(LOCKED);

    // Padded back up to two own keys, which is what defeated the count.
    const padded = Object.create(
      { boundSeconds: 7200 },
      {
        kind: { value: 'session-end-bound-recorded', enumerable: true },
        alpha: { value: 1, enumerable: true },
      },
    ) as object;
    expect(decideProvisionalEligibility(padded)).toEqual(LOCKED);
  });

  it('refuses a mixed record whose kind is inherited', () => {
    const bare = Object.create(
      { kind: 'session-end-bound-recorded' },
      { boundSeconds: { value: 7200, enumerable: true } },
    ) as object;
    expect(decideProvisionalEligibility(bare)).toEqual(LOCKED);

    const padded = Object.create(
      { kind: 'session-end-bound-recorded' },
      {
        boundSeconds: { value: 7200, enumerable: true },
        alpha: { value: 1, enumerable: true },
      },
    ) as object;
    expect(decideProvisionalEligibility(padded)).toEqual(LOCKED);
  });

  it('refuses an ordinary enumerable extra property', () => {
    expect(
      decideProvisionalEligibility({ ...validFields(), extra: true }),
    ).toEqual(LOCKED);
  });

  it('refuses a symbol-keyed extra property', () => {
    const record = { ...validFields(), [Symbol('smuggled')]: 'payload' };
    expect(Object.keys(record)).toHaveLength(2);
    expect(Reflect.ownKeys(record)).toHaveLength(3);
    expect(decideProvisionalEligibility(record)).toEqual(LOCKED);
  });

  it('refuses a non-enumerable extra property', () => {
    const record = validFields();
    Object.defineProperty(record, 'smuggled', {
      value: 'payload',
      enumerable: false,
    });
    expect(Object.keys(record)).toHaveLength(2);
    expect(Reflect.ownKeys(record)).toHaveLength(3);
    expect(decideProvisionalEligibility(record)).toEqual(LOCKED);
  });

  it('reads an explicitly present undefined field as unusable', () => {
    expect(
      decideProvisionalEligibility({ kind: undefined, boundSeconds: 7200 }),
    ).toEqual(LOCKED);
    expect(
      decideProvisionalEligibility({
        kind: 'session-end-bound-recorded',
        boundSeconds: undefined,
      }),
    ).toEqual(LOCKED);
  });
});

describe('the provisional bound contains every hostile inspection', () => {
  it('refuses a throwing accessor for kind without executing it', () => {
    let reads = 0;
    const record = {
      get kind() {
        reads += 1;
        throw new Error('hostile');
      },
      boundSeconds: 7200,
    };
    expect(decideProvisionalEligibility(record)).toEqual(LOCKED);
    expect(reads).toBe(0);
  });

  it('refuses a throwing accessor for the bound without executing it', () => {
    let reads = 0;
    const record = {
      kind: 'session-end-bound-recorded',
      get boundSeconds() {
        reads += 1;
        throw new Error('hostile');
      },
    };
    expect(decideProvisionalEligibility(record)).toEqual(LOCKED);
    expect(reads).toBe(0);
  });

  it('refuses a well-behaved accessor too, because shape is structural', () => {
    let reads = 0;
    const record = {
      kind: 'session-end-bound-recorded',
      get boundSeconds() {
        reads += 1;
        return 7200;
      },
    };
    expect(decideProvisionalEligibility(record)).toEqual(LOCKED);
    expect(reads).toBe(0);
  });

  it('contains a throwing ownKeys trap', () => {
    const hostile = new Proxy(validFields(), {
      ownKeys() {
        throw new Error('hostile');
      },
    });
    expect(() => decideProvisionalEligibility(hostile)).not.toThrow();
    expect(decideProvisionalEligibility(hostile)).toEqual(LOCKED);
  });

  it('contains a throwing getOwnPropertyDescriptor trap', () => {
    const hostile = new Proxy(validFields(), {
      getOwnPropertyDescriptor() {
        throw new Error('hostile');
      },
    });
    expect(() => decideProvisionalEligibility(hostile)).not.toThrow();
    expect(decideProvisionalEligibility(hostile)).toEqual(LOCKED);
  });

  it('never reaches the traps a shape decision has no business consulting', () => {
    // `get`, `has`, `getPrototypeOf` and `defineProperty` are all
    // caller-reachable machinery. Membership is decided from own descriptors
    // alone, so none of them fires - which is also why a throwing one cannot
    // escape.
    const touched: string[] = [];
    const hostile = new Proxy(validFields(), {
      get(target, property, receiver) {
        touched.push('get');
        return Reflect.get(target, property, receiver);
      },
      has(target, property) {
        touched.push('has');
        return Reflect.has(target, property);
      },
      getPrototypeOf(target) {
        touched.push('getPrototypeOf');
        return Reflect.getPrototypeOf(target);
      },
      defineProperty(target, property, descriptor) {
        touched.push('defineProperty');
        return Reflect.defineProperty(target, property, descriptor);
      },
    });
    expect(() => decideProvisionalEligibility(hostile)).not.toThrow();
    expect(touched).toEqual([]);
  });

  it('answers identically however many times it is asked', () => {
    const hostile = new Proxy(validFields(), {
      ownKeys() {
        throw new Error('hostile');
      },
    });
    const honest = validFields();
    for (let round = 0; round < 3; round += 1) {
      expect(decideProvisionalEligibility(hostile)).toEqual(LOCKED);
      expect(decideProvisionalEligibility(honest)).toEqual(ELIGIBLE);
    }
  });
});

describe('the provisional bound keeps its numeric and type domain', () => {
  it('locks every invalid numeric form', () => {
    for (const boundSeconds of [
      0,
      -1,
      -7200,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      10 ** 9,
      24 * 60 * 60 + 1,
      Number.MAX_SAFE_INTEGER,
      '7200',
      Object(7200),
      null,
      true,
    ]) {
      expect(
        decideProvisionalEligibility({
          kind: 'session-end-bound-recorded',
          boundSeconds,
        }),
      ).toEqual(LOCKED);
    }
  });

  it('accepts the smallest positive bound and the inclusive maximum', () => {
    for (const boundSeconds of [1, 24 * 60 * 60]) {
      expect(
        decideProvisionalEligibility({
          kind: 'session-end-bound-recorded',
          boundSeconds,
        }),
      ).toEqual({ eligible: true, boundSeconds });
    }
  });

  it('locks absence, a wrong kind and every non-record value', () => {
    for (const value of [
      undefined,
      null,
      7200,
      'session-end-bound-recorded',
      true,
      Symbol('bound'),
      () => validFields(),
      validFields,
      [],
      [{ kind: 'session-end-bound-recorded', boundSeconds: 7200 }],
      {},
      { kind: 'session-end-bound-recorded' },
      { boundSeconds: 7200 },
      { kind: 'something-else', boundSeconds: 7200 },
      { kind: 'SESSION-END-BOUND-RECORDED', boundSeconds: 7200 },
      { kind: ' session-end-bound-recorded ', boundSeconds: 7200 },
    ]) {
      expect(decideProvisionalEligibility(value)).toEqual(LOCKED);
    }
  });
});

describe('a malformed bound never unlocks a policy-locked source', () => {
  it('keeps OpenF1 locked for every hostile or malformed record', () => {
    const nonEnumerableExtra = validFields();
    Object.defineProperty(nonEnumerableExtra, 'smuggled', {
      value: 'payload',
      enumerable: false,
    });
    for (const value of [
      Object.create(validFields(), {
        alpha: { value: 1, enumerable: true },
        beta: { value: 2, enumerable: true },
      }),
      { ...validFields(), [Symbol('smuggled')]: 'payload' },
      nonEnumerableExtra,
      new Proxy(validFields(), {
        ownKeys() {
          throw new Error('hostile');
        },
      }),
      {
        kind: 'session-end-bound-recorded',
        get boundSeconds() {
          return 7200;
        },
      },
      undefined,
      null,
    ]) {
      const eligibility = decideProvisionalEligibility(value);
      expect(eligibility).toEqual(LOCKED);
      expect(sourceSelectable('openf1', eligibility)).toBe(false);
    }
  });

  it('leaves the policy table and its precedence untouched', () => {
    // A recorded bound is the only thing eligibility may move, and it may move
    // it for the provisional source alone. Jolpica is selectable on its own
    // policy and never depends on a bound at all.
    expect(sourceUnlockedByPolicy('jolpica')).toBe(true);
    expect(sourceUnlockedByPolicy('openf1')).toBe(false);
    expect(sourceSelectable('jolpica', LOCKED)).toBe(true);
    expect(sourceSelectable('jolpica', ELIGIBLE)).toBe(true);
    expect(sourceSelectable('openf1', LOCKED)).toBe(false);
    expect(
      sourceSelectable('openf1', decideProvisionalEligibility(validFields())),
    ).toBe(true);
  });

  it('records no production bound, so production stays locked', () => {
    expect(recordedProvisionalSessionEndBound).toBeNull();
    expect(
      sourceSelectable(
        'openf1',
        decideProvisionalEligibility(recordedProvisionalSessionEndBound),
      ),
    ).toBe(false);
  });
});
