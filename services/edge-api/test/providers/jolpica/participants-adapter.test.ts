/**
 * The Jolpica season-participants port, proven entirely against fakes.
 *
 * No test here reaches the network, needs a Cloudflare binding, reads a clock
 * or depends on a private evidence directory. The transport answers a scripted
 * sequence of in-memory steps and the limiter is a local object.
 */

import { describe, expect, it } from 'vitest';

import { canonicalConstructorSeasonEntryId } from '../../../src/contract/identity';
import type { Constructor, Driver } from '../../../src/contract/types';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  MultiSourceCoordinator,
  coordinatedResourceKinds,
  coordinationFor,
  isWellFormedOutcome,
  payloadMatchesResource,
  validateCoordinatedPayload,
  validateSeasonReferences,
  type CoordinatedPayloadFor,
  type CoordinatedResource,
  type ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import { gridViewUserAgent } from '../../../src/providers/http/provider-http-client';
import {
  curatedParticipants,
  curatedParticipantsFrom,
  participantsPageLimit,
  type CuratedDriverRow,
  type CuratedConstructorRow,
} from '../../../src/providers/jolpica';
import {
  PROVIDER_MAPPING_OPERATION,
  buildProviderMappingRegistry,
  curatedRegistries,
} from '../../../src/providers/mappings';
import { MockFormulaOneProvider } from '../../../src/providers/mock/mock-provider';
import { FixedClock } from '../../../src/runtime/clock';
import {
  CONSTRUCTORS_URL,
  DRIVERS_URL,
  RETRY_AT,
  completeScript,
  constructorRow,
  constructorsEnvelope,
  curatedConstructorMappings,
  curatedDriverMappings,
  driverRow,
  driversEnvelope,
  editedRegistry,
  fullSeasonConstructorRows,
  fullSeasonDriverRows,
  mappingDocument,
  participantsHarness,
  registryRows,
  syntheticMarkers,
  type EnvelopeOptions,
  type ParticipantsHarnessOptions,
  type TransportStep,
} from './participants-support';
import { LIMIT, SEASON } from './support';

const PARTICIPANTS: CoordinatedResource = {
  kind: 'season-participants',
  season: SEASON,
};

type ParticipantsPayload = CoordinatedPayloadFor<'season-participants'>;

async function fetchParticipants(
  options: ParticipantsHarnessOptions = {},
  signal?: AbortSignal,
) {
  const harness = participantsHarness(options);
  const outcome = await harness.port.fetchResource({
    source: 'jolpica',
    resource: PARTICIPANTS,
    ...(signal ? { signal } : {}),
  });
  return { ...harness, outcome };
}

function payloadOf(outcome: ProviderResourceOutcome): ParticipantsPayload {
  if (outcome.outcome !== 'candidate') {
    throw new Error(`expected a candidate, got ${outcome.outcome}`);
  }
  if (outcome.payload.kind !== 'season-participants') {
    throw new Error('expected a participants payload');
  }
  return outcome.payload;
}

function attemptOutcomes(outcome: ProviderResourceOutcome): string[] {
  return 'attempts' in outcome
    ? outcome.attempts.map((attempt) => attempt.outcome)
    : [];
}

const DRIVER_OPTIONAL_KEYS = [
  'givenName',
  'familyName',
  'shortCode',
  'permanentNumber',
  'nationality',
  'countryCode',
  'dateOfBirth',
  'placeOfBirth',
  'biography',
] as const;

const CONSTRUCTOR_ENTRY_NULL_KEYS = [
  'fullName',
  'shortName',
  'colorPrimary',
  'colorSecondary',
  'powerUnit',
  'teamPrincipal',
  'base',
  'chassis',
  'driverLineup',
] as const;

describe('a complete season-participants resource', () => {
  it('makes exactly two sequential requests, drivers then constructors', async () => {
    const { calls, reservations, outcome } = await fetchParticipants();

    expect(calls.map((call) => call.url)).toEqual([
      DRIVERS_URL,
      CONSTRUCTORS_URL,
    ]);
    for (const call of calls) {
      expect(call.method).toBe('GET');
      expect(call.redirect).toBe('manual');
      expect(call.hasBody).toBe(false);
      expect(call.headers['user-agent']).toBe(gridViewUserAgent);
      expect(new URL(call.url).searchParams.get('limit')).toBe(String(LIMIT));
    }
    expect(participantsPageLimit).toBe(100);
    // One reservation per request, both against the Jolpica budget.
    expect(reservations).toEqual(['jolpica', 'jolpica']);
    expect(outcome.outcome).toBe('candidate');
  });

  it('reports both requests as distinct, successful, ordered attempts', async () => {
    const { outcome } = await fetchParticipants();

    expect(outcome.outcome === 'candidate' && outcome.attempts).toHaveLength(2);
    expect(attemptOutcomes(outcome)).toEqual(['successful', 'successful']);
    if (outcome.outcome !== 'candidate') return;
    expect(outcome.attempts[0].reference).not.toBe(
      outcome.attempts[1]?.reference,
    );
    expect(isWellFormedOutcome(outcome)).toBe(true);
  });

  it('emits exactly four collections and passes the production validators', async () => {
    const { outcome } = await fetchParticipants();
    const payload = payloadOf(outcome);

    expect(Object.keys(payload).sort()).toEqual([
      'constructorEntries',
      'constructors',
      'driverEntries',
      'drivers',
      'kind',
    ]);
    expect(payloadMatchesResource(PARTICIPANTS, payload)).toBe(true);
    expect(validateCoordinatedPayload(payload)).toEqual([]);
  });

  it('normalizes all 32 drivers and 11 constructors to curated identities, in provider order', async () => {
    const { outcome } = await fetchParticipants();
    const payload = payloadOf(outcome);

    expect(payload.drivers).toHaveLength(32);
    expect(payload.constructors).toHaveLength(11);
    expect(payload.drivers.map((driver) => driver.id)).toEqual(
      curatedDriverMappings().map((mapping) => mapping.gridviewId),
    );
    expect(payload.constructors.map((constructor) => constructor.id)).toEqual(
      curatedConstructorMappings().map((mapping) => mapping.gridviewId),
    );
  });

  it('resolves the three curated special cases', async () => {
    const payload = payloadOf((await fetchParticipants()).outcome);
    const constructors = new Map(
      payload.constructors.map((constructor) => [constructor.id, constructor]),
    );
    const drivers = new Set(payload.drivers.map((driver) => driver.id));

    // `audi` continues the stable `sauber` lineage, whose current name is Audi.
    expect(constructors.get('sauber')?.name).toBe('Audi');
    expect(constructors.has('audi')).toBe(false);
    expect(constructors.has('racing-bulls')).toBe(true);
    expect(constructors.has('rb')).toBe(false);
    expect(drivers.has('andrea-kimi-antonelli')).toBe(true);
    expect(drivers.has('antonelli')).toBe(false);
  });

  it('never uses a provider identifier as a canonical identifier', async () => {
    const payload = payloadOf((await fetchParticipants()).outcome);
    const ids = new Set([
      ...payload.drivers.map((driver) => driver.id),
      ...payload.constructors.map((constructor) => constructor.id),
    ]);
    const differing = [
      ...curatedDriverMappings(),
      ...curatedConstructorMappings(),
    ].filter((mapping) => mapping.providerValue !== mapping.gridviewId);

    // Not vacuous: underscores, surname slugs, `audi`, `rb` and `antonelli`.
    expect(differing.length).toBeGreaterThan(10);
    for (const mapping of differing) {
      expect(ids.has(mapping.providerValue), mapping.providerValue).toBe(false);
    }
  });

  it('takes every name and fact from the curated registries, with media null', async () => {
    const payload = payloadOf((await fetchParticipants()).outcome);
    const curated = curatedParticipants();

    for (const driver of payload.drivers) {
      expect(driver).toEqual({ ...curated.driverById(driver.id), media: null });
    }
    for (const constructor of payload.constructors) {
      expect(constructor).toEqual({
        ...curated.constructorById(constructor.id),
        media: null,
      });
    }
  });

  it('keeps identity-only drivers with every optional fact present as explicit null', async () => {
    const payload = payloadOf((await fetchParticipants()).outcome);
    const identityOnly = new Set(
      registryRows('drivers')
        .filter((row) => Object.keys(row).length === 2)
        .map((row) => row.id as string),
    );
    const emitted = payload.drivers.filter((driver) =>
      identityOnly.has(driver.id),
    );

    expect(emitted).toHaveLength(25);
    for (const driver of emitted) {
      for (const key of DRIVER_OPTIONAL_KEYS) {
        expect(Object.hasOwn(driver, key), `${driver.id}.${key}`).toBe(true);
        expect(driver[key], `${driver.id}.${key}`).toBeNull();
      }
    }
  });

  it('applies exactly the mock provider defaults to every curated participant', async () => {
    const provider = new MockFormulaOneProvider({
      clock: new FixedClock(new Date('2026-07-20T12:00:00.000Z')),
    });
    const source = await provider.fetchSeasonSource(2026, ['season-calendar']);
    const curated = curatedParticipants();

    expect(source.drivers.length).toBeGreaterThanOrEqual(32);
    expect(source.constructors).toHaveLength(11);
    for (const mockDriver of source.drivers) {
      expect({ ...curated.driverById(mockDriver.id), media: null }).toEqual({
        ...mockDriver,
        media: null,
      });
    }
    for (const mockConstructor of source.constructors) {
      expect({
        ...curated.constructorById(mockConstructor.id),
        media: null,
      }).toEqual({ ...mockConstructor, media: null });
    }
  });

  it('ignores every provider-descriptive field, including deliberately conflicting ones', async () => {
    const { outcome, logger } = await fetchParticipants();
    const serialized = JSON.stringify(payloadOf(outcome));
    const logged = JSON.stringify(logger.events);

    for (const marker of syntheticMarkers) {
      expect(serialized).not.toContain(marker);
      expect(logged).not.toContain(marker);
    }
    // A provider permanent number never becomes a curated one.
    expect(serialized).not.toContain('"permanentNumber":99');
  });

  it('emits no driver season entry', async () => {
    const payload = payloadOf((await fetchParticipants()).outcome);
    expect(payload.driverEntries).toEqual([]);
  });

  it('emits one null-faceted constructor season entry per constructor', async () => {
    const payload = payloadOf((await fetchParticipants()).outcome);
    const entries = payload.constructorEntries;

    expect(entries).toHaveLength(11);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(11);
    expect(entries.map((entry) => entry.constructorId)).toEqual(
      payload.constructors.map((constructor) => constructor.id),
    );
    for (const entry of entries) {
      expect(entry.id).toBe(
        canonicalConstructorSeasonEntryId(SEASON, entry.constructorId),
      );
      expect(entry.season).toBe(SEASON);
      for (const key of CONSTRUCTOR_ENTRY_NULL_KEYS) {
        expect(entry[key], `${entry.id}.${key}`).toBeNull();
      }
    }
    expect(entries.map((entry) => entry.id)).toContain('2026-sauber');
    expect(entries.map((entry) => entry.id)).not.toContain('2026-audi');
  });

  it('satisfies every season reference relation it participates in', async () => {
    const payload = payloadOf((await fetchParticipants()).outcome);

    expect(
      validateSeasonReferences({
        season: SEASON,
        contentVersion: 'test',
        mediaVersion: null,
        attributionVersion: null,
        sourceUpdatedAt: '2026-07-20T12:00:00.000Z',
        seasonLabel: null,
        calendar: [],
        results: [],
        drivers: [...payload.drivers] as Driver[],
        constructors: [...payload.constructors] as Constructor[],
        circuits: [],
        driverEntries: [...payload.driverEntries],
        constructorEntries: [...payload.constructorEntries],
        driverStandings: [],
        constructorStandings: [],
      }),
    ).toEqual([]);
  });

  it('leaves its fixtures and the curated content unmutated, and returns a detached payload', async () => {
    const steps = completeScript();
    const before = JSON.stringify(steps);
    const curated = curatedParticipants();
    const sauber = JSON.stringify(curated.constructorById('sauber'));

    const { outcome } = await fetchParticipants({ steps });
    const payload = payloadOf(outcome);
    (payload.constructors[0] as { name: string }).name = 'mutated';
    (payload.drivers[0] as { fullName: string }).fullName = 'mutated';

    expect(JSON.stringify(steps)).toBe(before);
    expect(JSON.stringify(curated.constructorById('sauber'))).toBe(sauber);
    expect(
      curated.constructorById(payload.constructors[0]?.id ?? '')?.name,
    ).not.toBe('mutated');
    const again = payloadOf((await fetchParticipants()).outcome);
    expect(again.drivers[0]?.fullName).not.toBe('mutated');
  });

  it('decodes a smaller synthetic season without assuming 32 or 11 rows', async () => {
    const drivers = fullSeasonDriverRows().slice(0, 3);
    const constructors = fullSeasonConstructorRows().slice(0, 2);
    const { outcome } = await fetchParticipants({
      steps: [
        { kind: 'json', body: driversEnvelope(drivers) },
        { kind: 'json', body: constructorsEnvelope(constructors) },
      ],
    });
    const payload = payloadOf(outcome);

    expect(payload.drivers).toHaveLength(3);
    expect(payload.constructors).toHaveLength(2);
    expect(payload.constructorEntries).toHaveLength(2);
  });

  it('is selected, counted twice and attributed through the coordinator', async () => {
    const harness = participantsHarness();
    const run = await new MultiSourceCoordinator({
      ports: [harness.port],
      logger: new CapturingLogger(),
    }).coordinate({ plan: { season: SEASON, resources: [PARTICIPANTS] } });

    expect(run.status).toBe('completed');
    expect(coordinationFor(run, PARTICIPANTS)?.selection.outcome).toBe(
      'selected',
    );
    expect(run.accounting.lifetime).toEqual({
      total: 2,
      successful: 2,
      failed: 0,
      rateLimited: 0,
    });
    expect(run.accounting.byJobCategory).toEqual({
      profiles: { total: 2, successful: 2, failed: 0, rateLimited: 0 },
    });
  });

  it('involves no OpenF1 value', async () => {
    const { outcome, calls } = await fetchParticipants();
    const serialized = JSON.stringify(payloadOf(outcome));

    expect(
      calls.every((call) => call.url.startsWith('https://api.jolpi.ca/')),
    ).toBe(true);
    // The three OpenF1 acknowledgements stay unrelated to this resource.
    expect(serialized).not.toMatch(/openf1|driver_number|team_name/i);
  });
});

describe('resource refusal and request control', () => {
  it('refuses every other resource before any reservation, request or attempt', async () => {
    for (const kind of coordinatedResourceKinds) {
      if (kind === 'season-participants') continue;
      const resource = (
        kind === 'event-schedule'
          ? { kind, season: SEASON, round: 1 }
          : kind === 'session-classification'
            ? { kind, season: SEASON, round: 1, sessionType: 'race' }
            : { kind, season: SEASON }
      ) as CoordinatedResource;
      const harness = participantsHarness();
      const outcome = await harness.port.fetchResource({
        source: 'jolpica',
        resource,
      });

      expect(outcome, kind).toEqual({
        outcome: 'not-attempted',
        reason: 'resource-unsupported',
      });
      expect(harness.calls, kind).toHaveLength(0);
      expect(harness.reservations, kind).toHaveLength(0);
    }
  });

  it('refuses a cancellation before the first request without reserving', async () => {
    const controller = new AbortController();
    controller.abort();
    const { outcome, calls, reservations } = await fetchParticipants(
      {},
      controller.signal,
    );

    expect(outcome).toEqual({ outcome: 'not-attempted', reason: 'cancelled' });
    expect(calls).toHaveLength(0);
    expect(reservations).toHaveLength(0);
  });

  it('keeps a limiter deferral before the first request not attempted', async () => {
    const { outcome, calls } = await fetchParticipants({
      limiter: ['deferred'],
    });

    expect(outcome).toEqual({
      outcome: 'not-attempted',
      reason: 'rate-limit-deferred',
      retryAt: RETRY_AT,
    });
    expect(calls).toHaveLength(0);
  });

  it('keeps an unavailable limiter before the first request not attempted', async () => {
    const { outcome, calls } = await fetchParticipants({
      limiter: ['unavailable'],
    });

    expect(outcome).toEqual({
      outcome: 'not-attempted',
      reason: 'limiter-unavailable',
    });
    expect(calls).toHaveLength(0);
  });

  const firstRequestFailures: readonly {
    readonly name: string;
    readonly step: TransportStep;
    readonly reason: string;
    readonly attempt: string;
  }[] = [
    {
      name: 'a transport failure',
      step: { kind: 'network' },
      reason: 'provider-unavailable',
      attempt: 'failed',
    },
    {
      name: 'an HTTP error',
      step: { kind: 'status', status: 503 },
      reason: 'provider-unavailable',
      attempt: 'failed',
    },
    {
      name: 'a provider 429',
      step: { kind: 'rate-limited', retryAfterSeconds: 30 },
      reason: 'provider-rate-limited',
      attempt: 'rate-limited',
    },
    {
      name: 'an invalid payload',
      step: { kind: 'json', body: { MRData: null } },
      reason: 'invalid-payload',
      attempt: 'successful',
    },
  ];

  for (const failure of firstRequestFailures) {
    it(`ends on ${failure.name} of the first request without beginning the second`, async () => {
      const { outcome, calls, reservations } = await fetchParticipants({
        steps: [failure.step],
      });

      expect(outcome.outcome).toBe('failed');
      expect(outcome.outcome === 'failed' && outcome.reason).toBe(
        failure.reason,
      );
      expect(attemptOutcomes(outcome)).toEqual([failure.attempt]);
      expect(calls.map((call) => call.url)).toEqual([DRIVERS_URL]);
      expect(reservations).toHaveLength(1);
      expect(isWellFormedOutcome(outcome)).toBe(true);
    });
  }

  it('carries the upstream retry instruction of a first-request 429', async () => {
    const { outcome } = await fetchParticipants({
      steps: [{ kind: 'rate-limited', retryAfterSeconds: 30 }],
    });
    expect(outcome.outcome === 'failed' && outcome.retryAfter).toEqual(
      expect.any(String),
    );
  });

  it('ends on a driver mapping failure without beginning the second request', async () => {
    const { outcome, calls, logger } = await fetchParticipants({
      steps: [
        {
          kind: 'json',
          body: driversEnvelope([
            ...fullSeasonDriverRows(),
            driverRow('synthetic_unmapped'),
          ]),
        },
      ],
    });

    expect(outcome.outcome).toBe('mapping-failure');
    expect(attemptOutcomes(outcome)).toEqual(['successful']);
    expect(calls).toHaveLength(1);
    expect(
      logger.events.some(
        (event) => event.operation === PROVIDER_MAPPING_OPERATION,
      ),
    ).toBe(true);
  });

  it('is interrupted by a cancellation between the two requests', async () => {
    const controller = new AbortController();
    const { outcome, calls, reservations } = await fetchParticipants(
      { afterResponse: (index) => index === 0 && controller.abort() },
      controller.signal,
    );

    expect(outcome.outcome).toBe('interrupted');
    expect(outcome.outcome === 'interrupted' && outcome.reason).toBe(
      'cancelled',
    );
    expect(attemptOutcomes(outcome)).toEqual(['successful']);
    expect(calls).toHaveLength(1);
    // The constructors request never reached the limiter either.
    expect(reservations).toHaveLength(1);
    expect(isWellFormedOutcome(outcome)).toBe(true);
    expect('payload' in outcome).toBe(false);
  });

  it('is interrupted by a cancellation during the second reservation', async () => {
    const controller = new AbortController();
    const { outcome, calls, reservations } = await fetchParticipants(
      { limiter: ['allowed', { abort: controller }] },
      controller.signal,
    );

    expect(outcome).toMatchObject({
      outcome: 'interrupted',
      reason: 'cancelled',
    });
    expect(attemptOutcomes(outcome)).toEqual(['successful']);
    expect(calls).toHaveLength(1);
    expect(reservations).toHaveLength(2);
  });

  it('is interrupted by a limiter deferral before the second request', async () => {
    const { outcome, calls } = await fetchParticipants({
      limiter: ['allowed', 'deferred'],
    });

    expect(outcome).toEqual({
      outcome: 'interrupted',
      attempts: [expect.objectContaining({ outcome: 'successful' })],
      reason: 'rate-limit-deferred',
      retryAt: RETRY_AT,
    });
    expect(calls).toHaveLength(1);
  });

  it('is interrupted by an unavailable limiter before the second request', async () => {
    const { outcome, calls } = await fetchParticipants({
      limiter: ['allowed', 'unavailable'],
    });

    expect(outcome).toEqual({
      outcome: 'interrupted',
      attempts: [expect.objectContaining({ outcome: 'successful' })],
      reason: 'limiter-unavailable',
    });
    expect(calls).toHaveLength(1);
  });

  const secondRequestFailures: readonly {
    readonly name: string;
    readonly step: TransportStep;
    readonly reason: string;
    readonly attempts: readonly string[];
  }[] = [
    {
      name: 'a transport failure',
      step: { kind: 'network' },
      reason: 'provider-unavailable',
      attempts: ['successful', 'failed'],
    },
    {
      name: 'a provider 429',
      step: { kind: 'rate-limited', retryAfterSeconds: 30 },
      reason: 'provider-rate-limited',
      attempts: ['successful', 'rate-limited'],
    },
    {
      name: 'an invalid payload',
      step: { kind: 'json', body: constructorsEnvelope(null) },
      reason: 'invalid-payload',
      attempts: ['successful', 'successful'],
    },
  ];

  for (const failure of secondRequestFailures) {
    it(`reports both attempts and no payload on ${failure.name} of the second request`, async () => {
      const [drivers] = completeScript();
      const { outcome, calls, reservations } = await fetchParticipants({
        steps: [drivers as TransportStep, failure.step],
      });

      expect(outcome.outcome).toBe('failed');
      expect(outcome.outcome === 'failed' && outcome.reason).toBe(
        failure.reason,
      );
      expect(attemptOutcomes(outcome)).toEqual(failure.attempts);
      expect('payload' in outcome).toBe(false);
      expect(calls.map((call) => call.url)).toEqual([
        DRIVERS_URL,
        CONSTRUCTORS_URL,
      ]);
      expect(reservations).toHaveLength(2);
      expect(isWellFormedOutcome(outcome)).toBe(true);
    });
  }

  it('reports both attempts on a constructor mapping failure', async () => {
    const [drivers] = completeScript();
    const { outcome, calls } = await fetchParticipants({
      steps: [
        drivers as TransportStep,
        {
          kind: 'json',
          body: constructorsEnvelope([
            ...fullSeasonConstructorRows(),
            constructorRow('synthetic_unmapped'),
          ]),
        },
      ],
    });

    expect(outcome.outcome).toBe('mapping-failure');
    expect(attemptOutcomes(outcome)).toEqual(['successful', 'successful']);
    expect(calls).toHaveLength(2);
  });

  it('never retries and never makes a third request', async () => {
    // A third scripted step would be answered; none may be asked for.
    const steps: TransportStep[] = [
      ...completeScript(),
      { kind: 'json', body: {} },
    ];
    const success = await fetchParticipants({ steps });
    expect(success.calls).toHaveLength(2);

    const failing = await fetchParticipants({
      steps: [{ kind: 'network' }, { kind: 'network' }, { kind: 'network' }],
    });
    expect(failing.calls).toHaveLength(1);
  });

  it('counts an interrupted and a failed second request exactly through the coordinator', async () => {
    const coordinate = async (options: ParticipantsHarnessOptions) => {
      const harness = participantsHarness(options);
      return new MultiSourceCoordinator({
        ports: [harness.port],
        logger: new CapturingLogger(),
      }).coordinate({ plan: { season: SEASON, resources: [PARTICIPANTS] } });
    };
    const [drivers] = completeScript();

    const failed = await coordinate({
      steps: [drivers as TransportStep, { kind: 'network' }],
    });
    expect(failed.accounting.lifetime).toEqual({
      total: 2,
      successful: 1,
      failed: 1,
      rateLimited: 0,
    });
    expect(coordinationFor(failed, PARTICIPANTS)?.selection.outcome).toBe(
      'unavailable',
    );

    const interrupted = await coordinate({ limiter: ['allowed', 'deferred'] });
    expect(interrupted.accounting.lifetime).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    const contribution = coordinationFor(
      interrupted,
      PARTICIPANTS,
    )?.contributions.find((entry) => entry.source === 'jolpica');
    expect(contribution).toMatchObject({
      status: 'interrupted',
      attempted: true,
      reason: 'rate-limit-deferred',
      payload: null,
    });
  });
});

type Endpoint = 'drivers' | 'constructors';

/** Runs the port with one endpoint's response replaced. */
function withEndpoint(
  endpoint: Endpoint,
  body: unknown,
  options: Omit<ParticipantsHarnessOptions, 'steps'> = {},
) {
  const [drivers, constructors] = completeScript();
  const replaced: TransportStep = { kind: 'json', body };
  return fetchParticipants({
    ...options,
    steps:
      endpoint === 'drivers'
        ? [replaced, constructors as TransportStep]
        : [drivers as TransportStep, replaced],
  });
}

function rowsFor(endpoint: Endpoint): Record<string, unknown>[] {
  return endpoint === 'drivers'
    ? fullSeasonDriverRows()
    : fullSeasonConstructorRows();
}

function envelopeFor(
  endpoint: Endpoint,
  rows: unknown,
  options: EnvelopeOptions = {},
): Record<string, unknown> {
  return endpoint === 'drivers'
    ? driversEnvelope(rows, options)
    : constructorsEnvelope(rows, options);
}

function expectInvalid(
  endpoint: Endpoint,
  result: Awaited<ReturnType<typeof fetchParticipants>>,
  category?: string,
): void {
  expect(result.outcome.outcome).toBe('failed');
  expect(result.outcome.outcome === 'failed' && result.outcome.reason).toBe(
    'invalid-payload',
  );
  expect(result.calls).toHaveLength(endpoint === 'drivers' ? 1 : 2);
  expect(attemptOutcomes(result.outcome)).toEqual(
    endpoint === 'drivers' ? ['successful'] : ['successful', 'successful'],
  );
  if (category !== undefined) {
    expect(
      result.logger.events.find(
        (event) => event.operation === 'provider.participants.invalid_payload',
      )?.failureCategory,
    ).toBe(`${endpoint}-${category}`);
  }
}

function expectMappingFailure(
  endpoint: Endpoint,
  result: Awaited<ReturnType<typeof fetchParticipants>>,
): void {
  expect(result.outcome.outcome).toBe('mapping-failure');
  expect(result.calls).toHaveLength(endpoint === 'drivers' ? 1 : 2);
}

for (const endpoint of ['drivers', 'constructors'] as const) {
  describe(`${endpoint} pagination fails the whole resource`, () => {
    const count = (): number => rowsFor(endpoint).length;
    const cases: readonly [string, () => EnvelopeOptions, string][] = [
      ['a missing limit', () => ({ limit: undefined }), 'pagination'],
      ['a missing offset', () => ({ offset: undefined }), 'pagination'],
      ['a missing total', () => ({ total: undefined }), 'pagination'],
      ['a non-decimal total', () => ({ total: 'thirty' }), 'pagination'],
      ['a signed limit', () => ({ limit: '+100' }), 'pagination'],
      ['a negative offset', () => ({ offset: '-0' }), 'pagination'],
      [
        'a whitespace-padded total',
        () => ({ total: ` ${count()}` }),
        'pagination',
      ],
      ['a trailing-space limit', () => ({ limit: '100 ' }), 'pagination'],
      ['a fractional total', () => ({ total: `${count()}.0` }), 'pagination'],
      ['an exponent limit', () => ({ limit: '1e2' }), 'pagination'],
      ['a JSON-number limit', () => ({ limit: 100 }), 'pagination'],
      ['a leading-zero total', () => ({ total: `0${count()}` }), 'pagination'],
      ['an invalid offset', () => ({ offset: '1' }), 'pagination'],
      ['a different limit', () => ({ limit: '30' }), 'pagination'],
      [
        'an inconsistent total',
        () => ({ total: String(count() - 1) }),
        'incomplete-page',
      ],
      [
        'an incomplete page',
        () => ({ total: String(count() + 5) }),
        'incomplete-page',
      ],
      ['a total beyond the limit', () => ({ total: '101' }), 'incomplete-page'],
      ['a different season', () => ({ season: '2025' }), 'season-mismatch'],
      ['a numeric season', () => ({ season: SEASON }), 'season-mismatch'],
    ];

    for (const [name, options, category] of cases) {
      it(`refuses ${name}`, async () => {
        const result = await withEndpoint(
          endpoint,
          envelopeFor(endpoint, rowsFor(endpoint), options()),
        );
        expectInvalid(endpoint, result, category);
      });
    }

    it('refuses a row count that disagrees with the envelope', async () => {
      const rows = rowsFor(endpoint);
      const result = await withEndpoint(
        endpoint,
        envelopeFor(endpoint, rows.slice(1), { total: String(rows.length) }),
      );
      expectInvalid(endpoint, result, 'incomplete-page');
    });
  });

  describe(`${endpoint} mapping integrity fails the whole resource`, () => {
    const entity = endpoint === 'drivers' ? 'driver' : 'constructor';
    const field = endpoint === 'drivers' ? 'driverId' : 'constructorId';
    const row = endpoint === 'drivers' ? driverRow : constructorRow;
    const mappings = (): ReturnType<typeof curatedDriverMappings> =>
      endpoint === 'drivers'
        ? curatedDriverMappings()
        : curatedConstructorMappings();

    it('refuses an unmapped provider identity and drops no row', async () => {
      const result = await withEndpoint(
        endpoint,
        envelopeFor(endpoint, [
          ...rowsFor(endpoint),
          row('synthetic_unmapped'),
        ]),
      );
      expectMappingFailure(endpoint, result);
      expect('payload' in result.outcome).toBe(false);
    });

    it('refuses a mapping recorded under the wrong provider field', async () => {
      const [first] = mappings();
      const otherEntity = entity === 'driver' ? 'constructor' : 'driver';
      const otherField = entity === 'driver' ? 'constructorId' : 'driverId';
      const otherTarget = entity === 'driver' ? 'williams' : 'lando-norris';
      const registry = editedRegistry((document) => {
        document.mappings = document.mappings.map((mapping) =>
          mapping.entity === entity &&
          mapping.providerValue === first?.providerValue
            ? {
                ...mapping,
                entity: otherEntity,
                providerField: otherField,
                gridviewId: otherTarget,
              }
            : mapping,
        );
      });
      const result = await withEndpoint(
        endpoint,
        envelopeFor(endpoint, rowsFor(endpoint)),
        { registry },
      );
      expectMappingFailure(endpoint, result);
    });

    it('refuses a mapping curated only for another season', async () => {
      const document = mappingDocument();
      const isEntity = (mapping: { source: string; entity: string }) =>
        mapping.source === 'jolpica' && mapping.entity === entity;
      const registry = buildProviderMappingRegistry(
        [
          {
            ...document,
            mappings: document.mappings.filter((mapping) => !isEntity(mapping)),
          },
          {
            ...document,
            season: 2025,
            mappings: document.mappings.filter(isEntity),
          },
        ],
        curatedRegistries(),
      );
      const result = await withEndpoint(
        endpoint,
        envelopeFor(endpoint, rowsFor(endpoint)),
        { registry },
      );
      expectMappingFailure(endpoint, result);
    });

    it('refuses a duplicate provider identity', async () => {
      const rows = rowsFor(endpoint);
      const result = await withEndpoint(
        endpoint,
        envelopeFor(endpoint, [...rows, rows[0]]),
      );
      expectInvalid(endpoint, result, 'duplicate-identity');
    });

    it('refuses two provider identities resolving to one canonical identity', async () => {
      const [first] = mappings();
      const registry = editedRegistry((document) => {
        const template = document.mappings.find(
          (mapping) =>
            mapping.entity === entity &&
            mapping.providerValue === first?.providerValue,
        );
        document.mappings = [
          ...document.mappings,
          { ...template, providerValue: 'synthetic_alias' } as never,
        ];
      });
      const result = await withEndpoint(
        endpoint,
        envelopeFor(endpoint, [...rowsFor(endpoint), row('synthetic_alias')]),
        { registry },
      );
      expectInvalid(endpoint, result, `duplicate-canonical-${entity}`);
    });

    it('refuses a mapped target absent from the canonical registry', async () => {
      const [first] = mappings();
      const canonical = curatedRegistries();
      const registry = editedRegistry(() => undefined, {
        ...canonical,
        [entity]: new Set(
          [...canonical[entity]].filter((id) => id !== first?.gridviewId),
        ),
      });
      const result = await withEndpoint(
        endpoint,
        envelopeFor(endpoint, rowsFor(endpoint)),
        { registry },
      );
      // A registry with a dangling target is invalid as a whole and resolves
      // nothing, so the resource fails closed on its first request whichever
      // collection holds the dangling mapping.
      expect(result.outcome.outcome).toBe('mapping-failure');
      expect(result.calls).toHaveLength(1);
    });

    it('refuses a resolved identity with no curated content', async () => {
      const [first] = mappings();
      const drivers = registryRows('drivers') as unknown as CuratedDriverRow[];
      const constructors = registryRows(
        'constructors',
      ) as unknown as CuratedConstructorRow[];
      const participants = curatedParticipantsFrom(
        entity === 'driver'
          ? drivers.filter((entry) => entry.id !== first?.gridviewId)
          : drivers,
        entity === 'constructor'
          ? constructors.filter((entry) => entry.id !== first?.gridviewId)
          : constructors,
      );
      const result = await withEndpoint(
        endpoint,
        envelopeFor(endpoint, rowsFor(endpoint)),
        { participants },
      );
      expectMappingFailure(endpoint, result);
      expect(
        result.logger.events.find(
          (event) =>
            event.operation === 'provider.participants.curated_content_missing',
        )?.failureCategory,
      ).toBe(`curated-${entity}-missing`);
    });

    it(`resolves ${field} values only through the curated registry`, async () => {
      // Sanity for the cases above: the unedited registry resolves every row.
      const result = await withEndpoint(
        endpoint,
        envelopeFor(endpoint, rowsFor(endpoint)),
      );
      expect(result.outcome.outcome).toBe('candidate');
    });
  });

  describe(`hostile ${endpoint} payloads fail closed and never throw`, () => {
    const index = endpoint === 'drivers' ? 0 : 1;
    const identity = endpoint === 'drivers' ? 'driverId' : 'constructorId';
    const table = endpoint === 'drivers' ? 'DriverTable' : 'ConstructorTable';

    const bodies: readonly [string, () => unknown, string][] = [
      ['a null body', () => null, 'envelope'],
      ['an array body', () => [], 'envelope'],
      ['a null MRData', () => ({ MRData: null }), 'envelope'],
      ['an array MRData', () => ({ MRData: [] }), 'envelope'],
      [
        'an array table',
        () => {
          const body = envelopeFor(endpoint, []);
          (body.MRData as Record<string, unknown>)[table] = [];
          return body;
        },
        'envelope',
      ],
      ['a null collection', () => envelopeFor(endpoint, null), 'collection'],
      ['an object collection', () => envelopeFor(endpoint, {}), 'collection'],
      ['a null row', () => envelopeFor(endpoint, [null]), 'row'],
      ['an array row', () => envelopeFor(endpoint, [[]]), 'row'],
      ['a string row', () => envelopeFor(endpoint, ['albon']), 'row'],
      [
        'a numeric identity',
        () => envelopeFor(endpoint, [{ [identity]: 7 }]),
        'identity',
      ],
      [
        'an empty identity',
        () => envelopeFor(endpoint, [{ [identity]: '' }]),
        'identity',
      ],
      [
        'a padded identity',
        () =>
          envelopeFor(endpoint, [
            {
              [identity]: ` ${String((rowsFor(endpoint)[0] ?? {})[identity])}`,
            },
          ]),
        'mapping',
      ],
    ];

    for (const [name, body, category] of bodies) {
      it(`refuses ${name}`, async () => {
        const result = await withEndpoint(endpoint, body());
        if (category === 'mapping') {
          expectMappingFailure(endpoint, result);
        } else {
          expectInvalid(endpoint, result, category);
        }
      });
    }

    it('refuses an accessor that throws during decode, without invoking it', async () => {
      let invoked = false;
      const result = await fetchParticipants({
        successData: (call) => {
          if (call !== index) return undefined;
          const body = envelopeFor(endpoint, rowsFor(endpoint));
          Object.defineProperty(body, 'MRData', {
            enumerable: true,
            get() {
              invoked = true;
              throw new Error('https://example.invalid/hostile');
            },
          });
          return body;
        },
      });
      expectInvalid(endpoint, result, 'envelope');
      expect(invoked).toBe(false);
      expect(JSON.stringify(result.logger.events)).not.toContain('hostile');
    });

    it('contains a proxy whose traps throw', async () => {
      const result = await fetchParticipants({
        successData: (call) =>
          call === index
            ? new Proxy(
                {},
                {
                  getOwnPropertyDescriptor() {
                    throw new Error('hostile');
                  },
                },
              )
            : undefined,
      });
      expectInvalid(endpoint, result, 'envelope');
    });

    it('refuses an identity inherited from the prototype', async () => {
      const inherited = Object.create({
        [identity]: rowsFor(endpoint)[0]?.[identity],
      }) as Record<string, unknown>;
      const result = await withEndpoint(
        endpoint,
        envelopeFor(endpoint, [inherited]),
      );
      expectInvalid(endpoint, result, 'identity');
    });

    it('refuses a collection with a hole', async () => {
      const rows: unknown[] = [...rowsFor(endpoint)];
      delete rows[0];
      const result = await fetchParticipants({
        successData: (call) =>
          call === index ? envelopeFor(endpoint, rows) : undefined,
      });
      expectInvalid(endpoint, result, 'row');
    });

    it('ignores symbol-keyed and non-enumerable extras on a row', async () => {
      const rows = rowsFor(endpoint).map((entry) => {
        const copy: Record<string | symbol, unknown> = { ...entry };
        copy[Symbol('smuggled')] = 'Synthetic Provider Symbol';
        Object.defineProperty(copy, 'hidden', {
          value: 'Synthetic Provider Hidden',
          enumerable: false,
        });
        return copy;
      });
      const result = await fetchParticipants({
        successData: (call) =>
          call === index ? envelopeFor(endpoint, rows) : undefined,
      });
      expect(result.outcome.outcome).toBe('candidate');
      expect(JSON.stringify(payloadOf(result.outcome))).not.toContain(
        'Synthetic Provider',
      );
    });
  });
}

describe('normalization exceptions are contained', () => {
  it('maps a throwing curated lookup to invalid-payload with the attempt kept', async () => {
    const participants = {
      driverById(): never {
        throw new Error('hostile');
      },
      constructorById(): never {
        throw new Error('hostile');
      },
    };
    const { outcome, calls, logger } = await fetchParticipants({
      participants,
    });

    expect(outcome.outcome).toBe('failed');
    expect(outcome.outcome === 'failed' && outcome.reason).toBe(
      'invalid-payload',
    );
    expect(attemptOutcomes(outcome)).toEqual(['successful']);
    expect(calls).toHaveLength(1);
    expect(
      logger.events.find(
        (event) => event.operation === 'provider.participants.invalid_payload',
      )?.failureCategory,
    ).toBe('drivers-normalization');
  });
});
