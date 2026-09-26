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
 * a null `endRound` "no exit observed", i.e. -infinity and +infinity for
 * comparison. Touching spans overlap, because the shared round belongs to
 * both. Nothing in Flutter or Drift is modified by this suite.
 *
 * The spans here are **shapes**, not observations: most claim rounds the
 * fixture's calendar never classified. The two classification relations
 * (`result-entry-span`, `driver-entry-support`) therefore fail on them by
 * design and are proven in `participation-integrity.test.ts`; this suite
 * asserts every other relation. Each span carries its ADR 0026 D7 identity, so
 * `driver-entry-identity` stays silent.
 *
 * Recorded as a non-blocking backlog observation on PR #12 and deferred to the
 * adapter-registration / G4-activation gate; this suite closes it there.
 */

import { describe, expect, it } from 'vitest';

import type { DriverSeasonEntry } from '../../../src/contract/types';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { canonicalDriverSeasonEntryId } from '../../../src/contract/identity';
import {
  validateSeasonReferences,
  type SeasonRelation,
} from '../../../src/providers/coordination';
import { seasonFixture } from './support';

/** Every relation except the two that compare spans with classifications. */
function shapeRelations(source: ProviderSeasonSource): SeasonRelation[] {
  return validateSeasonReferences(source).filter(
    (relation) =>
      relation !== 'result-entry-span' && relation !== 'driver-entry-support',
  );
}

/** Replaces one driver's entries, leaving every other participant untouched. */
function withSpansFor(
  source: ProviderSeasonSource,
  driverId: string,
  spans: readonly { start: number | null; end: number | null }[],
): ProviderSeasonSource {
  const template = source.driverEntries.find(
    (entry) => entry.driverId === driverId,
  );
  if (template === undefined)
    throw new Error(`no curated entry for ${driverId}`);
  const replacements: DriverSeasonEntry[] = spans.map((span) => ({
    ...template,
    id: canonicalDriverSeasonEntryId(template.season, driverId, span.start),
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
  it('accepts the curated season', async () => {
    const source = await seasonFixture();

    expect(validateSeasonReferences(source)).toEqual([]);
  });

  it('accepts one span with no observed boundary', async () => {
    const source = await seasonFixture();

    expect(
      shapeRelations(withSpansFor(source, SOLO, [{ start: null, end: null }])),
    ).toEqual([]);
  });

  it('accepts a legitimate mid-season substitution', async () => {
    const source = await seasonFixture();

    expect(
      shapeRelations(
        withSpansFor(source, SOLO, [
          { start: 1, end: 9 },
          { start: 10, end: null },
        ]),
      ),
    ).toEqual([]);
  });

  it('accepts three non-overlapping spans', async () => {
    const source = await seasonFixture();

    expect(
      shapeRelations(
        withSpansFor(source, SOLO, [
          { start: 1, end: 5 },
          { start: 6, end: 9 },
          { start: 10, end: 20 },
        ]),
      ),
    ).toEqual([]);
  });

  it('accepts an open start followed by a later closed span', async () => {
    const source = await seasonFixture();

    expect(
      shapeRelations(
        withSpansFor(source, SOLO, [
          { start: null, end: 9 },
          { start: 10, end: 20 },
        ]),
      ),
    ).toEqual([]);
  });

  it('accepts a single-round span', async () => {
    const source = await seasonFixture();

    expect(
      shapeRelations(withSpansFor(source, SOLO, [{ start: 7, end: 7 }])),
    ).toEqual([]);
  });

  it('accepts overlapping spans belonging to two different drivers', async () => {
    const source = await seasonFixture();
    const overlapping = withSpansFor(
      withSpansFor(source, SOLO, [{ start: 1, end: 20 }]),
      'lando-norris',
      [{ start: 1, end: 20 }],
    );

    expect(shapeRelations(overlapping)).toEqual([]);
  });
});

describe('inverted spans are rejected', () => {
  it.each([
    ['a plainly inverted span', 9, 1],
    ['an inversion by one round', 6, 5],
  ])('rejects %s', async (_label, start, end) => {
    const source = await seasonFixture();

    expect(
      shapeRelations(withSpansFor(source, SOLO, [{ start, end }])),
    ).toContain('driver-entry-span');
  });

  it('treats a null start as the season start, so it can never invert', async () => {
    const source = await seasonFixture();

    expect(
      shapeRelations(withSpansFor(source, SOLO, [{ start: null, end: 1 }])),
    ).toEqual([]);
  });

  it('treats a null end as unbounded, so it can never invert', async () => {
    const source = await seasonFixture();

    expect(
      shapeRelations(withSpansFor(source, SOLO, [{ start: 24, end: null }])),
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
        shapeRelations(
          withSpansFor(source, SOLO, [
            { start: firstStart, end: firstEnd },
            { start: secondStart, end: secondEnd },
          ]),
        ),
      ).toContain('driver-entry-span');
    },
  );

  it('rejects an overlap involving an open end', async () => {
    const source = await seasonFixture();

    expect(
      shapeRelations(
        withSpansFor(source, SOLO, [
          { start: 1, end: null },
          { start: 10, end: 20 },
        ]),
      ),
    ).toContain('driver-entry-span');
  });

  it('rejects an overlap involving an open start', async () => {
    const source = await seasonFixture();

    expect(
      shapeRelations(
        withSpansFor(source, SOLO, [
          { start: 5, end: 9 },
          { start: null, end: 20 },
        ]),
      ),
    ).toContain('driver-entry-span');
  });

  it('rejects two fully open spans for one driver', async () => {
    const source = await seasonFixture();

    expect(
      shapeRelations(
        withSpansFor(source, SOLO, [
          { start: null, end: null },
          { start: null, end: null },
        ]),
      ),
    ).toContain('driver-entry-span');
  });

  it('detects an overlap regardless of the order the entries arrive in', async () => {
    const source = await seasonFixture();
    const overlapping = withSpansFor(source, SOLO, [
      { start: 10, end: 20 },
      { start: 1, end: 12 },
    ]);
    const reversed: ProviderSeasonSource = {
      ...overlapping,
      driverEntries: [...overlapping.driverEntries].reverse(),
    };

    expect(shapeRelations(overlapping)).toContain('driver-entry-span');
    expect(shapeRelations(reversed)).toContain('driver-entry-span');
  });
});

describe('the relation is independent of every neighbouring rule', () => {
  it('is the only relation an overlapping pair breaks', async () => {
    const source = await seasonFixture();

    expect(
      shapeRelations(
        withSpansFor(source, SOLO, [
          { start: 1, end: 9 },
          { start: 5, end: 12 },
        ]),
      ),
    ).toEqual(['driver-entry-span']);
  });

  it('is distinct from duplicate-identity, which two distinct ids never trigger', async () => {
    const source = await seasonFixture();
    const relations = shapeRelations(
      withSpansFor(source, SOLO, [
        { start: 1, end: 9 },
        { start: 5, end: 12 },
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

    const relations = shapeRelations(corrupted);

    expect(relations).toContain('driver-entry-driver');
    expect(relations).not.toContain('driver-entry-span');
  });

  it('reports each broken relation once, in declared vocabulary order', async () => {
    const source = await seasonFixture();
    const overlapping = withSpansFor(source, SOLO, [
      { start: 1, end: 9 },
      { start: 5, end: 12 },
    ]);
    const relations = shapeRelations({
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
