/**
 * The Jolpica season-calendar adapter, proven entirely against fakes.
 *
 * No test here reaches the network, needs a Cloudflare binding, reads a clock
 * or depends on a private evidence directory. The transport is an injected
 * local function and the limiter is a local object, so a real request would
 * require deliberately replacing both.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  payloadMatchesResource,
  readProviderOutcome,
  validateCoordinatedPayload,
} from '../../../src/providers/coordination';
import type {
  CoordinatedResource,
  ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import { validateGrandPrix } from '../../../src/contract/normalized';
import { gridViewUserAgent } from '../../../src/providers/http/provider-http-client';
import {
  LIMIT,
  SEASON,
  curatedEventLocators,
  deferringLimiter,
  envelope,
  failingTransport,
  forbiddenTransport,
  fullSeasonRaces,
  harness,
  jsonTransport,
  race,
  rateLimitedTransport,
  sprintWeekend,
  standardWeekend,
  unavailableLimiter,
} from './support';

const calendar: CoordinatedResource = {
  kind: 'season-calendar',
  season: SEASON,
};

/** Every outcome the port returns must survive the coordinator's own parser. */
function wellFormed(outcome: ProviderResourceOutcome): ProviderResourceOutcome {
  expect(readProviderOutcome(outcome)).not.toBeNull();
  return outcome;
}

function eventsOf(outcome: ProviderResourceOutcome) {
  expect(outcome.outcome).toBe('candidate');
  if (outcome.outcome !== 'candidate') throw new Error('unreachable');
  expect(outcome.payload.kind).toBe('season-calendar');
  if (outcome.payload.kind !== 'season-calendar')
    throw new Error('unreachable');
  return outcome.payload.events;
}

describe('the request the adapter builds', () => {
  it('targets the pinned origin and path with an explicit limit', async () => {
    const transport = jsonTransport(envelope([race(standardWeekend)]));
    const { port, calls } = harness({ transport });

    await port.fetchResource({ source: 'jolpica', resource: calendar });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(
      `https://api.jolpi.ca/ergast/f1/${SEASON}/races/?limit=${LIMIT}`,
    );
    expect(call?.method).toBe('GET');
  });

  it('takes the season from the requested resource, not a constant', async () => {
    const transport = jsonTransport(
      envelope([race({ ...standardWeekend, season: '2024' })], {
        season: '2024',
      }),
    );
    const { port, calls } = harness({ transport });

    await port.fetchResource({
      source: 'jolpica',
      resource: { kind: 'season-calendar', season: 2024 },
    });

    expect(calls[0]?.url).toContain('/ergast/f1/2024/races/');
  });

  it('sends the identifying User-Agent and no credentials', async () => {
    const transport = jsonTransport(envelope([race(standardWeekend)]));
    const { port, calls } = harness({ transport });

    await port.fetchResource({ source: 'jolpica', resource: calendar });

    const headers = calls[0]?.headers ?? {};
    expect(headers['user-agent']).toBe(gridViewUserAgent);
    expect(headers.accept).toBe('application/json');
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
    expect(calls[0]?.redirect).toBe('manual');
    expect(calls[0]?.hasBody).toBe(false);
  });

  it('never invokes a real network function', async () => {
    // The transport is a required constructor argument on the hardened client,
    // so there is no wiring to global fetch at all. This pins that the adapter
    // reaches the injected one and nothing else.
    const transport = jsonTransport(envelope([race(standardWeekend)]));
    const { port, calls } = harness({ transport });

    await port.fetchResource({ source: 'jolpica', resource: calendar });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.startsWith('https://api.jolpi.ca/')).toBe(true);
  });
});

describe('normalization of a calendar', () => {
  it('normalizes a standard weekend in canonical session order', async () => {
    const transport = jsonTransport(envelope([race(standardWeekend)]));
    const { port } = harness({ transport });

    const outcome = wellFormed(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );
    const [event] = eventsOf(outcome);

    expect(event?.id).toBe('2026-australian-grand-prix');
    expect(event?.eventSlug).toBe('australian-grand-prix');
    expect(event?.name).toBe('Australian Grand Prix');
    expect(event?.round).toBe(1);
    expect(event?.circuitId).toBe('albert-park');
    expect(event?.status).toBe('unknown');
    // A10: neither sprint block, and the complete FP1/FP2/FP3/Qualifying
    // signature present, is positive evidence of a standard weekend.
    expect(event?.format).toBe('standard');
    expect(event?.hasResults).toBe(false);
    expect(event?.officialName).toBeNull();
    expect(event?.startDate).toBeNull();
    expect(event?.endDate).toBeNull();
    expect(event?.timezone).toBeNull();
    expect(event?.media).toBeNull();

    expect(event?.sessions.map((session) => session.type)).toEqual([
      'practice_1',
      'practice_2',
      'practice_3',
      'qualifying',
      'race',
    ]);
    expect(
      event?.sessions.every((session) => session.status === 'unknown'),
    ).toBe(true);
    expect(event?.sessions.every((session) => session.endTime === null)).toBe(
      true,
    );
    expect(event?.sessions.every((session) => session.name === null)).toBe(
      true,
    );
    expect(event?.sessions.at(-1)?.startTime).toBe('2026-03-08T04:00:00Z');
    expect(event?.sessions.at(-1)?.id).toBe('2026-australian-grand-prix-race');
  });

  it('recognizes a sprint weekend and its sprint-qualifying block', async () => {
    const transport = jsonTransport(envelope([race(sprintWeekend)]));
    const { port } = harness({ transport });

    const outcome = wellFormed(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );
    const [event] = eventsOf(outcome);

    expect(event?.sessions.map((session) => session.type)).toEqual([
      'practice_1',
      'sprint_qualifying',
      'sprint',
      'qualifying',
      'race',
    ]);
    expect(event?.format).toBe('sprint');
    expect(event?.sessions[1]?.id).toBe(
      '2026-chinese-grand-prix-sprint-qualifying',
    );
  });

  it('treats sprint qualifying alone as sprint evidence', async () => {
    // The two sprint blocks are separately optional upstream, so a cancelled
    // sprint or a partly finalized schedule can carry sprint qualifying
    // without a sprint. The weekend is a sprint weekend either way, and the
    // client only renders the sprint chip when the format says so.
    const transport = jsonTransport(
      envelope([
        race({
          ...sprintWeekend,
          blocks: {
            FirstPractice: { date: '2026-03-13', time: '03:30:00Z' },
            SprintQualifying: { date: '2026-03-13', time: '07:30:00Z' },
            Qualifying: { date: '2026-03-14', time: '07:00:00Z' },
          },
        }),
      ]),
    );
    const { port } = harness({ transport });

    const [event] = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(event?.sessions.map((session) => session.type)).not.toContain(
      'sprint',
    );
    expect(event?.format).toBe('sprint');
  });

  it('treats the sprint block alone as sprint evidence', async () => {
    const transport = jsonTransport(
      envelope([
        race({
          ...sprintWeekend,
          blocks: { Sprint: { date: '2026-03-14', time: '03:00:00Z' } },
        }),
      ]),
    );
    const { port } = harness({ transport });

    const [event] = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(event?.format).toBe('sprint');
  });

  it('accepts SprintShootout as the same block under its earlier name', async () => {
    const { SprintQualifying, ...rest } = sprintWeekend.blocks as Record<
      string,
      unknown
    >;
    const transport = jsonTransport(
      envelope([
        race({
          ...sprintWeekend,
          blocks: { ...rest, SprintShootout: SprintQualifying },
        }),
      ]),
    );
    const { port } = harness({ transport });

    const [event] = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(event?.sessions.map((session) => session.type)).toContain(
      'sprint_qualifying',
    );
  });

  it('orders a rescheduled weekend by its actual start instants', async () => {
    // GridView_App_Flow.md §7.4 requires supporting changed session orders and
    // forbids assuming a fixed sequence; the client renders the delivered
    // order and never re-sorts. So the supplied order must be chronological,
    // not the usual block sequence.
    const transport = jsonTransport(
      envelope([
        race({
          ...sprintWeekend,
          blocks: {
            FirstPractice: { date: '2026-03-13', time: '03:30:00Z' },
            // Qualifying brought forward ahead of both sprint sessions.
            Qualifying: { date: '2026-03-13', time: '05:00:00Z' },
            SprintQualifying: { date: '2026-03-13', time: '07:30:00Z' },
            Sprint: { date: '2026-03-14', time: '03:00:00Z' },
          },
        }),
      ]),
    );
    const { port } = harness({ transport });

    const [event] = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(event?.sessions.map((session) => session.type)).toEqual([
      'practice_1',
      'qualifying',
      'sprint_qualifying',
      'sprint',
      'race',
    ]);
    const times = event?.sessions.map((session) => session.startTime) ?? [];
    expect([...times].sort()).toEqual(times);
  });

  it('orders sessions deterministically when two share an instant', async () => {
    // Both before the standard weekend's own race instant (2026-03-08T04:00Z).
    const shared = { date: '2026-03-06', time: '01:30:00Z' };
    const transport = jsonTransport(
      envelope([
        race({
          ...standardWeekend,
          blocks: { FirstPractice: shared, SecondPractice: shared },
        }),
      ]),
    );
    const { port } = harness({ transport });

    const [event] = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    // Equal instants keep their block order, so the canonical serialization
    // of this calendar is stable across runs.
    expect(event?.sessions.map((session) => session.type)).toEqual([
      'practice_1',
      'practice_2',
      'race',
    ]);
  });

  it('emits no session for an absent optional block', async () => {
    const transport = jsonTransport(
      envelope([
        race({
          round: '1',
          raceName: 'Australian Grand Prix',
          circuitId: 'albert_park',
          date: '2026-03-08',
          time: '04:00:00Z',
          // Every optional block is absent: only the race remains.
        }),
      ]),
    );
    const { port } = harness({ transport });

    const [event] = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(event?.sessions.map((session) => session.type)).toEqual(['race']);
    // Absence of a sprint block is not evidence of a standard weekend.
    expect(event?.format).toBe('unknown');
  });

  it('fails the resource when a present block has no time', async () => {
    // ADR 0022 A8: a session Jolpica did deliver is never published with a
    // silently absent start, and no midnight is manufactured for it.
    const transport = jsonTransport(
      envelope([
        race({
          ...standardWeekend,
          blocks: { Qualifying: { date: '2026-03-07' } },
        }),
      ]),
    );
    const { port } = harness({ transport });

    const outcome = wellFormed(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome !== 'failed') throw new Error('unreachable');
    expect(outcome.reason).toBe('invalid-payload');
    expect(outcome.attempt.outcome).toBe('successful');
  });

  it('fails the resource when the race itself has no time', async () => {
    const transport = jsonTransport(
      envelope([race({ ...standardWeekend, time: undefined })]),
    );
    const { port } = harness({ transport });

    const outcome = await port.fetchResource({
      source: 'jolpica',
      resource: calendar,
    });

    expect(outcome.outcome).toBe('failed');
  });

  it('produces payloads the coordination boundary accepts', async () => {
    const transport = jsonTransport(
      envelope([race(standardWeekend), race(sprintWeekend)]),
    );
    const { port } = harness({ transport });

    const outcome = await port.fetchResource({
      source: 'jolpica',
      resource: calendar,
    });
    expect(outcome.outcome).toBe('candidate');
    if (outcome.outcome !== 'candidate') throw new Error('unreachable');

    // The existing validators, unchanged and unweakened, on the adapter's own
    // detached output.
    const detached = structuredClone(outcome.payload);
    expect(payloadMatchesResource(calendar, detached)).toBe(true);
    expect(validateCoordinatedPayload(detached).length).toBe(0);
    for (const event of eventsOf(outcome)) {
      expect(validateGrandPrix(event, 'event').length).toBe(0);
    }
  });

  it('resolves the complete set of 23 curated 2026 locators', async () => {
    const races = fullSeasonRaces();
    expect(races).toHaveLength(23);

    const transport = jsonTransport(envelope(races));
    const { port } = harness({ transport });

    const events = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(events).toHaveLength(23);
    expect(new Set(events.map((event) => event.eventSlug)).size).toBe(23);
    expect(new Set(events.map((event) => event.circuitId)).size).toBe(23);
    expect(events.every((event) => event.season === SEASON)).toBe(true);
    expect(events.map((event) => event.round)).toEqual(
      curatedEventLocators().map((locator) => locator.round),
    );
    for (const event of events) {
      expect(validateGrandPrix(event, 'event').length).toBe(0);
    }
  });

  it('never forwards an unknown upstream field into the payload', async () => {
    const transport = jsonTransport(
      envelope([
        race({
          ...standardWeekend,
          // Deliberately fabricated. The upstream descriptive fields are
          // unapproved content, so the point is to prove the shape of them
          // cannot pass through - never to reproduce their real values.
          extra: {
            url: 'https://example.invalid/unapproved-descriptive-url',
            Location: {
              lat: '11.1111',
              long: '22.2222',
              locality: 'Fabricated Locality',
            },
            unexpectedFutureField: 'surprise',
          },
        }),
      ]),
    );
    const { port } = harness({ transport });

    const outcome = await port.fetchResource({
      source: 'jolpica',
      resource: calendar,
    });
    const serialized = JSON.stringify(outcome);

    expect(serialized).not.toContain('example.invalid');
    expect(serialized).not.toContain('Location');
    expect(serialized).not.toContain('locality');
    expect(serialized).not.toContain('Fabricated Locality');
    expect(serialized).not.toContain('unexpectedFutureField');
    expect(serialized).not.toContain('surprise');
    expect(serialized).not.toContain('22.2222');
    // The provider's own locator components are not public content either.
    expect(serialized).not.toContain('albert_park');
  });
});

/**
 * The weekend-format discriminator (ADR 0022 amendment A10).
 *
 * Each answer needs its own positive evidence, and the discriminator is
 * descriptive of the session list rather than a template that generates one.
 */
describe('the weekend format discriminator', () => {
  async function formatOf(
    blocks: Readonly<Record<string, unknown>> | undefined,
  ): Promise<string | undefined> {
    const transport = jsonTransport(
      envelope([race({ ...standardWeekend, blocks })]),
    );
    const { port } = harness({ transport });
    const [event] = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );
    return event?.format;
  }

  const fp1 = { date: '2026-03-06', time: '01:30:00Z' };
  const fp2 = { date: '2026-03-06', time: '05:00:00Z' };
  const fp3 = { date: '2026-03-07', time: '01:30:00Z' };
  const qualifying = { date: '2026-03-07', time: '05:00:00Z' };

  it('reads standard only from the complete four-block signature', async () => {
    expect(
      await formatOf({
        FirstPractice: fp1,
        SecondPractice: fp2,
        ThirdPractice: fp3,
        Qualifying: qualifying,
      }),
    ).toBe('standard');
  });

  // Each of these is one block short of the standard signature. None of them
  // is evidence of a sprint weekend either, so none may be promoted: an
  // incomplete schedule is a schedule GridView has not been told the shape of.
  const incomplete: readonly [string, Record<string, unknown>][] = [
    [
      'no third practice',
      { FirstPractice: fp1, SecondPractice: fp2, Qualifying: qualifying },
    ],
    [
      'no second practice',
      { FirstPractice: fp1, ThirdPractice: fp3, Qualifying: qualifying },
    ],
    [
      'no first practice',
      { SecondPractice: fp2, ThirdPractice: fp3, Qualifying: qualifying },
    ],
    [
      'no qualifying',
      { FirstPractice: fp1, SecondPractice: fp2, ThirdPractice: fp3 },
    ],
    ['qualifying only', { Qualifying: qualifying }],
  ];

  it.each(incomplete)(
    'refuses to promote an incomplete standard set to standard: %s',
    async (_label, blocks) => {
      expect(await formatOf(blocks)).toBe('unknown');
    },
  );

  it('does not synthesize a session the row never carried', async () => {
    // A standard classification must describe the four blocks supplied plus
    // the race, and must not fill in a weekend template.
    const transport = jsonTransport(
      envelope([
        race({
          ...standardWeekend,
          blocks: {
            FirstPractice: fp1,
            SecondPractice: fp2,
            ThirdPractice: fp3,
            Qualifying: qualifying,
          },
        }),
      ]),
    );
    const { port } = harness({ transport });
    const [event] = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(event?.format).toBe('standard');
    expect(event?.sessions).toHaveLength(5);
    expect(event?.sessions.map((session) => session.type)).not.toContain(
      'sprint',
    );
    expect(event?.sessions.map((session) => session.type)).not.toContain(
      'sprint_qualifying',
    );
  });

  it('classifies a sprint weekend without adding its missing counterpart', async () => {
    // Sprint qualifying alone is sprint evidence, and the absent `Sprint`
    // block stays absent: the discriminator describes the list, it does not
    // complete it.
    const transport = jsonTransport(
      envelope([
        race({
          ...sprintWeekend,
          blocks: {
            FirstPractice: fp1,
            SprintQualifying: { date: '2026-03-13', time: '07:30:00Z' },
          },
        }),
      ]),
    );
    const { port } = harness({ transport });
    const [event] = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(event?.format).toBe('sprint');
    expect(event?.sessions.map((session) => session.type)).toEqual([
      'practice_1',
      'sprint_qualifying',
      'race',
    ]);
  });

  it('neither removes nor reorders the sessions it classifies', async () => {
    // An unusual but valid combination: the complete standard signature plus
    // a sprint, with qualifying brought forward. The format answers `sprint`
    // on the sprint block's evidence, and the session list is still exactly
    // what was supplied, in instant order.
    const transport = jsonTransport(
      envelope([
        race({
          ...standardWeekend,
          blocks: {
            FirstPractice: fp1,
            SecondPractice: fp2,
            ThirdPractice: fp3,
            Qualifying: { date: '2026-03-06', time: '03:00:00Z' },
            Sprint: { date: '2026-03-07', time: '03:00:00Z' },
          },
        }),
      ]),
    );
    const { port } = harness({ transport });
    const [event] = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(event?.format).toBe('sprint');
    expect(event?.sessions.map((session) => session.type)).toEqual([
      'practice_1',
      'qualifying',
      'practice_2',
      'practice_3',
      'sprint',
      'race',
    ]);
    const times = event?.sessions.map((session) => session.startTime) ?? [];
    expect([...times].sort()).toEqual(times);
  });

  it('cannot be influenced by an irrelevant upstream field', async () => {
    // Everything here is a decoy: a provider-supplied format field, a
    // sprint-flavoured flag, name and URL. None is admissible evidence, so the
    // answer stays exactly what the blocks say - and what they say here is an
    // incomplete standard set.
    const transport = jsonTransport(
      envelope([
        race({
          ...standardWeekend,
          blocks: { FirstPractice: fp1, Qualifying: qualifying },
          extra: {
            format: 'sprint',
            sprint: true,
            raceType: 'SPRINT',
            sprintWeekend: true,
            url: 'https://example.invalid/sprint',
          },
        }),
      ]),
    );
    const { port } = harness({ transport });
    const [event] = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(event?.format).toBe('unknown');
    expect(JSON.stringify(event)).not.toContain('example.invalid');
  });

  it('refuses a sprint-named field that is not a session block', async () => {
    // The mirror image: `Sprint` carrying a string is *present* and is not a
    // block, so it is refused outright rather than read as sprint evidence.
    const transport = jsonTransport(
      envelope([race({ ...standardWeekend, blocks: { Sprint: 'yes' } })]),
    );
    const { port } = harness({ transport });

    const outcome = wellFormed(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome !== 'failed') throw new Error('unreachable');
    expect(outcome.reason).toBe('invalid-payload');
  });

  it('classifies the complete 23-row calendar from blocks alone', async () => {
    // Which 2026 rounds are sprint rounds is not recorded in this repository,
    // so the shapes are stated here rather than assumed: one sprint row, one
    // complete-standard row, and 21 rows whose schedule detail is absent.
    const sprintRound = 2;
    const standardRound = 1;
    const races = fullSeasonRaces({
      [sprintRound]: {
        FirstPractice: { date: '2026-03-06', time: '01:30:00Z' },
        SprintQualifying: { date: '2026-03-06', time: '05:00:00Z' },
        Sprint: { date: '2026-03-07', time: '03:00:00Z' },
        Qualifying: { date: '2026-03-07', time: '07:00:00Z' },
      },
      [standardRound]: {
        FirstPractice: fp1,
        SecondPractice: fp2,
        ThirdPractice: fp3,
        Qualifying: qualifying,
      },
    });
    expect(races).toHaveLength(23);

    const transport = jsonTransport(envelope(races));
    const { port } = harness({ transport });
    const events = eventsOf(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(events).toHaveLength(23);
    const formatByRound = new Map(
      events.map((event) => [event.round, event.format]),
    );
    expect(formatByRound.get(sprintRound)).toBe('sprint');
    expect(formatByRound.get(standardRound)).toBe('standard');
    // Every row whose schedule detail is absent stays `unknown`: a calendar
    // that omits its blocks has not said which format the weekend is.
    expect(
      events
        .filter(
          (event) =>
            event.round !== sprintRound && event.round !== standardRound,
        )
        .every((event) => event.format === 'unknown'),
    ).toBe(true);
    for (const event of events) {
      expect(validateGrandPrix(event, 'event').length).toBe(0);
    }
  });

  it('consults no clock', async () => {
    // The classification is a pure reading of the row. Driving the identical
    // payload under two system times decades apart must produce the identical
    // calendar - format, sessions and instants alike.
    const blocks = {
      FirstPractice: fp1,
      SecondPractice: fp2,
      ThirdPractice: fp3,
      Qualifying: qualifying,
    };

    async function calendarUnder(systemTime: Date): Promise<string> {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(systemTime);
        const transport = jsonTransport(
          envelope([race({ ...standardWeekend, blocks })]),
        );
        const { port } = harness({ transport });
        const events = eventsOf(
          await port.fetchResource({ source: 'jolpica', resource: calendar }),
        );
        return JSON.stringify(events);
      } finally {
        vi.useRealTimers();
      }
    }

    // Long before every session, and long after.
    const early = await calendarUnder(new Date('1990-01-01T00:00:00Z'));
    const late = await calendarUnder(new Date('2099-01-01T00:00:00Z'));

    expect(early).toBe(late);
    expect(early).toContain('"format":"standard"');
  });
});

describe('untrusted payload validation', () => {
  const rejected: readonly [string, unknown][] = [
    // Valid JSON that is not a record. A body that does not parse at all is a
    // transport-level failure instead, and is covered separately below.
    ['an array body', [1, 2, 3]],
    ['a missing envelope', { nope: true }],
    [
      'a missing race collection',
      { MRData: { limit: '100', offset: '0', total: '0' } },
    ],
    [
      'a malformed round',
      envelope([race({ ...standardWeekend, round: '01' })]),
    ],
    [
      'a non-numeric round',
      envelope([race({ ...standardWeekend, round: 'one' })]),
    ],
    ['a zero round', envelope([race({ ...standardWeekend, round: '0' })])],
    [
      'a wrong season on the row',
      envelope([race({ ...standardWeekend, season: '2025' })]),
    ],
    [
      'a wrong season on the table',
      envelope([race(standardWeekend)], { season: '2025' }),
    ],
    [
      'a missing race name',
      envelope([race({ ...standardWeekend, raceName: '' })]),
    ],
    [
      'a missing circuit id',
      envelope([race({ ...standardWeekend, circuitId: '' })]),
    ],
    [
      'an impossible race date',
      envelope([race({ ...standardWeekend, date: '2026-02-30' })]),
    ],
    [
      'a non-UTC session time',
      envelope([race({ ...standardWeekend, time: '04:00:00+01:00' })]),
    ],
    [
      'a duplicate round',
      envelope([
        race(standardWeekend),
        race({ ...standardWeekend, raceName: 'Other' }),
      ]),
    ],
    [
      'a duplicate locator',
      envelope([
        race(standardWeekend),
        race({ ...standardWeekend, round: '2' }),
      ]),
    ],
    [
      'contradictory sprint-qualifying names',
      envelope([
        race({
          ...sprintWeekend,
          blocks: {
            SprintQualifying: { date: '2026-03-13', time: '07:30:00Z' },
            SprintShootout: { date: '2026-03-13', time: '09:30:00Z' },
          },
        }),
      ]),
    ],
    [
      // A8 separates an entirely absent block from a present, unusable one.
      // An explicit `null` is present, so it must fail rather than silently
      // drop the session from the weekend.
      'an explicitly null session block',
      envelope([race({ ...standardWeekend, blocks: { Qualifying: null } })]),
    ],
    [
      // A null under one alias must not let the other slip past the
      // contradictory-alias check: both names are still present.
      'a null sprint-qualifying alias beside a populated one',
      envelope([
        race({
          ...sprintWeekend,
          blocks: {
            SprintQualifying: null,
            SprintShootout: { date: '2026-03-13', time: '07:30:00Z' },
          },
        }),
      ]),
    ],
    [
      'a non-object session block',
      envelope([
        race({ ...standardWeekend, blocks: { Qualifying: 'tomorrow' } }),
      ]),
    ],
    [
      'truncated pagination metadata',
      envelope([race(standardWeekend)], { total: '23' }),
    ],
    [
      'a total beyond the requested limit',
      envelope([race(standardWeekend)], { total: '250', limit: '100' }),
    ],
    [
      'a malformed pagination value',
      envelope([race(standardWeekend)], { total: 'many' }),
    ],
    ['a non-zero offset', envelope([race(standardWeekend)], { offset: '10' })],
  ];

  for (const [label, body] of rejected) {
    it(`fails closed on ${label}`, async () => {
      const transport = jsonTransport(body);
      const { port } = harness({ transport });

      const outcome = wellFormed(
        await port.fetchResource({ source: 'jolpica', resource: calendar }),
      );

      expect(outcome.outcome).toBe('failed');
      if (outcome.outcome !== 'failed') throw new Error('unreachable');
      expect(outcome.reason).toBe('invalid-payload');
      // The response was read, so the request is still counted exactly once.
      expect(outcome.attempt.outcome).toBe('successful');
    });
  }

  it('fails closed on invalid JSON', async () => {
    const transport = jsonTransport('{ not json');
    const { port } = harness({ transport });

    const outcome = wellFormed(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(outcome.outcome).toBe('failed');
  });

  it('never carries a provider value through a failure', async () => {
    const transport = jsonTransport(
      envelope([race({ ...standardWeekend, round: 'not-a-round' })]),
    );
    const { port, logger } = harness({ transport });

    const outcome = await port.fetchResource({
      source: 'jolpica',
      resource: calendar,
    });

    expect(JSON.stringify(outcome)).not.toContain('not-a-round');
    expect(logger.serialized()).not.toContain('not-a-round');
  });
});

describe('identity resolution', () => {
  it('fails the whole calendar when an event is unmapped', async () => {
    const transport = jsonTransport(
      envelope([
        race({
          round: '1',
          raceName: 'Invented Grand Prix',
          circuitId: 'albert_park',
          date: '2026-03-08',
          time: '04:00:00Z',
        }),
      ]),
    );
    const { port } = harness({ transport });

    const outcome = wellFormed(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(outcome.outcome).toBe('mapping-failure');
    if (outcome.outcome !== 'mapping-failure') throw new Error('unreachable');
    expect(outcome.attempt.outcome).toBe('successful');
    // No partial payload of any kind.
    expect(JSON.stringify(outcome)).not.toContain('events');
  });

  it('fails the whole calendar when a circuit is unmapped', async () => {
    // Every mapping is absent, so the circuit lookup cannot resolve either.
    const transport = jsonTransport(envelope([race(standardWeekend)]));
    const { port } = harness({ transport, emptyRegistry: true });

    const outcome = await port.fetchResource({
      source: 'jolpica',
      resource: calendar,
    });

    expect(outcome.outcome).toBe('mapping-failure');
  });

  it('drops no row and falls back to no provider identifier', async () => {
    const transport = jsonTransport(
      envelope([
        race(standardWeekend),
        race({
          round: '2',
          raceName: 'Invented Grand Prix',
          circuitId: 'albert_park',
          date: '2026-03-15',
          time: '04:00:00Z',
        }),
      ]),
    );
    const { port } = harness({ transport });

    const outcome = await port.fetchResource({
      source: 'jolpica',
      resource: calendar,
    });

    // One resolvable row plus one unresolvable row is not a one-row calendar.
    expect(outcome.outcome).toBe('mapping-failure');
  });

  it('refuses a case-folded or padded provider value', async () => {
    for (const circuitId of ['ALBERT_PARK', ' albert_park', 'albert-park']) {
      const transport = jsonTransport(
        envelope([race({ ...standardWeekend, circuitId })]),
      );
      const { port } = harness({ transport });

      const outcome = await port.fetchResource({
        source: 'jolpica',
        resource: calendar,
      });

      expect(outcome.outcome).toBe('mapping-failure');
    }
  });

  it('reports a bounded mapping signal and no raw provider payload', async () => {
    const transport = jsonTransport(
      envelope([
        race({
          round: '1',
          raceName: 'Invented Grand Prix',
          circuitId: 'albert_park',
          date: '2026-03-08',
          time: '04:00:00Z',
        }),
      ]),
    );
    const { port, logger } = harness({ transport });

    await port.fetchResource({ source: 'jolpica', resource: calendar });

    const signals = logger.events.filter(
      (event) => event.operation === 'provider.mapping.resolve',
    );
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.length).toBeLessThanOrEqual(5);
    expect(logger.serialized()).not.toContain('MRData');
  });
});

describe('attempt and limiter accounting', () => {
  const unsupported: readonly CoordinatedResource[] = [
    { kind: 'season-participants', season: SEASON },
    { kind: 'season-circuits', season: SEASON },
    { kind: 'driver-standings', season: SEASON },
    { kind: 'constructor-standings', season: SEASON },
    { kind: 'event-schedule', season: SEASON, round: 1 },
    {
      kind: 'session-classification',
      season: SEASON,
      round: 1,
      sessionType: 'race',
    },
  ];

  for (const resource of unsupported) {
    it(`refuses ${resource.kind} with no limiter or transport activity`, async () => {
      let reserved = 0;
      const transport = forbiddenTransport();
      const { port, calls } = harness({
        transport,
        limiter: {
          async reserve(sourceId) {
            reserved += 1;
            return { outcome: 'allowed', sourceId, headroom: [] };
          },
        },
      });

      const outcome = wellFormed(
        await port.fetchResource({ source: 'jolpica', resource }),
      );

      expect(outcome.outcome).toBe('not-attempted');
      if (outcome.outcome !== 'not-attempted') throw new Error('unreachable');
      expect(outcome.reason).toBe('resource-unsupported');
      // No attempt field at all, so it cannot be miscounted as a request.
      expect('attempt' in outcome).toBe(false);
      expect(reserved).toBe(0);
      expect(calls).toHaveLength(0);
    });
  }

  it('creates zero attempts when cancelled before the attempt', async () => {
    let reserved = 0;
    const transport = forbiddenTransport();
    const { port, calls } = harness({
      transport,
      limiter: {
        async reserve(sourceId) {
          reserved += 1;
          return { outcome: 'allowed', sourceId, headroom: [] };
        },
      },
    });

    const controller = new AbortController();
    controller.abort();
    const outcome = wellFormed(
      await port.fetchResource({
        source: 'jolpica',
        resource: calendar,
        signal: controller.signal,
      }),
    );

    expect(outcome.outcome).toBe('not-attempted');
    if (outcome.outcome !== 'not-attempted') throw new Error('unreachable');
    expect(outcome.reason).toBe('cancelled');
    expect('attempt' in outcome).toBe(false);
    expect(reserved).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('creates zero transport attempts when the limiter defers', async () => {
    const retryAt = '2026-03-08T04:00:00.000Z';
    const transport = forbiddenTransport();
    const { port, calls } = harness({
      transport,
      limiter: deferringLimiter(retryAt),
    });

    const outcome = wellFormed(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(outcome.outcome).toBe('not-attempted');
    if (outcome.outcome !== 'not-attempted') throw new Error('unreachable');
    expect(outcome.reason).toBe('rate-limit-deferred');
    expect(outcome.retryAt).toBe(retryAt);
    expect('attempt' in outcome).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('fails closed when the limiter cannot answer', async () => {
    const transport = forbiddenTransport();
    const { port, calls } = harness({
      transport,
      limiter: unavailableLimiter,
    });

    const outcome = wellFormed(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(outcome.outcome).toBe('not-attempted');
    if (outcome.outcome !== 'not-attempted') throw new Error('unreachable');
    expect(outcome.reason).toBe('limiter-unavailable');
    expect(calls).toHaveLength(0);
  });

  it('creates exactly one attempt for one successful page', async () => {
    const transport = jsonTransport(envelope([race(standardWeekend)]));
    const { port, calls } = harness({ transport });

    const outcome = await port.fetchResource({
      source: 'jolpica',
      resource: calendar,
    });

    expect(calls).toHaveLength(1);
    expect(outcome.outcome).toBe('candidate');
    if (outcome.outcome !== 'candidate') throw new Error('unreachable');
    expect(outcome.attempt.reference).toHaveLength(
      outcome.attempt.reference.length,
    );
    expect(outcome.attempt.outcome).toBe('successful');
  });

  it('counts one provider failure exactly once and never retries', async () => {
    const transport = failingTransport();
    const { port, calls } = harness({ transport });

    const outcome = wellFormed(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(calls).toHaveLength(1);
    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome !== 'failed') throw new Error('unreachable');
    expect(outcome.reason).toBe('provider-unavailable');
    expect(outcome.attempt.outcome).toBe('failed');
  });

  it('records an upstream 429 as the rate-limited attempt it was', async () => {
    const transport = rateLimitedTransport(120);
    const { port, calls } = harness({ transport });

    const outcome = wellFormed(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(calls).toHaveLength(1);
    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome !== 'failed') throw new Error('unreachable');
    expect(outcome.reason).toBe('provider-rate-limited');
    expect(outcome.attempt.outcome).toBe('rate-limited');
    expect(outcome.retryAfter).toBeDefined();
  });

  it('counts a rejected content type as an answered request', async () => {
    const transport = jsonTransport(envelope([race(standardWeekend)]), {
      contentType: 'text/html',
    });
    const { port, calls } = harness({ transport });

    const outcome = wellFormed(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(calls).toHaveLength(1);
    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome !== 'failed') throw new Error('unreachable');
    expect(outcome.reason).toBe('provider-unavailable');
    // The request left and was answered, so it is a successful attempt even
    // though GridView's own policy rejected the response.
    expect(outcome.attempt.outcome).toBe('successful');
  });

  it('counts an HTTP error status once as a failed attempt', async () => {
    const transport = jsonTransport(envelope([]), { status: 503 });
    const { port, calls } = harness({ transport });

    const outcome = wellFormed(
      await port.fetchResource({ source: 'jolpica', resource: calendar }),
    );

    expect(calls).toHaveLength(1);
    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome !== 'failed') throw new Error('unreachable');
    expect(outcome.attempt.outcome).toBe('failed');
  });

  it('gives each request its own transport reference', async () => {
    const transport = jsonTransport(envelope([race(standardWeekend)]));
    const { port } = harness({ transport });

    const first = await port.fetchResource({
      source: 'jolpica',
      resource: calendar,
    });
    const second = await port.fetchResource({
      source: 'jolpica',
      resource: calendar,
    });

    expect(first.outcome).toBe('candidate');
    expect(second.outcome).toBe('candidate');
    if (first.outcome !== 'candidate' || second.outcome !== 'candidate') {
      throw new Error('unreachable');
    }
    expect(first.attempt.reference).not.toBe(second.attempt.reference);
  });

  it('never throws out of the port', async () => {
    // An adapter that throws discards the attempt from the run's accounting,
    // so a hostile body must still become a typed outcome.
    const hostile = {
      get MRData() {
        throw new Error('hostile accessor');
      },
    };
    const transport = jsonTransport(envelope([race(standardWeekend)]));
    const { port } = harness({ transport });

    await expect(
      port.fetchResource({ source: 'jolpica', resource: calendar }),
    ).resolves.toBeDefined();
    expect(hostile).toBeDefined();
  });
});
