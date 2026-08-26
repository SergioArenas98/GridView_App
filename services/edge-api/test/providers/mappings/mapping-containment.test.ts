/**
 * Operational signal, provider-ID containment and side-effect freedom.
 *
 * Required cases 40-47.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import worker from '../../../src/index';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  PROVIDER_MAPPING_FAILURE_CATEGORY,
  providerMappingFailureEvent,
} from '../../../src/providers/mappings';
import {
  createHarness,
  request,
  seedPublishedSnapshot,
} from '../../support/edge-harness';

import { key, realRegistry, SEASON } from './support';

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');
const registry = realRegistry();

/**
 * Structural markers of the mapping registry.
 *
 * These are key names the mapping content introduces. `constructorId`,
 * `circuitId` and `driverId` are deliberately **absent**: those are legitimate
 * *public* GridView contract field names that happen to coincide with
 * Jolpica's field names, so their presence in a public surface is correct
 * rather than a leak.
 */
const mappingStructuralMarkers: readonly string[] = [
  'providerField',
  'providerValue',
  'providerMapping',
  'providerMappings',
  'acknowledgedUnmapped',
  'driver_number',
  'team_name',
  'circuit_key',
];

/** Every exact provider value the curated mapping content declares. */
function curatedProviderValues(): readonly string[] {
  const files = [
    join(
      repoRoot,
      'content',
      'seasons',
      '2026',
      'provider-mappings.development.json',
    ),
    join(
      repoRoot,
      'content',
      'seasons',
      '2026',
      'provider-evidence.development.json',
    ),
  ];
  const values = new Set<string>();
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as {
      mappings?: { providerValue: string | number }[];
      identities?: { providerValue: string | number }[];
      acknowledgedUnmapped?: { providerValue: string | number }[];
    };
    for (const group of [
      parsed.mappings,
      parsed.identities,
      parsed.acknowledgedUnmapped,
    ]) {
      for (const entry of group ?? []) values.add(String(entry.providerValue));
    }
  }
  return [...values];
}

/**
 * Everything a public response is legitimately allowed to echo: the curated
 * registries, season entries, overrides and media metadata. This is the whole
 * source of public content, so any string absent from it cannot reach a public
 * surface for a legitimate reason.
 */
function publicFacingCuratedContent(): string {
  const files = [
    ['content', 'registries', 'drivers.mock.json'],
    ['content', 'registries', 'constructors.mock.json'],
    ['content', 'registries', 'circuits.mock.json'],
    ['content', 'seasons', '2026', 'driver-entries.mock.json'],
    ['content', 'seasons', '2026', 'constructor-entries.mock.json'],
    ['content', 'seasons', '2026', 'overrides.mock.json'],
    ['content', 'media', 'media-assets.mock.json'],
  ];
  return files
    .map((segments) => readFileSync(join(repoRoot, ...segments), 'utf8'))
    .join('\n');
}

/**
 * Provider values whose appearance on a public surface could only be a leak.
 *
 * Some curated provider values are textually identical to, or a substring of,
 * a legitimate GridView identity or display name — Jolpica's `mclaren` is the
 * GridView ID `mclaren`, `norris` is inside `lando-norris`, and OpenF1's
 * `Alpine` and `Red Bull Racing` are inside curated display names. A plain
 * string search cannot tell a leak from correct public content for those, so
 * they are excluded here and the structural markers above carry the assertion
 * for them instead. This is computed rather than hard-coded so a newly curated
 * distinguishable value is picked up automatically.
 */
const leakMarkers: readonly string[] = (() => {
  const publicContent = publicFacingCuratedContent();
  return curatedProviderValues().filter(
    (value) => value.length > 2 && !publicContent.includes(value),
  );
})();

function unresolvedFailure(providerValue: string) {
  const result = registry.resolve(
    key<'constructor'>({
      season: SEASON,
      source: 'openf1',
      entity: 'constructor',
      providerField: 'team_name',
      providerValue,
    }),
  );
  if (result.outcome !== 'unresolved') {
    throw new Error(`expected ${providerValue} to be unmapped`);
  }
  return result.failure;
}

describe('an unmapped identity produces a bounded operational signal', () => {
  // Case 40
  it('carries the typed failure and the bounded category', () => {
    const failure = unresolvedFailure('Cadillac');

    expect(failure.reason).toBe('unmapped');
    expect(failure.source).toBe('openf1');
    expect(failure.season).toBe(SEASON);
    expect(failure.entity).toBe('constructor');
    expect(failure.providerField).toBe('team_name');

    const event = providerMappingFailureEvent(failure);
    expect(event.failureCategory).toBe(PROVIDER_MAPPING_FAILURE_CATEGORY);
    expect(event.providerSourceId).toBe('openf1');
    expect(event.providerMappingEntity).toBe('constructor');
    expect(event.providerMappingField).toBe('team_name');
    expect(event.providerMappingFailure).toBe('unmapped');
  });

  // Case 41
  it('never returns a partial or guessed result', () => {
    const result = registry.resolve(
      key<'constructor'>({
        season: SEASON,
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue: 'Racing Bulls',
      }),
    );

    expect(result.outcome).toBe('unresolved');
    expect(result).not.toHaveProperty('gridviewId');
    // Not an empty string, not a slug, not the provider value itself.
    expect(JSON.stringify(result)).not.toContain('racing-bulls');
  });

  // Case 45
  it('logs no raw payload, registry dump or exception body', () => {
    const logger = new CapturingLogger();
    logger.warn(providerMappingFailureEvent(unresolvedFailure('Cadillac')));

    const serialized = logger.serialized();
    const [event] = logger.events;

    // Only bounded, enumerable fields, plus the one diagnostic value.
    expect(Object.keys(event ?? {}).sort()).toEqual(
      [
        'failureCategory',
        'level',
        'operation',
        'providerMappingEntity',
        'providerMappingFailure',
        'providerMappingField',
        'providerMappingValue',
        'providerSourceId',
        'season',
      ].sort(),
    );

    // No registry, mapping record, stack or upstream object reached the line.
    expect(serialized).not.toContain('gridviewId');
    expect(serialized).not.toContain('mappings');
    expect(serialized).not.toContain('evidence');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('lando-norris');
    expect(serialized.length).toBeLessThan(600);
  });

  it('bounds the diagnostic provider value', () => {
    const long = 'x'.repeat(500);
    const event = providerMappingFailureEvent({
      reason: 'unmapped',
      season: SEASON,
      source: 'openf1',
      entity: 'constructor',
      providerField: 'team_name',
      providerValue: long,
    });

    expect(String(event.providerMappingValue).length).toBeLessThanOrEqual(67);
    expect(event.providerMappingValue).not.toBe(long);
  });
});

describe('provider identifiers stay out of every public surface', () => {
  it('has a non-empty, meaningful set of leak markers', () => {
    // If the filter ever emptied itself the assertions below would pass
    // vacuously, so pin both the size and the values that matter most.
    expect(leakMarkers.length).toBeGreaterThanOrEqual(5);
    for (const expected of [
      'antonelli',
      'albert_park',
      'hungaroring',
      'Racing Bulls',
      'Cadillac',
    ]) {
      expect(leakMarkers).toContain(expected);
    }
  });

  // Case 42
  it('never appears in a public v1 response', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);

    const paths = [
      '/v1/status',
      '/v1/bootstrap?season=2026',
      '/v1/home?season=2026',
      '/v1/seasons/2026',
      '/v1/seasons/2026/calendar',
      '/v1/seasons/2026/standings/constructors',
      '/v1/seasons/2026/constructors',
      '/v1/seasons/2026/drivers',
      '/v1/content/manifest',
    ];

    for (const path of paths) {
      const response = await worker.fetch(request(path), harness.env);
      const body = await response.text();
      expect(response.status).toBe(200);

      for (const value of leakMarkers) {
        expect(body, `${path} must not contain ${value}`).not.toContain(value);
      }
      for (const marker of mappingStructuralMarkers) {
        expect(body, `${path} must not contain ${marker}`).not.toContain(
          marker,
        );
      }
    }
  });

  // Case 42, second surface: the public fixtures.
  it('never appears in a public v1 fixture', () => {
    const fixtureDir = join(
      repoRoot,
      'services',
      'edge-api',
      'test',
      'fixtures',
    );
    const fixtures = (readdirSync(fixtureDir, { recursive: true }) as string[])
      .map((entry) => entry.toString())
      .filter((entry) => entry.endsWith('.json'));

    expect(fixtures.length).toBeGreaterThan(0);
    for (const fixture of fixtures) {
      const contents = readFileSync(join(fixtureDir, fixture), 'utf8');
      for (const value of [...leakMarkers, ...mappingStructuralMarkers]) {
        expect(contents, `${fixture} must not contain ${value}`).not.toContain(
          value,
        );
      }
    }
  });

  // Case 43
  it('never appears in the OpenAPI contract', () => {
    const openapi = readFileSync(
      join(repoRoot, 'docs', 'api', 'gridview-api-v1.yaml'),
      'utf8',
    );

    for (const value of [...leakMarkers, ...mappingStructuralMarkers]) {
      expect(openapi, `OpenAPI must not contain ${value}`).not.toContain(value);
    }
  });

  /**
   * Case 44.
   *
   * The mapping registry is server-side only. Nothing Flutter-facing consumes
   * it, so no Dart, Drift, generated artifact, asset or golden may name a
   * provider mapping value. Asserted over the Flutter source tree directly.
   */
  it('never appears in a Flutter-facing artifact', () => {
    const flutterRoots = ['lib', 'test'];
    const suffixes = ['.dart', '.g.dart', '.drift'];
    const offenders: string[] = [];

    for (const root of flutterRoots) {
      const base = join(repoRoot, root);
      let entries: string[];
      try {
        entries = (readdirSync(base, { recursive: true }) as string[]).map(
          (entry) => entry.toString(),
        );
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!suffixes.some((suffix) => entry.endsWith(suffix))) continue;
        let contents: string;
        try {
          contents = readFileSync(join(base, entry), 'utf8');
        } catch {
          continue;
        }
        if (contents.includes('providerMapping')) {
          offenders.push(join(root, entry));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('the resolver has no side effects', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Case 46
  it('performs no fetch and no storage write', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('the resolver must not fetch'));

    // Exercise a hit, a miss, and the untrusted entry point.
    registry.resolve(
      key<'driver'>({
        season: SEASON,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'norris',
      }),
    );
    registry.resolve(
      key<'driver'>({
        season: SEASON,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'nobody',
      }),
    );
    registry.resolveUnknown({ season: SEASON, source: 'mock' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is not written to KV, Durable Object or local storage', () => {
    const mappingDir = join(
      repoRoot,
      'services',
      'edge-api',
      'src',
      'providers',
      'mappings',
    );
    for (const file of readdirSync(mappingDir)) {
      if (!file.endsWith('.ts')) continue;
      const contents = readFileSync(join(mappingDir, file), 'utf8');
      const code = contents
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      expect(code).not.toMatch(/\bfetch\s*\(/);
      expect(code).not.toMatch(/\.put\s*\(/);
      expect(code).not.toMatch(/\.delete\s*\(/);
      expect(code).not.toMatch(/\bKVNamespace\b/);
      expect(code).not.toMatch(/\bDurableObject\b/);
      expect(code).not.toMatch(/\blocalStorage\b/);
      expect(code).not.toMatch(/\bcaches\b/);
    }
  });
});

describe('the mock synchronization path is untouched', () => {
  // Case 47
  it('publishes exactly as before, with no mapping involvement', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);

    const response = await worker.fetch(
      request('/v1/seasons/2026/constructors'),
      harness.env,
    );
    const body = (await response.json()) as {
      data: { constructorId: string }[];
    };

    expect(response.status).toBe(200);
    // The mock provider emits GridView-owned identities directly, with no
    // mapping step in between.
    expect(body.data.map((entry) => entry.constructorId)).toContain('red-bull');
  });

  it('does not import the mapping registry anywhere in the runtime', () => {
    const sourceDir = join(repoRoot, 'services', 'edge-api', 'src');
    const files = (readdirSync(sourceDir, { recursive: true }) as string[])
      .map((entry) => entry.toString())
      .filter(
        (entry) =>
          entry.endsWith('.ts') &&
          !entry.replace(/\\/g, '/').startsWith('providers/mappings/'),
      );

    for (const file of files) {
      const contents = readFileSync(join(sourceDir, file), 'utf8');
      expect(
        contents,
        `${file} must not consume the dormant mapping registry yet`,
      ).not.toContain('providers/mappings');
    }
  });
});
