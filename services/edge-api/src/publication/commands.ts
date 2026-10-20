/**
 * The publication command surface every caller depends on, independent of which
 * authority is behind it (ADR 0025 D6, D12).
 *
 * `SnapshotPublisher` (the legacy Workers KV pointer authority) and
 * `SequencedPublicationService` (the two-phase `SeasonPublicationSequencer`
 * protocol) both satisfy this shape structurally. The synchronization service
 * and the admin router type against this interface so the composition root can
 * hand them either one without either knowing which - and, crucially, so the
 * default build wires the exact `SnapshotPublisher` it wires today, unchanged.
 *
 * The dormant coordinated-publication bridge does **not** type against it: an
 * implementation of this shape may hand a season to the legacy authority, and
 * coordinated publication must never reach it (ADR 0023 D11). The bridge
 * types against `GuardedPublicationCommands` instead.
 */

import type { GeneratedSnapshotSet } from '../snapshots/generator';
import type { ManualCachePurgeResult, PublicationResult } from './publisher';

export interface PublicationCommands {
  publish(set: GeneratedSnapshotSet): Promise<PublicationResult>;
  rollback(season: number, targetVersion?: string): Promise<PublicationResult>;
  purgeActiveVersion(season: number): Promise<ManualCachePurgeResult>;
}

/**
 * The one command the coordinated-publication bridge may use (ADR 0023 D11,
 * ADR 0026 D14-D16): ordinary publication through the guarded sequencer, with
 * **no legacy fallback**.
 *
 * Only `SequencedPublicationService` implements it. `SnapshotPublisher` does
 * not and cannot: the legacy authority has no predecessor binding, so it can
 * never satisfy D16. A season whose sequencer authority is not `active` is
 * refused as `guard-authority-not-sequenced` before anything is written, and an
 * unreachable sequencer is the same bounded `sequencer-authority-unavailable`
 * failure ordinary sequenced publication reports. Otherwise the D14/D15
 * comparison, the expected-predecessor `prepare`, the candidate write and
 * `finalize` run exactly as they do for `PublicationCommands.publish`.
 */
export interface GuardedPublicationCommands {
  publishGuarded(
    set: GeneratedSnapshotSet,
    options?: GuardedPublicationOptions,
  ): Promise<PublicationResult>;
}

export interface GuardedPublicationOptions {
  /**
   * The active release the caller reviewed its candidate against. When given,
   * a season whose authoritative active version is any other is refused as
   * `guard-predecessor-stale` before anything is read or written, and the
   * D14/D15 comparison and the `prepare` CAS then bind to exactly this
   * version. A retry after a commit - reported or not - therefore finds its
   * own release active and is refused instead of minting a duplicate.
   *
   * Absent, the predecessor is whatever is authoritative when the
   * publication starts, as for coordinated publication.
   */
  readonly expectedActiveVersion?: string | null;
}

/**
 * The command surface for an **explicitly selected** sequencer authority whose
 * port is not reachable (`PublicationAuthority.mode === 'sequencer-unavailable'`).
 *
 * It is deliberately not `SnapshotPublisher`. Once an operator has selected the
 * sequencer, a missing binding is an unavailable authority, not permission to
 * mutate the legacy KV pointers behind their back - so every command here
 * answers with the same bounded `sequencer-authority-unavailable` outcome a
 * failed authority lookup produces, touches no storage at all, and never
 * rejects its promise. Scheduled and admin callers therefore see an ordinary
 * bounded result instead of an escaping exception or a legacy write.
 */
export class UnavailableSequencerPublicationCommands implements PublicationCommands {
  async publish(set: GeneratedSnapshotSet): Promise<PublicationResult> {
    return unavailable(set.season, set.version);
  }

  async rollback(
    season: number,
    targetVersion?: string,
  ): Promise<PublicationResult> {
    return unavailable(season, targetVersion ?? '');
  }

  async purgeActiveVersion(season: number): Promise<ManualCachePurgeResult> {
    return {
      season,
      activeVersion: null,
      ok: false,
      reason: 'sequencer-authority-unavailable',
      urls: [],
    };
  }
}

function unavailable(season: number, version: string): PublicationResult {
  return {
    status: 'failed',
    season,
    version,
    previousVersion: null,
    reason: 'sequencer-authority-unavailable',
    cachePurgeOk: true,
    cachePurge: 'not-required',
    pointerMaintenance: 'not-required',
    purgedUrls: [],
  };
}
