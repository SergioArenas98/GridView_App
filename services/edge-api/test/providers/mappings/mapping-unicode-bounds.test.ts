/**
 * The provider-value length bound is counted in Unicode code points.
 *
 * Every test here fails on commit 4fa738d, where `isProviderStringValue` used
 * `String#length` (UTF-16 code units) while JSON Schema `maxLength` counts
 * code points. A 64-code-point supplementary-plane value measures 128 there,
 * so the curated schema accepted it and the runtime rejected it — and because
 * the registry fails closed as a whole, content that passed
 * `validate:content` could invalidate the entire runtime registry.
 *
 * The canonical key's length prefix deliberately keeps using UTF-16 code-unit
 * counts: that is a serialization detail whose only requirement is
 * deterministic injectivity over an already-validated string, not a validation
 * bound that must mirror JSON Schema.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import {
  buildProviderMappingRegistry,
  canonicalKey,
  decodeProviderMappingKey,
  isProviderStringValue,
  providerMappingFailureEvent,
  type ProviderMappingKeyFor,
} from '../../../src/providers/mappings';

import { SEASON } from './support';

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');

/** U+1F3CE RACING CAR — one code point, two UTF-16 code units. */
const ASTRAL = String.fromCodePoint(0x1f3ce);

const atBound = ASTRAL.repeat(64);
const overBound = ASTRAL.repeat(65);
const mixedAtBound = 'a'.repeat(32) + ASTRAL.repeat(32);
const mixedOverBound = 'a'.repeat(33) + ASTRAL.repeat(32);

/** The curated schema compiled exactly as `validate:content` compiles it. */
function compileProviderStringValidator() {
  const schemasDir = join(repoRoot, 'content', 'schemas');
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const file of ['common', 'provider-mappings', 'provider-evidence']) {
    ajv.addSchema(
      JSON.parse(
        readFileSync(join(schemasDir, `${file}.schema.json`), 'utf8'),
      ) as object,
    );
  }
  return ajv.compile({
    $ref: 'https://gridview.local/schemas/provider-mappings.schema.json#/$defs/providerString',
  });
}

const schemaAccepts = compileProviderStringValidator();

function teamNameKey(
  providerValue: string,
): ProviderMappingKeyFor<'constructor'> {
  return {
    season: SEASON,
    source: 'openf1',
    entity: 'constructor',
    providerField: 'team_name',
    providerValue,
  };
}

describe('the astral fixtures really do diverge under the two measures', () => {
  it('measures 64 code points as 128 UTF-16 code units', () => {
    expect([...atBound].length).toBe(64);
    expect(atBound.length).toBe(128);
    expect([...overBound].length).toBe(65);
    expect([...mixedAtBound].length).toBe(64);
    expect(mixedAtBound.length).toBe(96);
    expect([...mixedOverBound].length).toBe(65);
  });
});

describe('every layer agrees at the 64/65 code-point boundary', () => {
  // Case 1
  it('JSON Schema accepts exactly 64 supplementary code points', () => {
    expect(schemaAccepts(atBound)).toBe(true);
  });

  /**
   * Case 2 — the build-time half.
   *
   * The `.mjs` validator cannot be imported from TypeScript without breaking
   * `tsc` (it has no declaration file, and adding one or enabling `allowJs`
   * would be a build change). Its verdicts on exactly these values are
   * asserted in `test/scripts/provider-mapping-parity.test.mjs`, driven by the
   * same shared corpus, so both halves are still pinned to the same numbers.
   */
  it('agrees with the curated schema, which the .mjs twin also checks', () => {
    expect(schemaAccepts(atBound)).toBe(true);
    expect(isProviderStringValue(atBound)).toBe(true);
  });

  // Case 3
  it('the TypeScript runtime decoder accepts it', () => {
    expect(isProviderStringValue(atBound)).toBe(true);
    expect(decodeProviderMappingKey(teamNameKey(atBound)).ok).toBe(true);
  });

  // Case 4 — direct resolve() key validation accepts it and reports a plain
  // curation gap rather than a malformed key.
  it('direct resolve() validation accepts it', () => {
    const registry = buildProviderMappingRegistry(
      [
        {
          kind: 'provider-mappings',
          schemaVersion: 2,
          season: SEASON,
          mappings: [],
        },
      ],
      { driver: new Set(), constructor: new Set(), circuit: new Set() },
    );
    const result = registry.resolve(teamNameKey(atBound));
    expect(result.outcome).toBe('unresolved');
    if (result.outcome !== 'unresolved') throw new Error('unreachable');
    expect(result.failure.reason).toBe('unmapped');
    expect(result.failure.reason).not.toBe('invalid-key');
  });

  // Case 5
  it('65 supplementary code points fail every layer', () => {
    expect(schemaAccepts(overBound)).toBe(false);
    expect(isProviderStringValue(overBound)).toBe(false);
    expect(decodeProviderMappingKey(teamNameKey(overBound)).ok).toBe(false);
  });

  // Cases 6 and 7
  it('agrees on a mixed BMP/non-BMP value at 64 and 65 code points', () => {
    expect(schemaAccepts(mixedAtBound)).toBe(true);
    expect(isProviderStringValue(mixedAtBound)).toBe(true);

    expect(schemaAccepts(mixedOverBound)).toBe(false);
    expect(isProviderStringValue(mixedOverBound)).toBe(false);
  });

  // Case 12
  it('leaves the existing ASCII maximum-length behaviour unchanged', () => {
    expect(isProviderStringValue('a'.repeat(64))).toBe(true);
    expect(isProviderStringValue('a'.repeat(65))).toBe(false);
    expect(schemaAccepts('a'.repeat(64))).toBe(true);
    expect(schemaAccepts('a'.repeat(65))).toBe(false);
  });
});

describe('exactness is preserved, not normalized', () => {
  // Case 8
  it('keeps composed and decomposed forms distinct', () => {
    const composed = 'Alpiné'; // é as one code point
    const decomposed = 'Alpiné'; // e + combining acute

    expect(composed).not.toBe(decomposed);
    expect(isProviderStringValue(composed)).toBe(true);
    expect(isProviderStringValue(decomposed)).toBe(true);

    // Distinct identities: nothing normalizes one into the other.
    expect(canonicalKey(teamNameKey(composed))).not.toBe(
      canonicalKey(teamNameKey(decomposed)),
    );
  });
});

describe('diagnostic truncation is code-point safe', () => {
  // Case 9
  it('never splits a surrogate pair', () => {
    const event = providerMappingFailureEvent({
      reason: 'unmapped',
      season: SEASON,
      source: 'openf1',
      entity: 'constructor',
      providerField: 'team_name',
      providerValue: ASTRAL.repeat(200),
    });

    const emitted = String(event.providerMappingValue);
    // No lone surrogate survived the cut.
    for (const unit of emitted) {
      const code = unit.codePointAt(0) ?? 0;
      expect(code >= 0xd800 && code <= 0xdfff).toBe(false);
    }
    expect(emitted.endsWith('...')).toBe(true);
    expect([...emitted.slice(0, -3)].length).toBe(64);
  });

  it('leaves a value inside the bound untouched', () => {
    const event = providerMappingFailureEvent({
      reason: 'unmapped',
      season: SEASON,
      source: 'openf1',
      entity: 'constructor',
      providerField: 'team_name',
      providerValue: atBound,
    });
    expect(event.providerMappingValue).toBe(atBound);
  });
});

describe('canonical-key serialization stays injective for Unicode', () => {
  // Case 10
  it('gives every accepted Unicode case a distinct key', () => {
    const values = [
      atBound,
      mixedAtBound,
      ASTRAL,
      ASTRAL + ASTRAL,
      'Alpiné',
      'Alpiné',
      'Alpine',
    ];
    const encoded = values.map((value) => canonicalKey(teamNameKey(value)));
    expect(new Set(encoded).size).toBe(values.length);
  });

  it('keeps the UTF-16 code-unit prefix, which is a serialization choice', () => {
    // Documented deliberately: the prefix counts code units, the validation
    // bound counts code points. Both are correct for their own purpose.
    expect(canonicalKey(teamNameKey(ASTRAL))).toContain(`2:${ASTRAL};`);
  });
});
