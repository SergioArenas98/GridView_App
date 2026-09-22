/**
 * The Jolpica adapter package.
 *
 * **Dormant by design.** No runtime module outside this directory imports it,
 * `src/index.ts` cannot reach it, no production composition constructs it, and
 * `PROVIDER_MODE` still admits exactly `mock | none`. It implements exactly
 * one coordinated resource - the season calendar - and refuses every other one
 * before reserving capacity or touching transport.
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
