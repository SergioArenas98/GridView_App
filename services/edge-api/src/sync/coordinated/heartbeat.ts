/**
 * The coordinated runtime's heartbeat (ADR 0028 D7): the one public trace
 * that the automatic path is running.
 *
 * After a **scheduled** run whose line is quiet - nothing was due, or it
 * observed and settled without a refusal, a block or a failure - and whose
 * season the closing ledger read finds neither held, durably blocked nor
 * publication-blocked, the season's `SyncState` records the run's instant as
 * `lastCompletedAt`. `GET /v1/status` already serves that value as
 * `lastSuccessfulSyncAt`, so an outside monitor that reads only public data
 * can tell a running automation from a stopped one: the value stops moving
 * when the cron no longer fires, when runs fail, or when the season needs an
 * operator.
 *
 * A manual run never beats: its operator is already looking, and an operator
 * call must not mask a stopped schedule.
 *
 * The write is one KV put of a record that carries instants and closed
 * values only. It never throws into the run: a failed write is one bounded
 * `warn` line, and the next healthy run writes again.
 */

import type { Logger } from '../../logging/logger';
import type { SnapshotStorage, SyncState } from '../../storage/types';

export const COORDINATED_HEARTBEAT_OPERATION = 'sync.coordinated.heartbeat';

export interface HeartbeatInput {
  readonly storage: SnapshotStorage;
  readonly season: number;
  readonly at: Date;
  /** The release this run published, or `null` when it published none. */
  readonly publishedVersion: string | null;
  readonly logger: Logger;
}

/** Records `at` as the season's last successful synchronization. */
export async function recordHeartbeat(input: HeartbeatInput): Promise<void> {
  const at = input.at.toISOString();
  try {
    const previous = await input.storage.getSyncState(input.season);
    const state: SyncState = {
      season: input.season,
      lastStartedAt: at,
      lastCompletedAt: at,
      lastFailedAt: previous?.lastFailedAt ?? null,
      lastFailureCategory: previous?.lastFailureCategory ?? null,
      lastSuccessByJob: previous?.lastSuccessByJob ?? {},
      lastFailureByJob: previous?.lastFailureByJob ?? {},
      lastSkippedJobs: [],
      lastPublicationVersion:
        input.publishedVersion ?? previous?.lastPublicationVersion ?? null,
      lastPublicationStatus:
        input.publishedVersion === null
          ? (previous?.lastPublicationStatus ?? null)
          : 'applied',
    };
    await input.storage.setSyncState(input.season, state);
  } catch {
    input.logger.warn({
      operation: COORDINATED_HEARTBEAT_OPERATION,
      season: input.season,
      syncTrigger: 'scheduled',
      failureCategory: 'heartbeat-write-failed',
    });
  }
}
