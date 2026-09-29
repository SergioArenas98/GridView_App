/**
 * The A3.5 staging predecessor gate's operator route, driven through the real
 * Worker entry point: admin authentication, the composition root's authority
 * resolution and the response headers are the real ones.
 *
 * The default env has no `SEASON_PUBLICATION_AUTHORITY`, like development and
 * production, so it shows what those answer: a refusal that reads nothing.
 */

import { describe, expect, it } from 'vitest';

import worker, { type Env } from '../../src/index';
import type { GeneratedSnapshotSet } from '../../src/snapshots/generator';
import {
  SEASON,
  SEED_VERSION,
  sequencedContext,
  type SequencedContext,
} from '../publication/sequenced/support';
import {
  adminRequest,
  createHarness,
  request,
  type EdgeHarness,
} from '../support/edge-harness';

const PATH = '/internal/admin/publication/standings-predecessor';
const GATE = `${PATH}?season=${SEASON}`;

const get = (path: string, token = 'local-test-token') =>
  adminRequest(path, token, undefined, 'GET');

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

/** A staging-shaped Worker whose sequencer is the context's own. */
function sequencedHarness(context: SequencedContext): {
  harness: EdgeHarness;
  env: Env;
} {
  const harness = createHarness({ storage: context.storage });
  return {
    harness,
    env: {
      ...harness.env,
      ENVIRONMENT: 'staging',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      __SEASON_PUBLICATION_SEQUENCER: context.port,
    },
  };
}

function gateLines(harness: EdgeHarness) {
  return harness.logger.events.filter(
    (event) => event.operation === 'publication.standings-predecessor',
  );
}

describe('the standings predecessor route', () => {
  it('requires the admin token', async () => {
    const harness = createHarness();
    for (const req of [request(GATE, 'GET'), get(GATE, 'wrong')]) {
      const response = await worker.fetch(req, harness.env);
      expect(response.status).toBe(401);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
    expect(gateLines(harness)).toEqual([]);
  });

  it('answers a coherent sequencer-active predecessor with 200 and writes nothing', async () => {
    const context = await sequencedContext();
    const { harness, env } = sequencedHarness(context);
    const writes = context.storage.writeLog.length;
    const before = await context.port.readAuthority(SEASON);

    const response = await worker.fetch(get(GATE), env);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await body(response)).toMatchObject({
      data: {
        kind: 'coherent',
        season: SEASON,
        activeVersion: SEED_VERSION,
        classifiedRace: 'present',
        standings: 'non-empty',
      },
    });
    expect(context.storage.writeLog).toHaveLength(writes);
    expect(await context.port.readAuthority(SEASON)).toEqual(before);
    expect(gateLines(harness)).toEqual([
      expect.objectContaining({
        level: 'info',
        season: SEASON,
        releaseVersion: SEED_VERSION,
      }),
    ]);
  });

  it('answers an incoherent predecessor with 409 and a closed reason only', async () => {
    const context = await sequencedContext({
      seedTransform: (set: GeneratedSnapshotSet) => ({
        ...set,
        documents: set.documents.map((document) =>
          document.documentName === 'standings:constructors'
            ? { ...document, data: [] }
            : document,
        ),
      }),
    });
    const { harness, env } = sequencedHarness(context);

    const response = await worker.fetch(get(GATE), env);

    expect(response.status).toBe(409);
    const answer = await body(response);
    expect(answer.data).toEqual({
      kind: 'refused',
      season: SEASON,
      reason: 'standings-tables-disagree',
    });
    const lines = gateLines(harness);
    expect(lines).toEqual([
      expect.objectContaining({
        level: 'warn',
        season: SEASON,
        failureCategory: 'standings-tables-disagree',
      }),
    ]);
    // No row, identity or document content reaches the answer or the log.
    for (const text of [JSON.stringify(answer), harness.logger.serialized()]) {
      expect(text).not.toContain('max-verstappen');
      expect(text).not.toContain('mclaren');
      expect(text).not.toContain('points');
    }
  });

  it('refuses a Worker on the legacy authority without reading the legacy pointer', async () => {
    const harness = createHarness();
    const response = await worker.fetch(get(GATE), harness.env);
    expect(response.status).toBe(409);
    expect(await body(response)).toMatchObject({
      data: { kind: 'refused', reason: 'authority-not-sequenced' },
    });
  });

  it('refuses a selected sequencer with no binding', async () => {
    const harness = createHarness();
    const response = await worker.fetch(get(GATE), {
      ...harness.env,
      ENVIRONMENT: 'staging',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
    });
    expect(response.status).toBe(409);
    expect(await body(response)).toMatchObject({
      data: { kind: 'refused', reason: 'authority-unavailable' },
    });
  });

  it('accepts GET only', async () => {
    const context = await sequencedContext();
    const { env } = sequencedHarness(context);
    const response = await worker.fetch(
      adminRequest(GATE, 'local-test-token', { season: SEASON }),
      env,
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([PATH, `${PATH}?season=26`, `${PATH}?season=2026x`])(
    'refuses %s without inferring a season',
    async (path) => {
      const context = await sequencedContext();
      const { harness, env } = sequencedHarness(context);
      const response = await worker.fetch(get(path), env);
      expect(response.status).toBe(400);
      expect(await body(response)).toMatchObject({
        error: { code: 'INVALID_PARAMETER', message: 'invalid-season' },
      });
      expect(gateLines(harness)).toEqual([]);
    },
  );
});
