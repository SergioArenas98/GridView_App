/**
 * Deep validation of a **normalized** contract value.
 *
 * This is the authoritative per-field validator an adapter's output must pass
 * before it can become a candidate. It is deliberately separate from
 * `validation/snapshot-validator.ts`, which checks snapshot metadata, top-level
 * document shape and provider neutrality at the publication boundary and keeps
 * exactly that scope: by the time a document is published it was assembled from
 * values checked here, so re-deriving the contract at the last write would put
 * the same rule in a second place it could drift from.
 *
 * Nothing in this module knows about coordination, providers, transport or
 * publication. It answers one question about one value.
 */

export {
  contractIssueCodes,
  maxCollectionLength,
  maxContractIssues,
  type ContractIssue,
  type ContractIssueCode,
} from './issues';

export { seasonMaximum, seasonMinimum } from './values';

export {
  circuitCheck,
  constructorCheck,
  constructorSeasonEntryCheck,
  constructorStandingCheck,
  driverCheck,
  driverSeasonEntryCheck,
  driverStandingCheck,
  grandPrixCheck,
  raceResultCheck,
  sessionCheck,
  validateCircuit,
  validateConstructor,
  validateConstructorSeasonEntry,
  validateConstructorStanding,
  validateDriver,
  validateDriverSeasonEntry,
  validateDriverStanding,
  validateFastestLap,
  validateGrandPrix,
  validateLapRecord,
  validateMediaAsset,
  validateRaceResult,
  validateRaceResultEntry,
  validateSession,
} from './entities';

export { mediaAsset as mediaAssetCheck } from './media';
export { arrayOf, type Check } from './values';
export { objectOf, type Field } from './object';
export { collect, IssueCollector } from './issues';
