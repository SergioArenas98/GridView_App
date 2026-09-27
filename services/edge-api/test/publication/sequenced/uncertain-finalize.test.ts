/**
 * A `finalize` whose answer stays uncertain after its one re-drive, reconciled
 * by exactly one authority read (ADR 0025 D4, D9; ADR 0026 D16).
 *
 * The candidate version is allocated to one operation and only that
 * operation's `finalize` can make it active, so an active, authoritative
 * `candidateVersion` proves the commit: the service then completes it through
 * the same post-commit path as a commit whose answer arrived. Every other
 * answer fails closed as `sequencer-authority-unavailable`, runs no
 * post-commit work, deletes nothing and sends nothing more.
 *
 * Each case runs through the real sequenced publication service over both the
 * in-process sequencer and the Durable Object client with a serialized
 * transport; faults are injected where each transport would really lose them.
 */

import { describe, expect, it, vi, type MockInstance } from 'vitest';

import type {
  SeasonAuthority,
  SeasonPublicationSequencerPort,
} from '../../../src/publication/sequencer';
import { SequencedPublicationService } from '../../../src/publication/sequenced/service';
import type { PublicationResult } from '../../../src/publication/publisher';
import { readStoredInventory } from '../../../src/publication/version-inventory';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import {
  SEASON,
  generatedSet,
  portWith,
  recording,
  sequencedContext,
  sequencerTransports,
  type SequencedContext,
  type SequencerTransport,
} from './support';

const LATER_ORDERING = '2026-07-20T00:00:00.000Z';
const OTHER_VERSION = 'v-another-release';

/** What the reconciliation read - any read after the first `finalize` - answers. */
type ReconciliationRead =
  | 'truthful'
  | 'unavailable'
  | 'other-version'
  | 'malformed-flag'
  | 'malformed-shape';

interface Faults {
  /** How many `finalize` answers, from the first, are lost. */
  readonly lostFinalizes: number;
  /** Whether a lost `finalize` still ran on the sequencer before its answer was lost. */
  readonly finalizeRuns: boolean;
  readonly reconciliation: ReconciliationRead;
}

/** `null` loses the read; otherwise the authority record, as returned. */
function rewrite(
  read: ReconciliationRead,
): ((authority: Record<string, unknown>) => unknown) | null {
  switch (read) {
    case 'truthful':
      return (authority) => authority;
    case 'unavailable':
      return null;
    case 'other-version':
      return (authority) => ({ ...authority, activeVersion: OTHER_VERSION });
    case 'malformed-flag':
      // Names the real active version, but `active` without authority is an
      // impossible record: never a confirmation.
      return (authority) => ({ ...authority, authoritative: false });
    case 'malformed-shape':
      return () => ({ cutoverState: 'active', authoritative: true });
  }
}

interface Faulty {
  readonly port: SeasonPublicationSequencerPort;
  /** Every port method the service called, in order. */
  readonly calls: string[];
  /** Authority reads after the first `finalize`. */
  readonly reconciliationReads: () => number;
}

interface Effects {
  readonly currentSeason: MockInstance;
  readonly contentMetadata: MockInstance;
  readonly purge: MockInstance;
  readonly deleteVersion: MockInstance;
  readonly deleteSidecar: MockInstance;
}

function watchEffects(ctx: SequencedContext): Effects {
  return {
    currentSeason: vi.spyOn(ctx.storage, 'setCurrentSeason'),
    contentMetadata: vi.spyOn(ctx.storage, 'setContentMetadata'),
    purge: vi.spyOn(ctx.purger, 'purgePublicUrls'),
    deleteVersion: vi.spyOn(ctx.storage, 'deleteUnpublishedVersion'),
    deleteSidecar: vi.spyOn(ctx.storage, 'deletePublicationMetadata'),
  };
}

function serviceWith(
  ctx: SequencedContext,
  port: SeasonPublicationSequencerPort,
): SequencedPublicationService {
  return new SequencedPublicationService({
    port,
    fallback: ctx.legacy,
    storage: ctx.storage,
    validator: runtimeSnapshotValidator,
    purger: ctx.purger,
    logger: ctx.logger,
    clock: ctx.clock,
    purgeOrigin: 'https://api.gridview.local',
  });
}

/** Ground truth, from the coordinator's own state - never through a fault. */
async function activeVersion(ctx: SequencedContext): Promise<string> {
  const authority = await ctx.coordinator.readAuthority(SEASON);
  if (authority.cutoverState !== 'active') throw new Error('not active');
  return authority.activeVersion;
}

function operationsLogged(ctx: SequencedContext): unknown[] {
  return ctx.logger.events.map((event) => event.operation);
}

/**
 * The two operations that run the two-phase protocol. `setUp` brings the
 * context to where the operation starts; `run` is the operation itself.
 */
interface Operation {
  readonly setUp: (ctx: SequencedContext) => Promise<void>;
  readonly run: (
    service: SequencedPublicationService,
    ctx: SequencedContext,
  ) => Promise<PublicationResult>;
  readonly movesSeasonPointer: boolean;
}

function laterSet(ctx: SequencedContext) {
  return generatedSet(ctx.clock, 'ignored-by-sequencer', {
    sourceUpdatedAt: LATER_ORDERING,
    contentVersion: '2026.07.20.2',
  });
}

const operations: Record<string, Operation> = {
  'ordinary publication': {
    setUp: async () => {},
    run: async (service, ctx) => service.publish(await laterSet(ctx)),
    movesSeasonPointer: true,
  },
  // Publishes a release first, so the rollback republishes the seed over it.
  'rollback-republication': {
    setUp: async (ctx) => {
      const published = await ctx.service.publish(await laterSet(ctx));
      if (published.status !== 'applied') {
        throw new Error(`set-up publish: ${JSON.stringify(published)}`);
      }
    },
    run: (service) => service.rollback(SEASON),
    movesSeasonPointer: false,
  },
};

const operationNames = Object.keys(operations);

describe.each(sequencerTransports)(
  'an uncertain finalize over the %s transport',
  (transport: SequencerTransport) => {
    const context = () => sequencedContext({ transport });

    /** Installs the faults at the layer this transport would lose them. */
    function faulty(ctx: SequencedContext, faults: Faults): Faulty {
      let finalizes = 0;
      let reconciliationReads = 0;
      const answer = rewrite(faults.reconciliation);

      let port: SeasonPublicationSequencerPort;
      if (transport === 'durable-object') {
        ctx.transport!.intercept = async (command, run) => {
          if (command === 'finalize') {
            finalizes += 1;
            if (finalizes > faults.lostFinalizes) return run();
            if (faults.finalizeRuns) await run();
            throw new Error('finalize answer lost');
          }
          if (command === 'read-authority' && finalizes > 0) {
            reconciliationReads += 1;
            if (answer === null) throw new Error('authority read lost');
            const response = await run();
            const body = (await response.json()) as Record<string, unknown>;
            return new Response(JSON.stringify(answer(body)), {
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return run();
        };
        port = ctx.port;
      } else {
        port = portWith(ctx.port, {
          finalize: async (request) => {
            finalizes += 1;
            if (finalizes > faults.lostFinalizes) {
              return ctx.port.finalize(request);
            }
            if (faults.finalizeRuns) await ctx.port.finalize(request);
            throw new Error('finalize answer lost');
          },
          readAuthority: async (season) => {
            if (finalizes === 0) return ctx.port.readAuthority(season);
            reconciliationReads += 1;
            if (answer === null) throw new Error('authority read lost');
            const authority = await ctx.port.readAuthority(season);
            return answer({ ...authority }) as SeasonAuthority;
          },
        });
      }
      const recorded = recording(port);
      return {
        port: recorded.port,
        calls: recorded.calls,
        reconciliationReads: () => reconciliationReads,
      };
    }

    /** Post-commit work, counted exactly. */
    function expectPostCommitOnce(effects: Effects, operation: Operation) {
      const pointerWrites = operation.movesSeasonPointer ? 1 : 0;
      expect(effects.currentSeason).toHaveBeenCalledTimes(pointerWrites);
      expect(effects.contentMetadata).toHaveBeenCalledTimes(pointerWrites);
      expect(effects.purge).toHaveBeenCalledTimes(1);
    }

    function expectNoCleanup(effects: Effects, calls: readonly string[]) {
      expect(effects.deleteVersion).not.toHaveBeenCalled();
      expect(effects.deleteSidecar).not.toHaveBeenCalled();
      expect(calls).not.toContain('cancel');
      expect(calls).not.toContain('authorizeCleanup');
      expect(calls).not.toContain('acknowledgeCleanup');
    }

    describe.each(operationNames)('%s', (name) => {
      const operation = operations[name]!;

      it('completes a commit the authority confirms exactly like one whose answer arrived', async () => {
        // The same operation twice, from identical deterministic contexts:
        // once with every answer delivered, once with both finalize answers
        // lost after the sequencer committed.
        const direct = await context();
        await operation.setUp(direct);
        const observed = faulty(direct, {
          lostFinalizes: 0,
          finalizeRuns: true,
          reconciliation: 'truthful',
        });
        const directEffects = watchEffects(direct);
        const directResult = await operation.run(
          serviceWith(direct, observed.port),
          direct,
        );

        const ctx = await context();
        await operation.setUp(ctx);
        const predecessor = await activeVersion(ctx);
        const lost = faulty(ctx, {
          lostFinalizes: 2,
          finalizeRuns: true,
          reconciliation: 'truthful',
        });
        const effects = watchEffects(ctx);
        ctx.logger.events.length = 0;

        const result = await operation.run(serviceWith(ctx, lost.port), ctx);

        expect(result).toMatchObject({
          status: 'applied',
          previousVersion: predecessor,
          reason: null,
          cachePurge: 'succeeded',
        });
        expect(result).toEqual(directResult);
        expect(await activeVersion(ctx)).toBe(result.version);

        // Two finalize calls, then exactly one authority read - no third
        // finalize, no second prepare.
        expect(lost.calls).toEqual([
          'readAuthority',
          'prepare',
          'finalize',
          'finalize',
          'readAuthority',
        ]);
        expect(lost.reconciliationReads()).toBe(1);

        // The same post-commit work, run once, with the same arguments.
        expectPostCommitOnce(effects, operation);
        expectPostCommitOnce(directEffects, operation);
        expect(effects.currentSeason.mock.calls).toEqual(
          directEffects.currentSeason.mock.calls,
        );
        expect(effects.contentMetadata.mock.calls).toEqual(
          directEffects.contentMetadata.mock.calls,
        );
        expect(effects.purge.mock.calls).toEqual(
          directEffects.purge.mock.calls,
        );
        expect(await ctx.storage.getCurrentSeason()).toBe(
          await direct.storage.getCurrentSeason(),
        );
        expect(await ctx.storage.getContentMetadata()).toEqual(
          await direct.storage.getContentMetadata(),
        );

        // The committed release is kept.
        expectNoCleanup(effects, lost.calls);
        expect(await ctx.storage.listVersions(SEASON)).toContain(
          result.version,
        );

        const logged = operationsLogged(ctx);
        expect(logged).toContain('publication.sequencer.finalize_reconciled');
        expect(logged).toContain('publication.sequencer.committed');
        expect(logged).not.toContain(
          'publication.sequencer.finalize_unavailable',
        );
      });

      const unconfirmed: Array<[string, Faults]> = [
        [
          'the authority read is unavailable',
          {
            lostFinalizes: 2,
            finalizeRuns: true,
            reconciliation: 'unavailable',
          },
        ],
        [
          'the predecessor is still active',
          { lostFinalizes: 2, finalizeRuns: false, reconciliation: 'truthful' },
        ],
        [
          'another version is active',
          {
            lostFinalizes: 2,
            finalizeRuns: false,
            reconciliation: 'other-version',
          },
        ],
        [
          'the authority record is active but not authoritative',
          {
            lostFinalizes: 2,
            finalizeRuns: true,
            reconciliation: 'malformed-flag',
          },
        ],
        [
          'the authority record is malformed',
          {
            lostFinalizes: 2,
            finalizeRuns: true,
            reconciliation: 'malformed-shape',
          },
        ],
      ];

      it.each(unconfirmed)('fails closed when %s', async (_label, faults) => {
        const ctx = await context();
        await operation.setUp(ctx);
        const predecessor = await activeVersion(ctx);
        const lost = faulty(ctx, faults);
        const effects = watchEffects(ctx);
        ctx.logger.events.length = 0;

        const result = await operation.run(serviceWith(ctx, lost.port), ctx);

        expect(result).toMatchObject({
          status: 'failed',
          reason: 'sequencer-authority-unavailable',
          previousVersion: predecessor,
          cachePurge: 'not-required',
          pointerMaintenance: 'not-required',
          purgedUrls: [],
        });
        expect(lost.calls).toEqual([
          'readAuthority',
          'prepare',
          'finalize',
          'finalize',
          'readAuthority',
        ]);
        expect(lost.reconciliationReads()).toBe(1);

        // No post-commit work and no cleanup: the candidate stays whole.
        expect(effects.currentSeason).not.toHaveBeenCalled();
        expect(effects.contentMetadata).not.toHaveBeenCalled();
        expect(effects.purge).not.toHaveBeenCalled();
        expectNoCleanup(effects, lost.calls);
        expect(await ctx.storage.listVersions(SEASON)).toContain(
          result.version,
        );
        expect(
          await readStoredInventory(ctx.storage, SEASON, result.version),
        ).toMatchObject({ kind: 'documents' });

        // Whatever actually committed is what the sequencer serves.
        expect(await activeVersion(ctx)).toBe(
          faults.finalizeRuns ? result.version : predecessor,
        );

        const logged = operationsLogged(ctx);
        expect(logged).toContain('publication.sequencer.finalize_unavailable');
        expect(logged).not.toContain(
          'publication.sequencer.finalize_reconciled',
        );
        expect(logged).not.toContain('publication.sequencer.committed');
      });

      it('runs the post-commit work once for a directly observed commit, with no reconciliation read', async () => {
        const ctx = await context();
        await operation.setUp(ctx);
        const observed = faulty(ctx, {
          lostFinalizes: 0,
          finalizeRuns: true,
          reconciliation: 'truthful',
        });
        const effects = watchEffects(ctx);

        const result = await operation.run(
          serviceWith(ctx, observed.port),
          ctx,
        );

        expect(result.status).toBe('applied');
        expect(observed.calls).toEqual([
          'readAuthority',
          'prepare',
          'finalize',
        ]);
        expect(observed.reconciliationReads()).toBe(0);
        expectPostCommitOnce(effects, operation);
        expectNoCleanup(effects, observed.calls);
      });

      it('accepts a replayed commit on the re-drive without reading the authority', async () => {
        const ctx = await context();
        await operation.setUp(ctx);
        const replayed = faulty(ctx, {
          lostFinalizes: 1,
          finalizeRuns: true,
          reconciliation: 'truthful',
        });
        const effects = watchEffects(ctx);

        const result = await operation.run(
          serviceWith(ctx, replayed.port),
          ctx,
        );

        expect(result.status).toBe('applied');
        expect(await activeVersion(ctx)).toBe(result.version);
        expect(replayed.calls).toEqual([
          'readAuthority',
          'prepare',
          'finalize',
          'finalize',
        ]);
        expect(replayed.reconciliationReads()).toBe(0);
        expectPostCommitOnce(effects, operation);
        expectNoCleanup(effects, replayed.calls);
      });
    });
  },
);
