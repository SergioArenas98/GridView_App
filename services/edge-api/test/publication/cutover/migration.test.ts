/**
 * D12's per-season migration procedure, steps 2-10, against an
 * operator-approved checkpoint.
 *
 * The two asymmetries this file exists to pin down:
 *
 * - **active is mandatory** - any failure of its inventory, documents,
 *   timestamps or provenance aborts the season's cutover with no Durable
 *   Object state written;
 * - **previous is best-effort** - its failure, at first read *or* at the
 *   step-9 recheck, removes both the pointer and its timestamp contribution
 *   and seeds `previousVersion: null`, and never aborts the active migration.
 *
 * And the two things the migration must never do: read a legacy pointer, or
 * treat a `listVersions` scan as evidence of anything.
 */

import { describe, expect, it } from 'vitest';

import { cutoverFingerprint } from '../../../src/publication/cutover/checkpoint';
import {
  revisionInputForDocument,
  snapshotRevision,
} from '../../../src/publication/snapshot-revision';
import {
  ACTIVE_SOURCE_UPDATED_AT,
  ACTIVE_VERSION,
  EVIDENCE_REFERENCE,
  MIGRATION_NOW,
  PREVIOUS_SOURCE_UPDATED_AT,
  PREVIOUS_VERSION,
  SEASON,
  SIDECAR_REQUIRED_VERSION,
  checkpointFor,
  copyRelease,
  cutoverContext,
  permissiveValidator,
  setDocumentSourceUpdatedAt,
  writeSidecar,
} from './support';

describe('the seed is built from the checkpoint, never from a pointer', () => {
  it('commits a complete seed and reports a non-authoritative seeded state', async () => {
    const context = await cutoverContext();
    const result = await context.service.seed(checkpointFor());

    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt).toMatchObject({
      season: SEASON,
      outcome: 'seeded',
      cutoverState: 'seeded',
      seeded: {
        activeVersion: ACTIVE_VERSION,
        previousVersion: null,
        previousVersionCommitted: false,
        committedSourceOrderingInput: ACTIVE_SOURCE_UPDATED_AT,
        activeProvenance: 'legacy-uniform-documents',
        seasonSnapshotObservedAtHighWaterMark: MIGRATION_NOW,
      },
    });
    expect(result.receipt.cutoverFingerprint).toBe(
      await cutoverFingerprint(checkpointFor()),
    );

    const authority = await context.port.readAuthority(SEASON);
    expect(authority).toMatchObject({
      cutoverState: 'seeded',
      authoritative: false,
      activeVersion: ACTIVE_VERSION,
      previousVersion: null,
    });
  });

  it('never reads a legacy pointer or a version listing', async () => {
    const context = await cutoverContext();
    await context.service.seed(checkpointFor());
    // `active:{season}`, `previous:{season}` and `listVersions` are all
    // recorded by the scripted storage. None of them may appear: the checkpoint
    // is an operator decision, and a prefix scan proves no completeness.
    expect(context.storage.pointerReads).toEqual([]);
  });

  it('reads the checkpoint version even when the legacy pointer names another', async () => {
    const context = await cutoverContext();
    // Move the live pointers somewhere else entirely. The migration must not
    // notice, because it never reads them.
    await context.memory.setActiveVersion(SEASON, 'v-somewhere-else');
    await context.memory.setPreviousVersion(SEASON, 'v-somewhere-older');

    const result = await context.service.seed(checkpointFor());
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded.activeVersion).toBe(ACTIVE_VERSION);
  });

  it('reuses the canonical snapshotRevision for every key', async () => {
    const context = await cutoverContext();
    await context.service.seed(checkpointFor());

    const inventory = await context.memory.readVersionInventory(
      SEASON,
      ACTIVE_VERSION,
    );
    expect(inventory).not.toBeNull();
    for (const name of inventory ?? []) {
      const document = await context.memory.readVersionedDocument(
        SEASON,
        ACTIVE_VERSION,
        name,
      );
      expect(document).not.toBeNull();
      const expected = await snapshotRevision(
        revisionInputForDocument(document!),
      );
      // The committed per-key record the sequencer holds is exactly what the
      // existing implementation computes - no second revision rule anywhere.
      // The document name is the storage key, not a field of the record.
      expect(context.host.peek(`committed/${name}`)).toEqual({
        revision: expected,
        observedAt: ACTIVE_SOURCE_UPDATED_AT,
      });
    }
  });

  it('writes no sidecar and moves no legacy pointer', async () => {
    const context = await cutoverContext();
    const activeBefore = await context.memory.getActiveVersion(SEASON);
    const previousBefore = await context.memory.getPreviousVersion(SEASON);

    await context.service.seed(checkpointFor());

    expect(await context.memory.getActiveVersion(SEASON)).toBe(activeBefore);
    expect(await context.memory.getPreviousVersion(SEASON)).toBe(
      previousBefore,
    );
    // A legacy-format version legitimately has none, and backfilling one would
    // mutate an artifact ADR 0007 treats as immutable.
    expect(
      await context.memory.readPublicationMetadata(SEASON, ACTIVE_VERSION),
    ).toBeNull();
    expect(
      await context.memory.readPublicationMetadata(SEASON, PREVIOUS_VERSION),
    ).toBeNull();
  });
});

describe('mandatory active validation', () => {
  it('aborts on an unreadable inventory, with no seed written', async () => {
    const context = await cutoverContext();
    context.storage.inventory = (version) =>
      version === ACTIVE_VERSION ? 'throw' : 'ok';

    expect(await context.service.seed(checkpointFor())).toEqual({
      kind: 'failed',
      failure: 'active-inventory-unavailable',
    });
    expect(await context.port.readAuthority(SEASON)).toEqual({
      cutoverState: 'uninitialized',
      authoritative: false,
    });
  });

  it('aborts on an absent inventory', async () => {
    const context = await cutoverContext();
    context.storage.inventory = (version) =>
      version === ACTIVE_VERSION ? 'absent' : 'ok';
    expect(await context.service.seed(checkpointFor())).toMatchObject({
      failure: 'active-inventory-unavailable',
    });
  });

  it('aborts on an empty inventory', async () => {
    const context = await cutoverContext();
    await context.memory.writeVersionInventory(SEASON, 'v-empty', []);
    expect(
      await context.service.seed(checkpointFor({ activeVersion: 'v-empty' })),
    ).toMatchObject({ failure: 'active-inventory-empty' });
  });

  it('aborts on a document the inventory names but storage cannot supply', async () => {
    const context = await cutoverContext();
    context.storage.document = (version, name) =>
      version === ACTIVE_VERSION && name === 'calendar' ? 'absent' : 'ok';
    expect(await context.service.seed(checkpointFor())).toMatchObject({
      failure: 'active-document-unavailable',
    });
  });

  it('aborts on a document that fails contract validation', async () => {
    const context = await cutoverContext();
    await setDocumentSourceUpdatedAt(
      context.memory,
      ACTIVE_VERSION,
      'calendar',
      'not-a-timestamp',
    );
    // `validateMeta` rejects the malformed envelope before the migration ever
    // reaches its own timestamp import.
    expect(await context.service.seed(checkpointFor())).toMatchObject({
      failure: 'active-document-invalid',
    });
  });

  it('aborts on an unorderable imported timestamp, even if validation passed', async () => {
    // Contract validation is about the public envelope; importing a
    // `snapshotObservedAt` is about a value every later comparison must order.
    // With a permissive validator the migration's own check is what refuses it.
    const context = await cutoverContext({ validator: permissiveValidator });
    await setDocumentSourceUpdatedAt(
      context.memory,
      ACTIVE_VERSION,
      'calendar',
      'yesterday',
    );
    expect(await context.service.seed(checkpointFor())).toMatchObject({
      failure: 'active-document-timestamp-invalid',
    });
  });

  it('aborts when the sequencer itself is unreachable', async () => {
    const context = await cutoverContext();
    const failing = {
      ...context.port,
      readAuthority: async () => {
        throw new Error('unreachable');
      },
      seedCutover: async () => {
        throw new Error('unreachable');
      },
    };
    const service = new (
      await import('../../../src/publication/cutover/service')
    ).CutoverPreparationService({
      config: (await import('./support')).runtimeConfigFor(),
      authority: { mode: 'sequencer', port: failing as never },
      storage: context.storage,
      validator: (await import('../../../src/validation/snapshot-validator'))
        .runtimeSnapshotValidator,
      logger: context.logger,
      clock: context.clock,
      retry: (await import('./support')).immediateRetry,
    });
    expect(await service.seed(checkpointFor())).toMatchObject({
      failure: 'seed-unconfirmed',
    });
  });
});

describe('the bounded retry budget', () => {
  it('succeeds when a read recovers inside the budget', async () => {
    const context = await cutoverContext();
    context.storage.inventory = (version, call) =>
      version === ACTIVE_VERSION && call === 1 ? 'throw' : 'ok';

    const result = await context.service.seed(checkpointFor());
    expect(result.kind).toBe('seeded');
    // Two reads for the first pass (one failure, one success), and the step-9
    // recheck reads it again.
    expect(
      context.storage.inventoryReads.filter((v) => v === ACTIVE_VERSION).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it('aborts when the budget is exhausted, and stops reading', async () => {
    const context = await cutoverContext({
      retry: { attempts: 2, delay: async () => {} },
    });
    context.storage.inventory = (version) =>
      version === ACTIVE_VERSION ? 'throw' : 'ok';

    expect(await context.service.seed(checkpointFor())).toMatchObject({
      failure: 'active-inventory-unavailable',
    });
    // Exactly the budget: bounded, never an unbounded wait.
    expect(
      context.storage.inventoryReads.filter((v) => v === ACTIVE_VERSION),
    ).toHaveLength(2);
  });
});

describe('provenance resolution reuses the shared rollback rules', () => {
  it('uses a valid sidecar on a legacy-format version', async () => {
    const context = await cutoverContext();
    await writeSidecar(context.memory, ACTIVE_VERSION, {
      schemaVersion: 1,
      sourceOrderingInput: '2026-07-01T00:00:00.000Z',
    });

    const result = await context.service.seed(checkpointFor());
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded).toMatchObject({
      committedSourceOrderingInput: '2026-07-01T00:00:00.000Z',
      activeProvenance: 'sidecar',
    });
  });

  it('uses a valid sidecar on a sidecar-required version', async () => {
    const context = await cutoverContext();
    await copyRelease(context.memory, ACTIVE_VERSION, SIDECAR_REQUIRED_VERSION);
    await writeSidecar(context.memory, SIDECAR_REQUIRED_VERSION, {
      schemaVersion: 1,
      sourceOrderingInput: '2026-07-02T00:00:00.000Z',
    });

    const result = await context.service.seed(
      checkpointFor({ activeVersion: SIDECAR_REQUIRED_VERSION }),
    );
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded).toMatchObject({
      committedSourceOrderingInput: '2026-07-02T00:00:00.000Z',
      activeProvenance: 'sidecar',
    });
  });

  it('falls back to uniform documents only on a legacy-format version', async () => {
    const context = await cutoverContext();
    const result = await context.service.seed(checkpointFor());
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded.activeProvenance).toBe(
      'legacy-uniform-documents',
    );
  });

  it('fails closed on an absent sidecar under a sidecar-required version', async () => {
    const context = await cutoverContext();
    await copyRelease(context.memory, ACTIVE_VERSION, SIDECAR_REQUIRED_VERSION);
    // Its documents carry a perfectly uniform timestamp; the fallback is still
    // unavailable, because eligibility comes from the identifier's namespace.
    expect(
      await context.service.seed(
        checkpointFor({ activeVersion: SIDECAR_REQUIRED_VERSION }),
      ),
    ).toMatchObject({ failure: 'active-provenance-unavailable' });
  });

  it('fails closed on a malformed sidecar', async () => {
    const context = await cutoverContext();
    await writeSidecar(context.memory, ACTIVE_VERSION, {
      schemaVersion: 1,
      sourceOrderingInput: 'yesterday',
    });
    expect(await context.service.seed(checkpointFor())).toMatchObject({
      failure: 'active-provenance-unavailable',
    });
  });

  it('fails closed on an unreadable sidecar, never diverting to the fallback', async () => {
    const context = await cutoverContext();
    context.storage.sidecar = (version) =>
      version === ACTIVE_VERSION ? 'throw' : 'ok';
    expect(await context.service.seed(checkpointFor())).toMatchObject({
      failure: 'active-provenance-unavailable',
    });
  });

  it('fails closed on non-uniform legacy document timestamps', async () => {
    const context = await cutoverContext();
    await setDocumentSourceUpdatedAt(
      context.memory,
      ACTIVE_VERSION,
      'calendar',
      '2026-07-19T00:00:00.000Z',
    );
    expect(await context.service.seed(checkpointFor())).toMatchObject({
      failure: 'active-provenance-unavailable',
    });
  });
});

describe('best-effort previousVersion', () => {
  it('commits a validated previous version and folds in its timestamps', async () => {
    const context = await cutoverContext();
    const result = await context.service.seed(
      checkpointFor({ previousVersion: PREVIOUS_VERSION }),
    );
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded).toMatchObject({
      previousVersion: PREVIOUS_VERSION,
      previousVersionCommitted: true,
    });
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      previousVersion: PREVIOUS_VERSION,
    });
  });

  it('seeds null and continues when the previous version is missing', async () => {
    const context = await cutoverContext();
    const result = await context.service.seed(
      checkpointFor({ previousVersion: 'v-never-existed' }),
    );
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded.previousVersion).toBeNull();
  });

  it('seeds null and continues when the previous version is unreadable', async () => {
    const context = await cutoverContext();
    context.storage.inventory = (version) =>
      version === PREVIOUS_VERSION ? 'throw' : 'ok';
    const result = await context.service.seed(
      checkpointFor({ previousVersion: PREVIOUS_VERSION }),
    );
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded.previousVersion).toBeNull();
  });

  it('seeds null when a previous version in the reserved namespace has no sidecar', async () => {
    const context = await cutoverContext();
    await copyRelease(
      context.memory,
      PREVIOUS_VERSION,
      SIDECAR_REQUIRED_VERSION,
    );
    const result = await context.service.seed(
      checkpointFor({ previousVersion: SIDECAR_REQUIRED_VERSION }),
    );
    // Never rescued by the legacy fallback, and never escalated into an abort.
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded.previousVersion).toBeNull();
  });

  it('never commits a previous version it could not validate', async () => {
    const context = await cutoverContext();
    context.storage.document = (version, name) =>
      version === PREVIOUS_VERSION && name === 'calendar' ? 'absent' : 'ok';
    await context.service.seed(
      checkpointFor({ previousVersion: PREVIOUS_VERSION }),
    );
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      previousVersion: null,
    });
  });
});

describe('the step-9 recheck', () => {
  it('aborts without seeding when the active recheck cannot be read', async () => {
    const context = await cutoverContext();
    // The first pass reads the inventory once; the recheck reads it again.
    context.storage.inventory = (version, call) =>
      version === ACTIVE_VERSION && call > 1 ? 'throw' : 'ok';

    expect(await context.service.seed(checkpointFor())).toEqual({
      kind: 'failed',
      failure: 'active-recheck-failed',
    });
    expect(await context.port.readAuthority(SEASON)).toEqual({
      cutoverState: 'uninitialized',
      authoritative: false,
    });
  });

  it('aborts when the active release no longer describes the same revisions', async () => {
    const context = await cutoverContext();
    // The recheck's read of `calendar` (its second) sees different `data`, so
    // its `snapshotRevision` differs from the staged one. That is exactly the
    // local read failure or change step 9 exists to catch.
    context.storage.documentPatch.set(`${ACTIVE_VERSION}|calendar|2`, {
      data: [],
    });

    expect(await context.service.seed(checkpointFor())).toEqual({
      kind: 'failed',
      failure: 'active-recheck-failed',
    });
    expect(await context.port.readAuthority(SEASON)).toEqual({
      cutoverState: 'uninitialized',
      authoritative: false,
    });
  });

  it('aborts when the active release no longer carries the same timestamps', async () => {
    const context = await cutoverContext();
    const document = await context.memory.readVersionedDocument(
      SEASON,
      ACTIVE_VERSION,
      'calendar',
    );
    expect(document).not.toBeNull();
    context.storage.documentPatch.set(`${ACTIVE_VERSION}|calendar|2`, {
      meta: { ...document!.meta, sourceUpdatedAt: '2026-07-19T00:00:00.000Z' },
    });

    expect(await context.service.seed(checkpointFor())).toMatchObject({
      failure: 'active-recheck-failed',
    });
  });

  it('drops a previous version whose recheck fails, with its timestamps', async () => {
    const context = await cutoverContext();
    context.storage.inventory = (version, call) =>
      version === PREVIOUS_VERSION && call > 1 ? 'throw' : 'ok';

    const result = await context.service.seed(
      checkpointFor({ previousVersion: PREVIOUS_VERSION }),
    );
    // Step 10 commits the post-recheck result, never step 8's optimistic one.
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded.previousVersion).toBeNull();
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      previousVersion: null,
    });
  });
});

describe('the conservatively seeded high-water mark', () => {
  it('takes the migration clock when it dominates every release timestamp', async () => {
    const context = await cutoverContext();
    const result = await context.service.seed(
      checkpointFor({ previousVersion: PREVIOUS_VERSION }),
    );
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded.seasonSnapshotObservedAtHighWaterMark).toBe(
      MIGRATION_NOW,
    );
  });

  it('takes an audited upper bound when it dominates the clock', async () => {
    const context = await cutoverContext();
    const bound = '2030-01-01T00:00:00.000Z';
    const result = await context.service.seed(
      checkpointFor({
        historicalFloorEvidence: {
          kind: 'audited-historical-upper-bound',
          auditedUpperBound: bound,
          evidenceReference: EVIDENCE_REFERENCE,
        },
      }),
    );
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded.seasonSnapshotObservedAtHighWaterMark).toBe(
      bound,
    );
  });

  it('folds in a validated previous version whose timestamps dominate', async () => {
    // A previous release published *after* the migration clock is unusual but
    // representable, and its timestamps must still raise the floor.
    const context = await cutoverContext();
    const future = '2031-05-05T05:05:05.000Z';
    await copyRelease(context.memory, PREVIOUS_VERSION, 'v-future-previous');
    const inventory = await context.memory.readVersionInventory(
      SEASON,
      'v-future-previous',
    );
    for (const name of inventory ?? []) {
      await setDocumentSourceUpdatedAt(
        context.memory,
        'v-future-previous',
        name,
        future,
      );
    }

    const result = await context.service.seed(
      checkpointFor({ previousVersion: 'v-future-previous' }),
    );
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded.seasonSnapshotObservedAtHighWaterMark).toBe(
      future,
    );
  });

  it('omits a dropped previous version from the floor', async () => {
    const context = await cutoverContext();
    const future = '2031-05-05T05:05:05.000Z';
    await copyRelease(context.memory, PREVIOUS_VERSION, 'v-future-previous');
    const inventory = await context.memory.readVersionInventory(
      SEASON,
      'v-future-previous',
    );
    for (const name of inventory ?? []) {
      await setDocumentSourceUpdatedAt(
        context.memory,
        'v-future-previous',
        name,
        future,
      );
    }
    // Its recheck fails, so both the pointer and its timestamps are removed.
    context.storage.inventory = (version, call) =>
      version === 'v-future-previous' && call > 1 ? 'throw' : 'ok';

    const result = await context.service.seed(
      checkpointFor({ previousVersion: 'v-future-previous' }),
    );
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(result.receipt.seeded.previousVersion).toBeNull();
    expect(result.receipt.seeded.seasonSnapshotObservedAtHighWaterMark).toBe(
      MIGRATION_NOW,
    );
  });

  it('starts no lower than the active release itself', async () => {
    const context = await cutoverContext();
    const result = await context.service.seed(checkpointFor());
    expect(result.kind).toBe('seeded');
    if (result.kind !== 'seeded') return;
    expect(
      result.receipt.seeded.seasonSnapshotObservedAtHighWaterMark >=
        ACTIVE_SOURCE_UPDATED_AT,
    ).toBe(true);
    expect(
      result.receipt.seeded.seasonSnapshotObservedAtHighWaterMark >=
        PREVIOUS_SOURCE_UPDATED_AT,
    ).toBe(true);
  });
});

describe('idempotence and conflict', () => {
  it('is idempotent for the identical checkpoint', async () => {
    const context = await cutoverContext();
    const first = await context.service.seed(checkpointFor());
    const second = await context.service.seed(checkpointFor());
    expect(first.kind).toBe('seeded');
    expect(second).toMatchObject({
      kind: 'seeded',
      receipt: { outcome: 'already-seeded', cutoverState: 'seeded' },
    });
  });

  it('fails closed on a conflicting checkpoint for the same season', async () => {
    const context = await cutoverContext();
    await context.service.seed(checkpointFor());
    const before = await context.port.readAuthority(SEASON);

    expect(
      await context.service.seed(
        checkpointFor({ migrationIdentity: 'cutover-2026-staging-02' }),
      ),
    ).toEqual({ kind: 'failed', failure: 'conflicting-cutover-seed' });
    // Never silently applied over an existing seed.
    expect(await context.port.readAuthority(SEASON)).toEqual(before);
  });

  it('fails closed when the checkpoint names a different active version', async () => {
    const context = await cutoverContext();
    await context.service.seed(checkpointFor());
    expect(
      await context.service.seed(
        checkpointFor({ previousVersion: PREVIOUS_VERSION }),
      ),
    ).toEqual({ kind: 'failed', failure: 'conflicting-cutover-seed' });
  });
});
