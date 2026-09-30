/**
 * The publication half of one coordinated run (decision pack §6.6 steps 6-9),
 * under the lease the observation half acquired and has not released.
 *
 * 6. **Publishability** is decided from the records the observation commit
 *    committed. A withheld candidate is never assembled.
 * 7. **The candidate is prepared once** - assembly and generation, by the
 *    bridge the composition built - with curated metadata (O-14) and a
 *    release-wide ordering input that strictly follows the season's last
 *    (O-13). Its digest is taken over its document names and snapshot
 *    revisions.
 * 8. **The no-change gate** (O-12) skips the guarded publisher only when the
 *    digest equals the last publication's *and* a fresh authority read,
 *    taken after the candidate exists, still serves the recorded release. An
 *    authority that cannot be confirmed never skips. Otherwise the ordering
 *    input and digest are reserved in one fenced commit, and the prepared
 *    candidate goes to the guarded sequenced publisher **once**.
 * 9. **The outcome commit** records what happened, with an explicit durable
 *    next-due decision for every path (`decisions.ts`), before the caller
 *    releases the lease.
 *
 * The race the gate cannot close - another writer committing between the
 * fresh authority read and the outcome commit - is not lost: the recorded
 * release then differs from what the authority serves, and the planner makes
 * a publication due at the next tick (`releaseDrifted`). A commit whose
 * answer was lost keeps its reservation, and the next run resolves it
 * against the authority (`recovery.ts`) without replaying anything.
 *
 * Assembly, snapshot generation, the D14-D16 guard and the sequencer protocol
 * are the existing ones, reached through the composed runtime; none is
 * duplicated here.
 */

import type { PublicationReason } from '../../../publication/publisher';
import type { SeasonPublicationSequencerPort } from '../../../publication/sequencer/port';
import type { CoordinatedRuntime } from '../composition';
import type {
  LeaseToken,
  LedgerInstant,
  LedgerRejectionReason,
  LedgerSnapshot,
  PublicationDisposition,
  SeasonRecord,
  Versioned,
} from '../ledger/model';
import {
  decidePublication,
  publicationStop,
  type CheckOutcome,
  type RunPlan,
  type SeasonOutcomes,
} from '../policy';
import {
  durableBlockReason,
  notApplied,
  settleSeasonRecord,
  withheldByPolicy,
  withheldCandidate,
  type NextDueDecision,
  type SettlementDecision,
  type WithheldCause,
} from './decisions';
import { candidateDigest } from './digest';
import { curatedSeasonMetadata, type CuratedSeasonMetadata } from './metadata';
import { nextOrderingInput } from './ordering';

type CoordinationRun = Awaited<
  ReturnType<CoordinatedRuntime['coordinator']['coordinate']>
>;
type PreparedCandidate = Extract<
  ReturnType<CoordinatedRuntime['publication']['prepareCandidate']>,
  { readonly outcome: 'prepared' }
>;

/** What the publication half did, before the lease is released. */
export type PublicationRunResult =
  | {
      /** The guarded publisher committed a release. */
      readonly outcome: 'published';
      readonly releaseVersion: string;
      /** `null`, or a post-commit degradation such as a failed purge. */
      readonly reason: PublicationReason | null;
      readonly publishCalls: 1;
      readonly next: 'completed';
    }
  | {
      /** Same digest, and the authority still serves the recorded release. */
      readonly outcome: 'unchanged';
      readonly publishCalls: 0;
      readonly next: 'completed';
    }
  | {
      readonly outcome: 'withheld';
      readonly cause: WithheldCause;
      readonly publishCalls: 0;
      readonly next: NextDueDecision;
    }
  | {
      /** The guarded publisher answered without a confirmed commit. */
      readonly outcome: 'not-applied';
      readonly publicationStatus: 'rejected' | 'failed' | 'skipped';
      readonly reason: PublicationReason | null;
      readonly publishCalls: 1;
      readonly next: NextDueDecision;
    };

export const publicationStages = ['publication', 'intent', 'outcome'] as const;
export type PublicationStage = (typeof publicationStages)[number];

export type PublicationStepFailure =
  | 'ledger-unavailable'
  | 'ledger-rejected'
  | 'ledger-uncertain'
  | 'lease-expired';

export type PublicationStep =
  | { readonly kind: 'settled'; readonly publication: PublicationRunResult }
  | {
      /**
       * A durable write this half needed did not commit. Never a clean
       * success: `publication` says what, if anything, was published.
       */
      readonly kind: 'failed';
      readonly stage: PublicationStage;
      readonly failure: PublicationStepFailure;
      readonly ledgerRejection: LedgerRejectionReason | null;
      readonly publication: PublicationRunResult | null;
    };

export interface PublicationStepInput {
  readonly runtime: CoordinatedRuntime;
  /** Where the authority is read for the no-change gate. */
  readonly sequencer: SeasonPublicationSequencerPort;
  readonly clock: () => Date;
  readonly lease: LeaseToken;
  readonly leaseExpiresAt: LedgerInstant;
  readonly plan: Extract<RunPlan, { readonly kind: 'publication' }>;
  readonly run: CoordinationRun;
  readonly seasonOutcomes: SeasonOutcomes;
  readonly classificationOutcomes: ReadonlyMap<number, CheckOutcome>;
  /** The ledger as the observation commit left it. */
  readonly committed: LedgerSnapshot;
  /** The disposition the season carried before this run. */
  readonly previous: PublicationDisposition | null;
  /** Whether the observation raised `classification.backlog-capacity-exceeded`. */
  readonly capacityExceeded: boolean;
  /** When every response had arrived. */
  readonly observedAt: Date;
  /** The curated metadata source. Defaults to the bundled records. */
  readonly metadata?: (season: number) => CuratedSeasonMetadata | null;
}

export async function publishUnderLease(
  input: PublicationStepInput,
): Promise<PublicationStep> {
  const season = input.committed.season;
  const current = input.committed.seasonRecord;
  if (current === null) {
    // The observation commit of a publication run always writes the season
    // record, so a missing one is a defect, never a decision.
    throw new TypeError('A publication run committed no season record.');
  }
  const records = new Map(
    input.committed.classifications.map(({ record }) => [record.round, record]),
  );

  // Checked first, on what the observation commit left: a hold or a durable
  // block ends the run before anything is prepared, reserved or sent,
  // whatever the trigger, the plan or the observations (OD-3, OD-5).
  const stop = publicationStop(current.record);
  if (stop !== null) {
    return settle(input, current, withheld(stop), { decision: 'stopped' });
  }
  if (input.run.status === 'cancelled') {
    return settle(input, current, withheld('cancelled'), { decision: 'retry' });
  }
  const decision = decidePublication({
    plan: input.plan,
    seasonOutcomes: input.seasonOutcomes,
    classificationOutcomes: input.classificationOutcomes,
    records,
  });
  if (!decision.publishable) {
    const selected = input.plan.checks.flatMap(({ round }) => {
      const record = records.get(round);
      return record === undefined ? [] : [record];
    });
    const durable = durableBlockReason({
      checks: input.plan.checks,
      records,
      outcomes: input.classificationOutcomes,
      capacityExceeded: input.capacityExceeded,
    });
    const settlement = withheldByPolicy(decision.reasons, selected, durable);
    const cause =
      settlement.decision === 'blocked' ||
      settlement.decision === 'durably-blocked'
        ? (settlement.reason as WithheldCause)
        : decision.reasons[0]!;
    return settle(input, current, withheld(cause), settlement);
  }

  const metadata = (input.metadata ?? curatedSeasonMetadata)(season);
  if (metadata === null) {
    return settle(input, current, withheld('metadata-unavailable'), {
      decision: 'blocked',
      reason: 'metadata-unavailable',
    });
  }

  const orderingInput = nextOrderingInput(
    input.observedAt,
    current.record.lastOrderingInput,
  );
  const generatedAt = input.clock();
  const candidate = input.runtime.publication.prepareCandidate(
    input.run,
    { ...metadata, sourceUpdatedAt: orderingInput },
    generatedAt.toISOString(),
    releaseLabel(generatedAt),
  );
  if (candidate.outcome === 'withheld') {
    return settle(
      input,
      current,
      withheld(candidate.gap),
      withheldCandidate(candidate.gap),
    );
  }

  const digest = await candidateDigest(candidate.set.documents);
  const last = current.record.lastPublication;
  if (last !== null && last.digest === digest) {
    // Read now, after the candidate exists: an authority read from before
    // coordination could predate a rollback that happened since.
    const serving = await servingVersion(input.sequencer, season);
    if (serving !== null && serving === last.activeVersion) {
      return settle(
        input,
        current,
        { outcome: 'unchanged', publishCalls: 0, next: 'completed' },
        {
          decision: 'completed',
          release: { digest, activeVersion: serving, published: false },
        },
      );
    }
  }

  return publishReserved(input, current, candidate, digest, orderingInput);
}

/** Reserve the ordering input and digest, then publish the candidate once. */
async function publishReserved(
  input: PublicationStepInput,
  current: Versioned<SeasonRecord>,
  candidate: PreparedCandidate,
  digest: string,
  orderingInput: LedgerInstant,
): Promise<PublicationStep> {
  if (Date.parse(input.leaseExpiresAt) <= input.clock().getTime()) {
    // Nothing is sent under a lease that can no longer record the outcome.
    // The `publishing` slot the observation commit wrote makes the next run
    // find the publication due.
    return failure('publication', 'lease-expired', null, null);
  }
  const since =
    current.record.publicationDisposition?.since ??
    input.observedAt.toISOString();
  const intent = await input.runtime.ledger.commit({
    lease: input.lease,
    seasonRecord: {
      expectedVersion: current.version,
      record: {
        ...current.record,
        lastOrderingInput: orderingInput,
        publicationDisposition: {
          state: 'publishing',
          since,
          digest,
          orderingInput,
        },
      },
    },
    classifications: [],
    backlogInsertions: [],
    backlogRemovals: [],
  });
  if (intent.outcome !== 'committed') {
    // The candidate is not sent without its reservation on record.
    return ledgerFailure('intent', intent, null);
  }
  const reserved = intent.snapshot.seasonRecord;
  if (reserved === null) {
    throw new TypeError('A committed reservation left no season record.');
  }

  const { result } =
    await input.runtime.publication.publishCandidate(candidate);
  if (result.status === 'applied') {
    return settle(
      input,
      reserved,
      {
        outcome: 'published',
        releaseVersion: result.version,
        reason: result.reason,
        publishCalls: 1,
        next: 'completed',
      },
      {
        decision: 'completed',
        release: { digest, activeVersion: result.version, published: true },
      },
    );
  }
  const settlement = notApplied(result);
  return settle(
    input,
    reserved,
    {
      outcome: 'not-applied',
      publicationStatus: result.status,
      reason: result.reason,
      publishCalls: 1,
      next: settlement.decision,
    },
    settlement,
  );
}

function withheld(
  cause: WithheldCause,
): Extract<PublicationRunResult, { readonly outcome: 'withheld' }> {
  // `next` is filled in by `settle` from the decision actually applied.
  return { outcome: 'withheld', cause, publishCalls: 0, next: 'retry' };
}

/** The outcome commit: one fenced write of the season record, or none. */
async function settle(
  input: PublicationStepInput,
  current: Versioned<SeasonRecord>,
  publication: PublicationRunResult,
  decision: SettlementDecision,
): Promise<PublicationStep> {
  const settled: PublicationRunResult =
    publication.outcome === 'withheld'
      ? { ...publication, next: decision.decision }
      : publication;
  const record = settleSeasonRecord({
    record: current.record,
    previous: input.previous,
    decision,
    now: input.clock(),
    advancesSchedule: input.plan.advancesSchedule,
  });
  if (JSON.stringify(record) !== JSON.stringify(current.record)) {
    const outcome = await input.runtime.ledger.commit({
      lease: input.lease,
      seasonRecord: { expectedVersion: current.version, record },
      classifications: [],
      backlogInsertions: [],
      backlogRemovals: [],
    });
    if (outcome.outcome !== 'committed') {
      return ledgerFailure('outcome', outcome, settled);
    }
  }
  return { kind: 'settled', publication: settled };
}

/** The release the authority serves, or `null` when it cannot confirm one. */
async function servingVersion(
  sequencer: SeasonPublicationSequencerPort,
  season: number,
): Promise<string | null> {
  try {
    const authority = await sequencer.readAuthority(season);
    return authority.cutoverState === 'active' && authority.authoritative
      ? authority.activeVersion
      : null;
  } catch {
    return null;
  }
}

/**
 * The label the generated set carries. It names nothing durable: the
 * sequencer allocates the committed version in `prepare`.
 */
function releaseLabel(at: Date): string {
  return `${at.toISOString().replace(/[-:.TZ]/g, '')}-coordinated`;
}

function failure(
  stage: PublicationStage,
  reason: PublicationStepFailure,
  ledgerRejection: LedgerRejectionReason | null,
  publication: PublicationRunResult | null,
): PublicationStep {
  return {
    kind: 'failed',
    stage,
    failure: reason,
    ledgerRejection,
    publication,
  };
}

function ledgerFailure(
  stage: PublicationStage,
  outcome:
    | { readonly outcome: 'rejected'; readonly reason: LedgerRejectionReason }
    | { readonly outcome: 'unavailable' }
    | { readonly outcome: 'uncertain' },
  publication: PublicationRunResult | null,
): PublicationStep {
  switch (outcome.outcome) {
    case 'rejected':
      return failure(stage, 'ledger-rejected', outcome.reason, publication);
    case 'unavailable':
      return failure(stage, 'ledger-unavailable', null, publication);
    case 'uncertain':
      return failure(stage, 'ledger-uncertain', null, publication);
  }
}
