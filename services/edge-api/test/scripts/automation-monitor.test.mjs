/**
 * The outside-in automation monitor (ADR 0028 D9): its pure judgement and
 * its CLI over a local fetch double. Nothing here reaches a network.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_THRESHOLDS,
  evaluateAutomationHealth,
  pendingRound,
  raceStart,
} from '../../scripts/monitor/automation-health.mjs';
import {
  parseArguments,
  runMonitor,
} from '../../scripts/monitor/automation-monitor.mjs';

const HOUR = 60 * 60 * 1000;
const RACE = '2026-10-25T20:00:00Z';
const at = (hoursAfterRace) =>
  new Date(Date.parse(RACE) + hoursAfterRace * HOUR);

const calendar = [
  { round: 17, status: 'unknown', hasResults: true },
  { round: 18, status: 'unknown', hasResults: false },
  { round: 19, status: 'unknown', hasResults: false },
];
const pendingEvent = {
  round: 18,
  sessions: [
    {
      type: 'qualifying',
      status: 'unknown',
      startTime: '2026-10-24T21:00:00Z',
    },
    { type: 'race', status: 'unknown', startTime: RACE },
  ],
};

function judge(overrides) {
  return evaluateAutomationHealth({
    now: at(1),
    status: { lastSuccessfulSyncAt: at(0.5).toISOString() },
    calendar,
    pendingEvent,
    requireHeartbeat: true,
    ...overrides,
  });
}

describe('the automation health judgement', () => {
  it('is healthy with a fresh heartbeat and no late result', () => {
    expect(judge({})).toEqual({ ok: true, findings: [] });
  });

  it('reports a stale or missing heartbeat, only when one is required', () => {
    const stale = judge({
      now: at(5),
      status: { lastSuccessfulSyncAt: at(1).toISOString() },
    });
    expect(stale.findings).toEqual([
      {
        code: 'heartbeat-stale',
        lastSuccessfulSyncAt: at(1).toISOString(),
        ageHours: 4,
      },
    ]);
    expect(judge({ status: { lastSuccessfulSyncAt: null } }).findings).toEqual([
      { code: 'heartbeat-missing' },
    ]);
    expect(
      judge({ status: { lastSuccessfulSyncAt: null }, requireHeartbeat: false })
        .ok,
    ).toBe(true);
    // At the threshold exactly, still healthy.
    expect(
      judge({
        now: at(3.5),
        status: { lastSuccessfulSyncAt: at(0.5).toISOString() },
      }).ok,
    ).toBe(true);
  });

  it('reports a result late once the race start is more than the threshold past', () => {
    const fresh = { lastSuccessfulSyncAt: at(12.4).toISOString() };
    expect(judge({ now: at(12), status: fresh }).ok).toBe(true);
    expect(judge({ now: at(12.5), status: fresh }).findings).toEqual([
      {
        code: 'results-late',
        round: 18,
        raceStart: '2026-10-25T20:00:00.000Z',
        hoursSinceRaceStart: 12.5,
      },
    ]);
  });

  it('cannot be fooled by an unreadable status, calendar or event', () => {
    expect(judge({ status: null }).findings).toEqual([
      { code: 'status-unavailable' },
    ]);
    expect(judge({ calendar: null }).findings).toEqual([
      { code: 'calendar-unavailable' },
    ]);
    expect(judge({ pendingEvent: null }).findings).toEqual([
      { code: 'event-unavailable', round: 18 },
    ]);
    expect(
      judge({ pendingEvent: { ...pendingEvent, round: 19 } }).findings,
    ).toEqual([{ code: 'event-unavailable', round: 18 }]);
  });

  it('skips cancelled and classified events, and finds none past the season', () => {
    expect(pendingRound(calendar)).toBe(18);
    expect(
      pendingRound([
        { round: 18, status: 'cancelled', hasResults: false },
        { round: 19, status: 'unknown', hasResults: false },
      ]),
    ).toBe(19);
    expect(pendingRound([{ round: 1, hasResults: true }])).toBeNull();
    expect(
      raceStart([{ type: 'race', status: 'cancelled', startTime: RACE }]),
    ).toBeNull();
    expect(raceStart('nope')).toBeNull();
  });

  it('defaults to three hours of heartbeat and twelve of results', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({
      heartbeatMaxAgeHours: 3,
      resultsLateAfterHours: 12,
    });
  });
});

describe('the monitor CLI', () => {
  it('parses its arguments and refuses a plain-http remote host', () => {
    expect(
      parseArguments([
        '--base-url',
        'https://api.example.test/path',
        '--skip-heartbeat',
        '--results-late-after-hours',
        '10',
      ]),
    ).toEqual({
      baseUrl: 'https://api.example.test',
      requireHeartbeat: false,
      simulateFailure: false,
      thresholds: { heartbeatMaxAgeHours: 3, resultsLateAfterHours: 10 },
    });
    expect(() =>
      parseArguments(['--base-url', 'http://api.example.test']),
    ).toThrow('https');
    expect(() => parseArguments([])).toThrow('--base-url is required');
    expect(() =>
      parseArguments(['--base-url', 'https://a.test', '--x']),
    ).toThrow('unknown argument');
  });

  function publicApi(overrides = {}) {
    const requests = [];
    const bodies = {
      '/v1/status': {
        data: {
          currentSeason: 2026,
          lastSuccessfulSyncAt: at(0.5).toISOString(),
        },
      },
      '/v1/seasons/2026/calendar': { data: calendar },
      '/v1/seasons/2026/grand-prix/18': { data: pendingEvent },
      ...overrides,
    };
    const fetchDouble = async (url, init) => {
      const path = new URL(url).pathname;
      requests.push({ path, headers: init.headers });
      const body = bodies[path];
      if (body === undefined) return new Response('{}', { status: 404 });
      if (body === 503) return new Response('{}', { status: 503 });
      return new Response(JSON.stringify(body), { status: 200 });
    };
    return { requests, fetch: fetchDouble };
  }

  const options = parseArguments(['--base-url', 'https://api.example.test']);

  it('sends three public GETs with no credential and reports health', async () => {
    const api = publicApi();
    const report = await runMonitor(options, {
      fetch: api.fetch,
      now: () => at(1),
    });
    expect(report).toMatchObject({ ok: true, season: 2026, pendingRound: 18 });
    expect(api.requests.map((request) => request.path)).toEqual([
      '/v1/status',
      '/v1/seasons/2026/calendar',
      '/v1/seasons/2026/grand-prix/18',
    ]);
    for (const { headers } of api.requests) {
      expect(Object.keys(headers).sort()).toEqual(['Accept', 'User-Agent']);
    }
  });

  it('retries a 5xx once, then reports the resource unavailable', async () => {
    const api = publicApi({ '/v1/status': 503 });
    const report = await runMonitor(options, {
      fetch: api.fetch,
      now: () => at(1),
    });
    expect(report.findings).toEqual([
      { code: 'status-unavailable' },
      { code: 'calendar-unavailable' },
    ]);
    expect(api.requests.map((request) => request.path)).toEqual([
      '/v1/status',
      '/v1/status',
    ]);
  });

  it('fails on demand, for an alert-delivery drill', async () => {
    const report = await runMonitor(
      { ...options, simulateFailure: true },
      { fetch: publicApi().fetch, now: () => at(1) },
    );
    expect(report.ok).toBe(false);
    expect(report.findings).toEqual([{ code: 'simulated-failure' }]);
  });
});
