/**
 * The curated 2026 Jolpica driver dataset.
 *
 * Pins the curator decision of 2026-09-23 that Provider Evaluation §8.10
 * records: every one of the 32 `driverId`s observed in the season-2026 Jolpica
 * driver list maps to a curated GridView driver, and the curated driver
 * registry holds those 32 identities plus `jack-doohan`.
 *
 * - `norris` was already mapped (§8.4) and is untouched.
 * - Six provider values map onto identities that already existed.
 * - 25 identities are new, identity-only rows: `id` and `fullName`, nothing
 *   else. Nine of them come from rows that carry nothing but a name.
 * - Every canonical ID is the curator-authored slug of the complete recorded
 *   given and family name; a surname-only provider ID is never an ID.
 * - `max-verstappen` and `lando-norris` lost their `permanentNumber`: the
 *   observed value is a season car number, which belongs in
 *   `DriverSeasonEntry.raceNumber`, not a career permanent number.
 * - `jack-doohan` stays a canonical identity with no Jolpica mapping.
 * - OpenF1 `driver_number` `12` (the same competitor as `antonelli`) stays
 *   acknowledged and unmapped: that mapping needs its own curator decision.
 *
 * `ACCEPTED` below is that curator decision row for row, so changing any
 * association or any canonical name means changing it here in the same
 * reviewed commit.
 *
 * A complete driver dataset is not a port. Nothing consumes any of this: no
 * drivers, constructors or participants port exists.
 *
 * Runs from a clean checkout. The raw Jolpica capture is held outside the
 * repository and is never read here: §8.10 is the repository-owned record of
 * it, and this test reconstructs that record from committed content.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { validateDriver } from '../../../src/contract/normalized';
import { MockFormulaOneProvider } from '../../../src/providers/mock/mock-provider';
import { FixedClock } from '../../../src/runtime/clock';

import { canonical, key, realRegistry, registryOf, SEASON } from './support';

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(repoRoot, ...segments), 'utf8');
}

/** The exact response hash §8.10 records for the 2026-09-23 observation. */
const RESPONSE_HASH =
  '2af29a2ae8fe8d3c1f2774d708fa9f8594ff27be69e0b2ce70b1d0513a4f0743';

/** The hash of the private curator decision pack §8.10 records. */
const DECISION_PACK_HASH =
  'faa23a5f9acad648489515a82e8d57f15165762c79d7732c3613a7694764c47b';

/** The response `Date` §8.10 records for that one response. */
const OBSERVED_AT = '2026-09-23T18:33:12Z';

const ENDPOINT = 'https://api.jolpi.ca/ergast/f1/2026/drivers/?limit=100';

interface AcceptedRow {
  readonly driverId: string;
  readonly gridviewId: string;
  readonly fullName: string;
}

/** The accepted table: exact Jolpica `driverId` -> canonical ID, full name. */
const ACCEPTED: readonly AcceptedRow[] = (
  [
    ['albon', 'alexander-albon', 'Alexander Albon'],
    ['alonso', 'fernando-alonso', 'Fernando Alonso'],
    ['antonelli', 'andrea-kimi-antonelli', 'Andrea Kimi Antonelli'],
    ['arvid_lindblad', 'arvid-lindblad', 'Arvid Lindblad'],
    ['ayumu_iwasa', 'ayumu-iwasa', 'Ayumu Iwasa'],
    ['bearman', 'oliver-bearman', 'Oliver Bearman'],
    ['bortoleto', 'gabriel-bortoleto', 'Gabriel Bortoleto'],
    ['bottas', 'valtteri-bottas', 'Valtteri Bottas'],
    ['colapinto', 'franco-colapinto', 'Franco Colapinto'],
    ['colton_herta', 'colton-herta', 'Colton Herta'],
    ['dino_beganovic', 'dino-beganovic', 'Dino Beganovic'],
    ['frederik_vesti', 'frederik-vesti', 'Frederik Vesti'],
    ['gasly', 'pierre-gasly', 'Pierre Gasly'],
    ['hadjar', 'isack-hadjar', 'Isack Hadjar'],
    ['hamilton', 'lewis-hamilton', 'Lewis Hamilton'],
    ['hulkenberg', 'nico-hulkenberg', 'Nico H\u00fclkenberg'],
    ['jak_crawford', 'jak-crawford', 'Jak Crawford'],
    ['lawson', 'liam-lawson', 'Liam Lawson'],
    ['leclerc', 'charles-leclerc', 'Charles Leclerc'],
    ['leonardo_fornaroli', 'leonardo-fornaroli', 'Leonardo Fornaroli'],
    ['luke_browning', 'luke-browning', 'Luke Browning'],
    ['max_verstappen', 'max-verstappen', 'Max Verstappen'],
    ['norris', 'lando-norris', 'Lando Norris'],
    ['ocon', 'esteban-ocon', 'Esteban Ocon'],
    ['paul_aron', 'paul-aron', 'Paul Aron'],
    ['perez', 'sergio-perez', 'Sergio P\u00e9rez'],
    ['piastri', 'oscar-piastri', 'Oscar Piastri'],
    ['russell', 'george-russell', 'George Russell'],
    ['ryo_hirakawa', 'ryo-hirakawa', 'Ryo Hirakawa'],
    ['sainz', 'carlos-sainz', 'Carlos Sainz'],
    ['stroll', 'lance-stroll', 'Lance Stroll'],
    ['tsunoda', 'yuki-tsunoda', 'Yuki Tsunoda'],
  ] as const
).map(([driverId, gridviewId, fullName]) => ({
  driverId,
  gridviewId,
  fullName,
}));

/** The 25 identities this dataset created. */
const NEW_IDS = [
  'alexander-albon',
  'andrea-kimi-antonelli',
  'arvid-lindblad',
  'ayumu-iwasa',
  'carlos-sainz',
  'colton-herta',
  'dino-beganovic',
  'esteban-ocon',
  'fernando-alonso',
  'frederik-vesti',
  'gabriel-bortoleto',
  'isack-hadjar',
  'jak-crawford',
  'lance-stroll',
  'leonardo-fornaroli',
  'liam-lawson',
  'luke-browning',
  'nico-hulkenberg',
  'oliver-bearman',
  'paul-aron',
  'pierre-gasly',
  'ryo-hirakawa',
  'sergio-perez',
  'valtteri-bottas',
  'yuki-tsunoda',
] as const;

/** The nine provider rows that carried a name and nothing else. */
const NAME_ONLY: readonly (readonly [string, string])[] = [
  ['paul_aron', 'paul-aron'],
  ['dino_beganovic', 'dino-beganovic'],
  ['luke_browning', 'luke-browning'],
  ['jak_crawford', 'jak-crawford'],
  ['leonardo_fornaroli', 'leonardo-fornaroli'],
  ['colton_herta', 'colton-herta'],
  ['ryo_hirakawa', 'ryo-hirakawa'],
  ['ayumu_iwasa', 'ayumu-iwasa'],
  ['frederik_vesti', 'frederik-vesti'],
];

/** The mapping that predates the dataset (§8.4), byte for byte. */
const NORRIS_MAPPING = {
  source: 'jolpica',
  entity: 'driver',
  providerField: 'driverId',
  providerValue: 'norris',
  gridviewId: 'lando-norris',
  evidence:
    'GridView_Provider_Evaluation.md 8.4 - Jolpica driverId slug example; 8.5 identifies Norris as the compared race winner.',
  note: 'The Jolpica slug is a surname only. It is not derivable from the GridView ID by any rule, which is why the mapping is curated rather than computed.',
} as const;

/**
 * The eight registry rows that predate the dataset, exactly as they must now
 * read. Only `max-verstappen` and `lando-norris` changed, each by losing its
 * `permanentNumber`; every other property of every row, and its key order, is
 * unchanged.
 */
const PRE_EXISTING_ROWS = [
  {
    id: 'max-verstappen',
    fullName: 'Max Verstappen',
    givenName: 'Max',
    familyName: 'Verstappen',
    shortCode: 'VER',
    nationality: 'Dutch',
    countryCode: 'NL',
    dateOfBirth: '1997-09-30',
    placeOfBirth: 'Hasselt',
    biography: null,
  },
  {
    id: 'charles-leclerc',
    fullName: 'Charles Leclerc',
    givenName: 'Charles',
    familyName: 'Leclerc',
    shortCode: 'LEC',
    permanentNumber: 16,
    nationality: 'Monegasque',
    countryCode: 'MC',
    dateOfBirth: '1997-10-16',
    placeOfBirth: 'Monte Carlo',
    biography: null,
  },
  {
    id: 'lewis-hamilton',
    fullName: 'Lewis Hamilton',
    givenName: 'Lewis',
    familyName: 'Hamilton',
    shortCode: 'HAM',
    permanentNumber: 44,
    nationality: 'British',
    countryCode: 'GB',
    dateOfBirth: '1985-01-07',
    placeOfBirth: 'Stevenage',
    biography: null,
  },
  {
    id: 'lando-norris',
    fullName: 'Lando Norris',
    givenName: 'Lando',
    familyName: 'Norris',
    shortCode: 'NOR',
    nationality: 'British',
    countryCode: 'GB',
    dateOfBirth: '1999-11-13',
    placeOfBirth: 'Bristol',
    biography: null,
  },
  {
    id: 'oscar-piastri',
    fullName: 'Oscar Piastri',
    givenName: 'Oscar',
    familyName: 'Piastri',
    shortCode: 'PIA',
    permanentNumber: 81,
    nationality: 'Australian',
    countryCode: 'AU',
    dateOfBirth: '2001-04-06',
    placeOfBirth: 'Melbourne',
    biography: null,
  },
  {
    id: 'george-russell',
    fullName: 'George Russell',
    givenName: 'George',
    familyName: 'Russell',
    shortCode: 'RUS',
    permanentNumber: 63,
    nationality: 'British',
    countryCode: 'GB',
    dateOfBirth: '1998-02-15',
    placeOfBirth: "King's Lynn",
    biography: null,
  },
  {
    id: 'jack-doohan',
    fullName: 'Jack Doohan',
    givenName: 'Jack',
    familyName: 'Doohan',
    shortCode: 'DOO',
    permanentNumber: 7,
    nationality: 'Australian',
    countryCode: 'AU',
    dateOfBirth: '2003-01-20',
    placeOfBirth: 'Gold Coast',
    biography: null,
  },
  {
    id: 'franco-colapinto',
    fullName: 'Franco Colapinto',
    givenName: 'Franco',
    familyName: 'Colapinto',
    shortCode: 'COL',
    permanentNumber: 43,
    nationality: 'Argentine',
    countryCode: 'AR',
    dateOfBirth: '2003-05-27',
    placeOfBirth: 'Pilar',
    biography: null,
  },
] as const;

/**
 * The three acknowledgements left after this dataset, each with its closed
 * reason. All are OpenF1; no Jolpica identity is acknowledged.
 */
const ACKNOWLEDGEMENTS: readonly (readonly [string, string, string, string])[] =
  [
    ['openf1', 'driver', '12', 'no-approved-provider-mapping'],
    ['openf1', 'constructor', 'Cadillac', 'no-approved-provider-mapping'],
    ['openf1', 'constructor', 'Racing Bulls', 'no-approved-provider-mapping'],
  ];

/** The keys a mapping record may carry. Anything else is an alias or worse. */
const MAPPING_KEYS = new Set([
  'source',
  'entity',
  'providerField',
  'providerValue',
  'gridviewId',
  'evidence',
  'note',
]);

interface CuratedRecord {
  readonly source: string;
  readonly entity: string;
  readonly providerField: string;
  readonly providerValue: unknown;
  readonly gridviewId?: string;
  readonly evidence?: string;
  readonly note?: string;
  readonly reason?: string;
  readonly detail?: string;
}

type RegistryRow = Record<string, unknown>;

const registryText = readRepoFile('content', 'registries', 'drivers.mock.json');
const driverRegistry = (JSON.parse(registryText) as { drivers: RegistryRow[] })
  .drivers;

const mappingDocument = JSON.parse(
  readRepoFile(
    'content',
    'seasons',
    '2026',
    'provider-mappings.development.json',
  ),
) as { season: number; mappings: CuratedRecord[] };

const evidenceCorpus = JSON.parse(
  readRepoFile(
    'content',
    'seasons',
    '2026',
    'provider-evidence.development.json',
  ),
) as {
  season: number;
  identities: CuratedRecord[];
  acknowledgedUnmapped: CuratedRecord[];
};

const isJolpicaDriver = (record: CuratedRecord): boolean =>
  record.source === 'jolpica' && record.entity === 'driver';

const isOpenF1Twelve = (record: CuratedRecord): boolean =>
  record.source === 'openf1' &&
  record.entity === 'driver' &&
  record.providerField === 'driver_number' &&
  record.providerValue === 12;

const real = realRegistry();
const driverMappings = mappingDocument.mappings.filter(isJolpicaDriver);
const driverIdentities = evidenceCorpus.identities.filter(isJolpicaDriver);

function driverKey(providerValue: string, season: number = SEASON) {
  return key<'driver'>({
    season,
    source: 'jolpica',
    entity: 'driver',
    providerField: 'driverId',
    providerValue,
  });
}

function resolvedDriver(providerValue: string): string | null {
  const result = real.resolve(driverKey(providerValue));
  return result.outcome === 'resolved' ? result.gridviewId : null;
}

function evidenceFor(providerValue: string): string {
  const record = driverIdentities.find(
    (entry) => entry.providerValue === providerValue,
  );
  return String(record?.evidence ?? '');
}

/**
 * The dataset's central mapping predicate: the season-2026 Jolpica driver
 * mappings are exactly the accepted table - every row present, no row extra,
 * every provider value a string compared with strict equality and every
 * target the accepted one. The negative controls below feed it defective
 * copies of the committed mappings to show it rejects them.
 */
function isExactlyTheAcceptedTable(
  mappings: readonly CuratedRecord[],
): boolean {
  const rows = mappings.filter(isJolpicaDriver);
  if (rows.length !== ACCEPTED.length) return false;
  return ACCEPTED.every(
    (accepted) =>
      rows.filter(
        (row) =>
          typeof row.providerValue === 'string' &&
          row.providerValue === accepted.driverId &&
          row.providerField === 'driverId' &&
          row.gridviewId === accepted.gridviewId,
      ).length === 1,
  );
}

/**
 * The dataset's central corpus predicate: every observed `driverId` is an
 * evidence identity, and none is acknowledged instead - so no captured row can
 * be silently dropped or parked.
 */
function coversEveryObservedDriver(
  identities: readonly CuratedRecord[],
  acknowledged: readonly CuratedRecord[],
): boolean {
  const observed = identities
    .filter(isJolpicaDriver)
    .map((record) => record.providerValue);
  return (
    observed.length === ACCEPTED.length &&
    ACCEPTED.every((row) => observed.includes(row.driverId)) &&
    acknowledged.filter(isJolpicaDriver).length === 0
  );
}

/**
 * The dataset's central registry predicate: the registry holds every accepted
 * identity with its accepted name, the eight pre-existing rows exactly, and
 * every created row as `id` and `fullName` only.
 */
function isExactlyTheAcceptedRegistry(rows: readonly RegistryRow[]): boolean {
  const preExisting = new Map<string, string>(
    PRE_EXISTING_ROWS.map((row) => [row.id, JSON.stringify(row)]),
  );
  if (rows.length !== ACCEPTED.length + 1) return false;
  for (const row of rows) {
    const id = String(row.id);
    const expected = preExisting.get(id);
    if (expected !== undefined) {
      if (JSON.stringify(row) !== expected) return false;
      continue;
    }
    const accepted = ACCEPTED.find((entry) => entry.gridviewId === id);
    if (accepted === undefined) return false;
    if (
      JSON.stringify(row) !==
      JSON.stringify({ id, fullName: accepted.fullName })
    ) {
      return false;
    }
  }
  return ACCEPTED.every((accepted) =>
    rows.some((row) => row.id === accepted.gridviewId),
  );
}

/**
 * The OpenF1 `12` predicate: acknowledged exactly once with the accurate
 * reason, and never mapped.
 */
function keepsTwelveAcknowledgedAndUnmapped(
  mappings: readonly CuratedRecord[],
  acknowledged: readonly CuratedRecord[],
): boolean {
  const acks = acknowledged.filter(isOpenF1Twelve);
  return (
    acks.length === 1 &&
    acks[0]?.reason === 'no-approved-provider-mapping' &&
    !mappings.some(isOpenF1Twelve)
  );
}

// ---------------------------------------------------------------------------

describe('the curated driver registry', () => {
  it('holds exactly the 32 accepted identities plus jack-doohan', () => {
    const ids = driverRegistry.map((entry) => entry.id as string);

    expect(ids).toHaveLength(33);
    expect(new Set(ids).size).toBe(33);
    expect(canonical.driver.size).toBe(33);
    expect([...ids].sort()).toEqual(
      [...ACCEPTED.map((row) => row.gridviewId), 'jack-doohan'].sort(),
    );
    expect(isExactlyTheAcceptedRegistry(driverRegistry)).toBe(true);
  });

  it('pairs every id with its accepted display name', () => {
    for (const row of ACCEPTED) {
      expect(
        driverRegistry.find((entry) => entry.id === row.gridviewId)?.fullName,
        row.gridviewId,
      ).toBe(row.fullName);
    }
  });

  it('created exactly 25 identities, each carrying only `id` and `fullName`', () => {
    const preExisting = new Set<string>(PRE_EXISTING_ROWS.map((row) => row.id));
    const created = driverRegistry.filter(
      (entry) => !preExisting.has(entry.id as string),
    );

    expect(created.map((entry) => entry.id).sort()).toEqual([...NEW_IDS]);
    for (const row of created) {
      // No name parts, code, number, nationality, country, birth details,
      // biography, URL or media: no provider descriptive fact was imported,
      // and an identity needs none.
      expect(Object.keys(row), String(row.id)).toEqual(['id', 'fullName']);
    }
  });

  it('keeps every pre-existing row byte-identical apart from two numbers', () => {
    for (const expected of PRE_EXISTING_ROWS) {
      const row = driverRegistry.find((entry) => entry.id === expected.id);
      // Serialized, so key order counts as much as every value.
      expect(JSON.stringify(row), expected.id).toBe(JSON.stringify(expected));
    }
  });

  it('carries no permanentNumber for Verstappen or Norris', () => {
    for (const id of ['max-verstappen', 'lando-norris']) {
      const row = driverRegistry.find((entry) => entry.id === id);
      expect(row, id).toBeDefined();
      expect(Object.hasOwn(row ?? {}, 'permanentNumber'), id).toBe(false);
    }
  });

  it('uses the complete given and family name, never a surname-only provider ID', () => {
    const ids = new Set(driverRegistry.map((entry) => entry.id as string));
    for (const row of ACCEPTED) {
      // A provider value is never adopted as an ID in any spelling.
      expect(ids.has(row.driverId), row.driverId).toBe(false);
      // Every ID has at least a given-name and a family-name token.
      expect(row.gridviewId.split('-').length, row.gridviewId).toBeGreaterThan(
        1,
      );
    }
    expect(ids.has('kimi-antonelli')).toBe(false);
    expect(ids.has('andrea-kimi-antonelli')).toBe(true);
  });

  it('keeps diacritics in display names only, stored NFC, with ASCII IDs', () => {
    for (const row of driverRegistry) {
      const id = String(row.id);
      const name = String(row.fullName);
      expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(name.normalize('NFC'), id).toBe(name);
    }
    expect(
      driverRegistry.find((entry) => entry.id === 'nico-hulkenberg')?.fullName,
    ).toBe('Nico H\u00fclkenberg');
    expect(
      driverRegistry.find((entry) => entry.id === 'sergio-perez')?.fullName,
    ).toBe('Sergio P\u00e9rez');
  });

  it('includes all nine name-only drivers as identity-only rows', () => {
    for (const [driverId, gridviewId] of NAME_ONLY) {
      const row = driverRegistry.find((entry) => entry.id === gridviewId);
      expect(row, gridviewId).toBeDefined();
      expect(Object.keys(row ?? {}), gridviewId).toEqual(['id', 'fullName']);
      expect(resolvedDriver(driverId), driverId).toBe(gridviewId);
    }
  });

  it('keeps jack-doohan canonical without inventing a Jolpica mapping', () => {
    expect(canonical.driver.has('jack-doohan')).toBe(true);
    expect(
      mappingDocument.mappings.filter(
        (record) => record.gridviewId === 'jack-doohan',
      ),
    ).toEqual([]);
    expect(resolvedDriver('doohan')).toBeNull();
    expect(resolvedDriver('jack_doohan')).toBeNull();
  });

  it('carries no provider URL or descriptive fact anywhere', () => {
    for (const marker of ['http', 'wikipedia', 'url', 'Url']) {
      expect(registryText, marker).not.toContain(marker);
    }
  });
});

describe('the 2026 Jolpica driver mappings', () => {
  it('are exactly the 32 accepted associations', () => {
    expect(mappingDocument.season).toBe(2026);
    expect(driverMappings).toHaveLength(32);
    expect(isExactlyTheAcceptedTable(mappingDocument.mappings)).toBe(true);
    expect(
      driverMappings
        .map((record) => [record.providerValue, record.gridviewId])
        .sort(),
    ).toEqual(ACCEPTED.map((row) => [row.driverId, row.gridviewId]).sort());
    for (const row of ACCEPTED) {
      expect(resolvedDriver(row.driverId), row.driverId).toBe(row.gridviewId);
    }
  });

  it('maps `antonelli` to `andrea-kimi-antonelli` and nothing else', () => {
    expect(resolvedDriver('antonelli')).toBe('andrea-kimi-antonelli');
    expect(
      driverMappings
        .filter((record) => record.gridviewId === 'andrea-kimi-antonelli')
        .map((record) => record.providerValue),
    ).toEqual(['antonelli']);
  });

  it('uses 32 distinct provider values and 32 distinct existing targets', () => {
    const values = driverMappings.map((record) => record.providerValue);
    const targets = driverMappings.map((record) => String(record.gridviewId));

    expect(new Set(values).size).toBe(32);
    expect(new Set(targets).size).toBe(32);
    for (const target of targets) {
      expect(canonical.driver.has(target), target).toBe(true);
    }
  });

  it('leaves the pre-existing norris mapping byte-identical', () => {
    const record = driverMappings.find(
      (entry) => entry.providerValue === 'norris',
    );
    expect(JSON.stringify(record)).toBe(JSON.stringify(NORRIS_MAPPING));
  });

  it('carries no alias, normalized value or inner season', () => {
    for (const record of driverMappings) {
      const label = String(record.providerValue);
      for (const field of Object.keys(record)) {
        expect(MAPPING_KEYS.has(field), `${label}.${field}`).toBe(true);
      }
      expect(record, label).not.toHaveProperty('season');
      expect(record.providerField, label).toBe('driverId');
      expect(typeof record.providerValue, label).toBe('string');
      expect(label.trim(), label).toBe(label);
      expect(label.toLowerCase(), label).toBe(label);
      // Never the canonical ID itself: every driver ID is curator-authored.
      expect(record.gridviewId, label).not.toBe(label);
    }
  });

  it('adds no OpenF1 driver mapping', () => {
    expect(
      mappingDocument.mappings
        .filter(
          (record) => record.source === 'openf1' && record.entity === 'driver',
        )
        .map((record) => [record.providerValue, record.gridviewId]),
    ).toEqual([[1, 'lando-norris']]);
  });

  it('matches nothing in another season or through a near miss', () => {
    for (const row of ACCEPTED) {
      expect(
        real.resolve(driverKey(row.driverId, 2027)).outcome,
        row.driverId,
      ).toBe('unresolved');
      for (const near of [
        row.driverId.toUpperCase(),
        row.driverId.replaceAll('_', '-'),
        row.gridviewId,
        ` ${row.driverId}`,
        `${row.driverId} `,
      ]) {
        if (near === row.driverId) continue;
        expect(
          real.resolveUnknown({
            season: SEASON,
            source: 'jolpica',
            entity: 'driver',
            providerField: 'driverId',
            providerValue: near,
          }).outcome,
          near,
        ).toBe('unresolved');
      }
    }
  });
});

describe('the 2026 driver evidence corpus', () => {
  it('records all 32 observed Jolpica driver identities', () => {
    expect(evidenceCorpus.season).toBe(2026);
    expect(driverIdentities).toHaveLength(32);
    expect(
      driverIdentities.map((record) => record.providerValue).sort(),
    ).toEqual(ACCEPTED.map((row) => row.driverId).sort());
    expect(
      coversEveryObservedDriver(
        evidenceCorpus.identities,
        evidenceCorpus.acknowledgedUnmapped,
      ),
    ).toBe(true);
  });

  it('gives each new mapping a repository-owned, licensed evidence record', () => {
    for (const row of ACCEPTED) {
      if (row.driverId === 'norris') continue;
      const evidence = evidenceFor(row.driverId);

      expect(evidence, row.driverId).toBe(
        `GridView_Provider_Evaluation.md 8.10 driver ${row.driverId} - Jolpica F1 (CC BY-NC-SA 4.0) ${ENDPOINT} at ${OBSERVED_AT}, HTTP 200, 32 of 32, SHA-256 ${RESPONSE_HASH}.`,
      );
      expect(evidence.length, row.driverId).toBeLessThanOrEqual(300);

      // The mapping cites the very same record.
      const mapping = driverMappings.find(
        (record) => record.providerValue === row.driverId,
      );
      expect(mapping?.evidence, row.driverId).toBe(evidence);
    }
    expect(evidenceFor('norris')).toBe(
      'GridView_Provider_Evaluation.md 8.4 - Jolpica driverId slug example.',
    );
  });

  it('acknowledges no Jolpica identity at all', () => {
    expect(
      evidenceCorpus.acknowledgedUnmapped.filter(
        (record) => record.source === 'jolpica',
      ),
    ).toEqual([]);
  });

  it('keeps the three OpenF1 acknowledgements with accurate reasons', () => {
    expect(evidenceCorpus.acknowledgedUnmapped).toHaveLength(3);
    expect(
      evidenceCorpus.acknowledgedUnmapped
        .map((record) => [
          record.source,
          record.entity,
          String(record.providerValue),
          String(record.reason),
        ])
        .sort(),
    ).toEqual([...ACKNOWLEDGEMENTS].map((row) => [...row]).sort());
  });

  it('keeps OpenF1 `12` acknowledged and unmapped now that its identity exists', () => {
    // Token-exact: `12` is two characters long, so containment can never
    // protect it; this assertion is its protection.
    expect(
      keepsTwelveAcknowledgedAndUnmapped(
        mappingDocument.mappings,
        evidenceCorpus.acknowledgedUnmapped,
      ),
    ).toBe(true);
    const record = evidenceCorpus.acknowledgedUnmapped.find(isOpenF1Twelve);
    expect(record?.detail).toContain('andrea-kimi-antonelli');
    expect(record?.detail).not.toContain('No canonical');
    expect(canonical.driver.has('andrea-kimi-antonelli')).toBe(true);
    expect(
      real.resolve(
        key<'driver'>({
          season: SEASON,
          source: 'openf1',
          entity: 'driver',
          providerField: 'driver_number',
          providerValue: 12,
        }),
      ).outcome,
    ).toBe('unresolved');
  });

  it('keeps Cadillac and Racing Bulls acknowledged and unmapped for OpenF1', () => {
    for (const teamName of ['Cadillac', 'Racing Bulls']) {
      expect(
        mappingDocument.mappings.some(
          (entry) =>
            entry.source === 'openf1' && entry.providerValue === teamName,
        ),
        teamName,
      ).toBe(false);
      expect(
        evidenceCorpus.acknowledgedUnmapped.find(
          (entry) => entry.providerValue === teamName,
        )?.reason,
        teamName,
      ).toBe('no-approved-provider-mapping');
    }
  });
});

describe('the drivers reach the normalized contract', () => {
  async function loadDrivers() {
    const provider = new MockFormulaOneProvider({
      clock: new FixedClock(new Date('2026-07-20T12:00:00.000Z')),
    });
    return (await provider.fetchSeasonSource(2026, ['season-calendar']))
      .drivers;
  }

  it('emits all 33 as valid normalized drivers', async () => {
    const drivers = await loadDrivers();

    expect(drivers).toHaveLength(33);
    for (const driver of drivers) {
      expect(validateDriver(driver, 'driver'), driver.id).toEqual([]);
    }
  });

  it('emits every new identity with null facts and its curated name', async () => {
    const drivers = await loadDrivers();

    for (const id of NEW_IDS) {
      const driver = drivers.find((entry) => entry.id === id);
      const accepted = ACCEPTED.find((row) => row.gridviewId === id);
      expect(driver?.fullName, id).toBe(accepted?.fullName);
      expect(driver?.permanentNumber, id).toBeNull();
      expect(driver?.shortCode, id).toBeNull();
      expect(driver?.nationality, id).toBeNull();
      expect(driver?.dateOfBirth, id).toBeNull();
    }
  });

  it('emits Verstappen and Norris with a null permanentNumber', async () => {
    const drivers = await loadDrivers();

    for (const id of ['max-verstappen', 'lando-norris']) {
      const driver = drivers.find((entry) => entry.id === id);
      expect(Object.hasOwn(driver ?? {}, 'permanentNumber'), id).toBe(true);
      expect(driver?.permanentNumber, id).toBeNull();
    }
  });
});

describe('nothing outside the driver dataset moved', () => {
  it('pins the final dataset totals', () => {
    expect(mappingDocument.mappings).toHaveLength(93);
    expect(evidenceCorpus.identities).toHaveLength(96);
    expect(evidenceCorpus.acknowledgedUnmapped).toHaveLength(3);
  });

  it('leaves constructors, events and circuits at 11 / 23 / 23', () => {
    const count = (entity: string) =>
      mappingDocument.mappings.filter(
        (record) => record.source === 'jolpica' && record.entity === entity,
      ).length;

    expect(canonical.constructor.size).toBe(11);
    expect(count('constructor')).toBe(11);
    expect(canonical.event.size).toBe(23);
    expect(count('event')).toBe(23);
    expect(canonical.circuit.size).toBe(23);
    expect(count('circuit')).toBe(23);
  });
});

describe('the repository-owned evidence record (Provider Evaluation §8.10)', () => {
  const evaluation = readRepoFile(
    'docs',
    'technical',
    'GridView_Provider_Evaluation.md',
  );
  const start = evaluation.indexOf('### 8.10 ');
  const section = evaluation.slice(start, evaluation.indexOf('\n---\n', start));
  const flat = section.replace(/^>[ ]?/gm, '').replace(/\s+/g, ' ');

  it('records the observation, its licence and its coverage', () => {
    expect(start).toBeGreaterThan(0);
    for (const fact of [
      RESPONSE_HASH,
      DECISION_PACK_HASH,
      ENDPOINT,
      OBSERVED_AT,
      'HTTP 200',
      'Jolpica F1',
      'CC BY-NC-SA 4.0',
      '**32 of 32**',
      '**93 exact mappings**',
      '**96 approved evidence identities**',
      '**three acknowledgements**',
      'curator-authored',
      'not committed',
      '`DriverSeasonEntry.raceNumber`',
    ]) {
      expect(flat, fact).toContain(fact);
    }
  });

  it('never claims a port, a participants resource or a live provider mode', () => {
    for (const fact of [
      'no drivers, constructors or participants port exists',
      'no live provider mode has been enabled',
      'Nothing was deployed',
    ]) {
      expect(flat, fact).toContain(fact);
    }
  });

  it('is reconstructed exactly by the committed driver table', () => {
    const rows = [
      ...section.matchAll(
        /^\| `([a-z_]+)` \| `([a-z-]+)` \| `([^`]+)` \| [^|]+ \|$/gm,
      ),
    ].map(([, driverId, gridviewId, fullName]) => ({
      driverId: String(driverId),
      gridviewId: String(gridviewId),
      fullName: String(fullName),
    }));

    expect(rows).toEqual(ACCEPTED);
  });
});

describe('a defective dataset is rejected', () => {
  it('rejects one captured driver mapping removed', () => {
    for (const row of ACCEPTED) {
      const partial = mappingDocument.mappings.filter(
        (record) =>
          !(isJolpicaDriver(record) && record.providerValue === row.driverId),
      );

      expect(partial.filter(isJolpicaDriver), row.driverId).toHaveLength(31);
      expect(isExactlyTheAcceptedTable(partial), row.driverId).toBe(false);
    }
  });

  it('rejects a name-only driver omitted from the registry', () => {
    for (const [, gridviewId] of NAME_ONLY) {
      const without = driverRegistry.filter((row) => row.id !== gridviewId);
      expect(isExactlyTheAcceptedRegistry(without), gridviewId).toBe(false);

      // And the mapping to it fails closed at the registry.
      const registry = registryOf(mappingDocument.mappings, SEASON, {
        ...canonical,
        driver: new Set(
          [...canonical.driver].filter((id) => id !== gridviewId),
        ),
      });
      expect(registry.isValid, gridviewId).toBe(false);
    }
  });

  it('rejects `antonelli` pointed at another canonical identity', () => {
    // Structurally valid - `jack-doohan` exists - so only the pin can reject it.
    const swapped = mappingDocument.mappings.map((record) =>
      isJolpicaDriver(record) && record.providerValue === 'antonelli'
        ? { ...record, gridviewId: 'jack-doohan' }
        : record,
    );

    expect(registryOf(swapped).problems).toEqual([]);
    expect(isExactlyTheAcceptedTable(swapped)).toBe(false);
  });

  it('rejects an unresolved provider row silently dropped or parked', () => {
    for (const row of ACCEPTED) {
      const dropped = evidenceCorpus.identities.filter(
        (record) =>
          !(isJolpicaDriver(record) && record.providerValue === row.driverId),
      );
      expect(
        coversEveryObservedDriver(dropped, evidenceCorpus.acknowledgedUnmapped),
        row.driverId,
      ).toBe(false);
    }

    const parked = [
      ...evidenceCorpus.acknowledgedUnmapped,
      {
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'paul_aron',
        reason: 'identity-pending-curation-review',
      },
    ];
    expect(coversEveryObservedDriver(evidenceCorpus.identities, parked)).toBe(
      false,
    );
  });

  it('rejects an optional provider fact copied into a new identity', () => {
    for (const [field, value] of [
      ['permanentNumber', 23],
      ['shortCode', 'ALB'],
      ['nationality', 'Thai'],
      ['dateOfBirth', '1996-03-23'],
      ['givenName', 'Alexander'],
    ] as const) {
      const enriched = driverRegistry.map((row) =>
        row.id === 'alexander-albon' ? { ...row, [field]: value } : row,
      );
      expect(isExactlyTheAcceptedRegistry(enriched), field).toBe(false);
    }
  });

  it('rejects a permanentNumber restored to Verstappen or Norris', () => {
    for (const id of ['max-verstappen', 'lando-norris']) {
      const restored = driverRegistry.map((row) =>
        row.id === id ? { ...row, permanentNumber: 1 } : row,
      );
      expect(isExactlyTheAcceptedRegistry(restored), id).toBe(false);
    }
  });

  it('rejects the OpenF1 `12` acknowledgement removed or turned into a mapping', () => {
    const removed = evidenceCorpus.acknowledgedUnmapped.filter(
      (record) => !isOpenF1Twelve(record),
    );
    expect(
      keepsTwelveAcknowledgedAndUnmapped(mappingDocument.mappings, removed),
    ).toBe(false);

    const mapped = [
      ...mappingDocument.mappings,
      {
        source: 'openf1',
        entity: 'driver',
        providerField: 'driver_number',
        providerValue: 12,
        gridviewId: 'andrea-kimi-antonelli',
        evidence: 'GridView_Provider_Evaluation.md 8.5',
      },
    ];
    expect(keepsTwelveAcknowledgedAndUnmapped(mapped, removed)).toBe(false);
    expect(
      keepsTwelveAcknowledgedAndUnmapped(
        mapped,
        evidenceCorpus.acknowledgedUnmapped,
      ),
    ).toBe(false);

    const staleReason = evidenceCorpus.acknowledgedUnmapped.map((record) =>
      isOpenF1Twelve(record)
        ? { ...record, reason: 'no-canonical-gridview-identity' }
        : record,
    );
    expect(
      keepsTwelveAcknowledgedAndUnmapped(mappingDocument.mappings, staleReason),
    ).toBe(false);
  });
});

describe('validation needs nothing outside the repository', () => {
  it('cites no private evidence path anywhere in the curated content', () => {
    const corpus = [
      readRepoFile(
        'content',
        'seasons',
        '2026',
        'provider-mappings.development.json',
      ),
      readRepoFile(
        'content',
        'seasons',
        '2026',
        'provider-evidence.development.json',
      ),
      registryText,
    ].join('\n');

    for (const marker of ['.gridview', 'raw-response', 'C:\\', '/home/']) {
      expect(corpus, marker).not.toContain(marker);
    }
  });
});
