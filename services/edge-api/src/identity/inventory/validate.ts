/**
 * U9: closed validation of an explicit optional-driver participants payload
 * (design §8.2, T29).
 *
 * The coordinator calls this on its **detached** candidate snapshot, with the
 * expected policy taken from the trusted run context. Nothing in the payload
 * is believed about itself: its policy version and catalog hash are compared
 * against the expectation, its counts and identifiers against each other and
 * against the projected `drivers`, and its digest against a value the
 * coordinator recomputed from the same snapshot.
 *
 * This is deliberately not a permissive superset of the strict contract. The
 * strict participants wrapper stays closed and still refuses a
 * `driverInventory` key; this validator applies only when the run's policy is
 * `optional-drivers`, and then `driverInventory` is required.
 *
 * Problems are closed codes only - never a value, a provider key or a hash.
 */

import { ownDataProperty } from '../../runtime/own-property';
import { isHash } from '../wire-decoders';
import {
  driverInventoryKeys,
  driverInventoryPolicyVersion,
  unresolvedInventoryReason,
  type DriverInventoryPolicy,
} from './model';

export const driverInventoryProblems = [
  /** `driverInventory` absent from an optional-mode payload. */
  'missing-accounting',
  /** Not a closed object, or a member is not a closed object. */
  'shape',
  'policy-version',
  'catalog-hash',
  'row-count',
  'identifier',
  'hash',
  'reason',
  'duplicate-observation',
  'duplicate-candidate',
  'duplicate-driver',
  'unresolved-order',
  /** `resolved` IDs and `drivers` IDs differ in membership or order. */
  'projection-mismatch',
  /** `driverEntries` must stay empty for participants inventory. */
  'driver-entries',
  'projection-digest',
] as const;

export type DriverInventoryProblem = (typeof driverInventoryProblems)[number];

/** The contract identifier grammar used for canonical `GridViewId`s. */
const canonicalIdPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const canonicalIdMaxLength = 96;
/** Matches the participants page cap; a larger census cannot be complete. */
const maxInventoryRows = 100;

function closedRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null;
  const own = Reflect.ownKeys(value);
  if (
    own.length !== keys.length ||
    own.some((k) => typeof k !== 'string' || !keys.includes(k))
  )
    return null;
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const property = ownDataProperty(value, key);
    if (property === null) return null;
    result[key] = property.value;
  }
  return result;
}

const isCanonicalId = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length <= canonicalIdMaxLength &&
  canonicalIdPattern.test(v);

/**
 * Every problem with one optional-mode participants payload.
 *
 * `payload` is the detached participants wrapper. `recomputedDigest` is the
 * digest the coordinator computed from the same snapshot (`null` when it
 * could not be computed). A strict policy has no inventory to validate and
 * answers no problems: the strict closed wrapper is enforced separately.
 */
export function validateDriverInventoryPayload(
  payload: unknown,
  policy: DriverInventoryPolicy,
  recomputedDigest: string | null,
): readonly DriverInventoryProblem[] {
  if (policy.mode === 'strict') return [];
  const problems = new Set<DriverInventoryProblem>();
  try {
    if (typeof payload !== 'object' || payload === null) return ['shape'];
    const accounting = ownDataProperty(payload, 'driverInventory');
    if (accounting === null) return ['missing-accounting'];
    const inventory = closedRecord(accounting.value, driverInventoryKeys);
    if (inventory === null) return ['shape'];

    if (
      inventory.policyVersion !== driverInventoryPolicyVersion ||
      policy.policyVersion !== driverInventoryPolicyVersion
    )
      problems.add('policy-version');
    if (
      !isHash(inventory.catalogHash) ||
      inventory.catalogHash !== policy.catalogHash
    )
      problems.add('catalog-hash');
    if (!isHash(inventory.projectionDigest)) problems.add('hash');

    const resolved = inventory.resolved;
    const unresolved = inventory.unresolved;
    if (
      !Array.isArray(resolved) ||
      !Array.isArray(unresolved) ||
      resolved.length > maxInventoryRows ||
      unresolved.length > maxInventoryRows
    )
      return [...problems, 'shape'];

    const resolvedIds: string[] = [];
    const observations = new Set<string>();
    for (const member of resolved) {
      const row = closedRecord(member, ['driverId', 'observationKeyHash']);
      if (row === null) {
        problems.add('shape');
        continue;
      }
      if (!isCanonicalId(row.driverId)) problems.add('identifier');
      else resolvedIds.push(row.driverId);
      if (!isHash(row.observationKeyHash)) problems.add('hash');
      else if (observations.has(row.observationKeyHash))
        problems.add('duplicate-observation');
      else observations.add(row.observationKeyHash);
    }
    if (new Set(resolvedIds).size !== resolvedIds.length)
      problems.add('duplicate-driver');

    const candidates: string[] = [];
    for (const member of unresolved) {
      const row = closedRecord(member, ['candidateId', 'reason']);
      if (row === null) {
        problems.add('shape');
        continue;
      }
      if (row.reason !== unresolvedInventoryReason) problems.add('reason');
      if (!isHash(row.candidateId)) {
        problems.add('hash');
        continue;
      }
      if (candidates.includes(row.candidateId))
        problems.add('duplicate-candidate');
      candidates.push(row.candidateId);
    }
    // Equal neighbours are already reported as duplicates above.
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i - 1]! > candidates[i]!) problems.add('unresolved-order');
    }
    for (const candidate of candidates) {
      if (observations.has(candidate)) problems.add('duplicate-observation');
    }

    const count = inventory.providerRowCount;
    if (
      typeof count !== 'number' ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      count > maxInventoryRows ||
      count !== resolved.length + unresolved.length
    )
      problems.add('row-count');

    const drivers = ownDataProperty(payload, 'drivers')?.value;
    if (!Array.isArray(drivers)) problems.add('projection-mismatch');
    else {
      const driverIds = drivers.map((d: unknown) =>
        typeof d === 'object' && d !== null
          ? ownDataProperty(d, 'id')?.value
          : undefined,
      );
      if (
        driverIds.length !== resolved.length ||
        driverIds.some((id, i) => id !== resolvedIds[i]) ||
        resolvedIds.length !== resolved.length
      )
        problems.add('projection-mismatch');
    }

    const entries = ownDataProperty(payload, 'driverEntries')?.value;
    if (!Array.isArray(entries) || entries.length !== 0)
      problems.add('driver-entries');

    if (
      recomputedDigest === null ||
      inventory.projectionDigest !== recomputedDigest
    )
      problems.add('projection-digest');
  } catch {
    return ['shape'];
  }
  return driverInventoryProblems.filter((p) => problems.has(p));
}
