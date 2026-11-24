import type {
  IdentityObservationDraft,
  IdentityHash,
  IdentityEvidenceProjection,
  IdentityKeyReference,
} from './discovery/model';
import type { ProviderMappingKey } from '../providers/mappings/mapping-key';
export const identityLimits = Object.freeze({
  candidatesPerScope: 1024,
  candidates: 4096,
  projections: 32,
  occurrences: 64,
  contexts: 64,
  recordBytes: 8192,
  batchCount: 100,
  batchBytes: 256 * 1024,
  logicalBytes: 256 * 1024 * 1024,
  audits: 16384,
});
export type CandidateState =
  | 'unresolved'
  | 'quarantined'
  | 'rejected'
  | 'approved-pending'
  | 'resolved'
  | 'archived';
export interface Candidate {
  candidateId: IdentityHash;
  key: ProviderMappingKey;
  state: CandidateState;
  archivedState: CandidateState | null;
  recordVersion: number;
  evidenceHead: IdentityHash;
  firstSeenAt: string;
  lastSeenAt: string;
  lastRecordedAt: string;
  observationCount: number;
  distinctEvidenceCount: number;
  contexts: Pick<IdentityKeyReference, 'resource' | 'round' | 'sessionType'>[];
  overflowed: boolean;
  conflict: boolean;
  newEvidence: boolean;
  urgent: boolean;
  reviewGeneration: number;
  notificationGeneration: number;
  acknowledgedNotificationGeneration: number;
  latestDecisionId: string | null;
  proposedRevisionId: string | null;
  resolvedRevisionId: string | null;
}
export interface MaterialProjection {
  evidenceDigest: IdentityHash;
  evidence: IdentityEvidenceProjection;
  key: ProviderMappingKey;
  resource: IdentityKeyReference['resource'];
  round: number | null;
  sessionType: 'race' | null;
  provenanceKind: 'provider-observation';
  extractorVersion: 'jolpica-identity/1';
}
export type StoredObservation = Omit<IdentityObservationDraft, 'recordedAt'> & {
  recordedAt: string;
};
/** First-admission provenance survives expiry of unreferenced occurrence detail. */
export interface MaterialEvidence {
  projection: MaterialProjection;
  source: Pick<
    StoredObservation,
    | 'observationId'
    | 'candidateId'
    | 'runId'
    | 'requestOrdinal'
    | 'endpointKind'
    | 'observedAt'
    | 'recordedAt'
    | 'catalogRef'
    | 'provenance'
    | 'omittedFields'
  >;
}
export interface ObserveResult {
  persisted: number;
  replayed: number;
  created: number;
  dropped: number;
}
export interface ListRequest {
  cursor: IdentityHash | null;
  limit: number;
  unread: boolean;
}
export interface InspectRequest {
  candidateId: IdentityHash;
  section: 'candidate' | 'evidence' | 'observations';
  cursor: IdentityHash | null;
  limit: number;
}
export interface Notification {
  candidateId: IdentityHash;
  generation: number;
  acknowledgedBy: string | null;
  acknowledgedCredentialId: string | null;
  acknowledgedAt: string | null;
}
export type CandidateSummary = Pick<
  Candidate,
  | 'candidateId'
  | 'key'
  | 'state'
  | 'recordVersion'
  | 'lastSeenAt'
  | 'observationCount'
  | 'distinctEvidenceCount'
  | 'overflowed'
  | 'conflict'
  | 'newEvidence'
  | 'urgent'
  | 'notificationGeneration'
  | 'acknowledgedNotificationGeneration'
>;
export interface ListResult {
  items: CandidateSummary[];
  cursor: IdentityHash | null;
}
export interface InspectResult {
  candidate: Candidate;
  notification: Notification;
  items: (MaterialEvidence | StoredObservation)[];
  cursor: IdentityHash | null;
}
export interface HealthResult {
  schemaVersion: 1;
  installationId: string;
  candidates: number;
  observations: number;
  evidence: number;
  unread: number;
  unresolved: number;
  quarantined: number;
  oldestUnresolvedAt: string | null;
  logicalBytes: number;
  capacityRatio: number;
  warning: boolean;
  maintenanceCursor: string;
  persisted: number;
  replayed: number;
  dropped: number;
}
export interface ReaderPrincipal {
  principalId: string;
  credentialId: string;
  role: 'reader';
}
export interface AcknowledgeRequest {
  candidateId: IdentityHash;
  notificationGeneration: number;
}
export interface IdentityPort {
  observe(request: {
    observations: readonly IdentityObservationDraft[];
  }): Promise<ObserveResult>;
  list(request: ListRequest): Promise<ListResult>;
  inspect(request: InspectRequest): Promise<InspectResult>;
  health(): Promise<HealthResult>;
}
export type IdentityCommand =
  'observe-batch' | 'list' | 'inspect' | 'acknowledge' | 'health';
export type IdentityErrorCode =
  | 'invalid-request'
  | 'installation-mismatch'
  | 'schema-version'
  | 'capacity'
  | 'conflict'
  | 'not-found'
  | 'unavailable';
export class IdentityError extends Error {
  constructor(readonly code: IdentityErrorCode) {
    super(code);
  }
}
