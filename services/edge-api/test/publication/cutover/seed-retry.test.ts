/**
 * An identical seed retry is independent of wall time (PR #19 review F1,
 * ADR 0025 D12 step 10).
 *
 * Reproduced defect: the high-water mark was recomputed from `clock.now()` on
 * every `seed(checkpoint)` call, and `seedMatchesCommittedState` compares that
 * field, so retrying the *same* checkpoint after a lost or ambiguous response
 * returned `conflicting-cutover-seed` instead of `already-seeded`. The original
 * idempotence test missed it because it used a `FixedClock`; every clock here
 * advances between attempts.
 *
 * The correction retrieves the committed seed bound to the checkpoint's
 * fingerprint **before** a fresh clock reading or any legacy read, so a retry
 * reuses the committed high-water mark byte for byte - and a different
 * checkpoint, or a committed state that cannot be reconciled with this one,
 * still fails closed without writing anything.
 */

import { describe, expect, it } from 'vitest';

import type { Clock } from '../../../src/runtime/clock';
import type { CutoverControl } from '../../../src/publication/cutover/control';
import { CutoverPreparationService } from '../../../src/publication/cutover/service';
import {
  DurableObjectSeasonPublicationSequencer,
  LocalSeasonPublicationSequencer,
  SeasonPublicationSequencer,
  authorityStorageKey,
  type CutoverSeed,
  type CutoverSeedOutcome,
  type SeasonPublicationSequencerPort,
  type SequencerDurableHost,
  type SequencerNamespace,
} from '../../../src/publication/sequencer';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import { MutableClock } from '../sequencer/support';
import {
  ACTIVE_VERSION,
  EVIDENCE_REFERENCE,
  MIGRATION_NOW,
  PREVIOUS_VERSION,
  SEASON,
  checkpointFor,
  copyRelease,
  cutoverContext,
  immediateRetry,
  runtimeConfigFor,
  type CutoverContext,
} from './support';

/** Far enough that a recomputed floor could never coincide with the first. */
const ONE_HOUR = 60 * 60 * 1000;
const seedControl: CutoverControl = { kind: 'seed', season: SEASON };

function serviceFor(
  context: CutoverContext,
  clock: Clock,
  options: {
    port?: SeasonPublicationSequencerPort;
    control?: CutoverControl;
  } = {},
): CutoverPreparationService {
  return new CutoverPreparationService({
    config: runtimeConfigFor({ control: options.control ?? seedControl }),
    authority: { mode: 'sequencer', port: options.port ?? context.port },
    storage: context.storage,
    validator: runtimeSnapshotValidator,
    logger: context.logger,
    clock,
    retry: immediateRetry,
  });
}

/** Every committed durable key and value, for a byte-for-byte comparison. */
function durableState(context: CutoverContext): Record<string, unknown> {
  return Object.fromEntries(
    context.host.committedKeys().map((key) => [key, context.host.peek(key)]),
  );
}

function legacyReads(context: CutoverContext): number {
  const { inventoryReads, documentReads, sidecarReads } = context.storage;
  return inventoryReads.length + documentReads.length + sidecarReads.length;
}

/**
 * The sequencer commits the first seed, and the answer never reaches the
 * caller - the lost-response half of an ambiguous outcome.
 */
class FirstSeedResponseLost extends LocalSeasonPublicationSequencer {
  private lost = false;

  override async seedCutover(seed: CutoverSeed): Promise<CutoverSeedOutcome> {
    const outcome = await super.seedCutover(seed);
    if (!this.lost) {
      this.lost = true;
      throw new Error('response lost after commit');
    }
    return outcome;
  }
}

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
 * One real Durable Object behind a stub whose first `seed-cutover` answer is
 * replaced by a transport failure **after** the object has committed it - the
 * unavailable-response half of an ambiguous outcome.
 */
function namespaceLosingFirstSeedResponse(): SequencerNamespace {
  const object = new SeasonPublicationSequencer(durableHost());
  let lost = false;
  return {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (url: string, init: RequestInit) => {
        const response = await object.fetch(new Request(url, init));
        const { command } = JSON.parse(String(init.body)) as {
          command: string;
        };
        if (command === 'seed-cutover' && !lost) {
          lost = true;
          return new Response('{"error":"sequencer-unavailable"}', {
            status: 500,
          });
        }
        return response;
      },
    }),
  };
}

describe('an identical retry reuses the committed seed', () => {
  it('returns already-seeded after the clock has advanced, and writes nothing', async () => {
    const context = await cutoverContext();
    const clock = new MutableClock(new Date(MIGRATION_NOW));
    const service = serviceFor(context, clock);

    const first = await service.seed(checkpointFor());
    expect(first).toMatchObject({
      kind: 'seeded',
      receipt: {
        outcome: 'seeded',
        seeded: { seasonSnapshotObservedAtHighWaterMark: MIGRATION_NOW },
      },
    });
    const committed = durableState(context);
    const authority = await context.port.readAuthority(SEASON);

    clock.advance(ONE_HOUR);
    const second = await service.seed(checkpointFor());

    expect(second).toMatchObject({
      kind: 'seeded',
      receipt: {
        outcome: 'already-seeded',
        cutoverState: 'seeded',
        seeded: {
          activeVersion: ACTIVE_VERSION,
          // The committed floor, byte for byte - never the retry's clock.
          seasonSnapshotObservedAtHighWaterMark: MIGRATION_NOW,
          activeProvenance: 'committed-seed',
        },
      },
    });
    // Neither lowered nor advanced, and no per-key state was rewritten.
    expect(durableState(context)).toEqual(committed);
    expect(await context.port.readAuthority(SEASON)).toEqual(authority);
  });

  it('recovers a seed whose first response was lost after it committed', async () => {
    const context = await cutoverContext();
    const clock = new MutableClock(new Date(MIGRATION_NOW));
    const port = new FirstSeedResponseLost(context.coordinator);
    const service = serviceFor(context, clock, { port });

    expect(await service.seed(checkpointFor())).toEqual({
      kind: 'failed',
      failure: 'seed-unconfirmed',
    });
    // The sequencer did commit it; only the answer was lost.
    const committed = durableState(context);
    expect(await port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'seeded',
    });

    clock.advance(ONE_HOUR);
    expect(await service.seed(checkpointFor())).toMatchObject({
      kind: 'seeded',
      receipt: {
        outcome: 'already-seeded',
        seeded: { seasonSnapshotObservedAtHighWaterMark: MIGRATION_NOW },
      },
    });
    expect(durableState(context)).toEqual(committed);
  });

  it('recovers over the Durable Object transport when the first answer was unavailable', async () => {
    const context = await cutoverContext();
    const clock = new MutableClock(new Date(MIGRATION_NOW));
    const port = new DurableObjectSeasonPublicationSequencer(
      namespaceLosingFirstSeedResponse(),
    );
    const service = serviceFor(context, clock, { port });

    // The transport failure maps to the client's bounded fallback, never to a
    // decision - but the object behind it committed the seed.
    expect(await service.seed(checkpointFor())).toMatchObject({
      kind: 'failed',
    });
    expect(await port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'seeded',
      authoritative: false,
    });

    clock.advance(ONE_HOUR);
    expect(await service.seed(checkpointFor())).toMatchObject({
      kind: 'seeded',
      receipt: {
        outcome: 'already-seeded',
        seeded: { seasonSnapshotObservedAtHighWaterMark: MIGRATION_NOW },
      },
    });
  });

  it('never re-reads the legacy artifacts, so their availability no longer matters', async () => {
    const context = await cutoverContext();
    const clock = new MutableClock(new Date(MIGRATION_NOW));
    const service = serviceFor(context, clock);
    const checkpoint = checkpointFor({ previousVersion: PREVIOUS_VERSION });
    expect(await service.seed(checkpoint)).toMatchObject({ kind: 'seeded' });

    // Every legacy read would now fail. Re-running the migration would drop the
    // best-effort previous version and report a conflict with the committed
    // seed; recovering the committed seed is unaffected.
    context.storage.inventory = () => 'throw';
    context.storage.sidecar = () => 'throw';
    const readsBefore = legacyReads(context);
    clock.advance(ONE_HOUR);

    expect(await service.seed(checkpoint)).toMatchObject({
      kind: 'seeded',
      receipt: {
        outcome: 'already-seeded',
        seeded: {
          previousVersion: PREVIOUS_VERSION,
          previousVersionCommitted: true,
        },
      },
    });
    expect(legacyReads(context)).toBe(readsBefore);
  });

  it('returns already-active after activation, and leaves authority untouched', async () => {
    const context = await cutoverContext();
    const clock = new MutableClock(new Date(MIGRATION_NOW));
    const seeded = await serviceFor(context, clock).seed(checkpointFor());
    if (seeded.kind !== 'seeded') throw new Error('seed failed');
    const activated = await serviceFor(context, clock, {
      control: { kind: 'activate', season: SEASON },
    }).activate(seeded.receipt.checkpoint, true);
    expect(activated).toMatchObject({ kind: 'activated' });
    const committed = durableState(context);

    clock.advance(ONE_HOUR);
    expect(
      await serviceFor(context, clock).seed(checkpointFor()),
    ).toMatchObject({
      kind: 'seeded',
      receipt: {
        outcome: 'already-active',
        cutoverState: 'active',
        seeded: { seasonSnapshotObservedAtHighWaterMark: MIGRATION_NOW },
      },
    });
    expect(durableState(context)).toEqual(committed);
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'active',
      authoritative: true,
    });
  });
});

describe('a different checkpoint still conflicts, whatever the clock', () => {
  async function seededContext() {
    const context = await cutoverContext();
    const clock = new MutableClock(new Date(MIGRATION_NOW));
    const service = serviceFor(context, clock);
    expect(await service.seed(checkpointFor())).toMatchObject({
      kind: 'seeded',
    });
    clock.advance(ONE_HOUR);
    return { context, service, committed: durableState(context) };
  }

  it('fails closed for a different migration identity, before any legacy read', async () => {
    const { context, service, committed } = await seededContext();
    const readsBefore = legacyReads(context);

    expect(
      await service.seed(
        checkpointFor({ migrationIdentity: 'cutover-2026-staging-02' }),
      ),
    ).toEqual({ kind: 'failed', failure: 'conflicting-cutover-seed' });
    // The authority decides the conflict; the legacy artifacts are not re-read
    // to find out, and nothing is written.
    expect(legacyReads(context)).toBe(readsBefore);
    expect(durableState(context)).toEqual(committed);
  });

  it('fails closed for a different active checkpoint version', async () => {
    const { context, service, committed } = await seededContext();
    await copyRelease(context.memory, ACTIVE_VERSION, 'v-cutover-other');
    const readsBefore = legacyReads(context);

    expect(
      await service.seed(checkpointFor({ activeVersion: 'v-cutover-other' })),
    ).toEqual({ kind: 'failed', failure: 'conflicting-cutover-seed' });
    expect(legacyReads(context)).toBe(readsBefore);
    expect(durableState(context)).toEqual(committed);
  });

  it('fails closed for a different previous checkpoint version', async () => {
    const { context, service, committed } = await seededContext();
    const readsBefore = legacyReads(context);

    expect(
      await service.seed(checkpointFor({ previousVersion: PREVIOUS_VERSION })),
    ).toEqual({ kind: 'failed', failure: 'conflicting-cutover-seed' });
    expect(legacyReads(context)).toBe(readsBefore);
    expect(durableState(context)).toEqual(committed);
  });
});

describe('a committed seed that cannot be reconciled fails closed', () => {
  async function tamperedContext(
    tamper: (context: CutoverContext) => void,
    checkpoint = checkpointFor(),
  ) {
    const context = await cutoverContext();
    const clock = new MutableClock(new Date(MIGRATION_NOW));
    const service = serviceFor(context, clock);
    expect(await service.seed(checkpoint)).toMatchObject({ kind: 'seeded' });
    tamper(context);
    clock.advance(ONE_HOUR);
    const committed = durableState(context);
    const result = await service.seed(checkpoint);
    // Whatever the failure, nothing was repaired, overwritten or reset.
    expect(durableState(context)).toEqual(committed);
    return result;
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

  it('on corrupt committed per-key state under the same fingerprint', async () => {
    expect(
      await tamperedContext((context) => {
        const key = context.host
          .committedKeys()
          .find((name) => name.startsWith('committed/'));
        context.host.poke(key!, { revision: 'not-a-revision' });
      }),
    ).toEqual({ kind: 'failed', failure: 'committed-seed-incoherent' });
  });

  it('on a committed active version this checkpoint never named', async () => {
    expect(
      await tamperedContext((context) =>
        patchAuthority(context, { activeVersion: PREVIOUS_VERSION }),
      ),
    ).toEqual({ kind: 'failed', failure: 'committed-seed-incoherent' });
  });

  it('on a committed previous version this checkpoint never named', async () => {
    expect(
      await tamperedContext((context) =>
        patchAuthority(context, { previousVersion: 'v-cutover-unnamed' }),
      ),
    ).toEqual({ kind: 'failed', failure: 'committed-seed-incoherent' });
  });

  it('on a committed high-water mark below its own per-key state', async () => {
    expect(
      await tamperedContext((context) =>
        patchAuthority(context, {
          seasonSnapshotObservedAtHighWaterMark: '2026-01-01T00:00:00.000Z',
        }),
      ),
    ).toEqual({ kind: 'failed', failure: 'committed-seed-incoherent' });
  });

  it('on a committed high-water mark below the audited upper bound', async () => {
    const bound = '2030-01-01T00:00:00.000Z';
    expect(
      await tamperedContext(
        (context) =>
          patchAuthority(context, {
            seasonSnapshotObservedAtHighWaterMark: MIGRATION_NOW,
          }),
        checkpointFor({
          historicalFloorEvidence: {
            kind: 'audited-historical-upper-bound',
            auditedUpperBound: bound,
            evidenceReference: EVIDENCE_REFERENCE,
          },
        }),
      ),
    ).toEqual({ kind: 'failed', failure: 'committed-seed-incoherent' });
  });

  it('when the committed seed cannot be retrieved at all', async () => {
    const context = await cutoverContext();
    const clock = new MutableClock(new Date(MIGRATION_NOW));
    const unreachable = new (class extends LocalSeasonPublicationSequencer {
      override async recoverCutoverSeed(): Promise<never> {
        throw new Error('unreachable');
      }
    })(context.coordinator);

    expect(
      await serviceFor(context, clock, { port: unreachable }).seed(
        checkpointFor(),
      ),
    ).toEqual({ kind: 'failed', failure: 'seed-unconfirmed' });
    // Without an answer about existing state, nothing is staged or written.
    expect(legacyReads(context)).toBe(0);
    expect(context.host.committedKeys()).toEqual([]);
  });
});
