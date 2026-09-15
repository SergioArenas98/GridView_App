/**
 * Mutation resumption after the fingerprint-bound activation, through the real
 * Worker composition (ADR 0025 D12).
 *
 * The invariant this file holds: a season named by a cutover control is never
 * mutated through the legacy publisher, and its publication and rollback stay
 * refused until the sequencer **positively** reports it `active` and
 * authoritative. Under `seed:` nothing reopens it. Under `activate:` the
 * activation request itself is what resumes its mutators, and they resume
 * through `SequencedPublicationService` - no configuration change, and never
 * through `SnapshotPublisher` or the legacy `active:{season}` and
 * `previous:{season}` pointers.
 *
 * Absence of a legacy write is proven by recording every pointer write and
 * every stored version, not inferred from a status word.
 */

import { describe, expect, it } from 'vitest';

import worker, { type Env } from '../../../src/index';
import { MockFormulaOneProvider } from '../../../src/providers/mock/mock-provider';
import type { SeasonAuthority } from '../../../src/publication/sequencer/model';
import type { SeasonPublicationSequencerPort } from '../../../src/publication/sequencer/port';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import {
  adminRequest,
  createHarness,
  request,
  seedPublishedSnapshot,
  type EdgeHarness,
} from '../../support/edge-harness';
import { countingPort, type CountingPort } from '../sequenced/support';
import {
  OTHER_SEASON,
  SEASON,
  checkpointFor,
  immediateRetry,
  inProcessPort,
} from './support';

const TOKEN = 'local-test-token';
const PAUSED = 'season-paused-for-cutover';
const UNAVAILABLE = 'sequencer-authority-unavailable';

/** Records every legacy pointer write. */
class PointerRecordingStorage extends MemorySnapshotStorage {
  readonly pointerWrites: string[] = [];

  override async setActiveVersion(
    season: number,
    version: string,
  ): Promise<void> {
    this.pointerWrites.push(`active:${season}`);
    return super.setActiveVersion(season, version);
  }

  override async setPreviousVersion(
    season: number,
    version: string | null,
  ): Promise<void> {
    this.pointerWrites.push(`previous:${season}`);
    return super.setPreviousVersion(season, version);
  }
}

/** One in-process coordinator per season, as one Durable Object per season. */
function perSeasonPort(): SeasonPublicationSequencerPort {
  const ports = new Map<number, SeasonPublicationSequencerPort>();
  const at = (season: number): SeasonPublicationSequencerPort => {
    let port = ports.get(season);
    if (port === undefined) {
      port = inProcessPort();
      ports.set(season, port);
    }
    return port;
  };
  return {
    readAuthority: (season) => at(season).readAuthority(season),
    prepare: (r) => at(r.season).prepare(r),
    finalize: (r) => at(r.season).finalize(r),
    cancel: (r) => at(r.season).cancel(r),
    authorizeCleanup: (r) => at(r.season).authorizeCleanup(r),
    acknowledgeCleanup: (r) => at(r.season).acknowledgeCleanup(r),
    seedCutover: (s) => at(s.season).seedCutover(s),
    recoverCutoverSeed: (r) => at(r.season).recoverCutoverSeed(r),
    activateCutover: (r) => at(r.season).activateCutover(r),
  };
}

interface Staged {
  readonly harness: EdgeHarness;
  readonly storage: PointerRecordingStorage;
  readonly port: CountingPort;
  /** The legacy release published before any cutover; the checkpoint names it. */
  readonly legacyActive: string;
}

/** One genuinely published legacy release, and a fresh sequencer. */
async function staged(): Promise<Staged> {
  const storage = new PointerRecordingStorage();
  const harness = createHarness({ storage });
  await seedPublishedSnapshot(harness);
  const legacyActive = await storage.getActiveVersion(SEASON);
  if (legacyActive === null) throw new Error('no legacy release');
  storage.pointerWrites.splice(0);
  return {
    harness,
    storage,
    port: countingPort(perSeasonPort()),
    legacyActive,
  };
}

function envFor(
  context: Staged,
  control: string,
  overrides: Partial<Env> = {},
): Env {
  return {
    ...context.harness.env,
    ENVIRONMENT: 'staging',
    SEASON_PUBLICATION_AUTHORITY: 'sequencer',
    SEASON_PUBLICATION_CUTOVER_CONTROL: control,
    __SEASON_PUBLICATION_SEQUENCER: context.port,
    __CUTOVER_RETRY: immediateRetry,
    ...overrides,
  };
}

function checkpoint(context: Staged, overrides = {}) {
  return checkpointFor({ activeVersion: context.legacyActive, ...overrides });
}

async function seed(context: Staged): Promise<void> {
  const response = await worker.fetch(
    adminRequest('/internal/admin/publication/cutover/seed', TOKEN, {
      checkpoint: checkpoint(context),
    }),
    envFor(context, `seed:${SEASON}`),
  );
  expect(response.status).toBe(200);
}

async function activate(
  context: Staged,
  body: Record<string, unknown>,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const response = await worker.fetch(
    adminRequest('/internal/admin/publication/cutover/activate', TOKEN, body),
    envFor(context, `activate:${SEASON}`),
  );
  return { status: response.status, data: await payload(response) };
}

/** A public read's body, without the per-request identifier. */
async function readBody(env: Env): Promise<unknown> {
  const response = await worker.fetch(
    request(`/v1/seasons/${SEASON}/calendar`),
    env,
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { meta: Record<string, unknown> };
  return { ...body, meta: { ...body.meta, requestId: null } };
}

async function payload(response: Response): Promise<Record<string, unknown>> {
  const parsed = (await response.json()) as { data?: Record<string, unknown> };
  return parsed.data ?? {};
}

/** A synchronization run that publishes `season` when admitted. */
async function publish(env: Env, season = SEASON): Promise<string> {
  const response = await worker.fetch(
    adminRequest(`/internal/admin/sync/full?season=${season}`),
    env,
  );
  return JSON.stringify(await payload(response));
}

async function rollback(
  env: Env,
  season = SEASON,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const response = await worker.fetch(
    adminRequest(`/internal/admin/rollback?season=${season}`),
    env,
  );
  return { status: response.status, data: await payload(response) };
}

/** A provider whose next release is strictly newer than the seeded one. */
function newerProvider(context: Staged): MockFormulaOneProvider {
  return new MockFormulaOneProvider({
    clock: context.harness.clock,
    sourceUpdatedAt: '2026-07-19T08:00:00.000Z',
    contentVersion: '2026.07.19.1',
  });
}

/** Everything the legacy path would have touched for the controlled season. */
async function legacySnapshot(context: Staged) {
  return {
    active: await context.storage.getActiveVersion(SEASON),
    previous: await context.storage.getPreviousVersion(SEASON),
    versions: await context.storage.listVersions(SEASON),
  };
}

function writesFor(context: Staged, season: number): string[] {
  return context.storage.pointerWrites.filter((write) =>
    write.endsWith(`:${season}`),
  );
}

/** Both mutators refused, nothing reached the two-phase protocol or legacy. */
async function expectRefused(
  context: Staged,
  env: Env,
  reason: string,
): Promise<void> {
  const before = await legacySnapshot(context);
  const mark = context.port.calls.length;

  expect(await publish(env)).toContain(reason);
  const rolledBack = await rollback(env);
  expect(rolledBack.status).toBe(409);
  expect(rolledBack.data).toMatchObject({ season: SEASON, reason });

  expect(await legacySnapshot(context)).toEqual(before);
  expect(context.storage.pointerWrites).toEqual([]);
  const calls = context.port.calls.slice(mark);
  expect(calls).not.toContain('prepare');
  expect(calls).not.toContain('finalize');
}

describe('admission stays closed until the season is durably active', () => {
  for (const phase of ['seed', 'activate'] as const) {
    for (const state of ['uninitialized', 'seeded'] as const) {
      it(`refuses publication and rollback under ${phase}:${SEASON} while ${state}`, async () => {
        const context = await staged();
        if (state === 'seeded') await seed(context);
        const mark = context.port.calls.length;

        await expectRefused(
          context,
          envFor(context, `${phase}:${SEASON}`),
          PAUSED,
        );

        // `seed:` refuses around the whole surface, before any authority read;
        // `activate:` asks the sequencer once per command and nothing more.
        const calls = new Set(context.port.calls.slice(mark));
        expect([...calls]).toEqual(phase === 'seed' ? [] : ['readAuthority']);
      });
    }
  }

  it(`never reopens under seed:${SEASON}, even for an active season`, async () => {
    const context = await staged();
    await seed(context);
    expect(
      (
        await activate(context, {
          checkpoint: checkpoint(context),
          confirmActivation: true,
        })
      ).status,
    ).toBe(200);
    await expectRefused(context, envFor(context, `seed:${SEASON}`), PAUSED);
  });
});

describe('an unreadable or unconfirmed authority fails closed under activate', () => {
  const answers: Record<string, () => Promise<SeasonAuthority>> = {
    'a lookup that throws': async () => {
      throw new Error('sequencer lookup failed');
    },
    'an unavailable authority': async () => ({
      cutoverState: 'unavailable',
      authoritative: false,
    }),
    'an active answer that is not authoritative': async () => ({
      cutoverState: 'active',
      authoritative: false,
      activeVersion: 'v-anything',
      previousVersion: null,
      cutoverFingerprint: 'cutover1:anything',
    }),
  };

  for (const [name, answer] of Object.entries(answers)) {
    it(`refuses both mutators on ${name}, without a legacy fallback`, async () => {
      const context = await staged();
      const inner = context.port;
      const port: CountingPort = {
        ...inner,
        readAuthority: async () => {
          inner.calls.push('readAuthority');
          return answer();
        },
      };
      await expectRefused(
        context,
        envFor(context, `activate:${SEASON}`, {
          __SEASON_PUBLICATION_SEQUENCER: port,
        }),
        UNAVAILABLE,
      );
    });
  }

  it('refuses both mutators when the selected sequencer is unreachable', async () => {
    const context = await staged();
    await expectRefused(
      context,
      envFor(context, `activate:${SEASON}`, {
        __SEASON_PUBLICATION_SEQUENCER: undefined,
      }),
      PAUSED,
    );
  });

  it('refuses both mutators when the authority mode is not the sequencer', async () => {
    const context = await staged();
    await seed(context);
    await activate(context, {
      checkpoint: checkpoint(context),
      confirmActivation: true,
    });
    // Durably active, yet a Worker that did not select the sequencer must not
    // reopen the season through the legacy publisher.
    await expectRefused(
      context,
      envFor(context, `activate:${SEASON}`, {
        SEASON_PUBLICATION_AUTHORITY: undefined,
      }),
      PAUSED,
    );
  });
});

describe('the activation request resumes mutators through the sequencer', () => {
  it('refuses before activation, then admits publication and rollback through the sequenced service', async () => {
    const context = await staged();
    const legacyRead = await readBody(context.harness.env);
    await seed(context);
    const env = envFor(context, `activate:${SEASON}`);

    // Deployed `activate:`, still seeded: closed, and reads stay on legacy.
    await expectRefused(context, env, PAUSED);
    expect(await readBody(env)).toEqual(legacyRead);

    // The exact protections: literal `true`, the exact checkpoint.
    expect(
      await activate(context, {
        checkpoint: checkpoint(context),
        confirmActivation: 'true',
      }),
    ).toMatchObject({
      status: 409,
      data: { kind: 'failed', failure: 'activation-not-confirmed' },
    });
    expect(
      await activate(context, {
        checkpoint: checkpoint(context, {
          migrationIdentity: 'another-attempt',
        }),
        confirmActivation: true,
      }),
    ).toMatchObject({
      status: 409,
      data: { kind: 'failed', failure: 'cutover-fingerprint-mismatch' },
    });
    await expectRefused(context, env, PAUSED);

    // The activation performs only the durable transition, idempotently.
    const before = await legacySnapshot(context);
    const body = { checkpoint: checkpoint(context), confirmActivation: true };
    expect(await activate(context, body)).toMatchObject({
      status: 200,
      data: { kind: 'activated', receipt: { outcome: 'activated' } },
    });
    expect(await activate(context, body)).toMatchObject({
      status: 200,
      data: { kind: 'activated', receipt: { outcome: 'already-active' } },
    });
    expect(await legacySnapshot(context)).toEqual(before);
    const status = await worker.fetch(
      adminRequest(
        `/internal/admin/publication/cutover/status?season=${SEASON}`,
        TOKEN,
        undefined,
        'GET',
      ),
      env,
    );
    expect(await payload(status)).toMatchObject({
      state: 'active',
      phase: 'activate',
      authoritative: true,
      admissionClosed: false,
    });

    // The next publication is admitted through the two-phase protocol, with
    // no configuration change, and moves no legacy pointer.
    const resumed = { ...env, __PROVIDER: newerProvider(context) };
    let mark = context.port.calls.length;
    const published = await publish(resumed);
    expect(published).not.toContain(PAUSED);
    expect(context.port.calls.slice(mark)).toEqual(
      expect.arrayContaining(['prepare', 'finalize']),
    );
    const afterPublish = await context.port.readAuthority(SEASON);
    expect(afterPublish).toMatchObject({
      cutoverState: 'active',
      authoritative: true,
      previousVersion: context.legacyActive,
    });
    if (afterPublish.cutoverState !== 'active') return;
    expect(afterPublish.activeVersion).toMatch(/^pm1-/);
    expect(await context.storage.getActiveVersion(SEASON)).toBe(before.active);
    expect(await context.storage.getPreviousVersion(SEASON)).toBe(
      before.previous,
    );
    expect(writesFor(context, SEASON)).toEqual([]);

    // Public reads now follow the sequencer, not the unmoved legacy pointer.
    expect(await readBody(resumed)).not.toEqual(legacyRead);

    // Rollback is admitted through the sequencer too: a republication of the
    // previous release under a fresh sequencer-allocated version.
    mark = context.port.calls.length;
    const rolledBack = await rollback(resumed);
    expect(rolledBack.status).toBe(200);
    expect(rolledBack.data).toMatchObject({
      status: 'applied',
      season: SEASON,
    });
    expect(String(rolledBack.data.version)).toMatch(/^pm1-/);
    expect(context.port.calls.slice(mark)).toEqual(
      expect.arrayContaining(['prepare', 'finalize']),
    );
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'active',
      activeVersion: rolledBack.data.version,
      previousVersion: afterPublish.activeVersion,
    });
    expect(await context.storage.getActiveVersion(SEASON)).toBe(before.active);
    expect(await context.storage.getPreviousVersion(SEASON)).toBe(
      before.previous,
    );
    expect(writesFor(context, SEASON)).toEqual([]);
  });
});

describe('what the cutover control does not touch', () => {
  it('publishes and rolls back a season the control does not name through its normal authority', async () => {
    // The mock provider only generates season 2026, so here the control names
    // another season and 2026 is the bystander, uninitialized in its own
    // sequencer: the legacy publisher still serves it, pointers and all.
    const context = await staged();
    const env = envFor(context, `activate:${OTHER_SEASON}`, {
      __PROVIDER: newerProvider(context),
    });
    expect(await publish(env)).not.toContain(PAUSED);
    expect(writesFor(context, SEASON)).toContain(`active:${SEASON}`);
    expect(await rollback(env)).toMatchObject({
      status: 200,
      data: { status: 'applied', season: SEASON },
    });
  });

  it('leaves another season unpaused after the controlled season activates', async () => {
    const context = await staged();
    await seed(context);
    await activate(context, {
      checkpoint: checkpoint(context),
      confirmActivation: true,
    });
    const rolledBack = await rollback(
      envFor(context, `activate:${SEASON}`),
      OTHER_SEASON,
    );
    // It reaches the legacy authority and gets that season's own answer.
    expect(rolledBack.data.season).toBe(OTHER_SEASON);
    expect(rolledBack.data.reason).not.toBe(PAUSED);
    expect(rolledBack.data.reason).not.toBe(UNAVAILABLE);
    expect(writesFor(context, SEASON)).toEqual([]);
  });

  it('keeps the operator cache purge available in both phases and after activation', async () => {
    const context = await staged();
    const purge = async (env: Env) => {
      const response = await worker.fetch(
        adminRequest(`/internal/admin/cache/purge?season=${SEASON}`),
        env,
      );
      expect(response.status).toBe(200);
      return payload(response);
    };

    await seed(context);
    for (const phase of ['seed', 'activate']) {
      expect(await purge(envFor(context, `${phase}:${SEASON}`))).toMatchObject({
        season: SEASON,
        activeVersion: context.legacyActive,
        ok: true,
      });
    }
    await activate(context, {
      checkpoint: checkpoint(context),
      confirmActivation: true,
    });
    expect(await purge(envFor(context, `activate:${SEASON}`))).toMatchObject({
      season: SEASON,
      ok: true,
    });
    expect(context.storage.pointerWrites).toEqual([]);
  });
});
