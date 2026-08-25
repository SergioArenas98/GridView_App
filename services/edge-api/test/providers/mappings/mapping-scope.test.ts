/**
 * Scope, isolation and the absence of heuristics.
 *
 * Required cases 11-24.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  decodeProviderMappingKey,
  providerMappingSources,
} from '../../../src/providers/mappings';

import { key, realRegistry, registryOf, SEASON } from './support';

const registry = realRegistry();

const unresolved = <T extends { outcome: string }>(result: T) => {
  expect(result.outcome).toBe('unresolved');
};

describe('scope and isolation', () => {
  // Case 11
  it('lets the same driver number map differently in different seasons', () => {
    const twentySix = registryOf(
      [
        {
          source: 'openf1',
          entity: 'driver',
          providerField: 'driver_number',
          providerValue: 1,
          gridviewId: 'lando-norris',
          evidence: 'fixture',
        },
      ],
      2026,
    );
    const twentySeven = registryOf(
      [
        {
          source: 'openf1',
          entity: 'driver',
          providerField: 'driver_number',
          providerValue: 1,
          gridviewId: 'max-verstappen',
          evidence: 'fixture',
        },
      ],
      2027,
    );

    const lookup = (season: number) =>
      key<'driver'>({
        season,
        source: 'openf1',
        entity: 'driver',
        providerField: 'driver_number',
        providerValue: 1,
      });

    expect(twentySix.resolve(lookup(2026))).toEqual({
      outcome: 'resolved',
      gridviewId: 'lando-norris',
    });
    expect(twentySeven.resolve(lookup(2027))).toEqual({
      outcome: 'resolved',
      gridviewId: 'max-verstappen',
    });
  });

  // Case 12
  it('does not resolve a 2026 mapping in 2027', () => {
    unresolved(
      registry.resolve(
        key<'driver'>({
          season: 2027,
          source: 'jolpica',
          entity: 'driver',
          providerField: 'driverId',
          providerValue: 'norris',
        }),
      ),
    );
    unresolved(
      registry.resolve(
        key<'driver'>({
          season: 2027,
          source: 'openf1',
          entity: 'driver',
          providerField: 'driver_number',
          providerValue: 1,
        }),
      ),
    );
  });

  // Case 13
  it('does not cross-resolve Jolpica and OpenF1 values', () => {
    // `mercedes` is a curated Jolpica constructorId, never an OpenF1 team_name.
    unresolved(
      registry.resolve(
        key<'constructor'>({
          season: SEASON,
          source: 'openf1',
          entity: 'constructor',
          providerField: 'team_name',
          providerValue: 'mercedes',
        }),
      ),
    );
    // And `Mercedes` is a curated OpenF1 team_name, never a Jolpica slug.
    unresolved(
      registry.resolve(
        key<'constructor'>({
          season: SEASON,
          source: 'jolpica',
          entity: 'constructor',
          providerField: 'constructorId',
          providerValue: 'Mercedes',
        }),
      ),
    );
  });

  // Case 14
  it('does not cross-resolve driver, constructor and circuit namespaces', () => {
    // A constructor value looked up as a driver, and the reverse.
    unresolved(
      registry.resolve(
        key<'driver'>({
          season: SEASON,
          source: 'jolpica',
          entity: 'driver',
          providerField: 'driverId',
          providerValue: 'mclaren',
        }),
      ),
    );
    unresolved(
      registry.resolve(
        key<'constructor'>({
          season: SEASON,
          source: 'jolpica',
          entity: 'constructor',
          providerField: 'constructorId',
          providerValue: 'norris',
        }),
      ),
    );
    unresolved(
      registry.resolve(
        key<'circuit'>({
          season: SEASON,
          source: 'jolpica',
          entity: 'circuit',
          providerField: 'circuitId',
          providerValue: 'mclaren',
        }),
      ),
    );

    // Identical text under two entity kinds stays two separate identities.
    const shared = registryOf([
      {
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue: 'Ferrari',
        gridviewId: 'ferrari',
        evidence: 'fixture',
      },
    ]);
    expect(
      shared.resolve(
        key<'constructor'>({
          season: SEASON,
          source: 'openf1',
          entity: 'constructor',
          providerField: 'team_name',
          providerValue: 'Ferrari',
        }),
      ).outcome,
    ).toBe('resolved');
  });

  // Case 15
  it('does not cross-resolve provider field names', () => {
    // The union makes a Jolpica `driver_number` unrepresentable, so the test
    // goes through the untrusted decoder, which is the only way such a value
    // could ever arrive.
    expect(
      decodeProviderMappingKey({
        season: SEASON,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driver_number',
        providerValue: 1,
      }),
    ).toBeNull();
    expect(
      decodeProviderMappingKey({
        season: SEASON,
        source: 'openf1',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'norris',
      }),
    ).toBeNull();
    // A real field on the wrong entity kind is equally not a key.
    expect(
      decodeProviderMappingKey({
        season: SEASON,
        source: 'jolpica',
        entity: 'constructor',
        providerField: 'circuitId',
        providerValue: 'mclaren',
      }),
    ).toBeNull();
  });

  // Case 16
  it('rejects the mock source in the key type and in the decoder', () => {
    // The mock provider emits GridView-owned identities, so `mock` is not a
    // member of the mapping-source union at all.
    expect(providerMappingSources).toEqual(['jolpica', 'openf1']);
    expect(providerMappingSources as readonly string[]).not.toContain('mock');

    expect(
      decodeProviderMappingKey({
        season: SEASON,
        source: 'mock',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'mock-drv-001',
      }),
    ).toBeNull();

    // And a curated file naming it cannot build an index.
    const mockRegistry = registryOf([
      {
        source: 'mock',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'mock-drv-001',
        gridviewId: 'max-verstappen',
        evidence: 'fixture',
      },
    ]);
    expect(mockRegistry.isValid).toBe(false);
  });

  // Case 17
  it('never lets numeric 1 resolve string "1"', () => {
    const numeric = registryOf([
      {
        source: 'openf1',
        entity: 'driver',
        providerField: 'driver_number',
        providerValue: 1,
        gridviewId: 'lando-norris',
        evidence: 'fixture',
      },
    ]);

    expect(
      numeric.resolve(
        key<'driver'>({
          season: SEASON,
          source: 'openf1',
          entity: 'driver',
          providerField: 'driver_number',
          providerValue: 1,
        }),
      ).outcome,
    ).toBe('resolved');

    // The string form is not even a decodable key for this field...
    expect(
      decodeProviderMappingKey({
        season: SEASON,
        source: 'openf1',
        entity: 'driver',
        providerField: 'driver_number',
        providerValue: '1',
      }),
    ).toBeNull();
    // ...and nothing coerces it on the way through the untrusted entry point.
    expect(
      numeric.resolveUnknown({
        season: SEASON,
        source: 'openf1',
        entity: 'driver',
        providerField: 'driver_number',
        providerValue: '1',
      }),
    ).toBeNull();
  });
});

describe('no heuristic ever runs during resolution', () => {
  const teamName = (providerValue: string) =>
    registry.resolve(
      key<'constructor'>({
        season: SEASON,
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue,
      }),
    );

  const jolpicaDriver = (providerValue: string) =>
    registry.resolve(
      key<'driver'>({
        season: SEASON,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue,
      }),
    );

  // Case 18
  it('leaves a case variation unmapped', () => {
    expect(teamName('Mercedes').outcome).toBe('resolved');
    for (const variant of ['mercedes', 'MERCEDES', 'MeRcEdEs']) {
      unresolved(teamName(variant));
    }
    expect(teamName('Red Bull Racing').outcome).toBe('resolved');
    for (const variant of ['red bull racing', 'RED BULL RACING']) {
      unresolved(teamName(variant));
    }
  });

  // Case 19
  it('leaves leading or trailing whitespace unmapped', () => {
    for (const variant of [
      ' Mercedes',
      'Mercedes ',
      '  Mercedes  ',
      '\tMercedes',
      'Mercedes\n',
    ]) {
      unresolved(teamName(variant));
    }
    unresolved(jolpicaDriver(' norris'));
    unresolved(jolpicaDriver('norris '));
  });

  // Case 20
  it('leaves a display-name lookalike unmapped', () => {
    // The GridView constructor's own display name is not a provider key.
    for (const displayName of ['Red Bull', 'McLaren', 'Alpine F1 Team']) {
      unresolved(teamName(displayName));
    }
    // Nor is the GridView public ID itself.
    unresolved(teamName('red-bull'));
    unresolved(jolpicaDriver('lando-norris'));
  });

  // Case 21
  it('leaves a substring, prefix or suffix unmapped', () => {
    for (const variant of [
      'Merc',
      'Mercedes-AMG',
      'AMG Mercedes',
      'Red Bull Racing Honda',
      'Racing',
    ]) {
      unresolved(teamName(variant));
    }
    for (const variant of ['nor', 'norr', 'norrisx', 'lnorris']) {
      unresolved(jolpicaDriver(variant));
    }
  });

  // Case 22
  it('leaves punctuation and transliteration variations unmapped', () => {
    for (const variant of [
      'Red-Bull Racing',
      'Red_Bull_Racing',
      'RedBullRacing',
      'Red Bull  Racing',
      'Mércèdes',
      'Mercedes.',
    ]) {
      unresolved(teamName(variant));
    }
    // The Jolpica circuit slug uses an underscore; the hyphenated GridView
    // form is not an accepted alternative spelling of it.
    unresolved(
      registry.resolve(
        key<'circuit'>({
          season: SEASON,
          source: 'jolpica',
          entity: 'circuit',
          providerField: 'circuitId',
          providerValue: 'albert-park',
        }),
      ),
    );
  });

  /**
   * Cases 23 and 24.
   *
   * The behavioural tests above prove no normalization happens. This one is
   * structural: it proves the resolution modules contain no normalizing
   * primitive at all, so a future edit cannot quietly reintroduce one.
   */
  it('contains no normalizer, slug generator or similarity matcher', () => {
    const mappingDir = join(
      __dirname,
      '..',
      '..',
      '..',
      'src',
      'providers',
      'mappings',
    );
    const files = readdirSync(mappingDir).filter((name) =>
      name.endsWith('.ts'),
    );
    expect(files.length).toBeGreaterThan(0);

    const forbidden: readonly [RegExp, string][] = [
      [/\.toLowerCase\s*\(/, 'case folding'],
      [/\.toUpperCase\s*\(/, 'case folding'],
      [/\.toLocaleLowerCase\s*\(/, 'case folding'],
      [/\.normalize\s*\(/, 'Unicode normalization'],
      [/\.startsWith\s*\(/, 'prefix matching'],
      [/\.endsWith\s*\(/, 'suffix matching'],
      [/\.includes\s*\(/, 'substring matching'],
      [/\.indexOf\s*\(/, 'substring matching'],
      [/levenshtein/i, 'fuzzy matching'],
      [/\bsimilarity\b/i, 'fuzzy matching'],
      [/\bslugify\b/i, 'slug generation'],
      [/\bparseInt\b/, 'numeric coercion'],
      [/\bparseFloat\b/, 'numeric coercion'],
      [/\bNumber\s*\(/, 'numeric coercion'],
      [/as unknown as/, 'a typing bypass'],
    ];

    for (const file of files) {
      const contents = readFileSync(join(mappingDir, file), 'utf8');
      // Strip block and line comments: prose may legitimately name the very
      // techniques the code must not perform.
      const code = contents
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const [pattern, label] of forbidden) {
        expect(
          pattern.test(code),
          `${file} must not perform ${label} (${pattern})`,
        ).toBe(false);
      }
    }
  });

  it('trims only to reject, never to look up', () => {
    // `isProviderStringValue` compares against `trim()` to *reject* padded
    // curated data. Nothing trims a value and then retries the lookup.
    const padded = registryOf([
      {
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue: ' Alpine ',
        gridviewId: 'alpine',
        evidence: 'fixture',
      },
    ]);
    expect(padded.isValid).toBe(false);
    expect(padded.problems[0]?.reason).toBe('invalid-key-combination');
  });
});
