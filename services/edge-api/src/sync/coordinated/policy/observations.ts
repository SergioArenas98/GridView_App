/**
 * One run's observations, turned into one conditional ledger commit
 * (decision pack §6.6 step 5) and the publishability decision (step 6).
 *
 * Pure: the caller supplies the lease, the snapshot it read under that lease,
 * the plan, what each planned request produced and the instant. The answer is
 * a `LedgerCommitRequest` for the C1 store, the closed events, and - for a
 * publication run - whether its candidate may be published. Nothing is sent,
 * committed or published here; the orchestration that would do so is a later,
 * separately authorized change.
 *
 * Rounds are processed in ascending order, so when the global operator backlog
 * has room for fewer corrections than a run stages, the earliest rounds take
 * it, deterministically. The store re-checks the capacity in its own
 * transaction.
 */

import type {
  BacklogReference,
  ClassificationRecord,
  ConditionalWrite,
  LeaseToken,
  LedgerCommitRequest,
  LedgerSnapshot,
} from '../ledger/model';
import {
  applyClassificationCheck,
  newClassificationRecord,
  type CheckOutcome,
  type ClassificationCheck,
} from './classification';
import type { PolicyEvent } from './events';
import type { PlannedCheck, RunPlan } from './planner';
import { decidePublication, type PublicationDecision } from './publishability';
import { applySeasonObservations, type SeasonOutcomes } from './refresh';

export interface RunObservationInput {
  readonly lease: LeaseToken;
  readonly snapshot: LedgerSnapshot;
  readonly plan: Exclude<RunPlan, { readonly kind: 'nothing-due' }>;
  readonly now: Date;
  readonly seasonOutcomes: SeasonOutcomes;
  /** By round. A planned round with no entry was not attempted. */
  readonly classificationOutcomes: ReadonlyMap<number, CheckOutcome>;
}

export interface RunObservationResult {
  readonly request: LedgerCommitRequest;
  readonly events: readonly PolicyEvent[];
  readonly decision: PublicationDecision;
}

const notAttempted: CheckOutcome = { status: 'not-attempted' };

function checkOf(planned: PlannedCheck): ClassificationCheck {
  return planned.check === 'cadence'
    ? { kind: 'cadence', slot: planned.slot }
    : { kind: planned.check };
}

/** Only records that actually change are written. */
function changed(
  before: ClassificationRecord | null,
  after: ClassificationRecord,
): boolean {
  return before === null
    ? after.lastAttemptedAt !== null || after.limiterDeferralUntil !== null
    : JSON.stringify(before) !== JSON.stringify(after);
}

export function recordRunObservations(
  input: RunObservationInput,
): RunObservationResult {
  const { plan, snapshot, now } = input;
  const events: PolicyEvent[] = [];

  const season = applySeasonObservations(
    snapshot.seasonRecord?.record ?? null,
    {
      season: snapshot.season,
      outcomes: input.seasonOutcomes,
      now,
      runKind: plan.kind,
      advancesSchedule: plan.advancesSchedule,
    },
  );
  events.push(...season.events);

  const stored = new Map(
    snapshot.classifications.map((entry) => [entry.record.round, entry]),
  );
  const writes: ConditionalWrite<ClassificationRecord>[] = [];
  const insertions: BacklogReference[] = [];
  const after = new Map<number, ClassificationRecord>();
  let backlogRoom = snapshot.backlog.capacity - snapshot.backlog.count;

  const checks = plan.kind === 'publication' ? plan.checks : [];
  for (const planned of [...checks].sort((l, r) => l.round - r.round)) {
    const current = stored.get(planned.round) ?? null;
    const record =
      current?.record ??
      newClassificationRecord(snapshot.season, planned.anchor);
    const step = applyClassificationCheck(record, {
      check: checkOf(planned),
      outcome: input.classificationOutcomes.get(planned.round) ?? notAttempted,
      now,
      backlogAvailable: backlogRoom > 0,
    });
    events.push(...step.events);
    after.set(planned.round, step.record);
    if (step.backlogInsertion !== null) {
      backlogRoom -= 1;
      insertions.push({
        round: planned.round,
        revision: step.backlogInsertion,
      });
    }
    if (changed(current?.record ?? null, step.record)) {
      writes.push({
        expectedVersion: current?.version ?? 0,
        record: step.record,
      });
    }
  }

  const seasonChanged =
    JSON.stringify(snapshot.seasonRecord?.record ?? null) !==
    JSON.stringify(season.record);
  return {
    request: {
      lease: input.lease,
      seasonRecord: seasonChanged
        ? {
            expectedVersion: snapshot.seasonRecord?.version ?? 0,
            record: season.record,
          }
        : null,
      classifications: writes,
      backlogInsertions: insertions,
      backlogRemovals: [],
    },
    events,
    decision: decidePublication({
      plan,
      seasonOutcomes: input.seasonOutcomes,
      classificationOutcomes: input.classificationOutcomes,
      records: after,
    }),
  };
}
