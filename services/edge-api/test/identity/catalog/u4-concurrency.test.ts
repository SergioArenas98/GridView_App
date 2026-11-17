import { beforeAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { CatalogWorkflow } from '../../../src/identity/catalog/workflow';
import type { SeedArtifact } from '../../../src/identity/catalog/model';
import { sqliteHost } from './sqlite-support';
import {
  setup,
  bindRequest,
  newDriverRequest,
  operation,
  validateAndActivate,
  installation,
} from './u4-support';
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
it('serializes concurrent candidate reviews and conflicting targets without last-writer-wins', async () => {
  const h = sqliteHost();
  try {
    const f = await setup(h.storage, seed),
      r = await bindRequest(f),
      other = await bindRequest(
        f,
        'synthetic_u4_driver',
        f.root.snapshot.drivers[1]!.anchor.driverId,
      );
    const results = await Promise.allSettled([
      f.workflow.review(r, f.cap),
      f.workflow.review(other, f.cap),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(
      rejected?.status === 'rejected' &&
        rejected.reason instanceof Error &&
        rejected.reason.message,
    ).toContain('candidate-evidence-conflict');
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_catalog_revisions').get()!
        .n,
    ).toBe(2);
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_catalog_decisions').get()!
        .n,
    ).toBe(2);
  } finally {
    h.db.close();
  }
});
it('reserves one canonical ID across different candidates and never silently reuses it', async () => {
  const h = sqliteHost();
  try {
    const f = await setup(h.storage, seed),
      a = await newDriverRequest(f, 'synthetic_first'),
      b = await newDriverRequest(f, 'synthetic_second');
    const result = await Promise.allSettled([
      f.workflow.review(a, f.cap),
      f.workflow.review(b, f.cap),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_catalog_anchors').get()!.n,
    ).toBe(34);
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_catalog_labels').get()!.n,
    ).toBe(2);
  } finally {
    h.db.close();
  }
});
it('gives concurrent proposals unique reserved labels, activates exactly one, and durably marks the loser stale', async () => {
  const h = sqliteHost();
  try {
    const f = await setup(h.storage, seed),
      a = await bindRequest(f, 'synthetic_first'),
      b = await bindRequest(f, 'synthetic_second');
    const proposals = await Promise.all([
      f.workflow.review(a, f.cap),
      f.workflow.review(b, f.cap),
    ]);
    expect(
      new Set(
        proposals.map(
          (p) => p.revision!.snapshot.seasonContent[0]!.datasetVersion,
        ),
      ).size,
    ).toBe(2);
    const requests = await Promise.all(
      proposals.map(async (p) => {
        const cmd = operation(f, p.revision!.revisionId),
          cert = await f.workflow.validate(cmd, f.cap);
        expect(cert.valid).toBe(true);
        return {
          ...cmd,
          operationId: crypto.randomUUID(),
          certificateId: cert.certificateId,
        };
      }),
    );
    const results = await Promise.all(
      requests.map((r) => f.workflow.activate(r, f.cap)),
    );
    expect(results.map((r) => r.outcome).sort()).toEqual([
      'activated',
      'conflict',
    ]);
    expect(f.workflow.head().activationSequence).toBe(2);
    const winner = results.find((r) => r.outcome === 'activated')!,
      loser = results.find((r) => r.outcome === 'conflict')!;
    expect(f.workflow.status(winner.revisionId)).toBe('activated');
    expect(f.workflow.status(loser.revisionId)).toBe('stale');
    expect(
      (await f.workflow.readRevision(f.root.revisionId)).snapshot.bindings,
    ).toHaveLength(94);
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_catalog_seasons').get()!.n,
    ).toBe(2);
    const retry = new CatalogWorkflow(h.storage, installation, f.authority);
    for (let i = 0; i < requests.length; i++)
      expect(await retry.activate(requests[i]!, f.cap)).toEqual(results[i]);
    const other = await bindRequest(f, 'synthetic_third');
    other.expectedActiveRevisionId = f.root.revisionId;
    other.expectedActivationSequence = 1;
    await expect(f.workflow.review(other, f.cap)).rejects.toThrow(
      'CATALOG_HEAD_CONFLICT',
    );
    await f.workflow.abandon(operation(f, loser.revisionId), f.cap);
    expect(f.workflow.status(loser.revisionId)).toBe('abandoned');
  } finally {
    h.db.close();
  }
});
it('recovers one activation for concurrent identical retries and refuses changed operation content', async () => {
  const h = sqliteHost();
  try {
    const f = await setup(h.storage, seed),
      r = await bindRequest(f),
      p = await f.workflow.review(r, f.cap),
      cmd = operation(f, p.revision!.revisionId),
      cert = await f.workflow.validate(cmd, f.cap),
      request = {
        ...cmd,
        operationId: crypto.randomUUID(),
        certificateId: cert.certificateId,
      };
    const results = await Promise.all([
      f.workflow.activate(request, f.cap),
      f.workflow.activate(request, f.cap),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(f.workflow.head().activationSequence).toBe(2);
    await expect(
      f.workflow.activate(
        { ...request, certificateId: crypto.randomUUID() },
        f.cap,
      ),
    ).rejects.toThrow('operation-content-conflict');
    expect(
      h.db
        .prepare(
          "SELECT COUNT(*) n FROM identity_catalog_operations WHERE family='activate'",
        )
        .get()!.n,
    ).toBe(2);
  } finally {
    h.db.close();
  }
});
it('does not allocate versions for evidence or dispositions, refuses clock regression and retains abandoned suffixes', async () => {
  let now = Date.parse('2026-11-14T12:00:00.000Z');
  const h = sqliteHost();
  try {
    const f = await setup(h.storage, seed, () => now),
      r = await bindRequest(f, 'synthetic_first');
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_catalog_labels').get()!.n,
    ).toBe(1);
    const p = await f.workflow.review(r, f.cap);
    expect(p.revision!.snapshot.seasonContent[0]!.datasetVersion).toBe(
      '2026.11.14.1',
    );
    await f.workflow.abandon(operation(f, p.revision!.revisionId), f.cap);
    now = Date.parse('2026-11-13T12:00:00.000Z');
    const b = await bindRequest(f, 'synthetic_second');
    await expect(f.workflow.review(b, f.cap)).rejects.toThrow(
      'dataset-clock-regression',
    );
    now = Date.parse('2026-11-14T12:00:00.000Z');
    const next = await f.workflow.review(b, f.cap);
    expect(next.revision!.snapshot.seasonContent[0]!.datasetVersion).toBe(
      '2026.11.14.2',
    );
    await validateAndActivate(f, next.revision!.revisionId);
    expect(
      h.db
        .prepare(
          'SELECT label FROM identity_catalog_labels ORDER BY date,suffix',
        )
        .all()
        .map((r) => r.label),
    ).toEqual(['2026.10.07.1', '2026.11.14.1', '2026.11.14.2']);
  } finally {
    h.db.close();
  }
});
