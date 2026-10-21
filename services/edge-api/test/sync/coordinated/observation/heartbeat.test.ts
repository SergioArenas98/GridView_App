/**
 * The heartbeat (ADR 0028 D7): a healthy scheduled run records its instant
 * as the season's `SyncState.lastCompletedAt`, which `GET /v1/status` serves
 * as `lastSuccessfulSyncAt`. Every other run - manual, failed, stopped,
 * blocked - leaves it where it was, so an outside monitor sees it stop.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SnapshotStorage } from '../../../../src/storage/types';
import { COORDINATED_HEARTBEAT_OPERATION } from '../../../../src/sync/coordinated/heartbeat';
import { sequencerTransports } from '../../../publication/sequenced/support';
import { HOUR, ObservationHarness, PRE_SEASON, SEASON } from './support';

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(globalFetch).not.toHaveBeenCalled();
});

const later = (at: string, millis: number) =>
  new Date(Date.parse(at) + millis).toISOString();
const FIRST_PUBLICATION = later(PRE_SEASON, HOUR);

async function lastCompleted(harness: ObservationHarness) {
  return (await harness.storage.getSyncState(SEASON))?.lastCompletedAt ?? null;
}

describe.each(sequencerTransports)(
  'the heartbeat over the %s transport',
  (transport) => {
    const harnessFor = () =>
      ObservationHarness.create({ transport, seed: 'unclassified' });

    it('beats after a scheduled observation, a publication and a nothing-due tick', async () => {
      const harness = await harnessFor();
      await harness.run(PRE_SEASON);
      expect(await lastCompleted(harness)).toBe(PRE_SEASON);

      await harness.run(FIRST_PUBLICATION);
      const state = await harness.storage.getSyncState(SEASON);
      expect(state?.lastCompletedAt).toBe(harness.clock.now().toISOString());
      expect(state?.lastPublicationVersion).toBe(harness.releases()[0]);
      expect(state?.lastPublicationStatus).toBe('applied');

      const idle = later(FIRST_PUBLICATION, HOUR);
      const run = await harness.run(idle);
      expect(run.outcome.status).toBe('nothing-due');
      expect(await lastCompleted(harness)).toBe(idle);
      // A tick that publishes nothing keeps the last publication.
      expect(
        (await harness.storage.getSyncState(SEASON))?.lastPublicationVersion,
      ).toBe(harness.releases()[0]);
    });

    it('does not beat when every check of a run failed', async () => {
      const harness = await harnessFor();
      await harness.run(PRE_SEASON);
      expect(await lastCompleted(harness)).toBe(PRE_SEASON);
      for (const path of [
        '/races/',
        '/circuits/',
        '/drivers/',
        '/constructors/',
        '/driverstandings/',
        '/constructorstandings/',
      ]) {
        harness.server.answers.set(path, () => ({
          kind: 'status',
          status: 503,
        }));
      }
      const run = await harness.run(FIRST_PUBLICATION);
      // Quiet - a provider outage is not GridView's failure - but no beat.
      expect(run.outcome.status).toBe('observed');
      expect(run.requests.length).toBeGreaterThan(0);
      expect(await lastCompleted(harness)).toBe(PRE_SEASON);
    });

    it('never beats for a manual run', async () => {
      const harness = await harnessFor();
      await harness.run(PRE_SEASON, { trigger: 'manual' });
      expect(await lastCompleted(harness)).toBeNull();
    });

    it('does not beat while an operator holds the season', async () => {
      const harness = await harnessFor();
      await harness.run(PRE_SEASON);
      await harness.run(FIRST_PUBLICATION);
      const before = await lastCompleted(harness);

      const at = later(FIRST_PUBLICATION, HOUR);
      harness.clock.set(at);
      const ledger = harness.freshLedger();
      const acquired = await ledger.acquireLease(SEASON);
      if (acquired.outcome !== 'acquired') throw new Error('lease refused');
      const lease = { season: SEASON, fence: acquired.lease.fence };
      const held = await ledger.operate({
        lease,
        action: 'hold',
        operationId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
        authMethod: 'shared-admin-token',
        expectedVersion: acquired.snapshot.seasonRecord?.version ?? 0,
      });
      expect(held.outcome).toBe('applied');
      await ledger.releaseLease(lease);

      await harness.run(later(at, HOUR));
      expect(await lastCompleted(harness)).toBe(before);
    });

    it('does not beat after a failed run', async () => {
      const harness = await ObservationHarness.create({
        transport,
        cutover: 'none',
      });
      const run = await harness.run(PRE_SEASON);
      expect(run.outcome.status).toBe('failed');
      expect(await lastCompleted(harness)).toBeNull();
    });

    it('does not beat while a publication candidate is blocked', async () => {
      const harness = await harnessFor();
      await harness.run(PRE_SEASON);
      // The guarded publication refuses the candidate with a guard reason,
      // which retrying cannot change, so the settlement blocks the season.
      const guardRejects = vi
        .spyOn(harness.service, 'publishGuarded')
        .mockResolvedValue({
          status: 'rejected',
          season: SEASON,
          version: 'v-blocked',
          previousVersion: null,
          reason: 'guard-round-coverage-regression',
        } as never);
      await harness.run(FIRST_PUBLICATION);
      guardRejects.mockRestore();
      expect((await harness.season()).publicationDisposition).toMatchObject({
        state: 'blocked',
      });
      expect(await lastCompleted(harness)).toBe(PRE_SEASON);
    });

    it('keeps the run unchanged when the heartbeat cannot be written', async () => {
      const harness = await harnessFor();
      const failing = Object.create(harness.storage) as SnapshotStorage;
      failing.setSyncState = async () => {
        throw new Error('kv down');
      };
      const run = await harness.run(PRE_SEASON, { storage: failing });
      expect(run.outcome.status).toBe('observed');
      expect(
        harness.logger.events.filter(
          (event) => event.operation === COORDINATED_HEARTBEAT_OPERATION,
        ),
      ).toEqual([
        expect.objectContaining({
          level: 'warn',
          failureCategory: 'heartbeat-write-failed',
        }),
      ]);
      expect(await lastCompleted(harness)).toBeNull();
    });
  },
);
