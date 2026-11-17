import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import { canonicalKey } from '../discovery/keys';
import { hashIdentityProjection } from '../discovery/keys';
import { decodeIdentityResponse } from '../response-decoders';
import { IdentityStore } from '../store';
import type { IdentityStorage } from '../schema';
import { requireCatalog } from './model';
import { boundedJson, exact } from './sources';
import {
  approval,
  decodeReview,
  instant,
  textBound,
  type ReviewRequest,
  type ReviewDecision,
} from './review';
import {
  applyDecision,
  type CatalogRevision,
  type CatalogHead,
} from './revision';
import { reserveDatasetVersions } from './dataset-version';
import {
  catalogValidatorVersion,
  type ValidationCertificate,
  type RevisionOperation,
  type ActivationRequest,
  type ActivationResult,
} from './activation';
import { CatalogCorrectionStore } from './correction-store';
import type { IdentityReviewPort } from './port';
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const size = (a: unknown) => utf8(canonicalJson(a)).length;
export interface ReviewResult {
  decision: ReviewDecision;
  revision: CatalogRevision | null;
}
/** Internal U4 storage mechanism; no external administration interface. */
export class CatalogWorkflow
  extends CatalogCorrectionStore
  implements IdentityReviewPort
{
  async review(input: ReviewRequest, cap: unknown): Promise<ReviewResult> {
    return this.reviewAttempt(input, cap, 0);
  }
  protected async reviewAttempt(
    input: ReviewRequest,
    cap: unknown,
    attempt: number,
  ): Promise<ReviewResult> {
    const p = this.actor(cap, 'reviewer'),
      r = decodeReview(input),
      replay = await this.replay<ReviewResult>(p, 'review', r.operationId, r);
    if (replay) return replay;
    this.expectHead(r.expectedActiveRevisionId, r.expectedActivationSequence);
    const parent = await this.readRevision(r.expectedActiveRevisionId);
    const c = this.checkCandidate(r),
      supports = await this.evidence(r.evidenceIds);
    if (c) {
      requireCatalog(
        c.state === 'unresolved' ||
          r.action === 'request-correction' ||
          (r.action === 'reopen' &&
            ['rejected', 'quarantined', 'archived'].includes(c.state)),
        'candidate-state-conflict',
      );
      if (approval(r.action))
        requireCatalog(
          !c.overflowed && !c.conflict,
          'candidate-evidence-incomplete',
        );
      await decodeIdentityResponse(
        'inspect',
        new IdentityStore(this.storage, this.installation, this.now).inspect({
          candidateId: c.candidateId,
          section: 'candidate',
          cursor: null,
          limit: 1,
        }),
      );
    } else
      requireCatalog(
        r.evidenceHead === (await hashIdentityProjection(supports)),
        'profile-evidence-head',
      );
    const time = this.time();
    const decision: ReviewDecision = {
      ...r,
      decisionId: crypto.randomUUID(),
      baseRevisionId: r.expectedActiveRevisionId,
      principalId: p.principalId,
      credentialId: p.credentialId,
      authMethod: p.authMethod,
      decidedAt: time,
      profileHash:
        r.profile === null ? null : await hashIdentityProjection(r.profile),
    };
    let revision: CatalogRevision | null = null;
    if (approval(r.action)) {
      const snapshot = await applyDecision(parent.snapshot, decision, supports);
      requireCatalog(
        snapshot.seasonContent.some(
          (s, i) =>
            s.seasonProjectionHash !==
            parent.snapshot.seasonContent[i]?.seasonProjectionHash,
        ),
        'no-effective-change',
      );
      revision = {
        revisionId: crypto.randomUUID(),
        sequence: parent.sequence + 1,
        parentRevisionId: parent.revisionId,
        parentContentHash: parent.contentHash,
        catalogSchemaVersion: 1,
        contentHash: await hashIdentityProjection(snapshot),
        createdAt: time,
        createdByPrincipal: p.principalId,
        decisionIds: [decision.decisionId],
        baseContentDigest: parent.baseContentDigest,
        snapshotByteLength: size(snapshot),
        snapshot,
        candidateHeads: c
          ? [
              {
                candidateId: c.candidateId,
                recordVersion: c.recordVersion + 1,
                evidenceHead: c.evidenceHead,
              },
            ]
          : [],
      };
    }
    // Dataset reservations are synchronous, but snapshot hashing is async. Plan
    // against exact allocator state, then CAS that state inside the final write.
    const labelsBefore = canonicalJson(
      this.rows('SELECT * FROM identity_catalog_labels ORDER BY season,label'),
    );
    if (revision) {
      const planned = structuredClone(revision.snapshot);
      const planning: IdentityStorage = {
        sql: {
          exec: (q, ...a) => {
            if (q.startsWith('INSERT')) return { toArray: () => [] };
            return this.storage.sql.exec(q, ...a);
          },
        },
        transactionSync: (fn) => fn(),
      };
      reserveDatasetVersions(
        planning,
        planned,
        parent.snapshot,
        revision.revisionId,
        time,
      );
      revision.snapshot = planned;
      revision.contentHash = await hashIdentityProjection(planned);
      revision.snapshotByteLength = size(planned);
      this.checkExportCapacity(revision);
    }
    const result = { decision, revision };
    const responseHash = await hashIdentityProjection(result);
    try {
      return await this.commit(
        p,
        'review',
        r.operationId,
        r,
        result,
        responseHash,
        () => {
          this.expectHead(
            r.expectedActiveRevisionId,
            r.expectedActivationSequence,
          );
          this.checkCandidate(r);
          requireCatalog(
            labelsBefore ===
              canonicalJson(
                this.rows(
                  'SELECT * FROM identity_catalog_labels ORDER BY season,label',
                ),
              ),
            'dataset-reservation-conflict',
          );
          this.rows(
            'INSERT INTO identity_catalog_decisions VALUES(?,?)',
            decision.decisionId,
            canonicalJson(decision),
          );
          if (revision) {
            this.insertRevision(revision);
            const planned = structuredClone(revision.snapshot);
            reserveDatasetVersions(
              this.storage,
              planned,
              parent.snapshot,
              revision.revisionId,
              time,
            );
            requireCatalog(
              same(planned, revision.snapshot),
              'dataset-reservation-conflict',
            );
            if (r.action === 'create-driver')
              this.rows(
                'INSERT INTO identity_catalog_anchors VALUES(?,?,?)',
                r.targetId!,
                decision.decisionId,
                canonicalJson(
                  revision.snapshot.drivers.find(
                    (d) => d.anchor.driverId === r.targetId,
                  )!.anchor,
                ),
              );
            if (r.proposedBindingKey) {
              const k = canonicalKey(r.proposedBindingKey);
              requireCatalog(
                !this.rows(
                  'SELECT target FROM identity_catalog_keys WHERE exact_key=?',
                  k,
                ).length,
                'binding-reservation-conflict',
              );
              this.rows(
                'INSERT INTO identity_catalog_keys VALUES(?,?,?,0)',
                k,
                r.targetId!,
                revision.revisionId,
              );
            }
            this.insertIndexes(revision);
          }
          this.protect(supports);
          if (c) {
            const current = this.checkCandidate(r)!;
            current.latestDecisionId = decision.decisionId;
            if (revision) {
              current.state = 'approved-pending';
              current.proposedRevisionId = revision.revisionId;
            } else if (r.action === 'reopen') {
              current.state = 'unresolved';
              current.archivedState = null;
              current.newEvidence = false;
              current.reviewGeneration++;
              current.notificationGeneration++;
              this.rows(
                'INSERT INTO identity_notifications VALUES(?,?,?,?)',
                current.candidateId,
                current.notificationGeneration,
                canonicalJson({
                  candidateId: current.candidateId,
                  generation: current.notificationGeneration,
                  acknowledgedBy: null,
                  acknowledgedCredentialId: null,
                  acknowledgedAt: null,
                }),
                512,
              );
            } else if (r.action === 'reject') current.state = 'rejected';
            else if (r.action === 'quarantine') current.state = 'quarantined';
            this.saveCandidate(current, r.expectedCandidateVersion!);
          }
        },
        time,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.endsWith('dataset-reservation-conflict') &&
        attempt < 3
      )
        return this.reviewAttempt(input, cap, attempt + 1);
      throw error;
    }
  }
  async validate(
    input: RevisionOperation,
    cap: unknown,
  ): Promise<ValidationCertificate> {
    const p = this.actor(cap, 'activator'),
      cmd = this.decodeOperation(input),
      replay = await this.replay<ValidationCertificate>(
        p,
        'validate',
        cmd.operationId,
        cmd,
      );
    if (replay) return replay;
    const r = this.rawRevision(cmd.revisionId),
      issues: string[] = [];
    try {
      requireCatalog(
        ['proposed', 'validated'].includes(this.status(r.revisionId)),
        'proposal-not-validatable',
      );
      this.expectHead(
        cmd.expectedActiveRevisionId,
        cmd.expectedActivationSequence,
      );
      requireCatalog(
        cmd.expectedActiveRevisionId === r.parentRevisionId,
        'proposal-parent-conflict',
      );
      await this.readRevision(r.revisionId);
      this.fresh(r);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : 'validation-failed');
    }
    const time = this.time(),
      reportHash = await hashIdentityProjection({
        issues,
        revisionId: r.revisionId,
        contentHash: r.contentHash,
      });
    const result: ValidationCertificate = {
      certificateId: crypto.randomUUID(),
      revisionId: r.revisionId,
      contentHash: r.contentHash,
      proposalHash: await hashIdentityProjection(r),
      validatorVersion: catalogValidatorVersion,
      baseRevisionId: r.parentRevisionId,
      baseContentHash: r.parentContentHash,
      evidenceHeads: r.candidateHeads,
      evidenceStateHash: await hashIdentityProjection(
        r.snapshot.reviewEvidence ?? [],
      ),
      reportHash,
      validatedAt: time,
      validatedByPrincipal: p.principalId,
      issues,
      valid: issues.length === 0,
    };
    return this.commit(
      p,
      'validate',
      cmd.operationId,
      cmd,
      result,
      await hashIdentityProjection(result),
      () => {
        requireCatalog(
          same(this.rawRevision(r.revisionId), r),
          'proposal-content-stale',
        );
        if (result.valid) {
          this.expectHead(
            cmd.expectedActiveRevisionId,
            cmd.expectedActivationSequence,
          );
          this.fresh(r);
          requireCatalog(
            ['proposed', 'validated'].includes(this.status(r.revisionId)),
            'proposal-not-validatable',
          );
          this.rows(
            "UPDATE identity_catalog_statuses SET status='validated' WHERE id=?",
            r.revisionId,
          );
        }
        this.rows(
          'INSERT INTO identity_catalog_certificates VALUES(?,?,?)',
          result.certificateId,
          r.revisionId,
          canonicalJson(result),
        );
      },
      time,
    );
  }
  protected async certificate(
    id: string,
    r: CatalogRevision,
  ): Promise<ValidationCertificate> {
    const v = boundedJson(this.body('certificates', id));
    exact(v, [
      'certificateId',
      'revisionId',
      'contentHash',
      'proposalHash',
      'validatorVersion',
      'baseRevisionId',
      'baseContentHash',
      'evidenceHeads',
      'evidenceStateHash',
      'reportHash',
      'validatedAt',
      'validatedByPrincipal',
      'issues',
      'valid',
    ]);
    instant(v.validatedAt);
    textBound(v.validatedByPrincipal, 200);
    requireCatalog(
      v.certificateId === id &&
        v.revisionId === r.revisionId &&
        v.contentHash === r.contentHash &&
        v.proposalHash === (await hashIdentityProjection(r)) &&
        v.validatorVersion === catalogValidatorVersion &&
        v.baseRevisionId === r.parentRevisionId &&
        v.baseContentHash === r.parentContentHash &&
        same(v.evidenceHeads, r.candidateHeads) &&
        v.evidenceStateHash ===
          (await hashIdentityProjection(r.snapshot.reviewEvidence ?? [])) &&
        same(v.issues, []) &&
        v.valid === true &&
        v.reportHash ===
          (await hashIdentityProjection({
            issues: [],
            revisionId: r.revisionId,
            contentHash: r.contentHash,
          })),
      'validation-certificate-invalid',
    );
    return v as unknown as ValidationCertificate;
  }
  async activate(
    input: ActivationRequest,
    cap: unknown,
  ): Promise<ActivationResult> {
    return this.activateAttempt(input, cap, 0);
  }
  protected async activateAttempt(
    input: ActivationRequest,
    cap: unknown,
    attempt: number,
  ): Promise<ActivationResult> {
    const p = this.actor(cap, 'activator'),
      cmd = this.decodeOperation(input, true) as ActivationRequest,
      replay = await this.replay<ActivationResult>(
        p,
        'activate',
        cmd.operationId,
        cmd,
      );
    if (replay) return replay;
    const r = await this.readRevision(cmd.revisionId),
      cert = await this.certificate(cmd.certificateId, r),
      time = this.time();
    requireCatalog(
      cmd.expectedActiveRevisionId === r.parentRevisionId &&
        cmd.expectedActivationSequence === r.sequence - 1,
      'activation-parent-conflict',
    );
    const h = this.head(),
      conflict =
        h.activeRevisionId !== cmd.expectedActiveRevisionId ||
        h.activationSequence !== cmd.expectedActivationSequence;
    const result: ActivationResult = {
      outcome: conflict ? 'conflict' : 'activated',
      revisionId: r.revisionId,
      activationSequence: conflict
        ? h.activationSequence
        : h.activationSequence + 1,
      code: conflict ? 'CATALOG_HEAD_CONFLICT' : null,
    };
    const origin = await this.validatedOrigin();
    const changed = r.snapshot.seasonContent.some(
      (s) =>
        s.seasonProjectionHash !==
        origin.snapshot.seasonContent.find((x) => x.season === s.season)
          ?.seasonProjectionHash,
    );
    const responseHash = await hashIdentityProjection(result);
    try {
      return await this.commit(
        p,
        'activate',
        cmd.operationId,
        cmd,
        result,
        responseHash,
        () => {
          const current = this.head();
          requireCatalog(same(current, h), 'CATALOG_HEAD_CONFLICT');
          requireCatalog(
            same(this.rawRevision(r.revisionId), r) &&
              same(this.body('certificates', cert.certificateId), cert),
            'activation-content-stale',
          );
          if (conflict) {
            const status = this.status(r.revisionId);
            requireCatalog(
              ['validated', 'stale', 'activated'].includes(status),
              'proposal-not-validated',
            );
            if (status !== 'activated')
              this.rows(
                "UPDATE identity_catalog_statuses SET status='stale' WHERE id=?",
                r.revisionId,
              );
            return;
          }
          requireCatalog(
            this.status(r.revisionId) === 'validated',
            'proposal-not-validated',
          );
          this.expectHead(
            cmd.expectedActiveRevisionId,
            cmd.expectedActivationSequence,
          );
          this.fresh(r);
          this.checkIndexes(r);
          for (const b of r.snapshot.bindings) {
            const k = this.rows(
              'SELECT target,revision,activated FROM identity_catalog_keys WHERE exact_key=?',
              canonicalKey(b.key),
            )[0];
            requireCatalog(
              k &&
                k.target === b.targetId &&
                (k.activated === 1 || k.revision === r.revisionId),
              'activation-binding-conflict',
            );
          }
          const next: CatalogHead = {
            ...current,
            activeRevisionId: r.revisionId,
            activationSequence: current.activationSequence + 1,
            seedDigest: current.seedDigest ?? origin.contentHash,
            hasRuntimeOnlyActivation:
              current.hasRuntimeOnlyActivation || changed,
            legacyV1AdmissionEnabled:
              current.legacyV1AdmissionEnabled && !changed,
          };
          this.rows(
            'UPDATE identity_catalog_head SET body=? WHERE id=1 AND body=?',
            canonicalJson(next),
            canonicalJson(current),
          );
          this.rows(
            "UPDATE identity_catalog_statuses SET status='activated' WHERE id=? AND status='validated'",
            r.revisionId,
          );
          this.rows(
            'UPDATE identity_catalog_keys SET activated=1 WHERE revision=? AND activated=0',
            r.revisionId,
          );
          for (const s of r.snapshot.seasonContent) {
            requireCatalog(
              this.rows(
                'SELECT projection FROM identity_catalog_labels WHERE season=? AND label=?',
                s.season,
                s.datasetVersion,
              )[0]?.projection === s.seasonProjectionHash,
              'activation-dataset-conflict',
            );
            this.rows(
              'INSERT INTO identity_catalog_seasons VALUES(?,?,?,?,?)',
              s.season,
              s.datasetVersion,
              s.seasonProjectionHash,
              s.baseContentDigest,
              r.revisionId,
            );
          }
          for (const expected of r.candidateHeads) {
            const c = this.candidate(expected.candidateId);
            c.state = 'resolved';
            c.resolvedRevisionId = r.revisionId;
            this.saveCandidate(c, expected.recordVersion);
          }
        },
        time,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.endsWith('CATALOG_HEAD_CONFLICT') &&
        attempt < 3
      )
        return this.activateAttempt(input, cap, attempt + 1);
      throw error;
    }
  }
  async abandon(
    input: RevisionOperation,
    cap: unknown,
  ): Promise<{ revisionId: string; status: 'abandoned' }> {
    const p = this.actor(
        cap,
        this.authority?.verify(cap).roles.includes('activator')
          ? 'activator'
          : 'reviewer',
      ),
      cmd = this.decodeOperation(input),
      replay = await this.replay<{ revisionId: string; status: 'abandoned' }>(
        p,
        'abandon',
        cmd.operationId,
        cmd,
      );
    if (replay) return replay;
    const r = await this.readRevision(cmd.revisionId);
    requireCatalog(
      p.roles.includes('activator') || r.createdByPrincipal === p.principalId,
      'catalog-authority',
    );
    const time = this.time(),
      result = { revisionId: r.revisionId, status: 'abandoned' as const };
    return this.commit(
      p,
      'abandon',
      cmd.operationId,
      cmd,
      result,
      await hashIdentityProjection(result),
      () => {
        this.expectHead(
          cmd.expectedActiveRevisionId,
          cmd.expectedActivationSequence,
        );
        requireCatalog(
          ['proposed', 'validated', 'stale'].includes(
            this.status(r.revisionId),
          ),
          'REVISION_ALREADY_ACTIVATED',
        );
        this.rows(
          "UPDATE identity_catalog_statuses SET status='abandoned' WHERE id=?",
          r.revisionId,
        );
        this.rows(
          'DELETE FROM identity_catalog_keys WHERE revision=? AND activated=0',
          r.revisionId,
        );
        for (const expected of r.candidateHeads) {
          const c = this.candidate(expected.candidateId);
          if (
            c.state === 'approved-pending' &&
            c.proposedRevisionId === r.revisionId
          ) {
            const previous = c.recordVersion;
            c.state = 'unresolved';
            c.proposedRevisionId = null;
            this.saveCandidate(c, previous);
          }
        }
      },
      time,
    );
  }
}
