/**
 * The bridge's prepare-once, publish-once split: the candidate the no-change
 * gate inspects is the one, and only one, the guarded publisher receives.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  type PreparedSeasonCandidate,
} from '../../../src/providers/coordination';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import {
  FIXED_NOW,
  completePort,
  fullPlan,
  metadataFor,
  publicationHarness,
  seasonFixture,
  seedSetFrom,
} from './support';

function coordinate(source: ProviderSeasonSource) {
  return new MultiSourceCoordinator({
    ports: [completePort('jolpica', source)],
    logger: new CapturingLogger(),
  }).coordinate({ plan: fullPlan(source) });
}

describe('a prepared coordinated candidate', () => {
  it('is generated once, and published through the guarded entry point once', async () => {
    const source = await seasonFixture();
    const harness = await publicationHarness({ seedSource: source });
    const bridge = new CoordinatedSeasonPublication({
      commands: harness.commands,
      logger: harness.logger,
    });
    const run = await coordinate(source);
    const metadata = {
      ...metadataFor(source),
      sourceUpdatedAt: '2026-07-19T00:00:00.000Z',
    };

    const candidate = bridge.prepareCandidate(
      run,
      metadata,
      FIXED_NOW,
      'label',
    );
    expect(candidate.outcome).toBe('prepared');
    expect(harness.publishCalls).toBe(0);
    const prepared = candidate as PreparedSeasonCandidate;
    // Deterministic: the same inputs generate the same set.
    const expected = bridge.prepareCandidate(run, metadata, FIXED_NOW, 'label');
    expect(prepared.set).toEqual((expected as PreparedSeasonCandidate).set);
    expect(Object.isFrozen(prepared)).toBe(true);

    const published = await bridge.publishCandidate(prepared);
    expect(published.result.status).toBe('applied');
    expect(harness.publishCalls).toBe(1);
    expect(harness.handed[0]!.set).toBe(prepared.set);

    await expect(bridge.publishCandidate(prepared)).rejects.toThrow(
      /at most once/,
    );
    expect(harness.publishCalls).toBe(1);
  });

  it('refuses a candidate another bridge prepared, before sending anything', async () => {
    const source = await seasonFixture();
    const harness = await publicationHarness({ seedSource: source });
    const make = () =>
      new CoordinatedSeasonPublication({
        commands: harness.commands,
        logger: harness.logger,
      });
    const candidate = make().prepareCandidate(
      await coordinate(source),
      { ...metadataFor(source), sourceUpdatedAt: '2026-07-19T00:00:00.000Z' },
      FIXED_NOW,
      'label',
    ) as PreparedSeasonCandidate;
    const forged = { ...candidate, set: seedSetFrom(source) };

    await expect(make().publishCandidate(candidate)).rejects.toThrow(
      /at most once/,
    );
    await expect(make().publishCandidate(forged)).rejects.toThrow(
      /at most once/,
    );
    expect(harness.publishCalls).toBe(0);
  });

  it('withholds an incomplete run without generating anything', async () => {
    const source = await seasonFixture();
    const harness = await publicationHarness({ seedSource: source });
    const bridge = new CoordinatedSeasonPublication({
      commands: harness.commands,
      logger: harness.logger,
    });
    const run = await coordinate(source);
    const cancelled = { ...run, status: 'cancelled' as const };

    expect(
      bridge.prepareCandidate(
        cancelled,
        { ...metadataFor(source), sourceUpdatedAt: FIXED_NOW },
        FIXED_NOW,
        'label',
      ),
    ).toMatchObject({ outcome: 'withheld', gap: 'run-not-completed' });
    expect(harness.publishCalls).toBe(0);
  });
});
