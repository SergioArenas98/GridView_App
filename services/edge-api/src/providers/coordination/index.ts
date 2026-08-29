/**
 * The multi-source provider coordination seam (gap G4).
 *
 * **Dormant by design.** No Jolpica adapter and no OpenF1 adapter exist, so no
 * port is registered anywhere in production wiring, `PROVIDER_MODE` still
 * admits exactly `mock | none`, and no provider request is possible. The mock
 * provider remains the whole-season deterministic double the synchronization
 * service drives, unchanged.
 *
 * What is real is the mechanism: independent per-source ports, typed
 * per-resource requests and outcomes, source role and capability policy owned
 * above the adapters, complete partial-success semantics, deterministic
 * role-based selection, exact once-per-request accounting, cancellation
 * containment and a guarded bridge to the unchanged publication boundary.
 */

export {
  MultiSourceCoordinator,
  CoordinatorConfigurationError,
  defaultMaxConcurrentOperations,
  maxAllowedConcurrentOperations,
} from './coordinator';
export type {
  CoordinationPlan,
  CoordinationRequest,
  MultiSourceCoordinatorOptions,
} from './coordinator';

export {
  COORDINATION_CONTRIBUTION_OPERATION,
  COORDINATION_RUN_OPERATION,
  COORDINATION_SELECTION_OPERATION,
  contributionEvent,
  runEvent,
  selectionEvent,
} from './coordination-signal';

export {
  CoordinatedSeasonPublication,
  COORDINATED_PUBLICATION_OPERATION,
} from './coordinated-publication';
export type {
  CoordinatedPublicationOutcome,
  CoordinatedSeasonPublicationOptions,
} from './coordinated-publication';

export {
  coordinationFailureReasons,
  coordinationFor,
  planProblems,
} from './outcome';
export type {
  ContributionStatus,
  CoordinationCounts,
  CoordinationFailureReason,
  CoordinationOutcomeReason,
  CoordinationRun,
  PlanProblem,
  ResourceCoordination,
  ResourceSelection,
  SourceContribution,
} from './outcome';

export {
  attemptOutcomesForFailureReason,
  attemptedFailureReasons,
  isInstant,
  isWellFormedOutcome,
  notAttemptedReasons,
  transportReferenceMaxLength,
} from './port';
export type {
  AttemptedFailureReason,
  NotAttemptedReason,
  ProviderResourceOutcome,
  ProviderResourcePort,
  ProviderResourceRequest,
  ProviderTransportAttempt,
} from './port';

export {
  classifiedSessionTypes,
  coordinatedResourceKinds,
  isCoordinatedResource,
  jobCategoryForResource,
  payloadMatchesResource,
  resourceKey,
} from './resource';
export type {
  ClassifiedSessionType,
  CoordinatedPayload,
  CoordinatedPayloadFor,
  CoordinatedResource,
  CoordinatedResourceKind,
} from './resource';

export { assembleSeasonSource, assemblyGaps } from './season-assembly';
export type {
  AssemblyGap,
  SeasonAssembly,
  SeasonSnapshotMetadata,
} from './season-assembly';

export { seasonRelations, validateSeasonReferences } from './season-integrity';
export type { SeasonRelation } from './season-integrity';

export {
  coordinatedSourceIds,
  decideProvisionalEligibility,
  isCoordinatedSourceId,
  recordedProvisionalSessionEndBound,
  rolePrecedenceOf,
  sourceRoles,
  sourceRoleOf,
  sourceSelectable,
  sourceSupportsResource,
  sourceUnlockedByPolicy,
} from './source-policy';
export type {
  CoordinatedSourceId,
  ProvisionalEligibility,
  ProvisionalSessionEndBound,
  SourceRole,
} from './source-policy';
