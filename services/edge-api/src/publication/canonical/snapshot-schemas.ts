/**
 * The canonical revision input, one declaration per snapshot key.
 *
 * These mirror the public payload types in `contract/types.ts`, and they are
 * the **only** description of what a `snapshotRevision` is computed over. Two
 * consequences follow, and both are deliberate:
 *
 * - **An undeclared property cannot reach the digest.** Exclusion is not a
 *   deny-list that has to enumerate `requestId`, `generatedAt`,
 *   `sourceUpdatedAt`, `snapshotObservedAt`, `staleAfter`, ETags, server-stale
 *   flags, provider identifiers, `fetchedAt`, `reconciledAt` and reconciliation
 *   state. None of them is declared, so none of them is read.
 * - **A new public field is a deliberate decision.** Adding one to
 *   `contract/types.ts` without adding it here leaves it out of the revision,
 *   which the "every generated document" tests are there to catch.
 *
 * ## `freshness` is selectively projected, not excluded wholesale
 *
 * `HomeData.freshness` - and therefore `BootstrapData.home.freshness` - is the
 * one place where excluded metadata lives *inside* `data`, but it is not a
 * single exclude-or-include decision: `generatedAt`, `sourceUpdatedAt` (which
 * the revision derives, so including it would be circular), `staleAfter` and
 * the server-`stale` flag are ADR 0020 exclusions and stay unread. `contentVersion`
 * is different - it carries the same curated, provider-supplied version as
 * `BootstrapData.contentVersion`, not a derived or time-varying signal, so it is
 * declared and read like any other stable payload field. A block that excluded
 * `freshness` wholesale would let a genuine curated content bump leave the
 * standalone `home` document's revision unchanged.
 *
 * `BootstrapData.contentVersion` and `BootstrapData.mediaVersion` **are**
 * declared at the top level too. They are top-level payload fields the client
 * reads, not a freshness projection, and a curated content bump is a genuine
 * change to what `/v1/bootstrap` serves. `content:manifest` carries the same
 * versions as its own payload and keeps its own revision for the same reason.
 *
 * ## Array policy
 *
 * Ordered by default, because order is content until something says otherwise:
 * calendar rounds, standings positions, classification entries, weekend
 * sessions and the upcoming-event list all carry a domain order.
 *
 * Two lists are declared unordered, each with the stable GridView identity it
 * sorts by: `media` (curated assets attached to an entity, in no domain order)
 * sorts by `id`, and `supportedSeasons` (a set of years) sorts by value. A
 * driver lineup stays **ordered** deliberately - a team's first and second
 * driver is a presentation order the client renders, so a permutation is a
 * change to what is served, not an incidental upstream reordering.
 */

import type { SnapshotDocumentName } from '../../storage/types';
import {
  byField,
  byValue,
  flag,
  nullableFlag,
  nullableInstant,
  nullableNumeric,
  nullableObject,
  nullableOrderedList,
  nullableText,
  nullableUnorderedList,
  numeric,
  unorderedList,
  object,
  orderedList,
  text,
  type CanonicalSpec,
} from './schema';

const mediaVariant = nullableObject([
  { key: 'url', spec: text() },
  { key: 'width', spec: nullableNumeric() },
  { key: 'height', spec: nullableNumeric() },
]);

/** The only object in the contract declaring its properties with `?`. */
const mediaVariants = object([
  { key: 'thumbnail', spec: mediaVariant, optional: true },
  { key: 'card', spec: mediaVariant, optional: true },
  { key: 'detail', spec: mediaVariant, optional: true },
  { key: 'hero', spec: mediaVariant, optional: true },
]);

const mediaAsset = object([
  { key: 'id', spec: text() },
  { key: 'entityType', spec: text() },
  { key: 'entityId', spec: nullableText() },
  { key: 'category', spec: text() },
  { key: 'format', spec: text() },
  { key: 'variants', spec: mediaVariants },
  { key: 'aspectRatio', spec: nullableNumeric() },
  { key: 'version', spec: text() },
  { key: 'attribution', spec: nullableText() },
  { key: 'license', spec: nullableText() },
  { key: 'fallbackCategory', spec: nullableText() },
]);

const media = nullableUnorderedList(mediaAsset, byField('id'));

const season = object([
  { key: 'year', spec: numeric() },
  { key: 'label', spec: nullableText() },
  { key: 'status', spec: text() },
  { key: 'startDate', spec: nullableText() },
  { key: 'endDate', spec: nullableText() },
  { key: 'roundCount', spec: nullableNumeric() },
  { key: 'currentRound', spec: nullableNumeric() },
  { key: 'isCurrent', spec: flag() },
]);

const driver = object([
  { key: 'id', spec: text() },
  { key: 'fullName', spec: text() },
  { key: 'givenName', spec: nullableText() },
  { key: 'familyName', spec: nullableText() },
  { key: 'shortCode', spec: nullableText() },
  { key: 'permanentNumber', spec: nullableNumeric() },
  { key: 'nationality', spec: nullableText() },
  { key: 'countryCode', spec: nullableText() },
  { key: 'dateOfBirth', spec: nullableText() },
  { key: 'placeOfBirth', spec: nullableText() },
  { key: 'biography', spec: nullableText() },
  { key: 'media', spec: media },
]);

const constructor = object([
  { key: 'id', spec: text() },
  { key: 'name', spec: text() },
  { key: 'shortName', spec: nullableText() },
  { key: 'nationality', spec: nullableText() },
  { key: 'countryCode', spec: nullableText() },
  { key: 'colorPrimary', spec: nullableText() },
  { key: 'biography', spec: nullableText() },
  { key: 'media', spec: media },
]);

const circuit = object([
  { key: 'id', spec: text() },
  { key: 'name', spec: text() },
  { key: 'locality', spec: nullableText() },
  { key: 'country', spec: nullableText() },
  { key: 'countryCode', spec: nullableText() },
  { key: 'latitude', spec: nullableNumeric() },
  { key: 'longitude', spec: nullableNumeric() },
  { key: 'lengthMeters', spec: nullableNumeric() },
  { key: 'cornerCount', spec: nullableNumeric() },
  { key: 'direction', spec: nullableText() },
  { key: 'firstGrandPrixYear', spec: nullableNumeric() },
  {
    key: 'lapRecord',
    spec: nullableObject([
      { key: 'driverId', spec: nullableText() },
      { key: 'timeMillis', spec: nullableNumeric() },
      { key: 'year', spec: nullableNumeric() },
    ]),
  },
  { key: 'media', spec: media },
]);

/**
 * The one place in the public payload where an RFC 3339 `date-time` appears.
 *
 * `startDate`, `endDate` and `dateOfBirth` are `format: date` in the OpenAPI
 * schema - a plain `YYYY-MM-DD` with one spelling already - so they are
 * ordinary strings here. Only the session boundaries carry a zone and a
 * fraction, and only they need canonicalizing.
 */
const session = object([
  { key: 'id', spec: text() },
  { key: 'type', spec: text() },
  { key: 'name', spec: nullableText() },
  { key: 'startTime', spec: nullableInstant() },
  { key: 'endTime', spec: nullableInstant() },
  { key: 'status', spec: text() },
]);

const grandPrix = object([
  { key: 'id', spec: text() },
  { key: 'season', spec: numeric() },
  { key: 'round', spec: numeric() },
  { key: 'eventSlug', spec: text() },
  { key: 'name', spec: text() },
  { key: 'officialName', spec: nullableText() },
  { key: 'circuitId', spec: text() },
  { key: 'status', spec: text() },
  { key: 'format', spec: text() },
  { key: 'startDate', spec: nullableText() },
  { key: 'endDate', spec: nullableText() },
  { key: 'timezone', spec: nullableText() },
  { key: 'sessions', spec: orderedList(session) },
  { key: 'hasResults', spec: flag() },
  { key: 'media', spec: media },
]);

const grandPrixSummary = object([
  { key: 'id', spec: text() },
  { key: 'season', spec: numeric() },
  { key: 'round', spec: numeric() },
  { key: 'eventSlug', spec: text() },
  { key: 'name', spec: text() },
  { key: 'circuitId', spec: text() },
  { key: 'circuitName', spec: nullableText() },
  { key: 'status', spec: text() },
  { key: 'format', spec: text() },
  { key: 'startDate', spec: nullableText() },
  { key: 'endDate', spec: nullableText() },
  { key: 'timezone', spec: nullableText() },
  { key: 'hasResults', spec: flag() },
]);

const driverSeasonEntry = object([
  { key: 'id', spec: text() },
  { key: 'season', spec: numeric() },
  { key: 'driverId', spec: text() },
  { key: 'constructorId', spec: text() },
  { key: 'raceNumber', spec: nullableNumeric() },
  { key: 'role', spec: nullableText() },
  { key: 'shortCode', spec: nullableText() },
  { key: 'startRound', spec: nullableNumeric() },
  { key: 'endRound', spec: nullableNumeric() },
]);

const constructorSeasonEntry = object([
  { key: 'id', spec: text() },
  { key: 'season', spec: numeric() },
  { key: 'constructorId', spec: text() },
  { key: 'fullName', spec: nullableText() },
  { key: 'shortName', spec: nullableText() },
  { key: 'colorPrimary', spec: nullableText() },
  { key: 'colorSecondary', spec: nullableText() },
  { key: 'powerUnit', spec: nullableText() },
  { key: 'teamPrincipal', spec: nullableText() },
  { key: 'base', spec: nullableText() },
  { key: 'chassis', spec: nullableText() },
  { key: 'driverLineup', spec: nullableOrderedList(text()) },
]);

const driverStanding = object([
  { key: 'season', spec: numeric() },
  { key: 'driverId', spec: text() },
  { key: 'constructorId', spec: nullableText() },
  { key: 'position', spec: nullableNumeric() },
  { key: 'points', spec: numeric() },
  { key: 'wins', spec: nullableNumeric() },
  { key: 'podiums', spec: nullableNumeric() },
  { key: 'provisional', spec: nullableFlag() },
]);

const constructorStanding = object([
  { key: 'season', spec: numeric() },
  { key: 'constructorId', spec: text() },
  { key: 'position', spec: nullableNumeric() },
  { key: 'points', spec: numeric() },
  { key: 'wins', spec: nullableNumeric() },
  { key: 'provisional', spec: nullableFlag() },
]);

const raceResult = object([
  { key: 'id', spec: text() },
  { key: 'season', spec: numeric() },
  { key: 'round', spec: numeric() },
  { key: 'grandPrixId', spec: text() },
  { key: 'sessionType', spec: text() },
  { key: 'status', spec: text() },
  {
    key: 'entries',
    spec: orderedList(
      object([
        { key: 'driverId', spec: text() },
        { key: 'constructorId', spec: text() },
        { key: 'position', spec: nullableNumeric() },
        { key: 'gridPosition', spec: nullableNumeric() },
        { key: 'points', spec: nullableNumeric() },
        { key: 'status', spec: text() },
        { key: 'laps', spec: nullableNumeric() },
        { key: 'elapsedTimeMillis', spec: nullableNumeric() },
        { key: 'gapToLeaderMillis', spec: nullableNumeric() },
        { key: 'lapsBehind', spec: nullableNumeric() },
        { key: 'fastestLap', spec: nullableFlag() },
        { key: 'dnfReason', spec: nullableText() },
        { key: 'gapText', spec: nullableText() },
      ]),
    ),
  },
  {
    key: 'fastestLap',
    spec: nullableObject([
      { key: 'driverId', spec: nullableText() },
      { key: 'timeMillis', spec: nullableNumeric() },
      { key: 'lap', spec: nullableNumeric() },
    ]),
  },
]);

const driverSummary = object([
  { key: 'id', spec: text() },
  { key: 'fullName', spec: text() },
  { key: 'shortCode', spec: nullableText() },
  { key: 'permanentNumber', spec: nullableNumeric() },
  { key: 'countryCode', spec: nullableText() },
]);

const constructorSummary = object([
  { key: 'id', spec: text() },
  { key: 'name', spec: text() },
  { key: 'shortName', spec: nullableText() },
  { key: 'colorPrimary', spec: nullableText() },
]);

const circuitSummary = object([
  { key: 'id', spec: text() },
  { key: 'name', spec: text() },
  { key: 'locality', spec: nullableText() },
  { key: 'countryCode', spec: nullableText() },
]);

const seasonDriverSummary = object([
  { key: 'driverId', spec: text() },
  { key: 'fullName', spec: text() },
  { key: 'shortCode', spec: nullableText() },
  { key: 'permanentNumber', spec: nullableNumeric() },
  { key: 'raceNumber', spec: nullableNumeric() },
  { key: 'countryCode', spec: nullableText() },
  { key: 'constructorId', spec: text() },
  { key: 'role', spec: nullableText() },
]);

const seasonConstructorSummary = object([
  { key: 'constructorId', spec: text() },
  { key: 'name', spec: text() },
  { key: 'fullName', spec: nullableText() },
  { key: 'shortName', spec: nullableText() },
  { key: 'colorPrimary', spec: nullableText() },
  { key: 'colorSecondary', spec: nullableText() },
  { key: 'powerUnit', spec: nullableText() },
  { key: 'driverLineup', spec: nullableOrderedList(text()) },
]);

/**
 * Only `contentVersion` is read - see the module note. The other four
 * `DataFreshness` properties are derived or time-varying and stay excluded.
 */
const homeFreshness = object([{ key: 'contentVersion', spec: nullableText() }]);

const home = object([
  { key: 'freshness', spec: homeFreshness },
  { key: 'featuredEvent', spec: nullableObject(fieldsOf(grandPrixSummary)) },
  { key: 'featuredSession', spec: nullableObject(fieldsOf(session)) },
  {
    key: 'latestCompletedEvent',
    spec: nullableObject(fieldsOf(grandPrixSummary)),
  },
  { key: 'driverLeader', spec: nullableObject(fieldsOf(driverStanding)) },
  {
    key: 'constructorLeader',
    spec: nullableObject(fieldsOf(constructorStanding)),
  },
  { key: 'upcomingEvents', spec: orderedList(grandPrixSummary) },
]);

const bootstrap = object([
  { key: 'season', spec: season },
  { key: 'calendar', spec: orderedList(grandPrixSummary) },
  { key: 'drivers', spec: orderedList(seasonDriverSummary) },
  { key: 'constructors', spec: orderedList(seasonConstructorSummary) },
  { key: 'circuits', spec: orderedList(circuitSummary) },
  { key: 'driverStandings', spec: orderedList(driverStanding) },
  { key: 'constructorStandings', spec: orderedList(constructorStanding) },
  { key: 'home', spec: home },
  { key: 'contentVersion', spec: nullableText() },
  { key: 'mediaVersion', spec: nullableText() },
]);

const contentManifest = object([
  { key: 'contentVersion', spec: text() },
  { key: 'mediaVersion', spec: nullableText() },
  { key: 'supportedSeasons', spec: unorderedList(numeric(), byValue) },
  { key: 'attributionVersion', spec: nullableText() },
  { key: 'minimumApiSchemaVersion', spec: numeric() },
]);

const driverDetail = object([
  { key: 'driver', spec: driver },
  { key: 'seasonEntry', spec: nullableObject(fieldsOf(driverSeasonEntry)) },
  { key: 'constructor', spec: nullableObject(fieldsOf(constructorSummary)) },
  { key: 'standing', spec: nullableObject(fieldsOf(driverStanding)) },
]);

const constructorDetail = object([
  { key: 'constructor', spec: constructor },
  {
    key: 'seasonEntry',
    spec: nullableObject(fieldsOf(constructorSeasonEntry)),
  },
  { key: 'standing', spec: nullableObject(fieldsOf(constructorStanding)) },
  { key: 'lineup', spec: nullableOrderedList(driverSummary) },
]);

const circuitDetail = object([
  { key: 'circuit', spec: circuit },
  { key: 'grandPrix', spec: nullableObject(fieldsOf(grandPrixSummary)) },
]);

/**
 * Reuses one object declaration in a nullable position.
 *
 * The alternative is declaring the same field list twice, which is precisely
 * the drift a canonical form cannot survive: two spellings of one payload
 * shape would be two revisions for one piece of content.
 */
function fieldsOf(spec: CanonicalSpec) {
  return spec.kind === 'object' ? spec.fields : [];
}

const exact: Partial<Record<string, CanonicalSpec>> = {
  season,
  bootstrap,
  home,
  calendar: orderedList(grandPrixSummary),
  drivers: orderedList(seasonDriverSummary),
  constructors: orderedList(seasonConstructorSummary),
  circuits: orderedList(circuitSummary),
  'standings:drivers': orderedList(driverStanding),
  'standings:constructors': orderedList(constructorStanding),
  'content:manifest': contentManifest,
};

const roundResultsPattern = /^grand-prix:\d+:results$/;
const roundPattern = /^grand-prix:\d+$/;

/**
 * The canonical schema for one snapshot key, or `null` when none is declared.
 *
 * `null` is fail-closed rather than permissive: a key with no declaration has
 * no defined revision, and the caller records that as a bounded marker instead
 * of hashing whatever the payload happened to contain.
 */
export function canonicalSchemaFor(
  documentName: SnapshotDocumentName | string,
): CanonicalSpec | null {
  const declared = Object.hasOwn(exact, documentName)
    ? exact[documentName]
    : undefined;
  if (declared !== undefined) return declared;
  // Checked before the round pattern: `grand-prix:1:results` would otherwise
  // never be reached, and a classification would be hashed as an event.
  if (roundResultsPattern.test(documentName)) return raceResult;
  if (roundPattern.test(documentName)) return grandPrix;
  if (documentName.startsWith('driver:')) return driverDetail;
  if (documentName.startsWith('constructor:')) return constructorDetail;
  if (documentName.startsWith('circuit:')) return circuitDetail;
  return null;
}
