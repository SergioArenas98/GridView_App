// Jolpica egress measurement (AU-4 follow-up, live-test step L1).
//
//   node services/edge-api/scripts/jolpica-egress/measure.mjs --season 2026 [--summary <file>]
//
// Answers one question: is a GitHub-hosted runner refused by Jolpica the way
// the staging Worker was (HTTP 429 after one or two requests on 2026-11-03 and
// 2026-11-04)? It sends exactly the requests a season-batch capture sends,
// in the same order, and nothing else:
//   - the six season-level GETs, then one results GET per round whose race
//     started at least five hours ago (the batch capture rule);
//   - one at a time, 2 s apart; never more than 30;
//   - the first non-200 (or a timeout or network error) ends the run. Nothing
//     is retried.
//
// It needs no credential and reads no environment variable. Response bodies
// are read only to check that a 200 is JSON (and, for a refusal, to classify
// the first 2 KiB into a fixed label); they are then discarded. Nothing is
// written except the optional Markdown summary. The output is one JSON line
// per request plus a verdict line: statuses, timings, sizes, allow-listed
// header values (`server` class, `cf-ray`, `cf-cache-status`, `Retry-After`).
// No body, no provider data, no IP address.
//
// Exit codes: 0 a measurement was recorded (whatever Jolpica answered),
// 1 an internal error, 2 a usage error.

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const origin = 'https://api.jolpi.ca';
export const userAgent =
  'GridView/1.0 (+https://github.com/SergioArenas98/GridView_App)';
/** Fixed: never faster than one request every two seconds. */
export const spacingMs = 2000;
export const requestTimeoutMs = 10_000;
export const maxResponseBytes = 2 * 1024 * 1024;
export const refusalSampleBytes = 2048;
export const maxRequests = 30;
export const batchCaptureOffsetMs = 5 * 60 * 60 * 1000;

const seasonResources = [
  ['calendar', 'races'],
  ['circuits', 'circuits'],
  ['drivers', 'drivers'],
  ['constructors', 'constructors'],
  ['driver-standings', 'driverstandings'],
  ['constructor-standings', 'constructorstandings'],
];

export function parseArguments(argv) {
  let season = null;
  let summary = null;
  for (let i = 0; i < argv.length; i += 2) {
    const [name, value] = [argv[i], argv[i + 1]];
    if (value === undefined) throw new Error(`missing value for ${name}`);
    if (name === '--season' && season === null) season = Number(value);
    else if (name === '--summary' && summary === null) summary = value;
    else throw new Error(`unexpected argument ${name}`);
  }
  if (!Number.isSafeInteger(season) || season < 1950 || season > 2100) {
    throw new Error('--season must be a four-digit year');
  }
  return { season, summary };
}

export function url(season, path) {
  return `${origin}/ergast/f1/${season}/${path}/?limit=100`;
}

/** Rounds a batch capture at `at` would request: race start + 5 h <= at. */
export function eligibleRounds(calendar, at) {
  const races = calendar?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races) || races.length === 0) return null;
  const rounds = [];
  for (const race of races) {
    const round = Number(race?.round);
    const date = race?.date;
    const time = race?.time ?? '23:59:59Z';
    if (!Number.isSafeInteger(round) || round < 1 || round > 30) return null;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return null;
    }
    if (
      typeof time !== 'string' ||
      !/^\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(time)
    ) {
      return null;
    }
    const start = Date.parse(`${date}T${time}`);
    if (Number.isNaN(start)) return null;
    if (start + batchCaptureOffsetMs <= at.getTime()) rounds.push(round);
  }
  return rounds.sort((a, b) => a - b);
}

/** Allow-listed response facts. Never a body or an arbitrary header value. */
export function headerFacts(headers) {
  const server = headers.get('server');
  const ray = headers.get('cf-ray')?.trim() ?? null;
  const cache = headers.get('cf-cache-status')?.trim() ?? null;
  const type = headers.get('content-type');
  return {
    server:
      server === null
        ? null
        : server.trim().toLowerCase() === 'cloudflare'
          ? 'cloudflare'
          : 'other',
    cfRay: ray !== null && /^[0-9a-f]{16}-[A-Z]{3}$/.test(ray) ? ray : null,
    cfCacheStatus:
      cache !== null &&
      /^(HIT|MISS|EXPIRED|STALE|BYPASS|DYNAMIC|REVALIDATED|UPDATING|NONE)$/.test(
        cache,
      )
        ? cache
        : null,
    contentType:
      type === null
        ? null
        : /^[a-z]+\/[a-z0-9.+-]+$/.test(
              (type.split(';')[0] ?? '').trim().toLowerCase(),
            )
          ? (type.split(';')[0] ?? '').trim().toLowerCase()
          : 'other',
  };
}

/** `Retry-After` as given (if printable and short) and in seconds (if parseable). */
export function retryAfterFacts(value, at) {
  if (value === null) return { retryAfterRaw: null, retryAfterSeconds: null };
  const raw = /^[\x20-\x7e]{1,64}$/.test(value) ? value : 'invalid';
  const trimmed = value.trim();
  let seconds = null;
  if (/^\d{1,9}$/.test(trimmed)) seconds = Number(trimmed);
  else {
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed))
      seconds = Math.max(0, Math.round((parsed - at.getTime()) / 1000));
  }
  return { retryAfterRaw: raw, retryAfterSeconds: seconds };
}

/** A fixed label for a refusal body's first bytes. The bytes are never kept. */
export function bodyClass(text) {
  const sample = text.trim();
  if (sample === '') return 'empty';
  if (/error code:\s*1015/i.test(sample)) return 'cloudflare-1015';
  if (/^<(!doctype|html)/i.test(sample)) return 'html';
  try {
    const value = JSON.parse(sample);
    if (value && typeof value === 'object' && 'detail' in value)
      return 'json-detail';
    return 'json-other';
  } catch {
    return 'other';
  }
}

async function readAtMost(response, limit) {
  if (!response.body) return { bytes: new Uint8Array(0), truncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.byteLength > limit) {
      chunks.push(value.subarray(0, limit - total));
      total = limit;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}

/** One GET, measured. Never retries and never throws for a provider failure. */
async function measureOne(transport, n, resource, target, clock) {
  const startedAt = clock();
  const record = { n, resource, startedAt: startedAt.toISOString() };
  let response;
  try {
    response = await transport(target, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'application/json', 'User-Agent': userAgent },
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (error) {
    const timedOut =
      error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return {
      ...record,
      status: null,
      durationMs: clock() - startedAt,
      failure: timedOut ? 'timeout' : 'network',
    };
  }
  const facts = headerFacts(response.headers);
  if (response.status !== 200) {
    let sample;
    try {
      const { bytes } = await readAtMost(response, refusalSampleBytes);
      sample = new TextDecoder().decode(bytes);
    } catch {
      sample = '';
    }
    return {
      ...record,
      status: response.status,
      durationMs: clock() - startedAt,
      ...facts,
      ...retryAfterFacts(response.headers.get('retry-after'), clock()),
      bodyClass: bodyClass(sample),
      failure: response.status === 429 ? 'rate-limited' : 'http-error',
    };
  }
  let read;
  try {
    read = await readAtMost(response, maxResponseBytes);
  } catch {
    return {
      ...record,
      status: 200,
      durationMs: clock() - startedAt,
      ...facts,
      failure: 'network',
    };
  }
  const durationMs = clock() - startedAt;
  if (read.truncated) {
    return {
      ...record,
      status: 200,
      durationMs,
      ...facts,
      failure: 'too-large',
    };
  }
  let json;
  try {
    json = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(read.bytes),
    );
  } catch {
    return {
      ...record,
      status: 200,
      durationMs,
      ...facts,
      bytes: read.bytes.byteLength,
      failure: 'invalid-json',
    };
  }
  return {
    ...record,
    status: 200,
    durationMs,
    ...facts,
    bytes: read.bytes.byteLength,
    failure: null,
    json,
  };
}

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The measurement. `transport`, `sleep` and `clock` are injected so tests
 * never reach a network; the CLI passes global `fetch`, a timer and the clock.
 */
export async function measure({
  season,
  transport,
  sleep = realSleep,
  clock = () => new Date(),
  emit = () => {},
}) {
  const startedAt = clock().toISOString();
  const records = [];
  let planned = seasonResources.length;
  let outcome = null;

  const step = async (resource, target) => {
    if (records.length >= maxRequests) return { failure: 'request-cap' };
    if (records.length > 0) await sleep(spacingMs);
    const record = await measureOne(
      transport,
      records.length + 1,
      resource,
      target,
      () => clock(),
    );
    // The parsed body is used only for the calendar; it is never emitted or kept.
    const visible = Object.fromEntries(
      Object.entries(record).filter(([key]) => key !== 'json'),
    );
    records.push(visible);
    emit(visible);
    return record;
  };

  let calendar = null;
  for (const [resource, path] of seasonResources) {
    const record = await step(resource, url(season, path));
    if (record.failure) {
      outcome = record.failure;
      break;
    }
    if (resource === 'calendar') calendar = record.json;
  }
  if (outcome === null) {
    const rounds = eligibleRounds(calendar, clock());
    if (rounds === null) outcome = 'calendar-unusable';
    else {
      planned += rounds.length;
      if (planned > maxRequests) outcome = 'request-cap';
      for (const round of outcome === null ? rounds : []) {
        const record = await step(
          `results-${String(round).padStart(2, '0')}`,
          url(season, `${round}/results`),
        );
        if (record.failure) {
          outcome = record.failure;
          break;
        }
      }
    }
  }
  const refused = records.find((r) => r.failure !== null) ?? null;
  return {
    verdict: outcome === null ? 'all-200' : outcome,
    season,
    planned,
    requestsSent: records.length,
    okResponses: records.filter((r) => r.status === 200 && r.failure === null)
      .length,
    firstRefusal:
      refused === null
        ? null
        : { n: refused.n, resource: refused.resource, status: refused.status },
    spacingMs,
    userAgent,
    startedAt,
    endedAt: clock().toISOString(),
    records,
  };
}

/** Markdown for the job summary: the same facts, no body, no provider data. */
export function summaryMarkdown(result) {
  const lines = [
    '## Jolpica egress measurement (L1)',
    '',
    `**Verdict: \`${result.verdict}\`**: ${result.okResponses} × 200 of ${result.requestsSent} sent (${result.planned} planned), ${result.spacingMs} ms apart.`,
    '',
    `Started ${result.startedAt}, ended ${result.endedAt}. User-Agent \`${result.userAgent}\`.`,
    '',
    '| # | Resource | Status | ms | Bytes | cf-cache-status | cf-ray | Retry-After | Body class |',
    '|---|---|---|---|---|---|---|---|---|',
    ...result.records.map(
      (r) =>
        `| ${r.n} | ${r.resource} | ${r.status ?? r.failure} | ${r.durationMs} | ${r.bytes ?? ''} | ${r.cfCacheStatus ?? ''} | ${r.cfRay ?? ''} | ${r.retryAfterRaw ?? ''} | ${r.bodyClass ?? ''} |`,
    ),
    '',
  ];
  return lines.join('\n');
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`jolpica-egress: ${error.message}\n`);
    process.exit(2);
  }
  try {
    const result = await measure({
      season: options.season,
      transport: (target, init) => fetch(target, init),
      emit: (record) => process.stdout.write(`${JSON.stringify(record)}\n`),
    });
    const { records, ...verdict } = result;
    process.stdout.write(
      `${JSON.stringify({ ...verdict, records: records.length })}\n`,
    );
    if (options.summary)
      appendFileSync(options.summary, summaryMarkdown(result));
    if (result.verdict !== 'all-200') {
      process.stdout.write(
        `::warning title=Jolpica egress::verdict ${result.verdict} at request ${result.firstRefusal?.n ?? '?'}\n`,
      );
    }
  } catch (error) {
    process.stderr.write(
      `jolpica-egress: internal error ${error?.name ?? ''}\n`,
    );
    process.exit(1);
  }
}
