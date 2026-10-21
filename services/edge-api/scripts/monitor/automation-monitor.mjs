#!/usr/bin/env node
/**
 * The automatic path's outside-in monitor (ADR 0028 D9).
 *
 *   node scripts/monitor/automation-monitor.mjs --base-url <https://host>
 *        [--skip-heartbeat] [--simulate-failure]
 *        [--heartbeat-max-age-hours N] [--results-late-after-hours N]
 *
 * It sends three public GETs - `/v1/status`, the current season's calendar
 * and the earliest unsettled event - and exits non-zero on any finding, so a
 * scheduled CI job that runs it fails and its owner is notified. It needs no
 * credential and reads nothing an app user could not read. It never calls a
 * provider and never triggers synchronization.
 *
 * `--skip-heartbeat` is for an environment that is not yet automatic: there
 * is no heartbeat before activation. `--simulate-failure` exits 1 after the
 * reads, whatever they found: it is how alert delivery is verified (gate
 * AU-6) without breaking anything.
 */

import { pathToFileURL } from 'node:url';

import {
  DEFAULT_THRESHOLDS,
  evaluateAutomationHealth,
  pendingRound,
} from './automation-health.mjs';

const USER_AGENT =
  'GridView-automation-monitor/1 (+https://gridview.netlify.app)';
const TIMEOUT_MS = 15_000;

/** @param {string[]} argv */
export function parseArguments(argv) {
  const options = {
    baseUrl: /** @type {string | null} */ (null),
    requireHeartbeat: true,
    simulateFailure: false,
    thresholds: { ...DEFAULT_THRESHOLDS },
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined) throw new Error(`${argument} needs a value`);
      index += 1;
      return next;
    };
    switch (argument) {
      case '--base-url':
        options.baseUrl = value();
        break;
      case '--skip-heartbeat':
        options.requireHeartbeat = false;
        break;
      case '--simulate-failure':
        options.simulateFailure = true;
        break;
      case '--heartbeat-max-age-hours':
        options.thresholds.heartbeatMaxAgeHours = positive(value(), argument);
        break;
      case '--results-late-after-hours':
        options.thresholds.resultsLateAfterHours = positive(value(), argument);
        break;
      default:
        throw new Error(`unknown argument ${argument}`);
    }
  }
  if (options.baseUrl === null) throw new Error('--base-url is required');
  const url = new URL(options.baseUrl);
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1') {
    throw new Error('--base-url must be https');
  }
  options.baseUrl = url.origin;
  return options;
}

/** @param {string} raw @param {string} name */
function positive(raw, name) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return parsed;
}

/**
 * One public GET, retried once after a network error or a 5xx. Answers the
 * envelope's `data`, or `null` when the resource could not be read.
 *
 * @param {string} url
 * @param {typeof fetch} fetchImpl
 */
async function readData(url, fetchImpl) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status >= 500 && attempt === 0) continue;
      if (response.status !== 200) return null;
      const body = await response.json();
      return typeof body === 'object' && body !== null && 'data' in body
        ? body.data
        : null;
    } catch {
      if (attempt === 1) return null;
    }
  }
  return null;
}

/**
 * @param {ReturnType<typeof parseArguments>} options
 * @param {{ fetch?: typeof fetch, now?: () => Date }} [io]
 */
export async function runMonitor(options, io = {}) {
  const fetchImpl = io.fetch ?? fetch;
  const now = io.now ?? (() => new Date());
  const base = options.baseUrl;

  const status = await readData(`${base}/v1/status`, fetchImpl);
  const season =
    status !== null && Number.isInteger(status.currentSeason)
      ? status.currentSeason
      : null;
  const calendarData =
    season === null
      ? null
      : await readData(`${base}/v1/seasons/${season}/calendar`, fetchImpl);
  const calendar = Array.isArray(calendarData) ? calendarData : null;
  const pending = calendar === null ? null : pendingRound(calendar);
  const eventData =
    pending === null
      ? null
      : await readData(
          `${base}/v1/seasons/${season}/grand-prix/${pending}`,
          fetchImpl,
        );

  const health = evaluateAutomationHealth({
    now: now(),
    status,
    calendar,
    pendingEvent:
      eventData !== null && typeof eventData === 'object'
        ? { round: eventData.round, sessions: eventData.sessions }
        : null,
    requireHeartbeat: options.requireHeartbeat,
    thresholds: options.thresholds,
  });
  const findings = options.simulateFailure
    ? [...health.findings, { code: 'simulated-failure' }]
    : health.findings;
  return {
    checkedAt: now().toISOString(),
    baseUrl: base,
    season,
    pendingRound: pending,
    lastSuccessfulSyncAt:
      status !== null && typeof status.lastSuccessfulSyncAt === 'string'
        ? status.lastSuccessfulSyncAt
        : null,
    ok: findings.length === 0,
    findings,
  };
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`automation-monitor: ${error.message}`);
    process.exit(2);
  }
  const report = await runMonitor(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    for (const finding of report.findings) {
      console.error(`::error title=GridView automation::${finding.code}`);
    }
    process.exit(1);
  }
}
