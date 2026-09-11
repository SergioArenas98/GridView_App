/**
 * Overlapping identical seed attempts are idempotent (PR #19 review F1, the
 * residual race; ADR 0025 D12 step 10).
 *
 * Reproduced defect at `6053f30`: two `seed(sameCheckpoint)` invocations - for
 * example a client's replacement request issued while its first, timed-out
 * invocation is still running - both recover `uninitialized` before either has
 * committed, both stage a fresh seed, and their migration clocks differ. The
 * first `seedCutover` commits; the second presents the same fingerprint with a
 * different high-water mark, and `seedMatchesCommittedState` reports
 * `conflicting-cutover-seed` for what is the same checkpoint.
 *
 * The correction keeps the committed-state comparison exactly as it is: after
 * that conflict, a freshly staged invocation recovers the committed seed
 * **once**, and re-presents it unchanged **once**. No clock is re-read, no
 * legacy artifact is re-read, nothing loops and nothing durable is rewritten.
 *
 * The interleaving is forced with barriers inside a port wrapper, never with
 * sleeps: both initial recoveries answer before either invocation stages, both
 * invocations stage before either `seedCutover` runs, and the winner's
 * `seedCutover` completes before the loser's starts.
 */

import { describe, expect, it } from 'vitest';

import type { CutoverControl } from '../../../src/publication/cutover/control';
import type { CutoverCheckpoint } from '../../../src/publication/cutover/checkpoint';
import {
  CutoverPreparationService,
  type CutoverSeedResult,
} from '../../../src/publication/cutover/service';
import {
  DurableObjectSeasonPublicationSequencer,
  SeasonPublicationSequencer,
  authorityStorageKey,
  type CutoverSeed,
  type CutoverSeedOutcome,
  type CutoverSeedRecovery,
  type CutoverSeedRecoveryRequest,
  type SeasonPublicationSequencerPort,
  type SequencerDurableHost,
  type SequencerNamespace,
} from '../../../src/publication/sequencer';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import { MutableClock } from '../sequencer/support';
import {
  MIGRATION_IDENTITY,
  MIGRATION_NOW,
  SEASON,
  checkpointFor,
  cutoverContext,
  immediateRetry,
  runtimeConfigFor,
  type CutoverContext,
} from './support';

/** The loser's clock: an hour after the winner's, so the two floors differ. */
const LATER = '2026-07-20T13:00:00.000Z';
const seedControl: CutoverControl = { kind: 'seed', season: SEASON };

/** Resolves every arrival once `parties` callers have arrived, never earlier. */
function barrier(parties: number): () => Promise<void> {
  let arrived = 0;
  let release!: () => void;
  const open = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    arrived += 1;
    if (arrived === parties) release();
    await open;
  };
}

/** What a scripted call does instead of (or around) the real one. */
type Scripted<T> = T | 'throw' | undefined;

/**
 * Which presentation a `seedCutover` call is: each invocation's own staged
 * seed (told apart by its floor), or the loser's re-presentation after it.
 */
type SeedRole = 'winner' | 'loser' | 'representation';

/**
 * Forces two overlapping `seed` invocations into the racing interleaving.
 *
 * - The first two `recoverCutoverSeed` calls - one per invocation - both answer
 *   from the real sequencer, and neither returns until both have answered, so
 *   both observe the season uninitialized.
 * - The first two `seedCutover` calls - one per invocation - wait until both
 *   invocations have staged. The seed whose high-water mark is `winner` then
 *   runs to completion before the other one starts, whatever order the two
 *   invocations happened to arrive in.
 * - Any later call is the loser's post-conflict recovery or re-presentation,
 *   and runs straight through, unless a test scripts it.
 */
class RacingPort implements SeasonPublicationSequencerPort {
  readonly recoveries: CutoverSeedRecovery[] = [];
  readonly presented: CutoverSeed[] = [];
  readonly seedOutcomes: (CutoverSeedOutcome | 'threw')[] = [];

  /** Replaces the answer of the N-th (1-based) recovery; may tamper first. */
  onRecovery: (call: number) => Scripted<CutoverSeedRecovery> = () => undefined;
  /** Replaces one presentation; `'lose'` commits it and loses the answer. */
  onSeed: (role: SeedRole) => Scripted<CutoverSeedOutcome> | 'lose' = () =>
    undefined;
  /** Once both invocations have staged, before the winner presents. */
  onBothStaged: () => void = () => {};
  /** Once the winner's presentation has settled, before the loser's. */
  onWinnerSettled: () => void = () => {};

  private readonly bothRecovered = barrier(2);
  private readonly bothStaged = barrier(2);
  private winnerSettled!: () => void;
  private readonly winnerDone = new Promise<void>((resolve) => {
    this.winnerSettled = resolve;
  });

  constructor(
    private readonly inner: SeasonPublicationSequencerPort,
    private readonly winner: string,
  ) {}

  readAuthority: SeasonPublicationSequencerPort['readAuthority'] = (s) =>
    this.inner.readAuthority(s);
  prepare: SeasonPublicationSequencerPort['prepare'] = (r) =>
    this.inner.prepare(r);
  finalize: SeasonPublicationSequencerPort['finalize'] = (r) =>
    this.inner.finalize(r);
  cancel: SeasonPublicationSequencerPort['cancel'] = (r) =>
    this.inner.cancel(r);
  authorizeCleanup: SeasonPublicationSequencerPort['authorizeCleanup'] = (r) =>
    this.inner.authorizeCleanup(r);
  acknowledgeCleanup: SeasonPublicationSequencerPort['acknowledgeCleanup'] = (
    r,
  ) => this.inner.acknowledgeCleanup(r);
  activateCutover: SeasonPublicationSequencerPort['activateCutover'] = (r) =>
    this.inner.activateCutover(r);

  async recoverCutoverSeed(
    request: CutoverSeedRecoveryRequest,
  ): Promise<CutoverSeedRecovery> {
    const call = this.recoveries.length + 1;
    const scripted = this.onRecovery(call);
    if (scripted === 'throw') {
      this.recoveries.push({ outcome: 'rejected', reason: 'state-corrupt' });
      throw new Error('scripted recovery failure');
    }
    const answer = scripted ?? (await this.inner.recoverCutoverSeed(request));
    this.recoveries.push(answer);
    if (call <= 2) await this.bothRecovered();
    return answer;
  }

  async seedCutover(seed: CutoverSeed): Promise<CutoverSeedOutcome> {
    const staged = this.presented.length < 2;
    this.presented.push(seed);
    const role: SeedRole = !staged
      ? 'representation'
      : seed.seasonSnapshotObservedAtHighWaterMark === this.winner
        ? 'winner'
        : 'loser';
    if (staged) {
      await this.bothStaged();
      if (role === 'winner') this.onBothStaged();
      if (role === 'loser') await this.winnerDone;
    }
    try {
      const scripted = this.onSeed(role);
      if (scripted === 'throw') throw new Error('scripted seed failure');
      const outcome =
        scripted === undefined || scripted === 'lose'
          ? await this.inner.seedCutover(seed)
          : scripted;
      if (scripted === 'lose') throw new Error('response lost after commit');
      this.seedOutcomes.push(outcome);
      return outcome;
    } catch (error) {
      this.seedOutcomes.push('threw');
      throw error;
    } finally {
      if (role === 'winner') {
        this.onWinnerSettled();
        this.winnerSettled();
      }
    }
  }
}

function serviceFor(
  context: CutoverContext,
  port: SeasonPublicationSequencerPort,
  now: string,
): CutoverPreparationService {
  return new CutoverPreparationService({
    config: runtimeConfigFor({ control: seedControl }),
    authority: { mode: 'sequencer', port },
    storage: context.storage,
    validator: runtimeSnapshotValidator,
    logger: context.logger,
    clock: new MutableClock(new Date(now)),
    retry: immediateRetry,
  });
}

/** The winner (clock `MIGRATION_NOW`) and the loser (clock `LATER`), together. */
async function overlap(
  context: CutoverContext,
  port: RacingPort,
  checkpoints: readonly [CutoverCheckpoint, CutoverCheckpoint] = [
    checkpointFor(),
    checkpointFor(),
  ],
): Promise<{ winner: CutoverSeedResult; loser: CutoverSeedResult }> {
  const [winner, loser] = await Promise.all([
    serviceFor(context, port, MIGRATION_NOW).seed(checkpoints[0]),
    serviceFor(context, port, LATER).seed(checkpoints[1]),
  ]);
  return { winner, loser };
}

function durableState(context: CutoverContext): Record<string, unknown> {
  return Object.fromEntries(
    context.host.committedKeys().map((key) => [key, context.host.peek(key)]),
  );
}

/** The high-water mark the sequencer holds under the race's fingerprint. */
async function committedFloor(
  inner: SeasonPublicationSequencerPort,
  port: RacingPort,
): Promise<string | undefined> {
  const recovery = await inner.recoverCutoverSeed({
    season: SEASON,
    cutoverFingerprint: port.presented[0]!.cutoverFingerprint,
  });
  return recovery.outcome === 'committed'
    ? recovery.seed.seasonSnapshotObservedAtHighWaterMark
    : undefined;
}

function legacyReads(context: CutoverContext): number {
  const { inventoryReads, documentReads, sidecarReads } = context.storage;
  return inventoryReads.length + documentReads.length + sidecarReads.length;
}

/**
 * The race under a local port: the committed state right after the winner's
 * commit, and the legacy read count once both invocations had staged.
 */
async function racingContext() {
  const context = await cutoverContext();
  const port = new RacingPort(context.port, MIGRATION_NOW);
  const observed: { readsAtStaging?: number; afterWinner?: object } = {};
  port.onBothStaged = () => {
    observed.readsAtStaging = legacyReads(context);
  };
  port.onWinnerSettled = () => {
    observed.afterWinner = durableState(context);
  };
  return { context, port, observed };
}

describe('the overlapping race itself', () => {
  it('stages two different floors for one checkpoint after two uninitialized recoveries', async () => {
    const { context, port } = await racingContext();
    await overlap(context, port);

    // Both invocations saw the season uninitialized before either committed.
    expect(port.recoveries.slice(0, 2)).toEqual([
      { outcome: 'uninitialized' },
      { outcome: 'uninitialized' },
    ]);
    // Both staged the same checkpoint under the same fingerprint, and only
    // their clocks - and so their floors - differ.
    const [first, second] = port.presented;
    expect(second!.cutoverFingerprint).toBe(first!.cutoverFingerprint);
    expect(second!.activeVersion).toBe(first!.activeVersion);
    expect(second!.perKeyState).toEqual(first!.perKeyState);
    expect(
      [first, second].map((s) => s!.seasonSnapshotObservedAtHighWaterMark),
    ).toEqual(expect.arrayContaining([MIGRATION_NOW, LATER]));
    // The committed-state comparison still calls the loser's own floor a
    // conflict: the correction is after it, never inside it.
    expect(port.seedOutcomes.slice(0, 2)).toEqual([
      { outcome: 'seeded' },
      { outcome: 'rejected', reason: 'conflicting-cutover-seed' },
    ]);
  });
});

describe('overlapping identical attempts resolve to one seed', () => {
  it('returns seeded and already-seeded, keeping the winner floor byte for byte', async () => {
    const { context, port, observed } = await racingContext();
    const { winner, loser } = await overlap(context, port);

    expect(winner).toMatchObject({
      kind: 'seeded',
      receipt: {
        outcome: 'seeded',
        seeded: { seasonSnapshotObservedAtHighWaterMark: MIGRATION_NOW },
      },
    });
    expect(loser).toMatchObject({
      kind: 'seeded',
      receipt: {
        outcome: 'already-seeded',
        cutoverState: 'seeded',
        seeded: {
          // The winner's original floor, never the loser's later clock.
          seasonSnapshotObservedAtHighWaterMark: MIGRATION_NOW,
          activeProvenance: 'committed-seed',
        },
      },
    });
    // Authority and per-key state are exactly what the winner committed.
    expect(durableState(context)).toEqual(observed.afterWinner);
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'seeded',
      authoritative: false,
    });
    expect(await committedFloor(context.port, port)).toBe(MIGRATION_NOW);
  });

  it('recovers once and presents at most twice, with no legacy read after the conflict', async () => {
    const { context, port, observed } = await racingContext();
    await overlap(context, port);

    // The winner makes one recovery and one presentation; everything past
    // that is the loser's: its initial recovery plus exactly one after the
    // conflict, and its staged seed plus exactly one re-presentation.
    expect(port.recoveries).toHaveLength(3);
    expect(port.presented).toHaveLength(3);
    // The re-presented seed is the recovered one, unchanged.
    const recovered = port.recoveries[2];
    expect(recovered).toMatchObject({ outcome: 'committed' });
    expect(port.presented[2]).toEqual(
      recovered?.outcome === 'committed' ? recovered.seed : undefined,
    );
    expect(port.seedOutcomes[2]).toEqual({ outcome: 'already-seeded' });
    // Neither the legacy artifacts nor the clock were consulted again.
    expect(legacyReads(context)).toBe(observed.readsAtStaging);
  });

  it('recovers the winner seed when the winner lost its own answer', async () => {
    const { context, port, observed } = await racingContext();
    port.onSeed = (role) => (role === 'winner' ? 'lose' : undefined);
    const { winner, loser } = await overlap(context, port);

    // The winner committed, but its caller never learned it.
    expect(winner).toEqual({ kind: 'failed', failure: 'seed-unconfirmed' });
    expect(loser).toMatchObject({
      kind: 'seeded',
      receipt: {
        outcome: 'already-seeded',
        seeded: { seasonSnapshotObservedAtHighWaterMark: MIGRATION_NOW },
      },
    });
    expect(durableState(context)).toEqual(observed.afterWinner);
    expect(port.recoveries).toHaveLength(3);
    expect(port.presented).toHaveLength(3);
  });
});

describe('overlapping attempts across the Durable Object transport', () => {
  /** A minimal SQLite-shaped storage for a real Durable Object instance. */
  function durableHost(): SequencerDurableHost {
    const values = new Map<string, unknown>();
    return {
      storage: {
        transactionSync: <T>(closure: () => T): T => closure(),
        kv: {
          get: <T>(key: string) => values.get(key) as T | undefined,
          put: <T>(key: string, value: T) => {
            values.set(key, structuredClone(value));
          },
          delete: (key: string) => values.delete(key),
          list: <T>({ prefix = '' }: { prefix?: string } = {}) =>
            [...values.entries()].filter(([key]) => key.startsWith(prefix)) as [
              string,
              T,
            ][],
        },
      },
    };
  }

  /**
   * One real Durable Object; `garble` names a 1-based `recover-cutover-seed`
   * call whose response body is replaced by one no decoder accepts.
   */
  function namespace(garble?: number): SequencerNamespace {
    const object = new SeasonPublicationSequencer(durableHost());
    let recoveries = 0;
    return {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (url: string, init: RequestInit) => {
          const response = await object.fetch(new Request(url, init));
          const { command } = JSON.parse(String(init.body)) as {
            command: string;
          };
          if (command === 'recover-cutover-seed' && ++recoveries === garble) {
            return new Response('{"outcome":"committed","seed":{}}', {
              status: 200,
            });
          }
          return response;
        },
      }),
    };
  }

  it('resolves to seeded and already-seeded', async () => {
    const context = await cutoverContext();
    const inner = new DurableObjectSeasonPublicationSequencer(namespace());
    const port = new RacingPort(inner, MIGRATION_NOW);
    const { winner, loser } = await overlap(context, port);

    expect(winner).toMatchObject({ receipt: { outcome: 'seeded' } });
    expect(loser).toMatchObject({
      receipt: {
        outcome: 'already-seeded',
        seeded: { seasonSnapshotObservedAtHighWaterMark: MIGRATION_NOW },
      },
    });
    expect(await inner.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'seeded',
    });
    expect(await committedFloor(inner, port)).toBe(MIGRATION_NOW);
  });

  it('fails closed when the post-conflict answer cannot be decoded', async () => {
    const context = await cutoverContext();
    const inner = new DurableObjectSeasonPublicationSequencer(namespace(3));
    const port = new RacingPort(inner, MIGRATION_NOW);
    const { winner, loser } = await overlap(context, port);

    expect(winner).toMatchObject({ receipt: { outcome: 'seeded' } });
    expect(loser).toEqual({
      kind: 'failed',
      failure: 'committed-seed-incoherent',
    });
    // No re-presentation after an unusable recovery.
    expect(port.recoveries).toHaveLength(3);
    expect(port.presented).toHaveLength(2);
    expect(await committedFloor(inner, port)).toBe(MIGRATION_NOW);
  });
});

describe('every inconsistent post-conflict outcome is bounded', () => {
  /**
   * Runs the race with the loser's post-conflict recovery (the third) or its
   * re-presentation scripted, and proves the loser stopped there: nothing is
   * rewritten, nothing is re-read, nothing repeats.
   */
  async function raceWith(script: {
    recovery?: (context: CutoverContext) => Scripted<CutoverSeedRecovery>;
    representation?: Scripted<CutoverSeedOutcome>;
  }) {
    const { context, port, observed } = await racingContext();
    port.onRecovery = (call) =>
      call === 3 && script.recovery ? script.recovery(context) : undefined;
    port.onSeed = (role) =>
      role === 'representation' ? script.representation : undefined;
    const { winner, loser } = await overlap(context, port);

    expect(winner).toMatchObject({ receipt: { outcome: 'seeded' } });
    expect(port.recoveries.length).toBeLessThanOrEqual(3);
    expect(port.presented.length).toBeLessThanOrEqual(3);
    expect(legacyReads(context)).toBe(observed.readsAtStaging);
    return { context, port, loser, afterWinner: observed.afterWinner };
  }

  function patchAuthority(
    context: CutoverContext,
    patch: Record<string, unknown>,
  ): void {
    context.host.poke(authorityStorageKey, {
      ...(context.host.peek(authorityStorageKey) as Record<string, unknown>),
      ...patch,
    });
  }

  it('a different checkpoint won the race: still conflicting-cutover-seed', async () => {
    const { context, port } = await racingContext();
    const { winner, loser } = await overlap(context, port, [
      checkpointFor(),
      checkpointFor({ migrationIdentity: `${MIGRATION_IDENTITY}-other` }),
    ]);

    expect(winner).toMatchObject({ receipt: { outcome: 'seeded' } });
    expect(loser).toEqual({
      kind: 'failed',
      failure: 'conflicting-cutover-seed',
    });
    // The post-conflict recovery named another fingerprint, so nothing was
    // re-presented.
    expect(port.recoveries[2]).toEqual({
      outcome: 'rejected',
      reason: 'conflicting-cutover-seed',
    });
    expect(port.presented).toHaveLength(2);
  });

  it('corrupt committed state: committed-seed-incoherent, nothing repaired', async () => {
    let tampered: object | undefined;
    const { context, port, loser } = await raceWith({
      recovery: (context) => {
        const key = context.host
          .committedKeys()
          .find((name) => name.startsWith('committed/'));
        context.host.poke(key!, { revision: 'not-a-revision' });
        tampered = durableState(context);
        return undefined;
      },
    });

    expect(loser).toEqual({
      kind: 'failed',
      failure: 'committed-seed-incoherent',
    });
    expect(port.presented).toHaveLength(2);
    expect(durableState(context)).toEqual(tampered);
  });

  it('checkpoint-incoherent committed state: committed-seed-incoherent', async () => {
    let tampered: object | undefined;
    const { context, port, loser } = await raceWith({
      recovery: (context) => {
        patchAuthority(context, { previousVersion: 'v-cutover-unnamed' });
        tampered = durableState(context);
        return undefined;
      },
    });

    expect(loser).toEqual({
      kind: 'failed',
      failure: 'committed-seed-incoherent',
    });
    expect(port.presented).toHaveLength(2);
    expect(durableState(context)).toEqual(tampered);
  });

  it('uninitialized after a conflict: fails closed and never restarts the migration', async () => {
    const { context, port, loser, afterWinner } = await raceWith({
      recovery: () => ({ outcome: 'uninitialized' }),
    });

    expect(loser).toEqual({ kind: 'failed', failure: 'seed-unconfirmed' });
    expect(port.presented).toHaveLength(2);
    expect(durableState(context)).toEqual(afterWinner);
  });

  it('a recovery that throws after the conflict: seed-unconfirmed', async () => {
    const { context, port, loser, afterWinner } = await raceWith({
      recovery: () => 'throw',
    });

    expect(loser).toEqual({ kind: 'failed', failure: 'seed-unconfirmed' });
    expect(port.presented).toHaveLength(2);
    expect(durableState(context)).toEqual(afterWinner);
  });

  it('a re-presentation that throws: seed-unconfirmed, no second recovery', async () => {
    const { context, port, loser, afterWinner } = await raceWith({
      representation: 'throw',
    });

    expect(loser).toEqual({ kind: 'failed', failure: 'seed-unconfirmed' });
    expect(port.recoveries).toHaveLength(3);
    expect(port.presented).toHaveLength(3);
    expect(durableState(context)).toEqual(afterWinner);
  });

  it('a re-presentation that is rejected: bounded, no second recovery', async () => {
    const { port, loser } = await raceWith({
      representation: {
        outcome: 'rejected',
        reason: 'conflicting-cutover-seed',
      },
    });

    expect(loser).toEqual({
      kind: 'failed',
      failure: 'conflicting-cutover-seed',
    });
    expect(port.recoveries).toHaveLength(3);
    expect(port.presented).toHaveLength(3);
  });
});
