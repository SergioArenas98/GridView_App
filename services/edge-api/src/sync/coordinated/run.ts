/**
 * The coordinated synchronization entry point, shared by the scheduled
 * handler and `POST /internal/admin/sync/full` when `PROVIDER_MODE` is
 * `coordinated`.
 *
 * **A skeleton that fails closed.** A run composes the coordinated runtime
 * only when every dependency is bound. The reconciliation ledger never is in
 * this change, so every run, scheduled or manual, stops at
 * `coordinated-runtime-unavailable` before a transport, client or port exists.
 * No provider request is possible, and nothing is observed, published or
 * recorded. Public reads are unaffected: the refusal is a bounded outcome of
 * the sync entry point, never a Worker-wide configuration error.
 *
 * Planning, lease, observation, the publishability decision and the no-change
 * gate belong to the G5 planner and G9 ledger and do not exist yet. Even a
 * fully composed runtime, reachable today only by handing this function a
 * synthetic ledger, stops at `not-planned` and sends nothing.
 */

import type { Logger } from '../../logging/logger';
import {
  composeCoordinatedRuntime,
  type CoordinatedRuntimeDependencies,
  type CoordinatedUnavailableReason,
} from './composition';

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
}

export type CoordinatedSyncOutcome =
  | {
      readonly status: 'coordinated-runtime-unavailable';
      readonly season: number;
      readonly run: CoordinatedRunKind;
      readonly reasons: readonly CoordinatedUnavailableReason[];
      readonly providerRequests: 0;
    }
  | {
      /** Composed, with no planner to decide a request. Sends nothing. */
      readonly status: 'not-planned';
      readonly season: number;
      readonly run: CoordinatedRunKind;
      readonly providerRequests: 0;
    };

export const COORDINATED_SYNC_OPERATION = 'sync.coordinated';

export async function runCoordinatedSync(
  request: CoordinatedSyncRequest,
  dependencies: CoordinatedRuntimeDependencies,
): Promise<CoordinatedSyncOutcome> {
  const run = coordinatedRunKind(request.trigger);
  const composition = composeCoordinatedRuntime(dependencies);
  if (composition.kind === 'unavailable') {
    logOutcome(
      dependencies.logger,
      request,
      'coordinated-runtime-unavailable',
      [...composition.reasons],
    );
    return {
      status: 'coordinated-runtime-unavailable',
      season: request.season,
      run,
      reasons: composition.reasons,
      providerRequests: 0,
    };
  }
  logOutcome(dependencies.logger, request, 'not-planned', []);
  return {
    status: 'not-planned',
    season: request.season,
    run,
    providerRequests: 0,
  };
}

function logOutcome(
  logger: Logger,
  request: CoordinatedSyncRequest,
  status: CoordinatedSyncOutcome['status'],
  reasons: CoordinatedUnavailableReason[],
): void {
  logger.warn({
    operation: `${COORDINATED_SYNC_OPERATION}.withheld`,
    season: request.season,
    syncTrigger: request.trigger,
    coordinationStatus: status,
    failureCategory: status,
    ...(reasons.length === 0
      ? {}
      : { coordinationMissingDependencies: reasons }),
    providerOperationCallCount: 0,
  });
}
