/**
 * The admission-closure boundary for one season being cut over
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D12 step 1).
 *
 * D12 step 1 requires that **no publication or rollback mutator may be
 * *admitted*** against the legacy pointers for the season being cut over, from
 * before the checkpoint is approved until the separate activation confirmation
 * resumes that season's mutators. This decorator is that boundary: it sits
 * outside whatever publication command surface the composition built, so the
 * refusal happens **before `SnapshotPublisher` is reached at all** - not inside
 * it, and not after a candidate has been written.
 *
 * ## What this is, and what it is deliberately not
 *
 * It is an **admission-closure boundary, not a quiescence guarantee.** It stops
 * new publications and rollbacks from starting for this season. It says nothing
 * about an invocation admitted before the control was deployed and still
 * executing, and nothing here waits, sleeps or otherwise presents elapsed time
 * as proof that such an invocation has drained - D12 forbids exactly that. An
 * operator accounts for known in-flight legacy operations by ordinary
 * operational care before approving a checkpoint; this code makes no claim
 * about them.
 *
 * ## Scope
 *
 * Exactly one season is closed. Every other season's publication, rollback and
 * purge run through the wrapped commands unchanged, because a cutover of 2026
 * is not a reason to stop publishing 2025.
 *
 * `purgeActiveVersion` stays open for the paused season too. A cache purge
 * moves no pointer, creates no version and admits no mutator; it is the
 * operator's own read-repair tool and D12 gives no reason to withdraw it during
 * a cutover.
 *
 * ## The refusal is operational, not benign
 *
 * A refused publication reports the bounded
 * `season-paused-for-cutover` reason, whose synchronization consequence is
 * `failed`. A cutover pause is a deliberate operational state, not the pacing
 * system declining a stale candidate: recording it as a completed no-op would
 * advance `lastCompletedAt` and mark every due job successful, and a season
 * that cannot publish for the length of a cutover would look healthy.
 */

import type { GeneratedSnapshotSet } from '../../snapshots/generator';
import type { PublicationCommands } from '../commands';
import type { ManualCachePurgeResult, PublicationResult } from '../publisher';

/**
 * Wraps a publication command surface and refuses admission for one season.
 *
 * Constructed only when the cutover control names a season; the composition
 * returns the inner commands untouched otherwise, so the default build is
 * byte-for-byte what it is today.
 */
export class CutoverPausedPublicationCommands implements PublicationCommands {
  constructor(
    private readonly inner: PublicationCommands,
    private readonly pausedSeason: number,
  ) {}

  async publish(set: GeneratedSnapshotSet): Promise<PublicationResult> {
    if (set.season !== this.pausedSeason) return this.inner.publish(set);
    return paused(set.season, set.version);
  }

  async rollback(
    season: number,
    targetVersion?: string,
  ): Promise<PublicationResult> {
    if (season !== this.pausedSeason) {
      return this.inner.rollback(season, targetVersion);
    }
    return paused(season, targetVersion ?? '');
  }

  /**
   * Always delegated. A purge is not a mutator admission, and an operator
   * mid-cutover is exactly who needs it.
   */
  async purgeActiveVersion(season: number): Promise<ManualCachePurgeResult> {
    return this.inner.purgeActiveVersion(season);
  }
}

function paused(season: number, version: string): PublicationResult {
  return {
    status: 'rejected',
    season,
    version,
    previousVersion: null,
    reason: 'season-paused-for-cutover',
    cachePurgeOk: true,
    cachePurge: 'not-required',
    pointerMaintenance: 'not-required',
    purgedUrls: [],
  };
}
