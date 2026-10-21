/**
 * The automatic path's health, judged from public data alone (ADR 0028 D9).
 *
 * Two questions, both answerable from what any client can read:
 *
 * 1. **Is the automation running?** `GET /v1/status` serves the coordinated
 *    runtime's heartbeat as `lastSuccessfulSyncAt`. A healthy scheduled run
 *    advances it every hour; it stops when the cron no longer fires, when
 *    runs fail, or when the season needs an operator (held, blocked, a
 *    staged correction, a guard rejection).
 * 2. **Are results late?** The earliest event that is neither cancelled nor
 *    classified (`hasResults`) has a race start in its `grand-prix` document.
 *    Once that start is more than `resultsLateAfterHours` in the past, its
 *    result should have been published.
 *
 * Pure: the CLI (`automation-monitor.mjs`) fetches, this module decides.
 * Every finding is a closed code with bounded values; nothing here reads or
 * prints a credential, a header or a payload beyond the fields named.
 */

export const DEFAULT_THRESHOLDS = Object.freeze({
  /** Three missed hourly runs. */
  heartbeatMaxAgeHours: 3,
  /**
   * The race is asked for hourly from race start + 1 h 30 min to + 10 h
   * 30 min (ADR 0028 D5); this leaves the window's last check, made at
   * + 11 h 17 min for a race at minute 00, room to land. Nothing asks again
   * until + 15 h, so a result Jolpica serves after the window alerts here
   * first and is published at the + 15 h 17 min check: an alert that clears
   * itself, by design, rather than a later one that misses a stalled path.
   */
  resultsLateAfterHours: 12,
});

const HOUR_MS = 60 * 60 * 1000;

/**
 * @typedef {{ code: string, [key: string]: string | number | null }} Finding
 * @typedef {{ heartbeatMaxAgeHours: number, resultsLateAfterHours: number }} Thresholds
 */

/**
 * @param {{
 *   now: Date,
 *   status: { lastSuccessfulSyncAt?: unknown } | null,
 *   calendar: readonly unknown[] | null,
 *   pendingEvent: { round: number, sessions?: unknown } | null,
 *   requireHeartbeat: boolean,
 *   thresholds?: Thresholds,
 * }} input
 * @returns {{ ok: boolean, findings: Finding[] }}
 */
export function evaluateAutomationHealth(input) {
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;
  /** @type {Finding[]} */
  const findings = [];
  const now = input.now.getTime();

  if (input.status === null) {
    findings.push({ code: 'status-unavailable' });
  } else if (input.requireHeartbeat) {
    const beat = instant(input.status.lastSuccessfulSyncAt);
    if (beat === null) {
      findings.push({ code: 'heartbeat-missing' });
    } else {
      const ageHours = (now - beat) / HOUR_MS;
      if (ageHours > thresholds.heartbeatMaxAgeHours) {
        findings.push({
          code: 'heartbeat-stale',
          lastSuccessfulSyncAt: new Date(beat).toISOString(),
          ageHours: round1(ageHours),
        });
      }
    }
  }

  if (input.calendar === null) {
    findings.push({ code: 'calendar-unavailable' });
  } else {
    const pending = pendingRound(input.calendar);
    if (pending !== null) {
      if (input.pendingEvent === null || input.pendingEvent.round !== pending) {
        findings.push({ code: 'event-unavailable', round: pending });
      } else {
        const start = raceStart(input.pendingEvent.sessions);
        const lateBy =
          start === null
            ? null
            : (now - start) / HOUR_MS - thresholds.resultsLateAfterHours;
        if (start !== null && lateBy !== null && lateBy > 0) {
          findings.push({
            code: 'results-late',
            round: pending,
            raceStart: new Date(start).toISOString(),
            hoursSinceRaceStart: round1((now - start) / HOUR_MS),
          });
        }
      }
    }
  }

  return { ok: findings.length === 0, findings };
}

/**
 * The round of the earliest event the release does not settle: neither
 * cancelled nor classified. `null` when every event is settled.
 *
 * @param {readonly unknown[]} calendar
 * @returns {number | null}
 */
export function pendingRound(calendar) {
  let earliest = null;
  for (const event of calendar) {
    if (typeof event !== 'object' || event === null) continue;
    const { round, status, hasResults } =
      /** @type {Record<string, unknown>} */ (event);
    if (typeof round !== 'number' || !Number.isInteger(round)) continue;
    if (status === 'cancelled' || hasResults === true) continue;
    if (earliest === null || round < earliest) earliest = round;
  }
  return earliest;
}

/**
 * The race session's start, in epoch milliseconds, or `null`.
 *
 * @param {unknown} sessions
 * @returns {number | null}
 */
export function raceStart(sessions) {
  if (!Array.isArray(sessions)) return null;
  for (const session of sessions) {
    if (typeof session !== 'object' || session === null) continue;
    const { type, status, startTime } = /** @type {Record<string, unknown>} */ (
      session
    );
    if (type !== 'race' || status === 'cancelled') continue;
    const start = instant(startTime);
    if (start !== null) return start;
  }
  return null;
}

/** @param {unknown} value */
function instant(value) {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** @param {number} value */
function round1(value) {
  return Math.round(value * 10) / 10;
}
