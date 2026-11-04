/**
 * `SEASON_INGEST_TOKEN`: the scoped credential an automatic season-batch
 * submitter outside Cloudflare uses instead of `ADMIN_TOKEN`. Driven through
 * the real Worker entry point. It must open exactly the cutover-status read and
 * the season ingest, in staging only, and nothing else anywhere.
 */

import { describe, expect, it } from 'vitest';

import {
  isSeasonIngestScope,
  minimumScopedTokenLength,
  seasonIngestAuthOk,
} from '../../src/admin/auth';
import worker, { type Env } from '../../src/index';
import { createHarness } from '../support/edge-harness';

const ADMIN = 'local-test-token';
const SCOPED = 's'.repeat(40);

function env(overrides: Partial<Env> = {}): Env {
  return {
    ...createHarness().env,
    ENVIRONMENT: 'staging',
    SEASON_INGEST_TOKEN: SCOPED,
    ...overrides,
  };
}

function call(method: string, path: string, token: string): Request {
  return new Request(`https://api.gridview.local${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    ...(method === 'POST' ? { body: '{not json' } : {}),
  });
}

async function status(
  environment: Env,
  method: string,
  path: string,
  token = SCOPED,
) {
  return (await worker.fetch(call(method, path, token), environment)).status;
}

const STATUS = '/internal/admin/publication/cutover/status?season=2026';
const INGEST = '/internal/admin/season/ingest';

describe('SEASON_INGEST_TOKEN', () => {
  it('opens the cutover-status read and the season ingest in staging', async () => {
    expect(await status(env(), 'GET', STATUS)).not.toBe(401);
    // The ingest itself then refuses (no SEASON_BATCH_INGEST here) without
    // reading the body: authorization passed, admission did not.
    const response = await worker.fetch(call('POST', INGEST, SCOPED), env());
    expect(response.status).toBe(409);
    expect(
      ((await response.json()) as { data: { stage: string } }).data.stage,
    ).toBe('admission');
  });

  it.each([
    ['GET', '/internal/admin/sync/status?season=2026'],
    ['POST', '/internal/admin/sync/full?season=2026'],
    ['GET', '/internal/admin/reconciliation?season=2026'],
    ['GET', '/internal/admin/quota'],
    ['POST', '/internal/admin/publication/cutover/status?season=2026'],
    ['GET', INGEST],
    ['POST', '/internal/admin/season/ingest/'],
    ['POST', '/internal/admin/season/%69ngest'],
    ['POST', '/internal/admin/publication/cutover/activate?season=2026'],
  ])('opens nothing else: %s %s is 401', async (method, path) => {
    expect(await status(env(), method, path)).toBe(401);
  });

  it.each(['production', 'e2e', 'development'])(
    'is ignored in %s',
    async (environment) => {
      const other = env({ ENVIRONMENT: environment });
      expect(seasonIngestAuthOk(call('GET', STATUS, SCOPED), other)).toBe(
        false,
      );
      expect(seasonIngestAuthOk(call('POST', INGEST, SCOPED), other)).toBe(
        false,
      );
      // End to end the request is never authorized (the harness answers
      // production before routing; the others reach the 401).
      expect(await status(other, 'GET', STATUS)).not.toBe(200);
      if (environment !== 'production') {
        expect(await status(other, 'POST', INGEST)).toBe(401);
      }
    },
  );

  it('is ignored when short, unset, or equal to ADMIN_TOKEN', async () => {
    const short = 's'.repeat(minimumScopedTokenLength - 1);
    expect(
      await status(env({ SEASON_INGEST_TOKEN: short }), 'GET', STATUS, short),
    ).toBe(401);
    expect(
      await status(
        env({ SEASON_INGEST_TOKEN: undefined }),
        'GET',
        STATUS,
        SCOPED,
      ),
    ).toBe(401);
    const same = 'a'.repeat(40);
    const shared = env({ ADMIN_TOKEN: same, SEASON_INGEST_TOKEN: same });
    expect(seasonIngestAuthOk(call('GET', STATUS, same), shared)).toBe(false);
  });

  it('a wrong or missing bearer is 401, and ADMIN_TOKEN still opens everything', async () => {
    expect(await status(env(), 'GET', STATUS, 'x'.repeat(40))).toBe(401);
    const bare = new Request(`https://api.gridview.local${STATUS}`);
    expect((await worker.fetch(bare, env())).status).toBe(401);
    expect(
      await status(
        env(),
        'GET',
        '/internal/admin/sync/status?season=2026',
        ADMIN,
      ),
    ).not.toBe(401);
    expect(await status(env(), 'GET', STATUS, ADMIN)).not.toBe(401);
  });

  it('names exactly two requests', () => {
    expect(
      isSeasonIngestScope('GET', '/internal/admin/publication/cutover/status'),
    ).toBe(true);
    expect(isSeasonIngestScope('POST', '/internal/admin/season/ingest')).toBe(
      true,
    );
    expect(
      isSeasonIngestScope('HEAD', '/internal/admin/publication/cutover/status'),
    ).toBe(false);
    expect(isSeasonIngestScope('PUT', '/internal/admin/season/ingest')).toBe(
      false,
    );
  });
});
