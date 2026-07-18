// Public contract enums, expressed as string-literal unions. Every enum carries
// an `unknown` member so an unrecognised value maps to `unknown` rather than
// throwing. Mirrors docs/technical/GridView_Domain_Model.md section 5.4.

export const SEASON_STATUSES = [
  'upcoming',
  'active',
  'completed',
  'unknown',
] as const;
export type SeasonStatus = (typeof SEASON_STATUSES)[number];

export const WEEKEND_FORMATS = ['standard', 'sprint', 'unknown'] as const;
export type WeekendFormat = (typeof WEEKEND_FORMATS)[number];

export const EVENT_STATUSES = [
  'scheduled',
  'upcoming',
  'in_progress',
  'completed',
  'postponed',
  'cancelled',
  'unknown',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const SESSION_TYPES = [
  'practice_1',
  'practice_2',
  'practice_3',
  'sprint_qualifying',
  'sprint',
  'qualifying',
  'race',
  'unknown',
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_STATUSES = [
  'scheduled',
  'live',
  'completed',
  'cancelled',
  'postponed',
  'unknown',
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const DRIVER_ROLES = ['race', 'reserve', 'test', 'unknown'] as const;
export type DriverRole = (typeof DRIVER_ROLES)[number];

export const RESULT_STATUSES = [
  'provisional',
  'final',
  'unavailable',
  'unknown',
] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const FINISH_STATUSES = [
  'finished',
  'lapped',
  'dnf',
  'dns',
  'dsq',
  'dnq',
  'unknown',
] as const;
export type FinishStatus = (typeof FINISH_STATUSES)[number];

export const CIRCUIT_DIRECTIONS = [
  'clockwise',
  'counter_clockwise',
  'unknown',
] as const;
export type CircuitDirection = (typeof CIRCUIT_DIRECTIONS)[number];

export const MEDIA_ENTITY_TYPES = [
  'driver',
  'constructor',
  'circuit',
  'grand_prix',
  'placeholder',
  'unknown',
] as const;
export type MediaEntityType = (typeof MEDIA_ENTITY_TYPES)[number];

export const MEDIA_CATEGORIES = [
  'portrait',
  'logo',
  'car',
  'circuit_layout',
  'hero',
  'thumbnail',
  'unknown',
] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const MEDIA_FORMATS = [
  'webp',
  'avif',
  'png',
  'jpeg',
  'unknown',
] as const;
export type MediaFormat = (typeof MEDIA_FORMATS)[number];

export const MEDIA_VARIANT_NAMES = [
  'thumbnail',
  'card',
  'detail',
  'hero',
] as const;
export type MediaVariantName = (typeof MEDIA_VARIANT_NAMES)[number];

/**
 * Maps a raw value to a member of `allowed`, falling back to `fallback`
 * (conventionally `unknown`) when the value is not recognised. Additive-safe.
 */
export function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
