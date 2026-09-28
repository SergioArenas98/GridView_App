// Semantic rules for the curated `data-source-attribution` record
// (`content/attribution/data-sources.json`).
//
// JSON Schema proves the record's shape. It cannot prove that `version` still
// identifies the content it names, or that each licensor appears exactly once.
// Those rules are stated here once so the content validator and its tests
// share them.

import { createHash } from 'node:crypto';

/**
 * Every attribution version ever issued, with the digest of the content it
 * identifies. Append-only: an entry is never edited or removed, so a version
 * can never come to mean different content.
 *
 * To change the record, issue the next version and append it here with the
 * digest `attributionContentDigest` reports for the new content.
 */
export const ISSUED_ATTRIBUTION_VERSIONS = Object.freeze({
  'data-sources-v1':
    'cda4922b7de59cc86ebdb1f23994429c0c3b6cd8eac3971c3f8e140cb61c8621',
});

/** Serializes a JSON value with object keys sorted, so digests ignore key order. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * The SHA-256 of everything a version identifies: the `sources` array, in
 * order, with key order ignored. `kind`, `version` and the `$schema` editor
 * hint are excluded because they describe the record rather than the notice.
 */
export function attributionContentDigest(document) {
  return createHash('sha256')
    .update(canonicalJson(document.sources), 'utf8')
    .digest('hex');
}

/**
 * Every problem with the record, as human-readable strings. An empty list
 * means the record satisfies every rule. Nothing is repaired.
 */
export function validateAttributionDocument(
  document,
  issued = ISSUED_ATTRIBUTION_VERSIONS,
) {
  const problems = [];

  const seenIds = new Set();
  const seenNames = new Set();
  document.sources.forEach((source, index) => {
    const where = `sources[${index}]`;
    if (seenIds.has(source.sourceId)) {
      problems.push(`${where}: duplicate sourceId "${source.sourceId}"`);
    }
    seenIds.add(source.sourceId);
    const name = source.name.trim().toLowerCase();
    if (seenNames.has(name)) {
      problems.push(`${where}: duplicate source name "${source.name}"`);
    }
    seenNames.add(name);
  });

  const digest = attributionContentDigest(document);
  const expected = Object.hasOwn(issued, document.version)
    ? issued[document.version]
    : undefined;
  if (expected === undefined) {
    problems.push(
      `version "${document.version}" has not been issued; append it to ` +
        `ISSUED_ATTRIBUTION_VERSIONS with digest ${digest}`,
    );
  } else if (expected !== digest) {
    problems.push(
      `version "${document.version}" identifies different content ` +
        `(issued digest ${expected}, current ${digest}); issue a new version ` +
        'instead of changing an issued one',
    );
  }

  return problems;
}
