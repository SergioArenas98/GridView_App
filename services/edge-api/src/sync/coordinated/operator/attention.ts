/**
 * The level-triggered attention signal (PR-E2; OD-1, OD-8).
 *
 * After every scheduled coordinated run, the season's ledger state is read
 * once more, and while any condition below holds, one bounded
 * `reconciliation.attention` line is written. It repeats on every tick while
 * the condition lasts, so a stopped season never goes quiet after the run
 * that stopped it:
 *
 * - `operator-hold`: an operator holds the season's publication;
 * - `durable-block`: a run durably blocked it (OD-5), with the closed reason;
 * - `backlog-warning`: the global review backlog holds at least 48 of its 60
 *   slots (OD-8);
 * - `backlog-full`: it holds all 60, so no further correction can be staged.
 *
 * The line is `warn`, or `error` at a full backlog. It carries the season,
 * the closed conditions and the backlog count: no revision, round, instant,
 * operation ID or payload.
 *
 * **Emitting is not delivering.** For staging, an operator reviews these
 * lines daily (OD-1, runbook). Production needs a verified delivery path,
 * which does not exist.
 */

import type { Logger } from '../../../logging/logger';
import {
  BACKLOG_CAPACITY,
  BACKLOG_WARNING_THRESHOLD,
  type DurableBlockReason,
  type LedgerSnapshot,
} from '../ledger/model';
import type { ReconciliationLedgerPort } from '../ledger-port';

export type BacklogAttention = 'normal' | 'warning' | 'full';

export function backlogAttention(count: number): BacklogAttention {
  if (count >= BACKLOG_CAPACITY) return 'full';
  if (count >= BACKLOG_WARNING_THRESHOLD) return 'warning';
  return 'normal';
}

export const RECONCILIATION_ATTENTION_OPERATION = 'reconciliation.attention';

export const attentionConditions = [
  'operator-hold',
  'durable-block',
  'backlog-warning',
  'backlog-full',
] as const;
export type AttentionCondition = (typeof attentionConditions)[number];

export interface SeasonAttention {
  readonly season: number;
  /** In `attentionConditions` order; never empty. */
  readonly conditions: readonly AttentionCondition[];
  readonly durableBlockReason: DurableBlockReason | null;
  readonly backlogCount: number;
  readonly backlogCapacity: number;
  readonly level: 'warn' | 'error';
}

/** What needs an operator in `snapshot`, or `null` when nothing does. */
export function seasonAttention(
  snapshot: LedgerSnapshot,
): SeasonAttention | null {
  const record = snapshot.seasonRecord?.record ?? null;
  const backlog = backlogAttention(snapshot.backlog.count);
  const conditions = attentionConditions.filter((condition) => {
    switch (condition) {
      case 'operator-hold':
        return record?.operatorHold != null;
      case 'durable-block':
        return record?.durableBlock != null;
      case 'backlog-warning':
        return backlog === 'warning';
      case 'backlog-full':
        return backlog === 'full';
    }
  });
  if (conditions.length === 0) return null;
  return {
    season: snapshot.season,
    conditions,
    durableBlockReason: record?.durableBlock?.reason ?? null,
    backlogCount: snapshot.backlog.count,
    backlogCapacity: snapshot.backlog.capacity,
    level: backlog === 'full' ? 'error' : 'warn',
  };
}

/**
 * Reads the season once and writes the attention line when a condition
 * holds. Takes no lease and writes nothing to the ledger. A read that fails
 * writes no attention line: the run's own line already reports the ledger
 * failure. It never throws into the run.
 */
export async function signalAttention(
  ledger: ReconciliationLedgerPort,
  season: number,
  logger: Logger,
): Promise<SeasonAttention | null> {
  let attention: SeasonAttention | null;
  try {
    const read = await ledger.readSeason(season);
    if (read.outcome !== 'read') return null;
    attention = seasonAttention(read.snapshot);
  } catch {
    return null;
  }
  if (attention === null) return null;
  const event = {
    operation: RECONCILIATION_ATTENTION_OPERATION,
    season: attention.season,
    syncTrigger: 'scheduled',
    reconciliationAttention: [...attention.conditions],
    ...(attention.durableBlockReason === null
      ? {}
      : { durableBlockReason: attention.durableBlockReason }),
    backlogCount: attention.backlogCount,
    backlogCapacity: attention.backlogCapacity,
  };
  if (attention.level === 'error') logger.error(event);
  else logger.warn(event);
  return attention;
}
