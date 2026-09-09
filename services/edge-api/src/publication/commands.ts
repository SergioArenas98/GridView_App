/**
 * The publication command surface every caller depends on, independent of which
 * authority is behind it (ADR 0025 D6, D12).
 *
 * `SnapshotPublisher` (the legacy Workers KV pointer authority) and
 * `SequencedPublicationService` (the two-phase `SeasonPublicationSequencer`
 * protocol) both satisfy this shape structurally. The synchronization service,
 * the admin router and the coordinated-publication bridge type against this
 * interface so the composition root can hand them either one without any of
 * them knowing which - and, crucially, so the default build wires the exact
 * `SnapshotPublisher` it wires today, unchanged.
 */

import type { GeneratedSnapshotSet } from '../snapshots/generator';
import type { ManualCachePurgeResult, PublicationResult } from './publisher';

export interface PublicationCommands {
  publish(set: GeneratedSnapshotSet): Promise<PublicationResult>;
  rollback(season: number, targetVersion?: string): Promise<PublicationResult>;
  purgeActiveVersion(season: number): Promise<ManualCachePurgeResult>;
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
