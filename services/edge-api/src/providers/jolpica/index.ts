/**
 * The Jolpica adapter package.
 *
 * **Dormant by design.** Exactly one runtime module outside this directory
 * imports it: the coordinated runtime composition,
 * `src/sync/coordinated/composition.ts`. That module is reachable from the
 * Worker, but it constructs nothing unless `PROVIDER_MODE` is `coordinated`
 * and every coordinated dependency is bound. No committed environment selects
 * that mode, and the reconciliation ledger it requires has no binding, so no
 * port here is constructed in any deployed configuration.
 *
 * It implements exactly six coordinated resources in five ports: the season
 * calendar, the season circuits, the season participants, the race
 * classification, and the driver and constructor standings, which share one
 * port. Each port refuses every other resource before reserving capacity or
 * touching transport. `JolpicaResourcePort` is the single registration a
 * coordinator holds for source `jolpica`, and routes to the five.
 */

export { JolpicaResourcePort } from './resource-port';
export type { JolpicaResourcePorts } from './resource-port';

export { JolpicaCalendarPort, calendarPageLimit } from './calendar-port';
export type { JolpicaCalendarPortOptions } from './calendar-port';

export { decodeSeasonCalendar, jolpicaSessionBlocks } from './calendar-payload';
export type {
  CalendarDecodeProblem,
  CalendarDecodeResult,
  DecodedRace,
  DecodedSession,
  JolpicaSessionBlock,
} from './calendar-payload';

export {
  maxReportedMappingFailures,
  normalizeSeasonCalendar,
} from './calendar-normalizer';
export type { CalendarNormalization } from './calendar-normalizer';

export { curatedEventNames } from './curated-events';
export type { CuratedEventNames } from './curated-events';

export { JolpicaCircuitsPort, circuitsPageLimit } from './circuits-port';
export type { JolpicaCircuitsPortOptions } from './circuits-port';

export { decodeSeasonCircuits } from './circuits-payload';
export type {
  CircuitsDecodeProblem,
  CircuitsDecodeResult,
  DecodedCircuit,
} from './circuits-payload';

export { normalizeSeasonCircuits } from './circuits-normalizer';
export type {
  CircuitsNormalization,
  CircuitsNormalizationProblem,
} from './circuits-normalizer';

export { curatedCircuits, curatedCircuitsFrom } from './curated-circuits';
export type {
  CuratedCircuit,
  CuratedCircuitRow,
  CuratedCircuits,
} from './curated-circuits';

export {
  JolpicaParticipantsPort,
  participantsPageLimit,
} from './participants-port';
export type { JolpicaParticipantsPortOptions } from './participants-port';

export {
  decodeSeasonConstructors,
  decodeSeasonDrivers,
  participantsDecodeProblems,
} from './participants-payload';
export type {
  ConstructorsDecodeResult,
  DecodedConstructor,
  DecodedDriver,
  DriversDecodeResult,
  ParticipantsDecodeProblem,
} from './participants-payload';

export {
  constructorSeasonEntries,
  normalizeSeasonConstructors,
  normalizeSeasonDrivers,
} from './participants-normalizer';
export type {
  IdentityNormalization,
  ParticipantsNormalizationProblem,
} from './participants-normalizer';

export {
  curatedParticipants,
  curatedParticipantsFrom,
} from './curated-participants';
export type {
  CuratedConstructor,
  CuratedConstructorRow,
  CuratedDriver,
  CuratedDriverRow,
  CuratedParticipants,
} from './curated-participants';

export { JolpicaResultsPort, resultsPageLimit } from './results-port';
export type { JolpicaResultsPortOptions } from './results-port';

export {
  decodeRaceResults,
  parseFastestLapTime,
  resultStatusTable,
  resultsDecodeProblems,
} from './results-payload';
export type {
  DecodedFastestLap,
  DecodedRaceResult,
  DecodedResultRow,
  ResultRowClass,
  ResultsDecodeProblem,
  ResultsDecodeResult,
} from './results-payload';

export { normalizeRaceResults } from './results-normalizer';
export type {
  ResultsNormalization,
  ResultsNormalizationProblem,
} from './results-normalizer';

export { JolpicaStandingsPort, standingsPageLimit } from './standings-port';
export type { JolpicaStandingsPortOptions } from './standings-port';

export {
  decodeConstructorStandings,
  decodeDriverStandings,
  parseStandingPoints,
  standingsDecodeProblems,
} from './standings-payload';
export type {
  DecodedConstructorStanding,
  DecodedDriverStanding,
  StandingsDecodeProblem,
  StandingsDecodeResult,
} from './standings-payload';

export {
  normalizeConstructorStandings,
  normalizeDriverStandings,
} from './standings-normalizer';
export type {
  StandingsNormalization,
  StandingsNormalizationProblem,
} from './standings-normalizer';
