import { afterEach, expect, it, vi } from 'vitest';
import { generateSeasonBatch } from '../../../scripts/season-batch/generate';
import { inputFor } from '../../season-batch/support';
import { ingestFor } from '../../ingest/support';
import { CapturingLogger } from '../../../src/logging/logger';
import { FixedClock } from '../../../src/runtime/clock';
import type { SeasonBatchSubmission } from '../../../src/ingest/submission';
afterEach(() => vi.unstubAllGlobals());
it('keeps reviewed bundled v1 generation identical and explicitly rejects runtime v1 before reading input', async () => {
  vi.stubGlobal('fetch', () => {
    throw Error('batch network forbidden');
  });
  const input = inputFor(),
    old = await generateSeasonBatch(input);
  expect(old.ok).toBe(true);
  expect(
    await generateSeasonBatch({ ...input, identityMode: 'bundled' }),
  ).toEqual(old);
  expect(
    await generateSeasonBatch({ ...input, identityMode: 'compare' }),
  ).toEqual(old);
  const forbidden = {
    get capture(): never {
      throw Error('runtime v1 input must not be read');
    },
    bodies: input.bodies,
    provenance: input.provenance,
    identityMode: 'runtime' as const,
  };
  expect(await generateSeasonBatch(forbidden)).toMatchObject({
    ok: false,
    failure: 'runtime-batch-requires-u7',
  });
});
it('blocks runtime v1 admission and direct ingestion without publication authority', async () => {
  const guarded = {
    publishGuarded: vi.fn(() => {
      throw Error('publication forbidden');
    }),
  };
  const deps = {
    logger: new CapturingLogger(),
    clock: new FixedClock(new Date('2026-11-15T00:00:00.000Z')),
  };
  const bundled = ingestFor(deps, guarded),
    admitted = bundled.admit();
  expect(typeof admitted).not.toBe('string');
  if (typeof admitted === 'string') throw Error(admitted);
  const runtime = ingestFor(deps, guarded, { identityMode: 'runtime' });
  expect(runtime.admit()).toBe('runtime-batch-requires-u7');
  expect(
    await runtime.ingest(admitted, {} as SeasonBatchSubmission),
  ).toMatchObject({
    outcome: 'refused',
    stage: 'admission',
    reason: 'runtime-batch-requires-u7',
  });
  expect(guarded.publishGuarded).not.toHaveBeenCalled();
});
