/** Synchronous run-local admission only. No drain, persistence or background task. */
import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import { isSealedObservation } from './model';
import type { IdentityObservation } from './model';

export interface CollectorLimits {
  readonly maxObservations?: number;
  readonly maxBytes?: number;
}
export type CollectionOutcome =
  'collected' | 'duplicate' | 'capacity' | 'disabled' | 'invalid' | 'conflict';
export interface CollectorStats {
  readonly collected: number;
  readonly bytes: number;
  readonly duplicates: number;
  readonly dropped: number;
  readonly conflicts: number;
}
export interface IdentityObservationCollector {
  collect(observation: IdentityObservation): CollectionOutcome;
  snapshot(): readonly IdentityObservation[];
  stats(): CollectorStats;
}
export const inertIdentityObservationCollector: IdentityObservationCollector =
  Object.freeze({
    collect: () => 'disabled' as const,
    snapshot: () => Object.freeze([]),
    stats: () => ({
      collected: 0,
      bytes: 0,
      duplicates: 0,
      dropped: 0,
      conflicts: 0,
    }),
  });
function limit(value: number | undefined, maximum: number): number {
  const n = value ?? maximum;
  if (!Number.isSafeInteger(n) || n < 1 || n > maximum)
    throw new Error('Invalid discovery collector limit.');
  return n;
}
export function createIdentityObservationCollector(
  limits: CollectorLimits = {},
): IdentityObservationCollector {
  const maxObservations = limit(limits.maxObservations, 2000);
  const maxBytes = limit(limits.maxBytes, 2 * 1024 * 1024);
  const retained = new Map<string, IdentityObservation>();
  let bytes = 0,
    duplicates = 0,
    dropped = 0,
    conflicts = 0;
  const increment = (n: number): number =>
    Math.min(Number.MAX_SAFE_INTEGER, n + 1);
  return Object.freeze({
    collect(observation: IdentityObservation): CollectionOutcome {
      // Accept only deeply frozen drafts minted by this module family.
      if (!isSealedObservation(observation)) return 'invalid';
      try {
        const text = canonicalJson(observation);
        const previous = retained.get(observation.observationId);
        if (previous !== undefined) {
          if (canonicalJson(previous) !== text) {
            conflicts = increment(conflicts);
            return 'conflict';
          }
          duplicates = increment(duplicates);
          return 'duplicate';
        }
        const length = utf8(text).byteLength;
        if (
          length > 8192 ||
          retained.size >= maxObservations ||
          bytes + length > maxBytes
        ) {
          dropped = increment(dropped);
          return 'capacity';
        }
        retained.set(observation.observationId, observation);
        bytes += length;
        return 'collected';
      } catch {
        return 'invalid';
      }
    },
    snapshot: () => Object.freeze([...retained.values()]),
    stats: () => ({
      collected: retained.size,
      bytes,
      duplicates,
      dropped,
      conflicts,
    }),
  });
}
