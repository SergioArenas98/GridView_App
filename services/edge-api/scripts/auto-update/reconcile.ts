/**
 * Reconciliation for the automatic season-batch path (GitHub Actions).
 *
 * A scheduled job outside Cloudflare fetches Jolpica F1 and submits a season
 * batch to the Worker's guarded ingest. This module decides, run by run, what
 * that job checks and whether a batch may be submitted. It carries the
 * coordinated runtime's own per-round `ClassificationRecord`s in the job's
 * state and drives them with the runtime's own functions:
 *
 * - `dueSlot` (cadence: ADR 0028 D5) decides which round is checked when;
 * - `applyClassificationCheck` (the settling state machine) decides what an
 *   observation does: a first result seen twice (AU-D5), confirmations,
 *   settling, a correction pending until corroborated, `unstable-source`,
 *   a superseded revision rejected for good, a correction after settlement
 *   staged for an operator;
 * - `classificationRevision` is the revision a published release carries.
 *
 * So the accepted result and correction policy
 * (`docs/release/automatic-updates.md` §2-§3) is reused, not re-implemented.
 * What the batch path cannot do the same way is stated where it happens and
 * in `docs/release/github-actions-updates.md`.
 *
 * Pure: every function takes the instant it reasons about. No I/O.
 */

import type { RaceResult } from '../../src/contract/types';
import { canonicalJson } from '../../src/ingest/canonical-json';
import { classificationRevision } from '../../src/sync/coordinated/classification-revision';
import {
  BACKLOG_CAPACITY,
  type CalendarAnchor,
  type ClassificationRecord,
  type RevisionHash,
} from '../../src/sync/coordinated/ledger/model';
import { decodeClassificationRecord } from '../../src/sync/coordinated/ledger/records';
import {
  calendarAnchor,
  isBatchCaptureEligible,
} from '../../src/sync/coordinated/policy/cadence';
import {
  applyClassificationCheck,
  isInOperatorBacklog,
  newClassificationRecord,
  rescheduledClassificationRecord,
  type CheckOutcome,
  type ClassificationCheck,
} from '../../src/sync/coordinated/policy/classification';
import type { PolicyEventCategory } from '../../src/sync/coordinated/policy/events';
import { dueSlot } from '../../src/sync/coordinated/policy/planner';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const STATE_SCHEMA_VERSION = 1;
/** After a 429, no run asks Jolpica for at least this long. */
export const MINIMUM_HOLD_MS = 2 * HOUR_MS;
/** A provider-controlled `Retry-After` never silences the job longer. */
export const MAXIMUM_HOLD_MS = 24 * HOUR_MS;
/** Season-level data (calendar, standings, participants) is re-read daily. */
export const FULL_REFRESH_INTERVAL_MS = 24 * HOUR_MS;
/** A scheduler's ticks drift; a daily refresh may run a little early. */
export const TICK_TOLERANCE_MS = 10 * MINUTE_MS;
/** Jolpica F1's published sustained limit; the job never plans past it. */
export const HOURLY_REQUEST_LIMIT = 500;
/** Requests in one run: six season-level plus at most 24 rounds. */
export const RUN_REQUEST_LIMIT = 30;
/** More due rounds than this are served by one full capture, not probes. */
export const MAXIMUM_PROBES = 5;
/** Requests in one full capture today (6 + rounds); planning uses the cap. */
export const FULL_CAPTURE_REQUESTS = 25;

const shaPattern = /^[0-9a-f]{64}$/;
const revisionPattern = /^sha256:[0-9a-f]{64}$/;
const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// The Worker validates the version itself; this only bounds what is echoed.
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export interface StopRecord {
  readonly reason: string;
  readonly at: string;
  readonly rounds: readonly number[];
}

export interface PublishedRecord {
  /** Digest of the published documents' data, instants masked. */
  readonly contentDigest: string;
  readonly version: string;
  readonly at: string;
}

export interface AutoUpdateState {
  readonly schemaVersion: typeof STATE_SCHEMA_VERSION;
  readonly season: number;
  /** The code that computed `bodyRevisions`; a new commit discards them. */
  readonly codeVersion: string;
  readonly holdUntil: string | null;
  /** Set when a human must look; every later run then sends nothing. */
  readonly stopped: StopRecord | null;
  readonly anchors: readonly CalendarAnchor[];
  readonly records: readonly ClassificationRecord[];
  /** A results body's SHA-256 -> the revision it was computed to, per round. */
  readonly bodyRevisions: Readonly<
    Record<
      string,
      { readonly bodySha256: string; readonly revision: RevisionHash }
    >
  >;
  readonly published: PublishedRecord | null;
  readonly lastFullCaptureAt: string | null;
  /** Instants of the requests sent in the last hour. */
  readonly recentRequests: readonly string[];
}

const isIso = (value: unknown): value is string =>
  typeof value === 'string' &&
  isoPattern.test(value) &&
  !Number.isNaN(Date.parse(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The state of a season the job has never run for. */
export function emptyState(
  season: number,
  codeVersion: string,
): AutoUpdateState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    season,
    codeVersion,
    holdUntil: null,
    stopped: null,
    anchors: [],
    records: [],
    bodyRevisions: {},
    published: null,
    lastFullCaptureAt: null,
    recentRequests: [],
  };
}

export type StateDecoding =
  | { readonly ok: true; readonly state: AutoUpdateState }
  | { readonly ok: false; readonly reason: string };

/**
 * Strict decoding. A state that does not decode stops the job (a human
 * re-bootstraps it); it is never reset silently. Records are decoded by the
 * ledger's own decoder. Body revisions computed by other code are dropped.
 */
export function decodeState(
  value: unknown,
  codeVersion: string,
): StateDecoding {
  const refuse = (reason: string): StateDecoding => ({ ok: false, reason });
  if (!isRecord(value) || value.schemaVersion !== STATE_SCHEMA_VERSION) {
    return refuse('state-version');
  }
  const { season, holdUntil, stopped, anchors, records, bodyRevisions } = value;
  const { published, lastFullCaptureAt, recentRequests } = value;
  if (!Number.isSafeInteger(season)) return refuse('state-season');
  if (typeof value.codeVersion !== 'string') return refuse('state-code');
  if (holdUntil !== null && !isIso(holdUntil)) return refuse('state-hold');
  if (
    stopped !== null &&
    !(
      isRecord(stopped) &&
      typeof stopped.reason === 'string' &&
      isIso(stopped.at) &&
      Array.isArray(stopped.rounds)
    )
  ) {
    return refuse('state-stopped');
  }
  if (!Array.isArray(anchors)) return refuse('state-anchors');
  const decodedAnchors: CalendarAnchor[] = [];
  for (const entry of anchors) {
    if (!isRecord(entry) || !isIso(entry.anchor))
      return refuse('state-anchors');
    if (entry.anchorKind !== 'date-time' && entry.anchorKind !== 'date-eod') {
      return refuse('state-anchors');
    }
    if (!Number.isSafeInteger(entry.round)) return refuse('state-anchors');
    decodedAnchors.push({
      round: entry.round as number,
      anchor: entry.anchor,
      anchorKind: entry.anchorKind,
    });
  }
  if (!Array.isArray(records)) return refuse('state-records');
  const decodedRecords: ClassificationRecord[] = [];
  for (const entry of records) {
    const decoded = decodeClassificationRecord(entry);
    if (!decoded.ok || decoded.value.season !== season) {
      return refuse('state-records');
    }
    decodedRecords.push(decoded.value);
  }
  if (!isRecord(bodyRevisions)) return refuse('state-body-revisions');
  const revisions: Record<string, { bodySha256: string; revision: string }> =
    {};
  for (const [round, entry] of Object.entries(bodyRevisions)) {
    if (
      !Number.isSafeInteger(Number(round)) ||
      !isRecord(entry) ||
      typeof entry.bodySha256 !== 'string' ||
      !shaPattern.test(entry.bodySha256) ||
      typeof entry.revision !== 'string' ||
      !revisionPattern.test(entry.revision)
    ) {
      return refuse('state-body-revisions');
    }
    revisions[round] = {
      bodySha256: entry.bodySha256,
      revision: entry.revision,
    };
  }
  if (
    published !== null &&
    !(
      isRecord(published) &&
      typeof published.contentDigest === 'string' &&
      shaPattern.test(published.contentDigest) &&
      typeof published.version === 'string' &&
      versionPattern.test(published.version) &&
      isIso(published.at)
    )
  ) {
    return refuse('state-published');
  }
  if (lastFullCaptureAt !== null && !isIso(lastFullCaptureAt)) {
    return refuse('state-last-capture');
  }
  if (!Array.isArray(recentRequests) || !recentRequests.every(isIso)) {
    return refuse('state-requests');
  }
  return {
    ok: true,
    state: {
      schemaVersion: STATE_SCHEMA_VERSION,
      season: season as number,
      codeVersion,
      holdUntil: holdUntil as string | null,
      stopped: stopped as StopRecord | null,
      anchors: decodedAnchors,
      records: decodedRecords,
      // Computed by other code: discarded, so a mapping change cannot leak in.
      bodyRevisions: value.codeVersion === codeVersion ? revisions : {},
      published: published as PublishedRecord | null,
      lastFullCaptureAt: lastFullCaptureAt as string | null,
      recentRequests: recentRequests as string[],
    },
  };
}

/** Race anchors from a Jolpica calendar body, by the runtime's own rule. */
export function anchorsFromCalendar(
  calendar: unknown,
): CalendarAnchor[] | null {
  const races = (calendar as { MRData?: { RaceTable?: { Races?: unknown } } })
    ?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races) || races.length === 0) return null;
  const anchors: CalendarAnchor[] = [];
  for (const race of races as {
    round?: unknown;
    date?: unknown;
    time?: unknown;
  }[]) {
    const round = Number(race?.round);
    if (!Number.isSafeInteger(round) || typeof race?.date !== 'string')
      return null;
    const time = typeof race.time === 'string' ? race.time : null;
    const anchor = calendarAnchor(round, race.date, time);
    if (anchor === null) return null;
    anchors.push(anchor);
  }
  return anchors.sort((a, b) => a.round - b.round);
}

export interface DueCheck {
  readonly round: number;
  readonly slot: number;
}

export type Plan =
  | { readonly kind: 'stopped'; readonly reason: string }
  | { readonly kind: 'held'; readonly until: string }
  | { readonly kind: 'idle'; readonly reason?: string }
  | {
      readonly kind: 'run';
      readonly due: readonly DueCheck[];
      /** Whether a full capture is needed whatever the probes find. */
      readonly fullCapture: boolean;
      readonly reason: string;
    };

const recordFor = (state: AutoUpdateState, round: number) =>
  state.records.find((record) => record.round === round) ?? null;

/**
 * What one run may do. A round is checked only once a batch may carry it
 * (race start + 5 h, the batch capture rule the ingest verifies); before that
 * nothing is recorded for it, so its cadence slots are not consumed.
 */
export function planRun(
  state: AutoUpdateState | null,
  now: Date,
  mode: 'scheduled' | 'bootstrap',
): Plan {
  if (mode === 'bootstrap') {
    if (state !== null)
      return { kind: 'stopped', reason: 'bootstrap-state-exists' };
    // The first run: every round a batch must carry is due at its current
    // slot, exactly as a newly bound ledger is (AU-4 step 2).
    return { kind: 'run', due: [], fullCapture: true, reason: 'bootstrap' };
  }
  if (state === null) return { kind: 'stopped', reason: 'state-missing' };
  if (state.stopped !== null)
    return { kind: 'stopped', reason: state.stopped.reason };
  if (state.holdUntil !== null && Date.parse(state.holdUntil) > now.getTime()) {
    return { kind: 'held', until: state.holdUntil };
  }
  // Between a race's start and the moment a batch must carry it (+ 5 h),
  // Jolpica may already serve that round's standings while a batch may not
  // yet carry its result; the generator then refuses the batch for
  // incoherent standings. Nothing is captured in that window.
  const started = state.anchors.filter(
    (anchor) =>
      Date.parse(anchor.anchor) <= now.getTime() &&
      !isBatchCaptureEligible(anchor.anchor, now),
  );
  if (started.length > 0) {
    return {
      kind: 'idle',
      reason: `race-not-batch-eligible:${started.map((a) => a.round).join(',')}`,
    };
  }
  const due: DueCheck[] = [];
  for (const anchor of state.anchors) {
    if (!isBatchCaptureEligible(anchor.anchor, now)) continue;
    const slot = dueSlot(recordFor(state, anchor.round), anchor, now);
    if (slot !== null) due.push({ round: anchor.round, slot });
  }
  // A batch must carry every eligible round, so while one has never been
  // sighted a full capture would only be refused: that round's own probe
  // starts the capture once Jolpica serves it.
  const unsighted = state.anchors.some((anchor) => {
    if (!isBatchCaptureEligible(anchor.anchor, now)) return false;
    const record = recordFor(state, anchor.round);
    return (
      record === null ||
      (record.contentRevision === null &&
        record.candidateRevision === null &&
        record.terminalReason === null)
    );
  });
  const refresh =
    !unsighted &&
    (state.lastFullCaptureAt === null ||
      now.getTime() - Date.parse(state.lastFullCaptureAt) >=
        FULL_REFRESH_INTERVAL_MS - TICK_TOLERANCE_MS);
  // An accepted revision the serving release does not carry yet (a failed
  // or refused submission): publish it on the next run.
  const drift =
    !unsighted &&
    state.records.some(
      (record) =>
        record.contentRevision !== null &&
        record.contentRevision !== record.publishedRevision,
    );
  if (due.length === 0 && !refresh && !drift) return { kind: 'idle' };
  const tooMany = due.length > MAXIMUM_PROBES;
  return {
    kind: 'run',
    due,
    fullCapture: refresh || drift || tooMany,
    reason: refresh
      ? 'daily-refresh'
      : drift
        ? 'unpublished-revision'
        : tooMany
          ? 'many-due'
          : 'due',
  };
}

/** Requests still allowed in the current hour by Jolpica's sustained limit. */
export function hourlyHeadroom(state: AutoUpdateState, now: Date): number {
  const since = now.getTime() - HOUR_MS;
  const recent = state.recentRequests.filter((at) => Date.parse(at) > since);
  return HOURLY_REQUEST_LIMIT - recent.length;
}

/** Records requests just sent, keeping only the last hour. */
export function withRequests(
  state: AutoUpdateState,
  sentAt: readonly string[],
  now: Date,
): AutoUpdateState {
  const since = now.getTime() - HOUR_MS;
  return {
    ...state,
    recentRequests: [...state.recentRequests, ...sentAt].filter(
      (at) => Date.parse(at) > since,
    ),
  };
}

/** After a 429: hold for 2-24 h, honouring a longer `Retry-After`. */
export function afterRateLimit(
  state: AutoUpdateState,
  now: Date,
  retryAfter: string | null,
): AutoUpdateState {
  const floor = now.getTime() + MINIMUM_HOLD_MS;
  const ceiling = now.getTime() + MAXIMUM_HOLD_MS;
  const asked = retryAfter === null ? Number.NaN : Date.parse(retryAfter);
  const until = Number.isNaN(asked)
    ? floor
    : Math.min(Math.max(asked, floor), ceiling);
  const running = state.holdUntil === null ? 0 : Date.parse(state.holdUntil);
  return {
    ...state,
    holdUntil: new Date(Math.max(until, running)).toISOString(),
  };
}

/** Anything a human must look at: every later run sends nothing. */
export function stopFor(
  state: AutoUpdateState,
  reason: string,
  rounds: readonly number[],
  now: Date,
): AutoUpdateState {
  return {
    ...state,
    stopped: { reason, at: now.toISOString(), rounds: [...rounds] },
  };
}

export interface CheckToApply {
  readonly round: number;
  readonly check: ClassificationCheck;
  readonly outcome: CheckOutcome;
}

export interface AppliedChecks {
  readonly state: AutoUpdateState;
  readonly events: readonly {
    readonly round: number;
    readonly category: PolicyEventCategory;
  }[];
}

/**
 * Applies checks through the runtime's state machine. A round without a
 * record gets a new one at its anchor (`newClassificationRecord`).
 */
export function applyChecks(
  state: AutoUpdateState,
  checks: readonly CheckToApply[],
  now: Date,
): AppliedChecks {
  let records = [...state.records];
  const events: { round: number; category: PolicyEventCategory }[] = [];
  for (const { round, check, outcome } of checks) {
    const anchor = state.anchors.find((entry) => entry.round === round);
    const current =
      records.find((record) => record.round === round) ??
      (anchor ? newClassificationRecord(state.season, anchor) : null);
    if (current === null) continue;
    const backlog = records.filter(isInOperatorBacklog).length;
    const step = applyClassificationCheck(current, {
      check,
      outcome,
      now,
      backlogAvailable: backlog < BACKLOG_CAPACITY,
    });
    records = [
      ...records.filter((record) => record.round !== round),
      step.record,
    ].sort((a, b) => a.round - b.round);
    for (const event of step.events)
      events.push({ round, category: event.category });
  }
  return { state: { ...state, records }, events };
}

/**
 * New calendar anchors from a full capture. A moved race with nothing
 * observed is rescheduled by the runtime's own rule.
 */
export function withAnchors(
  state: AutoUpdateState,
  anchors: readonly CalendarAnchor[],
): AutoUpdateState {
  const records = state.records.map((record) => {
    const anchor = anchors.find((entry) => entry.round === record.round);
    return anchor
      ? (rescheduledClassificationRecord(record, anchor) ?? record)
      : record;
  });
  return { ...state, anchors: [...anchors], records };
}

export interface BatchDocument {
  readonly documentName: string;
  readonly data: unknown;
}

const resultsDocument = /^grand-prix:(\d+):results$/;

/** The revision each round carries in a generated batch, as published. */
export async function batchRevisions(
  documents: readonly BatchDocument[],
): Promise<Map<number, RevisionHash>> {
  const revisions = new Map<number, RevisionHash>();
  for (const document of documents) {
    const match = resultsDocument.exec(document.documentName);
    if (!match) continue;
    revisions.set(
      Number(match[1]),
      await classificationRevision(document.data as RaceResult),
    );
  }
  return revisions;
}

const instantKeys = new Set([
  'generatedAt',
  'staleAfter',
  'sourceUpdatedAt',
  'lastPublishedAt',
  'snapshotObservedAt',
  'observedAt',
]);

function masked(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(masked);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !instantKeys.has(key))
        .map(([key, inner]) => [key, masked(inner)]),
    );
  }
  return value;
}

/**
 * The digest of what a batch would publish, without instants: two batches
 * with the same digest publish the same content, so the second is not sent
 * (the ingest would mint a release that only re-stamps freshness).
 */
export async function contentDigest(
  documents: readonly BatchDocument[],
): Promise<string> {
  const text = canonicalJson(
    [...documents]
      .sort((a, b) => (a.documentName < b.documentName ? -1 : 1))
      .map((document) => ({
        documentName: document.documentName,
        data: masked(document.data),
      })),
  );
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export type Gate =
  | { readonly kind: 'publish' }
  | { readonly kind: 'unchanged' }
  | {
      readonly kind: 'withhold';
      readonly reason: string;
      readonly rounds: readonly number[];
    }
  | {
      readonly kind: 'stop';
      readonly reason: string;
      readonly rounds: readonly number[];
    };

/**
 * Whether this batch may be submitted. A batch publishes the whole season as
 * Jolpica served it at capture time, so it may be sent only when every round
 * it carries is exactly the revision the state machine has accepted:
 *
 * - a staged or competing correction (operator backlog) stops the job: the
 *   runtime withholds the whole season until an operator disposes (O-5(a));
 * - a first result, or a correction, not yet corroborated withholds this
 *   batch until it is (the runtime would publish the other rounds' changes
 *   meanwhile; a batch cannot separate them);
 * - a revision the state machine rejected for good (superseded) still being
 *   served stops the job: the runtime keeps publishing the accepted one, which
 *   a batch of the current capture cannot do;
 * - an accepted round missing from the batch stops the job.
 */
export function gate(
  state: AutoUpdateState,
  revisions: ReadonlyMap<number, RevisionHash>,
  digest: string,
): Gate {
  const backlog = state.records
    .filter(isInOperatorBacklog)
    .map((record) => record.round);
  if (backlog.length > 0)
    return { kind: 'stop', reason: 'staged-correction', rounds: backlog };

  const missing = state.records
    .filter(
      (record) =>
        record.contentRevision !== null && !revisions.has(record.round),
    )
    .map((record) => record.round);
  if (missing.length > 0)
    return { kind: 'stop', reason: 'accepted-round-missing', rounds: missing };

  const superseded: number[] = [];
  const firstPending: number[] = [];
  const changePending: number[] = [];
  for (const [round, revision] of revisions) {
    const record = recordFor(state, round);
    if (record === null || record.contentRevision === null)
      firstPending.push(round);
    else if (record.contentRevision !== revision) {
      if (record.supersededRevisions.includes(revision)) superseded.push(round);
      else changePending.push(round);
    }
  }
  if (superseded.length > 0) {
    return {
      kind: 'stop',
      reason: 'superseded-revision-served',
      rounds: superseded,
    };
  }
  if (firstPending.length > 0) {
    return {
      kind: 'withhold',
      reason: 'first-result-pending',
      rounds: firstPending,
    };
  }
  if (changePending.length > 0) {
    return {
      kind: 'withhold',
      reason: 'change-pending',
      rounds: changePending,
    };
  }
  if (state.published !== null && state.published.contentDigest === digest) {
    return { kind: 'unchanged' };
  }
  return { kind: 'publish' };
}

/** After the ingest answered `applied`: the batch is what is served. */
export function afterPublished(
  state: AutoUpdateState,
  revisions: ReadonlyMap<number, RevisionHash>,
  digest: string,
  version: string,
  now: Date,
): AutoUpdateState {
  return {
    ...state,
    published: { contentDigest: digest, version, at: now.toISOString() },
    records: state.records.map((record) =>
      revisions.has(record.round)
        ? { ...record, publishedRevision: revisions.get(record.round)! }
        : record,
    ),
  };
}

/** After a batch whose content is already served. */
export function afterUnchanged(
  state: AutoUpdateState,
  revisions: ReadonlyMap<number, RevisionHash>,
): AutoUpdateState {
  return {
    ...state,
    records: state.records.map((record) =>
      revisions.has(record.round)
        ? { ...record, publishedRevision: revisions.get(record.round)! }
        : record,
    ),
  };
}

/** Remembers which results body computed to which revision, per round. */
export function withBodyRevisions(
  state: AutoUpdateState,
  entries: readonly {
    readonly round: number;
    readonly bodySha256: string;
    readonly revision: RevisionHash;
  }[],
): AutoUpdateState {
  const next = { ...state.bodyRevisions };
  for (const { round, bodySha256, revision } of entries) {
    next[String(round)] = { bodySha256, revision };
  }
  return { ...state, bodyRevisions: next };
}

export { isInOperatorBacklog };
