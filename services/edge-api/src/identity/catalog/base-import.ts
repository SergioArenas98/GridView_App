import { compareUtf8 } from '../../publication/canonical/ordering';
/** Deterministic U5 adapter for the existing reviewed, sealed-base import.
 * Driver identities/profiles and all existing exact binding targets survive. */
import { canonicalJson } from '../../ingest/canonical-json';
import { canonicalKey, hashIdentityProjection } from '../discovery/keys';
import type { IdentityHash } from '../discovery/model';
import { requireCatalog, type RepositorySource } from './model';
import type { CatalogPrincipal, ReviewEvidence } from './review';
import { instant, textBound, uuid } from './review';
import type { ReviewedSnapshot } from './revision';
import { checkSnapshotCapacity } from './revision';
import { projectSeasons } from './dataset-version';
import { prepareSeed } from './seed';
import { exact } from './sources';
import { reviewedRegistry } from './indexes';

export interface BaseImportDecision {
  decisionId: string;
  action: 'import-base';
  operationId: string;
  baseRevisionId: string;
  principalId: string;
  credentialId: string;
  authMethod: CatalogPrincipal['authMethod'];
  decidedAt: string;
  artifactSources: RepositorySource[];
  artifactHash: IdentityHash;
  evidenceIds: IdentityHash[];
  rationale: string;
  candidateId: null;
  expectedCandidateVersion: null;
  evidenceHead: IdentityHash;
}
export async function applyReviewedBase(
  parent: ReviewedSnapshot,
  d: BaseImportDecision,
  support: ReviewEvidence[],
): Promise<ReviewedSnapshot> {
  exact(d, [
    'decisionId',
    'action',
    'operationId',
    'baseRevisionId',
    'principalId',
    'credentialId',
    'authMethod',
    'decidedAt',
    'artifactSources',
    'artifactHash',
    'evidenceIds',
    'rationale',
    'candidateId',
    'expectedCandidateVersion',
    'evidenceHead',
  ]);
  uuid(d.decisionId);
  uuid(d.operationId);
  uuid(d.baseRevisionId);
  instant(d.decidedAt);
  textBound(d.principalId, 200);
  textBound(d.credentialId, 200);
  textBound(d.rationale);
  requireCatalog(
    d.action === 'import-base' &&
      ['test-logical-principal', 'individual-bearer'].includes(d.authMethod) &&
      d.candidateId === null &&
      d.expectedCandidateVersion === null,
    'base-import-decision',
  );
  const artifact = await prepareSeed(d.artifactSources);
  requireCatalog(
    d.artifactHash === (await hashIdentityProjection(artifact)) &&
      d.evidenceHead === (await hashIdentityProjection(support)) &&
      d.evidenceIds.length > 0 &&
      d.evidenceIds.length === support.length &&
      support.every((e) => d.evidenceIds.includes(e.evidenceId)),
    'base-import-evidence',
  );
  const donor = artifact.snapshot;
  const s = structuredClone(parent);
  requireCatalog(
    donor.drivers.every((v) =>
      parent.drivers.some((x) => x.anchor.driverId === v.anchor.driverId),
    ),
    'base-import-driver-creation-forbidden',
  );
  for (const binding of donor.bindings) {
    const previous = s.bindings.find(
      (b) => canonicalKey(b.key) === canonicalKey(binding.key),
    );
    requireCatalog(
      !previous || previous.targetId === binding.targetId,
      'base-import-binding-conflict',
    );
    if (!previous) {
      requireCatalog(
        binding.key.entity !== 'driver',
        'base-import-driver-binding-forbidden',
      );
      s.bindings.push(binding);
    }
  }
  const merge = <T>(old: T[], next: T[], id: (value: T) => string) =>
    [...new Map([...old, ...next].map((x) => [id(x), x])).values()].sort(
      (a, b) => compareUtf8(id(a), id(b)),
    );
  s.constructors = merge(s.constructors, donor.constructors, (x) => x.id);
  s.circuits = merge(s.circuits, donor.circuits, (x) => x.id);
  s.events = merge(s.events, donor.events, (x) => x.id);
  s.evidence = merge(s.evidence, donor.evidence, (x) => x.evidenceId);
  s.importDecisions = merge(
    s.importDecisions,
    donor.importDecisions,
    (x) => x.decisionId,
  );
  s.sourceDocuments = structuredClone(donor.sourceDocuments);
  requireCatalog(
    parent.seasonContent.every((old) =>
      donor.seasonContent.some((next) => next.season === old.season),
    ),
    'base-import-season-removal',
  );
  s.seasonContent = donor.seasonContent.map((v) => ({
    ...v,
    datasetVersion:
      parent.seasonContent.find((x) => x.season === v.season)?.datasetVersion ??
      v.datasetVersion,
  }));
  s.bindings.sort((a, b) =>
    compareUtf8(canonicalKey(a.key), canonicalKey(b.key)),
  );
  s.unresolved = merge(s.unresolved, donor.unresolved, (x) =>
    canonicalKey(x.key),
  ).filter(
    (u) => !s.bindings.some((b) => canonicalKey(b.key) === canonicalKey(u.key)),
  );
  s.reviewEvidence = merge(
    s.reviewEvidence ?? [],
    support,
    (x) => x.evidenceId,
  );
  s.reviewBaseImports = merge(
    s.reviewBaseImports ?? [],
    [d],
    (x) => x.decisionId,
  );
  await projectSeasons(s);
  checkSnapshotCapacity(s);
  requireCatalog(reviewedRegistry(s).isValid, 'base-import-registry');
  requireCatalog(
    canonicalJson(parent) !== canonicalJson(s),
    'no-effective-change',
  );
  return s;
}
