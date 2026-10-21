/**
 * How a sequenced release's `staleAfter` is chosen (ADR 0005, amendment of
 * 2026-10-19; extended to the coordinated runtime by ADR 0028).
 *
 * `staleAfter` tells a client when to treat a payload as stale. Only the
 * mock provider republishes on every run, so only there does the generator's
 * fixed interval (15 minutes, an hour for the content manifest) say "expect a
 * newer publication by then". With no automatic provider
 * (`PROVIDER_MODE=none`, staging's manually published season batches)
 * nothing republishes on a schedule, and the coordinated runtime republishes
 * only content that changed (its no-change gate, O-12). In both, the same
 * interval only says that 15 minutes have passed: unchanged data would be
 * called stale for the whole life of a release.
 *
 * The `calendar-horizon` policy instead derives `staleAfter` from what the
 * release itself covers. A release stops describing the season at the
 * earliest start of a sprint or race session of an event it does not classify:
 * from then on a result, a standings change and Home's featured event can all
 * be missing from it. That instant is a property of the release's own
 * documents, so an ordinary publication and a rollback republication of the
 * same content derive the same absolute horizon, whenever they run.
 *
 * When every event is settled or cancelled, no scheduled event is left to
 * outdate the release, and its data documents take
 * `SEASON_COMPLETE_STALE_AFTER` instead of a 15-minute expiry.
 *
 * Constraint: the `interval` policy measures each stored
 * `staleAfter - generatedAt` pair when it re-stamps. A release stamped under
 * this policy must not be rolled back by a Worker on the `interval` policy:
 * a horizon-length interval would be carried forward, and a season-complete
 * one would leave the year range and refuse the rollback. `none` and
 * `coordinated` share this policy, so switching between them re-stamps
 * consistently; only a switch to `mock` would cross the constraint.
 *
 * The content manifest is the client's check for a newer publication and keeps
 * its one-hour interval under either policy.
 */

import type { ProviderMode } from '../../config/environment';
import type { StoredSnapshot } from '../../storage/types';
import { isRecord } from './embedded-freshness';

export type FreshnessPolicy = 'interval' | 'calendar-horizon';

const grandPrixDocument = /^grand-prix:\d+$/;

/** The sessions whose outcome changes results, standings or Home. */
const horizonSessionTypes: ReadonlySet<unknown> = new Set(['sprint', 'race']);

/**
 * What a release's own calendar says about when it stops covering the season.
 *
 * - `session`: the earliest start, in epoch milliseconds, of a sprint or race
 *   session of an event the release does not settle.
 * - `season-complete`: every event is settled or cancelled. No scheduled
 *   event is left that could make the release incomplete; only a later
 *   correction can change it.
 * - `undetermined`: no horizon can be derived, and the caller keeps the fixed
 *   interval.
 */
export type CalendarHorizon =
  | { readonly kind: 'session'; readonly at: number }
  | { readonly kind: 'season-complete' }
  | { readonly kind: 'undetermined' };

const undetermined: CalendarHorizon = { kind: 'undetermined' };
const seasonComplete: CalendarHorizon = { kind: 'season-complete' };

/**
 * The `staleAfter` of a season-complete release's data documents: the last
 * instant the contract's four-digit RFC 3339 `date-time` can spell. The
 * contract requires a `staleAfter` on every snapshot and has no "never"
 * value, so this is the representable form of "no scheduled event can
 * outdate this data". The content manifest still expires after an hour, so a
 * later correction is found by the manifest check (ADR 0005, amendment of
 * 2026-10-19).
 */
export const SEASON_COMPLETE_STALE_AFTER = '9999-12-31T23:59:59.999Z';

/**
 * The calendar horizon of a release.
 *
 * An event is settled exactly as the season chronology settles it: status
 * `completed`, or a classified race result (`hasResults`). A `cancelled`
 * event never starts, so it bounds nothing. Every other event must carry a
 * timed race session that is not cancelled; its sprint, when timed and not
 * cancelled, can only bring the horizon earlier.
 *
 * `undetermined` when the release has no `grand-prix:<round>` document, or an
 * unsettled event has no usable race start, or any event document is not
 * shaped as one: a horizon that skipped such an event could claim freshness
 * past a race the release does not cover.
 *
 * Reads only the documents. A session horizon at or before the publication
 * instant is returned as is; whether it can apply is the caller's decision.
 */
export function calendarHorizon(
  documents: readonly StoredSnapshot[],
): CalendarHorizon {
  let events = 0;
  let earliest: number | null = null;
  for (const document of documents) {
    if (!grandPrixDocument.test(document.documentName)) continue;
    events += 1;
    const event: unknown = document.data;
    if (!isRecord(event)) return undetermined;
    if (event.status === 'cancelled') continue;
    if (event.status === 'completed' || event.hasResults === true) continue;
    const start = earliestResultSessionStart(event.sessions);
    if (start === null) return undetermined;
    earliest = earliest === null ? start : Math.min(earliest, start);
  }
  if (earliest !== null) return { kind: 'session', at: earliest };
  return events > 0 ? seasonComplete : undetermined;
}

/**
 * The earliest timed, non-cancelled sprint or race start of one event, or
 * `null` when the event has no timed race session to bound it.
 */
function earliestResultSessionStart(sessions: unknown): number | null {
  if (!Array.isArray(sessions)) return null;
  let race: number | null = null;
  let earliest: number | null = null;
  for (const session of sessions) {
    if (!isRecord(session)) return null;
    if (!horizonSessionTypes.has(session.type)) continue;
    if (session.status === 'cancelled') continue;
    if (typeof session.startTime !== 'string') continue;
    const start = Date.parse(session.startTime);
    if (Number.isNaN(start)) continue;
    if (session.type === 'race')
      race = race === null ? start : Math.min(race, start);
    earliest = earliest === null ? start : Math.min(earliest, start);
  }
  return race === null ? null : earliest;
}

/**
 * The policy of every sequenced release a Worker stamps. Only the mock
 * provider republishes on every run, so only there does the generator's
 * fixed interval say when to expect newer data. With `none` every release is
 * published by hand - a season batch or a rollback - and the coordinated
 * runtime publishes only a changed candidate, so in both the release's own
 * calendar says when it stops covering the season.
 */
export function freshnessPolicyFor(mode: ProviderMode): FreshnessPolicy {
  return mode === 'mock' ? 'interval' : 'calendar-horizon';
}
