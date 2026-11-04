/**
 * The automatic season-batch path end to end, offline: a mocked Jolpica F1
 * (the coordinated runtime's own `JolpicaServer` double) -> the job's capture
 * and reconciliation -> the repository's generator and submission builder ->
 * the REAL Worker entry point on the committed staging variables, reached
 * with the scoped `SEASON_INGEST_TOKEN` only -> the guarded ingest and the
 * in-process sequencer. Nothing here reaches a network.
 *
 * Scenarios: bootstrap, a new result (seen twice, from + 5 h), a correction
 * before settlement (corroborated, then published), a correction after
 * settlement (stops for an operator), a 429 (held, never retried), a refused
 * upload and an ambiguous upload (both stop), and a dry run.
 */

import { describe, expect, it } from 'vitest';

import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import worker, { type Env } from '../../src/index';
import { CapturingLogger } from '../../src/logging/logger';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import { allowedOrigins } from '../../scripts/auto-update/submit.mjs';
import { runOnce, type RunDeps } from '../../scripts/auto-update/orchestrate';
import type { AutoUpdateState } from '../../scripts/auto-update/reconcile';
import { generateSeasonBatch } from '../../scripts/season-batch/generate';
import { buildSubmission } from '../../scripts/season-batch/submission';
import { committedVars } from '../e2e/automatic-updates/stage';
import { ingestContext } from '../ingest/support';
import type { SequencedContext } from '../publication/sequenced/support';
import { COMMIT } from '../season-batch/support';
import {
  anchorOf,
  HOUR,
  JolpicaServer,
  type ResultVariant,
} from '../sync/coordinated/observation/support';

const ORIGIN = allowedOrigins[0]!;
const SCOPED = 'scoped-season-ingest-token-0123456789abcdef';
const ADMIN = 'admin-token-never-given-to-the-job-0123456789';

/** `hours` after round `round`'s scheduled start, at minute 18. */
const at = (round: number, hours: number) =>
  new Date(anchorOf(round).getTime() + hours * HOUR + 18 * 60 * 1000);

type WorkerHook = (
  request: Request,
  forward: () => Promise<Response>,
) => Promise<Response>;

class Scenario {
  readonly jolpica = new JolpicaServer();
  readonly lines: Record<string, unknown>[] = [];
  readonly workerCalls: {
    method: string;
    path: string;
    authorization: string | null;
  }[] = [];
  state: AutoUpdateState | null = null;
  workerHook: WorkerHook | null = null;
  submit = true;

  private constructor(
    readonly context: SequencedContext,
    readonly env: Env,
  ) {}

  static async create(
    results: Record<number, ResultVariant>,
  ): Promise<Scenario> {
    const context = await ingestContext();
    const env = {
      ...committedVars('staging'),
      ADMIN_TOKEN: ADMIN,
      SEASON_INGEST_TOKEN: SCOPED,
      __LOCAL_STORAGE: context.storage,
      __SEASON_PUBLICATION_SEQUENCER: context.port,
      __CLOCK: context.clock,
      __CACHE_PURGER: new MemoryCachePurgeAdapter(),
      __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
      __LOGGER: new CapturingLogger(),
    } as unknown as Env;
    const scenario = new Scenario(context, env);
    scenario.serve(results);
    return scenario;
  }

  serve(results: Record<number, ResultVariant>): void {
    for (const [round, variant] of Object.entries(results)) {
      this.jolpica.results.set(Number(round), variant);
    }
  }

  async activeVersion(): Promise<string | null> {
    const authority = await this.context.port.readAuthority(2026);
    return (
      (authority as { activeVersion?: string | null }).activeVersion ?? null
    );
  }

  private deps(now: Date): RunDeps {
    return {
      season: 2026,
      codeVersion: COMMIT,
      now: () => now,
      sleep: async () => {},
      spacingMs: 2000,
      jolpica: (url, init) => this.jolpica.transport(new Request(url, init)),
      generate: async (manifest, bodies) => {
        const result = await generateSeasonBatch({
          capture: manifest,
          bodies,
          provenance: { gitCommit: COMMIT, treeClean: true },
        });
        if (!result.ok) return { ok: false, failure: result.failure };
        return {
          ok: true,
          documents: JSON.parse(result.artifact.text).documents,
          manifestText: result.manifest.text,
          manifestSha256: result.manifest.sha256,
          artifactText: result.artifact.text,
        };
      },
      buildSubmission: async (generated, expectedActiveVersion) => {
        const built = await buildSubmission({
          manifestBytes: new TextEncoder().encode(generated.manifestText),
          artifactBytes: new TextEncoder().encode(generated.artifactText),
          reviewedManifestSha256: generated.manifestSha256,
          expectedActiveVersion,
          now,
        });
        return built.ok
          ? { ok: true, text: built.text }
          : { ok: false, failure: built.failure };
      },
      worker: async (url, init) => {
        const request = new Request(url, init);
        this.workerCalls.push({
          method: request.method,
          path: new URL(url).pathname,
          authorization: request.headers.get('Authorization'),
        });
        const forward = () => worker.fetch(request.clone(), this.env);
        return this.workerHook ? this.workerHook(request, forward) : forward();
      },
      origin: ORIGIN,
      token: SCOPED,
      submit: this.submit,
      log: (line) => this.lines.push(line),
    };
  }

  async tick(now: Date, mode: 'scheduled' | 'bootstrap' = 'scheduled') {
    const before = this.jolpica.requests.length;
    const result = await runOnce(this.state, mode, this.deps(now));
    this.state = result.state;
    return { ...result, requests: this.jolpica.requests.length - before };
  }

  record(round: number) {
    return this.state?.records.find((record) => record.round === round) ?? null;
  }
}

/** Bootstraps at round 3 + 24 h: rounds 1-3 are served, 1-2 are live. */
async function bootstrapped(): Promise<Scenario> {
  const scenario = await Scenario.create({ 1: 'A', 2: 'A', 3: 'A' });
  const result = await scenario.tick(at(3, 24), 'bootstrap');
  expect(result.outcome).toBe('published');
  return scenario;
}

describe('the automatic season-batch path, end to end', { timeout: 60_000 }, () => {
  it('bootstraps: one capture, every eligible round accepted at its current slot, published with the scoped token only', async () => {
    const scenario = await Scenario.create({ 1: 'A', 2: 'A', 3: 'A' });
    const before = await scenario.activeVersion();
    const result = await scenario.tick(at(3, 24), 'bootstrap');

    expect(result).toMatchObject({
      outcome: 'published',
      exitCode: 0,
      requests: 9,
    });
    expect(await scenario.activeVersion()).not.toBe(before);
    expect(
      scenario.state!.records.map((r) => [r.round, r.contentRevision !== null]),
    ).toEqual([
      [1, true],
      [2, true],
      [3, true],
    ]);
    // Round 1 is past its 14-day ceiling: settled on deadline at once.
    expect(scenario.record(1)!.reviewState).toBe('settled');
    // Exactly the two scoped requests, never the admin token.
    expect(scenario.workerCalls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /internal/admin/publication/cutover/status',
      'POST /internal/admin/season/ingest',
    ]);
    expect(
      scenario.workerCalls.every((c) => c.authorization === `Bearer ${SCOPED}`),
    ).toBe(true);
    // A second bootstrap is refused: the state exists.
    expect((await scenario.tick(at(3, 25), 'bootstrap')).outcome).toBe(
      'stopped:bootstrap-state-exists',
    );
  });

  it('publishes a new result only once seen twice, and never before race start + 5 h', async () => {
    const scenario = await bootstrapped();
    const published = await scenario.activeVersion();

    // During the race and until + 5 h nothing is captured.
    const during = await scenario.tick(at(4, 2));
    expect(during).toMatchObject({ outcome: 'idle', requests: 0 });

    // + 5 h 18: Jolpica serves round 4. First sighting: held pending (AU-D5).
    scenario.serve({ 4: 'A' });
    const first = await scenario.tick(at(4, 5));
    expect(first.outcome).toBe('withheld:first-result-pending');
    expect(await scenario.activeVersion()).toBe(published);
    expect(scenario.record(4)!.contentRevision).toBeNull();
    expect(scenario.record(4)!.candidateRevision).not.toBeNull();

    // + 6 h 18: the same result again, from a one-request probe: accepted and
    // published.
    const second = await scenario.tick(at(4, 6));
    expect(second.outcome).toBe('published');
    expect(await scenario.activeVersion()).not.toBe(published);
    expect(scenario.record(4)!.contentRevision).toBe(
      scenario.record(4)!.publishedRevision,
    );

    // Nothing due until the + 9 h 30 confirmation: idle, no request.
    expect(await scenario.tick(at(4, 7))).toMatchObject({
      outcome: 'idle',
      requests: 0,
    });
  });

  it('a correction before settlement is held at one sighting and published when corroborated', async () => {
    const scenario = await bootstrapped();
    scenario.serve({ 4: 'A' });
    await scenario.tick(at(4, 5));
    await scenario.tick(at(4, 6));
    const accepted = scenario.record(4)!.contentRevision;
    const servingA = await scenario.activeVersion();

    // Jolpica corrects round 4 at + 8 h. The + 9 h 30 confirmation sights it.
    scenario.serve({ 4: 'B' });
    const sighted = await scenario.tick(at(4, 9.6));
    expect(sighted.outcome).toBe('withheld:change-pending');
    expect(await scenario.activeVersion()).toBe(servingA);
    expect(scenario.record(4)!.contentRevision).toBe(accepted);

    // The next hourly check returns it again: accepted and published.
    const corroborated = await scenario.tick(at(4, 10.6));
    expect(corroborated.outcome).toBe('published');
    expect(scenario.record(4)!.contentRevision).not.toBe(accepted);
    expect(scenario.record(4)!.supersededRevisions).toContain(accepted);
    expect(await scenario.activeVersion()).not.toBe(servingA);
  });

  it('a correction after settlement stops the job for an operator (the season is withheld)', async () => {
    const scenario = await bootstrapped();
    const serving = await scenario.activeVersion();
    expect(scenario.record(1)!.reviewState).toBe('settled');

    // Jolpica changes settled round 1. The daily refresh re-reads it: first
    // sighted (nothing published), then staged at the next re-read (§3).
    scenario.serve({ 1: 'B' });
    const sighted = await scenario.tick(at(3, 48));
    expect(sighted).toMatchObject({
      outcome: 'withheld:change-pending',
      exitCode: 0,
    });
    expect(await scenario.activeVersion()).toBe(serving);
    const result = await scenario.tick(at(3, 72));
    expect(result).toMatchObject({
      outcome: 'stopped:staged-correction',
      exitCode: 3,
    });
    expect(scenario.state!.stopped).toMatchObject({
      reason: 'staged-correction',
      rounds: [1],
    });
    expect(await scenario.activeVersion()).toBe(serving);

    // Every later run sends nothing until a human clears the stop.
    const later = await scenario.tick(at(3, 96));
    expect(later).toMatchObject({
      outcome: 'stopped:staged-correction',
      exitCode: 3,
      requests: 0,
    });
  });

  it('a 429 ends the run at once, holds every later run, and nothing is retried', async () => {
    const scenario = await bootstrapped();
    scenario.serve({ 4: 'A' });
    scenario.jolpica.answers.set('/4/results/', () => ({
      kind: 'status',
      status: 429,
      headers: { 'Retry-After': '10800' },
    }));
    const sent = scenario.jolpica.requests.length;
    const refused = await scenario.tick(at(4, 5));
    // Rounds 2 and 3 are due too and are probed first; round 4's probe is
    // refused, and it is the run's last request.
    expect(refused.outcome).toBe('withheld:probe-provider-rate-limited');
    expect(scenario.jolpica.requests.slice(sent).at(-1)).toBe('/4/results/');
    expect(scenario.jolpica.requests.slice(sent)).not.toContain('/races/');
    expect(Date.parse(scenario.state!.holdUntil!)).toBe(
      at(4, 5).getTime() + 3 * HOUR,
    );

    const held = await scenario.tick(at(4, 6));
    expect(held).toMatchObject({ outcome: 'held', requests: 0 });

    scenario.jolpica.answers.delete('/4/results/');
    const after = await scenario.tick(at(4, 8.1));
    expect(after.requests).toBeGreaterThan(0);
    expect(after.outcome).toBe('withheld:first-result-pending');
  });

  it('a refused upload (stale release) stops the job; nothing is resent', async () => {
    const scenario = await bootstrapped();
    scenario.serve({ 4: 'A' });
    await scenario.tick(at(4, 5));
    scenario.workerHook = async (request, forward) =>
      request.method === 'POST'
        ? new Response(
            JSON.stringify({
              data: {
                outcome: 'publication',
                publication: { status: 'stale' },
              },
            }),
            { status: 409 },
          )
        : forward();
    const serving = await scenario.activeVersion();
    const result = await scenario.tick(at(4, 6));
    expect(result).toMatchObject({
      outcome: 'stopped:ingest-refused',
      exitCode: 3,
    });
    expect(await scenario.activeVersion()).toBe(serving);
    const posts = () =>
      scenario.workerCalls.filter((c) => c.method === 'POST').length;
    const sent = posts();
    expect((await scenario.tick(at(4, 7))).outcome).toBe(
      'stopped:ingest-refused',
    );
    expect(posts()).toBe(sent);
  });

  it('an ambiguous upload stops the job, and the CAS refuses the same submission again', async () => {
    const scenario = await bootstrapped();
    scenario.serve({ 4: 'A' });
    await scenario.tick(at(4, 5));
    let body: string | null = null;
    scenario.workerHook = async (request, forward) => {
      if (request.method !== 'POST') return forward();
      body = await request.clone().text();
      await forward(); // it commits ...
      throw new Error('answer lost'); // ... and the answer is lost
    };
    const serving = await scenario.activeVersion();
    const result = await scenario.tick(at(4, 6));
    expect(result).toMatchObject({
      outcome: 'stopped:ingest-ambiguous',
      exitCode: 3,
    });
    expect(await scenario.activeVersion()).not.toBe(serving);

    // The same submission sent again is refused: it names the old release.
    scenario.workerHook = null;
    const resend = await worker.fetch(
      new Request(`${ORIGIN}/internal/admin/season/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SCOPED}`,
          'Content-Type': 'application/json',
        },
        body: body!,
      }),
      scenario.env,
    );
    expect(resend.status).toBe(409);
  });

  it('a bootstrap refused by a 429 leaves no state, so it can be dispatched again later', async () => {
    const scenario = await Scenario.create({ 1: 'A', 2: 'A', 3: 'A' });
    scenario.jolpica.answers.set('/drivers/', () => ({
      kind: 'status',
      status: 429,
    }));
    const refused = await scenario.tick(at(3, 24), 'bootstrap');
    expect(refused).toMatchObject({
      outcome: 'withheld:capture-provider-rate-limited',
      requests: 3,
      state: null,
    });
    expect(scenario.workerCalls).toEqual([]);
    scenario.jolpica.answers.delete('/drivers/');
    expect((await scenario.tick(at(3, 30), 'bootstrap')).outcome).toBe(
      'published',
    );
  });

  it('a dry run decides but sends nothing credentialed', async () => {
    const scenario = await Scenario.create({ 1: 'A', 2: 'A', 3: 'A' });
    scenario.submit = false;
    const result = await scenario.tick(at(3, 24), 'bootstrap');
    expect(result.outcome).toBe('publishable-not-submitted');
    expect(scenario.workerCalls).toEqual([]);
  });
});
