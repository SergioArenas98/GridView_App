/**
 * Source roles, source capability and the fail-closed provisional gate.
 *
 * **This module is the only place that knows both sources.** An adapter is an
 * independent port: it never imports, calls, inspects or coordinates with the
 * other one, and it never decides which source wins. Role and capability are
 * owned here, above the adapters, exactly as
 * GridView_Provider_Evaluation.md §10.10 requires.
 *
 * Nothing here unlocks anything. `PROVIDER_MODE` still admits exactly
 * `mock | none`, no adapter for either source exists, and the provisional
 * source stays locked because no justified maximum-session-duration bound has
 * been recorded (ADR 0020 §5, rules D5.1-D5.8).
 */

import { realProviderSourceIds } from '../http/reservation-engine';
import type { RealProviderSourceId } from '../http/reservation-engine';
import type { CoordinatedResourceKind } from './resource';

/**
 * The sources the coordinator drives.
 *
 * Exactly the real sources. `mock` is deliberately **not** a coordinated
 * source: it is a whole-season deterministic test double with a `testOnly`
 * quota policy, it owns no role in the reconciled/provisional model, and
 * giving it one would let a test fixture be presented as source policy.
 * The array is pinned to `realProviderSourceIds` so the two can never drift.
 */
export const coordinatedSourceIds = realProviderSourceIds;

export type CoordinatedSourceId = RealProviderSourceId;

export function isCoordinatedSourceId(
  value: unknown,
): value is CoordinatedSourceId {
  return (
    typeof value === 'string' &&
    (coordinatedSourceIds as readonly string[]).includes(value)
  );
}

/**
 * What a source's data *means*, which is what selection is decided on.
 *
 * - `reconciled` - complete, corrected, authoritative. Jolpica.
 * - `provisional` - fast, incomplete, correctable. OpenF1.
 *
 * A role is a property of the **source**, never of a payload, a timestamp, a
 * response size or an arrival order.
 */
export const sourceRoles = ['reconciled', 'provisional'] as const;
export type SourceRole = (typeof sourceRoles)[number];

/**
 * Selection precedence. Lower wins.
 *
 * This single table is the whole of the "which source wins" decision, and it
 * is why a provisional payload can never overwrite a reconciled one: not
 * because of an ordering accident, but because `reconciled` is declared to
 * outrank `provisional` and nothing else is consulted.
 */
const rolePrecedence: Record<SourceRole, number> = {
  reconciled: 0,
  provisional: 1,
};

export function rolePrecedenceOf(role: SourceRole): number {
  return rolePrecedence[role];
}

interface SourcePolicy {
  readonly sourceId: CoordinatedSourceId;
  readonly role: SourceRole;
  /**
   * The resources this source may be asked for at all. A request outside this
   * set is skipped with a bounded typed reason **before** the adapter is
   * called, so an unsupported request can never reserve capacity or reach
   * transport.
   */
  readonly capabilities: ReadonlySet<CoordinatedResourceKind>;
  /**
   * `true` when the source may be selected and driven at all.
   *
   * `false` is a **policy lock**, not a runtime failure: the provisional
   * source is locked closed until a justified session-end bound is recorded,
   * and the lock is checked before capability, reservation, transport and
   * accounting.
   */
  readonly unlockedByPolicy: boolean;
}

/**
 * Jolpica: complete and reconciled.
 *
 * Covers complete season metadata, the calendar and session schedule,
 * participants, circuits, historical depth, final classifications and
 * standings (GridView_Provider_Evaluation.md §7, §10.2). Selected and
 * unlocked in policy - and still without an adapter in this phase.
 */
const reconciledPolicy: SourcePolicy = {
  sourceId: 'jolpica',
  role: 'reconciled',
  capabilities: new Set<CoordinatedResourceKind>([
    'season-calendar',
    'event-schedule',
    'season-participants',
    'season-circuits',
    'session-classification',
    'driver-standings',
    'constructor-standings',
  ]),
  unlockedByPolicy: true,
};

/**
 * OpenF1: provisional, and eligible for almost nothing.
 *
 * Exactly the documented post-session result and championship resources
 * (GridView_Provider_Evaluation.md §10.2, §11.1). There is deliberately **no**
 * capability for telemetry, live timing, media, a baseline metadata refresh or
 * a health check: ADR 0020 D5.2 admits no exception at all, and an ungated
 * schedule or discovery lookup could itself fire inside the live window.
 */
const provisionalPolicy: SourcePolicy = {
  sourceId: 'openf1',
  role: 'provisional',
  capabilities: new Set<CoordinatedResourceKind>([
    'session-classification',
    'driver-standings',
    'constructor-standings',
  ]),
  unlockedByPolicy: false,
};

const policies: Record<CoordinatedSourceId, SourcePolicy> = {
  jolpica: reconciledPolicy,
  openf1: provisionalPolicy,
};

export function sourceRoleOf(sourceId: CoordinatedSourceId): SourceRole {
  return policies[sourceId].role;
}

export function sourceSupportsResource(
  sourceId: CoordinatedSourceId,
  kind: CoordinatedResourceKind,
): boolean {
  return policies[sourceId].capabilities.has(kind);
}

export function sourceUnlockedByPolicy(sourceId: CoordinatedSourceId): boolean {
  return policies[sourceId].unlockedByPolicy;
}

/**
 * The already-decided eligibility input for the provisional source.
 *
 * The live-window bound is **not calculated here**. ADR 0020 D5.1-D5.8 require
 * a justified upper bound on the *actual* end of each applicable session type,
 * supported by an official source and an access date; deriving one from a
 * scheduled start or end time is explicitly forbidden. So this module consumes
 * a decision, it does not make one.
 */
export interface ProvisionalSessionEndBound {
  readonly kind: 'session-end-bound-recorded';
  /** Justified upper bound on how long after the scheduled start a session may run. */
  readonly boundSeconds: number;
}

export type ProvisionalEligibility =
  | { readonly eligible: true; readonly boundSeconds: number }
  | { readonly eligible: false; readonly reason: 'bound-unavailable' };

const BOUND_MAX_SECONDS = 24 * 60 * 60;

/**
 * **No bound is recorded.**
 *
 * This constant exists so the absence is a reviewed, greppable fact rather
 * than a missing wiring nobody noticed. Recording a real value requires an
 * official source and an access date, is Phase 9B adapter work, and is not
 * attempted here.
 */
export const recordedProvisionalSessionEndBound: ProvisionalSessionEndBound | null =
  null;

/**
 * Decides provisional eligibility from an untrusted value.
 *
 * Fails closed in every direction that is not an exact, complete, in-range
 * recorded bound: `undefined`, `null`, a bare number, a wrong `kind`, a
 * non-integer, zero, a negative, an absurd value or an object carrying an
 * extra property all mean **locked**. Absence and malformation are never read
 * as permission.
 */
export function decideProvisionalEligibility(
  value: unknown,
): ProvisionalEligibility {
  const locked = { eligible: false, reason: 'bound-unavailable' } as const;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return locked;
  }
  const own = Object.keys(value);
  if (own.length !== 2) return locked;
  const record = value as Record<string, unknown>;
  if (record.kind !== 'session-end-bound-recorded') return locked;
  const bound = record.boundSeconds;
  if (
    typeof bound !== 'number' ||
    !Number.isSafeInteger(bound) ||
    bound <= 0 ||
    bound > BOUND_MAX_SECONDS
  ) {
    return locked;
  }
  return { eligible: true, boundSeconds: bound };
}

/**
 * Whether a source may be driven at all for this run.
 *
 * A policy-unlocked source is always selectable. A policy-locked source is
 * selectable only when an explicit recorded bound was supplied and decoded
 * successfully - which no production wiring does, because no bound exists.
 */
export function sourceSelectable(
  sourceId: CoordinatedSourceId,
  eligibility: ProvisionalEligibility,
): boolean {
  return sourceUnlockedByPolicy(sourceId) || eligibility.eligible;
}
