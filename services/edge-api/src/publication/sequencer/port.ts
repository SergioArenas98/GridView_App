/**
 * The internal port future callers will hold, and the in-process adapter that
 * satisfies it directly over a coordinator.
 *
 * The port exists so the publisher, the rollback command, the migration runner
 * and the public router can each be written and tested against one seam,
 * without any of them depending on whether the coordinator is reached in-process
 * or through a Durable Object stub.
 *
 * **Nothing implements a production caller for this port in this slice.** There
 * is no binding, no registration in the Worker entry point and no code path
 * that reaches a live sequencer.
 */

import type {
  CancelOutcome,
  CleanupAcknowledgement,
  CleanupAuthorization,
  CleanupRequest,
  CutoverActivationOutcome,
  CutoverActivationRequest,
  CutoverSeed,
  CutoverSeedOutcome,
  FinalizeOutcome,
  FinalizeRequest,
  OperationIdentity,
  PrepareOutcome,
  PrepareRequest,
  SeasonAuthority,
} from './model';
import type { SeasonPublicationCoordinator } from './coordinator';

/**
 * The season publication authority, as a caller sees it.
 *
 * Every method is asynchronous because a real caller reaches the object across
 * a stub boundary. Every outcome is a bounded discriminated union: a caller
 * switches exhaustively over it rather than catching an exception, so a
 * rejection can never reach a log or a response as free-form text.
 */
export interface SeasonPublicationSequencerPort {
  readAuthority(season: number): Promise<SeasonAuthority>;
  prepare(request: PrepareRequest): Promise<PrepareOutcome>;
  finalize(request: FinalizeRequest): Promise<FinalizeOutcome>;
  cancel(request: OperationIdentity): Promise<CancelOutcome>;
  /**
   * Authorizes deletion of one named retired operation's orphaned version -
   * whether it is still the current `cancelled` record or has been moved to the
   * single pending-cleanup slot by a later `prepare`. The caller performs the
   * external, best-effort Workers KV deletion itself; the sequencer never
   * touches Workers KV.
   */
  authorizeCleanup(request: CleanupRequest): Promise<CleanupAuthorization>;
  /**
   * Idempotently retires a cleaned-up identity from whichever bounded slot
   * holds it, once the external deletion has succeeded or the version's absence
   * is confirmed.
   */
  acknowledgeCleanup(request: CleanupRequest): Promise<CleanupAcknowledgement>;
  seedCutover(seed: CutoverSeed): Promise<CutoverSeedOutcome>;
  activateCutover(
    request: CutoverActivationRequest,
  ): Promise<CutoverActivationOutcome>;
}

/**
 * Drives one coordinator directly, without a stub boundary.
 *
 * This is what makes the port testable end to end in the repository's
 * plain-Node runner, and what a future in-process caller would use if the
 * sequencer ever ran beside its caller. It adds no authority of its own: every
 * decision is still taken inside the coordinator's own transaction.
 */
export class LocalSeasonPublicationSequencer implements SeasonPublicationSequencerPort {
  constructor(private readonly coordinator: SeasonPublicationCoordinator) {}

  async readAuthority(season: number): Promise<SeasonAuthority> {
    return this.coordinator.readAuthority(season);
  }

  async prepare(request: PrepareRequest): Promise<PrepareOutcome> {
    return this.coordinator.prepare(request);
  }

  async finalize(request: FinalizeRequest): Promise<FinalizeOutcome> {
    return this.coordinator.finalize(request);
  }

  async cancel(request: OperationIdentity): Promise<CancelOutcome> {
    return this.coordinator.cancel(request);
  }

  async authorizeCleanup(
    request: CleanupRequest,
  ): Promise<CleanupAuthorization> {
    return this.coordinator.authorizeCleanup(request);
  }

  async acknowledgeCleanup(
    request: CleanupRequest,
  ): Promise<CleanupAcknowledgement> {
    return this.coordinator.acknowledgeCleanup(request);
  }

  async seedCutover(seed: CutoverSeed): Promise<CutoverSeedOutcome> {
    return this.coordinator.seedCutover(seed);
  }

  async activateCutover(
    request: CutoverActivationRequest,
  ): Promise<CutoverActivationOutcome> {
    return this.coordinator.activateCutover(request);
  }
}
