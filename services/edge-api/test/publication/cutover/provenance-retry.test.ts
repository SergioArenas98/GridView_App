/**
 * Provenance reads share the bounded retry budget (PR #19 review F2,
 * ADR 0025 D12 steps 3, 6, 8 and 9).
 *
 * Reproduced defect: inventory and document reads went through the retry
 * budget, but `resolveRollbackSourceOrdering` ran once, so a single transient
 * `__publication_metadata` read failure aborted a valid cutover with
 * `active-provenance-unavailable` - even though D12 step 3 puts required active
 * provenance inside the budget.
 *
 * Only `unreadable-sidecar` is transient. Every other rejection - malformed,
 * absent in the sidecar-required namespace, missing or non-uniform legacy
 * timestamps - is a permanent classification of an immutable artifact and must
 * stop at the attempt that produced it. Each permanent case below therefore
 * starts with one transient failure: that proves the unreadable read *was*
 * retried, and that the permanent answer then ended the loop rather than
 * consuming the rest of the budget.
 */

import { describe, expect, it } from 'vitest';

import {
  ACTIVE_VERSION,
  PREVIOUS_VERSION,
  SEASON,
  SIDECAR_REQUIRED_VERSION,
  checkpointFor,
  copyRelease,
  cutoverContext,
  setDocumentSourceUpdatedAt,
  writeSidecar,
} from './support';

const ATTEMPTS = 3;

/** A bounded budget whose delays are recorded and resolve immediately. */
function recordingRetry() {
  const delays: number[] = [];
  return {
    delays,
    policy: {
      attempts: ATTEMPTS,
      delay: async (attempt: number) => {
        delays.push(attempt);
      },
    },
  };
}

function sidecarReadsOf(
  context: Awaited<ReturnType<typeof cutoverContext>>,
  version: string,
): number {
  return context.storage.sidecarReads.filter((read) => read === version).length;
}

describe('the mandatory active provenance', () => {
  it('recovers from one transient unreadable sidecar inside the budget', async () => {
    const { delays, policy } = recordingRetry();
    const context = await cutoverContext({ retry: policy });
    context.storage.sidecar = (version, call) =>
      version === ACTIVE_VERSION && call === 1 ? 'throw' : 'ok';

    const result = await context.service.seed(checkpointFor());

    expect(result).toMatchObject({
      kind: 'seeded',
      receipt: { seeded: { activeProvenance: 'legacy-uniform-documents' } },
    });
    // Two for the first pass (one failure, one success), one for the recheck.
    expect(sidecarReadsOf(context, ACTIVE_VERSION)).toBe(3);
    expect(delays).toEqual([1]);
  });

  it('recovers a valid sidecar after a transient failure', async () => {
    const context = await cutoverContext({ retry: recordingRetry().policy });
    await writeSidecar(context.memory, ACTIVE_VERSION, {
      schemaVersion: 1,
      sourceOrderingInput: '2026-07-01T00:00:00.000Z',
    });
    context.storage.sidecar = (version, call) =>
      version === ACTIVE_VERSION && call === 1 ? 'throw' : 'ok';

    expect(await context.service.seed(checkpointFor())).toMatchObject({
      kind: 'seeded',
      receipt: {
        seeded: {
          activeProvenance: 'sidecar',
          committedSourceOrderingInput: '2026-07-01T00:00:00.000Z',
        },
      },
    });
  });

  it('exhausts exactly the budget, then fails closed with no seed written', async () => {
    const { delays, policy } = recordingRetry();
    const context = await cutoverContext({ retry: policy });
    context.storage.sidecar = (version) =>
      version === ACTIVE_VERSION ? 'throw' : 'ok';

    expect(await context.service.seed(checkpointFor())).toEqual({
      kind: 'failed',
      failure: 'active-provenance-unavailable',
    });
    // Bounded: exactly the configured attempts, never an unbounded wait, and
    // an unreadable read never diverts to the legacy fallback.
    expect(sidecarReadsOf(context, ACTIVE_VERSION)).toBe(ATTEMPTS);
    expect(delays).toEqual([1, 2]);
    expect(await context.port.readAuthority(SEASON)).toEqual({
      cutoverState: 'uninitialized',
      authoritative: false,
    });
    expect(context.host.committedKeys()).toEqual([]);
  });
});

describe('permanent provenance classifications are never retried', () => {
  it('stops at a malformed sidecar', async () => {
    const context = await cutoverContext({ retry: recordingRetry().policy });
    await writeSidecar(context.memory, ACTIVE_VERSION, {
      schemaVersion: 1,
      sourceOrderingInput: 'yesterday',
    });
    context.storage.sidecar = (version, call) =>
      version === ACTIVE_VERSION && call === 1 ? 'throw' : 'ok';

    expect(await context.service.seed(checkpointFor())).toEqual({
      kind: 'failed',
      failure: 'active-provenance-unavailable',
    });
    // One transient read, one malformed answer, and no third attempt.
    expect(sidecarReadsOf(context, ACTIVE_VERSION)).toBe(2);
  });

  it('stops at an absent sidecar in the sidecar-required namespace', async () => {
    const context = await cutoverContext({ retry: recordingRetry().policy });
    await copyRelease(context.memory, ACTIVE_VERSION, SIDECAR_REQUIRED_VERSION);
    context.storage.sidecar = (version, call) =>
      version === SIDECAR_REQUIRED_VERSION && call === 1 ? 'throw' : 'ok';

    expect(
      await context.service.seed(
        checkpointFor({ activeVersion: SIDECAR_REQUIRED_VERSION }),
      ),
    ).toEqual({ kind: 'failed', failure: 'active-provenance-unavailable' });
    expect(sidecarReadsOf(context, SIDECAR_REQUIRED_VERSION)).toBe(2);
  });

  it('stops at non-uniform legacy document timestamps', async () => {
    const context = await cutoverContext({ retry: recordingRetry().policy });
    await setDocumentSourceUpdatedAt(
      context.memory,
      ACTIVE_VERSION,
      'calendar',
      '2026-07-19T00:00:00.000Z',
    );
    context.storage.sidecar = (version, call) =>
      version === ACTIVE_VERSION && call === 1 ? 'throw' : 'ok';

    expect(await context.service.seed(checkpointFor())).toEqual({
      kind: 'failed',
      failure: 'active-provenance-unavailable',
    });
    expect(sidecarReadsOf(context, ACTIVE_VERSION)).toBe(2);
  });
});

describe('the best-effort previous provenance', () => {
  it('recovers a transient unreadable sidecar and keeps the previous version', async () => {
    const context = await cutoverContext({ retry: recordingRetry().policy });
    context.storage.sidecar = (version, call) =>
      version === PREVIOUS_VERSION && call === 1 ? 'throw' : 'ok';

    expect(
      await context.service.seed(
        checkpointFor({ previousVersion: PREVIOUS_VERSION }),
      ),
    ).toMatchObject({
      kind: 'seeded',
      receipt: {
        seeded: {
          previousVersion: PREVIOUS_VERSION,
          previousVersionCommitted: true,
        },
      },
    });
  });

  it('omits the previous version after exhausting the budget, and continues', async () => {
    const context = await cutoverContext({ retry: recordingRetry().policy });
    context.storage.sidecar = (version) =>
      version === PREVIOUS_VERSION ? 'throw' : 'ok';

    expect(
      await context.service.seed(
        checkpointFor({ previousVersion: PREVIOUS_VERSION }),
      ),
    ).toMatchObject({
      kind: 'seeded',
      receipt: { seeded: { previousVersion: null } },
    });
    // Omitted at its first read, so no recheck read follows.
    expect(sidecarReadsOf(context, PREVIOUS_VERSION)).toBe(ATTEMPTS);
  });
});

describe('the step-9 recheck uses the same bounded provenance reads', () => {
  it('recovers from a transient unreadable sidecar during the active recheck', async () => {
    const context = await cutoverContext({ retry: recordingRetry().policy });
    // The first pass reads once and succeeds; the recheck's first read fails.
    context.storage.sidecar = (version, call) =>
      version === ACTIVE_VERSION && call === 2 ? 'throw' : 'ok';

    expect(await context.service.seed(checkpointFor())).toMatchObject({
      kind: 'seeded',
    });
    expect(sidecarReadsOf(context, ACTIVE_VERSION)).toBe(3);
  });

  it('fails the active recheck after exactly the budget', async () => {
    const context = await cutoverContext({ retry: recordingRetry().policy });
    context.storage.sidecar = (version, call) =>
      version === ACTIVE_VERSION && call > 1 ? 'throw' : 'ok';

    expect(await context.service.seed(checkpointFor())).toEqual({
      kind: 'failed',
      failure: 'active-recheck-failed',
    });
    expect(sidecarReadsOf(context, ACTIVE_VERSION)).toBe(1 + ATTEMPTS);
    expect(context.host.committedKeys()).toEqual([]);
  });

  it('recovers a transient failure during the previous recheck', async () => {
    const context = await cutoverContext({ retry: recordingRetry().policy });
    context.storage.sidecar = (version, call) =>
      version === PREVIOUS_VERSION && call === 2 ? 'throw' : 'ok';

    expect(
      await context.service.seed(
        checkpointFor({ previousVersion: PREVIOUS_VERSION }),
      ),
    ).toMatchObject({
      kind: 'seeded',
      receipt: { seeded: { previousVersion: PREVIOUS_VERSION } },
    });
  });
});
