/**
 * The D14/D15 publication guard: one pure derivation of a release's classified
 * rounds and participation facts, and the containment comparison between an
 * authoritative predecessor and a candidate
 * ([ADR 0026](../../../../../docs/adr/0026-season-participation-semantics-and-derivation.md)
 * D14, D15;
 * [ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D4).
 *
 * The same function derives both sides, so a candidate and its predecessor can
 * never be read by different rules. Only `grand-prix:{round}:results`
 * documents are inputs. Spans, `hasResults`, standings and the drivers
 * collection are not: spans cannot reconstruct facts, and nothing else carries
 * them.
 *
 * The guard is **in memory only**. It is never persisted, never sent to the
 * sequencer and never copied into a candidate. Its durable anchor is the
 * existing per-document `snapshotRevision` the sequencer already holds for the
 * active release, which `prepare` compares inside its own transaction (D16).
 *
 * Nothing here may reach a log: a derivation reports only `valid` or
 * `invalid`, and a comparison only a closed reason. No driver, constructor,
 * round list or tuple ever leaves this module inside a diagnostic.
 */

import { isClassifiedResult } from '../../contract/participation';
import { validateRaceResult } from '../../contract/normalized';
import type { RaceResult } from '../../contract/types';
import type { StoredSnapshot } from '../../storage/types';
import { compareUtf8 } from '../canonical/ordering';

/** The highest round a guard admits. Jolpica's calendar port refuses more. */
export const maximumGuardRound = 100;

/** The most result rows one round's document may carry. */
export const maximumGuardRowsPerRound = 100;

/**
 * Every results document name, whatever its round spelling. Selection is
 * deliberately broad so a malformed round - a leading zero, zero, or above
 * {@link maximumGuardRound} - is **selected and then refused**, never skipped.
 * The sequencer selects its committed rows by this same predicate.
 */
const raceResultsDocumentPattern = /^grand-prix:\d+:results$/;

/** Whether a document name is a `grand-prix:{round}:results` document. */
export function isRaceResultsDocumentName(name: string): boolean {
  return raceResultsDocumentPattern.test(name);
}

/**
 * The round a results document name encodes, or `null` when its spelling is
 * not the canonical decimal of a round in `1..maximumGuardRound`.
 */
export function roundOfResultsDocument(name: string): number | null {
  if (!isRaceResultsDocumentName(name)) return null;
  const digits = name.slice('grand-prix:'.length, -':results'.length);
  const round = Number(digits);
  if (!Number.isSafeInteger(round)) return null;
  if (round < 1 || round > maximumGuardRound) return null;
  // A leading zero spells a round no generator produces; it is inconsistent,
  // not an alias.
  return `grand-prix:${round}:results` === name ? round : null;
}

/** One participation fact: `(round, canonicalDriverId, canonicalConstructorId)`. */
export type GuardFact = readonly [
  round: number,
  driverId: string,
  constructorId: string,
];

/**
 * A release's canonical guard sets.
 *
 * - `classifiedRounds` - strictly ascending, unique, each in
 *   `1..maximumGuardRound`.
 * - `facts` - sorted by round, then driver ID by `compareUtf8`; unique on
 *   `(round, driverId)`.
 *
 * Only canonical GridView slugs from normalized `RaceResultEntry` rows appear
 * here, so no provider identifier can. Position, points, finish status, entry
 * order and fastest lap are not guard facts.
 */
export interface ParticipationGuard {
  readonly season: number;
  readonly classifiedRounds: readonly number[];
  readonly facts: readonly GuardFact[];
}

export type GuardDerivation =
  | { readonly kind: 'valid'; readonly guard: ParticipationGuard }
  | { readonly kind: 'invalid' };

const invalid: GuardDerivation = { kind: 'invalid' };

/**
 * Derives the guard sets from a release's documents.
 *
 * `invalid` - never an empty guard - when any results document is malformed:
 * a round that is out of range or disagrees with its name or season, a body
 * that fails the deep `RaceResult` validation, more than
 * {@link maximumGuardRowsPerRound} rows, a repeated document name, or a
 * repeated `(round, driver)` in a classified document even with the same
 * constructor (ADR 0026 D5). A well-formed document that is not a classified
 * race contributes nothing.
 */
export function deriveParticipationGuard(
  season: number,
  documents: readonly StoredSnapshot[],
): GuardDerivation {
  const seenDocuments = new Set<string>();
  const rounds: number[] = [];
  const facts: GuardFact[] = [];
  for (const document of documents) {
    const name = String(document.documentName);
    if (!isRaceResultsDocumentName(name)) continue;
    if (seenDocuments.has(name)) return invalid;
    seenDocuments.add(name);

    const round = roundOfResultsDocument(name);
    if (round === null) return invalid;
    if (validateRaceResult(document.data, 'data').length > 0) return invalid;
    const result = document.data as RaceResult;
    if (result.season !== season || result.round !== round) return invalid;
    if (result.entries.length > maximumGuardRowsPerRound) return invalid;
    if (result.sessionType !== 'race' || !isClassifiedResult(result.status)) {
      continue;
    }

    const drivers = new Set<string>();
    for (const entry of result.entries) {
      if (drivers.has(entry.driverId)) return invalid;
      drivers.add(entry.driverId);
      facts.push([round, entry.driverId, entry.constructorId]);
    }
    rounds.push(round);
  }

  rounds.sort((left, right) => left - right);
  facts.sort(
    (left, right) => left[0] - right[0] || compareUtf8(left[1], right[1]),
  );
  return {
    kind: 'valid',
    guard: { season, classifiedRounds: rounds, facts },
  };
}

/** The closed D14/D15 regression reasons, in their evaluation precedence. */
export const guardRegressionReasons = [
  'guard-round-coverage-regression',
  'guard-participation-fact-removed',
  'guard-constructor-replaced',
] as const;

export type GuardRegressionReason = (typeof guardRegressionReasons)[number];

export type GuardComparison =
  | { readonly kind: 'contained' }
  | { readonly kind: 'regression'; readonly reason: GuardRegressionReason };

/**
 * Whether a candidate preserves everything its predecessor published.
 *
 * 1. **D14** - every predecessor classified round is classified in the
 *    candidate, else `guard-round-coverage-regression`.
 * 2. **D15** - every predecessor `(round, driver, constructor)` fact has a
 *    candidate fact for the same `(round, driver)`, else
 *    `guard-participation-fact-removed`; and that fact names the same
 *    constructor, else `guard-constructor-replaced`.
 *
 * Additional rounds and facts are allowed. Neither input is mutated, and
 * nothing from the predecessor is returned.
 */
export function compareParticipationGuards(
  predecessor: ParticipationGuard,
  candidate: ParticipationGuard,
): GuardComparison {
  const candidateRounds = new Set(candidate.classifiedRounds);
  for (const round of predecessor.classifiedRounds) {
    if (!candidateRounds.has(round)) {
      return { kind: 'regression', reason: 'guard-round-coverage-regression' };
    }
  }

  const candidateConstructors = new Map<string, string>();
  for (const [round, driverId, constructorId] of candidate.facts) {
    candidateConstructors.set(factKey(round, driverId), constructorId);
  }
  let replaced = false;
  for (const [round, driverId, constructorId] of predecessor.facts) {
    const current = candidateConstructors.get(factKey(round, driverId));
    if (current === undefined) {
      return { kind: 'regression', reason: 'guard-participation-fact-removed' };
    }
    if (current !== constructorId) replaced = true;
  }
  return replaced
    ? { kind: 'regression', reason: 'guard-constructor-replaced' }
    : { kind: 'contained' };
}

function factKey(round: number, driverId: string): string {
  // A slug cannot contain a space, so this key is unambiguous.
  return `${round} ${driverId}`;
}
