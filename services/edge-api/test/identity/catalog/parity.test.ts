import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { catalogIndexes } from '../../../src/identity/catalog/indexes';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import { curatedParticipants } from '../../../src/providers/jolpica/curated-participants';
import { curatedCircuits } from '../../../src/providers/jolpica/curated-circuits';
import { curatedEventNames } from '../../../src/providers/jolpica/curated-events';
import {
  normalizeSeasonDrivers,
  normalizeSeasonConstructors,
} from '../../../src/providers/jolpica/participants-normalizer';
import { normalizeRaceResults } from '../../../src/providers/jolpica/results-normalizer';
import {
  normalizeDriverStandings,
  normalizeConstructorStandings,
} from '../../../src/providers/jolpica/standings-normalizer';
import { normalizeSeasonCircuits } from '../../../src/providers/jolpica/circuits-normalizer';
import { normalizeSeasonCalendar } from '../../../src/providers/jolpica/calendar-normalizer';
import { decodeSeasonCalendar } from '../../../src/providers/jolpica/calendar-payload';
import {
  envelope,
  race,
  standardWeekend,
} from '../../providers/jolpica/support';
import { fixtures, forbidNetwork } from '../discovery/support';
import type { DecodedJolpicaResource } from '../../../src/identity/discovery/model';
import type { SeedArtifact } from '../../../src/identity/catalog/model';
import type { ProviderMappingKey } from '../../../src/providers/mappings/mapping-key';
import { MockFormulaOneProvider } from '../../../src/providers/mock/mock-provider';
import { generateSnapshotSet } from '../../../src/snapshots/generator';
let seed: SeedArtifact, catalog: Awaited<ReturnType<typeof catalogIndexes>>;
const old = {
  registry: providerMappingRegistry(),
  participants: curatedParticipants(),
  circuits: curatedCircuits(),
  events: curatedEventNames(),
};
beforeAll(async () => {
  seed = await prepareSeed(loadCorpus('p0'));
  catalog = await catalogIndexes(seed);
});
beforeEach(forbidNetwork);
afterEach(() => vi.unstubAllGlobals());
function normalize(i: DecodedJolpicaResource, c: typeof old): unknown {
  if (!i.decoded.ok) return i.decoded;
  switch (i.endpointKind) {
    case 'season-drivers':
      return i.decoded.ok
        ? normalizeSeasonDrivers(
            i.decoded.drivers,
            2026,
            c.registry,
            c.participants,
          )
        : i.decoded;
    case 'season-constructors':
      return i.decoded.ok
        ? normalizeSeasonConstructors(
            i.decoded.constructors,
            2026,
            c.registry,
            c.participants,
          )
        : i.decoded;
    case 'season-circuits':
      return i.decoded.ok
        ? normalizeSeasonCircuits(
            i.decoded.circuits,
            2026,
            c.registry,
            c.circuits,
          )
        : i.decoded;
    case 'season-calendar':
      return i.decoded.ok
        ? normalizeSeasonCalendar(i.decoded.races, 2026, c.registry, c.events)
        : i.decoded;
    case 'race-results':
      return i.decoded.ok && i.decoded.race
        ? normalizeRaceResults(i.decoded.race, 2026, c.registry)
        : i.decoded;
    case 'driver-standings':
      return i.decoded.ok
        ? normalizeDriverStandings(i.decoded.rows, 2026, c.registry)
        : i.decoded;
    case 'constructor-standings':
      return i.decoded.ok
        ? normalizeConstructorStandings(i.decoded.rows, 2026, c.registry)
        : i.decoded;
  }
}
describe('R0 exact bundled parity', () => {
  it('preserves every target, profile field, non-driver registry and acknowledgement', () => {
    for (const b of seed.snapshot.bindings) {
      expect(catalog.registry.resolve(b.key)).toEqual(
        old.registry.resolve(b.key),
      );
      expect(catalog.registry.resolve(b.key)).toMatchObject({
        outcome: 'resolved',
        gridviewId: b.targetId,
      });
    }
    for (const d of seed.snapshot.drivers)
      expect(catalog.participants.driverById(d.anchor.driverId)).toEqual(
        old.participants.driverById(d.anchor.driverId),
      );
    for (const c of seed.snapshot.constructors)
      expect(catalog.participants.constructorById(c.id)).toEqual(
        old.participants.constructorById(c.id),
      );
    for (const c of seed.snapshot.circuits)
      expect(catalog.circuits.get(c.id)).toEqual(old.circuits.get(c.id));
    expect(catalog.events).toEqual(old.events);
    for (const u of seed.snapshot.unresolved) {
      expect(catalog.registry.resolve(u.key)).toEqual(
        old.registry.resolve(u.key),
      );
      expect(catalog.registry.resolve(u.key)).toMatchObject({
        outcome: 'unresolved',
        failure: { reason: 'unmapped' },
      });
    }
  });
  it('preserves typed values, providers, seasons and invalid/unknown failures for every binding', () => {
    for (const b of seed.snapshot.bindings)
      for (const changed of [
        { ...b.key, season: 2027 },
        {
          ...b.key,
          providerValue:
            typeof b.key.providerValue === 'number'
              ? String(b.key.providerValue)
              : 99,
        },
        { ...b.key, source: b.key.source === 'jolpica' ? 'openf1' : 'jolpica' },
        { ...b.key, providerValue: 'synthetic-unknown' },
      ]) {
        const k = changed as ProviderMappingKey;
        expect(catalog.registry.resolve(k)).toEqual(old.registry.resolve(k));
        expect(catalog.registry.resolve(k).outcome).toBe('unresolved');
      }
  });
  it.each(fixtures().map((f) => [f.input.endpointKind, f.input] as const))(
    'preserves %s normalized success/failure',
    (_, input) => {
      expect(normalize(input, catalog)).toEqual(normalize(input, old));
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it('normalizes the complete known driver, constructor and circuit inventories and a valid calendar', () => {
    const keys = seed.snapshot.bindings.filter(
      (b) => b.key.source === 'jolpica',
    );
    const drivers = keys
      .filter((b) => b.key.entity === 'driver')
      .map((b) => ({ driverId: b.key.providerValue as string }));
    const constructors = keys
      .filter((b) => b.key.entity === 'constructor')
      .map((b) => ({ constructorId: b.key.providerValue as string }));
    const circuits = keys
      .filter((b) => b.key.entity === 'circuit')
      .map((b) => ({ circuitId: b.key.providerValue as string }));
    expect(
      normalizeSeasonDrivers(
        drivers,
        2026,
        catalog.registry,
        catalog.participants,
      ),
    ).toEqual(
      normalizeSeasonDrivers(drivers, 2026, old.registry, old.participants),
    );
    expect(
      normalizeSeasonConstructors(
        constructors,
        2026,
        catalog.registry,
        catalog.participants,
      ),
    ).toEqual(
      normalizeSeasonConstructors(
        constructors,
        2026,
        old.registry,
        old.participants,
      ),
    );
    expect(
      normalizeSeasonCircuits(
        circuits,
        2026,
        catalog.registry,
        catalog.circuits,
      ),
    ).toEqual(
      normalizeSeasonCircuits(circuits, 2026, old.registry, old.circuits),
    );
    const decoded = decodeSeasonCalendar(
      envelope([race(standardWeekend)]),
      2026,
      100,
    );
    expect(decoded.ok).toBe(true);
    const input: DecodedJolpicaResource = {
      endpointKind: 'season-calendar',
      season: 2026,
      requestedLimit: 100,
      decoded,
    };
    expect(normalize(input, catalog)).toEqual(normalize(input, old));
  });
  it('generates identical documents from the same representative season with either profile context', async () => {
    const now = '2026-11-14T12:00:00.000Z';
    const source = await new MockFormulaOneProvider({
      clock: { now: () => new Date(now) },
      contentVersion: '2026.10.07.1',
    }).fetchSeasonSource(2026, [
      'profiles',
      'season-calendar',
      'standings',
      'results',
    ]);
    const withProfiles = (c: typeof old) => ({
      ...source,
      drivers: source.drivers.map((d) => ({
        ...c.participants.driverById(d.id)!,
        media: null,
      })),
      constructors: source.constructors.map((d) => ({
        ...c.participants.constructorById(d.id)!,
        media: null,
      })),
      circuits: source.circuits.map((d) => ({
        ...c.circuits.get(d.id)!,
        media: null,
      })),
    });
    expect(
      generateSnapshotSet(withProfiles(catalog), now, 'synthetic-release'),
    ).toEqual(generateSnapshotSet(withProfiles(old), now, 'synthetic-release'));
    expect(fetch).not.toHaveBeenCalled();
  });
  it('admits the U6 runtime reader without importing administrative or durable write authority', async () => {
    const graph = await build({
      absWorkingDir: resolve(import.meta.dirname, '../../..'),
      entryPoints: ['src/sync/coordinated/composition.ts'],
      bundle: true,
      write: false,
      metafile: true,
      format: 'esm',
    });
    const inputs = Object.keys(graph.metafile!.inputs).map((p) =>
      p.replaceAll('\\', '/'),
    );
    expect(inputs).toContain('src/identity/catalog/run-context.ts');
    expect(
      inputs.filter((p) =>
        /identity\/(admin|durable-object)|identity\/catalog\/(pin|workflow|repository|revision-store|admin-workflow)\.ts$/.test(
          p,
        ),
      ),
    ).toEqual([]);
  });
});
