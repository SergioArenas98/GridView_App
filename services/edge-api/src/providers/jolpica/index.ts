/**
 * The Jolpica adapter package.
 *
 * **Dormant by design.** No runtime module outside this directory imports it,
 * `src/index.ts` cannot reach it, no production composition constructs it, and
 * `PROVIDER_MODE` still admits exactly `mock | none`. It implements exactly
 * four coordinated resources, each in its own port - the season calendar,
 * the season circuits, the season participants and the race classification -
 * and each port refuses every other resource before reserving capacity or
 * touching transport.
 */

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
