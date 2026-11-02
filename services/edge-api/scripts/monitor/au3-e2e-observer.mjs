#!/usr/bin/env node
/**
 * Gate AU-3's temporary observer (docs/release/automatic-updates.md section
 * 8.2). TEMPORARY: it exists only for the asynchronous demonstration and is
 * removed by the pull request that unschedules the e2e Worker afterwards.
 *
 *   node scripts/monitor/au3-e2e-observer.mjs --out <dir>
 *
 * It runs the real automation monitor (`runMonitor`, unchanged) against the
 * e2e host, then reads a fixed list of public resources once each and keeps
 * every answer verbatim. Everything is written to <dir> with its instants, for
 * the workflow to keep as an artifact.
 *
 * The host is fixed: it cannot be pointed at staging or production, and every
 * request, the monitor's included, goes through a transport that refuses any
 * other origin and any redirect. Every request is a public GET with no
 * credential, so the observer can read nothing an app user could not. It
 * exits 1 when the monitor reports a finding or cannot run, after writing
 * everything, so GitHub notifies the owner.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseArguments, runMonitor } from './automation-monitor.mjs';

export const E2E_BASE_URL = 'https://gridview-api-e2e.sejuma18.workers.dev';

/** What the demonstration's criteria are read from, in a fixed order. */
export const PUBLIC_PATHS = Object.freeze([
  '/v1/status',
  '/v1/bootstrap',
  '/v1/home',
  '/v1/content/manifest',
  '/v1/seasons/2026/calendar',
  '/v1/seasons/2026/grand-prix/22',
  '/v1/seasons/2026/grand-prix/22/results',
  '/v1/seasons/2026/grand-prix/23',
  '/v1/seasons/2026/standings/drivers',
  '/v1/seasons/2026/standings/constructors',
]);

const KEPT_HEADERS = Object.freeze([
  'age',
  'cache-control',
  'cf-ray',
  'content-type',
  'date',
  'etag',
]);
const USER_AGENT =
  'GridView-au3-e2e-observer/1 (+https://gridview.netlify.app)';
const TIMEOUT_MS = 15_000;

/** @param {string[]} argv */
export function parseObserverArguments(argv) {
  const options = { out: /** @type {string | null} */ (null) };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--out': {
        const next = argv[index + 1];
        if (next === undefined) throw new Error('--out needs a value');
        options.out = next;
        index += 1;
        break;
      }
      default:
        throw new Error(`unknown argument ${argument}`);
    }
  }
  if (options.out === null) throw new Error('--out is required');
  return options;
}

/**
 * A fetch that reaches the e2e host only: any other origin is refused before
 * anything is sent, and a redirect fails instead of being followed.
 *
 * @param {typeof fetch} fetchImpl
 * @returns {typeof fetch}
 */
export function e2eOnly(fetchImpl) {
  return async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== E2E_BASE_URL) {
      throw new Error(`refused: ${url.origin} is not the e2e host`);
    }
    return fetchImpl(url.href, { ...init, redirect: 'error' });
  };
}

/** @param {string} path */
function fileNameOf(path) {
  return `${path.replace(/^\//, '').replace(/[^A-Za-z0-9]+/g, '_')}.json`;
}

/** @param {Uint8Array} bytes */
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** A failure as far as it can be described without its stack. */
function describeError(error) {
  if (!(error instanceof Error)) return { name: 'unknown' };
  const cause = error.cause;
  return {
    name: error.name,
    message: error.message,
    cause:
      cause instanceof Error
        ? {
            name: cause.name,
            message: cause.message,
            code: 'code' in cause ? cause.code : null,
          }
        : null,
  };
}

/**
 * One public GET, kept byte for byte. No retry: a failure is recorded as
 * such. When the answer's head arrived but its body did not, the status and
 * headers are kept with the error.
 *
 * @param {string} path
 * @param {{ fetch: typeof fetch, now: () => Date }} io
 */
async function capture(path, io) {
  const requestedAt = io.now().toISOString();
  let response;
  try {
    response = await io.fetch(`${E2E_BASE_URL}${path}`, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return {
      path,
      requestedAt,
      receivedAt: io.now().toISOString(),
      status: null,
      error: describeError(error),
    };
  }
  const head = {
    path,
    requestedAt,
    status: response.status,
    headers: Object.fromEntries(
      KEPT_HEADERS.flatMap((name) => {
        const value = response.headers.get(name);
        return value === null ? [] : [[name, value]];
      }),
    ),
  };
  try {
    const body = new Uint8Array(await response.arrayBuffer());
    return { ...head, receivedAt: io.now().toISOString(), body };
  } catch (error) {
    return {
      ...head,
      receivedAt: io.now().toISOString(),
      error: describeError(error),
    };
  }
}

/** The GitHub run this observation belongs to, when there is one. */
function runOf(env) {
  return {
    repository: env.GITHUB_REPOSITORY ?? null,
    runId: env.GITHUB_RUN_ID ?? null,
    runAttempt: env.GITHUB_RUN_ATTEMPT ?? null,
    event: env.GITHUB_EVENT_NAME ?? null,
    sha: env.GITHUB_SHA ?? null,
  };
}

/**
 * The real monitor; a crash is a report too, never a lost observation.
 *
 * @param {typeof runMonitor} monitor
 * @param {{ fetch: typeof fetch, now: () => Date }} io
 */
async function monitorReport(monitor, io) {
  try {
    return await monitor(parseArguments(['--base-url', E2E_BASE_URL]), io);
  } catch (error) {
    return {
      checkedAt: io.now().toISOString(),
      baseUrl: E2E_BASE_URL,
      ok: false,
      error: describeError(error),
    };
  }
}

/**
 * @param {ReturnType<typeof parseObserverArguments>} options
 * @param {{ fetch?: typeof fetch, now?: () => Date, env?: Record<string, string | undefined>, monitor?: typeof runMonitor }} [io]
 *   `monitor` is replaceable only so a crash can be tested; it defaults to
 *   the real `runMonitor`.
 */
export async function observe(options, io = {}) {
  const fetchImpl = e2eOnly(io.fetch ?? fetch);
  const now = io.now ?? (() => new Date());
  const env = io.env ?? process.env;
  const meta = {
    startedAt: now().toISOString(),
    baseUrl: E2E_BASE_URL,
    run: runOf(env),
  };
  await mkdir(options.out, { recursive: true });

  // Written first and again at the end, so a run killed part-way still says
  // when it started and that it did not finish.
  await writeJson(options.out, 'meta.json', { ...meta, finishedAt: null });

  const monitor = await monitorReport(io.monitor ?? runMonitor, {
    fetch: fetchImpl,
    now,
  });
  await writeJson(options.out, 'monitor-report.json', monitor);

  await mkdir(join(options.out, 'responses'), { recursive: true });
  const index = [];
  for (const path of PUBLIC_PATHS) {
    const answer = await capture(path, { fetch: fetchImpl, now });
    if ('body' in answer) {
      // Recorded with `/` on every platform: it names a file in the artifact.
      const file = `responses/${fileNameOf(path)}`;
      await writeFile(join(options.out, file), answer.body);
      const { body, ...rest } = answer;
      index.push({
        ...rest,
        file,
        bytes: body.byteLength,
        sha256: sha256(body),
      });
    } else {
      index.push(answer);
    }
    await writeJson(options.out, 'responses/index.json', index);
  }
  // A 404 is an answer (round 22's results before they exist); only a read
  // that got no answer, or no body, counts as failed.
  const failedReads = index.filter((entry) => 'error' in entry).length;
  await writeJson(options.out, 'meta.json', {
    ...meta,
    finishedAt: now().toISOString(),
    monitorOk: monitor.ok,
    failedReads,
  });
  return { ok: monitor.ok, failedReads };
}

/** @param {string} dir @param {string} name @param {unknown} value */
async function writeJson(dir, name, value) {
  await writeFile(
    join(dir, name),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  let options;
  try {
    options = parseObserverArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`au3-e2e-observer: ${error.message}`);
    process.exit(2);
  }
  const result = await observe(options);
  if (result.failedReads > 0) {
    console.log(
      `::warning title=AU-3 observer::${result.failedReads} public read(s) failed; see responses/index.json`,
    );
  }
  if (!result.ok) {
    console.error(
      '::error title=AU-3 observer::the monitor reported a finding or could not run',
    );
    process.exit(1);
  }
}
