/**
 * ADR 0026 D12 items 1 and 2: the season Drivers collection carries split
 * spans, and driver detail reports the current span.
 *
 * - `GET /v1/seasons/{season}/drivers` emits one `SeasonDriverSummary` per
 *   `DriverSeasonEntry`, with that entry's `entryId`, `startRound`,
 *   `endRound` and constructor, and nothing is grouped, flattened or dropped.
 * - `DriverDetail.seasonEntry` is the open span, else the latest effective
 *   start, whatever order the entries arrive in.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { selectCurrentDriverEntry } from '../../src/contract/participation';
import type {
  DriverDetail,
  DriverSeasonEntry,
  SeasonDriverSummary,
} from '../../src/contract/types';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import { canonicalRevisionText } from '../../src/publication/snapshot-revision';
import { FixedClock } from '../../src/runtime/clock';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import {
  splitEntry,
  splitSeasonFixture,
} from '../providers/coordination/split-participation-support';

const NOW = '2026-07-20T12:00:00.000Z';
const fixtureRoot = join(__dirname, '..', 'fixtures', 'api', 'v1');

/** The complete, ordered `SeasonDriverSummary` property set. */
const SUMMARY_KEYS = [
  'entryId',
  'driverId',
  'fullName',
  'shortCode',
  'permanentNumber',
  'raceNumber',
  'countryCode',
  'constructorId',
  'role',
  'startRound',
  'endRound',
];

async function mockSource(): Promise<ProviderSeasonSource> {
  const provider = new MockFormulaOneProvider({
    clock: new FixedClock(new Date(NOW)),
    sourceUpdatedAt: '2026-07-18T11:55:00.000Z',
  });
  return provider.fetchSeasonSource(2026, ['season-calendar']);
}

function document<T>(source: ProviderSeasonSource, name: string): T {
  const found = generateSnapshotSet(source, NOW, 'v').documents.find(
    (candidate) => candidate.documentName === name,
  );
  if (found === undefined) throw new Error(`no document ${name}`);
  return found.data as T;
}

function drivers(source: ProviderSeasonSource): SeasonDriverSummary[] {
  return document<SeasonDriverSummary[]>(source, 'drivers');
}

function detail(source: ProviderSeasonSource, driverId: string): DriverDetail {
  return document<DriverDetail>(source, `driver:${driverId}`);
}

function withEntries(
  source: ProviderSeasonSource,
  driverEntries: DriverSeasonEntry[],
): ProviderSeasonSource {
  return { ...source, driverEntries };
}

describe('the SeasonDriverSummary shape', () => {
  it('pins the complete property set, in order, on every row', async () => {
    for (const row of drivers(await mockSource())) {
      expect(Object.keys(row)).toEqual(SUMMARY_KEYS);
    }
  });

  it('always carries the entry id and both bounds, nulls explicitly present', async () => {
    const rows = drivers(await mockSource());
    const verstappen = rows.find((row) => row.driverId === 'max-verstappen')!;
    const doohan = rows.find((row) => row.driverId === 'jack-doohan')!;
    const colapinto = rows.find((row) => row.driverId === 'franco-colapinto')!;

    expect(verstappen).toMatchObject({
      entryId: '2026-max-verstappen',
      startRound: null,
      endRound: null,
    });
    expect(Object.hasOwn(verstappen, 'startRound')).toBe(true);
    expect(Object.hasOwn(verstappen, 'endRound')).toBe(true);
    expect(JSON.parse(JSON.stringify(verstappen))).toHaveProperty(
      'startRound',
      null,
    );
    expect(doohan).toMatchObject({
      entryId: '2026-jack-doohan',
      startRound: null,
      endRound: 9,
    });
    expect(colapinto).toMatchObject({
      entryId: '2026-franco-colapinto-10',
      startRound: 10,
      endRound: null,
    });
  });

  it('adds the same rows to the bootstrap document', async () => {
    const source = await mockSource();
    const bootstrap = document<{ drivers: SeasonDriverSummary[] }>(
      source,
      'bootstrap',
    );

    expect(bootstrap.drivers).toEqual(drivers(source));
  });

  it('puts the new fields in the canonical revision', () => {
    const row = {
      entryId: '2026-liam-lawson',
      driverId: 'liam-lawson',
      fullName: 'Liam Lawson',
      shortCode: null,
      permanentNumber: null,
      raceNumber: null,
      countryCode: null,
      constructorId: 'racing-bulls',
      role: 'race',
      startRound: null,
      endRound: 11,
    };
    const text = (data: unknown[]) =>
      canonicalRevisionText({
        documentName: 'drivers',
        schemaVersion: 1,
        data,
      });
    const base = text([row]);

    expect(text([{ ...row, entryId: '2026-liam-lawson-12' }])).not.toBe(base);
    expect(text([{ ...row, startRound: 12 }])).not.toBe(base);
    expect(text([{ ...row, endRound: null }])).not.toBe(base);
  });
});

describe('one transport row per season entry', () => {
  it('publishes a driver with two spans twice', async () => {
    const rows = drivers(await splitSeasonFixture());
    const lawson = rows.filter((row) => row.driverId === 'liam-lawson');

    expect(rows).toHaveLength(5);
    expect(lawson).toHaveLength(2);
  });

  it('keeps each row to its own entry, constructor and bounds', async () => {
    const lawson = drivers(await splitSeasonFixture()).filter(
      (row) => row.driverId === 'liam-lawson',
    );

    expect(
      lawson.map(({ entryId, constructorId, startRound, endRound }) => ({
        entryId,
        constructorId,
        startRound,
        endRound,
      })),
    ).toEqual([
      {
        entryId: '2026-liam-lawson',
        constructorId: 'racing-bulls',
        startRound: null,
        endRound: 11,
      },
      {
        entryId: '2026-liam-lawson-12',
        constructorId: 'red-bull',
        startRound: 12,
        endRound: null,
      },
    ]);
    // Identity fields come from the one stable driver on both rows.
    expect(lawson[0]!.fullName).toBe(lawson[1]!.fullName);
    expect(lawson[0]!.countryCode).toBe(lawson[1]!.countryCode);
  });

  it('never takes the constructor from a standing', async () => {
    const source = await splitSeasonFixture();
    const standings = source.driverStandings.map((standing) =>
      standing.driverId === 'max-verstappen'
        ? { ...standing, constructorId: 'ferrari' }
        : standing,
    );
    const verstappen = drivers({
      ...source,
      driverStandings: standings,
    }).find((row) => row.driverId === 'max-verstappen')!;

    expect(verstappen.constructorId).toBe('red-bull');
  });

  it('orders drivers by first entry and each driver’s spans chronologically', async () => {
    const source = await splitSeasonFixture();
    const expected = [
      '2026-max-verstappen',
      '2026-isack-hadjar',
      '2026-liam-lawson',
      '2026-liam-lawson-12',
      '2026-yuki-tsunoda-12',
    ];
    // Lawson's later span listed first: his rows still come out in order,
    // at the position of his first entry.
    const [ver, had, lawEarly, lawLate, tsu] = source.driverEntries;
    const shuffled = withEntries(source, [
      ver!,
      had!,
      lawLate!,
      lawEarly!,
      tsu!,
    ]);

    expect(drivers(source).map((row) => row.entryId)).toEqual(expected);
    expect(drivers(shuffled).map((row) => row.entryId)).toEqual(expected);
  });

  it('is deterministic across runs', async () => {
    const source = await splitSeasonFixture();

    expect(JSON.stringify(drivers(source))).toBe(
      JSON.stringify(drivers(source)),
    );
  });

  it('keeps an identity without an entry out of the season list', async () => {
    const source = await splitSeasonFixture();
    const rows = drivers(source);

    expect(source.drivers.some((driver) => driver.id === 'pierre-gasly')).toBe(
      true,
    );
    expect(rows.some((row) => row.driverId === 'pierre-gasly')).toBe(false);
    // It still has a detail document, with no season entry.
    expect(detail(source, 'pierre-gasly').seasonEntry).toBeNull();
    expect(detail(source, 'pierre-gasly').constructor).toBeNull();
  });

  it('matches the split contract fixture exactly', async () => {
    const fixture = JSON.parse(
      readFileSync(join(fixtureRoot, 'drivers', 'season-drivers-split.json'), {
        encoding: 'utf8',
      }),
    ) as { data: unknown };

    expect(fixture.data).toEqual(drivers(await splitSeasonFixture()));
  });
});

describe('driver detail selects the current span', () => {
  it('selects an open second span over the first historical one', async () => {
    const lawson = detail(await splitSeasonFixture(), 'liam-lawson');

    expect(lawson.seasonEntry?.id).toBe('2026-liam-lawson-12');
    expect(lawson.constructor?.id).toBe('red-bull');
  });

  it('selects the latest effective start when every span is closed', async () => {
    const source = await splitSeasonFixture();
    const closed = withEntries(
      source,
      source.driverEntries.map((entry) =>
        entry.id === '2026-liam-lawson-12' ? { ...entry, endRound: 13 } : entry,
      ),
    );
    const lawson = detail(closed, 'liam-lawson');

    expect(lawson.seasonEntry?.id).toBe('2026-liam-lawson-12');
    expect(lawson.constructor?.id).toBe('red-bull');
  });

  it('selects a driver’s only closed span, with its constructor', async () => {
    const hadjar = detail(await splitSeasonFixture(), 'isack-hadjar');

    expect(hadjar.seasonEntry?.id).toBe('2026-isack-hadjar');
    expect(hadjar.seasonEntry?.endRound).toBe(11);
    expect(hadjar.constructor?.id).toBe('red-bull');
  });

  it('does not depend on source order', async () => {
    const source = await splitSeasonFixture();
    const reversed = withEntries(source, [...source.driverEntries].reverse());

    expect(detail(reversed, 'liam-lawson')).toEqual(
      detail(source, 'liam-lawson'),
    );
  });

  it('treats a null start as the season start when all spans are closed', () => {
    const early = splitEntry('liam-lawson', 'racing-bulls', null, 11);
    const late = splitEntry('liam-lawson', 'red-bull', 12, 13);

    expect(selectCurrentDriverEntry([late, early], 'liam-lawson')).toBe(late);
    expect(selectCurrentDriverEntry([early, late], 'liam-lawson')).toBe(late);
    expect(selectCurrentDriverEntry([early], 'max-verstappen')).toBeNull();
  });

  it('refuses to guess between two open spans or two equal starts', () => {
    expect(() =>
      selectCurrentDriverEntry(
        [
          splitEntry('liam-lawson', 'racing-bulls', null, null),
          splitEntry('liam-lawson', 'red-bull', 12, null),
        ],
        'liam-lawson',
      ),
    ).toThrow(/two open spans/);
    expect(() =>
      selectCurrentDriverEntry(
        [
          splitEntry('liam-lawson', 'racing-bulls', 12, 12),
          splitEntry('liam-lawson', 'red-bull', 12, 13),
        ],
        'liam-lawson',
      ),
    ).toThrow(/share a start/);
  });
});
