/**
 * The single, guarded bridge from a coordination run to season publication.
 *
 * Coordinated publication goes through the **guarded sequencer only** (ADR 0023
 * D11 as amended, ADR 0026 D14-D16). The bridge holds a
 * `GuardedPublicationCommands`, never a `SnapshotPublisher` or the general
 * `PublicationCommands` surface, so it has no path to the legacy KV authority:
 *
 *     assembleSeasonSource -> preflight -> generateSnapshotSet
 *       -> publishGuarded: D14/D15 comparison against the authoritative
 *          release -> expected-predecessor `prepare` -> candidate write
 *          -> `finalize`
 *
 * Every established guarantee is preserved unchanged:
 *
 * - Adapters never publish. Only this step calls publication, and only with a
 *   complete, assembled season.
 * - The coordinator never writes an active pointer. The sequencer's `finalize`
 *   is the commit point, and it belongs to the sequenced service.
 * - Publication happens **at most once** for one completed run: one call site,
 *   no loop, no retry, no second attempt on failure.
 * - An incomplete, cancelled or rejected run does not reach publication at
 *   all, so it cannot replace the active release.
 * - There is **no legacy fallback**. A season whose sequencer authority is not
 *   `active` - legacy-only, uninitialized, seeded - fails as
 *   `guard-authority-not-sequenced`, and an unreachable sequencer fails as
 *   `sequencer-authority-unavailable`. Neither writes anything.
 * - A publication failure, including a D14/D15 refusal or a stale predecessor,
 *   is returned as-is. Nothing here compensates, rolls forward, republishes or
 *   repairs the candidate from the predecessor, so the prior active release
 *   stands. The predecessor is a guard only, never an input.
 * - **Expected operational failures are contained, not propagated.** Assembly
 *   settles referential integrity before generation; generation is guarded; and
 *   the sequenced service converts its own storage, validation, guard,
 *   sequencer, cleanup and purge failures into bounded results. So a caller
 *   gets an outcome for every failure this system anticipates.
 *
 *   That is deliberately narrower than "nothing can ever throw here". An
 *   arbitrary programmer defect is not claimed to be impossible, because the
 *   only honest report for one would have to state whether publication
 *   committed - and nothing outside the sequenced service can know that. The
 *   service is therefore where the guarantee lives, and this boundary does not
 *   wrap it in a catch that would have to guess.
 */

import type { Logger } from '../../logging/logger';
import type { GuardedPublicationCommands } from '../../publication/commands';
import type { PublicationResult } from '../../publication/publisher';
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
  /** The guarded sequenced publication; there is no legacy alternative. */
  readonly commands: GuardedPublicationCommands;
  readonly logger: Logger;
}

export class CoordinatedSeasonPublication {
  private readonly commands: GuardedPublicationCommands;
  private readonly logger: Logger;

  constructor(options: CoordinatedSeasonPublicationOptions) {
    this.commands = options.commands;
    this.logger = options.logger;
  }

  /**
   * Publishes a completed run, or withholds it with a bounded reason.
   *
   * `generatedAt` and `version` are supplied by the caller; nothing about
   * publication identity is invented by coordination. The sequencer allocates
   * the committed release version in `prepare`, so `result.version` - not
   * `version` - names what was committed.
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
      // Nothing was generated, so publication is never reached, no pointer
      // moves and the prior active release keeps serving.
      return {
        outcome: 'withheld',
        gap: 'generation-failed',
        missing: [],
        relations: [],
      };
    }

    // Past this point the sequenced service owns the result, including whether
    // the commit point was crossed. Its outcomes are returned unchanged: a
    // committed release whose cache purge failed is still `published`, and is
    // never downgraded to `withheld`, because the release is serving; a refused
    // or failed publication carries its bounded status and reason, and the
    // authoritative release keeps serving.
    const result = await this.commands.publishGuarded(set);
    const event = {
      operation: COORDINATED_PUBLICATION_OPERATION,
      season: run.season,
      releaseVersion: result.version,
      coordinationOutcome: 'published',
      publicationStatus: result.status,
      // A closed `PublicationReason` member, never an identifier or a fact.
      ...(result.reason === null ? {} : { failureCategory: result.reason }),
    };
    if (result.status === 'applied' || result.status === 'skipped') {
      this.logger.info(event);
    } else {
      this.logger.warn(event);
    }
    return { outcome: 'published', result };
  }
}
