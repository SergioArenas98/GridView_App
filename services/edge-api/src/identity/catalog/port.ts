import type { IdentityHash } from '../discovery/model';
import type { SeedArtifact } from './model';
import type { DossierInput, ReviewEvidence, ReviewRequest } from './review';
import type { CatalogHead, CatalogRevision, ProposalStatus } from './revision';
import type {
  RevisionOperation,
  ActivationRequest,
  ActivationResult,
  ValidationCertificate,
} from './activation';
import type {
  CorrectionRequest,
  IdentityCorrection,
  CorrectionStatus,
} from './correction';
import type { ReviewResult } from './workflow';

/** Internal capability-bearing interface. U4 supplies no HTTP administration,
 * credentials or runtime reader; only the isolated test adapter grants a
 * logical capability. Unknown data is still decoded at implementation entry. */
export interface IdentityReviewPort {
  head(): CatalogHead;
  status(revisionId: string): ProposalStatus;
  recordEvidence(
    request: { schemaVersion: 1; operationId: string; dossier: DossierInput },
    capability: unknown,
  ): Promise<ReviewEvidence>;
  proposeSeed(
    seed: SeedArtifact,
    request: {
      schemaVersion: 1;
      operationId: string;
      revisionId: string;
      expectedActiveRevisionId: null;
      expectedActivationSequence: 0;
    },
    capability: unknown,
  ): Promise<CatalogRevision>;
  review(request: ReviewRequest, capability: unknown): Promise<ReviewResult>;
  validate(
    request: RevisionOperation,
    capability: unknown,
  ): Promise<ValidationCertificate>;
  activate(
    request: ActivationRequest,
    capability: unknown,
  ): Promise<ActivationResult>;
  abandon(
    request: RevisionOperation,
    capability: unknown,
  ): Promise<{ revisionId: string; status: 'abandoned' }>;
  reportCorrection(
    request: CorrectionRequest,
    capability: unknown,
  ): Promise<IdentityCorrection>;
  correctionStatus(
    request: {
      schemaVersion: 1;
      operationId: string;
      correctionId: string;
      expectedEventId: string;
      status: Exclude<CorrectionStatus, 'reported'>;
      rationale: string;
    },
    capability: unknown,
  ): Promise<{ eventId: string; status: CorrectionStatus }>;
  readRevision(revisionId: string): Promise<CatalogRevision>;
  exportRevision(revisionId: string): Promise<string>;
  readOperation(
    principalId: string,
    family: string,
    operationId: string,
  ): Promise<unknown>;
}
/** Explicit profile-only evidence heads hash the immutable supporting records. */
export type ProfileEvidenceHead = IdentityHash;
