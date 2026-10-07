/**
 * The frozen-fixture converter, over batches the real generator makes from
 * synthetic recorded captures. Nothing here reads a private capture or sends
 * a request.
 */

import { createHash } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import { canonicalJson, utf8 } from '../../scripts/season-batch/canonical-json';
import {
  convertSeasonBatch,
  descriptorFile,
  fixtureNamesFor,
  type FixtureConversionInput,
  type FixtureFile,
} from '../../scripts/season-batch/fixtures';
import { generateSeasonBatch } from '../../scripts/season-batch/generate';
import { inputFor, OBSERVED_AT, ROUNDS, SEASON } from './support';

interface Batch {
  readonly artifact: string;
  readonly manifest: string;
}

let batch: Batch;

beforeAll(async () => {
  const result = await generateSeasonBatch(inputFor());
  if (!result.ok) throw new Error(`fixture batch refused: ${result.failure}`);
  batch = { artifact: result.artifact.text, manifest: result.manifest.text };
});

function sha256(text: string | Uint8Array): string {
  return createHash('sha256').update(text).digest('hex');
}

function input(
  overrides: Partial<{
    artifact: string;
    manifest: string;
    expected: string;
    origin: string;
  }> = {},
): FixtureConversionInput {
  const manifest = overrides.manifest ?? batch.manifest;
  return {
    manifestBytes: utf8(manifest),
    artifactBytes: utf8(overrides.artifact ?? batch.artifact),
    expectedManifestSha256: overrides.expected ?? sha256(manifest),
    origin: overrides.origin ?? 'provider-capture',
  };
}

/** Rewrites the manifest, then fixes up the artifact digest it records. */
function editManifest(
  edit: (manifest: Record<string, unknown>) => void,
): string {
  const manifest = JSON.parse(batch.manifest) as Record<string, unknown>;
  edit(manifest);
  return canonicalJson(manifest);
}

/**
 * Rewrites the artifact and re-anchors the manifest to it, so the edit is
 * consistent at the file level and only a deeper check can catch it.
 */
function editArtifact(
  edit: (artifact: Record<string, unknown>) => void,
  options: { rehashDocuments?: boolean } = {},
): { artifact: string; manifest: string } {
  const artifact = JSON.parse(batch.artifact) as Record<string, unknown>;
  edit(artifact);
  const text = canonicalJson(artifact);
  const manifest = editManifest((value) => {
    const record = value.artifact as Record<string, unknown>;
    record.byteLength = utf8(text).byteLength;
    record.sha256 = sha256(text);
    if (options.rehashDocuments === true) {
      const summary = value.summary as Record<string, unknown>;
      summary.documents = (
        artifact.documents as { documentName: string }[]
      ).map((document) => ({
        documentName: document.documentName,
        sha256: sha256(canonicalJson(document)),
      }));
    }
  });
  return { artifact: text, manifest };
}

function byName(files: readonly FixtureFile[], name: string): FixtureFile {
  const file = files.find((candidate) => candidate.name === name);
  if (file === undefined) throw new Error(`missing ${name}`);
  return file;
}

describe('frozen fixtures: conversion', () => {
  it('maps every document to the files FixtureGridViewApi loads', async () => {
    const result = await convertSeasonBatch(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const names = result.files.map((file) => file.name);
    for (const expected of [
      'bootstrap.json',
      `bootstrap-${SEASON}.json`,
      'home.json',
      'season-current.json',
      `season-${SEASON}.json`,
      `calendar-${SEASON}.json`,
      `drivers-${SEASON}.json`,
      `constructors-${SEASON}.json`,
      `circuits-${SEASON}.json`,
      `standings-drivers-${SEASON}.json`,
      `standings-constructors-${SEASON}.json`,
      'content-manifest.json',
      descriptorFile,
      ...ROUNDS.map((round) => `results-${SEASON}-${round}.json`),
    ]) {
      expect(names).toContain(expected);
    }
    // No status document exists: the Worker computes /v1/status.
    expect(names).not.toContain('status.json');
    expect(names.filter((name) => name.startsWith('grand-prix-'))).toHaveLength(
      JSON.parse(byName(result.files, `calendar-${SEASON}.json`).text).data
        .length,
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it('serves exactly the stored document in the public envelope', async () => {
    const result = await convertSeasonBatch(input());
    if (!result.ok) throw new Error(result.failure);
    const artifact = JSON.parse(batch.artifact) as {
      documents: { documentName: string; meta: object; data: unknown }[];
    };
    const home = artifact.documents.find((d) => d.documentName === 'home')!;
    const envelope = JSON.parse(byName(result.files, 'home.json').text);
    const requestId = `frozen-${sha256(batch.manifest).slice(0, 16)}`;
    expect(envelope).toEqual({
      data: home.data,
      meta: { ...home.meta, requestId },
    });
    // Both names of one document carry the same bytes.
    expect(byName(result.files, 'bootstrap.json').text).toBe(
      byName(result.files, `bootstrap-${SEASON}.json`).text,
    );
    expect(byName(result.files, 'season-current.json').text).toBe(
      byName(result.files, `season-${SEASON}.json`).text,
    );
  });

  it('describes the batch and every file in the descriptor', async () => {
    const result = await convertSeasonBatch(input());
    if (!result.ok) throw new Error(result.failure);
    const descriptor = JSON.parse(byName(result.files, descriptorFile).text);
    const manifest = JSON.parse(batch.manifest);
    expect(descriptor).toMatchObject({
      kind: 'gridview-frozen-dataset',
      schemaVersion: 1,
      origin: 'provider-capture',
      season: SEASON,
      capturedAt: OBSERVED_AT,
      sources: ['jolpica'],
      batch: {
        manifestSha256: sha256(batch.manifest),
        artifactSha256: manifest.artifact.sha256,
        captureDigest: manifest.capture.digest,
        generatorCommit: manifest.generator.gitCommit,
        version: manifest.summary.version,
        documentCount: manifest.summary.documentCount,
      },
    });
    const fixtures = result.files.filter(
      (file) => file.name !== descriptorFile,
    );
    expect(descriptor.files).toEqual(
      fixtures.map((file) => ({
        name: file.name,
        byteLength: utf8(file.text).byteLength,
        sha256: sha256(file.text),
      })),
    );
  });

  it('credits no source for a synthetic batch', async () => {
    const result = await convertSeasonBatch(input({ origin: 'synthetic' }));
    if (!result.ok) throw new Error(result.failure);
    const descriptor = JSON.parse(byName(result.files, descriptorFile).text);
    expect(descriptor.origin).toBe('synthetic');
    expect(descriptor.sources).toEqual([]);
  });

  it('is deterministic', async () => {
    const first = await convertSeasonBatch(input());
    const second = await convertSeasonBatch(input());
    expect(first).toEqual(second);
  });
});

describe('frozen fixtures: refusals (negative controls)', () => {
  it('refuses a manifest other than the reviewed one', async () => {
    expect(
      await convertSeasonBatch(input({ expected: 'f'.repeat(64) })),
    ).toEqual({ ok: false, failure: 'manifest-digest-mismatch' });
  });

  it('refuses a manifest edited after review, even if re-hashed', async () => {
    // The reviewed hash still names the original bytes.
    const edited = editManifest((manifest) => {
      (manifest.summary as Record<string, unknown>).version = 'edited';
    });
    expect(
      await convertSeasonBatch(
        input({ manifest: edited, expected: sha256(batch.manifest) }),
      ),
    ).toEqual({ ok: false, failure: 'manifest-digest-mismatch' });
  });

  it.each([
    [
      'an unknown field',
      (m: Record<string, unknown>) => {
        m.reviewedBy = 'someone';
      },
      'manifest-malformed',
    ],
    [
      'another kind',
      (m: Record<string, unknown>) => {
        m.kind = 'gridview-season-batch';
      },
      'manifest-malformed',
    ],
    [
      'a non-200 response',
      (m: Record<string, unknown>) => {
        const capture = m.capture as { responses: { status: number }[] };
        capture.responses[0]!.status = 404;
      },
      'manifest-malformed',
    ],
    [
      'a dirty generator tree',
      (m: Record<string, unknown>) => {
        (m.generator as Record<string, unknown>).treeClean = false;
      },
      'manifest-tree-dirty',
    ],
    [
      'a capture digest that does not match its responses',
      (m: Record<string, unknown>) => {
        (m.capture as Record<string, unknown>).digest = '0'.repeat(64);
      },
      'capture-digest-inconsistent',
    ],
  ])('refuses a manifest with %s', async (_, edit, failure) => {
    const manifest = editManifest(edit);
    expect(await convertSeasonBatch(input({ manifest }))).toEqual({
      ok: false,
      failure,
    });
  });

  it('refuses a non-canonical manifest', async () => {
    const manifest = JSON.stringify(JSON.parse(batch.manifest));
    expect(await convertSeasonBatch(input({ manifest }))).toEqual({
      ok: false,
      failure: 'manifest-not-canonical',
    });
  });

  it('refuses an artifact that does not match the manifest', async () => {
    const artifact = batch.artifact.replace('"season": 2026', '"season": 2025');
    expect(await convertSeasonBatch(input({ artifact }))).toEqual({
      ok: false,
      failure: 'artifact-digest-mismatch',
    });
    expect(
      await convertSeasonBatch(input({ artifact: `${batch.artifact} ` })),
    ).toEqual({ ok: false, failure: 'artifact-digest-mismatch' });
  });

  it('refuses a document edited after generation', async () => {
    const edited = editArtifact((artifact) => {
      const documents = artifact.documents as { data: unknown }[];
      documents[0]!.data = { tampered: true };
    });
    expect(await convertSeasonBatch(input(edited))).toEqual({
      ok: false,
      failure: 'document-digest-mismatch',
    });
  });

  it('refuses re-hashed documents that the source does not regenerate', async () => {
    const edited = editArtifact(
      (artifact) => {
        const documents = artifact.documents as {
          documentName: string;
          meta: Record<string, unknown>;
        }[];
        const home = documents.find((d) => d.documentName === 'home')!;
        home.meta.contentVersion = 'edited';
      },
      { rehashDocuments: true },
    );
    expect(await convertSeasonBatch(input(edited))).toEqual({
      ok: false,
      failure: 'document-source-inconsistent',
    });
  });

  it('refuses a missing or an extra document', async () => {
    const missing = editArtifact(
      (artifact) => {
        artifact.documents = (
          artifact.documents as { documentName: string }[]
        ).filter((d) => d.documentName !== 'home');
      },
      { rehashDocuments: true },
    );
    expect(await convertSeasonBatch(input(missing))).toEqual({
      ok: false,
      failure: 'artifact-inconsistent',
    });
  });

  it('refuses an artifact with an unknown field', async () => {
    const edited = editArtifact((artifact) => {
      artifact.extra = true;
    });
    expect(await convertSeasonBatch(input(edited))).toEqual({
      ok: false,
      failure: 'artifact-malformed',
    });
  });

  it('refuses an attribution the bundled record does not match', async () => {
    const manifest = editManifest((m) => {
      (m.attribution as Record<string, unknown>).licenseName = 'CC BY 4.0';
    });
    expect(await convertSeasonBatch(input({ manifest }))).toEqual({
      ok: false,
      failure: 'attribution-mismatch',
    });
    // A synthetic batch credits nothing, so it does not depend on the record.
    expect(
      (await convertSeasonBatch(input({ manifest, origin: 'synthetic' }))).ok,
    ).toBe(true);
  });

  it('refuses an undeclared origin', async () => {
    expect(await convertSeasonBatch(input({ origin: '' }))).toEqual({
      ok: false,
      failure: 'origin-invalid',
    });
    expect(await convertSeasonBatch(input({ origin: 'captured' }))).toEqual({
      ok: false,
      failure: 'origin-invalid',
    });
  });
});

describe('frozen fixtures: file names', () => {
  it.each([
    ['grand-prix:7', 'grand-prix-2026-7.json'],
    ['grand-prix:12:results', 'results-2026-12.json'],
    ['driver:max-verstappen', 'driver-max-verstappen.json'],
    ['constructor:red-bull', 'constructor-red-bull.json'],
    ['circuit:monza', 'circuit-monza.json'],
    ['content:manifest', 'content-manifest.json'],
  ])('maps %s to %s', (documentName, name) => {
    expect(fixtureNamesFor(documentName, 2026)?.names).toEqual([name]);
  });

  it.each([
    'grand-prix:07',
    'grand-prix:0',
    'grand-prix:1:sprint',
    'driver:../secret',
    'driver:Max',
    'driver:',
    'status',
    'standings:teams',
  ])('refuses %s', (documentName) => {
    expect(fixtureNamesFor(documentName, 2026)).toBeNull();
  });
});
