/**
 * Batch verification: every closed refusal, each over a real generator batch
 * edited just enough that only the check under test can catch it.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import dataSources from '../../../../content/attribution/data-sources.json';
import {
  batchVerificationFailures,
  verifySeasonBatch,
  type BatchVerificationInput,
  type SourceAttribution,
} from '../../src/ingest/batch-verification';
import { curatedSeasonMetadata } from '../../src/sync/coordinated/outcome/metadata';
import {
  BATCH_OBSERVED_AT,
  copy,
  IMPOSSIBLE_OBSERVED_AT,
  impossibleInstantBatch,
  reanchored,
  recaptured,
  rehashDocuments,
  SEASON,
  sha256,
  syntheticBatch,
  type Batch,
  type Json,
} from './support';
import { canonicalJson } from '../../src/ingest/canonical-json';

let batch: Batch;

beforeAll(async () => {
  batch = await syntheticBatch();
});

const jolpica = dataSources.sources.find(
  (source) => source.sourceId === 'jolpica',
)!;
const attribution: SourceAttribution = {
  recordVersion: dataSources.version,
  name: jolpica.name,
  sourceUrl: jolpica.sourceUrl,
  licenseName: jolpica.licenseName,
  licenseUrl: jolpica.licenseUrl,
};

function input(
  value: Batch = batch,
  overrides: Partial<BatchVerificationInput> = {},
): BatchVerificationInput {
  return {
    manifest: value.manifest,
    artifact: value.artifact,
    reviewedManifestSha256: value.manifestSha256,
    season: SEASON,
    now: new Date('2026-07-20T12:00:00.000Z'),
    metadata: curatedSeasonMetadata(SEASON),
    attribution,
    ...overrides,
  };
}

async function failure(
  value: Batch,
  overrides: Partial<BatchVerificationInput> = {},
): Promise<string> {
  const result = await verifySeasonBatch(input(value, overrides));
  if (result.ok) throw new Error('expected a refusal');
  return result.failure;
}

/** Edits the artifact and re-anchors the manifest at the file level. */
function artifactEdit(edit: (artifact: Json) => void): Batch {
  const artifact = copy(batch.artifact);
  edit(artifact);
  return reanchored(batch.manifest, artifact);
}

/** Edits the manifest and makes it the reviewed one. */
function manifestEdit(edit: (manifest: Json) => void): Batch {
  const manifest = copy(batch.manifest);
  edit(manifest);
  return {
    manifest,
    artifact: batch.artifact,
    manifestSha256: sha256(canonicalJson(manifest)),
  };
}

function source(artifact: Json): Json {
  return artifact.source as Json;
}

describe('season batch verification', () => {
  it('accepts a generator batch and returns its verified source', async () => {
    const result = await verifySeasonBatch(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch).toMatchObject({
      season: SEASON,
      observedAt: BATCH_OBSERVED_AT,
      version: '20260316120000000-batch',
      manifestSha256: batch.manifestSha256,
      artifactSha256: (batch.manifest.artifact as Json).sha256,
      classifiedRounds: [1, 2, 3],
    });
    expect(result.batch.source).toEqual(batch.artifact.source);
  });

  it('declares a closed, distinct refusal vocabulary', () => {
    expect(new Set(batchVerificationFailures).size).toBe(
      batchVerificationFailures.length,
    );
  });

  it('refuses any manifest but the reviewed one', async () => {
    expect(
      await failure(batch, { reviewedManifestSha256: 'f'.repeat(64) }),
    ).toBe('manifest-digest-mismatch');
    expect(await failure(batch, { reviewedManifestSha256: 'not-hex' })).toBe(
      'manifest-digest-mismatch',
    );
    const reindented = manifestEdit(() => {});
    expect(reindented.manifestSha256).toBe(batch.manifestSha256);
  });

  it('refuses a manifest of another shape, season or source', async () => {
    expect(
      await failure(
        manifestEdit((manifest) => {
          manifest.extra = true;
        }),
      ),
    ).toBe('manifest-malformed');
    expect(
      await failure(
        manifestEdit((manifest) => {
          manifest.season = SEASON + 1;
        }),
      ),
    ).toBe('manifest-malformed');
    expect(
      await failure(
        manifestEdit((manifest) => {
          const capture = manifest.capture as Json;
          (capture.responses as Json[])[0]!.url =
            'https://example.invalid/ergast/f1/2026/races/';
          recaptured(manifest);
        }),
      ),
    ).toBe('manifest-malformed');
  });

  it('refuses a batch generated from a modified tree', async () => {
    expect(
      await failure(
        manifestEdit((manifest) => {
          (manifest.generator as Json).treeClean = false;
        }),
      ),
    ).toBe('manifest-tree-dirty');
  });

  it('refuses a manifest whose capture digest is not its responses', async () => {
    expect(
      await failure(
        manifestEdit((manifest) => {
          const capture = manifest.capture as Json;
          (capture.responses as Json[])[0]!.sha256 = '0'.repeat(64);
        }),
      ),
    ).toBe('capture-digest-inconsistent');
  });

  it('refuses an artifact that is not the reviewed manifest names', async () => {
    const artifact = copy(batch.artifact);
    (artifact.release as Json).seasonLabel = 'edited';
    expect(await failure({ ...batch, artifact })).toBe(
      'artifact-digest-mismatch',
    );
  });

  it('refuses an artifact of another shape', async () => {
    expect(
      await failure(
        artifactEdit((artifact) => {
          delete artifact.observedAt;
        }),
      ),
    ).toBe('artifact-malformed');
    expect(
      await failure(
        artifactEdit((artifact) => {
          (artifact.documents as Json[])[0]!.extra = 1;
        }),
      ),
    ).toBe('artifact-malformed');
  });

  it('refuses an artifact whose instants or labels disagree', async () => {
    expect(
      await failure(
        artifactEdit((artifact) => {
          (artifact.release as Json).version = 'another-version';
        }),
      ),
    ).toBe('artifact-inconsistent');
    expect(
      await failure(
        artifactEdit((artifact) => {
          (artifact.release as Json).sourceUpdatedAt =
            '2026-03-17T12:00:00.000Z';
        }),
      ),
    ).toBe('artifact-inconsistent');
    expect(
      await failure(
        artifactEdit((artifact) => {
          source(artifact).sourceUpdatedAt = '2026-03-17T12:00:00.000Z';
        }),
      ),
    ).toBe('artifact-inconsistent');
  });

  it('refuses an impossible calendar instant, even fully rehashed', async () => {
    const impossible = await impossibleInstantBatch();
    expect(impossible.manifest.capture).toMatchObject({
      observedAt: IMPOSSIBLE_OBSERVED_AT,
    });
    expect(impossible.artifact.observedAt).toBe(IMPOSSIBLE_OBSERVED_AT);
    expect(await failure(impossible)).toBe('manifest-malformed');
  });

  it('refuses a capture instant that does not round-trip', async () => {
    for (const observedAt of [
      '2026-04-31T12:00:00.000Z',
      '2025-02-29T12:00:00.000Z',
      '2026-03-16T24:00:00.000Z',
      '2026-03-16T23:59:60.000Z',
      '2026-13-01T12:00:00.000Z',
    ]) {
      expect(
        await failure(
          manifestEdit((manifest) => {
            (manifest.capture as Json).observedAt = observedAt;
            recaptured(manifest);
          }),
        ),
      ).toBe('manifest-malformed');
    }
  });

  it('refuses a batch captured after the Worker clock', async () => {
    expect(
      await failure(batch, { now: new Date('2026-03-16T11:59:59.999Z') }),
    ).toBe('batch-from-future');
  });

  it('refuses a batch generated against other curated content', async () => {
    const metadata = curatedSeasonMetadata(SEASON)!;
    expect(
      await failure(batch, {
        metadata: { ...metadata, contentVersion: '2099.01.01.1' },
      }),
    ).toBe('curated-metadata-mismatch');
    expect(await failure(batch, { metadata: null })).toBe(
      'curated-metadata-mismatch',
    );
  });

  it('refuses a batch credited unlike this Worker credits its source', async () => {
    expect(
      await failure(batch, {
        attribution: { ...attribution, licenseUrl: 'https://example.invalid' },
      }),
    ).toBe('attribution-mismatch');
    expect(
      await failure(batch, {
        attribution: { ...attribution, recordVersion: 'data-sources-v9' },
      }),
    ).toBe('attribution-mismatch');
    expect(await failure(batch, { attribution: null })).toBe(
      'attribution-mismatch',
    );
  });

  it('refuses a source of another shape', async () => {
    expect(
      await failure(
        artifactEdit((artifact) => {
          delete source(artifact).results;
        }),
      ),
    ).toBe('source-malformed');
    expect(
      await failure(
        artifactEdit((artifact) => {
          source(artifact).drivers = {};
        }),
      ),
    ).toBe('source-malformed');
  });

  it('refuses a source entity that fails deep validation', async () => {
    expect(
      await failure(
        artifactEdit((artifact) => {
          (source(artifact).drivers as Json[])[0]!.id = 'Not A Slug';
        }),
      ),
    ).toBe('source-invalid');
    expect(
      await failure(
        artifactEdit((artifact) => {
          (source(artifact).calendar as Json[])[0]!.season = SEASON + 1;
        }),
      ),
    ).toBe('source-invalid');
  });

  it('refuses a source whose references do not resolve', async () => {
    expect(
      await failure(
        artifactEdit((artifact) => {
          (source(artifact).driverEntries as Json[])[0]!.constructorId =
            'no-such-team';
        }),
      ),
    ).toBe('source-inconsistent');
  });

  it('refuses a capture that does not classify every eligible round', async () => {
    expect(
      await failure(
        manifestEdit((manifest) => {
          (manifest.capture as Json).classificationRounds = [1, 2];
          recaptured(manifest);
        }),
      ),
    ).toBe('classification-incomplete');
    // Declared, but missing from the source: the season's own references
    // (the event's results and the entries derived from them) already break.
    expect(
      await failure(
        artifactEdit((artifact) => {
          const results = source(artifact).results as Json[];
          source(artifact).results = results.slice(0, -1);
        }),
      ),
    ).toBe('source-inconsistent');
  });

  it('refuses a document that is not its reviewed digest', async () => {
    expect(
      await failure(
        artifactEdit((artifact) => {
          ((artifact.documents as Json[])[0]!.meta as Json).generatedAt =
            '2026-03-16T12:00:00.001Z';
        }),
      ),
    ).toBe('document-digest-mismatch');
  });

  it('refuses a document the source does not regenerate, even re-hashed', async () => {
    const artifact = copy(batch.artifact);
    const home = (artifact.documents as Json[]).find(
      (document) => document.documentName === 'home',
    )!;
    (home.data as Json).edited = true;
    const manifest = copy(batch.manifest);
    rehashDocuments(manifest, artifact);
    expect(await failure(reanchored(manifest, artifact))).toBe(
      'document-source-inconsistent',
    );
  });

  it('refuses a summary that does not describe the batch', async () => {
    expect(
      await failure(
        manifestEdit((manifest) => {
          const summary = manifest.summary as Json;
          summary.drivers = (summary.drivers as number) + 1;
        }),
      ),
    ).toBe('summary-inconsistent');
    expect(
      await failure(
        manifestEdit((manifest) => {
          (manifest.summary as Json).classifiedRounds = [1, 2];
        }),
      ),
    ).toBe('summary-inconsistent');
  });
});
