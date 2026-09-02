/**
 * The value rules, the closed-shape rule and hostile-value containment.
 *
 * Every case here is driven through a real entity validator rather than an
 * exported predicate, because the predicates are an implementation detail and
 * the contract is what the entity declares. `Driver` is used as the carrier: it
 * has a required identifier, a required string, nullable strings, a nullable
 * integer, a patterned country code, a date and a nested media collection, so
 * one entity exercises every primitive family.
 */

import { describe, expect, it } from 'vitest';

import {
  contractIssueCodes,
  maxCollectionLength,
  maxContractIssues,
  validateDriver,
  validateMediaAsset,
  type ContractIssue,
} from '../../src/contract/normalized';

function driver(overrides: Record<string, unknown> = {}): unknown {
  return {
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
    ...overrides,
  };
}

function codesAt(issues: readonly ContractIssue[], path: string): string[] {
  return issues
    .filter((issue) => issue.path === path)
    .map((issue) => issue.code);
}

describe('a valid entity produces no issues', () => {
  it('accepts the fully populated form', () => {
    expect(validateDriver(driver(), 'data')).toEqual([]);
  });

  it('accepts null in every nullable position', () => {
    expect(
      validateDriver(
        driver({
          givenName: null,
          familyName: null,
          shortCode: null,
          permanentNumber: null,
          nationality: null,
          countryCode: null,
          dateOfBirth: null,
          placeOfBirth: null,
          biography: null,
          media: null,
        }),
        'data',
      ),
    ).toEqual([]);
  });

  it('accepts an empty media collection, which is not the same as null', () => {
    expect(validateDriver(driver({ media: [] }), 'data')).toEqual([]);
  });

  it('accepts an empty string where the contract states no length bound', () => {
    expect(validateDriver(driver({ fullName: '' }), 'data')).toEqual([]);
  });
});

describe('the container itself', () => {
  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'driver'],
    ['a number', 7],
    ['undefined', undefined],
  ])('rejects %s as an entity', (_label, value) => {
    expect(codesAt(validateDriver(value, 'data'), 'data')).toEqual(['type']);
  });
});

describe('required properties must be present, not merely non-null', () => {
  it.each([
    'id',
    'fullName',
    'givenName',
    'familyName',
    'shortCode',
    'permanentNumber',
    'nationality',
    'countryCode',
    'dateOfBirth',
    'placeOfBirth',
    'biography',
    'media',
  ])('reports %s as missing when the key is absent', (key) => {
    const value = driver();
    delete (value as Record<string, unknown>)[key];

    expect(codesAt(validateDriver(value, 'data'), `data.${key}`)).toEqual([
      'missing',
    ]);
  });

  it('refuses an explicitly undefined value, which is not a contract value', () => {
    // `undefined` is a present own data property, so it is reported as a wrong
    // *value* rather than an absent property. Either way it is refused: it is
    // not representable in JSON and could never be a contract value.
    expect(
      codesAt(
        validateDriver(driver({ shortCode: undefined }), 'data'),
        'data.shortCode',
      ),
    ).toEqual(['type']);
  });
});

describe('unknown own properties are refused', () => {
  it('rejects an additive string-keyed property', () => {
    expect(
      codesAt(
        validateDriver(driver({ providerRef: 'upstream-42' }), 'data'),
        'data',
      ),
    ).toEqual(['unknown-property']);
  });

  it('names the offending key structurally and never its value', () => {
    const issues = validateDriver(
      driver({ providerRef: 'upstream-42' }),
      'data',
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).not.toContain('upstream-42');
    expect(JSON.stringify(issues)).not.toContain('upstream-42');
  });

  it('rejects a symbol-keyed property', () => {
    const value = driver() as Record<string, unknown>;
    Object.defineProperty(value, Symbol('leak'), {
      value: 'upstream',
      enumerable: true,
      configurable: true,
    });

    expect(codesAt(validateDriver(value, 'data'), 'data')).toEqual([
      'unknown-property',
    ]);
  });

  it('rejects a non-enumerable property', () => {
    const value = driver() as Record<string, unknown>;
    Object.defineProperty(value, 'hidden', {
      value: 'upstream',
      enumerable: false,
      configurable: true,
    });

    expect(codesAt(validateDriver(value, 'data'), 'data')).toEqual([
      'unknown-property',
    ]);
  });

  it('reports one issue per unknown key, deterministically ordered', () => {
    const issues = validateDriver(
      driver({ zebra: 1, alpha: 2 }),
      'data',
    ).filter((issue) => issue.code === 'unknown-property');

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.message)).toEqual([
      issues[0]?.message,
      issues[1]?.message,
    ]);
  });
});

describe('no value is coerced', () => {
  it.each([
    ['a numeric string for an integer', 'permanentNumber', '1', 'type'],
    ['a boolean for an integer', 'permanentNumber', true, 'type'],
    ['a number for a string', 'fullName', 33, 'type'],
    ['a boolean for a string', 'fullName', false, 'type'],
    ['an array for a string', 'fullName', ['Max'], 'type'],
    ['an object for a string', 'fullName', { first: 'Max' }, 'type'],
    ['an object for a collection', 'media', {}, 'type'],
    ['a string for a collection', 'media', 'none', 'type'],
  ])('rejects %s', (_label, key, value, code) => {
    expect(
      codesAt(validateDriver(driver({ [key]: value }), 'data'), `data.${key}`),
    ).toEqual([code]);
  });

  it('rejects null in a non-nullable position', () => {
    expect(
      codesAt(validateDriver(driver({ id: null }), 'data'), 'data.id'),
    ).toEqual(['null']);
  });
});

describe('numeric rules', () => {
  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['a fractional value', 1.5],
    ['an unsafe integer', Number.MAX_SAFE_INTEGER + 2],
  ])('rejects %s for an integer field', (_label, value) => {
    expect(
      codesAt(
        validateDriver(driver({ permanentNumber: value }), 'data'),
        'data.permanentNumber',
      ),
    ).toEqual(['integer']);
  });

  it('accepts a negative integer where the contract states no sign bound', () => {
    expect(validateDriver(driver({ permanentNumber: -1 }), 'data')).toEqual([]);
  });

  it('accepts zero', () => {
    expect(validateDriver(driver({ permanentNumber: 0 }), 'data')).toEqual([]);
  });
});

describe('identifier grammar', () => {
  it.each([
    ['an uppercase segment', 'Max-Verstappen'],
    ['a leading hyphen', '-max'],
    ['a trailing hyphen', 'max-'],
    ['a double hyphen', 'max--verstappen'],
    ['a colon prefix', 'driver:max'],
    ['an underscore', 'max_verstappen'],
    ['whitespace padding', ' max-verstappen '],
    ['an empty string', ''],
    ['a non-ASCII letter', 'maxé'],
  ])('rejects %s as a slug', (_label, value) => {
    expect(
      codesAt(validateDriver(driver({ id: value }), 'data'), 'data.id'),
    ).toEqual(['identifier']);
  });

  it('rejects a slug longer than the contract bound', () => {
    expect(
      codesAt(
        validateDriver(driver({ id: 'a'.repeat(65) }), 'data'),
        'data.id',
      ),
    ).toEqual(['identifier']);
  });

  it('accepts a slug at the exact bound', () => {
    expect(validateDriver(driver({ id: 'a'.repeat(64) }), 'data')).toEqual([]);
  });

  it('accepts digit-only and mixed segments', () => {
    expect(validateDriver(driver({ id: '2026-driver-7' }), 'data')).toEqual([]);
  });
});

describe('patterned strings', () => {
  it.each([
    ['lowercase', 'nl'],
    ['three letters', 'NLD'],
    ['one letter', 'N'],
    ['a digit', 'N1'],
  ])('rejects %s as a country code', (_label, value) => {
    expect(
      codesAt(
        validateDriver(driver({ countryCode: value }), 'data'),
        'data.countryCode',
      ),
    ).toEqual(['pattern']);
  });
});

describe('date rules', () => {
  it.each([
    ['a date-time where a date is required', '1997-09-30T00:00:00.000Z'],
    ['a slash-separated date', '1997/09/30'],
    ['a two-digit year', '97-09-30'],
    ['month 13', '1997-13-01'],
    ['day 32', '1997-01-32'],
    ['29 February in a common year', '1997-02-29'],
    ['a padded date', ' 1997-09-30'],
    ['an empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(
      codesAt(
        validateDriver(driver({ dateOfBirth: value }), 'data'),
        'data.dateOfBirth',
      ),
    ).toEqual(['date']);
  });

  it('accepts 29 February in a leap year', () => {
    expect(
      validateDriver(driver({ dateOfBirth: '1996-02-29' }), 'data'),
    ).toEqual([]);
  });
});

describe('nested collections and objects', () => {
  const asset = {
    id: 'max-verstappen-portrait-v1',
    entityType: 'driver',
    entityId: 'max-verstappen',
    category: 'portrait',
    format: 'webp',
    variants: {
      thumbnail: { url: 'https://media.example/x.webp', width: 1, height: 1 },
    },
    aspectRatio: 1,
    version: 'v1',
    attribution: null,
    license: null,
    fallbackCategory: null,
  };

  it('accepts a valid media asset', () => {
    expect(validateMediaAsset(asset, 'data')).toEqual([]);
  });

  it('accepts a media variant map with every optional key absent', () => {
    expect(validateMediaAsset({ ...asset, variants: {} }, 'data')).toEqual([]);
  });

  it('reports a nested failure at its own structural path', () => {
    const issues = validateDriver(
      driver({ media: [{ ...asset, id: 'NOT A SLUG' }] }),
      'data',
    );

    expect(codesAt(issues, 'data.media[0].id')).toEqual(['identifier']);
  });

  it('reports a deeply nested failure at its own structural path', () => {
    const issues = validateDriver(
      driver({
        media: [
          {
            ...asset,
            variants: { hero: { url: 'not-a-url', width: null, height: null } },
          },
        ],
      }),
      'data',
    );

    expect(codesAt(issues, 'data.media[0].variants.hero.url')).toEqual(['uri']);
  });

  it('rejects an unknown key inside a nested object', () => {
    const issues = validateDriver(
      driver({ media: [{ ...asset, upstreamKey: 1 }] }),
      'data',
    );

    expect(codesAt(issues, 'data.media[0]')).toEqual(['unknown-property']);
  });

  it('rejects an array hole as a missing element', () => {
    const sparse: unknown[] = [];
    sparse.length = 2;
    sparse[1] = asset;

    expect(
      codesAt(
        validateDriver(driver({ media: sparse }), 'data'),
        'data.media[0]',
      ),
    ).toEqual(['missing']);
  });

  it('rejects an enum value outside the vocabulary', () => {
    expect(
      codesAt(
        validateMediaAsset({ ...asset, category: 'mugshot' }, 'data'),
        'data.category',
      ),
    ).toEqual(['enum']);
  });

  it('accepts the additive-safe unknown enum member', () => {
    expect(
      validateMediaAsset({ ...asset, category: 'unknown' }, 'data'),
    ).toEqual([]);
  });
});

describe('bounded traversal and bounded output', () => {
  it('rejects a collection longer than the documented bound', () => {
    const media = Array.from({ length: maxCollectionLength + 1 }, () => ({}));

    expect(
      codesAt(validateDriver(driver({ media }), 'data'), 'data.media'),
    ).toEqual(['too-many-items']);
  });

  it('does not traverse a collection it refused for length', () => {
    const media = Array.from({ length: maxCollectionLength + 1 }, () => ({}));

    expect(validateDriver(driver({ media }), 'data')).toHaveLength(1);
  });

  it('caps the number of issues it produces', () => {
    const media = Array.from(
      { length: maxCollectionLength },
      () => 'not-an-object',
    );
    const issues = validateDriver(driver({ media }), 'data');

    expect(issues.length).toBeLessThanOrEqual(maxContractIssues + 1);
    expect(issues.at(-1)?.code).toBe('issue-limit');
  });

  it('emits no limit marker when the issue count fits', () => {
    const issues = validateDriver(driver({ id: null }), 'data');

    expect(issues.some((issue) => issue.code === 'issue-limit')).toBe(false);
  });
});

describe('hostile values are contained, never executed', () => {
  it('refuses an accessor-backed property instead of invoking it', () => {
    let reads = 0;
    const value = driver() as Record<string, unknown>;
    delete value.fullName;
    Object.defineProperty(value, 'fullName', {
      get() {
        reads += 1;
        return 'Max Verstappen';
      },
      enumerable: true,
      configurable: true,
    });

    expect(codesAt(validateDriver(value, 'data'), 'data.fullName')).toEqual([
      'missing',
    ]);
    expect(reads).toBe(0);
  });

  it('refuses an inherited declared property', () => {
    const value = Object.create({ fullName: 'Max Verstappen' }) as Record<
      string,
      unknown
    >;
    for (const [key, entry] of Object.entries(
      driver() as Record<string, unknown>,
    )) {
      if (key !== 'fullName') value[key] = entry;
    }

    expect(codesAt(validateDriver(value, 'data'), 'data.fullName')).toEqual([
      'missing',
    ]);
  });

  it('is unaffected by a polluted Object prototype', () => {
    const polluted = Object.getPrototypeOf({}) as Record<string, unknown>;
    polluted.injected = 'upstream';
    try {
      expect(validateDriver(driver(), 'data')).toEqual([]);
    } finally {
      delete polluted.injected;
    }
  });

  it('accepts a null-prototype object that is otherwise valid', () => {
    const value = Object.assign(
      Object.create(null) as Record<string, unknown>,
      driver(),
    );

    expect(validateDriver(value, 'data')).toEqual([]);
  });

  it('contains a proxy that throws from ownKeys', () => {
    const hostile = new Proxy(driver() as object, {
      ownKeys() {
        throw new Error('hostile ownKeys');
      },
    });

    expect(codesAt(validateDriver(hostile, 'data'), 'data')).toEqual([
      'unreadable',
    ]);
  });

  it('contains a proxy that throws from getOwnPropertyDescriptor', () => {
    const hostile = new Proxy(driver() as object, {
      getOwnPropertyDescriptor() {
        throw new Error('hostile descriptor');
      },
    });

    expect(
      validateDriver(hostile, 'data').some(
        (issue) => issue.code === 'unreadable',
      ),
    ).toBe(true);
  });

  it('never throws for any hostile shape', () => {
    const hostile: unknown[] = [
      new Proxy(
        {},
        {
          ownKeys: () => {
            throw new Error('x');
          },
        },
      ),
      new Proxy(
        {},
        {
          getOwnPropertyDescriptor: () => {
            throw new Error('x');
          },
        },
      ),
      Object.create(null),
      {
        media: new Proxy([], {
          get: () => {
            throw new Error('x');
          },
        }),
      },
    ];

    for (const value of hostile) {
      expect(() => validateDriver(value, 'data')).not.toThrow();
    }
  });

  it('mutates nothing it validates', () => {
    const value = driver({ id: 'NOT A SLUG' }) as Record<string, unknown>;
    const before = JSON.stringify(value);
    validateDriver(value, 'data');

    expect(JSON.stringify(value)).toBe(before);
  });
});

describe('the issue vocabulary is closed', () => {
  it('emits only declared codes', () => {
    const issues = [
      ...validateDriver(driver({ id: null }), 'data'),
      ...validateDriver(driver({ providerRef: 1 }), 'data'),
      ...validateDriver(driver({ dateOfBirth: 'x' }), 'data'),
      ...validateDriver(7, 'data'),
    ];

    for (const issue of issues) {
      expect(contractIssueCodes).toContain(issue.code);
    }
  });

  it('produces structural paths only', () => {
    const issues = validateDriver(
      driver({ media: [{ id: 'NOT A SLUG' }] }),
      'data',
    );

    for (const issue of issues) {
      expect(issue.path).toMatch(/^data(\.[a-zA-Z]+|\[\d+\])*$/);
    }
  });
});
