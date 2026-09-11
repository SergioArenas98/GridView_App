/**
 * Scaffolding for the Integration slice's tests (Phase 9B-6b): a real
 * `MemorySnapshotStorage`, an in-process `LocalSeasonPublicationSequencer` over
 * a `MemorySequencerHost`, and a `SequencedPublicationService` wired to both.
 *
 * The sequencer is seeded and activated from an initial legacy publication -
 * the same shape ADR 0025 D12's migration would produce - so the two-phase
 * protocol runs against a realistic committed baseline. Nothing here touches a
 * Durable Object binding, a provider, Workers KV or the network.
 */

import { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import { CapturingLogger } from '../../../src/logging/logger';
import { SnapshotPublisher } from '../../../src/publication/publisher';
import {
  revisionInputForDocument,
  snapshotRevision,
} from '../../../src/publication/snapshot-revision';
import {
  LocalSeasonPublicationSequencer,
  MemorySequencerHost,
  SeasonPublicationCoordinator,
  type CutoverSeed,
  type PerKeyState,
  type SeasonPublicationSequencerPort,
} from '../../../src/publication/sequencer';
import { SequencedPublicationService } from '../../../src/publication/sequenced/service';
import { MockFormulaOneProvider } from '../../../src/providers/mock/mock-provider';
import { FixedClock } from '../../../src/runtime/clock';
import {
  generateSnapshotSet,
  type GeneratedSnapshotSet,
} from '../../../src/snapshots/generator';
import { readStoredInventory } from '../../../src/publication/version-inventory';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import type {
  SnapshotStorage,
  StoredSnapshot,
} from '../../../src/storage/types';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';

export const SEASON = 2026;
export const CUTOVER_FINGERPRINT = 'integration-cutover-2026';
export const SEED_VERSION = 'v-seed-legacy';
/** Sits behind every generated set's `sourceUpdatedAt`, so a later publish is admitted. */
export const SEED_ORDERING_INPUT = '2026-07-10T00:00:00.000Z';
export const SEED_HIGH_WATER_MARK = '2026-07-10T00:00:00.000Z';

const ALL_JOBS = [
  'season-calendar',
  'event-schedule',
  'profiles',
  'standings',
  'results',
  'home-rebuild',
] as const;

export async function generatedSet(
  clock: FixedClock,
  version: string,
  overrides: { sourceUpdatedAt?: string; contentVersion?: string } = {},
): Promise<GeneratedSnapshotSet> {
  const source = await new MockFormulaOneProvider({
    clock,
    sourceUpdatedAt: overrides.sourceUpdatedAt,
    contentVersion: overrides.contentVersion,
  }).fetchSeasonSource(SEASON, [...ALL_JOBS]);
  return generateSnapshotSet(source, clock.now().toISOString(), version);
}

export interface HexCounter {
  (): string;
}

export function hexCounter(): HexCounter {
  let next = 0;
  return () => {
    next += 1;
    return next.toString(16).padStart(8, '0');
  };
}

export interface SequencedContext {
  readonly storage: MemorySnapshotStorage;
  readonly logger: CapturingLogger;
  readonly purger: MemoryCachePurgeAdapter;
  readonly coordinator: SeasonPublicationCoordinator;
  readonly port: LocalSeasonPublicationSequencer;
  readonly service: SequencedPublicationService;
  readonly legacy: SnapshotPublisher;
  readonly clock: FixedClock;
  readonly seedSet: GeneratedSnapshotSet;
}

/**
 * A storage view over a real `MemorySnapshotStorage` with the failure knobs the
 * Integration tests need and `MemorySnapshotStorage` alone cannot produce: a
 * sidecar or inventory read that throws (ADR 0025 D8 *unreadable*, D6 degraded),
 * and a document that reads back `null` at one version (D6 propagation lag).
 */
export class SidecarReadFailingStorage implements SnapshotStorage {
  failReadFor: string | null = null;
  readonly unreadableInventories = new Set<string>();
  readonly hiddenDocuments = new Set<string>();
  readonly inventoryReads: string[] = [];

  constructor(private readonly inner: MemorySnapshotStorage) {}

  async readPublicationMetadata(
    season: number,
    version: string,
  ): Promise<unknown> {
    if (this.failReadFor === version) {
      throw new Error('simulated sidecar read failure');
    }
    return this.inner.readPublicationMetadata(season, version);
  }

  async readVersionInventory(season: number, version: string) {
    this.inventoryReads.push(version);
    if (this.unreadableInventories.has(version)) {
      throw new Error('simulated inventory read failure');
    }
    return this.inner.readVersionInventory(season, version);
  }

  async readVersionedDocument(
    season: number,
    version: string,
    documentName: import('../../../src/storage/types').SnapshotDocumentName,
  ) {
    if (this.hiddenDocuments.has(`${version}|${documentName}`)) return null;
    return this.inner.readVersionedDocument(season, version, documentName);
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
  getActiveVersion: SnapshotStorage['getActiveVersion'] = (...a) =>
    this.inner.getActiveVersion(...a);
  setActiveVersion: SnapshotStorage['setActiveVersion'] = (...a) =>
    this.inner.setActiveVersion(...a);
  getPreviousVersion: SnapshotStorage['getPreviousVersion'] = (...a) =>
    this.inner.getPreviousVersion(...a);
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
  listVersions: SnapshotStorage['listVersions'] = (...a) =>
    this.inner.listVersions(...a);
  deleteUnpublishedVersion: SnapshotStorage['deleteUnpublishedVersion'] = (
    ...a
  ) => this.inner.deleteUnpublishedVersion(...a);
}

export async function perKeyStateFor(
  documents: readonly StoredSnapshot[],
  observedAt: string,
): Promise<PerKeyState[]> {
  const states: PerKeyState[] = [];
  for (const document of documents) {
    states.push({
      documentName: document.documentName,
      revision: await snapshotRevision(revisionInputForDocument(document)),
      observedAt,
    });
  }
  return states;
}

export async function sequencedContext(
  options: { storage?: MemorySnapshotStorage } = {},
): Promise<SequencedContext> {
  const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
  const storage = options.storage ?? new MemorySnapshotStorage();
  const logger = new CapturingLogger();
  const purger = new MemoryCachePurgeAdapter();
  const legacy = new SnapshotPublisher(
    storage,
    runtimeSnapshotValidator,
    purger,
    logger,
  );

  // 1. An initial legacy publication supplies real documents and an inventory.
  const seedSet = await generatedSet(clock, SEED_VERSION, {
    sourceUpdatedAt: SEED_ORDERING_INPUT,
    contentVersion: '2026.07.10.1',
  });
  const seededPublication = await legacy.publish(seedSet);
  if (seededPublication.status !== 'applied') {
    throw new Error(
      `seed publish failed: ${JSON.stringify(seededPublication)}`,
    );
  }

  // 2. Seed + activate the sequencer from it, the way D12 migration would.
  const coordinator = new SeasonPublicationCoordinator(
    new MemorySequencerHost(),
    {
      clock,
      token: (() => {
        let n = 0;
        return () => `op-token-${(n += 1)}`;
      })(),
      opaqueVersionComponent: hexCounter(),
    },
  );
  const inventory = await readStoredInventory(storage, SEASON, SEED_VERSION);
  if (inventory.kind !== 'documents') {
    throw new Error('seed inventory not readable');
  }
  const seedDocuments: StoredSnapshot[] = [];
  for (const name of inventory.documents) {
    const document = await storage.readVersionedDocument(
      SEASON,
      SEED_VERSION,
      name,
    );
    if (document) seedDocuments.push(document);
  }
  const seed: CutoverSeed = {
    season: SEASON,
    cutoverFingerprint: CUTOVER_FINGERPRINT,
    activeVersion: SEED_VERSION,
    previousVersion: null,
    committedSourceOrderingInput: SEED_ORDERING_INPUT,
    perKeyState: await perKeyStateFor(seedDocuments, SEED_HIGH_WATER_MARK),
    seasonSnapshotObservedAtHighWaterMark: SEED_HIGH_WATER_MARK,
  };
  const seeded = coordinator.seedCutover(seed);
  if (seeded.outcome !== 'seeded') {
    throw new Error(`seedCutover: ${JSON.stringify(seeded)}`);
  }
  const activated = coordinator.activateCutover({
    season: SEASON,
    cutoverFingerprint: CUTOVER_FINGERPRINT,
  });
  if (activated.outcome !== 'activated') {
    throw new Error(`activateCutover: ${JSON.stringify(activated)}`);
  }

  const port = new LocalSeasonPublicationSequencer(coordinator);
  const service = new SequencedPublicationService({
    port,
    fallback: legacy,
    storage,
    validator: runtimeSnapshotValidator,
    purger,
    logger,
    clock,
    purgeOrigin: 'https://api.gridview.local',
  });

  return {
    storage,
    logger,
    purger,
    coordinator,
    port,
    service,
    legacy,
    clock,
    seedSet,
  };
}

/**
 * A sequencer port that records every call and, by default, reports every
 * season `uninitialized` - so a test can prove the router and the sequenced
 * service both fall back to legacy behaviour without touching the two-phase
 * protocol, and prove nothing calls the port when it should not.
 */
export interface CountingPort extends SeasonPublicationSequencerPort {
  readonly calls: string[];
}

export function countingPort(
  inner?: SeasonPublicationSequencerPort,
): CountingPort {
  const calls: string[] = [];
  const record =
    <A extends unknown[], R>(name: string, fn: (...a: A) => Promise<R>) =>
    (...args: A): Promise<R> => {
      calls.push(name);
      return fn(...args);
    };
  const uninitialized = async () =>
    ({ cutoverState: 'uninitialized', authoritative: false }) as const;
  return {
    calls,
    readAuthority: record(
      'readAuthority',
      inner ? (s: number) => inner.readAuthority(s) : uninitialized,
    ),
    prepare: record('prepare', (r) =>
      inner
        ? inner.prepare(r)
        : Promise.resolve({
            outcome: 'rejected' as const,
            reason: 'authority-not-active' as const,
          }),
    ),
    finalize: record('finalize', (r) =>
      inner
        ? inner.finalize(r)
        : Promise.resolve({
            outcome: 'rejected' as const,
            reason: 'authority-not-active' as const,
          }),
    ),
    cancel: record('cancel', (r) =>
      inner
        ? inner.cancel(r)
        : Promise.resolve({
            outcome: 'rejected' as const,
            reason: 'authority-not-active' as const,
          }),
    ),
    authorizeCleanup: record('authorizeCleanup', (r) =>
      inner
        ? inner.authorizeCleanup(r)
        : Promise.resolve({
            outcome: 'refused' as const,
            reason: 'no-current-operation' as const,
          }),
    ),
    acknowledgeCleanup: record('acknowledgeCleanup', (r) =>
      inner
        ? inner.acknowledgeCleanup(r)
        : Promise.resolve({
            outcome: 'rejected' as const,
            reason: 'identity-not-current' as const,
          }),
    ),
    seedCutover: record('seedCutover', (r) =>
      inner
        ? inner.seedCutover(r)
        : Promise.resolve({
            outcome: 'rejected' as const,
            reason: 'state-corrupt' as const,
          }),
    ),
    recoverCutoverSeed: record('recoverCutoverSeed', (r) =>
      inner
        ? inner.recoverCutoverSeed(r)
        : Promise.resolve({ outcome: 'uninitialized' as const }),
    ),
    activateCutover: record('activateCutover', (r) =>
      inner
        ? inner.activateCutover(r)
        : Promise.resolve({
            outcome: 'rejected' as const,
            reason: 'state-corrupt' as const,
          }),
    ),
  };
}
