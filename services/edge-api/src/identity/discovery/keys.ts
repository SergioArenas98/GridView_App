/** Enumeration mirrors normalizer lookup order; no resolution or log-cap filtering. */
import {
  canonicalKey,
  decodeProviderMappingKey,
} from '../../providers/mappings/mapping-key';
import type { ProviderMappingKey } from '../../providers/mappings/mapping-key';
import { canonicalJson, sha256Hex, utf8 } from '../../ingest/canonical-json';
/** Exact key serialization shared with reviewed catalog storage; no resolver. */
export { canonicalKey };
import { ownDataProperty } from '../../runtime/own-property';
import type {
  DecodedJolpicaResource,
  IdentityHash,
  IdentityKeyReference,
} from './model';

export async function identityHash(text: string): Promise<IdentityHash> {
  return `sha256:${await sha256Hex(utf8(text))}`;
}
export const hashIdentityProjection = (value: unknown): Promise<IdentityHash> =>
  identityHash(canonicalJson(value));
/** Copy only own data fields before the existing key validator reads values. */
export function discoveryKey(value: unknown): ProviderMappingKey | null {
  const copy = (
    input: unknown,
    names: readonly string[],
  ): Record<string, unknown> | null => {
    if (typeof input !== 'object' || input === null || Array.isArray(input))
      return null;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== names.length ||
      keys.some((k) => typeof k !== 'string' || !names.includes(k))
    )
      return null;
    const result: Record<string, unknown> = {};
    for (const name of names) {
      const property = ownDataProperty(input, name);
      if (property === null) return null;
      result[name] = property.value;
    }
    return result;
  };
  try {
    const key = copy(value, [
      'season',
      'source',
      'entity',
      'providerField',
      'providerValue',
    ]);
    if (key === null) return null;
    if (typeof key.providerValue === 'object' && key.providerValue !== null) {
      key.providerValue = copy(key.providerValue, [
        'round',
        'raceName',
        'circuitId',
      ]);
    }
    const decoded = decodeProviderMappingKey(key);
    return decoded.ok ? decoded.key : null;
  } catch {
    return null;
  }
}
/** Uses the existing key validation/serialization, with no accessor execution. */
export async function candidateIdFor(
  key: ProviderMappingKey,
): Promise<IdentityHash> {
  const decoded = discoveryKey(key);
  if (decoded === null) throw new Error('Invalid identity discovery key.');
  return identityHash('gv-identity-candidate/1' + canonicalKey(decoded));
}
export function enumerateJolpicaKeys(
  input: DecodedJolpicaResource,
): readonly IdentityKeyReference[] {
  const refs: IdentityKeyReference[] = [];
  const { season } = input;
  const endpoint = input.endpointKind;
  const resource: IdentityKeyReference['resource'] =
    endpoint === 'race-results'
      ? {
          kind: 'session-classification',
          season,
          round: input.round,
          sessionType: 'race',
        }
      : {
          kind:
            endpoint === 'season-drivers' || endpoint === 'season-constructors'
              ? 'season-participants'
              : endpoint,
          season,
        };
  const add = (
    key: ProviderMappingKey,
    round: number | null,
    driverPath: readonly string[] | null = null,
  ): void => {
    refs.push({
      key,
      resource,
      round,
      sessionType: endpoint === 'race-results' ? 'race' : null,
      driverPath,
    });
  };
  const driver = (
    value: string,
    round: number | null,
    path: readonly string[],
  ): void =>
    add(
      {
        season,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: value,
      },
      round,
      path,
    );
  const constructor = (value: string, round: number | null): void =>
    add(
      {
        season,
        source: 'jolpica',
        entity: 'constructor',
        providerField: 'constructorId',
        providerValue: value,
      },
      round,
    );
  const circuit = (value: string, round: number | null): void =>
    add(
      {
        season,
        source: 'jolpica',
        entity: 'circuit',
        providerField: 'circuitId',
        providerValue: value,
      },
      round,
    );
  const event = (r: {
    round: number;
    raceName: string;
    circuitId: string;
  }): void =>
    add(
      {
        season,
        source: 'jolpica',
        entity: 'event',
        providerField: 'eventLocator',
        providerValue: {
          round: r.round,
          raceName: r.raceName,
          circuitId: r.circuitId,
        },
      },
      r.round,
    );
  switch (input.endpointKind) {
    case 'season-drivers':
      if (input.decoded.ok)
        input.decoded.drivers.forEach((r, i) =>
          driver(r.driverId, null, [
            'MRData',
            'DriverTable',
            'Drivers',
            String(i),
          ]),
        );
      break;
    case 'season-constructors':
      if (input.decoded.ok)
        input.decoded.constructors.forEach((r) =>
          constructor(r.constructorId, null),
        );
      break;
    case 'season-circuits':
      if (input.decoded.ok)
        input.decoded.circuits.forEach((r) => circuit(r.circuitId, null));
      break;
    case 'season-calendar':
      if (input.decoded.ok)
        input.decoded.races.forEach((r) => {
          event(r);
          circuit(r.circuitId, r.round);
        });
      break;
    case 'race-results':
      if (input.decoded.ok && input.decoded.race !== null) {
        event(input.decoded.race);
        input.decoded.race.rows.forEach((r, i) => {
          driver(r.driverId, input.round, [
            'MRData',
            'RaceTable',
            'Races',
            '0',
            'Results',
            String(i),
            'Driver',
          ]);
          constructor(r.constructorId, input.round);
        });
      }
      break;
    case 'driver-standings':
      if (input.decoded.ok) {
        const { round, rows } = input.decoded;
        rows.forEach((r, i) => {
          driver(r.driverId, round, [
            'MRData',
            'StandingsTable',
            'StandingsLists',
            '0',
            'DriverStandings',
            String(i),
            'Driver',
          ]);
          r.constructorIds.forEach((id) => constructor(id, round));
        });
      }
      break;
    case 'constructor-standings':
      if (input.decoded.ok) {
        const { round, rows } = input.decoded;
        rows.forEach((r) => constructor(r.constructorId, round));
      }
  }
  return refs;
}
