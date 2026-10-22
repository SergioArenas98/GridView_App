/**
 * The coordinated orchestration over a `genesis` season (ADR 0025 D12,
 * "Amendment (2026-10-20)"; ADR 0028 D3): a season the sequencer holds
 * authoritative with no release, as production does after its one genesis
 * request.
 *
 * Such a season has nothing to reconcile and nothing to recover against, so
 * the run plans from the ledger alone and its first publication binds the
 * empty predecessor the authority itself reports. That is how production's
 * first release is published automatically, with no capture or submission.
 * A season that is merely `uninitialized` or `seeded` is still refused.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe.each(sequencerTransports)(
  'a genesis season over the %s transport',
  (transport) => {
    const genesis = () =>
      ObservationHarness.create({ transport, cutover: 'genesis' });

    it('bootstraps from the ledger alone: nothing to reconcile', async () => {
      const harness = await genesis();
      const run = await harness.run(PRE_SEASON);

      expect(run.outcome).toMatchObject({
        status: 'observed',
        plan: 'observation',
        coordination: 'completed',
      });
      expect(run.requests).toEqual(['/races/']);
      expect(run.publishCalls).toBe(0);
      // No release exists, so no published revision can be cached.
      expect(run.ledgerCalls).not.toContain('reconcilePublishedRevisions');
      expect(harness.activeVersion()).toBeNull();
    });

    it('publishes the first release against the empty predecessor', async () => {
      const harness = await genesis();
      await harness.run(PRE_SEASON);
      const run = await harness.run(FIRST_PUBLICATION);

      expect(run.outcome).toMatchObject({
        status: 'observed',
        plan: 'publication',
        publication: { outcome: 'published' },
      });
      expect(run.publishCalls).toBe(1);
      const [release] = harness.releases();
      expect(release).toBeDefined();
      expect(harness.activeVersion()).toBe(release);
      const authority = harness.context.coordinator.readAuthority(SEASON);
      expect(authority).toMatchObject({
        cutoverState: 'active',
        activeVersion: release,
        previousVersion: null,
      });
      expect((await harness.season()).lastPublication).toMatchObject({
        activeVersion: release,
      });
    });

    it('then runs as an active season: the next tick reconciles and changes nothing', async () => {
      const harness = await genesis();
      await harness.run(PRE_SEASON);
      await harness.run(FIRST_PUBLICATION);
      const [release] = harness.releases();

      const run = await harness.run(later(FIRST_PUBLICATION, HOUR));
      expect(run.outcome.status).toBe('nothing-due');
      expect(run.ledgerCalls).toContain('reconcilePublishedRevisions');
      expect(harness.releases()).toEqual([release]);
    });

    it('recovers a publication whose answer was lost before any release existed', async () => {
      const harness = await genesis();
      await harness.run(PRE_SEASON);
      // The guarded publication never answers: the run dies after its
      // reservation, leaving the season `publishing` with no release.
      harness.onPublish = () => {
        throw new Error('lost before prepare');
      };
      await expect(harness.run(FIRST_PUBLICATION)).rejects.toThrow(
        'lost before prepare',
      );
      expect((await harness.season()).publicationDisposition).toMatchObject({
        state: 'publishing',
      });
      expect(harness.activeVersion()).toBeNull();

      harness.onPublish = () => {};
      const run = await harness.run(later(FIRST_PUBLICATION, HOUR));
      expect(run.outcome).toMatchObject({
        status: 'observed',
        publication: { outcome: 'published' },
      });
      expect(harness.releases()).toHaveLength(1);
      expect((await harness.season()).publicationDisposition).toBeNull();
    });

    it.each(['none', 'seeded'] as const)(
      'still refuses a season that is %s',
      async (cutover) => {
        const harness = await ObservationHarness.create({
          transport,
          cutover,
        });
        const run = await harness.run(PRE_SEASON);
        expect(run.outcome).toMatchObject({
          status: 'failed',
          stage: 'authority',
          failure: 'authority-not-authoritative',
          providerRequests: 0,
        });
        expect(run.requests).toEqual([]);
      },
    );
  },
);
