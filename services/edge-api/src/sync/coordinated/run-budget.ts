/**
 * The coordinated run budget (owner decisions RB-1 to RB-3, 2026-10-06; O-10
 * decision pack §8): one budget, the same for a scheduled and a manual run.
 *
 * It starts when the run's lease is acquired (`startedAt`, the Worker's
 * clock) and has two gates:
 *
 * - **The coordination deadline**, 240 s after the start. The run's own
 *   `AbortSignal` aborts there, so the coordinator schedules nothing more and
 *   the hardened HTTP boundary aborts the request in flight. A run whose
 *   coordination has not begun by then begins it already cancelled, and sends
 *   nothing.
 * - **The intent gate**, checked immediately before the reservation commit
 *   that commits the run to publication. It is open only while at most 300 s
 *   have elapsed **and** at least 300 s remain on the lease. A closed gate
 *   withholds the publication as `run-budget-exhausted` (RB-5).
 *
 * Nothing after the intent commit is cancelled. Once `prepare` can have
 * begun, the existing recovery protocol - the sidecar, the sequencer's
 * prepare TTL and the D5 cleanup - is the only safe one, so the budget never
 * reaches the guarded publication: its signal is handed to the coordinator
 * and nothing else, and its timer is disarmed as soon as coordination ends.
 *
 * The budget is not tied to a manual run's client connection (RB-8): it
 * bounds the run whatever the client does.
 */

/** From the start of the run to the abort of its coordination. */
export const COORDINATION_DEADLINE_MS = 240_000;

/** From the start of the run to the last instant intent may be committed. */
export const INTENT_DEADLINE_MS = 300_000;

/**
 * The lease that must remain when intent is committed. The intent deadline
 * plus this reserve fits inside `LEASE_TTL_MS`, so a run that commits intent
 * at its last permitted instant still holds the lease its guarded publication
 * and outcome commit need. A test pins that against the ledger's constant.
 */
export const PUBLICATION_LEASE_RESERVE_MS = 300_000;

/**
 * Arms `expire` to run once, `delayMillis` from now, and answers how to disarm
 * it. The default is a timer; a test drives its own from a fake clock.
 */
export type RunBudgetTimer = (
  delayMillis: number,
  expire: () => void,
) => () => void;

export const timerRunBudget: RunBudgetTimer = (delayMillis, expire) => {
  const handle = setTimeout(expire, delayMillis);
  return () => clearTimeout(handle);
};

export interface RunBudget {
  /** When the lease was acquired, on the Worker's clock. */
  readonly startedAt: Date;
  /** The run's coordination signal. Handed to the coordinator and nothing else. */
  readonly signal: AbortSignal;
  /**
   * Called just before coordination: a run already past its coordination
   * deadline begins it cancelled, whatever the timer has done.
   */
  enterCoordination(now: Date): void;
  /** Stops the timer and unlinks the caller's signal. Idempotent. */
  disarm(): void;
}

export interface RunBudgetOptions {
  readonly startedAt: Date;
  readonly timer?: RunBudgetTimer;
  /** A caller's cancellation, linked into the run's signal. */
  readonly linked?: AbortSignal;
}

export function startRunBudget(options: RunBudgetOptions): RunBudget {
  const { startedAt, linked } = options;
  const controller = new AbortController();
  const abort = () => controller.abort();
  const deadline = startedAt.getTime() + COORDINATION_DEADLINE_MS;
  if (linked?.aborted) abort();
  linked?.addEventListener('abort', abort, { once: true });
  const disarmTimer = (options.timer ?? timerRunBudget)(
    COORDINATION_DEADLINE_MS,
    abort,
  );
  let armed = true;
  return {
    startedAt,
    signal: controller.signal,
    enterCoordination(now) {
      if (now.getTime() >= deadline) abort();
    },
    disarm() {
      if (!armed) return;
      armed = false;
      disarmTimer();
      linked?.removeEventListener('abort', abort);
    },
  };
}

/**
 * The intent gate: whether a run that started at `startedAt` may still commit
 * to publication at `now`, under a lease that expires at `leaseExpiresAt`.
 */
export function intentGateOpen(
  startedAt: Date,
  now: Date,
  leaseExpiresAt: string,
): boolean {
  return (
    now.getTime() - startedAt.getTime() <= INTENT_DEADLINE_MS &&
    Date.parse(leaseExpiresAt) - now.getTime() >= PUBLICATION_LEASE_RESERVE_MS
  );
}
