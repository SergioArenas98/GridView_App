// Automatic Jolpica capture for the season-batch path (PROOF OF CONCEPT, dormant).
//
// Produces exactly the capture the existing generator replays
// (`scripts/season-batch/README.md`, "Capture format"), with the rules of the
// owner-run captures of 2026-10-13 and 2026-10-19:
//   - fixed origin and paths; HTTPS; no redirects; identifying User-Agent;
//   - one request at a time, at least `minimumSpacingMs` apart;
//   - 10 s per request, 2 MiB per body, JSON only;
//   - the first non-200 stops the capture. Nothing is retried and nothing is
//     written: a capture is complete or it does not exist.
//
// The transport is injected. Nothing here calls global `fetch` by itself, and
// nothing reads a credential: Jolpica is unauthenticated.

import { createHash } from 'node:crypto';

export const jolpicaOrigin = 'https://api.jolpi.ca';
export const userAgent =
  'GridView/1.0 (+https://github.com/SergioArenas98/GridView_App)';
/** Never faster than one request a second (the owner captures used >= 1 s). */
export const minimumSpacingMs = 1000;
export const defaultSpacingMs = 2000;
export const requestTimeoutMs = 10_000;
export const maxResponseBytes = 2 * 1024 * 1024;
/** Six season-level requests plus at most 24 rounds. */
export const maxRequestsPerCapture = 30;
/** The batch capture rule: rounds whose race started >= 5 h before (cadence.ts). */
export const batchCaptureOffsetMs = 5 * 60 * 60 * 1000;

export const seasonResources = Object.freeze([
  ['calendar.json', 'races'],
  ['circuits.json', 'circuits'],
  ['drivers.json', 'drivers'],
  ['constructors.json', 'constructors'],
  ['driver-standings.json', 'driverstandings'],
  ['constructor-standings.json', 'constructorstandings'],
]);

function checkSeason(season) {
  if (!Number.isSafeInteger(season) || season < 1950 || season > 2100) {
    throw new RangeError('season must be a four-digit year');
  }
}

function checkRound(round) {
  if (!Number.isSafeInteger(round) || round < 1 || round > 30) {
    throw new RangeError('round must be an integer from 1 to 30');
  }
}

export function seasonUrl(season, path) {
  checkSeason(season);
  return `${jolpicaOrigin}/ergast/f1/${season}/${path}/?limit=100`;
}

export function resultsUrl(season, round) {
  checkRound(round);
  return seasonUrl(season, `${round}/results`);
}

export function resultsFile(round) {
  checkRound(round);
  return `results-${String(round).padStart(2, '0')}.json`;
}

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const utcTimePattern = /^\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/**
 * Race anchors from a Jolpica calendar body, with the runtime's rule
 * (`calendarAnchor` in cadence.ts): date + UTC time, or the date at
 * 23:59:59Z without a time. `null` when the body is not a usable calendar.
 */
export function calendarAnchors(calendar) {
  const races = calendar?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races) || races.length === 0) return null;
  const anchors = [];
  for (const race of races) {
    const round = Number(race?.round);
    const { date } = race ?? {};
    const time = race?.time ?? null;
    if (!Number.isSafeInteger(round) || round < 1 || round > 30) return null;
    if (typeof date !== 'string' || !calendarDatePattern.test(date))
      return null;
    if (
      time !== null &&
      (typeof time !== 'string' || !utcTimePattern.test(time))
    ) {
      return null;
    }
    const parsed = Date.parse(`${date}T${time ?? '23:59:59Z'}`);
    if (Number.isNaN(parsed)) return null;
    const start = new Date(parsed).toISOString();
    if (start.slice(0, 10) !== date) return null;
    anchors.push({ round, start });
  }
  anchors.sort((a, b) => a.round - b.round);
  return anchors;
}

/** Rounds a batch captured at `at` must carry (`isBatchCaptureEligible`). */
export function eligibleRounds(anchors, at) {
  return anchors
    .filter(
      ({ start }) => Date.parse(start) + batchCaptureOffsetMs <= at.getTime(),
    )
    .map(({ round }) => round);
}

/** `Retry-After` in delta-seconds or HTTP-date form, as an ISO instant. */
export function parseRetryAfter(value, at) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^\d{1,9}$/.test(trimmed)) {
    return new Date(at.getTime() + Number(trimmed) * 1000).toISOString();
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) || parsed <= at.getTime()
    ? null
    : new Date(parsed).toISOString();
}

/**
 * Bounded, non-payload facts about a refusal, so the next 429 says which
 * layer answered. Allow-listed values only; never a body or arbitrary header.
 */
export function refusalDiagnostics(headers) {
  const server = headers.get('server');
  const ray = headers.get('cf-ray');
  const cache = headers.get('cf-cache-status');
  const type = headers.get('content-type');
  const retryAfter = headers.get('retry-after');
  return {
    server:
      server === null
        ? null
        : server.trim().toLowerCase() === 'cloudflare'
          ? 'cloudflare'
          : 'other',
    cfRay:
      ray !== null && /^[0-9a-f]{16}-[A-Z]{3}$/.test(ray.trim())
        ? ray.trim()
        : null,
    cfCacheStatus:
      cache !== null &&
      /^(HIT|MISS|EXPIRED|STALE|BYPASS|DYNAMIC|REVALIDATED|UPDATING|NONE)$/.test(
        cache.trim(),
      )
        ? cache.trim()
        : null,
    contentType:
      type === null
        ? null
        : (type.split(';')[0] ?? '').trim().toLowerCase().slice(0, 64),
    retryAfterRaw:
      retryAfter === null
        ? null
        : /^[\x20-\x7e]{1,64}$/.test(retryAfter)
          ? retryAfter
          : 'invalid',
  };
}

async function readBounded(response, limit) {
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

async function discard(response) {
  try {
    await response.body?.cancel();
  } catch {
    // Already consumed or errored: nothing to release.
  }
}

const jsonMediaType = /^application\/(?:[\w.+-]+\+)?json$/i;

/** One GET. Never retries; never throws for a provider or network failure. */
export async function getOnce(transport, url, now) {
  let response;
  try {
    response = await transport(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'application/json', 'User-Agent': userAgent },
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch {
    return { ok: false, failure: 'network-or-timeout', url };
  }
  const { status } = response;
  if (status !== 200) {
    const diagnostics = refusalDiagnostics(response.headers);
    await discard(response);
    if (status === 429) {
      return {
        ok: false,
        failure: 'provider-rate-limited',
        url,
        status,
        retryAfter: parseRetryAfter(response.headers.get('retry-after'), now()),
        diagnostics,
      };
    }
    return {
      ok: false,
      failure:
        status >= 300 && status < 400
          ? 'redirect-rejected'
          : 'provider-http-error',
      url,
      status,
      diagnostics,
    };
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!jsonMediaType.test((contentType.split(';')[0] ?? '').trim())) {
    await discard(response);
    return { ok: false, failure: 'invalid-content-type', url, status };
  }
  let bytes;
  try {
    bytes = await readBounded(response, maxResponseBytes);
  } catch {
    // The body stream failed after the headers: no usable response.
    return { ok: false, failure: 'network-or-timeout', url, status };
  }
  if (bytes === null)
    return { ok: false, failure: 'response-too-large', url, status };
  let json;
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, failure: 'malformed-json', url, status };
  }
  return {
    ok: true,
    url,
    contentType,
    bytes,
    json,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

/** A sleep that can be replaced in tests. */
export const realSleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function pacer(sleep, spacingMs) {
  if (!Number.isSafeInteger(spacingMs) || spacingMs < minimumSpacingMs) {
    throw new RangeError(
      `spacing must be an integer of at least ${minimumSpacingMs} ms`,
    );
  }
  let sent = 0;
  return {
    get sent() {
      return sent;
    },
    async next() {
      if (sent > 0) await sleep(spacingMs);
      sent += 1;
    },
  };
}

/**
 * One results request for `round`: the cheap probe a run makes before it
 * spends a full capture. `complete` is a shallow check only; the generator
 * still validates everything.
 */
export async function probeRound({
  transport,
  season,
  round,
  now = () => new Date(),
}) {
  const url = resultsUrl(season, round);
  const got = await getOnce(transport, url, now);
  if (!got.ok) return { ...got, requestsSent: 1 };
  const races = got.json?.MRData?.RaceTable?.Races;
  const race = Array.isArray(races) && races.length === 1 ? races[0] : null;
  const results = race?.Results;
  const complete =
    race !== null &&
    Number(race.round) === round &&
    Array.isArray(results) &&
    results.length > 0 &&
    Number(got.json.MRData.total) === results.length;
  return { ok: true, url, sha256: got.sha256, complete, requestsSent: 1 };
}

/**
 * The full capture: six season-level requests, then one results request per
 * eligible round. Returns the capture manifest and bodies only when every
 * response was a valid 200.
 */
export async function captureSeason({
  transport,
  season,
  now = () => new Date(),
  sleep = realSleep,
  spacingMs = defaultSpacingMs,
  maxRequests = maxRequestsPerCapture,
}) {
  checkSeason(season);
  const pace = pacer(sleep, spacingMs);
  const responses = [];
  const bodies = new Map();
  const stop = (got) => ({ ...got, ok: false, requestsSent: pace.sent });

  const take = async (file, url) => {
    await pace.next();
    const got = await getOnce(transport, url, now);
    if (got.ok) {
      responses.push({
        url,
        status: 200,
        contentType: got.contentType,
        file,
        byteLength: got.bytes.byteLength,
        sha256: got.sha256,
      });
      bodies.set(file, got.bytes);
    }
    return got;
  };

  let calendar = null;
  for (const [file, path] of seasonResources) {
    const got = await take(file, seasonUrl(season, path));
    if (!got.ok) return stop(got);
    if (file === 'calendar.json') calendar = got.json;
  }
  const anchors = calendarAnchors(calendar);
  if (anchors === null) return stop({ failure: 'calendar-unusable' });
  const rounds = eligibleRounds(anchors, now());
  if (seasonResources.length + rounds.length > maxRequests) {
    return stop({ failure: 'request-cap-exceeded' });
  }
  for (const round of rounds) {
    const got = await take(resultsFile(round), resultsUrl(season, round));
    if (!got.ok) return stop(got);
  }
  return {
    ok: true,
    requestsSent: pace.sent,
    anchors,
    manifest: {
      kind: 'gridview-jolpica-capture',
      schemaVersion: 1,
      season,
      // The instant the capture was complete (README "Capture format"). If a
      // race crossed its five-hour mark during the capture, the generator's
      // eligibility check refuses it: fail closed, never a partial batch.
      observedAt: now().toISOString(),
      classificationRounds: rounds,
      responses,
    },
    bodies,
  };
}
