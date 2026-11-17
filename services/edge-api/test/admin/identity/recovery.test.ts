import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { harness, syntheticSeed, installation } from './support';
import { bindRequest } from '../../identity/catalog/u4-support';
import { IdentityCatalog } from '../../../src/identity/durable-object';
import * as originValidation from '../../../src/identity/catalog/validate';
import { catalogValidatorVersion } from '../../../src/identity/catalog/activation';

let seed: Awaited<ReturnType<typeof syntheticSeed>>;
let f: Awaited<ReturnType<typeof harness>>;
beforeAll(async () => {
  seed = await syntheticSeed();
}, 30000);
beforeEach(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw Error('U5 recovery network forbidden');
    }),
  );
  f = await harness(seed);
}, 30000);
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await f?.dispose();
  vi.unstubAllGlobals();
});

async function preparedActivation() {
  const review = await f.workflow.review(await bindRequest(f), f.cap);
  const revision = review.revision!;
  const path = '/revisions/' + revision.revisionId + '/activate';
  const validation = await f.call(
    '/revisions/' + revision.revisionId + '/validate',
    f.envelope({
      catalogHash: revision.contentHash,
      expectedValidatorVersion: catalogValidatorVersion,
    }),
    f.activator.token,
  );
  expect(validation.status).toBe(200);
  const certificate = (await validation.json()) as {
    data: { reportHash: string };
  };
  const request = f.envelope({
    catalogHash: revision.contentHash,
    validationReportHash: certificate.data.reportHash,
  });
  return { revision, path, request };
}
function authoritativeState() {
  const tables = f.host.db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'identity_%' AND name NOT IN ('identity_admin_rates','identity_admin_navigation') ORDER BY name",
    )
    .all() as { name: string }[];
  return Object.fromEntries(
    tables.map(({ name }) => [
      name,
      f.host.db.prepare('SELECT * FROM ' + name + ' ORDER BY rowid').all(),
    ]),
  );
}
function restartObject() {
  const object = new IdentityCatalog(
    { storage: f.host.storage },
    f.config,
    true,
  );
  vi.spyOn(f.namespace, 'get').mockReturnValue({
    fetch: (url, init) => object.fetch(new Request(url, init)),
  });
}
async function assertRecovery(
  p: Awaited<ReturnType<typeof preparedActivation>>,
) {
  restartObject();
  const lookup = await f.call(
    '/operations/' + p.request.operationId + '?family=activate',
    undefined,
    f.activator.token,
  );
  expect(lookup.status).toBe(200);
  expect(await lookup.json()).toMatchObject({
    data: {
      state: 'committed',
      result: {
        status: 200,
        data: {
          activeRevisionId: p.revision.revisionId,
          activationSequence: 2,
        },
      },
    },
  });
  const before = authoritativeState();
  for (let i = 0; i < 2; i++) {
    const replay = await f.call(p.path, p.request, f.activator.token);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      replayed: true,
      data: { activeRevisionId: p.revision.revisionId, activationSequence: 2 },
    });
  }
  const conflict = await f.call(
    p.path,
    { ...p.request, reason: 'Conflicting operation reuse' },
    f.activator.token,
  );
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toMatchObject({
    error: { code: 'IDEMPOTENCY_CONFLICT' },
  });
  expect((await f.call(p.path, p.request, f.reviewer.token)).status).toBe(403);
  expect((await f.call(p.path, p.request, 'invalid')).status).toBe(401);
  expect(authoritativeState()).toEqual(before);
  expect(f.workflow.head().activationSequence).toBe(2);
  expect(f.edge.provider.requestMetrics().lifetime.total).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
}

it('reuses only the byte-identical immutable origin proof across individually authenticated requests and revalidates after restart', async () => {
  const validation = vi.spyOn(originValidation, 'validateSeed');
  const path = '/revisions/' + f.root.revisionId;
  expect((await f.call(path, undefined, f.reader.token)).status).toBe(200);
  expect((await f.call(path, undefined, f.activator.token)).status).toBe(200);
  expect(validation).toHaveBeenCalledTimes(1);
  restartObject();
  expect((await f.call(path, undefined, f.reader.token)).status).toBe(200);
  expect(validation).toHaveBeenCalledTimes(2);
  expect(f.workflow.installation).toBe(installation);
});

it('rejects changed, malformed and missing origin bytes across requests without reusing a previous proof', async () => {
  const path = '/revisions/' + f.root.revisionId;
  expect((await f.call(path)).status).toBe(200);
  const before = authoritativeState();
  const original = (
    f.host.db
      .prepare('SELECT body FROM identity_catalog_origin WHERE id=1')
      .get() as { body: string }
  ).body;
  const altered = JSON.parse(original);
  altered.snapshot.drivers[0].profile.fullName = 'Corrupted origin';
  for (const body of [JSON.stringify(altered), '{', '{']) {
    f.host.db
      .prepare('UPDATE identity_catalog_origin SET body=? WHERE id=1')
      .run(body);
    expect((await f.call(path)).status).toBeGreaterThanOrEqual(400);
    expect(f.workflow.head().activeRevisionId).toBe(f.root.revisionId);
  }
  f.host.db
    .prepare('UPDATE identity_catalog_origin SET body=? WHERE id=1')
    .run(original);
  expect((await f.call(path)).status).toBe(200);
  f.host.db.prepare('DELETE FROM identity_catalog_origin WHERE id=1').run();
  expect((await f.call(path)).status).toBe(503);
  f.host.db
    .prepare('INSERT INTO identity_catalog_origin VALUES(1,?)')
    .run(original);
  expect((await f.call(path)).status).toBe(200);
  expect(authoritativeState()).toEqual(before);
});

it.each(['before-commit', 'after-commit'] as const)(
  'returns the unchanged 10-second timeout %s and recovers one activation with the same operation ID',
  async (phase) => {
    const p = await preparedActivation();
    const before = authoritativeState();
    const fetchObject = f.namespace.get().fetch;
    let release!: () => void, arrived!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      arrived = resolve;
    });
    let pending: Promise<Response> | undefined;
    const forwarding = vi.spyOn(f.namespace, 'get').mockReturnValue({
      fetch: (url, init) =>
        (pending = (async () => {
          if (phase === 'before-commit') {
            arrived();
            await gate;
          }
          const response = await fetchObject(url, init);
          if (phase === 'after-commit') {
            arrived();
            await gate;
          }
          return response;
        })()),
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const call = f.call(p.path, p.request, f.activator.token);
      await ready;
      await vi.advanceTimersByTimeAsync(9999);
      let settled = false;
      void call.then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const response = await call;
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        error: { code: 'CATALOG_UNAVAILABLE' },
      });
      if (phase === 'before-commit') {
        expect(authoritativeState()).toEqual(before);
        expect(f.workflow.head().activationSequence).toBe(1);
      } else {
        expect(f.workflow.head().activationSequence).toBe(2);
        expect(
          f.host.db
            .prepare(
              'SELECT COUNT(*) n FROM identity_admin_receipts WHERE id=?',
            )
            .get(p.request.operationId),
        ).toEqual({ n: 1 });
      }
    } finally {
      release();
      vi.useRealTimers();
      await pending;
      forwarding.mockRestore();
    }
    await assertRecovery(p);
  },
);

it('rolls back activation, candidate, audit, labels and both receipts on HTTP-receipt storage failure before retrying the unchanged operation', async () => {
  const p = await preparedActivation();
  const before = authoritativeState();
  f.host.db.exec(
    "CREATE TRIGGER u5_fail_receipt BEFORE INSERT ON identity_admin_receipts WHEN NEW.family='activate' BEGIN SELECT RAISE(ABORT,'injected-u5-receipt-failure'); END",
  );
  const response = await f.call(p.path, p.request, f.activator.token);
  expect(response.status).toBe(503);
  expect(authoritativeState()).toEqual(before);
  f.host.db.exec('DROP TRIGGER u5_fail_receipt');
  restartObject();
  const unknown = await f.call(
    '/operations/' + p.request.operationId + '?family=activate',
    undefined,
    f.activator.token,
  );
  expect(await unknown.json()).toMatchObject({ data: { state: 'unknown' } });
  expect((await f.call(p.path, p.request, f.activator.token)).status).toBe(200);
  await assertRecovery(p);
});

it('activates through the real SQLite API under controlled digest queue contention without repeating the immutable origin proof', async () => {
  const p = await preparedActivation();
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  const proof = vi.spyOn(originValidation, 'validateSeed');
  const delayed = vi
    .spyOn(crypto.subtle, 'digest')
    .mockImplementation(async (...args) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      return digest(...args);
    });
  try {
    const response = await f.call(p.path, p.request, f.activator.token);
    expect(response.status).toBe(200);
    expect(proof).not.toHaveBeenCalled();
  } finally {
    delayed.mockRestore();
    proof.mockRestore();
  }
  await assertRecovery(p);
});
