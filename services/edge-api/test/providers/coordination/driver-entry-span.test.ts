/**
 * F3 - driver participation spans must be internally consistent.
 *
 * Mid-season participation is modelled as split spans rather than by mutating
 * identity (`GridView_Domain_Model.md` §6.7), so multiple entries for one
 * driver are legitimate and must stay accepted. What is not legitimate is an
 * *inverted* span or two *overlapping* stints for the same driver: the local
 * write rejects both, so publishing either fails the client's roster refresh
 * transaction and leaves users on stale data with no server-side signal.
 *
 * The rule mirrors `CompetitorDao._validateDriverSpans()`
 * (`lib/core/database/daos/competitor_dao.dart`) exactly, including its
 * null-bound semantics: a null `startRound` means "from the season start" and
 * a null `endRound` "until the season end", i.e. -infinity and +infinity for
 * comparison. Touching spans overlap, because the shared round belongs to
 * both. Nothing in Flutter or Drift is modified by this suite.
 *
 * Recorded as a non-blocking backlog observation on PR #12 and deferred to the
 * adapter-registration / G4-activation gate; this suite closes it there.
 */

import { describe, expect, it } from 'vitest';

import type { DriverSeasonEntry } from '../../../src/contract/types';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { validateSeasonReferences } from '../../../src/providers/coordination';
import { seasonFixture } from './support';

/** Replaces one driver's entries, leaving every other participant untouched. */
function withSpansFor(
  source: ProviderSeasonSource,
  driverId: string,
  spans: readonly {
    start: number | null;
    end: number | null;
    suffix?: string;
  }[],
): ProviderSeasonSource {
  const template = source.driverEntries.find(
    (entry) => entry.driverId === driverId,
  );
  if (template === undefined)
    throw new Error(`no curated entry for ${driverId}`);
  const replacements: DriverSeasonEntry[] = spans.map((span, index) => ({
    ...template,
    id: `${template.season}-${driverId}${span.suffix ?? (index === 0 ? '' : `-${index}`)}`,
    startRound: span.start,
    endRound: span.end,
  }));
  return {
    ...source,
    driverEntries: [
      ...source.driverEntries.filter((entry) => entry.driverId !== driverId),
      ...replacements,
    ],
  };
}

const SOLO = 'max-verstappen';

describe('valid participation is preserved', () => {
  it('accepts the curated season, which already contains a real split seat', async () => {
    const source = await seasonFixture();
    const alpine = source.driverEntries.filter(
      (entry) => entry.constructorId === 'alpine',
    );

    expect(alpine.length).toBeGreaterThan(1);
    expect(validateSeasonReferences(source)).toEqual([]);
  });

  it('accepts one open-ended full-season span', async () => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(
        withSpansFor(source, SOLO, [{ start: null, end: null }]),
      ),
    ).toEqual([]);
  });

  it('accepts a legitimate mid-season substitution', async () => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(
        withSpansFor(source, SOLO, [
          { start: 1, end: 9 },
          { start: 10, end: null, suffix: '-10' },
        ]),
      ),
    ).toEqual([]);
  });

  it('accepts three non-overlapping spans', async () => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(
        withSpansFor(source, SOLO, [
          { start: 1, end: 5 },
          { start: 6, end: 9, suffix: '-6' },
          { start: 10, end: 20, suffix: '-10' },
        ]),
      ),
    ).toEqual([]);
  });

  it('accepts an open start followed by a later closed span', async () => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(
        withSpansFor(source, SOLO, [
          { start: null, end: 9 },
          { start: 10, end: 20, suffix: '-10' },
        ]),
      ),
    ).toEqual([]);
  });

  it('accepts a single-round span', async () => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(
        withSpansFor(source, SOLO, [{ start: 7, end: 7 }]),
      ),
    ).toEqual([]);
  });

  it('accepts overlapping spans belonging to two different drivers', async () => {
    const source = await seasonFixture();
    const overlapping = withSpansFor(
      withSpansFor(source, SOLO, [{ start: 1, end: 20 }]),
      'lando-norris',
      [{ start: 1, end: 20 }],
    );

    expect(validateSeasonReferences(overlapping)).toEqual([]);
  });
});

describe('inverted spans are rejected', () => {
  it.each([
    ['a plainly inverted span', 9, 1],
    ['an inversion by one round', 6, 5],
  ])('rejects %s', async (_label, start, end) => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(withSpansFor(source, SOLO, [{ start, end }])),
    ).toContain('driver-entry-span');
  });

  it('treats a null start as the season start, so it can never invert', async () => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(
        withSpansFor(source, SOLO, [{ start: null, end: 1 }]),
      ),
    ).toEqual([]);
  });

  it('treats a null end as the season end, so it can never invert', async () => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(
        withSpansFor(source, SOLO, [{ start: 24, end: null }]),
      ),
    ).toEqual([]);
  });
});

describe('overlapping spans for one driver are rejected', () => {
  it.each([
    ['fully overlapping spans', 1, 9, 1, 9],
    ['partially overlapping spans', 1, 9, 5, 12],
    ['a nested span', 1, 20, 5, 9],
    ['touching spans, whose shared round belongs to both', 1, 9, 9, 12],
  ])(
    'rejects %s',
    async (_label, firstStart, firstEnd, secondStart, secondEnd) => {
      const source = await seasonFixture();

      expect(
        validateSeasonReferences(
          withSpansFor(source, SOLO, [
            { start: firstStart, end: firstEnd },
            { start: secondStart, end: secondEnd, suffix: '-b' },
          ]),
        ),
      ).toContain('driver-entry-span');
    },
  );

  it('rejects an overlap involving an open end', async () => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(
        withSpansFor(source, SOLO, [
          { start: 1, end: null },
          { start: 10, end: 20, suffix: '-b' },
        ]),
      ),
    ).toContain('driver-entry-span');
  });

  it('rejects an overlap involving an open start', async () => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(
        withSpansFor(source, SOLO, [
          { start: 5, end: 9 },
          { start: null, end: 20, suffix: '-b' },
        ]),
      ),
    ).toContain('driver-entry-span');
  });

  it('rejects two fully open spans for one driver', async () => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(
        withSpansFor(source, SOLO, [
          { start: null, end: null },
          { start: null, end: null, suffix: '-b' },
        ]),
      ),
    ).toContain('driver-entry-span');
  });

  it('detects an overlap regardless of the order the entries arrive in', async () => {
    const source = await seasonFixture();
    const overlapping = withSpansFor(source, SOLO, [
      { start: 10, end: 20 },
      { start: 1, end: 12, suffix: '-b' },
    ]);
    const reversed: ProviderSeasonSource = {
      ...overlapping,
      driverEntries: [...overlapping.driverEntries].reverse(),
    };

    expect(validateSeasonReferences(overlapping)).toContain(
      'driver-entry-span',
    );
    expect(validateSeasonReferences(reversed)).toContain('driver-entry-span');
  });
});

describe('the relation is independent of every neighbouring rule', () => {
  it('is the only relation an overlapping pair breaks', async () => {
    const source = await seasonFixture();

    expect(
      validateSeasonReferences(
        withSpansFor(source, SOLO, [
          { start: 1, end: 9 },
          { start: 5, end: 12, suffix: '-b' },
        ]),
      ),
    ).toEqual(['driver-entry-span']);
  });

  it('is distinct from duplicate-identity, which two distinct ids never trigger', async () => {
    const source = await seasonFixture();
    const relations = validateSeasonReferences(
      withSpansFor(source, SOLO, [
        { start: 1, end: 9 },
        { start: 5, end: 12, suffix: '-b' },
      ]),
    );

    expect(relations).not.toContain('duplicate-identity');
  });

  it('still reports the reference relation when the driver does not resolve', async () => {
    const source = await seasonFixture();
    const corrupted: ProviderSeasonSource = {
      ...source,
      driverEntries: source.driverEntries.map((entry, index) =>
        index === 0 ? { ...entry, driverId: 'no-such-driver' } : entry,
      ),
    };

    const relations = validateSeasonReferences(corrupted);

    expect(relations).toContain('driver-entry-driver');
    expect(relations).not.toContain('driver-entry-span');
  });

  it('reports each broken relation once, in declared vocabulary order', async () => {
    const source = await seasonFixture();
    const overlapping = withSpansFor(source, SOLO, [
      { start: 1, end: 9 },
      { start: 5, end: 12, suffix: '-b' },
    ]);
    const relations = validateSeasonReferences({
      ...overlapping,
      constructorEntries: overlapping.constructorEntries.map((entry, index) =>
        index === 0 ? { ...entry, id: '2026-entry-x' } : entry,
      ),
    });

    expect(relations).toEqual([
      'driver-entry-span',
      'constructor-entry-identity',
    ]);
    expect(new Set(relations).size).toBe(relations.length);
  });
});
