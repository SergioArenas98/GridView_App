import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canonicalJson,
  sha256Hex,
  utf8,
} from '../../../src/ingest/canonical-json';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import {
  candidateIdFor,
  enumerateJolpicaKeys,
} from '../../../src/identity/discovery/keys';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import type { ProviderMappingKey } from '../../../src/providers/mappings/mapping-key';
import type { DecodedJolpicaResource } from '../../../src/identity/discovery/model';
import {
  normalizeSeasonDrivers,
  normalizeSeasonConstructors,
} from '../../../src/providers/jolpica/participants-normalizer';
import { normalizeRaceResults } from '../../../src/providers/jolpica/results-normalizer';
import {
  normalizeDriverStandings,
  normalizeConstructorStandings,
} from '../../../src/providers/jolpica/standings-normalizer';
import { normalizeSeasonCalendar } from '../../../src/providers/jolpica/calendar-normalizer';
import { normalizeSeasonCircuits } from '../../../src/providers/jolpica/circuits-normalizer';
import { curatedParticipants } from '../../../src/providers/jolpica/curated-participants';
import { curatedCircuits } from '../../../src/providers/jolpica/curated-circuits';
import { curatedEventNames } from '../../../src/providers/jolpica/curated-events';

import { emptyResultsEnvelope } from '../../providers/jolpica/results-support';
import { emptyStandingsEnvelope } from '../../providers/jolpica/standings-support';
import { decodeRaceResults } from '../../../src/providers/jolpica/results-payload';
import { decodeDriverStandings } from '../../../src/providers/jolpica/standings-payload';
import {
  context,
  driverInput,
  driversEnvelope,
  fixtures,
  forbidNetwork,
} from './support';

const registry = providerMappingRegistry();
beforeEach(forbidNetwork);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function normalize(input: DecodedJolpicaResource): unknown {
  switch (input.endpointKind) {
    case 'season-drivers':
      return input.decoded.ok
        ? normalizeSeasonDrivers(
            input.decoded.drivers,
            input.season,
            registry,
            curatedParticipants(),
          )
        : input.decoded;
    case 'season-constructors':
      return input.decoded.ok
        ? normalizeSeasonConstructors(
            input.decoded.constructors,
            input.season,
            registry,
            curatedParticipants(),
          )
        : input.decoded;
    case 'race-results':
      return input.decoded.ok && input.decoded.race
        ? normalizeRaceResults(input.decoded.race, input.season, registry)
        : input.decoded;
    case 'driver-standings':
      return input.decoded.ok
        ? normalizeDriverStandings(input.decoded.rows, input.season, registry)
        : input.decoded;
    case 'constructor-standings':
      return input.decoded.ok
        ? normalizeConstructorStandings(
            input.decoded.rows,
            input.season,
            registry,
          )
        : input.decoded;
    case 'season-calendar':
      return input.decoded.ok
        ? normalizeSeasonCalendar(
            input.decoded.races,
            input.season,
            registry,
            curatedEventNames(),
          )
        : input.decoded;
    case 'season-circuits':
      return input.decoded.ok
        ? normalizeSeasonCircuits(
            input.decoded.circuits,
            input.season,
            registry,
            curatedCircuits(),
          )
        : input.decoded;
  }
}
describe('normalizer parity and evidence provenance', () => {
  it.each(fixtures().map((f) => [f.input.endpointKind, f] as const))(
    'matches the exact lookup sequence of %s',
    async (_, f) => {
      const resolve = vi.spyOn(registry, 'resolve');
      const before = normalize(f.input);
      const calls = resolve.mock.calls.map(([key]) => key);
      expect(enumerateJolpicaKeys(f.input).map((r) => r.key)).toEqual(calls);
      const source = structuredClone(f);
      await extractJolpicaObservations(f.input, f.body, context, registry);
      expect(normalize(f.input)).toEqual(before);
      expect(f).toEqual(source);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it('hashes only the specified material projection and occurrence context', async () => {
    const body = driversEnvelope([
      { driverId: 'synthetic_driver', givenName: 'Synthetic' },
    ]);
    const input = driverInput(body);
    const o = (await extractJolpicaObservations(input, body, context, registry))
      .observations[0]!;
    const digest = async (value: unknown) =>
      `sha256:${await sha256Hex(utf8(canonicalJson(value)))}`;
    expect(o.evidenceDigest).toBe(
      await digest({
        extractorVersion: 'jolpica-identity/1',
        key: o.key,
        resource: o.resource,
        round: null,
        sessionType: null,
        evidence: o.evidence,
        provenanceKind: 'provider-observation',
      }),
    );
    expect(o.observationId).toBe(
      await digest({
        format: 'gv-identity-observation/1',
        candidateId: o.candidateId,
        runId: context.runId,
        requestOrdinal: 1,
        evidenceDigest: o.evidenceDigest,
      }),
    );
    const later = (
      await extractJolpicaObservations(
        input,
        body,
        {
          ...context,
          runId: '22222222-2222-4222-8222-222222222222',
          observedAt: '2026-11-14T12:00:00Z',
        },
        registry,
      )
    ).observations[0]!;
    expect(later.candidateId).toBe(o.candidateId);
    expect(later.evidenceDigest).toBe(o.evidenceDigest);
    expect(later.observationId).not.toBe(o.observationId);
  });
  it('validates context without coercion or hostile property execution', async () => {
    const body = driversEnvelope([{ driverId: 'synthetic_driver' }]);
    const toString = vi.fn(() => 'direct');
    const malformed = { ...context, transportKind: { toString } } as never;
    expect(
      await extractJolpicaObservations(
        driverInput(body),
        body,
        malformed,
        registry,
      ),
    ).toMatchObject({ status: 'skipped', reason: 'invalid-context' });
    expect(toString).not.toHaveBeenCalled();
  });
  it.each([
    { runId: 'not-a-uuid' },
    { requestOrdinal: 0 },
    { requestOrdinal: 1.5 },
    { observedAt: '2026-02-30T00:00:00Z' },
    { observedAt: '2026-11-13T12:00:00+01:00' },
    { catalogRef: { mode: 'bundled', catalogHash: 'bad' } },
    { synthetic: false },
    { transportKind: 'something-else' },
  ])('rejects invalid provenance %#', async (delta) => {
    const body = driversEnvelope([{ driverId: 'synthetic_driver' }]);
    expect(
      (
        await extractJolpicaObservations(
          driverInput(body),
          body,
          { ...context, ...delta } as never,
          registry,
        )
      ).observations,
    ).toEqual([]);
  });
  it('supports explicit runtime catalog references without storage', async () => {
    const body = driversEnvelope([{ driverId: 'synthetic_driver' }]);
    const runtime = {
      ...context,
      catalogRef: {
        mode: 'runtime',
        catalogHash: context.catalogRef.catalogHash,
        revisionId: context.runId,
      },
    } as const;
    expect(
      (
        await extractJolpicaObservations(
          driverInput(body),
          body,
          runtime,
          registry,
        )
      ).observations[0]!.catalogRef,
    ).toEqual(runtime.catalogRef);
  });
  it('uses the validated table round for standings', async () => {
    const f = fixtures().find(
      (f) => f.input.endpointKind === 'driver-standings',
    )!;
    const refs = enumerateJolpicaKeys(f.input);
    expect(refs.every((r) => r.round === 9 && r.sessionType === null)).toBe(
      true,
    );
  });
  it('accepts structurally valid no-results and empty-standings answers without observations', async () => {
    const body = emptyResultsEnvelope();
    const input: DecodedJolpicaResource = {
      endpointKind: 'race-results',
      season: 2026,
      round: 1,
      requestedLimit: 100,
      decoded: decodeRaceResults(body, 2026, 1, 100),
    };
    expect(
      await extractJolpicaObservations(input, body, context, registry),
    ).toEqual({ status: 'collected', observations: [] });
    const standings = emptyStandingsEnvelope('DriverStandings');
    const s: DecodedJolpicaResource = {
      endpointKind: 'driver-standings',
      season: 2026,
      requestedLimit: 100,
      decoded: decodeDriverStandings(standings, 2026, 100),
    };
    expect(
      await extractJolpicaObservations(s, standings, context, registry),
    ).toEqual({ status: 'collected', observations: [] });
  });
  it('never invokes structural accessors even for legacy calendar decoding', async () => {
    const f = fixtures().find(
      (f) => f.input.endpointKind === 'season-calendar',
    )!;
    const getter = vi.fn(() => {
      throw Error('raw accessor');
    });
    const hostile = Object.defineProperty({}, 'MRData', { get: getter });
    expect(
      await extractJolpicaObservations(f.input, hostile, context, registry),
    ).toMatchObject({
      status: 'skipped',
      reason: 'unsafe-input',
      observations: [],
    });
    expect(getter).not.toHaveBeenCalled();
  });
  it('does not iterate hostile arrays or execute getters at row locations', async () => {
    const good = driversEnvelope([{ driverId: 'synthetic_driver' }]);
    const getter = vi.fn(() => {
      throw Error('array getter');
    });
    const rows = new Array(1);
    Object.defineProperty(rows, '0', { get: getter });
    Object.defineProperty(rows, Symbol.iterator, { get: getter });
    const hostile = driversEnvelope(rows);
    expect(
      (
        await extractJolpicaObservations(
          driverInput(good),
          hostile,
          context,
          registry,
        )
      ).observations,
    ).toEqual([]);
    expect(getter).not.toHaveBeenCalled();
  });
  it('contains revoked proxy and structural failures', async () => {
    const good = driversEnvelope([{ driverId: 'synthetic_driver' }]);
    const proxy = Proxy.revocable({}, {});
    proxy.revoke();
    expect(
      await extractJolpicaObservations(
        driverInput(good),
        proxy.proxy,
        context,
        registry,
      ),
    ).toMatchObject({ status: 'skipped', reason: 'unsafe-input' });
  });
  it('does not invoke accessors while validating candidate keys', async () => {
    const getter = vi.fn(() => 'synthetic_driver');
    const key = {
      season: 2026,
      source: 'jolpica',
      entity: 'driver',
      providerField: 'driverId',
    };
    Object.defineProperty(key, 'providerValue', {
      get: getter,
      enumerable: true,
    });
    await expect(candidateIdFor(key as ProviderMappingKey)).rejects.toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
  it('preserves all four November keys as unresolved without changing their content', async () => {
    const keys = [
      'rafael_camara',
      'gabriele_mini',
      'freddie_slater',
      'nikola_tsolov',
    ];
    const body = driversEnvelope(keys.map((driverId) => ({ driverId })));
    const result = await extractJolpicaObservations(
      driverInput(body),
      body,
      context,
      registry,
    );
    expect(result.observations.map((o) => o.key.providerValue)).toEqual(keys);
    for (const o of result.observations)
      expect(registry.resolve(o.key)).toMatchObject({
        outcome: 'unresolved',
        failure: { reason: 'unmapped' },
      });
  });
});
