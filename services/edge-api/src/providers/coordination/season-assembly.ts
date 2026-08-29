/**
 * Assembles a **complete** season source from a coordination run, or explains
 * precisely why one cannot be assembled.
 *
 * This exists because the existing publication boundary is all-or-nothing: the
 * snapshot generator derives the season, bootstrap, home, calendar, per-event,
 * per-entity and manifest documents from one whole `ProviderSeasonSource`, and
 * the publisher writes the active pointer only after every generated document
 * has been written and validated. That contract is **not weakened here**.
 * Partial coordination is represented explicitly and simply does not publish.
 *
 * **Snapshot metadata is an input, not a derivation.** `sourceUpdatedAt` for
 * the adopted sources is GridView's own observation timestamp bound to a
 * stored snapshot revision (ADR 0020 §1), which requires persisted
 * reconciliation state - gap G9. Deriving it here would implement G9
 * implicitly, so the already-decided values are supplied by the caller exactly
 * as the mock provider supplies them today.
 */

import type {
  Circuit,
  Constructor,
  ConstructorSeasonEntry,
  ConstructorStanding,
  Driver,
  DriverSeasonEntry,
  DriverStanding,
  GrandPrix,
  RaceResult,
  Session,
} from '../../contract/types';
import type { EventStatus } from '../../contract/enums';
import type { ProviderSeasonSource } from '../formula-one-provider';
import type { CoordinationRun, ResourceCoordination } from './outcome';
import {
  isClassifiedResult,
  validateSeasonReferences,
  type SeasonRelation,
} from './season-integrity';
import type {
  CoordinatedPayload,
  CoordinatedPayloadFor,
  CoordinatedResource,
  CoordinatedResourceKind,
} from './resource';

/**
 * The already-decided publication metadata for one season snapshot.
 *
 * None of it is invented by coordination, and none of it is read from a
 * provider response: neither adopted source publishes a version or an update
 * timestamp (GridView_Provider_Evaluation.md §8.6).
 */
export interface SeasonSnapshotMetadata {
  readonly contentVersion: string;
  readonly mediaVersion: string | null;
  readonly attributionVersion: string | null;
  readonly sourceUpdatedAt: string;
  readonly seasonLabel: string | null;
}

/** Why a complete season could not be assembled. Closed and bounded. */
export const assemblyGaps = [
  /** The run was cancelled or its plan was rejected. */
  'run-not-completed',
  /** A planned resource produced no usable candidate. */
  'resource-unavailable',
  /** A resource the season snapshot requires was not planned at all. */
  'missing-required-resource',
  /** A calendar round has no selected race classification. */
  'missing-round-classification',
  /**
   * The selected payloads are individually valid but mutually inconsistent:
   * a reference snapshot generation depends on does not resolve.
   */
  'inconsistent-references',
] as const;

export type AssemblyGap = (typeof assemblyGaps)[number];

export type SeasonAssembly =
  | { readonly complete: true; readonly source: ProviderSeasonSource }
  | {
      readonly complete: false;
      readonly gap: AssemblyGap;
      /** The exact identities that are missing. Bounded enum members and integers. */
      readonly missing: readonly CoordinatedResource[];
      /**
       * For `inconsistent-references`: the relations that did not resolve.
       * Closed enum members only - never an identifier - and empty for every
       * other gap.
       */
      readonly relations: readonly SeasonRelation[];
    };

/**
 * Resources a publishable season snapshot cannot be built without.
 *
 * `event-schedule` is deliberately absent: a selected schedule refines the
 * sessions of its round, but the calendar already carries a complete session
 * list, so a schedule refresh is an improvement rather than a prerequisite.
 * A *planned* schedule that produced no candidate still blocks publication,
 * because the completeness rule below requires every planned resource to have
 * been selected.
 */
const requiredSeasonResources: readonly CoordinatedResourceKind[] = [
  'season-calendar',
  'season-participants',
  'season-circuits',
  'driver-standings',
  'constructor-standings',
];

/**
 * Whether an event's race classification is **required** for a season snapshot
 * to be complete.
 *
 * Only `completed` establishes that a race was run and therefore that a
 * classification must exist. Every other status leaves the result legitimately
 * absent, and the public contract already says so: the Grand Prix results
 * resource "returns the race classification when available", and an
 * unavailable future result must be a meaningful absence rather than a
 * fabricated empty classification (GridView_Backend_Scheme.md §10.5). The
 * generator honours that by emitting a results document only when one exists,
 * so a non-completed round simply has none.
 *
 * | Status        | Race result required |
 * | ------------- | -------------------- |
 * | `scheduled`   | no                   |
 * | `upcoming`    | no                   |
 * | `in_progress` | no                   |
 * | `completed`   | **yes**              |
 * | `postponed`   | no                   |
 * | `cancelled`   | no                   |
 * | `unknown`     | no                   |
 *
 * `in_progress` is excluded because a race under way has no stable
 * classification yet, and `unknown` because it establishes nothing - inventing
 * a requirement from it would block an entire season on a value the contract
 * defines as "not recognised". Both choices fail towards *not fabricating*
 * data, which is the direction the result contract already takes.
 *
 * **This is publication completeness, not scheduling.** It reads one field of
 * data the source supplied. No clock, event offset, session duration, cadence
 * or due-job calculation is involved, and gap G5 remains untouched.
 */
const raceClassificationRequiredByStatus: Record<EventStatus, boolean> = {
  scheduled: false,
  upcoming: false,
  in_progress: false,
  completed: true,
  postponed: false,
  cancelled: false,
  unknown: false,
};

/**
 * A pure, total predicate over the closed status union.
 *
 * Compared with `=== true` rather than used as a truthy lookup: `status` is
 * typed but arrives from an adapter, and an unrecognised value must behave
 * like `unknown` - the additive-safe fallback the enum contract defines - not
 * like a missing entry that could throw or read as required.
 */
export function requiresRaceClassification(status: EventStatus): boolean {
  return raceClassificationRequiredByStatus[status] === true;
}

function payloadOf<K extends CoordinatedResourceKind>(
  run: CoordinationRun,
  kind: K,
): CoordinatedPayloadFor<K> | null {
  for (const resource of run.resources) {
    if (resource.resource.kind !== kind) continue;
    if (resource.selection.outcome !== 'selected') continue;
    return resource.selection.payload as CoordinatedPayloadFor<K>;
  }
  return null;
}

function selectedPayloads(
  run: CoordinationRun,
  kind: CoordinatedResourceKind,
): { resource: ResourceCoordination; payload: CoordinatedPayload }[] {
  const out: { resource: ResourceCoordination; payload: CoordinatedPayload }[] =
    [];
  for (const resource of run.resources) {
    if (resource.resource.kind !== kind) continue;
    if (resource.selection.outcome !== 'selected') continue;
    out.push({ resource, payload: resource.selection.payload });
  }
  return out;
}

/**
 * Assembles the season, or reports the first gap that blocks it.
 *
 * Order matters: a cancelled run is reported as such rather than as an
 * incomplete one, and an unavailable planned resource is reported before a
 * missing required resource, because "we asked and got nothing" and "we never
 * asked" are different operator problems.
 */
export function assembleSeasonSource(
  run: CoordinationRun,
  metadata: SeasonSnapshotMetadata,
): SeasonAssembly {
  if (run.status !== 'completed') {
    return {
      complete: false,
      gap: 'run-not-completed',
      missing: [],
      relations: [],
    };
  }

  const unavailable = run.resources
    .filter((resource) => resource.selection.outcome !== 'selected')
    .map((resource) => resource.resource);
  if (unavailable.length > 0) {
    return {
      complete: false,
      gap: 'resource-unavailable',
      missing: unavailable,
      relations: [],
    };
  }

  const missingRequired = requiredSeasonResources
    .filter((kind) => payloadOf(run, kind) === null)
    .map((kind) => ({ kind, season: run.season }) as CoordinatedResource);
  if (missingRequired.length > 0) {
    return {
      complete: false,
      gap: 'missing-required-resource',
      missing: missingRequired,
      relations: [],
    };
  }

  const calendarPayload = payloadOf(run, 'season-calendar');
  const participants = payloadOf(run, 'season-participants');
  const circuitsPayload = payloadOf(run, 'season-circuits');
  const driverStandingsPayload = payloadOf(run, 'driver-standings');
  const constructorStandingsPayload = payloadOf(run, 'constructor-standings');
  if (
    calendarPayload === null ||
    participants === null ||
    circuitsPayload === null ||
    driverStandingsPayload === null ||
    constructorStandingsPayload === null
  ) {
    // Unreachable after the check above; retained so the narrowing below is
    // proven rather than asserted.
    return {
      complete: false,
      gap: 'missing-required-resource',
      missing: [],
      relations: [],
    };
  }

  const schedules = new Map<number, readonly Session[]>();
  for (const entry of selectedPayloads(run, 'event-schedule')) {
    if (entry.payload.kind !== 'event-schedule') continue;
    schedules.set(entry.payload.round, entry.payload.sessions);
  }

  // **Only the race classification is publishable.** The public resource
  // `/v1/seasons/{season}/grand-prix/{round}/results` is defined as the race
  // classification, and the generator picks its document with a lookup by
  // round alone - so any non-race classification sitting in this collection
  // could be published in the race's place. A qualifying or sprint
  // classification is a perfectly valid *coordination* result and remains
  // visible in the run; this phase simply has no public document to carry it,
  // and inventing one would widen the v1 contract.
  // Two different things, deliberately kept apart:
  //
  // - `classifications` is the set of selected race-result *resources*. A
  //   round that has not been classified still has one, because the contract
  //   requires a not-yet-run session to answer with a meaningful absence
  //   (`status: 'unavailable'`, no entries) rather than a fabricated empty
  //   classification. Dropping it would remove that answer from the release.
  // - `classifiedRounds` is the set of rounds that actually *have* a
  //   classification. Only `final` and `provisional` qualify, so the presence
  //   of a document proves nothing here.
  //
  // Completeness for a completed round is proved against the second set. The
  // first is what gets published.
  const classifications: RaceResult[] = [];
  const classifiedRounds = new Set<number>();
  for (const entry of selectedPayloads(run, 'session-classification')) {
    if (entry.payload.kind !== 'session-classification') continue;
    if (entry.payload.result.sessionType !== 'race') continue;
    classifications.push(entry.payload.result);
    if (isClassifiedResult(entry.payload.result.status)) {
      classifiedRounds.add(entry.payload.result.round);
    }
  }

  const calendar: GrandPrix[] = [...calendarPayload.events]
    .map((event) => {
      const sessions = schedules.get(event.round);
      // A refreshed schedule replaces the event's sessions wholesale, never
      // field by field: a merged session list could leave an event internally
      // inconsistent (GridView_Provider_Evaluation.md §10.9 rule 3).
      return sessions === undefined
        ? { ...event, sessions: [...event.sessions] }
        : { ...event, sessions: [...sessions] };
    })
    .sort((left, right) => left.round - right.round);

  const missingClassifications = calendar
    .filter(
      (event) =>
        requiresRaceClassification(event.status) &&
        !classifiedRounds.has(event.round),
    )
    .map(
      (event) =>
        ({
          kind: 'session-classification',
          season: run.season,
          round: event.round,
          sessionType: 'race',
        }) as CoordinatedResource,
    );
  if (missingClassifications.length > 0) {
    return {
      complete: false,
      gap: 'missing-round-classification',
      missing: missingClassifications,
      relations: [],
    };
  }

  // Every member is a race classification for a distinct round, so round
  // order is a total order and no session tiebreak is reachable.
  const results = classifications
    .slice()
    .sort((left, right) => left.round - right.round);

  const source: ProviderSeasonSource = {
    season: run.season,
    contentVersion: metadata.contentVersion,
    mediaVersion: metadata.mediaVersion,
    attributionVersion: metadata.attributionVersion,
    sourceUpdatedAt: metadata.sourceUpdatedAt,
    seasonLabel: metadata.seasonLabel,
    calendar,
    results,
    drivers: [...participants.drivers] as Driver[],
    constructors: [...participants.constructors] as Constructor[],
    circuits: [...circuitsPayload.circuits] as Circuit[],
    driverEntries: [...participants.driverEntries] as DriverSeasonEntry[],
    constructorEntries: [
      ...participants.constructorEntries,
    ] as ConstructorSeasonEntry[],
    driverStandings: [...driverStandingsPayload.standings] as DriverStanding[],
    constructorStandings: [
      ...constructorStandingsPayload.standings,
    ] as ConstructorStanding[],
  };
  // The last gate: individually valid payloads must also agree with each
  // other. Generation assumes these references resolve - some by throwing,
  // some by publishing a dangling identifier - so they are settled here, while
  // nothing has been generated and nothing has been written.
  const relations = validateSeasonReferences(source);
  if (relations.length > 0) {
    return {
      complete: false,
      gap: 'inconsistent-references',
      missing: [],
      relations,
    };
  }

  return { complete: true, source };
}
