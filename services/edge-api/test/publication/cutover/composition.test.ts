/**
 * Admission closure and the read path, through the real Worker composition
 * (ADR 0025 D12 step 1).
 *
 * The two facts a real staging cutover depends on, proven end to end rather
 * than at the decorator alone:
 *
 * - while a season is paused, **its** publication and rollback are refused
 *   before any publisher runs, every other season keeps working, and the
 *   operator cache purge stays available;
 * - **reads keep being served through the legacy authority** for the whole
 *   pre-activation interval, because `uninitialized` and `seeded` are both
 *   states in which legacy pointers remain the declared authority.
 */

import { describe, expect, it } from 'vitest';

import worker, { type Env } from '../../../src/index';
import {
  adminRequest,
  createHarness,
  request,
  seedPublishedSnapshot,
  type EdgeHarness,
} from '../../support/edge-harness';
import { OTHER_SEASON, SEASON, immediateRetry, inProcessPort } from './support';

function pausedEnv(harness: EdgeHarness, control: string): Env {
  return {
    ...harness.env,
    ENVIRONMENT: 'staging',
    SEASON_PUBLICATION_AUTHORITY: 'sequencer',
    SEASON_PUBLICATION_CUTOVER_CONTROL: control,
    __SEASON_PUBLICATION_SEQUENCER: inProcessPort(),
    __CUTOVER_RETRY: immediateRetry,
  };
}

async function payload(response: Response): Promise<Record<string, unknown>> {
  const parsed = (await response.json()) as { data?: Record<string, unknown> };
  return parsed.data ?? {};
}

describe('a paused season cannot be mutated through the admin surface', () => {
  it('refuses rollback with the bounded cutover reason, moving no pointer', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const activeBefore = await harness.storage.getActiveVersion(SEASON);
    const previousBefore = await harness.storage.getPreviousVersion(SEASON);

    const response = await worker.fetch(
      adminRequest(`/internal/admin/rollback?season=${SEASON}`),
      pausedEnv(harness, `seed:${SEASON}`),
    );

    expect(response.status).toBe(409);
    expect(await payload(response)).toMatchObject({
      status: 'rejected',
      season: SEASON,
      reason: 'season-paused-for-cutover',
      pointerMaintenance: 'not-required',
    });
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(activeBefore);
    expect(await harness.storage.getPreviousVersion(SEASON)).toBe(
      previousBefore,
    );
  });

  it('refuses a synchronization run that would publish the paused season', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const activeBefore = await harness.storage.getActiveVersion(SEASON);

    const response = await worker.fetch(
      adminRequest(`/internal/admin/sync/full?season=${SEASON}`),
      pausedEnv(harness, `seed:${SEASON}`),
    );

    // The run itself completes as an operational failure rather than a
    // completed no-op, and no new version becomes active.
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(activeBefore);
    expect(JSON.stringify(await payload(response))).toContain(
      'season-paused-for-cutover',
    );
  });

  it('keeps the operator cache purge available for the paused season', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const response = await worker.fetch(
      adminRequest(`/internal/admin/cache/purge?season=${SEASON}`),
      pausedEnv(harness, `seed:${SEASON}`),
    );
    expect([200, 207]).toContain(response.status);
    expect(await payload(response)).toMatchObject({ season: SEASON });
  });

  it('pauses in the activate phase exactly as in the seed phase', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const response = await worker.fetch(
      adminRequest(`/internal/admin/rollback?season=${SEASON}`),
      pausedEnv(harness, `activate:${SEASON}`),
    );
    expect(await payload(response)).toMatchObject({
      reason: 'season-paused-for-cutover',
    });
  });

  it('leaves another season rollback path untouched', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const response = await worker.fetch(
      adminRequest(`/internal/admin/rollback?season=${OTHER_SEASON}`),
      pausedEnv(harness, `seed:${SEASON}`),
    );
    // It reaches the real authority and gets that season's own answer, which
    // for a season that was never published is a bounded refusal of its own -
    // and never the cutover pause.
    const data = await payload(response);
    expect(data.reason).not.toBe('season-paused-for-cutover');
    expect(data.season).toBe(OTHER_SEASON);
  });
});

describe('reads continue through the legacy authority before activation', () => {
  it('serves public reads while the paused season is uninitialized', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const response = await worker.fetch(
      request(`/v1/seasons/${SEASON}/calendar`),
      pausedEnv(harness, `seed:${SEASON}`),
    );
    // `uninitialized` keeps the legacy path: pausing mutators does not pause
    // readers, and the sequencer is not the authority until activation.
    expect(response.status).toBe(200);
  });

  it('serves public reads unchanged when no control is set at all', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const response = await worker.fetch(
      request(`/v1/seasons/${SEASON}/calendar`),
      harness.env,
    );
    expect(response.status).toBe(200);
  });
});
