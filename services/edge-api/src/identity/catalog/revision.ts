import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import { canonicalKey } from '../discovery/keys';
import { reviewedRegistry } from './indexes';
import { compareUtf8 } from '../../publication/canonical/ordering';
import { hashIdentityProjection } from '../discovery/keys';
import type { IdentityHash } from '../discovery/model';
import { catalogLimits, requireCatalog, type CatalogSnapshot } from './model';
import {
  approval,
  checkAssociation,
  decodeReview,
  instant,
  textBound,
  uuid,
  type ReviewDecision,
  type ReviewEvidence,
} from './review';
import { projectSeasons } from './dataset-version';
import { boundedJson, exact } from './sources';
import { isHash, integer } from '../wire-decoders';

import type { BaseImportDecision } from './base-import';
export interface ReviewedSnapshot extends CatalogSnapshot {
  reviewBaseImports?: BaseImportDecision[];
  reviewDecisions?: ReviewDecision[];
  reviewEvidence?: ReviewEvidence[];
}
export interface CandidateHead {
  candidateId: IdentityHash;
  recordVersion: number;
  evidenceHead: IdentityHash;
}
export interface CatalogRevision {
  revisionId: string;
  sequence: number;
  parentRevisionId: string | null;
  parentContentHash: IdentityHash | null;
  catalogSchemaVersion: 1;
  contentHash: IdentityHash;
  createdAt: string;
  createdByPrincipal: string;
  decisionIds: string[];
  baseContentDigest: IdentityHash;
  snapshotByteLength: number;
  snapshot: ReviewedSnapshot;
  candidateHeads: CandidateHead[];
}
export type ProposalStatus =
  'proposed' | 'validated' | 'activated' | 'abandoned' | 'stale';
export interface CatalogHead {
  installationId: string;
  activeRevisionId: string | null;
  activationSequence: number;
  schemaVersion: 1;
  admissionState: 'open' | 'paused';
  seedDigest: IdentityHash | null;
  minimumReaderVersion: 1;
  legacyV1AdmissionEnabled: boolean;
  hasRuntimeOnlyActivation: boolean;
}
export function decodeDecision(input: unknown): ReviewDecision {
  const v = boundedJson(input);
  exact(v, [
    'schemaVersion',
    'operationId',
    'expectedActiveRevisionId',
    'expectedActivationSequence',
    'candidateId',
    'expectedCandidateVersion',
    'evidenceHead',
    'action',
    'targetId',
    'proposedBindingKey',
    'profile',
    'evidenceIds',
    'reasonCode',
    'rationale',
    'duplicateReview',
    'decisionId',
    'baseRevisionId',
    'principalId',
    'credentialId',
    'authMethod',
    'decidedAt',
    'profileHash',
  ]);
  const {
    decisionId,
    baseRevisionId,
    principalId,
    credentialId,
    authMethod,
    decidedAt,
    profileHash,
    ...request
  } = v;
  decodeReview(request);
  uuid(decisionId);
  uuid(baseRevisionId);
  textBound(principalId, 200);
  textBound(credentialId, 200);
  instant(decidedAt);
  requireCatalog(
    ['test-logical-principal', 'individual-bearer'].includes(
      authMethod as string,
    ) && baseRevisionId === request.expectedActiveRevisionId,
    'decision-provenance',
  );
  requireCatalog(
    profileHash === null || typeof profileHash === 'string',
    'decision-profile-hash',
  );
  return v as unknown as ReviewDecision;
}
/** Deterministic, complete parent delta. A caller never submits a partial
 * replacement catalog. Equality against this rebuild is the closed decoder. */
export async function applyDecision(
  parent: ReviewedSnapshot,
  d: ReviewDecision,
  support: ReviewEvidence[],
): Promise<ReviewedSnapshot> {
  decodeDecision(d);
  requireCatalog(approval(d.action), 'proposal-action');
  checkAssociation(d, support);
  const s = structuredClone(parent);
  if (d.action === 'create-driver') {
    requireCatalog(
      !s.drivers.some((x) => x.anchor.driverId === d.targetId),
      'canonical-id-conflict',
    );
    const dup = d.duplicateReview!;
    const ids = s.drivers.map((x) => x.anchor.driverId).sort(compareUtf8);
    requireCatalog(
      canonicalJson(dup.inspectedCanonicalIds) === canonicalJson(ids) &&
        dup.catalogHashReviewed === (await hashIdentityProjection(parent)) &&
        dup.evidenceIds.length > 0 &&
        dup.evidenceIds.every((id) => d.evidenceIds.includes(id)),
      'complete-duplicate-review',
    );
    if (s.drivers.some((x) => x.profile.fullName === d.profile!.fullName))
      requireCatalog(dup.sameNameDistinction !== null, 'same-name-distinction');
    s.drivers.push({
      anchor: {
        driverId: d.targetId!,
        origin: 'reviewed-new',
        createdDecisionId: d.decisionId,
        createdAt: d.decidedAt,
      },
      profileVersion: 1,
      profileHash: await hashIdentityProjection(d.profile),
      profile: d.profile!,
      decisionId: d.decisionId,
      evidenceIds: d.evidenceIds,
    });
  } else {
    const driver = s.drivers.find((x) => x.anchor.driverId === d.targetId);
    requireCatalog(driver, 'canonical-target-missing');
    if (d.action === 'approve-profile') {
      requireCatalog(
        canonicalJson(d.profile) !== canonicalJson(driver.profile),
        'no-effective-change',
      );
      driver.profile = d.profile!;
      driver.profileVersion++;
      driver.profileHash = await hashIdentityProjection(driver.profile);
      driver.decisionId = d.decisionId;
      driver.evidenceIds = d.evidenceIds;
    }
  }
  requireCatalog(
    d.profileHash ===
      (d.profile === null ? null : await hashIdentityProjection(d.profile)),
    'decision-profile-hash',
  );
  if (d.proposedBindingKey) {
    requireCatalog(
      !s.bindings.some(
        (b) => canonicalKey(b.key) === canonicalKey(d.proposedBindingKey!),
      ),
      'binding-conflict',
    );
    const content = {
      key: d.proposedBindingKey,
      targetEntity: d.proposedBindingKey.entity,
      targetId: d.targetId!,
      decisionId: d.decisionId,
      evidenceIds: d.evidenceIds,
      createdAt: d.decidedAt,
    };
    s.bindings.push({
      ...content,
      bindingId: await hashIdentityProjection(content),
    });
    // Preserve the acknowledgement as historical evidence in sourceDocuments,
    // while this revision's effective unresolved index reflects the reviewed key.
    s.unresolved = s.unresolved.filter(
      (u) => canonicalKey(u.key) !== canonicalKey(d.proposedBindingKey!),
    );
  }
  s.drivers.sort((a, b) => compareUtf8(a.anchor.driverId, b.anchor.driverId));
  s.bindings.sort((a, b) =>
    compareUtf8(canonicalKey(a.key), canonicalKey(b.key)),
  );
  s.reviewDecisions = [...(s.reviewDecisions ?? []), d].sort((a, b) =>
    compareUtf8(a.decisionId, b.decisionId),
  );
  const evidence = new Map(
    (s.reviewEvidence ?? []).map((e) => [e.evidenceId, e]),
  );
  support.forEach((e) => evidence.set(e.evidenceId, e));
  s.reviewEvidence = [...evidence.values()].sort((a, b) =>
    compareUtf8(a.evidenceId, b.evidenceId),
  );
  await projectSeasons(s);
  checkSnapshotCapacity(s);
  const registry = reviewedRegistry(s);
  requireCatalog(
    registry.isValid && registry.size === s.bindings.length,
    'revision-registry',
  );
  return s;
}
export function checkSnapshotCapacity(s: ReviewedSnapshot): void {
  requireCatalog(
    s.drivers.length <= catalogLimits.drivers &&
      s.bindings.length <= catalogLimits.bindings &&
      utf8(canonicalJson(s)).length <= catalogLimits.snapshotBytes,
    'snapshot-capacity',
  );
}
export function decodeRevision(input: unknown): CatalogRevision {
  const v = boundedJson(input);
  exact(v, [
    'revisionId',
    'sequence',
    'parentRevisionId',
    'parentContentHash',
    'catalogSchemaVersion',
    'contentHash',
    'createdAt',
    'createdByPrincipal',
    'decisionIds',
    'baseContentDigest',
    'snapshotByteLength',
    'snapshot',
    'candidateHeads',
  ]);
  uuid(v.revisionId);
  instant(v.createdAt);
  textBound(v.createdByPrincipal, 200);
  requireCatalog(
    v.catalogSchemaVersion === 1 &&
      isHash(v.contentHash) &&
      isHash(v.baseContentDigest) &&
      (v.parentContentHash === null || isHash(v.parentContentHash)) &&
      integer(v.snapshotByteLength, 1, catalogLimits.snapshotBytes) &&
      typeof v.sequence === 'number' &&
      Number.isSafeInteger(v.sequence) &&
      v.sequence > 0 &&
      Array.isArray(v.decisionIds) &&
      Array.isArray(v.candidateHeads),
    'revision-schema',
  );
  if (v.parentRevisionId !== null) uuid(v.parentRevisionId);
  for (const id of v.decisionIds) uuid(id);
  for (const c of v.candidateHeads) {
    exact(c, ['candidateId', 'recordVersion', 'evidenceHead']);
    requireCatalog(
      isHash(c.candidateId) &&
        isHash(c.evidenceHead) &&
        typeof c.recordVersion === 'number' &&
        Number.isSafeInteger(c.recordVersion) &&
        c.recordVersion > 0,
      'revision-candidate-head',
    );
  }
  return v as unknown as CatalogRevision;
}
