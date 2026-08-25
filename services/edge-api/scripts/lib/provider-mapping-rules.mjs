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
 * Field separator for the canonical key: NUL. Curated provider values may not
 * contain any control character, so no value can embed it and forge a key that
 * belongs to a different combination.
 */
const KEY_SEPARATOR = String.fromCharCode(0);

function valueTypeOf(value) {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number' && Number.isSafeInteger(value))
    return 'integer';
  return null;
}

/** True when the four discriminators form one declared combination. */
export function isValidKeyShape(record) {
  const valueType = valueTypeOf(record.providerValue);
  if (valueType === null) return false;
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
 * keys and can never collide. The separator is NUL, which a curated provider
 * value may not contain (the schema rejects every control character), so no
 * provider value can forge a different key by embedding the separator.
 * Nothing is lower-cased, trimmed or normalized here: the key is the exact
 * value.
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
  return [
    season,
    source,
    entity,
    providerField,
    valueType,
    String(providerValue),
  ].join(KEY_SEPARATOR);
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
