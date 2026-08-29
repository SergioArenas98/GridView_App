/**
 * The single, guarded bridge from a coordination run to the existing
 * publication boundary.
 *
 * Every established guarantee is preserved unchanged:
 *
 * - Adapters never publish. Only this step calls the publisher, and only with
 *   a complete, assembled season.
 * - The coordinator never writes an active pointer. `SnapshotPublisher`
 *   remains the sole publication authority and the active pointer remains its
 *   final write.
 * - Publication happens **at most once** for one completed run: one call site,
 *   no loop, no retry, no second attempt on failure.
 * - An incomplete, cancelled or rejected run does not reach the publisher at
 *   all, so it cannot replace the active release.
 * - A publisher failure is returned as-is. Nothing here compensates, rolls
 *   forward or republishes, so the prior active release stands.
 * - **This boundary returns; it does not throw.** Assembly settles referential
 *   integrity before generation, and generation itself is contained, so an
 *   unexpected defect becomes a bounded withheld outcome rather than a
 *   rejected promise the caller never agreed to handle.
 */

import type { Logger } from '../../logging/logger';
import type { PublicationResult } from '../../publication/publisher';
import type { SnapshotPublisher } from '../../publication/publisher';
import { generateSnapshotSet } from '../../snapshots/generator';
import type { CoordinationRun } from './outcome';
import type { CoordinatedResource } from './resource';
import {
  assembleSeasonSource,
  type AssemblyGap,
  type SeasonSnapshotMetadata,
} from './season-assembly';
import type { SeasonRelation } from './season-integrity';

export const COORDINATED_PUBLICATION_OPERATION =
  'provider.coordination.publication';

export type CoordinatedPublicationOutcome =
  | { readonly outcome: 'published'; readonly result: PublicationResult }
  | {
      readonly outcome: 'withheld';
      readonly gap: AssemblyGap | 'generation-failed';
      readonly missing: readonly CoordinatedResource[];
      /** Bounded relation names for `inconsistent-references`; else empty. */
      readonly relations: readonly SeasonRelation[];
    };

export interface CoordinatedSeasonPublicationOptions {
  readonly publisher: SnapshotPublisher;
  readonly logger: Logger;
}

export class CoordinatedSeasonPublication {
  private readonly publisher: SnapshotPublisher;
  private readonly logger: Logger;

  constructor(options: CoordinatedSeasonPublicationOptions) {
    this.publisher = options.publisher;
    this.logger = options.logger;
  }

  /**
   * Publishes a completed run, or withholds it with a bounded reason.
   *
   * `generatedAt` and `version` are supplied by the caller. Release versioning
   * and the clock stay with the synchronization path that owns them; nothing
   * about publication identity is invented by coordination.
   */
  async publish(
    run: CoordinationRun,
    metadata: SeasonSnapshotMetadata,
    generatedAt: string,
    version: string,
  ): Promise<CoordinatedPublicationOutcome> {
    const assembly = assembleSeasonSource(run, metadata);
    if (!assembly.complete) {
      this.logger.warn({
        operation: COORDINATED_PUBLICATION_OPERATION,
        season: run.season,
        coordinationStatus: run.status,
        coordinationOutcome: 'withheld',
        failureCategory: assembly.gap,
        // Bounded twice over: closed resource kinds only - never an identity
        // payload - and *distinct*, so the field can hold at most one entry
        // per member of the closed kind union however many resources an
        // adapter-supplied calendar made unavailable.
        coordinationMissing: [
          ...new Set(assembly.missing.map((resource) => resource.kind)),
        ],
        // Closed relation members, already distinct and already bounded by the
        // relation union - never an entity identifier.
        coordinationRelations: [...assembly.relations],
      });
      return {
        outcome: 'withheld',
        gap: assembly.gap,
        missing: assembly.missing,
        relations: assembly.relations,
      };
    }

    // Narrowly around generation only. Preflight settles every reference the
    // generator looks up, but generation also derives values from caller
    // inputs it cannot vouch for, and this boundary promises an outcome rather
    // than a thrown error. The thrown value is never read: it can embed a
    // payload, an identifier or a stack.
    let set;
    try {
      set = generateSnapshotSet(assembly.source, generatedAt, version);
    } catch {
      this.logger.warn({
        operation: COORDINATED_PUBLICATION_OPERATION,
        season: run.season,
        coordinationStatus: run.status,
        coordinationOutcome: 'withheld',
        failureCategory: 'generation-failed',
      });
      // Nothing was generated, so the publisher is never reached, no pointer
      // moves and the prior active release keeps serving.
      return {
        outcome: 'withheld',
        gap: 'generation-failed',
        missing: [],
        relations: [],
      };
    }

    // Past this point the publisher owns the result. Its failures are its own
    // and are returned unchanged - they are never reinterpreted as a
    // generation failure.
    const result = await this.publisher.publish(set);
    this.logger.info({
      operation: COORDINATED_PUBLICATION_OPERATION,
      season: run.season,
      releaseVersion: result.version,
      coordinationOutcome: 'published',
      publicationStatus: result.status,
    });
    return { outcome: 'published', result };
  }
}
