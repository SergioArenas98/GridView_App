/**
 * A session belongs to exactly one calendar event, and its identity says so.
 *
 * `GridView_Domain_Model.md` §6 defines a session's identity as
 * `{grandPrixId}-{sessionType}`, so the identity is *derived from* its parent
 * event rather than merely stored beside it. The coordination seam can break
 * that: an `event-schedule` resource names only a season and a round, so
 * `payloadMatchesResource` can check the round it declares but has no event id
 * to check the sessions against - and assembly then replaces that round's
 * sessions wholesale.
 *
 * The invariant this file pins:
 *
 * > Every session published under a calendar event carries that event's own
 * > canonical identity for its session type.
 *
 * It is deliberately **distinct from duplicate detection**. A borrowed session
 * that also exists under its real event is caught today as a duplicate primary
 * key; a borrowed session whose event is not in the calendar at all is unique,
 * collides with nothing, and was published under the wrong Grand Prix. Both
 * must fail, for two different reasons.
 *
 * Nothing here rewrites, coerces or infers an identity: a mismatch withholds
 * the whole assembled source, exactly as every other broken relation does.
 */

import { describe, expect, it } from 'vitest';

import { SESSION_TYPES } from '../../../src/contract/enums';
import type { GrandPrix, Session } from '../../../src/contract/types';
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
  payloadFor,
  publicationHarness,
  rounds,
  seasonFixture,
  seasonResources,
  testOnlyProvisionalBound,
} from './support';

/** A Grand Prix identity that appears nowhere in the curated calendar. */
const FOREIGN_EVENT = '2026-monaco-grand-prix';

function scheduleResource(round: number): CoordinatedResource {
  return { kind: 'event-schedule', season: SEASON, round };
}

/** The same sessions, re-identified under a different Grand Prix. */
function reparent(
  sessions: readonly Session[],
  fromEventId: string,
  toEventId: string,
): Session[] {
  return sessions.map((session) => ({
    ...session,
    id: session.id.replace(fromEventId, toEventId),
  }));
}

function withSessions(
  source: ProviderSeasonSource,
  round: number,
  sessions: readonly Session[],
): ProviderSeasonSource {
  return {
    ...source,
    calendar: source.calendar.map((event) =>
      event.round === round ? { ...event, sessions: [...sessions] } : event,
    ),
  };
}

function eventOf(source: ProviderSeasonSource, round: number): GrandPrix {
  const event = source.calendar.find((candidate) => candidate.round === round);
  if (event === undefined) throw new Error('fixture gap');
  return event;
}

/**
 * A run whose `event-schedule` for one round answers with supplied sessions.
 *
 * Every other resource comes from the curated fixture through the ordinary
 * port, so the only thing under test is the schedule.
 */
async function runWithSchedule(
  source: ProviderSeasonSource,
  round: number,
  sessions: readonly Session[],
  sourceId: 'jolpica' | 'openf1' = 'jolpica',
  reverseOrder = false,
  withProvisional = false,
): Promise<CoordinationRun> {
  const complete = completePort(sourceId, source);
  let sequence = 0;
  const port = new FakePort(sourceId, (request) => {
    if (request.resource.kind !== 'event-schedule') {
      return complete.fetchResource(request);
    }
    sequence += 1;
    return {
      outcome: 'candidate',
      attempt: attempt(`${sourceId}-schedule-${sequence}`),
      payload: {
        kind: 'event-schedule',
        round: request.resource.round,
        sessions,
      },
    } as unknown as ProviderResourceOutcome;
  });

  const resources: CoordinatedResource[] = [
    ...seasonResources,
    ...rounds(source).map((entry) => ({
      kind: 'session-classification' as const,
      season: SEASON,
      round: entry,
      sessionType: 'race' as const,
    })),
    scheduleResource(round),
  ];

  return new MultiSourceCoordinator({
    ports: withProvisional ? [port, completePort('openf1', source)] : [port],
    logger: new CapturingLogger(),
    ...(sourceId === 'openf1' || withProvisional
      ? { provisionalSessionEndBound: testOnlyProvisionalBound }
      : {}),
  }).coordinate({
    plan: {
      season: SEASON,
      resources: reverseOrder ? [...resources].reverse() : resources,
    },
  });
}

describe('a session identity is bound to its own calendar event', () => {
  it('rejects sessions whose identities name an event absent from the calendar', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const borrowed = reparent(victim.sessions, victim.id, FOREIGN_EVENT);

    // Unique across the whole season: duplicate detection cannot see this.
    const relations = validateSeasonReferences(
      withSessions(source, victim.round, borrowed),
    );

    expect(relations).toContain('session-event');
    expect(relations).not.toContain('duplicate-identity');
  });

  it('rejects a single mismatched session among otherwise valid ones', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const first = victim.sessions[0];
    if (first === undefined) throw new Error('fixture gap');
    const mixed = [
      { ...first, id: first.id.replace(victim.id, FOREIGN_EVENT) },
      ...victim.sessions.slice(1),
    ];

    const relations = validateSeasonReferences(
      withSessions(source, victim.round, mixed),
    );

    expect(relations).toContain('session-event');
    expect(relations).not.toContain('duplicate-identity');
  });

  it('rejects sessions borrowed from another event already in the calendar', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const donor = eventOf(source, source.calendar[1]?.round ?? 0);

    const relations = validateSeasonReferences(
      withSessions(source, victim.round, donor.sessions),
    );

    // Both failures are real and independent: the identities do not belong to
    // this event, *and* they now exist twice in one season.
    expect(relations).toContain('session-event');
    expect(relations).toContain('duplicate-identity');
  });

  it('keeps duplicate detection working on its own', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const first = victim.sessions[0];
    if (first === undefined) throw new Error('fixture gap');
    // Two copies of a session that *does* belong to this event.
    const duplicated = [...victim.sessions, { ...first }];

    const relations = validateSeasonReferences(
      withSessions(source, victim.round, duplicated),
    );

    expect(relations).toContain('duplicate-identity');
    expect(relations).not.toContain('session-event');
  });

  it('rejects a correct event carrying the wrong session-type suffix', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const race = victim.sessions.find((session) => session.type === 'race');
    if (race === undefined) throw new Error('fixture gap');
    const mistyped = victim.sessions.map((session) =>
      session.type === 'race'
        ? { ...session, id: `${victim.id}-qualifying-2` }
        : session,
    );

    expect(
      validateSeasonReferences(withSessions(source, victim.round, mistyped)),
    ).toContain('session-event');
  });

  it('rejects a foreign event carrying the correct session-type suffix', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const race = victim.sessions.find((session) => session.type === 'race');
    if (race === undefined) throw new Error('fixture gap');

    expect(
      validateSeasonReferences(
        withSessions(source, victim.round, [
          ...victim.sessions.filter((session) => session.type !== 'race'),
          { ...race, id: `${FOREIGN_EVENT}-race` },
        ]),
      ),
    ).toContain('session-event');
  });

  it('rejects near-miss identities that differ only by case or padding', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const race = victim.sessions.find((session) => session.type === 'race');
    if (race === undefined) throw new Error('fixture gap');

    for (const id of [
      `${victim.id}-RACE`,
      `${victim.id}-race `,
      ` ${victim.id}-race`,
      `${victim.id}_race`,
      `${victim.id}-race-`,
    ]) {
      const relations = validateSeasonReferences(
        withSessions(source, victim.round, [
          ...victim.sessions.filter((session) => session.type !== 'race'),
          { ...race, id },
        ]),
      );
      expect(relations, id).toContain('session-event');
    }
  });

  it('accepts every declared session type under its own event', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const template = victim.sessions[0];
    if (template === undefined) throw new Error('fixture gap');

    const all: Session[] = SESSION_TYPES.map((type) => ({
      ...template,
      type,
      id: `${victim.id}-${type.replaceAll('_', '-')}`,
    }));

    expect(
      validateSeasonReferences(withSessions(source, victim.round, all)),
    ).not.toContain('session-event');
  });

  it('accepts the curated season unchanged, and an event with no sessions', async () => {
    const source = await seasonFixture();
    expect(validateSeasonReferences(source)).toEqual([]);

    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    expect(
      validateSeasonReferences(withSessions(source, victim.round, [])),
    ).not.toContain('session-event');
  });

  it('preserves the existing classification-to-event binding', async () => {
    const source = await seasonFixture();
    const first = source.results[0];
    if (first === undefined) throw new Error('fixture gap');

    const relations = validateSeasonReferences({
      ...source,
      results: [
        { ...first, grandPrixId: FOREIGN_EVENT },
        ...source.results.slice(1),
      ],
    });

    expect(relations).toContain('result-event');
    expect(relations).not.toContain('session-event');
  });
});

describe('a mis-bound schedule withholds the whole assembled season', () => {
  it('withholds a season whose schedule carries another event’s sessions', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const run = await runWithSchedule(
      source,
      victim.round,
      reparent(victim.sessions, victim.id, FOREIGN_EVENT),
    );

    expect(run.status).toBe('completed');
    const assembly = assembleSeasonSource(run, metadataFor(source));
    expect(assembly.complete).toBe(false);
    if (assembly.complete) return;
    expect(assembly.gap).toBe('inconsistent-references');
    expect(assembly.relations).toContain('session-event');
  });

  it('withholds identically whichever order the plan lists its resources in', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const borrowed = reparent(victim.sessions, victim.id, FOREIGN_EVENT);

    for (const reversed of [false, true]) {
      const run = await runWithSchedule(
        source,
        victim.round,
        borrowed,
        'jolpica',
        reversed,
      );
      const assembly = assembleSeasonSource(run, metadataFor(source));
      expect(assembly.complete, `reversed=${reversed}`).toBe(false);
      if (assembly.complete) continue;
      expect(assembly.relations).toContain('session-event');
    }
  });

  it('withholds while the provisional source stays structurally excluded', async () => {
    // A schedule is a reconciled-only capability (ADR 0020 D5.2), so the
    // provisional source cannot contribute one even when policy-unlocked. The
    // relation is therefore enforced on the reconciled answer, and the
    // provisional side stays a never-attempted contribution.
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const run = await runWithSchedule(
      source,
      victim.round,
      reparent(victim.sessions, victim.id, FOREIGN_EVENT),
      'jolpica',
      false,
      true,
    );

    const schedule = run.resources.find(
      (entry) => entry.resource.kind === 'event-schedule',
    );
    const provisional = schedule?.contributions.find(
      (entry) => entry.source === 'openf1',
    );
    expect(provisional?.reason).toBe('resource-unsupported');
    expect(provisional?.attempted).toBe(false);

    const assembly = assembleSeasonSource(run, metadataFor(source));
    expect(assembly.complete).toBe(false);
    if (assembly.complete) return;
    expect(assembly.relations).toContain('session-event');
  });

  it('never reaches generation or publication', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const run = await runWithSchedule(
      source,
      victim.round,
      reparent(victim.sessions, victim.id, FOREIGN_EVENT),
    );

    const harness = publicationHarness();
    const outcome = await new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    }).publish(run, metadataFor(source), FIXED_NOW, '2026.07.20.1');

    expect(outcome.outcome).toBe('withheld');
    if (outcome.outcome !== 'withheld') return;
    expect(outcome.gap).toBe('inconsistent-references');
    expect(outcome.relations).toContain('session-event');
    expect(harness.publishCalls).toBe(0);
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
    // Bounded diagnostics only: no identifier ever rides out.
    expect(harness.logger.serialized()).not.toContain(FOREIGN_EVENT);
    expect(harness.logger.serialized()).not.toContain(victim.id);
  });

  it('publishes a correctly bound schedule refresh unchanged', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const refreshed = victim.sessions.map((session) => ({
      ...session,
      status: 'completed' as const,
    }));
    const run = await runWithSchedule(source, victim.round, refreshed);

    const assembly = assembleSeasonSource(run, metadataFor(source));
    expect(assembly.complete).toBe(true);
    if (!assembly.complete) return;
    const published = assembly.source.calendar.find(
      (event) => event.round === victim.round,
    );
    expect(published?.sessions.map((session) => session.id)).toEqual(
      victim.sessions.map((session) => session.id),
    );
    expect(
      published?.sessions.every((session) => session.status === 'completed'),
    ).toBe(true);

    const harness = publicationHarness();
    const outcome = await new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    }).publish(run, metadataFor(source), FIXED_NOW, '2026.07.20.1');
    expect(outcome.outcome).toBe('published');
    expect(harness.publishCalls).toBe(1);
  });

  it('leaves the payload boundary untouched: nothing is rewritten or inferred', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const borrowed = reparent(victim.sessions, victim.id, FOREIGN_EVENT);
    const run = await runWithSchedule(source, victim.round, borrowed);

    // The schedule is still a valid *candidate* for its resource: the identity
    // relation is a season-wide fact, decided where the event is in hand, and
    // the resource boundary is deliberately unchanged.
    const schedule = run.resources.find(
      (entry) => entry.resource.kind === 'event-schedule',
    );
    expect(schedule?.selection.outcome).toBe('selected');
    if (schedule?.selection.outcome !== 'selected') return;
    const payload = schedule.selection.payload;
    expect(payload.kind).toBe('event-schedule');
    if (payload.kind !== 'event-schedule') return;
    expect(payload.sessions.map((session) => session.id)).toEqual(
      borrowed.map((session) => session.id),
    );
  });

  it('still carries the curated schedule through when it is the only contribution', async () => {
    const source = await seasonFixture();
    const victim = eventOf(source, source.calendar[0]?.round ?? 0);
    const payload = payloadFor(source, scheduleResource(victim.round));
    expect(payload).not.toBeNull();

    const run = await runWithSchedule(source, victim.round, victim.sessions);
    const assembly = assembleSeasonSource(run, metadataFor(source));
    expect(assembly.complete).toBe(true);
  });
});
