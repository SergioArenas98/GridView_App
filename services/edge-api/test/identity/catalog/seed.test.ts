import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { validateSeed } from '../../../src/identity/catalog/validate';
import { exportSeed, importSeed } from '../../../src/identity/catalog/export';
import { forbidNetwork } from '../discovery/support';
import { artifacts } from '../../../scripts/identity/artifacts';

beforeEach(forbidNetwork);
afterEach(() => vi.unstubAllGlobals());
describe('R0 complete reviewed corpus', () => {
  it('emits a deterministic manifest and complete bundled parity report', async () => {
    const output = await artifacts(loadCorpus());
    expect(JSON.parse(output['parity.json']).valid).toBe(true);
    expect(JSON.parse(output['manifest.json']).counts).toMatchObject({
      drivers: 33,
      bindings: 94,
      evidence: 101,
      unresolved: 7,
    });
    expect(await artifacts(loadCorpus())).toEqual(output);
  });
  it('preserves the exact corpus and deterministic immutable export', async () => {
    const corpus = loadCorpus();
    const a = await prepareSeed(corpus);
    expect(a.snapshot.drivers).toHaveLength(33);
    expect(a.snapshot.bindings).toHaveLength(94);
    expect(a.snapshot.evidence).toHaveLength(101);
    expect(a.snapshot.unresolved).toHaveLength(7);
    expect(a.snapshot.constructors).toHaveLength(11);
    expect(a.snapshot.circuits).toHaveLength(24);
    expect(a.snapshot.events).toHaveLength(23);
    expect(a.snapshot.seasonContent[0]?.datasetVersion).toBe('2026.10.07.1');
    expect(await prepareSeed(corpus)).toEqual(a);
    expect(await importSeed(await exportSeed(a))).toEqual(a);
    expect(Object.isFrozen(a.snapshot.drivers)).toBe(true);
    expect(await validateSeed(a)).toEqual(a);
    expect(fetch).not.toHaveBeenCalled();
  });
});
