/**
 * AU-3's temporary daytime observer: its date guard, what it sends and what
 * it keeps, over a local fetch double. Nothing here reaches a network.
 */

import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  E2E_BASE_URL,
  OBSERVATION_WINDOW,
  PUBLIC_PATHS,
  SLOT_HOURS,
  SLOT_MINUTES,
  e2eOnly,
  insideWindow,
  nominalSlot,
  observe,
  parseObserverArguments,
} from '../../scripts/monitor/au3-e2e-observer.mjs';
import {
  parseArguments,
  runMonitor,
} from '../../scripts/monitor/automation-monitor.mjs';

const WORKFLOW = fileURLToPath(
  new URL(
    '../../../../.github/workflows/au3-e2e-observer.yml',
    import.meta.url,
  ),
);
const MONITOR_WORKFLOW = fileURLToPath(
  new URL(
    '../../../../.github/workflows/automation-monitor.yml',
    import.meta.url,
  ),
);

const NOON = new Date('2026-11-05T12:27:04.000Z');
/** Not valid UTF-8: kept intact only if a body is stored as bytes. */
const RAW_BYTES = new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]);
const NOT_FOUND = '{"error":{"code":"NOT_FOUND"}}';

/** The e2e host as it should look after the 12:17 release. */
function e2eHost() {
  const requests = [];
  const bodies = {
    '/v1/status': {
      data: {
        currentSeason: 2026,
        lastSuccessfulSyncAt: '2026-11-05T12:17:07.000Z',
      },
    },
    '/v1/seasons/2026/calendar': {
      data: [
        { round: 22, status: 'unknown', hasResults: true },
        { round: 23, status: 'unknown', hasResults: false },
      ],
    },
    '/v1/seasons/2026/grand-prix/23': {
      data: {
        round: 23,
        sessions: [
          {
            type: 'race',
            status: 'unknown',
            startTime: '2026-11-12T09:00:00Z',
          },
        ],
      },
    },
  };
  const fetchDouble = async (url, init) => {
    const parsed = new URL(url);
    requests.push({ origin: parsed.origin, path: parsed.pathname, init });
    switch (parsed.pathname) {
      case '/v1/home':
        throw new TypeError('network down');
      case '/v1/seasons/2026/standings/drivers':
        return new Response(NOT_FOUND, { status: 404 });
      case '/v1/content/manifest':
        return new Response(RAW_BYTES, { status: 200 });
      default:
        break;
    }
    const body = bodies[parsed.pathname] ?? { data: { path: parsed.pathname } };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        etag: 'W/"gv1-test"',
        'cf-ray': 'abc-DUB',
        'set-cookie': 'x=1',
      },
    });
  };
  return { requests, fetch: fetchDouble };
}

let out;
beforeEach(async () => {
  out = await mkdtemp(join(tmpdir(), 'au3-observer-'));
});
afterEach(async () => {
  await rm(out, { recursive: true, force: true });
});

const readJson = async (name) =>
  JSON.parse(await readFile(join(out, name), 'utf8'));
const entryFor = (index, path) => index.find((entry) => entry.path === path);

describe('the AU-3 observer date guard', () => {
  it('observes only on 5 November 2026, 00:00 to 18:00 UTC', () => {
    expect(insideWindow(new Date('2026-11-05T00:00:00.000Z'))).toBe(true);
    expect(insideWindow(new Date('2026-11-05T17:59:59.999Z'))).toBe(true);
    expect(insideWindow(new Date('2026-11-04T23:59:59.999Z'))).toBe(false);
    expect(insideWindow(new Date('2026-11-05T18:00:00.000Z'))).toBe(false);
    expect(insideWindow(new Date('2027-11-05T12:27:00.000Z'))).toBe(false);
  });

  it('sends nothing outside the window and records why', async () => {
    const host = e2eHost();
    const result = await observe(
      { out, rehearsal: false },
      {
        fetch: host.fetch,
        now: () => new Date('2027-11-05T12:27:00.000Z'),
        env: {},
      },
    );
    expect(result).toEqual({ skipped: true, ok: true });
    expect(host.requests).toEqual([]);
    expect(await readdir(out)).toEqual(['skipped.json']);
    expect(await readJson('skipped.json')).toMatchObject({
      skipped: 'outside-window',
      evidenceKind: 'au3-observation',
      window: OBSERVATION_WINDOW,
    });
  });

  it('runs outside the window only as a rehearsal, marked as never evidence', async () => {
    const host = e2eHost();
    const result = await observe(
      { out, rehearsal: true },
      {
        fetch: host.fetch,
        now: () => new Date('2026-11-04T21:00:00.000Z'),
        env: {},
      },
    );
    expect(result.skipped).toBe(false);
    expect((await readJson('meta.json')).evidenceKind).toBe(
      'rehearsal-not-evidence',
    );
  });
});

describe('the AU-3 observation', () => {
  it('keeps the real monitor report and every public answer, timestamped', async () => {
    const host = e2eHost();
    const env = {
      GITHUB_RUN_ID: '42',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_EVENT_NAME: 'schedule',
      GITHUB_SHA: 'deadbeef',
      GITHUB_REPOSITORY: 'owner/repo',
    };
    const result = await observe(
      { out, rehearsal: false },
      { fetch: host.fetch, now: () => NOON, env },
    );
    expect(result).toEqual({ skipped: false, ok: true, failedReads: 1 });

    const expected = await runMonitor(
      parseArguments(['--base-url', E2E_BASE_URL]),
      {
        fetch: e2eHost().fetch,
        now: () => NOON,
      },
    );
    expect(await readJson('monitor-report.json')).toEqual(expected);

    const index = await readJson('responses/index.json');
    expect(index.map((entry) => entry.path)).toEqual([...PUBLIC_PATHS]);
    const status = entryFor(index, '/v1/status');
    expect(status).toMatchObject({
      status: 200,
      requestedAt: NOON.toISOString(),
      receivedAt: NOON.toISOString(),
      headers: { etag: 'W/"gv1-test"', 'cf-ray': 'abc-DUB' },
      file: 'responses/v1_status.json',
    });
    expect(status.headers).not.toHaveProperty('set-cookie');
    expect(
      JSON.parse(await readFile(join(out, status.file), 'utf8')).data
        .lastSuccessfulSyncAt,
    ).toBe('2026-11-05T12:17:07.000Z');

    // A failed read is recorded, and the others still run.
    expect(entryFor(index, '/v1/home')).toMatchObject({
      status: null,
      error: { name: 'TypeError', message: 'network down', cause: null },
    });
    // A 404 is an answer, kept like any other and not counted as failed.
    const standings = entryFor(index, '/v1/seasons/2026/standings/drivers');
    expect(standings.status).toBe(404);
    expect(await readFile(join(out, standings.file), 'utf8')).toBe(NOT_FOUND);
    // Bodies are kept byte for byte, and hashed as bytes.
    const manifest = entryFor(index, '/v1/content/manifest');
    expect(new Uint8Array(await readFile(join(out, manifest.file)))).toEqual(
      RAW_BYTES,
    );
    expect(manifest).toMatchObject({
      bytes: RAW_BYTES.byteLength,
      sha256: createHash('sha256').update(RAW_BYTES).digest('hex'),
    });

    expect(await readJson('meta.json')).toMatchObject({
      evidenceKind: 'au3-observation',
      startedAt: NOON.toISOString(),
      finishedAt: NOON.toISOString(),
      slot: '2026-11-05T12:27:00.000Z',
      delaySeconds: 4,
      monitorOk: true,
      failedReads: 1,
      run: { runId: '42', event: 'schedule', sha: 'deadbeef' },
    });
  });

  it('sends only public GETs to the e2e host, with no credential and no redirect', async () => {
    const host = e2eHost();
    await observe(
      { out, rehearsal: false },
      { fetch: host.fetch, now: () => NOON, env: {} },
    );
    expect(new Set(host.requests.map((request) => request.origin))).toEqual(
      new Set([E2E_BASE_URL]),
    );
    for (const request of host.requests) {
      expect(request.path.startsWith('/v1/')).toBe(true);
      expect(request.init.method ?? 'GET').toBe('GET');
      expect(request.init.redirect).toBe('error');
      expect(
        Object.keys(request.init.headers).map((name) => name.toLowerCase()),
      ).not.toContain('authorization');
    }
  });

  it('refuses any origin but the e2e host, before sending', async () => {
    const sent = [];
    const guarded = e2eOnly(async (url, init) => {
      sent.push({ url, init });
      return new Response('{}');
    });
    for (const other of [
      'https://gridview-api-staging.sejuma18.workers.dev/v1/status',
      'https://gridview-api-production.sejuma18.workers.dev/v1/status',
      'https://api.jolpi.ca/ergast/f1/2026.json',
      'http://gridview-api-e2e.sejuma18.workers.dev/v1/status',
    ]) {
      await expect(guarded(other)).rejects.toThrow('is not the e2e host');
    }
    expect(sent).toEqual([]);
    await guarded(`${E2E_BASE_URL}/v1/status`, { redirect: 'follow' });
    expect(sent).toEqual([
      { url: `${E2E_BASE_URL}/v1/status`, init: { redirect: 'error' } },
    ]);
  });

  it('keeps observing when the monitor itself fails, and reports not ok', async () => {
    const host = e2eHost();
    const result = await observe(
      { out, rehearsal: false },
      {
        fetch: host.fetch,
        now: () => NOON,
        env: {},
        monitor: async () => {
          throw new RangeError('unexpected input');
        },
      },
    );
    expect(result).toEqual({ skipped: false, ok: false, failedReads: 1 });
    expect(await readJson('monitor-report.json')).toEqual({
      checkedAt: NOON.toISOString(),
      baseUrl: E2E_BASE_URL,
      ok: false,
      error: { name: 'RangeError', message: 'unexpected input', cause: null },
    });
    expect(
      (await readJson('responses/index.json')).map((entry) => entry.path),
    ).toEqual([...PUBLIC_PATHS]);
    expect((await readJson('meta.json')).monitorOk).toBe(false);
  });

  it('keeps the status and headers of an answer whose body failed', async () => {
    const host = e2eHost();
    const broken = async (url, init) => {
      if (new URL(url).pathname !== '/v1/bootstrap') {
        return host.fetch(url, init);
      }
      const body = new ReadableStream({
        start(controller) {
          controller.error(new Error('body stalled'));
        },
      });
      return new Response(body, { status: 200, headers: { etag: 'W/"x"' } });
    };
    const result = await observe(
      { out, rehearsal: false },
      { fetch: broken, now: () => NOON, env: {} },
    );
    expect(result.failedReads).toBe(2);
    const entry = entryFor(
      await readJson('responses/index.json'),
      '/v1/bootstrap',
    );
    expect(entry).toMatchObject({
      status: 200,
      headers: { etag: 'W/"x"' },
      error: { name: 'Error', message: 'body stalled' },
    });
    expect(entry).not.toHaveProperty('file');
  });

  it('reports a monitor finding as not ok, after keeping everything', async () => {
    const host = e2eHost();
    const late = () => new Date('2026-11-05T16:52:00.000Z');
    const stale = async (url, init) =>
      new URL(url).pathname === '/v1/status'
        ? new Response(
            JSON.stringify({
              data: {
                currentSeason: 2026,
                lastSuccessfulSyncAt: '2026-11-05T12:17:07.000Z',
              },
            }),
            { status: 200 },
          )
        : host.fetch(url, init);
    const result = await observe(
      { out, rehearsal: false },
      { fetch: stale, now: late, env: {} },
    );
    expect(result).toEqual({ skipped: false, ok: false, failedReads: 1 });
    expect((await readJson('monitor-report.json')).findings).toEqual([
      expect.objectContaining({ code: 'heartbeat-stale' }),
    ]);
    expect((await readJson('meta.json')).monitorOk).toBe(false);
  });
});

describe('the AU-3 observer schedule', () => {
  it('attributes a start to its latest slot, across the hour', () => {
    expect(nominalSlot(new Date('2026-11-05T09:27:00.000Z'))).toEqual({
      slot: '2026-11-05T09:27:00.000Z',
      delaySeconds: 0,
    });
    expect(nominalSlot(new Date('2026-11-05T10:05:30.000Z'))).toEqual({
      slot: '2026-11-05T09:52:00.000Z',
      delaySeconds: 810,
    });
  });

  it('attributes only to real slots: none before 00:27, none after 16:52', () => {
    expect(nominalSlot(new Date('2026-11-05T00:05:00.000Z'))).toEqual({
      slot: null,
      delaySeconds: null,
    });
    // The 16:52 slot started late; there is no 17:27 slot.
    expect(nominalSlot(new Date('2026-11-05T17:40:00.000Z'))).toEqual({
      slot: '2026-11-05T16:52:00.000Z',
      delaySeconds: 48 * 60,
    });
  });

  it('matches the workflow: two slots an hour, 00-16 UTC, 5 November only', async () => {
    const workflow = await readFile(WORKFLOW, 'utf8');
    const crons = [...workflow.matchAll(/cron: (['"])([^'"]+)\1/g)].map(
      (match) => match[2],
    );
    expect(crons).toEqual([
      `${SLOT_MINUTES.join(',')} ${SLOT_HOURS.first}-${SLOT_HOURS.last} 5 11 *`,
    ]);
    expect(workflow).toContain('retention-days: 90');
    expect(workflow).toMatch(
      /if: always\(\)\n\s+uses: actions\/upload-artifact@/,
    );
    expect(workflow).toContain('path: ${{ runner.temp }}/observation');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toMatch(/permissions:\n {2}contents: read\n/);
    expect(workflow.match(/permissions:/g)).toHaveLength(1);
    expect(workflow).not.toMatch(/secrets\.|cloudflare|token/i);
  });

  it('leaves the AU-5 monitor workflow manual-only', async () => {
    const monitor = await readFile(MONITOR_WORKFLOW, 'utf8');
    expect(monitor).not.toMatch(/^\s*schedule:/m);
  });

  it('parses its arguments', () => {
    expect(parseObserverArguments(['--out', 'o', '--rehearsal'])).toEqual({
      out: 'o',
      rehearsal: true,
    });
    expect(() => parseObserverArguments([])).toThrow('--out is required');
    expect(() =>
      parseObserverArguments(['--out', 'o', '--base-url', 'x']),
    ).toThrow('unknown argument');
  });
});
