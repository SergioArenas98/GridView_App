import { beforeAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { CatalogWorkflow } from '../../../src/identity/catalog/workflow';
import { IdentityStore } from '../../../src/identity/store';
import type { IdentityStorage } from '../../../src/identity/schema';
import type { SeedArtifact } from '../../../src/identity/catalog/model';
import {
  catalogTables,
  catalogMigration,
} from '../../../src/identity/catalog/schema';
import { sqliteHost } from './sqlite-support';
import {
  setup,
  bindRequest,
  operation,
  installation,
  candidate,
} from './u4-support';
import { localAuthority } from './u4-authority';
let seed: SeedArtifact;
beforeAll(async () => {
  seed = await prepareSeed(loadCorpus());
});
beforeEach(() =>
  vi.stubGlobal('fetch', () => {
    throw Error('U4 network forbidden');
  }),
);
afterEach(() => vi.unstubAllGlobals());
function faultStorage(
  storage: IdentityStorage,
  qualifies = (q: string) => /^(INSERT|UPDATE|DELETE|CREATE)/.test(q),
) {
  let at: number | null = null,
    writes = 0;
  return {
    storage: {
      transactionSync: <T>(fn: () => T) => storage.transactionSync(fn),
      sql: {
        exec(q: string, ...args: (string | number | null)[]) {
          if (qualifies(q)) {
            writes++;
            if (writes === at) throw Error('injected-u4-write-' + writes);
          }
          return storage.sql.exec(q, ...args);
        },
      },
    } satisfies IdentityStorage,
    fail(n: number | null) {
      at = n;
      writes = 0;
    },
    count: () => writes,
  };
}
function dump(h: ReturnType<typeof sqliteHost>) {
  return Object.fromEntries(
    [
      'identity_candidates',
      'identity_evidence',
      'identity_observations',
      'identity_notifications',
      'identity_receipts',
      ...catalogTables.map((t) => 'identity_catalog_' + t),
    ].map((t) => [
      t,
      h.db.prepare('SELECT * FROM ' + t + ' ORDER BY rowid').all(),
    ]),
  );
}
it('rolls back at every activation write including audit and durable receipt, then retries the same operation once', async () => {
  const h = sqliteHost(),
    fault = faultStorage(h.storage);
  try {
    const f = await setup(fault.storage, seed),
      r = await bindRequest(f),
      p = await f.workflow.review(r, f.cap),
      cmd = operation(f, p.revision!.revisionId),
      cert = await f.workflow.validate(cmd, f.cap),
      request = {
        ...cmd,
        operationId: crypto.randomUUID(),
        certificateId: cert.certificateId,
      };
    const before = dump(h);
    // Seven authoritative writes: head, status, key reservation, season record,
    // candidate, audit, receipt. Every interruption must leave identical bytes.
    for (let n = 1; n <= 7; n++) {
      fault.fail(n);
      await expect(f.workflow.activate(request, f.cap)).rejects.toThrow(
        'injected-u4-write-' + n,
      );
      expect(dump(h)).toEqual(before);
      fault.fail(null);
      const restarted = new CatalogWorkflow(
        fault.storage,
        installation,
        f.authority,
      );
      expect(restarted.head().activationSequence).toBe(1);
    }
    fault.fail(null);
    const result = await f.workflow.activate(request, f.cap);
    expect(result.outcome).toBe('activated');
    expect(fault.count()).toBe(7);
    fault.fail(null);
    expect(await f.workflow.activate(request, f.cap)).toEqual(result);
    expect(fault.count()).toBe(0);
  } finally {
    h.db.close();
  }
});
it('rolls back every additive migration statement and preserves pre-existing U2 records before retry', async () => {
  const h = sqliteHost();
  try {
    const u2 = new IdentityStore(h.storage, installation);
    await candidate(u2);
    const before = h.db.prepare('SELECT * FROM identity_candidates').all(),
      a = localAuthority();
    const fault = faultStorage(
      h.storage,
      (q) => /^(INSERT|CREATE)/.test(q) && q.includes('identity_catalog_'),
    );
    // migration-table creation, eighteen new tables and migration receipt.
    for (let n = 1; n <= catalogMigration.length + 2; n++) {
      fault.fail(n);
      expect(
        () => new CatalogWorkflow(fault.storage, installation, a.authority),
      ).toThrow('injected-u4-write-' + n);
      expect(h.db.prepare('SELECT * FROM identity_candidates').all()).toEqual(
        before,
      );
      expect(
        h.db
          .prepare(
            "SELECT name FROM sqlite_master WHERE name LIKE 'identity_catalog_%'",
          )
          .all(),
      ).toEqual([]);
    }
    fault.fail(null);
    const workflow = new CatalogWorkflow(
      fault.storage,
      installation,
      a.authority,
    );
    expect(workflow.head().activeRevisionId).toBeNull();
    expect(h.db.prepare('SELECT * FROM identity_candidates').all()).toEqual(
      before,
    );
  } finally {
    h.db.close();
  }
});
it('rolls back approval, reserved labels, candidate transition and audit on interrupted proposal admission', async () => {
  const h = sqliteHost(),
    fault = faultStorage(h.storage);
  try {
    const f = await setup(fault.storage, seed),
      request = await bindRequest(f),
      before = dump(h);
    fault.fail(5);
    await expect(f.workflow.review(request, f.cap)).rejects.toThrow(
      'injected-u4-write-5',
    );
    expect(dump(h)).toEqual(before);
    fault.fail(null);
    const review = await f.workflow.review(request, f.cap);
    expect(review.revision!.snapshot.seasonContent[0]!.datasetVersion).toBe(
      '2026.11.14.1',
    );
  } finally {
    h.db.close();
  }
});
