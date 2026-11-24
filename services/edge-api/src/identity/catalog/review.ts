import { canonicalJson } from '../../ingest/canonical-json';
import { validateDriver } from '../../contract/normalized';
import { canonicalKey, discoveryKey } from '../discovery/keys';
import type { ProviderMappingKey } from './model';
import { collect } from '../../contract/normalized/issues';
import { slug } from '../../contract/normalized/values';
import type { CuratedDriver } from '../../providers/jolpica/curated-participants';
import { canonicalInstant } from '../../publication/canonical/instant';
import { integer, isHash, uuidPattern } from '../wire-decoders';
import type { IdentityHash } from '../discovery/model';
import { boundedJson, exact, records } from './sources';
import { requireCatalog } from './model';

export interface CatalogPrincipal {
  principalId: string;
  credentialId: string;
  authMethod: 'test-logical-principal' | 'individual-bearer';
  roles: ('reader' | 'reviewer' | 'activator')[];
}
/** Injected trusted capability resolver, never a request-body principal decoder.
 * U5 must supply individual authentication; production has no resolver in U4. */
export interface CatalogAuthority {
  verify(capability: unknown): CatalogPrincipal;
  isolatedLocalTests: boolean;
}
export type EvidenceReference =
  | { kind: 'observation'; observationId: IdentityHash }
  | {
      kind: 'repository';
      path: string;
      fileSha256: IdentityHash;
      recordPointer: string;
    }
  | { kind: 'citation'; httpsUrl: string; claimSummary: string };
export interface EvidenceClaim {
  field:
    | 'provider-key'
    | 'canonical-association'
    | 'fullName'
    | 'givenName'
    | 'familyName'
    | 'dateOfBirth'
    | 'nationality'
    | 'shortCode'
    | 'permanentNumber';
  value:
    | string
    | number
    | ProviderMappingKey
    | { key: ProviderMappingKey; targetId: string };
  sourceField: null;
}
export interface DossierInput {
  claims: EvidenceClaim[];
  references: EvidenceReference[];
  rationale: string;
  synthetic: boolean;
}
export interface ReviewEvidence extends DossierInput {
  evidenceId: IdentityHash;
  kind: 'review-dossier';
  createdAt: string;
  createdBy: CatalogPrincipal;
  projectionDigest: IdentityHash;
  /** Exact retained supporting records, not arbitrary fetched URL contents. */
  closure: { reference: EvidenceReference; body: unknown }[];
}
export interface DuplicateReview {
  catalogHashReviewed: IdentityHash;
  inspectedCanonicalIds: string[];
  evidenceIds: IdentityHash[];
  fullCatalogChecked: true;
  idExplicitlyReviewed: true;
  sameNameDistinction: string | null;
}
export const reasons = [
  'no-canonical-gridview-identity',
  'no-approved-provider-mapping',
  'insufficient-evidence',
  'conflicting-evidence',
  'ambiguous-person',
  'invalid-association',
  'invalid-provider-record',
  'duplicate-candidate',
  'new-evidence',
  'capacity-review-required',
] as const;
export type ReviewAction =
  | 'bind-existing'
  | 'create-driver'
  | 'approve-profile'
  | 'reject'
  | 'quarantine'
  | 'reopen'
  | 'request-correction';
export interface ReviewRequest {
  schemaVersion: 1;
  operationId: string;
  expectedActiveRevisionId: string;
  expectedActivationSequence: number;
  candidateId: IdentityHash | null;
  expectedCandidateVersion: number | null;
  evidenceHead: IdentityHash;
  action: ReviewAction;
  targetId: string | null;
  proposedBindingKey: ProviderMappingKey | null;
  profile: CuratedDriver | null;
  evidenceIds: IdentityHash[];
  reasonCode: (typeof reasons)[number];
  rationale: string;
  duplicateReview: DuplicateReview | null;
}
export interface ReviewDecision extends ReviewRequest {
  decisionId: string;
  baseRevisionId: string;
  principalId: string;
  credentialId: string;
  authMethod: 'test-logical-principal' | 'individual-bearer';
  decidedAt: string;
  profileHash: IdentityHash | null;
}
export const approval = (a: ReviewAction) =>
  ['bind-existing', 'create-driver', 'approve-profile'].includes(a);
export function textBound(v: unknown, max = 2000): asserts v is string {
  requireCatalog(
    typeof v === 'string' &&
      [...v].length > 0 &&
      [...v].length <= max &&
      [...v].every((c) => c.codePointAt(0)! >= 32 && c.codePointAt(0)! !== 127),
    'review-text',
  );
}
export function uuid(v: unknown): asserts v is string {
  requireCatalog(typeof v === 'string' && uuidPattern.test(v), 'operation-id');
}
export function instant(v: unknown): asserts v is string {
  requireCatalog(
    typeof v === 'string' && canonicalInstant(v) === v,
    'review-instant',
  );
}
export function key(v: unknown): ProviderMappingKey {
  const result = discoveryKey(v);
  requireCatalog(result, 'review-key');
  return result;
}
const isPublicIdGrammar = (v: unknown): v is string =>
  typeof v === 'string' &&
  collect('driverId', (c) => slug(v, 'driverId', c)).length === 0;
export function profile(v: unknown): CuratedDriver {
  exact(v, [
    'id',
    'fullName',
    'givenName',
    'familyName',
    'shortCode',
    'permanentNumber',
    'nationality',
    'countryCode',
    'dateOfBirth',
    'placeOfBirth',
    'biography',
  ]);
  requireCatalog(
    validateDriver({ ...v, media: null }, 'driver').length === 0,
    'review-profile',
  );
  for (const [field, value] of Object.entries(v))
    if (typeof value === 'string')
      textBound(
        value,
        field === 'biography' ? 8000 : field === 'shortCode' ? 16 : 200,
      );
  requireCatalog(
    v.permanentNumber === null || integer(v.permanentNumber),
    'review-profile-number',
  );
  return v as unknown as CuratedDriver;
}
export function decodeDossier(input: unknown): DossierInput {
  const v = boundedJson(input);
  exact(v, ['claims', 'references', 'rationale', 'synthetic']);
  textBound(v.rationale);
  requireCatalog(typeof v.synthetic === 'boolean', 'evidence-synthetic');
  const claims = records(v.claims),
    refs = records(v.references);
  requireCatalog(
    claims.length > 0 &&
      claims.length <= 32 &&
      refs.length > 0 &&
      refs.length <= 32,
    'evidence-count',
  );
  for (const c of claims) {
    exact(c, ['field', 'value', 'sourceField']);
    requireCatalog(c.sourceField === null, 'dossier-source-field');
    if (c.field === 'provider-key') key(c.value);
    else if (c.field === 'canonical-association') {
      exact(c.value, ['key', 'targetId']);
      key(c.value.key);
      requireCatalog(isPublicIdGrammar(c.value.targetId), 'association-id');
    } else {
      requireCatalog(
        [
          'fullName',
          'givenName',
          'familyName',
          'dateOfBirth',
          'nationality',
          'shortCode',
          'permanentNumber',
        ].includes(c.field as string),
        'evidence-field',
      );
      if (c.field === 'permanentNumber')
        requireCatalog(
          integer(c.value) ||
            (typeof c.value === 'string' && /^[0-9]{1,16}$/.test(c.value)),
          'evidence-number',
        );
      else {
        textBound(c.value, c.field === 'shortCode' ? 16 : 200);
        if (c.field === 'dateOfBirth')
          requireCatalog(
            /^\d{4}-\d{2}-\d{2}$/.test(c.value) &&
              new Date(c.value).toISOString().slice(0, 10) === c.value,
            'evidence-date',
          );
      }
    }
  }
  for (const r of refs) {
    if (r.kind === 'observation') {
      exact(r, ['kind', 'observationId']);
      requireCatalog(isHash(r.observationId), 'evidence-reference');
    } else if (r.kind === 'repository') {
      exact(r, ['kind', 'path', 'fileSha256', 'recordPointer']);
      textBound(r.path, 512);
      textBound(r.recordPointer, 512);
      requireCatalog(
        isHash(r.fileSha256) &&
          !r.path.startsWith('/') &&
          !r.path.includes('..') &&
          !/[:\\]/.test(r.path) &&
          r.recordPointer.startsWith('/'),
        'evidence-reference',
      );
    } else {
      exact(r, ['kind', 'httpsUrl', 'claimSummary']);
      requireCatalog(r.kind === 'citation', 'evidence-reference');
      textBound(r.httpsUrl, 1000);
      textBound(r.claimSummary);
      const u = new URL(r.httpsUrl);
      requireCatalog(
        u.protocol === 'https:' &&
          !u.username &&
          !u.password &&
          !u.search &&
          !u.hash &&
          !r.httpsUrl.includes('?') &&
          !r.httpsUrl.includes('#'),
        'citation-url',
      );
    }
  }
  requireCatalog(
    new Set(refs.map(canonicalJson)).size === refs.length,
    'duplicate-evidence-reference',
  );
  return v as unknown as DossierInput;
}
export function decodeReview(input: unknown): ReviewRequest {
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
  ]);
  requireCatalog(v.schemaVersion === 1, 'review-version');
  uuid(v.operationId);
  uuid(v.expectedActiveRevisionId);
  requireCatalog(
    integer(v.expectedActivationSequence) && isHash(v.evidenceHead),
    'review-version',
  );
  requireCatalog(
    [
      'bind-existing',
      'create-driver',
      'approve-profile',
      'reject',
      'quarantine',
      'reopen',
      'request-correction',
    ].includes(v.action as string),
    'review-action',
  );
  requireCatalog(
    reasons.includes(v.reasonCode as (typeof reasons)[number]) &&
      (v.action === 'reopen'
        ? v.reasonCode === 'new-evidence'
        : v.reasonCode !== 'new-evidence'),
    'review-reason',
  );
  textBound(v.rationale);
  requireCatalog(
    (v.candidateId === null && v.expectedCandidateVersion === null) ||
      (isHash(v.candidateId) && integer(v.expectedCandidateVersion, 1)),
    'review-candidate',
  );
  requireCatalog(
    v.targetId === null || isPublicIdGrammar(v.targetId),
    'review-target',
  );
  if (v.proposedBindingKey !== null)
    requireCatalog(
      key(v.proposedBindingKey).entity === 'driver',
      'review-driver-only',
    );
  if (v.profile !== null) profile(v.profile);
  requireCatalog(
    Array.isArray(v.evidenceIds) &&
      v.evidenceIds.length <= 32 &&
      v.evidenceIds.every(isHash) &&
      new Set(v.evidenceIds).size === v.evidenceIds.length,
    'review-evidence',
  );
  if (v.duplicateReview !== null) {
    const d = v.duplicateReview;
    exact(d, [
      'catalogHashReviewed',
      'inspectedCanonicalIds',
      'evidenceIds',
      'fullCatalogChecked',
      'idExplicitlyReviewed',
      'sameNameDistinction',
    ]);
    requireCatalog(
      isHash(d.catalogHashReviewed) &&
        Array.isArray(d.inspectedCanonicalIds) &&
        d.inspectedCanonicalIds.every(isPublicIdGrammar) &&
        Array.isArray(d.evidenceIds) &&
        d.evidenceIds.every(isHash) &&
        d.fullCatalogChecked === true &&
        d.idExplicitlyReviewed === true,
      'duplicate-review',
    );
    if (d.sameNameDistinction !== null) textBound(d.sameNameDistinction);
  }
  const a = v.action;
  if (approval(a as ReviewAction)) {
    requireCatalog(
      v.targetId !== null && v.evidenceIds.length > 0,
      'approval-inputs',
    );
    requireCatalog(
      a === 'approve-profile'
        ? v.candidateId === null && v.proposedBindingKey === null
        : v.candidateId !== null && v.proposedBindingKey !== null,
      'approval-scope',
    );
    requireCatalog(
      a === 'bind-existing'
        ? v.profile === null
        : v.profile !== null && profile(v.profile).id === v.targetId,
      'approval-profile',
    );
    requireCatalog(
      a === 'create-driver'
        ? v.duplicateReview !== null
        : v.duplicateReview === null,
      'approval-duplicate-review',
    );
  } else {
    requireCatalog(
      v.profile === null &&
        v.targetId === null &&
        v.proposedBindingKey === null &&
        v.duplicateReview === null &&
        v.candidateId !== null,
      'disposition-inputs',
    );
  }
  return v as unknown as ReviewRequest;
}
export function checkAssociation(
  d: ReviewRequest,
  evidence: ReviewEvidence[],
): void {
  const supports = evidence.filter((e) => d.evidenceIds.includes(e.evidenceId));
  requireCatalog(supports.length === d.evidenceIds.length, 'evidence-closure');
  requireCatalog(
    supports.some((e) =>
      e.claims.some(
        (c) =>
          c.field === 'fullName' &&
          (d.profile === null || c.value === d.profile.fullName),
      ),
    ),
    'evidence-name',
  );
  if (d.proposedBindingKey)
    requireCatalog(
      supports.some((e) =>
        e.claims.some((c) => {
          if (
            c.field !== 'canonical-association' ||
            typeof c.value !== 'object' ||
            !('key' in c.value)
          )
            return false;
          return (
            canonicalKey(c.value.key) === canonicalKey(d.proposedBindingKey!) &&
            c.value.targetId === d.targetId
          );
        }),
      ),
      'evidence-association',
    );
}
