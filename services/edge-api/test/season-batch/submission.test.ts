/**
 * The offline submission builder: it runs the Worker's own verification and
 * writes exactly the body the guarded ingest accepts. Synthetic batches only;
 * nothing is sent.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { buildSubmission } from '../../scripts/season-batch/submission';
import { decodeSubmission } from '../../src/ingest/submission';
import {
  ingestContext,
  ingestFor,
  ingestOnce,
  activeAttribution,
  SEED_VERSION,
  sha256,
  syntheticBatch,
  type Batch,
} from '../ingest/support';
import { canonicalJson } from '../../src/ingest/canonical-json';

let batch: Batch;
let manifestBytes: Uint8Array;
let artifactBytes: Uint8Array;

beforeAll(async () => {
  batch = await syntheticBatch();
  manifestBytes = new TextEncoder().encode(canonicalJson(batch.manifest));
  artifactBytes = new TextEncoder().encode(canonicalJson(batch.artifact));
});

function input(overrides: Partial<Parameters<typeof buildSubmission>[0]> = {}) {
  return {
    manifestBytes,
    artifactBytes,
    reviewedManifestSha256: batch.manifestSha256,
    expectedActiveVersion: SEED_VERSION,
    now: new Date('2026-07-20T12:00:00.000Z'),
    ...overrides,
  };
}

describe('season-batch submission builder', () => {
  it('builds the body the guarded ingest publishes', async () => {
    const result = await buildSubmission(input());
    if (!result.ok) throw new Error(result.failure);
    expect(result.summary).toMatchObject({
      season: 2026,
      expectedActiveVersion: SEED_VERSION,
      manifestSha256: batch.manifestSha256,
      classifiedRounds: [1, 2, 3],
      submissionSha256: sha256(result.text),
      // The committed record calls the source dormant: the Worker will refuse
      // until a later change activates it.
      attributionStatus: 'not-active',
    });

    const ctx = await ingestContext();
    const outcome = await ingestOnce(
      ingestFor(ctx, ctx.service),
      JSON.parse(result.text) as Record<string, unknown>,
    );
    expect(outcome).toMatchObject({
      outcome: 'publication',
      publication: { status: 'applied' },
    });
  });

  it('reports an active record as active', async () => {
    const result = await buildSubmission(
      input({ attributionRecord: activeAttribution() }),
    );
    expect(result.ok && result.summary.attributionStatus).toBe('active');
  });

  it('refuses any manifest but the reviewed one', async () => {
    expect(
      await buildSubmission(input({ reviewedManifestSha256: 'a'.repeat(64) })),
    ).toEqual({ ok: false, failure: 'manifest-digest-mismatch' });
  });

  it('refuses what the Worker would refuse, with its reason', async () => {
    const tampered = new TextEncoder().encode(
      canonicalJson({
        ...batch.artifact,
        observedAt: '2026-03-17T12:00:00.000Z',
      }),
    );
    expect(await buildSubmission(input({ artifactBytes: tampered }))).toEqual({
      ok: false,
      failure: 'artifact-digest-mismatch',
    });
    expect(
      await buildSubmission(input({ now: new Date('2026-03-01T00:00:00Z') })),
    ).toEqual({ ok: false, failure: 'batch-from-future' });
  });

  it('refuses an unreadable batch or an invalid expected version', async () => {
    const garbage = new TextEncoder().encode('{not json');
    expect(await buildSubmission(input({ artifactBytes: garbage }))).toEqual({
      ok: false,
      failure: 'batch-malformed',
    });
    expect(
      await buildSubmission(input({ expectedActiveVersion: 'two words' })),
    ).toEqual({ ok: false, failure: 'expected-version-invalid' });
  });

  it('writes a body the Worker decodes exactly', async () => {
    const result = await buildSubmission(input());
    if (!result.ok) throw new Error(result.failure);
    const decoded = decodeSubmission(JSON.parse(result.text));
    expect(decoded).toMatchObject({
      season: 2026,
      expectedActiveVersion: SEED_VERSION,
      reviewedManifestSha256: batch.manifestSha256,
    });
    expect(decoded?.manifest).toEqual(batch.manifest);
    expect(decoded?.artifact).toEqual(batch.artifact);
  });
});
