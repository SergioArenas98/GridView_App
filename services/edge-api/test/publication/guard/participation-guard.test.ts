/**
 * The D14/D15 guard as pure functions (ADR 0026 D14, D15): one derivation for
 * a candidate and its predecessor alike, and the containment comparison.
 *
 * Nothing here touches storage or the sequencer. The D16 binding and the
 * service integration are covered in `test/publication/sequencer` and
 * `test/publication/sequenced/publication-guard.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import {
  compareParticipationGuards,
  deriveParticipationGuard,
  isRaceResultsDocumentName,
  maximumGuardRound,
  maximumGuardRowsPerRound,
  roundOfResultsDocument,
  type ParticipationGuard,
} from '../../../src/publication/guard/participation-guard';
import type { RaceResult } from '../../../src/contract/types';
import { MockFormulaOneProvider } from '../../../src/providers/mock/mock-provider';
import { FixedClock } from '../../../src/runtime/clock';
import { generateSnapshotSet } from '../../../src/snapshots/generator';
import type { StoredSnapshot } from '../../../src/storage/types';
import {
  ROUND_ONE,
  ROUND_TWO,
  SEASON,
  calendarDocument,
  classifiedRound,
  entry,
  raceResult,
  stored,
  unavailableRound,
} from './support';

function guardOf(documents: readonly StoredSnapshot[]): ParticipationGuard {
  const derived = deriveParticipationGuard(SEASON, documents);
  if (derived.kind !== 'valid') throw new Error('expected a valid guard');
  return derived.guard;
}

function withResult(
  document: StoredSnapshot,
  change: (result: RaceResult) => RaceResult,
): StoredSnapshot {
  return { ...document, data: change(document.data as RaceResult) };
}

/** Recursively freezes a value, so any mutation of it throws. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

describe('results document names', () => {
  it('selects every results document, however its round is spelled', () => {
    expect(isRaceResultsDocumentName('grand-prix:1:results')).toBe(true);
    expect(isRaceResultsDocumentName('grand-prix:01:results')).toBe(true);
    expect(isRaceResultsDocumentName('grand-prix:0:results')).toBe(true);
    expect(isRaceResultsDocumentName('grand-prix:1')).toBe(false);
    expect(isRaceResultsDocumentName('standings:drivers')).toBe(false);
    expect(isRaceResultsDocumentName('grand-prix:x:results')).toBe(false);
  });

  it('reads only a canonical round inside the admitted range', () => {
    expect(roundOfResultsDocument('grand-prix:1:results')).toBe(1);
    expect(
      roundOfResultsDocument(`grand-prix:${maximumGuardRound}:results`),
    ).toBe(maximumGuardRound);
    expect(roundOfResultsDocument('grand-prix:0:results')).toBeNull();
    expect(roundOfResultsDocument('grand-prix:01:results')).toBeNull();
    expect(
      roundOfResultsDocument(`grand-prix:${maximumGuardRound + 1}:results`),
    ).toBeNull();
    expect(
      roundOfResultsDocument('grand-prix:99999999999999999999:results'),
    ).toBeNull();
  });
});

describe('deriving the canonical guard', () => {
  it('collects classified rounds and facts in canonical order, from results documents only', () => {
    const guard = guardOf([
      calendarDocument(),
      classifiedRound(2, [...ROUND_TWO].reverse()),
      unavailableRound(3),
      classifiedRound(1, [...ROUND_ONE].reverse(), 'provisional'),
    ]);
    expect(guard).toEqual({
      season: SEASON,
      classifiedRounds: [1, 2],
      facts: [
        [1, 'lando-norris', 'mclaren'],
        [1, 'max-verstappen', 'red-bull'],
        [1, 'oscar-piastri', 'mclaren'],
        [2, 'charles-leclerc', 'ferrari'],
        [2, 'lewis-hamilton', 'ferrari'],
      ],
    });
  });

  it('derives an empty guard for a release with no classified round', () => {
    expect(guardOf([calendarDocument(), unavailableRound(1)])).toEqual({
      season: SEASON,
      classifiedRounds: [],
      facts: [],
    });
  });

  it('ignores a well-formed result that is not a classified race', () => {
    const sprint = withResult(classifiedRound(1, ROUND_ONE), (result) => ({
      ...result,
      sessionType: 'sprint',
    }));
    const unknown = withResult(classifiedRound(2, ROUND_TWO), (result) => ({
      ...result,
      status: 'unknown',
    }));
    expect(guardOf([sprint, unknown]).facts).toEqual([]);
  });

  it('never carries a position, a points value, a status or a fastest lap', () => {
    const guard = guardOf([classifiedRound(1, ROUND_ONE)]);
    for (const fact of guard.facts) expect(fact).toHaveLength(3);
    expect(Object.keys(guard).sort()).toEqual([
      'classifiedRounds',
      'facts',
      'season',
    ]);
  });

  it('does not mutate its input documents', () => {
    const documents = deepFreeze([
      classifiedRound(2, ROUND_TWO),
      classifiedRound(1, ROUND_ONE),
    ]);
    expect(() => deriveParticipationGuard(SEASON, documents)).not.toThrow();
  });
});

describe('deriving fails closed, never as an empty guard', () => {
  const cases: Array<[string, readonly StoredSnapshot[]]> = [
    [
      'a duplicate (round, driver) with the same constructor',
      [
        classifiedRound(1, [
          ['max-verstappen', 'red-bull'],
          ['max-verstappen', 'red-bull'],
        ]),
      ],
    ],
    [
      'a duplicate (round, driver) with a different constructor',
      [
        classifiedRound(1, [
          ['max-verstappen', 'red-bull'],
          ['max-verstappen', 'racing-bulls'],
        ]),
      ],
    ],
    [
      'a repeated results document',
      [classifiedRound(1, ROUND_ONE), classifiedRound(1, ROUND_ONE)],
    ],
    [
      'a round of zero',
      [stored('grand-prix:0:results', raceResult(0, 'final', []))],
    ],
    [
      'a round above the maximum',
      [
        stored(
          `grand-prix:${maximumGuardRound + 1}:results`,
          raceResult(maximumGuardRound + 1, 'final', [
            entry('max-verstappen', 'red-bull', 1),
          ]),
        ),
      ],
    ],
    [
      'a leading-zero round spelling',
      [stored('grand-prix:01:results', raceResult(1, 'final', []))],
    ],
    [
      'a body round that disagrees with its name',
      [stored('grand-prix:1:results', raceResult(2, 'final', []))],
    ],
    [
      'a body season that disagrees with the operation',
      [
        stored(
          'grand-prix:1:results',
          raceResult(1, 'final', [], { season: SEASON - 1 }),
        ),
      ],
    ],
    [
      'a malformed body',
      [stored('grand-prix:1:results', { round: 1, status: 'final' })],
    ],
    [
      'an unknown result status',
      [
        withResult(classifiedRound(1, ROUND_ONE), (result) => ({
          ...result,
          status: 'classified' as never,
        })),
      ],
    ],
    [
      'a non-slug driver identity',
      [classifiedRound(1, [['Max Verstappen', 'red-bull']])],
    ],
    [
      'more rows than one round admits',
      [
        classifiedRound(
          1,
          Array.from(
            { length: maximumGuardRowsPerRound + 1 },
            (_, index) => [`driver-${index}`, 'red-bull'] as const,
          ),
        ),
      ],
    ],
  ];

  it.each(cases)('refuses %s', (_label, documents) => {
    expect(deriveParticipationGuard(SEASON, documents)).toEqual({
      kind: 'invalid',
    });
  });

  it('admits exactly the maximum rows and the maximum round', () => {
    const rows = Array.from(
      { length: maximumGuardRowsPerRound },
      (_, index) => [`driver-${index}`, 'red-bull'] as const,
    );
    const guard = guardOf([classifiedRound(maximumGuardRound, rows)]);
    expect(guard.classifiedRounds).toEqual([maximumGuardRound]);
    expect(guard.facts).toHaveLength(maximumGuardRowsPerRound);
  });
});

describe('D14 and D15 containment', () => {
  const predecessor = guardOf([
    classifiedRound(1, ROUND_ONE),
    classifiedRound(2, ROUND_TWO),
  ]);

  it('passes a first classified publication over a zero-classified predecessor', () => {
    const empty = guardOf([unavailableRound(1)]);
    expect(
      compareParticipationGuards(
        empty,
        guardOf([classifiedRound(1, ROUND_ONE)]),
      ),
    ).toEqual({ kind: 'contained' });
  });

  it('passes an exactly equivalent candidate', () => {
    expect(compareParticipationGuards(predecessor, predecessor)).toEqual({
      kind: 'contained',
    });
  });

  it('passes added rounds and added facts', () => {
    const wider = guardOf([
      classifiedRound(1, [...ROUND_ONE, ['charles-leclerc', 'ferrari']]),
      classifiedRound(2, ROUND_TWO),
      classifiedRound(3, ROUND_ONE),
    ]);
    expect(compareParticipationGuards(predecessor, wider)).toEqual({
      kind: 'contained',
    });
  });

  it('passes changed positions, points, statuses, order and fastest lap', () => {
    const reshuffled = withResult(
      classifiedRound(1, [...ROUND_ONE].reverse(), 'provisional'),
      (result) => ({
        ...result,
        entries: result.entries.map((row, index) => ({
          ...row,
          position: null,
          points: 100 + index,
          status: index === 0 ? 'dnf' : 'lapped',
          lapsBehind: index,
          fastestLap: index === 1,
        })),
        fastestLap: {
          driverId: 'oscar-piastri',
          timeMillis: 80000,
          lap: 12,
        },
      }),
    );
    const candidate = guardOf([reshuffled, classifiedRound(2, ROUND_TWO)]);
    expect(compareParticipationGuards(predecessor, candidate)).toEqual({
      kind: 'contained',
    });
  });

  it('refuses a previously classified round that is now unavailable', () => {
    const candidate = guardOf([
      classifiedRound(1, ROUND_ONE),
      unavailableRound(2),
    ]);
    expect(compareParticipationGuards(predecessor, candidate)).toEqual({
      kind: 'regression',
      reason: 'guard-round-coverage-regression',
    });
  });

  it('refuses a previously classified round whose document is absent', () => {
    const candidate = guardOf([classifiedRound(1, ROUND_ONE)]);
    expect(compareParticipationGuards(predecessor, candidate)).toEqual({
      kind: 'regression',
      reason: 'guard-round-coverage-regression',
    });
  });

  it('refuses a fact missing from a round that is still classified', () => {
    const candidate = guardOf([
      classifiedRound(1, ROUND_ONE.slice(0, 2)),
      classifiedRound(2, ROUND_TWO),
    ]);
    expect(compareParticipationGuards(predecessor, candidate)).toEqual({
      kind: 'regression',
      reason: 'guard-participation-fact-removed',
    });
  });

  it('refuses a published fact whose constructor was replaced', () => {
    const candidate = guardOf([
      classifiedRound(1, ROUND_ONE),
      classifiedRound(2, [
        ['charles-leclerc', 'ferrari'],
        ['lewis-hamilton', 'mclaren'],
      ]),
    ]);
    expect(compareParticipationGuards(predecessor, candidate)).toEqual({
      kind: 'regression',
      reason: 'guard-constructor-replaced',
    });
  });

  it('reports coverage before facts, and a removal before a replacement', () => {
    const everythingWrong = guardOf([
      classifiedRound(1, [
        ['max-verstappen', 'ferrari'],
        ['lando-norris', 'mclaren'],
      ]),
    ]);
    expect(compareParticipationGuards(predecessor, everythingWrong)).toEqual({
      kind: 'regression',
      reason: 'guard-round-coverage-regression',
    });
    const removalAndReplacement = guardOf([
      classifiedRound(1, [
        ['max-verstappen', 'ferrari'],
        ['lando-norris', 'mclaren'],
      ]),
      classifiedRound(2, ROUND_TWO),
    ]);
    expect(
      compareParticipationGuards(predecessor, removalAndReplacement),
    ).toEqual({
      kind: 'regression',
      reason: 'guard-participation-fact-removed',
    });
  });

  it('never mutates or returns either side', () => {
    const frozenPredecessor = deepFreeze(structuredClone(predecessor));
    const candidate = deepFreeze(
      guardOf([classifiedRound(1, ROUND_ONE), classifiedRound(2, ROUND_TWO)]),
    );
    const comparison = compareParticipationGuards(frozenPredecessor, candidate);
    expect(comparison).toEqual({ kind: 'contained' });
    expect(Object.keys(comparison)).toEqual(['kind']);
  });
});

describe('the current mock generator as a staging proxy', () => {
  it('derives a valid, non-empty guard: one classified round and five facts', async () => {
    const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
    const source = await new MockFormulaOneProvider({
      clock,
    }).fetchSeasonSource(SEASON, [
      'season-calendar',
      'event-schedule',
      'profiles',
      'standings',
      'results',
      'home-rebuild',
    ]);
    const set = generateSnapshotSet(
      source,
      clock.now().toISOString(),
      'v-mock',
    );
    // The mock's only classified race is the Italian Grand Prix, round 12.
    // Every later candidate for a season published from it must keep these
    // five facts (curator decision C2).
    expect(guardOf(set.documents)).toEqual({
      season: SEASON,
      classifiedRounds: [12],
      facts: [
        [12, 'charles-leclerc', 'ferrari'],
        [12, 'lando-norris', 'mclaren'],
        [12, 'lewis-hamilton', 'ferrari'],
        [12, 'max-verstappen', 'red-bull'],
        [12, 'oscar-piastri', 'mclaren'],
      ],
    });
  });
});
