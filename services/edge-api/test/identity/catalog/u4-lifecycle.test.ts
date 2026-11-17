import {
  beforeAll,
  afterEach,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import type { SeedArtifact } from '../../../src/identity/catalog/model';
import { CatalogWorkflow } from '../../../src/identity/catalog/workflow';
import { hashIdentityProjection } from '../../../src/identity/discovery/keys';
import {
  catalogMigration,
  catalogMigrationHash,
} from '../../../src/identity/catalog/schema';
import { sqliteHost } from './sqlite-support';
import {
  setup,
  bindRequest,
  newDriverRequest,
  operation,
  validateAndActivate,
  candidate,
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
describe('U4 immutable local lifecycle', () => {
  it('keeps R0 exact and approval pending until explicit validated activation, then recovers identical receipts', async () => {
    const h = sqliteHost();
    try {
      const f = await setup(h.storage, seed);
      expect(f.root.contentHash).toBe(
        'sha256:8a2a62d8412fdfd71cfd5138b4f87682f33a690d21c3d5eec46153bfbda39851',
      );
      const request = await bindRequest(f),
        review = await f.workflow.review(request, f.cap),
        r = review.revision!;
      expect(f.workflow.head().activeRevisionId).toBe(f.root.revisionId);
      expect(
        f.store.inspect({
          candidateId: request.candidateId!,
          section: 'candidate',
          cursor: null,
          limit: 1,
        }).candidate.state,
      ).toBe('approved-pending');
      expect(r.snapshot.seasonContent[0]!.datasetVersion).toBe('2026.11.14.1');
      expect(await f.workflow.review(request, f.cap)).toEqual(review);
      await expect(
        f.workflow.review(
          { ...request, rationale: 'Different payload' },
          f.cap,
        ),
      ).rejects.toThrow('operation-content-conflict');
      const activated = await validateAndActivate(f, r.revisionId);
      expect(activated.result.outcome).toBe('activated');
      const head = f.workflow.head();
      expect(head).toMatchObject({
        activationSequence: 2,
        hasRuntimeOnlyActivation: true,
        legacyV1AdmissionEnabled: false,
      });
      expect(await f.workflow.activate(activated.request, f.cap)).toEqual(
        activated.result,
      );
      expect(f.workflow.head()).toEqual(head);
      expect(
        await f.workflow.readOperation(
          'synthetic-reviewer',
          'activate',
          activated.request.operationId,
        ),
      ).toEqual(activated.result);
      expect(
        f.store.inspect({
          candidateId: request.candidateId!,
          section: 'candidate',
          cursor: null,
          limit: 1,
        }).candidate,
      ).toMatchObject({ state: 'resolved', resolvedRevisionId: r.revisionId });
      expect(f.workflow.status(f.root.revisionId)).toBe('activated');
      expect(await f.workflow.readRevision(f.root.revisionId)).toEqual(f.root);
      expect(
        JSON.parse(await f.workflow.exportRevision(r.revisionId)).revision,
      ).toEqual(r);
      const again = new CatalogWorkflow(h.storage, installation, f.authority);
      expect(await again.activate(activated.request, f.cap)).toEqual(
        activated.result,
      );
      expect(again.head()).toEqual(head);
    } finally {
      h.db.close();
    }
  });
  it('requires verified injected authority, roles, closed requests, exact keys and existing targets', async () => {
    const h = sqliteHost();
    try {
      const f = await setup(h.storage, seed),
        r = await bindRequest(f);
      await expect(
        new CatalogWorkflow(h.storage, installation).review(r, f.cap),
      ).rejects.toThrow('authority-unconfigured');
      await expect(
        f.workflow.review(r, { principalId: 'spoof' }),
      ).rejects.toThrow('unverified');
      await expect(
        f.workflow.review(r, f.issue('activator-only', ['activator'])),
      ).rejects.toThrow('catalog-authority');
      await expect(
        f.workflow.review({ ...r, targetId: 'missing-driver' }, f.cap),
      ).rejects.toThrow();
      await expect(
        f.workflow.review({ ...r, actor: 'spoof' } as typeof r, f.cap),
      ).rejects.toThrow('closed-shape');
      await expect(
        f.workflow.review(
          {
            ...r,
            proposedBindingKey: { ...r.proposedBindingKey, providerValue: 12 },
          } as typeof r,
          f.cap,
        ),
      ).rejects.toThrow('review-key');
      await expect(
        f.workflow.review(
          {
            ...r,
            proposedBindingKey: { ...r.proposedBindingKey, season: 2025 },
          } as typeof r,
          f.cap,
        ),
      ).rejects.toThrow('candidate-key-conflict');
      const configured = new CatalogWorkflow(h.storage, installation, {
        ...f.authority,
        isolatedLocalTests: false,
      });
      await expect(configured.review(r, f.cap)).rejects.toThrow(
        'catalog-authority',
      );
      expect(f.workflow.head().activeRevisionId).toBe(f.root.revisionId);
    } finally {
      h.db.close();
    }
  });
  it('rejects, quarantines and explicitly reopens without creating mappings or dataset versions', async () => {
    const h = sqliteHost();
    try {
      const f = await setup(h.storage, seed),
        base = await bindRequest(f),
        r = {
          ...base,
          action: 'reject' as const,
          targetId: null,
          proposedBindingKey: null,
          evidenceIds: [],
        };
      const rejected = await f.workflow.review(r, f.cap);
      expect(rejected.revision).toBeNull();
      expect(
        f.store.inspect({
          candidateId: r.candidateId!,
          section: 'candidate',
          cursor: null,
          limit: 1,
        }).candidate.state,
      ).toBe('rejected');
      expect(
        (await f.workflow.readRevision(f.root.revisionId)).snapshot.bindings,
      ).toHaveLength(94);
      await expect(
        f.workflow.review({ ...base, operationId: crypto.randomUUID() }, f.cap),
      ).rejects.toThrow('candidate-evidence-conflict');
      const c = f.store.inspect({
        candidateId: r.candidateId!,
        section: 'candidate',
        cursor: null,
        limit: 1,
      }).candidate;
      await f.workflow.review(
        {
          ...r,
          operationId: crypto.randomUUID(),
          action: 'reopen',
          reasonCode: 'new-evidence',
          expectedCandidateVersion: c.recordVersion,
          evidenceHead: c.evidenceHead,
        },
        f.cap,
      );
      const reopened = f.store.inspect({
        candidateId: r.candidateId!,
        section: 'candidate',
        cursor: null,
        limit: 1,
      }).candidate;
      expect(reopened).toMatchObject({
        state: 'unresolved',
        reviewGeneration: 2,
        notificationGeneration: 2,
      });
      await f.workflow.review(
        {
          ...r,
          operationId: crypto.randomUUID(),
          action: 'quarantine',
          expectedCandidateVersion: reopened.recordVersion,
        },
        f.cap,
      );
      expect(f.store.health().quarantined).toBe(1);
      expect(
        h.db.prepare('SELECT COUNT(*) n FROM identity_catalog_labels').get()!.n,
      ).toBe(1);
    } finally {
      h.db.close();
    }
  });
  it('requires complete duplicate review and explicit same-name distinction, reserves an abandoned ID forever', async () => {
    const h = sqliteHost();
    try {
      const f = await setup(h.storage, seed),
        r = await newDriverRequest(f);
      await expect(
        f.workflow.review(
          {
            ...r,
            duplicateReview: {
              ...r.duplicateReview!,
              inspectedCanonicalIds: [],
            },
          },
          f.cap,
        ),
      ).rejects.toThrow('complete-duplicate-review');
      await expect(
        f.workflow.review(
          {
            ...r,
            duplicateReview: {
              ...r.duplicateReview!,
              catalogHashReviewed: `sha256:${'a'.repeat(64)}`,
            },
          },
          f.cap,
        ),
      ).rejects.toThrow('complete-duplicate-review');
      const proposal = await f.workflow.review(r, f.cap),
        id = proposal.revision!.revisionId;
      const before = await f.workflow.exportRevision(id);
      await f.workflow.abandon(operation(f, id), f.cap);
      expect(f.workflow.status(id)).toBe('abandoned');
      expect(await f.workflow.exportRevision(id)).toBe(before);
      const c = f.store.inspect({
        candidateId: r.candidateId!,
        section: 'candidate',
        cursor: null,
        limit: 1,
      }).candidate;
      expect(c.state).toBe('unresolved');
      await expect(
        f.workflow.review(
          {
            ...r,
            operationId: crypto.randomUUID(),
            expectedCandidateVersion: c.recordVersion,
          },
          f.cap,
        ),
      ).rejects.toThrow();
      expect(
        h.db
          .prepare('SELECT COUNT(*) n FROM identity_catalog_anchors WHERE id=?')
          .get(r.targetId)!.n,
      ).toBe(1);
      expect(
        h.db
          .prepare(
            'SELECT COUNT(*) n FROM identity_catalog_decisions WHERE id=?',
          )
          .get(proposal.decision.decisionId)!.n,
      ).toBe(1);
      const r2 = await newDriverRequest(
          f,
          'synthetic_other',
          'synthetic-other-person',
        ),
        p2 = await f.workflow.review(r2, f.cap);
      expect(p2.revision!.snapshot.seasonContent[0]!.datasetVersion).toBe(
        '2026.11.14.2',
      );
    } finally {
      h.db.close();
    }
  });
  it('updates a profile under its permanent ID and records corrections without destructive repair or head rollback', async () => {
    const h = sqliteHost();
    try {
      const f = await setup(h.storage, seed),
        r = await bindRequest(f),
        p = await f.workflow.review(r, f.cap);
      await validateAndActivate(f, p.revision!.revisionId);
      const profile = {
        ...f.root.snapshot.drivers[0]!.profile,
        fullName: 'Synthetic Reviewed Profile',
      };
      const e = await f.workflow.recordEvidence(
        {
          schemaVersion: 1,
          operationId: crypto.randomUUID(),
          dossier: {
            claims: [
              { field: 'fullName', value: profile.fullName, sourceField: null },
            ],
            references: [
              {
                kind: 'citation',
                httpsUrl: 'https://example.invalid/profile',
                claimSummary: 'Synthetic fixture only.',
              },
            ],
            rationale: 'Synthetic reviewed profile.',
            synthetic: true,
          },
        },
        f.cap,
      );
      const head = f.workflow.head();
      const update = await f.workflow.review(
        {
          ...r,
          operationId: crypto.randomUUID(),
          expectedActiveRevisionId: head.activeRevisionId!,
          expectedActivationSequence: head.activationSequence,
          action: 'approve-profile',
          candidateId: null,
          expectedCandidateVersion: null,
          proposedBindingKey: null,
          profile,
          evidenceIds: [e.evidenceId],
          evidenceHead: await hashIdentityProjection([e]),
        },
        f.cap,
      );
      expect(
        update.revision!.snapshot.drivers.find(
          (d) => d.anchor.driverId === profile.id,
        )!.profileVersion,
      ).toBe(2);
      await validateAndActivate(f, update.revision!.revisionId);
      const c = f.store.inspect({
        candidateId: r.candidateId!,
        section: 'candidate',
        cursor: null,
        limit: 1,
      }).candidate;
      await expect(
        f.workflow.review(
          {
            ...r,
            operationId: crypto.randomUUID(),
            expectedActiveRevisionId: f.workflow.head().activeRevisionId!,
            expectedActivationSequence: 3,
            expectedCandidateVersion: c.recordVersion,
          },
          f.cap,
        ),
      ).rejects.toThrow('REVISION_ALREADY_ACTIVATED');
      const decision = await f.workflow.review(
        {
          ...r,
          operationId: crypto.randomUUID(),
          expectedActiveRevisionId: f.workflow.head().activeRevisionId!,
          expectedActivationSequence: 3,
          expectedCandidateVersion: c.recordVersion,
          action: 'request-correction',
          targetId: null,
          proposedBindingKey: null,
        },
        f.cap,
      );
      const before = f.workflow.head(),
        report = await f.workflow.reportCorrection(
          {
            schemaVersion: 1,
            operationId: crypto.randomUUID(),
            decisionId: decision.decision.decisionId,
            affectedDriverIds: [profile.id],
            affectedBindingIds: [
              p.revision!.snapshot.bindings.find(
                (b) => b.key.providerValue === 'synthetic_u4_driver',
              )!.bindingId,
            ],
            affectedRevisionIds: [p.revision!.revisionId],
            affectedSeasons: [2026],
            publishedVersions: ['suspected-local-reference'],
            reasonCode: 'invalid-association',
            rationale: 'Synthetic incident reporting only.',
            evidenceIds: r.evidenceIds,
          },
          f.cap,
        );
      expect(f.workflow.head()).toEqual({
        ...before,
        admissionState: 'paused',
      });
      const event = await f.workflow.correctionStatus(
        {
          schemaVersion: 1,
          operationId: crypto.randomUUID(),
          correctionId: report.correctionId,
          expectedEventId: report.correctionId,
          status: 'requires-separate-plan',
          rationale: 'Separate historical repair authorization is needed.',
        },
        f.cap,
      );
      expect(event.status).toBe('requires-separate-plan');
      expect(f.workflow.head().activeRevisionId).toBe(before.activeRevisionId);
      expect(
        (await f.workflow.readRevision(f.root.revisionId)).snapshot.drivers[0]!
          .profile,
      ).toEqual(seed.snapshot.drivers[0]!.profile);
    } finally {
      h.db.close();
    }
  });
  it('hashes additive migration bytes and fails safely on unknown storage versions', async () => {
    expect(await hashIdentityProjection(catalogMigration)).toBe(
      catalogMigrationHash,
    );
    const h = sqliteHost();
    try {
      const f = await setup(h.storage, seed);
      h.db
        .prepare('INSERT INTO identity_catalog_migrations VALUES(2,?)')
        .run('future');
      expect(
        () => new CatalogWorkflow(h.storage, installation, f.authority),
      ).toThrow('catalog-storage-schema');
      expect(
        h.db.prepare('SELECT COUNT(*) n FROM identity_catalog_revisions').get()!
          .n,
      ).toBe(1);
    } finally {
      h.db.close();
    }
  });
  it('detects stale evidence and candidate changes while repeated sightings alone keep a certificate usable', async () => {
    const h = sqliteHost();
    try {
      const f = await setup(h.storage, seed),
        r = await bindRequest(f),
        p = await f.workflow.review(r, f.cap),
        cmd = operation(f, p.revision!.revisionId),
        cert = await f.workflow.validate(cmd, f.cap);
      expect(cert.valid).toBe(true);
      await candidate(f.store, 'synthetic_u4_driver', 2);
      const activation = {
        ...cmd,
        operationId: crypto.randomUUID(),
        certificateId: cert.certificateId,
      };
      expect((await f.workflow.activate(activation, f.cap)).outcome).toBe(
        'activated',
      );
      const r2 = await bindRequest(f, 'synthetic_freshness'),
        p2 = await f.workflow.review(r2, f.cap),
        cmd2 = operation(f, p2.revision!.revisionId),
        cert2 = await f.workflow.validate(cmd2, f.cap);
      await candidate(f.store, 'synthetic_freshness', 3, 'Changed');
      await expect(
        f.workflow.activate(
          {
            ...cmd2,
            operationId: crypto.randomUUID(),
            certificateId: cert2.certificateId,
          },
          f.cap,
        ),
      ).rejects.toThrow('candidate-evidence-stale');
      const invalid = await f.workflow.validate(
        { ...cmd2, operationId: crypto.randomUUID() },
        f.cap,
      );
      expect(invalid.valid).toBe(false);
      expect(invalid.issues.join()).toContain('candidate-evidence-stale');
    } finally {
      h.db.close();
    }
  });
});
