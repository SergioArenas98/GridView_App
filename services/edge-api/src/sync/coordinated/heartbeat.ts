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
 * **A failed observation is remembered until one succeeds.** A scheduled run
 * that sent provider requests and observed nothing - Jolpica down, blocking
 * GridView or answering unusably - records its instant as `lastFailedAt`.
 * While that mark is newer than the last beat, a run that sent no request
 * (nothing was due) does not beat: a failed refresh is rescheduled hours
 * ahead, and the idle ticks between must not make an outage look healthy.
 * The next run with a successful observation beats and so clears the mark.
 * `lastFailedAt` is not served publicly; only `lastCompletedAt` is.
 *
 * The write is one KV put of a record that carries instants and closed
 * values only. It never throws into the run: a failed write is one bounded
 * `warn` line, and the next healthy run writes again.
 */

import type { Logger } from '../../logging/logger';
import type { SnapshotStorage, SyncState } from '../../storage/types';

export const COORDINATED_HEARTBEAT_OPERATION = 'sync.coordinated.heartbeat';

/** The closed `lastFailureCategory` of a scheduled run that observed nothing. */
export const OBSERVATION_FAILED_CATEGORY = 'coordinated-observation-failed';

/**
 * What a healthy run's beat rests on: a successful provider observation, or
 * nothing due (no request sent).
 */
export type HeartbeatEvidence = 'observed' | 'idle';

export interface HeartbeatInput {
  readonly storage: SnapshotStorage;
  readonly season: number;
  readonly at: Date;
  /** The release this run published, or `null` when it published none. */
  readonly publishedVersion: string | null;
  readonly evidence: HeartbeatEvidence;
  readonly logger: Logger;
}

export interface FailedObservationInput {
  readonly storage: SnapshotStorage;
  readonly season: number;
  readonly at: Date;
  readonly logger: Logger;
}

/** Whether a failed observation is newer than the last beat. */
function failureOutstanding(previous: SyncState | null): boolean {
  if (previous?.lastFailedAt == null) return false;
  return (
    previous.lastCompletedAt === null ||
    Date.parse(previous.lastFailedAt) > Date.parse(previous.lastCompletedAt)
  );
}

function writeFailed(logger: Logger, season: number): void {
  logger.warn({
    operation: COORDINATED_HEARTBEAT_OPERATION,
    season,
    syncTrigger: 'scheduled',
    failureCategory: 'heartbeat-write-failed',
  });
}

/**
 * Records `at` as the season's last successful synchronization, unless the
 * run was idle while a failed observation is outstanding.
 */
export async function recordHeartbeat(input: HeartbeatInput): Promise<void> {
  const at = input.at.toISOString();
  try {
    const previous = await input.storage.getSyncState(input.season);
    if (input.evidence === 'idle' && failureOutstanding(previous)) return;
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
    writeFailed(input.logger, input.season);
  }
}

/**
 * Marks a scheduled run that sent provider requests and observed nothing, so
 * later idle runs do not beat until an observation succeeds again. The beat
 * itself (`lastCompletedAt`) is left where it was.
 */
export async function recordFailedObservation(
  input: FailedObservationInput,
): Promise<void> {
  const at = input.at.toISOString();
  try {
    const previous = await input.storage.getSyncState(input.season);
    const state: SyncState = {
      season: input.season,
      lastStartedAt: at,
      lastCompletedAt: previous?.lastCompletedAt ?? null,
      lastFailedAt: at,
      lastFailureCategory: OBSERVATION_FAILED_CATEGORY,
      lastSuccessByJob: previous?.lastSuccessByJob ?? {},
      lastFailureByJob: previous?.lastFailureByJob ?? {},
      lastSkippedJobs: [],
      lastPublicationVersion: previous?.lastPublicationVersion ?? null,
      lastPublicationStatus: previous?.lastPublicationStatus ?? null,
    };
    await input.storage.setSyncState(input.season, state);
  } catch {
    writeFailed(input.logger, input.season);
  }
}
