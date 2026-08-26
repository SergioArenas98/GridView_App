// Semantic rules for the curated provider-identifier mapping registry.
//
// JSON Schema settles the shape of one record. It cannot settle the three
// things that actually make the registry safe, because each one is a statement
// about the whole file or about another file:
//
//   1. composite-key uniqueness  - no complete key may appear twice, even when
//      both records point at the same target;
//   2. target existence and kind - every target must already exist in the
//      curated registry for that entity kind;
//   3. evidence coverage         - every approved provider identity must be
//      mapped or explicitly acknowledged as unmapped.
//
// These are pure functions over already-parsed data so they can be unit
// tested directly. They never read the network and never mutate their input.

/** Entity kind -> the curated registry file that owns its canonical IDs. */
export const registryFileForEntity = Object.freeze({
  driver: 'registries/drivers.mock.json',
  constructor: 'registries/constructors.mock.json',
  circuit: 'registries/circuits.mock.json',
});

/**
 * The only valid (source, entity, provider field, value type) combinations.
 * Anything else is not a mapping with a bad field - it is not a mapping.
 */
export const providerKeyShapes = Object.freeze([
  {
    source: 'jolpica',
    entity: 'driver',
    providerField: 'driverId',
    valueType: 'string',
  },
  {
    source: 'jolpica',
    entity: 'constructor',
    providerField: 'constructorId',
    valueType: 'string',
  },
  {
    source: 'jolpica',
    entity: 'circuit',
    providerField: 'circuitId',
    valueType: 'string',
  },
  {
    source: 'openf1',
    entity: 'driver',
    providerField: 'driver_number',
    valueType: 'integer',
  },
  {
    source: 'openf1',
    entity: 'constructor',
    providerField: 'team_name',
    valueType: 'string',
  },
  {
    source: 'openf1',
    entity: 'circuit',
    providerField: 'circuit_key',
    valueType: 'integer',
  },
]);

/**
 * Value bounds.
 *
 * These must stay identical to `src/providers/mappings/mapping-key.ts`. The
 * two implementations exist because `validate:content` runs on plain Node
 * while the resolver ships to the Worker, and neither may import the other
 * without a dependency or a package-script change. The parity tests feed the
 * same checked-in case corpus to both and compare verdicts, so a divergence
 * fails CI rather than sitting undetected.
 */
const PROVIDER_STRING_MAX_LENGTH = 64;
const SEASON_MIN = 1950;
const SEASON_MAX = 2100;

/** Exact upstream string: bounded, no control character, no edge whitespace. */
export function isProviderStringValue(value) {
  if (typeof value !== 'string') return false;
  // Unicode code points, matching JSON Schema `maxLength` and the TypeScript
  // runtime. `String#length` would count UTF-16 code units and reject a
  // supplementary-plane value the curated schema accepts.
  const codePoints = [...value];
  if (
    codePoints.length === 0 ||
    codePoints.length > PROVIDER_STRING_MAX_LENGTH
  ) {
    return false;
  }
  for (const character of codePoints) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return false;
  }
  return value.trim() === value;
}

/** Exact upstream integer: positive and inside the safe-integer range. */
export function isProviderIntegerValue(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function isSeason(value) {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= SEASON_MIN &&
    value <= SEASON_MAX
  );
}

function valueTypeOf(value) {
  if (isProviderStringValue(value)) return 'string';
  if (isProviderIntegerValue(value)) return 'integer';
  return null;
}

/**
 * The complete, closed set of properties a provider mapping *key* may carry.
 * Mirrors `PROVIDER_KEY_PROPERTIES` in
 * `src/providers/mappings/mapping-key.ts`.
 */
export const PROVIDER_KEY_PROPERTIES = new Set([
  'season',
  'source',
  'entity',
  'providerField',
  'providerValue',
]);

/**
 * The closed set of properties a curated *mapping record* may carry: the key
 * fields minus the document-level season, plus the target and its provenance.
 * Mirrors `additionalProperties: false` in the curated JSON Schema.
 */
export const MAPPING_RECORD_PROPERTIES = new Set([
  'source',
  'entity',
  'providerField',
  'providerValue',
  'gridviewId',
  'evidence',
  'note',
]);

/** True when `value` carries no own enumerable property outside `allowed`. */
export function hasNoUnexpectedProperty(value, allowed) {
  for (const property of Object.keys(value)) {
    if (!allowed.has(property)) return false;
  }
  return true;
}

/**
 * Decodes a whole provider key, exactly as the TypeScript runtime does.
 *
 * Used by the shared parity corpus so both sides answer the same yes/no
 * question about the same object. A key is a closed shape: an extra property
 * such as `gridviewId` or `target` alongside a valid key is rejected rather
 * than ignored, and own enumerable properties only, so nothing can supply a
 * key field by inheriting it from a prototype.
 */
export function decodeProviderKey(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  if (!hasNoUnexpectedProperty(value, PROVIDER_KEY_PROPERTIES)) return false;
  if (Object.keys(value).length !== PROVIDER_KEY_PROPERTIES.size) {
    return false;
  }
  if (!isSeason(value.season)) return false;
  return isValidKeyShape(value);
}

/** True when the four discriminators form one declared combination. */
export function isValidKeyShape(record) {
  const valueType = valueTypeOf(record.providerValue);
  if (valueType === null) return false;
  if (record.season !== undefined && !isSeason(record.season)) return false;
  return providerKeyShapes.some(
    (shape) =>
      shape.source === record.source &&
      shape.entity === record.entity &&
      shape.providerField === record.providerField &&
      shape.valueType === valueType,
  );
}

/**
 * The canonical lookup key.
 *
 * The value type is part of the key, so integer 1 and string "1" are different
 * keys and can never collide. Components are **length-prefixed** rather than
 * separator-joined, which makes the encoding injective over all inputs instead
 * of only over inputs that were validated first. Nothing is lower-cased,
 * trimmed or normalized here: the key is the exact value.
 *
 * Must stay byte-identical to `canonicalKey` in
 * `src/providers/mappings/mapping-key.ts`.
 */
export function canonicalKey({
  season,
  source,
  entity,
  providerField,
  providerValue,
}) {
  const valueType = valueTypeOf(providerValue);
  if (valueType === null) {
    throw new TypeError('provider value must be a string or a safe integer');
  }
  if (!isSeason(season)) {
    throw new TypeError('season must be an integer between 1950 and 2100');
  }
  const components = [
    String(season),
    source,
    entity,
    providerField,
    valueType,
    String(providerValue),
  ];
  let encoded = '';
  for (const component of components) {
    encoded += component.length + ':' + component + ';';
  }
  return encoded;
}

/** Human-readable form of a key, for validator output only. */
export function describeKey({
  season,
  source,
  entity,
  providerField,
  providerValue,
}) {
  return (
    season +
    ' ' +
    source +
    '.' +
    entity +
    '.' +
    providerField +
    ' = ' +
    JSON.stringify(providerValue)
  );
}

/**
 * Enforces one canonical seasonal document of each kind, paired one-to-one.
 *
 * The runtime imports exactly one mapping document per season, so accepting
 * several at build time would let a second file diverge from what actually
 * ships. Merging them would preserve that divergence rather than remove it, so
 * duplicates are rejected outright.
 *
 * This must run **before** coverage: a `.find()` over duplicates silently
 * checks the first document and lets every other one bypass the evidence
 * corpus entirely, which is exactly the gap this rule closes.
 *
 * `mappingDocuments` and `evidenceDocuments` are `{ label, data }` entries.
 * Returns `{ problems, mappingsBySeason }`; `problems` is empty when the set is
 * well-formed. Output order depends only on the season, never on file
 * discovery order, and no document content is echoed.
 */
export function validateSeasonalDocumentSet(
  mappingDocuments,
  evidenceDocuments,
) {
  const problems = [];

  const group = (documents) => {
    const bySeason = new Map();
    for (const entry of documents) {
      const season = entry.data.season;
      if (!bySeason.has(season)) bySeason.set(season, []);
      bySeason.get(season).push(entry);
    }
    return bySeason;
  };

  const mappingsBySeason = group(mappingDocuments);
  const evidenceBySeason = group(evidenceDocuments);

  const bySeasonOrder = (a, b) => Number(a) - Number(b);

  const reportDuplicates = (bySeason, kind) => {
    for (const season of [...bySeason.keys()].sort(bySeasonOrder)) {
      const entries = bySeason.get(season);
      if (entries.length <= 1) continue;
      const paths = entries.map((entry) => entry.label).sort();
      problems.push({
        label: paths[0],
        message:
          'season ' +
          season +
          ' has ' +
          entries.length +
          ' ' +
          kind +
          ' documents; exactly one is allowed: ' +
          paths.join(', '),
      });
    }
  };

  reportDuplicates(mappingsBySeason, 'provider-mappings');
  reportDuplicates(evidenceBySeason, 'provider-evidence');

  const seasons = new Set([
    ...mappingsBySeason.keys(),
    ...evidenceBySeason.keys(),
  ]);
  for (const season of [...seasons].sort(bySeasonOrder)) {
    const mappings = mappingsBySeason.get(season) ?? [];
    const evidence = evidenceBySeason.get(season) ?? [];
    if (mappings.length > 0 && evidence.length === 0) {
      problems.push({
        label: mappings[0].label,
        message: 'no provider-evidence corpus exists for season ' + season,
      });
    }
    if (evidence.length > 0 && mappings.length === 0) {
      problems.push({
        label: evidence[0].label,
        message: 'no provider-mappings document exists for season ' + season,
      });
    }
  }

  return { problems, mappingsBySeason };
}

/**
 * Validates one parsed mapping document against the curated registries.
 *
 * canonicalIds is { driver: Set, constructor: Set, circuit: Set }.
 * Returns an array of problem strings; empty means valid. Record order in the
 * file never affects the result, and a duplicate is always an error rather
 * than an overwrite, so there is no last-entry-wins behaviour anywhere.
 */
export function validateMappingDocument(document, canonicalIds) {
  const problems = [];
  const seen = new Map();

  document.mappings.forEach((record, index) => {
    const at = 'mappings[' + index + ']';
    const described = describeKey({ season: document.season, ...record });

    if (!hasNoUnexpectedProperty(record, MAPPING_RECORD_PROPERTIES)) {
      problems.push(
        at +
          ': unexpected property on a curated mapping record (' +
          described +
          ')',
      );
      return;
    }

    if (!isValidKeyShape(record)) {
      problems.push(
        at +
          ': invalid source/entity/providerField/value-type combination (' +
          described +
          ')',
      );
      return;
    }

    const key = canonicalKey({ season: document.season, ...record });
    const previous = seen.get(key);
    if (previous !== undefined) {
      problems.push(
        previous.gridviewId === record.gridviewId
          ? at +
              ': duplicate key already declared at mappings[' +
              previous.index +
              '] (' +
              described +
              ')'
          : at +
              ': ambiguous key - mappings[' +
              previous.index +
              '] maps it to "' +
              previous.gridviewId +
              '" and this record maps it to "' +
              record.gridviewId +
              '" (' +
              described +
              ')',
      );
      return;
    }
    seen.set(key, { index, gridviewId: record.gridviewId });

    const canonical = canonicalIds[record.entity];
    if (!canonical || !canonical.has(record.gridviewId)) {
      problems.push(
        at +
          ': target "' +
          record.gridviewId +
          '" does not exist in ' +
          registryFileForEntity[record.entity] +
          ' (dangling, or a target of the wrong entity kind)',
      );
    }
  });

  return problems;
}

/**
 * Checks that the approved evidence corpus is completely accounted for.
 *
 * An identity the repository already records must not silently disappear: it
 * is either mapped, or acknowledged as unmapped with a reviewed reason. Adding
 * a new approved identity therefore fails validation until one of those two
 * explicit decisions is made in review.
 */
export function validateEvidenceCoverage(evidence, mappingDocument) {
  const problems = [];

  const mapped = new Set(
    mappingDocument.mappings
      .filter((record) => isValidKeyShape(record))
      .map((record) =>
        canonicalKey({ season: mappingDocument.season, ...record }),
      ),
  );

  const acknowledged = new Map();
  evidence.acknowledgedUnmapped.forEach((record, index) => {
    const at = 'acknowledgedUnmapped[' + index + ']';
    if (!isValidKeyShape(record)) {
      problems.push(at + ': invalid key combination');
      return;
    }
    const key = canonicalKey({ season: evidence.season, ...record });
    if (acknowledged.has(key)) {
      problems.push(at + ': duplicate acknowledgement');
      return;
    }
    acknowledged.set(key, at);
    if (mapped.has(key)) {
      problems.push(
        at +
          ': identity is acknowledged as unmapped but a mapping exists for it (' +
          describeKey({ season: evidence.season, ...record }) +
          ')',
      );
    }
  });

  const known = new Set();
  evidence.identities.forEach((record, index) => {
    const at = 'identities[' + index + ']';
    if (!isValidKeyShape(record)) {
      problems.push(at + ': invalid key combination');
      return;
    }
    const key = canonicalKey({ season: evidence.season, ...record });
    if (known.has(key)) {
      problems.push(at + ': duplicate identity');
      return;
    }
    known.add(key);
    if (!mapped.has(key) && !acknowledged.has(key)) {
      problems.push(
        at +
          ': approved provider identity is neither mapped nor acknowledged as unmapped (' +
          describeKey({ season: evidence.season, ...record }) +
          ')',
      );
    }
  });

  for (const [key, at] of acknowledged) {
    if (!known.has(key)) {
      problems.push(
        at + ': acknowledgement does not correspond to any recorded identity',
      );
    }
  }

  // A mapping for an identity the corpus never recorded means the value came
  // from somewhere other than the repository's approved evidence.
  mappingDocument.mappings.forEach((record, index) => {
    if (!isValidKeyShape(record)) return;
    const key = canonicalKey({ season: mappingDocument.season, ...record });
    if (!known.has(key)) {
      problems.push(
        'mappings[' +
          index +
          ']: mapped identity is absent from the approved evidence corpus (' +
          describeKey({ season: mappingDocument.season, ...record }) +
          ')',
      );
    }
  });

  return problems;
}
