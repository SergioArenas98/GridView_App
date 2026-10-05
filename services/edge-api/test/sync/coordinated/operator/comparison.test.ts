/**
 * The OD-7 comparison (PR-E3): counts, sorted canonical driver IDs and
 * changed `RaceResult` field names against the **published** document, and
 * never a value. Every input here is synthetic; nothing is a provider payload.
 */

import { describe, expect, it } from 'vitest';

import type {
  RaceResult,
  RaceResultEntry,
} from '../../../../src/contract/types';
import type { SeasonPublicationSequencerPort } from '../../../../src/publication/sequencer/port';
import {
  revisionInputForDocument,
  snapshotRevision,
} from '../../../../src/publication/snapshot-revision';
import type {
  SnapshotStorage,
  StoredSnapshot,
} from '../../../../src/storage/types';
import {
  compareWithPublished,
  entryFieldNames,
  resultFieldNames,
} from '../../../../src/sync/coordinated/operator';

const SEASON = 2026;
const ROUND = 4;
const VERSION = '2026.10.05.1';
/** A value that must never appear in any comparison. */
const MARKER = 'VALUE-MARKER-7f3a';

function entry(
  driverId: string,
  position: number,
  overrides: Partial<RaceResultEntry> = {},
): RaceResultEntry {
  return {
    driverId,
    constructorId: 'team-synthetic',
    position,
    gridPosition: position,
    points: Math.max(0, 26 - position),
    status: 'finished',
    laps: 57,
    elapsedTimeMillis: 5_400_000 + position,
    gapToLeaderMillis: position === 1 ? null : position * 1000,
    lapsBehind: 0,
    fastestLap: false,
    dnfReason: null,
    gapText: null,
    ...overrides,
  } as RaceResultEntry;
}

function result(
  entries: RaceResultEntry[],
  overrides: Partial<RaceResult> = {},
): RaceResult {
  return {
    id: `${SEASON}-${ROUND}-race`,
    season: SEASON,
    round: ROUND,
    grandPrixId: 'synthetic-grand-prix',
    sessionType: 'race',
    status: 'final',
    entries,
    fastestLap: { driverId: 'driver-alpha', timeMillis: 91_000, lap: 40 },
    ...overrides,
  } as RaceResult;
}

const base = () =>
  result([
    entry('driver-alpha', 1),
    entry('driver-bravo', 2),
    entry('driver-charlie', 3),
  ]);

function document(data: unknown): StoredSnapshot {
  return {
    data,
    meta: { schemaVersion: 1 } as StoredSnapshot['meta'],
    documentName: `grand-prix:${ROUND}:results`,
    resourceIdentity: `grand-prix:${ROUND}:results`,
  };
}

function sequencer(
  authority: unknown = {
    cutoverState: 'active',
    authoritative: true,
    activeVersion: VERSION,
  },
): SeasonPublicationSequencerPort {
  return {
    readAuthority: async () => {
      if (authority instanceof Error) throw authority;
      return authority;
    },
  } as unknown as SeasonPublicationSequencerPort;
}

function storage(stored: StoredSnapshot | null | Error): SnapshotStorage {
  return {
    readVersionedDocument: async (
      season: number,
      version: string,
      name: string,
    ) => {
      expect([season, version, name]).toEqual([
        SEASON,
        VERSION,
        `grand-prix:${ROUND}:results`,
      ]);
      if (stored instanceof Error) throw stored;
      return stored;
    },
  } as unknown as SnapshotStorage;
}

async function compare(
  observed: RaceResult,
  published: StoredSnapshot | null | Error = document(base()),
  authority?: unknown,
  acceptedRevision: string | null = null,
) {
  return compareWithPublished({
    sequencer: sequencer(authority),
    storage: storage(published),
    season: SEASON,
    round: ROUND,
    observed,
    acceptedRevision,
  });
}

/** Every key path of a value, with array items as `[]`. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => keyPaths(item, `${prefix}[]`));
  }
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return [path, ...keyPaths(child, path)];
  });
}

describe('the OD-7 comparison with the published document', () => {
  it('names nothing when the observation is the published content', async () => {
    const published = document(base());
    const accepted = await snapshotRevision(
      revisionInputForDocument(published),
    );

    expect(await compare(base(), published, undefined, accepted)).toEqual({
      base: 'published',
      status: 'compared',
      publishedIsAccepted: true,
      counts: {
        observedEntries: 3,
        publishedEntries: 3,
        added: 0,
        removed: 0,
        changed: 0,
      },
      drivers: { added: [], removed: [], changed: [] },
      resultFields: [],
      entryFields: [],
    });
  });

  it('counts and names added, removed and changed drivers, and the changed field names only', async () => {
    const observed = result(
      [
        entry('driver-charlie', 1, { points: 26, gapText: MARKER }),
        entry('driver-alpha', 2),
        entry('driver-delta', 3, { dnfReason: MARKER }),
      ],
      { status: 'provisional' as RaceResult['status'] },
    );

    const comparison = await compare(observed);

    expect(comparison).toEqual({
      base: 'published',
      status: 'compared',
      // The base is labelled published, and says it is not the accepted one.
      publishedIsAccepted: false,
      counts: {
        observedEntries: 3,
        publishedEntries: 3,
        added: 1,
        removed: 1,
        changed: 2,
      },
      drivers: {
        added: ['driver-delta'],
        removed: ['driver-bravo'],
        changed: ['driver-alpha', 'driver-charlie'],
      },
      resultFields: ['entries', 'status'],
      entryFields: [
        'elapsedTimeMillis',
        'gapText',
        'gapToLeaderMillis',
        'gridPosition',
        'points',
        'position',
      ],
    });
  });

  it('shows no field value, old or new, and only the closed key paths', async () => {
    const observed = result(
      [
        entry('driver-alpha', 1, { dnfReason: MARKER, gapText: MARKER }),
        entry('driver-bravo', 2, { constructorId: 'team-marker-7f3a' }),
        entry('driver-charlie', 3),
      ],
      { grandPrixId: 'grand-prix-marker-7f3a' },
    );
    const published = document(
      result(
        [
          entry('driver-alpha', 1),
          entry('driver-bravo', 2),
          entry('driver-charlie', 3, { status: 'disqualified' as never }),
        ],
        {
          fastestLap: { driverId: 'driver-bravo', timeMillis: 90_123, lap: 39 },
        },
      ),
    );

    const comparison = await compare(observed, published);
    const text = JSON.stringify(comparison);

    for (const value of [
      MARKER,
      'marker-7f3a',
      'disqualified',
      'provisional',
      'final',
      'finished',
      '90123',
      '91000',
      'team-synthetic',
      'synthetic-grand-prix',
    ]) {
      expect(text, value).not.toContain(value);
    }
    expect(new Set(keyPaths(comparison))).toEqual(
      new Set([
        'base',
        'status',
        'publishedIsAccepted',
        'counts',
        'counts.observedEntries',
        'counts.publishedEntries',
        'counts.added',
        'counts.removed',
        'counts.changed',
        'drivers',
        'drivers.added',
        'drivers.removed',
        'drivers.changed',
        'resultFields',
        'entryFields',
      ]),
    );
    if (comparison.status !== 'compared') throw new Error('not compared');
    // Every name it shows is a canonical driver ID or a closed field name.
    expect(comparison.drivers.changed).toEqual([
      'driver-alpha',
      'driver-bravo',
      'driver-charlie',
    ]);
    for (const field of comparison.resultFields) {
      expect([...resultFieldNames, 'entries']).toContain(field);
    }
    for (const field of comparison.entryFields) {
      expect(entryFieldNames).toContain(field);
    }
    expect(comparison.resultFields).toEqual([
      'entries',
      'fastestLap',
      'grandPrixId',
    ]);
    expect(comparison.entryFields).toEqual([
      'constructorId',
      'dnfReason',
      'gapText',
      'status',
    ]);
  });

  it('names the entries when only their order changed', async () => {
    const [alpha, bravo, charlie] = base().entries;
    const comparison = await compare(result([bravo!, alpha!, charlie!]));

    expect(comparison).toMatchObject({
      status: 'compared',
      counts: { added: 0, removed: 0, changed: 0 },
      resultFields: ['entries'],
      entryFields: [],
    });
  });

  it.each([
    [
      'the authority cannot answer',
      { authority: new Error('down') },
      'authority-unavailable',
    ],
    [
      'the authority is unavailable',
      { authority: { cutoverState: 'unavailable' } },
      'authority-unavailable',
    ],
    [
      'the season is only seeded',
      {
        authority: {
          cutoverState: 'seeded',
          authoritative: false,
          activeVersion: VERSION,
        },
      },
      'authority-not-authoritative',
    ],
    [
      'the document reads as absent',
      { published: null },
      'published-document-unavailable',
    ],
    [
      'the document read throws',
      { published: new Error('kv') },
      'published-document-unavailable',
    ],
    [
      'the document is another round',
      { published: document(result(base().entries, { round: ROUND + 1 })) },
      'published-document-invalid',
    ],
    [
      'the document repeats a driver',
      {
        published: document(
          result([entry('driver-alpha', 1), entry('driver-alpha', 2)]),
        ),
      },
      'published-document-invalid',
    ],
    [
      'a driver ID is not canonical',
      { published: document(result([entry('Driver Alpha', 1)])) },
      'published-document-invalid',
    ],
    [
      'the envelope names another document',
      { published: { ...document(base()), documentName: 'home' } },
      'published-document-invalid',
    ],
    [
      'the observation repeats a driver',
      {
        observed: result([entry('driver-alpha', 1), entry('driver-alpha', 2)]),
      },
      'observed-result-invalid',
    ],
  ] as const)(
    'is unavailable, never invented, when %s',
    async (_, setup, reason) => {
      const options = setup as {
        authority?: unknown;
        published?: StoredSnapshot | null | Error;
        observed?: RaceResult;
      };
      expect(
        await compare(
          options.observed ?? base(),
          'published' in options ? options.published! : document(base()),
          options.authority,
        ),
      ).toEqual({ base: 'published', status: 'unavailable', reason });
    },
  );
});
