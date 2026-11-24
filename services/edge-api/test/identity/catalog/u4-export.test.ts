import { it, expect, vi } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { verifyRevisionExport } from '../../../src/identity/catalog/revision-export';
import { sqliteHost } from './sqlite-support';
import { setup, bindRequest, validateAndActivate } from './u4-support';
it('reimports complete revision exports offline and detects historical decision, evidence and profile corruption', async () => {
  vi.stubGlobal('fetch', () => {
    throw Error('U4 network forbidden');
  });
  const h = sqliteHost();
  try {
    const f = await setup(h.storage, await prepareSeed(loadCorpus()));
    expect(
      await verifyRevisionExport(
        await f.workflow.exportRevision(f.root.revisionId),
      ),
    ).toEqual(f.root);
    const r1 = await bindRequest(f, 'synthetic_export_one'),
      p1 = (await f.workflow.review(r1, f.cap)).revision!;
    await validateAndActivate(f, p1.revisionId);
    const r2 = await bindRequest(f, 'synthetic_export_two'),
      p2 = (await f.workflow.review(r2, f.cap)).revision!;
    const exported = await f.workflow.exportRevision(p2.revisionId);
    expect(await verifyRevisionExport(exported)).toEqual(p2);
    const parsed = JSON.parse(exported);
    expect(parsed.history).toHaveLength(3);
    expect(parsed.decisions).toHaveLength(3);
    for (const mutate of [
      (v: typeof parsed) => {
        v.decisions[1].targetId = 'wrong-person';
      },
      (v: typeof parsed) => {
        v.history[1].contentHash = `sha256:${'0'.repeat(64)}`;
      },
      (v: typeof parsed) => {
        v.revision.snapshot.reviewEvidence[0].synthetic = false;
      },
      (v: typeof parsed) => {
        v.revision.snapshot.drivers.pop();
      },
      (v: typeof parsed) => {
        v.history.pop();
      },
    ]) {
      const v = JSON.parse(exported);
      mutate(v);
      await expect(verifyRevisionExport(JSON.stringify(v))).rejects.toThrow();
    }
  } finally {
    h.db.close();
    vi.unstubAllGlobals();
  }
}, 30000);
