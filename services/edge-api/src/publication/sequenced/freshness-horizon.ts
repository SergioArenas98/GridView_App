/**
 * How a sequenced release's `staleAfter` is chosen (ADR 0005, amendment of
 * 2026-10-19).
 *
 * `staleAfter` tells a client when to treat a payload as stale. Under an
 * automatic provider the Worker republishes on its own schedule, so the
 * generator's fixed interval (15 minutes, an hour for the content manifest)
 * says "expect a newer publication by then". With no automatic provider
 * (`PROVIDER_MODE=none`, staging's manually published season batches) nothing
 * republishes on a schedule, and the same interval only says that 15 minutes
 * have passed: unchanged data would be called stale for the whole life of a
 * batch.
 *
 * The `calendar-horizon` policy instead derives `staleAfter` from what the
 * release itself covers. A release stops describing the season at the
 * earliest start of a sprint or race session of an event it does not classify:
 * from then on a result, a standings change and Home's featured event can all
 * be missing from it. That instant is a property of the release's own
 * documents, so an ordinary publication and a rollback republication of the
 * same content derive the same absolute horizon, whenever they run.
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
 * The earliest start, in epoch milliseconds, of a sprint or race session of
 * an event the release does not settle, or `null` when no horizon can be
 * derived.
 *
 * An event is settled exactly as the season chronology settles it: status
 * `completed`, or a classified race result (`hasResults`). A `cancelled`
 * event never starts, so it bounds nothing. Every other event must carry a
 * timed race session that is not cancelled; its sprint, when timed and not
 * cancelled, can only bring the horizon earlier.
 *
 * `null` - the caller then keeps the fixed interval - when:
 *
 * - the release has no `grand-prix:<round>` document;
 * - every event is settled or cancelled (nothing is left to happen);
 * - an unsettled event has no usable race start, or any event document is
 *   not shaped as one. A horizon that skipped such an event could claim
 *   freshness past a race the release does not cover.
 *
 * Reads only the documents. A horizon at or before the publication instant is
 * returned as is; whether it can apply is the caller's decision.
 */
export function calendarHorizon(
  documents: readonly StoredSnapshot[],
): number | null {
  let earliest: number | null = null;
  for (const document of documents) {
    if (!grandPrixDocument.test(document.documentName)) continue;
    const event: unknown = document.data;
    if (!isRecord(event)) return null;
    if (event.status === 'cancelled') continue;
    if (event.status === 'completed' || event.hasResults === true) continue;
    const start = earliestResultSessionStart(event.sessions);
    if (start === null) return null;
    earliest = earliest === null ? start : Math.min(earliest, start);
  }
  return earliest;
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
 * The policy of every sequenced release a Worker stamps. Only an automatic
 * provider republishes on a schedule, so only then does the generator's fixed
 * interval say when to expect newer data. With `none` every release is
 * published by hand - a season batch or a rollback - and its own calendar says
 * when it stops covering the season.
 */
export function freshnessPolicyFor(mode: ProviderMode): FreshnessPolicy {
  return mode === 'none' ? 'calendar-horizon' : 'interval';
}
