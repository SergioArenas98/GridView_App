/**
 * Publication as a phase transition, and what each phase does when its
 * infrastructure fails.
 *
 * There is exactly one irreversible step: `setActiveVersion`. Before it the new
 * release is not serving; after it, it is. That single fact decides how every
 * failure must be reported, and only `SnapshotPublisher` knows which side of it
 * a run ended on - which is why the publisher, not its callers, is where
 * operational failures are converted into bounded results.
 *
 * - **Pre-commit** (reads, validation, inactive writes, bookkeeping pointers):
 *   nothing is serving, so a failure returns `failed`, leaves the previous
 *   active pointer alone, leaves the partial version inactive and purges
 *   nothing.
 * - **Commit** (`setActiveVersion`): the final storage write.
 * - **Post-commit** (cache purge): cannot un-publish. A purge failure is
 *   `applied` with `cachePurge: 'failed'`, never a failure implying the old
 *   release still serves.
 */

import { describe, expect, it } from 'vitest';

import {
  MemoryCachePurgeAdapter,
  type CachePurgeAdapter,
  type CachePurgeResult,
} from '../../src/cache/purge';
import { CapturingLogger } from '../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  type CoordinationRun,
} from '../../src/providers/coordination';
import {
  SnapshotPublisher,
  cachePurgeDispositions,
  publicationReasons,
  type PublicationResult,
} from '../../src/publication/publisher';
import { MemorySnapshotStorage } from '../../src/storage/local';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../src/storage/types';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import type { SnapshotValidator } from '../../src/validation/snapshot-validator';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import type { GeneratedSnapshotSet } from '../../src/snapshots/generator';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import { SynchronizationService } from '../../src/sync/sync-service';
import { createHarness } from '../support/edge-harness';
import {
  FIXED_NOW,
  SEASON,
  completePort,
  fullPlan,
  metadataFor,
  seasonFixture,
} from '../providers/coordination/support';

const PRIOR = 'v0';
const NEXT = 'v1';
const PRIOR_UPDATED_AT = '2026-07-01T00:00:00.000Z';

/** Storage methods a publication run depends on. */
type StorageMethod =
  | 'getActiveVersion'
  | 'readVersionedDocument'
  | 'writeVersionedDocument'
  | 'readVersionInventory'
  | 'writeVersionInventory'
  | 'setPreviousVersion'
  | 'setContentMetadata'
  | 'setCurrentSeason'
  | 'setActiveVersion'
  | 'deleteUnpublishedVersion';

/**
 * A real in-memory storage that can be armed to reject the *n*-th call of one
 * named method.
 *
 * Arming happens after seeding, so a prior release can be published normally
 * first. That is what makes the `activeSourceUpdatedAt` read and the
 * `setPreviousVersion` write genuinely reachable: both are skipped entirely
 * when nothing is active yet.
 */
class ArmableStorage implements SnapshotStorage {
  private readonly inner = new MemorySnapshotStorage();
  private readonly counts = new Map<StorageMethod, number>();
  private armed: { method: StorageMethod; onCall: number } | null = null;
  readonly calls: StorageMethod[] = [];

  arm(method: StorageMethod, onCall = 1): void {
    this.armed = { method, onCall };
    this.counts.clear();
    this.calls.length = 0;
  }

  private async guard(method: StorageMethod): Promise<void> {
    this.calls.push(method);
    const next = (this.counts.get(method) ?? 0) + 1;
    this.counts.set(method, next);
    if (this.armed?.method === method && next === this.armed.onCall) {
      throw new Error(`KV outage in ${method} for gridview://secret-key`);
    }
  }

  async writeVersionedDocument(
    season: number,
    version: string,
    document: StoredSnapshot,
  ): Promise<void> {
    await this.guard('writeVersionedDocument');
    return this.inner.writeVersionedDocument(season, version, document);
  }
  async readVersionedDocument(
    season: number,
    version: string,
    documentName: SnapshotDocumentName,
  ): Promise<StoredSnapshot | null> {
    await this.guard('readVersionedDocument');
    return this.inner.readVersionedDocument(season, version, documentName);
  }
  async readVersionInventory(
    season: number,
    version: string,
  ): Promise<SnapshotDocumentName[] | null> {
    await this.guard('readVersionInventory');
    return this.inner.readVersionInventory(season, version);
  }
  async writeVersionInventory(
    season: number,
    version: string,
    documentNames: readonly SnapshotDocumentName[],
  ): Promise<void> {
    await this.guard('writeVersionInventory');
    return this.inner.writeVersionInventory(season, version, documentNames);
  }
  async getActiveVersion(season: number): Promise<string | null> {
    await this.guard('getActiveVersion');
    return this.inner.getActiveVersion(season);
  }
  async setActiveVersion(season: number, version: string): Promise<void> {
    await this.guard('setActiveVersion');
    return this.inner.setActiveVersion(season, version);
  }
  async getPreviousVersion(season: number): Promise<string | null> {
    return this.inner.getPreviousVersion(season);
  }
  async setPreviousVersion(
    season: number,
    version: string | null,
  ): Promise<void> {
    await this.guard('setPreviousVersion');
    return this.inner.setPreviousVersion(season, version);
  }
  getCurrentSeason(): Promise<number | null> {
    return this.inner.getCurrentSeason();
  }
  async setCurrentSeason(season: number): Promise<void> {
    await this.guard('setCurrentSeason');
    return this.inner.setCurrentSeason(season);
  }
  getSyncState(season: number): ReturnType<SnapshotStorage['getSyncState']> {
    return this.inner.getSyncState(season);
  }
  setSyncState(
    season: number,
    state: Parameters<SnapshotStorage['setSyncState']>[1],
  ): Promise<void> {
    return this.inner.setSyncState(season, state);
  }
  getQuotaState(
    sourceId: Parameters<SnapshotStorage['getQuotaState']>[0],
  ): ReturnType<SnapshotStorage['getQuotaState']> {
    return this.inner.getQuotaState(sourceId);
  }
  setQuotaState(
    sourceId: Parameters<SnapshotStorage['setQuotaState']>[0],
    state: Parameters<SnapshotStorage['setQuotaState']>[1],
  ): Promise<void> {
    return this.inner.setQuotaState(sourceId, state);
  }
  getContentMetadata(): ReturnType<SnapshotStorage['getContentMetadata']> {
    return this.inner.getContentMetadata();
  }
  async setContentMetadata(
    metadata: Parameters<SnapshotStorage['setContentMetadata']>[0],
  ): Promise<void> {
    await this.guard('setContentMetadata');
    return this.inner.setContentMetadata(metadata);
  }
  listVersions(season: number): Promise<string[]> {
    return this.inner.listVersions(season);
  }
  async deleteUnpublishedVersion(
    season: number,
    version: string,
  ): Promise<void> {
    await this.guard('deleteUnpublishedVersion');
    return this.inner.deleteUnpublishedVersion(season, version);
  }
}

/** A purge adapter that fails like an outage, not by reporting `ok: false`. */
class ExplodingPurger implements CachePurgeAdapter {
  calls = 0;
  constructor(private readonly mode: 'throw' | 'reject') {}
  purgePublicUrls(urls: string[]): Promise<CachePurgeResult> {
    this.calls += 1;
    if (this.mode === 'throw') {
      throw new Error(`purge exploded for ${urls[0] ?? 'nothing'}`);
    }
    return Promise.reject(new Error('purge network failure'));
  }
}

/** A purge adapter that counts calls but always succeeds. */
class CountingPurger extends MemoryCachePurgeAdapter {
  calls = 0;
  override purgePublicUrls(urls: string[]): Promise<CachePurgeResult> {
    this.calls += 1;
    return super.purgePublicUrls(urls);
  }
}

const throwingValidator: SnapshotValidator = {
  validate() {
    throw new Error('validator exploded on gridview://secret-key');
  },
};

function publisherFor(
  storage: SnapshotStorage,
  purger: CachePurgeAdapter,
  logger: CapturingLogger,
  validator: SnapshotValidator = runtimeSnapshotValidator,
): SnapshotPublisher {
  return new SnapshotPublisher(
    storage,
    validator,
    purger,
    logger,
    'https://api.gridview.test',
  );
}

function setFor(
  source: ProviderSeasonSource,
  version: string,
  sourceUpdatedAt = source.sourceUpdatedAt,
): GeneratedSnapshotSet {
  return generateSnapshotSet(
    { ...source, sourceUpdatedAt },
    FIXED_NOW,
    version,
  );
}

/** Publishes `v0` normally, so a later run has a real prior release. */
async function seeded(
  source: ProviderSeasonSource,
): Promise<{ storage: ArmableStorage; logger: CapturingLogger }> {
  const storage = new ArmableStorage();
  const logger = new CapturingLogger();
  const first = await publisherFor(
    storage,
    new MemoryCachePurgeAdapter(),
    logger,
  ).publish(setFor(source, PRIOR, PRIOR_UPDATED_AT));
  expect(first.status).toBe('applied');
  expect(await storage.getActiveVersion(SEASON)).toBe(PRIOR);
  return { storage, logger };
}

/** Runs an operation and reports whether it returned or rejected. */
async function settle<T>(
  operation: () => Promise<T>,
): Promise<{ rejected: boolean; value?: T }> {
  try {
    return { rejected: false, value: await operation() };
  } catch {
    return { rejected: true };
  }
}

describe('every pre-commit phase returns a bounded failed result', () => {
  const phases: { method: StorageMethod; onCall: number; label: string }[] = [
    { method: 'getActiveVersion', onCall: 1, label: 'active-version read' },
    {
      method: 'readVersionedDocument',
      onCall: 1,
      label: 'active-source-updated-at read',
    },
    {
      method: 'writeVersionedDocument',
      onCall: 1,
      label: 'first inactive write',
    },
    {
      method: 'writeVersionedDocument',
      onCall: 5,
      label: 'later inactive write',
    },
    {
      method: 'writeVersionInventory',
      onCall: 1,
      label: 'exact inventory write',
    },
    {
      // Call 1 is the replaced version's inventory, read for the withdrawn
      // routes. That one is a cache concern and is contained as a failed purge
      // on an applied publication, not as a pre-commit failure - it is pinned
      // in `withdrawn-route-invalidation.test.ts` instead. The completeness
      // read this phase names is the one inside the write block.
      method: 'readVersionInventory',
      onCall: 2,
      label: 'completeness inventory read',
    },
    {
      method: 'readVersionedDocument',
      onCall: 2,
      label: 'version-complete document read',
    },
    { method: 'setContentMetadata', onCall: 1, label: 'content metadata' },
    { method: 'setCurrentSeason', onCall: 1, label: 'current season' },
    { method: 'setActiveVersion', onCall: 1, label: 'active pointer commit' },
  ];

  it('contains every phase, preserves the prior release and never purges', async () => {
    const source = await seasonFixture();

    for (const phase of phases) {
      const { storage, logger } = await seeded(source);
      const purger = new CountingPurger();
      storage.arm(phase.method, phase.onCall);

      const outcome = await settle(() =>
        publisherFor(storage, purger, logger).publish(setFor(source, NEXT)),
      );

      expect(outcome.rejected, `${phase.label} must not reject`).toBe(false);
      expect(outcome.value?.status, phase.label).toBe('failed');
      expect(publicationReasons as readonly string[], phase.label).toContain(
        String(outcome.value?.reason),
      );
      // The commit point was never crossed: the prior release still serves.
      expect(await storage.getActiveVersion(SEASON), phase.label).toBe(PRIOR);
      expect(purger.calls, `${phase.label} must not purge`).toBe(0);
      expect(outcome.value?.cachePurge, phase.label).toBe('not-required');
    }
  });

  it('genuinely reaches the active-source read and the previous pointer', async () => {
    const source = await seasonFixture();
    const { storage, logger } = await seeded(source);
    const purger = new CountingPurger();
    storage.arm('deleteUnpublishedVersion', 99);

    await publisherFor(storage, purger, logger).publish(setFor(source, NEXT));

    // Both are skipped entirely when nothing is active, so their presence here
    // is what proves the seeded prior release exercised them. The previous
    // pointer is now written *after* the commit, so it is post-commit
    // maintenance rather than a pre-commit phase.
    expect(storage.calls).toContain('readVersionedDocument');
    expect(storage.calls).toContain('setPreviousVersion');
    expect(storage.calls.indexOf('setPreviousVersion')).toBeGreaterThan(
      storage.calls.indexOf('setActiveVersion'),
    );
  });

  it('leaves both pointers untouched when the commit itself fails', async () => {
    const source = await seasonFixture();
    const { storage, logger } = await seeded(source);
    storage.arm('setActiveVersion', 1);

    const outcome = await settle(() =>
      publisherFor(storage, new CountingPurger(), logger).publish(
        setFor(source, NEXT),
      ),
    );

    expect(outcome.value?.status).toBe('failed');
    expect(await storage.getActiveVersion(SEASON)).toBe(PRIOR);
    // Writing `previous` before the commit would have overwritten the only
    // version a default rollback can reach with the one still serving.
    expect(await storage.getPreviousVersion(SEASON)).toBeNull();
    expect(storage.calls).not.toContain('setPreviousVersion');
  });

  it('contains an idempotency read rejection', async () => {
    const source = await seasonFixture();
    const { storage, logger } = await seeded(source);
    storage.arm('readVersionInventory', 1);

    // Republishing the active version drives the completed-version read.
    const outcome = await settle(() =>
      publisherFor(storage, new CountingPurger(), logger).publish(
        setFor(source, PRIOR, PRIOR_UPDATED_AT),
      ),
    );

    expect(outcome.rejected).toBe(false);
    expect(outcome.value?.status).toBe('failed');
    expect(outcome.value?.reason).toBe('storage-read');
    expect(await storage.getActiveVersion(SEASON)).toBe(PRIOR);
  });

  it('contains a validator that throws, as an operational failure', async () => {
    const source = await seasonFixture();
    const { storage, logger } = await seeded(source);
    const purger = new CountingPurger();

    const outcome = await settle(() =>
      publisherFor(storage, purger, logger, throwingValidator).publish(
        setFor(source, NEXT),
      ),
    );

    expect(outcome.rejected).toBe(false);
    // A validator that *throws* is a broken dependency, not a document that
    // failed its contract. `rejected` would tell the synchronization service
    // the candidate was examined and declined, which is exactly what did not
    // happen.
    expect(outcome.value?.status).toBe('failed');
    expect(outcome.value?.reason).toBe('contract-validation');
    expect(await storage.getActiveVersion(SEASON)).toBe(PRIOR);
    expect(purger.calls).toBe(0);
  });

  it('still reports a validator that returns issues as rejected', async () => {
    const source = await seasonFixture();
    const { storage, logger } = await seeded(source);
    const purger = new CountingPurger();
    const reportingValidator: SnapshotValidator = {
      validate: () => [{ path: 'data', message: 'forced contract issue' }],
    };

    const outcome = await settle(() =>
      publisherFor(storage, purger, logger, reportingValidator).publish(
        setFor(source, NEXT),
      ),
    );

    expect(outcome.rejected).toBe(false);
    expect(outcome.value?.status).toBe('rejected');
    expect(outcome.value?.reason).toBe('contract-validation');
    expect(await storage.getActiveVersion(SEASON)).toBe(PRIOR);
    expect(purger.calls).toBe(0);
  });

  it('keeps the original failure when cleanup also rejects', async () => {
    const source = await seasonFixture();
    const { storage, logger } = await seeded(source);
    const purger = new CountingPurger();
    // The write fails; the compensating delete then fails too.
    storage.arm('writeVersionedDocument', 1);
    const failingCleanup = new Proxy(storage, {
      get(target, property, receiver) {
        if (property === 'deleteUnpublishedVersion') {
          return async (): Promise<void> => {
            throw new Error('cleanup outage for gridview://secret-key');
          };
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    }) as unknown as SnapshotStorage;

    const outcome = await settle(() =>
      publisherFor(failingCleanup, purger, logger).publish(
        setFor(source, NEXT),
      ),
    );

    expect(outcome.rejected, 'cleanup rejection must not escape').toBe(false);
    // The classification is the one from the phase that actually failed.
    expect(outcome.value?.status).toBe('failed');
    expect(outcome.value?.reason).toBe('storage-write');
    expect(await storage.getActiveVersion(SEASON)).toBe(PRIOR);
    expect(purger.calls).toBe(0);
  });
});

describe('the commit point is the final storage write', () => {
  it('writes the active pointer last', async () => {
    const source = await seasonFixture();
    const { storage, logger } = await seeded(source);
    storage.arm('deleteUnpublishedVersion', 99);

    await publisherFor(storage, new CountingPurger(), logger).publish(
      setFor(source, NEXT),
    );

    // The commit point is the last write that decides *what serves*. Only the
    // post-commit `previous` pointer maintenance may follow it, and that write
    // can no longer precede it - which is what keeps a failed commit from
    // destroying the recovery path.
    const decisive = storage.calls.filter(
      (call) =>
        call === 'writeVersionedDocument' ||
        call === 'writeVersionInventory' ||
        call === 'setContentMetadata' ||
        call === 'setCurrentSeason' ||
        call === 'setActiveVersion',
    );
    expect(decisive.at(-1)).toBe('setActiveVersion');
    expect(decisive.filter((call) => call === 'setActiveVersion')).toHaveLength(
      1,
    );
    expect(storage.calls.at(-1)).toBe('setPreviousVersion');
  });

  it('attempts no rollback after committing', async () => {
    const source = await seasonFixture();
    const { storage, logger } = await seeded(source);
    storage.arm('deleteUnpublishedVersion', 99);

    const result = await publisherFor(
      storage,
      new ExplodingPurger('reject'),
      logger,
    ).publish(setFor(source, NEXT));

    expect(result.status).toBe('applied');
    // Nothing tried to undo the commit: the new version is still active and
    // no compensating delete of it was issued.
    expect(await storage.getActiveVersion(SEASON)).toBe(NEXT);
    expect(storage.calls).not.toContain('deleteUnpublishedVersion');
  });
});

describe('a post-commit purge failure stays published', () => {
  for (const mode of ['throw', 'reject'] as const) {
    it(`reports published with a bounded warning when the purge ${mode}s`, async () => {
      const source = await seasonFixture();
      const { storage, logger } = await seeded(source);
      const purger = new ExplodingPurger(mode);

      const outcome = await settle(() =>
        publisherFor(storage, purger, logger).publish(setFor(source, NEXT)),
      );

      expect(outcome.rejected, `purge ${mode} must not reject`).toBe(false);
      expect(outcome.value?.status).toBe('applied');
      expect(outcome.value?.cachePurge).toBe('failed');
      expect(outcome.value?.cachePurgeOk).toBe(false);
      expect(outcome.value?.reason).toBe('cache-purge-failed');
      // The release really is serving. Saying otherwise would be false.
      expect(await storage.getActiveVersion(SEASON)).toBe(NEXT);
      expect(purger.calls).toBe(1);
    });
  }

  it('reports ordinary success when the purge succeeds', async () => {
    const source = await seasonFixture();
    const { storage, logger } = await seeded(source);
    const purger = new CountingPurger();

    const result = await publisherFor(storage, purger, logger).publish(
      setFor(source, NEXT),
    );

    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('succeeded');
    expect(result.cachePurgeOk).toBe(true);
    expect(result.reason).toBeNull();
    expect(purger.calls).toBe(1);
    expect(await storage.getActiveVersion(SEASON)).toBe(NEXT);
  });

  it('keeps the purge disposition and reason inside closed domains', async () => {
    const source = await seasonFixture();
    const observed: PublicationResult[] = [];
    for (const purger of [
      new CountingPurger(),
      new ExplodingPurger('reject'),
    ]) {
      const { storage, logger } = await seeded(source);
      observed.push(
        await publisherFor(storage, purger, logger).publish(
          setFor(source, NEXT),
        ),
      );
    }

    for (const result of observed) {
      expect(cachePurgeDispositions as readonly string[]).toContain(
        result.cachePurge,
      );
      if (result.reason !== null) {
        expect(publicationReasons as readonly string[]).toContain(
          result.reason,
        );
      }
    }
  });
});

describe('publication reports nothing raw', () => {
  it('keeps outage text, keys and payloads out of results and logs', async () => {
    const source = await seasonFixture();

    for (const arm of [
      { method: 'getActiveVersion' as const, purger: new CountingPurger() },
      { method: 'setActiveVersion' as const, purger: new CountingPurger() },
    ]) {
      const { storage, logger } = await seeded(source);
      storage.arm(arm.method, 1);
      const result = await publisherFor(storage, arm.purger, logger).publish(
        setFor(source, NEXT),
      );
      const text = `${logger.serialized()}${JSON.stringify(result)}`;
      expect(text).not.toContain('KV outage');
      expect(text).not.toContain('secret-key');
      expect(text).not.toContain('max-verstappen');
    }

    const { storage, logger } = await seeded(source);
    const result = await publisherFor(
      storage,
      new ExplodingPurger('throw'),
      logger,
    ).publish(setFor(source, NEXT));
    const text = `${logger.serialized()}${JSON.stringify(result)}`;
    expect(text).not.toContain('purge exploded');
    expect(text).not.toContain('Error');
  });

  it('stays truthful for an ordinary idempotent republication', async () => {
    const source = await seasonFixture();
    const { storage, logger } = await seeded(source);
    const purger = new CountingPurger();

    const result = await publisherFor(storage, purger, logger).publish(
      setFor(source, PRIOR, PRIOR_UPDATED_AT),
    );

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('idempotent');
    expect(result.cachePurge).toBe('not-required');
    expect(purger.calls).toBe(0);
    expect(await storage.getActiveVersion(SEASON)).toBe(PRIOR);
  });
});

describe('coordinated publication returns for every operational failure', () => {
  async function completedRun(
    source: ProviderSeasonSource,
  ): Promise<CoordinationRun> {
    return new MultiSourceCoordinator({
      ports: [completePort('jolpica', source)],
      logger: new CapturingLogger(),
    }).coordinate({ plan: fullPlan(source) });
  }

  it('never rejects, whichever phase fails', async () => {
    const source = await seasonFixture();
    const run = await completedRun(source);

    const cases: {
      label: string;
      arm?: StorageMethod;
      purger: CachePurgeAdapter;
      validator?: SnapshotValidator;
    }[] = [
      {
        label: 'active-version read',
        arm: 'getActiveVersion',
        purger: new CountingPurger(),
      },
      {
        label: 'inactive write',
        arm: 'writeVersionedDocument',
        purger: new CountingPurger(),
      },
      {
        label: 'active pointer',
        arm: 'setActiveVersion',
        purger: new CountingPurger(),
      },
      { label: 'purge rejects', purger: new ExplodingPurger('reject') },
      { label: 'purge throws', purger: new ExplodingPurger('throw') },
      {
        label: 'validator throws',
        purger: new CountingPurger(),
        validator: throwingValidator,
      },
    ];

    for (const entry of cases) {
      const { storage, logger } = await seeded(source);
      if (entry.arm) storage.arm(entry.arm, 1);
      const boundary = new CoordinatedSeasonPublication({
        publisher: publisherFor(storage, entry.purger, logger, entry.validator),
        logger,
      });

      const outcome = await settle(() =>
        boundary.publish(run, metadataFor(source), FIXED_NOW, NEXT),
      );

      expect(outcome.rejected, `${entry.label} must return`).toBe(false);
      expect(outcome.value?.outcome, entry.label).toBe('published');
      const serialized = logger.serialized();
      expect(serialized).not.toContain('KV outage');
      expect(serialized).not.toContain('secret-key');
      expect(serialized).not.toContain('purge exploded');
    }
  });

  it('never reports a committed publication as withheld', async () => {
    const source = await seasonFixture();
    const run = await completedRun(source);
    const { storage, logger } = await seeded(source);

    const outcome = await new CoordinatedSeasonPublication({
      publisher: publisherFor(storage, new ExplodingPurger('reject'), logger),
      logger,
    }).publish(run, metadataFor(source), FIXED_NOW, NEXT);

    expect(outcome.outcome).toBe('published');
    if (outcome.outcome === 'published') {
      expect(outcome.result.status).toBe('applied');
      expect(outcome.result.cachePurge).toBe('failed');
    }
    expect(await storage.getActiveVersion(SEASON)).toBe(NEXT);
  });

  it('keeps a pre-commit failure as a truthful failed publication', async () => {
    const source = await seasonFixture();
    const run = await completedRun(source);
    const { storage, logger } = await seeded(source);
    storage.arm('setActiveVersion', 1);

    const outcome = await new CoordinatedSeasonPublication({
      publisher: publisherFor(storage, new CountingPurger(), logger),
      logger,
    }).publish(run, metadataFor(source), FIXED_NOW, NEXT);

    expect(outcome.outcome).toBe('published');
    if (outcome.outcome === 'published') {
      expect(outcome.result.status).toBe('failed');
    }
    // Last known good survives.
    expect(await storage.getActiveVersion(SEASON)).toBe(PRIOR);
  });

  it('keeps cancellation distinct from any publication failure', async () => {
    const source = await seasonFixture();
    const { storage, logger } = await seeded(source);
    const controller = new AbortController();
    controller.abort();
    const cancelled = await new MultiSourceCoordinator({
      ports: [completePort('jolpica', source)],
      logger,
    }).coordinate({ plan: fullPlan(source), signal: controller.signal });

    const outcome = await new CoordinatedSeasonPublication({
      publisher: publisherFor(storage, new CountingPurger(), logger),
      logger,
    }).publish(cancelled, metadataFor(source), FIXED_NOW, NEXT);

    expect(cancelled.status).toBe('cancelled');
    expect(outcome.outcome).toBe('withheld');
    if (outcome.outcome === 'withheld') {
      expect(outcome.gap).toBe('run-not-completed');
    }
    expect(await storage.getActiveVersion(SEASON)).toBe(PRIOR);
  });
});

describe('the public contract is untouched by the purge disposition', () => {
  it('adds no public field and no fixture change', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const repoRoot = join(__dirname, '..', '..', '..', '..');
    const openapi = readFileSync(
      join(repoRoot, 'docs', 'api', 'gridview-api-v1.yaml'),
      'utf8',
    );
    for (const marker of ['cachePurge', 'not-required', 'purgeDisposition']) {
      expect(openapi, `OpenAPI must not contain ${marker}`).not.toContain(
        marker,
      );
    }

    const fixtureDir = join(
      repoRoot,
      'services',
      'edge-api',
      'test',
      'fixtures',
    );
    const fixtures = (readdirSync(fixtureDir, { recursive: true }) as string[])
      .map((entry) => entry.toString())
      .filter((entry) => entry.endsWith('.json'));
    expect(fixtures.length).toBeGreaterThan(0);
    for (const fixture of fixtures) {
      expect(
        readFileSync(join(fixtureDir, fixture), 'utf8'),
        fixture,
      ).not.toContain('cachePurge');
    }
  });
});

describe('a broken validator fails the synchronization', () => {
  function serviceWith(
    harness: ReturnType<typeof createHarness>,
    validator: SnapshotValidator,
  ): SynchronizationService {
    return new SynchronizationService(
      harness.storage,
      harness.provider,
      new SnapshotPublisher(
        harness.storage,
        validator,
        harness.purger,
        harness.logger,
        'https://api.gridview.test',
      ),
      harness.clock,
      harness.logger,
    );
  }

  it('reports failed and never marks due jobs successful', async () => {
    const harness = createHarness();
    const before = await harness.storage.getSyncState(SEASON);

    const result = await serviceWith(harness, throwingValidator).run({
      season: SEASON,
      trigger: 'manual-full',
      forceVersion: NEXT,
    });

    // Nothing was published, so nothing may look like a success.
    expect(result.status).toBe('failed');
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();

    const state = await harness.storage.getSyncState(SEASON);
    expect(state?.lastFailedAt).toBeTypeOf('string');
    expect(state?.lastCompletedAt ?? null).toBe(
      before?.lastCompletedAt ?? null,
    );
    for (const job of result.dueJobs) {
      expect(state?.lastSuccessByJob?.[job] ?? null, job).toBe(
        before?.lastSuccessByJob?.[job] ?? null,
      );
    }

    const events = harness.logger.events.map((event) => event.operation);
    expect(events).toContain('sync.failed');
    expect(events).not.toContain('sync.completed');
    // The validator's own exception text never reaches a log line.
    expect(harness.logger.serialized()).not.toContain('validator exploded');
    expect(harness.logger.serialized()).not.toContain('secret-key');
  });

  it('also fails the run when the validator reports issues', async () => {
    const harness = createHarness();
    const result = await serviceWith(harness, {
      validate: () => [{ path: 'data', message: 'forced contract issue' }],
    }).run({ season: SEASON, trigger: 'manual-full', forceVersion: NEXT });

    // A declined candidate publishes nothing either, but it is a *different*
    // fact: the documents were examined and did not satisfy the contract.
    expect(result.publicationStatus).toBe('rejected');
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
  });
});

describe('the synchronization service reads a purge warning truthfully', () => {
  it('does not reclassify published-with-warning as a publication failure', async () => {
    const harness = createHarness();
    // The purge fails after the active pointer has already moved.
    harness.purger.failNext = true;
    const service = new SynchronizationService(
      harness.storage,
      harness.provider,
      new SnapshotPublisher(
        harness.storage,
        runtimeSnapshotValidator,
        harness.purger,
        harness.logger,
        'https://api.gridview.test',
      ),
      harness.clock,
      harness.logger,
    );

    const result = await service.run({
      season: SEASON,
      trigger: 'manual-full',
      forceVersion: 'v1',
    });

    // The release committed, so the run completed. Reporting
    // `snapshot-publication-failure` here would claim the old release still
    // serves, which is false.
    expect(result.status).toBe('completed');
    expect(result.publicationStatus).toBe('applied');
    expect(await harness.storage.getActiveVersion(SEASON)).not.toBeNull();
  });

  it('still reports a genuine pre-commit failure as failed', async () => {
    const harness = createHarness();
    const service = new SynchronizationService(
      harness.storage,
      harness.provider,
      new SnapshotPublisher(
        harness.storage,
        { validate: () => [{ path: 'x', message: 'forced' }] },
        harness.purger,
        harness.logger,
        'https://api.gridview.test',
      ),
      harness.clock,
      harness.logger,
    );

    const result = await service.run({
      season: SEASON,
      trigger: 'manual-full',
      forceVersion: 'v1',
    });

    expect(result.publicationStatus).toBe('rejected');
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
  });
});
