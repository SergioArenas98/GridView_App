import { describe, expect, it } from 'vitest';
import {
  candidateIdFor,
  enumerateJolpicaKeys,
} from '../../../src/identity/discovery/keys';
import { canonicalKey } from '../../../src/providers/mappings/mapping-key';
import { sha256Hex, utf8 } from '../../../src/ingest/canonical-json';
import { driverInput, driversEnvelope, fixtures } from './support';

describe('exact discovery keys', () => {
  const key = {
    season: 2026,
    source: 'jolpica',
    entity: 'driver',
    providerField: 'driverId',
    providerValue: 'synthetic_driver',
  } as const;
  it('uses the established canonical key and prescribed candidate hash', async () => {
    expect(await candidateIdFor(key)).toBe(
      `sha256:${await sha256Hex(utf8('gv-identity-candidate/1' + canonicalKey(key)))}`,
    );
  });
  it('keeps provider, season and typed values distinct', async () => {
    const ids = await Promise.all([
      candidateIdFor(key),
      candidateIdFor({ ...key, season: 2025 }),
      candidateIdFor({
        season: 2026,
        source: 'openf1',
        entity: 'driver',
        providerField: 'driver_number',
        providerValue: 12,
      }),
      candidateIdFor({ ...key, providerValue: '12' }),
    ]);
    expect(new Set(ids).size).toBe(4);
  });
  it('rejects coerced or malformed typed values', async () => {
    await expect(
      candidateIdFor({ ...key, providerValue: 12 } as never),
    ).rejects.toThrow();
    await expect(
      candidateIdFor({
        season: 2026,
        source: 'openf1',
        entity: 'driver',
        providerField: 'driver_number',
        providerValue: '12',
      } as never),
    ).rejects.toThrow();
  });
  it('does not enumerate rejected decoder results', () => {
    expect(
      enumerateJolpicaKeys(driverInput(driversEnvelope([{ driverId: 1 }]))),
    ).toEqual([]);
  });
  it.each(fixtures().map((f) => [f.input.endpointKind, f] as const))(
    'enumerates %s without a log cap',
    (_, f) => {
      expect(
        new Set(enumerateJolpicaKeys(f.input).map((r) => r.key.entity)),
      ).toEqual(new Set(f.entities));
    },
  );
});
