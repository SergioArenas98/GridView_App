/**
 * Identity-only and partially described constructor rows at the
 * content-loading seam.
 *
 * The curated constructor registry always carries `id` and `name`, and carries
 * the five descriptive facts only where GridView owns them: the 2026
 * constructors curated for provider mapping are identity-only rows. The
 * normalized `Constructor` contract is stricter: every one of those keys must
 * be *present*, as an explicit `null` wherever no fact is recorded.
 * `withConstructorMedia` in the mock provider is the single seam where the two
 * shapes meet, following the circuit precedent in
 * `circuit-media-defaults.test.ts`.
 *
 * These tests read synthetic rows through the real provider - with the curated
 * registry replaced for this file alone - and judge what leaves the seam with
 * the production validator.
 */

import { describe, expect, it, vi } from 'vitest';

import { validateConstructor } from '../../src/contract/normalized';
import type { Constructor } from '../../src/contract/types';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import { FixedClock } from '../../src/runtime/clock';

/**
 * Every row is hoisted so the mock factory below and the assertions can name
 * the very same objects: the non-mutation test depends on that identity.
 */
const rows = vi.hoisted(() => ({
  /** Exactly the shape of a 2026 curated identity: `id` and `name` only. */
  identityOnly: {
    id: 'identity-only-team',
    name: 'Identity Only Team',
  },
  /**
   * Two of the five descriptive facts supplied - one populated string and one
   * explicit `null` - and the other three omitted outright.
   */
  partiallyDescribed: {
    id: 'partly-described-team',
    name: 'Partly Described Team',
    shortName: 'Partly',
    biography: null,
  },
  /** All five supplied, so the row can never need a default. */
  fullyDescribed: {
    id: 'fully-described-team',
    name: 'Fully Described Team',
    shortName: 'Fully',
    nationality: 'British',
    countryCode: 'GB',
    colorPrimary: '#123456',
    biography: 'An authored biography.',
  },
}));

vi.mock('../../../../content/registries/constructors.mock.json', () => ({
  default: {
    constructors: [
      rows.identityOnly,
      rows.partiallyDescribed,
      rows.fullyDescribed,
    ],
  } as unknown,
}));

/** Every property the normalized `Constructor` contract declares. */
const DECLARED_CONSTRUCTOR_KEYS = [
  'id',
  'name',
  'shortName',
  'nationality',
  'countryCode',
  'colorPrimary',
  'biography',
  'media',
] as const satisfies readonly (keyof Constructor)[];

/** The five optional descriptive facts the seam defaults. */
const DESCRIPTIVE_FACTS = [
  'shortName',
  'nationality',
  'countryCode',
  'colorPrimary',
  'biography',
] as const satisfies readonly (keyof Constructor)[];

/** The three the partially described row leaves out entirely. */
const OMITTED_BY_THE_PARTIAL_ROW = [
  'nationality',
  'countryCode',
  'colorPrimary',
] as const satisfies readonly (keyof Constructor)[];

/** The curated season as the production provider actually emits it. */
async function loadConstructors(): Promise<Constructor[]> {
  const provider = new MockFormulaOneProvider({
    clock: new FixedClock(new Date('2026-07-20T12:00:00.000Z')),
  });
  const source = await provider.fetchSeasonSource(2026, ['season-calendar']);
  return source.constructors;
}

function constructorFrom(
  constructors: readonly Constructor[],
  id: string,
): Constructor {
  const constructor = constructors.find((entry) => entry.id === id);
  if (constructor === undefined) {
    throw new Error(`the provider emitted no constructor "${id}"`);
  }
  return constructor;
}

describe('an identity-only constructor row', () => {
  it('keeps its identity untouched', async () => {
    const constructor = constructorFrom(
      await loadConstructors(),
      'identity-only-team',
    );

    expect(constructor.id).toBe('identity-only-team');
    expect(constructor.name).toBe('Identity Only Team');
  });

  it('turns every descriptive fact into a present, explicit null', async () => {
    const constructor = constructorFrom(
      await loadConstructors(),
      'identity-only-team',
    );

    for (const key of DESCRIPTIVE_FACTS) {
      // Presence is the whole point: an absent key fails the contract, an
      // explicit `null` satisfies it, and `undefined` would pass neither.
      expect(Object.hasOwn(constructor, key), key).toBe(true);
      expect(constructor[key], key).toBeNull();
    }
  });

  it('emits the complete contract field set and nothing more', async () => {
    const constructor = constructorFrom(
      await loadConstructors(),
      'identity-only-team',
    );

    // In contract order, too: a default never moves ahead of `id` and `name`.
    expect(Object.keys(constructor)).toEqual([...DECLARED_CONSTRUCTOR_KEYS]);
    // Judged by the production validator, not by a second copy of the rule:
    // it reports `missing` for an absent key and `unknown` for a surplus one.
    expect(validateConstructor(constructor, 'constructor')).toEqual([]);
  });
});

describe('a partially described constructor row', () => {
  it('preserves every supplied value exactly, including an explicit null', async () => {
    const constructor = constructorFrom(
      await loadConstructors(),
      'partly-described-team',
    );

    // Supplied and populated: the row wins over the default.
    expect(constructor.shortName).toBe('Partly');
    // Supplied as `null`: indistinguishable from the default, and left alone.
    expect(Object.hasOwn(constructor, 'biography')).toBe(true);
    expect(constructor.biography).toBeNull();
  });

  it('defaults only the facts it omits', async () => {
    const constructor = constructorFrom(
      await loadConstructors(),
      'partly-described-team',
    );

    for (const key of OMITTED_BY_THE_PARTIAL_ROW) {
      expect(Object.hasOwn(rows.partiallyDescribed, key), key).toBe(false);
      expect(Object.hasOwn(constructor, key), key).toBe(true);
      expect(constructor[key], key).toBeNull();
    }
  });

  it('emits the complete contract field set and nothing more', async () => {
    const constructor = constructorFrom(
      await loadConstructors(),
      'partly-described-team',
    );

    expect([...Object.keys(constructor)].sort()).toEqual(
      [...DECLARED_CONSTRUCTOR_KEYS].sort(),
    );
    expect(validateConstructor(constructor, 'constructor')).toEqual([]);
  });
});

describe('a fully described constructor row', () => {
  it('reaches the contract with every authored value winning over the defaults', async () => {
    const constructor = constructorFrom(
      await loadConstructors(),
      'fully-described-team',
    );

    expect(Object.keys(constructor)).toEqual([...DECLARED_CONSTRUCTOR_KEYS]);
    expect(constructor).toEqual({
      id: 'fully-described-team',
      name: 'Fully Described Team',
      shortName: 'Fully',
      nationality: 'British',
      countryCode: 'GB',
      colorPrimary: '#123456',
      biography: 'An authored biography.',
      media: null,
    });
    expect(validateConstructor(constructor, 'constructor')).toEqual([]);
  });
});

describe('the seam', () => {
  it('reads every curated row without mutating it', async () => {
    const before = structuredClone(rows);

    await loadConstructors();
    await loadConstructors();

    // The seam clones before it maps, so the loaded content stays pristine and
    // a second read cannot observe the first one's defaults.
    expect(rows).toEqual(before);
    expect(Object.keys(rows.identityOnly).sort()).toEqual(['id', 'name']);
    expect(Object.hasOwn(rows.partiallyDescribed, 'nationality')).toBe(false);
  });
});
