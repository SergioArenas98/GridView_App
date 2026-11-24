import type { IdentityHash } from '../discovery/model';
import type { CandidateHead } from './revision';
export const catalogValidatorVersion = 'gridview-identity-validator/u4.1';
export interface ValidationCertificate {
  certificateId: string;
  revisionId: string;
  contentHash: IdentityHash;
  proposalHash: IdentityHash;
  validatorVersion: typeof catalogValidatorVersion;
  baseRevisionId: string | null;
  baseContentHash: IdentityHash | null;
  evidenceHeads: CandidateHead[];
  evidenceStateHash: IdentityHash;
  reportHash: IdentityHash;
  validatedAt: string;
  validatedByPrincipal: string;
  issues: string[];
  valid: boolean;
}
export interface RevisionOperation {
  schemaVersion: 1;
  operationId: string;
  revisionId: string;
  expectedActiveRevisionId: string | null;
  expectedActivationSequence: number;
}
export interface ActivationRequest extends RevisionOperation {
  certificateId: string;
}
export interface ActivationResult {
  outcome: 'activated' | 'conflict';
  revisionId: string;
  activationSequence: number;
  code: null | 'CATALOG_HEAD_CONFLICT';
}
