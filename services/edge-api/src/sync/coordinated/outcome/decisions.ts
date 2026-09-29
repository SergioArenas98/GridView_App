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
 * | `retry` (a transient failure, a cancellation) | now + 1 h | cleared |
 * | `cadence` (only a later cadence check can change it) | that check, at least now + 1 h | cleared |
 * | `blocked` (operator action needed) | cleared | `blocked` with the reason |
 * | `resolve` (the commit is unknown) | unchanged | `publishing` kept |
 *
 * A manual run never moves a due time (O-8): its `retry` and `cadence`
 * decisions leave `publicationDueAt` as it was. It still records a block, a
 * completion and an unknown commit.
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
  LedgerInstant,
  PublicationBlockReason,
  RevisionHash,
  SeasonRecord,
} from '../ledger/model';
import type { WithholdReason } from '../policy';

const HOUR_MS = 60 * 60 * 1000;

/** The retry interval of a transient failure: the eventual hourly tick (O-7). */
export const PUBLICATION_RETRY_MS = HOUR_MS;

export const nextDueDecisions = [
  'completed',
  'retry',
  'cadence',
  'blocked',
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

/** Why a candidate never reached the guarded publisher. Closed. */
export type WithheldCause =
  'cancelled' | 'metadata-unavailable' | WithholdReason | CandidateGap;

/** Withholding reasons only a later cadence check can resolve. */
const cadenceResolved: ReadonlySet<WithholdReason> = new Set([
  'classification-pending',
  'classification-unaccepted',
  'classification-superseded',
]);

/**
 * The decision for a candidate withheld by the publishability policy.
 *
 * A staged or review-locked record needs an operator (O-5(a)); anything only
 * a cadence check can settle waits for that check rather than an hourly
 * retry; everything else is a transient provider state, retried.
 */
export function withheldByPolicy(
  reasons: readonly WithholdReason[],
  records: readonly ClassificationRecord[],
): SettlementDecision {
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
        publicationDisposition: null,
        publicationDueAt: advancesSchedule
          ? plus(now, PUBLICATION_RETRY_MS)
          : record.publicationDueAt,
      };
    case 'cadence':
      return {
        ...record,
        publicationDisposition: null,
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
    case 'resolve':
      return record;
  }
}
