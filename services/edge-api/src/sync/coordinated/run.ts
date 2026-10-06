/**
 * The coordinated synchronization entry point, shared by the scheduled
 * handler and `POST /internal/admin/sync/full` when `PROVIDER_MODE` is
 * `coordinated`.
 *
 * **Wired, and unbound.** Both triggers reach the one §6.6 orchestration in
 * `observation/` - lease, reconciliation, recovery, the G5 planner, one
 * coordination, the G9 observation commit and, for a publication plan, the
 * publication half in `outcome/` with its no-change gate, ordering input,
 * curated metadata, hold and durable-block stops, guarded publication and
 * outcome commit - through this function and nothing else. There is no second
 * publication path and no legacy fallback.
 *
 * Every dependency is checked first, and nothing that could make a request is
 * constructed unless all of them are present. `resolveReconciliationLedger`
 * still answers `null`, so in every environment this gate refuses the run as
 * `ledger-unbound`: no lease, no limiter reservation, no request and no
 * publication write. The orchestration below it is reachable only by a caller
 * that supplies a ledger, which today means tests.
 *
 * The two triggers differ only in what the orchestration does with them
 * (runtime activation decision O-8): a scheduled run serves what is due and
 * advances the due times it serves; a manual run is a forced publication run
 * whose observations are out of cadence - they corroborate nothing - and it
 * moves no due time.
 */

import type { Logger } from '../../logging/logger';
import type { SeasonPublicationSequencerPort } from '../../publication/sequencer/port';
import type { SnapshotStorage } from '../../storage/types';
import {
  missingCoordinatedDependencies,
  type CoordinatedRuntimeDependencies,
  type CoordinatedUnavailableReason,
} from './composition';
import {
  observeCoordinatedSeason,
  type CoordinatedObservationResult,
} from './observation';
import { signalAttention } from './operator/attention';

export type CoordinatedSyncTrigger = 'scheduled' | 'manual';

/**
 * What a trigger asks of a run (runtime activation decision O-8).
 *
 * - `scheduled`: only what is due, and it advances the due times it serves.
 * - `manual`: a **forced publication run** through the same ledger, limiter
 *   and guard. It never advances scheduled due times, so an operator cannot
 *   move the cadence, or build corroboration, by calling it repeatedly.
 */
export interface CoordinatedRunKind {
  readonly trigger: CoordinatedSyncTrigger;
  readonly forcedPublication: boolean;
  readonly advancesSchedule: boolean;
}

const runKinds: Readonly<Record<CoordinatedSyncTrigger, CoordinatedRunKind>> =
  Object.freeze({
    scheduled: Object.freeze({
      trigger: 'scheduled',
      forcedPublication: false,
      advancesSchedule: true,
    }),
    manual: Object.freeze({
      trigger: 'manual',
      forcedPublication: true,
      advancesSchedule: false,
    }),
  });

export function coordinatedRunKind(
  trigger: CoordinatedSyncTrigger,
): CoordinatedRunKind {
  return runKinds[trigger];
}

export interface CoordinatedSyncRequest {
  readonly season: number;
  readonly trigger: CoordinatedSyncTrigger;
  /**
   * Caller cancellation, handed to the coordinator. No Worker entry point
   * supplies one outside tests: no accepted decision defines a run budget.
   */
  readonly signal?: AbortSignal;
}

/** What the orchestration needs beyond the runtime's gated dependencies. */
export interface CoordinatedSyncDependencies extends CoordinatedRuntimeDependencies {
  /**
   * The sequencer the authority and its active release are read from, or
   * `null` when the publication authority is not a reachable sequencer.
   */
  readonly sequencer: SeasonPublicationSequencerPort | null;
  /** Where the active release's documents are read from. */
  readonly storage: SnapshotStorage;
}

type OrchestratedResult = Exclude<
  CoordinatedObservationResult,
  { readonly status: 'coordinated-runtime-unavailable' }
>;

export type CoordinatedSyncOutcome =
  | {
      readonly status: 'coordinated-runtime-unavailable';
      readonly season: number;
      readonly run: CoordinatedRunKind;
      readonly reasons: readonly CoordinatedUnavailableReason[];
      readonly providerRequests: 0;
    }
  | (OrchestratedResult & {
      readonly season: number;
      readonly run: CoordinatedRunKind;
    });

export const COORDINATED_SYNC_OPERATION = 'sync.coordinated';

export async function runCoordinatedSync(
  request: CoordinatedSyncRequest,
  dependencies: CoordinatedSyncDependencies,
): Promise<CoordinatedSyncOutcome> {
  const run = coordinatedRunKind(request.trigger);
  const { sequencer } = dependencies;
  const missing = unavailableReasons(dependencies);
  if (missing.length > 0 || sequencer === null) {
    // The gate in front of the orchestration: with no ledger - every
    // environment today - or any other dependency missing, nothing is
    // constructed, leased, reserved, sent or written.
    logWithheld(dependencies.logger, request, missing);
    // A degraded runtime must not silence a stopped season: with a ledger
    // bound, a scheduled run still reads it for the attention line.
    if (request.trigger === 'scheduled' && dependencies.ledger !== null) {
      await signalAttention(
        dependencies.ledger,
        request.season,
        dependencies.logger,
      );
    }
    return {
      status: 'coordinated-runtime-unavailable',
      season: request.season,
      run,
      reasons: missing,
      providerRequests: 0,
    };
  }

  const outcome = await observeCoordinatedSeason(
    {
      season: request.season,
      trigger: request.trigger,
      ...(request.signal ? { signal: request.signal } : {}),
    },
    { ...dependencies, sequencer },
  );
  // The orchestration wrote the run's one line, and the attention line for a
  // scheduled run. Its own composition cannot refuse past the gate above. It
  // echoes the request's season and trigger, answered here as the run kind.
  const { season, trigger, ...result } = outcome;
  return { ...result, season, run: coordinatedRunKind(trigger) };
}

/**
 * Every missing dependency, in the composition's order. A sequencer that is
 * absent under an authority reporting itself as one is still refused.
 */
function unavailableReasons(
  dependencies: CoordinatedSyncDependencies,
): CoordinatedUnavailableReason[] {
  const missing = missingCoordinatedDependencies(dependencies);
  if (dependencies.sequencer === null && missing.length === 0) {
    return ['authority-not-sequencer'];
  }
  return missing;
}

function logWithheld(
  logger: Logger,
  request: CoordinatedSyncRequest,
  reasons: readonly CoordinatedUnavailableReason[],
): void {
  logger.warn({
    operation: `${COORDINATED_SYNC_OPERATION}.withheld`,
    season: request.season,
    syncTrigger: request.trigger,
    coordinationStatus: 'coordinated-runtime-unavailable',
    failureCategory: 'coordinated-runtime-unavailable',
    ...(reasons.length === 0
      ? {}
      : { coordinationMissingDependencies: [...reasons] }),
    providerOperationCallCount: 0,
  });
}
