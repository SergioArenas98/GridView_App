/**
 * What counts as a normalized **record**.
 *
 * The validator's object boundary asked only "is this a non-null, non-array
 * object?". That is not the same question as "is this an ordinary record the
 * public contract could describe": a `Date`, a `Map`, a typed array and a boxed
 * primitive all pass it. The consequence is worst where every declared property
 * is optional - `MediaVariants` is the only such object in the contract - since
 * an exotic with no own keys then produces no issue at all, is selected, and is
 * published as whatever KV serialization makes of it.
 *
 * The correction is **general**, not a `MediaVariants` special case: one
 * classifier serves every object the validator inspects, so an exotic is
 * refused at an entity, at a nested object and at a collection element alike.
 * These tests therefore drive it through several carriers, not only the
 * reported one.
 */

import { describe, expect, it } from 'vitest';

import {
  validateCircuit,
  validateDriver,
  validateMediaAsset,
  validateRaceResult,
  type ContractIssue,
} from '../../src/contract/normalized';

const variant = { url: 'https://media.example/x.webp', width: 1, height: 1 };

const asset: Record<string, unknown> = {
  id: 'max-verstappen-portrait-v1',
  entityType: 'driver',
  entityId: 'max-verstappen',
  category: 'portrait',
  format: 'webp',
  variants: { thumbnail: variant },
  aspectRatio: 1,
  version: 'v1',
  attribution: null,
  license: null,
  fallbackCategory: null,
};

const driver: Record<string, unknown> = {
  id: 'max-verstappen',
  fullName: 'Max Verstappen',
  givenName: 'Max',
  familyName: 'Verstappen',
  shortCode: 'VER',
  permanentNumber: 1,
  nationality: 'Dutch',
  countryCode: 'NL',
  dateOfBirth: '1997-09-30',
  placeOfBirth: 'Hasselt',
  biography: null,
  media: null,
};

const circuit: Record<string, unknown> = {
  id: 'spa-francorchamps',
  name: 'Circuit de Spa-Francorchamps',
  locality: 'Stavelot',
  country: 'Belgium',
  countryCode: 'BE',
  latitude: 50.4372,
  longitude: 5.9714,
  lengthMeters: 7004,
  cornerCount: 19,
  direction: 'clockwise',
  firstGrandPrixYear: 1950,
  lapRecord: { driverId: 'max-verstappen', timeMillis: 104000, year: 2018 },
  media: null,
};

const resultEntry: Record<string, unknown> = {
  driverId: 'max-verstappen',
  constructorId: 'red-bull',
  position: 1,
  gridPosition: 2,
  points: 25,
  status: 'finished',
  laps: 44,
  elapsedTimeMillis: 5400000,
  gapToLeaderMillis: null,
  lapsBehind: null,
  fastestLap: false,
  dnfReason: null,
  gapText: null,
};

const raceResult: Record<string, unknown> = {
  id: '2026-belgian-grand-prix-race-results',
  season: 2026,
  round: 13,
  grandPrixId: '2026-belgian-grand-prix',
  sessionType: 'race',
  status: 'final',
  entries: [resultEntry],
  fastestLap: { driverId: 'lando-norris', timeMillis: 104321, lap: 44 },
};

function codesAt(issues: readonly ContractIssue[], path: string): string[] {
  return issues
    .filter((issue) => issue.path === path)
    .map((issue) => issue.code);
}

/**
 * Structured-cloneable exotics matter most: a value that survives
 * `structuredClone` reaches assembly and publication intact, so the validator
 * is the only thing standing between it and a public document. The rest are
 * included because the classifier must not depend on cloneability to be right.
 */
function exotics(): [string, unknown][] {
  return [
    ['a Date', new Date('2026-01-01T00:00:00.000Z')],
    ['a Map', new Map<string, string>([['a', 'b']])],
    ['a Set', new Set<string>(['a'])],
    ['a RegExp', /x/u],
    ['an ArrayBuffer', new ArrayBuffer(8)],
    ['a Uint8Array', new Uint8Array([1, 2, 3])],
    ['a Float64Array', new Float64Array([1])],
    ['a DataView', new DataView(new ArrayBuffer(8))],
    ['a boxed Number', new Number(1)],
    ['a boxed String', new String('x')],
    ['a boxed Boolean', new Boolean(true)],
    ['an Error', new Error('e')],
    ['a custom-prototype object', Object.create({ marker: 1 }) as object],
    ['a class instance', new (class Holder {})()],
  ];
}

describe('an exotic object is not a record - the reported vector', () => {
  it.each(exotics())('rejects %s as MediaAsset.variants', (_label, value) => {
    expect(
      codesAt(
        validateMediaAsset({ ...asset, variants: value }, 'v'),
        'v.variants',
      ),
    ).toEqual(['type']);
  });

  it('reports exactly one issue, because the value is refused as a whole', () => {
    expect(
      validateMediaAsset({ ...asset, variants: new Date() }, 'v'),
    ).toHaveLength(1);
  });

  it('leaks neither the value nor its constructor into the issue', () => {
    const issues = validateMediaAsset(
      { ...asset, variants: new Date('2026-01-01') },
      'v',
    );
    const serialized = JSON.stringify(issues);

    expect(serialized).not.toContain('Date');
    expect(serialized).not.toContain('2026-01-01');
    expect(serialized).not.toContain('constructor');
    expect(serialized).not.toContain('prototype');
  });
});

describe('the classifier is general, not a MediaVariants special case', () => {
  it.each(exotics())('rejects %s in place of an entity', (_label, value) => {
    expect(validateDriver(value, 'v')).toEqual([
      {
        path: 'v',
        code: 'type',
        message: expect.any(String) as unknown as string,
      },
    ]);
  });

  it.each(exotics())(
    'rejects %s as a nullable nested object',
    (_label, value) => {
      expect(
        codesAt(
          validateCircuit({ ...circuit, lapRecord: value }, 'v'),
          'v.lapRecord',
        ),
      ).toEqual(['type']);
    },
  );

  it.each(exotics())('rejects %s as a nested value object', (_label, value) => {
    expect(
      codesAt(
        validateRaceResult({ ...raceResult, fastestLap: value }, 'v'),
        'v.fastestLap',
      ),
    ).toEqual(['type']);
  });

  it.each(exotics())('rejects %s as a collection element', (_label, value) => {
    expect(
      codesAt(validateDriver({ ...driver, media: [value] }, 'v'), 'v.media[0]'),
    ).toEqual(['type']);
  });

  it.each(exotics())('rejects %s as a media variant', (_label, value) => {
    expect(
      codesAt(
        validateMediaAsset({ ...asset, variants: { hero: value } }, 'v'),
        'v.variants.hero',
      ),
    ).toEqual(['type']);
  });
});

describe('a prototype that cannot be read is contained, not thrown', () => {
  it('reports one bounded unreadable issue for a throwing getPrototypeOf trap', () => {
    const hostile = new Proxy(
      { ...asset },
      {
        getPrototypeOf() {
          throw new Error('hostile getPrototypeOf');
        },
      },
    );

    expect(codesAt(validateMediaAsset(hostile, 'v'), 'v')).toEqual([
      'unreadable',
    ]);
  });

  it('never throws for a hostile prototype trap at any depth', () => {
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('hostile getPrototypeOf');
        },
      },
    );

    expect(() =>
      validateMediaAsset({ ...asset, variants: hostile }, 'v'),
    ).not.toThrow();
    expect(() =>
      validateDriver({ ...driver, media: [hostile] }, 'v'),
    ).not.toThrow();
    expect(() => validateDriver(hostile, 'v')).not.toThrow();
  });

  it('does not invoke a property accessor while classifying', () => {
    let reads = 0;
    const probe = { ...asset };
    Object.defineProperty(probe, 'version', {
      get() {
        reads += 1;
        return 'v1';
      },
      enumerable: true,
      configurable: true,
    });

    validateMediaAsset(probe, 'v');

    expect(reads).toBe(0);
  });
});

describe('ordinary records stay accepted', () => {
  it('accepts an ordinary object literal', () => {
    expect(validateMediaAsset(asset, 'v')).toEqual([]);
  });

  it('accepts an empty variant map, where every key is optional', () => {
    expect(validateMediaAsset({ ...asset, variants: {} }, 'v')).toEqual([]);
  });

  it('accepts a variant map with every optional key absent but one present', () => {
    expect(
      validateMediaAsset({ ...asset, variants: { detail: variant } }, 'v'),
    ).toEqual([]);
  });

  it('accepts every nested ordinary variant value', () => {
    expect(
      validateMediaAsset(
        {
          ...asset,
          variants: {
            thumbnail: variant,
            card: variant,
            detail: variant,
            hero: {
              url: 'https://media.example/h.webp',
              width: null,
              height: null,
            },
          },
        },
        'v',
      ),
    ).toEqual([]);
  });

  it('accepts an explicitly null optional variant', () => {
    expect(
      validateMediaAsset({ ...asset, variants: { hero: null } }, 'v'),
    ).toEqual([]);
  });

  it('accepts a null-prototype object, which the existing contract tests require', () => {
    const nullProto = Object.assign(
      Object.create(null) as Record<string, unknown>,
      asset,
    );

    expect(validateMediaAsset(nullProto, 'v')).toEqual([]);
  });

  it('accepts a null-prototype value nested as a variant map', () => {
    const nullProto = Object.assign(
      Object.create(null) as Record<string, unknown>,
      {
        thumbnail: variant,
      },
    );

    expect(validateMediaAsset({ ...asset, variants: nullProto }, 'v')).toEqual(
      [],
    );
  });

  it('accepts a transparent proxy over an ordinary record', () => {
    const transparent = new Proxy({ ...asset }, {});

    expect(validateMediaAsset(transparent, 'v')).toEqual([]);
  });

  it('accepts the ordinary nested objects on other entities', () => {
    expect(validateCircuit(circuit, 'v')).toEqual([]);
    expect(validateRaceResult(raceResult, 'v')).toEqual([]);
    expect(validateDriver({ ...driver, media: [asset] }, 'v')).toEqual([]);
  });
});

describe('arrays keep their own classification', () => {
  it('still reports an array in place of an object as a type failure', () => {
    expect(
      codesAt(
        validateMediaAsset({ ...asset, variants: [] }, 'v'),
        'v.variants',
      ),
    ).toEqual(['type']);
  });

  it('still accepts an array where the contract declares a collection', () => {
    expect(validateDriver({ ...driver, media: [] }, 'v')).toEqual([]);
  });
});
