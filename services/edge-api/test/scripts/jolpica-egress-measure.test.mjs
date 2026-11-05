/**
 * The Jolpica egress measurement (L1) and its workflow, over a local fetch
 * double built from the season-batch fixture. Nothing here reaches a network.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';
import { describe, expect, it, vi } from 'vitest';

import {
  bodyClass,
  eligibleRounds,
  headerFacts,
  maxRequests,
  measure,
  parseArguments,
  retryAfterFacts,
  spacingMs,
  summaryMarkdown,
  userAgent,
} from '../../scripts/jolpica-egress/measure.mjs';
import { fixtureCapture, OBSERVED_AT, urls } from '../season-batch/support.ts';

const here = dirname(fileURLToPath(import.meta.url));
const script = resolve(
  here,
  '..',
  '..',
  'scripts',
  'jolpica-egress',
  'measure.mjs',
);
const workflow = resolve(
  here,
  '..',
  '..',
  '..',
  '..',
  '.github',
  'workflows',
  'jolpica-egress-measure.yml',
);

const clock = () => new Date(OBSERVED_AT);
const noSleep = async () => {};

/** Serves the fixture capture by URL; `override(url, n)` may answer instead. */
function jolpica(override) {
  const byUrl = new Map(fixtureCapture().responses.map((r) => [r.url, r]));
  const calls = [];
  const transport = async (target, init) => {
    calls.push({ target, init });
    const replaced = override?.(target, calls.length);
    if (replaced instanceof Error) throw replaced;
    if (replaced) return replaced;
    const entry = byUrl.get(target);
    if (!entry)
      return new Response('{}', {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    return new Response(entry.body, {
      status: 200,
      headers: {
        'content-type': entry.contentType,
        server: 'cloudflare',
        'cf-cache-status': 'HIT',
        'cf-ray': '0123456789abcdef-DUB',
      },
    });
  };
  return { transport, calls };
}

const refusal = (status, body, headers = {}) =>
  new Response(body, { status, headers: { server: 'cloudflare', ...headers } });

describe('measurement: a clean run', () => {
  it('sends exactly one capture’s requests, in order, identified, 2 s apart, and keeps no body', async () => {
    const { transport, calls } = jolpica();
    const sleep = vi.fn(noSleep);
    const emitted = [];
    const result = await measure({
      season: 2026,
      transport,
      sleep,
      clock,
      emit: (r) => emitted.push(r),
    });

    expect(result).toMatchObject({
      verdict: 'all-200',
      planned: 9,
      requestsSent: 9,
      okResponses: 9,
      firstRefusal: null,
      spacingMs: 2000,
    });
    expect(calls.map((c) => c.target)).toEqual([
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
    for (const { init } of calls) {
      expect(init).toMatchObject({
        method: 'GET',
        redirect: 'manual',
        headers: { Accept: 'application/json', 'User-Agent': userAgent },
      });
      expect(init.body).toBeUndefined();
      expect(init.headers).not.toHaveProperty('Authorization');
    }
    expect(sleep).toHaveBeenCalledTimes(8);
    expect(sleep.mock.calls.every(([ms]) => ms === spacingMs)).toBe(true);
    expect(emitted).toHaveLength(9);
    expect(result.records[0]).toMatchObject({
      n: 1,
      resource: 'calendar',
      status: 200,
      cfCacheStatus: 'HIT',
      cfRay: '0123456789abcdef-DUB',
      server: 'cloudflare',
      failure: null,
    });
    const text = JSON.stringify(result) + summaryMarkdown(result);
    expect(text).not.toContain('MRData');
    expect(result.records.some((r) => 'json' in r)).toBe(false);
  });
});

describe('measurement: the first refusal ends the run, nothing is retried', () => {
  it('stops at a 429 and records which layer answered, without the body', async () => {
    const { transport, calls } = jolpica((_target, n) =>
      n === 2
        ? refusal(429, 'error code: 1015', {
            'retry-after': '10',
            'cf-ray': 'fedcba9876543210-LHR',
            'content-type': 'text/plain; charset=UTF-8',
          })
        : undefined,
    );
    const result = await measure({
      season: 2026,
      transport,
      sleep: noSleep,
      clock,
    });
    expect(calls).toHaveLength(2);
    expect(result).toMatchObject({
      verdict: 'rate-limited',
      requestsSent: 2,
      okResponses: 1,
      firstRefusal: { n: 2, resource: 'circuits', status: 429 },
    });
    expect(result.records[1]).toMatchObject({
      status: 429,
      server: 'cloudflare',
      cfRay: 'fedcba9876543210-LHR',
      contentType: 'text/plain',
      retryAfterRaw: '10',
      retryAfterSeconds: 10,
      bodyClass: 'cloudflare-1015',
      failure: 'rate-limited',
    });
    expect(JSON.stringify(result)).not.toContain('error code');
  });

  it('stops at a 429 among the results too', async () => {
    const { transport, calls } = jolpica((target) =>
      target === urls.results(2)
        ? refusal(429, '{"detail":"Request was throttled."}', {
            'content-type': 'application/json',
          })
        : undefined,
    );
    const result = await measure({
      season: 2026,
      transport,
      sleep: noSleep,
      clock,
    });
    expect(result).toMatchObject({
      verdict: 'rate-limited',
      requestsSent: 8,
      firstRefusal: { resource: 'results-02' },
    });
    expect(result.records[7]).toMatchObject({
      bodyClass: 'json-detail',
      retryAfterRaw: null,
      retryAfterSeconds: null,
    });
    expect(calls.map((c) => c.target)).not.toContain(urls.results(3));
  });

  it.each([
    [
      'a 503',
      () => refusal(503, '<html>busy</html>', { 'content-type': 'text/html' }),
      'http-error',
      { bodyClass: 'html' },
    ],
    [
      'a redirect',
      () => refusal(302, '', { location: 'https://elsewhere.example/' }),
      'http-error',
      { status: 302, bodyClass: 'empty' },
    ],
    [
      'a timeout',
      () => new DOMException('timed out', 'TimeoutError'),
      'timeout',
      { status: null },
    ],
    [
      'a network error',
      () => new TypeError('fetch failed'),
      'network',
      { status: null },
    ],
    [
      'broken JSON',
      () =>
        new Response('{"MRData":', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      'invalid-json',
      { status: 200 },
    ],
    [
      'an oversized body',
      () => new Response(new Uint8Array(2 * 1024 * 1024 + 1), { status: 200 }),
      'too-large',
      { status: 200 },
    ],
  ])('stops at %s', async (_name, answer, verdict, fields) => {
    const { transport, calls } = jolpica((target) =>
      target === urls.drivers ? answer() : undefined,
    );
    const result = await measure({
      season: 2026,
      transport,
      sleep: noSleep,
      clock,
    });
    expect(result).toMatchObject({ verdict, requestsSent: 3 });
    expect(result.records[2]).toMatchObject(fields);
    expect(calls).toHaveLength(3);
  });

  it('never exceeds 30 requests: a season too long for the cap stops before its results', async () => {
    const races = Array.from({ length: 30 }, (_, i) => ({
      round: String(i + 1),
      date: '2026-01-01',
      time: '12:00:00Z',
    }));
    const calendar = new Response(
      JSON.stringify({ MRData: { RaceTable: { Races: races } } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
    const { transport, calls } = jolpica((target) =>
      target === urls.calendar ? calendar : undefined,
    );
    const result = await measure({
      season: 2026,
      transport,
      sleep: noSleep,
      clock,
    });
    expect(result).toMatchObject({
      verdict: 'request-cap',
      planned: 36,
      requestsSent: 6,
    });
    expect(calls.length).toBeLessThanOrEqual(maxRequests);
  });

  it('stops when the calendar cannot be read', async () => {
    const empty = new Response('{"MRData":{"RaceTable":{"Races":[]}}}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const { transport } = jolpica((target) =>
      target === urls.calendar ? empty : undefined,
    );
    expect(
      await measure({ season: 2026, transport, sleep: noSleep, clock }),
    ).toMatchObject({ verdict: 'calendar-unusable', requestsSent: 6 });
  });
});

describe('measurement: calendar-once sends exactly one GET', () => {
  it('sends only the calendar, identified, and records its colo and race count', async () => {
    const { transport, calls } = jolpica();
    const sleep = vi.fn(async () => {});
    const emitted = [];
    const result = await measure({
      season: 2026,
      mode: 'calendar-once',
      transport,
      sleep,
      clock,
      emit: (record) => emitted.push(record),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].target).toBe(
      'https://api.jolpi.ca/ergast/f1/2026/races/?limit=100',
    );
    expect(calls[0].target).toBe(urls.calendar);
    expect(calls[0].init).toMatchObject({
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'application/json', 'User-Agent': userAgent },
    });
    expect(sleep).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      verdict: 'all-200',
      mode: 'calendar-once',
      planned: 1,
      requestsSent: 1,
      okResponses: 1,
      firstRefusal: null,
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      resource: 'calendar',
      status: 200,
      edgeColo: 'DUB',
      cfCacheStatus: 'HIT',
    });
    expect(Number.isInteger(emitted[0].races)).toBe(true);
    expect(emitted[0].races).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain('MRData');
  });

  it('stops after a 429 too, and records it in the Worker vocabulary with a fingerprint', async () => {
    const html =
      '<!DOCTYPE html><html><head><title>429 Too Many Requests</title></head><body>Too Many Requests</body></html>';
    const { transport, calls } = jolpica(() =>
      refusal(429, html, {
        'content-type': 'text/html',
        'cf-ray': 'a55adea84dba9d4b-DUB',
        'cf-cache-status': 'BYPASS',
        'x-amzn-requestid': 'secret-value-never-logged',
        'x-unlisted-thing': 'also-never-logged',
      }),
    );
    const result = await measure({
      season: 2026,
      mode: 'calendar-once',
      transport,
      sleep: noSleep,
      clock,
    });
    expect(calls).toHaveLength(1);
    expect(result.verdict).toBe('rate-limited');
    const [record] = result.records;
    expect(record.worker).toEqual({
      providerCacheStatus: 'BYPASS',
      providerEdgeColo: 'DUB',
      providerRefusalLayer: 'unknown',
      providerRefusalBody: 'other',
      providerRetryAfterForm: 'absent',
      providerServer: 'cloudflare',
      providerBodyMedia: 'html',
      providerRay: 'a55adea84dba9d4b-DUB',
    });
    expect(record.fingerprint).toEqual({
      headerMarks: [
        'cf-cache-status',
        'cf-ray',
        'content-type',
        'server',
        'x-amzn-*',
      ],
      otherHeaders: 1,
      bodyBytes: new TextEncoder().encode(html).byteLength,
      bodySha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      title: 'too-many-requests',
    });
    const text = JSON.stringify(result) + summaryMarkdown(result);
    expect(text).not.toMatch(
      /Too Many Requests|secret-value|also-never|x-unlisted/,
    );
    expect(summaryMarkdown(result)).toContain('title `too-many-requests`');
  });

  it('treats a refusal body over 4 KiB as oversize, as the Worker does', async () => {
    const { transport } = jolpica(() =>
      refusal(429, 'x'.repeat(4097), { 'content-type': 'text/html' }),
    );
    const result = await measure({
      season: 2026,
      mode: 'calendar-once',
      transport,
      sleep: noSleep,
      clock,
    });
    expect(result.records[0].worker.providerRefusalBody).toBe('oversize');
    expect(result.records[0].fingerprint).toMatchObject({
      bodyBytes: null,
      bodySha256: null,
      title: 'absent',
    });
  });

  it('sends one request and nothing more on a network failure', async () => {
    const { transport, calls } = jolpica(() => new TypeError('fetch failed'));
    const result = await measure({
      season: 2026,
      mode: 'calendar-once',
      transport,
      sleep: noSleep,
      clock,
    });
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ verdict: 'network', requestsSent: 1 });
  });

  it('refuses an unknown mode before sending anything', async () => {
    const { transport, calls } = jolpica();
    await expect(
      measure({ season: 2026, mode: 'calendar-twice', transport, clock }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe('measurement: helpers', () => {
  it('uses the batch capture rule for rounds (race start + 5 h)', () => {
    const calendar = {
      MRData: {
        RaceTable: {
          Races: [
            { round: '1', date: '2026-03-01', time: '12:00:00Z' },
            { round: '2', date: '2026-03-08', time: '12:00:00Z' },
            { round: '3', date: '2026-03-08' },
          ],
        },
      },
    };
    expect(eligibleRounds(calendar, new Date('2026-03-08T16:59:59Z'))).toEqual([
      1,
    ]);
    expect(eligibleRounds(calendar, new Date('2026-03-08T17:00:00Z'))).toEqual([
      1, 2,
    ]);
    expect(eligibleRounds(calendar, new Date('2026-03-09T04:59:59Z'))).toEqual([
      1, 2, 3,
    ]);
    expect(eligibleRounds({}, new Date())).toBeNull();
  });

  it('keeps header values to allow-listed shapes', () => {
    expect(
      headerFacts(
        new Headers({
          server: 'nginx',
          'cf-ray': 'x',
          'cf-cache-status': 'weird',
          'content-type': 'text/html; x',
        }),
      ),
    ).toEqual({
      server: 'other',
      cfRay: null,
      cfCacheStatus: null,
      contentType: 'text/html',
    });
    expect(retryAfterFacts('x'.repeat(65), new Date())).toEqual({
      retryAfterRaw: 'invalid',
      retryAfterSeconds: null,
    });
    expect(
      retryAfterFacts(
        'Wed, 04 Nov 2026 21:00:00 GMT',
        new Date('2026-11-04T20:59:00Z'),
      ),
    ).toEqual({
      retryAfterRaw: 'Wed, 04 Nov 2026 21:00:00 GMT',
      retryAfterSeconds: 60,
    });
    expect(bodyClass('  ')).toBe('empty');
    expect(bodyClass('[1]')).toBe('json-other');
    expect(bodyClass('Too Many Requests')).toBe('other');
  });

  it('accepts only --season, --summary and --mode', () => {
    expect(parseArguments(['--season', '2026'])).toEqual({
      season: 2026,
      summary: null,
      mode: 'capture',
    });
    expect(
      parseArguments(['--season', '2026', '--mode', 'calendar-once']),
    ).toEqual({ season: 2026, summary: null, mode: 'calendar-once' });
    expect(() =>
      parseArguments(['--season', '2026', '--mode', 'calendar-twice']),
    ).toThrow();
    expect(() =>
      parseArguments([
        '--season',
        '2026',
        '--mode',
        'capture',
        '--mode',
        'capture',
      ]),
    ).toThrow();
    expect(() => parseArguments([])).toThrow();
    expect(() =>
      parseArguments(['--season', '2026', '--retry', '3']),
    ).toThrow();
    expect(() => parseArguments(['--season', 'x'])).toThrow();
  });

  it('the CLI refuses bad arguments before sending anything', () => {
    const run = spawnSync(process.execPath, [script, '--season', 'nope'], {
      encoding: 'utf8',
    });
    expect(run.status).toBe(2);
    expect(run.stdout).toBe('');
  });
});

describe('the workflow', () => {
  const text = readFileSync(workflow, 'utf8');
  const doc = yaml.load(text);
  const job = doc.jobs.measure;

  it('can only be dispatched by hand, on master, with the confirmation', () => {
    expect(Object.keys(doc.on)).toEqual(['workflow_dispatch']);
    expect(job.if).toBe(
      "github.ref == 'refs/heads/master' && (inputs.confirm == 'measure-once' || inputs.confirm == 'calendar-once')",
    );
    expect(doc.concurrency).toEqual({
      group: 'jolpica-egress-measure',
      'cancel-in-progress': false,
    });
    expect(job['timeout-minutes']).toBeLessThanOrEqual(10);
  });

  it('holds no credential and uploads nothing', () => {
    expect(doc.permissions).toEqual({ contents: 'read' });
    expect(text).not.toMatch(
      /secrets\.|upload-artifact|GITHUB_TOKEN|actions\/cache/,
    );
    expect(job.steps[0].with['persist-credentials']).toBe(false);
  });

  it('pins every action to a full commit SHA and runs only the measurement', () => {
    const uses = job.steps.filter((s) => s.uses).map((s) => s.uses);
    expect(uses).toHaveLength(2);
    for (const use of uses)
      expect(use).toMatch(/^actions\/(checkout|setup-node)@[0-9a-f]{40}$/);
    const runs = job.steps.filter((s) => s.run).map((s) => s.run.trim());
    // The mode is one of two literals chosen by the typed confirmation; no
    // input text reaches the command line.
    expect(runs).toEqual([
      "node services/edge-api/scripts/jolpica-egress/measure.mjs --season 2026 --mode ${{ inputs.confirm == 'calendar-once' && 'calendar-once' || 'capture' }} --summary \"$GITHUB_STEP_SUMMARY\"",
    ]);
  });
});

describe('the measurement stays self-contained', () => {
  const importsOf = (source) =>
    [...source.matchAll(/^import [\s\S]*? from '([^']+)';$/gm)].map(
      (m) => m[1],
    );

  it('imports only Node built-ins and its own refusal facts', () => {
    const source = readFileSync(script, 'utf8');
    expect(
      importsOf(source).filter((name) => !name.startsWith('node:')),
    ).toEqual(['./refusal-facts.mjs']);
    expect(source).not.toMatch(/process\.env/);
    const facts = readFileSync(
      resolve(dirname(script), 'refusal-facts.mjs'),
      'utf8',
    );
    expect(importsOf(facts)).toEqual(['node:crypto']);
    expect(facts).not.toMatch(/process\.env|fetch\(/);
  });
});
