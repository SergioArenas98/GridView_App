/**
 * The `calendar-horizon` freshness policy (ADR 0005, amendment of
 * 2026-10-19): the horizon a release's own documents imply, how the stamp
 * applies it, and what a client is served after an ordinary publication and a
 * rollback republication. The `interval` policy is covered, unchanged, by
 * `publication-instant-rule.test.ts` and `publication-instant.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import { handlePublicRequest } from '../../../src/public/router';
import { stampPublicationInstant } from '../../../src/publication/sequenced/documents';
import {
  calendarHorizon,
  freshnessPolicyFor,
  SEASON_COMPLETE_STALE_AFTER,
} from '../../../src/publication/sequenced/freshness-horizon';
import { SequencedPublicationService } from '../../../src/publication/sequenced/service';
import { readStoredInventory } from '../../../src/publication/version-inventory';
import { FixedClock } from '../../../src/runtime/clock';
import type { GeneratedSnapshotSet } from '../../../src/snapshots/generator';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../../src/storage/types';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import {
  SEASON,
  generatedSet,
  sequencedContext,
  type SequencedContext,
} from './support';

/** The seed instant every sequenced context starts from. */
const SEED_INSTANT = '2026-07-20T12:00:00.000Z';
/** Round 13's sprint: the earliest sprint or race the mock season leaves open. */
const ROUND_13_SPRINT = '2026-07-25T10:00:00.000Z';
const ROUND_13_RACE = '2026-07-26T13:00:00.000Z';
const ROUND_14_RACE = '2026-08-09T14:00:00.000Z';

const at = (instant: string) => new FixedClock(new Date(instant));
const session = (instant: string) => ({
  kind: 'session',
  at: Date.parse(instant),
});
const UNDETERMINED = { kind: 'undetermined' };

type Event = Record<string, unknown> & { sessions: Record<string, unknown>[] };

/** Rewrites one `grand-prix:<round>` document's event, leaving the rest. */
function withEvent(
  documents: readonly StoredSnapshot[],
  round: number,
  change: (event: Event) => unknown,
): StoredSnapshot[] {
  return documents.map((document) =>
    document.documentName === `grand-prix:${round}`
      ? { ...document, data: change(document.data as Event) }
      : document,
  );
}

/**
 * The mock season made boundable: round 12 is classified, 13 (a sprint
 * weekend) is ahead, 14 races on its own date (the mock reuses round 12's
 * session times for it), and the postponed, untimed round 15 is cancelled
 * like round 16.
 */
function boundable(documents: readonly StoredSnapshot[]): StoredSnapshot[] {
  const raced = withEvent(documents, 14, (event) => ({
    ...event,
    sessions: event.sessions.map((session) =>
      session.type === 'race'
        ? { ...session, startTime: ROUND_14_RACE }
        : session,
    ),
  }));
  return withEvent(raced, 15, (event) => ({ ...event, status: 'cancelled' }));
}

/** Every event of the boundable season settled: rounds 13 and 14 completed. */
function completed(documents: readonly StoredSnapshot[]): StoredSnapshot[] {
  let settled = boundable(documents);
  for (const round of [13, 14]) {
    settled = withEvent(settled, round, (event) => ({
      ...event,
      status: 'completed',
    }));
  }
  return settled;
}

async function documentsAt(instant: string): Promise<StoredSnapshot[]> {
  const set = await generatedSet(at(instant), 'v', {
    sourceUpdatedAt: '2026-07-10T00:00:00.000Z',
    contentVersion: '2026.07.10.1',
  });
  return set.documents;
}

function named(
  documents: readonly StoredSnapshot[],
  name: SnapshotDocumentName,
): StoredSnapshot {
  const found = documents.find((document) => document.documentName === name);
  if (!found) throw new Error(`no ${name}`);
  return found;
}

/** Every `staleAfter` a document carries: its meta and any Home freshness. */
function staleAftersOf(document: StoredSnapshot): unknown[] {
  const data = document.data as {
    freshness?: { staleAfter: unknown };
    home?: { freshness?: { staleAfter: unknown } };
  };
  return [
    document.meta.staleAfter,
    ...(document.documentName === 'home' ? [data.freshness?.staleAfter] : []),
    ...(document.documentName === 'bootstrap'
      ? [data.home?.freshness?.staleAfter]
      : []),
  ];
}

/** The release serves `seasonStaleAfter` everywhere but the manifest. */
function expectStaleAfter(
  documents: readonly StoredSnapshot[],
  seasonStaleAfter: string,
  manifestStaleAfter: string,
): void {
  for (const document of documents) {
    const expected =
      document.documentName === 'content:manifest'
        ? manifestStaleAfter
        : seasonStaleAfter;
    for (const value of staleAftersOf(document)) {
      expect(value, document.documentName).toBe(expected);
    }
  }
}

describe('the calendar horizon of a release', () => {
  it('is the earliest sprint or race start of an event the release leaves open', async () => {
    const documents = boundable(await documentsAt(SEED_INSTANT));
    expect(calendarHorizon(documents)).toEqual(session(ROUND_13_SPRINT));
  });

  it('skips a cancelled sprint, keeping the race', async () => {
    const documents = withEvent(
      boundable(await documentsAt(SEED_INSTANT)),
      13,
      (event) => ({
        ...event,
        sessions: event.sessions.map((session) =>
          session.type === 'sprint'
            ? { ...session, status: 'cancelled' }
            : session,
        ),
      }),
    );
    expect(calendarHorizon(documents)).toEqual(session(ROUND_13_RACE));
  });

  it('ignores an event settled by a classified result, whatever its status', async () => {
    // Round 13 classified while its status still reads `upcoming`: the
    // horizon moves on to round 14's race.
    const documents = withEvent(
      boundable(await documentsAt(SEED_INSTANT)),
      13,
      (event) => ({ ...event, hasResults: true }),
    );
    expect(calendarHorizon(documents)).toEqual(session(ROUND_14_RACE));
  });

  it('is undetermined when an open event has no timed race session', async () => {
    // The mock season as generated: round 15 is postponed with no sessions.
    expect(calendarHorizon(await documentsAt(SEED_INSTANT))).toEqual(
      UNDETERMINED,
    );
  });

  it('is undetermined when an open event only times its sprint', async () => {
    const documents = withEvent(
      boundable(await documentsAt(SEED_INSTANT)),
      14,
      (event) => ({
        ...event,
        sessions: event.sessions.map((session) =>
          session.type === 'race' ? { ...session, startTime: null } : session,
        ),
      }),
    );
    expect(calendarHorizon(documents)).toEqual(UNDETERMINED);
  });

  it('is undetermined when an event document is not shaped as one', async () => {
    const documents = withEvent(
      boundable(await documentsAt(SEED_INSTANT)),
      14,
      () => 'not an event',
    );
    expect(calendarHorizon(documents)).toEqual(UNDETERMINED);
  });

  it('is season-complete when every event is settled or cancelled', async () => {
    const documents = completed(await documentsAt(SEED_INSTANT));
    expect(calendarHorizon(documents)).toEqual({ kind: 'season-complete' });
  });

  it('reads Grand Prix documents only, never their results', async () => {
    const documents = boundable(await documentsAt(SEED_INSTANT));
    expect(
      documents.some((document) => document.documentName.endsWith(':results')),
    ).toBe(true);
    expect(
      calendarHorizon(
        documents.filter(
          (document) => !/^grand-prix:\d+$/.test(document.documentName),
        ),
      ),
    ).toEqual(UNDETERMINED);
  });
});

describe('the policy a Worker stamps with', () => {
  it('is the calendar horizon unless a provider republishes on every run', () => {
    expect(freshnessPolicyFor('none')).toBe('calendar-horizon');
    // The coordinated runtime publishes only changed content (O-12), so a
    // fixed interval would call unchanged data stale between releases.
    expect(freshnessPolicyFor('coordinated')).toBe('calendar-horizon');
    expect(freshnessPolicyFor('mock')).toBe('interval');
  });
});

describe('stamping under the calendar horizon', () => {
  const INSTANT = '2026-07-20T12:00:00.001Z';

  it('gives every document but the manifest the horizon', async () => {
    const documents = boundable(await documentsAt(SEED_INSTANT));
    const stamped = stampPublicationInstant(
      documents,
      INSTANT,
      'calendar-horizon',
    );
    expect(stamped).not.toBeNull();
    expectStaleAfter(
      stamped ?? [],
      ROUND_13_SPRINT,
      '2026-07-20T13:00:00.001Z',
    );
    for (const document of stamped ?? []) {
      expect(document.meta.generatedAt).toBe(INSTANT);
    }
  });

  it('keeps 15 minutes when the horizon is not after the instant', async () => {
    const documents = boundable(await documentsAt(SEED_INSTANT));
    const stamped = stampPublicationInstant(
      documents,
      ROUND_13_SPRINT,
      'calendar-horizon',
    );
    expectStaleAfter(
      stamped ?? [],
      '2026-07-25T10:15:00.000Z',
      '2026-07-25T11:00:00.000Z',
    );
  });

  it('keeps 15 minutes when no horizon can be derived', async () => {
    const stamped = stampPublicationInstant(
      await documentsAt(SEED_INSTANT),
      INSTANT,
      'calendar-horizon',
    );
    expectStaleAfter(
      stamped ?? [],
      '2026-07-20T12:15:00.001Z',
      '2026-07-20T13:00:00.001Z',
    );
  });

  it('never carries a stored horizon-length interval forward', async () => {
    // A release stamped under the horizon, republished after it has passed.
    const published = stampPublicationInstant(
      boundable(await documentsAt(SEED_INSTANT)),
      INSTANT,
      'calendar-horizon',
    );
    const later = '2026-07-27T09:00:00.000Z';
    const republished = stampPublicationInstant(
      published ?? [],
      later,
      'calendar-horizon',
    );
    expectStaleAfter(
      republished ?? [],
      '2026-07-27T09:15:00.000Z',
      '2026-07-27T10:00:00.000Z',
    );
  });

  it('returns a document untouched only when it carries both the instant and the horizon', async () => {
    const stamped =
      stampPublicationInstant(
        boundable(await documentsAt(SEED_INSTANT)),
        INSTANT,
        'calendar-horizon',
      ) ?? [];
    const again =
      stampPublicationInstant(stamped, INSTANT, 'calendar-horizon') ?? [];
    again.forEach((document, index) => {
      expect(document).toBe(stamped[index]);
    });

    // Generated at the instant, so only `staleAfter` differs: restamped.
    const generated = boundable(await documentsAt(INSTANT));
    const restamped =
      stampPublicationInstant(generated, INSTANT, 'calendar-horizon') ?? [];
    expect(named(restamped, 'home')).not.toBe(named(generated, 'home'));
    expectStaleAfter(restamped, ROUND_13_SPRINT, '2026-07-20T13:00:00.001Z');
  });

  it('gives a season-complete release the no-scheduled-event expiry', async () => {
    const stamped = stampPublicationInstant(
      completed(await documentsAt(SEED_INSTANT)),
      INSTANT,
      'calendar-horizon',
    );
    expectStaleAfter(
      stamped ?? [],
      SEASON_COMPLETE_STALE_AFTER,
      '2026-07-20T13:00:00.001Z',
    );
  });

  it('is refused by the interval policy after a mode switch (constraint)', async () => {
    // A season-complete release must not be re-stamped under `interval`: the
    // measured interval would leave the year range. ADR 0005 records this as
    // a constraint on any future provider-mode switch.
    const stamped = stampPublicationInstant(
      completed(await documentsAt(SEED_INSTANT)),
      INSTANT,
      'calendar-horizon',
    );
    expect(
      stampPublicationInstant(
        stamped ?? [],
        '2026-12-20T00:00:00.000Z',
        'interval',
      ),
    ).toBeNull();
  });

  it('refuses when the manifest interval would leave the year range', async () => {
    expect(
      stampPublicationInstant(
        await documentsAt(SEED_INSTANT),
        '9999-12-31T23:59:00.000Z',
        'calendar-horizon',
      ),
    ).toBeNull();
  });
});

async function releaseDocuments(
  storage: SnapshotStorage,
  version: string,
): Promise<StoredSnapshot[]> {
  const inventory = await readStoredInventory(storage, SEASON, version);
  if (inventory.kind !== 'documents') throw new Error('no inventory');
  const documents: StoredSnapshot[] = [];
  for (const name of inventory.documents) {
    const document = await storage.readVersionedDocument(SEASON, version, name);
    if (!document) throw new Error(`missing ${name}`);
    documents.push(document);
  }
  return documents;
}

function serviceAt(
  ctx: SequencedContext,
  instant: string,
): SequencedPublicationService {
  return new SequencedPublicationService({
    port: ctx.port,
    fallback: ctx.legacy,
    storage: ctx.storage,
    validator: runtimeSnapshotValidator,
    purger: ctx.purger,
    logger: ctx.logger,
    clock: at(instant),
    purgeOrigin: 'https://api.gridview.local',
    freshnessPolicy: 'calendar-horizon',
  });
}

/** A batch-like candidate generated at `instant` with a derivable horizon. */
async function boundableSet(
  instant: string,
  contentVersion: string,
): Promise<GeneratedSnapshotSet> {
  const set = await generatedSet(at(instant), 'ignored-by-sequencer', {
    sourceUpdatedAt: '2026-07-20T00:00:00.000Z',
    contentVersion,
  });
  return { ...set, documents: boundable(set.documents) };
}

async function completedSet(
  instant: string,
  contentVersion: string,
): Promise<GeneratedSnapshotSet> {
  const set = await boundableSet(instant, contentVersion);
  return { ...set, documents: completed(set.documents) };
}

async function served(
  ctx: SequencedContext,
  path: string,
): Promise<{ generatedAt: string; staleAfter: string }> {
  const response = await handlePublicRequest(
    new Request(`https://api.gridview.local${path}`),
    ctx.storage,
    'req',
    { mode: 'sequencer', port: ctx.port },
  );
  expect(response.response.status, path).toBe(200);
  const body = (await response.response.json()) as {
    meta: { generatedAt: string; staleAfter: string };
  };
  return body.meta;
}

describe('a manually published season under the calendar horizon', () => {
  it('serves the horizon on season documents and an hour on the manifest', async () => {
    const ctx = await sequencedContext({ freshnessPolicy: 'calendar-horizon' });
    const instant = '2026-07-20T12:05:00.000Z';
    const result = await serviceAt(ctx, instant).publish(
      await boundableSet(instant, '2026.07.20.2'),
    );
    expect(result.status).toBe('applied');

    expectStaleAfter(
      await releaseDocuments(ctx.storage, result.version),
      ROUND_13_SPRINT,
      '2026-07-20T13:05:00.000Z',
    );
    expect(await served(ctx, '/v1/home')).toMatchObject({
      generatedAt: instant,
      staleAfter: ROUND_13_SPRINT,
    });
    expect(await served(ctx, '/v1/seasons/2026/grand-prix/14')).toMatchObject({
      staleAfter: ROUND_13_SPRINT,
    });
    expect(await served(ctx, '/v1/content/manifest')).toMatchObject({
      generatedAt: instant,
      staleAfter: '2026-07-20T13:05:00.000Z',
    });
  });

  it('keeps a completed season current while the manifest still checks hourly', async () => {
    const ctx = await sequencedContext({ freshnessPolicy: 'calendar-horizon' });
    const first = await serviceAt(ctx, '2026-12-07T10:00:00.000Z').publish(
      await completedSet('2026-12-07T10:00:00.000Z', '2026.12.07.1'),
    );
    expect(first.status).toBe('applied');
    expect(await served(ctx, '/v1/home')).toMatchObject({
      staleAfter: SEASON_COMPLETE_STALE_AFTER,
    });
    expect(await served(ctx, '/v1/content/manifest')).toMatchObject({
      generatedAt: '2026-12-07T10:00:00.000Z',
      staleAfter: '2026-12-07T11:00:00.000Z',
    });

    // A later correction is a new release: the manifest the client checks
    // carries its later instant, and the data keeps the same expiry.
    const correction = await serviceAt(ctx, '2026-12-09T09:00:00.000Z').publish(
      await completedSet('2026-12-09T09:00:00.000Z', '2026.12.09.1'),
    );
    expect(correction.status).toBe('applied');
    expect(await served(ctx, '/v1/content/manifest')).toMatchObject({
      generatedAt: '2026-12-09T09:00:00.000Z',
      staleAfter: '2026-12-09T10:00:00.000Z',
    });
    expectStaleAfter(
      await releaseDocuments(ctx.storage, correction.version),
      SEASON_COMPLETE_STALE_AFTER,
      '2026-12-09T10:00:00.000Z',
    );

    // Rolling the correction back under the same policy is not refused.
    const rollback = await serviceAt(ctx, '2026-12-10T09:00:00.000Z').rollback(
      SEASON,
      first.version,
    );
    expect(rollback.status).toBe('applied');
    expectStaleAfter(
      await releaseDocuments(ctx.storage, rollback.version),
      SEASON_COMPLETE_STALE_AFTER,
      '2026-12-10T10:00:00.000Z',
    );
  });

  it('republishes a rollback target with its own absolute horizon', async () => {
    const ctx = await sequencedContext({ freshnessPolicy: 'calendar-horizon' });
    const first = await serviceAt(ctx, '2026-07-20T12:05:00.000Z').publish(
      await boundableSet('2026-07-20T12:05:00.000Z', '2026.07.20.2'),
    );
    expect(first.status).toBe('applied');
    const second = await serviceAt(ctx, '2026-07-21T08:00:00.000Z').publish(
      await boundableSet('2026-07-21T08:00:00.000Z', '2026.07.21.1'),
    );
    expect(second.status).toBe('applied');

    // Three days after the first release, still before its horizon.
    const rollback = await serviceAt(ctx, '2026-07-23T08:00:00.000Z').rollback(
      SEASON,
      first.version,
    );

    expect(rollback.status).toBe('applied');
    expectStaleAfter(
      await releaseDocuments(ctx.storage, rollback.version),
      ROUND_13_SPRINT,
      '2026-07-23T09:00:00.000Z',
    );
  });

  it('keeps 15 minutes on a rollback republished after its horizon', async () => {
    const ctx = await sequencedContext({ freshnessPolicy: 'calendar-horizon' });
    const first = await serviceAt(ctx, '2026-07-20T12:05:00.000Z').publish(
      await boundableSet('2026-07-20T12:05:00.000Z', '2026.07.20.2'),
    );
    expect(first.status).toBe('applied');
    const second = await serviceAt(ctx, '2026-07-21T08:00:00.000Z').publish(
      await boundableSet('2026-07-21T08:00:00.000Z', '2026.07.21.1'),
    );
    expect(second.status).toBe('applied');

    const rollback = await serviceAt(ctx, '2026-07-27T09:00:00.000Z').rollback(
      SEASON,
      first.version,
    );

    expect(rollback.status).toBe('applied');
    expectStaleAfter(
      await releaseDocuments(ctx.storage, rollback.version),
      '2026-07-27T09:15:00.000Z',
      '2026-07-27T10:00:00.000Z',
    );
  });
});
