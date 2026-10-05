/**
 * `POST /internal/admin/rollback` in coordinated mode (PR-E2; OD-3), through
 * the real Worker entry point, over the real sequencer, guarded sequenced
 * publication and ledger - in process and through both Durable Object
 * clients - with the resolver's answer injected (`vi.mock`).
 *
 * A coordinated rollback runs only while an operator holds the season, and
 * the D14/D15 guard still applies. The hold is placed and released through
 * the operator routes. The scheduled ticks are the injected orchestration
 * (`observeCoordinatedSeason`), because the Worker's scheduled entry point
 * does not run it yet.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker, { type Env } from '../../src/index';
import { CapturingLogger } from '../../src/logging/logger';
import { SequencedPublicationService } from '../../src/publication/sequenced/service';
import type { ReconciliationLedgerPort } from '../../src/sync/coordinated/ledger-port';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import { sequencerTransports } from '../publication/sequenced/support';
import { MutableClock } from '../publication/sequencer/support';
import {
  HOUR,
  ObservationHarness,
  PRE_SEASON,
  SEASON,
  tickAfter,
} from '../sync/coordinated/observation/support';
import { createHarness } from '../support/edge-harness';
import {
  ADMIN_TOKEN,
  OP,
  OperatorLedger,
  PUBLIC_BASE_URL,
  call,
  paths,
} from './reconciliation-support';

const injected = vi.hoisted(() => ({
  ledger: null as null | (() => unknown),
}));

vi.mock('../../src/sync/coordinated/ledger-port', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../src/sync/coordinated/ledger-port')
    >();
  return {
    ...actual,
    resolveReconciliationLedger: () =>
      (injected.ledger?.() ?? null) as ReconciliationLedgerPort | null,
  };
});

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});
const rollback = vi.spyOn(SequencedPublicationService.prototype, 'rollback');

beforeEach(() => {
  globalFetch.mockClear();
  rollback.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  injected.ledger = null;
  vi.unstubAllGlobals();
  expect(globalFetch).not.toHaveBeenCalled();
});

const MINUTE = 60 * 1000;
const later = (at: string, millis: number) =>
  new Date(Date.parse(at) + millis).toISOString();
const FIRST_PUBLICATION = later(PRE_SEASON, HOUR);

describe.each(sequencerTransports)(
  'the coordinated rollback over the %s transport',
  (transport) => {
    async function prePublished() {
      const harness = await ObservationHarness.create({
        transport,
        seed: 'unclassified',
      });
      await harness.run(PRE_SEASON);
      await harness.run(FIRST_PUBLICATION);
      const [release] = harness.releases();
      if (release === undefined) throw new Error('nothing was published');
      injected.ledger = () => harness.freshLedger();
      const logger = new CapturingLogger();
      const env: Env = {
        ENVIRONMENT: 'staging',
        PROVIDER_MODE: 'coordinated',
        PUBLIC_BASE_URL,
        ADMIN_TOKEN,
        SEASON_PUBLICATION_AUTHORITY: 'sequencer',
        SEASON_PUBLICATION_CUTOVER_CONTROL: `activate:${SEASON}`,
        __SEASON_PUBLICATION_SEQUENCER: harness.sequencer,
        __LOCAL_STORAGE: harness.storage,
        __CACHE_PURGER: harness.context.purger,
        __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
        __CLOCK: harness.clock,
        __LOGGER: logger,
        __PROVIDER_RATE_LIMITER: harness.limiter,
        __PROVIDER_TRANSPORT: harness.server.transport,
      };
      return { harness, release, env, logger };
    }

    /** One operator action through the route, at `at`. */
    async function act(
      harness: ObservationHarness,
      env: Env,
      at: string,
      path: string,
      operationId: string,
    ) {
      harness.clock.set(at);
      const read = await call(env, 'GET', paths.inspect(SEASON));
      const version = read.body.data?.seasonRecordVersion as number;
      const answer = await call(env, 'POST', path, {
        season: SEASON,
        expectedSeasonRecordVersion: version,
        operationId,
      });
      expect(answer.status, path).toBe(200);
      return answer;
    }

    async function rollBack(harness: ObservationHarness, env: Env, at: string) {
      harness.clock.set(at);
      return call(env, 'POST', paths.rollback(SEASON), {});
    }

    it('refuses a season that is not held, before the rollback is reached', async () => {
      const { harness, release, env, logger } = await prePublished();

      const answer = await rollBack(
        harness,
        env,
        later(FIRST_PUBLICATION, MINUTE),
      );

      expect(answer.status).toBe(409);
      expect(answer.cacheControl).toBe('no-store');
      expect(answer.body.data).toEqual({
        status: 'publication-not-held',
        season: SEASON,
        rollbackCalls: 0,
        leaseRelease: 'released',
      });
      expect(rollback).not.toHaveBeenCalled();
      expect(harness.activeVersion()).toBe(release);
      expect(
        logger.events.find(
          (event) => event.operation === 'reconciliation.operator-action',
        ),
      ).toMatchObject({
        level: 'warn',
        operatorAction: 'rollback',
        operatorOutcome: 'not-held',
        operatorHoldState: 'not-held',
      });
    });

    it('rolls back a held season, and the hold keeps drift from republishing it until the release', async () => {
      const { harness, release, env } = await prePublished();
      await act(
        harness,
        env,
        later(FIRST_PUBLICATION, MINUTE),
        paths.hold,
        OP[0],
      );

      const answer = await rollBack(
        harness,
        env,
        later(FIRST_PUBLICATION, 2 * MINUTE),
      );

      // The existing answer: the rollback's own result.
      expect(answer.status).toBe(200);
      expect(answer.body.data).toMatchObject({ status: 'applied' });
      expect(rollback).toHaveBeenCalledTimes(1);
      const rolledBack = harness.activeVersion();
      expect(rolledBack).not.toBe(release);

      for (const hours of [2, 3, 4]) {
        const tick = await harness.run(later(PRE_SEASON, hours * HOUR));
        expect(tick.outcome).toMatchObject({ status: 'nothing-due' });
        expect(tick.requests).toEqual([]);
        expect(tick.publishCalls).toBe(0);
        // Every tick raises the hold for the daily review.
        expect(harness.logger.events.at(-1)).toMatchObject({
          level: 'warn',
          operation: 'reconciliation.attention',
          reconciliationAttention: ['operator-hold'],
        });
      }
      expect(harness.activeVersion()).toBe(rolledBack);

      // Releasing is consent to resume: the rolled-back content returns.
      await act(
        harness,
        env,
        later(PRE_SEASON, 5 * HOUR),
        paths.releaseHold,
        OP[1],
      );
      const resumed = await harness.run(later(PRE_SEASON, 6 * HOUR));
      expect(resumed.outcome).toMatchObject({
        publication: { outcome: 'published' },
      });
      expect(harness.activeVersion()).not.toBe(rolledBack);
    });

    it('still enforces D14: a rollback that drops a classified round is refused, and the hold stays', async () => {
      const { harness, env } = await prePublished();
      harness.server.results.set(1, 'A');
      await harness.run(tickAfter(1, 5));
      const classified = harness.activeVersion();
      expect(harness.releases()).toHaveLength(2);
      await act(harness, env, tickAfter(1, 6), paths.hold, OP[0]);

      const answer = await rollBack(harness, env, tickAfter(1, 6));

      expect(answer.status).toBe(409);
      expect(answer.body.data).toMatchObject({
        status: 'rejected',
        reason: 'guard-round-coverage-regression',
      });
      expect(rollback).toHaveBeenCalledTimes(1);
      expect(harness.activeVersion()).toBe(classified);
      expect((await harness.season()).operatorHold).toMatchObject({
        operationId: OP[0],
      });
    });

    it('refuses while a run holds the lease, reaching nothing', async () => {
      const { harness, env } = await prePublished();
      await act(
        harness,
        env,
        later(FIRST_PUBLICATION, MINUTE),
        paths.hold,
        OP[0],
      );
      const running = await harness.freshLedger().acquireLease(SEASON);
      expect(running.outcome).toBe('acquired');

      const answer = await rollBack(
        harness,
        env,
        later(FIRST_PUBLICATION, 2 * MINUTE),
      );

      expect(answer.status).toBe(409);
      expect(answer.body.data).toEqual({
        status: 'run-in-progress',
        season: SEASON,
        rollbackCalls: 0,
      });
      expect(rollback).not.toHaveBeenCalled();
    });
  },
);

describe('the whole-season rollback is unchanged', () => {
  it.each(['mock', 'none'])(
    'under %s it reaches the publisher and never the ledger',
    async (providerMode) => {
      const ledger = new OperatorLedger('local');
      injected.ledger = () => ledger.client();
      const harness = createHarness({ environment: 'staging', providerMode });
      harness.env.PUBLIC_BASE_URL = PUBLIC_BASE_URL;
      const clock = new MutableClock(harness.clock.now());
      harness.env.__CLOCK = clock;
      if (providerMode === 'mock') {
        for (let i = 0; i < 2; i += 1) {
          clock.advance(60 * MINUTE);
          await worker.fetch(
            new Request(`${PUBLIC_BASE_URL}/internal/admin/sync/full`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
            }),
            harness.env,
          );
        }
      }
      const active = await harness.storage.getActiveVersion(SEASON);

      const answer = await call(
        harness.env,
        'POST',
        paths.rollback(SEASON),
        {},
      );

      if (providerMode === 'mock') {
        expect(answer.status).toBe(200);
        expect(answer.body.data).toMatchObject({ status: 'applied' });
        expect(await harness.storage.getActiveVersion(SEASON)).not.toBe(active);
      } else {
        // Nothing was ever published: the existing no-target refusal.
        expect(answer.status).toBe(409);
      }
      expect(ledger.calls).toEqual([]);
      expect(
        harness.logger.events.some((event) =>
          event.operation.startsWith('reconciliation.'),
        ),
      ).toBe(false);
    },
  );
});
