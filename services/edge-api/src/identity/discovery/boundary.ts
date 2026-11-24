/** Private U1 boundary: bounded copies of decoder-required fields, never whole bodies. */
import { ownDataProperty } from '../../runtime/own-property';
import {
  decodeSeasonDrivers,
  decodeSeasonConstructors,
} from '../../providers/jolpica/participants-payload';
import { decodeRaceResults } from '../../providers/jolpica/results-payload';
import {
  decodeDriverStandings,
  decodeConstructorStandings,
} from '../../providers/jolpica/standings-payload';
import { decodeSeasonCalendar } from '../../providers/jolpica/calendar-payload';
import { decodeSeasonCircuits } from '../../providers/jolpica/circuits-payload';
import type { DecodedJolpicaResource } from './model';

/** No getters/iterators/toJSON. Proxy descriptor traps may throw and are contained. */
export function own(value: unknown, field: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return ownDataProperty(value, field)?.value;
}
type Shape = { readonly [field: string]: Shape | readonly [Shape] | true };
const identityDriver: Shape = { driverId: true };
const identityConstructor: Shape = { constructorId: true };
const identityCircuit: Shape = { circuitId: true };
const time: Shape = { time: true, millis: true };
const resultRow: Shape = {
  Driver: identityDriver,
  Constructor: identityConstructor,
  position: true,
  positionText: true,
  points: true,
  grid: true,
  laps: true,
  status: true,
  Time: time,
  FastestLap: { rank: true, lap: true, Time: time },
};
const instant: Shape = { date: true, time: true };
const calendarRace: Shape = {
  season: true,
  round: true,
  raceName: true,
  Circuit: identityCircuit,
  date: true,
  time: true,
  FirstPractice: instant,
  SecondPractice: instant,
  ThirdPractice: instant,
  Qualifying: instant,
  Sprint: instant,
  SprintShootout: instant,
  SprintQualifying: instant,
};
function shapeFor(kind: DecodedJolpicaResource['endpointKind']): Shape {
  const pagination = { limit: true, offset: true, total: true } as const;
  let table: Shape;
  switch (kind) {
    case 'season-drivers':
      table = { DriverTable: { season: true, Drivers: [identityDriver] } };
      break;
    case 'season-constructors':
      table = {
        ConstructorTable: { season: true, Constructors: [identityConstructor] },
      };
      break;
    case 'season-circuits':
      table = { CircuitTable: { season: true, Circuits: [identityCircuit] } };
      break;
    case 'season-calendar':
      table = { RaceTable: { season: true, Races: [calendarRace] } };
      break;
    case 'race-results':
      table = {
        RaceTable: {
          season: true,
          round: true,
          Races: [
            {
              season: true,
              round: true,
              raceName: true,
              Circuit: identityCircuit,
              Results: [resultRow],
            },
          ],
        },
      };
      break;
    case 'driver-standings':
    case 'constructor-standings': {
      const row = {
        position: true,
        positionText: true,
        points: true,
        wins: true,
      } as const;
      table = {
        StandingsTable: {
          season: true,
          round: true,
          StandingsLists: [
            {
              season: true,
              round: true,
              ...(kind === 'driver-standings'
                ? {
                    DriverStandings: [
                      {
                        ...row,
                        Driver: identityDriver,
                        Constructors: [identityConstructor],
                      },
                    ],
                  }
                : {
                    ConstructorStandings: [
                      { ...row, Constructor: identityConstructor },
                    ],
                  }),
            },
          ],
        },
      };
    }
  }
  return { MRData: { ...pagination, ...table } };
}
function project(
  value: unknown,
  shape: Shape | readonly [Shape] | true,
  budget: { nodes: number },
  depth = 0,
): unknown {
  if (++budget.nodes > 20_000 || depth > 12)
    throw new Error('Discovery projection capacity.');
  if (shape === true) {
    if (typeof value === 'string' && value.length > 8192)
      throw new Error('Discovery field capacity.');
    if (
      value !== null &&
      !['string', 'number', 'boolean', 'undefined'].includes(typeof value)
    )
      throw new Error('Unsafe scalar.');
    return value;
  }
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) return null;
    const length = own(value, 'length');
    if (
      typeof length !== 'number' ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > 100
    )
      throw new Error('Discovery array capacity.');
    const result: unknown[] = [];
    for (let i = 0; i < length; i++) {
      const entry = ownDataProperty(value, String(i));
      if (entry === null) throw new Error('Unsafe array element.');
      result.push(project(entry.value, shape[0]!, budget, depth + 1));
    }
    return result;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null;
  const result: Record<string, unknown> = {};
  for (const [key, childShape] of Object.entries(shape)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) continue;
    if (!('value' in descriptor))
      throw new Error('Unsafe structural property.');
    result[key] = project(descriptor.value, childShape, budget, depth + 1);
  }
  return result;
}
/** Revalidate a minimal inert view, so caller's decode cannot refer to another response.
 * Existing decoders are unmodified; older decoders never see hostile raw getters here.
 */
export function recheckDecoded(
  input: DecodedJolpicaResource,
  body: unknown,
): DecodedJolpicaResource {
  const projected = project(body, shapeFor(input.endpointKind), { nodes: 0 });
  const { season, requestedLimit } = input;
  switch (input.endpointKind) {
    case 'season-drivers':
      return {
        ...input,
        decoded: decodeSeasonDrivers(projected, season, requestedLimit),
      };
    case 'season-constructors':
      return {
        ...input,
        decoded: decodeSeasonConstructors(projected, season, requestedLimit),
      };
    case 'season-circuits':
      return {
        ...input,
        decoded: decodeSeasonCircuits(projected, season, requestedLimit),
      };
    case 'season-calendar':
      return {
        ...input,
        decoded: decodeSeasonCalendar(projected, season, requestedLimit),
      };
    case 'race-results':
      return {
        ...input,
        decoded: decodeRaceResults(
          projected,
          season,
          input.round,
          requestedLimit,
        ),
      };
    case 'driver-standings':
      return {
        ...input,
        decoded: decodeDriverStandings(projected, season, requestedLimit),
      };
    case 'constructor-standings':
      return {
        ...input,
        decoded: decodeConstructorStandings(projected, season, requestedLimit),
      };
  }
}
