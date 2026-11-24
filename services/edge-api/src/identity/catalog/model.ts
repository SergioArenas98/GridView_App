import type {
  CuratedDriver,
  CuratedConstructor,
} from '../../providers/jolpica/curated-participants';
import type { CuratedCircuit } from '../../providers/jolpica/curated-circuits';
import type { ProviderMappingKey } from '../../providers/mappings/mapping-key';
export type { ProviderMappingKey };
import type { IdentityHash } from '../discovery/model';

export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export type Document = { [key: string]: Json };
export interface RepositorySource {
  path: string;
  /** Exact UTF-8 source bytes, retained for hash verification on reimport. */
  text: string;
  fileHash: IdentityHash;
  semanticHash: IdentityHash;
  documentVersion: number | string | null;
  sourceStatus: string;
  /** Only a real commit containing these exact bytes; null for dirty/CRLF bytes. */
  exactCommit: string | null;
  /** Available repository history, explicitly NOT a claim about these bytes. */
  baseCommit: string;
}
export interface RepositoryReference {
  path: string;
  fileHash: IdentityHash;
  pointer: string;
}
export interface ImportDecision {
  decisionId: IdentityHash;
  evidenceId: IdentityHash;
  kind: 'historical-repository-import';
  reference: RepositoryReference;
  historicalReviewer: null;
  historicalApprovedAt: null;
}
export interface DriverMember {
  anchor: {
    driverId: string;
    origin: 'repository-import' | 'reviewed-new';
    createdDecisionId: string;
    createdAt: string | null;
  };
  profileVersion: number;
  profileHash: IdentityHash;
  profile: CuratedDriver;
  decisionId: string;
  evidenceIds: IdentityHash[];
}
export interface CatalogEvidence {
  evidenceId: IdentityHash;
  key: ProviderMappingKey;
  reference: RepositoryReference;
  originalProvenance: string;
  status:
    'historical-mapped' | 'historical-unresolved' | 'pending-operator-report';
  /** Repository claims, never fabricated online observations. */
  origin: 'repository-import';
}
export interface CatalogBinding {
  bindingId: IdentityHash;
  key: ProviderMappingKey;
  targetEntity: ProviderMappingKey['entity'];
  targetId: string;
  decisionId: string;
  evidenceIds: IdentityHash[];
  createdAt: string | null;
}
export interface CatalogSnapshot {
  format: 'gridview-identity-catalog/1';
  drivers: DriverMember[];
  constructors: CuratedConstructor[];
  circuits: CuratedCircuit[];
  events: { id: string; name: string }[];
  bindings: CatalogBinding[];
  evidence: CatalogEvidence[];
  importDecisions: ImportDecision[];
  unresolved: {
    key: ProviderMappingKey;
    reason: string;
    detail: string;
    evidenceId: IdentityHash;
    reference: RepositoryReference;
  }[];
  seasonContent: {
    season: number;
    datasetVersion: string;
    seasonLabel: string;
    seasonProjectionHash: IdentityHash;
    baseContentDigest: IdentityHash;
  }[];
  /** Exact validated document content, including sealed non-driver and seasonal base. */
  sourceDocuments: { path: string; document: Document }[];
}
/** Offline R0 package, not an authenticated CatalogRevision or activation. */
export interface SeedArtifact {
  format: 'gridview-identity-seed/1';
  catalogSchemaVersion: 1;
  state: 'prepared-unactivated';
  revisionId: null;
  sequence: 0;
  parentRevisionId: null;
  contentHash: IdentityHash;
  snapshotByteLength: number;
  sources: RepositorySource[];
  snapshot: CatalogSnapshot;
}
export const catalogLimits = {
  snapshotBytes: 2 * 1024 * 1024,
  exportBytes: 2 * 1024 * 1024,
  drivers: 10000,
  bindings: 100000,
} as const;
export class CatalogValidationError extends Error {
  constructor(readonly code: string) {
    super('Identity seed rejected: ' + code);
  }
}
export function requireCatalog(
  condition: unknown,
  code: string,
): asserts condition {
  if (!condition) throw new CatalogValidationError(code);
}
