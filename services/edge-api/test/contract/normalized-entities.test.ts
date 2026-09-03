/**
 * The per-entity contract matrix.
 *
 * One table per entity carried by a `CoordinatedPayload`, derived from
 * `docs/api/gridview-api-v1.yaml` for value rules and from
 * `src/contract/types.ts` for property presence. Each row asserts the exact
 * structural path **and** the closed issue code, never merely that something
 * was reported.
 *
 * Constraints the authoritative contract does not state are deliberately not
 * asserted: there is no sign or range rule for wins, podiums, laps, lengths,
 * corner counts, coordinates, aspect ratios, durations, gaps or points, so a
 * negative value in those positions is valid and is pinned as such.
 */

import { describe, expect, it } from 'vitest';

import {
  validateCircuit,
  validateConstructor,
  validateConstructorSeasonEntry,
  validateConstructorStanding,
  validateDriver,
  validateDriverSeasonEntry,
  validateDriverStanding,
  validateFastestLap,
  validateGrandPrix,
  validateLapRecord,
  validateRaceResult,
  validateRaceResultEntry,
  validateSession,
  type ContractIssue,
} from '../../src/contract/normalized';

type Validator = (value: unknown, path: string) => readonly ContractIssue[];

interface Case {
  readonly label: string;
  readonly patch: Record<string, unknown>;
  readonly drop?: string;
  readonly path: string;
  readonly code: string;
}

const session = {
  id: '2026-belgian-grand-prix-race',
  type: 'race',
  name: 'Race',
  startTime: '2026-07-19T13:00:00.000Z',
  endTime: '2026-07-19T15:00:00.000Z',
  status: 'completed',
};

const lapRecord = {
  driverId: 'max-verstappen',
  timeMillis: 104000,
  year: 2018,
};

const circuit = {
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
  lapRecord,
  media: null,
};

const constructor = {
  id: 'red-bull',
  name: 'Red Bull Racing',
  shortName: 'Red Bull',
  nationality: 'Austrian',
  countryCode: 'AT',
  colorPrimary: '#1E3A8A',
  biography: null,
  media: null,
};

const grandPrix = {
  id: '2026-belgian-grand-prix',
  season: 2026,
  round: 13,
  eventSlug: 'belgian-grand-prix',
  name: 'Belgian Grand Prix',
  officialName: null,
  circuitId: 'spa-francorchamps',
  status: 'completed',
  format: 'standard',
  startDate: '2026-07-17',
  endDate: '2026-07-19',
  timezone: 'Europe/Brussels',
  sessions: [session],
  hasResults: true,
  media: null,
};

const driverEntry = {
  id: '2026-max-verstappen',
  season: 2026,
  driverId: 'max-verstappen',
  constructorId: 'red-bull',
  raceNumber: 1,
  role: 'race',
  shortCode: 'VER',
  startRound: null,
  endRound: null,
};

const constructorEntry = {
  id: '2026-red-bull',
  season: 2026,
  constructorId: 'red-bull',
  fullName: 'Oracle Red Bull Racing',
  shortName: 'Red Bull',
  colorPrimary: '#1E3A8A',
  colorSecondary: null,
  powerUnit: 'Red Bull Powertrains',
  teamPrincipal: null,
  base: 'Milton Keynes',
  chassis: null,
  driverLineup: ['max-verstappen'],
};

const driverStanding = {
  season: 2026,
  driverId: 'max-verstappen',
  constructorId: 'red-bull',
  position: 1,
  points: 210.5,
  wins: 6,
  podiums: 9,
  provisional: false,
};

const constructorStanding = {
  season: 2026,
  constructorId: 'red-bull',
  position: 3,
  points: 240.5,
  wins: 6,
  provisional: false,
};

const fastestLap = { driverId: 'lando-norris', timeMillis: 104321, lap: 44 };

const resultEntry = {
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

const raceResult = {
  id: '2026-belgian-grand-prix-race-results',
  season: 2026,
  round: 13,
  grandPrixId: '2026-belgian-grand-prix',
  sessionType: 'race',
  status: 'final',
  entries: [resultEntry],
  fastestLap,
};

const driver = {
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

interface Entity {
  readonly name: string;
  readonly validate: Validator;
  readonly valid: Record<string, unknown>;
  /** Properties the contract declares; each must be reported when absent. */
  readonly declared: readonly string[];
  readonly cases: readonly Case[];
}

const entities: readonly Entity[] = [
  {
    name: 'Session',
    validate: validateSession,
    valid: session,
    declared: ['id', 'type', 'name', 'startTime', 'endTime', 'status'],
    cases: [
      {
        label: 'non-canonical identifier grammar',
        patch: { id: 'Race 2026' },
        path: 'v.id',
        code: 'identifier',
      },
      {
        label: 'unknown session type',
        patch: { type: 'warmup' },
        path: 'v.type',
        code: 'enum',
      },
      {
        label: 'unknown session status',
        patch: { status: 'delayed' },
        path: 'v.status',
        code: 'enum',
      },
      {
        label: 'null session type',
        patch: { type: null },
        path: 'v.type',
        code: 'null',
      },
      {
        label: 'date where a date-time is required',
        patch: { startTime: '2026-07-19' },
        path: 'v.startTime',
        code: 'timestamp',
      },
      {
        label: 'unparseable date-time',
        patch: { endTime: '2026-13-45T99:00:00Z' },
        path: 'v.endTime',
        code: 'timestamp',
      },
      {
        label: 'numeric start time',
        patch: { startTime: 1_700_000_000 },
        path: 'v.startTime',
        code: 'type',
      },
    ],
  },
  {
    name: 'LapRecord',
    validate: validateLapRecord,
    valid: lapRecord,
    declared: ['driverId', 'timeMillis', 'year'],
    cases: [
      {
        label: 'invalid driver slug',
        patch: { driverId: 'Max' },
        path: 'v.driverId',
        code: 'identifier',
      },
      {
        label: 'fractional milliseconds',
        patch: { timeMillis: 104000.5 },
        path: 'v.timeMillis',
        code: 'integer',
      },
      {
        label: 'NaN year',
        patch: { year: Number.NaN },
        path: 'v.year',
        code: 'integer',
      },
    ],
  },
  {
    name: 'Circuit',
    validate: validateCircuit,
    valid: circuit,
    declared: [
      'id',
      'name',
      'locality',
      'country',
      'countryCode',
      'latitude',
      'longitude',
      'lengthMeters',
      'cornerCount',
      'direction',
      'firstGrandPrixYear',
      'lapRecord',
      'media',
    ],
    cases: [
      {
        label: 'null name',
        patch: { name: null },
        path: 'v.name',
        code: 'null',
      },
      {
        label: 'unknown direction',
        patch: { direction: 'figure-eight' },
        path: 'v.direction',
        code: 'enum',
      },
      {
        label: 'Infinity latitude',
        patch: { latitude: Number.POSITIVE_INFINITY },
        path: 'v.latitude',
        code: 'number',
      },
      {
        label: 'string longitude',
        patch: { longitude: '5.97' },
        path: 'v.longitude',
        code: 'type',
      },
      {
        label: 'fractional length',
        patch: { lengthMeters: 7004.4 },
        path: 'v.lengthMeters',
        code: 'integer',
      },
      {
        label: 'array lap record',
        patch: { lapRecord: [] },
        path: 'v.lapRecord',
        code: 'type',
      },
      {
        label: 'malformed nested lap record',
        patch: { lapRecord: { ...lapRecord, year: 'x' } },
        path: 'v.lapRecord.year',
        code: 'type',
      },
      {
        label: 'lowercase country code',
        patch: { countryCode: 'be' },
        path: 'v.countryCode',
        code: 'pattern',
      },
    ],
  },
  {
    name: 'Driver',
    validate: validateDriver,
    valid: driver,
    declared: [
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
    ],
    cases: [
      {
        label: 'null identifier',
        patch: { id: null },
        path: 'v.id',
        code: 'null',
      },
      {
        label: 'null full name',
        patch: { fullName: null },
        path: 'v.fullName',
        code: 'null',
      },
      {
        label: 'object media collection',
        patch: { media: {} },
        path: 'v.media',
        code: 'type',
      },
    ],
  },
  {
    name: 'Constructor',
    validate: validateConstructor,
    valid: constructor,
    declared: [
      'id',
      'name',
      'shortName',
      'nationality',
      'countryCode',
      'colorPrimary',
      'biography',
      'media',
    ],
    cases: [
      {
        label: 'invalid identifier',
        patch: { id: 'Red Bull' },
        path: 'v.id',
        code: 'identifier',
      },
      {
        label: 'colour without a hash',
        patch: { colorPrimary: '1E3A8A' },
        path: 'v.colorPrimary',
        code: 'pattern',
      },
      {
        label: 'three-digit colour',
        patch: { colorPrimary: '#1E3' },
        path: 'v.colorPrimary',
        code: 'pattern',
      },
      {
        label: 'named colour',
        patch: { colorPrimary: 'navy' },
        path: 'v.colorPrimary',
        code: 'pattern',
      },
    ],
  },
  {
    name: 'GrandPrix',
    validate: validateGrandPrix,
    valid: grandPrix,
    declared: [
      'id',
      'season',
      'round',
      'eventSlug',
      'name',
      'officialName',
      'circuitId',
      'status',
      'format',
      'startDate',
      'endDate',
      'timezone',
      'sessions',
      'hasResults',
      'media',
    ],
    cases: [
      {
        label: 'round below the contract minimum',
        patch: { round: 0 },
        path: 'v.round',
        code: 'range',
      },
      {
        label: 'negative round',
        patch: { round: -1 },
        path: 'v.round',
        code: 'range',
      },
      {
        label: 'season below the supported range',
        patch: { season: 1800 },
        path: 'v.season',
        code: 'range',
      },
      {
        label: 'season above the supported range',
        patch: { season: 3000 },
        path: 'v.season',
        code: 'range',
      },
      {
        label: 'unknown event status',
        patch: { status: 'delayed' },
        path: 'v.status',
        code: 'enum',
      },
      {
        label: 'unknown weekend format',
        patch: { format: 'double-header' },
        path: 'v.format',
        code: 'enum',
      },
      {
        label: 'null sessions collection',
        patch: { sessions: null },
        path: 'v.sessions',
        code: 'null',
      },
      {
        label: 'non-boolean hasResults',
        patch: { hasResults: 'true' },
        path: 'v.hasResults',
        code: 'type',
      },
      {
        label: 'malformed nested session',
        patch: { sessions: [{ ...session, type: 'warmup' }] },
        path: 'v.sessions[0].type',
        code: 'enum',
      },
      {
        label: 'non-object session element',
        patch: { sessions: ['race'] },
        path: 'v.sessions[0]',
        code: 'type',
      },
      {
        label: 'date-time where a date is required',
        patch: { startDate: '2026-07-17T00:00:00Z' },
        path: 'v.startDate',
        code: 'date',
      },
    ],
  },
  {
    name: 'DriverSeasonEntry',
    validate: validateDriverSeasonEntry,
    valid: driverEntry,
    declared: [
      'id',
      'season',
      'driverId',
      'constructorId',
      'raceNumber',
      'role',
      'shortCode',
      'startRound',
      'endRound',
    ],
    cases: [
      {
        label: 'invalid composite identifier',
        patch: { id: '2026 Max' },
        path: 'v.id',
        code: 'identifier',
      },
      {
        label: 'unknown driver role',
        patch: { role: 'principal' },
        path: 'v.role',
        code: 'enum',
      },
      {
        label: 'fractional start round',
        patch: { startRound: 1.5 },
        path: 'v.startRound',
        code: 'integer',
      },
      {
        label: 'null driver reference',
        patch: { driverId: null },
        path: 'v.driverId',
        code: 'null',
      },
    ],
  },
  {
    name: 'ConstructorSeasonEntry',
    validate: validateConstructorSeasonEntry,
    valid: constructorEntry,
    declared: [
      'id',
      'season',
      'constructorId',
      'fullName',
      'shortName',
      'colorPrimary',
      'colorSecondary',
      'powerUnit',
      'teamPrincipal',
      'base',
      'chassis',
      'driverLineup',
    ],
    cases: [
      {
        label: 'invalid lineup member',
        patch: { driverLineup: ['Max Verstappen'] },
        path: 'v.driverLineup[0]',
        code: 'identifier',
      },
      {
        label: 'non-string lineup member',
        patch: { driverLineup: [7] },
        path: 'v.driverLineup[0]',
        code: 'type',
      },
      {
        label: 'object lineup',
        patch: { driverLineup: {} },
        path: 'v.driverLineup',
        code: 'type',
      },
      {
        label: 'invalid secondary colour',
        patch: { colorSecondary: '#ZZZZZZ' },
        path: 'v.colorSecondary',
        code: 'pattern',
      },
    ],
  },
  {
    name: 'DriverStanding',
    validate: validateDriverStanding,
    valid: driverStanding,
    declared: [
      'season',
      'driverId',
      'constructorId',
      'position',
      'points',
      'wins',
      'podiums',
      'provisional',
    ],
    cases: [
      {
        label: 'position below the contract minimum',
        patch: { position: 0 },
        path: 'v.position',
        code: 'range',
      },
      {
        label: 'null points',
        patch: { points: null },
        path: 'v.points',
        code: 'null',
      },
      {
        label: 'NaN points',
        patch: { points: Number.NaN },
        path: 'v.points',
        code: 'number',
      },
      {
        label: 'string points',
        patch: { points: '210.5' },
        path: 'v.points',
        code: 'type',
      },
      {
        label: 'fractional wins',
        patch: { wins: 1.5 },
        path: 'v.wins',
        code: 'integer',
      },
      {
        label: 'non-boolean provisional',
        patch: { provisional: 'yes' },
        path: 'v.provisional',
        code: 'type',
      },
    ],
  },
  {
    name: 'ConstructorStanding',
    validate: validateConstructorStanding,
    valid: constructorStanding,
    declared: [
      'season',
      'constructorId',
      'position',
      'points',
      'wins',
      'provisional',
    ],
    cases: [
      {
        label: 'position below the contract minimum',
        patch: { position: 0 },
        path: 'v.position',
        code: 'range',
      },
      {
        label: 'Infinity points',
        patch: { points: Number.POSITIVE_INFINITY },
        path: 'v.points',
        code: 'number',
      },
      {
        label: 'invalid constructor reference',
        patch: { constructorId: 'Red Bull' },
        path: 'v.constructorId',
        code: 'identifier',
      },
    ],
  },
  {
    name: 'FastestLap',
    validate: validateFastestLap,
    valid: fastestLap,
    declared: ['driverId', 'timeMillis', 'lap'],
    cases: [
      {
        label: 'invalid driver reference',
        patch: { driverId: 'Lando' },
        path: 'v.driverId',
        code: 'identifier',
      },
      {
        label: 'fractional lap',
        patch: { lap: 44.5 },
        path: 'v.lap',
        code: 'integer',
      },
    ],
  },
  {
    name: 'RaceResultEntry',
    validate: validateRaceResultEntry,
    valid: resultEntry,
    declared: [
      'driverId',
      'constructorId',
      'position',
      'gridPosition',
      'points',
      'status',
      'laps',
      'elapsedTimeMillis',
      'gapToLeaderMillis',
      'lapsBehind',
      'fastestLap',
      'dnfReason',
      'gapText',
    ],
    cases: [
      {
        label: 'unknown finish status',
        patch: { status: 'retired' },
        path: 'v.status',
        code: 'enum',
      },
      {
        label: 'null finish status',
        patch: { status: null },
        path: 'v.status',
        code: 'null',
      },
      {
        label: 'position below the contract minimum',
        patch: { position: 0 },
        path: 'v.position',
        code: 'range',
      },
      {
        label: 'NaN points',
        patch: { points: Number.NaN },
        path: 'v.points',
        code: 'number',
      },
      {
        label: 'non-boolean fastest lap flag',
        patch: { fastestLap: 1 },
        path: 'v.fastestLap',
        code: 'type',
      },
      {
        label: 'numeric gap text',
        patch: { gapText: 12 },
        path: 'v.gapText',
        code: 'type',
      },
    ],
  },
  {
    name: 'RaceResult',
    validate: validateRaceResult,
    valid: raceResult,
    declared: [
      'id',
      'season',
      'round',
      'grandPrixId',
      'sessionType',
      'status',
      'entries',
      'fastestLap',
    ],
    cases: [
      {
        label: 'unknown result status',
        patch: { status: 'contested' },
        path: 'v.status',
        code: 'enum',
      },
      {
        label: 'invalid parent identifier',
        patch: { grandPrixId: '2026 Belgian GP' },
        path: 'v.grandPrixId',
        code: 'identifier',
      },
      {
        label: 'object entries collection',
        patch: { entries: {} },
        path: 'v.entries',
        code: 'type',
      },
      {
        label: 'null entries collection',
        patch: { entries: null },
        path: 'v.entries',
        code: 'null',
      },
      {
        label: 'malformed nested entry',
        patch: { entries: [{ ...resultEntry, status: 'retired' }] },
        path: 'v.entries[0].status',
        code: 'enum',
      },
      {
        label: 'malformed nested fastest lap',
        patch: { fastestLap: { ...fastestLap, lap: 'x' } },
        path: 'v.fastestLap.lap',
        code: 'type',
      },
      {
        label: 'array fastest lap',
        patch: { fastestLap: [] },
        path: 'v.fastestLap',
        code: 'type',
      },
    ],
  },
];

describe.each(entities)('$name', (entity) => {
  it('accepts the contract-valid form', () => {
    expect(entity.validate(entity.valid, 'v')).toEqual([]);
  });

  it('accepts an empty collection where the contract permits one', () => {
    expect(entity.validate(entity.valid, 'v')).toEqual([]);
  });

  it.each([
    ['null', null],
    ['an array', [] as unknown],
    ['a string', 'x'],
    ['a number', 1],
  ])('rejects %s in place of the entity', (_label, value) => {
    const issues = entity.validate(value, 'v');

    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('v');
    expect(issues[0]?.code).toBe('type');
  });

  it.each(entity.declared)(
    'reports the declared property %s when absent',
    (key) => {
      const value: Record<string, unknown> = { ...entity.valid };
      delete value[key];
      const issues = entity.validate(value, 'v');

      expect(
        issues.filter((issue) => issue.path === `v.${key}`).map((i) => i.code),
      ).toEqual(['missing']);
    },
  );

  it('refuses an unknown own property', () => {
    const issues = entity.validate(
      { ...entity.valid, upstreamField: 'x' },
      'v',
    );

    expect(
      issues.filter((issue) => issue.path === 'v').map((i) => i.code),
    ).toEqual(['unknown-property']);
  });

  it.each(entity.cases.map((c) => [c.label, c] as const))(
    'rejects %s',
    (_label, testCase) => {
      const value: Record<string, unknown> = {
        ...entity.valid,
        ...testCase.patch,
      };
      const issues = entity.validate(value, 'v');

      expect(
        issues
          .filter((issue) => issue.path === testCase.path)
          .map((i) => i.code),
      ).toEqual([testCase.code]);
    },
  );

  it('never throws and never mutates', () => {
    const value: Record<string, unknown> = { ...entity.valid };
    const before = JSON.stringify(value);

    expect(() => entity.validate(value, 'v')).not.toThrow();
    expect(JSON.stringify(value)).toBe(before);
  });
});

describe('constraints the contract does not state are not invented', () => {
  it.each([
    [
      'negative wins on a driver standing',
      validateDriverStanding,
      { ...driverStanding, wins: -1 },
    ],
    [
      'negative podiums',
      validateDriverStanding,
      { ...driverStanding, podiums: -3 },
    ],
    [
      'negative points',
      validateDriverStanding,
      { ...driverStanding, points: -5 },
    ],
    [
      'a negative lap count',
      validateRaceResultEntry,
      { ...resultEntry, laps: -1 },
    ],
    [
      'a negative grid position',
      validateRaceResultEntry,
      { ...resultEntry, gridPosition: -2 },
    ],
    [
      'a latitude beyond ninety degrees',
      validateCircuit,
      { ...circuit, latitude: 900 },
    ],
    [
      'a negative circuit length',
      validateCircuit,
      { ...circuit, lengthMeters: -1 },
    ],
    [
      'a first Grand Prix year outside the season range',
      validateCircuit,
      { ...circuit, firstGrandPrixYear: 1899 },
    ],
  ])('accepts %s', (_label, validate, value) => {
    expect((validate as Validator)(value, 'v')).toEqual([]);
  });
});
