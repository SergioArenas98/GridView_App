/**
 * The ingest route's admission, driven through the real Worker entry point
 * with the attribution record exactly as committed: authentication, the
 * composition root and the response headers are the real ones.
 *
 * Every committed environment leaves `SEASON_BATCH_INGEST` unset, so the
 * route admits nothing anywhere - and refuses before it reads a byte of the
 * body. The committed record calls Jolpica `active` (`data-sources-v2`), so
 * once a staging Worker is fully configured the attribution gate passes.
 */

import { describe, expect, it } from 'vitest';

import worker, { type Env } from '../../src/index';
import { adminRequest, createHarness, request } from '../support/edge-harness';
import { sequencedContext } from '../publication/sequenced/support';

const PATH = '/internal/admin/season/ingest';

/** A POST whose body is never valid; a refusal must not even read it. */
function unreadPost(token = 'local-test-token'): Request {
  return new Request(`https://api.gridview.local${PATH}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: '{not json',
  });
}

async function refusal(env: Env): Promise<{ status: number; data: unknown }> {
  const post = unreadPost();
  const response = await worker.fetch(post, env);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(post.bodyUsed).toBe(false);
  const body = (await response.json()) as { data: unknown };
  return { status: response.status, data: body.data };
}

function admission(reason: string) {
  return {
    status: 409,
    data: { outcome: 'refused', stage: 'admission', reason },
  };
}

async function stagingSequencer(overrides: Partial<Env> = {}): Promise<Env> {
  const context = await sequencedContext();
  const harness = createHarness({ storage: context.storage });
  return {
    ...harness.env,
    ENVIRONMENT: 'staging',
    SEASON_PUBLICATION_AUTHORITY: 'sequencer',
    __SEASON_PUBLICATION_SEQUENCER: context.port,
    SEASON_BATCH_INGEST: '2026',
    ...overrides,
  };
}

describe('the season ingest route: admission', () => {
  it('requires the admin token', async () => {
    const harness = createHarness();
    for (const req of [
      request(PATH, 'POST'),
      adminRequest(PATH, 'wrong', {}),
    ]) {
      const response = await worker.fetch(req, harness.env);
      expect(response.status).toBe(401);
    }
  });

  it('accepts POST only', async () => {
    const response = await worker.fetch(
      adminRequest(PATH, undefined, undefined, 'GET'),
      createHarness().env,
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
  });

  it('is disabled while SEASON_BATCH_INGEST is unset', async () => {
    expect(await refusal(createHarness().env)).toEqual(
      admission('ingest-disabled'),
    );
    expect(
      await refusal(await stagingSequencer({ SEASON_BATCH_INGEST: '' })),
    ).toEqual(admission('ingest-disabled'));
  });

  it('refuses a value that is not a curated season', async () => {
    for (const value of ['abcd', '2026 ', '2099']) {
      expect(
        await refusal(await stagingSequencer({ SEASON_BATCH_INGEST: value })),
      ).toEqual(admission('ingest-misconfigured'));
    }
  });

  it('admits nothing in development, and production only under a genesis control', async () => {
    const development = createHarness();
    expect(
      await refusal({ ...development.env, SEASON_BATCH_INGEST: '2026' }),
    ).toEqual(admission('environment-not-permitted'));
    // Production passes the environment check (ADR 0025 D12, "Amendment
    // (2026-10-20)") and is still refused: no `genesis:2026` control names the
    // season, and there is no legacy ingest path.
    const production = createHarness({
      environment: 'production',
      providerMode: 'none',
    });
    expect(
      await refusal({ ...production.env, SEASON_BATCH_INGEST: '2026' }),
    ).toEqual(admission('genesis-control-required'));
  });

  it('admits nothing beside a coordinated provider budget', async () => {
    expect(
      await refusal(await stagingSequencer({ PROVIDER_MODE: 'coordinated' })),
    ).toEqual(admission('provider-mode-coordinated'));
  });

  it('admits nothing without the guarded sequencer', async () => {
    expect(
      await refusal(
        await stagingSequencer({ SEASON_PUBLICATION_AUTHORITY: undefined }),
      ),
    ).toEqual(admission('authority-not-sequenced'));
  });

  it('admits a fully configured staging Worker with the committed record, and only then reads the body', async () => {
    const post = unreadPost();
    const response = await worker.fetch(post, await stagingSequencer());
    expect(post.bodyUsed).toBe(true);
    expect(response.status).toBe(400);
    expect(((await response.json()) as { data: unknown }).data).toEqual({
      outcome: 'refused',
      stage: 'request',
      reason: 'submission-malformed',
    });
  });
});
