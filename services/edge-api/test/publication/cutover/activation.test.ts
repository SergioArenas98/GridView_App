/**
 * D12 step 11: the separate, idempotent, fingerprint-bound `seeded -> active`
 * transition, and every gate that stands in front of it.
 *
 * The property this file exists to hold: **activation is never a side effect.**
 * Seeding does not activate, no method does both, the activate phase cannot
 * create or replace a seed, and an operator's confirmation must be explicit and
 * must carry back the same checkpoint whose fingerprint the seed committed.
 */

import { describe, expect, it } from 'vitest';

import { CutoverPreparationService } from '../../../src/publication/cutover/service';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import {
  ACTIVE_VERSION,
  EVIDENCE_REFERENCE,
  OTHER_SEASON,
  PREVIOUS_VERSION,
  SEASON,
  checkpointFor,
  cutoverContext,
  immediateRetry,
  runtimeConfigFor,
  type CutoverContext,
} from './support';

/** The same storage and sequencer, re-composed in the activate phase. */
function activationService(
  context: CutoverContext,
  overrides: Parameters<typeof runtimeConfigFor>[0] = {},
): CutoverPreparationService {
  return new CutoverPreparationService({
    config: runtimeConfigFor({
      control: { kind: 'activate', season: SEASON },
      ...overrides,
    }),
    authority: { mode: 'sequencer', port: context.port },
    storage: context.storage,
    validator: runtimeSnapshotValidator,
    logger: context.logger,
    clock: context.clock,
    retry: immediateRetry,
  });
}

describe('the two phases cannot do each other work', () => {
  it('refuses activation while the control is in the seed phase', async () => {
    const context = await cutoverContext();
    await context.service.seed(checkpointFor());
    expect(await context.service.activate(checkpointFor(), true)).toEqual({
      kind: 'refused',
      refusal: 'phase-not-permitted',
    });
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'seeded',
      authoritative: false,
    });
  });

  it('refuses seeding while the control is in the activate phase', async () => {
    const context = await cutoverContext();
    const activate = activationService(context);
    expect(await activate.seed(checkpointFor())).toEqual({
      kind: 'refused',
      refusal: 'phase-not-permitted',
    });
    // Nothing was created, so the activate phase can never replace a seed.
    expect(await context.port.readAuthority(SEASON)).toEqual({
      cutoverState: 'uninitialized',
      authoritative: false,
    });
  });

  it('never activates as a side effect of a successful seed', async () => {
    const context = await cutoverContext();
    const result = await context.service.seed(checkpointFor());
    expect(result.kind).toBe('seeded');
    const authority = await context.port.readAuthority(SEASON);
    expect(authority.cutoverState).toBe('seeded');
    expect(authority.authoritative).toBe(false);
  });
});

describe('activation preconditions', () => {
  it('fails closed before any seed exists', async () => {
    const context = await cutoverContext();
    expect(
      await activationService(context).activate(checkpointFor(), true),
    ).toEqual({ kind: 'failed', failure: 'cutover-not-seeded' });
  });

  it('fails closed without an explicit confirmation', async () => {
    const context = await cutoverContext();
    await context.service.seed(checkpointFor());
    expect(
      await activationService(context).activate(checkpointFor(), false),
    ).toEqual({ kind: 'failed', failure: 'activation-not-confirmed' });
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'seeded',
    });
  });

  it('fails closed for a different season', async () => {
    const context = await cutoverContext();
    await context.service.seed(checkpointFor());
    expect(
      await activationService(context).activate(
        checkpointFor({ season: OTHER_SEASON }),
        true,
      ),
    ).toEqual({ kind: 'refused', refusal: 'season-not-paused' });
  });

  it('fails closed on an altered receipt, field by field', async () => {
    const context = await cutoverContext();
    await context.service.seed(checkpointFor());
    const activate = activationService(context);

    for (const altered of [
      checkpointFor({ activeVersion: PREVIOUS_VERSION }),
      checkpointFor({ previousVersion: PREVIOUS_VERSION }),
      checkpointFor({ migrationIdentity: 'cutover-2026-staging-02' }),
      checkpointFor({
        historicalFloorEvidence: {
          kind: 'authorized-client-baseline-reset',
          evidenceReference: EVIDENCE_REFERENCE,
        },
      }),
      checkpointFor({
        historicalFloorEvidence: {
          kind: 'no-retained-pre-cutover-client-state',
          evidenceReference: 'AUDIT-2026-07-20/somewhere-else',
        },
      }),
      checkpointFor({
        historicalFloorEvidence: {
          kind: 'audited-historical-upper-bound',
          auditedUpperBound: '2026-06-01T00:00:00.000Z',
          evidenceReference: EVIDENCE_REFERENCE,
        },
      }),
    ]) {
      expect(await activate.activate(altered, true)).toEqual({
        kind: 'failed',
        failure: 'cutover-fingerprint-mismatch',
      });
    }
    // The seeded attempt is left exactly as it was, to abandon or restart.
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'seeded',
      authoritative: false,
    });
  });
});

describe('a correct confirmation activates, idempotently', () => {
  it('performs the transition and reports an authoritative season', async () => {
    const context = await cutoverContext();
    const seeded = await context.service.seed(checkpointFor());
    expect(seeded.kind).toBe('seeded');
    if (seeded.kind !== 'seeded') return;

    const activated = await activationService(context).activate(
      seeded.receipt.checkpoint,
      true,
    );
    expect(activated).toMatchObject({
      kind: 'activated',
      receipt: {
        season: SEASON,
        outcome: 'activated',
        cutoverState: 'active',
        cutoverFingerprint: seeded.receipt.cutoverFingerprint,
        activeVersion: ACTIVE_VERSION,
      },
    });
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'active',
      authoritative: true,
    });
  });

  it('is idempotent for an identical retry', async () => {
    const context = await cutoverContext();
    const seeded = await context.service.seed(checkpointFor());
    if (seeded.kind !== 'seeded') throw new Error('seed failed');
    const activate = activationService(context);

    await activate.activate(seeded.receipt.checkpoint, true);
    expect(
      await activate.activate(seeded.receipt.checkpoint, true),
    ).toMatchObject({
      kind: 'activated',
      receipt: { outcome: 'already-active' },
    });
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'active',
      authoritative: true,
    });
  });

  it('still rejects a mismatched fingerprint after activation', async () => {
    const context = await cutoverContext();
    const seeded = await context.service.seed(checkpointFor());
    if (seeded.kind !== 'seeded') throw new Error('seed failed');
    const activate = activationService(context);
    await activate.activate(seeded.receipt.checkpoint, true);

    expect(
      await activate.activate(
        checkpointFor({ migrationIdentity: 'cutover-2026-staging-02' }),
        true,
      ),
    ).toEqual({ kind: 'failed', failure: 'cutover-fingerprint-mismatch' });
  });
});

describe('environment, authority mode and port are all required', () => {
  it('refuses every operation in production', async () => {
    for (const environment of ['production', 'development'] as const) {
      const context = await cutoverContext({ environment });
      expect(await context.service.seed(checkpointFor())).toEqual({
        kind: 'refused',
        refusal: 'environment-not-staging',
      });
      const activate = activationService(context, { environment });
      expect(await activate.activate(checkpointFor(), true)).toEqual({
        kind: 'refused',
        refusal: 'environment-not-staging',
      });
      expect(await context.service.status(SEASON)).toEqual({
        state: 'unavailable',
        reason: 'environment-not-staging',
        season: SEASON,
      });
      expect(await context.port.readAuthority(SEASON)).toEqual({
        cutoverState: 'uninitialized',
        authoritative: false,
      });
    }
  });

  it('refuses every operation when the authority mode is legacy', async () => {
    const context = await cutoverContext({ authority: { mode: 'legacy' } });
    expect(await context.service.seed(checkpointFor())).toEqual({
      kind: 'refused',
      refusal: 'authority-mode-not-sequencer',
    });
    expect(await context.service.status(SEASON)).toMatchObject({
      state: 'unavailable',
      reason: 'authority-mode-not-sequencer',
    });
  });

  it('refuses every operation when no sequencer port is reachable', async () => {
    const context = await cutoverContext({
      authority: { mode: 'sequencer-unavailable' },
    });
    expect(await context.service.seed(checkpointFor())).toEqual({
      kind: 'refused',
      refusal: 'sequencer-unavailable',
    });
    expect(await context.service.status(SEASON)).toMatchObject({
      state: 'unavailable',
      reason: 'sequencer-unavailable',
    });
  });

  it('refuses every operation for a season the control does not name', async () => {
    const context = await cutoverContext();
    expect(
      await context.service.seed(checkpointFor({ season: OTHER_SEASON })),
    ).toEqual({ kind: 'refused', refusal: 'season-not-paused' });
    expect(await context.service.status(OTHER_SEASON)).toMatchObject({
      state: 'unavailable',
      reason: 'season-not-paused',
    });
  });

  it('reports disabled, and reads nothing, with no control set', async () => {
    const context = await cutoverContext({ control: { kind: 'disabled' } });
    expect(await context.service.status(SEASON)).toEqual({ state: 'disabled' });
    expect(await context.service.seed(checkpointFor())).toEqual({
      kind: 'refused',
      refusal: 'disabled',
    });
    expect(await context.service.activate(checkpointFor(), true)).toEqual({
      kind: 'refused',
      refusal: 'disabled',
    });
    expect(context.storage.inventoryReads).toEqual([]);
    expect(context.storage.pointerReads).toEqual([]);
  });
});

describe('status reporting', () => {
  it('distinguishes uninitialized, seeded and active', async () => {
    const context = await cutoverContext();
    expect(await context.service.status(SEASON)).toEqual({
      state: 'uninitialized',
      season: SEASON,
      phase: 'seed',
      admissionClosed: true,
    });

    const seeded = await context.service.seed(checkpointFor());
    if (seeded.kind !== 'seeded') throw new Error('seed failed');
    expect(await context.service.status(SEASON)).toMatchObject({
      state: 'seeded',
      authoritative: false,
      activeVersion: ACTIVE_VERSION,
      cutoverFingerprint: seeded.receipt.cutoverFingerprint,
    });

    const activate = activationService(context);
    await activate.activate(seeded.receipt.checkpoint, true);
    expect(await activate.status(SEASON)).toMatchObject({
      state: 'active',
      phase: 'activate',
      authoritative: true,
    });
  });

  it('never infers authority from a legacy pointer', async () => {
    const context = await cutoverContext();
    await context.service.status(SEASON);
    expect(context.storage.pointerReads).toEqual([]);
  });
});
