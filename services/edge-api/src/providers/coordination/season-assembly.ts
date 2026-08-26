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
import type { ProviderSeasonSource } from '../formula-one-provider';
import type { CoordinationRun, ResourceCoordination } from './outcome';
import {
  classifiedSessionTypes,
  type ClassifiedSessionType,
  type CoordinatedPayload,
  type CoordinatedPayloadFor,
  type CoordinatedResource,
  type CoordinatedResourceKind,
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
] as const;

export type AssemblyGap = (typeof assemblyGaps)[number];

export type SeasonAssembly =
  | { readonly complete: true; readonly source: ProviderSeasonSource }
  | {
      readonly complete: false;
      readonly gap: AssemblyGap;
      /** The exact identities that are missing. Bounded enum members and integers. */
      readonly missing: readonly CoordinatedResource[];
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

const sessionOrder = new Map<ClassifiedSessionType, number>(
  classifiedSessionTypes.map((type, index) => [type, index]),
);

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
    return { complete: false, gap: 'run-not-completed', missing: [] };
  }

  const unavailable = run.resources
    .filter((resource) => resource.selection.outcome !== 'selected')
    .map((resource) => resource.resource);
  if (unavailable.length > 0) {
    return {
      complete: false,
      gap: 'resource-unavailable',
      missing: unavailable,
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
    return { complete: false, gap: 'missing-required-resource', missing: [] };
  }

  const schedules = new Map<number, readonly Session[]>();
  for (const entry of selectedPayloads(run, 'event-schedule')) {
    if (entry.payload.kind !== 'event-schedule') continue;
    schedules.set(entry.payload.round, entry.payload.sessions);
  }

  const classifications: RaceResult[] = [];
  const racesByRound = new Set<number>();
  for (const entry of selectedPayloads(run, 'session-classification')) {
    if (entry.payload.kind !== 'session-classification') continue;
    classifications.push(entry.payload.result);
    if (entry.payload.result.sessionType === 'race') {
      racesByRound.add(entry.payload.result.round);
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
    .filter((event) => !racesByRound.has(event.round))
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
    };
  }

  const results = classifications.slice().sort((left, right) => {
    if (left.round !== right.round) return left.round - right.round;
    return (
      (sessionOrder.get(left.sessionType as ClassifiedSessionType) ?? 0) -
      (sessionOrder.get(right.sessionType as ClassifiedSessionType) ?? 0)
    );
  });

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
  return { complete: true, source };
}
