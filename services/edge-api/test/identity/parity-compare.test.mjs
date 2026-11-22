import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  canonical,
  compareTrees,
  parseArguments,
} from '../../scripts/identity/parity-compare.mjs';

const hash = (s) => 'sha256:' + createHash('sha256').update(s).digest('hex');
const exportWrapper = {
  installationId: 'c45d60b8-a723-4b6e-8530-750592af2b94',
  revision: { revisionId: 'rev-1', contentHash: hash('catalog') },
  exportHash: hash('export'),
};
const reference = {
  installationId: exportWrapper.installationId,
  revisionId: 'rev-1',
  catalogHash: exportWrapper.revision.contentHash,
  exportSha256: exportWrapper.exportHash,
  inventoryPolicy: 'strict-v1',
  datasetVersion: '2026.10.07.1',
};

function tree({ runtime, documents, capture, gitCommit = 'a'.repeat(40) }) {
  const artifact = {
    schemaVersion: runtime ? 2 : 1,
    ...(runtime ? { identityCatalog: reference } : {}),
    kind: 'gridview-season-batch',
    release: { contentVersion: '2026.10.07.1' },
    source: { drivers: [{ id: 'driver-a' }] },
    documents,
  };
  const artifactBytes = Buffer.from(JSON.stringify(artifact));
  const manifest = {
    schemaVersion: runtime ? 2 : 1,
    ...(runtime ? { identityCatalog: reference } : {}),
    artifact: {
      file: 'artifact.json',
      byteLength: artifactBytes.byteLength,
      sha256: createHash('sha256').update(artifactBytes).digest('hex'),
    },
    capture: capture ?? { responses: [{ url: 'u1' }, { url: 'u2' }] },
    generator: { gitCommit, treeClean: true, schemaVersion: runtime ? 2 : 1 },
  };
  return {
    artifact,
    manifest,
    artifactBytes,
    manifestBytes: Buffer.from(JSON.stringify(manifest)),
  };
}
const docs = [
  { documentName: 'home', data: { x: 1 } },
  { documentName: 'drivers', data: { y: 2 } },
];
const input = (overrides = {}) => {
  const a = tree({ runtime: false, documents: docs });
  const b = tree({ runtime: true, documents: docs });
  return {
    a1: a,
    a2: a,
    b1: b,
    b2: b,
    exportBytes: Buffer.from(JSON.stringify(exportWrapper)),
    ...overrides,
  };
};
const checks = (r) => r.findings.map((f) => f.check);

describe('U11 parity comparator', () => {
  it('reports parity when only the provenance envelope differs', () => {
    expect(compareTrees(input()).findings).toEqual([]);
  });

  it('names a changed public document', () => {
    const b = tree({
      runtime: true,
      documents: [docs[0], { documentName: 'drivers', data: { y: 3 } }],
    });
    const r = compareTrees(input({ b1: b, b2: b }));
    expect(r.findings).toContainEqual({
      check: 'documents',
      detail: ['drivers'],
    });
  });

  it('detects non-deterministic runs', () => {
    const other = tree({ runtime: true, documents: [...docs].reverse() });
    expect(checks(compareTrees(input({ b2: other })))).toContain('determinism');
  });

  it('refuses a side A that carries runtime authority', () => {
    const a = tree({ runtime: true, documents: docs });
    expect(checks(compareTrees(input({ a1: a, a2: a })))).toContain(
      'side-a-authority',
    );
  });

  it('detects different request accounting', () => {
    const b = tree({
      runtime: true,
      documents: docs,
      capture: { responses: [{ url: 'u2' }, { url: 'u1' }] },
    });
    expect(checks(compareTrees(input({ b1: b, b2: b })))).toContain(
      'request-accounting',
    );
  });

  it('detects a different generator commit', () => {
    const b = tree({
      runtime: true,
      documents: docs,
      gitCommit: 'b'.repeat(40),
    });
    expect(checks(compareTrees(input({ b1: b, b2: b })))).toContain('code');
  });

  it('detects a reference block that does not match the export', () => {
    const other = { ...exportWrapper, exportHash: hash('other') };
    const r = compareTrees(
      input({ exportBytes: Buffer.from(JSON.stringify(other)) }),
    );
    expect(r.findings).toContainEqual({
      check: 'reference',
      detail: 'identityCatalog.exportSha256',
    });
  });

  it('detects a manifest that does not commit to its artifact', () => {
    const b = tree({ runtime: true, documents: docs });
    const tampered = {
      ...b,
      artifactBytes: Buffer.from(b.artifactBytes.toString() + ' '),
    };
    expect(
      checks(compareTrees(input({ b1: tampered, b2: tampered }))),
    ).toContain('manifest-artifact-commitment');
  });

  it('canonicalizes independent of key order', () => {
    expect(canonical({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(
      canonical({ a: [{ c: 3, d: 2 }], b: 1 }),
    );
  });

  it('accepts only the five named arguments, once each', () => {
    const ok = [
      '--a1',
      'x',
      '--a2',
      'x',
      '--b1',
      'x',
      '--b2',
      'x',
      '--export',
      'x',
    ];
    expect(parseArguments(ok)).not.toBeNull();
    expect(parseArguments(ok.slice(0, 8))).toBeNull();
    expect(parseArguments([...ok, '--a1', 'y'])).toBeNull();
    expect(parseArguments(['--out', 'x', ...ok.slice(2)])).toBeNull();
  });
});
