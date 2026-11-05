/**
 * The staging-only one-GET Jolpica calendar comparison
 * (`POST /internal/admin/provider/jolpica/calendar-once?season=YYYY`,
 * 2026-11-05), through the real Worker entry point of a coordinated staging
 * Worker.
 *
 * It must send exactly the first request of a coordinated run - the season
 * calendar, same URL, same headers, through the run's own client, pacer and
 * limiter - and then stop: no second request, no ledger, release or storage
 * write, never a publication, nothing retried.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleCalendarSingleGetRequest } from '../../../../src/admin/calendar-single-get-route';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../../../src/providers/http/provider-rate-limiter';
import type { RealProviderSourceId } from '../../../../src/providers/http/reservation-engine';
import { calendarSingleGetUrl } from '../../../../src/sync/coordinated/calendar-single-get';
import type { CoordinatedRuntimeDependencies } from '../../../../src/sync/coordinated/composition';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import { sequencerTransports } from '../../../publication/sequenced/support';
import {
  ADMIN_TOKEN,
  EntryPointHarness,
  PUBLIC_BASE_URL,
  type LedgerBinding,
} from './support';

const injected = vi.hoisted(() => ({
  ledger: null as null | (() => unknown),
}));

vi.mock(
  '../../../../src/sync/coordinated/ledger-port',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../src/sync/coordinated/ledger-port')
      >();
    return {
      ...actual,
      resolveReconciliationLedger: () =>
        (injected.ledger?.() ?? null) as ReconciliationLedgerPort | null,
    };
  },
);

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});
beforeEach(() => {
  injected.ledger = null;
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});
afterEach(() => {
  expect(globalFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

const bind = (binding: LedgerBinding) => {
  injected.ledger = binding;
};

const routePath = '/internal/admin/provider/jolpica/calendar-once';
const calendarUrl = 'https://api.jolpi.ca/ergast/f1/2026/races/?limit=100';
const at = '2026-11-05T09:00:00.000Z';
const gridViewUserAgent =
  'GridView/1.0 (+https://github.com/SergioArenas98/GridView_App)';

/** A season calendar with three rows; only the count is ever reported. */
function calendarBody() {
  return {
    MRData: {
      RaceTable: {
        season: '2026',
        Races: [{ round: '1' }, { round: '2' }, { round: '3' }],
      },
    },
  };
}

function json(body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

interface Recording {
  readonly sent: Request[];
  readonly reserved: string[];
  readonly reports: [RealProviderSourceId, string | null][];
}

async function staging(
  transport: (typeof sequencerTransports)[number],
  answer: () => Response,
  reserve?: (sourceId: RealProviderSourceId) => ReservationOutcome,
) {
  const recording: Recording = { sent: [], reserved: [], reports: [] };
  const limiter: ProviderRateLimiterClient = {
    async reserve(sourceId) {
      recording.reserved.push(sourceId);
      return (
        reserve?.(sourceId) ?? { outcome: 'allowed', sourceId, headroom: [] }
      );
    },
    async recordRateLimited(sourceId, retryAfter) {
      recording.reports.push([sourceId, retryAfter]);
    },
  };
  const harness = await EntryPointHarness.create(transport, bind, {
    env: {
      __PROVIDER_RATE_LIMITER: limiter,
      __PROVIDER_TRANSPORT: async (outbound: Request) => {
        recording.sent.push(outbound);
        return answer();
      },
    },
  });
  const call = async (
    method = 'POST',
    token: string | null = ADMIN_TOKEN,
    query = '?season=2026',
  ) => {
    const answer = await harness.admin(
      at,
      new Request(`${PUBLIC_BASE_URL}${routePath}${query}`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    );
    return {
      ...answer,
      body: answer.body as { data?: Record<string, unknown> },
    };
  };
  return { harness, recording, call };
}

const htmlRefusal =
  '<!DOCTYPE html><html><head><title>429 Too Many Requests</title></head></html>';
const htmlRefusalBytes = new TextEncoder().encode(htmlRefusal).byteLength;

describe.each(sequencerTransports)(
  'the one-GET calendar comparison on a coordinated staging Worker, over the %s transport',
  (transport) => {
    it("sends exactly a run's first request, writes nothing, and reports closed facts", async () => {
      const run = await staging(transport, () =>
        json(calendarBody(), {
          'cf-cache-status': 'MISS',
          'cf-ray': '0123456789abcdef-DUB',
        }),
      );
      const before = await run.harness.snapshot();

      const answer = await run.call();
      const { status, body } = answer;

      expect(status).toBe(200);
      expect(run.recording.sent).toHaveLength(1);
      const [outbound] = run.recording.sent;
      expect(outbound!.url).toBe(calendarUrl);
      expect(outbound!.method).toBe('GET');
      expect(outbound!.redirect).toBe('manual');
      expect([...outbound!.headers.entries()].sort()).toEqual([
        ['accept', 'application/json'],
        ['user-agent', gridViewUserAgent],
      ]);
      expect(run.recording.reserved).toEqual(['jolpica']);
      expect(body.data).toEqual({
        outcome: 'answered',
        url: calendarUrl,
        startedAt: at,
        status: 200,
        cacheStatus: 'MISS',
        edgeColo: 'DUB',
        ray: '0123456789abcdef-DUB',
        races: 3,
      });
      // No ledger call at all, no publication, no storage write.
      expect(await run.harness.snapshot()).toEqual(before);
      expect(answer.ledgerCalls).toEqual([]);
      expect([answer.prepares, answer.storageWrites]).toEqual([0, 0]);
      expect(
        run.harness.harness.logger.events.find(
          (event) => event.operation === 'provider.calendar_single_get',
        ),
      ).toMatchObject({
        providerSingleGetOutcome: 'answered',
        status: 200,
        providerCacheStatus: 'MISS',
        season: 2026,
      });
      expect(JSON.stringify(body)).not.toContain('RaceTable');
    });

    it('sends nothing while the limiter holds Jolpica, and says until when', async () => {
      const run = await staging(
        transport,
        () => json(calendarBody()),
        (sourceId) => ({
          outcome: 'deferred',
          sourceId,
          retryAt: '2026-11-05T09:01:00.000Z',
          limitingWindows: [],
          headroom: [],
          cause: 'provider-hold',
        }),
      );

      const { body } = await run.call();

      expect(run.recording.sent).toHaveLength(0);
      expect(body.data).toEqual({
        outcome: 'not-sent',
        url: calendarUrl,
        reason: 'rate-limit-deferred',
        retryAt: '2026-11-05T09:01:00.000Z',
      });
    });

    it('reports and holds a 429, returns its closed facts and fingerprint, and sends nothing more', async () => {
      const run = await staging(
        transport,
        () =>
          new Response(htmlRefusal, {
            status: 429,
            headers: {
              'Content-Type': 'text/html',
              server: 'cloudflare',
              'cf-ray': 'a55adea84dba9d4b-DUB',
              'cf-cache-status': 'BYPASS',
              'x-amzn-requestid': 'never-logged',
            },
          }),
      );

      const { body } = await run.call();

      expect(run.recording.sent).toHaveLength(1);
      expect(run.recording.reports).toEqual([['jolpica', null]]);
      expect(body.data).toEqual({
        outcome: 'refused',
        url: calendarUrl,
        startedAt: at,
        status: 429,
        refusal: {
          providerCacheStatus: 'BYPASS',
          providerEdgeColo: 'DUB',
          providerRefusalLayer: 'unknown',
          providerRefusalBody: 'other',
          providerRetryAfterForm: 'absent',
          providerServer: 'cloudflare',
          providerBodyMedia: 'html',
          providerRay: 'a55adea84dba9d4b-DUB',
        },
        fingerprint: {
          headerMarks: [
            'cf-cache-status',
            'cf-ray',
            'content-type',
            'server',
            'x-amzn-*',
          ],
          otherHeaders: 0,
          bodyBytes: htmlRefusalBytes,
          bodySha256: expect.stringMatching(/^[0-9a-f]{64}$/),
          title: 'too-many-requests',
        },
      });
      expect(
        run.harness.harness.logger.events.find(
          (event) => event.operation === 'provider.request.rate_limited',
        ),
      ).toMatchObject({
        providerRefusalTitle: 'too-many-requests',
        providerRefusalHeaderMarks:
          'cf-cache-status,cf-ray,content-type,server,x-amzn-*',
        providerRefusalOtherHeaders: 0,
        providerRefusalBodyBytes: htmlRefusalBytes,
      });
      const everything =
        JSON.stringify(body) +
        JSON.stringify(run.harness.harness.logger.events);
      expect(everything).not.toMatch(/Too Many Requests|never-logged/);
    });

    it('keeps an upstream Retry-After as the hold, and reports it', async () => {
      const run = await staging(
        transport,
        () =>
          new Response('error code: 1015', {
            status: 429,
            headers: { 'Content-Type': 'text/plain', 'Retry-After': '120' },
          }),
      );

      const { body } = await run.call();

      expect(run.recording.sent).toHaveLength(1);
      expect(run.recording.reports).toEqual([
        ['jolpica', '2026-11-05T09:02:00.000Z'],
      ]);
      expect(body.data).toMatchObject({
        outcome: 'refused',
        retryAfter: '2026-11-05T09:02:00.000Z',
        refusal: {
          providerRefusalLayer: 'edge',
          providerRefusalBody: 'cloudflare-1015',
          providerRetryAfterForm: 'delta',
        },
      });
    });

    it('never follows a redirect and never retries a failure', async () => {
      const run = await staging(
        transport,
        () =>
          new Response(null, {
            status: 301,
            headers: { Location: 'https://elsewhere.example/' },
          }),
      );

      const { body } = await run.call();

      expect(run.recording.sent).toHaveLength(1);
      expect(body.data).toEqual({
        outcome: 'failed',
        url: calendarUrl,
        startedAt: at,
        reason: 'redirect-rejected',
        status: 301,
      });
    });

    it('sends nothing when the coordinated runtime cannot compose', async () => {
      const run = await staging(transport, () => json(calendarBody()));
      run.harness.unbindLedger();

      const { status, body } = await run.call();

      expect(status).toBe(503);
      expect(body.data).toMatchObject({
        outcome: 'coordinated-runtime-unavailable',
      });
      expect([
        run.recording.sent.length,
        run.recording.reserved.length,
      ]).toEqual([0, 0]);
    });

    it('requires the admin token, POST and exactly one valid season', async () => {
      const run = await staging(transport, () => json(calendarBody()));

      expect((await run.call('POST', null)).status).toBe(401);
      expect((await run.call('POST', 'wrong-token')).status).toBe(401);
      expect((await run.call('GET')).status).toBe(405);
      for (const query of [
        '',
        '?season=26',
        '?season=2026&round=1',
        '?season=abcd',
        '?resource=results&season=2026',
      ]) {
        expect((await run.call('POST', ADMIN_TOKEN, query)).status, query).toBe(
          400,
        );
      }
      expect(run.recording.sent).toHaveLength(0);
      expect(run.recording.reserved).toHaveLength(0);
    });
  },
);

describe('the one-GET route outside coordinated staging', () => {
  it('is refused before anything is composed', async () => {
    const untouchable = new Proxy(
      {},
      {
        get() {
          throw new Error('nothing may be composed');
        },
      },
    ) as CoordinatedRuntimeDependencies;
    for (const [environment, coordinated] of [
      ['production', true],
      ['e2e', true],
      ['development', true],
      ['staging', false],
      [undefined, true],
    ] as const) {
      const url = `${PUBLIC_BASE_URL}${routePath}?season=2026`;
      const response = await handleCalendarSingleGetRequest(
        new Request(url, { method: 'POST' }),
        new URL(url),
        {
          environment,
          coordinated,
          dependencies: untouchable,
          logger: { info() {}, warn() {}, error() {} },
          requestId: 'r-1',
        },
      );
      expect(response.status, `${environment}/${coordinated}`).toBe(404);
    }
  });

  it('names exactly the URL the calendar port requests', () => {
    expect(calendarSingleGetUrl(2026)).toBe(calendarUrl);
  });
});
