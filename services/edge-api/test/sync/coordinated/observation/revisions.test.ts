/**
 * The revision an observation is recorded under, and the calendar anchors.
 *
 * A classification revision must be exactly the revision the authoritative
 * release's results document has, or `contentRevision` and `publishedRevision`
 * could never be compared. A refresh revision must change with every field of
 * the payload and with nothing else.
 */

import { describe, expect, it } from 'vitest';

import type { CoordinatedPayload } from '../../../../src/providers/coordination';
import type { GrandPrix, RaceResult } from '../../../../src/contract/types';
import {
  revisionInputForDocument,
  snapshotRevision,
} from '../../../../src/publication/snapshot-revision';
import { FixedClock } from '../../../../src/runtime/clock';
import {
  PUBLISHED_SNAPSHOT_SCHEMA_VERSION,
  calendarAnchorsOf,
  classificationRevision,
  readPublishedRevisions,
  refreshRevision,
} from '../../../../src/sync/coordinated/observation';
import { generatedSet } from '../../../publication/sequenced/support';
import { ObservationHarness, SEASON } from './support';

const SHA = /^sha256:[0-9a-f]{64}$/;

async function generatedResults() {
  const set = await generatedSet(
    new FixedClock(new Date('2026-07-20T12:00:00.000Z')),
    'v-revisions',
  );
  return set.documents.filter((document) =>
    /^grand-prix:\d+:results$/.test(document.documentName),
  );
}

describe('a classification revision', () => {
  it('is the revision of the results document that would publish it', async () => {
    const documents = await generatedResults();
    expect(documents.length).toBeGreaterThan(0);
    for (const document of documents) {
      expect(document.meta.schemaVersion).toBe(
        PUBLISHED_SNAPSHOT_SCHEMA_VERSION,
      );
      expect(await classificationRevision(document.data as RaceResult)).toBe(
        await snapshotRevision(revisionInputForDocument(document)),
      );
    }
  });

  it('is the revision the authority reports for the active release', async () => {
    const harness = await ObservationHarness.create();
    const published = await readPublishedRevisions(
      harness.sequencer,
      harness.storage,
      SEASON,
    );
    if (published.kind !== 'read') throw new Error('authority not read');
    expect(published.activeVersion).toBe('v-seed-legacy');
    expect(published.revisions.length).toBeGreaterThan(0);
    for (const { round, revision } of published.revisions) {
      const document = await harness.storage.readVersionedDocument(
        SEASON,
        'v-seed-legacy',
        `grand-prix:${round}:results`,
      );
      expect(await classificationRevision(document!.data as RaceResult)).toBe(
        revision,
      );
    }
    // Sorted by round.
    const rounds = published.revisions.map(({ round }) => round);
    expect(rounds).toEqual([...rounds].sort((left, right) => left - right));
  });

  it('changes with the content and with the round', async () => {
    const [document] = await generatedResults();
    const result = document!.data as RaceResult;
    const base = await classificationRevision(result);
    expect(base).toMatch(SHA);
    expect(
      await classificationRevision({
        ...result,
        entries: result.entries.slice(1),
      }),
    ).not.toBe(base);
    expect(
      await classificationRevision({ ...result, round: result.round + 1 }),
    ).not.toBe(base);
  });
});

/** A synthetic payload: the revision reads plain data, not the contract. */
const payload = (value: unknown) => value as CoordinatedPayload;

const row = { position: 1, driverId: 'a', points: 10, wins: 1 };
const standings = payload({
  kind: 'driver-standings',
  round: 3,
  standings: [row],
});

describe('a refresh revision', () => {
  it('is a stable digest, independent of key order', async () => {
    const revision = await refreshRevision(standings);
    expect(revision).toMatch(SHA);
    expect(await refreshRevision(structuredClone(standings))).toBe(revision);
    const reordered = payload({
      standings: [{ wins: 1, points: 10, driverId: 'a', position: 1 }],
      round: 3,
      kind: 'driver-standings',
    });
    expect(await refreshRevision(reordered)).toBe(revision);
  });

  it('changes with every field, including the standings round, and with order', async () => {
    const revision = await refreshRevision(standings);
    const variants = [
      { ...standings, round: 4 },
      { ...standings, round: null },
      { ...standings, kind: 'constructor-standings' },
      { ...standings, standings: [{ ...row, wins: 2 }] },
      { ...standings, standings: [{ ...row, points: 10.5 }] },
      { ...standings, standings: [{ ...row, driverId: 'b' }] },
      { ...standings, standings: [row, { ...row, position: 2 }] },
      { ...standings, standings: [] },
    ].map(payload);
    const seen = new Set([revision]);
    for (const variant of variants) {
      const other = await refreshRevision(variant);
      expect(other).toMatch(SHA);
      expect(seen.has(other!)).toBe(false);
      seen.add(other!);
    }
    const two = payload({
      kind: 'season-circuits',
      circuits: [{ id: 'a' }, { id: 'b' }],
    });
    const swapped = payload({
      kind: 'season-circuits',
      circuits: [{ id: 'b' }, { id: 'a' }],
    });
    expect(await refreshRevision(two)).not.toBe(await refreshRevision(swapped));
  });

  it('refuses a payload that is not plain JSON data', async () => {
    const cyclic: Record<string, unknown> = { kind: 'season-circuits' };
    cyclic.circuits = [cyclic];
    const refused: unknown[] = [
      { ...standings, round: Number.NaN },
      { ...standings, round: Number.POSITIVE_INFINITY },
      { ...standings, extra: undefined },
      { ...standings, extra: () => 1 },
      { ...standings, extra: new Date(0) },
      { ...standings, extra: 1n },
      cyclic,
    ];
    for (const value of refused) {
      expect(await refreshRevision(payload(value))).toBeNull();
    }
  });
});

function event(round: number, startTime: string | null, season = SEASON) {
  return {
    season,
    round,
    sessions: [
      { type: 'qualifying', startTime: '2026-03-07T05:00:00Z' },
      { type: 'race', startTime },
    ],
  } as unknown as GrandPrix;
}

const calendar = (events: GrandPrix[]): CoordinatedPayload => ({
  kind: 'season-calendar',
  events,
});

describe('calendar anchors', () => {
  it('are the race starts, sorted by round', () => {
    expect(
      calendarAnchorsOf(
        calendar([
          event(2, '2026-03-15T04:00:00Z'),
          event(1, '2026-03-08T04:00:00Z'),
        ]),
        SEASON,
      ),
    ).toEqual([
      { round: 1, anchor: '2026-03-08T04:00:00.000Z', anchorKind: 'date-time' },
      { round: 2, anchor: '2026-03-15T04:00:00.000Z', anchorKind: 'date-time' },
    ]);
    expect(calendarAnchorsOf(calendar([]), SEASON)).toEqual([]);
  });

  it('refuse a calendar they cannot anchor exactly', () => {
    const twoRaces = event(1, '2026-03-08T04:00:00Z');
    twoRaces.sessions.push({ ...twoRaces.sessions[1]! });
    const noRace = event(1, '2026-03-08T04:00:00Z');
    noRace.sessions.pop();
    const refused: GrandPrix[][] = [
      [event(1, null)],
      [event(1, '2026-03-08')],
      [event(1, '2026-03-08T04:00:00+01:00')],
      [event(1, '2026-02-30T04:00:00Z')],
      [event(1, '2026-03-08T04:00:00Z', SEASON + 1)],
      [event(1, '2026-03-08T04:00:00Z'), event(1, '2026-03-15T04:00:00Z')],
      [event(0, '2026-03-08T04:00:00Z')],
      [event(101, '2026-03-08T04:00:00Z')],
      [event(1.5, '2026-03-08T04:00:00Z')],
      [twoRaces],
      [noRace],
      Array.from({ length: 101 }, (_, index) =>
        event(index + 1, '2026-03-08T04:00:00Z'),
      ),
    ];
    for (const events of refused) {
      expect(calendarAnchorsOf(calendar(events), SEASON)).toBeNull();
    }
    expect(calendarAnchorsOf(standings, SEASON)).toBeNull();
  });
});
