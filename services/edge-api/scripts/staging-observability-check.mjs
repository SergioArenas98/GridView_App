#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const expectedHost = 'gridview-api-staging.sejuma18.workers.dev';
const readinessTimeoutMs = 30000;
const readinessProbeIntervalMs = 1500;
const drainTimeoutMs = 20000;
const drainPollIntervalMs = 500;
const tailStopGraceMs = 1000;
const workflowTimeoutMs = 70000;
const stagingWorkerName = 'gridview-api-staging';
const wranglerTailArgs = Object.freeze([
  'tail',
  stagingWorkerName,
  '--format',
  'json',
]);

export const expectedOperations = Object.freeze([
  'request.completed',
  'sync.started',
  'sync.completed',
  'publication.completed',
  'cache.purge',
  'rollback.completed',
]);

export function normalizeAndValidateBaseUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') {
    throw new Error('Staging base URL must use https.');
  }
  if (parsed.hostname !== expectedHost) {
    throw new Error(`Staging base URL must use ${expectedHost}.`);
  }
  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export function resolveWranglerEntrypoint() {
  const packageJsonPath = require.resolve('wrangler/package.json');
  const entrypoint = resolve(
    dirname(packageJsonPath),
    'wrangler-dist',
    'cli.js',
  );
  if (!existsSync(entrypoint)) {
    throw new Error(
      'Could not resolve the local Wrangler JavaScript entrypoint.',
    );
  }
  return entrypoint;
}

// Launch Wrangler by invoking its real CLI entrypoint (wrangler-dist/cli.js)
// directly with Node on every platform. This is exactly what Wrangler's own
// bin/wrangler.js bootstrap does after a Node version check. Spawning the
// Windows .cmd wrapper through cmd.exe was previously used, but Node re-escapes
// the pre-quoted cmd command line with MSVCRT backslash-quote rules that cmd.exe
// does not understand, mangling the arguments so the wrapper "is not recognized
// as a command" and the tail exits within ~40ms. Going straight to the JS
// entrypoint sidesteps cmd.exe quoting entirely and keeps the tail alive.
export function buildWranglerTailCommand(platform = process.platform) {
  const command = process.execPath;
  const args = [
    '--no-warnings',
    resolveWranglerEntrypoint(),
    ...wranglerTailArgs,
  ];
  return {
    category: 'wrangler-tail',
    mode: 'direct-dist-cli',
    entrypointName: 'node_modules/wrangler/wrangler-dist/cli.js',
    command,
    args,
    options: {
      cwd: process.cwd(),
      env: wranglerChildEnvironment(),
      shell: false,
      windowsHide: platform === 'win32',
    },
  };
}

export async function runObservabilityCheck({ baseUrl, token }) {
  const base = normalizeAndValidateBaseUrl(baseUrl);
  const collector = createTailCollector();
  const diagnostic = createDiagnostic();
  const tailCommand = buildWranglerTailCommand();
  const tail = spawn(
    tailCommand.command,
    tailCommand.args,
    tailCommand.options,
  );

  diagnostic.tailProcessStarted = true;
  diagnostic.tailCommandMode = tailCommand.mode;
  diagnostic.tailCommandEntrypoint = tailCommand.entrypointName;

  let tailError = null;
  let cleanupRequested = false;
  const timeout = setTimeout(() => {
    diagnostic.timeoutOccurred = true;
    terminateChild(tail);
  }, workflowTimeoutMs);

  tail.stdout?.on('data', (chunk) => collector.push('stdout', chunk));
  tail.stderr?.on('data', (chunk) => collector.push('stderr', chunk));
  tail.on('error', (error) => {
    tailError = error;
  });
  tail.on('exit', (code, signal) => {
    diagnostic.tailExitCode = code;
    diagnostic.tailExitCodeHex =
      typeof code === 'number' ? hexExitCode(code) : null;
    diagnostic.tailExitCategory =
      typeof code === 'number' ? tailExitCategory(code) : null;
    diagnostic.tailExitSignal = signal;
    diagnostic.tailExitedEarly = !cleanupRequested;
  });

  try {
    if (tailError) throw childProcessError(tailCommand.category, tailError);

    const readiness = await waitForTailReadiness({
      base,
      collector,
      token,
      timeoutMs: readinessTimeoutMs,
      intervalMs: readinessProbeIntervalMs,
      shouldContinue: () =>
        !diagnostic.tailExitedEarly &&
        !diagnostic.timeoutOccurred &&
        tailError === null,
    });
    diagnostic.tailReadinessConfirmed = readiness.confirmed;
    diagnostic.readinessProbeStatuses = readiness.probeStatuses;
    mergeTailDiagnostic(diagnostic, readiness.tail);
    throwIfTimedOut(diagnostic);
    if (tailError) throw childProcessError(tailCommand.category, tailError);
    if (!readiness.confirmed) {
      throw diagnosticError(
        'wrangler-tail readiness was not confirmed before traffic.',
        diagnostic,
      );
    }

    try {
      diagnostic.trafficSteps = await driveTraffic(base, token);
    } catch (error) {
      if (Array.isArray(error?.trafficSteps)) {
        diagnostic.trafficSteps = error.trafficSteps;
      }
      mergeTailDiagnostic(diagnostic, buildTailDiagnostic(collector, token));
      throw diagnosticError(
        error instanceof Error
          ? error.message
          : 'Traffic workflow failed before completion.',
        diagnostic,
      );
    }

    throwIfTimedOut(diagnostic);
    const drain = await waitForExpectedOperations({
      collector,
      token,
      timeoutMs: drainTimeoutMs,
      intervalMs: drainPollIntervalMs,
    });
    diagnostic.drainCompleted = drain.completed;
    mergeTailDiagnostic(diagnostic, drain.tail);
    throwIfTimedOut(diagnostic);
    if (tailError) throw childProcessError(tailCommand.category, tailError);

    if (Object.values(diagnostic.redaction).some(Boolean)) {
      const categories = [
        ...new Set(
          diagnostic.redactionFindings.map((finding) => finding.category),
        ),
      ].sort();
      throw diagnosticError(
        `Sensitive or unsafe content was found in the tailed logs: ${categories.join(', ')}`,
        diagnostic,
      );
    }

    const missing = expectedOperations.filter(
      (operation) => !diagnostic.observedOperationNames.includes(operation),
    );
    if (missing.length > 0) {
      throw diagnosticError(
        `Missing expected log operations: ${missing.join(', ')}`,
        diagnostic,
      );
    }

    return diagnostic;
  } finally {
    clearTimeout(timeout);
    cleanupRequested = true;
    collector.flush();
    terminateChild(tail);
    await delay(tailStopGraceMs);
  }
}

export function createTailCollector() {
  const buffers = { stdout: '', stderr: '' };
  const records = [];

  function push(stream, chunk) {
    buffers[stream] += chunk.toString();
    const parts = buffers[stream].split(/\r?\n/);
    buffers[stream] = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.trim();
      if (line) records.push({ stream, line });
    }
  }

  function flush() {
    for (const stream of ['stdout', 'stderr']) {
      const line = buffers[stream].trim();
      if (line) {
        records.push({ stream, line });
        buffers[stream] = '';
      }
    }
  }

  function snapshot() {
    return [...records];
  }

  return {
    records,
    push,
    flush,
    snapshot,
  };
}

export function buildTailDiagnostic(collector, token) {
  const records = collector.snapshot();
  const jsonRecords = extractJsonRecords(records);
  const text = classifyTailText(records);

  let recordsParsedSuccessfully = 0;
  let parserShapeMismatches = 0;
  const operations = new Set();
  const recordKinds = new Set();
  let structuredApplicationLogEvents = 0;

  for (const parsed of jsonRecords.parsedRecords) {
    recordsParsedSuccessfully += 1;
    recordKinds.add(tailRecordKind(parsed));
    const extraction = extractApplicationLogEvents(parsed);
    if (extraction.shapeMismatch) parserShapeMismatches += 1;
    for (const event of extraction.events) {
      structuredApplicationLogEvents += 1;
      operations.add(event.operation);
    }
  }

  const rawTail = records.map((record) => record.line).join('\n');
  const redactionResult = scanRedaction(
    jsonRecords.parsedRecords,
    rawTail,
    token,
  );
  return {
    tailOutputLinesReceived: records.length,
    tailRecordsReceived: jsonRecords.candidateCount,
    tailRecordsParsedSuccessfully: recordsParsedSuccessfully,
    structuredApplicationLogEvents,
    parserShapeMismatches,
    malformedJsonRecordCount: jsonRecords.malformedCount,
    tailIncompleteJsonFragment: jsonRecords.incompleteFragment,
    tailRecordKinds: [...recordKinds].sort(),
    tailStdoutLinesReceived: text.stdoutLines,
    tailStderrLinesReceived: text.stderrLines,
    tailTextLineCategories: text.categories,
    tailTextLineSummaries: text.summaries,
    observedOperationNames: [...operations].sort(),
    redaction: redactionResult.flags,
    redactionFindings: redactionResult.findings,
  };
}

export function extractApplicationLogEvents(tailRecord) {
  if (!isObject(tailRecord)) {
    return { events: [], shapeMismatch: true };
  }

  const logEntries = Array.isArray(tailRecord.logs) ? tailRecord.logs : null;
  if (!logEntries) {
    return { events: [], shapeMismatch: true };
  }

  const events = [];
  let sawMessageCarrier = false;
  for (const logEntry of logEntries) {
    for (const candidate of messageCandidates(logEntry)) {
      sawMessageCarrier = true;
      const event = parseApplicationLogCandidate(candidate);
      if (event) events.push(event);
    }
  }

  return {
    events,
    shapeMismatch: !sawMessageCarrier || events.length === 0,
  };
}

export async function waitForTailReadiness({
  base,
  collector,
  token,
  timeoutMs,
  intervalMs,
  probeFetch = fetch,
  shouldContinue = () => true,
}) {
  const probeStatuses = [];
  const probeId = crypto.randomUUID();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline && shouldContinue()) {
    try {
      const response = await probeFetch(
        `${base}/v1/status?tailProbe=${encodeURIComponent(probeId)}-${probeStatuses.length + 1}`,
      );
      probeStatuses.push(response.status);
    } catch {
      probeStatuses.push(null);
    }

    await delay(intervalMs);
    const tail = buildTailDiagnostic(collector, token);
    if (tail.tailRecordsParsedSuccessfully > 0) {
      return { confirmed: true, probeStatuses, tail };
    }
    if (!shouldContinue()) break;
  }

  return {
    confirmed: false,
    probeStatuses,
    tail: buildTailDiagnostic(collector, token),
  };
}

export async function waitForExpectedOperations({
  collector,
  token,
  timeoutMs,
  intervalMs,
}) {
  const deadline = Date.now() + timeoutMs;
  let tail = buildTailDiagnostic(collector, token);

  while (Date.now() < deadline) {
    const missing = expectedOperations.filter(
      (operation) => !tail.observedOperationNames.includes(operation),
    );
    if (missing.length === 0) {
      return { completed: true, tail };
    }
    await delay(intervalMs);
    tail = buildTailDiagnostic(collector, token);
  }

  return { completed: false, tail };
}

export function terminateChild(child) {
  if (!child.killed) child.kill();
}

export function childProcessError(category, error) {
  return new Error(
    `${category} failed to start or run: ${error.code ?? error.name ?? 'unknown'}`,
  );
}

function createDiagnostic() {
  return {
    tailProcessStarted: false,
    tailCommandMode: null,
    tailCommandEntrypoint: null,
    tailReadinessConfirmed: false,
    tailOutputLinesReceived: 0,
    tailRecordsReceived: 0,
    tailRecordsParsedSuccessfully: 0,
    structuredApplicationLogEvents: 0,
    parserShapeMismatches: 0,
    malformedJsonRecordCount: 0,
    tailIncompleteJsonFragment: false,
    tailRecordKinds: [],
    tailStdoutLinesReceived: 0,
    tailStderrLinesReceived: 0,
    tailTextLineCategories: [],
    tailTextLineSummaries: [],
    observedOperationNames: [],
    trafficSteps: [],
    readinessProbeStatuses: [],
    drainCompleted: false,
    tailExitedEarly: false,
    tailExitCode: null,
    tailExitCodeHex: null,
    tailExitCategory: null,
    tailExitSignal: null,
    timeoutOccurred: false,
    redaction: emptyRedactionFlags(),
    redactionFindings: [],
  };
}

function mergeTailDiagnostic(target, tail) {
  target.tailOutputLinesReceived = tail.tailOutputLinesReceived;
  target.tailRecordsReceived = tail.tailRecordsReceived;
  target.tailRecordsParsedSuccessfully = tail.tailRecordsParsedSuccessfully;
  target.structuredApplicationLogEvents = tail.structuredApplicationLogEvents;
  target.parserShapeMismatches = tail.parserShapeMismatches;
  target.malformedJsonRecordCount = tail.malformedJsonRecordCount;
  target.tailIncompleteJsonFragment = tail.tailIncompleteJsonFragment;
  target.tailRecordKinds = tail.tailRecordKinds;
  target.tailStdoutLinesReceived = tail.tailStdoutLinesReceived;
  target.tailStderrLinesReceived = tail.tailStderrLinesReceived;
  target.tailTextLineCategories = tail.tailTextLineCategories;
  target.tailTextLineSummaries = tail.tailTextLineSummaries;
  target.observedOperationNames = tail.observedOperationNames;
  target.redaction = tail.redaction;
  target.redactionFindings = tail.redactionFindings;
}

function extractJsonRecords(records) {
  const parsedRecords = [];
  let candidateCount = 0;
  let malformedCount = 0;
  let incompleteFragment = false;

  for (const stream of ['stdout', 'stderr']) {
    const text = records
      .filter((record) => record.stream === stream)
      .map((record) => record.line)
      .join('\n');
    const result = extractJsonRecordsFromText(text);
    parsedRecords.push(...result.parsedRecords);
    candidateCount += result.candidateCount;
    malformedCount += result.malformedCount;
    incompleteFragment ||= result.incompleteFragment;
  }

  return {
    parsedRecords,
    candidateCount,
    malformedCount,
    incompleteFragment,
  };
}

function extractJsonRecordsFromText(text) {
  const parsedRecords = [];
  let candidateCount = 0;
  let malformedCount = 0;
  let incompleteFragment = false;
  let started = false;
  let inString = false;
  let escaped = false;
  let depth = 0;
  let buffer = '';

  for (const char of text) {
    if (!started) {
      if (char !== '{') continue;
      started = true;
      inString = false;
      escaped = false;
      depth = 0;
      buffer = '';
    }

    buffer += char;

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      depth += 1;
    } else if (char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0) {
        candidateCount += 1;
        const parsed = parseJsonObject(buffer);
        if (parsed) parsedRecords.push(parsed);
        else malformedCount += 1;
        started = false;
        buffer = '';
      }
    }
  }

  if (started) incompleteFragment = true;

  return {
    parsedRecords,
    candidateCount,
    malformedCount,
    incompleteFragment,
  };
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseApplicationLogCandidate(candidate) {
  if (isObject(candidate) && typeof candidate.operation === 'string') {
    return { operation: candidate.operation };
  }
  if (typeof candidate !== 'string') return null;

  const parsed = parseJsonObject(candidate.trim());
  if (parsed && typeof parsed.operation === 'string') {
    return { operation: parsed.operation };
  }
  return null;
}

function messageCandidates(logEntry) {
  if (!isObject(logEntry)) return [];
  return flatten([
    logEntry.message,
    logEntry.messages,
    logEntry.args,
    logEntry.result,
  ]);
}

function tailRecordKind(record) {
  if (Array.isArray(record.logs) && isObject(record.event)) {
    return 'wrangler-tail-event';
  }
  if ('error' in record || 'errors' in record) return 'wrangler-json-error';
  if (isObject(record.event) && typeof record.event.type === 'string') {
    return `wrangler-tail-${sanitizedName(record.event.type)}`;
  }
  return 'json-object';
}

function sanitizedName(value) {
  return value.replace(/[^a-z0-9._-]/gi, '_').slice(0, 64);
}

function hexExitCode(code) {
  return `0x${(code >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

function tailExitCategory(code) {
  if (code >>> 0 === 0xc0000409) return 'windows-fail-fast';
  if (code === 0) return 'clean-exit';
  return 'nonzero-exit';
}

function classifyTailText(records) {
  const categories = new Set();
  let stdoutLines = 0;
  let stderrLines = 0;

  for (const record of records) {
    if (record.stream === 'stdout') stdoutLines += 1;
    if (record.stream === 'stderr') stderrLines += 1;
    for (const category of categoriesForTailLine(record.line)) {
      categories.add(category);
    }
  }

  return {
    stdoutLines,
    stderrLines,
    categories: [...categories].sort(),
    summaries: [...summariesForTailLines(records)].sort(),
  };
}

function categoriesForTailLine(line) {
  const categories = [];
  if (/^\s*[{}[\],]/.test(line) || /^\s*"[^"]+"\s*:/.test(line)) {
    categories.push('json-fragment');
  }
  if (/\b(Error|Exception|Fatal|failed|failure)\b/i.test(line)) {
    categories.push('error-text');
  }
  if (/\b(EINVAL|EPERM|ENOENT|EACCES|C0000409)\b/i.test(line)) {
    categories.push('process-error-code');
  }
  if (/\b(auth|login|permission|unauthori[sz]ed)\b/i.test(line)) {
    categories.push('authentication-or-permission-text');
  }
  if (/\b(esbuild|workerd|spawn)\b/i.test(line)) {
    categories.push('native-helper-or-spawn-text');
  }
  if (/\b(wrangler|cloudflare|worker|tail)\b/i.test(line)) {
    categories.push('wrangler-text');
  }
  if (categories.length === 0) categories.push('unclassified-text');
  return categories;
}

function summariesForTailLines(records) {
  const summaries = new Set();
  for (const record of records) {
    for (const summary of summariesForTailLine(record.line)) {
      summaries.add(`${record.stream}:${summary}`);
    }
  }
  return summaries;
}

function summariesForTailLine(line) {
  const normalized = line.replace(/\s+/g, ' ').trim();
  const summaries = [];
  if (/Required Worker name missing/i.test(normalized)) {
    summaries.push('required-worker-name-missing');
  }
  if (/Unknown argument|Unknown arguments/i.test(normalized)) {
    summaries.push('unknown-argument');
  }
  if (/Need to collect logs for at least one outcome/i.test(normalized)) {
    summaries.push('missing-tail-status-selection');
  }
  if (/sampling rate must be between 0 and 1/i.test(normalized)) {
    summaries.push('invalid-sampling-rate');
  }
  if (/not authenticated|run `?wrangler login`?/i.test(normalized)) {
    summaries.push('wrangler-authentication-required');
  }
  if (/permission|unauthori[sz]ed/i.test(normalized)) {
    summaries.push('wrangler-permission-or-authorization');
  }
  if (/Cannot find module|MODULE_NOT_FOUND/i.test(normalized)) {
    summaries.push('module-not-found');
  }
  if (/No such file|ENOENT/i.test(normalized)) {
    summaries.push('file-not-found');
  }
  if (/Command failed/i.test(normalized)) {
    summaries.push('command-failed');
  }
  if (/workers\/scripts\/.+\/tails/i.test(normalized)) {
    summaries.push('tail-api-error');
  }
  if (/Worker does not exist|code:\s*10007/i.test(normalized)) {
    summaries.push('worker-not-found');
  }
  return summaries;
}

function flatten(values) {
  const out = [];
  for (const value of values) {
    if (Array.isArray(value)) out.push(...flatten(value));
    else if (value !== undefined && value !== null) out.push(value);
  }
  return out;
}

// A value that matches this is an intentional redaction marker, never a leak
// (the Worker's own logger.ts replaces sensitive fields with "[redacted]").
const REDACTED_VALUE =
  /^\s*(?:bearer\s+)?(?:\[redacted\]|\[filtered\]|<redacted>|redacted|\*{3,}|x{4,})\s*$/i;
// Benign authentication metadata: failure categories / status words that carry
// no credential material. These must NOT be treated as secret leaks.
const BENIGN_AUTH_VALUE =
  /^(?:unauthorized|forbidden|authorization_failed|authorization_required|missing_authorization|invalid_authorization|none|null)$/i;
// A real Bearer credential: "bearer " followed by a non-redacted token that has
// token-like entropy (at least one digit or credential punctuation), so prose
// like "bearer authentication" is not mistaken for a secret.
const BEARER_CREDENTIAL =
  /\bbearer\s+(?![[<"'])(?=[A-Za-z0-9._~+/=-]*[0-9._~+/=-])[A-Za-z0-9._~+/=-]{12,}/i;
// A bare opaque credential value (e.g. a raw API key) used only when it appears
// as the value of an authorization field.
const OPAQUE_CREDENTIAL = /^(?=.*[0-9._~+/=-])[A-Za-z0-9._~+/=-]{16,}$/;
const AUTHORIZATION_KEY = /^authorization$/i;
const PROVIDER_KEY =
  /^(?:providermapping|providerid|providerkey|providersecret|providerapikey)$/i;
const PROVIDER_TEXT = /providerMapping|providerId/;
const SECRET_ENV_NAME = /\bGRIDVIEW_STAGING_ADMIN_TOKEN\b/;
const STACK_TRACE = /\n\s+at\s+\S+\s+\(/;
const INTERNAL_KV_KEY = /\b(?:snapshot|pointer|sync|quota|content-meta):/i;

const REDACTION_FLAG_BY_CATEGORY = Object.freeze({
  'admin-token-value': 'containsAdminToken',
  'bearer-credential': 'containsBearerCredential',
  'authorization-header-value': 'containsAuthorizationHeaderValue',
  'secret-env-name': 'containsSecretEnvName',
  'provider-mapping': 'containsProviderMapping',
  'stack-trace': 'containsStackTrace',
  'internal-kv-key': 'containsInternalKvKey',
});

function emptyRedactionFlags() {
  return {
    containsAdminToken: false,
    containsBearerCredential: false,
    containsAuthorizationHeaderValue: false,
    containsSecretEnvName: false,
    containsProviderMapping: false,
    containsStackTrace: false,
    containsInternalKvKey: false,
  };
}

// Distinguishes real credential material from benign authentication metadata by
// walking the parsed tail records (including JSON re-encoded inside log
// messages) rather than substring-scanning the whole serialized tail. Findings
// carry only a category and a structured field path — never the matched value —
// so failure output can never echo a secret. The bare word "authorization", a
// failure category such as "authorization_failed", "unauthorized", a 401, and a
// redacted authorization field are all treated as safe.
export function scanRedaction(parsedRecords, rawText, token) {
  const ctx = { token, findings: [], seen: new Set() };

  parsedRecords.forEach((record, index) => {
    walkForRedaction(record, `record[${index}]`, ctx);
  });

  // Precise raw-tail backstop for credentials that may appear in unparsed
  // stderr text. We deliberately never scan raw text for the word
  // "authorization" — that is what caused the over-broad false positive.
  inspectStringForCredentials(rawText, 'raw-tail-text', ctx);

  const flags = emptyRedactionFlags();
  for (const finding of ctx.findings) {
    const flag = REDACTION_FLAG_BY_CATEGORY[finding.category];
    if (flag) flags[flag] = true;
  }
  return { flags, findings: ctx.findings };
}

function walkForRedaction(value, path, ctx) {
  if (typeof value === 'string') {
    inspectStringForCredentials(value, path, ctx);
    const nested = parseJsonContainer(value);
    if (nested !== undefined) walkForRedaction(nested, `${path}:json`, ctx);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkForRedaction(item, `${path}[${index}]`, ctx),
    );
    return;
  }
  if (!isObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (AUTHORIZATION_KEY.test(key) && typeof child === 'string') {
      inspectAuthorizationValue(child, childPath, ctx);
    }
    if (PROVIDER_KEY.test(key)) {
      addRedactionFinding(ctx, 'provider-mapping', childPath);
    }
    walkForRedaction(child, childPath, ctx);
  }
}

function inspectStringForCredentials(value, path, ctx) {
  if (typeof value !== 'string' || value.length === 0) return;
  if (ctx.token && ctx.token.length > 0 && value.includes(ctx.token)) {
    addRedactionFinding(ctx, 'admin-token-value', path);
  }
  if (BEARER_CREDENTIAL.test(value)) {
    addRedactionFinding(ctx, 'bearer-credential', path);
  }
  if (SECRET_ENV_NAME.test(value)) {
    addRedactionFinding(ctx, 'secret-env-name', path);
  }
  if (STACK_TRACE.test(value)) {
    addRedactionFinding(ctx, 'stack-trace', path);
  }
  if (INTERNAL_KV_KEY.test(value)) {
    addRedactionFinding(ctx, 'internal-kv-key', path);
  }
  if (PROVIDER_TEXT.test(value)) {
    addRedactionFinding(ctx, 'provider-mapping', path);
  }
}

function inspectAuthorizationValue(value, path, ctx) {
  const trimmed = value.trim();
  if (trimmed === '' || REDACTED_VALUE.test(trimmed)) return;
  if (BENIGN_AUTH_VALUE.test(trimmed)) return;
  if (
    (ctx.token && ctx.token.length > 0 && trimmed.includes(ctx.token)) ||
    BEARER_CREDENTIAL.test(trimmed) ||
    OPAQUE_CREDENTIAL.test(trimmed)
  ) {
    addRedactionFinding(ctx, 'authorization-header-value', path);
  }
}

function addRedactionFinding(ctx, category, fieldPath) {
  const key = `${category}|${fieldPath}`;
  if (ctx.seen.has(key)) return;
  ctx.seen.add(key);
  ctx.findings.push({ category, fieldPath });
}

function parseJsonContainer(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    return isObject(parsed) || Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function driveTraffic(base, token) {
  const steps = [];
  try {
    const publicRequest = await recordStep(steps, 'public status', () =>
      fetch(url(base, '/v1/status')),
    );
    const unauthorized = await recordStep(
      steps,
      'unauthorized admin status',
      () => fetch(url(base, '/internal/admin/sync/status')),
    );
    const statusBefore = await recordStep(steps, 'admin status before', () =>
      adminFetch(base, token, '/internal/admin/sync/status'),
    );
    const activeVersionBefore = await readActiveVersion(statusBefore);
    const sync = await recordStep(steps, 'admin sync', () =>
      adminFetch(base, token, '/internal/admin/sync/full', {
        method: 'POST',
      }),
    );
    const purge = await recordStep(steps, 'admin cache purge', () =>
      adminFetch(base, token, '/internal/admin/cache/purge', {
        method: 'POST',
      }),
    );
    const rollback = await recordStep(steps, 'admin rollback', () =>
      adminFetch(base, token, '/internal/admin/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: activeVersionBefore }),
      }),
    );
    const statusAfter = await recordStep(steps, 'admin status after', () =>
      adminFetch(base, token, '/internal/admin/sync/status'),
    );
    const activeVersionAfter = await readActiveVersion(statusAfter);

    assertStatus(publicRequest, 200, 'public status');
    assertStatus(unauthorized, 401, 'unauthorized admin status');
    assertStatus(statusBefore, 200, 'admin status before');
    assert(
      typeof activeVersionBefore === 'string' && activeVersionBefore.length > 0,
      'admin status before did not include an active version',
    );
    assertStatus(sync, 200, 'admin sync');
    assert(purge.status === 200 || purge.status === 207, 'admin cache purge');
    assertStatus(rollback, 200, 'admin rollback');
    assertStatus(statusAfter, 200, 'admin status after');
    assert(
      activeVersionAfter === activeVersionBefore,
      'admin rollback did not restore the pre-workflow active version',
    );

    return steps;
  } catch (error) {
    error.trafficSteps = steps;
    throw error;
  }
}

async function recordStep(steps, name, request) {
  try {
    const response = await request();
    steps.push({ name, status: response.status });
    return response;
  } catch (error) {
    steps.push({ name, status: null, errorCategory: 'request-failed' });
    const wrapped = new Error(
      error instanceof Error ? error.message : `${name} request failed.`,
    );
    wrapped.trafficSteps = steps;
    throw wrapped;
  }
}

function adminFetch(base, token, path, init = {}) {
  return fetch(url(base, path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

async function readActiveVersion(response) {
  try {
    const body = await response.json();
    return body?.data?.activeVersion ?? null;
  } catch {
    return null;
  }
}

function url(base, path) {
  return `${base}${path}`;
}

function wranglerChildEnvironment() {
  const env = { ...process.env };
  delete env.GRIDVIEW_STAGING_ADMIN_TOKEN;
  return env;
}

function diagnosticError(message, diagnostic) {
  const error = new Error(message);
  error.diagnostic = diagnostic;
  return error;
}

function throwIfTimedOut(diagnostic) {
  if (diagnostic.timeoutOccurred) {
    throw diagnosticError(
      'wrangler-tail timed out before observability checks finished.',
      diagnostic,
    );
  }
}

function assertStatus(response, expected, label) {
  assert(
    response.status === expected,
    `${label} expected HTTP ${expected}, got ${response.status}`,
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function main() {
  const baseUrl = process.argv[2];
  const token = process.env.GRIDVIEW_STAGING_ADMIN_TOKEN;

  if (!baseUrl) {
    console.error(
      'Usage: node scripts/staging-observability-check.mjs <base-url>',
    );
    process.exit(2);
  }

  if (!token) {
    console.error(
      'GRIDVIEW_STAGING_ADMIN_TOKEN must be set in the local environment.',
    );
    process.exit(2);
  }

  try {
    const summary = await runObservabilityCheck({ baseUrl, token });
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    const output = {
      error: error instanceof Error ? error.message : String(error),
      diagnostic: error?.diagnostic,
    };
    console.error(JSON.stringify(output, null, 2));
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
