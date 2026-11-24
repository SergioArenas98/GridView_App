/**
 * U9: the private driver-inventory accounting model and its closed policy
 * vocabulary (design §8.1-8.3, ADR 0030).
 *
 * Six concepts stay separate. A provider-observed inventory row is a private
 * observation, not an entrant claim. A verified canonical profile comes only
 * from the pinned catalog. An unresolved inventory-only observation is
 * counted, never projected: it has no canonical ID, profile, team or span.
 * Required classification/standings identities and accepted participation are
 * untouched by this module.
 *
 * **Private.** `DriverInventory` is internal coordination metadata. It must
 * never enter `ProviderSeasonSource`, a generated snapshot, a public schema, a
 * dataset content hash or a classification revision hash.
 *
 * **No operational authority.** This module only describes the policy. The
 * composition derives the policy from the admitted run context through
 * {@link inventoryPolicyForContext}. Since U10 that context may carry
 * `optional-drivers/1`, but only when the explicit runtime configuration
 * selected it and the durable run pin recorded it; nothing here reads
 * configuration or enables it.
 */

import type { IdentityHash, IdentityKeyReference } from '../discovery/model';
import {
  canonicalKey,
  identityHash,
  hashIdentityProjection,
} from '../discovery/keys';
import { ownDataProperty } from '../../runtime/own-property';
import { isHash } from '../wire-decoders';

/**
 * The exact typed provider key, reached through the reviewed U1 discovery
 * types so this module takes no direct dependency on mapping content.
 */
export type InventoryKey = IdentityKeyReference['key'];

/** The only supported optional-inventory accounting version. */
export const driverInventoryPolicyVersion = 1 as const;

/** The only reason an inventory row may be unresolved and still accounted. */
export const unresolvedInventoryReason = 'unmapped' as const;

/** The closed set of `driverInventory` keys, in declaration order. */
export const driverInventoryKeys = [
  'policyVersion',
  'catalogHash',
  'providerRowCount',
  'resolved',
  'unresolved',
  'projectionDigest',
] as const;

/**
 * The inventory policy selected for one **whole** run.
 *
 * `strict` is the pre-U9 behaviour and the default. `optional-drivers` binds
 * the version and the catalog hash of the trusted run context: a coordinator
 * compares a payload against these values and never against the payload's own
 * claim.
 */
export type DriverInventoryPolicy =
  | { readonly mode: 'strict' }
  | {
      readonly mode: 'optional-drivers';
      readonly policyVersion: typeof driverInventoryPolicyVersion;
      readonly catalogHash: IdentityHash;
    };

export interface ResolvedInventoryDriver {
  readonly driverId: string;
  readonly observationKeyHash: IdentityHash;
}

export interface UnresolvedInventoryDriver {
  readonly candidateId: IdentityHash;
  readonly reason: typeof unresolvedInventoryReason;
}

/** The private accounting of one complete decoded driver inventory. */
export interface DriverInventory {
  readonly policyVersion: typeof driverInventoryPolicyVersion;
  readonly catalogHash: IdentityHash;
  readonly providerRowCount: number;
  /** Provider order; exactly equal to the projected `drivers` IDs. */
  readonly resolved: readonly ResolvedInventoryDriver[];
  /** Ascending `candidateId` order, independent of provider row order. */
  readonly unresolved: readonly UnresolvedInventoryDriver[];
  readonly projectionDigest: IdentityHash;
}

export class InventoryPolicyError extends Error {
  constructor(
    readonly failure:
      'inventory-policy-invalid' | 'inventory-policy-unavailable',
  ) {
    super(failure);
    this.name = 'InventoryPolicyError';
  }
}

export const strictInventoryPolicy: DriverInventoryPolicy = Object.freeze({
  mode: 'strict',
});

/**
 * Builds the optional policy for an **explicit isolated** context. The caller
 * supplies the catalog hash of a trusted run context; nothing here reads
 * configuration. Operational wiring reaches it only through
 * {@link inventoryPolicyForContext}.
 */
export function optionalDriverInventoryPolicy(
  catalogHash: string,
): DriverInventoryPolicy {
  if (!isHash(catalogHash))
    throw new InventoryPolicyError('inventory-policy-invalid');
  return Object.freeze({
    mode: 'optional-drivers',
    policyVersion: driverInventoryPolicyVersion,
    catalogHash,
  });
}

/**
 * Reads an injected policy once, as own data properties, into a frozen copy.
 * `undefined` is the strict default. Anything else malformed is refused, so a
 * caller can never obtain a permissive policy by passing a near miss.
 */
export function readDriverInventoryPolicy(
  value: unknown,
): DriverInventoryPolicy | null {
  if (value === undefined) return strictInventoryPolicy;
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return null;
    const mode = ownDataProperty(value, 'mode');
    if (mode === null) return null;
    const keys = Reflect.ownKeys(value);
    if (mode.value === 'strict')
      return keys.length === 1 ? strictInventoryPolicy : null;
    if (mode.value !== 'optional-drivers' || keys.length !== 3) return null;
    const version = ownDataProperty(value, 'policyVersion');
    const catalogHash = ownDataProperty(value, 'catalogHash');
    if (
      version === null ||
      catalogHash === null ||
      version.value !== driverInventoryPolicyVersion ||
      !isHash(catalogHash.value)
    )
      return null;
    return optionalDriverInventoryPolicy(catalogHash.value);
  } catch {
    return null;
  }
}

/**
 * The closed run-context inventory policy versions (U6 provenance).
 *
 * `strict/1` is the default and the pre-U9 behaviour. `optional-drivers/1` is
 * the phase-3 policy, representable only in a **runtime** context admitted
 * through a durable pin whose request named that policy, or in a verified
 * offline export context generated under it.
 */
export const inventoryPolicyVersions = [
  'strict/1',
  'optional-drivers/1',
] as const;
export type InventoryPolicyVersion = (typeof inventoryPolicyVersions)[number];

/** The private batch-v2 vocabulary for each run-context policy version. */
export type BatchInventoryPolicy = 'strict-v1' | 'optional-driver-inventory-v1';
const batchPolicyByVersion: Readonly<
  Record<InventoryPolicyVersion, BatchInventoryPolicy>
> = Object.freeze({
  'strict/1': 'strict-v1',
  'optional-drivers/1': 'optional-driver-inventory-v1',
});

/** Exact closed mapping; anything else is `null`, never a default. */
export function batchInventoryPolicyFor(
  version: unknown,
): BatchInventoryPolicy | null {
  return typeof version === 'string' &&
    Object.hasOwn(batchPolicyByVersion, version)
    ? batchPolicyByVersion[version as InventoryPolicyVersion]
    : null;
}

/** Exact closed inverse mapping; anything else is `null`. */
export function inventoryPolicyVersionFor(
  policy: unknown,
): InventoryPolicyVersion | null {
  for (const version of inventoryPolicyVersions) {
    if (batchPolicyByVersion[version] === policy) return version;
  }
  return null;
}

/**
 * The policy an **operational** run uses, derived from its admitted context
 * and nothing else. `optional-drivers/1` requires runtime authority and binds
 * the context's own catalog hash; every other combination is refused rather
 * than mapped onto a permissive or strict default.
 */
export function inventoryPolicyForContext(context: {
  readonly inventoryPolicyVersion: string;
  readonly authority?: string;
  readonly catalogHash?: string;
}): DriverInventoryPolicy {
  if (context.inventoryPolicyVersion === 'strict/1')
    return strictInventoryPolicy;
  if (
    context.inventoryPolicyVersion === 'optional-drivers/1' &&
    context.authority === 'runtime' &&
    typeof context.catalogHash === 'string'
  )
    return optionalDriverInventoryPolicy(context.catalogHash);
  throw new InventoryPolicyError('inventory-policy-unavailable');
}

/**
 * A resolved row's private observation hash. Domain-separated from the U1
 * candidate identity (`gv-identity-candidate/1`) so a resolved and an
 * unresolved row can never share one value, and computed from the exact
 * typed key serialization the reviewed catalog uses.
 */
export function observationKeyHashFor(
  key: InventoryKey,
): Promise<IdentityHash> {
  return identityHash(
    'gv-identity-inventory-observation/1' + canonicalKey(key),
  );
}

/** The fields the projection digest covers: everything but the digest. */
export type DriverInventoryProjection = Omit<
  DriverInventory,
  'projectionDigest'
>;

/** Deterministic digest of the complete accounting projection. */
export function driverInventoryProjectionDigest(
  projection: DriverInventoryProjection,
): Promise<IdentityHash> {
  return hashIdentityProjection({
    format: 'gridview-driver-inventory/1',
    policyVersion: projection.policyVersion,
    catalogHash: projection.catalogHash,
    providerRowCount: projection.providerRowCount,
    resolved: projection.resolved.map((r) => ({
      driverId: r.driverId,
      observationKeyHash: r.observationKeyHash,
    })),
    unresolved: projection.unresolved.map((u) => ({
      candidateId: u.candidateId,
      reason: u.reason,
    })),
  });
}

/**
 * Recomputes the digest of an **untrusted, already detached** accounting
 * value. Returns `null` when the value is not even shaped enough to digest;
 * the closed validator then reports the precise problem. Never throws.
 */
export async function recomputeDriverInventoryDigest(
  value: unknown,
): Promise<IdentityHash | null> {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return null;
    const read = (name: string): unknown => ownDataProperty(value, name)?.value;
    const resolved = read('resolved');
    const unresolved = read('unresolved');
    if (!Array.isArray(resolved) || !Array.isArray(unresolved)) return null;
    const field = (row: unknown, name: string): unknown =>
      typeof row === 'object' && row !== null
        ? (ownDataProperty(row, name)?.value ?? null)
        : null;
    // The same projection `driverInventoryProjectionDigest` hashes. The
    // canonical serializer rejects non-JSON values, so an exotic member fails
    // here and is caught below.
    return await hashIdentityProjection({
      format: 'gridview-driver-inventory/1',
      policyVersion: read('policyVersion') ?? null,
      catalogHash: read('catalogHash') ?? null,
      providerRowCount: read('providerRowCount') ?? null,
      resolved: resolved.map((r: unknown) => ({
        driverId: field(r, 'driverId'),
        observationKeyHash: field(r, 'observationKeyHash'),
      })),
      unresolved: unresolved.map((u: unknown) => ({
        candidateId: field(u, 'candidateId'),
        reason: field(u, 'reason'),
      })),
    });
  } catch {
    return null;
  }
}
