/**
 * U9: explicit optional-driver inventory and strict internal accounting
 * (design §8.1-8.4; T23, T24, T26, T28, T29, T34).
 *
 * Synthetic data only. Every transport is a scripted in-memory double, and the
 * global `fetch` throws, so nothing here can reach Jolpica, OpenF1 or a proxy.
 * The positive whole-season publication demonstration is U10's; here an
 * inventory-bearing payload is proven to be *refused* by assembly.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ConfigurationError,
  resolveIdentityInventoryMode,
  resolveOperationalInventoryMode,
} from '../../../src/config/environment';
import {
  bundledRunContext,
  identityConfiguration,
  type IdentityRunContext,
} from '../../../src/identity/catalog/run-context';
import { createIdentityObservationCollector } from '../../../src/identity/discovery/collector';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { candidateIdFor } from '../../../src/identity/discovery/keys';
import {
  captureDiscovery,
  createShadowDiscovery,
  type DiscoverySink,
} from '../../../src/identity/discovery/persist';
import {
  driverInventoryProjectionDigest,
  inventoryPolicyForContext,
  InventoryPolicyError,
  optionalDriverInventoryPolicy,
  readDriverInventoryPolicy,
  strictInventoryPolicy,
  type DriverInventory,
  type DriverInventoryPolicy,
} from '../../../src/identity/inventory/model';
import { normalizeDriverInventory } from '../../../src/identity/inventory/normalize';
import { validateDriverInventoryPayload } from '../../../src/identity/inventory/validate';
import type { IdentityPort } from '../../../src/identity/port';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatorConfigurationError,
  MultiSourceCoordinator,
  assembleSeasonSource,
  type CoordinatedResource,
  type CoordinationRun,
  type ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import { ProviderHttpClient } from '../../../src/providers/http/provider-http-client';
import {
  JolpicaCalendarPort,
  JolpicaCircuitsPort,
  JolpicaParticipantsPort,
  JolpicaResourcePort,
  JolpicaResultsPort,
  JolpicaStandingsPort,
  curatedParticipantsFrom,
  type CuratedParticipants,
} from '../../../src/providers/jolpica';
import type { ProviderMappingRegistry } from '../../../src/providers/mappings';
import { context as observationContext } from '../../identity/discovery/support';
import {
  FakePort,
  attempt,
  completePort,
  fullPlan,
  metadataFor,
  seasonFixture,
} from '../coordination/support';
import {
  CONSTRUCTORS_URL,
  DRIVERS_URL,
  SeamedClient,
  constructorRow,
  constructorsEnvelope,
  driverRow,
  driversEnvelope,
  editedRegistry,
  fullSeasonConstructorRows,
  fullSeasonDriverRows,
  registryRows,
  scriptedLimiter,
  scriptedTransport,
  type ReservationStep,
  type TransportStep,
} from './participants-support';
import { baseRows, resultsEnvelope, resultsUrl } from './results-support';
import {
  baseDriverRows,
  driverStandingsEnvelope,
  driverStandingsUrl,
} from './standings-support';
import { SEASON } from './support';

const UNKNOWN_A = 'synthetic_inventory_unknown_a';
const UNKNOWN_B = 'synthetic_inventory_unknown_b';
const UNKNOWN_C = 'synthetic_inventory_unknown_c';
const PARTICIPANTS: CoordinatedResource = {
  kind: 'season-participants',
  season: SEASON,
};

let runContext: IdentityRunContext;
let policy: DriverInventoryPolicy;

beforeEach(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('U9 network forbidden');
    }),
  );
  runContext = await bundledRunContext({
    runId: '00000000-0000-4000-8000-000000000009',
    season: SEASON,
  });
  policy = optionalDriverInventoryPolicy(runContext.catalogHash);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

interface Harness {
  readonly port: JolpicaParticipantsPort;
  readonly logger: CapturingLogger;
  readonly calls: readonly { readonly url: string }[];
  readonly reservations: readonly string[];
}

function harness(
  options: {
    readonly steps?: readonly TransportStep[];
    readonly limiter?: readonly ReservationStep[];
    readonly inventoryPolicy?: unknown;
    readonly registry?: ProviderMappingRegistry;
    readonly participants?: CuratedParticipants;
    readonly discovery?: DiscoverySink;
    readonly afterResponse?: (index: number) => void;
  } = {},
): Harness {
  const scripted = scriptedTransport(options.steps ?? []);
  const limiter = scriptedLimiter(options.limiter ?? []);
  const logger = new CapturingLogger();
  const client = new SeamedClient(
    { transport: scripted.transport, limiter: limiter.limiter, logger },
    undefined,
    options.afterResponse,
  );
  const port = new JolpicaParticipantsPort({
    client,
    logger,
    registry: options.registry ?? runContext.registry,
    participants: options.participants ?? runContext.participants,
    ...('inventoryPolicy' in options
      ? { inventoryPolicy: options.inventoryPolicy }
      : {}),
    ...(options.discovery ? { discovery: options.discovery } : {}),
  });
  return {
    port,
    logger,
    calls: scripted.calls,
    reservations: limiter.reservations,
  };
}

const driversStep = (rows: unknown, options = {}): TransportStep => ({
  kind: 'json',
  body: driversEnvelope(rows, options),
});
const constructorsStep = (
  rows: unknown = fullSeasonConstructorRows(),
): TransportStep => ({ kind: 'json', body: constructorsEnvelope(rows) });

const fetchParticipants = (h: Harness, signal?: AbortSignal) =>
  h.port.fetchResource({
    source: 'jolpica',
    resource: PARTICIPANTS,
    ...(signal ? { signal } : {}),
  });

type Candidate = Extract<ProviderResourceOutcome, { outcome: 'candidate' }>;
type ParticipantsPayloadView = {
  readonly kind: 'season-participants';
  readonly drivers: readonly { readonly id: string }[];
  readonly constructors: readonly { readonly id: string }[];
  readonly driverEntries: readonly unknown[];
  readonly constructorEntries: readonly { driverLineup: unknown }[];
  readonly driverInventory?: DriverInventory;
};

function payloadOf(outcome: ProviderResourceOutcome): ParticipantsPayloadView {
  expect(outcome.outcome).toBe('candidate');
  return (outcome as Candidate).payload as unknown as ParticipantsPayloadView;
}

function inventoryOf(outcome: ProviderResourceOutcome): DriverInventory {
  const inventory = payloadOf(outcome).driverInventory;
  expect(inventory).toBeDefined();
  return inventory!;
}

const unknownKey = (providerValue: string) => ({
  season: SEASON,
  source: 'jolpica' as const,
  entity: 'driver' as const,
  providerField: 'driverId' as const,
  providerValue,
});

const knownIds = () => runContext.participants;

describe('U9 inventory policy vocabulary', () => {
  it('defaults to strict and reads only exact closed policies', () => {
    expect(readDriverInventoryPolicy(undefined)).toBe(strictInventoryPolicy);
    expect(readDriverInventoryPolicy({ mode: 'strict' })).toEqual({
      mode: 'strict',
    });
    expect(readDriverInventoryPolicy(policy)).toEqual(policy);
    for (const bad of [
      null,
      [],
      'optional-drivers',
      { mode: 'strict', extra: true },
      { mode: 'optional-drivers', policyVersion: 1 },
      { mode: 'optional-drivers', policyVersion: 2, catalogHash: policy.mode },
      {
        mode: 'optional-drivers',
        policyVersion: 1,
        catalogHash: 'sha256:bad',
      },
      { mode: 'permissive' },
    ]) {
      expect(readDriverInventoryPolicy(bad)).toBeNull();
    }
  });

  it('never invokes an accessor-backed policy field', () => {
    const getter = vi.fn(() => 'optional-drivers');
    const hostile = Object.defineProperty({}, 'mode', {
      get: getter,
      enumerable: true,
    });
    expect(readDriverInventoryPolicy(hostile)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });

  it('derives strict from a strict context and refuses unknown or non-runtime optional versions', () => {
    // U10 widened the closed vocabulary to `optional-drivers/1` (runtime only);
    // the strict default and every unknown version keep their U9 answers.
    expect(inventoryPolicyForContext(runContext)).toBe(strictInventoryPolicy);
    expect(() =>
      inventoryPolicyForContext({ inventoryPolicyVersion: 'optional/1' }),
    ).toThrow(InventoryPolicyError);
    expect(() =>
      inventoryPolicyForContext({
        inventoryPolicyVersion: 'optional-drivers/1',
        authority: 'bundled',
        catalogHash: runContext.catalogHash,
      }),
    ).toThrow(InventoryPolicyError);
    expect(() => optionalDriverInventoryPolicy('not-a-hash')).toThrow(
      InventoryPolicyError,
    );
  });

  it('refuses malformed policies at wiring time in both the port and the coordinator', () => {
    expect(() => harness({ inventoryPolicy: { mode: 'optional' } })).toThrow(
      TypeError,
    );
    expect(
      () =>
        new MultiSourceCoordinator({
          ports: [],
          logger: new CapturingLogger(),
          inventoryPolicy: { mode: 'optional-drivers', policyVersion: 2 },
        }),
    ).toThrow(CoordinatorConfigurationError);
  });
});

describe('U9 operational gate (T35, acceptance 36-37)', () => {
  it('parses the closed vocabulary strictly with strict as default', () => {
    expect(resolveIdentityInventoryMode()).toBe('strict');
    expect(resolveIdentityInventoryMode('strict')).toBe('strict');
    expect(resolveIdentityInventoryMode('optional-drivers')).toBe(
      'optional-drivers',
    );
    for (const bad of ['', 'Strict', 'optional', 'optional-drivers ', 'on'])
      expect(() => resolveIdentityInventoryMode(bad)).toThrow(
        ConfigurationError,
      );
  });

  it('keeps optional-drivers unavailable to bundled, compare and incomplete runtime configuration', () => {
    // U10 replaced the U9 blanket refusal: runtime with a binding and an
    // installation is accepted (test/identity/catalog/inventory-policy.test.ts);
    // every configuration below still refuses it.
    expect(resolveOperationalInventoryMode(undefined, 'bundled')).toBe(
      'strict',
    );
    for (const mode of ['bundled', 'compare'] as const)
      expect(() =>
        resolveOperationalInventoryMode('optional-drivers', mode),
      ).toThrow(ConfigurationError);
    expect(identityConfiguration({}).inventoryMode).toBe('strict');
    for (const mode of ['bundled', 'compare', 'runtime'])
      expect(() =>
        identityConfiguration({
          IDENTITY_CATALOG_MODE: mode,
          IDENTITY_INVENTORY_MODE: 'optional-drivers',
        }),
      ).toThrow(ConfigurationError);
  });
});

describe('U9 containment of the optional policy and its normalizer', () => {
  it('constructs the optional policy nowhere in production source', () => {
    const root = join(__dirname, '..', '..', '..', 'src');
    const offenders = (readdirSync(root, { recursive: true }) as string[])
      .map((entry) => entry.toString().split('\\').join('/'))
      .filter((entry) => entry.endsWith('.ts'))
      .filter((entry) => entry !== 'identity/inventory/model.ts')
      .filter((entry) =>
        /optionalDriverInventoryPolicy|'optional-drivers'\s*,\s*policyVersion/.test(
          readFileSync(join(root, entry), 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
  });

  it('fails closed with a closed diagnostic when an unmapped key has no U1 candidate identity', async () => {
    const result = await normalizeDriverInventory({
      providerValues: [' refused '],
      season: SEASON,
      resolve: () => ({
        outcome: 'unresolved',
        failure: { reason: 'unmapped' },
      }),
      driverById: () => null,
      catalogHash: runContext.catalogHash as `sha256:${string}`,
      maxReportedFailures: 5,
    });
    expect(result).toEqual({
      ok: false,
      kind: 'contradiction',
      problem: 'candidate-id-refused',
    });
  });
});

describe('U9 strict-mode parity (acceptance 1, 38)', () => {
  it('keeps the strict early exit: an unknown driver ends the resource before constructors', async () => {
    for (const inventoryPolicy of [undefined, { mode: 'strict' }]) {
      const h = harness({
        inventoryPolicy,
        steps: [driversStep([...fullSeasonDriverRows(), driverRow(UNKNOWN_A)])],
      });
      const outcome = await fetchParticipants(h);
      expect(outcome).toEqual({
        outcome: 'mapping-failure',
        attempts: [
          { reference: 'jolpica-participants-1', outcome: 'successful' },
        ],
      });
      expect(h.calls.map((c) => c.url)).toEqual([DRIVERS_URL]);
      expect(h.reservations).toHaveLength(1);
    }
  });

  it('emits the identical closed strict payload with no accounting', async () => {
    const steps = [driversStep(fullSeasonDriverRows()), constructorsStep()];
    const implicit = await fetchParticipants(harness({ steps }));
    const explicit = await fetchParticipants(
      harness({ steps, inventoryPolicy: { mode: 'strict' } }),
    );
    expect(explicit).toEqual(implicit);
    expect(Object.keys(payloadOf(implicit)).sort()).toEqual([
      'constructorEntries',
      'constructors',
      'driverEntries',
      'drivers',
      'kind',
    ]);
  });
});

describe('U9 optional normalization accounts every decoded driver row (T23, T26)', () => {
  it('accounts an all-known inventory with the strict profile projection', async () => {
    const steps = [driversStep(fullSeasonDriverRows()), constructorsStep()];
    const strict = payloadOf(await fetchParticipants(harness({ steps })));
    const outcome = await fetchParticipants(
      harness({ steps, inventoryPolicy: policy }),
    );
    const payload = payloadOf(outcome);
    const inventory = inventoryOf(outcome);
    expect(payload.drivers).toEqual(strict.drivers);
    expect(payload.constructors).toEqual(strict.constructors);
    expect(payload.constructorEntries).toEqual(strict.constructorEntries);
    expect(inventory.providerRowCount).toBe(fullSeasonDriverRows().length);
    expect(inventory.unresolved).toEqual([]);
    expect(inventory.resolved.map((r) => r.driverId)).toEqual(
      payload.drivers.map((d) => d.id),
    );
    expect(inventory.catalogHash).toBe(runContext.catalogHash);
    expect(inventory.policyVersion).toBe(1);
    const { projectionDigest, ...projection } = inventory;
    expect(projectionDigest).toBe(
      await driverInventoryProjectionDigest(projection),
    );
  });

  it('accounts one valid unknown, keeps verified profiles and still makes the constructors request', async () => {
    const known = fullSeasonDriverRows();
    const h = harness({
      inventoryPolicy: policy,
      steps: [
        driversStep([...known, driverRow(UNKNOWN_A)]),
        constructorsStep(),
      ],
    });
    const outcome = await fetchParticipants(h);
    const payload = payloadOf(outcome);
    const inventory = inventoryOf(outcome);
    expect(h.calls.map((c) => c.url)).toEqual([DRIVERS_URL, CONSTRUCTORS_URL]);
    expect((outcome as Candidate).attempts).toEqual([
      { reference: 'jolpica-participants-1', outcome: 'successful' },
      { reference: 'jolpica-participants-2', outcome: 'successful' },
    ]);
    expect(h.reservations).toEqual(['jolpica', 'jolpica']);
    expect(payload.drivers).toHaveLength(known.length);
    expect(inventory.providerRowCount).toBe(known.length + 1);
    expect(inventory.unresolved).toEqual([
      {
        candidateId: await candidateIdFor(unknownKey(UNKNOWN_A)),
        reason: 'unmapped',
      },
    ]);
    // No invented identity, profile, span or team assignment (T23, T26).
    expect(payload.driverEntries).toEqual([]);
    expect(
      payload.constructorEntries.every((e) => e.driverLineup === null),
    ).toBe(true);
    expect(JSON.stringify(payload.drivers)).not.toContain(UNKNOWN_A);
    expect(JSON.stringify(h.logger.events)).not.toContain(UNKNOWN_A);
    expect(h.logger.events).toContainEqual(
      expect.objectContaining({
        operation: 'provider.participants.inventory_unresolved',
        identityUnresolvedCount: 1,
      }),
    );
  });

  it('accounts multiple and interleaved unknowns in provider order for resolved and candidate order for unresolved', async () => {
    const known = fullSeasonDriverRows();
    const rows = [
      driverRow(UNKNOWN_C),
      ...known.slice(0, 3),
      driverRow(UNKNOWN_A),
      ...known.slice(3),
      driverRow(UNKNOWN_B),
    ];
    const outcome = await fetchParticipants(
      harness({
        inventoryPolicy: policy,
        steps: [driversStep(rows), constructorsStep()],
      }),
    );
    const payload = payloadOf(outcome);
    const inventory = inventoryOf(outcome);
    expect(inventory.providerRowCount).toBe(rows.length);
    expect(inventory.resolved.length + inventory.unresolved.length).toBe(
      rows.length,
    );
    const expectedCandidates = (
      await Promise.all(
        [UNKNOWN_A, UNKNOWN_B, UNKNOWN_C].map((v) =>
          candidateIdFor(unknownKey(v)),
        ),
      )
    ).sort();
    expect(inventory.unresolved.map((u) => u.candidateId)).toEqual(
      expectedCandidates,
    );
    expect(payload.drivers.map((d) => d.id)).toEqual(
      inventory.resolved.map((r) => r.driverId),
    );
    const strict = payloadOf(
      await fetchParticipants(
        harness({ steps: [driversStep(known), constructorsStep()] }),
      ),
    );
    expect(payload.drivers).toEqual(strict.drivers);
    expect(
      new Set(inventory.resolved.map((r) => r.observationKeyHash)).size,
    ).toBe(inventory.resolved.length);
  });

  it('is deterministic: unresolved accounting is independent of unknown row order', async () => {
    const known = fullSeasonDriverRows();
    const run = async (unknowns: string[]) =>
      inventoryOf(
        await fetchParticipants(
          harness({
            inventoryPolicy: policy,
            steps: [
              driversStep([...known, ...unknowns.map((u) => driverRow(u))]),
              constructorsStep(),
            ],
          }),
        ),
      );
    const first = await run([UNKNOWN_A, UNKNOWN_B]);
    const again = await run([UNKNOWN_A, UNKNOWN_B]);
    const swapped = await run([UNKNOWN_B, UNKNOWN_A]);
    expect(again).toEqual(first);
    expect(swapped).toEqual(first);
  });
});

describe('U9 only an exact valid unmapped driver key is optional', () => {
  it('fails a duplicate unknown provider row in the decoder; no constructors request', async () => {
    const h = harness({
      inventoryPolicy: policy,
      steps: [
        driversStep([
          ...fullSeasonDriverRows(),
          driverRow(UNKNOWN_A),
          driverRow(UNKNOWN_A),
        ]),
      ],
    });
    expect(await fetchParticipants(h)).toMatchObject({
      outcome: 'failed',
      reason: 'invalid-payload',
      attempts: [{ outcome: 'successful' }],
    });
    expect(h.calls.map((c) => c.url)).toEqual([DRIVERS_URL]);
  });

  it('fails two provider aliases of one canonical driver as a contradiction, never merged', async () => {
    const [first] = runContext.verifiedBindings.filter(
      (b) => b.key.entity === 'driver' && b.key.season === SEASON,
    );
    const registry = editedRegistry((document) => {
      document.mappings.push({
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'synthetic_alias_of_first',
        gridviewId: first!.targetId,
      });
    });
    expect(registry.isValid).toBe(true);
    const h = harness({
      inventoryPolicy: policy,
      registry,
      steps: [
        driversStep([
          ...fullSeasonDriverRows(),
          driverRow('synthetic_alias_of_first'),
        ]),
      ],
    });
    expect(await fetchParticipants(h)).toMatchObject({
      outcome: 'failed',
      reason: 'invalid-payload',
    });
    expect(h.calls.map((c) => c.url)).toEqual([DRIVERS_URL]);
    expect(h.logger.events).toContainEqual(
      expect.objectContaining({
        failureCategory: 'drivers-duplicate-canonical-driver',
      }),
    );
  });

  it('treats a contradictory registry as blocking, not as an unmapped observation', async () => {
    const [first, second] = runContext.verifiedBindings.filter(
      (b) => b.key.entity === 'driver' && b.key.season === SEASON,
    );
    const registry = editedRegistry((document) => {
      document.mappings.push({
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: first!.key.providerValue,
        gridviewId: second!.targetId,
      });
    });
    expect(registry.isValid).toBe(false);
    const h = harness({
      inventoryPolicy: policy,
      registry,
      steps: [driversStep(fullSeasonDriverRows())],
    });
    expect(await fetchParticipants(h)).toMatchObject({
      outcome: 'mapping-failure',
    });
    expect(h.calls.map((c) => c.url)).toEqual([DRIVERS_URL]);
  });

  it('never converts a malformed provider key into an unresolved identity', async () => {
    // Outside the established key grammar: empty, padded, control
    // characters, over-long, wrong type. (`Red Bull`-style spaces and
    // capitals are valid keys, so they are correctly unmapped, not malformed.)
    for (const malformed of [
      '',
      ' padded ',
      'a' + String.fromCharCode(10) + 'b',
      'x'.repeat(65),
      7,
      null,
    ]) {
      const h = harness({
        inventoryPolicy: policy,
        steps: [driversStep([...fullSeasonDriverRows(), driverRow(malformed)])],
      });
      const outcome = await fetchParticipants(h);
      expect(outcome.outcome).not.toBe('candidate');
      expect(h.calls.map((c) => c.url)).toEqual([DRIVERS_URL]);
    }
    // Even past the decoder, the resolver's invalid-key answer is blocking.
    const direct = await normalizeDriverInventory({
      providerValues: [' padded '],
      season: SEASON,
      resolve: (providerValue) =>
        runContext.registry.resolve({
          season: SEASON,
          source: 'jolpica',
          entity: 'driver',
          providerField: 'driverId',
          providerValue,
        }),
      driverById: (id) => knownIds().driverById(id),
      catalogHash: runContext.catalogHash as `sha256:${string}`,
      maxReportedFailures: 5,
    });
    expect(direct).toMatchObject({ ok: false, kind: 'mapping' });
  });

  it('fails a mapped target with no canonical profile as a mapping failure, not optional', async () => {
    const drivers = registryRows('drivers');
    const [first] = runContext.verifiedBindings.filter(
      (b) => b.key.entity === 'driver' && b.key.season === SEASON,
    );
    const participants = curatedParticipantsFrom(
      runContext.canonicalProfiles.drivers.filter(
        (d) => d.id !== first!.targetId,
      ),
      runContext.canonicalProfiles.constructors,
    );
    expect(drivers.length).toBeGreaterThan(0);
    const h = harness({
      inventoryPolicy: policy,
      participants,
      steps: [driversStep(fullSeasonDriverRows())],
    });
    expect(await fetchParticipants(h)).toMatchObject({
      outcome: 'mapping-failure',
    });
    expect(h.calls.map((c) => c.url)).toEqual([DRIVERS_URL]);
  });

  it('fails an invalid canonical profile as invalid payload', async () => {
    const [first] = runContext.verifiedBindings.filter(
      (b) => b.key.entity === 'driver' && b.key.season === SEASON,
    );
    const participants: CuratedParticipants = {
      driverById: (id) => {
        const profile = runContext.participants.driverById(id);
        return profile && id === first!.targetId
          ? { ...profile, countryCode: 'not-a-country-code' }
          : profile;
      },
      constructorById: (id) => runContext.participants.constructorById(id),
    } as CuratedParticipants;
    const h = harness({
      inventoryPolicy: policy,
      participants,
      steps: [driversStep(fullSeasonDriverRows())],
    });
    expect(await fetchParticipants(h)).toMatchObject({
      outcome: 'failed',
      reason: 'invalid-payload',
    });
    expect(h.calls.map((c) => c.url)).toEqual([DRIVERS_URL]);
    expect(h.logger.events).toContainEqual(
      expect.objectContaining({
        failureCategory: 'drivers-invalid-driver-profile',
      }),
    );
  });

  it('fails structural driver problems before any constructors request (incomplete page, envelope)', async () => {
    for (const step of [
      driversStep([...fullSeasonDriverRows(), driverRow(UNKNOWN_A)], {
        total: '500',
      }),
      driversStep([driverRow(UNKNOWN_A)], { season: '2025' }),
      { kind: 'json', body: { MRData: null } } as TransportStep,
      driversStep('not-a-collection'),
    ]) {
      const h = harness({ inventoryPolicy: policy, steps: [step] });
      expect(await fetchParticipants(h)).toMatchObject({
        outcome: 'failed',
        reason: 'invalid-payload',
        attempts: [{ outcome: 'successful' }],
      });
      expect(h.calls.map((c) => c.url)).toEqual([DRIVERS_URL]);
    }
  });
});

describe('U9 constructor inventory remains fully strict (T28)', () => {
  it('fails an unknown constructor after an optional unknown driver, with both real attempts', async () => {
    const h = harness({
      inventoryPolicy: policy,
      steps: [
        driversStep([...fullSeasonDriverRows(), driverRow(UNKNOWN_A)]),
        constructorsStep([
          ...fullSeasonConstructorRows(),
          constructorRow('synthetic_unknown_constructor'),
        ]),
      ],
    });
    expect(await fetchParticipants(h)).toEqual({
      outcome: 'mapping-failure',
      attempts: [
        { reference: 'jolpica-participants-1', outcome: 'successful' },
        { reference: 'jolpica-participants-2', outcome: 'successful' },
      ],
    });
    expect(h.calls.map((c) => c.url)).toEqual([DRIVERS_URL, CONSTRUCTORS_URL]);
  });

  it('fails a constructor with no canonical profile; known drivers cannot conceal it', async () => {
    const [constructorBinding] = runContext.verifiedBindings.filter(
      (b) => b.key.entity === 'constructor' && b.key.season === SEASON,
    );
    const participants = curatedParticipantsFrom(
      runContext.canonicalProfiles.drivers,
      runContext.canonicalProfiles.constructors.filter(
        (c) => c.id !== constructorBinding!.targetId,
      ),
    );
    const h = harness({
      inventoryPolicy: policy,
      participants,
      steps: [driversStep(fullSeasonDriverRows()), constructorsStep()],
    });
    expect(await fetchParticipants(h)).toMatchObject({
      outcome: 'mapping-failure',
      attempts: [{ outcome: 'successful' }, { outcome: 'successful' }],
    });
  });

  it('reports a failed constructors transport with both attempts and no partial payload', async () => {
    const h = harness({
      inventoryPolicy: policy,
      steps: [
        driversStep([...fullSeasonDriverRows(), driverRow(UNKNOWN_A)]),
        { kind: 'status', status: 503 },
      ],
    });
    const outcome = await fetchParticipants(h);
    expect(outcome).toMatchObject({
      outcome: 'failed',
      reason: 'provider-unavailable',
      attempts: [{ outcome: 'successful' }, { outcome: 'failed' }],
    });
    expect('payload' in outcome).toBe(false);
  });

  it('reports cancellation between the two requests as interrupted with only the real attempt', async () => {
    const controller = new AbortController();
    const h = harness({
      inventoryPolicy: policy,
      steps: [driversStep([...fullSeasonDriverRows(), driverRow(UNKNOWN_A)])],
      afterResponse: (index) => {
        if (index === 0) controller.abort();
      },
    });
    expect(await fetchParticipants(h, controller.signal)).toEqual({
      outcome: 'interrupted',
      attempts: [
        { reference: 'jolpica-participants-1', outcome: 'successful' },
      ],
      reason: 'cancelled',
    });
    expect(h.calls.map((c) => c.url)).toEqual([DRIVERS_URL]);
  });

  it('reports a limiter deferral before constructors as interrupted, never a fabricated attempt', async () => {
    const h = harness({
      inventoryPolicy: policy,
      limiter: ['allowed', 'deferred'],
      steps: [driversStep([...fullSeasonDriverRows(), driverRow(UNKNOWN_A)])],
    });
    expect(await fetchParticipants(h)).toMatchObject({
      outcome: 'interrupted',
      reason: 'rate-limit-deferred',
      attempts: [{ outcome: 'successful' }],
    });
    expect(h.calls.map((c) => c.url)).toEqual([DRIVERS_URL]);
    expect(h.reservations).toEqual(['jolpica', 'jolpica']);
  });
});

/** A valid optional payload produced by the real port, for coordinator tests. */
async function realOptionalPayload(): Promise<ParticipantsPayloadView> {
  return payloadOf(
    await fetchParticipants(
      harness({
        inventoryPolicy: policy,
        steps: [
          driversStep([
            ...fullSeasonDriverRows(),
            driverRow(UNKNOWN_A),
            driverRow(UNKNOWN_B),
          ]),
          constructorsStep(),
        ],
      }),
    ),
  );
}

function coordinateWith(
  payload: unknown,
  inventoryPolicy: unknown = policy,
): Promise<CoordinationRun> {
  const port = new FakePort(
    'jolpica',
    () =>
      ({
        outcome: 'candidate',
        attempts: [attempt('j-1'), attempt('j-2')],
        payload,
      }) as ProviderResourceOutcome,
  );
  return new MultiSourceCoordinator({
    ports: [port],
    logger: new CapturingLogger(),
    inventoryPolicy,
  }).coordinate({ plan: { season: SEASON, resources: [PARTICIPANTS] } });
}

function participantsContribution(run: CoordinationRun) {
  return run.resources[0]!.contributions.find((c) => c.source === 'jolpica')!;
}

/** Rebuilds the digest after a tamper, so only the targeted rule can fail. */
async function resealed(
  payload: ParticipantsPayloadView,
  edit: (inventory: Record<string, unknown>) => void,
): Promise<ParticipantsPayloadView> {
  const copy = structuredClone(payload) as unknown as Record<string, unknown>;
  const inventory = copy.driverInventory as Record<string, unknown>;
  edit(inventory);
  // The digest covers only the named projection fields, never itself.
  inventory.projectionDigest = await driverInventoryProjectionDigest(
    inventory as unknown as DriverInventory,
  );
  return copy as unknown as ParticipantsPayloadView;
}

describe('U9 coordinator deep validation of private accounting (T29)', () => {
  it('admits a genuine optional payload against the trusted run policy', async () => {
    const run = await coordinateWith(await realOptionalPayload());
    expect(run.resources[0]!.selection.outcome).toBe('selected');
  });

  it('refuses accounting in strict mode and its absence in optional mode', async () => {
    const payload = await realOptionalPayload();
    const strictRun = await coordinateWith(payload, { mode: 'strict' });
    expect(participantsContribution(strictRun)).toMatchObject({
      status: 'failed',
      reason: 'invalid-payload',
    });
    const bare = Object.fromEntries(
      Object.entries(payload).filter(([key]) => key !== 'driverInventory'),
    );
    const missing = await coordinateWith(bare);
    expect(participantsContribution(missing)).toMatchObject({
      status: 'failed',
      reason: 'invalid-payload',
    });
  });

  it.each([
    [
      'forged catalog hash',
      (i: Record<string, unknown>) => {
        i.catalogHash = `sha256:${'f'.repeat(64)}`;
      },
    ],
    [
      'unsupported policy version',
      (i: Record<string, unknown>) => {
        i.policyVersion = 2;
      },
    ],
    [
      'row-count mismatch',
      (i: Record<string, unknown>) => {
        i.providerRowCount = (i.providerRowCount as number) - 1;
      },
    ],
    [
      'duplicate unresolved candidate',
      (i: Record<string, unknown>) => {
        const u = i.unresolved as unknown[];
        u[1] = structuredClone(u[0]);
      },
    ],
    [
      'duplicate resolved observation',
      (i: Record<string, unknown>) => {
        const r = i.resolved as { observationKeyHash: string }[];
        r[1]!.observationKeyHash = r[0]!.observationKeyHash;
      },
    ],
    [
      'resolved reference missing from drivers',
      (i: Record<string, unknown>) => {
        const r = i.resolved as { driverId: string }[];
        r[0]!.driverId = 'synthetic-unverified-driver';
      },
    ],
    [
      'resolved order differing from drivers',
      (i: Record<string, unknown>) => {
        const r = i.resolved as unknown[];
        [r[0], r[1]] = [r[1], r[0]];
      },
    ],
    [
      'unsorted unresolved accounting',
      (i: Record<string, unknown>) => {
        (i.unresolved as unknown[]).reverse();
      },
    ],
    [
      'unrecognised unresolved reason',
      (i: Record<string, unknown>) => {
        (i.unresolved as Record<string, unknown>[])[0]!.reason = 'ambiguous';
      },
    ],
    [
      'unknown accounting field',
      (i: Record<string, unknown>) => {
        i.providerKeys = ['leak'];
      },
    ],
    [
      'unknown unresolved member field',
      (i: Record<string, unknown>) => {
        (i.unresolved as Record<string, unknown>[])[0]!.providerValue = 'leak';
      },
    ],
    [
      'malformed candidate hash',
      (i: Record<string, unknown>) => {
        (i.unresolved as Record<string, unknown>[])[0]!.candidateId = 'x';
      },
    ],
  ])('rejects %s at the deep boundary', async (_name, edit) => {
    const run = await coordinateWith(
      await resealed(await realOptionalPayload(), edit),
    );
    expect(participantsContribution(run)).toMatchObject({
      status: 'failed',
      reason: 'invalid-payload',
    });
    expect(run.resources[0]!.selection.outcome).toBe('unavailable');
  });

  it('rejects an incorrect projection digest without resealing', async () => {
    const payload = structuredClone(await realOptionalPayload());
    (payload.driverInventory as { projectionDigest: string }).projectionDigest =
      `sha256:${'0'.repeat(64)}`;
    expect(
      participantsContribution(await coordinateWith(payload)),
    ).toMatchObject({ status: 'failed', reason: 'invalid-payload' });
  });

  it('rejects a profile tamper that the accounting no longer matches', async () => {
    const payload = structuredClone(await realOptionalPayload()) as unknown as {
      drivers: unknown[];
    };
    payload.drivers.pop();
    expect(
      participantsContribution(await coordinateWith(payload)),
    ).toMatchObject({ status: 'failed', reason: 'invalid-payload' });
  });

  it('rejects a payload whose driverEntries are not empty', async () => {
    const payload = structuredClone(await realOptionalPayload()) as unknown as {
      driverEntries: unknown[];
    };
    payload.driverEntries.push({ season: SEASON });
    const contribution = participantsContribution(
      await coordinateWith(payload),
    );
    expect(contribution.status).toBe('failed');
    // The inventory rule itself, isolated from the public entry contract.
    const genuine = await realOptionalPayload();
    const digest = genuine.driverInventory!.projectionDigest;
    expect(validateDriverInventoryPayload(genuine, policy, digest)).toEqual([]);
    expect(
      validateDriverInventoryPayload(
        { ...genuine, driverEntries: [{}] },
        policy,
        digest,
      ),
    ).toEqual(['driver-entries']);
    expect(
      validateDriverInventoryPayload(genuine, strictInventoryPolicy, null),
    ).toEqual([]);
  });

  it('trusts the run context, not the payload: a self-consistent payload for another catalog fails', async () => {
    const payload = await realOptionalPayload();
    const otherPolicy = optionalDriverInventoryPolicy(
      `sha256:${'e'.repeat(64)}`,
    );
    const run = await coordinateWith(payload, otherPolicy);
    expect(participantsContribution(run)).toMatchObject({
      status: 'failed',
      reason: 'invalid-payload',
    });
  });

  it('keeps its detached candidate when the adapter mutates accounting after submission', async () => {
    const payload = structuredClone(await realOptionalPayload());
    const expected = JSON.parse(JSON.stringify(payload)) as unknown;
    const run = await coordinateWith(payload);
    expect(run.resources[0]!.selection.outcome).toBe('selected');
    const inventory = payload.driverInventory as unknown as {
      unresolved: unknown[];
      providerRowCount: number;
      catalogHash: string;
    };
    inventory.unresolved.length = 0;
    inventory.providerRowCount = 0;
    inventory.catalogHash = 'tampered';
    (payload.drivers as unknown[]).length = 0;
    const selection = run.resources[0]!.selection;
    expect(selection.outcome === 'selected' && selection.payload).toEqual(
      expected,
    );
  });
});

describe('U9 discovery integration is best effort and bounded', () => {
  it('derives the same candidate IDs as U1 discovery extraction', async () => {
    const rows = [
      ...fullSeasonDriverRows(),
      driverRow(UNKNOWN_A),
      driverRow(UNKNOWN_B),
    ];
    const captured: string[] = [];
    const tasks: Promise<void>[] = [];
    const sink: DiscoverySink = {
      capture(input, body, registry) {
        tasks.push(
          extractJolpicaObservations(
            input,
            body,
            observationContext,
            registry,
          ).then((result) => {
            if (result.status === 'skipped') return;
            for (const o of result.observations) captured.push(o.candidateId);
          }),
        );
      },
    };
    const outcome = await fetchParticipants(
      harness({
        inventoryPolicy: policy,
        discovery: sink,
        steps: [driversStep(rows), constructorsStep()],
      }),
    );
    await Promise.all(tasks);
    const inventory = inventoryOf(outcome);
    expect([...new Set(captured)].sort()).toEqual(
      inventory.unresolved.map((u) => u.candidateId),
    );
  });

  it('keeps explicit, valid accounting when the discovery store fails', async () => {
    const write = vi.fn(async () => {
      throw new Error('private storage outage');
    });
    const logger = new CapturingLogger();
    const session = createShadowDiscovery({
      client: { observe: write } as unknown as IdentityPort,
      context: observationContext,
      clock: () => Date.parse(observationContext.observedAt),
      logger,
    });
    const outcome = await fetchParticipants(
      harness({
        inventoryPolicy: policy,
        discovery: session,
        steps: [
          driversStep([...fullSeasonDriverRows(), driverRow(UNKNOWN_A)]),
          constructorsStep(),
        ],
      }),
    );
    await session.drain();
    expect(write).toHaveBeenCalled();
    const inventory = inventoryOf(outcome);
    expect(inventory.unresolved).toHaveLength(1);
    expect(
      participantsContribution(await coordinateWith(payloadOf(outcome))),
    ).toMatchObject({ status: 'candidate' });
    expect(JSON.stringify(logger.events)).not.toContain(
      'private storage outage',
    );
  });

  it('contains a throwing sink without changing the outcome', async () => {
    const steps = [
      driversStep([...fullSeasonDriverRows(), driverRow(UNKNOWN_A)]),
      constructorsStep(),
    ];
    const throwing: DiscoverySink = {
      capture() {
        throw new Error('sink failure');
      },
    };
    const plain = await fetchParticipants(
      harness({ inventoryPolicy: policy, steps }),
    );
    const contained = await fetchParticipants(
      harness({ inventoryPolicy: policy, steps, discovery: throwing }),
    );
    expect(contained).toEqual(plain);
  });

  it('deduplicates repeated observations and bounds collector overflow without affecting normalization', async () => {
    const body = driversEnvelope([
      ...fullSeasonDriverRows(),
      driverRow(UNKNOWN_A),
      driverRow(UNKNOWN_B),
    ]);
    const collector = createIdentityObservationCollector({
      maxObservations: 1,
    });
    const outcomes: string[] = [];
    const tasks: Promise<void>[] = [];
    const sink: DiscoverySink = {
      capture(input, captured, registry) {
        tasks.push(
          extractJolpicaObservations(
            input,
            captured,
            observationContext,
            registry,
          ).then((result) => {
            if (result.status === 'skipped') return;
            for (const o of result.observations)
              outcomes.push(collector.collect(o));
          }),
        );
      },
    };
    const steps = [{ kind: 'json', body } as TransportStep, constructorsStep()];
    const first = await fetchParticipants(
      harness({ inventoryPolicy: policy, discovery: sink, steps }),
    );
    await Promise.all(tasks);
    // Two unknowns, capacity one: one collected, one bounded overflow.
    expect(outcomes.filter((o) => o === 'collected')).toHaveLength(1);
    expect(outcomes).toContain('capacity');
    captureDiscovery(
      sink,
      {
        endpointKind: 'season-drivers',
        season: SEASON,
        requestedLimit: 100,
        decoded: {
          ok: true,
          drivers: [{ driverId: UNKNOWN_A }],
        },
      },
      driversEnvelope([driverRow(UNKNOWN_A)]),
      runContext.registry,
    );
    await Promise.all(tasks);
    expect(collector.stats().dropped).toBeGreaterThan(0);
    // Overflow and duplicates never change the accounting.
    expect(inventoryOf(first).unresolved).toHaveLength(2);
    expect(inventoryOf(first).providerRowCount).toBe(
      fullSeasonDriverRows().length + 2,
    );
  });
});

/** Routes a request by URL so one coordinator run can use real ports. */
function routedClient(routes: ReadonlyMap<string, unknown>) {
  const calls: string[] = [];
  const logger = new CapturingLogger();
  const limiter = scriptedLimiter([]);
  const client = new ProviderHttpClient({
    limiter: limiter.limiter,
    logger,
    transport: async (request) => {
      calls.push(request.url);
      const body = routes.get(request.url);
      if (body === undefined) throw new Error(`unrouted ${request.url}`);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  return { client, calls, logger };
}

const withUnknownDrivers = (rows: Record<string, unknown>[]) =>
  rows.map((row, index) =>
    index < 2
      ? { ...row, Driver: { driverId: [UNKNOWN_A, UNKNOWN_B][index] } }
      : row,
  );

async function phase3Run(inventoryPolicy: unknown) {
  const routes = new Map<string, unknown>([
    [
      DRIVERS_URL,
      driversEnvelope([
        ...fullSeasonDriverRows(),
        driverRow(UNKNOWN_A),
        driverRow(UNKNOWN_B),
      ]),
    ],
    [CONSTRUCTORS_URL, constructorsEnvelope(fullSeasonConstructorRows())],
    [resultsUrl(1), resultsEnvelope(withUnknownDrivers(baseRows()))],
    [
      driverStandingsUrl(),
      driverStandingsEnvelope(withUnknownDrivers(baseDriverRows())),
    ],
  ]);
  const { client, calls, logger } = routedClient(routes);
  const registry = runContext.registry;
  const ports = {
    calendar: new JolpicaCalendarPort({
      client,
      logger,
      registry,
      eventNames: runContext.events,
    }),
    circuits: new JolpicaCircuitsPort({
      client,
      logger,
      registry,
      circuits: runContext.circuits,
    }),
    participants: new JolpicaParticipantsPort({
      client,
      logger,
      registry,
      participants: runContext.participants,
      inventoryPolicy,
    }),
    results: new JolpicaResultsPort({ client, logger, registry }),
    standings: new JolpicaStandingsPort({ client, logger, registry }),
  };
  const run = await new MultiSourceCoordinator({
    ports: [new JolpicaResourcePort(ports)],
    logger,
    inventoryPolicy,
  }).coordinate({
    plan: {
      season: SEASON,
      resources: [
        PARTICIPANTS,
        {
          kind: 'session-classification',
          season: SEASON,
          round: 1,
          sessionType: 'race',
        },
        { kind: 'driver-standings', season: SEASON },
      ],
    },
  });
  return { run, calls };
}

describe('U9 synthetic phase-3 counterpart of the November regression (T24, T34)', () => {
  it('strict: unknown inventory drivers end participants early; required rows block', async () => {
    const { run, calls } = await phase3Run({ mode: 'strict' });
    expect(calls).toEqual([DRIVERS_URL, resultsUrl(1), driverStandingsUrl()]);
    expect(run.resources.map((r) => r.selection.outcome)).toEqual([
      'unavailable',
      'unavailable',
      'unavailable',
    ]);
  });

  it('optional: one additional constructors request, participants selected, unknown result and standings rows still block', async () => {
    const { run, calls } = await phase3Run(policy);
    expect(calls).toEqual([
      DRIVERS_URL,
      CONSTRUCTORS_URL,
      resultsUrl(1),
      driverStandingsUrl(),
    ]);
    const [participants, classification, standings] = run.resources;
    expect(participants!.selection.outcome).toBe('selected');
    for (const required of [classification!, standings!]) {
      expect(required.selection.outcome).toBe('unavailable');
      expect(required.contributions[0]).toMatchObject({
        status: 'failed',
        reason: 'mapping-unresolved',
      });
    }
    expect(run.accounting).toBeDefined();
  });
});

describe('U9 no public leakage and no pre-U10 publication (acceptance 35-36)', () => {
  it('refuses to assemble an inventory-bearing participants payload before U10 closure', async () => {
    const source = await seasonFixture();
    const complete = await new MultiSourceCoordinator({
      ports: [completePort('jolpica', source)],
      logger: new CapturingLogger(),
    }).coordinate({ plan: fullPlan(source) });
    const metadata = metadataFor(source);
    expect(assembleSeasonSource(complete, metadata).complete).toBe(true);
    const inventory = (await realOptionalPayload()).driverInventory;
    const withInventory = {
      ...complete,
      resources: complete.resources.map((resource) =>
        resource.resource.kind === 'season-participants' &&
        resource.selection.outcome === 'selected'
          ? {
              ...resource,
              selection: {
                ...resource.selection,
                payload: {
                  ...resource.selection.payload,
                  driverInventory: inventory,
                },
              },
            }
          : resource,
      ),
    } as CoordinationRun;
    expect(assembleSeasonSource(withInventory, metadata)).toEqual({
      complete: false,
      gap: 'inconsistent-references',
      missing: [],
      relations: [],
    });
  });

  it('never places accounting, candidate IDs or unknown keys in an assembled public source', async () => {
    const source = await seasonFixture();
    const serialized = JSON.stringify(source);
    expect(serialized).not.toContain('driverInventory');
    expect(serialized).not.toContain('candidateId');
    expect(serialized).not.toContain('observationKeyHash');
    expect(serialized).not.toContain(UNKNOWN_A);
  });
});
