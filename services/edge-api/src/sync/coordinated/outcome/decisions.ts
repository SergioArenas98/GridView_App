/**
 * What a publication run's end means for the season's durable publication
 * state (decision pack §6.6 step 9). Pure: the instant, the records and the
 * outcome are inputs.
 *
 * A scheduled publication run's observation commit clears `publicationDueAt`
 * (C2 step 5). Every way the run can end therefore makes one explicit
 * decision about when publication is next due:
 *
 * | Decision | `publicationDueAt` | Disposition |
 * |---|---|---|
 * | `completed` (applied, or genuinely unchanged) | unchanged | cleared |
 * | `retry` (a transient failure, a cancellation, an exhausted run budget) | now + 1 h | cleared, but an earlier block is kept |
 * | `cadence` (only a later cadence check can change it) | that check, at least now + 1 h | cleared, but an earlier block is kept |
 * | `blocked` (operator action needed) | cleared | `blocked` with the reason |
 * | `durably-blocked` (an hourly loop otherwise; OD-5) | cleared | an earlier block is kept; `durableBlock` set |
 * | `stopped` (a hold or durable block was in force) | cleared | an earlier block is kept |
 * | `resolve` (the commit is unknown) | unchanged | `publishing` kept |
 *
 * A manual run never moves a due time (O-8): its `retry`, `cadence`,
 * `durably-blocked` and `stopped` decisions leave `publicationDueAt` as it
 * was. It still records a block, a durable block, a completion and an unknown
 * commit.
 *
 * No decision touches `operatorHold`, and none clears `durableBlock`: only an
 * operator action does (the store refuses anything else).
 *
 * `publishedRevision` is never written here: only reconciliation from the
 * authority writes it. An applied release reaches it at the next run.
 */

import type {
  PublicationReason,
  PublicationResult,
} from '../../../publication/publisher';
import type {
  ClassificationRecord,
  DurableBlockReason,
  LedgerInstant,
  PublicationBlockReason,
  RevisionHash,
  SeasonRecord,
} from '../ledger/model';
import {
  roundWithholdReason,
  type CheckOutcome,
  type PlannedCheck,
  type PublicationStop,
  type WithholdReason,
} from '../policy';

const HOUR_MS = 60 * 60 * 1000;

/** The retry interval of a transient failure: the eventual hourly tick (O-7). */
export const PUBLICATION_RETRY_MS = HOUR_MS;

export const nextDueDecisions = [
  'completed',
  'retry',
  'cadence',
  'blocked',
  'durably-blocked',
  'stopped',
  'resolve',
] as const;
export type NextDueDecision = (typeof nextDueDecisions)[number];

export type SettlementDecision =
  | {
      readonly decision: 'completed';
      /** The release now serving the digest: published, or confirmed. */
      readonly release: {
        readonly digest: RevisionHash;
        readonly activeVersion: string;
        readonly published: boolean;
      };
    }
  | { readonly decision: 'retry' }
  | {
      readonly decision: 'cadence';
      /** The selected rounds' records, for their next cadence check. */
      readonly records: readonly ClassificationRecord[];
    }
  | { readonly decision: 'blocked'; readonly reason: PublicationBlockReason }
  | {
      /** Recorded as `durableBlock`: only an operator clears it (OD-5). */
      readonly decision: 'durably-blocked';
      readonly reason: DurableBlockReason;
    }
  | {
      /** A hold or durable block was in force: nothing was prepared. */
      readonly decision: 'stopped';
    }
  | { readonly decision: 'resolve' };

/** Assembly gaps, as the bridge reports them. */
export type CandidateGap =
  | 'run-not-completed'
  | 'resource-unavailable'
  | 'missing-required-resource'
  | 'missing-round-classification'
  | 'standings-round-incoherent'
  | 'inconsistent-references'
  | 'generation-failed';

/**
 * Why a candidate never reached the guarded publisher. Closed.
 *
 * `run-budget-exhausted` is the run budget's intent gate (RB-5): too late in
 * the run, or too little lease left, to commit to publication. It is
 * retried, and recorded nowhere but the run's answer and log line.
 */
export type WithheldCause =
  | 'cancelled'
  | 'run-budget-exhausted'
  | 'metadata-unavailable'
  | PublicationStop
  | DurableBlockReason
  | WithholdReason
  | CandidateGap;

/** Withholding reasons only a later cadence check can resolve. */
const cadenceResolved: ReadonlySet<WithholdReason> = new Set([
  'classification-pending',
  'classification-unaccepted',
  'classification-superseded',
]);

export interface DurableBlockInput {
  readonly checks: readonly PlannedCheck[];
  /** The records as the observation commit left them, by round. */
  readonly records: ReadonlyMap<number, ClassificationRecord>;
  readonly outcomes: ReadonlyMap<number, CheckOutcome>;
  /** Whether this run raised `classification.backlog-capacity-exceeded`. */
  readonly capacityExceeded: boolean;
}

/**
 * The OD-5 conditions that would otherwise withhold the season on an hourly
 * timer for as long as they last, or `null`:
 *
 * - a correction the full backlog could not take, which stays pending on a
 *   settled record whose next sighting would stage it;
 * - a settled round whose reread returned a revision the ledger superseded.
 *   A settled record has no cadence check left, so only the hourly floor
 *   would ever ask again, and D2.2 keeps the revision rejected (OD-6).
 *
 * An unsettled round serving a superseded revision is not one: its own
 * cadence checks are bounded and end at settlement.
 */
export function durableBlockReason(
  input: DurableBlockInput,
): DurableBlockReason | null {
  if (input.capacityExceeded) return 'backlog-capacity-exceeded';
  for (const { round } of input.checks) {
    const record = input.records.get(round);
    if (
      record?.reviewState === 'settled' &&
      roundWithholdReason(record, input.outcomes.get(round)) ===
        'classification-superseded'
    ) {
      return 'classification-superseded';
    }
  }
  return null;
}

/**
 * The decision for a candidate withheld by the publishability policy.
 *
 * A condition that would loop hourly stops the season durably (OD-5). A
 * staged or review-locked record needs an operator (O-5(a)); anything only
 * a cadence check can settle waits for that check rather than an hourly
 * retry; everything else is a transient provider state, retried.
 */
export function withheldByPolicy(
  reasons: readonly WithholdReason[],
  records: readonly ClassificationRecord[],
  durable: DurableBlockReason | null = null,
): SettlementDecision {
  if (durable !== null) return { decision: 'durably-blocked', reason: durable };
  if (reasons.includes('classification-staged')) {
    return { decision: 'blocked', reason: 'classification-staged' };
  }
  if (reasons.includes('classification-review-locked')) {
    return { decision: 'blocked', reason: 'classification-review-locked' };
  }
  if (reasons.every((reason) => cadenceResolved.has(reason))) {
    return { decision: 'cadence', records };
  }
  return { decision: 'retry' };
}

/** The decision for a candidate the bridge could not assemble or generate. */
export function withheldCandidate(gap: CandidateGap): SettlementDecision {
  switch (gap) {
    case 'inconsistent-references':
    case 'generation-failed':
      return { decision: 'blocked', reason: gap };
    case 'run-not-completed':
    case 'resource-unavailable':
    case 'missing-required-resource':
    case 'missing-round-classification':
    case 'standings-round-incoherent':
      return { decision: 'retry' };
  }
}

/** Refusals retrying cannot change: the guard, the season, the candidate. */
const blockingReasons: Readonly<
  Partial<Record<PublicationReason, PublicationBlockReason>>
> = {
  'guard-round-coverage-regression': 'guard-round-coverage-regression',
  'guard-participation-fact-removed': 'guard-participation-fact-removed',
  'guard-constructor-replaced': 'guard-constructor-replaced',
  'guard-candidate-invalid': 'guard-candidate-invalid',
  'guard-predecessor-invalid': 'guard-predecessor-invalid',
  'guard-authority-not-sequenced': 'guard-authority-not-sequenced',
  'contract-validation': 'contract-validation',
};

/**
 * The decision for what the guarded publisher answered, other than a commit.
 *
 * `sequencer-authority-unavailable` covers a `finalize` whose answer was lost
 * and never confirmed, so whether the release committed is unknown: the
 * reservation is kept and the next run resolves it against the authority.
 * Every other failure is transient - a stale or unreadable predecessor, a
 * busy or superseded sequencer, a storage failure, a strictly older ordering
 * input - and is retried.
 */
export function notApplied(result: PublicationResult): SettlementDecision {
  if (result.reason === 'sequencer-authority-unavailable') {
    return { decision: 'resolve' };
  }
  const blocked =
    result.reason === null ? undefined : blockingReasons[result.reason];
  return blocked === undefined
    ? { decision: 'retry' }
    : { decision: 'blocked', reason: blocked };
}

function plus(at: Date, millis: number): LedgerInstant {
  return new Date(at.getTime() + millis).toISOString();
}

/** The earliest next cadence check among `records`, never sooner than a retry. */
function nextCadenceCheck(
  records: readonly ClassificationRecord[],
  now: Date,
): LedgerInstant {
  const floor = now.getTime() + PUBLICATION_RETRY_MS;
  const next = records
    .map((record) => record.nextDueAt)
    .filter((dueAt): dueAt is string => dueAt !== null)
    .map((dueAt) => Date.parse(dueAt))
    .reduce((earliest, at) => Math.min(earliest, at), Number.POSITIVE_INFINITY);
  return new Date(
    Number.isFinite(next) ? Math.max(next, floor) : floor,
  ).toISOString();
}

export interface SettlementInput {
  /** The season record as the run last committed it. */
  readonly record: SeasonRecord;
  /** The disposition the season carried before this run began. */
  readonly previous: SeasonRecord['publicationDisposition'];
  readonly decision: SettlementDecision;
  readonly now: Date;
  readonly advancesSchedule: boolean;
}

/**
 * A block the run did not resolve. A retry or a cadence wait says nothing
 * about the held reason - the run never reached a decision on it - so it never
 * clears a block: a manual run moves no due time (O-8), and clearing the block
 * there would leave the season with neither a due time nor an operator hold.
 * Only a completion, or a new block, replaces it.
 */
function unresolvedBlock(
  previous: SeasonRecord['publicationDisposition'],
): SeasonRecord['publicationDisposition'] {
  return previous?.state === 'blocked' ? previous : null;
}

/** The season record the outcome commit writes. */
export function settleSeasonRecord(input: SettlementInput): SeasonRecord {
  const { record, decision, now, advancesSchedule } = input;
  const at = now.toISOString();
  switch (decision.decision) {
    case 'completed': {
      const { release } = decision;
      return {
        ...record,
        publicationDisposition: null,
        lastPublication: {
          digest: release.digest,
          activeVersion: release.activeVersion,
          publishedAt:
            release.published || record.lastPublication === null
              ? at
              : record.lastPublication.publishedAt,
          confirmedAt: at,
        },
      };
    }
    case 'retry':
      return {
        ...record,
        publicationDisposition: unresolvedBlock(input.previous),
        publicationDueAt: advancesSchedule
          ? plus(now, PUBLICATION_RETRY_MS)
          : record.publicationDueAt,
      };
    case 'cadence':
      return {
        ...record,
        publicationDisposition: unresolvedBlock(input.previous),
        publicationDueAt: advancesSchedule
          ? nextCadenceCheck(decision.records, now)
          : record.publicationDueAt,
      };
    case 'blocked': {
      // A block that persists keeps the instant it began.
      const previous = input.previous;
      const since =
        previous?.state === 'blocked' && previous.reason === decision.reason
          ? previous.since
          : at;
      return {
        ...record,
        publicationDisposition: {
          state: 'blocked',
          since,
          reason: decision.reason,
        },
        publicationDueAt: advancesSchedule ? null : record.publicationDueAt,
      };
    }
    case 'durably-blocked':
      return {
        ...record,
        publicationDisposition: unresolvedBlock(input.previous),
        durableBlock: { since: at, reason: decision.reason },
        publicationDueAt: advancesSchedule ? null : record.publicationDueAt,
      };
    case 'stopped':
      // The stop itself is left exactly as it is; only an operator ends it.
      return {
        ...record,
        publicationDisposition: unresolvedBlock(input.previous),
        publicationDueAt: advancesSchedule ? null : record.publicationDueAt,
      };
    case 'resolve':
      return record;
  }
}
