/**
 * U10 identity-closure test fixtures, shared by `identity-closure.test.ts`
 * (pure closure and assembly) and `identity-closure-publication.test.ts`
 * (complete guarded publication). Synthetic data only.
 */

import { expect } from 'vitest';

import type { Driver, RaceResult } from '../../../src/contract/types';
import { identityHash } from '../../../src/identity/discovery/keys';
import {
  driverInventoryProjectionDigest,
  optionalDriverInventoryPolicy,
  type DriverInventory,
  type DriverInventoryPolicy,
} from '../../../src/identity/inventory/model';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  type CoordinatedPublicationOutcome,
  type CoordinationRun,
  type ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import type {
  PinnedDriverProfiles,
  SeasonIdentityContext,
} from '../../../src/providers/coordination/season-identity-closure';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import type { PublicationResult } from '../../../src/publication/publisher';
import { splitSeasonFixture } from './split-participation-support';
import {
  FIXED_NOW,
  FakePort,
  SEASON,
  attempt,
  fullPlan,
  metadataFor,
  payloadFor,
  seasonFixture,
  type PublicationHarness,
} from './support';

export const CATALOG = `sha256:${'c'.repeat(64)}` as const;
export const OTHER_CATALOG = `sha256:${'d'.repeat(64)}` as const;
export const FIRST_AT = '2026-07-18T12:00:00.000Z';
export const SECOND_AT = '2026-07-18T13:00:00.000Z';
export const UNKNOWN_LABELS = [
  'synthetic_u10_unknown_a',
  'synthetic_u10_unknown_b',
];
/** The run's single admitted optional policy, bound to the synthetic catalog. */
export const policy: DriverInventoryPolicy =
  optionalDriverInventoryPolicy(CATALOG);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Every Jolpica profile projection carries explicit null media. */
export function withNullMedia(
  source: ProviderSeasonSource,
): ProviderSeasonSource {
  return {
    ...source,
    drivers: source.drivers.map((d) => ({ ...d, media: null })),
  };
}

/** The split season with a final race classification at `classified` only. */
export async function splitSeason(
  classified: readonly number[] = [1, 11, 12, 13],
): Promise<ProviderSeasonSource> {
  const split = withNullMedia(await splitSeasonFixture());
  const mock = await seasonFixture();
  const kept = new Set(classified);
  return {
    ...split,
    calendar: split.calendar.map((event, index) =>
      kept.has(event.round)
        ? event
        : { ...event, status: mock.calendar[index]!.status, hasResults: false },
    ),
    results: split.results.map((result) =>
      kept.has(result.round)
        ? result
        : { ...result, status: 'unavailable' as const, entries: [] },
    ),
  };
}

export function withRows(
  source: ProviderSeasonSource,
  round: number,
  map: (entries: RaceResult['entries']) => RaceResult['entries'],
): ProviderSeasonSource {
  return {
    ...source,
    results: source.results.map((r) =>
      r.round === round ? { ...r, entries: map(r.entries) } : r,
    ),
  };
}

/** The pinned profile view of a synthetic catalog holding `drivers`. */
export function profilesOf(
  drivers: readonly Driver[],
  options: {
    readonly catalogHash?: string;
    readonly unbound?: readonly string[];
    readonly missing?: readonly string[];
    readonly override?: Readonly<Record<string, Omit<Driver, 'media'>>>;
  } = {},
): PinnedDriverProfiles & { readonly lookups: string[] } {
  const lookups: string[] = [];
  const byId = new Map(
    drivers.map((d) => {
      const { media, ...profile } = d;
      void media;
      return [d.id, profile];
    }),
  );
  return {
    lookups,
    catalogHash: options.catalogHash ?? CATALOG,
    driverById(id) {
      lookups.push(id);
      if (options.missing?.includes(id)) return null;
      const profile = options.override?.[id] ?? byId.get(id);
      return profile === undefined ? null : { ...profile };
    },
    isVerifiedSeasonDriver: (id) =>
      byId.has(id) && !(options.unbound ?? []).includes(id),
  };
}

export async function accountingFor(
  inventory: readonly Driver[],
  unknown: readonly string[] = UNKNOWN_LABELS,
  catalogHash: `sha256:${string}` = CATALOG,
): Promise<DriverInventory> {
  const resolved = await Promise.all(
    inventory.map(async (d) => ({
      driverId: d.id,
      observationKeyHash: await identityHash('u10-observation:' + d.id),
    })),
  );
  const candidates = await Promise.all(
    unknown.map((label) => identityHash('u10-candidate:' + label)),
  );
  const unresolved = [...candidates]
    .sort()
    .map((candidateId) => ({ candidateId, reason: 'unmapped' as const }));
  const projection = {
    policyVersion: 1 as const,
    catalogHash,
    providerRowCount: resolved.length + unresolved.length,
    resolved,
    unresolved,
  };
  return {
    ...projection,
    projectionDigest: await driverInventoryProjectionDigest(projection),
  };
}

export interface OptionalPortOptions {
  /** The verified inventory profiles; defaults to every source driver. */
  readonly inventory?: readonly Driver[];
  readonly accounting?: DriverInventory | null;
  /** Answer `failed` instead for these resources. */
  readonly failing?: (kind: string, round?: number) => boolean;
  readonly participants?: (payload: Record<string, unknown>) => unknown;
}

/** A Jolpica port answering an optional-policy participants contribution. */
export async function optionalPort(
  source: ProviderSeasonSource,
  options: OptionalPortOptions = {},
): Promise<FakePort> {
  const inventory = options.inventory ?? source.drivers;
  const accounting =
    options.accounting === undefined
      ? await accountingFor(inventory)
      : options.accounting;
  let sequence = 0;
  return new FakePort('jolpica', (request) => {
    sequence += 1;
    const resource = request.resource;
    const round = 'round' in resource ? resource.round : undefined;
    if (options.failing?.(resource.kind, round)) {
      // Exactly what a Jolpica port answers for an unmapped required row:
      // the whole resource fails; no row is filtered out.
      return {
        outcome: 'mapping-failure',
        attempts: [attempt(`jolpica-${sequence}`)],
      } as ProviderResourceOutcome;
    }
    let payload: unknown = payloadFor(source, resource);
    if (resource.kind === 'season-participants') {
      const base: Record<string, unknown> = {
        kind: 'season-participants',
        drivers: inventory,
        constructors: source.constructors,
        driverEntries: [],
        constructorEntries: source.constructorEntries,
        ...(accounting === null ? {} : { driverInventory: accounting }),
      };
      payload = options.participants ? options.participants(base) : base;
    }
    return {
      outcome: 'candidate',
      // The real optional participants port makes two requests.
      attempts:
        resource.kind === 'season-participants'
          ? [
              attempt(`jolpica-${sequence}-drivers`),
              attempt(`jolpica-${sequence}-constructors`),
            ]
          : [attempt(`jolpica-${sequence}`)],
      payload,
    } as ProviderResourceOutcome;
  });
}

export async function coordinateOptional(
  source: ProviderSeasonSource,
  options: OptionalPortOptions = {},
  inventoryPolicy: DriverInventoryPolicy = policy,
): Promise<CoordinationRun> {
  return new MultiSourceCoordinator({
    ports: [await optionalPort(source, options)],
    logger: new CapturingLogger(),
    inventoryPolicy,
  }).coordinate({ plan: fullPlan(source) });
}

export function identityFor(
  source: ProviderSeasonSource,
  overrides: Partial<SeasonIdentityContext> = {},
): SeasonIdentityContext {
  return {
    policy,
    profiles: profilesOf(source.drivers),
    ...overrides,
  };
}

export function without(
  source: ProviderSeasonSource,
  ...ids: string[]
): Driver[] {
  return source.drivers.filter((d) => !ids.includes(d.id));
}

export const PRIVATE_MARKERS = [
  'driverInventory',
  'candidateId',
  'observationKeyHash',
  'projectionDigest',
  'unmapped',
  CATALOG,
  'sha256:',
  ...UNKNOWN_LABELS,
];

export async function expectNoPrivateLeak(value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  for (const marker of PRIVATE_MARKERS)
    expect(serialized, marker).not.toContain(marker);
  for (const label of UNKNOWN_LABELS) {
    const candidate = await identityHash('u10-candidate:' + label);
    expect(serialized).not.toContain(candidate.slice('sha256:'.length));
  }
}

export function resultOf(
  outcome: CoordinatedPublicationOutcome,
): PublicationResult {
  expect(outcome.outcome).toBe('published');
  if (outcome.outcome !== 'published') throw new Error('unreachable');
  return outcome.result;
}

export async function strictAssembled(
  source: ProviderSeasonSource,
): Promise<ProviderSeasonSource> {
  const assembly = assembleSeasonSource(
    await new MultiSourceCoordinator({
      ports: [await optionalPort(source, { accounting: null })],
      logger: new CapturingLogger(),
    }).coordinate({ plan: fullPlan(source) }),
    metadataFor(source),
  );
  if (!assembly.complete) throw new Error(`no seed: ${assembly.gap}`);
  return assembly.source;
}

export async function publishOptional(
  harness: PublicationHarness,
  source: ProviderSeasonSource,
  options: OptionalPortOptions = {},
  at = FIRST_AT,
  identity: SeasonIdentityContext = identityFor(source),
): Promise<CoordinatedPublicationOutcome> {
  return new CoordinatedSeasonPublication({
    commands: harness.commands,
    logger: harness.logger,
    identity,
  }).publish(
    await coordinateOptional(source, options),
    { ...metadataFor(source), sourceUpdatedAt: at },
    FIXED_NOW,
    'caller-version',
  );
}

export async function storedDocuments(
  harness: PublicationHarness,
  version: string,
) {
  const names =
    (await harness.storage.readVersionInventory(SEASON, version)) ?? [];
  return Promise.all(
    [...names].map((n) =>
      harness.storage.readVersionedDocument(SEASON, version, n),
    ),
  );
}

export async function expectUnchanged(
  harness: PublicationHarness,
  version: string,
  before: unknown,
): Promise<void> {
  expect(harness.activeVersion()).toBe(version);
  expect(await storedDocuments(harness, version)).toEqual(before);
}
