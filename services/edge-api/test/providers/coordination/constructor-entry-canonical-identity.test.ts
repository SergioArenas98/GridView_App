/**
 * F5 - the constructor season entry's own canonical identity.
 *
 * `GridView_Domain_Model.md` §4.2 defines it as exactly
 * `{season}-{constructorId}`, and both components are fields on the payload,
 * so the canonical value is derivable from the candidate itself.
 *
 * This is the closest analogue to the `result-identity` relation already in
 * the vocabulary. The existing checks are not enough: `constructor-entry-
 * constructor` asks only whether `constructorId` resolves, and
 * `duplicate-identity` needs two payloads to collide - a single arbitrary
 * unique id collides with nothing and passes both.
 *
 * The driver season entry is deliberately **not** the same case: the domain
 * model appends a start round for a split seat (§6.7), so its identity is not
 * a strict function of the payload and no equivalent relation is added.
 *
 * Recorded as a non-blocking backlog observation on PR #12 and deferred to the
 * adapter-registration / G4-activation gate; this suite closes it there.
 */

import { describe, expect, it } from 'vitest';

import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { validateSeasonReferences } from '../../../src/providers/coordination';
import { seasonFixture } from './support';

function withEntryId(
  source: ProviderSeasonSource,
  id: string,
): ProviderSeasonSource {
  return {
    ...source,
    constructorEntries: source.constructorEntries.map((entry, index) =>
      index === 0 ? { ...entry, id } : entry,
    ),
  };
}

describe('the canonical constructor-entry identity is required', () => {
  it('accepts the curated season unchanged', async () => {
    expect(validateSeasonReferences(await seasonFixture())).toEqual([]);
  });

  it.each([
    ['an arbitrary unique id', '2026-entry-1'],
    ['the wrong season', '2025-red-bull'],
    ['the wrong constructor', '2026-mclaren'],
    ['the constructor alone', 'red-bull'],
    ['the season alone', '2026'],
    ['a reversed composition', 'red-bull-2026'],
    ['a doubled separator', '2026--red-bull'],
    ['a trailing suffix', '2026-red-bull-1'],
    ['a leading suffix', 'team-2026-red-bull'],
  ])('rejects %s', async (_label, wrongId) => {
    const source = await seasonFixture();

    expect(validateSeasonReferences(withEntryId(source, wrongId))).toContain(
      'constructor-entry-identity',
    );
  });

  it('accepts the canonical identity rebuilt from the payload itself', async () => {
    const source = await seasonFixture();
    const entry = source.constructorEntries[0]!;

    expect(
      validateSeasonReferences(
        withEntryId(source, `${entry.season}-${entry.constructorId}`),
      ),
    ).toEqual([]);
  });

  it('rejects an identity that differs only by case', async () => {
    const source = await seasonFixture();
    const entry = source.constructorEntries[0]!;

    expect(
      validateSeasonReferences(
        withEntryId(
          source,
          `${entry.season}-${entry.constructorId.toUpperCase()}`,
        ),
      ),
    ).toContain('constructor-entry-identity');
  });

  it('rejects an identity padded with whitespace', async () => {
    const source = await seasonFixture();
    const entry = source.constructorEntries[0]!;

    expect(
      validateSeasonReferences(
        withEntryId(source, ` ${entry.season}-${entry.constructorId} `),
      ),
    ).toContain('constructor-entry-identity');
  });

  it('checks every entry, not only the first', async () => {
    const source = await seasonFixture();
    const corrupted: ProviderSeasonSource = {
      ...source,
      constructorEntries: source.constructorEntries.map((entry, index) =>
        index === source.constructorEntries.length - 1
          ? { ...entry, id: '2026-entry-x' }
          : entry,
      ),
    };

    expect(validateSeasonReferences(corrupted)).toContain(
      'constructor-entry-identity',
    );
  });
});

describe('the relation is independent of every neighbouring rule', () => {
  it('is the only relation an arbitrary unique entry id breaks', async () => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(withEntryId(source, '2026-entry-1')),
    ).toEqual(['constructor-entry-identity']);
  });

  it('does not depend on duplicate-identity, which two wrong ids never trigger', async () => {
    const source = await seasonFixture();
    const corrupted: ProviderSeasonSource = {
      ...source,
      constructorEntries: source.constructorEntries.map((entry, index) =>
        index < 2 ? { ...entry, id: `2026-entry-${index}` } : entry,
      ),
    };

    const relations = validateSeasonReferences(corrupted);

    expect(relations).toContain('constructor-entry-identity');
    expect(relations).not.toContain('duplicate-identity');
  });

  it('still reports the reference relation when the constructor does not resolve', async () => {
    const source = await seasonFixture();
    const corrupted: ProviderSeasonSource = {
      ...source,
      constructorEntries: source.constructorEntries.map((entry, index) =>
        index === 0
          ? { ...entry, constructorId: 'no-such-team', id: '2026-no-such-team' }
          : entry,
      ),
    };

    const relations = validateSeasonReferences(corrupted);

    expect(relations).toContain('constructor-entry-constructor');
    expect(relations).not.toContain('constructor-entry-identity');
  });

  it('leaves the driver season entry identity unconstrained, as the model requires', async () => {
    const source = await seasonFixture();
    // A split seat appends its start round, so this id is legitimately *not*
    // `{season}-{driverId}`. Adding a symmetric relation for driver entries
    // would reject the curated season, which is why none is added.
    const split = source.driverEntries.find(
      (entry) => entry.id !== `${entry.season}-${entry.driverId}`,
    );

    expect(split).toBeDefined();
    expect(split?.startRound).not.toBeNull();
    expect(validateSeasonReferences(source)).toEqual([]);
  });
});
