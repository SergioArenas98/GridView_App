import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { canonicalJson } from '../../../src/ingest/canonical-json';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import {
  hashIdentityProjection,
  identityHash,
} from '../../../src/identity/discovery/keys';
import { exportSeed, importSeed } from '../../../src/identity/catalog/export';
import { validateSeed } from '../../../src/identity/catalog/validate';
import { forbidNetwork } from '../discovery/support';
import type {
  Document,
  RepositorySource,
  SeedArtifact,
} from '../../../src/identity/catalog/model';
import {
  hashSeasonProjection,
  seasonProjection,
} from '../../../src/identity/catalog/projection';

let seed: SeedArtifact;
beforeAll(async () => {
  seed = await prepareSeed(loadCorpus());
});
beforeEach(forbidNetwork);
afterEach(() => vi.unstubAllGlobals());
const projection = (s: SeedArtifact) =>
  s.snapshot.seasonContent[0]!.seasonProjectionHash;
async function evidenceMutation(change: (d: Document) => void) {
  const corpus: Omit<RepositorySource, 'semanticHash'>[] = loadCorpus();
  const source = corpus.find((s) =>
    s.path.endsWith('provider-evidence.development.json'),
  )!;
  const document: Document = JSON.parse(source.text);
  change(document);
  source.text = JSON.stringify(document);
  source.fileHash = await identityHash(source.text);
  source.exactCommit = null;
  return prepareSeed(corpus);
}
it('keeps the effective projection invariant for an evidence-only note, while full integrity changes', async () => {
  const changed = await evidenceMutation((d) => {
    d.note = 'In-memory evidence-only test note';
  });
  expect(projection(changed)).toBe(projection(seed));
  expect(changed.contentHash).not.toBe(seed.contentHash);
  expect(changed.snapshot.seasonContent[0]!.baseContentDigest).not.toBe(
    seed.snapshot.seasonContent[0]!.baseContentDigest,
  );
  expect(await importSeed(await exportSeed(changed))).toEqual(changed);
});
it('keeps acknowledgement rationale out of effective content but inside full integrity', async () => {
  const changed = await evidenceMutation((d) => {
    const acknowledgements = d.acknowledgedUnmapped as Document[];
    acknowledgements[0]!.detail =
      'In-memory unresolved acknowledgement review note';
  });
  expect(projection(changed)).toBe(projection(seed));
  expect(changed.contentHash).not.toBe(seed.contentHash);
  expect(changed.snapshot.unresolved).toHaveLength(7);
  expect(await validateSeed(changed)).toEqual(changed);
});
it('does not accept evidence tampering under the original catalog hash', async () => {
  const changed = structuredClone(seed);
  changed.snapshot.evidence[0]!.originalProvenance += ' tampered';
  expect(await hashIdentityProjection(changed.snapshot)).not.toBe(
    seed.contentHash,
  );
  await expect(validateSeed(changed)).rejects.toThrow();
});
it('matches the regenerated exact R0 package and preserves source hashes and all seven blockers', async () => {
  const text = readFileSync(
    '../../docs/operations/identity-seed-r0/seed.json',
    'utf8',
  );
  expect(await exportSeed(seed)).toBe(text);
  expect(await importSeed(text)).toEqual(seed);
  expect(canonicalJson(await prepareSeed(loadCorpus()))).toBe(text);
  expect(seed.snapshot.unresolved).toHaveLength(7);
  for (const key of [
    'rafael_camara',
    'gabriele_mini',
    'freddie_slater',
    'nikola_tsolov',
  ])
    expect(
      seed.snapshot.bindings.some((b) => b.key.providerValue === key),
    ).toBe(false);
  for (const source of seed.sources)
    expect(source.fileHash).toBe(await identityHash(source.text));
});
it('rejects the previous projection contract even if its catalog hash is internally consistent', async () => {
  const legacy = structuredClone(seed);
  legacy.snapshot.seasonContent[0]!.seasonProjectionHash =
    await hashIdentityProjection({
      drivers: seed.snapshot.drivers.map((d) => d.profile),
      constructors: seed.snapshot.constructors,
      circuits: seed.snapshot.circuits,
      events: seed.snapshot.events,
      bindings: seed.snapshot.bindings.map((b) => ({
        key: b.key,
        targetId: b.targetId,
      })),
      baseContentDigest: seed.snapshot.seasonContent[0]!.baseContentDigest,
      datasetVersion: seed.snapshot.seasonContent[0]!.datasetVersion,
    });
  legacy.contentHash = await hashIdentityProjection(legacy.snapshot);
  await expect(validateSeed(legacy)).rejects.toThrow();
});

// Small synthetic, two-season fixture. No mutation of real source identities.
function fixture() {
  const s = structuredClone(seed.snapshot);
  const driver = (id: string) => ({
    ...s.drivers[0]!,
    anchor: {
      ...s.drivers[0]!.anchor,
      driverId: id,
    },
    profile: {
      ...s.drivers[0]!.profile,
      id,
      fullName: 'Synthetic Driver',
      givenName: 'Synthetic',
      familyName: 'Driver',
    },
  });
  s.drivers = [
    driver('synthetic-shared'),
    driver('synthetic-2027'),
    driver('synthetic-entry-only'),
  ];
  s.constructors = [
    { ...s.constructors[0]!, id: 'synthetic-team', name: 'Synthetic Team' },
  ];
  s.circuits = [
    { ...s.circuits[0]!, id: 'synthetic-circuit', name: 'Synthetic Circuit' },
  ];
  s.events = [{ id: 'synthetic-event', name: 'Synthetic Event' }];
  const template = s.bindings[0]!;
  s.bindings = [2026, 2027].flatMap((season) => [
    {
      ...template,
      key: {
        season,
        source: 'jolpica' as const,
        entity: 'driver' as const,
        providerField: 'driverId' as const,
        providerValue: 'synthetic_shared',
      },
      targetEntity: 'driver' as const,
      targetId: 'synthetic-shared',
    },
    {
      ...template,
      key: {
        season,
        source: 'jolpica' as const,
        entity: 'constructor' as const,
        providerField: 'constructorId' as const,
        providerValue: 'synthetic_team',
      },
      targetEntity: 'constructor' as const,
      targetId: 'synthetic-team',
    },
    {
      ...template,
      key: {
        season,
        source: 'jolpica' as const,
        entity: 'circuit' as const,
        providerField: 'circuitId' as const,
        providerValue: 'synthetic_circuit',
      },
      targetEntity: 'circuit' as const,
      targetId: 'synthetic-circuit',
    },
    {
      ...template,
      key: {
        season,
        source: 'jolpica' as const,
        entity: 'event' as const,
        providerField: 'eventLocator' as const,
        providerValue: {
          round: 1,
          raceName: 'Synthetic Event',
          circuitId: 'synthetic_circuit',
        },
      },
      targetEntity: 'event' as const,
      targetId: 'synthetic-event',
    },
  ]);
  s.sourceDocuments = [2026, 2027].flatMap<Fixture['sourceDocuments'][number]>(
    (season): Fixture['sourceDocuments'] => [
      {
        path: `test/${season}/metadata`,
        document: {
          kind: 'season-metadata',
          season,
          datasetVersion: '2026.10.07.1',
          seasonLabel: `Synthetic season ${season}`,
        },
      },
      {
        path: `test/${season}/drivers`,
        document: {
          kind: 'driver-season-entries',
          season,
          entries: [
            {
              id: `synthetic-entry-${season}`,
              season,
              driverId:
                season === 2027 ? 'synthetic-2027' : 'synthetic-entry-only',
              constructorId: 'synthetic-team',
              raceNumber: 10,
            },
          ],
        },
      },
      {
        path: `test/${season}/constructors`,
        document: {
          kind: 'constructor-season-entries',
          season,
          entries: [
            {
              id: `synthetic-team-${season}`,
              season,
              constructorId: 'synthetic-team',
              driverLineup: ['synthetic-shared'],
            },
          ],
        },
      },
      {
        path: `test/${season}/overrides`,
        document: {
          kind: 'overrides',
          season,
          drivers: [
            { id: 'synthetic-shared', biography: 'Synthetic biography' },
          ],
          constructors: [],
          circuits: [],
        },
      },
    ],
  );
  return s;
}
type Fixture = ReturnType<typeof fixture>;
const doc = (s: Fixture, kind: string, season = 2026) =>
  s.sourceDocuments.find(
    (x) => x.document.kind === kind && x.document.season === season,
  )!.document;
async function changedSeasons(
  mutate: (s: Fixture) => void,
  expected: number[],
) {
  const s = fixture(),
    changed = structuredClone(s);
  mutate(changed);
  for (const season of [2026, 2027]) {
    const differs =
      (await hashSeasonProjection(changed, season)) !==
      (await hashSeasonProjection(s, season));
    expect(differs, `season ${season}`).toBe(expected.includes(season));
  }
}
it('scopes a verified binding alias change to its exact season', async () => {
  await changedSeasons(
    (s) => {
      s.bindings[0]!.key = {
        season: 2026,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'synthetic_new_alias',
      };
    },
    [2026],
  );
});
it('detects a binding target change, even when profiles stay identical', async () => {
  await changedSeasons(
    (s) => {
      s.bindings[0]!.targetId = 'synthetic-entry-only';
    },
    [2026],
  );
});
it.each([
  'fullName',
  'givenName',
  'familyName',
  'shortCode',
  'nationality',
  'countryCode',
  'dateOfBirth',
  'placeOfBirth',
  'biography',
] as const)(
  'detects shared canonical profile field %s in every applicable season',
  async (field) => {
    await changedSeasons(
      (s) => {
        s.drivers[0]!.profile[field] =
          field === 'countryCode'
            ? 'GB'
            : field === 'dateOfBirth'
              ? '2000-01-02'
              : 'Synthetic changed';
      },
      [2026, 2027],
    );
  },
);
it('detects a permanent number profile change', async () => {
  await changedSeasons(
    (s) => {
      s.drivers[0]!.profile.permanentNumber = 999;
    },
    [2026, 2027],
  );
});
it('includes explicitly season-referenced profiles without a binding', async () => {
  await changedSeasons(
    (s) => {
      s.drivers[2]!.profile.biography = 'Synthetic changed';
    },
    [2026],
  );
});
it('excludes profiles referenced only by another season', async () => {
  await changedSeasons(
    (s) => {
      s.drivers[1]!.profile.fullName = 'Synthetic changed';
    },
    [2027],
  );
});
it.each(['constructors', 'circuits', 'events'] as const)(
  'includes relevant sealed %s content',
  async (registry) => {
    await changedSeasons(
      (s) => {
        s[registry][0]!.name = 'Synthetic changed';
      },
      [2026, 2027],
    );
  },
);
it.each([
  'driver-season-entries',
  'constructor-season-entries',
  'overrides',
  'season-metadata',
])('includes effective %s base fields without mixing seasons', async (kind) => {
  await changedSeasons(
    (s) => {
      const d = doc(s, kind);
      if (kind === 'season-metadata')
        d.seasonLabel = 'Synthetic changed season';
      else if (kind === 'overrides')
        (d.drivers as Document[])[0]!.biography = 'Synthetic changed';
      else
        (d.entries as Document[])[0]![
          kind === 'driver-season-entries' ? 'raceNumber' : 'fullName'
        ] = kind === 'driver-season-entries' ? 99 : 'Synthetic changed';
    },
    [2026],
  );
});
it('excludes metadata notes, version labels, provenance, decisions and unresolved records', async () => {
  await changedSeasons((s) => {
    for (const { document } of s.sourceDocuments) {
      document.note = 'Synthetic note';
      document.datasetVersion = '2099.01.01.1';
    }
    s.evidence = [];
    s.unresolved = [];
    s.importDecisions = [];
    s.bindings.forEach((b) => {
      b.evidenceIds = [];
      b.decisionId = 'sha256:synthetic-test';
    });
    s.drivers.forEach((d) => {
      d.profileVersion = 1;
      d.profileHash = 'sha256:synthetic-test';
      d.evidenceIds = [];
    });
  }, []);
});
it('candidate observations are outside the effective snapshot projection', async () => {
  const s = fixture();
  const input = {
    ...s,
    candidateObservations: [
      { observedAt: '2026-11-14T00:00:00Z', synthetic: true },
    ],
  };
  expect(await hashSeasonProjection(input, 2026)).toBe(
    await hashSeasonProjection(s, 2026),
  );
  input.candidateObservations.push({
    observedAt: '2026-11-15T00:00:00Z',
    synthetic: true,
  });
  expect(await hashSeasonProjection(input, 2026)).toBe(
    await hashSeasonProjection(s, 2026),
  );
});
it('normalizes registry/binding ordering without mutating the snapshot', async () => {
  const s = fixture(),
    before = structuredClone(s);
  const reordered = structuredClone(s);
  reordered.drivers.reverse();
  reordered.bindings.reverse();
  expect(await hashSeasonProjection(reordered, 2026)).toBe(
    await hashSeasonProjection(s, 2026),
  );
  expect(s).toEqual(before);
});
it('refuses absent or ambiguous season metadata', () => {
  const s = fixture();
  expect(() => seasonProjection(s, 2025)).toThrow();
  s.sourceDocuments.push(structuredClone(s.sourceDocuments[0]!));
  expect(() => seasonProjection(s, 2026)).toThrow();
});
