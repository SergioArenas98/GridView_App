/**
 * The season publication sequencer mechanism (ADR 0025), as one entry point.
 *
 * **Inert unless explicitly selected.** The Durable Object class is exported
 * from the Worker entry point and registered in `wrangler.toml` (see
 * `durable-object.ts`), but the port is reached only once
 * `SEASON_PUBLICATION_AUTHORITY` is explicitly `sequencer`, which no committed
 * environment sets. No public API, OpenAPI contract, routing or cache behaviour
 * changes because these modules exist.
 */

export {
  candidateVersionForEpoch,
  epochOfCandidateVersion,
  maximumOperationEpoch,
  randomOpaqueVersionComponent,
  sidecarRequiredVersionPrefix,
  versionNamespace,
  type OpaqueVersionComponent,
  type VersionNamespace,
} from './candidate-version';
export {
  isManifestCommitment,
  manifestCommitment,
  manifestCommitmentAlgorithm,
  manifestCommitmentFormatVersion,
  manifestCommitmentText,
} from './manifest-commitment';
export * from './model';
export {
  authorityStorageKey,
  committedKeyPrefix,
  maximumManifestSize,
  operationStorageKey,
  pendingCleanupStorageKey,
  preparedKeyPrefix,
  readPendingCleanupRecord,
  type SequencerHost,
  type SequencerRecordStore,
} from './store';
export {
  durableObjectSequencerHost,
  MemorySequencerHost,
  type SequencerDurableHost,
} from './hosts';
export {
  defaultPreparationTtlMs,
  randomOperationToken,
  SeasonPublicationCoordinator,
  type OperationTokenSource,
  type SequencerOptions,
} from './coordinator';
export {
  assignObservationTimestamps,
  validateCutoverSeed,
  validatePrepareRequest,
} from './rules';
export {
  LocalSeasonPublicationSequencer,
  type SeasonPublicationSequencerPort,
} from './port';
export {
  DurableObjectSeasonPublicationSequencer,
  SeasonPublicationSequencer,
  sequencerCommands,
  sequencerRequestUrl,
  type SequencerCommand,
  type SequencerNamespace,
} from './durable-object';
export {
  candidateVersionOwnedBy,
  decodeCancelOutcome,
  decodeCleanupAcknowledgement,
  decodeCleanupAuthorization,
  decodeCutoverActivationOutcome,
  decodeCutoverSeedOutcome,
  decodeCutoverSeedRecovery,
  decodeFinalizeOutcome,
  decodePrepareOutcome,
  decodeSeasonAuthority,
  prepareAssignmentsMatchRequest,
} from './wire-decoders';
