import { it, expect } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import {
  projectSeasons,
  reserveDatasetVersions,
} from '../../../src/identity/catalog/dataset-version';
import type { IdentityStorage } from '../../../src/identity/schema';

/** Deterministic reservation storage double; real SQLite constraints and races
 * are exercised independently by u4-concurrency and u4-local. */
function reservationDouble() {
  const labels: {
    season: number;
    label: string;
    projection: string;
    revision: string;
    date: string;
    suffix: number;
  }[] = [];
  const storage: IdentityStorage = {
    transactionSync: (fn) => fn(),
    sql: {
      exec(q, ...args) {
        if (q.startsWith('INSERT INTO identity_catalog_labels')) {
          const [season, label, projection, revision, date, suffix] = args as [
            number,
            string,
            string,
            string,
            string,
            number,
          ];
          if (labels.some((r) => r.season === season && r.label === label))
            throw Error('duplicate-label');
          labels.push({ season, label, projection, revision, date, suffix });
          return { toArray: () => [] };
        }
        if (q.startsWith('SELECT date,suffix'))
          return {
            toArray: () =>
              labels
                .filter((r) => r.season === args[0])
                .sort(
                  (a, b) => b.date.localeCompare(a.date) || b.suffix - a.suffix,
                )
                .slice(0, 1),
          };
        throw Error('unexpected allocator SQL');
      },
    },
  };
  return { storage, labels };
}
it('uses only corrected effective projections, isolates seasons and allocates nothing for evidence/provenance-only changes', async () => {
  const seed = await prepareSeed(loadCorpus()),
    parent = structuredClone(seed.snapshot),
    r = reservationDouble();
  const meta = structuredClone(
    parent.sourceDocuments.find((d) => d.document.kind === 'season-metadata')!,
  );
  meta.path = 'synthetic-2027';
  meta.document.season = 2027;
  parent.sourceDocuments.push(meta);
  parent.seasonContent.push({
    ...parent.seasonContent[0]!,
    season: 2027,
    datasetVersion: '2026.10.07.1',
  });
  await projectSeasons(parent);
  reserveDatasetVersions(
    r.storage,
    parent,
    null,
    'seed',
    '2026-11-14T12:00:00.000Z',
  );
  expect(r.labels).toHaveLength(2);
  const evidence = structuredClone(parent);
  evidence.evidence[0]!.originalProvenance +=
    ' Evidence-only synthetic fixture.';
  evidence.sourceDocuments.find(
    (d) => d.document.kind === 'provider-evidence',
  )!.document.note = 'Evidence-only note';
  await projectSeasons(evidence);
  expect(evidence.seasonContent.map((s) => s.seasonProjectionHash)).toEqual(
    parent.seasonContent.map((s) => s.seasonProjectionHash),
  );
  reserveDatasetVersions(
    r.storage,
    evidence,
    parent,
    'evidence',
    '2026-11-14T12:00:00.000Z',
  );
  expect(r.labels).toHaveLength(2);
  const profile = structuredClone(parent);
  profile.drivers[0]!.profile.fullName = 'Synthetic Changed Profile';
  await projectSeasons(profile);
  reserveDatasetVersions(
    r.storage,
    profile,
    parent,
    'profile',
    '2026-11-14T12:00:00.000Z',
  );
  expect(profile.seasonContent.map((s) => s.datasetVersion)).toEqual([
    '2026.11.14.1',
    '2026.10.07.1',
  ]);
  expect(r.labels).toHaveLength(3);
  const binding = structuredClone(parent);
  const alias = structuredClone(
    binding.bindings.find(
      (b) => b.key.entity === 'driver' && b.key.source === 'jolpica',
    )!,
  );
  if (alias.key.source === 'jolpica' && alias.key.entity === 'driver')
    alias.key = { ...alias.key, providerValue: 'synthetic_alias' };
  binding.bindings.push(alias);
  await projectSeasons(binding);
  reserveDatasetVersions(
    r.storage,
    binding,
    parent,
    'binding',
    '2026-11-14T12:00:00.000Z',
  );
  expect(binding.seasonContent[0]!.datasetVersion).toBe('2026.11.14.2');
  expect(binding.seasonContent[1]!.datasetVersion).toBe('2026.10.07.1');
  expect(() =>
    reserveDatasetVersions(
      r.storage,
      binding,
      parent,
      'regression',
      '2026-11-13T12:00:00.000Z',
    ),
  ).toThrow('dataset-clock-regression');
});
