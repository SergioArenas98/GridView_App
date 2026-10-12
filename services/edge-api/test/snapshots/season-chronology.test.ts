import { describe, expect, it } from 'vitest';

import type { EventStatus } from '../../src/contract/enums';
import type {
  GrandPrix,
  GrandPrixSummary,
  HomeData,
  Season,
  Session,
} from '../../src/contract/types';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import { FixedClock } from '../../src/runtime/clock';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import { resolveSeasonChronology } from '../../src/snapshots/season-chronology';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';

// The instant the 2026-10-07 frozen-APK capture was observed.
const CAPTURE_INSTANT = '2026-10-07T22:41:45.852Z';

interface EventShape {
  round: number;
  status?: EventStatus;
  hasResults?: boolean;
  race?: string | null;
  firstSession?: string;
  startDate?: string | null;
  endDate?: string | null;
}

function event(shape: EventShape): GrandPrix {
  const id = `2026-round-${shape.round}-grand-prix`;
  const sessions: Session[] = [];
  if (shape.firstSession !== undefined) {
    sessions.push(session(id, 'practice_1', shape.firstSession));
  }
  if (shape.race !== null && shape.race !== undefined) {
    sessions.push(session(id, 'race', shape.race));
  }
  return {
    id,
    season: 2026,
    round: shape.round,
    eventSlug: `round-${shape.round}-grand-prix`,
    name: `Round ${shape.round} Grand Prix`,
    officialName: null,
    circuitId: 'monza',
    status: shape.status ?? 'unknown',
    format: 'unknown',
    startDate: shape.startDate ?? null,
    endDate: shape.endDate ?? null,
    timezone: null,
    sessions,
    hasResults: shape.hasResults ?? false,
    media: null,
  };
}

function session(
  grandPrixId: string,
  type: Session['type'],
  startTime: string,
): Session {
  return {
    id: `${grandPrixId}-${type}`,
    type,
    name: null,
    startTime,
    endTime: null,
    status: 'unknown',
  };
}

/**
 * A Jolpica-shaped season as A6-A8 publish it: every status `unknown`, no
 * weekend dates, one explicit race start per round, classified rounds 1-16.
 * Race starts are synthetic: fortnightly from 2026-03-08 for rounds 1-16
 * (round 16 on 2026-10-04), then fortnightly from 2026-10-11 for rounds 17-23,
 * so the capture instant falls between round 16 and round 17.
 */
function jolpicaShapedSeason(classifiedThrough = 16): GrandPrix[] {
  return Array.from({ length: 23 }, (_, index) => {
    const round = index + 1;
    return event({
      round,
      hasResults: round <= classifiedThrough,
      race: raceStart(round),
    });
  });
}

function raceStart(round: number): string {
  if (round <= 16) {
    return new Date(Date.UTC(2026, 2, 8 + (round - 1) * 14, 13)).toISOString();
  }
  return new Date(Date.UTC(2026, 9, 11 + (round - 17) * 14, 12)).toISOString();
}

const rounds = (events: readonly (GrandPrix | null)[]): (number | null)[] =>
  events.map((item) => item?.round ?? null);

describe('resolveSeasonChronology', () => {
  it('at the capture instant: next race 17, latest classified 16, never round 1', () => {
    const chronology = resolveSeasonChronology(
      jolpicaShapedSeason(),
      CAPTURE_INSTANT,
    );

    expect(chronology.featured?.round).toBe(17);
    expect(chronology.latestSettled?.round).toBe(16);
    expect(rounds(chronology.ahead.slice(0, 3))).toEqual([17, 18, 19]);
    expect(rounds(chronology.ahead)).not.toContain(1);
    // Settling reads hasResults; it never rewrites the published status.
    expect(chronology.latestSettled?.status).toBe('unknown');
  });

  it('pre-season: the first race is next and nothing is settled', () => {
    const chronology = resolveSeasonChronology(
      jolpicaShapedSeason(0),
      '2026-02-01T00:00:00.000Z',
    );

    expect(chronology.featured?.round).toBe(1);
    expect(chronology.latestSettled).toBeNull();
    expect(rounds(chronology.ahead.slice(0, 3))).toEqual([1, 2, 3]);
  });

  it('a weekend in progress stays the next race until its race starts', () => {
    const events = [
      event({ round: 16, hasResults: true, race: '2026-09-27T11:00:00Z' }),
      event({
        round: 17,
        firstSession: '2026-10-09T09:30:00Z',
        race: '2026-10-11T12:00:00Z',
      }),
      event({ round: 18, race: '2026-10-25T20:00:00Z' }),
    ];

    const saturday = resolveSeasonChronology(events, '2026-10-10T15:00:00Z');
    expect(saturday.featured?.round).toBe(17);
    expect(saturday.latestSettled?.round).toBe(16);
  });

  it('a race that has started without a classification is neither next nor latest', () => {
    const events = [
      event({ round: 16, hasResults: true, race: '2026-09-27T11:00:00Z' }),
      event({ round: 17, race: '2026-10-11T12:00:00Z' }),
      event({ round: 18, race: '2026-10-25T20:00:00Z' }),
    ];

    const chronology = resolveSeasonChronology(events, '2026-10-11T12:30:00Z');

    expect(chronology.featured?.round).toBe(18);
    expect(chronology.latestSettled?.round).toBe(16);
    expect(rounds(chronology.ahead)).toEqual([18]);
  });

  it('an aging reading of the same capture moves on without completing anything', () => {
    // Five days after the capture, round 17's race start has passed and the
    // frozen data still has no classification for it.
    const chronology = resolveSeasonChronology(
      jolpicaShapedSeason(),
      '2026-10-12T09:00:00.000Z',
    );

    expect(chronology.featured?.round).toBe(18);
    expect(chronology.latestSettled?.round).toBe(16);
    expect(rounds(chronology.ahead)).not.toContain(17);
  });

  it('missing session times: undated events follow the last settled round', () => {
    const events = Array.from({ length: 6 }, (_, index) =>
      event({ round: index + 1, hasResults: index < 3, race: null }),
    );

    const chronology = resolveSeasonChronology(events, CAPTURE_INSTANT);

    expect(chronology.featured?.round).toBe(4);
    expect(chronology.latestSettled?.round).toBe(3);
    expect(rounds(chronology.ahead)).toEqual([4, 5, 6]);
  });

  it('missing session times: a published weekend date still places the event', () => {
    const events = [
      event({ round: 1, startDate: '2026-03-06', endDate: '2026-03-08' }),
      event({ round: 2, startDate: '2026-10-09', endDate: '2026-10-11' }),
    ];

    const chronology = resolveSeasonChronology(events, CAPTURE_INSTANT);

    expect(chronology.featured?.round).toBe(2);
    expect(chronology.latestSettled).toBeNull();
  });

  it('a season with no future races features the latest classified event', () => {
    const chronology = resolveSeasonChronology(
      jolpicaShapedSeason(23),
      '2027-02-01T00:00:00.000Z',
    );

    expect(chronology.ahead).toEqual([]);
    expect(chronology.featured?.round).toBe(23);
    expect(chronology.latestSettled?.round).toBe(23);
  });

  it('an unknown season with nothing ahead and nothing settled features nothing', () => {
    const chronology = resolveSeasonChronology(
      jolpicaShapedSeason(0),
      '2027-02-01T00:00:00.000Z',
    );

    expect(chronology.ahead).toEqual([]);
    expect(chronology.featured).toBeNull();
    expect(chronology.latestSettled).toBeNull();
  });

  it('authoritative statuses keep their rule whatever the clock says', () => {
    const events = [
      event({ round: 12, status: 'completed', race: '2026-07-12T13:00:00Z' }),
      event({ round: 13, status: 'upcoming', race: '2026-07-26T13:00:00Z' }),
      event({ round: 14, status: 'scheduled', race: '2026-08-09T13:00:00Z' }),
      event({ round: 15, status: 'postponed', race: null }),
      event({ round: 16, status: 'cancelled', race: null }),
    ];

    // Months after every listed race start: authoritative `upcoming` and
    // `scheduled` events are not demoted by elapsed time.
    const chronology = resolveSeasonChronology(events, CAPTURE_INSTANT);

    expect(chronology.featured?.round).toBe(13);
    expect(chronology.latestSettled?.round).toBe(12);
    expect(rounds(chronology.ahead)).toEqual([13, 14, 15, 16]);
  });

  it('an authoritative in_progress event is featured', () => {
    const events = [
      event({ round: 16, status: 'completed', hasResults: true }),
      event({ round: 17, status: 'in_progress', race: '2026-10-11T12:00:00Z' }),
      event({ round: 18, status: 'scheduled' }),
    ];

    const chronology = resolveSeasonChronology(events, '2026-10-11T14:00:00Z');

    expect(chronology.featured?.round).toBe(17);
  });

  it('an authoritative completed season keeps featuring its final event', () => {
    const events = [
      event({ round: 1, status: 'completed' }),
      event({ round: 2, status: 'completed' }),
    ];

    expect(
      resolveSeasonChronology(events, CAPTURE_INSTANT).featured?.round,
    ).toBe(2);
  });
});

describe('generated Home for a Jolpica-shaped season', () => {
  it('names round 17 next and round 16 latest, and keeps every status unknown', async () => {
    const set = await jolpicaShapedSet();
    const home = documentData<HomeData>(set, 'home');
    const season = documentData<Season>(set, 'season');
    const calendar = documentData<GrandPrixSummary[]>(set, 'calendar');

    expect(home.featuredEvent?.round).toBe(17);
    expect(home.featuredSession?.type).toBe('race');
    expect(home.featuredSession?.startTime).toBe(raceStart(17));
    expect(home.latestCompletedEvent?.round).toBe(16);
    expect(home.latestCompletedEvent?.status).toBe('unknown');
    expect(home.latestCompletedEvent?.hasResults).toBe(true);
    expect(home.upcomingEvents.map((item) => item.round)).toEqual([17, 18, 19]);
    expect(season.currentRound).toBe(17);
    // No date is manufactured and no status is promoted.
    expect(season.startDate).toBeNull();
    expect(season.endDate).toBeNull();
    for (const summary of calendar) {
      expect(summary.status).toBe('unknown');
      expect(summary.startDate).toBeNull();
      expect(summary.endDate).toBeNull();
    }
    // Home and the bootstrap's embedded Home are one value.
    expect(documentData<{ home: HomeData }>(set, 'bootstrap').home).toEqual(
      home,
    );
    for (const document of set.documents) {
      expect(runtimeSnapshotValidator.validate(document)).toEqual([]);
    }
  });
});

async function jolpicaShapedSet() {
  const clock = new FixedClock(new Date(CAPTURE_INSTANT));
  const provider = new MockFormulaOneProvider({
    clock,
    sourceUpdatedAt: '2026-10-07T22:41:00.000Z',
  });
  const mock = await provider.fetchSeasonSource(2026, [
    'season-calendar',
    'event-schedule',
    'profiles',
    'standings',
    'results',
    'home-rebuild',
  ]);
  const circuitId = mock.calendar[0]!.circuitId;
  const calendar = jolpicaShapedSeason().map((item) => ({
    ...item,
    circuitId,
  }));
  return generateSnapshotSet(
    { ...mock, calendar, results: [] },
    CAPTURE_INSTANT,
    'test-version',
  );
}

function documentData<T>(
  set: Awaited<ReturnType<typeof jolpicaShapedSet>>,
  name: string,
): T {
  const document = set.documents.find((item) => item.documentName === name);
  if (document === undefined) throw new Error(`missing ${name}`);
  return document.data as T;
}
