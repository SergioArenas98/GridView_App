/**
 * F4 - the calendar event's own canonical identity.
 *
 * `GridView_Domain_Model.md` §4.2 defines the Grand Prix edition identity as
 * exactly `{season}-{eventSlug}`, and both components are fields on the
 * payload, so the canonical value is derivable from the candidate itself.
 *
 * The preflight already binds a *session* to its event and a *classification*
 * to its event. Neither catches this: an event carrying an arbitrary unique
 * `id` passes both as long as its sessions and results consistently use that
 * same incorrect id, which is exactly what every case below constructs. The
 * local database keys events by this `id`, so an arbitrary id and a later
 * corrected one are two primary keys for one edition.
 *
 * Recorded as a non-blocking backlog observation on PR #12 and deferred to the
 * adapter-registration / G4-activation gate; this suite closes it there.
 */

import { describe, expect, it } from 'vitest';

import {
  canonicalRaceResultId,
  canonicalSessionId,
} from '../../../src/contract/identity';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { validateSeasonReferences } from '../../../src/providers/coordination';
import { seasonFixture } from './support';

/**
 * Re-identifies one event **consistently**: the event, every session it
 * carries and every classification filed under it. That is what makes the
 * vector real - an inconsistent rewrite would be caught by `session-event` or
 * `result-identity`, and would prove nothing about this relation.
 */
function reIdentifyEvent(
  source: ProviderSeasonSource,
  round: number,
  id: string,
): ProviderSeasonSource {
  return {
    ...source,
    calendar: source.calendar.map((event) =>
      event.round === round
        ? {
            ...event,
            id,
            sessions: event.sessions.map((session) => ({
              ...session,
              id: canonicalSessionId(id, session.type),
            })),
          }
        : event,
    ),
    results: source.results.map((result) =>
      result.round === round
        ? {
            ...result,
            grandPrixId: id,
            id: canonicalRaceResultId(id, result.sessionType),
          }
        : result,
    ),
  };
}

describe('the canonical event identity is required', () => {
  it('accepts the curated season unchanged', async () => {
    expect(validateSeasonReferences(await seasonFixture())).toEqual([]);
  });

  it.each([
    ['an arbitrary unique id', '2026-event-13'],
    ['the wrong season', '2025-belgian-grand-prix'],
    ['a season that is not a year', 'season-belgian-grand-prix'],
    ['the wrong slug', '2026-french-grand-prix'],
    ['the slug alone', 'belgian-grand-prix'],
    ['the season alone', '2026'],
    ['a reversed composition', 'belgian-grand-prix-2026'],
    ['an extra separator', '2026--belgian-grand-prix'],
    ['a trailing suffix', '2026-belgian-grand-prix-1'],
    ['a leading suffix', 'x-2026-belgian-grand-prix'],
  ])('rejects %s', async (_label, wrongId) => {
    const source = await seasonFixture();
    const event = source.calendar[0]!;

    const relations = validateSeasonReferences(
      reIdentifyEvent(source, event.round, wrongId),
    );

    expect(relations).toContain('event-identity');
  });

  it('accepts the canonical identity rebuilt from the payload itself', async () => {
    const source = await seasonFixture();
    const event = source.calendar[0]!;
    const canonical = `${event.season}-${event.eventSlug}`;

    expect(
      validateSeasonReferences(reIdentifyEvent(source, event.round, canonical)),
    ).toEqual([]);
  });

  it('rejects an identity that differs only by case', async () => {
    const source = await seasonFixture();
    const event = source.calendar[0]!;

    const relations = validateSeasonReferences(
      reIdentifyEvent(
        source,
        event.round,
        `${event.season}-${event.eventSlug.toUpperCase()}`,
      ),
    );

    expect(relations).toContain('event-identity');
  });

  it('rejects an identity padded with whitespace', async () => {
    const source = await seasonFixture();
    const event = source.calendar[0]!;

    const relations = validateSeasonReferences(
      reIdentifyEvent(
        source,
        event.round,
        ` ${event.season}-${event.eventSlug} `,
      ),
    );

    expect(relations).toContain('event-identity');
  });
});

describe('the relation is independent of every neighbouring rule', () => {
  it('is the only relation a consistently re-identified event breaks', async () => {
    const source = await seasonFixture();
    const event = source.calendar[0]!;

    expect(
      validateSeasonReferences(
        reIdentifyEvent(source, event.round, '2026-event-13'),
      ),
    ).toEqual(['event-identity']);
  });

  it('does not depend on duplicate-identity, which two wrong ids never trigger', async () => {
    const source = await seasonFixture();
    const [first, second] = [source.calendar[0]!, source.calendar[1]!];
    const corrupted = reIdentifyEvent(
      reIdentifyEvent(source, first.round, '2026-event-a'),
      second.round,
      '2026-event-b',
    );

    const relations = validateSeasonReferences(corrupted);

    expect(relations).toContain('event-identity');
    expect(relations).not.toContain('duplicate-identity');
  });

  it('still reports session-event when the sessions are inconsistent too', async () => {
    const source = await seasonFixture();
    const event = source.calendar[0]!;
    const corrupted: ProviderSeasonSource = {
      ...reIdentifyEvent(source, event.round, '2026-event-13'),
      calendar: reIdentifyEvent(
        source,
        event.round,
        '2026-event-13',
      ).calendar.map((candidate) =>
        candidate.round === event.round
          ? {
              ...candidate,
              sessions: event.sessions.map((session) => ({ ...session })),
            }
          : candidate,
      ),
    };

    const relations = validateSeasonReferences(corrupted);

    expect(relations).toContain('event-identity');
    expect(relations).toContain('session-event');
  });

  it('reports each broken relation once, in declared vocabulary order', async () => {
    const source = await seasonFixture();
    const event = source.calendar[0]!;
    const corrupted = reIdentifyEvent(source, event.round, '2026-event-13');
    const relations = validateSeasonReferences({
      ...corrupted,
      calendar: corrupted.calendar.map((candidate) =>
        candidate.round === event.round
          ? { ...candidate, circuitId: 'no-such-circuit' }
          : candidate,
      ),
    });

    expect(relations).toEqual(['event-circuit', 'event-identity']);
    expect(new Set(relations).size).toBe(relations.length);
  });
});
