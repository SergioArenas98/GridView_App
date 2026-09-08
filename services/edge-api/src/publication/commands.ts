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
