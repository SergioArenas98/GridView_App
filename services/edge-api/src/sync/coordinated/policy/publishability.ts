/**
 * Whether a publication run's candidate may be published (runtime activation
 * decision O-5(a); decision pack §6.6 step 6).
 *
 * The decision reads the records **after** the run's observations were applied.
 * A candidate is publishable only when every season-level resource and every
 * selected round was observed, and every selected round carries exactly its
 * accepted revision with nothing pending, staged or locked. Otherwise the
 * **whole season candidate is withheld**. No row of an earlier release is ever
 * substituted, because assembly has no carry-over.
 *
 * Consequence (O-5(a), accepted): a staged correction withholds the season
 * until an operator disposes of it, and no disposition mechanism exists yet.
 * A correction Jolpica keeps serving after it was staged can therefore keep
 * the season frozen until that separate mechanism exists.
 */

import type { ClassificationRecord, RevisionHash } from '../ledger/model';
import type { CheckOutcome } from './classification';
import type { RunPlan } from './planner';
import type { SeasonOutcomes } from './refresh';

export const withholdReasons = [
  'classification-pending',
  'classification-review-locked',
  'classification-staged',
  'classification-superseded',
  'classification-unaccepted',
  'classification-unavailable',
  'not-a-publication-run',
  'season-resource-unavailable',
] as const;
export type WithholdReason = (typeof withholdReasons)[number];

export type PublicationDecision =
  | {
      readonly publishable: true;
      /** The revision the candidate must carry for each selected round. */
      readonly rounds: readonly {
        readonly round: number;
        readonly revision: RevisionHash;
      }[];
    }
  | {
      readonly publishable: false;
      /** Sorted, each at most once: a bounded, closed set safe for logs. */
      readonly reasons: readonly WithholdReason[];
    };

export interface PublicationInput {
  readonly plan: RunPlan;
  readonly seasonOutcomes: SeasonOutcomes;
  readonly classificationOutcomes: ReadonlyMap<number, CheckOutcome>;
  /** The records after this run's observations were applied, by round. */
  readonly records: ReadonlyMap<number, ClassificationRecord>;
}

/** Why one selected round withholds the candidate, or `null` if it does not. */
export function roundWithholdReason(
  record: ClassificationRecord | undefined,
  outcome: CheckOutcome | undefined,
): WithholdReason | null {
  if (outcome?.status !== 'observed' || record === undefined) {
    return 'classification-unavailable';
  }
  if (record.stagedCorrection !== null) return 'classification-staged';
  if (record.competingCorrection !== null) {
    return 'classification-review-locked';
  }
  if (record.candidateRevision !== null) return 'classification-pending';
  if (record.supersededRevisions.includes(outcome.revision)) {
    return 'classification-superseded';
  }
  if (outcome.revision !== record.contentRevision) {
    return 'classification-unaccepted';
  }
  return null;
}

export function decidePublication(
  input: PublicationInput,
): PublicationDecision {
  const { plan } = input;
  if (plan.kind !== 'publication') {
    return { publishable: false, reasons: ['not-a-publication-run'] };
  }
  const reasons = new Set<WithholdReason>();
  for (const resource of plan.refresh) {
    if (input.seasonOutcomes[resource]?.status !== 'observed') {
      reasons.add('season-resource-unavailable');
    }
  }
  const rounds: { round: number; revision: RevisionHash }[] = [];
  for (const { round } of plan.checks) {
    const record = input.records.get(round);
    const reason = roundWithholdReason(
      record,
      input.classificationOutcomes.get(round),
    );
    if (reason === null) {
      rounds.push({ round, revision: record!.contentRevision! });
    } else {
      reasons.add(reason);
    }
  }
  if (reasons.size > 0) {
    return {
      publishable: false,
      reasons: withholdReasons.filter((reason) => reasons.has(reason)),
    };
  }
  return { publishable: true, rounds };
}
