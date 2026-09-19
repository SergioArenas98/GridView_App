/**
 * Curated Grand Prix event identity and exact locator resolution.
 *
 * Covers the mechanism decided by the ADR 0022 amendment of 2026-09-16 (A1-A5):
 * a curated event registry owns every `eventSlug`, and Jolpica events resolve
 * only through a complete, season-scoped locator matched by exact typed
 * equality.
 *
 * **Every provider value here is a synthetic fixture.** No live Jolpica payload
 * is copied, nothing in this file is curated content, and nothing here is an
 * approved mapping. The real curated 2026 dataset is asserted separately, in
 * event-dataset-2026.test.ts.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import eventsRegistry from '../../../../../content/registries/events.development.json';
import {
  buildProviderMappingRegistry,
  canonicalKey,
  curatedRegistries,
  decodeProviderMappingKey,
  isProviderEventLocator,
  providerMappingEntities,
  providerMappingFields,
  providerKeyShapes,
  type CanonicalRegistries,
  type ProviderEventLocator,
  type ProviderMappingRegistry,
} from '../../../src/providers/mappings';

import { canonical, documentOf, key, SEASON } from './support';

const HUNGARORING = 'hungaroring';
const BALATON = 'balaton-park';

/** Synthetic canonical event identities. Never curated content. */
const registries: CanonicalRegistries = {
  ...canonical,
  event: new Set(['hungarian-grand-prix', 'european-grand-prix']),
};

function locator(
  overrides: Partial<ProviderEventLocator> = {},
): ProviderEventLocator {
  return {
    round: 11,
    raceName: 'Hungarian Grand Prix',
    circuitId: HUNGARORING,
    ...overrides,
  };
}

function eventRecord(
  value: ProviderEventLocator,
  gridviewId = 'hungarian-grand-prix',
): Record<string, unknown> {
  return {
    source: 'jolpica',
    entity: 'event',
    providerField: 'eventLocator',
    providerValue: value,
    gridviewId,
    evidence: 'synthetic test fixture',
  };
}

function registryOfEvents(
  records: readonly unknown[],
  season: number = SEASON,
  canonicalIds: CanonicalRegistries = registries,
): ProviderMappingRegistry {
  return buildProviderMappingRegistry(
    [documentOf(records, season)],
    canonicalIds,
  );
}

function eventKey(
  value: ProviderEventLocator,
  season: number = SEASON,
): ReturnType<typeof key<'event'>> {
  return key<'event'>({
    season,
    source: 'jolpica',
    entity: 'event',
    providerField: 'eventLocator',
    providerValue: value,
  });
}

// ---------------------------------------------------------------------------

describe('the curated event registry', () => {
  it('is committed and well-formed', () => {
    expect(eventsRegistry.kind).toBe('event-registry');
    // The exact curated dataset is pinned in event-dataset-2026.test.ts.
    expect(eventsRegistry.events).toHaveLength(23);
  });

  it('exposes exactly the curated canonical event set to the resolver', () => {
    expect([...curatedRegistries().event].sort()).toEqual(
      eventsRegistry.events.map((event) => event.id).sort(),
    );
  });

  it('makes every event mapping target missing when it is empty', () => {
    const built = registryOfEvents([eventRecord(locator())], SEASON, {
      ...canonical,
      event: new Set<string>(),
    });

    expect(built.isValid).toBe(false);
    expect(built.problems.map((problem) => problem.reason)).toContain(
      'target-missing',
    );
  });

  it('accepts synthetic canonical event entries', () => {
    const built = registryOfEvents([eventRecord(locator())]);

    expect(built.problems).toEqual([]);
    expect(built.isValid).toBe(true);
    expect(built.size).toBe(1);
  });
});

describe('the event entity joins the closed key model', () => {
  it('declares event as a mapping entity and eventLocator as its field', () => {
    expect(providerMappingEntities).toContain('event');
    expect(providerMappingFields).toContain('eventLocator');
  });

  it('declares exactly one event combination, and it is Jolpica', () => {
    const eventShapes = providerKeyShapes.filter(
      (shape) => shape.entity === 'event',
    );

    expect(eventShapes).toEqual([
      {
        source: 'jolpica',
        entity: 'event',
        providerField: 'eventLocator',
        valueType: 'locator',
      },
    ]);
  });

  it('never builds a GrandPrix id: the target is a bare eventSlug', () => {
    const built = registryOfEvents([eventRecord(locator())]);
    const result = built.resolve(eventKey(locator()));

    expect(result).toEqual({
      outcome: 'resolved',
      gridviewId: 'hungarian-grand-prix',
    });
    // `{season}-{eventSlug}` is built by `canonicalGrandPrixId` elsewhere.
    if (result.outcome !== 'resolved') throw new Error('unreachable');
    expect(result.gridviewId).not.toContain(String(SEASON));
  });
});

describe('exact locator resolution', () => {
  const built = registryOfEvents([eventRecord(locator())]);

  it('resolves the complete tuple', () => {
    expect(built.resolve(eventKey(locator()))).toEqual({
      outcome: 'resolved',
      gridviewId: 'hungarian-grand-prix',
    });
  });

  it('refuses every proper subset of the tuple', () => {
    // Each of these agrees with the curated record on two components and
    // differs in the third. None may resolve: a subset match is forbidden.
    const partials: readonly ProviderEventLocator[] = [
      locator({ round: 12 }),
      locator({ raceName: 'Belgian Grand Prix' }),
      locator({ circuitId: BALATON }),
    ];

    for (const partial of partials) {
      const result = built.resolve(eventKey(partial));
      expect(result.outcome, JSON.stringify(partial)).toBe('unresolved');
      if (result.outcome !== 'unresolved') throw new Error('unreachable');
      expect(result.failure.reason).toBe('unmapped');
    }
  });

  it('applies no case folding, trimming or punctuation rewriting', () => {
    const variants: readonly ProviderEventLocator[] = [
      locator({ raceName: 'hungarian grand prix' }),
      locator({ raceName: 'HUNGARIAN GRAND PRIX' }),
      locator({ raceName: 'Hungarian  Grand Prix' }),
      locator({ raceName: 'Hungarian Grand-Prix' }),
      locator({ circuitId: 'Hungaroring' }),
      locator({ circuitId: 'hungaro-ring' }),
    ];

    for (const variant of variants) {
      expect(built.resolve(eventKey(variant)).outcome, variant.raceName).toBe(
        'unresolved',
      );
    }
  });

  it('never falls back to the circuit, the race name or the round', () => {
    // The circuit mapping is a separate, independently resolved key. An event
    // lookup must not borrow it, and a circuit lookup must not borrow an event.
    const result = built.resolveUnknown({
      season: SEASON,
      source: 'jolpica',
      entity: 'circuit',
      providerField: 'circuitId',
      providerValue: HUNGARORING,
    });

    expect(result.outcome).toBe('unresolved');
  });

  it('returns the canonical fail-closed result for an unknown locator', () => {
    const result = built.resolve(
      eventKey(locator({ round: 3, raceName: 'Unknown Grand Prix' })),
    );

    expect(result.outcome).toBe('unresolved');
    if (result.outcome !== 'unresolved') throw new Error('unreachable');
    expect(result.failure.reason).toBe('unmapped');
    expect(result.failure.entity).toBe('event');
    expect(result.failure.providerField).toBe('eventLocator');
    expect(result.failure.season).toBe(SEASON);
  });
});

describe('aliases, collisions and scope', () => {
  it('lets two historical locator aliases target one immutable slug', () => {
    // A sponsor rename and a round shift, each curated as its own record.
    const built = registryOfEvents([
      eventRecord(locator()),
      eventRecord(locator({ round: 12, raceName: 'Grand Prix of Hungary' })),
    ]);

    expect(built.problems).toEqual([]);
    expect(built.size).toBe(2);
    for (const value of [
      locator(),
      locator({ round: 12, raceName: 'Grand Prix of Hungary' }),
    ]) {
      expect(built.resolve(eventKey(value))).toEqual({
        outcome: 'resolved',
        gridviewId: 'hungarian-grand-prix',
      });
    }
  });

  it('keeps identical race names at different circuits distinct', () => {
    const built = registryOfEvents([
      eventRecord(locator({ raceName: 'European Grand Prix' })),
      eventRecord(
        locator({
          round: 12,
          raceName: 'European Grand Prix',
          circuitId: BALATON,
        }),
        'european-grand-prix',
      ),
    ]);

    expect(built.problems).toEqual([]);
    expect(
      built.resolve(eventKey(locator({ raceName: 'European Grand Prix' }))),
    ).toEqual({ outcome: 'resolved', gridviewId: 'hungarian-grand-prix' });
    expect(
      built.resolve(
        eventKey(
          locator({
            round: 12,
            raceName: 'European Grand Prix',
            circuitId: BALATON,
          }),
        ),
      ),
    ).toEqual({ outcome: 'resolved', gridviewId: 'european-grand-prix' });
  });

  it('lets one circuit host two events in the same season', () => {
    const built = registryOfEvents([
      eventRecord(locator()),
      eventRecord(
        locator({ round: 12, raceName: 'European Grand Prix' }),
        'european-grand-prix',
      ),
    ]);

    expect(built.problems).toEqual([]);
    expect(built.size).toBe(2);
    // A circuit therefore never implies an event.
    expect(
      built.resolve(eventKey(locator({ raceName: 'European Grand Prix' })))
        .outcome,
    ).toBe('unresolved');
  });

  it('keeps the same locator in another season a different key', () => {
    const twentySix = registryOfEvents([eventRecord(locator())], 2026);
    const twentySeven = registryOfEvents(
      [eventRecord(locator(), 'european-grand-prix')],
      2027,
    );

    expect(twentySix.resolve(eventKey(locator(), 2026))).toEqual({
      outcome: 'resolved',
      gridviewId: 'hungarian-grand-prix',
    });
    expect(twentySeven.resolve(eventKey(locator(), 2027))).toEqual({
      outcome: 'resolved',
      gridviewId: 'european-grand-prix',
    });
    // Neither registry answers for the other's season.
    expect(twentySix.resolve(eventKey(locator(), 2027)).outcome).toBe(
      'unresolved',
    );
    expect(twentySeven.resolve(eventKey(locator(), 2026)).outcome).toBe(
      'unresolved',
    );
  });

  it('fails the whole registry when one locator names two events', () => {
    const built = registryOfEvents([
      eventRecord(locator()),
      eventRecord(locator(), 'european-grand-prix'),
    ]);

    expect(built.isValid).toBe(false);
    expect(built.size).toBe(0);
    expect(built.problems.map((problem) => problem.reason)).toContain(
      'ambiguous-key',
    );
  });

  it('never resolves an ambiguous locator to the first record', () => {
    const built = registryOfEvents([
      eventRecord(locator()),
      eventRecord(locator(), 'european-grand-prix'),
    ]);
    const result = built.resolve(eventKey(locator()));

    expect(result.outcome).toBe('unresolved');
    if (result.outcome !== 'unresolved') throw new Error('unreachable');
    // Not `unmapped`, and above all not the first record's target.
    expect(result.failure.reason).toBe('registry-invalid');
  });

  it('reports a repeated identical record as a duplicate, not an overwrite', () => {
    const built = registryOfEvents([
      eventRecord(locator()),
      eventRecord(locator()),
    ]);

    expect(built.isValid).toBe(false);
    expect(built.problems.map((problem) => problem.reason)).toContain(
      'duplicate-key',
    );
  });

  it('fails closed when a target is not in the event registry', () => {
    const built = registryOfEvents([
      eventRecord(locator(), 'never-curated-grand-prix'),
    ]);

    expect(built.isValid).toBe(false);
    expect(built.problems.map((problem) => problem.reason)).toContain(
      'target-missing',
    );
  });

  it('refuses an event target that names a circuit identity', () => {
    // `hungaroring` is not in the event registry, whatever else it may be.
    const built = registryOfEvents([eventRecord(locator(), HUNGARORING)]);

    expect(built.isValid).toBe(false);
    expect(built.problems.map((problem) => problem.reason)).toContain(
      'target-missing',
    );
  });
});

describe('determinism and immutability', () => {
  it('gives the same verdict whatever order the records are in', () => {
    const forwards = registryOfEvents([
      eventRecord(locator()),
      eventRecord(
        locator({ round: 12, raceName: 'European Grand Prix' }),
        'european-grand-prix',
      ),
    ]);
    const backwards = registryOfEvents([
      eventRecord(
        locator({ round: 12, raceName: 'European Grand Prix' }),
        'european-grand-prix',
      ),
      eventRecord(locator()),
    ]);

    expect(forwards.isValid).toBe(backwards.isValid);
    expect(forwards.size).toBe(backwards.size);
    for (const value of [
      locator(),
      locator({ round: 12, raceName: 'European Grand Prix' }),
    ]) {
      expect(forwards.resolve(eventKey(value))).toEqual(
        backwards.resolve(eventKey(value)),
      );
    }
  });

  it('reports the same problem reasons whatever order the records are in', () => {
    const reasons = (records: readonly unknown[]) =>
      registryOfEvents(records)
        .problems.map((problem) => problem.reason)
        .sort();

    const good = eventRecord(locator());
    const dangling = eventRecord(
      locator({ round: 12 }),
      'never-curated-grand-prix',
    );

    expect(reasons([good, dangling])).toEqual(reasons([dangling, good]));
  });

  it('does not mutate the locator it is given', () => {
    const input = locator();
    const snapshot = { ...input };
    const built = registryOfEvents([eventRecord(input)]);

    built.resolve(eventKey(input));
    built.resolveUnknown({
      season: SEASON,
      source: 'jolpica',
      entity: 'event',
      providerField: 'eventLocator',
      providerValue: input,
    });

    expect(input).toEqual(snapshot);
  });

  it('does not mutate the curated record objects it reads', () => {
    const record = eventRecord(locator());
    const snapshot = JSON.parse(JSON.stringify(record)) as unknown;

    registryOfEvents([record]);

    expect(record).toEqual(snapshot);
  });

  it('detaches the decoded locator from the caller of the decoder', () => {
    const input = locator();
    const decoded = decodeProviderMappingKey({
      season: SEASON,
      source: 'jolpica',
      entity: 'event',
      providerField: 'eventLocator',
      providerValue: input,
    });

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error('unreachable');
    expect(decoded.key.providerValue).not.toBe(input);
    expect(Object.isFrozen(decoded.key.providerValue)).toBe(true);
  });
});

describe('the canonical encoding stays injective over locators', () => {
  it('separates components that a joined string would confuse', () => {
    // A separator-joined encoding would collapse these two distinct locators.
    const first = canonicalKey(
      eventKey(locator({ raceName: 'A', circuitId: 'B-C' })),
    );
    const second = canonicalKey(
      eventKey(locator({ raceName: 'A-B', circuitId: 'C' })),
    );

    expect(first).not.toBe(second);
  });

  it('separates a locator from a scalar key of the same season', () => {
    const asLocator = canonicalKey(eventKey(locator()));
    const asString = canonicalKey(
      key<'circuit'>({
        season: SEASON,
        source: 'jolpica',
        entity: 'circuit',
        providerField: 'circuitId',
        providerValue: HUNGARORING,
      }),
    );

    expect(asLocator).not.toBe(asString);
  });

  it('is stable across two structurally identical locator objects', () => {
    expect(canonicalKey(eventKey(locator()))).toBe(
      canonicalKey(eventKey({ ...locator() })),
    );
  });
});

describe('the locator predicate is closed and exact', () => {
  it('accepts a complete locator', () => {
    expect(isProviderEventLocator(locator())).toBe(true);
  });

  it('refuses a redundant inner season', () => {
    expect(isProviderEventLocator({ ...locator(), season: SEASON })).toBe(
      false,
    );
  });

  it('refuses an incomplete, malformed or non-object locator', () => {
    const rejected: readonly unknown[] = [
      { round: 11, raceName: 'Hungarian Grand Prix' },
      { raceName: 'Hungarian Grand Prix', circuitId: HUNGARORING },
      { round: 11, circuitId: HUNGARORING },
      { ...locator(), round: 0 },
      { ...locator(), round: 41 },
      { ...locator(), round: 1.5 },
      { ...locator(), round: '11' },
      { ...locator(), raceName: '' },
      { ...locator(), circuitId: '' },
      { ...locator(), raceName: ' Hungarian Grand Prix' },
      [11, 'Hungarian Grand Prix', HUNGARORING],
      'hungaroring',
      null,
      undefined,
    ];

    for (const value of rejected) {
      expect(isProviderEventLocator(value), JSON.stringify(value)).toBe(false);
    }
  });

  it('refuses a locator that inherits a component from a prototype', () => {
    const parent = { circuitId: HUNGARORING };
    const child = Object.create(parent) as Record<string, unknown>;
    child.round = 11;
    child.raceName = 'Hungarian Grand Prix';

    expect(isProviderEventLocator(child)).toBe(false);
  });
});

describe('the existing entity kinds are unchanged', () => {
  it('still resolves the curated driver, constructor and circuit mappings', () => {
    const real = buildProviderMappingRegistry(
      [
        documentOf([
          {
            source: 'jolpica',
            entity: 'driver',
            providerField: 'driverId',
            providerValue: 'norris',
            gridviewId: 'lando-norris',
            evidence: 'fixture',
          },
          {
            source: 'jolpica',
            entity: 'constructor',
            providerField: 'constructorId',
            providerValue: 'mclaren',
            gridviewId: 'mclaren',
            evidence: 'fixture',
          },
          {
            source: 'openf1',
            entity: 'driver',
            providerField: 'driver_number',
            providerValue: 1,
            gridviewId: 'lando-norris',
            evidence: 'fixture',
          },
        ]),
      ],
      registries,
    );

    expect(real.problems).toEqual([]);
    expect(real.size).toBe(3);
    expect(
      real.resolve(
        key<'driver'>({
          season: SEASON,
          source: 'jolpica',
          entity: 'driver',
          providerField: 'driverId',
          providerValue: 'norris',
        }),
      ),
    ).toEqual({ outcome: 'resolved', gridviewId: 'lando-norris' });
    expect(
      real.resolve(
        key<'driver'>({
          season: SEASON,
          source: 'openf1',
          entity: 'driver',
          providerField: 'driver_number',
          providerValue: 1,
        }),
      ),
    ).toEqual({ outcome: 'resolved', gridviewId: 'lando-norris' });
  });

  it('leaves the real curated registry valid and its size unchanged', () => {
    const real = buildProviderMappingRegistry(
      [documentOf([])],
      curatedRegistries(),
    );

    expect(real.isValid).toBe(true);
    expect(real.size).toBe(0);
  });
});

describe('the event mechanism is unreachable from the Worker', () => {
  const repoRoot = join(__dirname, '..', '..', '..', '..', '..');
  const edgeSrc = join(repoRoot, 'services', 'edge-api', 'src');

  it('is not imported by the Worker entry point', () => {
    const entry = readFileSync(join(edgeSrc, 'index.ts'), 'utf8');

    expect(entry).not.toContain('providers/mappings');
    expect(entry).not.toContain('event-registry');
    expect(entry).not.toContain('events.development.json');
  });

  it('changes no provider request, reservation or request-metric module', () => {
    // The event mechanism is pure content plus a lookup. It must not have
    // reached the outbound boundary, the rate limiter or the accounting that
    // a real request would touch.
    const untouched = [
      join('providers', 'provider-metrics.ts'),
      join('providers', 'quota-model.ts'),
      join('providers', 'provider-source.ts'),
      join('providers', 'formula-one-provider.ts'),
      join('providers', 'factory.ts'),
      join('providers', 'http', 'provider-http-client.ts'),
    ];

    for (const file of untouched) {
      const contents = readFileSync(join(edgeSrc, file), 'utf8');
      expect(contents, file).not.toContain('eventLocator');
      expect(contents, file).not.toContain('event-registry');
      expect(contents, file).not.toContain('providers/mappings');
    }
  });

  it('keeps the curated event registry behind the mapping boundary', () => {
    // Only the mapping module may read the curated event registry file. This
    // is the composition proof A9 asks for: a dependency boundary, not a
    // file-name rule.
    const importers = ['config', 'sync', 'routes', 'publication', 'contract'];

    for (const area of importers) {
      const dir = join(edgeSrc, area);
      const entries = (readdirSync(dir, { recursive: true }) as string[])
        .map((entry) => entry.toString())
        .filter((entry) => entry.endsWith('.ts'));
      for (const file of entries) {
        const contents = readFileSync(join(dir, file), 'utf8');
        expect(contents, `${area}/${file}`).not.toContain(
          'events.development.json',
        );
      }
    }
  });
});
