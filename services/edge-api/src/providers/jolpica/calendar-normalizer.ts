/**
 * Turns decoded Jolpica race rows into the normalized public calendar.
 *
 * This is the **identity boundary**. Every GridView identifier emitted here
 * comes from the curated mapping registry and the curated registries behind
 * it; none is derived, minted, folded, trimmed or guessed from a provider
 * value (ADR 0022 D2, D4, D5, amendment A1). An unresolved event or circuit
 * fails the **whole** calendar: a calendar missing one event is not a smaller
 * correct calendar, and a row silently dropped is the failure mode curated
 * mappings exist to prevent.
 *
 * It is also where the accepted calendar semantics are applied, and they are
 * deliberately conservative:
 *
 * - every `GrandPrix.status` and `Session.status` is `unknown` (A6);
 * - `hasResults` is a provisional `false` that assembly later owns (A7);
 * - no timestamp is manufactured and the clock is never read (A8).
 */

import type { GrandPrix, Session } from '../../contract/types';
import type { SessionType, WeekendFormat } from '../../contract/enums';
import {
  canonicalGrandPrixId,
  canonicalSessionId,
} from '../../contract/identity';
import type {
  ProviderMappingFailure,
  ProviderMappingRegistry,
} from '../mappings';
import type { DecodedRace, JolpicaSessionBlock } from './calendar-payload';
import type { CuratedEventNames } from './curated-events';

/**
 * The session type each documented Jolpica block contributes.
 *
 * A total map over the block vocabulary, so a block this adapter recognizes
 * can never reach the contract without a declared type.
 */
const blockSessionTypes: Record<JolpicaSessionBlock, SessionType> = {
  FirstPractice: 'practice_1',
  SecondPractice: 'practice_2',
  ThirdPractice: 'practice_3',
  SprintQualifying: 'sprint_qualifying',
  Sprint: 'sprint',
  Qualifying: 'qualifying',
};

export type CalendarNormalization =
  | { readonly ok: true; readonly events: readonly GrandPrix[] }
  | {
      readonly ok: false;
      readonly failures: readonly ProviderMappingFailure[];
    };

/**
 * Upper bound on the mapping failures reported from one calendar.
 *
 * A whole unmapped season would otherwise produce one log line per event. The
 * first few identify the problem; the rest only repeat it.
 */
export const maxReportedMappingFailures = 5;

/**
 * The blocks that exist only on a sprint weekend.
 *
 * **Either one is evidence, independently.** They are separately optional
 * upstream, so a cancelled sprint or a partially finalized schedule can carry
 * sprint qualifying without a sprint, and a weekend is no less a sprint
 * weekend for it. Keying the format on `Sprint` alone would drop the sprint
 * designation from exactly those payloads. The sprint-qualifying block is
 * already normalized to one member here, so the `SprintShootout` spelling is
 * covered without naming it again.
 */
const sprintEvidenceBlocks: ReadonlySet<JolpicaSessionBlock> = new Set([
  'Sprint',
  'SprintQualifying',
]);

/**
 * The weekend format, read from the row's own composition.
 *
 * A sprint-specific block is **positive provider evidence** of a sprint
 * weekend. Its absence is not positive evidence of a standard one: a calendar
 * published before a sprint round's detail firms up simply omits the blocks,
 * and calling that `standard` would be a confident wrong answer of exactly the
 * kind D4 and D5 forbid. So the honest third member of the existing enum is
 * used instead, and nothing downstream is told more than Jolpica actually
 * said.
 *
 * No accepted decision assigns `GrandPrix.format` for a Jolpica calendar; this
 * is an adapter normalization choice made on A6's reasoning, not a new
 * architecture decision.
 */
function weekendFormat(race: DecodedRace): WeekendFormat {
  return race.sessions.some((session) =>
    sprintEvidenceBlocks.has(session.block),
  )
    ? 'sprint'
    : 'unknown';
}

/**
 * Every session of one weekend, **ordered by its own start instant**.
 *
 * `sessions` is an ordered list in the canonical snapshot schema and the
 * client renders it in the delivered order, never re-sorting it
 * (`home_session_focus.dart`). The product contract is chronological display
 * (`GridView_PRD.md` §Grand Prix acceptance criteria) and explicit support for
 * **changed session orders**, rendering "the sessions supplied by the data
 * model rather than assuming a fixed sequence"
 * (`GridView_App_Flow.md` §7.4). Ordering therefore belongs to whoever
 * supplies the list, which is this adapter.
 *
 * Emitting the blocks in their usual weekend sequence would be exactly the
 * fixed-sequence assumption §7.4 forbids: a rescheduled weekend - qualifying
 * moved before sprint qualifying, say - is a payload Jolpica can legitimately
 * publish, and it would be delivered, and displayed, in the wrong order.
 *
 * Two details make this total and deterministic:
 *
 * - **Every instant exists.** A present block without a complete instant
 *   already failed the resource, and the race's instant is required (A8), so
 *   there is no missing value to position.
 * - **Comparison is lexicographic, not chronological arithmetic.** Every
 *   instant is the same fixed-width `YYYY-MM-DDTHH:MM:SSZ` UTC form, for which
 *   byte order and time order coincide, so no parsing, zone maths or
 *   `Date` round trip can go wrong here. `sort` is stable, so two sessions
 *   sharing an instant keep their block order and the canonical serialization
 *   stays deterministic.
 */
function sessionsFor(race: DecodedRace, grandPrixId: string): Session[] {
  const scheduled = [
    ...race.sessions.map((decoded) => ({
      type: blockSessionTypes[decoded.block],
      startTime: decoded.startTime,
    })),
    { type: 'race' as SessionType, startTime: race.startTime },
  ];
  return scheduled
    .sort((left, right) => {
      // A comparator that never answers 0 makes equal elements compare
      // inconsistently, which would defeat the stability the deterministic
      // ordering above relies on.
      if (left.startTime === right.startTime) return 0;
      return left.startTime < right.startTime ? -1 : 1;
    })
    .map((entry) =>
      normalizedSession(grandPrixId, entry.type, entry.startTime),
    );
}

function normalizedSession(
  grandPrixId: string,
  type: SessionType,
  startTime: string,
): Session {
  return {
    id: canonicalSessionId(grandPrixId, type),
    type,
    // Jolpica publishes no session label, and inventing one would put adapter
    // prose in a public field. `endTime` is likewise never published.
    name: null,
    startTime,
    endTime: null,
    status: 'unknown',
  };
}

/**
 * Resolves and normalizes one complete calendar.
 *
 * Both identities are resolved **independently**: an event mapping never
 * implies a circuit, so each is its own curated lookup (amendment A3). Every
 * row is attempted even after the first failure, so an operator sees the
 * bounded set of identities to curate rather than one at a time - but no
 * partial payload is ever produced.
 */
export function normalizeSeasonCalendar(
  races: readonly DecodedRace[],
  season: number,
  registry: ProviderMappingRegistry,
  eventNames: CuratedEventNames,
): CalendarNormalization {
  const events: GrandPrix[] = [];
  const failures: ProviderMappingFailure[] = [];

  for (const race of races) {
    const event = registry.resolve({
      season,
      source: 'jolpica',
      entity: 'event',
      providerField: 'eventLocator',
      // The locator carries no season of its own: the season above is the
      // key's qualifier, supplied by the requested season (A2).
      providerValue: {
        round: race.round,
        raceName: race.raceName,
        circuitId: race.circuitId,
      },
    });
    const circuit = registry.resolve({
      season,
      source: 'jolpica',
      entity: 'circuit',
      providerField: 'circuitId',
      providerValue: race.circuitId,
    });

    if (event.outcome === 'unresolved') addFailure(failures, event.failure);
    if (circuit.outcome === 'unresolved') addFailure(failures, circuit.failure);
    if (event.outcome === 'unresolved' || circuit.outcome === 'unresolved') {
      continue;
    }

    const eventSlug = event.gridviewId;
    const id = canonicalGrandPrixId(season, eventSlug);
    events.push({
      id,
      season,
      round: race.round,
      eventSlug,
      // The curated registry owns the display name; the provider's `raceName`
      // is a locator component and never public content.
      name: eventNames.get(eventSlug) ?? eventSlug,
      officialName: null,
      circuitId: circuit.gridviewId,
      status: 'unknown',
      format: weekendFormat(race),
      // Jolpica publishes no weekend span or venue timezone on this endpoint,
      // and deriving one from the race date would be manufacturing it.
      startDate: null,
      endDate: null,
      timezone: null,
      sessions: sessionsFor(race, id),
      // Provisional and evidence in neither direction. Season assembly owns
      // the final value (A7); this slice does not implement that derivation.
      hasResults: false,
      media: null,
    });
  }

  if (failures.length > 0) return { ok: false, failures };
  return { ok: true, events };
}

function addFailure(
  failures: ProviderMappingFailure[],
  failure: ProviderMappingFailure,
): void {
  if (failures.length < maxReportedMappingFailures) failures.push(failure);
}
