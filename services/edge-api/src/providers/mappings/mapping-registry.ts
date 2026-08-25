/**
 * The immutable provider-identifier mapping registry and its resolver.
 *
 * Construction is all-or-nothing. Every curated record is decoded, checked for
 * a valid discriminated combination, checked for composite-key uniqueness and
 * checked against the curated GridView registry that owns its entity kind. If
 * **any** record fails, no index is exposed at all: the registry is returned
 * in an invalid state whose every lookup answers `registry-invalid`. There is
 * no partially usable index and no valid subset to fall back on, because a
 * half-loaded identity table is exactly how a wrong identity gets published.
 *
 * The resolver never reads the network, never writes KV, Durable Object or
 * local storage, never mutates anything and never mints an identifier.
 */

import {
  canonicalKey,
  decodeProviderMappingKey,
  isPublicIdGrammar,
  validateProviderMappingKey,
  type GridViewIdFor,
  type ProviderKeyProblem,
  type ProviderMappingEntity,
  type ProviderMappingField,
  type ProviderMappingKey,
  type ProviderMappingKeyFor,
  type ProviderMappingSource,
} from './mapping-key';

/**
 * Why a lookup did not produce a GridView identity.
 *
 * `ambiguous` and `target-missing` are unreachable through a successfully
 * constructed registry, because construction rejects both. They are retained
 * as distinct defensive categories rather than folded into `registry-invalid`:
 * an operator reading the signal needs to know whether an identity was
 * duplicated with conflicting targets or pointed at a nonexistent one, and a
 * future adapter classifies them differently.
 */
export type ProviderMappingFailureReason =
  | 'unmapped'
  | 'registry-invalid'
  | 'ambiguous'
  | 'target-missing'
  | 'invalid-key';

/**
 * Typed internal context for a failed lookup.
 *
 * It carries enough for a future adapter to classify and report the failure.
 * It is **not** part of the public v1 contract and must never be serialized
 * into a public response, an OpenAPI example or a published snapshot.
 */
export interface ProviderMappingFailure {
  readonly reason: ProviderMappingFailureReason;
  /** `null` only when the key was malformed and no season could be read. */
  readonly season: number | null;
  readonly source: ProviderMappingSource | 'unknown';
  readonly entity: ProviderMappingEntity | 'unknown';
  readonly providerField: ProviderMappingField | 'unknown';
  /**
   * The exact provider value, for an internal diagnostic field only. Bounded
   * by the curated schema and by the key decoder; never a provider payload.
   *
   * `null` for an `invalid-key` failure. A value that failed validation is
   * exactly the value that must not be echoed anywhere, and an operator's
   * action for it is "fix the adapter", not "curate this identifier", so the
   * bounded `keyProblem` carries the whole diagnosis instead.
   */
  readonly providerValue: string | number | null;
  /** Bounded sub-reason; present only when `reason` is `invalid-key`. */
  readonly keyProblem?: ProviderKeyProblem;
}

export type ProviderMappingResolution<E extends ProviderMappingEntity> =
  | { readonly outcome: 'resolved'; readonly gridviewId: GridViewIdFor<E> }
  | {
      readonly outcome: 'unresolved';
      readonly failure: ProviderMappingFailure;
    };

/** One structural problem found while constructing the registry. */
export interface RegistryProblem {
  readonly at: string;
  readonly reason:
    | 'invalid-record'
    | 'unsupported-document'
    | 'unexpected-property'
    | 'invalid-key-combination'
    | 'invalid-target-grammar'
    | 'duplicate-key'
    | 'ambiguous-key'
    | 'target-missing';
}

/** The curated registries that own canonical identities, by entity kind. */
export interface CanonicalRegistries {
  readonly driver: ReadonlySet<string>;
  readonly constructor: ReadonlySet<string>;
  readonly circuit: ReadonlySet<string>;
}

interface IndexedTarget {
  readonly gridviewId: string;
  readonly at: string;
}

/**
 * A fully validated, frozen mapping index, or a fail-closed invalid registry.
 *
 * Safe to cache at module scope: it is derived from immutable version-
 * controlled content, holds no request state, and exposes no mutator. That is
 * the opposite of the per-request accounting and quota state, which must never
 * be cached this way.
 */
export class ProviderMappingRegistry {
  private constructor(
    private readonly index: ReadonlyMap<string, IndexedTarget> | null,
    readonly problems: readonly RegistryProblem[],
  ) {}

  /** True when every curated record validated and the index is usable. */
  get isValid(): boolean {
    return this.index !== null;
  }

  /** Number of indexed mappings; always 0 when the registry is invalid. */
  get size(): number {
    return this.index?.size ?? 0;
  }

  /**
   * Internal factories.
   *
   * These are **not** public. A public `valid(index)` would be a structural
   * bypass of the entire validated-construction boundary: any caller could
   * hand it a Map of unvalidated entries and get back a registry that reports
   * `isValid`, has no problems, and hands out branded GridView identities for
   * targets that exist in no curated registry. `buildProviderMappingRegistry`
   * is the only way to obtain a registry, and it validates every record.
   */
  private static make(
    index: ReadonlyMap<string, IndexedTarget> | null,
    problems: readonly RegistryProblem[],
  ): ProviderMappingRegistry {
    return new ProviderMappingRegistry(index, Object.freeze([...problems]));
  }

  /**
   * Resolves one provider key to its GridView identity.
   *
   * Exact typed equality only. There is no fallback of any kind: no case
   * folding, no trimming, no slug generation, no display-name lookup, no
   * similarity search, no second attempt against another provider field, and
   * no attempt against another source or season.
   */
  resolve<E extends ProviderMappingEntity>(
    key: ProviderMappingKeyFor<E>,
  ): ProviderMappingResolution<E> {
    // The caller's types prove the key's *shape*, never its runtime contents.
    // `providerValue: string` accepts padded, empty and control-character
    // strings; `number` accepts NaN, -1 and 1.5.
    // Re-validate here so the resolver's guarantees do not depend on every
    // future adapter being careful.
    const validated = validateProviderMappingKey(key);
    if (!validated.ok) {
      return {
        outcome: 'unresolved',
        failure: invalidKeyFailure(validated.problem),
      };
    }

    if (this.index === null) {
      return {
        outcome: 'unresolved',
        failure: failureFor(key, 'registry-invalid'),
      };
    }

    const found = this.index.get(canonicalKey(validated.key));
    if (found === undefined) {
      return { outcome: 'unresolved', failure: failureFor(key, 'unmapped') };
    }

    return {
      outcome: 'resolved',
      gridviewId: found.gridviewId as GridViewIdFor<E>,
    };
  }

  /**
   * Resolves an untrusted value, decoding it first.
   *
   * A value that is not a complete valid key — an unknown source such as
   * `mock`, a mismatched field, a string where an integer is required — is
   * rejected by the decoder and never reaches the index.
   *
   * It returns an explicit `invalid-key` failure rather than a bare `null`.
   * A malformed provider identity is not "no mapping is required here", and a
   * caller must not be able to read the two as the same thing and continue
   * with an unvalidated provider value.
   */
  resolveUnknown(
    value: unknown,
  ): ProviderMappingResolution<ProviderMappingEntity> {
    const decoded = decodeProviderMappingKey(value);
    if (!decoded.ok) {
      return {
        outcome: 'unresolved',
        failure: invalidKeyFailure(decoded.problem),
      };
    }
    return this.resolve(
      decoded.key as ProviderMappingKeyFor<ProviderMappingEntity>,
    );
  }

  /**
   * Builds the registry from one or more curated documents.
   *
   * Record order never affects the outcome. A repeated complete key is always an
   * error — never an overwrite — so no last-entry-wins behaviour exists, and a
   * repeat that points at a *different* target is reported as `ambiguous-key`
   * rather than being silently reduced to a duplicate.
   */
  static build(
    documents: readonly unknown[],
    canonical: CanonicalRegistries,
  ): ProviderMappingRegistry {
    const problems: RegistryProblem[] = [];
    const index = new Map<string, IndexedTarget>();

    documents.forEach((rawDocument, documentIndex) => {
      if (typeof rawDocument !== 'object' || rawDocument === null) {
        problems.push({
          at: `documents[${documentIndex}]`,
          reason: 'invalid-record',
        });
        return;
      }

      const document = rawDocument as CuratedMappingDocument;
      const season = document.season;

      if (
        document.kind !== SUPPORTED_DOCUMENT_KIND ||
        document.schemaVersion !== SUPPORTED_SCHEMA_VERSION
      ) {
        problems.push({
          at: `documents[${documentIndex}]`,
          reason: 'unsupported-document',
        });
        return;
      }

      if (!hasNoUnexpectedProperty(rawDocument, DOCUMENT_PROPERTIES)) {
        problems.push({
          at: `documents[${documentIndex}]`,
          reason: 'unexpected-property',
        });
        return;
      }

      if (!Array.isArray(document.mappings)) {
        problems.push({
          at: `documents[${documentIndex}]`,
          reason: 'invalid-record',
        });
        return;
      }

      document.mappings.forEach((rawRecord: unknown, recordIndex) => {
        const at = `documents[${documentIndex}].mappings[${recordIndex}]`;

        if (typeof rawRecord !== 'object' || rawRecord === null) {
          problems.push({ at, reason: 'invalid-record' });
          return;
        }
        const record = rawRecord as Record<string, unknown>;

        if (!hasNoUnexpectedProperty(rawRecord, MAPPING_RECORD_PROPERTIES)) {
          problems.push({ at, reason: 'unexpected-property' });
          return;
        }

        // Built field by field rather than spread, because the decoder now
        // requires an exact closed shape and a curated record legitimately
        // carries `gridviewId`, `evidence` and `note` alongside the key.
        const decoded = decodeProviderMappingKey({
          season,
          source: record.source,
          entity: record.entity,
          providerField: record.providerField,
          providerValue: record.providerValue,
        });
        if (!decoded.ok) {
          problems.push({ at, reason: 'invalid-key-combination' });
          return;
        }
        const key = decoded.key;

        const target = record.gridviewId;
        if (!isPublicIdGrammar(target)) {
          problems.push({ at, reason: 'invalid-target-grammar' });
          return;
        }

        const encoded = canonicalKey(key);
        const previous = index.get(encoded);
        if (previous !== undefined) {
          problems.push({
            at,
            reason:
              previous.gridviewId === target
                ? 'duplicate-key'
                : 'ambiguous-key',
          });
          return;
        }

        if (!canonical[key.entity].has(target)) {
          problems.push({ at, reason: 'target-missing' });
          return;
        }

        index.set(encoded, Object.freeze({ gridviewId: target, at }));
      });
    });

    if (problems.length > 0) {
      // Fail closed: discard the partially built index entirely.
      return ProviderMappingRegistry.make(null, problems);
    }

    return ProviderMappingRegistry.make(index, []);
  }
}

/**
 * A bounded failure for a key that never passed validation.
 *
 * Nothing provider-controlled is carried: the identity fields are `unknown`
 * and the value is `null`, because an unvalidated value is precisely what must
 * not reach a diagnostic field. The closed `keyProblem` is the diagnosis.
 */
function invalidKeyFailure(
  problem: ProviderKeyProblem,
): ProviderMappingFailure {
  return Object.freeze({
    reason: 'invalid-key' as const,
    season: null,
    source: 'unknown' as const,
    entity: 'unknown' as const,
    providerField: 'unknown' as const,
    providerValue: null,
    keyProblem: problem,
  });
}

function failureFor(
  key: ProviderMappingKey,
  reason: ProviderMappingFailureReason,
): ProviderMappingFailure {
  return Object.freeze({
    reason,
    season: key.season,
    source: key.source,
    entity: key.entity,
    providerField: key.providerField,
    providerValue: key.providerValue,
  });
}

/** The shape a curated mapping document must have to be read at all. */
interface CuratedMappingDocument {
  readonly kind?: unknown;
  readonly schemaVersion?: unknown;
  readonly season?: unknown;
  readonly mappings?: unknown;
}

/**
 * The one document kind and schema version this resolver understands.
 *
 * Checked at runtime, not only by the build-time schema. The `provider-mappings`
 * kind previously carried an incompatible version-1 shape (per-provider grouped
 * arrays of opaque mock identifiers), so "which shape is this?" is a real
 * question rather than a decorative field. An unknown version, a missing
 * version or another content kind fails closed instead of being partially
 * interpreted.
 */
const SUPPORTED_DOCUMENT_KIND = 'provider-mappings';
const SUPPORTED_SCHEMA_VERSION = 2;

/**
 * The closed property sets, mirroring `additionalProperties: false` in the
 * curated JSON Schema so the runtime boundary is as strict as the build-time
 * one rather than merely ignoring what the schema rejects.
 *
 * `$schema` is an editor hint the schema itself tolerates, so it is allowed
 * here too; `status` and `note` are optional curated metadata.
 */
const DOCUMENT_PROPERTIES: ReadonlySet<string> = new Set([
  '$schema',
  'kind',
  'schemaVersion',
  'status',
  'note',
  'season',
  'mappings',
]);

const MAPPING_RECORD_PROPERTIES: ReadonlySet<string> = new Set([
  'source',
  'entity',
  'providerField',
  'providerValue',
  'gridviewId',
  'evidence',
  'note',
]);

/** True when `value` carries no own enumerable property outside `allowed`. */
function hasNoUnexpectedProperty(
  value: object,
  allowed: ReadonlySet<string>,
): boolean {
  for (const property of Object.keys(value)) {
    if (!allowed.has(property)) return false;
  }
  return true;
}

/**
 * The only way to obtain a registry.
 *
 * Every record is validated before any index is exposed, and the internal
 * factory that skips validation is private to the class, so there is no
 * structural bypass through the public exports.
 */
export function buildProviderMappingRegistry(
  documents: readonly unknown[],
  canonical: CanonicalRegistries,
): ProviderMappingRegistry {
  return ProviderMappingRegistry.build(documents, canonical);
}

/** Collects canonical IDs from a curated registry document. */
export function canonicalIdsFrom(
  entries: readonly { readonly id: string }[],
): ReadonlySet<string> {
  return new Set(entries.map((entry) => entry.id));
}
