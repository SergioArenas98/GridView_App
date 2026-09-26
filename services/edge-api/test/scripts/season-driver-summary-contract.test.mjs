/**
 * The additive `SeasonDriverSummary` contract, validated against the OpenAPI
 * document itself: `entryId`, `startRound` and `endRound` are required keys,
 * the bounds are nullable integers of at least 1, and the schema example
 * conforms.
 */

import { describe, expect, it } from 'vitest';

import {
  buildOpenApiAjv,
  compileSchema,
  loadOpenApi,
} from '../../scripts/lib/openapi-ajv.mjs';

const openapi = loadOpenApi();
const { ajv, ref } = buildOpenApiAjv(openapi);
const validate = compileSchema(ajv, ref, 'SeasonDriverSummary');
const schema = openapi.components.schemas.SeasonDriverSummary;

const row = {
  entryId: '2026-liam-lawson',
  driverId: 'liam-lawson',
  fullName: 'Liam Lawson',
  shortCode: null,
  permanentNumber: null,
  raceNumber: null,
  countryCode: null,
  constructorId: 'racing-bulls',
  role: 'race',
  startRound: null,
  endRound: 11,
};

describe('SeasonDriverSummary in the OpenAPI contract', () => {
  it('declares exactly the eleven properties', () => {
    expect(Object.keys(schema.properties)).toEqual([
      'entryId',
      'driverId',
      'fullName',
      'shortCode',
      'permanentNumber',
      'raceNumber',
      'countryCode',
      'constructorId',
      'role',
      'startRound',
      'endRound',
    ]);
  });

  it('requires the entry id and both bounds', () => {
    expect(schema.required).toEqual(
      expect.arrayContaining(['entryId', 'startRound', 'endRound']),
    );
    for (const key of ['entryId', 'startRound', 'endRound']) {
      const missing = { ...row };
      delete missing[key];
      expect(validate(missing), key).toBe(false);
    }
  });

  it('accepts explicit null bounds and bounds of at least 1', () => {
    expect(validate(row)).toBe(true);
    expect(validate({ ...row, startRound: 12, endRound: null })).toBe(true);
    expect(validate({ ...row, startRound: 1, endRound: 1 })).toBe(true);
  });

  it('refuses a zero or fractional bound and a malformed entry id', () => {
    expect(validate({ ...row, startRound: 0 })).toBe(false);
    expect(validate({ ...row, endRound: 0 })).toBe(false);
    expect(validate({ ...row, endRound: 1.5 })).toBe(false);
    expect(validate({ ...row, entryId: '2026_liam_lawson' })).toBe(false);
  });

  it('has a schema example that conforms', () => {
    expect(schema.example).toBeDefined();
    expect(validate(schema.example)).toBe(true);
  });
});
