import { beforeAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import type { SeedArtifact } from '../../../src/identity/catalog/model';
import { hashIdentityProjection } from '../../../src/identity/discovery/keys';
import { canonicalJson } from '../../../src/ingest/canonical-json';
import { CatalogWorkflow } from '../../../src/identity/catalog/workflow';
import { checkSnapshotCapacity } from '../../../src/identity/catalog/revision';
import { sqliteHost } from './sqlite-support';
import {
  setup,
  bindRequest,
  newDriverRequest,
  operation,
  validateAndActivate,
} from './u4-support';
import { installation } from './u4-support';
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
it('accepts correction binding references only as exact binding IDs, not evidence hashes appearing in a binding body', async () => {
  const h = sqliteHost();
  try {
    const f = await setup(h.storage, seed),
      r = await bindRequest(f),
      p = (await f.workflow.review(r, f.cap)).revision!;
    await validateAndActivate(f, p.revisionId);
    const c = f.store.inspect({
      candidateId: r.candidateId!,
      section: 'candidate',
      cursor: null,
      limit: 1,
    }).candidate;
    const decision = await f.workflow.review(
      {
        ...r,
        operationId: crypto.randomUUID(),
        expectedActiveRevisionId: p.revisionId,
        expectedActivationSequence: 2,
        expectedCandidateVersion: c.recordVersion,
        action: 'request-correction',
        targetId: null,
        proposedBindingKey: null,
      },
      f.cap,
    );
    await expect(
      f.workflow.reportCorrection(
        {
          schemaVersion: 1,
          operationId: crypto.randomUUID(),
          decisionId: decision.decision.decisionId,
          affectedDriverIds: [],
          affectedBindingIds: r.evidenceIds,
          affectedRevisionIds: [p.revisionId],
          affectedSeasons: [2026],
          publishedVersions: [],
          reasonCode: 'invalid-association',
          rationale: 'Synthetic exact-reference test.',
          evidenceIds: r.evidenceIds,
        },
        f.cap,
      ),
    ).rejects.toThrow('correction-binding-missing');
    expect(f.workflow.head().admissionState).toBe('open');
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_catalog_corrections').get()!
        .n,
    ).toBe(0);
  } finally {
    h.db.close();
  }
});
it('fails capacity admission atomically and never truncates snapshot/export or audit history', async () => {
  class Probe extends CatalogWorkflow {
    checkExport(
      r: Parameters<CatalogWorkflow['exportRevision']>[0],
      value: typeof seed.snapshot,
    ) {
      void r;
      this.checkExportCapacity({ ...root, snapshot: value });
    }
  }
  const h = sqliteHost();
  let root: Awaited<ReturnType<typeof setup>>['root'];
  try {
    const f = await setup(h.storage, seed);
    root = f.root;
    const tooBig = structuredClone(seed.snapshot);
    tooBig.drivers[0]!.profile.biography = 'x'.repeat(2 * 1024 * 1024);
    expect(() => checkSnapshotCapacity(tooBig)).toThrow('snapshot-capacity');
    const largeExport = structuredClone(seed.snapshot);
    largeExport.sourceDocuments[0]!.document.note = 'x'.repeat(1500000);
    expect(() =>
      new Probe(h.storage, installation, f.authority).checkExport(
        root.revisionId,
        largeExport,
      ),
    ).toThrow('revision-export-capacity');
    const r = await bindRequest(f),
      before = h.db
        .prepare('SELECT COUNT(*) n FROM identity_catalog_decisions')
        .get()!.n;
    h.db.prepare('UPDATE identity_receipts SET bytes=268435456').run();
    await expect(f.workflow.review(r, f.cap)).rejects.toThrow(
      'catalog-logical-capacity',
    );
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_catalog_decisions').get()!
        .n,
    ).toBe(before);
    expect(f.workflow.head().activationSequence).toBe(1);
    h.db.prepare('UPDATE identity_receipts SET bytes=1024').run();
    h.db
      .prepare('INSERT INTO identity_catalog_audit VALUES(16384,?)')
      .run('{}');
    await expect(f.workflow.review(r, f.cap)).rejects.toThrow('audit-capacity');
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_catalog_decisions').get()!
        .n,
    ).toBe(before);
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_catalog_labels').get()!.n,
    ).toBe(1);
  } finally {
    h.db.close();
  }
});
it('verifies durable request and response hashes before recovering an operation result', async () => {
  const h = sqliteHost();
  try {
    const f = await setup(h.storage, seed),
      r = await bindRequest(f);
    await f.workflow.review(r, f.cap);
    const row = h.db
      .prepare(
        "SELECT body FROM identity_catalog_operations WHERE family='review' AND id=?",
      )
      .get(r.operationId)!;
    const original = String(row.body),
      tampered = JSON.parse(original);
    tampered.response.decision.rationale = 'Tampered durable response';
    h.db
      .prepare(
        "UPDATE identity_catalog_operations SET body=? WHERE family='review' AND id=?",
      )
      .run(canonicalJson(tampered), r.operationId);
    await expect(f.workflow.review(r, f.cap)).rejects.toThrow(
      'operation-response-integrity',
    );
    const requestTampered = JSON.parse(original);
    requestTampered.requestHash = `sha256:${'0'.repeat(64)}`;
    h.db
      .prepare(
        "UPDATE identity_catalog_operations SET body=? WHERE family='review' AND id=?",
      )
      .run(canonicalJson(requestTampered), r.operationId);
    await expect(f.workflow.review(r, f.cap)).rejects.toThrow(
      'operation-response-integrity',
    );
  } finally {
    h.db.close();
  }
});
it('refuses ordinary proposals that remove, retarget, merge or tamper with complete historical content even with a recomputed hash', async () => {
  const h = sqliteHost();
  try {
    const f = await setup(h.storage, seed),
      r = await bindRequest(f),
      p = (await f.workflow.review(r, f.cap)).revision!,
      original = canonicalJson(p);
    const mutations = [
      (v: typeof p) => {
        v.snapshot.drivers.pop();
      },
      (v: typeof p) => {
        v.snapshot.bindings[0]!.targetId =
          v.snapshot.drivers[1]!.anchor.driverId;
      },
      (v: typeof p) => {
        v.snapshot.evidence[0]!.originalProvenance = 'silently replaced';
      },
      (v: typeof p) => {
        v.snapshot.constructors.pop();
      },
      (v: typeof p) => {
        v.snapshot.sourceDocuments[0]!.document.note = 'modified sealed base';
      },
      (v: typeof p) => {
        v.snapshot.bindings.push(structuredClone(v.snapshot.bindings[0]!));
      },
      (v: typeof p) => {
        v.snapshot.seasonContent[0]!.datasetVersion = '2026.10.07.1';
      },
      (v: typeof p) => {
        v.parentContentHash = `sha256:${'0'.repeat(64)}`;
      },
      (v: typeof p) => {
        v.catalogSchemaVersion = 2 as 1;
      },
      (v: typeof p) => {
        (v.snapshot as unknown as Record<string, unknown>).unexpected = true;
      },
    ];
    for (const mutate of mutations) {
      const v = JSON.parse(original) as typeof p;
      mutate(v);
      v.contentHash = await hashIdentityProjection(v.snapshot);
      v.snapshotByteLength = new TextEncoder().encode(
        canonicalJson(v.snapshot),
      ).length;
      h.db
        .prepare(
          'UPDATE identity_catalog_revisions SET body=?,hash=? WHERE id=?',
        )
        .run(canonicalJson(v), v.contentHash, p.revisionId);
      if (v.catalogSchemaVersion !== 1)
        await expect(
          f.workflow.validate(operation(f, p.revisionId), f.cap),
        ).rejects.toThrow('revision-schema');
      else {
        const cert = await f.workflow.validate(
          operation(f, p.revisionId),
          f.cap,
        );
        expect(cert.valid).toBe(false);
      }
      expect(f.workflow.head().activeRevisionId).toBe(f.root.revisionId);
    }
    h.db
      .prepare('UPDATE identity_catalog_revisions SET body=?,hash=? WHERE id=?')
      .run(original, p.contentHash, p.revisionId);
    expect(
      (await f.workflow.validate(operation(f, p.revisionId), f.cap)).valid,
    ).toBe(true);
  } finally {
    h.db.close();
  }
});
it('binds certificates to exact proposal, parent, candidate heads, evidence bytes and validator version', async () => {
  const h = sqliteHost();
  try {
    const f = await setup(h.storage, seed),
      r = await bindRequest(f),
      p = (await f.workflow.review(r, f.cap)).revision!,
      cmd = operation(f, p.revisionId),
      cert = await f.workflow.validate(cmd, f.cap),
      activation = {
        ...cmd,
        operationId: crypto.randomUUID(),
        certificateId: cert.certificateId,
      };
    for (const delta of [
      { validatorVersion: 'old-validator' },
      { contentHash: `sha256:${'0'.repeat(64)}` },
      { baseRevisionId: crypto.randomUUID() },
      { evidenceHeads: [] },
      { valid: false },
      { evidenceStateHash: `sha256:${'0'.repeat(64)}` },
    ]) {
      h.db
        .prepare('UPDATE identity_catalog_certificates SET body=? WHERE id=?')
        .run(canonicalJson({ ...cert, ...delta }), cert.certificateId);
      await expect(f.workflow.activate(activation, f.cap)).rejects.toThrow(
        'validation-certificate-invalid',
      );
    }
    h.db
      .prepare('UPDATE identity_catalog_certificates SET body=? WHERE id=?')
      .run(canonicalJson(cert), cert.certificateId);
    const e = p.snapshot.reviewEvidence![0]!;
    h.db
      .prepare('UPDATE identity_catalog_dossiers SET body=? WHERE id=?')
      .run(canonicalJson({ ...e, rationale: 'Tampered' }), e.evidenceId);
    await expect(f.workflow.activate(activation, f.cap)).rejects.toThrow(
      'dossier-integrity',
    );
    expect(f.workflow.head().activationSequence).toBe(1);
  } finally {
    h.db.close();
  }
});
it('refuses insufficient evidence, unknown references, unsafe citations, excessive profiles and same-name ambiguity', async () => {
  const h = sqliteHost();
  try {
    const f = await setup(h.storage, seed),
      r = await newDriverRequest(f);
    await expect(
      f.workflow.review({ ...r, evidenceIds: [] }, f.cap),
    ).rejects.toThrow('approval-inputs');
    await expect(
      f.workflow.review(
        { ...r, profile: { ...r.profile!, biography: 'x'.repeat(8001) } },
        f.cap,
      ),
    ).rejects.toThrow('review-text');
    for (const httpsUrl of [
      'https://example.invalid/?token=x',
      'https://u:p@example.invalid/',
      'https://example.invalid/#fragment',
      'http://example.invalid/',
    ])
      await expect(
        f.workflow.recordEvidence(
          {
            schemaVersion: 1,
            operationId: crypto.randomUUID(),
            dossier: {
              claims: [
                { field: 'fullName', value: 'Synthetic', sourceField: null },
              ],
              references: [
                { kind: 'citation', httpsUrl, claimSummary: 'Synthetic' },
              ],
              rationale: 'Synthetic',
              synthetic: true,
            },
          },
          f.cap,
        ),
      ).rejects.toThrow('citation-url');
    await expect(
      f.workflow.recordEvidence(
        {
          schemaVersion: 1,
          operationId: crypto.randomUUID(),
          dossier: {
            claims: [
              { field: 'fullName', value: 'Synthetic', sourceField: null },
            ],
            references: [
              {
                kind: 'observation',
                observationId: `sha256:${'0'.repeat(64)}`,
              },
            ],
            rationale: 'Synthetic',
            synthetic: false,
          },
        },
        f.cap,
      ),
    ).rejects.toThrow('evidence-observation-missing');
    r.profile!.fullName = f.root.snapshot.drivers[0]!.profile.fullName;
    const e = await f.workflow.recordEvidence(
      {
        schemaVersion: 1,
        operationId: crypto.randomUUID(),
        dossier: {
          claims: [
            {
              field: 'fullName',
              value: r.profile!.fullName,
              sourceField: null,
            },
            {
              field: 'canonical-association',
              value: { key: r.proposedBindingKey!, targetId: r.targetId! },
              sourceField: null,
            },
          ],
          references: [
            {
              kind: 'citation',
              httpsUrl: 'https://example.invalid/same-name',
              claimSummary: 'Synthetic ambiguity.',
            },
          ],
          rationale: 'Synthetic same-name evidence.',
          synthetic: true,
        },
      },
      f.cap,
    );
    r.evidenceIds = [e.evidenceId];
    r.duplicateReview!.evidenceIds = r.evidenceIds;
    await expect(f.workflow.review(r, f.cap)).rejects.toThrow(
      'same-name-distinction',
    );
    r.duplicateReview!.sameNameDistinction =
      'Reviewed as a distinct synthetic person for mechanism tests.';
    const proposal = await f.workflow.review(r, f.cap);
    expect(
      (await validateAndActivate(f, proposal.revision!.revisionId)).result
        .outcome,
    ).toBe('activated');
  } finally {
    h.db.close();
  }
});
