/**
 * The Jolpica adapter package.
 *
 * **Dormant by design.** No runtime module outside this directory imports it,
 * `src/index.ts` cannot reach it, no production composition constructs it, and
 * `PROVIDER_MODE` still admits exactly `mock | none`. It implements exactly
 * two coordinated resources, each in its own port - the season calendar and
 * the season circuits - and each port refuses every other resource before
 * reserving capacity or touching transport.
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
