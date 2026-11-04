/**
 * One run of the automatic season-batch path (GitHub Actions -> guarded
 * ingest). Every dependency is injected: the CLI (`run.mjs`) wires the
 * network, the generator and the submission builder; the tests wire mocked
 * Jolpica responses and an in-process Worker ingest.
 *
 * A run:
 * 1. plans from its state (`reconcile.ts`): idle, held, stopped, or checks;
 * 2. probes each due round with ONE request when that is cheaper than a full
 *    capture, and reuses the revision a known results body computed to;
 * 3. otherwise, or when a probe saw a new body, captures the season (the
 *    requests of one batch, paced, first non-200 ends it, never retried),
 *    generates the batch and computes each round's published revision;
 * 4. applies every check through the coordinated runtime's state machine;
 * 5. submits only a batch the gate admits, once, through the scoped token.
 *
 * Exit codes: 0 done (idle, held, withheld, unchanged, published);
 * 2 attention (the job continues next run, but GitHub should notify);
 * 3 stopped for a human (every later run sends nothing).
 */

import {
  captureSeason,
  probeRound,
  resultsUrl,
  type CaptureManifest,
  type Transport,
} from './capture.mjs';
import {
  afterPublished,
  afterRateLimit,
  afterUnchanged,
  anchorsFromCalendar,
  applyChecks,
  batchRevisions,
  contentDigest,
  emptyState,
  gate,
  hourlyHeadroom,
  planRun,
  MAXIMUM_PROBES,
  RUN_REQUEST_LIMIT,
  stopFor,
  withAnchors,
  withBodyRevisions,
  withRequests,
  type AutoUpdateState,
  type BatchDocument,
  type CheckToApply,
  type DueCheck,
} from './reconcile';
import { readActiveVersion, submitIngest } from './submit.mjs';
import { isBatchCaptureEligible } from '../../src/sync/coordinated/policy/cadence';
import { dueSlot } from '../../src/sync/coordinated/policy/planner';

export type Generated =
  | {
      readonly ok: true;
      readonly documents: readonly BatchDocument[];
      readonly manifestText: string;
      readonly manifestSha256: string;
      readonly artifactText: string;
    }
  | { readonly ok: false; readonly failure: string };

export interface RunDeps {
  readonly season: number;
  readonly codeVersion: string;
  readonly now: () => Date;
  readonly sleep: (ms: number) => Promise<void>;
  readonly spacingMs: number;
  readonly jolpica: Transport;
  readonly generate: (
    manifest: CaptureManifest,
    bodies: Map<string, Uint8Array>,
  ) => Promise<Generated>;
  readonly buildSubmission: (
    generated: Extract<Generated, { ok: true }>,
    expectedActiveVersion: string,
  ) => Promise<{ ok: true; text: string } | { ok: false; failure: string }>;
  readonly worker: Transport;
  readonly origin: string;
  readonly token: string | undefined;
  /** False: stop before any credentialed call (a dry run). */
  readonly submit: boolean;
  readonly log: (line: Record<string, unknown>) => void;
}

export interface RunResult {
  readonly state: AutoUpdateState | null;
  readonly outcome: string;
  readonly exitCode: 0 | 2 | 3;
}

const done = (
  state: AutoUpdateState | null,
  outcome: string,
  exitCode: 0 | 2 | 3 = 0,
): RunResult => ({
  state,
  outcome,
  exitCode,
});

function stamps(count: number, now: Date): string[] {
  return Array.from({ length: count }, () => now.toISOString());
}

export async function runOnce(
  input: AutoUpdateState | null,
  mode: 'scheduled' | 'bootstrap',
  deps: RunDeps,
): Promise<RunResult> {
  const { log } = deps;
  const startedAt = deps.now();
  const plan = planRun(input, startedAt, mode);
  log({ step: 'plan', plan });
  if (plan.kind === 'stopped') return done(input, `stopped:${plan.reason}`, 3);
  if (plan.kind === 'held' || plan.kind === 'idle')
    return done(input, plan.kind);

  let state = input ?? emptyState(deps.season, deps.codeVersion);
  if (hourlyHeadroom(state, startedAt) < RUN_REQUEST_LIMIT + MAXIMUM_PROBES) {
    log({ step: 'budget', withheld: 'hourly-request-limit' });
    return done(state, 'withheld:hourly-request-limit');
  }

  const checked = new Set<number>();
  const pendingBatch: DueCheck[] = [];
  let probesSent = 0;
  let fullCapture = plan.fullCapture;

  // 2. Probes: one request per due round, while that is cheaper.
  if (!fullCapture) {
    const checks: CheckToApply[] = [];
    for (const due of plan.due) {
      if (probesSent > 0) await deps.sleep(deps.spacingMs);
      const probe = await probeRound({
        transport: deps.jolpica,
        season: deps.season,
        round: due.round,
        now: deps.now,
      });
      probesSent += 1;
      state = withRequests(state, stamps(1, deps.now()), deps.now());
      const cadence = { kind: 'cadence' as const, slot: due.slot };
      if (!probe.ok) {
        checks.push({
          round: due.round,
          check: cadence,
          outcome: { status: 'failed' },
        });
        log({
          step: 'probe',
          round: due.round,
          failure: probe.failure,
          status: probe.status ?? null,
          diagnostics: probe.diagnostics ?? null,
        });
        if (probe.failure === 'provider-rate-limited') {
          state = afterRateLimit(state, deps.now(), probe.retryAfter ?? null);
        }
        // The first refusal ends the run's requests; the other due rounds
        // are not attempted, so their cadence slots are not consumed.
        const applied = applyChecks(state, checks, deps.now());
        log({ step: 'checks', events: applied.events });
        return done(applied.state, `withheld:probe-${probe.failure}`);
      }
      const known = state.bodyRevisions[String(due.round)];
      if (!probe.complete) {
        checks.push({
          round: due.round,
          check: cadence,
          outcome: { status: 'failed' },
        });
      } else if (known && known.bodySha256 === probe.sha256) {
        checks.push({
          round: due.round,
          check: cadence,
          outcome: { status: 'observed', revision: known.revision },
        });
      } else {
        pendingBatch.push(due);
      }
      log({
        step: 'probe',
        round: due.round,
        complete: probe.complete,
        known: Boolean(known && known.bodySha256 === probe.sha256),
      });
    }
    const applied = applyChecks(state, checks, deps.now());
    state = applied.state;
    for (const { round } of checks) checked.add(round);
    if (applied.events.length > 0)
      log({ step: 'checks', events: applied.events });
    const drift = state.records.some(
      (record) =>
        record.contentRevision !== null &&
        record.contentRevision !== record.publishedRevision,
    );
    fullCapture = pendingBatch.length > 0 || drift;
    if (!fullCapture) return done(state, 'checked');
    await deps.sleep(deps.spacingMs);
  }

  // 3. The full capture, then the batch.
  const capture = await captureSeason({
    transport: deps.jolpica,
    season: deps.season,
    now: deps.now,
    sleep: deps.sleep,
    spacingMs: deps.spacingMs,
  });
  state = withRequests(
    state,
    stamps(capture.requestsSent, deps.now()),
    deps.now(),
  );
  const batchDue: DueCheck[] = plan.fullCapture ? [...plan.due] : pendingBatch;
  if (!capture.ok) {
    log({
      step: 'capture',
      failure: capture.failure,
      requestsSent: capture.requestsSent,
      status: capture.status ?? null,
      diagnostics: capture.diagnostics ?? null,
    });
    if (capture.failure === 'provider-rate-limited') {
      state = afterRateLimit(state, deps.now(), capture.retryAfter ?? null);
    }
    const applied = applyChecks(
      state,
      batchDue.map((due) => ({
        round: due.round,
        check: { kind: 'cadence', slot: due.slot },
        outcome: { status: 'failed' },
      })),
      deps.now(),
    );
    // A failed bootstrap leaves no state, so it can simply be dispatched again.
    return done(
      mode === 'bootstrap' ? null : applied.state,
      `withheld:capture-${capture.failure}`,
    );
  }
  log({
    step: 'capture',
    requestsSent: capture.requestsSent,
    rounds: capture.manifest.classificationRounds,
  });
  const calendar = JSON.parse(
    new TextDecoder().decode(capture.bodies.get('calendar.json')),
  );
  const anchors = anchorsFromCalendar(calendar);
  if (anchors === null) {
    return done(
      stopFor(state, 'calendar-unusable', [], deps.now()),
      'stopped:calendar-unusable',
      3,
    );
  }
  state = withAnchors(
    { ...state, lastFullCaptureAt: capture.manifest.observedAt },
    anchors,
  );

  // The first run: every round a batch carries is due at its current slot.
  const now = deps.now();
  const due: DueCheck[] =
    mode === 'bootstrap'
      ? anchors
          .filter((anchor) => isBatchCaptureEligible(anchor.anchor, now))
          .map((anchor) => ({
            round: anchor.round,
            slot: dueSlot(null, anchor, now),
          }))
          .filter((entry): entry is DueCheck => entry.slot !== null)
      : batchDue;

  const generated = await deps.generate(capture.manifest, capture.bodies);
  if (!generated.ok) {
    log({ step: 'generate', failure: generated.failure });
    const applied = applyChecks(
      state,
      due.map((entry) => ({
        round: entry.round,
        check: { kind: 'cadence', slot: entry.slot },
        outcome: { status: 'failed' },
      })),
      now,
    );
    // Not a human stop: the next run asks again. But a refusal that
    // persists (an unmapped identity, a missing result) needs curation, so
    // the job reports attention.
    return done(
      mode === 'bootstrap' ? null : applied.state,
      `withheld:generator-${generated.failure}`,
      2,
    );
  }
  const revisions = await batchRevisions(generated.documents);
  state = withBodyRevisions(
    state,
    [...revisions].flatMap(([round, revision]) => {
      const body = capture.manifest.responses.find(
        (entry) => entry.url === resultsUrl(deps.season, round),
      );
      return body ? [{ round, bodySha256: body.sha256, revision }] : [];
    }),
  );

  // 4. Checks from the batch: the due rounds at their slots, and a re-read of
  // every other accepted round (the runtime re-reads every classified round
  // in a publication run; a settled one that changed is staged).
  const checks: CheckToApply[] = [];
  for (const entry of due) {
    const revision = revisions.get(entry.round);
    checks.push({
      round: entry.round,
      check: { kind: 'cadence', slot: entry.slot },
      outcome: revision
        ? { status: 'observed', revision }
        : { status: 'failed' },
    });
    checked.add(entry.round);
  }
  for (const record of state.records) {
    if (checked.has(record.round) || record.contentRevision === null) continue;
    const revision = revisions.get(record.round);
    if (revision)
      checks.push({
        round: record.round,
        check: { kind: 'reread' },
        outcome: { status: 'observed', revision },
      });
  }
  const applied = applyChecks(state, checks, now);
  state = applied.state;
  if (applied.events.length > 0)
    log({ step: 'checks', events: applied.events });
  if (
    applied.events.some(
      (event) => event.category === 'classification.unstable-source',
    )
  ) {
    log({ step: 'attention', reason: 'unstable-source' });
  }

  // 5. The gate, then at most one submission.
  const digest = await contentDigest(generated.documents);
  const decision = gate(state, revisions, digest);
  log({ step: 'gate', decision });
  if (decision.kind === 'stop') {
    return done(
      stopFor(state, decision.reason, decision.rounds, now),
      `stopped:${decision.reason}`,
      3,
    );
  }
  if (decision.kind === 'withhold')
    return done(state, `withheld:${decision.reason}`);
  if (decision.kind === 'unchanged')
    return done(afterUnchanged(state, revisions), 'unchanged');
  if (!deps.submit) {
    log({ step: 'not-submitted', note: 'dry run: no credentialed call' });
    return done(state, 'publishable-not-submitted');
  }

  try {
    return await submitOnce(state, generated, revisions, digest, deps, now);
  } catch {
    // Defence in depth: whatever escaped, the ingest may have committed, so
    // the job stops durably and never submits again on its own.
    return done(
      stopFor(state, 'ingest-ambiguous', [], now),
      'stopped:ingest-ambiguous',
      3,
    );
  }
}

/** The credentialed steps: read the active release, build, submit once. */
async function submitOnce(
  state: AutoUpdateState,
  generated: Extract<Generated, { ok: true }>,
  revisions: Map<number, string>,
  digest: string,
  deps: RunDeps,
  now: Date,
): Promise<RunResult> {
  const { log } = deps;
  const active = await readActiveVersion({
    transport: deps.worker,
    origin: deps.origin,
    token: deps.token,
    season: deps.season,
  });
  if (!active.ok) {
    return done(
      stopFor(state, `active-version-${active.failure}`, [], now),
      `stopped:active-version-${active.failure}`,
      3,
    );
  }
  const built = await deps.buildSubmission(generated, active.activeVersion);
  if (!built.ok) {
    return done(
      stopFor(state, `submission-${built.failure}`, [], now),
      `stopped:submission-${built.failure}`,
      3,
    );
  }
  const answer = await submitIngest({
    transport: deps.worker,
    origin: deps.origin,
    token: deps.token,
    bodyText: built.text,
  });
  log({ step: 'ingest', answer, expectedActiveVersion: active.activeVersion });
  if (answer.outcome === 'applied') {
    return done(
      afterPublished(state, revisions, digest, answer.version, deps.now()),
      'published',
    );
  }
  // Refused or ambiguous: never retried. A lost answer may have committed;
  // the CAS refuses a resend of the same batch either way.
  return done(
    stopFor(state, `ingest-${answer.outcome}`, [], now),
    `stopped:ingest-${answer.outcome}`,
    3,
  );
}
