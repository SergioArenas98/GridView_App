/**
 * Turns decoded Jolpica circuit rows into the normalized season-circuits
 * resource.
 *
 * This is the **identity boundary**. Every canonical identifier, name and
 * fact emitted here comes from the curated mapping registry and the curated
 * circuit registry behind it; none is derived, minted, folded, trimmed or
 * guessed from a provider value (ADR 0022 D2, D4, D5).
 *
 * **Membership is exactly the provider's rows, each resolved, or nothing.**
 * An unresolved `circuitId` fails the **whole** resource and no row is ever
 * dropped from an otherwise accepted one (ADR 0022 D10). The resource is not
 * filtered against the calendar and its size is not compared with the number
 * of races: each coordinated resource is fetched and normalized independently
 * (ADR 0023 D3), and whether the calendar's circuits are all present is the
 * season preflight's `event-circuit` relation, not this adapter's. So the
 * recorded 24-circuits-for-23-races observation (Provider Evaluation §8.4, gap
 * M8) needs no rule of its own here: an extra row that is curated is carried,
 * and one that is not fails the resource as `mapping-failure` until a reviewed
 * mapping exists for it.
 */

import type { Circuit } from '../../contract/types';
import type {
  ProviderMappingFailure,
  ProviderMappingRegistry,
} from '../mappings';
import { maxReportedMappingFailures } from './calendar-normalizer';
import type { DecodedCircuit } from './circuits-payload';
import type { CuratedCircuits } from './curated-circuits';

/** Why a resolved resource still could not be normalized. Closed, log-safe. */
export type CircuitsNormalizationProblem =
  /**
   * Two distinct provider identities resolved to one canonical circuit.
   *
   * ADR 0022 D9 allows several curated aliases for one identity, but one
   * normalized collection holding the same circuit twice is a contradictory
   * resource with a duplicate primary key, not two facts to merge.
   */
  | 'duplicate-canonical-circuit'
  /**
   * An identity resolved, but the curated registry holds no content for it.
   * Unreachable with the committed content, whose mapping targets are checked
   * against that very registry; kept total for injected registries.
   */
  | 'curated-circuit-missing';

export type CircuitsNormalization =
  | { readonly ok: true; readonly circuits: readonly Circuit[] }
  | {
      readonly ok: false;
      readonly kind: 'mapping';
      readonly failures: readonly ProviderMappingFailure[];
    }
  | {
      readonly ok: false;
      readonly kind: 'contradiction';
      readonly problem: CircuitsNormalizationProblem;
    };

/**
 * Resolves and normalizes one complete season-circuits resource.
 *
 * Every row is attempted even after the first failure, so an operator sees the
 * bounded set of identities to curate rather than one at a time - but no
 * partial payload is ever produced.
 */
export function normalizeSeasonCircuits(
  rows: readonly DecodedCircuit[],
  season: number,
  registry: ProviderMappingRegistry,
  curated: CuratedCircuits,
): CircuitsNormalization {
  const resolvedIds: string[] = [];
  const failures: ProviderMappingFailure[] = [];

  for (const row of rows) {
    const resolution = registry.resolve({
      season,
      source: 'jolpica',
      entity: 'circuit',
      providerField: 'circuitId',
      providerValue: row.circuitId,
    });
    if (resolution.outcome === 'unresolved') {
      if (failures.length < maxReportedMappingFailures) {
        failures.push(resolution.failure);
      }
      continue;
    }
    resolvedIds.push(resolution.gridviewId);
  }

  if (failures.length > 0) return { ok: false, kind: 'mapping', failures };

  const circuits: Circuit[] = [];
  const seen = new Set<string>();
  for (const id of resolvedIds) {
    if (seen.has(id)) {
      return {
        ok: false,
        kind: 'contradiction',
        problem: 'duplicate-canonical-circuit',
      };
    }
    seen.add(id);
    const circuit = curated.get(id);
    if (circuit === null) {
      return {
        ok: false,
        kind: 'contradiction',
        problem: 'curated-circuit-missing',
      };
    }
    // Media is curated content owned by the media pipeline, and the only
    // circuit media committed today is mock media. The calendar emits
    // `GrandPrix.media: null` on the same reasoning.
    circuits.push({ ...circuit, media: null });
  }

  return { ok: true, circuits };
}
