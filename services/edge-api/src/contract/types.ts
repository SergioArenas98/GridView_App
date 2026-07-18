// Public GridView API v1 contract types. These mirror
// docs/api/gridview-api-v1.yaml and are intentionally kept separate from any
// provider types (there is no provider adapter in Phase 2). Nullable fields use
// `T | null`; absent optionals are represented as null.

import type {
  CircuitDirection,
  DriverRole,
  EventStatus,
  FinishStatus,
  MediaCategory,
  MediaEntityType,
  MediaFormat,
  ResultStatus,
  SeasonStatus,
  SessionStatus,
  SessionType,
  WeekendFormat,
} from './enums';

export type Slug = string;
export type GridViewId = string;
export type CountryCode = string;

export interface MediaVariant {
  url: string;
  width: number | null;
  height: number | null;
}

export interface MediaVariants {
  thumbnail?: MediaVariant | null;
  card?: MediaVariant | null;
  detail?: MediaVariant | null;
  hero?: MediaVariant | null;
}

export interface MediaAsset {
  id: GridViewId;
  entityType: MediaEntityType;
  entityId: Slug | null;
  category: MediaCategory;
  format: MediaFormat;
  variants: MediaVariants;
  aspectRatio: number | null;
  version: string;
  attribution: string | null;
  license: string | null;
  fallbackCategory: string | null;
}

export interface DataFreshness {
  generatedAt: string;
  sourceUpdatedAt: string | null;
  staleAfter: string | null;
  contentVersion: string | null;
  stale: boolean | null;
}

export interface Season {
  year: number;
  label: string | null;
  status: SeasonStatus;
  startDate: string | null;
  endDate: string | null;
  roundCount: number | null;
  currentRound: number | null;
  isCurrent: boolean;
}

export interface Driver {
  id: Slug;
  fullName: string;
  givenName: string | null;
  familyName: string | null;
  shortCode: string | null;
  permanentNumber: number | null;
  nationality: string | null;
  countryCode: CountryCode | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  biography: string | null;
  media: MediaAsset[] | null;
}

export interface Constructor {
  id: Slug;
  name: string;
  shortName: string | null;
  nationality: string | null;
  countryCode: CountryCode | null;
  colorPrimary: string | null;
  biography: string | null;
  media: MediaAsset[] | null;
}

export interface LapRecord {
  driverId: Slug | null;
  timeMillis: number | null;
  year: number | null;
}

export interface Circuit {
  id: Slug;
  name: string;
  locality: string | null;
  country: string | null;
  countryCode: CountryCode | null;
  latitude: number | null;
  longitude: number | null;
  lengthMeters: number | null;
  cornerCount: number | null;
  direction: CircuitDirection | null;
  firstGrandPrixYear: number | null;
  lapRecord: LapRecord | null;
  media: MediaAsset[] | null;
}

export interface Session {
  id: GridViewId;
  type: SessionType;
  name: string | null;
  startTime: string | null;
  endTime: string | null;
  status: SessionStatus;
}

export interface GrandPrix {
  id: GridViewId;
  season: number;
  round: number;
  eventSlug: Slug;
  name: string;
  officialName: string | null;
  circuitId: Slug;
  status: EventStatus;
  format: WeekendFormat;
  startDate: string | null;
  endDate: string | null;
  timezone: string | null;
  sessions: Session[];
  hasResults: boolean;
  media: MediaAsset[] | null;
}

export interface GrandPrixSummary {
  id: GridViewId;
  season: number;
  round: number;
  eventSlug: Slug;
  name: string;
  circuitId: Slug;
  circuitName: string | null;
  status: EventStatus;
  format: WeekendFormat;
  startDate: string | null;
  endDate: string | null;
  timezone: string | null;
  hasResults: boolean;
}

export interface DriverSeasonEntry {
  id: GridViewId;
  season: number;
  driverId: Slug;
  constructorId: Slug;
  raceNumber: number | null;
  role: DriverRole | null;
  shortCode: string | null;
  startRound: number | null;
  endRound: number | null;
}

export interface ConstructorSeasonEntry {
  id: GridViewId;
  season: number;
  constructorId: Slug;
  fullName: string | null;
  shortName: string | null;
  colorPrimary: string | null;
  colorSecondary: string | null;
  powerUnit: string | null;
  teamPrincipal: string | null;
  base: string | null;
  chassis: string | null;
  driverLineup: Slug[] | null;
}

export interface DriverStanding {
  season: number;
  driverId: Slug;
  constructorId: Slug | null;
  position: number | null;
  points: number;
  wins: number | null;
  podiums: number | null;
  provisional: boolean | null;
}

export interface ConstructorStanding {
  season: number;
  constructorId: Slug;
  position: number | null;
  points: number;
  wins: number | null;
  provisional: boolean | null;
}

export interface FastestLap {
  driverId: Slug | null;
  timeMillis: number | null;
  lap: number | null;
}

export interface RaceResultEntry {
  driverId: Slug;
  constructorId: Slug;
  position: number | null;
  gridPosition: number | null;
  points: number | null;
  status: FinishStatus;
  laps: number | null;
  elapsedTimeMillis: number | null;
  gapToLeaderMillis: number | null;
  lapsBehind: number | null;
  fastestLap: boolean | null;
  dnfReason: string | null;
  gapText: string | null;
}

export interface RaceResult {
  id: GridViewId;
  season: number;
  round: number;
  grandPrixId: GridViewId;
  sessionType: SessionType;
  status: ResultStatus;
  entries: RaceResultEntry[];
  fastestLap: FastestLap | null;
}

export interface DriverSummary {
  id: Slug;
  fullName: string;
  shortCode: string | null;
  permanentNumber: number | null;
  countryCode: CountryCode | null;
}

export interface ConstructorSummary {
  id: Slug;
  name: string;
  shortName: string | null;
  colorPrimary: string | null;
}

export interface CircuitSummary {
  id: Slug;
  name: string;
  locality: string | null;
  countryCode: CountryCode | null;
}

export interface SeasonDriverSummary {
  driverId: Slug;
  fullName: string;
  shortCode: string | null;
  permanentNumber: number | null;
  raceNumber: number | null;
  countryCode: CountryCode | null;
  constructorId: Slug;
  role: DriverRole | null;
}

export interface SeasonConstructorSummary {
  constructorId: Slug;
  name: string;
  fullName: string | null;
  shortName: string | null;
  colorPrimary: string | null;
  colorSecondary: string | null;
  powerUnit: string | null;
  driverLineup: Slug[] | null;
}

export interface DriverDetail {
  driver: Driver;
  seasonEntry: DriverSeasonEntry | null;
  constructor: ConstructorSummary | null;
  standing: DriverStanding | null;
}

export interface ConstructorDetail {
  constructor: Constructor;
  seasonEntry: ConstructorSeasonEntry | null;
  standing: ConstructorStanding | null;
  lineup: DriverSummary[] | null;
}

export interface CircuitDetail {
  circuit: Circuit;
  grandPrix: GrandPrixSummary | null;
}

export interface StatusData {
  status: 'ok' | 'degraded' | 'maintenance';
  service: 'gridview-edge-api';
  environment: 'development' | 'staging' | 'production';
  apiVersion: '1';
  currentSeason: number | null;
  lastSuccessfulSyncAt: string | null;
  snapshotAgeSeconds: number | null;
  maintenance: boolean;
}

export interface HomeData {
  freshness: DataFreshness;
  featuredEvent: GrandPrixSummary | null;
  featuredSession: Session | null;
  latestCompletedEvent: GrandPrixSummary | null;
  driverLeader: DriverStanding | null;
  constructorLeader: ConstructorStanding | null;
  upcomingEvents: GrandPrixSummary[];
}

export interface BootstrapData {
  season: Season;
  calendar: GrandPrixSummary[];
  drivers: SeasonDriverSummary[];
  constructors: SeasonConstructorSummary[];
  circuits: CircuitSummary[];
  driverStandings: DriverStanding[];
  constructorStandings: ConstructorStanding[];
  home: HomeData;
  contentVersion: string | null;
  mediaVersion: string | null;
}

export interface ContentManifest {
  contentVersion: string;
  mediaVersion: string | null;
  supportedSeasons: number[];
  attributionVersion: string | null;
  minimumApiSchemaVersion: number;
}

// ---- Envelopes ------------------------------------------------------------

export interface BaseMeta {
  apiVersion: '1';
  generatedAt: string;
  requestId: string;
}

export interface SnapshotMeta extends BaseMeta {
  schemaVersion: number;
  sourceUpdatedAt: string;
  staleAfter: string;
  contentVersion: string;
}

export interface SeasonSnapshotMeta extends SnapshotMeta {
  season: number;
}

export interface SuccessEnvelope<
  TData,
  TMeta extends BaseMeta = SeasonSnapshotMeta,
> {
  data: TData;
  meta: TMeta;
}

export type ErrorCode =
  | 'INVALID_PARAMETER'
  | 'SEASON_NOT_FOUND'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_NOT_AVAILABLE'
  | 'SNAPSHOT_NOT_READY'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_RATE_LIMITED'
  | 'MAINTENANCE'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  requestId: string;
}

export interface ErrorEnvelope {
  error: ErrorBody;
}
