import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import { buildProviderMappingRegistry } from '../../../src/providers/mappings/mapping-registry';
import { normalizeSeasonDrivers } from '../../../src/providers/jolpica/participants-normalizer';
import { curatedParticipants } from '../../../src/providers/jolpica/curated-participants';
import {
  context,
  driverInput,
  driversEnvelope,
  fixtures,
  forbidNetwork,
} from './support';

const registry = providerMappingRegistry();
const canonical = {
  driver: new Set<string>(),
  constructor: new Set<string>(),
  circuit: new Set<string>(),
  event: new Set<string>(),
};
const empty = buildProviderMappingRegistry([], canonical);
async function extract(rows: unknown[], options = {}) {
  const body = driversEnvelope(rows, options);
  return extractJolpicaObservations(driverInput(body), body, context, registry);
}
beforeEach(forbidNetwork);
afterEach(() => vi.unstubAllGlobals());

describe('decoder-gated discovery', () => {
  it('does not discover a known driver', async () => {
    expect((await extract([{ driverId: 'norris' }])).observations).toEqual([]);
  });
  it('records an exact unknown with deterministic identifiers and no canonical target', async () => {
    const row = {
      driverId: 'synthetic_driver',
      givenName: 'Álvaro',
      familyName: ' Muñoz ',
      permanentNumber: '07',
    };
    const first = await extract([row]);
    expect(first).toEqual(await extract([row]));
    expect(first.status).toBe('collected');
    expect(first.observations).toHaveLength(1);
    const o = first.observations[0]!;
    expect(o.key).toEqual({
      season: 2026,
      source: 'jolpica',
      entity: 'driver',
      providerField: 'driverId',
      providerValue: 'synthetic_driver',
    });
    expect(o.evidence).toEqual({
      givenName: { value: 'Álvaro', sourceField: 'givenName' },
      familyName: { value: ' Muñoz ', sourceField: 'familyName' },
      permanentNumber: { value: '07', sourceField: 'permanentNumber' },
    });
    expect(o.candidateId).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(o.evidenceDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(o.observationId).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(o.recordedAt).toBeNull();
    expect(o.provenance.synthetic).toBe(true);
    expect(o).not.toHaveProperty('gridviewId');
  });
  it.each(fixtures().map((f) => [f.input.endpointKind, f] as const))(
    'enumerates %s with exact validated context',
    async (_, f) => {
      expect(f.input.decoded.ok).toBe(true);
      const result = await extractJolpicaObservations(
        f.input,
        f.body,
        context,
        empty,
      );
      expect(result.status).toBe('collected');
      expect(new Set(result.observations.map((o) => o.key.entity))).toEqual(
        new Set(f.entities),
      );
      for (const o of result.observations) {
        expect(o.endpointKind).toBe(f.input.endpointKind);
        expect(o.resource.season).toBe(2026);
        expect(o.sessionType).toBe(
          f.input.endpointKind === 'race-results' ? 'race' : null,
        );
        if (o.key.entity !== 'driver') expect(o.evidence).toEqual({});
      }
    },
  );
  it('discovers all unknown drivers beyond the log cap', async () => {
    const result = await extract(
      Array.from({ length: 20 }, (_, i) => ({ driverId: `synthetic_${i}` })),
    );
    expect(result.observations).toHaveLength(20);
  });
  it.each([
    [{ total: '2' }, [{ driverId: 'synthetic_driver' }]],
    [{ season: '2025' }, [{ driverId: 'synthetic_driver' }]],
    [{}, [{ driverId: 'synthetic_driver' }, { driverId: 'synthetic_driver' }]],
    [{}, [{ driverId: 12 }]],
  ])('refuses failed decoding %#', async (options, rows) => {
    expect(await extract(rows, options)).toMatchObject({
      status: 'skipped',
      reason: 'decode-failed',
      observations: [],
    });
  });
  it('refuses a response mismatched to the supplied successful decode', async () => {
    const body = driversEnvelope([{ driverId: 'synthetic_driver' }]);
    const input = driverInput(body);
    const other = driversEnvelope([{ driverId: 'another_driver' }]);
    expect(
      await extractJolpicaObservations(input, other, context, registry),
    ).toMatchObject({
      status: 'skipped',
      reason: 'decode-mismatch',
      observations: [],
    });
  });
  it('refuses a truncated response paired with an earlier successful decode', async () => {
    const good = driversEnvelope([{ driverId: 'synthetic_driver' }]);
    const bad = driversEnvelope([{ driverId: 'synthetic_driver' }], {
      total: '2',
    });
    expect(
      (
        await extractJolpicaObservations(
          driverInput(good),
          bad,
          context,
          registry,
        )
      ).observations,
    ).toEqual([]);
  });
  it('does not mistake catalog or key faults for candidates', async () => {
    const badRegistry = buildProviderMappingRegistry([{}], canonical);
    const body = driversEnvelope([{ driverId: 'synthetic_driver' }]);
    expect(
      await extractJolpicaObservations(
        driverInput(body),
        body,
        context,
        badRegistry,
      ),
    ).toMatchObject({
      status: 'skipped',
      reason: 'resolution-fault',
      observations: [],
    });
    expect((await extract([{ driverId: ' padded ' }])).observations).toEqual(
      [],
    );
  });
  it('does not change decoding, normalization or provider bodies', async () => {
    const body = driversEnvelope([
      { driverId: 'norris', givenName: 'Not canonical' },
      { driverId: 'synthetic_driver' },
    ]);
    const before = structuredClone(body);
    const input = driverInput(body);
    if (input.endpointKind !== 'season-drivers' || !input.decoded.ok)
      throw Error('fixture');
    const normalized = normalizeSeasonDrivers(
      input.decoded.drivers,
      2026,
      registry,
      curatedParticipants(),
    );
    await extractJolpicaObservations(input, body, context, registry);
    expect(body).toEqual(before);
    expect(driverInput(body)).toEqual(input);
    expect(
      normalizeSeasonDrivers(
        input.decoded.drivers,
        2026,
        registry,
        curatedParticipants(),
      ),
    ).toEqual(normalized);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('allowlisted evidence', () => {
  it('keeps supported claims as evidence and never fabricates a full name', async () => {
    const o = (
      await extract([
        {
          driverId: 'synthetic_driver',
          givenName: 'Ada',
          familyName: 'Synthetic',
          fullName: 'Unapproved Alias',
          code: 'SYN',
          dateOfBirth: '2000-02-29',
          nationality: 'Synthetic',
          permanentNumber: '7',
        },
      ])
    ).observations[0]!;
    expect(o.evidence.shortCode).toEqual({ value: 'SYN', sourceField: 'code' });
    expect(o.evidence.dateOfBirth?.value).toBe('2000-02-29');
    expect(o.evidence.nationality?.value).toBe('Synthetic');
    expect(o.evidence.fullName).toBeUndefined();
    expect(o.omittedFields).toContainEqual({
      field: 'fullName',
      reason: 'unsupported-field',
    });
  });
  it.each(['1e2', '+7', '7.0', '9007199254740992'])(
    'does not coerce an invalid number claim %s',
    async (value) => {
      const o = (
        await extract([
          { driverId: 'synthetic_driver', permanentNumber: value },
        ])
      ).observations[0]!;
      expect(o.evidence.permanentNumber).toBeUndefined();
      expect(o.omittedFields).toContainEqual({
        field: 'permanentNumber',
        reason: 'invalid-value',
      });
    },
  );
  it('treats non-enumerable optional properties as unsafe', async () => {
    const row = { driverId: 'synthetic_driver' };
    Object.defineProperty(row, 'givenName', {
      value: 'Hidden',
      enumerable: false,
    });
    expect(
      (await extract([row])).observations[0]!.omittedFields,
    ).toContainEqual({ field: 'givenName', reason: 'unsafe-property' });
  });
  it('distinguishes absent optional fields from invalid fields', async () => {
    const result = await extract([
      {
        driverId: 'synthetic_driver',
        givenName: null,
        dateOfBirth: '2026-02-30',
        permanentNumber: 7,
      },
    ]);
    expect(result.observations[0]!.evidence).toEqual({});
    expect(result.observations[0]!.omittedFields).toEqual([
      { field: 'givenName', reason: 'invalid-type' },
      { field: 'dateOfBirth', reason: 'invalid-value' },
      { field: 'permanentNumber', reason: 'invalid-type' },
    ]);
  });
  it('ignores missing fields without inventing claims', async () => {
    const o = (await extract([{ driverId: 'synthetic_driver' }]))
      .observations[0]!;
    expect(o.evidence).toEqual({});
    expect(o.omittedFields).toEqual([]);
  });
  it('does not invoke optional getters, toJSON or inherited evidence', async () => {
    const getter = vi.fn(() => {
      throw Error('getter');
    });
    const row = Object.assign(
      Object.create({ familyName: 'Inherited' }) as Record<string, unknown>,
      { driverId: 'synthetic_driver', toJSON: getter },
    );
    Object.defineProperty(row, 'givenName', { get: getter });
    const o = (await extract([row])).observations[0]!;
    expect(getter).not.toHaveBeenCalled();
    expect(o.evidence).toEqual({});
    expect(o.omittedFields).toContainEqual({
      field: 'givenName',
      reason: 'unsafe-property',
    });
  });
  it.each(['x'.repeat(201), 'bad\u0000name', ''])(
    'bounds invalid text %#',
    async (value) => {
      const o = (
        await extract([{ driverId: 'synthetic_driver', givenName: value }])
      ).observations[0]!;
      expect(o.evidence).toEqual({});
      expect(o.omittedFields).toHaveLength(1);
    },
  );
  it('counts Unicode code points and preserves decomposed accents', async () => {
    const value = '𐐀'.repeat(200);
    const o = (
      await extract([
        {
          driverId: 'synthetic_driver',
          givenName: value,
          familyName: 'Jose\u0301',
        },
      ])
    ).observations[0]!;
    expect(o.evidence.givenName?.value).toBe(value);
    expect(o.evidence.familyName?.value).toBe('Jose\u0301');
  });
  it('contains hostile optional descriptor traps', async () => {
    const row = new Proxy(
      { driverId: 'synthetic_driver' },
      {
        getOwnPropertyDescriptor(target, field) {
          if (field === 'givenName') throw Error('private raw error');
          return Reflect.getOwnPropertyDescriptor(target, field);
        },
      },
    );
    const o = (await extract([row])).observations[0]!;
    expect(o.omittedFields).toContainEqual({
      field: 'givenName',
      reason: 'unsafe-property',
    });
    expect(JSON.stringify(o)).not.toContain('private raw error');
  });
  it('never accesses unrelated sensitive fields', async () => {
    const getter = vi.fn(() => {
      throw Error('sensitive');
    });
    const row = { driverId: 'synthetic_driver', givenName: 'Synthetic' };
    for (const key of [
      'authorization',
      'headers',
      'cookie',
      'biography',
      'url',
      'image',
    ])
      Object.defineProperty(row, key, { get: getter });
    const o = (await extract([row])).observations[0]!;
    expect(getter).not.toHaveBeenCalled();
    expect(JSON.stringify(o)).not.toMatch(
      /authorization|cookie|biography|image|headers/,
    );
  });
  it('snapshots evidence before asynchronous hashing', async () => {
    const row = { driverId: 'synthetic_driver', givenName: 'Before' };
    const body = driversEnvelope([row]);
    const promise = extractJolpicaObservations(
      driverInput(body),
      body,
      context,
      registry,
    );
    row.givenName = 'After';
    expect((await promise).observations[0]!.evidence.givenName?.value).toBe(
      'Before',
    );
  });
});
