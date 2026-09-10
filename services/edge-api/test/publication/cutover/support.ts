/**
 * Scaffolding for the staging cutover preparation tests (ADR 0025 D12).
 *
 * A real `MemorySnapshotStorage` holds two genuinely published legacy releases
 * - written by the ordinary `SnapshotPublisher`, so they carry a real
 * inventory, real documents and a real uniform `meta.sourceUpdatedAt`, and no
 * `__publication_metadata` sidecar, which is exactly the pre-cutover state D12
 * step 6's legacy fallback exists for. An in-process
 * `LocalSeasonPublicationSequencer` over a `MemorySequencerHost` stands in for
 * the Durable Object.
 *
 * Nothing here touches a Durable Object binding, Workers KV, Cloudflare, a
 * provider or the network, and every retry budget is driven by an injected
 * delay that resolves immediately, so no test sleeps.
 */

import { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import type { RuntimeConfig } from '../../../src/config/environment';
import { CapturingLogger } from '../../../src/logging/logger';
import type { PublicationAuthority } from '../../../src/publication/authority';
import { SnapshotPublisher } from '../../../src/publication/publisher';
import type { CutoverControl } from '../../../src/publication/cutover/control';
import type { CutoverCheckpoint } from '../../../src/publication/cutover/checkpoint';
import type { CutoverRetryPolicy } from '../../../src/publication/cutover/migration';
import { CutoverPreparationService } from '../../../src/publication/cutover/service';
import {
  LocalSeasonPublicationSequencer,
  MemorySequencerHost,
  SeasonPublicationCoordinator,
} from '../../../src/publication/sequencer';
import { MockFormulaOneProvider } from '../../../src/providers/mock/mock-provider';
import { FixedClock } from '../../../src/runtime/clock';
import { generateSnapshotSet } from '../../../src/snapshots/generator';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import type {
  PublicationMetadataRecord,
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../../src/storage/types';
import type { SnapshotValidator } from '../../../src/validation/snapshot-validator';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';

export const SEASON = 2026;
export const OTHER_SEASON = 2025;
export const ACTIVE_VERSION = 'v-cutover-active';
export const PREVIOUS_VERSION = 'v-cutover-previous';
/** A version in the reserved namespace, so an absent sidecar must fail closed. */
export const SIDECAR_REQUIRED_VERSION = 'pm1-0000000000001-0000000a';

export const PREVIOUS_SOURCE_UPDATED_AT = '2026-07-12T09:00:00.000Z';
export const ACTIVE_SOURCE_UPDATED_AT = '2026-07-18T11:55:00.000Z';
/** Later than both releases, so the migration clock is the ordinary floor. */
export const MIGRATION_NOW = '2026-07-20T12:00:00.000Z';

export const MIGRATION_IDENTITY = 'cutover-2026-staging-01';
export const EVIDENCE_REFERENCE = 'AUDIT-2026-07-20/staging-no-client-state';

/** Bounded, and instant: no test in this slice waits on a real delay. */
export const immediateRetry: CutoverRetryPolicy = {
  attempts: 3,
  delay: async () => {},
};

const ALL_JOBS = [
  'season-calendar',
  'event-schedule',
  'profiles',
  'standings',
  'results',
  'home-rebuild',
] as const;

export function checkpointFor(
  overrides: Partial<CutoverCheckpoint> = {},
): CutoverCheckpoint {
  return {
    season: SEASON,
    activeVersion: ACTIVE_VERSION,
    previousVersion: null,
    migrationIdentity: MIGRATION_IDENTITY,
    historicalFloorEvidence: {
      kind: 'no-retained-pre-cutover-client-state',
      evidenceReference: EVIDENCE_REFERENCE,
    },
    ...overrides,
  };
}

export type ReadOutcome = 'ok' | 'throw' | 'absent';

/**
 * A storage view that can script the exact outcome of each individual read.
 *
 * `MemorySnapshotStorage` alone cannot produce a read that *throws* (D8's
 * *unreadable*, which must never be treated as *absent*), a document that
 * disappears between two passes (D12 step 9's recheck), or a read that fails a
 * bounded number of times and then succeeds (step 3's retry budget). Each hook
 * receives the 1-based call count for that exact key, so a test states the
 * sequence it wants rather than counting internal state.
 */
export class ScriptedStorage implements SnapshotStorage {
  inventory: (version: string, call: number) => ReadOutcome = () => 'ok';
  document: (
    version: string,
    documentName: string,
    call: number,
  ) => ReadOutcome = () => 'ok';
  sidecar: (version: string, call: number) => ReadOutcome = () => 'ok';
  /**
   * Shallow patches applied to one exact `version|documentName|call` read, so a
   * test can make the step-9 recheck see a genuinely different release without
   * mutating shared state between two awaits.
   */
  readonly documentPatch = new Map<string, Partial<StoredSnapshot>>();

  readonly inventoryReads: string[] = [];
  readonly documentReads: string[] = [];
  readonly sidecarReads: string[] = [];
  readonly pointerReads: string[] = [];

  private readonly counts = new Map<string, number>();

  constructor(private readonly inner: MemorySnapshotStorage) {}

  private next(key: string): number {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return count;
  }

  async readVersionInventory(
    season: number,
    version: string,
  ): Promise<SnapshotDocumentName[] | null> {
    this.inventoryReads.push(version);
    const outcome = this.inventory(version, this.next(`inv|${version}`));
    if (outcome === 'throw') throw new Error('scripted inventory failure');
    if (outcome === 'absent') return null;
    return this.inner.readVersionInventory(season, version);
  }

  async readVersionedDocument(
    season: number,
    version: string,
    documentName: SnapshotDocumentName,
  ): Promise<StoredSnapshot | null> {
    this.documentReads.push(`${version}|${documentName}`);
    const outcome = this.document(
      version,
      documentName,
      this.next(`doc|${version}|${documentName}`),
    );
    if (outcome === 'throw') throw new Error('scripted document failure');
    if (outcome === 'absent') return null;
    const document = await this.inner.readVersionedDocument(
      season,
      version,
      documentName,
    );
    const patch = this.documentPatch.get(
      `${version}|${documentName}|${this.counts.get(`doc|${version}|${documentName}`) ?? 0}`,
    );
    if (document === null || patch === undefined) return document;
    return { ...document, ...patch };
  }

  async readPublicationMetadata(
    season: number,
    version: string,
  ): Promise<unknown> {
    this.sidecarReads.push(version);
    const outcome = this.sidecar(version, this.next(`meta|${version}`));
    if (outcome === 'throw') throw new Error('scripted sidecar failure');
    if (outcome === 'absent') return null;
    return this.inner.readPublicationMetadata(season, version);
  }

  /** Recorded so a test can prove the migration never reads a legacy pointer. */
  async getActiveVersion(season: number): Promise<string | null> {
    this.pointerReads.push(`active:${season}`);
    return this.inner.getActiveVersion(season);
  }

  async getPreviousVersion(season: number): Promise<string | null> {
    this.pointerReads.push(`previous:${season}`);
    return this.inner.getPreviousVersion(season);
  }

  /** Recorded so a test can prove no completeness claim is drawn from a scan. */
  async listVersions(season: number): Promise<string[]> {
    this.pointerReads.push(`list:${season}`);
    return this.inner.listVersions(season);
  }

  // Everything else delegates verbatim.
  writeVersionedDocument: SnapshotStorage['writeVersionedDocument'] = (...a) =>
    this.inner.writeVersionedDocument(...a);
  writeVersionInventory: SnapshotStorage['writeVersionInventory'] = (...a) =>
    this.inner.writeVersionInventory(...a);
  writePublicationMetadata: SnapshotStorage['writePublicationMetadata'] = (
    ...a
  ) => this.inner.writePublicationMetadata(...a);
  deletePublicationMetadata: SnapshotStorage['deletePublicationMetadata'] = (
    ...a
  ) => this.inner.deletePublicationMetadata(...a);
  setActiveVersion: SnapshotStorage['setActiveVersion'] = (...a) =>
    this.inner.setActiveVersion(...a);
  setPreviousVersion: SnapshotStorage['setPreviousVersion'] = (...a) =>
    this.inner.setPreviousVersion(...a);
  getCurrentSeason: SnapshotStorage['getCurrentSeason'] = (...a) =>
    this.inner.getCurrentSeason(...a);
  setCurrentSeason: SnapshotStorage['setCurrentSeason'] = (...a) =>
    this.inner.setCurrentSeason(...a);
  getSyncState: SnapshotStorage['getSyncState'] = (...a) =>
    this.inner.getSyncState(...a);
  setSyncState: SnapshotStorage['setSyncState'] = (...a) =>
    this.inner.setSyncState(...a);
  getQuotaState: SnapshotStorage['getQuotaState'] = (...a) =>
    this.inner.getQuotaState(...a);
  setQuotaState: SnapshotStorage['setQuotaState'] = (...a) =>
    this.inner.setQuotaState(...a);
  getContentMetadata: SnapshotStorage['getContentMetadata'] = (...a) =>
    this.inner.getContentMetadata(...a);
  setContentMetadata: SnapshotStorage['setContentMetadata'] = (...a) =>
    this.inner.setContentMetadata(...a);
  deleteUnpublishedVersion: SnapshotStorage['deleteUnpublishedVersion'] = (
    ...a
  ) => this.inner.deleteUnpublishedVersion(...a);
}

export interface CutoverContext {
  readonly memory: MemorySnapshotStorage;
  readonly storage: ScriptedStorage;
  readonly logger: CapturingLogger;
  readonly clock: FixedClock;
  readonly host: MemorySequencerHost;
  readonly coordinator: SeasonPublicationCoordinator;
  readonly port: LocalSeasonPublicationSequencer;
  readonly service: CutoverPreparationService;
}

export interface CutoverContextOptions {
  readonly control?: CutoverControl;
  readonly environment?: RuntimeConfig['environment'];
  readonly authority?: PublicationAuthority;
  readonly withPrevious?: boolean;
  readonly retry?: CutoverRetryPolicy;
  readonly validator?: SnapshotValidator;
}

/**
 * Accepts every document.
 *
 * The migration's own timestamp import is a second, independent check: contract
 * validation is about the public envelope, and importing a `snapshotObservedAt`
 * is about a value every later comparison must be able to order. A permissive
 * validator is how a test reaches that check rather than the validator that
 * usually rejects the same document first.
 */
export const permissiveValidator: SnapshotValidator = { validate: () => [] };

export function runtimeConfigFor(
  options: CutoverContextOptions = {},
): RuntimeConfig {
  return {
    environment: options.environment ?? 'staging',
    providerMode: 'mock',
    publicationAuthorityMode: 'sequencer',
    publicationCutoverControl: options.control ?? {
      kind: 'seed',
      season: SEASON,
    },
    publicBaseUrl: null,
  };
}

/**
 * Two published legacy releases, an in-process sequencer, and a preparation
 * service wired to both.
 *
 * `previousVersion` is published first with an older `sourceUpdatedAt`, so the
 * later active publication is admitted normally and the legacy pointers end up
 * describing exactly the pair a real cutover would face. The migration must
 * never read those pointers, and `ScriptedStorage.pointerReads` proves it.
 */
/**
 * A standalone in-process sequencer port, for a test that drives the routes
 * through the Worker rather than through a hand-built service.
 */
export function inProcessPort(): LocalSeasonPublicationSequencer {
  return new LocalSeasonPublicationSequencer(
    new SeasonPublicationCoordinator(new MemorySequencerHost(), {
      clock: new FixedClock(new Date(MIGRATION_NOW)),
    }),
  );
}

export async function cutoverContext(
  options: CutoverContextOptions = {},
): Promise<CutoverContext> {
  const clock = new FixedClock(new Date(MIGRATION_NOW));
  const memory = new MemorySnapshotStorage();
  const logger = new CapturingLogger();
  const publisher = new SnapshotPublisher(
    memory,
    runtimeSnapshotValidator,
    new MemoryCachePurgeAdapter(),
    logger,
  );

  if (options.withPrevious ?? true) {
    await publish(publisher, clock, PREVIOUS_VERSION, {
      sourceUpdatedAt: PREVIOUS_SOURCE_UPDATED_AT,
      contentVersion: '2026.07.12.1',
    });
  }
  await publish(publisher, clock, ACTIVE_VERSION, {
    sourceUpdatedAt: ACTIVE_SOURCE_UPDATED_AT,
    contentVersion: '2026.07.18.1',
  });

  const storage = new ScriptedStorage(memory);
  const host = new MemorySequencerHost();
  const coordinator = new SeasonPublicationCoordinator(host, { clock });
  const port = new LocalSeasonPublicationSequencer(coordinator);
  const service = new CutoverPreparationService({
    config: runtimeConfigFor(options),
    authority: options.authority ?? { mode: 'sequencer', port },
    storage,
    validator: options.validator ?? runtimeSnapshotValidator,
    logger,
    clock,
    retry: options.retry ?? immediateRetry,
  });

  return { memory, storage, logger, clock, host, coordinator, port, service };
}

async function publish(
  publisher: SnapshotPublisher,
  clock: FixedClock,
  version: string,
  overrides: { sourceUpdatedAt: string; contentVersion: string },
): Promise<void> {
  const source = await new MockFormulaOneProvider({
    clock,
    sourceUpdatedAt: overrides.sourceUpdatedAt,
    contentVersion: overrides.contentVersion,
  }).fetchSeasonSource(SEASON, [...ALL_JOBS]);
  const set = generateSnapshotSet(source, clock.now().toISOString(), version);
  const result = await publisher.publish(set);
  if (result.status !== 'applied') {
    throw new Error(`seed publish failed: ${JSON.stringify(result)}`);
  }
}

/** Copies one published release onto a second version identifier. */
export async function copyRelease(
  memory: MemorySnapshotStorage,
  from: string,
  to: string,
): Promise<void> {
  const inventory = await memory.readVersionInventory(SEASON, from);
  if (inventory === null) throw new Error(`no inventory for ${from}`);
  for (const name of inventory) {
    const document = await memory.readVersionedDocument(SEASON, from, name);
    if (document === null) throw new Error(`missing ${from}|${name}`);
    await memory.writeVersionedDocument(SEASON, to, document);
  }
  await memory.writeVersionInventory(SEASON, to, inventory);
}

/** Rewrites one document's `meta.sourceUpdatedAt` in place. */
export async function setDocumentSourceUpdatedAt(
  memory: MemorySnapshotStorage,
  version: string,
  documentName: SnapshotDocumentName,
  value: unknown,
): Promise<void> {
  const document = await memory.readVersionedDocument(
    SEASON,
    version,
    documentName,
  );
  if (document === null) throw new Error(`missing ${version}|${documentName}`);
  await memory.writeVersionedDocument(SEASON, version, {
    ...document,
    meta: { ...document.meta, sourceUpdatedAt: value as string },
  });
}

export async function writeSidecar(
  memory: MemorySnapshotStorage,
  version: string,
  record: PublicationMetadataRecord | Record<string, unknown>,
): Promise<void> {
  await memory.writePublicationMetadata(
    SEASON,
    version,
    record as PublicationMetadataRecord,
  );
}
