/**
 * The season publication sequencer mechanism (ADR 0025), as one entry point.
 *
 * **Inert by construction.** Nothing here is reachable from the Worker entry
 * point, no `wrangler.toml` binding or migration declares the Durable Object
 * class, no production code path calls the port, and no public API, OpenAPI
 * contract, routing or cache behaviour changes because these modules exist.
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
  preparedKeyPrefix,
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
