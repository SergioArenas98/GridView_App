/**
 * The internal cutover preparation service
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D12, GridView_Implementation_Plan.md 14.0.11 item 3).
 *
 * It runs D12's per-season migration procedure against an operator-approved
 * checkpoint and commits a durable `seeded` state, and - as a **separate**
 * operator act - performs the fingerprint-bound `seeded -> active` transition.
 *
 * ## Nothing here is enabled, and nothing here deploys
 *
 * Every operation requires all of: the staging runtime environment, an explicit
 * `SEASON_PUBLICATION_AUTHORITY=sequencer`, a reachable sequencer port, and a
 * cutover control naming this exact season in this exact phase. No committed
 * environment sets the last two, so every operation is refused before it reads
 * anything. Nothing in this file provisions a Cloudflare resource, deploys a
 * Worker, contacts a provider or calls a deployed endpoint.
 *
 * ## Why the migration lives here and not in the Durable Object
 *
 * The Durable Object accepts an **already validated, complete** seed and
 * commits it atomically, idempotently, refusing a conflicting one. Selecting
 * and validating the checkpoint is a different job, needs Workers KV reads the
 * object deliberately never performs, and would put unbounded read/retry logic
 * inside the transaction that decides authority. The split is D12's, and this
 * file is the outside half of it.
 *
 * ## What is reused rather than re-derived
 *
 * `SnapshotStorage`, `SnapshotValidator`, the canonical `snapshotRevision`
 * implementation, `canonicalInstant`/`compareInstants` through
 * `highestInstant`, the shared rollback-provenance resolver, and
 * `SeasonPublicationSequencerPort`. There is no second revision rule, no second
 * provenance rule and no second timestamp rule anywhere in this slice.
 *
 * ## Seed and activation are never one act
 *
 * There is no method, route or helper that seeds and activates together, and a
 * successful seed never activates as a side effect. D12's two durable
 * transitions exist precisely because a crash between them is a real,
 * distinguishable state; collapsing them here would erase that.
 */

import type { Logger } from '../../logging/logger';
import type { Clock } from '../../runtime/clock';
import type { SnapshotStorage } from '../../storage/types';
import type { SnapshotValidator } from '../../validation/snapshot-validator';
import type { EnvironmentName, RuntimeConfig } from '../../config/environment';
import { boundedInstant } from '../canonical/instant';
import type { PublicationAuthority } from '../authority';
import type { CutoverSeed, CutoverSeedOutcome } from '../sequencer/model';
import type { SeasonPublicationSequencerPort } from '../sequencer/port';
import { highestInstant } from '../sequencer/rules';
import type { CutoverControl, CutoverPhase } from './control';
import {
  auditedUpperBoundOf,
  cutoverFingerprint,
  seedDescribesCheckpoint,
  type CutoverCheckpoint,
} from './checkpoint';
import {
  defaultCutoverRetryPolicy,
  importRelease,
  observedTimestamps,
  releasesMatch,
  type CutoverRetryPolicy,
  type ImportedRelease,
  type ReleaseImportRefusal,
} from './migration';

/**
 * Why an operation could not even be attempted.
 *
 * Every value here is a refusal taken **before** any storage read, and none of
 * them is ever satisfied by a committed environment.
 */
export const cutoverGateRefusals = [
  /** No cutover control is set at all. */
  'disabled',
  /** The control names a different season. */
  'season-not-paused',
  /** `seed:` cannot activate, and `activate:` cannot seed. */
  'phase-not-permitted',
  /** Only staging is an authorized cutover target; production never is. */
  'environment-not-staging',
  /** `SEASON_PUBLICATION_AUTHORITY` is not the exact string `sequencer`. */
  'authority-mode-not-sequencer',
  /** Sequencer mode is selected and no port is reachable. */
  'sequencer-unavailable',
] as const;

export type CutoverGateRefusal = (typeof cutoverGateRefusals)[number];

/** Why a seed attempt failed after the gate allowed it. Bounded. */
export const cutoverSeedFailures = [
  'active-inventory-unavailable',
  'active-inventory-empty',
  'active-document-unavailable',
  'active-document-invalid',
  'active-document-timestamp-invalid',
  'active-provenance-unavailable',
  /** The mandatory step-9 re-read failed or no longer matched. */
  'active-recheck-failed',
  /** The migration clock has no usable RFC 3339 spelling. */
  'migration-clock-unusable',
  /** No orderable value survived to seed the high-water mark. */
  'high-water-mark-unresolved',
  /** A different seed or fingerprint already exists for this season. */
  'conflicting-cutover-seed',
  /**
   * A seed is committed under this exact fingerprint, but the sequencer did not
   * return one that is complete, internally consistent and one this checkpoint
   * could have produced (over the Durable Object transport this includes an
   * answer that could not be decoded). Nothing was written or repaired.
   */
  'committed-seed-incoherent',
  /** The sequencer refused the seed for another bounded reason. */
  'seed-rejected',
  /** The sequencer's post-seed authority did not describe the seed committed. */
  'seed-unconfirmed',
] as const;

export type CutoverSeedFailure = (typeof cutoverSeedFailures)[number];

/** Why an activation attempt failed after the gate allowed it. Bounded. */
export const cutoverActivationFailures = [
  /** The request carried no explicit activation confirmation. */
  'activation-not-confirmed',
  /** The season holds no seed to activate. */
  'cutover-not-seeded',
  /** The recomputed checkpoint fingerprint is not the seeded one. */
  'cutover-fingerprint-mismatch',
  /** The sequencer refused the transition for another bounded reason. */
  'activation-rejected',
  /** The sequencer's authority lookup could not be resolved. */
  'authority-unreadable',
] as const;

export type CutoverActivationFailure =
  (typeof cutoverActivationFailures)[number];

/** The safe operator receipt a later confirmation and audit are built from. */
export interface CutoverSeedReceipt {
  readonly season: number;
  readonly outcome: 'seeded' | 'already-seeded' | 'already-active';
  readonly cutoverState: 'seeded' | 'active';
  readonly cutoverFingerprint: string;
  /** Exactly the fields the fingerprint covers, echoed for re-presentation. */
  readonly checkpoint: CutoverCheckpoint;
  readonly seeded: {
    readonly activeVersion: string;
    readonly previousVersion: string | null;
    /** Whether the checkpoint's previous version validated and was committed. */
    readonly previousVersionCommitted: boolean;
    readonly committedSourceOrderingInput: string;
    /**
     * How the ordering input was derived, for the audit trail. A retry that
     * reused the committed seed reports `committed-seed`: it re-derived nothing,
     * and the original derivation is not part of durable authority state.
     */
    readonly activeProvenance:
      'sidecar' | 'legacy-uniform-documents' | 'committed-seed';
    readonly seasonSnapshotObservedAtHighWaterMark: string;
    readonly documentCount: number;
  };
}

export interface CutoverActivationReceipt {
  readonly season: number;
  readonly outcome: 'activated' | 'already-active';
  readonly cutoverState: 'active';
  readonly cutoverFingerprint: string;
  readonly activeVersion: string;
  readonly previousVersion: string | null;
}

export type CutoverSeedResult =
  | { readonly kind: 'seeded'; readonly receipt: CutoverSeedReceipt }
  | { readonly kind: 'refused'; readonly refusal: CutoverGateRefusal }
  | { readonly kind: 'failed'; readonly failure: CutoverSeedFailure };

export type CutoverActivationResult =
  | { readonly kind: 'activated'; readonly receipt: CutoverActivationReceipt }
  | { readonly kind: 'refused'; readonly refusal: CutoverGateRefusal }
  | { readonly kind: 'failed'; readonly failure: CutoverActivationFailure };

/**
 * What the read-only status route reports.
 *
 * `disabled` and `unavailable` are deliberately distinct from
 * `uninitialized`: the first two say nothing at all about the season's durable
 * state, and the third is a positive answer from the authority itself.
 * **Authority is never inferred from a legacy pointer** - `disabled` and
 * `unavailable` report exactly that no authoritative answer is available.
 */
export type CutoverStatus =
  | { readonly state: 'disabled' }
  | {
      readonly state: 'unavailable';
      readonly reason: CutoverGateRefusal;
      readonly season: number;
    }
  | {
      readonly state: 'uninitialized';
      readonly season: number;
      readonly phase: CutoverPhase;
      readonly admissionClosed: true;
    }
  | {
      readonly state: 'seeded' | 'active';
      readonly season: number;
      readonly phase: CutoverPhase;
      readonly admissionClosed: true;
      readonly authoritative: boolean;
      readonly activeVersion: string;
      readonly previousVersion: string | null;
      readonly cutoverFingerprint: string;
    };

export interface CutoverPreparationDeps {
  readonly config: RuntimeConfig;
  readonly authority: PublicationAuthority;
  readonly storage: SnapshotStorage;
  readonly validator: SnapshotValidator;
  readonly logger: Logger;
  readonly clock: Clock;
  readonly retry?: CutoverRetryPolicy;
}

export class CutoverPreparationService {
  private readonly control: CutoverControl;
  private readonly environment: EnvironmentName;
  private readonly authority: PublicationAuthority;
  private readonly storage: SnapshotStorage;
  private readonly validator: SnapshotValidator;
  private readonly logger: Logger;
  private readonly clock: Clock;
  private readonly retry: CutoverRetryPolicy;

  constructor(deps: CutoverPreparationDeps) {
    this.control = deps.config.publicationCutoverControl;
    this.environment = deps.config.environment;
    this.authority = deps.authority;
    this.storage = deps.storage;
    this.validator = deps.validator;
    this.logger = deps.logger;
    this.clock = deps.clock;
    this.retry = deps.retry ?? defaultCutoverRetryPolicy;
  }

  /**
   * Read-only inspection. Available in both phases, and it commits nothing.
   *
   * It reports only what the sequencer itself answers. A `disabled` or
   * `unavailable` status is never resolved by falling back to
   * `active:{season}` - that pointer is the legacy authority, not this
   * authority's state, and reading it here would be exactly the inference D12
   * forbids.
   */
  async status(season: number): Promise<CutoverStatus> {
    if (this.control.kind === 'disabled') return { state: 'disabled' };
    const phase = this.control.kind;
    const port = this.reachablePort(season, phase);
    if (port.kind === 'refused') {
      return { state: 'unavailable', reason: port.refusal, season };
    }
    let authority;
    try {
      authority = await port.port.readAuthority(season);
    } catch {
      return { state: 'unavailable', reason: 'sequencer-unavailable', season };
    }
    if (authority.cutoverState === 'unavailable') {
      return { state: 'unavailable', reason: 'sequencer-unavailable', season };
    }
    if (authority.cutoverState === 'uninitialized') {
      return {
        state: 'uninitialized',
        season,
        phase,
        admissionClosed: true,
      };
    }
    return {
      state: authority.cutoverState,
      season,
      phase,
      admissionClosed: true,
      authoritative: authority.authoritative,
      activeVersion: authority.activeVersion,
      previousVersion: authority.previousVersion,
      cutoverFingerprint: authority.cutoverFingerprint,
    };
  }

  /**
   * D12 steps 2-10 against the operator-approved checkpoint.
   *
   * Only reachable in `seed:<same season>` mode, which is also what closes that
   * season's legacy mutation admission - the same single configuration value the
   * composition boundary reads to install `CutoverPausedPublicationCommands`, so
   * "admission is closed" is one fact here, not two that could disagree.
   *
   * It never activates, and it never writes a legacy pointer, a historical
   * sidecar, or partial Durable Object state.
   *
   * ## An identical retry reuses the committed seed
   *
   * The seed already committed under this checkpoint's fingerprint is recovered
   * **first** - before the migration clock is read and before any legacy read -
   * so a retry after a lost or ambiguous response re-presents exactly the
   * committed seed, high-water mark included, and a later wall clock cannot turn
   * it into a conflict. Only a season with no committed seed runs the fresh
   * migration, whose single clock reading is then part of the floor.
   *
   * Two overlapping identical attempts can both find the season uninitialized
   * and stage different floors; the one that commits second is told
   * `conflicting-cutover-seed`. That invocation alone recovers once more and
   * re-presents the committed seed unchanged, once - no clock or legacy
   * re-read, no loop - and every inconsistent answer on that path fails closed.
   */
  async seed(checkpoint: CutoverCheckpoint): Promise<CutoverSeedResult> {
    const gate = this.reachablePort(checkpoint.season, 'seed');
    if (gate.kind === 'refused') {
      return this.refusedSeed(checkpoint.season, gate.refusal);
    }
    const port = gate.port;
    const season = checkpoint.season;
    const fingerprint = await cutoverFingerprint(checkpoint);

    const recovered = await this.recoverCommittedSeed(
      port,
      checkpoint,
      fingerprint,
    );
    const staged =
      recovered.kind === 'uninitialized'
        ? await this.stageFreshSeed(checkpoint, fingerprint)
        : recovered;
    if (staged.kind === 'failed') {
      return this.failedSeed(season, staged.failure);
    }
    let { seed, provenance } = staged;

    // A recovered seed takes this same path: `seedCutover`'s committed-state
    // comparison, not the recovery, decides `already-seeded`/`already-active`.
    let outcome = await presentSeed(port, seed);
    if (
      recovered.kind === 'uninitialized' &&
      outcome?.outcome === 'rejected' &&
      outcome.reason === 'conflicting-cutover-seed'
    ) {
      // An overlapping identical attempt may have committed between this
      // invocation's recovery and its seed, with its own clock reading. Recover
      // once more and re-present what is committed, unchanged, once: the same
      // comparison then decides, and a different fingerprint still conflicts.
      const settled = await this.recoverCommittedSeed(
        port,
        checkpoint,
        fingerprint,
      );
      if (settled.kind !== 'staged') {
        // `uninitialized` right after a conflict is a contradiction, never
        // permission to migrate again.
        return this.failedSeed(
          season,
          settled.kind === 'failed' ? settled.failure : 'seed-unconfirmed',
        );
      }
      ({ seed, provenance } = settled);
      outcome = await presentSeed(port, seed);
    }
    if (outcome === null) return this.failedSeed(season, 'seed-unconfirmed');
    if (outcome.outcome === 'rejected') {
      return this.failedSeed(
        season,
        outcome.reason === 'conflicting-cutover-seed'
          ? 'conflicting-cutover-seed'
          : 'seed-rejected',
      );
    }

    // Verify what the authority now reports, rather than trusting the outcome
    // word alone: a `seeded` season must be non-authoritative and bound to this
    // exact fingerprint before an operator is handed a receipt to confirm.
    const expectedState =
      outcome.outcome === 'already-active' ? 'active' : 'seeded';
    const confirmed = await this.confirmSeededAuthority(
      port,
      season,
      fingerprint,
      seed,
      expectedState,
    );
    if (!confirmed) return this.failedSeed(season, 'seed-unconfirmed');

    this.logger.info({
      operation: 'publication.cutover.seeded',
      season,
      releaseVersion: seed.activeVersion,
      cutoverState: expectedState,
      publicationStatus: outcome.outcome,
    });

    return {
      kind: 'seeded',
      receipt: {
        season,
        outcome: outcome.outcome,
        cutoverState: expectedState,
        cutoverFingerprint: fingerprint,
        checkpoint,
        seeded: {
          activeVersion: seed.activeVersion,
          previousVersion: seed.previousVersion,
          previousVersionCommitted: seed.previousVersion !== null,
          committedSourceOrderingInput: seed.committedSourceOrderingInput,
          activeProvenance: provenance,
          seasonSnapshotObservedAtHighWaterMark:
            seed.seasonSnapshotObservedAtHighWaterMark,
          documentCount: seed.perKeyState.length,
        },
      },
    };
  }

  /**
   * D12 step 11: the separate, idempotent, fingerprint-bound `seeded -> active`
   * transition.
   *
   * It creates and replaces nothing. The fingerprint is **recomputed locally**
   * from the checkpoint the operator re-presents and compared to the one the
   * sequencer actually holds, so an altered receipt cannot activate: the
   * recomputation no longer matches. A missing confirmation, a season that is
   * not `seeded`, or a mismatched fingerprint each fail closed with the seeded
   * attempt left exactly as it was, for the operator to abandon or restart.
   */
  async activate(
    checkpoint: CutoverCheckpoint,
    confirmActivation: boolean,
  ): Promise<CutoverActivationResult> {
    const gate = this.reachablePort(checkpoint.season, 'activate');
    if (gate.kind === 'refused') {
      return this.refusedActivation(checkpoint.season, gate.refusal);
    }
    const season = checkpoint.season;
    if (!confirmActivation) {
      return this.failedActivation(season, 'activation-not-confirmed');
    }

    let authority;
    try {
      authority = await gate.port.readAuthority(season);
    } catch {
      return this.failedActivation(season, 'authority-unreadable');
    }
    if (authority.cutoverState === 'unavailable') {
      return this.failedActivation(season, 'authority-unreadable');
    }
    if (authority.cutoverState === 'uninitialized') {
      return this.failedActivation(season, 'cutover-not-seeded');
    }

    const fingerprint = await cutoverFingerprint(checkpoint);
    if (authority.cutoverFingerprint !== fingerprint) {
      return this.failedActivation(season, 'cutover-fingerprint-mismatch');
    }

    let outcome;
    try {
      outcome = await gate.port.activateCutover({
        season,
        cutoverFingerprint: fingerprint,
      });
    } catch {
      return this.failedActivation(season, 'activation-rejected');
    }
    if (outcome.outcome === 'rejected') {
      return this.failedActivation(
        season,
        outcome.reason === 'cutover-fingerprint-mismatch'
          ? 'cutover-fingerprint-mismatch'
          : outcome.reason === 'cutover-not-seeded'
            ? 'cutover-not-seeded'
            : 'activation-rejected',
      );
    }

    this.logger.info({
      operation: 'publication.cutover.activated',
      season,
      releaseVersion: authority.activeVersion,
      cutoverState: 'active',
      publicationStatus: outcome.outcome,
    });

    return {
      kind: 'activated',
      receipt: {
        season,
        outcome: outcome.outcome,
        cutoverState: 'active',
        cutoverFingerprint: fingerprint,
        activeVersion: authority.activeVersion,
        previousVersion: authority.previousVersion,
      },
    };
  }

  // --- guards ---------------------------------------------------------------

  /**
   * The one gate every operation passes, in the order that reveals the least.
   *
   * All five conditions are required together. None of them is satisfied by a
   * committed environment, and production fails at the environment check before
   * an authority mode or a port is even considered.
   */
  private reachablePort(
    season: number,
    phase: CutoverPhase,
  ):
    | { kind: 'ok'; port: SeasonPublicationSequencerPort }
    | { kind: 'refused'; refusal: CutoverGateRefusal } {
    if (this.control.kind === 'disabled') {
      return { kind: 'refused', refusal: 'disabled' };
    }
    if (this.control.season !== season) {
      return { kind: 'refused', refusal: 'season-not-paused' };
    }
    if (this.control.kind !== phase) {
      // `seed:` cannot activate and `activate:` cannot seed. D12 forbids one
      // operator act that does both, and this is where that is enforced.
      return { kind: 'refused', refusal: 'phase-not-permitted' };
    }
    if (this.environment !== 'staging') {
      return { kind: 'refused', refusal: 'environment-not-staging' };
    }
    if (this.authority.mode === 'legacy') {
      return { kind: 'refused', refusal: 'authority-mode-not-sequencer' };
    }
    if (this.authority.mode === 'sequencer-unavailable') {
      return { kind: 'refused', refusal: 'sequencer-unavailable' };
    }
    return { kind: 'ok', port: this.authority.port };
  }

  /**
   * Retrieves the seed already committed under this fingerprint, if any.
   *
   * `uninitialized` is the only answer that lets a fresh migration run. A seed
   * under another fingerprint is a conflict, decided here without reading a
   * legacy artifact. A matching seed is reused only if it is one this exact
   * checkpoint could have produced; a fingerprint match is never permission to
   * accept durable fields that disagree with the checkpoint, and nothing here
   * repairs, rewrites or replaces them.
   */
  private async recoverCommittedSeed(
    port: SeasonPublicationSequencerPort,
    checkpoint: CutoverCheckpoint,
    fingerprint: string,
  ): Promise<{ readonly kind: 'uninitialized' } | StagedSeed> {
    let recovery;
    try {
      recovery = await port.recoverCutoverSeed({
        season: checkpoint.season,
        cutoverFingerprint: fingerprint,
      });
    } catch {
      // No answer about existing state: stage nothing, write nothing.
      return { kind: 'failed', failure: 'seed-unconfirmed' };
    }
    switch (recovery.outcome) {
      case 'uninitialized':
        return { kind: 'uninitialized' };
      case 'rejected':
        return {
          kind: 'failed',
          failure:
            recovery.reason === 'conflicting-cutover-seed'
              ? 'conflicting-cutover-seed'
              : recovery.reason === 'state-corrupt'
                ? 'committed-seed-incoherent'
                : 'seed-rejected',
        };
      case 'committed':
        return seedDescribesCheckpoint(recovery.seed, checkpoint, fingerprint)
          ? {
              kind: 'staged',
              seed: recovery.seed,
              provenance: 'committed-seed',
            }
          : { kind: 'failed', failure: 'committed-seed-incoherent' };
    }
  }

  /** D12 steps 2-9 and the conservative floor, for a season with no seed. */
  private async stageFreshSeed(
    checkpoint: CutoverCheckpoint,
    fingerprint: string,
  ): Promise<StagedSeed> {
    const season = checkpoint.season;

    // The migration's own observation clock, read once, before anything else.
    const migrationNow = boundedInstant(this.clock.now());
    if (migrationNow === null) {
      return { kind: 'failed', failure: 'migration-clock-unusable' };
    }

    // Step 2-6, mandatory: the selected active version, by exact versioned key.
    const active = await importRelease(
      this.deps(),
      season,
      checkpoint.activeVersion,
    );
    if (!active.ok) {
      return { kind: 'failed', failure: activeFailure(active.refusal) };
    }

    // Step 8, best-effort: an invalid or absent previous version is never a
    // cutover-blocking condition and is never committed as an authoritative
    // rollback target.
    let previous: ImportedRelease | null = null;
    if (checkpoint.previousVersion !== null) {
      const read = await importRelease(
        this.deps(),
        season,
        checkpoint.previousVersion,
      );
      if (read.ok) {
        previous = read.release;
      } else {
        this.logger.warn({
          operation: 'publication.cutover.previous_omitted',
          season,
          releaseVersion: checkpoint.previousVersion,
          failureCategory: read.refusal,
        });
      }
    }

    // Step 9: the active recheck is mandatory, the previous recheck best-effort.
    const activeRecheck = await importRelease(
      this.deps(),
      season,
      checkpoint.activeVersion,
    );
    if (
      !activeRecheck.ok ||
      !releasesMatch(active.release, activeRecheck.release)
    ) {
      return { kind: 'failed', failure: 'active-recheck-failed' };
    }
    if (previous !== null) {
      const recheck = await importRelease(
        this.deps(),
        season,
        previous.version,
      );
      if (!recheck.ok || !releasesMatch(previous, recheck.release)) {
        // Step 10 commits the post-recheck result, never step 8's optimistic
        // one: both the pointer and its timestamp contribution are dropped.
        this.logger.warn({
          operation: 'publication.cutover.previous_omitted',
          season,
          releaseVersion: previous.version,
          failureCategory: 'previous-recheck-failed',
        });
        previous = null;
      }
    }

    // The conservative high-water-mark seed: every active timestamp, every
    // timestamp of a previous version that survived its recheck, the migration
    // clock, and any audited upper bound the evidence supplied.
    const highWaterMark = highestInstant([
      ...observedTimestamps(active.release),
      ...(previous === null ? [] : observedTimestamps(previous)),
      migrationNow,
      auditedUpperBoundOf(checkpoint.historicalFloorEvidence),
    ]);
    if (highWaterMark === null) {
      return { kind: 'failed', failure: 'high-water-mark-unresolved' };
    }

    return {
      kind: 'staged',
      provenance: active.release.provenance,
      seed: {
        season,
        cutoverFingerprint: fingerprint,
        activeVersion: active.release.version,
        previousVersion: previous === null ? null : previous.version,
        committedSourceOrderingInput: active.release.sourceOrderingInput,
        perKeyState: active.release.perKeyState,
        seasonSnapshotObservedAtHighWaterMark: highWaterMark,
      },
    };
  }

  private async confirmSeededAuthority(
    port: SeasonPublicationSequencerPort,
    season: number,
    fingerprint: string,
    seed: CutoverSeed,
    expected: 'seeded' | 'active',
  ): Promise<boolean> {
    let authority;
    try {
      authority = await port.readAuthority(season);
    } catch {
      return false;
    }
    if (authority.cutoverState !== expected) return false;
    if (authority.cutoverFingerprint !== fingerprint) return false;
    if (authority.activeVersion !== seed.activeVersion) return false;
    if (authority.previousVersion !== seed.previousVersion) return false;
    // A seeded season is never authoritative; only activation makes it so.
    return expected === 'active'
      ? authority.authoritative
      : !authority.authoritative;
  }

  private deps() {
    return {
      storage: this.storage,
      validator: this.validator,
      retry: this.retry,
    };
  }

  private refusedSeed(
    season: number,
    refusal: CutoverGateRefusal,
  ): CutoverSeedResult {
    this.logger.warn({
      operation: 'publication.cutover.seed_refused',
      season,
      failureCategory: refusal,
    });
    return { kind: 'refused', refusal };
  }

  private failedSeed(
    season: number,
    failure: CutoverSeedFailure,
  ): CutoverSeedResult {
    this.logger.warn({
      operation: 'publication.cutover.seed_failed',
      season,
      failureCategory: failure,
    });
    return { kind: 'failed', failure };
  }

  private refusedActivation(
    season: number,
    refusal: CutoverGateRefusal,
  ): CutoverActivationResult {
    this.logger.warn({
      operation: 'publication.cutover.activation_refused',
      season,
      failureCategory: refusal,
    });
    return { kind: 'refused', refusal };
  }

  private failedActivation(
    season: number,
    failure: CutoverActivationFailure,
  ): CutoverActivationResult {
    this.logger.warn({
      operation: 'publication.cutover.activation_failed',
      season,
      failureCategory: failure,
    });
    return { kind: 'failed', failure };
  }
}

/** A complete seed ready for `seedCutover`, or why none could be staged. */
type StagedSeed =
  | {
      readonly kind: 'staged';
      readonly seed: CutoverSeed;
      readonly provenance: CutoverSeedReceipt['seeded']['activeProvenance'];
    }
  | { readonly kind: 'failed'; readonly failure: CutoverSeedFailure };

/** `null` when no answer arrived: the seed may or may not have committed. */
async function presentSeed(
  port: SeasonPublicationSequencerPort,
  seed: CutoverSeed,
): Promise<CutoverSeedOutcome | null> {
  try {
    return await port.seedCutover(seed);
  } catch {
    return null;
  }
}

/** The active half's obligations are mandatory, so every refusal is a failure. */
function activeFailure(refusal: ReleaseImportRefusal): CutoverSeedFailure {
  switch (refusal) {
    case 'inventory-unavailable':
      return 'active-inventory-unavailable';
    case 'inventory-empty':
      return 'active-inventory-empty';
    case 'document-unavailable':
      return 'active-document-unavailable';
    case 'document-invalid':
      return 'active-document-invalid';
    case 'document-timestamp-invalid':
      return 'active-document-timestamp-invalid';
    case 'provenance-unavailable':
      return 'active-provenance-unavailable';
  }
}
