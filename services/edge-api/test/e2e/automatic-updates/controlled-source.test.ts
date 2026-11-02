/**
 * The controlled provider source (ADR 0028 D10): its transport, its fence,
 * and the staging demonstration it serves, played through the real Worker
 * from the same documents an operator would load into the demonstration
 * Worker's KV namespace.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../../../src/index';
import { ConfigurationError } from '../../../src/config/environment';
import {
  CONTROLLED_SOURCE_KEY_PREFIX,
  MAX_CONTROLLED_VERSIONS,
  controlledSourceKey,
  controlledSourceTransport,
  decodeControlledDocument,
  resolveControlledProviderSource,
  versionAt,
} from '../../../src/providers/controlled/source';
import { createHarness, request } from '../../support/edge-harness';
import {
  MemoryKv,
  RESULT_HOLD_AFTER_HOURS,
  controlledPaths,
  controlledSeasonDocuments,
  demonstrationPhases,
  shiftedRaceStart,
} from './controlled-season';
import {
  AutomaticUpdateStage,
  DAY,
  HOUR,
  MINUTE,
  type TickRecord,
} from './stage';

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(globalFetch).not.toHaveBeenCalled();
});

const RACES = 'https://api.jolpi.ca/ergast/f1/2026/races/?limit=100';
const doc = (versions: unknown) => ({ schemaVersion: 1, versions });

describe('the controlled source transport', () => {
  it('keys only the pinned Jolpica path, by path and query', () => {
    expect(controlledSourceKey(RACES)).toBe(
      `${CONTROLLED_SOURCE_KEY_PREFIX}/ergast/f1/2026/races/?limit=100`,
    );
    for (const url of [
      'https://example.com/ergast/f1/2026/races/',
      'http://api.jolpi.ca/ergast/f1/2026/races/',
      'https://api.jolpi.ca/other/2026/races/',
      'https://user:pw@api.jolpi.ca/ergast/f1/2026/races/',
      'not a url',
    ]) {
      expect(controlledSourceKey(url), url).toBeNull();
    }
  });

  it('accepts exactly a schema-1 document with increasing instants', () => {
    const good = doc([
      { from: '1970-01-01T00:00:00.000Z', status: 200, body: { a: 1 } },
      { from: '2026-11-15T16:00:00.000Z', status: 200, body: { a: 2 } },
    ]);
    expect(decodeControlledDocument(good)).toEqual(good);
    for (const bad of [
      null,
      [],
      { schemaVersion: 2, versions: [] },
      doc([]),
      { ...good, extra: true },
      doc([{ from: '2026-11-15', status: 200, body: {} }]),
      doc([{ from: '2026-11-15T16:00:00Z', status: 200, body: {} }]),
      doc([
        { from: '2026-11-15T16:00:00.000Z', status: 200, body: {} },
        { from: '2026-11-15T16:00:00.000Z', status: 200, body: {} },
      ]),
      doc([{ from: '1970-01-01T00:00:00.000Z', status: 99, body: {} }]),
      doc([{ from: '1970-01-01T00:00:00.000Z', status: 204, body: {} }]),
      doc([{ from: '1970-01-01T00:00:00.000Z', status: 304, body: {} }]),
      doc([{ from: '1970-01-01T00:00:00.000Z', status: 301, body: {} }]),
      doc([{ from: '1970-01-01T00:00:00.000Z', status: 200 }]),
      doc(
        Array.from({ length: MAX_CONTROLLED_VERSIONS + 1 }, (_, index) => ({
          from: new Date(index * 1000).toISOString(),
          status: 200,
          body: {},
        })),
      ),
    ]) {
      expect(decodeControlledDocument(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('serves the version in force at the clock reading', async () => {
    const kv = new MemoryKv();
    const document = doc([
      { from: '1970-01-01T00:00:00.000Z', status: 200, body: { v: 'empty' } },
      { from: '2026-11-15T16:00:00.000Z', status: 200, body: { v: 'result' } },
    ]);
    kv.values.set(controlledSourceKey(RACES)!, JSON.stringify(document));
    let now = new Date('2026-11-15T15:59:59.999Z');
    const transport = controlledSourceTransport(kv, () => now);

    expect(await (await transport(new Request(RACES))).json()).toEqual({
      v: 'empty',
    });
    now = new Date('2026-11-15T16:00:00.000Z');
    const answer = await transport(new Request(RACES));
    expect(answer.status).toBe(200);
    expect(answer.headers.get('Content-Type')).toBe('application/json');
    expect(await answer.json()).toEqual({ v: 'result' });
    expect(
      versionAt(decodeControlledDocument(document)!, new Date(0 - 1)),
    ).toBeNull();
  });

  it('fails closed: absent, malformed, unreadable, off-path and non-GET', async () => {
    const kv = new MemoryKv();
    kv.values.set(controlledSourceKey(RACES)!, JSON.stringify({ nope: true }));
    const transport = controlledSourceTransport(kv, () => new Date());
    expect((await transport(new Request(RACES))).status).toBe(503);
    expect(
      (await transport(new Request(RACES.replace('races', 'circuits')))).status,
    ).toBe(404);
    expect((await transport(new Request('https://example.com/x'))).status).toBe(
      404,
    );
    expect(
      (await transport(new Request(RACES, { method: 'POST' }))).status,
    ).toBe(404);
    const unreadable = controlledSourceTransport(
      { get: async () => Promise.reject(new Error('kv down')) },
      () => new Date(),
    );
    expect((await unreadable(new Request(RACES))).status).toBe(503);
  });
});

describe('the controlled source fence', () => {
  it('is admitted only as `kv` in a coordinated staging Worker', () => {
    expect(
      resolveControlledProviderSource(undefined, 'production', 'none'),
    ).toBe('none');
    expect(resolveControlledProviderSource('', 'staging', 'none')).toBe('none');
    expect(
      resolveControlledProviderSource('kv', 'staging', 'coordinated'),
    ).toBe('kv');
    for (const [value, environment, mode] of [
      ['kv', 'production', 'coordinated'],
      ['kv', 'production', 'none'],
      ['kv', 'development', 'mock'],
      ['kv', 'staging', 'none'],
      ['kv', 'staging', 'mock'],
      ['KV', 'staging', 'coordinated'],
      ['network', 'staging', 'coordinated'],
    ] as const) {
      expect(
        () => resolveControlledProviderSource(value, environment, mode),
        `${value} ${environment} ${mode}`,
      ).toThrow(ConfigurationError);
    }
  });

  it('makes a production Worker that selects it fail closed on every request', async () => {
    const harness = createHarness({
      environment: 'production',
      providerMode: 'none',
    });
    harness.env.PUBLIC_BASE_URL = 'https://api.gridview.test';
    harness.env.CONTROLLED_PROVIDER_SOURCE = 'kv';
    const response = await worker.fetch(request('/v1/status'), harness.env);
    expect(response.status).toBe(500);
    expect(harness.logger.events).toEqual([
      expect.objectContaining({
        operation: 'request.failed',
        failureCategory: 'configuration',
      }),
    ]);
  });
});

describe('the staging demonstration, from the documents an operator loads', () => {
  const RACE_START = '2026-11-15T14:00:00.000Z';
  const options = {
    raceRound: 22,
    raceStart: RACE_START,
    correction: { afterHours: 8, variant: 'B' as const },
  };

  it('builds one bounded document per requested resource', async () => {
    const documents = await controlledSeasonDocuments(options);
    expect(documents.size).toBe(controlledPaths().length);
    for (const [key, document] of documents) {
      expect(decodeControlledDocument(document), key).not.toBeNull();
    }
    const results = documents.get(
      `${CONTROLLED_SOURCE_KEY_PREFIX}/ergast/f1/2026/22/results/?limit=100`,
    )!;
    // Empty, then the result two hours in, then the correction.
    expect(results.versions.map((version) => version.from)).toEqual([
      '1970-01-01T00:00:00.000Z',
      '2026-11-15T16:00:00.000Z',
      '2026-11-15T22:00:00.000Z',
    ]);
    const calendar = documents.get(
      `${CONTROLLED_SOURCE_KEY_PREFIX}/ergast/f1/2026/races/?limit=100`,
    )!;
    expect(calendar.versions).toHaveLength(1);
    expect(shiftedRaceStart(options, 22)).toBe(RACE_START);
    // The whole load stays far below a KV value's 25 MiB.
    const bytes = [...documents.values()].reduce(
      (sum, document) => sum + JSON.stringify(document).length,
      0,
    );
    expect(bytes).toBeLessThan(2 * 1024 * 1024);
  });

  it('publishes the first release from genesis, then the race result and its correction, hands-free', async () => {
    const kv = new MemoryKv().load(await controlledSeasonDocuments(options));
    const stage = await AutomaticUpdateStage.create('demonstration', {
      controlledSource: kv,
    });
    const tickAt = (hours: number) =>
      new Date(
        Date.parse(RACE_START) + hours * HOUR + 17 * MINUTE,
      ).toISOString();

    // Loaded three hours before the race: bootstrap, then the first release.
    await stage.hourly(tickAt(-3), tickAt(-1));
    expect(stage.releases()).toHaveLength(1);
    expect(
      (await stage.fetch('/v1/seasons/2026/grand-prix/21/results')).status,
    ).toBe(200);
    expect(
      (await stage.fetch('/v1/seasons/2026/grand-prix/22/results')).status,
    ).toBe(404);

    const weekend = await stage.hourly(tickAt(0), tickAt(16));
    const published = weekend
      .filter((tick) => tick.releasesAfter > tick.releasesBefore)
      .map((tick) => tick.at);
    // At the race start, a run that was due anyway (the daily checks of
    // rounds 20 and 21) regenerates Home, whose featured event moves on to
    // the next round: new content, so a new release. Then the result:
    // sighted at its first check (+ 2 h 17 min, the first tick at or after
    // + 1 h 30 min) and published when the next hourly tick sees it again
    // (AU-D5); and the correction: sighted at the + 9 h 30 min confirmation,
    // pending, and corroborated on the next hourly tick.
    expect(published).toEqual([tickAt(0), tickAt(3), tickAt(11)]);
    const home = (await (await stage.fetch('/v1/home?season=2026')).json()) as {
      data: { featuredEvent: { round: number } };
    };
    expect(home.data.featuredEvent.round).toBe(23);
    const results = (await (
      await stage.fetch('/v1/seasons/2026/grand-prix/22/results')
    ).json()) as { data: { entries: { position: number; points: number }[] } };
    expect(
      results.data.entries.find((entry) => entry.position === 1)?.points,
    ).toBe(26);
    expect(kv.reads).toBeGreaterThan(0);
    expect(stage.workerRequests.every((path) => path.startsWith('/v1/'))).toBe(
      true,
    );
  });

  // The AU-3 replay (runbook §8.2): the paused Worker keeps its ledger, its
  // sequencer and its first release, and a source regenerated for a new race
  // instant overwrites the same keys. Every race moves weeks later, and
  // round 22, never observed, is past its first ceiling at the new load.
  it(
    'replays on the paused demonstration from a regenerated source, hands-free',
    { timeout: 180_000 },
    async () => {
      const PAUSED_START = '2026-10-23T09:00:00.000Z';
      const REPLAY_START = '2026-11-12T09:00:00.000Z';
      const paused = await controlledSeasonDocuments({
        ...options,
        raceStart: PAUSED_START,
      });
      const kv = new MemoryKv().load(paused);
      const stage = await AutomaticUpdateStage.create('demonstration', {
        controlledSource: kv,
      });

      // The ticks that ran on 2026-10-22 before the pause.
      await stage.hourly(
        '2026-10-22T12:17:00.000Z',
        '2026-10-22T16:17:00.000Z',
      );
      expect(stage.releases()).toHaveLength(1);

      const replay = await controlledSeasonDocuments({
        ...options,
        raceStart: REPLAY_START,
      });
      expect([...replay.keys()].sort()).toEqual([...paused.keys()].sort());
      kv.load(replay);
      const tickAt = (hours: number) =>
        new Date(
          Date.parse(REPLAY_START) + hours * HOUR + 17 * MINUTE,
        ).toISOString();

      const events = (tick: TickRecord) =>
        tick.logs.reduce<Record<string, number>>(
          (all, line) => ({
            ...all,
            ...(line.reconciliationEvents as
              Record<string, number> | undefined),
          }),
          {},
        );
      const view = async () => {
        const home = (await (
          await stage.fetch('/v1/home?season=2026')
        ).json()) as { data: { featuredEvent: { round: number } } };
        const response = await stage.fetch(
          '/v1/seasons/2026/grand-prix/22/results',
        );
        const results =
          response.status === 200
            ? ((await response.json()) as {
                data: { entries: { position: number; points: number }[] };
              })
            : null;
        return {
          featuredRound: home.data.featuredEvent.round,
          winnerPoints:
            results?.data.entries.find((entry) => entry.position === 1)
              ?.points ?? null,
        };
      };

      // The first run still asks for rounds 22 and 23 on the old calendar's
      // anchors and fails; rounds 20 and 21 settle on deadline, round 22 is
      // past its first ceiling, and the moved calendar is read. The release
      // two ticks later serves that calendar.
      const before = await stage.hourly(tickAt(-3), tickAt(1));
      expect(events(before[0]!)).toMatchObject({
        'classification.check-failed': 2,
        'classification.settled-on-deadline': 2,
        'classification.never-reconciled': 1,
        'refresh.overwrite': 1,
      });
      // No run is due at the race start, so Home stays on round 22.
      expect(
        before.map((tick) => tick.releasesAfter > tick.releasesBefore),
      ).toEqual([false, false, true, false, false]);
      expect(await view()).toEqual({ featuredRound: 22, winnerPoints: null });

      // Round 22 follows its new start (PR #91): sighted at + 2 h 17 min,
      // published at + 3 h 17 min, when Home moves on.
      const result = await stage.hourly(tickAt(2), tickAt(3));
      expect(events(result[0]!)['classification.rescheduled']).toBe(1);
      expect(result[0]!.releasesAfter).toBe(result[0]!.releasesBefore);
      expect(result[1]!.releasesAfter).toBe(result[1]!.releasesBefore + 1);
      expect(await view()).toEqual({ featuredRound: 23, winnerPoints: 25 });

      // The correction: sighted at + 10 h 17 min, published an hour later.
      const rest = await stage.hourly(tickAt(4), tickAt(16));
      expect(
        rest
          .filter((tick) => tick.releasesAfter > tick.releasesBefore)
          .map((tick) => tick.at),
      ).toEqual([tickAt(11)]);
      expect(await view()).toEqual({ featuredRound: 23, winnerPoints: 26 });
      expect(
        [...before, ...result, ...rest].flatMap((tick) =>
          tick.logs.map((line) => String(line.publicationReason)),
        ),
      ).not.toContain('standings-round-incoherent');
      expect(await stage.harness.record(22)).toMatchObject({
        anchor: REPLAY_START,
      });
      expect(
        stage.workerRequests.every((path) => path.startsWith('/v1/')),
      ).toBe(true);
    },
  );
});

// The deployed demonstration (runbook §8.2): one load publishes the result,
// and a later load, whenever the owner has seen it, supplies the correction.
// Everything between the two loads runs with nobody acting. It starts from the
// paused Worker, as the deployed one does. Exact polling instants are the
// gate's (`gate.test.ts`); these cases pin only what the phases rely on.
describe('the asynchronous demonstration, phase by phase', () => {
  const PAUSED_START = '2026-10-23T09:00:00.000Z';
  const RACE_START = '2026-11-12T09:00:00.000Z';
  const RESULTS_KEY = `${CONTROLLED_SOURCE_KEY_PREFIX}/ergast/f1/2026/22/results/?limit=100`;
  const after = (millis: number) =>
    new Date(Date.parse(RACE_START) + millis).toISOString();
  /** The first :17 tick at or after `millis` past the race start. */
  const tickAfter = (millis: number) => {
    const at = Date.parse(RACE_START) + millis;
    const hour = Math.floor(at / HOUR) * HOUR;
    const tick = hour + 17 * MINUTE;
    return new Date(tick >= at ? tick : tick + HOUR).toISOString();
  };

  const pausedStage = async (kv: MemoryKv) => {
    kv.load(
      await controlledSeasonDocuments({
        raceRound: 22,
        raceStart: PAUSED_START,
        correction: { afterHours: 8, variant: 'B' },
      }),
    );
    const stage = await AutomaticUpdateStage.create('demonstration', {
      controlledSource: kv,
    });
    await stage.hourly('2026-10-22T12:17:00.000Z', '2026-10-22T16:17:00.000Z');
    return stage;
  };

  const winnerPoints = async (stage: AutomaticUpdateStage) => {
    const response = await stage.fetch(
      '/v1/seasons/2026/grand-prix/22/results',
    );
    if (response.status !== 200) return null;
    const body = (await response.json()) as {
      data: { entries: { position: number; points: number }[] };
    };
    return body.data.entries.find((entry) => entry.position === 1)!.points;
  };

  const heartbeat = async (stage: AutomaticUpdateStage) => {
    const status = (await (await stage.fetch('/v1/status')).json()) as {
      data: { lastSuccessfulSyncAt: string };
    };
    return status.data.lastSuccessfulSyncAt;
  };

  it('changes one provider document between the phases, and holds only the result', async () => {
    const phases = demonstrationPhases(RACE_START);
    const result = await controlledSeasonDocuments(phases.result);
    const correction = await controlledSeasonDocuments(phases.correction);
    expect([...correction.keys()].sort()).toEqual([...result.keys()].sort());
    expect(
      [...correction]
        .filter(
          ([key, document]) =>
            JSON.stringify(document) !== JSON.stringify(result.get(key)),
        )
        .map(([key]) => key),
    ).toEqual([RESULTS_KEY]);
    for (const documents of [result, correction]) {
      for (const [key, document] of documents) {
        expect(decodeControlledDocument(document), key).not.toBeNull();
      }
    }
    expect(result.get(RESULTS_KEY)!.versions.map((v) => v.from)).toEqual([
      '1970-01-01T00:00:00.000Z',
      after(2 * HOUR),
      after(RESULT_HOLD_AFTER_HOURS * HOUR),
    ]);
    expect(
      await controlledSeasonDocuments(phases.correction),
      'the same race instant gives the same file',
    ).toEqual(correction);
  });

  it.each([
    ['the same day', 8 * HOUR],
    ['after the result would have settled', 2 * DAY],
    ['at the latest advance, after round 23 has started', 13 * DAY],
  ])(
    'publishes the result, holds it, and publishes the correction advanced %s',
    { timeout: 180_000 },
    async (_when, advanceAfter) => {
      const kv = new MemoryKv();
      const stage = await pausedStage(kv);
      const phases = demonstrationPhases(RACE_START);
      const correction = await controlledSeasonDocuments(phases.correction);

      // Phase 1: the source is loaded, the Worker is scheduled, nobody acts.
      kv.load(await controlledSeasonDocuments(phases.result));
      await stage.hourly(after(-3 * HOUR + 17 * MINUTE), tickAfter(4 * HOUR));
      expect(await winnerPoints(stage)).toBe(25);
      const first = stage.activeVersion();
      const home = (await (
        await stage.fetch('/v1/home?season=2026')
      ).json()) as { data: { featuredEvent: { round: number } } };
      expect(home.data.featuredEvent.round).toBe(23);

      // Phase 2: however long the owner takes, the result stays served and
      // the runs stay healthy.
      const advanceBy = tickAfter(advanceAfter - HOUR);
      const held = await stage.hourly(tickAfter(5 * HOUR), advanceBy);
      expect(await winnerPoints(stage)).toBe(25);
      expect(stage.activeVersion()).toBe(first);
      expect(Date.parse(await heartbeat(stage))).toBeGreaterThanOrEqual(
        Date.parse(held.at(-1)!.at),
      );

      // Phase 3: the only act is loading the changed document.
      kv.values.set(RESULTS_KEY, JSON.stringify(correction.get(RESULTS_KEY)));

      // Phase 4: at most two days and three hours later.
      await stage.hourly(
        new Date(Date.parse(advanceBy) + HOUR).toISOString(),
        new Date(Date.parse(advanceBy) + 2 * DAY + 3 * HOUR).toISOString(),
      );
      expect(await winnerPoints(stage)).toBe(26);
      expect(stage.activeVersion()).not.toBe(first);
      expect(await stage.harness.record(22)).toMatchObject({
        stagedCorrection: null,
        competingCorrection: null,
      });
      expect(
        stage.ticks.flatMap((tick) =>
          tick.logs.map((line) => String(line.publicationReason)),
        ),
      ).not.toContain('standings-round-incoherent');
      expect(
        stage.workerRequests.every((path) => path.startsWith('/v1/')),
      ).toBe(true);
    },
  );

  it('keeps the old anchor when the first run comes after the result exists', async () => {
    // Why the runbook has the schedule live before `T′` + 2 h: from here the
    // correction would not publish.
    const kv = new MemoryKv();
    const stage = await pausedStage(kv);
    const phases = demonstrationPhases(RACE_START);
    kv.load(await controlledSeasonDocuments(phases.result));
    await stage.tick(tickAfter(4 * HOUR));
    expect(await stage.harness.record(22)).toMatchObject({
      anchor: PAUSED_START,
    });
  });
});
