import type {
  BootstrapData,
  Circuit,
  CircuitDetail,
  CircuitSummary,
  Constructor,
  ConstructorDetail,
  ConstructorSummary,
  ContentManifest,
  DataFreshness,
  Driver,
  DriverDetail,
  DriverSummary,
  GrandPrix,
  GrandPrixSummary,
  HomeData,
  Season,
  SeasonConstructorSummary,
  SeasonDriverSummary,
} from '../contract/types';
import { addSeconds } from '../runtime/clock';
import type { ProviderSeasonSource } from '../providers/formula-one-provider';
import type {
  SnapshotDocumentName,
  StoredMeta,
  StoredSnapshot,
} from '../storage/types';

export interface GeneratedSnapshotSet {
  season: number;
  version: string;
  sourceUpdatedAt: string;
  contentVersion: string;
  documents: StoredSnapshot[];
}

export function generateSnapshotSet(
  source: ProviderSeasonSource,
  generatedAt: string,
  version: string,
): GeneratedSnapshotSet {
  const staleAfter = addSeconds(generatedAt, 15 * 60);
  const season = seasonData(source);
  const calendar = source.calendar.map((event) =>
    summaryForEvent(event, source),
  );
  const drivers = source.driverEntries.map((entry) => {
    const driver = requireOne(source.drivers, entry.driverId, 'driver');
    return {
      driverId: driver.id,
      fullName: driver.fullName,
      shortCode: entry.shortCode ?? driver.shortCode,
      permanentNumber: driver.permanentNumber,
      raceNumber: entry.raceNumber,
      countryCode: driver.countryCode,
      constructorId: entry.constructorId,
      role: entry.role,
    } satisfies SeasonDriverSummary;
  });
  const constructors = source.constructorEntries.map((entry) => {
    const constructor = requireOne(
      source.constructors,
      entry.constructorId,
      'constructor',
    );
    return {
      constructorId: constructor.id,
      name: constructor.name,
      fullName: entry.fullName,
      shortName: entry.shortName ?? constructor.shortName,
      colorPrimary: entry.colorPrimary ?? constructor.colorPrimary,
      colorSecondary: entry.colorSecondary,
      powerUnit: entry.powerUnit,
      driverLineup: entry.driverLineup,
    } satisfies SeasonConstructorSummary;
  });
  const circuits = source.calendar.map((event) =>
    circuitSummary(requireOne(source.circuits, event.circuitId, 'circuit')),
  );
  const driverStandings = source.driverStandings;
  const constructorStandings = source.constructorStandings;
  const freshness = freshnessFor(source, generatedAt, staleAfter);
  const home = homeData(
    calendar,
    source.calendar,
    driverStandings,
    constructorStandings,
    freshness,
  );
  const manifest: ContentManifest = {
    contentVersion: source.contentVersion,
    mediaVersion: source.mediaVersion,
    supportedSeasons: [source.season],
    attributionVersion: source.attributionVersion,
    minimumApiSchemaVersion: 1,
  };
  const bootstrap: BootstrapData = {
    season,
    calendar,
    drivers,
    constructors,
    circuits,
    driverStandings,
    constructorStandings,
    home,
    contentVersion: source.contentVersion,
    mediaVersion: source.mediaVersion,
  };

  const documents: StoredSnapshot[] = [
    stored('season', season, source, generatedAt, staleAfter),
    stored('bootstrap', bootstrap, source, generatedAt, staleAfter),
    stored('home', home, source, generatedAt, staleAfter),
    stored('calendar', calendar, source, generatedAt, staleAfter),
    stored('drivers', drivers, source, generatedAt, staleAfter),
    stored('constructors', constructors, source, generatedAt, staleAfter),
    stored('circuits', circuits, source, generatedAt, staleAfter),
    stored(
      'standings:drivers',
      driverStandings,
      source,
      generatedAt,
      staleAfter,
    ),
    stored(
      'standings:constructors',
      constructorStandings,
      source,
      generatedAt,
      staleAfter,
    ),
    stored(
      'content:manifest',
      manifest,
      source,
      generatedAt,
      addSeconds(generatedAt, 3600),
    ),
  ];

  for (const event of source.calendar) {
    documents.push(
      stored(
        `grand-prix:${event.round}`,
        event,
        source,
        generatedAt,
        staleAfter,
      ),
    );
    const result = source.results.find((item) => item.round === event.round);
    if (result) {
      documents.push(
        stored(
          `grand-prix:${event.round}:results`,
          result,
          source,
          generatedAt,
          staleAfter,
        ),
      );
    }
  }

  for (const driver of source.drivers) {
    documents.push(
      stored(
        `driver:${driver.id}`,
        driverDetail(driver, source),
        source,
        generatedAt,
        staleAfter,
      ),
    );
  }
  for (const constructor of source.constructors) {
    documents.push(
      stored(
        `constructor:${constructor.id}`,
        constructorDetail(constructor, source),
        source,
        generatedAt,
        staleAfter,
      ),
    );
  }
  for (const circuit of source.circuits) {
    documents.push(
      stored(
        `circuit:${circuit.id}`,
        circuitDetail(circuit, source),
        source,
        generatedAt,
        staleAfter,
      ),
    );
  }

  return {
    season: source.season,
    version,
    sourceUpdatedAt: source.sourceUpdatedAt,
    contentVersion: source.contentVersion,
    documents,
  };
}

export function requiredDocumentNames(
  source: ProviderSeasonSource,
): SnapshotDocumentName[] {
  return generateRequiredDocumentNames(
    source.calendar.map((event) => event.round),
    source.drivers.map((driver) => driver.id),
    source.constructors.map((constructor) => constructor.id),
    source.circuits.map((circuit) => circuit.id),
  );
}

export function generateRequiredDocumentNames(
  rounds: number[],
  driverIds: string[],
  constructorIds: string[],
  circuitIds: string[],
): SnapshotDocumentName[] {
  return [
    'season',
    'bootstrap',
    'home',
    'calendar',
    'drivers',
    'constructors',
    'circuits',
    'standings:drivers',
    'standings:constructors',
    'content:manifest',
    ...rounds.flatMap((round) => [
      `grand-prix:${round}` as const,
      `grand-prix:${round}:results` as const,
    ]),
    ...driverIds.map((id) => `driver:${id}` as const),
    ...constructorIds.map((id) => `constructor:${id}` as const),
    ...circuitIds.map((id) => `circuit:${id}` as const),
  ];
}

function seasonData(source: ProviderSeasonSource): Season {
  const rounds = source.calendar.map((event) => event.round);
  const dates = source.calendar
    .flatMap((event) => [event.startDate, event.endDate])
    .filter((date): date is string => date !== null);
  return {
    year: source.season,
    label: source.seasonLabel,
    status: 'active',
    startDate: dates[0] ?? null,
    endDate: dates.at(-1) ?? null,
    roundCount: rounds.length,
    currentRound:
      source.calendar.find((event) => event.status !== 'completed')?.round ??
      null,
    isCurrent: true,
  };
}

function homeData(
  calendar: GrandPrixSummary[],
  events: GrandPrix[],
  driverStandings: ProviderSeasonSource['driverStandings'],
  constructorStandings: ProviderSeasonSource['constructorStandings'],
  freshness: DataFreshness,
): HomeData {
  const featuredEvent =
    calendar.find((event) => event.status !== 'completed') ??
    calendar.at(-1) ??
    null;
  const fullFeatured = events.find(
    (event) => event.round === featuredEvent?.round,
  );
  return {
    freshness,
    featuredEvent,
    featuredSession:
      fullFeatured?.sessions.find((session) => session.type === 'race') ?? null,
    latestCompletedEvent:
      [...calendar].reverse().find((event) => event.status === 'completed') ??
      null,
    driverLeader: driverStandings[0] ?? null,
    constructorLeader: constructorStandings[0] ?? null,
    upcomingEvents: calendar
      .filter((event) => event.status !== 'completed')
      .slice(0, 3),
  };
}

function summaryForEvent(
  event: GrandPrix,
  source: ProviderSeasonSource,
): GrandPrixSummary {
  return {
    id: event.id,
    season: event.season,
    round: event.round,
    eventSlug: event.eventSlug,
    name: event.name,
    circuitId: event.circuitId,
    circuitName:
      source.circuits.find((circuit) => circuit.id === event.circuitId)?.name ??
      null,
    status: event.status,
    format: event.format,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
    hasResults: event.hasResults,
  };
}

function driverDetail(
  driver: Driver,
  source: ProviderSeasonSource,
): DriverDetail {
  const seasonEntry =
    source.driverEntries.find((entry) => entry.driverId === driver.id) ?? null;
  const constructor = seasonEntry
    ? source.constructors.find((item) => item.id === seasonEntry.constructorId)
    : null;
  return {
    driver,
    seasonEntry,
    constructor: constructor ? constructorSummary(constructor) : null,
    standing:
      source.driverStandings.find(
        (standing) => standing.driverId === driver.id,
      ) ?? null,
  };
}

function constructorDetail(
  constructor: Constructor,
  source: ProviderSeasonSource,
): ConstructorDetail {
  const seasonEntry =
    source.constructorEntries.find(
      (entry) => entry.constructorId === constructor.id,
    ) ?? null;
  const lineup = seasonEntry?.driverLineup
    ? seasonEntry.driverLineup.map((id) =>
        driverSummary(requireOne(source.drivers, id, 'driver')),
      )
    : null;
  return {
    constructor,
    seasonEntry,
    standing:
      source.constructorStandings.find(
        (standing) => standing.constructorId === constructor.id,
      ) ?? null,
    lineup,
  };
}

function circuitDetail(
  circuit: Circuit,
  source: ProviderSeasonSource,
): CircuitDetail {
  const event = source.calendar.find((item) => item.circuitId === circuit.id);
  return {
    circuit,
    grandPrix: event ? summaryForEvent(event, source) : null,
  };
}

function driverSummary(driver: Driver): DriverSummary {
  return {
    id: driver.id,
    fullName: driver.fullName,
    shortCode: driver.shortCode,
    permanentNumber: driver.permanentNumber,
    countryCode: driver.countryCode,
  };
}

function constructorSummary(constructor: Constructor): ConstructorSummary {
  return {
    id: constructor.id,
    name: constructor.name,
    shortName: constructor.shortName,
    colorPrimary: constructor.colorPrimary,
  };
}

function circuitSummary(circuit: Circuit): CircuitSummary {
  return {
    id: circuit.id,
    name: circuit.name,
    locality: circuit.locality,
    countryCode: circuit.countryCode,
  };
}

function freshnessFor(
  source: ProviderSeasonSource,
  generatedAt: string,
  staleAfter: string,
): DataFreshness {
  return {
    generatedAt,
    sourceUpdatedAt: source.sourceUpdatedAt,
    staleAfter,
    contentVersion: source.contentVersion,
    stale: false,
  };
}

function stored<T>(
  documentName: SnapshotDocumentName,
  data: T,
  source: ProviderSeasonSource,
  generatedAt: string,
  staleAfter: string,
): StoredSnapshot<T> {
  const base: StoredMeta = {
    apiVersion: '1',
    schemaVersion: 1,
    generatedAt,
    sourceUpdatedAt: source.sourceUpdatedAt,
    staleAfter,
    contentVersion: source.contentVersion,
    ...(documentName === 'content:manifest' ? {} : { season: source.season }),
  };
  return {
    data,
    meta: base,
    documentName,
    resourceIdentity: `v1:${source.season}:${documentName}`,
  };
}

function requireOne<T extends { id: string }>(
  values: T[],
  id: string,
  type: string,
): T {
  const value = values.find((item) => item.id === id);
  if (!value) throw new Error(`Missing ${type} ${id} in mock snapshot source.`);
  return value;
}
