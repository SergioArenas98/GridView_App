/**
 * D16 through coordination: overlapping coordinated runs against the same
 * authoritative predecessor (ADR 0026 D16, D12 item 13).
 *
 * Two runs of the real bridge share one real `SequencedPublicationService`. A
 * wider candidate classifies round 13; a narrower one does not. A barrier holds
 * each run at the boundary between its authority read (and the D14/D15
 * comparison that read feeds) and `prepare`, so both are compared against the
 * same predecessor before either can commit. Then:
 *
 * - **Both prepare before either commits.** The first valid `prepare` wins and
 *   the other is refused as `operation-in-progress`.
 * - **The loser prepares after the winner committed.** Its expected
 *   predecessor is no longer the active release, so it is refused as
 *   `guard-predecessor-stale`.
 *
 * Whichever wins, a narrower candidate never replaces the wider release: once
 * the wider one is active, rerunning the narrower one fails D14. Every case
 * runs over the in-process sequencer and the Durable Object client.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
} from '../../../src/providers/coordination';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { readPredecessorGuard } from '../../../src/publication/guard/predecessor';
import type { PublicationResult } from '../../../src/publication/publisher';
import { SequencedPublicationService } from '../../../src/publication/sequenced/service';
import type {
  PrepareOutcome,
  PrepareRequest,
  SeasonPublicationSequencerPort,
} from '../../../src/publication/sequencer';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import {
  SEED_VERSION,
  portWith,
  sequencerTransports,
  type SequencerTransport,
} from '../../publication/sequenced/support';
import {
  FIXED_NOW,
  SEASON,
  completePort,
  fullPlan,
  metadataFor,
  publicationHarness,
  seasonFixture,
  type PublicationHarness,
} from './support';
import { splitSeasonFixture } from './split-participation-support';

const WIDE_AT = '2026-07-18T12:00:00.000Z';
/** Later than the wider candidate, so ordering is never why it loses. */
const NARROW_AT = '2026-07-18T12:30:00.000Z';
const RERUN_AT = '2026-07-18T13:00:00.000Z';

type Label = 'wide' | 'narrow';

async function splitSeason(
  classified: readonly number[],
): Promise<ProviderSeasonSource> {
  const split = await splitSeasonFixture();
  const mock = await seasonFixture();
  const kept = new Set(classified);
  return {
    ...split,
    calendar: split.calendar.map((event, index) =>
      kept.has(event.round)
        ? event
        : { ...event, status: mock.calendar[index]!.status, hasResults: false },
    ),
    results: split.results.map((result) =>
      kept.has(result.round)
        ? result
        : { ...result, status: 'unavailable' as const, entries: [] },
    ),
  };
}

function coordinate(source: ProviderSeasonSource) {
  return new MultiSourceCoordinator({
    ports: [completePort('jolpica', source)],
    logger: new CapturingLogger(),
  }).coordinate({ plan: fullPlan(source) });
}

async function assembled(
  source: ProviderSeasonSource,
): Promise<ProviderSeasonSource> {
  const assembly = assembleSeasonSource(
    await coordinate(source),
    metadataFor(source),
  );
  if (!assembly.complete) throw new Error(`no assembly: ${assembly.gap}`);
  return assembly.source;
}

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/**
 * The expected-predecessor binding a `prepare` request carries, exactly as the
 * service built it. The overlapping-run tests pass it through unchanged.
 */
function bindPredecessor(request: PrepareRequest): PrepareRequest {
  return request;
}

/**
 * A port that holds each labelled run at `prepare` until the test releases it.
 * A request whose ordering input is not labelled - a rerun - passes straight
 * through.
 */
function barrierPort(
  inner: SeasonPublicationSequencerPort,
  labels: ReadonlyMap<string, Label>,
) {
  const held = new Map<Label, Deferred>();
  const prepared = new Map<Label, Deferred>();
  const outcomes = new Map<Label, PrepareOutcome>();
  const bothArrived = deferred();
  const port = portWith(inner, {
    prepare: async (request) => {
      const label = labels.get(request.sourceOrderingInput);
      if (label === undefined) return inner.prepare(request);
      const release = deferred();
      held.set(label, release);
      prepared.set(label, deferred());
      if (held.size === labels.size) bothArrived.resolve();
      await release.promise;
      const outcome = await inner.prepare(bindPredecessor(request));
      outcomes.set(label, outcome);
      prepared.get(label)!.resolve();
      return outcome;
    },
  });
  return {
    port,
    bothArrived: bothArrived.promise,
    release: (label: Label) => held.get(label)!.resolve(),
    prepared: (label: Label) => prepared.get(label)!.promise,
    outcome: (label: Label) => outcomes.get(label),
  };
}

async function roundsOf(
  harness: PublicationHarness,
  version: string,
): Promise<number[]> {
  const read = await readPredecessorGuard(harness.storage, SEASON, version);
  if (read.kind !== 'read') throw new Error(read.kind);
  return [...read.guard.classifiedRounds];
}

describe.each(sequencerTransports)(
  'overlapping coordinated runs over the %s sequencer transport',
  (transport: SequencerTransport) => {
    async function overlap(
      winner: Label,
      loserPrepares: 'before-commit' | 'after-commit',
    ) {
      const harness = await publicationHarness({
        transport,
        seedSource: await assembled(await splitSeason([1, 11, 12])),
      });
      const { context } = harness;
      const barrier = barrierPort(
        context.port,
        new Map<string, Label>([
          [WIDE_AT, 'wide'],
          [NARROW_AT, 'narrow'],
        ]),
      );
      const service = new SequencedPublicationService({
        port: barrier.port,
        fallback: context.legacy,
        storage: context.storage,
        validator: runtimeSnapshotValidator,
        purger: context.purger,
        logger: context.logger,
        clock: context.clock,
      });
      const bridge = new CoordinatedSeasonPublication({
        commands: service,
        logger: harness.logger,
      });
      const sources = {
        wide: await splitSeason([1, 11, 12, 13]),
        narrow: await splitSeason([1, 11, 12]),
      };
      const at = { wide: WIDE_AT, narrow: NARROW_AT };
      const run = async (label: Label, sourceUpdatedAt = at[label]) => {
        const outcome = await bridge.publish(
          await coordinate(sources[label]),
          { ...metadataFor(sources[label]), sourceUpdatedAt },
          FIXED_NOW,
          `caller-${label}`,
        );
        if (outcome.outcome !== 'published') {
          throw new Error(`withheld: ${outcome.gap}`);
        }
        return outcome.result;
      };

      const loser: Label = winner === 'wide' ? 'narrow' : 'wide';
      const pending = { wide: run('wide'), narrow: run('narrow') };
      await barrier.bothArrived;
      // Both runs compared against the seed; neither has prepared yet.
      expect(harness.activeVersion()).toBe(SEED_VERSION);

      barrier.release(winner);
      await barrier.prepared(winner);
      let winnerResult: PublicationResult;
      if (loserPrepares === 'before-commit') {
        barrier.release(loser);
        winnerResult = await pending[winner];
      } else {
        winnerResult = await pending[winner];
        barrier.release(loser);
      }
      const loserResult = await pending[loser];

      return {
        harness,
        barrier,
        loser,
        winnerResult,
        loserResult,
        rerun: (label: Label) => run(label, RERUN_AT),
      };
    }

    for (const winner of ['wide', 'narrow'] as const) {
      for (const loserPrepares of ['before-commit', 'after-commit'] as const) {
        it(`${winner} wins; the loser prepares ${loserPrepares}`, async () => {
          const { harness, barrier, loser, winnerResult, loserResult, rerun } =
            await overlap(winner, loserPrepares);

          // The first valid prepare won and committed.
          expect(winnerResult.status).toBe('applied');
          expect(winnerResult.previousVersion).toBe(SEED_VERSION);
          expect(harness.activeVersion()).toBe(winnerResult.version);

          // The other run was refused without writing anything.
          expect(loserResult.status).toBe('failed');
          if (loserPrepares === 'before-commit') {
            expect(barrier.outcome(loser)).toMatchObject({
              outcome: 'rejected',
              reason: 'operation-in-progress',
            });
            expect(loserResult.reason).toBe('sequencer-prepare-rejected');
            expect(
              harness.logger.events.some(
                (event) =>
                  event.operation === 'publication.sequencer.rejected' &&
                  event.failureCategory === 'operation-in-progress',
              ),
            ).toBe(true);
          } else {
            expect(barrier.outcome(loser)).toMatchObject({
              outcome: 'rejected',
              reason: 'stale-predecessor',
            });
            expect(loserResult.reason).toBe('guard-predecessor-stale');
          }
          expect(await harness.storage.listVersions(SEASON)).toEqual(
            [SEED_VERSION, winnerResult.version].sort(),
          );

          if (winner === 'wide') {
            // The narrower candidate, rerun against the wider release, now
            // fails D14 and can never replace it.
            const narrow = await rerun('narrow');
            expect(narrow).toMatchObject({
              status: 'rejected',
              reason: 'guard-round-coverage-regression',
              previousVersion: winnerResult.version,
            });
          } else {
            // The narrower release was valid against the seed; the wider
            // candidate, rerun, contains it and replaces it.
            const wide = await rerun('wide');
            expect(wide.status).toBe('applied');
            expect(wide.previousVersion).toBe(winnerResult.version);
          }

          // Safety: whichever order, the wider release is what serves, and no
          // narrower release was ever committed on top of it.
          const active = harness.activeVersion();
          expect(active).not.toBeNull();
          expect(await roundsOf(harness, active!)).toEqual([1, 11, 12, 13]);
          expect(harness.legacyPublishCalls).toBe(0);
          const serialized = harness.logger.serialized();
          expect(serialized).not.toContain('sha256:');
          expect(serialized).not.toContain('yuki-tsunoda');
        });
      }
    }
  },
);
