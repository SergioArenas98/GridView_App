import { describe, expect, it, vi } from 'vitest';

import {
  calendarAnchors,
  captureSeason,
  eligibleRounds,
  getOnce,
  minimumSpacingMs,
  parseRetryAfter,
  probeRound,
  refusalDiagnostics,
  userAgent,
} from '../../scripts/auto-update/capture.mjs';
import { generateSeasonBatch } from '../../scripts/season-batch/generate';
import {
  calendarAnchor,
  isBatchCaptureEligible,
} from '../../src/sync/coordinated/policy/cadence';
import {
  captureFiles,
  COMMIT,
  fixtureCapture,
  OBSERVED_AT,
  urls,
} from '../season-batch/support';
import { mockJolpica, noSleep, tooMany } from './support';

const at = () => new Date(OBSERVED_AT);
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('automatic capture: success', () => {
  it('records exactly the capture the generator replays, and the generator accepts it', async () => {
    const jolpica = mockJolpica();
    const capture = await captureSeason({
      transport: jolpica.transport,
      season: 2026,
      now: at,
      sleep: noSleep,
    });
    if (!capture.ok) throw new Error(capture.failure);
    expect(capture.requestsSent).toBe(9);
    const expected = captureFiles(fixtureCapture()).manifest;
    expect(capture.manifest).toEqual(expected);

    const result = await generateSeasonBatch({
      capture: capture.manifest,
      bodies: capture.bodies,
      provenance: { gitCommit: COMMIT, treeClean: true },
    });
    expect(result.ok).toBe(true);
  });

  it('sends only fixed Jolpica URLs, one at a time, identified, without redirects', async () => {
    const jolpica = mockJolpica();
    await captureSeason({
      transport: jolpica.transport,
      season: 2026,
      now: at,
      sleep: noSleep,
    });
    expect(jolpica.calls.map((c) => c.url)).toEqual([
      urls.calendar,
      urls.circuits,
      urls.drivers,
      urls.constructors,
      urls.driverStandings,
      urls.constructorStandings,
      urls.results(1),
      urls.results(2),
      urls.results(3),
    ]);
    for (const { init } of jolpica.calls) {
      expect(init.method).toBe('GET');
      expect(init.redirect).toBe('manual');
      expect(init.headers).toEqual({
        Accept: 'application/json',
        'User-Agent': userAgent,
      });
      expect(init.body).toBeUndefined();
    }
  });

  it('waits the spacing before every request but the first, and refuses less than 1 s', async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const jolpica = mockJolpica();
    await captureSeason({
      transport: jolpica.transport,
      season: 2026,
      now: at,
      sleep,
      spacingMs: 3000,
    });
    expect(sleep).toHaveBeenCalledTimes(8);
    expect(sleep.mock.calls.every(([ms]) => ms === 3000)).toBe(true);
    await expect(
      captureSeason({
        transport: jolpica.transport,
        season: 2026,
        now: at,
        sleep,
        spacingMs: minimumSpacingMs - 1,
      }),
    ).rejects.toThrow(RangeError);
  });

  it('applies the runtime anchor and batch eligibility rules exactly', async () => {
    const calendar = JSON.parse(
      new TextDecoder().decode(fixtureCapture().responses[0]!.body),
    );
    const anchors = calendarAnchors(calendar)!;
    for (const race of calendar.MRData.RaceTable.Races) {
      const runtime = calendarAnchor(
        Number(race.round),
        race.date,
        race.time ?? null,
      )!;
      expect(
        anchors.find((a: { round: number }) => a.round === runtime.round)
          ?.start,
      ).toBe(runtime.anchor);
    }
    for (const offsetHours of [-200, -5, -4.99, 0, 5, 24, 400, 2000]) {
      const instant = new Date(
        Date.parse(OBSERVED_AT) + offsetHours * 3_600_000,
      );
      const runtime = anchors
        .filter((a: { start: string }) =>
          isBatchCaptureEligible(a.start, instant),
        )
        .map((a: { round: number }) => a.round);
      expect(eligibleRounds(anchors, instant)).toEqual(runtime);
    }
  });
});

describe('automatic capture: failures leave nothing behind', () => {
  it('stops at the first 429: no later request, no capture, the hold instruction kept', async () => {
    const jolpica = mockJolpica(undefined, (_url, index) =>
      index === 3
        ? tooMany({ 'retry-after': '120', 'cf-ray': '0123456789abcdef-LHR' })
        : undefined,
    );
    const result = await captureSeason({
      transport: jolpica.transport,
      season: 2026,
      now: at,
      sleep: noSleep,
    });
    expect(jolpica.calls).toHaveLength(3);
    expect(result).toMatchObject({
      ok: false,
      failure: 'provider-rate-limited',
      requestsSent: 3,
      status: 429,
      retryAfter: '2026-03-16T12:02:00.000Z',
      diagnostics: {
        server: 'cloudflare',
        cfRay: '0123456789abcdef-LHR',
        retryAfterRaw: '120',
        contentType: 'text/plain',
      },
    });
    expect(result).not.toHaveProperty('manifest');
    expect(result).not.toHaveProperty('bodies');
  });

  it('stops on a 429 among the results too', async () => {
    const jolpica = mockJolpica(undefined, (url) =>
      url === urls.results(2) ? tooMany() : undefined,
    );
    const result = await captureSeason({
      transport: jolpica.transport,
      season: 2026,
      now: at,
      sleep: noSleep,
    });
    expect(result).toMatchObject({
      ok: false,
      failure: 'provider-rate-limited',
      requestsSent: 8,
      retryAfter: null,
    });
    expect(jolpica.calls.map((c) => c.url)).not.toContain(urls.results(3));
  });

  it.each([
    ['a 5xx', () => json({}, 503), 'provider-http-error'],
    [
      'a redirect',
      () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://elsewhere.example/' },
        }),
      'redirect-rejected',
    ],
    [
      'HTML',
      () =>
        new Response('<html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      'invalid-content-type',
    ],
    [
      'broken JSON',
      () =>
        new Response('{"MRData":', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      'malformed-json',
    ],
    [
      'a transport error',
      () => new Error('socket hang up'),
      'network-or-timeout',
    ],
    [
      'an oversized body',
      () =>
        new Response(new Uint8Array(2 * 1024 * 1024 + 1), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      'response-too-large',
    ],
  ])('refuses %s, without retrying', async (_name, answer, failure) => {
    const jolpica = mockJolpica(undefined, (url) =>
      url === urls.drivers ? answer() : undefined,
    );
    const result = await captureSeason({
      transport: jolpica.transport,
      season: 2026,
      now: at,
      sleep: noSleep,
    });
    expect(result).toMatchObject({ ok: false, failure, requestsSent: 3 });
    expect(jolpica.calls.filter((c) => c.url === urls.drivers)).toHaveLength(1);
  });

  it('refuses before the results when the season would exceed the request cap', async () => {
    const jolpica = mockJolpica();
    const result = await captureSeason({
      transport: jolpica.transport,
      season: 2026,
      now: at,
      sleep: noSleep,
      maxRequests: 8,
    });
    expect(result).toMatchObject({
      ok: false,
      failure: 'request-cap-exceeded',
      requestsSent: 6,
    });
  });

  it('a capture missing a round is refused by the generator (incomplete data never becomes a batch)', async () => {
    const jolpica = mockJolpica();
    const capture = await captureSeason({
      transport: jolpica.transport,
      season: 2026,
      now: at,
      sleep: noSleep,
    });
    if (!capture.ok) throw new Error(capture.failure);
    const manifest = {
      ...capture.manifest,
      responses: capture.manifest.responses.filter(
        (r: { url: string }) => r.url !== urls.results(3),
      ),
    };
    const result = await generateSeasonBatch({
      capture: manifest,
      bodies: capture.bodies,
      provenance: { gitCommit: COMMIT, treeClean: true },
    });
    expect(result.ok).toBe(false);
  });
});

describe('probe and header parsing', () => {
  it('probes one round with one request and judges completeness shallowly', async () => {
    const jolpica = mockJolpica();
    const probe = await probeRound({
      transport: jolpica.transport,
      season: 2026,
      round: 2,
      now: at,
    });
    expect(probe).toMatchObject({ ok: true, complete: true, requestsSent: 1 });
    expect(jolpica.calls.map((c) => c.url)).toEqual([urls.results(2)]);

    const empty = mockJolpica(undefined, () =>
      json({
        MRData: {
          total: '0',
          RaceTable: { season: '2026', round: '4', Races: [] },
        },
      }),
    );
    expect(
      await probeRound({
        transport: empty.transport,
        season: 2026,
        round: 4,
        now: at,
      }),
    ).toMatchObject({ ok: true, complete: false });
  });

  it('parses Retry-After in both forms and refuses junk', () => {
    const now = new Date('2026-11-04T20:00:00.000Z');
    expect(parseRetryAfter('10', now)).toBe('2026-11-04T20:00:10.000Z');
    expect(parseRetryAfter('Wed, 04 Nov 2026 21:00:00 GMT', now)).toBe(
      '2026-11-04T21:00:00.000Z',
    );
    expect(parseRetryAfter('Wed, 04 Nov 2026 19:00:00 GMT', now)).toBeNull();
    expect(parseRetryAfter('soon', now)).toBeNull();
    expect(parseRetryAfter(null, now)).toBeNull();
  });

  it('keeps refusal diagnostics to allow-listed values', () => {
    const d = refusalDiagnostics(
      new Headers({
        server: 'nginx/1.2',
        'cf-ray': 'not a ray',
        'cf-cache-status': 'weird',
        'content-type': 'application/json; charset=utf-8',
        'retry-after': 'x'.repeat(65),
      }),
    );
    expect(d).toEqual({
      server: 'other',
      cfRay: null,
      cfCacheStatus: null,
      contentType: 'application/json',
      retryAfterRaw: 'invalid',
    });
  });

  it('never reaches outside Jolpica, whatever the season or round', async () => {
    const jolpica = mockJolpica();
    await expect(
      probeRound({ transport: jolpica.transport, season: 2026, round: 0 }),
    ).rejects.toThrow(RangeError);
    await expect(
      captureSeason({
        transport: jolpica.transport,
        season: Number.NaN,
        sleep: noSleep,
      }),
    ).rejects.toThrow(RangeError);
    const got = await getOnce(jolpica.transport, urls.calendar, at);
    expect(got.ok).toBe(true);
    expect(jolpica.calls).toHaveLength(1);
  });
});
