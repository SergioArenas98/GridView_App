import dataSources from '../../../../../content/attribution/data-sources.json';
import type { Env } from '../../config/environment';
import {
  ConfigurationError,
  resolveIdentityCatalogMode,
  resolveOperationalInventoryMode,
  type IdentityCatalogMode,
  type IdentityInventoryMode,
} from '../../config/environment';
import type { InventoryPolicyVersion } from '../inventory/model';
export {
  resolveIdentityCatalogMode,
  type IdentityCatalogMode,
} from '../../config/environment';
import { canonicalJson } from '../../ingest/canonical-json';
import type { Logger } from '../../logging/logger';
import type { ProviderMappingRegistry } from '../../providers/mappings/mapping-registry';
import {
  curatedParticipantsFrom,
  type CuratedParticipants,
  type CuratedDriver,
  type CuratedConstructor,
} from '../../providers/jolpica/curated-participants';
import {
  curatedCircuitsFrom,
  type CuratedCircuits,
  type CuratedCircuit,
} from '../../providers/jolpica/curated-circuits';
import type { CuratedEventNames } from '../../providers/jolpica/curated-events';
import {
  curatedSeasonMetadata,
  type CuratedSeasonMetadata,
} from '../../sync/coordinated/outcome/metadata';
import { hashIdentityProjection } from '../discovery/keys';
import { canonicalKey } from '../../providers/mappings/mapping-key';
import { within } from '../discovery/persist';
import { uuidPattern } from '../wire-decoders';
import type { IdentityNamespace } from '../client';
import { bundledIdentityContent } from './bundled-context';
import { reviewedRegistry } from './indexes';
import { catalogLimits, requireCatalog, type CatalogBinding } from './model';
import { seasonProjection, hashSeasonProjection } from './projection';
import {
  decodeRunPin,
  pinInventoryPolicyVersion,
  samePinExecution,
  type RunPin,
  type PinRequest,
} from './pin-contract';
import { verifyRevisionExport } from './revision-export';
import type { CatalogRevision } from './revision';
import { exact, freeze } from './sources';

/** Internal namespace routing only, following IdentityClient's call convention. */
const pinRequestUrl = 'https://identity-catalog/run-pin';
/**
 * Each pin attempt's deadline, response body included (ADR 0031, amended
 * 2026-11-23). The catalog object rebuilds the canonical lineage on every pin,
 * so its cost grows with the active revision's history: staging's three-
 * revision catalog R2 took 4.4 s, and two 2 s attempts both failed. Both
 * attempts still consume the 240 s coordination budget.
 */
const pinAttemptTimeoutMs = 10_000;
export class CatalogAdmissionError extends Error {
  constructor(readonly failure: 'catalog-unavailable' | 'catalog-invalid') {
    super(failure);
  }
}
export interface IdentityContextConfiguration {
  readonly mode: IdentityCatalogMode;
  readonly installationId?: string;
  readonly namespace?: IdentityNamespace;
  /**
   * The operational inventory policy for every run admitted under this
   * configuration. `optional-drivers` (U10) is representable only with
   * runtime catalog mode, a UUID installation and a catalog binding; it is
   * refused while parsing configuration otherwise. Absent (direct test
   * wiring) means strict.
   */
  readonly inventoryMode?: IdentityInventoryMode;
}
export function identityConfiguration(
  env: Pick<
    Env,
    | 'IDENTITY_CATALOG_MODE'
    | 'IDENTITY_INSTALLATION_ID'
    | 'IDENTITY_CATALOG'
    | 'IDENTITY_INVENTORY_MODE'
  >,
): IdentityContextConfiguration {
  const mode = resolveIdentityCatalogMode(env.IDENTITY_CATALOG_MODE);
  const inventoryMode = resolveOperationalInventoryMode(
    env.IDENTITY_INVENTORY_MODE,
    mode,
  );
  // Optional-driver inventory needs a complete runtime catalog authority for
  // every run: no binding or installation means no admissible pin, and that
  // is a configuration error rather than a later fallback to strict.
  if (
    inventoryMode === 'optional-drivers' &&
    (!uuidPattern.test(env.IDENTITY_INSTALLATION_ID ?? '') ||
      typeof env.IDENTITY_CATALOG?.idFromName !== 'function' ||
      typeof env.IDENTITY_CATALOG?.get !== 'function')
  )
    throw new ConfigurationError(
      'IDENTITY_INVENTORY_MODE=optional-drivers requires a catalog binding and installation.',
    );
  return Object.freeze({
    mode,
    installationId: env.IDENTITY_INSTALLATION_ID,
    namespace: env.IDENTITY_CATALOG,
    inventoryMode,
  });
}
export interface IdentityRunContext {
  readonly runId: string;
  readonly installationId: string;
  readonly mode: IdentityCatalogMode;
  readonly authority: 'bundled' | 'runtime';
  readonly season: number;
  readonly revisionId: string | null;
  readonly catalogHash: string;
  readonly seasonProjectionHash: string;
  readonly effectiveSeasonProjection: ReturnType<typeof seasonProjection>;
  readonly datasetVersion: string;
  readonly registry: ProviderMappingRegistry;
  readonly canonicalProfiles: {
    readonly drivers: readonly CuratedDriver[];
    readonly constructors: readonly CuratedConstructor[];
    readonly circuits: readonly CuratedCircuit[];
    readonly events: readonly { id: string; name: string }[];
  };
  readonly verifiedBindings: readonly Pick<
    CatalogBinding,
    'key' | 'targetId'
  >[];
  readonly participants: CuratedParticipants;
  readonly circuits: CuratedCircuits;
  readonly events: CuratedEventNames;
  readonly baseContentReferences: readonly {
    readonly path: string;
    readonly semanticHash: string;
  }[];
  readonly baseContentDigest: string;
  readonly seasonMetadata: CuratedSeasonMetadata | null;
  /** The run's single admitted inventory policy (U6/U10 provenance). */
  readonly inventoryPolicyVersion: InventoryPolicyVersion;
  readonly pin: RunPin | null;
  readonly comparison: 'equal' | 'different' | 'unavailable' | null;
}
const admitted = new WeakSet<object>();
function seal(context: IdentityRunContext): IdentityRunContext {
  freeze(context);
  admitted.add(context);
  return context;
}
export function assertIdentityRunContext(context: IdentityRunContext): void {
  if (!admitted.has(context))
    throw new CatalogAdmissionError('catalog-invalid');
}
/** Keep the established resolver implementation in a closure. Even a runtime
 * cast cannot get its internal Map and mutate a run's verified bindings. */
function sealedRegistry(
  registry: ProviderMappingRegistry,
): ProviderMappingRegistry {
  const view = Object.create(
    Object.getPrototypeOf(registry),
  ) as ProviderMappingRegistry;
  Object.defineProperties(view, {
    isValid: { value: registry.isValid, enumerable: true },
    size: { value: registry.size, enumerable: true },
    problems: { value: registry.problems, enumerable: true },
    resolve: { value: registry.resolve.bind(registry) },
    resolveUnknown: { value: registry.resolveUnknown.bind(registry) },
  });
  Object.freeze(view);
  return view;
}
function completeInputs(s: Parameters<typeof seasonProjection>[0]) {
  const ordered = <T extends { id: string }>(rows: readonly T[]) =>
    [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    canonicalProfiles: {
      drivers: ordered(s.drivers.map((d) => d.profile)),
      constructors: ordered(s.constructors),
      circuits: ordered(s.circuits),
      events: ordered(s.events),
    },
    verifiedBindings: s.bindings
      .map((b) => ({ key: b.key, targetId: b.targetId }))
      .sort((a, b) => (canonicalKey(a.key) < canonicalKey(b.key) ? -1 : 1)),
  };
}
function names(
  rows: readonly { id: string; name: string }[],
): CuratedEventNames {
  const map = new Map(rows.map((r) => [r.id, r.name]));
  // No Map mutator is exposed, even by a runtime cast.
  const result: CuratedEventNames = Object.freeze({
    size: map.size,
    get: map.get.bind(map),
    has: map.has.bind(map),
    entries: map.entries.bind(map),
    keys: map.keys.bind(map),
    values: map.values.bind(map),
    forEach: (
      callback: (value: string, key: string, map: CuratedEventNames) => void,
      thisArg?: unknown,
    ) => {
      for (const [k, v] of map) callback.call(thisArg, v, k, result);
    },
    [Symbol.iterator]: map[Symbol.iterator].bind(map),
  });
  return result;
}

export async function bundledRunContext(input: {
  runId: string;
  season: number;
  installationId?: string;
}): Promise<IdentityRunContext> {
  const content = bundledIdentityContent();
  const projection = seasonProjection(content.projectionInput, input.season);
  const metadata = curatedSeasonMetadata(input.season);
  const baseContentReferences = await Promise.all(
    content.sourceDocuments.map(async (d) => ({
      path: d.path,
      semanticHash: await hashIdentityProjection(d.document),
    })),
  );
  return seal({
    runId: input.runId,
    installationId: input.installationId ?? 'bundled-repository',
    mode: 'bundled',
    authority: 'bundled',
    season: input.season,
    revisionId: null,
    catalogHash: await hashIdentityProjection({
      format: 'gridview-bundled-context/1',
      content: content.projectionInput,
      attribution: dataSources,
    }),
    seasonProjectionHash: await hashSeasonProjection(
      content.projectionInput,
      input.season,
    ),
    effectiveSeasonProjection: projection,
    datasetVersion: metadata?.contentVersion ?? '',
    registry: sealedRegistry(content.registry),
    ...completeInputs(content.projectionInput),
    participants: content.participants,
    circuits: content.circuits,
    events: names(content.events),
    baseContentReferences: [
      ...baseContentReferences,
      {
        path: 'content/attribution/data-sources.json',
        semanticHash: await hashIdentityProjection(dataSources),
      },
    ],
    baseContentDigest: await hashIdentityProjection(content.sourceDocuments),
    seasonMetadata: metadata,
    inventoryPolicyVersion: 'strict/1',
    pin: null,
    comparison: null,
  });
}

/** Verify complete U4 lineage before exposing any lookup. A partial response is never admitted. */
export async function contextFromPin(
  input: unknown,
  request: PinRequest,
): Promise<IdentityRunContext> {
  exact(input, ['pin', 'receiptHash', 'lineage']);
  const pin = decodeRunPin(input.pin);
  requireCatalog(
    samePinExecution(pin.request, request) &&
      input.receiptHash === (await hashIdentityProjection(pin)) &&
      typeof input.lineage === 'string',
    'pin-request-integrity',
  );
  const revision = await verifyRevisionExport(input.lineage);
  return contextFromRevision(revision, request, pin);
}

/** Offline verified lineage only. No pin, namespace or network authority is created. */
export async function contextFromExport(
  lineage: string,
  input: {
    installationId: string;
    season: number;
    inventoryPolicy?: InventoryPolicyVersion;
  },
): Promise<IdentityRunContext> {
  requireCatalog(uuidPattern.test(input.installationId), 'export-installation');
  const policy = input.inventoryPolicy ?? 'strict/1';
  requireCatalog(
    policy === 'strict/1' || policy === 'optional-drivers/1',
    'export-inventory-policy',
  );
  return contextFromRevision(
    await verifyRevisionExport(lineage),
    pinRequestFor(
      {
        installationId: input.installationId,
        season: input.season,
        runId: '00000000-0000-4000-8000-000000000007',
        purpose: 'manual',
        leaseFence: null,
      },
      policy,
    ),
    null,
  );
}

/**
 * The durable pin request for one run under one policy. Strict stays the
 * exact schema-1 request; only the optional policy produces schema 2.
 */
export function pinRequestFor(
  base: Omit<PinRequest, 'schemaVersion' | 'inventoryPolicy'>,
  policy: InventoryPolicyVersion,
): PinRequest {
  return policy === 'optional-drivers/1'
    ? {
        schemaVersion: 2,
        runId: base.runId,
        installationId: base.installationId,
        season: base.season,
        purpose: base.purpose,
        leaseFence: base.leaseFence,
        inventoryPolicy: 'optional-driver-inventory-v1',
      }
    : {
        schemaVersion: 1,
        runId: base.runId,
        installationId: base.installationId,
        season: base.season,
        purpose: base.purpose,
        leaseFence: base.leaseFence,
      };
}
async function contextFromRevision(
  revision: CatalogRevision,
  request: PinRequest,
  admittedPin: RunPin | null,
): Promise<IdentityRunContext> {
  const s = revision.snapshot,
    season = s.seasonContent.find((s) => s.season === request.season);
  requireCatalog(season, 'export-season-missing');
  const pin = admittedPin ?? {
    revisionId: revision.revisionId,
    catalogHash: revision.contentHash,
    seasonProjectionHash: season.seasonProjectionHash,
    datasetVersion: season.datasetVersion,
    baseContentDigest: season.baseContentDigest,
  };
  requireCatalog(
    season &&
      revision.revisionId === pin.revisionId &&
      revision.contentHash === pin.catalogHash &&
      season.seasonProjectionHash === pin.seasonProjectionHash &&
      season.datasetVersion === pin.datasetVersion &&
      season.baseContentDigest === pin.baseContentDigest,
    'pin-context-integrity',
  );
  const registry = reviewedRegistry(s);
  requireCatalog(
    registry.isValid &&
      (await hashSeasonProjection(s, request.season)) ===
        pin.seasonProjectionHash,
    'pin-context-projection',
  );
  const baseContentReferences = await Promise.all(
    s.sourceDocuments.map(async (d) => ({
      path: d.path,
      semanticHash: await hashIdentityProjection(d.document),
    })),
  );
  // U3/U4 seal non-driver base inputs. Legal attribution remains separately deployed
  // policy; admit only the supported complete base, never merge live Git profiles.
  const supported = bundledIdentityContent();
  requireCatalog(
    season.baseContentDigest ===
      (await hashIdentityProjection(supported.sourceDocuments)),
    'unsupported-runtime-base',
  );
  const sourceMetadata = s.sourceDocuments
    .filter((d) => d.document.kind === 'season-metadata')
    .map((d) => ({ ...d.document, datasetVersion: season.datasetVersion }));
  const metadata = curatedSeasonMetadata(
    request.season,
    sourceMetadata,
    dataSources,
  );
  requireCatalog(
    metadata && metadata.seasonLabel === season.seasonLabel,
    'pin-metadata',
  );
  return seal({
    runId: request.runId,
    installationId: request.installationId,
    mode: 'runtime',
    authority: 'runtime',
    season: request.season,
    revisionId: pin.revisionId,
    catalogHash: pin.catalogHash,
    seasonProjectionHash: pin.seasonProjectionHash,
    effectiveSeasonProjection: seasonProjection(s, request.season),
    datasetVersion: pin.datasetVersion,
    registry: sealedRegistry(registry),
    ...completeInputs(s),
    participants: curatedParticipantsFrom(
      s.drivers.map((d) => d.profile),
      s.constructors,
    ),
    circuits: curatedCircuitsFrom(s.circuits),
    events: names(s.events),
    baseContentReferences: [
      ...baseContentReferences,
      {
        path: 'content/attribution/data-sources.json',
        semanticHash: await hashIdentityProjection(dataSources),
      },
    ],
    baseContentDigest: pin.baseContentDigest,
    seasonMetadata: metadata,
    inventoryPolicyVersion: pinInventoryPolicyVersion(request),
    pin: admittedPin,
    comparison: null,
  });
}

async function readPin(
  config: IdentityContextConfiguration,
  request: PinRequest,
  signal?: AbortSignal,
): Promise<IdentityRunContext> {
  if (
    !config.namespace ||
    typeof config.namespace.idFromName !== 'function' ||
    typeof config.namespace.get !== 'function' ||
    !uuidPattern.test(config.installationId ?? '')
  )
    throw new CatalogAdmissionError('catalog-unavailable');
  const attempt = async () => {
    const stub = config.namespace!.get(
      config.namespace!.idFromName('identity:' + request.installationId),
    );
    const response = await stub.fetch(pinRequestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: canonicalJson(request),
    });
    if (!response.ok) {
      if (response.status === 422 || response.status === 409)
        throw new CatalogAdmissionError('catalog-invalid');
      throw new CatalogAdmissionError('catalog-unavailable');
    }
    requireCatalog(response.body, 'pin-response-missing');
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        requireCatalog(
          size <= catalogLimits.exportBytes * 2,
          'pin-response-capacity',
        );
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes),
    ) as unknown;
  };
  let value: unknown;
  for (let n = 0; n < 2; n++) {
    if (signal?.aborted) throw new CatalogAdmissionError('catalog-unavailable');
    try {
      value = await within(attempt(), pinAttemptTimeoutMs);
      break;
    } catch (error) {
      if (
        error instanceof CatalogAdmissionError &&
        error.failure === 'catalog-invalid'
      )
        throw error;
      if (n === 1) throw new CatalogAdmissionError('catalog-unavailable');
    }
  }
  if (signal?.aborted) throw new CatalogAdmissionError('catalog-unavailable');
  try {
    return await contextFromPin(value, request);
  } catch {
    throw new CatalogAdmissionError('catalog-invalid');
  }
}

export async function admitIdentityContext(
  config: IdentityContextConfiguration | undefined,
  input: {
    runId: string;
    season: number;
    purpose: PinRequest['purpose'];
    leaseFence: number | null;
    signal?: AbortSignal;
  },
  logger: Logger,
): Promise<IdentityRunContext> {
  const mode = config?.mode ?? 'bundled';
  if (!['bundled', 'compare', 'runtime'].includes(mode))
    throw new CatalogAdmissionError('catalog-invalid');
  const inventoryMode = config?.inventoryMode ?? 'strict';
  // Defence in depth behind configuration parsing: the optional policy is a
  // runtime-only whole-run policy, never a bundled or compare one, and an
  // unknown value is never read as strict.
  if (
    (inventoryMode !== 'strict' && inventoryMode !== 'optional-drivers') ||
    (inventoryMode === 'optional-drivers' && mode !== 'runtime')
  )
    throw new CatalogAdmissionError('catalog-invalid');
  if (mode === 'bundled')
    return bundledRunContext({
      ...input,
      installationId: config?.installationId,
    });
  const request = pinRequestFor(
    {
      runId: input.runId,
      installationId: config?.installationId ?? '',
      season: input.season,
      purpose: input.purpose,
      leaseFence: input.leaseFence,
    },
    inventoryMode === 'optional-drivers' ? 'optional-drivers/1' : 'strict/1',
  );
  if (mode === 'runtime') return readPin(config!, request, input.signal);
  const bundled = await bundledRunContext({
    ...input,
    installationId: config?.installationId,
  });
  let comparison: IdentityRunContext['comparison'] = 'unavailable';
  try {
    const runtime = await readPin(config!, request, input.signal);
    const comparable = (c: IdentityRunContext) => ({
      projection: c.effectiveSeasonProjection,
      profiles: c.canonicalProfiles,
      bindings: c.verifiedBindings,
      metadata: c.seasonMetadata,
      base: c.baseContentReferences,
      datasetVersion: c.datasetVersion,
    });
    comparison =
      canonicalJson(comparable(runtime)) === canonicalJson(comparable(bundled))
        ? 'equal'
        : 'different';
  } catch {
    /* Diagnostic only. Bundled authority is explicit in compare mode. */
  }
  try {
    logger.info({
      operation: 'identity.catalog.compare',
      identityComparison: comparison,
    });
  } catch {
    /* Diagnostic only. */
  }
  return seal({ ...bundled, mode: 'compare', comparison });
}
