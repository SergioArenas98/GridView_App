import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { EventStatus } from '../../src/contract/enums';
import type {
  GrandPrix,
  HomeData,
  Season,
  Session,
} from '../../src/contract/types';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import { FixedClock } from '../../src/runtime/clock';
import { generateSnapshotSet } from '../../src/snapshots/generator';

// The same cases drive the Flutter Home/Calendar test
// (test/database/cross_layer_chronology_test.dart), so the generator and the
// phone are held to one set of expectations (ADR 0022 A11).
const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(
  here,
  '..',
  '..',
  '..',
  '..',
  'test',
  'fixtures',
  'chronology',
  'cross_layer_cases.json',
);

interface FixtureEvent {
  round: number;
  status: EventStatus;
  hasResults: boolean;
  startDate: string | null;
  endDate: string | null;
  race: string | null;
}

interface FixtureCase {
  name: string;
  referenceInstant: string;
  events: FixtureEvent[];
  server: {
    featuredRound: number | null;
    currentRound: number | null;
    latestRound: number | null;
    upcomingRounds: number[];
  };
}

const { cases } = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  cases: FixtureCase[];
};

function grandPrix(event: FixtureEvent, circuitId: string): GrandPrix {
  const id = `2026-round-${event.round}-grand-prix`;
  const sessions: Session[] =
    event.race === null
      ? []
      : [
          {
            id: `${id}-race`,
            type: 'race',
            name: null,
            startTime: event.race,
            endTime: null,
            status: 'unknown',
          },
        ];
  return {
    id,
    season: 2026,
    round: event.round,
    eventSlug: `round-${event.round}-grand-prix`,
    name: `Round ${event.round} Grand Prix`,
    officialName: null,
    circuitId,
    status: event.status,
    format: 'unknown',
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: null,
    sessions,
    hasResults: event.hasResults,
    media: null,
  };
}

async function generate(testCase: FixtureCase) {
  const clock = new FixedClock(new Date(testCase.referenceInstant));
  const provider = new MockFormulaOneProvider({
    clock,
    sourceUpdatedAt: testCase.referenceInstant,
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
  const set = generateSnapshotSet(
    {
      ...mock,
      calendar: testCase.events.map((event) => grandPrix(event, circuitId)),
      results: [],
    },
    testCase.referenceInstant,
    'test-version',
  );
  const data = <T>(name: string): T =>
    set.documents.find((document) => document.documentName === name)!.data as T;
  return { home: data<HomeData>('home'), season: data<Season>('season') };
}

describe('cross-layer chronology cases (generator side)', () => {
  it('loads the shared cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(4);
  });

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const { home, season } = await generate(testCase);

      expect(home.featuredEvent?.round ?? null).toBe(
        testCase.server.featuredRound,
      );
      expect(season.currentRound).toBe(testCase.server.currentRound);
      expect(home.latestCompletedEvent?.round ?? null).toBe(
        testCase.server.latestRound,
      );
      expect(home.upcomingEvents.map((event) => event.round)).toEqual(
        testCase.server.upcomingRounds,
      );
      // The featured race session is what the phone stores for the focus.
      expect(home.featuredSession?.type ?? null).toBe(
        home.featuredEvent === null ? null : 'race',
      );
      // Published statuses are carried through unchanged.
      for (const summary of home.upcomingEvents) {
        const source = testCase.events.find(
          (event) => event.round === summary.round,
        );
        expect(summary.status).toBe(source?.status);
      }
      if (home.latestCompletedEvent !== null) {
        const source = testCase.events.find(
          (event) => event.round === home.latestCompletedEvent?.round,
        );
        expect(home.latestCompletedEvent.status).toBe(source?.status);
      }
    });
  }
});
