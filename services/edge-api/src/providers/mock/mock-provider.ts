import type {
  Circuit,
  Constructor,
  ConstructorSeasonEntry,
  ConstructorStanding,
  Driver,
  DriverSeasonEntry,
  DriverStanding,
  GrandPrix,
  MediaAsset,
  RaceResult,
  Session,
} from '../../contract/types';
import type { Clock } from '../../runtime/clock';
import { addSeconds } from '../../runtime/clock';
import type { QuotaState, SyncJobCategory } from '../../storage/types';
import {
  ProviderError,
  ProviderRateLimitedError,
  type FormulaOneProvider,
  type ProviderSeasonSource,
  type ProviderStatus,
} from '../formula-one-provider';

import driversRegistry from '../../../../../content/registries/drivers.mock.json';
import constructorsRegistry from '../../../../../content/registries/constructors.mock.json';
import circuitsRegistry from '../../../../../content/registries/circuits.mock.json';
import driverEntriesContent from '../../../../../content/seasons/2026/driver-entries.mock.json';
import constructorEntriesContent from '../../../../../content/seasons/2026/constructor-entries.mock.json';
import mediaContent from '../../../../../content/media/media-assets.mock.json';

export type MockFailureMode = 'none' | 'failure' | 'rate_limited';

export interface MockProviderOptions {
  clock: Clock;
  failureMode?: MockFailureMode;
  invalidData?: boolean;
  quota?: QuotaState;
  sourceUpdatedAt?: string;
  contentVersion?: string;
}

type RegistryDriver = Omit<Driver, 'media'>;
type RegistryConstructor = Omit<Constructor, 'media'>;
type RegistryCircuit = Omit<Circuit, 'media'>;

export class MockFormulaOneProvider implements FormulaOneProvider {
  readonly name = 'mock-development-provider';
  callCount = 0;

  constructor(private readonly options: MockProviderOptions) {}

  async fetchSeasonSource(
    season: number,
    jobs: SyncJobCategory[],
  ): Promise<ProviderSeasonSource> {
    this.callCount += 1;
    if (this.options.failureMode === 'rate_limited') {
      throw new ProviderRateLimitedError(
        addSeconds(this.options.clock.now(), 60),
      );
    }
    if (this.options.failureMode === 'failure') {
      throw new ProviderError('mock-provider-failure');
    }
    if (season !== 2026) {
      throw new ProviderError('season-not-supported');
    }

    const quota = quotaWithUsage(this.defaultQuota(), jobs, this.options.clock);
    const drivers = withDriverMedia(
      clone(
        (driversRegistry as unknown as { drivers: RegistryDriver[] }).drivers,
      ),
    );
    const constructors = withConstructorMedia(
      clone(
        (
          constructorsRegistry as unknown as {
            constructors: RegistryConstructor[];
          }
        ).constructors,
      ),
    );
    const circuits = withCircuitMedia(
      clone(
        (circuitsRegistry as unknown as { circuits: RegistryCircuit[] })
          .circuits,
      ),
    );
    const source: ProviderSeasonSource = {
      season,
      contentVersion: this.options.contentVersion ?? '2026.07.18.1',
      mediaVersion: this.options.contentVersion ?? '2026.07.18.1',
      attributionVersion: '1',
      sourceUpdatedAt:
        this.options.sourceUpdatedAt ?? '2026-07-18T11:55:00.000Z',
      seasonLabel: '2026 FIA Formula One World Championship (mock)',
      calendar: buildCalendar(),
      results: buildResults(),
      drivers,
      constructors,
      circuits,
      driverEntries: clone(
        (driverEntriesContent as { entries: DriverSeasonEntry[] }).entries,
      ),
      constructorEntries: clone(
        (constructorEntriesContent as { entries: ConstructorSeasonEntry[] })
          .entries,
      ),
      driverStandings: buildDriverStandings(),
      constructorStandings: buildConstructorStandings(),
      quota,
    };

    if (this.options.invalidData) {
      (source.calendar[0] as GrandPrix & { providerId: string }).providerId =
        'mock-event-invalid';
    }
    return source;
  }

  async getProviderStatus(): Promise<ProviderStatus> {
    if (this.options.failureMode === 'rate_limited') {
      return { status: 'rate_limited', quota: this.defaultQuota('critical') };
    }
    if (this.options.failureMode === 'failure') {
      return { status: 'unavailable', quota: this.defaultQuota('unknown') };
    }
    return { status: 'ok', quota: this.defaultQuota() };
  }

  private defaultQuota(
    warningLevel: QuotaState['warningLevel'] = 'normal',
  ): QuotaState {
    return (
      this.options.quota ?? {
        dailyLimit: 1000,
        dailyRemaining: 900,
        perMinuteLimit: 60,
        perMinuteRemaining: 55,
        lastProviderSuccessAt: null,
        lastProviderFailureAt: null,
        retryAfter: null,
        usageByJobCategory: {},
        warningLevel,
      }
    );
  }
}

function sessions(grandPrixId: string, sprint: boolean): Session[] {
  const standard: Session[] = [
    session(grandPrixId, 'practice_1', 'Practice 1', '2026-07-10T11:30:00Z'),
    session(grandPrixId, 'practice_2', 'Practice 2', '2026-07-10T15:00:00Z'),
    session(grandPrixId, 'practice_3', 'Practice 3', '2026-07-11T10:30:00Z'),
    session(grandPrixId, 'qualifying', 'Qualifying', '2026-07-11T14:00:00Z'),
    session(grandPrixId, 'race', 'Race', '2026-07-12T13:00:00Z'),
  ];
  if (!sprint) return standard;
  return [
    session(grandPrixId, 'practice_1', 'Practice 1', '2026-07-24T11:30:00Z'),
    session(
      grandPrixId,
      'sprint_qualifying',
      'Sprint Qualifying',
      '2026-07-24T15:30:00Z',
    ),
    session(grandPrixId, 'sprint', 'Sprint', '2026-07-25T10:00:00Z'),
    session(grandPrixId, 'qualifying', 'Qualifying', '2026-07-25T14:00:00Z'),
    session(grandPrixId, 'race', 'Race', '2026-07-26T13:00:00Z'),
  ];
}

function session(
  grandPrixId: string,
  type: Session['type'],
  name: string,
  startTime: string,
): Session {
  return {
    id: `${grandPrixId}-${type.replaceAll('_', '-')}`,
    type,
    name,
    startTime,
    endTime: null,
    status: 'scheduled',
  };
}

function buildCalendar(): GrandPrix[] {
  const italianId = '2026-italian-grand-prix';
  const belgianId = '2026-belgian-grand-prix';
  return [
    {
      id: italianId,
      season: 2026,
      round: 12,
      eventSlug: 'italian-grand-prix',
      name: 'Italian Grand Prix',
      officialName: 'Mock Italian Grand Prix',
      circuitId: 'monza',
      status: 'completed',
      format: 'standard',
      startDate: '2026-07-10',
      endDate: '2026-07-12',
      timezone: 'Europe/Rome',
      sessions: sessions(italianId, false).map((item) => ({
        ...item,
        status: 'completed',
      })),
      hasResults: true,
      media: null,
    },
    {
      id: belgianId,
      season: 2026,
      round: 13,
      eventSlug: 'belgian-grand-prix',
      name: 'Belgian Grand Prix',
      officialName: 'Mock Belgian Grand Prix',
      circuitId: 'spa-francorchamps',
      status: 'upcoming',
      format: 'sprint',
      startDate: '2026-07-24',
      endDate: '2026-07-26',
      timezone: 'Europe/Brussels',
      sessions: sessions(belgianId, true),
      hasResults: false,
      media: null,
    },
    {
      id: '2026-british-grand-prix',
      season: 2026,
      round: 14,
      eventSlug: 'british-grand-prix',
      name: 'British Grand Prix',
      officialName: 'Mock British Grand Prix',
      circuitId: 'silverstone',
      status: 'upcoming',
      format: 'standard',
      startDate: '2026-08-07',
      endDate: '2026-08-09',
      timezone: 'Europe/London',
      sessions: sessions('2026-british-grand-prix', false),
      hasResults: false,
      media: null,
    },
    {
      id: '2026-japanese-grand-prix',
      season: 2026,
      round: 15,
      eventSlug: 'japanese-grand-prix',
      name: 'Japanese Grand Prix',
      officialName: 'Mock Japanese Grand Prix',
      circuitId: 'suzuka',
      status: 'postponed',
      format: 'standard',
      startDate: null,
      endDate: null,
      timezone: 'Asia/Tokyo',
      sessions: [],
      hasResults: false,
      media: null,
    },
    {
      id: '2026-australian-grand-prix',
      season: 2026,
      round: 16,
      eventSlug: 'australian-grand-prix',
      name: 'Australian Grand Prix',
      officialName: 'Mock Australian Grand Prix',
      circuitId: 'albert-park',
      status: 'cancelled',
      format: 'standard',
      startDate: null,
      endDate: null,
      timezone: 'Australia/Melbourne',
      sessions: [],
      hasResults: false,
      media: null,
    },
  ];
}

function buildResults(): RaceResult[] {
  const calendar = buildCalendar();
  return calendar.map((event) => {
    if (event.hasResults) {
      return {
        id: `${event.id}-race-results`,
        season: event.season,
        round: event.round,
        grandPrixId: event.id,
        sessionType: 'race',
        status: 'final',
        entries: [
          resultEntry('max-verstappen', 'red-bull', 1, 1, 25, 4512345, null),
          resultEntry('lando-norris', 'mclaren', 2, 3, 18, null, 3456),
          resultEntry('oscar-piastri', 'mclaren', 3, 2, 15.5, null, 6789),
          {
            ...resultEntry(
              'charles-leclerc',
              'ferrari',
              4,
              4,
              null,
              null,
              null,
            ),
            status: 'lapped',
            lapsBehind: 1,
          },
          {
            ...resultEntry(
              'lewis-hamilton',
              'ferrari',
              null,
              5,
              null,
              null,
              null,
            ),
            status: 'dnf',
            dnfReason: 'Power unit (mock)',
          },
        ],
        fastestLap: { driverId: 'lando-norris', timeMillis: 91456, lap: 42 },
      };
    }
    return {
      id: `${event.id}-race-results`,
      season: event.season,
      round: event.round,
      grandPrixId: event.id,
      sessionType: 'race',
      status: 'unavailable',
      entries: [],
      fastestLap: null,
    };
  });
}

function resultEntry(
  driverId: string,
  constructorId: string,
  position: number | null,
  gridPosition: number | null,
  points: number | null,
  elapsedTimeMillis: number | null,
  gapToLeaderMillis: number | null,
): RaceResult['entries'][number] {
  return {
    driverId,
    constructorId,
    position,
    gridPosition,
    points,
    status: 'finished',
    laps: 53,
    elapsedTimeMillis,
    gapToLeaderMillis,
    lapsBehind: null,
    fastestLap: driverId === 'lando-norris',
    dnfReason: null,
    gapText: null,
  };
}

function buildDriverStandings(): DriverStanding[] {
  return [
    standing('max-verstappen', 'red-bull', 1, 210.5, 6, 9),
    standing('lando-norris', 'mclaren', 2, 198, 5, 8),
    standing('oscar-piastri', 'mclaren', 3, 192.5, 2, 7),
    standing('charles-leclerc', 'ferrari', 4, 165, 1, 5),
    standing('lewis-hamilton', 'ferrari', 5, 121, 0, 3),
    standing('george-russell', 'mercedes', 6, 98, 0, 2),
    standing('franco-colapinto', 'alpine', null, 0, 0, 0, true),
  ];
}

function standing(
  driverId: string,
  constructorId: string,
  position: number | null,
  points: number,
  wins: number,
  podiums: number,
  provisional = false,
): DriverStanding {
  return {
    season: 2026,
    driverId,
    constructorId,
    position,
    points,
    wins,
    podiums,
    provisional,
  };
}

function buildConstructorStandings(): ConstructorStanding[] {
  return [
    constructorStanding('mclaren', 1, 390.5, 7),
    constructorStanding('ferrari', 2, 286, 1),
    constructorStanding('red-bull', 3, 240.5, 6),
    constructorStanding('mercedes', 4, 160, 0),
    constructorStanding('alpine', 5, 12, 0, true),
  ];
}

function constructorStanding(
  constructorId: string,
  position: number,
  points: number,
  wins: number,
  provisional = false,
): ConstructorStanding {
  return { season: 2026, constructorId, position, points, wins, provisional };
}

function quotaWithUsage(
  quota: QuotaState,
  jobs: SyncJobCategory[],
  clock: Clock,
): QuotaState {
  const usageByJobCategory = { ...quota.usageByJobCategory };
  for (const job of jobs) {
    usageByJobCategory[job] = (usageByJobCategory[job] ?? 0) + 1;
  }
  return {
    ...quota,
    lastProviderSuccessAt: clock.now().toISOString(),
    usageByJobCategory,
  };
}

function withDriverMedia(drivers: RegistryDriver[]): Driver[] {
  return drivers.map((driver) => ({
    ...driver,
    media: mediaFor('driver', driver.id),
  }));
}

function withConstructorMedia(
  constructors: RegistryConstructor[],
): Constructor[] {
  return constructors.map((constructor) => ({
    ...constructor,
    media: mediaFor('constructor', constructor.id),
  }));
}

function withCircuitMedia(circuits: RegistryCircuit[]): Circuit[] {
  return circuits.map((circuit) => ({
    ...circuit,
    media: mediaFor('circuit', circuit.id),
  }));
}

function mediaFor(entityType: string, entityId: string): MediaAsset[] | null {
  const assets = (mediaContent as { assets: unknown[] }).assets.filter(
    (asset) =>
      typeof asset === 'object' &&
      asset !== null &&
      (asset as { entityType?: string }).entityType === entityType &&
      (asset as { entityId?: string }).entityId === entityId,
  );
  return assets.length > 0 ? (clone(assets) as MediaAsset[]) : null;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
