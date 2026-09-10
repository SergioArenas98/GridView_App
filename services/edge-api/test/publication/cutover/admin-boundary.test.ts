/**
 * The internal cutover routes, driven through the real Worker entry point.
 *
 * Everything here goes through `worker.fetch`, so the composition root, the
 * admin authentication, the cutover control resolution and the response headers
 * are the real ones - not a service constructed by hand.
 *
 * The default env has no `SEASON_PUBLICATION_CUTOVER_CONTROL` and no
 * `SEASON_PUBLICATION_AUTHORITY`, which is exactly what every committed
 * environment has, so these tests also demonstrate what an operator would get
 * today: `disabled`, from an authenticated request, with nothing read.
 */

import { describe, expect, it } from 'vitest';

import worker, { type Env } from '../../../src/index';
import {
  adminRequest,
  createHarness,
  request,
  seedPublishedSnapshot,
  type EdgeHarness,
} from '../../support/edge-harness';
import {
  ACTIVE_VERSION,
  EVIDENCE_REFERENCE,
  MIGRATION_IDENTITY,
  OTHER_SEASON,
  SEASON,
  immediateRetry,
  inProcessPort,
} from './support';

const STATUS = `/internal/admin/publication/cutover/status?season=${SEASON}`;
const SEED = '/internal/admin/publication/cutover/seed';
const ACTIVATE = '/internal/admin/publication/cutover/activate';

function cutoverEnv(harness: EdgeHarness, overrides: Partial<Env> = {}): Env {
  return { ...harness.env, ...overrides };
}

const checkpointBody = {
  season: SEASON,
  activeVersion: ACTIVE_VERSION,
  migrationIdentity: MIGRATION_IDENTITY,
  historicalFloorEvidence: {
    kind: 'no-retained-pre-cutover-client-state',
    evidenceReference: EVIDENCE_REFERENCE,
  },
};

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('authentication is mandatory on every cutover route', () => {
  it('rejects an unauthenticated or wrongly authenticated request', async () => {
    const harness = createHarness();
    const cases: [string, Request][] = [
      ['status', request(STATUS, 'GET')],
      ['seed', request(SEED, 'POST')],
      ['activate', request(ACTIVATE, 'POST')],
      ['status-wrong-token', adminRequest(STATUS, 'wrong', undefined, 'GET')],
      ['seed-wrong-token', adminRequest(SEED, 'wrong', { x: 1 })],
      ['activate-wrong-token', adminRequest(ACTIVATE, 'wrong', { x: 1 })],
    ];
    for (const [name, req] of cases) {
      const response = await worker.fetch(req, harness.env);
      expect(response.status, name).toBe(401);
      expect(response.headers.get('Cache-Control'), name).toBe('no-store');
    }
  });
});

describe('the default deployment reports disabled', () => {
  it('answers an authenticated status request with disabled', async () => {
    const harness = createHarness();
    const response = await worker.fetch(
      adminRequest(STATUS, 'local-test-token', undefined, 'GET'),
      harness.env,
    );
    expect(response.status).toBe(200);
    expect(await body(response)).toMatchObject({
      data: { state: 'disabled' },
    });
  });

  it('refuses seed and activate with a bounded disabled result', async () => {
    const harness = createHarness();
    for (const [path, payload] of [
      [SEED, { checkpoint: checkpointBody }],
      [ACTIVATE, { checkpoint: checkpointBody, confirmActivation: true }],
    ] as const) {
      const response = await worker.fetch(
        adminRequest(path, 'local-test-token', payload),
        harness.env,
      );
      expect(response.status).toBe(409);
      expect(await body(response)).toMatchObject({
        data: { kind: 'refused', refusal: 'disabled' },
      });
    }
  });
});

describe('the routes are bounded at the boundary', () => {
  const env = (harness: EdgeHarness): Env =>
    cutoverEnv(harness, {
      ENVIRONMENT: 'staging',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_PUBLICATION_CUTOVER_CONTROL: `seed:${SEASON}`,
      __SEASON_PUBLICATION_SEQUENCER: inProcessPort(),
      __CUTOVER_RETRY: immediateRetry,
    });

  it('refuses a wrong method with 405 and no-store', async () => {
    const harness = createHarness();
    for (const [path, method] of [
      [STATUS, 'POST'],
      [SEED, 'GET'],
      [ACTIVATE, 'GET'],
    ] as const) {
      const response = await worker.fetch(
        adminRequest(path, 'local-test-token', undefined, method),
        env(harness),
      );
      expect(response.status).toBe(405);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('refuses a malformed season on the status route', async () => {
    const harness = createHarness();
    for (const query of ['', '?season=', '?season=26', '?season=abcd']) {
      const response = await worker.fetch(
        adminRequest(
          `/internal/admin/publication/cutover/status${query}`,
          'local-test-token',
          undefined,
          'GET',
        ),
        env(harness),
      );
      expect(response.status).toBe(400);
      expect(await body(response)).toMatchObject({
        error: { code: 'INVALID_PARAMETER' },
      });
    }
  });

  it('refuses malformed JSON and a malformed checkpoint', async () => {
    const harness = createHarness();
    const malformedJson = request(SEED, 'POST', {
      headers: {
        Authorization: 'Bearer local-test-token',
        'Content-Type': 'application/json',
      },
      body: '{ not json',
    });
    expect((await worker.fetch(malformedJson, env(harness))).status).toBe(400);

    for (const payload of [
      {},
      { checkpoint: null },
      { checkpoint: { season: SEASON } },
      { checkpoint: { ...checkpointBody, season: 12 } },
      { checkpoint: { ...checkpointBody, historicalFloorEvidence: true } },
      {
        checkpoint: {
          ...checkpointBody,
          historicalFloorEvidence: { kind: 'listVersions-scan' },
        },
      },
    ]) {
      const response = await worker.fetch(
        adminRequest(SEED, 'local-test-token', payload),
        env(harness),
      );
      expect(response.status).toBe(400);
      expect(await body(response)).toMatchObject({
        error: { code: 'INVALID_PARAMETER' },
      });
    }
  });

  it('never accepts a truthy stand-in for the activation confirmation', async () => {
    const harness = createHarness();
    for (const confirmActivation of [undefined, 'true', 1, {}, 'yes']) {
      const response = await worker.fetch(
        adminRequest(ACTIVATE, 'local-test-token', {
          checkpoint: checkpointBody,
          confirmActivation,
        }),
        cutoverEnv(harness, {
          ENVIRONMENT: 'staging',
          SEASON_PUBLICATION_AUTHORITY: 'sequencer',
          SEASON_PUBLICATION_CUTOVER_CONTROL: `activate:${SEASON}`,
          __SEASON_PUBLICATION_SEQUENCER: inProcessPort(),
          __CUTOVER_RETRY: immediateRetry,
        }),
      );
      expect(response.status).toBe(409);
      expect(await body(response)).toMatchObject({
        data: { kind: 'failed', failure: 'activation-not-confirmed' },
      });
    }
  });

  it('serves every cutover response no-store', async () => {
    const harness = createHarness();
    const responses = [
      await worker.fetch(
        adminRequest(STATUS, 'local-test-token', undefined, 'GET'),
        env(harness),
      ),
      await worker.fetch(
        adminRequest(SEED, 'local-test-token', { checkpoint: checkpointBody }),
        env(harness),
      ),
      await worker.fetch(
        adminRequest(ACTIVATE, 'local-test-token', {
          checkpoint: checkpointBody,
          confirmActivation: true,
        }),
        env(harness),
      ),
    ];
    for (const response of responses) {
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('CDN-Cache-Control')).toBeNull();
      expect(response.headers.get('ETag')).toBeNull();
    }
  });

  it('names the season explicitly rather than inheriting the current one', async () => {
    const harness = createHarness();
    // `meta:current-season` is never consulted: a body naming another season is
    // refused as not-paused rather than quietly retargeted at the paused one.
    const response = await worker.fetch(
      adminRequest(SEED, 'local-test-token', {
        checkpoint: { ...checkpointBody, season: OTHER_SEASON },
      }),
      env(harness),
    );
    expect(await body(response)).toMatchObject({
      data: { kind: 'refused', refusal: 'season-not-paused' },
    });
  });
});

describe('a receipt round-trips from seed to activation', () => {
  it('seeds through the route, then activates with the receipt it returned', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const activeVersion = await harness.storage.getActiveVersion(SEASON);
    expect(activeVersion).not.toBeNull();
    // One in-process sequencer shared by both phases, exactly as one deployed
    // Durable Object would be.
    const port = inProcessPort();

    const seeded = await worker.fetch(
      adminRequest(SEED, 'local-test-token', {
        checkpoint: { ...checkpointBody, activeVersion },
      }),
      cutoverEnv(harness, {
        ENVIRONMENT: 'staging',
        SEASON_PUBLICATION_AUTHORITY: 'sequencer',
        SEASON_PUBLICATION_CUTOVER_CONTROL: `seed:${SEASON}`,
        __SEASON_PUBLICATION_SEQUENCER: port,
        __CUTOVER_RETRY: immediateRetry,
      }),
    );
    expect(seeded.status).toBe(200);
    const seedResult = (
      (await body(seeded)) as {
        data: {
          kind: string;
          receipt: { checkpoint: unknown; cutoverFingerprint: string };
        };
      }
    ).data;
    expect(seedResult.kind).toBe('seeded');
    const receipt = seedResult.receipt;
    // The receipt carries no operation token and no secret.
    expect(JSON.stringify(receipt)).not.toContain('operationToken');
    expect(JSON.stringify(receipt)).not.toContain('local-test-token');

    const activateEnv = cutoverEnv(harness, {
      ENVIRONMENT: 'staging',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_PUBLICATION_CUTOVER_CONTROL: `activate:${SEASON}`,
      __SEASON_PUBLICATION_SEQUENCER: port,
      __CUTOVER_RETRY: immediateRetry,
    });

    // An altered receipt cannot activate: the recomputed fingerprint differs.
    const altered = await worker.fetch(
      adminRequest(ACTIVATE, 'local-test-token', {
        checkpoint: {
          ...(receipt.checkpoint as Record<string, unknown>),
          migrationIdentity: 'cutover-2026-staging-99',
        },
        confirmActivation: true,
      }),
      activateEnv,
    );
    expect(altered.status).toBe(409);
    expect(await body(altered)).toMatchObject({
      data: { kind: 'failed', failure: 'cutover-fingerprint-mismatch' },
    });

    const activated = await worker.fetch(
      adminRequest(ACTIVATE, 'local-test-token', {
        checkpoint: receipt.checkpoint,
        confirmActivation: true,
      }),
      activateEnv,
    );
    expect(activated.status).toBe(200);
    expect(await body(activated)).toMatchObject({
      data: {
        kind: 'activated',
        receipt: {
          outcome: 'activated',
          cutoverState: 'active',
          cutoverFingerprint: receipt.cutoverFingerprint,
        },
      },
    });
  });
});

describe('a misconfigured control does not silently disable anything', () => {
  it('fails the request as a bounded configuration error', async () => {
    const harness = createHarness();
    const response = await worker.fetch(
      adminRequest(STATUS, 'local-test-token', undefined, 'GET'),
      cutoverEnv(harness, {
        SEASON_PUBLICATION_CUTOVER_CONTROL: 'seed:20xx',
      }),
    );
    expect(response.status).toBe(500);
    expect(await body(response)).toMatchObject({
      error: { message: 'The service is not correctly configured.' },
    });
    expect(harness.logger.serialized()).toContain('"configuration"');
  });
});

describe('nothing sensitive reaches a response or a log line', () => {
  it('never echoes the admin token or a raw body', async () => {
    const secret = 'very-secret-cutover-token';
    const harness = createHarness({ adminToken: secret });
    const response = await worker.fetch(
      adminRequest(SEED, secret, {
        checkpoint: {
          ...checkpointBody,
          migrationIdentity: 'cutover-with-a-distinctive-identity',
        },
      }),
      cutoverEnv(harness, {
        ENVIRONMENT: 'staging',
        ADMIN_TOKEN: secret,
        SEASON_PUBLICATION_AUTHORITY: 'sequencer',
        SEASON_PUBLICATION_CUTOVER_CONTROL: `seed:${SEASON}`,
        __SEASON_PUBLICATION_SEQUENCER: inProcessPort(),
        __CUTOVER_RETRY: immediateRetry,
      }),
    );
    const text = JSON.stringify(await body(response));
    expect(text).not.toContain(secret);
    const logs = harness.logger.serialized();
    expect(logs).not.toContain(secret);
    // The request body is never logged, only bounded categories.
    expect(logs).not.toContain('cutover-with-a-distinctive-identity');
  });
});

describe('the public contract is untouched', () => {
  it('serves no cutover route publicly', async () => {
    const harness = createHarness();
    for (const path of [
      '/v1/publication/cutover/status',
      '/publication/cutover/seed',
    ]) {
      const response = await worker.fetch(request(path), harness.env);
      expect(response.status).toBe(404);
    }
  });
});
