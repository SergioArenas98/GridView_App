import { vi } from 'vitest';
import {
  decodeSeasonDrivers,
  decodeSeasonConstructors,
} from '../../../src/providers/jolpica/participants-payload';
import { decodeRaceResults } from '../../../src/providers/jolpica/results-payload';
import {
  decodeDriverStandings,
  decodeConstructorStandings,
} from '../../../src/providers/jolpica/standings-payload';
import { decodeSeasonCalendar } from '../../../src/providers/jolpica/calendar-payload';
import { decodeSeasonCircuits } from '../../../src/providers/jolpica/circuits-payload';
import type {
  DecodedJolpicaResource,
  ObservationContext,
} from '../../../src/identity/discovery/model';
import {
  driversEnvelope,
  constructorsEnvelope,
} from '../../providers/jolpica/participants-support';
import {
  baseRows,
  resultsEnvelope,
} from '../../providers/jolpica/results-support';
import {
  baseDriverRows,
  baseConstructorRows,
  driverStandingsEnvelope,
  constructorStandingsEnvelope,
} from '../../providers/jolpica/standings-support';
import { circuitsEnvelope } from '../../providers/jolpica/circuits-support';

export { driversEnvelope };
export const context: ObservationContext = {
  runId: '11111111-1111-4111-8111-111111111111',
  requestOrdinal: 1,
  observedAt: '2026-11-13T12:00:00.000Z',
  catalogRef: { mode: 'bundled', catalogHash: `sha256:${'a'.repeat(64)}` },
  transportKind: 'controlled',
  synthetic: true,
};
export function forbidNetwork() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('U1 network forbidden');
    }),
  );
}
export function driverInput(
  body: unknown,
  season = 2026,
): DecodedJolpicaResource {
  return {
    endpointKind: 'season-drivers',
    season,
    requestedLimit: 100,
    decoded: decodeSeasonDrivers(body, season, 100),
  };
}
export function fixtures(): {
  input: DecodedJolpicaResource;
  body: unknown;
  entities: string[];
}[] {
  const drivers = driversEnvelope([{ driverId: 'synthetic_driver' }]);
  const constructors = constructorsEnvelope([
    { constructorId: 'synthetic_team' },
  ]);
  const results = resultsEnvelope(baseRows());
  const driverStandings = driverStandingsEnvelope(baseDriverRows());
  const constructorStandings = constructorStandingsEnvelope(
    baseConstructorRows(),
  );
  const circuits = circuitsEnvelope([{ circuitId: 'synthetic_circuit' }]);
  const calendar = {
    MRData: {
      limit: '100',
      offset: '0',
      total: '1',
      RaceTable: {
        season: '2026',
        Races: [
          {
            season: '2026',
            round: '1',
            raceName: 'Synthetic Grand Prix',
            Circuit: { circuitId: 'synthetic_circuit' },
            date: '2026-03-01',
            time: '12:00:00Z',
          },
        ],
      },
    },
  };
  return [
    { input: driverInput(drivers), body: drivers, entities: ['driver'] },
    {
      input: {
        endpointKind: 'season-constructors',
        season: 2026,
        requestedLimit: 100,
        decoded: decodeSeasonConstructors(constructors, 2026, 100),
      },
      body: constructors,
      entities: ['constructor'],
    },
    {
      input: {
        endpointKind: 'race-results',
        season: 2026,
        round: 1,
        requestedLimit: 100,
        decoded: decodeRaceResults(results, 2026, 1, 100),
      },
      body: results,
      entities: ['event', 'driver', 'constructor'],
    },
    {
      input: {
        endpointKind: 'driver-standings',
        season: 2026,
        requestedLimit: 100,
        decoded: decodeDriverStandings(driverStandings, 2026, 100),
      },
      body: driverStandings,
      entities: ['driver', 'constructor'],
    },
    {
      input: {
        endpointKind: 'constructor-standings',
        season: 2026,
        requestedLimit: 100,
        decoded: decodeConstructorStandings(constructorStandings, 2026, 100),
      },
      body: constructorStandings,
      entities: ['constructor'],
    },
    {
      input: {
        endpointKind: 'season-calendar',
        season: 2026,
        requestedLimit: 100,
        decoded: decodeSeasonCalendar(calendar, 2026, 100),
      },
      body: calendar,
      entities: ['circuit', 'event'],
    },
    {
      input: {
        endpointKind: 'season-circuits',
        season: 2026,
        requestedLimit: 100,
        decoded: decodeSeasonCircuits(circuits, 2026, 100),
      },
      body: circuits,
      entities: ['circuit'],
    },
  ];
}
