/**
 * A classification belongs to exactly one session of one event, and its
 * identity says so.
 *
 * `GridView_Domain_Model.md` §4.2 and §6.11 define a race result's identity as
 * `{grandPrixId}-{sessionType}-results`, so - like a session identity - it is
 * *derived from* its parent rather than merely stored beside it. The
 * coordination seam cannot catch a violation on its own: a
 * `session-classification` resource names a season, a round and a session type,
 * so `payloadMatchesResource` can check those three and has no event identity
 * to check the `id` against. Assembly then carries the result through verbatim.
 *
 * What that costs downstream is concrete. The Flutter database keys results by
 * this `id` while enforcing `UNIQUE(grandPrixId, sessionType)`, so a
 * classification published under an arbitrary unique id and a later corrected
 * one published under a different arbitrary id are two different primary keys
 * for one unique session - and the refresh transaction that tries to hold both
 * fails.
 *
 * The invariant this file pins:
 *
 * > Every published classification carries its own parent's canonical identity
 * > for its session type, built by the one shared constructor.
 *
 * It is deliberately **distinct from three neighbouring relations**:
 *
 * - `result-event` asks whether `grandPrixId` matches the event at that round.
 *   A result can name the right event and still carry a wrong `id`.
 * - `duplicate-identity` asks whether two payloads collide. Two results with
 *   two *different* arbitrary ids collide with nothing at all.
 * - `session-event` is about `calendar[].sessions[]`, a different collection
 *   with a different identity rule.
 *
 * Nothing here rewrites, coerces, repairs or drops an invalid result: a
 * mismatch withholds the whole assembled source before generation and
 * publication, exactly as every other broken relation does.
 */

import { describe, expect, it } from 'vitest';

import { classifiedSessionTypes } from '../../../src/providers/coordination/resource';
import { canonicalRaceResultId } from '../../../src/contract/identity';
import type { RaceResult } from '../../../src/contract/types';
import { CapturingLogger } from '../../../src/logging/logger';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  validateSeasonReferences,
  type CoordinatedResource,
  type CoordinationRun,
  type ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import {
  FIXED_NOW,
  FakePort,
  SEASON,
  attempt,
  completePort,
  metadataFor,
  publicationHarness,
  raceResource,
  rounds,
  seasonFixture,
  seasonResources,
} from './support';

/** A Grand Prix identity that appears nowhere in the curated calendar. */
const FOREIGN_EVENT = '2026-monaco-grand-prix';

/** A unique identifier that is not derived from anything. */
const OPAQUE_ID = 'result-8f2c1a90-4d33-4a1e-b0d2-2f1a77c9e514';

function firstClassified(source: ProviderSeasonSource): RaceResult {
  const result = source.results.find((candidate) =>
    source.calendar.some((event) => event.round === candidate.round),
  );
  if (result === undefined) throw new Error('fixture gap');
  return result;
}

/** The same season with one classification re-identified. */
function withResultId(
  source: ProviderSeasonSource,
  round: number,
  id: string,
): ProviderSeasonSource {
  return {
    ...source,
    results: source.results.map((result) =>
      result.round === round ? { ...result, id } : result,
    ),
  };
}

/**
 * A run whose `session-classification` for one round answers with a supplied
 * classification.
 *
 * Every other resource comes from the curated fixture through the ordinary
 * port, so the only thing under test is the classification.
 */
async function runWithClassification(
  source: ProviderSeasonSource,
  round: number,
  result: RaceResult,
  reverseOrder = false,
): Promise<CoordinationRun> {
  const complete = completePort('jolpica', source);
  let sequence = 0;
  const port = new FakePort('jolpica', (request) => {
    if (
      request.resource.kind !== 'session-classification' ||
      request.resource.round !== round
    ) {
      return complete.fetchResource(request);
    }
    sequence += 1;
    return {
      outcome: 'candidate',
      attempt: attempt(`jolpica-classification-${sequence}`),
      payload: { kind: 'session-classification', result },
    } as unknown as ProviderResourceOutcome;
  });

  const resources: CoordinatedResource[] = [
    ...seasonResources,
    ...rounds(source).map((entry) => raceResource(entry)),
  ];

  return new MultiSourceCoordinator({
    ports: [port],
    logger: new CapturingLogger(),
  }).coordinate({
    plan: {
      season: SEASON,
      resources: reverseOrder ? [...resources].reverse() : resources,
    },
  });
}

describe('the canonical race-result identity has one implementation', () => {
  it('builds the identity the domain model documents', () => {
    expect(canonicalRaceResultId('2026-belgian-grand-prix', 'race')).toBe(
      '2026-belgian-grand-prix-race-results',
    );
    expect(canonicalRaceResultId('2026-belgian-grand-prix', 'sprint')).toBe(
      '2026-belgian-grand-prix-sprint-results',
    );
  });

  it('hyphenates a multi-word session type exactly as session identities do', () => {
    expect(
      canonicalRaceResultId('2026-belgian-grand-prix', 'sprint_qualifying'),
    ).toBe('2026-belgian-grand-prix-sprint-qualifying-results');
  });

  it('is the identity the curated fixture already carries', async () => {
    const source = await seasonFixture();
    for (const result of source.results) {
      expect(result.id).toBe(
        canonicalRaceResultId(result.grandPrixId, result.sessionType),
      );
    }
  });
});

describe('a classification identity is bound to its own parent session', () => {
  it('accepts the curated season unchanged', async () => {
    const source = await seasonFixture();
    expect(validateSeasonReferences(source)).toEqual([]);
  });

  it('rejects an arbitrary unique id under an otherwise correct result', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);

    const relations = validateSeasonReferences(
      withResultId(source, victim.round, OPAQUE_ID),
    );

    expect(relations).toContain('result-identity');
    // The season, round, parent event and session type are all correct, and
    // the id collides with nothing.
    expect(relations).not.toContain('result-event');
    expect(relations).not.toContain('duplicate-identity');
    expect(relations).not.toContain('session-event');
  });

  it('rejects the correct parent carrying the wrong result suffix', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);

    for (const id of [
      `${victim.grandPrixId}-race`,
      `${victim.grandPrixId}-results`,
      `${victim.grandPrixId}-race-result`,
      `${victim.grandPrixId}-race-results-2`,
      `${victim.grandPrixId}-qualifying-results`,
      `${victim.grandPrixId}-sprint-results`,
    ]) {
      const relations = validateSeasonReferences(
        withResultId(source, victim.round, id),
      );
      expect(relations, id).toContain('result-identity');
      expect(relations, id).not.toContain('result-event');
    }
  });

  it('rejects a canonical-looking id built for a different Grand Prix', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);
    const donor = source.calendar.find(
      (event) => event.id !== victim.grandPrixId,
    );
    if (donor === undefined) throw new Error('fixture gap');

    for (const parent of [FOREIGN_EVENT, donor.id]) {
      const relations = validateSeasonReferences(
        withResultId(
          source,
          victim.round,
          canonicalRaceResultId(parent, 'race'),
        ),
      );
      // `grandPrixId` still names the right event, so the existing
      // classification-to-event relation cannot see this.
      expect(relations, parent).toContain('result-identity');
      expect(relations, parent).not.toContain('result-event');
    }
  });

  it('rejects near misses that differ only by case, separator or padding', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);
    const canonical = canonicalRaceResultId(victim.grandPrixId, 'race');

    for (const id of [
      canonical.toUpperCase(),
      `${canonical} `,
      ` ${canonical}`,
      canonical.replaceAll('-', '_'),
      `${victim.grandPrixId}_race_results`,
      `${canonical}-`,
      `-${canonical}`,
      canonical.replace('-race-results', '--race-results'),
      canonical.replace('-results', '-Results'),
    ]) {
      const relations = validateSeasonReferences(
        withResultId(source, victim.round, id),
      );
      expect(relations, id).toContain('result-identity');
    }
  });

  it('accepts every supported result session type under its own parent', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);

    for (const sessionType of classifiedSessionTypes) {
      const relations = validateSeasonReferences({
        ...source,
        results: source.results.map((result) =>
          result.round === victim.round
            ? {
                ...result,
                sessionType,
                id: canonicalRaceResultId(result.grandPrixId, sessionType),
              }
            : result,
        ),
      });
      expect(relations, sessionType).not.toContain('result-identity');
    }
  });

  it('keeps duplicate detection working independently of parent derivation', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);

    // Two canonical copies of one classification: duplicate, not mis-derived.
    const duplicated = validateSeasonReferences({
      ...source,
      results: [...source.results, { ...victim }],
    });
    expect(duplicated).toContain('duplicate-identity');
    expect(duplicated).not.toContain('result-identity');

    // Two *different* arbitrary ids collide with nothing and are both wrong.
    const distinct = validateSeasonReferences({
      ...source,
      results: source.results.map((result, index) => ({
        ...result,
        id: `${OPAQUE_ID}-${index}`,
      })),
    });
    expect(distinct).toContain('result-identity');
    expect(distinct).not.toContain('duplicate-identity');
  });

  it('reports result-identity and result-event as separate facts', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);

    // A result that names a foreign parent *and* is identified from it: the
    // event relation fails, the identity relation does not.
    const relations = validateSeasonReferences({
      ...source,
      results: source.results.map((result) =>
        result.round === victim.round
          ? {
              ...result,
              grandPrixId: FOREIGN_EVENT,
              id: canonicalRaceResultId(FOREIGN_EVENT, 'race'),
            }
          : result,
      ),
    });

    expect(relations).toContain('result-event');
    expect(relations).not.toContain('result-identity');
  });

  it('orders result-identity in the declared relation order', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);
    const relations = validateSeasonReferences(
      withResultId(source, victim.round, OPAQUE_ID),
    );
    expect(relations).toEqual(['result-identity']);
  });
});

describe('a mis-identified classification withholds the whole assembled season', () => {
  it('withholds before generation on inconsistent-references', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);
    const run = await runWithClassification(source, victim.round, {
      ...victim,
      id: OPAQUE_ID,
    });

    expect(run.status).toBe('completed');
    const assembly = assembleSeasonSource(run, metadataFor(source));
    expect(assembly.complete).toBe(false);
    if (assembly.complete) return;
    expect(assembly.gap).toBe('inconsistent-references');
    expect(assembly.relations).toContain('result-identity');
  });

  it('withholds identically whichever order the plan lists its resources in', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);

    for (const reversed of [false, true]) {
      const run = await runWithClassification(
        source,
        victim.round,
        { ...victim, id: OPAQUE_ID },
        reversed,
      );
      const assembly = assembleSeasonSource(run, metadataFor(source));
      expect(assembly.complete, `reversed=${reversed}`).toBe(false);
      if (assembly.complete) continue;
      expect(assembly.relations, `reversed=${reversed}`).toContain(
        'result-identity',
      );
    }
  });

  it('never reaches generation or publication, and leaks no identifier', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);
    const run = await runWithClassification(source, victim.round, {
      ...victim,
      id: OPAQUE_ID,
    });

    const harness = publicationHarness();
    const outcome = await new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    }).publish(run, metadataFor(source), FIXED_NOW, '2026.07.20.1');

    expect(outcome.outcome).toBe('withheld');
    if (outcome.outcome !== 'withheld') return;
    expect(outcome.gap).toBe('inconsistent-references');
    expect(outcome.relations).toContain('result-identity');
    expect(harness.publishCalls).toBe(0);
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
    // Bounded diagnostics only: no provider-controlled identifier rides out.
    expect(harness.logger.serialized()).not.toContain(OPAQUE_ID);
    expect(harness.logger.serialized()).not.toContain(victim.grandPrixId);
    expect(JSON.stringify(outcome)).not.toContain(OPAQUE_ID);
  });

  it('leaves the payload boundary untouched: nothing is rewritten or inferred', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);
    const run = await runWithClassification(source, victim.round, {
      ...victim,
      id: OPAQUE_ID,
    });

    // The classification is still a valid *candidate* for its resource: the
    // identity relation is a season-wide fact decided where the result, its
    // parent event and the assembled season are all in hand.
    const classification = run.resources.find(
      (entry) =>
        entry.resource.kind === 'session-classification' &&
        entry.resource.round === victim.round,
    );
    expect(classification?.selection.outcome).toBe('selected');
    if (classification?.selection.outcome !== 'selected') return;
    const payload = classification.selection.payload;
    expect(payload.kind).toBe('session-classification');
    if (payload.kind !== 'session-classification') return;
    expect(payload.result.id).toBe(OPAQUE_ID);
  });

  it('publishes a correctly identified classification refresh unchanged', async () => {
    const source = await seasonFixture();
    const victim = firstClassified(source);
    const run = await runWithClassification(source, victim.round, {
      ...victim,
      status: 'final',
    });

    const assembly = assembleSeasonSource(run, metadataFor(source));
    expect(assembly.complete).toBe(true);

    const harness = publicationHarness();
    const outcome = await new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    }).publish(run, metadataFor(source), FIXED_NOW, '2026.07.20.1');
    expect(outcome.outcome).toBe('published');
    expect(harness.publishCalls).toBe(1);
  });
});
