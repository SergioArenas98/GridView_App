/**
 * The Jolpica season-circuits port, proven entirely against fakes.
 *
 * No test here reaches the network, needs a Cloudflare binding, reads a clock
 * or depends on a private evidence directory. The transport is an injected
 * local function and the limiter is a local object.
 */

import { describe, expect, it } from 'vitest';

import { validateCircuit } from '../../../src/contract/normalized';
import type { Circuit } from '../../../src/contract/types';
import {
  payloadMatchesResource,
  readProviderOutcome,
  validateCoordinatedPayload,
} from '../../../src/providers/coordination';
import type {
  CoordinatedResource,
  ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import { gridViewUserAgent } from '../../../src/providers/http/provider-http-client';
import {
  JolpicaCalendarPort,
  JolpicaCircuitsPort,
  circuitsPageLimit,
  curatedCircuits,
  curatedCircuitsFrom,
} from '../../../src/providers/jolpica';
import { CapturingLogger } from '../../../src/logging/logger';
import { ProviderHttpClient } from '../../../src/providers/http/provider-http-client';
import {
  buildProviderMappingRegistry,
  canonicalIdsFrom,
  curatedMappingDocuments,
  curatedRegistries,
  providerMappingRegistry,
  type ProviderMappingRegistry,
} from '../../../src/providers/mappings';
import { MockFormulaOneProvider } from '../../../src/providers/mock/mock-provider';
import { FixedClock } from '../../../src/runtime/clock';
import { documentOf, record } from '../mappings/support';
import {
  circuitRow,
  circuitsEnvelope,
  circuitsHarness,
  curatedCircuitMappings,
  curatedRegistryRows,
  fullSeasonCircuitRows,
  syntheticDescription,
} from './circuits-support';
import {
  LIMIT,
  SEASON,
  allowingLimiter,
  countingLimiter,
  deferringLimiter,
  failingTransport,
  forbiddenTransport,
  jsonTransport,
  rateLimitedTransport,
  unavailableLimiter,
  type RecordingTransport,
} from './support';

const circuitsResource: CoordinatedResource = {
  kind: 'season-circuits',
  season: SEASON,
};

/** Every property the normalized `Circuit` contract declares. */
const DECLARED_CIRCUIT_KEYS = [
  'id',
  'name',
  'locality',
  'country',
  'countryCode',
  'latitude',
  'longitude',
  'lengthMeters',
  'cornerCount',
  'direction',
  'firstGrandPrixYear',
  'lapRecord',
  'media',
] as const satisfies readonly (keyof Circuit)[];

/** The ten descriptive facts plus media: every optional contract field. */
const OPTIONAL_CIRCUIT_KEYS = DECLARED_CIRCUIT_KEYS.filter(
  (key) => key !== 'id' && key !== 'name',
);

/** Every outcome the port returns must survive the coordinator's own parser. */
function wellFormed(outcome: ProviderResourceOutcome): ProviderResourceOutcome {
  expect(readProviderOutcome(outcome)).not.toBeNull();
  return outcome;
}

function circuitsOf(outcome: ProviderResourceOutcome): readonly Circuit[] {
  expect(outcome.outcome).toBe('candidate');
  if (outcome.outcome !== 'candidate') throw new Error('unreachable');
  expect(outcome.payload.kind).toBe('season-circuits');
  if (outcome.payload.kind !== 'season-circuits') {
    throw new Error('unreachable');
  }
  return outcome.payload.circuits;
}

async function fetchCircuits(
  body: unknown,
  options: Parameters<typeof circuitsHarness>[0] = {},
) {
  const transport = jsonTransport(body);
  const built = circuitsHarness({ transport, ...options });
  const outcome = wellFormed(
    await built.port.fetchResource({
      source: 'jolpica',
      resource: circuitsResource,
    }),
  );
  return { ...built, outcome };
}

function expectInvalidPayload(outcome: ProviderResourceOutcome): void {
  expect(outcome.outcome).toBe('failed');
  if (outcome.outcome !== 'failed') throw new Error('unreachable');
  expect(outcome.reason).toBe('invalid-payload');
  // The response was read, so the request is still counted exactly once.
  expect(outcome.attempt.outcome).toBe('successful');
  expect(Object.keys(outcome).sort()).toEqual(['attempt', 'outcome', 'reason']);
}

function expectMappingFailure(outcome: ProviderResourceOutcome): void {
  expect(outcome.outcome).toBe('mapping-failure');
  if (outcome.outcome !== 'mapping-failure') throw new Error('unreachable');
  expect(outcome.attempt.outcome).toBe('successful');
  // No partial payload of any kind.
  expect(Object.keys(outcome).sort()).toEqual(['attempt', 'outcome']);
}

/** A mapping registry over the real canonical registries plus `extra`. */
function registryWith(
  mappings: readonly unknown[],
  extraCanonicalIds: readonly string[] = [],
): ProviderMappingRegistry {
  const canonical = curatedRegistries();
  return buildProviderMappingRegistry([documentOf(mappings)], {
    ...canonical,
    circuit: extraCanonicalIds.length
      ? canonicalIdsFrom([
          ...curatedRegistryRows().map((row) => ({ id: String(row.id) })),
          ...extraCanonicalIds.map((id) => ({ id })),
        ])
      : canonical.circuit,
  });
}

function circuitMapping(providerValue: string, gridviewId: string) {
  return record({
    entity: 'circuit',
    providerField: 'circuitId',
    providerValue,
    gridviewId,
  });
}

describe('the request the circuits port builds', () => {
  it('targets the pinned origin and circuits path with an explicit limit', async () => {
    const { calls } = await fetchCircuits(
      circuitsEnvelope([circuitRow('albert_park')]),
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      `https://api.jolpi.ca/ergast/f1/${SEASON}/circuits/?limit=${LIMIT}`,
    );
    expect(calls[0]?.method).toBe('GET');
    // The explicit page size is the documented cap, not the upstream default.
    expect(circuitsPageLimit).toBe(100);
  });

  it('takes the season from the requested resource, not a constant', async () => {
    const transport = jsonTransport(circuitsEnvelope([], { season: '2024' }));
    const { port, calls } = circuitsHarness({ transport });

    await port.fetchResource({
      source: 'jolpica',
      resource: { kind: 'season-circuits', season: 2024 },
    });

    expect(calls[0]?.url).toBe(
      `https://api.jolpi.ca/ergast/f1/2024/circuits/?limit=${LIMIT}`,
    );
  });

  it('sends the identifying User-Agent and no credentials', async () => {
    const { calls } = await fetchCircuits(
      circuitsEnvelope([circuitRow('albert_park')]),
    );

    const headers = calls[0]?.headers ?? {};
    expect(headers['user-agent']).toBe(gridViewUserAgent);
    expect(headers.accept).toBe('application/json');
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
    expect(calls[0]?.redirect).toBe('manual');
    expect(calls[0]?.hasBody).toBe(false);
  });
});

describe('normalization of season circuits', () => {
  it('decodes a valid response into a coordination-valid payload', async () => {
    const { outcome } = await fetchCircuits(
      circuitsEnvelope([circuitRow('albert_park'), circuitRow('spa')]),
    );

    const circuits = circuitsOf(outcome);
    expect(circuits.map((circuit) => circuit.id)).toEqual([
      'albert-park',
      'spa-francorchamps',
    ]);
    if (outcome.outcome !== 'candidate') throw new Error('unreachable');
    expect(payloadMatchesResource(circuitsResource, outcome.payload)).toBe(
      true,
    );
    expect(validateCoordinatedPayload(outcome.payload)).toEqual([]);
  });

  it('resolves every curated 2026 circuitId through the curated mappings', async () => {
    const mappings = curatedCircuitMappings();
    expect(mappings).toHaveLength(23);

    const { outcome } = await fetchCircuits(
      circuitsEnvelope(fullSeasonCircuitRows()),
    );

    const circuits = circuitsOf(outcome);
    // Exactly the curated target of each row, in the provider's row order.
    expect(circuits.map((circuit) => circuit.id)).toEqual(
      mappings.map((mapping) => mapping.gridviewId),
    );
    for (const circuit of circuits) {
      expect(validateCircuit(circuit, 'circuit')).toEqual([]);
    }
  });

  it('takes canonical ids and names from the registry, never the payload', async () => {
    const registryNames = new Map(
      curatedRegistryRows().map((row) => [String(row.id), String(row.name)]),
    );

    const { outcome } = await fetchCircuits(
      circuitsEnvelope([
        circuitRow('spa', syntheticDescription),
        circuitRow('yas_marina', syntheticDescription),
      ]),
    );

    const circuits = circuitsOf(outcome);
    expect(circuits.map((circuit) => circuit.id)).toEqual([
      'spa-francorchamps',
      'yas-marina',
    ]);
    for (const circuit of circuits) {
      expect(circuit.name).toBe(registryNames.get(circuit.id));
    }
    const serialized = JSON.stringify(outcome);
    expect(serialized).not.toContain('Synthetic Provider');
    expect(serialized).not.toContain('example.invalid');
    expect(serialized).not.toContain('12.3456');
    // The provider identifier itself never becomes a public value.
    expect(serialized).not.toContain('yas_marina');
  });

  it('emits every optional field of an identity-only circuit as explicit null', async () => {
    const identityOnly = curatedRegistryRows().filter(
      (row) => Object.keys(row).sort().join(',') === 'id,name',
    );
    expect(identityOnly).toHaveLength(17);
    const identityOnlyIds = new Set(identityOnly.map((row) => String(row.id)));

    const { outcome } = await fetchCircuits(
      circuitsEnvelope(
        curatedCircuitMappings()
          .filter((mapping) => identityOnlyIds.has(mapping.gridviewId))
          .map((mapping) =>
            circuitRow(mapping.providerValue, syntheticDescription),
          ),
      ),
    );

    const circuits = circuitsOf(outcome);
    expect(circuits).toHaveLength(17);
    for (const circuit of circuits) {
      expect(Object.keys(circuit).sort()).toEqual(
        [...DECLARED_CIRCUIT_KEYS].sort(),
      );
      for (const key of OPTIONAL_CIRCUIT_KEYS) {
        // Present and null: an absent key fails the contract.
        expect(Object.hasOwn(circuit, key), key).toBe(true);
        expect(circuit[key], `${circuit.id}.${key}`).toBeNull();
      }
    }
  });

  it('preserves the curated values of a fully described circuit', async () => {
    const spa = curatedRegistryRows().find(
      (row) => row.id === 'spa-francorchamps',
    );
    expect(spa).toBeDefined();
    // The row really is fully described, so this is not vacuous.
    expect(Object.keys(spa ?? {}).sort()).toEqual(
      DECLARED_CIRCUIT_KEYS.filter((key) => key !== 'media').sort(),
    );

    const { outcome } = await fetchCircuits(
      circuitsEnvelope([circuitRow('spa', syntheticDescription)]),
    );

    const [circuit] = circuitsOf(outcome);
    expect(circuit).toEqual({ ...spa, media: null });
  });

  it('applies exactly the mock provider defaults to every curated circuit', async () => {
    // The mock provider's content seam is the established rule for turning a
    // partial registry row into a contract circuit. The adapter reads the same
    // registry and must agree with it field for field; only media differs,
    // because the adapter never presents the mock media set.
    const provider = new MockFormulaOneProvider({
      clock: new FixedClock(new Date('2026-07-20T12:00:00.000Z')),
    });
    const source = await provider.fetchSeasonSource(2026, ['season-calendar']);
    const curated = curatedCircuits();

    expect(source.circuits).toHaveLength(23);
    for (const mockCircuit of source.circuits) {
      expect({ ...curated.get(mockCircuit.id), media: null }).toEqual({
        ...mockCircuit,
        media: null,
      });
    }
  });

  it('never lets a caller alter the curated content', async () => {
    const curated = curatedCircuits();
    const first = curated.get('spa-francorchamps');
    if (first === null || first.lapRecord === null) {
      throw new Error('fixture expectation');
    }
    first.name = 'mutated';
    first.lapRecord.year = 1;

    const second = curated.get('spa-francorchamps');
    expect(second?.name).not.toBe('mutated');
    expect(second?.lapRecord?.year).not.toBe(1);
  });

  it('never forwards an unknown upstream field into the payload', async () => {
    const { outcome } = await fetchCircuits(
      circuitsEnvelope([
        circuitRow('albert_park', { leakMarker: 'LEAK-MARKER-VALUE' }),
      ]),
    );

    const [circuit] = circuitsOf(outcome);
    expect(Object.keys(circuit ?? {}).sort()).toEqual(
      [...DECLARED_CIRCUIT_KEYS].sort(),
    );
    expect(JSON.stringify(outcome)).not.toContain('LEAK-MARKER-VALUE');
  });
});

describe('the M8 row-count observation', () => {
  /**
   * Provider Evaluation §8.4 recorded 24 circuits for a 23-race calendar and
   * left the difference unexplained (M8, DATA-04). The accepted rule that
   * decides the resource is ADR 0022 D10: every provider row must resolve, and
   * no row is ever dropped from an otherwise accepted resource. So a 24th row
   * without a curated mapping fails the whole resource - it is neither
   * filtered out against the calendar nor carried with an invented identity.
   */
  it('fails the whole resource when a 24th row has no curated mapping', async () => {
    const rows = [
      ...fullSeasonCircuitRows(),
      circuitRow('synthetic_unmapped_venue', syntheticDescription),
    ];
    expect(rows).toHaveLength(24);

    const { outcome, logger } = await fetchCircuits(circuitsEnvelope(rows));

    expectMappingFailure(outcome);
    // Exactly the unresolved row is reported, through the bounded signal.
    const signals = logger.events.filter(
      (event) => event.operation === 'provider.mapping.resolve',
    );
    expect(signals).toHaveLength(1);
    // The one provider value that is logged is the bounded internal mapping
    // diagnostic ADR 0022 D10 permits. Nothing else from the payload is.
    expect(signals[0]?.providerMappingValue).toBe('synthetic_unmapped_venue');
    expect(logger.serialized()).not.toContain('MRData');
    expect(logger.serialized()).not.toContain('CircuitTable');
    expect(logger.serialized()).not.toContain('Synthetic Provider');
  });

  it('carries an extra row that is curated, without comparing to the calendar', async () => {
    // A synthetic curated identity stands in for a reviewed mapping. The
    // resource is not trimmed to the 23 calendar circuits: membership is the
    // provider's rows, each resolved.
    const registry = registryWith(
      [
        ...curatedMappingDocumentsCircuitRecords(),
        circuitMapping('synthetic_extra_venue', 'synthetic-extra-venue'),
      ],
      ['synthetic-extra-venue'],
    );
    const circuits = curatedCircuitsFrom([
      ...(curatedRegistryRows() as never[]),
      { id: 'synthetic-extra-venue', name: 'Synthetic Extra Venue' },
    ]);

    const { outcome } = await fetchCircuits(
      circuitsEnvelope([
        ...fullSeasonCircuitRows(),
        circuitRow('synthetic_extra_venue'),
      ]),
      { registry, circuits },
    );

    const normalized = circuitsOf(outcome);
    expect(normalized).toHaveLength(24);
    expect(normalized.at(-1)?.id).toBe('synthetic-extra-venue');
  });

  it('accepts fewer rows than the calendar has races', async () => {
    // Nothing in the port knows how many races a season has. Whether every
    // calendar circuit is present is the season preflight's relation.
    const { outcome } = await fetchCircuits(
      circuitsEnvelope(fullSeasonCircuitRows().slice(0, 3)),
    );

    expect(circuitsOf(outcome)).toHaveLength(3);
  });
});

/** The committed 2026 circuit mapping records, as plain records. */
function curatedMappingDocumentsCircuitRecords(): readonly unknown[] {
  return curatedCircuitMappings().map((mapping) =>
    circuitMapping(mapping.providerValue, mapping.gridviewId),
  );
}

describe('identity resolution', () => {
  it('fails the whole resource on an unknown circuitId', async () => {
    const { outcome } = await fetchCircuits(
      circuitsEnvelope([circuitRow('synthetic_unmapped_venue')]),
    );

    expectMappingFailure(outcome);
  });

  it('fails the whole resource when no mapping exists at all', async () => {
    const { outcome } = await fetchCircuits(
      circuitsEnvelope([circuitRow('albert_park')]),
      { emptyRegistry: true },
    );

    expectMappingFailure(outcome);
  });

  it('manufactures no slug from a provider identifier or display name', async () => {
    // Each value would resolve if a rule converted, folded, trimmed or read a
    // name - so each must fail instead.
    for (const circuitId of [
      'albert-park',
      'ALBERT_PARK',
      ' albert_park',
      'albert_park ',
      'yas-marina',
      'spa-francorchamps',
      'Circuit de Spa-Francorchamps',
    ]) {
      const { outcome } = await fetchCircuits(
        circuitsEnvelope([
          circuitRow(circuitId, {
            circuitName: 'Albert Park Grand Prix Circuit',
          }),
        ]),
      );

      expectMappingFailure(outcome);
    }
  });

  it('rejects two provider rows that resolve to one canonical circuit', async () => {
    // ADR 0022 D9 allows several curated aliases for one identity; one
    // normalized collection holding that identity twice is still contradictory.
    const registry = registryWith([
      circuitMapping('albert_park', 'albert-park'),
      circuitMapping('synthetic_albert_park_alias', 'albert-park'),
    ]);

    const { outcome, logger } = await fetchCircuits(
      circuitsEnvelope([
        circuitRow('albert_park'),
        circuitRow('synthetic_albert_park_alias'),
      ]),
      { registry },
    );

    expectInvalidPayload(outcome);
    const warning = logger.events.find(
      (event) => event.operation === 'provider.circuits.invalid_payload',
    );
    expect(warning?.failureCategory).toBe('duplicate-canonical-circuit');
  });

  it('contains a resolved identity with no curated content', async () => {
    const { outcome, logger } = await fetchCircuits(
      circuitsEnvelope([circuitRow('albert_park')]),
      { circuits: curatedCircuitsFrom([]) },
    );

    expectMappingFailure(outcome);
    expect(
      logger.events.some(
        (event) =>
          event.operation === 'provider.circuits.curated_content_missing',
      ),
    ).toBe(true);
  });

  it('reports a bounded mapping signal and no raw provider payload', async () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      circuitRow(`synthetic_unmapped_${index}`, syntheticDescription),
    );

    const { logger } = await fetchCircuits(circuitsEnvelope(rows));

    const signals = logger.events.filter(
      (event) => event.operation === 'provider.mapping.resolve',
    );
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.length).toBeLessThanOrEqual(5);
    const serialized = logger.serialized();
    expect(serialized).not.toContain('MRData');
    expect(serialized).not.toContain('Synthetic Provider');
  });
});

describe('untrusted payload validation', () => {
  const valid = [circuitRow('albert_park')];

  const rejected: readonly [string, unknown][] = [
    ['an array body', [1, 2, 3]],
    ['a missing envelope', { nope: true }],
    [
      'a missing circuit table',
      { MRData: { limit: '100', offset: '0', total: '0' } },
    ],
    [
      'a missing circuit collection',
      {
        MRData: {
          limit: '100',
          offset: '0',
          total: '0',
          CircuitTable: { season: '2026' },
        },
      },
    ],
    [
      'a non-array circuit collection',
      {
        MRData: {
          limit: '100',
          offset: '0',
          total: '1',
          CircuitTable: { season: '2026', Circuits: { circuitId: 'x' } },
        },
      },
    ],
    ['a missing table season', circuitsEnvelope(valid, { season: undefined })],
    ['a numeric table season', circuitsEnvelope(valid, { season: 2026 })],
    ['a wrong table season', circuitsEnvelope(valid, { season: '2025' })],
    ['a null circuit row', circuitsEnvelope([null])],
    ['a non-object circuit row', circuitsEnvelope(['albert_park'])],
    ['a missing circuitId', circuitsEnvelope([{ circuitName: 'x' }])],
    ['an empty circuitId', circuitsEnvelope([circuitRow('')])],
    ['a numeric circuitId', circuitsEnvelope([circuitRow(7)])],
    ['a null circuitId', circuitsEnvelope([circuitRow(null)])],
    [
      'a duplicate provider circuitId',
      circuitsEnvelope([circuitRow('albert_park'), circuitRow('albert_park')]),
    ],
  ];

  for (const [label, body] of rejected) {
    it(`fails closed on ${label}`, async () => {
      const { outcome } = await fetchCircuits(body);
      expectInvalidPayload(outcome);
    });
  }

  it('fails closed on invalid JSON', async () => {
    const { outcome } = await fetchCircuits('{ not json');

    expect(outcome.outcome).toBe('failed');
    expect('payload' in outcome).toBe(false);
  });

  it('never carries a provider value through a failure', async () => {
    const { outcome, logger } = await fetchCircuits(
      circuitsEnvelope([
        circuitRow('synthetic-secret-value'),
        circuitRow('synthetic-secret-value'),
      ]),
    );

    expectInvalidPayload(outcome);
    expect(JSON.stringify(outcome)).not.toContain('synthetic-secret-value');
    expect(logger.serialized()).not.toContain('synthetic-secret-value');
  });
});

describe('pagination and numeric wire strings', () => {
  const valid = [circuitRow('albert_park')];

  const rejected: readonly [string, unknown][] = [
    ['a padded limit', circuitsEnvelope(valid, { limit: '0100' })],
    ['an exponent limit', circuitsEnvelope(valid, { limit: '1e2' })],
    ['a signed limit', circuitsEnvelope(valid, { limit: '+100' })],
    ['a fractional limit', circuitsEnvelope(valid, { limit: '100.0' })],
    ['a whitespace limit', circuitsEnvelope(valid, { limit: ' 100' })],
    ['a JSON-number limit', circuitsEnvelope(valid, { limit: 100 })],
    ['a missing limit', circuitsEnvelope(valid, { limit: undefined })],
    ['a negative offset', circuitsEnvelope(valid, { offset: '-1' })],
    ['an empty offset', circuitsEnvelope(valid, { offset: '' })],
    ['a non-numeric total', circuitsEnvelope(valid, { total: 'many' })],
    [
      'a total beyond the safe integer range',
      circuitsEnvelope(valid, { total: '9007199254740993' }),
    ],
    ['a non-zero offset', circuitsEnvelope(valid, { offset: '10' })],
    [
      'an echoed limit other than requested',
      circuitsEnvelope(valid, { limit: '30' }),
    ],
    [
      'a total above the rows returned',
      circuitsEnvelope(valid, { total: '24' }),
    ],
    [
      'a total below the rows returned',
      circuitsEnvelope([circuitRow('albert_park'), circuitRow('spa')], {
        total: '1',
      }),
    ],
    [
      'a total beyond the requested limit',
      circuitsEnvelope(valid, { total: '250' }),
    ],
  ];

  for (const [label, body] of rejected) {
    it(`fails closed on ${label}`, async () => {
      const { outcome } = await fetchCircuits(body);
      expectInvalidPayload(outcome);
    });
  }

  // Values `JSON.parse` can never produce, handed to the port as the client's
  // own decoded data.
  const nonFinite: readonly [string, unknown][] = [
    ['an infinite limit', Infinity],
    ['a NaN limit', Number.NaN],
    ['a negative infinite limit', -Infinity],
  ];

  for (const [label, limit] of nonFinite) {
    it(`fails closed on ${label}`, async () => {
      const { outcome } = await fetchCircuits(circuitsEnvelope(valid), {
        successData: () => circuitsEnvelope(valid, { limit }),
      });
      expectInvalidPayload(outcome);
    });
  }

  it('fails closed on a non-finite total', async () => {
    const { outcome } = await fetchCircuits(circuitsEnvelope(valid), {
      successData: () => circuitsEnvelope(valid, { total: Infinity }),
    });
    expectInvalidPayload(outcome);
  });
});

describe('descriptive provider fields are never decoded', () => {
  /**
   * Coordinates, locality, country and the circuit name are unapproved
   * descriptive content (Provider Evaluation §8.8.1), so the decoder never
   * reads them. They are therefore never validated into meaning either: no
   * value of theirs, however malformed, can reach or alter the payload. This
   * pins that the numeric and coordinate fields sit outside the decode rather
   * than being silently accepted into it.
   */
  const malformedDescriptions: readonly [string, unknown][] = [
    ['a non-numeric latitude', { Location: { lat: 'north', long: '5.97' } }],
    ['an out-of-range latitude', { Location: { lat: '999', long: '5.97' } }],
    ['an exponent longitude', { Location: { lat: '50.4', long: '1e400' } }],
    ['a non-object location', { Location: 'somewhere' }],
    ['a numeric circuit name', { circuitName: 42 }],
  ];

  for (const [label, extra] of malformedDescriptions) {
    it(`carries nothing from ${label}`, async () => {
      const clean = await fetchCircuits(circuitsEnvelope([circuitRow('spa')]));
      const noisy = await fetchCircuits(
        circuitsEnvelope([circuitRow('spa', extra as Record<string, unknown>)]),
      );

      expect(circuitsOf(noisy.outcome)).toEqual(circuitsOf(clean.outcome));
    });
  }

  it('carries nothing from a non-finite coordinate', async () => {
    const clean = await fetchCircuits(circuitsEnvelope([circuitRow('spa')]));
    const noisy = await fetchCircuits(circuitsEnvelope([circuitRow('spa')]), {
      successData: () =>
        circuitsEnvelope([
          circuitRow('spa', { Location: { lat: Number.NaN, long: Infinity } }),
        ]),
    });

    expect(circuitsOf(noisy.outcome)).toEqual(circuitsOf(clean.outcome));
  });
});

describe('no partial resource', () => {
  it('returns nothing when one row of a full season is malformed', async () => {
    const { outcome } = await fetchCircuits(
      circuitsEnvelope([...fullSeasonCircuitRows(), { circuitName: 'x' }]),
    );

    expectInvalidPayload(outcome);
  });

  it('returns nothing when one row of a full season is unmapped', async () => {
    const rows = [...fullSeasonCircuitRows()];
    rows.splice(11, 0, circuitRow('synthetic_unmapped_venue'));

    const { outcome } = await fetchCircuits(circuitsEnvelope(rows));

    expectMappingFailure(outcome);
  });
});

describe('attempt and limiter accounting', () => {
  const unsupported: readonly CoordinatedResource[] = [
    { kind: 'season-calendar', season: SEASON },
    { kind: 'season-participants', season: SEASON },
    { kind: 'driver-standings', season: SEASON },
    { kind: 'constructor-standings', season: SEASON },
    { kind: 'event-schedule', season: SEASON, round: 1 },
    {
      kind: 'session-classification',
      season: SEASON,
      round: 1,
      sessionType: 'race',
    },
  ];

  for (const resource of unsupported) {
    it(`refuses ${resource.kind} with no limiter or transport activity`, async () => {
      const { limiter, reservations } = countingLimiter();
      const { port, calls } = circuitsHarness({
        transport: forbiddenTransport(),
        limiter,
      });

      const outcome = wellFormed(
        await port.fetchResource({ source: 'jolpica', resource }),
      );

      expect(outcome.outcome).toBe('not-attempted');
      if (outcome.outcome !== 'not-attempted') throw new Error('unreachable');
      expect(outcome.reason).toBe('resource-unsupported');
      expect('attempt' in outcome).toBe(false);
      expect(reservations).toHaveLength(0);
      expect(calls).toHaveLength(0);
    });
  }

  it('creates zero attempts when cancelled before the attempt', async () => {
    const { limiter, reservations } = countingLimiter();
    const { port, calls } = circuitsHarness({
      transport: forbiddenTransport(),
      limiter,
    });
    const controller = new AbortController();
    controller.abort();

    const outcome = wellFormed(
      await port.fetchResource({
        source: 'jolpica',
        resource: circuitsResource,
        signal: controller.signal,
      }),
    );

    expect(outcome.outcome).toBe('not-attempted');
    if (outcome.outcome !== 'not-attempted') throw new Error('unreachable');
    expect(outcome.reason).toBe('cancelled');
    expect('attempt' in outcome).toBe(false);
    expect(reservations).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it('does not count a rate-limit refusal as an attempted request', async () => {
    const retryAt = '2026-03-08T04:00:00.000Z';
    const { port, calls } = circuitsHarness({
      transport: forbiddenTransport(),
      limiter: deferringLimiter(retryAt),
    });

    const outcome = wellFormed(
      await port.fetchResource({
        source: 'jolpica',
        resource: circuitsResource,
      }),
    );

    expect(outcome.outcome).toBe('not-attempted');
    if (outcome.outcome !== 'not-attempted') throw new Error('unreachable');
    expect(outcome.reason).toBe('rate-limit-deferred');
    expect(outcome.retryAt).toBe(retryAt);
    expect('attempt' in outcome).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('fails closed when the limiter cannot answer', async () => {
    const { port, calls } = circuitsHarness({
      transport: forbiddenTransport(),
      limiter: unavailableLimiter,
    });

    const outcome = wellFormed(
      await port.fetchResource({
        source: 'jolpica',
        resource: circuitsResource,
      }),
    );

    expect(outcome.outcome).toBe('not-attempted');
    if (outcome.outcome !== 'not-attempted') throw new Error('unreachable');
    expect(outcome.reason).toBe('limiter-unavailable');
    expect(calls).toHaveLength(0);
  });

  it('creates exactly one attempt and one reservation for one page', async () => {
    const { limiter, reservations } = countingLimiter();
    const { port, calls } = circuitsHarness({
      transport: jsonTransport(circuitsEnvelope(fullSeasonCircuitRows())),
      limiter,
    });

    const outcome = await port.fetchResource({
      source: 'jolpica',
      resource: circuitsResource,
    });

    expect(outcome.outcome).toBe('candidate');
    if (outcome.outcome !== 'candidate') throw new Error('unreachable');
    expect(outcome.attempt.outcome).toBe('successful');
    expect(reservations).toEqual(['jolpica']);
    expect(calls).toHaveLength(1);
  });

  it('maps a transport failure to provider-unavailable, once, with no retry', async () => {
    const { port, calls } = circuitsHarness({ transport: failingTransport() });

    const outcome = wellFormed(
      await port.fetchResource({
        source: 'jolpica',
        resource: circuitsResource,
      }),
    );

    expect(calls).toHaveLength(1);
    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome !== 'failed') throw new Error('unreachable');
    expect(outcome.reason).toBe('provider-unavailable');
    expect(outcome.attempt.outcome).toBe('failed');
  });

  it('records an upstream 429 as the rate-limited attempt it was', async () => {
    const { port, calls } = circuitsHarness({
      transport: rateLimitedTransport(120),
    });

    const outcome = wellFormed(
      await port.fetchResource({
        source: 'jolpica',
        resource: circuitsResource,
      }),
    );

    expect(calls).toHaveLength(1);
    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome !== 'failed') throw new Error('unreachable');
    expect(outcome.reason).toBe('provider-rate-limited');
    expect(outcome.attempt.outcome).toBe('rate-limited');
    expect(outcome.retryAfter).toBeDefined();
  });

  it('gives each request its own transport reference', async () => {
    const { port } = circuitsHarness({
      transport: jsonTransport(circuitsEnvelope([circuitRow('albert_park')])),
    });

    const first = await port.fetchResource({
      source: 'jolpica',
      resource: circuitsResource,
    });
    const second = await port.fetchResource({
      source: 'jolpica',
      resource: circuitsResource,
    });

    if (first.outcome !== 'candidate' || second.outcome !== 'candidate') {
      throw new Error('expected two candidates');
    }
    expect(first.attempt.reference).not.toBe(second.attempt.reference);
  });
});

describe('exceptions never escape the port', () => {
  it('maps a hostile body accessor to invalid-payload', async () => {
    const { limiter, reservations } = countingLimiter();
    const { outcome, logger, calls } = await fetchCircuits(
      circuitsEnvelope([circuitRow('albert_park')]),
      {
        limiter,
        successData: () => ({
          get MRData(): never {
            throw new Error('hostile accessor');
          },
        }),
      },
    );

    expectInvalidPayload(outcome);
    expect(reservations).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(JSON.stringify(outcome)).not.toContain('hostile accessor');
    expect(logger.serialized()).not.toContain('hostile accessor');
  });

  it('maps a normalization exception to invalid-payload', async () => {
    const throwingRegistry = {
      resolve(): never {
        throw new Error('normalization exploded');
      },
    } as unknown as ProviderMappingRegistry;

    const { outcome, logger } = await fetchCircuits(
      circuitsEnvelope([circuitRow('albert_park')]),
      { registry: throwingRegistry },
    );

    expectInvalidPayload(outcome);
    expect(logger.serialized()).not.toContain('normalization exploded');
  });
});

describe('the calendar port is unchanged by this resource', () => {
  it('still refuses season-circuits before any limiter or transport activity', async () => {
    const { limiter, reservations } = countingLimiter();
    const transport = forbiddenTransport();
    const logger = new CapturingLogger();
    const calendar = new JolpicaCalendarPort({
      client: new ProviderHttpClient({
        transport: transport.transport,
        limiter,
        logger,
      }),
      logger,
      registry: providerMappingRegistry(),
    });

    const outcome = await calendar.fetchResource({
      source: 'jolpica',
      resource: circuitsResource,
    });

    expect(outcome).toEqual({
      outcome: 'not-attempted',
      reason: 'resource-unsupported',
    });
    expect(reservations).toHaveLength(0);
  });

  /**
   * The two ports map every hardened-boundary failure identically. Each owns
   * its copy of the mapping so the calendar slice stays untouched; this is
   * what keeps the copies from drifting apart.
   */
  const failures: readonly [string, () => RecordingTransport, boolean][] = [
    ['a network failure', failingTransport, true],
    ['an upstream 429', () => rateLimitedTransport(60), true],
    [
      'a rejected content type',
      () => jsonTransport({}, { contentType: 'text/html' }),
      true,
    ],
    ['an HTTP error status', () => jsonTransport({}, { status: 503 }), true],
    ['a malformed JSON body', () => jsonTransport('{ nope'), true],
    ['a deferring limiter', forbiddenTransport, false],
  ];

  for (const [label, transportFor, allowed] of failures) {
    it(`maps ${label} exactly as the calendar port does`, async () => {
      const limiter = allowed
        ? allowingLimiter
        : deferringLimiter('2026-03-08T04:00:00.000Z');
      const logger = new CapturingLogger();
      const client = (transport: RecordingTransport) =>
        new ProviderHttpClient({
          transport: transport.transport,
          limiter,
          logger,
        });

      const calendarOutcome = await new JolpicaCalendarPort({
        client: client(transportFor()),
        logger,
        reference: () => 'ref',
      }).fetchResource({
        source: 'jolpica',
        resource: { kind: 'season-calendar', season: SEASON },
      });
      const circuitsOutcome = await new JolpicaCircuitsPort({
        client: client(transportFor()),
        logger,
        reference: () => 'ref',
      }).fetchResource({ source: 'jolpica', resource: circuitsResource });

      // An upstream `Retry-After` is resolved against the clock when each
      // response arrives, so two sequential requests may land a second apart.
      // Its presence is compared; everything else must be identical.
      const withoutClock = (outcome: ProviderResourceOutcome) => {
        const { retryAfter, ...rest } = outcome as ProviderResourceOutcome & {
          retryAfter?: string;
        };
        return { ...rest, hasRetryAfter: retryAfter !== undefined };
      };
      expect(withoutClock(circuitsOutcome)).toEqual(
        withoutClock(calendarOutcome),
      );
    });
  }
});

describe('curated mapping is the only way to an identity', () => {
  it('uses the committed registry by default', () => {
    // The default registry is the committed documents, not an ad-hoc one.
    const committed = buildProviderMappingRegistry(
      curatedMappingDocuments(),
      curatedRegistries(),
    );
    const resolution = committed.resolve({
      season: SEASON,
      source: 'jolpica',
      entity: 'circuit',
      providerField: 'circuitId',
      providerValue: 'spa',
    });
    expect(resolution).toMatchObject({
      outcome: 'resolved',
      gridviewId: 'spa-francorchamps',
    });
  });
});
