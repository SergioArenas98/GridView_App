/**
 * The declared shape of every entity a coordinated payload carries.
 *
 * One table per entity, mirroring `contract/types.ts` for which properties
 * exist and `docs/api/gridview-api-v1.yaml` for what their values may be. The
 * tables are the specification: adding a property to the contract without
 * adding it here makes it an undeclared key and fails closed, which is the
 * direction a normalization gate should fail in.
 *
 * Only bounds the contract actually states are applied - `position >= 1`,
 * `round >= 1` and the season range. Nothing constrains the sign or magnitude
 * of wins, podiums, laps, lengths, corner counts, coordinates, aspect ratios,
 * durations, gaps or points, because the contract does not.
 */

import {
  CIRCUIT_DIRECTIONS,
  DRIVER_ROLES,
  EVENT_STATUSES,
  FINISH_STATUSES,
  RESULT_STATUSES,
  SESSION_STATUSES,
  SESSION_TYPES,
  WEEKEND_FORMATS,
} from '../enums';
import type { ContractIssue } from './issues';
import { collect } from './issues';
import { mediaAsset } from './media';
import { objectOf, nullableObjectOf, type Field } from './object';
import type { Check } from './values';
import {
  arrayOf,
  bool,
  colorHex,
  countryCode,
  enumOf,
  gridViewId,
  int,
  intAtLeast,
  isoDate,
  isoDateTime,
  nullable,
  num,
  seasonYear,
  slug,
  str,
} from './values';

/** `media: MediaAsset[] | null` - the shared tail of the profile entities. */
const mediaCollection: Field = {
  key: 'media',
  check: nullable(arrayOf(mediaAsset)),
};

const sessionFields: readonly Field[] = [
  { key: 'id', check: gridViewId },
  { key: 'type', check: enumOf(SESSION_TYPES) },
  { key: 'name', check: nullable(str) },
  { key: 'startTime', check: nullable(isoDateTime) },
  { key: 'endTime', check: nullable(isoDateTime) },
  { key: 'status', check: enumOf(SESSION_STATUSES) },
];

const lapRecordFields: readonly Field[] = [
  { key: 'driverId', check: nullable(slug) },
  { key: 'timeMillis', check: nullable(int) },
  { key: 'year', check: nullable(int) },
];

const driverFields: readonly Field[] = [
  { key: 'id', check: slug },
  { key: 'fullName', check: str },
  { key: 'givenName', check: nullable(str) },
  { key: 'familyName', check: nullable(str) },
  { key: 'shortCode', check: nullable(str) },
  { key: 'permanentNumber', check: nullable(int) },
  { key: 'nationality', check: nullable(str) },
  { key: 'countryCode', check: nullable(countryCode) },
  { key: 'dateOfBirth', check: nullable(isoDate) },
  { key: 'placeOfBirth', check: nullable(str) },
  { key: 'biography', check: nullable(str) },
  mediaCollection,
];

const constructorFields: readonly Field[] = [
  { key: 'id', check: slug },
  { key: 'name', check: str },
  { key: 'shortName', check: nullable(str) },
  { key: 'nationality', check: nullable(str) },
  { key: 'countryCode', check: nullable(countryCode) },
  { key: 'colorPrimary', check: nullable(colorHex) },
  { key: 'biography', check: nullable(str) },
  mediaCollection,
];

const circuitFields: readonly Field[] = [
  { key: 'id', check: slug },
  { key: 'name', check: str },
  { key: 'locality', check: nullable(str) },
  { key: 'country', check: nullable(str) },
  { key: 'countryCode', check: nullable(countryCode) },
  { key: 'latitude', check: nullable(num) },
  { key: 'longitude', check: nullable(num) },
  { key: 'lengthMeters', check: nullable(int) },
  { key: 'cornerCount', check: nullable(int) },
  { key: 'direction', check: nullable(enumOf(CIRCUIT_DIRECTIONS)) },
  { key: 'firstGrandPrixYear', check: nullable(int) },
  { key: 'lapRecord', check: nullableObjectOf(lapRecordFields) },
  mediaCollection,
];

const grandPrixFields: readonly Field[] = [
  { key: 'id', check: gridViewId },
  { key: 'season', check: seasonYear },
  { key: 'round', check: intAtLeast(1) },
  { key: 'eventSlug', check: slug },
  { key: 'name', check: str },
  { key: 'officialName', check: nullable(str) },
  { key: 'circuitId', check: slug },
  { key: 'status', check: enumOf(EVENT_STATUSES) },
  { key: 'format', check: enumOf(WEEKEND_FORMATS) },
  { key: 'startDate', check: nullable(isoDate) },
  { key: 'endDate', check: nullable(isoDate) },
  { key: 'timezone', check: nullable(str) },
  { key: 'sessions', check: arrayOf(objectOf(sessionFields)) },
  { key: 'hasResults', check: bool },
  mediaCollection,
];

const driverSeasonEntryFields: readonly Field[] = [
  { key: 'id', check: gridViewId },
  { key: 'season', check: seasonYear },
  { key: 'driverId', check: slug },
  { key: 'constructorId', check: slug },
  { key: 'raceNumber', check: nullable(int) },
  { key: 'role', check: nullable(enumOf(DRIVER_ROLES)) },
  { key: 'shortCode', check: nullable(str) },
  { key: 'startRound', check: nullable(int) },
  { key: 'endRound', check: nullable(int) },
];

const constructorSeasonEntryFields: readonly Field[] = [
  { key: 'id', check: gridViewId },
  { key: 'season', check: seasonYear },
  { key: 'constructorId', check: slug },
  { key: 'fullName', check: nullable(str) },
  { key: 'shortName', check: nullable(str) },
  { key: 'colorPrimary', check: nullable(colorHex) },
  { key: 'colorSecondary', check: nullable(colorHex) },
  { key: 'powerUnit', check: nullable(str) },
  { key: 'teamPrincipal', check: nullable(str) },
  { key: 'base', check: nullable(str) },
  { key: 'chassis', check: nullable(str) },
  { key: 'driverLineup', check: nullable(arrayOf(slug)) },
];

const driverStandingFields: readonly Field[] = [
  { key: 'season', check: seasonYear },
  { key: 'driverId', check: slug },
  { key: 'constructorId', check: nullable(slug) },
  { key: 'position', check: nullable(intAtLeast(1)) },
  { key: 'points', check: num },
  { key: 'wins', check: nullable(int) },
  { key: 'podiums', check: nullable(int) },
  { key: 'provisional', check: nullable(bool) },
];

const constructorStandingFields: readonly Field[] = [
  { key: 'season', check: seasonYear },
  { key: 'constructorId', check: slug },
  { key: 'position', check: nullable(intAtLeast(1)) },
  { key: 'points', check: num },
  { key: 'wins', check: nullable(int) },
  { key: 'provisional', check: nullable(bool) },
];

const fastestLapFields: readonly Field[] = [
  { key: 'driverId', check: nullable(slug) },
  { key: 'timeMillis', check: nullable(int) },
  { key: 'lap', check: nullable(int) },
];

const raceResultEntryFields: readonly Field[] = [
  { key: 'driverId', check: slug },
  { key: 'constructorId', check: slug },
  { key: 'position', check: nullable(intAtLeast(1)) },
  { key: 'gridPosition', check: nullable(int) },
  { key: 'points', check: nullable(num) },
  { key: 'status', check: enumOf(FINISH_STATUSES) },
  { key: 'laps', check: nullable(int) },
  { key: 'elapsedTimeMillis', check: nullable(int) },
  { key: 'gapToLeaderMillis', check: nullable(int) },
  { key: 'lapsBehind', check: nullable(int) },
  { key: 'fastestLap', check: nullable(bool) },
  { key: 'dnfReason', check: nullable(str) },
  { key: 'gapText', check: nullable(str) },
];

const raceResultFields: readonly Field[] = [
  { key: 'id', check: gridViewId },
  { key: 'season', check: seasonYear },
  { key: 'round', check: intAtLeast(1) },
  { key: 'grandPrixId', check: gridViewId },
  { key: 'sessionType', check: enumOf(SESSION_TYPES) },
  { key: 'status', check: enumOf(RESULT_STATUSES) },
  { key: 'entries', check: arrayOf(objectOf(raceResultEntryFields)) },
  { key: 'fastestLap', check: nullableObjectOf(fastestLapFields) },
];

/** The check for one entity, as a bounded standalone validator. */
function validator(
  check: Check,
): (value: unknown, path: string) => readonly ContractIssue[] {
  return (value, path) =>
    collect(path, (collector) => check(value, path, collector));
}

export const sessionCheck = objectOf(sessionFields);
export const driverCheck = objectOf(driverFields);
export const constructorCheck = objectOf(constructorFields);
export const circuitCheck = objectOf(circuitFields);
export const grandPrixCheck = objectOf(grandPrixFields);
export const driverSeasonEntryCheck = objectOf(driverSeasonEntryFields);
export const constructorSeasonEntryCheck = objectOf(
  constructorSeasonEntryFields,
);
export const driverStandingCheck = objectOf(driverStandingFields);
export const constructorStandingCheck = objectOf(constructorStandingFields);
export const raceResultCheck = objectOf(raceResultFields);

export const validateSession = validator(sessionCheck);
export const validateLapRecord = validator(objectOf(lapRecordFields));
export const validateDriver = validator(driverCheck);
export const validateConstructor = validator(constructorCheck);
export const validateCircuit = validator(circuitCheck);
export const validateGrandPrix = validator(grandPrixCheck);
export const validateDriverSeasonEntry = validator(driverSeasonEntryCheck);
export const validateConstructorSeasonEntry = validator(
  constructorSeasonEntryCheck,
);
export const validateDriverStanding = validator(driverStandingCheck);
export const validateConstructorStanding = validator(constructorStandingCheck);
export const validateFastestLap = validator(objectOf(fastestLapFields));
export const validateRaceResultEntry = validator(
  objectOf(raceResultEntryFields),
);
export const validateRaceResult = validator(raceResultCheck);
export const validateMediaAsset = validator(mediaAsset);
