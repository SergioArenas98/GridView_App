/**
 * ADR 0026 D12 items 4 and 5 at the producing-side integrity boundary.
 *
 * - `driver-entry-identity`: every driver season entry carries its D7
 *   identity, `{season}-{driverId}` or `{season}-{driverId}-{startRound}`.
 * - `result-entry-span`: every selected classified race row falls inside
 *   exactly one span of its driver, and that span names its constructor.
 * - `driver-entry-support`: every span is backed by the rows at its own
 *   boundaries (D6, D8), so an unsupported span cannot publish.
 *
 * Global entry-id uniqueness stays with `duplicate-identity`, which already
 * covers `driverEntries[].id` across the whole collection; the cross-driver
 * D7 collision is proven here against it.
 *
 * Every fixture is authored (`split-participation-support.ts`). No span is
 * derived from anything and no provider data is read.
 */

import { describe, expect, it } from 'vitest';

import { canonicalDriverSeasonEntryId } from '../../../src/contract/identity';
import type { DriverSeasonEntry } from '../../../src/contract/types';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { validateSeasonReferences } from '../../../src/providers/coordination';
import {
  splitDriverEntries,
  splitEntry,
  splitRow,
  splitSeasonFixture,
  withDriverEntries,
  withRoundRows,
} from './split-participation-support';

const LAWSON = 'liam-lawson';

function withoutEntry(
  source: ProviderSeasonSource,
  id: string,
): ProviderSeasonSource {
  const kept = source.driverEntries.filter((entry) => entry.id !== id);
  if (kept.length !== source.driverEntries.length - 1) {
    throw new Error(`fixture gap: no entry ${id}`);
  }
  return withDriverEntries(source, kept);
}

function replacingDriver(
  source: ProviderSeasonSource,
  driverId: string,
  spans: readonly DriverSeasonEntry[],
): ProviderSeasonSource {
  return withDriverEntries(source, [
    ...source.driverEntries.filter((entry) => entry.driverId !== driverId),
    ...spans,
  ]);
}

describe('D7 driver season entry identity', () => {
  it.each([
    [2026, 'max-verstappen', null, '2026-max-verstappen'],
    [2026, 'liam-lawson', null, '2026-liam-lawson'],
    [2026, 'liam-lawson', 12, '2026-liam-lawson-12'],
    [2026, 'yuki-tsunoda', 12, '2026-yuki-tsunoda-12'],
    [2026, 'franco-colapinto', 7, '2026-franco-colapinto-7'],
  ])('builds %s %s from start %s as %s', (season, driverId, start, id) => {
    expect(canonicalDriverSeasonEntryId(season, driverId, start)).toBe(id);
  });

  it('suffixes an only span that starts mid-season, like any later span', () => {
    const tsunoda = splitDriverEntries().find(
      (entry) => entry.driverId === 'yuki-tsunoda',
    );

    expect(tsunoda?.id).toBe('2026-yuki-tsunoda-12');
  });

  it('refuses an ordinal suffix in place of the start round', async () => {
    const source = await splitSeasonFixture();
    const relations = validateSeasonReferences(
      withDriverEntries(
        source,
        source.driverEntries.map((entry) =>
          entry.id === '2026-liam-lawson-12'
            ? { ...entry, id: '2026-liam-lawson-2' }
            : entry,
        ),
      ),
    );

    expect(relations).toEqual(['driver-entry-identity']);
  });

  it('refuses a base id on a span with a non-null start', async () => {
    const source = await splitSeasonFixture();
    const relations = validateSeasonReferences(
      withDriverEntries(
        source,
        source.driverEntries.map((entry) =>
          entry.id === '2026-yuki-tsunoda-12'
            ? { ...entry, id: '2026-yuki-tsunoda' }
            : entry,
        ),
      ),
    );

    expect(relations).toEqual(['driver-entry-identity']);
  });

  it('fails the whole candidate on a cross-driver collision and renames nothing', async () => {
    const source = await splitSeasonFixture();
    const template = source.drivers.find((driver) => driver.id === LAWSON)!;
    // `foo-12`'s base entry and `foo`'s round-12 entry are both
    // `2026-foo-12`: the D7 rule is not injective across drivers.
    const drivers = [
      ...source.drivers,
      { ...template, id: 'test-driver' },
      { ...template, id: 'test-driver-12' },
    ];
    const base = splitEntry('test-driver-12', 'alpine', null, null);
    const suffixed = splitEntry('test-driver', 'haas', 12, null);
    expect(base.id).toBe(suffixed.id);

    let collided: ProviderSeasonSource = withDriverEntries(
      { ...source, drivers },
      [...source.driverEntries, base, suffixed],
    );
    for (const round of [1, 11, 12, 13]) {
      collided = withRoundRows(collided, round, (rows) => [
        ...rows,
        splitRow('test-driver-12', 'alpine', rows.length + 1),
        ...(round >= 12
          ? [splitRow('test-driver', 'haas', rows.length + 2)]
          : []),
      ]);
    }

    expect(validateSeasonReferences(collided)).toEqual(['duplicate-identity']);
    // Both entries are still there, under the one id they share.
    expect(
      collided.driverEntries.filter((entry) => entry.id === base.id),
    ).toHaveLength(2);
  });
});

describe('classification to span', () => {
  it('accepts the synthetic Lawson, Tsunoda and Hadjar split', async () => {
    expect(validateSeasonReferences(await splitSeasonFixture())).toEqual([]);
  });

  it('places every classified row in exactly one span of the same constructor', async () => {
    const source = await splitSeasonFixture();
    for (const result of source.results.filter((r) => r.status === 'final')) {
      for (const row of result.entries) {
        const covering = source.driverEntries.filter(
          (entry) =>
            entry.driverId === row.driverId &&
            (entry.startRound ?? 0) <= result.round &&
            result.round <= (entry.endRound ?? Number.MAX_SAFE_INTEGER),
        );
        expect(covering).toHaveLength(1);
        expect(covering[0]!.constructorId).toBe(row.constructorId);
      }
    }
  });

  it('fails a classified row outside every span', async () => {
    const source = withRoundRows(await splitSeasonFixture(), 12, (rows) => [
      ...rows,
      splitRow('pierre-gasly', 'alpine', rows.length + 1),
    ]);

    expect(validateSeasonReferences(source)).toEqual(['result-entry-span']);
  });

  it('fails a row whose constructor differs from its covering span', async () => {
    const source = withRoundRows(await splitSeasonFixture(), 11, (rows) =>
      rows.map((row) =>
        row.driverId === 'max-verstappen'
          ? { ...row, constructorId: 'ferrari' }
          : row,
      ),
    );

    expect(validateSeasonReferences(source)).toEqual(['result-entry-span']);
  });

  it('fails a row that two overlapping spans both cover', async () => {
    const base = await splitSeasonFixture();
    const source = withDriverEntries(base, [
      ...base.driverEntries,
      splitEntry('max-verstappen', 'red-bull', 12, null),
    ]);
    const relations = validateSeasonReferences(source);

    expect(relations).toContain('result-entry-span');
    expect(relations).toContain('driver-entry-span');
  });

  it('fails when Lawson loses his second span', async () => {
    const source = withoutEntry(
      await splitSeasonFixture(),
      '2026-liam-lawson-12',
    );

    expect(validateSeasonReferences(source)).toEqual(['result-entry-span']);
  });

  it.each(['racing-bulls', 'red-bull'])(
    'fails when Lawson is flattened into one %s span',
    async (constructorId) => {
      const source = replacingDriver(await splitSeasonFixture(), LAWSON, [
        splitEntry(LAWSON, constructorId, null, null),
      ]);
      const relations = validateSeasonReferences(source);

      expect(relations).toContain('result-entry-span');
      expect(relations).toContain('driver-entry-support');
    },
  );

  it('gives the same verdict whatever order entries and rows arrive in', async () => {
    const source = await splitSeasonFixture();
    const reversed: ProviderSeasonSource = {
      ...source,
      driverEntries: [...source.driverEntries].reverse(),
      results: source.results.map((result) => ({
        ...result,
        entries: [...result.entries].reverse(),
      })),
    };
    const broken = withoutEntry(reversed, '2026-liam-lawson-12');

    expect(validateSeasonReferences(reversed)).toEqual([]);
    expect(validateSeasonReferences(broken)).toEqual(['result-entry-span']);
  });

  it('counts a provisional race classification as participation', async () => {
    const source = await splitSeasonFixture();
    const provisional: ProviderSeasonSource = {
      ...source,
      results: source.results.map((result) =>
        result.round === 13 ? { ...result, status: 'provisional' } : result,
      ),
    };

    expect(validateSeasonReferences(provisional)).toEqual([]);
  });
});

describe('span to classification', () => {
  it('fails a span no classified row supports', async () => {
    const base = await splitSeasonFixture();
    const source = withDriverEntries(base, [
      ...base.driverEntries,
      splitEntry('pierre-gasly', 'alpine', null, null),
    ]);

    expect(validateSeasonReferences(source)).toEqual(['driver-entry-support']);
  });

  it('fails a closed span whose end round has no row', async () => {
    const source = replacingDriver(await splitSeasonFixture(), 'isack-hadjar', [
      splitEntry('isack-hadjar', 'red-bull', null, 12),
    ]);

    expect(validateSeasonReferences(source)).toEqual(['driver-entry-support']);
  });

  it('fails an open span after a later classified round without the driver', async () => {
    // Hadjar is absent from rounds 12 and 13, which establishes his exit.
    const source = replacingDriver(await splitSeasonFixture(), 'isack-hadjar', [
      splitEntry('isack-hadjar', 'red-bull', null, null),
    ]);

    expect(validateSeasonReferences(source)).toEqual(['driver-entry-support']);
  });

  it('fails a span whose start round has no row', async () => {
    // Tsunoda's span claims round 12, but round 12 no longer observes him.
    const source = withRoundRows(await splitSeasonFixture(), 12, (rows) =>
      rows.filter((row) => row.driverId !== 'yuki-tsunoda'),
    );

    expect(validateSeasonReferences(source)).toEqual(['driver-entry-support']);
  });

  it('fails a span that starts after its first row', async () => {
    const source = replacingDriver(await splitSeasonFixture(), 'yuki-tsunoda', [
      splitEntry('yuki-tsunoda', 'racing-bulls', 13, null),
    ]);

    // Round 12's Tsunoda row is then outside every span.
    expect(validateSeasonReferences(source)).toEqual(['result-entry-span']);
  });

  it('fails a non-null start at the first classified round, which D8 spells null', async () => {
    const source = replacingDriver(
      await splitSeasonFixture(),
      'max-verstappen',
      [splitEntry('max-verstappen', 'red-bull', 1, null)],
    );

    expect(validateSeasonReferences(source)).toEqual(['driver-entry-support']);
  });

  it('refuses every span before the first classified race, and accepts none', async () => {
    const source = await splitSeasonFixture();
    const preSeason: ProviderSeasonSource = {
      ...source,
      calendar: source.calendar.map((event) => ({
        ...event,
        hasResults: false,
      })),
      results: source.results.map((result) => ({
        ...result,
        status: 'unavailable',
        entries: [],
      })),
    };

    expect(validateSeasonReferences(preSeason)).toEqual([
      'driver-entry-support',
    ]);
    expect(validateSeasonReferences(withDriverEntries(preSeason, []))).toEqual(
      [],
    );
  });
});
