/**
 * The ingest route end to end through the real Worker entry point, as an
 * enabled staging Worker would run it once the attribution record credits the
 * source as `active` (a later, separate change). Only the bundled record is
 * replaced here; the composition root, the guarded sequenced service and the
 * response mapping are the real ones.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

import worker, { type Env } from '../../src/index';
import { maximumSubmissionBytes } from '../../src/ingest/submission';
import {
  adminRequest,
  createHarness,
  type EdgeHarness,
} from '../support/edge-harness';
import type { SequencedContext } from '../publication/sequenced/support';
import {
  copy,
  ingestContext,
  reanchored,
  SEASON,
  SEED_VERSION,
  submissionFor,
  syntheticBatch,
  type Batch,
  type Json,
} from './support';

vi.mock(
  '../../../../content/attribution/data-sources.json',
  async (importOriginal) => {
    const original = (await importOriginal()) as { default: Json };
    const record = structuredClone(original.default);
    record.sources = (record.sources as Json[]).map((source) =>
      source.sourceId === 'jolpica' ? { ...source, status: 'active' } : source,
    );
    return { default: record };
  },
);

const PATH = '/internal/admin/season/ingest';

let batch: Batch;

beforeAll(async () => {
  batch = await syntheticBatch();
});

async function enabled(): Promise<{
  context: SequencedContext;
  harness: EdgeHarness;
  env: Env;
}> {
  const context = await ingestContext();
  const harness = createHarness({ storage: context.storage });
  return {
    context,
    harness,
    env: {
      ...harness.env,
      ENVIRONMENT: 'staging',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      __SEASON_PUBLICATION_SEQUENCER: context.port,
      SEASON_BATCH_INGEST: String(SEASON),
    },
  };
}

async function post(
  env: Env,
  body: unknown,
): Promise<{ status: number; data: Json; response: Response }> {
  const response = await worker.fetch(adminRequest(PATH, undefined, body), env);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const json = (await response.json()) as { data: Json };
  return { status: response.status, data: json.data, response };
}

describe('the season ingest route through the Worker', () => {
  it('publishes a reviewed batch with 200', async () => {
    const { context, env } = await enabled();
    const { status, data } = await post(
      env,
      submissionFor(batch, SEED_VERSION),
    );
    expect(status).toBe(200);
    expect(data.outcome).toBe('publication');
    const publication = data.publication as Json;
    expect(publication.status).toBe('applied');
    const authority = await context.coordinator.readAuthority(SEASON);
    expect(authority).toMatchObject({ activeVersion: publication.version });
  });

  it('refuses a stale retry with 409 and writes nothing', async () => {
    const { context, env } = await enabled();
    expect((await post(env, submissionFor(batch, SEED_VERSION))).status).toBe(
      200,
    );
    const writes = context.storage.writeLog.length;
    const { status, data } = await post(
      env,
      submissionFor(batch, SEED_VERSION),
    );
    expect(status).toBe(409);
    expect(data.publication).toMatchObject({
      status: 'rejected',
      reason: 'guard-predecessor-stale',
    });
    expect(context.storage.writeLog).toHaveLength(writes);
  });

  it('refuses a batch that fails verification with 422', async () => {
    const { context, env } = await enabled();
    const artifact = copy(batch.artifact);
    (artifact.source as Json).seasonLabel = 'edited';
    const writes = context.storage.writeLog.length;
    const { status, data } = await post(
      env,
      submissionFor(reanchored(batch.manifest, artifact), SEED_VERSION),
    );
    expect(status).toBe(422);
    expect(data).toEqual({
      outcome: 'refused',
      stage: 'verification',
      reason: 'artifact-inconsistent',
    });
    expect(context.storage.writeLog).toHaveLength(writes);
  });

  it('refuses a body that is not a submission with 400', async () => {
    const { env } = await enabled();
    const unparsable = new Request(`https://api.gridview.local${PATH}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer local-test-token' },
      body: '{not json',
    });
    const malformed = await worker.fetch(unparsable, env);
    expect(malformed.status).toBe(400);
    // Admitted, so read - the counterpart of the unread admission refusals.
    expect(unparsable.bodyUsed).toBe(true);
    for (const body of [
      { ...submissionFor(batch, SEED_VERSION), extra: true },
      { ...submissionFor(batch, SEED_VERSION), kind: 'other' },
      submissionFor(batch, 'not a version!'),
      submissionFor(batch, SEED_VERSION, { reviewedManifestSha256: 'F00' }),
    ]) {
      const { status, data } = await post(env, body);
      expect(status).toBe(400);
      expect(data.reason).toBe('submission-malformed');
    }
  });

  it('refuses another season with 400', async () => {
    const { env } = await enabled();
    const { status, data } = await post(
      env,
      submissionFor(batch, SEED_VERSION, { season: SEASON + 1 }),
    );
    expect(status).toBe(400);
    expect(data.reason).toBe('season-not-enabled');
  });

  it('refuses an oversized body with 413, declared or streamed', async () => {
    const { env } = await enabled();
    const declared = await worker.fetch(
      new Request(`https://api.gridview.local${PATH}`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer local-test-token',
          'Content-Length': String(maximumSubmissionBytes + 1),
        },
        body: '{}',
      }),
      env,
    );
    expect(declared.status).toBe(413);

    const padded = {
      ...submissionFor(batch, SEED_VERSION),
      padding: 'x'.repeat(maximumSubmissionBytes),
    };
    const streamed = await worker.fetch(
      new Request(`https://api.gridview.local${PATH}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer local-test-token' },
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(JSON.stringify(padded)),
            );
            controller.close();
          },
        }),
        duplex: 'half',
      } as RequestInit),
      env,
    );
    expect(streamed.status).toBe(413);
    expect(((await streamed.json()) as { data: Json }).data.reason).toBe(
      'submission-oversized',
    );
  });
});
