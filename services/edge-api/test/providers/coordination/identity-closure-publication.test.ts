/**
 * U10: complete guarded publication under the explicit optional-driver
 * inventory policy (design §8.4, ADR 0030 D3-D4; matrix T23, T24, T25, T30,
 * T31). Real optional-mode coordinator, assembly and closure, generator, and
 * the real `SequencedPublicationService` over both sequencer transports; the
 * predecessor is a guard only. Synthetic data; no port reaches a network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SeasonDriverSummary } from '../../../src/contract/types';
import { CoordinatedSeasonPublication } from '../../../src/providers/coordination';
import type { SeasonIdentityContext } from '../../../src/providers/coordination/season-identity-closure';
import { SequencedPublicationService } from '../../../src/publication/sequenced/service';
import type {
  PrepareOutcome,
  SeasonPublicationSequencerPort,
} from '../../../src/publication/sequencer';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import {
  SEED_VERSION,
  portWith,
  sequencerTransports,
  type SequencerTransport,
} from '../../publication/sequenced/support';
import { FIXED_NOW, SEASON, metadataFor, publicationHarness } from './support';
import {
  FIRST_AT,
  SECOND_AT,
  policy,
  splitSeason,
  withRows,
  profilesOf,
  coordinateOptional,
  identityFor,
  without,
  expectNoPrivateLeak,
  resultOf,
  strictAssembled,
  publishOptional,
  storedDocuments,
  expectUnchanged,
} from './identity-closure-support';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('U10 network forbidden');
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

// ---------------------------------------------------------------------------
// Complete guarded publication (T23, T25, T30, T31)
// ---------------------------------------------------------------------------

describe.each(sequencerTransports)(
  'U10 optional-policy guarded publication over the %s sequencer transport',
  (transport: SequencerTransport) => {
    async function harnessFor(predecessor: readonly number[]) {
      return publicationHarness({
        transport,
        seedSource: await strictAssembled(await splitSeason(predecessor)),
      });
    }

    it('T23 positive: commits a complete season with unknown inventory-only drivers and no private field', async () => {
      const harness = await harnessFor([1, 11, 12]);
      const result = resultOf(
        await publishOptional(harness, await splitSeason()),
      );
      expect(result).toMatchObject({
        status: 'applied',
        previousVersion: SEED_VERSION,
        reason: null,
      });
      expect(harness.publishCalls).toBe(1);
      expect(harness.legacyPublishCalls).toBe(0);
      expect(harness.activeVersion()).toBe(result.version);
      const documents = await storedDocuments(harness, result.version);
      expect(documents.length).toBeGreaterThan(0);
      await expectNoPrivateLeak(documents);
      await expectNoPrivateLeak(harness.handed[0]!.set);
      expect(harness.logger.serialized()).not.toContain('driverInventory');
    });

    it('T25 positive: publishes the supplemented debutant profile with its result-derived spans', async () => {
      const harness = await harnessFor([1, 11, 12]);
      const source = await splitSeason();
      const result = resultOf(
        await publishOptional(harness, source, {
          inventory: without(source, 'yuki-tsunoda'),
        }),
      );
      expect(result.status).toBe('applied');
      const drivers = (await harness.activeDocument('drivers'))!
        .data as SeasonDriverSummary[];
      expect(drivers.some((d) => d.driverId === 'yuki-tsunoda')).toBe(true);
      const profileDoc = await harness.activeDocument(
        'driver:yuki-tsunoda' as never,
      );
      expect(profileDoc).not.toBeNull();
    });

    it('T24/T25 negative: an unknown debutant withholds before publication and keeps the release', async () => {
      const harness = await harnessFor([1, 11, 12]);
      const before = await storedDocuments(harness, SEED_VERSION);
      const outcome = await publishOptional(harness, await splitSeason(), {
        failing: (kind, round) =>
          kind === 'session-classification' && round === 13,
      });
      expect(outcome).toMatchObject({
        outcome: 'withheld',
        gap: 'resource-unavailable',
      });
      expect(harness.publishCalls).toBe(0);
      await expectUnchanged(harness, SEED_VERSION, before);
    });

    it('missing pinned profile withholds as inconsistent-references with zero publication calls', async () => {
      const harness = await harnessFor([1, 11, 12]);
      const before = await storedDocuments(harness, SEED_VERSION);
      const source = await splitSeason();
      const outcome = await publishOptional(
        harness,
        source,
        { inventory: without(source, 'yuki-tsunoda') },
        FIRST_AT,
        {
          policy,
          profiles: profilesOf(source.drivers, { missing: ['yuki-tsunoda'] }),
        },
      );
      expect(outcome).toMatchObject({
        outcome: 'withheld',
        gap: 'inconsistent-references',
        relations: ['required-driver-profile'],
      });
      expect(harness.publishCalls).toBe(0);
      await expectUnchanged(harness, SEED_VERSION, before);
    });

    it('T30 D14: an optional candidate missing a published classified round is rejected', async () => {
      const harness = await harnessFor([1, 11, 12, 13]);
      const before = await storedDocuments(harness, SEED_VERSION);
      const result = resultOf(
        await publishOptional(harness, await splitSeason([1, 11, 12])),
      );
      expect(result).toMatchObject({
        status: 'rejected',
        reason: 'guard-round-coverage-regression',
      });
      await expectUnchanged(harness, SEED_VERSION, before);
    });

    it('T30 D15: a removed participation fact or replaced constructor is rejected', async () => {
      for (const [candidate, reason] of [
        [
          withRows(await splitSeason(), 12, (rows) =>
            rows.filter((r) => r.driverId !== 'yuki-tsunoda'),
          ),
          'guard-participation-fact-removed',
        ],
        [
          withRows(await splitSeason(), 13, (rows) =>
            rows.map((r) =>
              r.driverId === 'liam-lawson'
                ? { ...r, constructorId: 'racing-bulls' }
                : r,
            ),
          ),
          'guard-constructor-replaced',
        ],
      ] as const) {
        const harness = await harnessFor([1, 11, 12, 13]);
        const before = await storedDocuments(harness, SEED_VERSION);
        const result = resultOf(await publishOptional(harness, candidate));
        expect(result).toMatchObject({ status: 'rejected', reason });
        await expectUnchanged(harness, SEED_VERSION, before);
      }
    });

    it('T31: a narrower optional candidate never replaces a wider committed release', async () => {
      const harness = await harnessFor([1, 11, 12]);
      const wide = resultOf(
        await publishOptional(harness, await splitSeason()),
      );
      expect(wide.status).toBe('applied');
      const before = await storedDocuments(harness, wide.version);
      const narrow = resultOf(
        await publishOptional(
          harness,
          await splitSeason([1, 11, 12]),
          {},
          SECOND_AT,
        ),
      );
      expect(narrow).toMatchObject({
        status: 'rejected',
        reason: 'guard-round-coverage-regression',
        previousVersion: wide.version,
      });
      await expectUnchanged(harness, wide.version, before);
    });

    it('T31 D16: a loser preparing after the winner committed is refused by expected-predecessor CAS', async () => {
      const harness = await harnessFor([1, 11, 12]);
      const { context } = harness;
      let hold: (() => void) | null = null;
      let arrived!: () => void;
      const narrowArrived = new Promise<void>((r) => (arrived = r));
      const outcomes: PrepareOutcome[] = [];
      const port: SeasonPublicationSequencerPort = portWith(context.port, {
        prepare: async (request) => {
          if (request.sourceOrderingInput === SECOND_AT) {
            await new Promise<void>((release) => {
              hold = release;
              arrived();
            });
          }
          const outcome = await context.port.prepare(request);
          outcomes.push(outcome);
          return outcome;
        },
      });
      const service = new SequencedPublicationService({
        port,
        fallback: context.legacy,
        storage: context.storage,
        validator: runtimeSnapshotValidator,
        purger: context.purger,
        logger: context.logger,
        clock: context.clock,
      });
      const bridge = (identity: SeasonIdentityContext) =>
        new CoordinatedSeasonPublication({
          commands: service,
          logger: harness.logger,
          identity,
        });
      const narrowSource = await splitSeason([1, 11, 12]);
      const wideSource = await splitSeason();
      // The narrower run reads the seed predecessor, then waits at prepare.
      const narrow = bridge(identityFor(narrowSource)).publish(
        await coordinateOptional(narrowSource),
        { ...metadataFor(narrowSource), sourceUpdatedAt: SECOND_AT },
        FIXED_NOW,
        'narrow',
      );
      await narrowArrived;
      const wide = resultOf(
        await bridge(identityFor(wideSource)).publish(
          await coordinateOptional(wideSource),
          { ...metadataFor(wideSource), sourceUpdatedAt: FIRST_AT },
          FIXED_NOW,
          'wide',
        ),
      );
      expect(wide.status).toBe('applied');
      hold!();
      const loser = resultOf(await narrow);
      // The established D16 answer: a failed prepare, nothing written.
      expect(loser).toMatchObject({
        status: 'failed',
        reason: 'guard-predecessor-stale',
      });
      expect(outcomes.at(-1)).toMatchObject({
        outcome: 'rejected',
        reason: 'stale-predecessor',
      });
      expect(harness.activeVersion()).toBe(wide.version);
      expect(await harness.storage.listVersions(SEASON)).toEqual(
        [SEED_VERSION, wide.version].sort(),
      );
    });
  },
);
