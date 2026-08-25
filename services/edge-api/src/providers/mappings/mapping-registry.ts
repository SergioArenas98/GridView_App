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
  type GridViewIdFor,
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
  'unmapped' | 'registry-invalid' | 'ambiguous' | 'target-missing';

/**
 * Typed internal context for a failed lookup.
 *
 * It carries enough for a future adapter to classify and report the failure.
 * It is **not** part of the public v1 contract and must never be serialized
 * into a public response, an OpenAPI example or a published snapshot.
 */
export interface ProviderMappingFailure {
  readonly reason: ProviderMappingFailureReason;
  readonly season: number;
  readonly source: ProviderMappingSource;
  readonly entity: ProviderMappingEntity;
  readonly providerField: ProviderMappingField;
  /**
   * The exact provider value, for an internal diagnostic field only. Bounded
   * by the curated schema and by the key decoder; never a provider payload.
   */
  readonly providerValue: string | number;
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

  static invalid(
    problems: readonly RegistryProblem[],
  ): ProviderMappingRegistry {
    return new ProviderMappingRegistry(null, Object.freeze([...problems]));
  }

  static valid(
    index: ReadonlyMap<string, IndexedTarget>,
  ): ProviderMappingRegistry {
    return new ProviderMappingRegistry(index, Object.freeze([]));
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
    if (this.index === null) {
      return {
        outcome: 'unresolved',
        failure: failureFor(key, 'registry-invalid'),
      };
    }

    const found = this.index.get(canonicalKey(key));
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
   */
  resolveUnknown(
    value: unknown,
  ): ProviderMappingResolution<ProviderMappingEntity> | null {
    const key = decodeProviderMappingKey(value);
    if (key === null) return null;
    return this.resolve(key as ProviderMappingKeyFor<ProviderMappingEntity>);
  }
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
  readonly season?: unknown;
  readonly mappings?: unknown;
}

/**
 * Builds the registry from one or more curated documents.
 *
 * Record order never affects the outcome. A repeated complete key is always an
 * error — never an overwrite — so no last-entry-wins behaviour exists, and a
 * repeat that points at a *different* target is reported as `ambiguous-key`
 * rather than being silently reduced to a duplicate.
 */
export function buildProviderMappingRegistry(
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

      const key = decodeProviderMappingKey({ ...record, season });
      if (key === null) {
        problems.push({ at, reason: 'invalid-key-combination' });
        return;
      }

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
            previous.gridviewId === target ? 'duplicate-key' : 'ambiguous-key',
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
    return ProviderMappingRegistry.invalid(problems);
  }

  return ProviderMappingRegistry.valid(index);
}

/** Collects canonical IDs from a curated registry document. */
export function canonicalIdsFrom(
  entries: readonly { readonly id: string }[],
): ReadonlySet<string> {
  return new Set(entries.map((entry) => entry.id));
}
