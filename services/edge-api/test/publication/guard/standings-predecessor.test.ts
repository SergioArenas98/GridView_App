/**
 * The read-only A3.5 staging predecessor gate (ADR 0023 A3.5 item 2).
 *
 * A predecessor is coherent when its driver and constructor standings are both
 * non-empty exactly when it has a classified race round. Everything else -
 * disagreement, either direction of mismatch, a missing, unreadable or
 * malformed document, an unavailable or non-sequenced authority - is a bounded
 * refusal, and nothing is ever written.
 *
 * The first half drives the gate over hand-built releases and a stub
 * authority, so each case states exactly what the release holds. The second
 * half runs it against a real sequencer over both transports, seeded from the
 * mock baseline the way staging's season 2026 was.
 */

import { describe, expect, it } from 'vitest';

import type {
  ConstructorStanding,
  DriverStanding,
} from '../../../src/contract/types';
import {
  legacyPublicationAuthority,
  unavailableSequencerAuthority,
  type PublicationAuthority,
} from '../../../src/publication/authority';
import {
  checkStandingsPredecessor,
  maximumStandingsRows,
  standingsPredecessorRefusals,
  type StandingsPredecessorCheck,
} from '../../../src/publication/guard/standings-predecessor';
import type { SeasonAuthority } from '../../../src/publication/sequencer/model';
import type { SeasonPublicationSequencerPort } from '../../../src/publication/sequencer/port';
import type { GeneratedSnapshotSet } from '../../../src/snapshots/generator';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../../src/storage/types';
import {
  SEED_VERSION,
  sequencedContext,
  sequencerTransports,
} from '../sequenced/support';
import {
  ROUND_ONE,
  SEASON,
  calendarDocument,
  classifiedRound,
  stored,
  unavailableRound,
} from './support';

const VERSION = 'v-standings-predecessor';
const OTHER_VERSION = 'v-standings-successor';

function driverRow(
  driverId: string,
  constructorId: string | null,
  position: number,
): DriverStanding {
  return {
    season: SEASON,
    driverId,
    constructorId,
    position,
    points: 30 - position,
    wins: 0,
    podiums: 0,
    provisional: false,
  };
}

function constructorRow(
  constructorId: string,
  position: number,
): ConstructorStanding {
  return {
    season: SEASON,
    constructorId,
    position,
    points: 60 - position,
    wins: 0,
    provisional: false,
  };
}

const DRIVERS: readonly DriverStanding[] = [
  driverRow('max-verstappen', 'red-bull', 1),
  driverRow('lando-norris', 'mclaren', 2),
  driverRow('liam-lawson', null, 3),
];
const CONSTRUCTORS: readonly ConstructorStanding[] = [
  constructorRow('mclaren', 1),
  constructorRow('red-bull', 2),
];

const driverTable = (rows: readonly unknown[] = DRIVERS) =>
  stored('standings:drivers', [...rows]);
const constructorTable = (rows: readonly unknown[] = CONSTRUCTORS) =>
  stored('standings:constructors', [...rows]);

interface ReleaseOptions {
  /** Documents written; defaults to a classified round and both tables. */
  readonly documents?: readonly StoredSnapshot[];
  /** The inventory; defaults to every written document's name. */
  readonly inventory?: readonly string[];
}

async function release(
  options: ReleaseOptions = {},
): Promise<MemorySnapshotStorage> {
  const documents = options.documents ?? [
    calendarDocument(),
    classifiedRound(1, ROUND_ONE),
    unavailableRound(2),
    driverTable(),
    constructorTable(),
  ];
  const storage = new MemorySnapshotStorage();
  for (const document of documents) {
    await storage.writeVersionedDocument(SEASON, VERSION, document);
  }
  await storage.writeVersionInventory(
    SEASON,
    VERSION,
    (options.inventory ??
      documents.map(
        ({ documentName }) => documentName,
      )) as SnapshotDocumentName[],
  );
  return storage;
}

const activeAuthority = (version = VERSION): SeasonAuthority => ({
  cutoverState: 'active',
  authoritative: true,
  activeVersion: version,
  previousVersion: null,
  cutoverFingerprint: 'cutover1:test',
});

/**
 * A sequencer answering `readAuthority` from a script, one answer per call and
 * the last one repeated. Any other command fails the test: the gate may only
 * read the authority.
 */
function scriptedAuthority(
  ...answers: ReadonlyArray<SeasonAuthority | 'throw'>
): { authority: PublicationAuthority; calls: string[] } {
  const calls: string[] = [];
  const port = new Proxy({} as SeasonPublicationSequencerPort, {
    get(_target, property) {
      return async (season: number) => {
        calls.push(String(property));
        if (property !== 'readAuthority') {
          throw new Error(`unexpected sequencer command ${String(property)}`);
        }
        expect(season).toBe(SEASON);
        const answer =
          answers[Math.min(calls.length - 1, answers.length - 1)] ?? 'throw';
        if (answer === 'throw') throw new Error('simulated authority failure');
        return answer;
      };
    },
  });
  return { authority: { mode: 'sequencer', port }, calls };
}

const active = () => scriptedAuthority(activeAuthority()).authority;

const seededAuthority: SeasonAuthority = {
  cutoverState: 'seeded',
  authoritative: false,
  activeVersion: VERSION,
  previousVersion: null,
  cutoverFingerprint: 'cutover1:test',
};

/**
 * A storage view that records every method used and refuses any write or
 * legacy-pointer read, so a test that passes proves the gate read nothing but
 * the version's inventory and documents.
 */
function readOnly(inner: SnapshotStorage): {
  storage: SnapshotStorage;
  used: Set<string>;
} {
  const allowed = new Set(['readVersionInventory', 'readVersionedDocument']);
  const used = new Set<string>();
  const storage = new Proxy(inner, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        used.add(String(property));
        if (!allowed.has(String(property))) {
          throw new Error(`gate used storage.${String(property)}`);
        }
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  return { storage, used };
}

/** A storage view whose named reads throw. */
function throwingOn(
  inner: MemorySnapshotStorage,
  failing: { inventory?: boolean; document?: string },
): SnapshotStorage {
  return new Proxy(inner, {
    get(target, property, receiver) {
      if (property === 'readVersionInventory' && failing.inventory) {
        return async () => {
          throw new Error('simulated inventory read failure');
        };
      }
      if (property === 'readVersionedDocument' && failing.document) {
        return async (season: number, version: string, name: string) => {
          if (name === failing.document) {
            throw new Error('simulated document read failure');
          }
          return target.readVersionedDocument(
            season,
            version,
            name as SnapshotDocumentName,
          );
        };
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

async function check(
  storage: SnapshotStorage,
  authority: PublicationAuthority = active(),
): Promise<StandingsPredecessorCheck> {
  const view = readOnly(storage);
  const result = await checkStandingsPredecessor(
    authority,
    view.storage,
    SEASON,
  );
  expectBounded(result);
  return result;
}

const refusal = (reason: string) => ({
  kind: 'refused',
  season: SEASON,
  reason,
});

/** Only the season, the version and closed values ever leave the gate. */
function expectBounded(result: StandingsPredecessorCheck): void {
  if (result.kind === 'refused') {
    expect(Object.keys(result).sort()).toEqual(['kind', 'reason', 'season']);
    expect(standingsPredecessorRefusals).toContain(result.reason);
  } else {
    expect(Object.keys(result).sort()).toEqual([
      'activeVersion',
      'classifiedRace',
      'kind',
      'season',
      'standings',
    ]);
  }
  const text = JSON.stringify(result);
  for (const identity of [
    'max-verstappen',
    'lando-norris',
    'liam-lawson',
    'mclaren',
    'red-bull',
  ]) {
    expect(text).not.toContain(identity);
  }
}

describe('a coherent predecessor passes', () => {
  it('when both tables have rows and a race round is classified', async () => {
    const storage = await release();
    const writes = storage.writeLog.length;
    const view = readOnly(storage);
    expect(
      await checkStandingsPredecessor(active(), view.storage, SEASON),
    ).toEqual({
      kind: 'coherent',
      season: SEASON,
      activeVersion: VERSION,
      classifiedRace: 'present',
      standings: 'non-empty',
    });
    // Read-only: only the version's own inventory and documents, never the
    // legacy pointers, and nothing written.
    expect([...view.used].sort()).toEqual([
      'readVersionInventory',
      'readVersionedDocument',
    ]);
    expect(storage.writeLog).toHaveLength(writes);
  });

  it('when a provisional race classification is the only classified round', async () => {
    expect(
      await check(
        await release({
          documents: [
            classifiedRound(1, ROUND_ONE, 'provisional'),
            driverTable(),
            constructorTable(),
          ],
        }),
      ),
    ).toMatchObject({ kind: 'coherent', classifiedRace: 'present' });
  });

  it('when the pre-season release has no classified round and two empty tables', async () => {
    expect(
      await check(
        await release({
          documents: [
            calendarDocument(),
            unavailableRound(1),
            driverTable([]),
            constructorTable([]),
          ],
        }),
      ),
    ).toEqual({
      kind: 'coherent',
      season: SEASON,
      activeVersion: VERSION,
      classifiedRace: 'absent',
      standings: 'empty',
    });
  });

  it('when the pre-season release carries no results document at all', async () => {
    expect(
      await check(
        await release({
          documents: [
            calendarDocument(),
            driverTable([]),
            constructorTable([]),
          ],
        }),
      ),
    ).toMatchObject({ kind: 'coherent', classifiedRace: 'absent' });
  });
});

describe('an incoherent predecessor is refused', () => {
  it('when both tables have rows and no race round is classified', async () => {
    // The seeded or mock-derived shape A3.5 warns about: an empty candidate
    // would pass D14 vacuously against it.
    expect(
      await check(
        await release({
          documents: [unavailableRound(1), driverTable(), constructorTable()],
        }),
      ),
    ).toEqual(refusal('standings-without-classified-round'));
  });

  it('when a race round is classified and both tables are empty', async () => {
    expect(
      await check(
        await release({
          documents: [
            classifiedRound(1, ROUND_ONE),
            driverTable([]),
            constructorTable([]),
          ],
        }),
      ),
    ).toEqual(refusal('classified-round-without-standings'));
  });

  it.each([
    [
      'the driver table is empty after a classified race',
      true,
      [],
      CONSTRUCTORS,
    ],
    [
      'the constructor table is empty after a classified race',
      true,
      DRIVERS,
      [],
    ],
    [
      'the driver table is empty before any classified race',
      false,
      [],
      CONSTRUCTORS,
    ],
    [
      'the constructor table is empty before any classified race',
      false,
      DRIVERS,
      [],
    ],
  ] as const)('when %s', async (_label, classified, drivers, constructors) => {
    expect(
      await check(
        await release({
          documents: [
            classified ? classifiedRound(1, ROUND_ONE) : unavailableRound(1),
            driverTable(drivers),
            constructorTable(constructors),
          ],
        }),
      ),
    ).toEqual(refusal('standings-tables-disagree'));
  });
});

describe('a missing or unreadable document is refused, never read as empty', () => {
  const both = [
    classifiedRound(1, ROUND_ONE),
    driverTable(),
    constructorTable(),
  ];

  it.each([
    ['the driver table', [classifiedRound(1, ROUND_ONE), constructorTable()]],
    ['the constructor table', [classifiedRound(1, ROUND_ONE), driverTable()]],
    ['both tables', [classifiedRound(1, ROUND_ONE)]],
  ] as const)(
    'when the release does not name %s',
    async (_label, documents) => {
      expect(await check(await release({ documents }))).toEqual(
        refusal('standings-missing'),
      );
    },
  );

  it.each([
    'standings:drivers',
    'standings:constructors',
    'grand-prix:1:results',
  ])('when %s is named but reads as absent', async (name) => {
    const storage = await release({
      documents: both.filter(({ documentName }) => documentName !== name),
      inventory: both.map(({ documentName }) => documentName),
    });
    expect(await check(storage)).toEqual(refusal('release-unavailable'));
  });

  it.each([
    'standings:drivers',
    'standings:constructors',
    'grand-prix:1:results',
  ])('when reading %s fails', async (document) => {
    expect(
      await check(throwingOn(await release({ documents: both }), { document })),
    ).toEqual(refusal('release-unavailable'));
  });

  it('when the inventory is absent', async () => {
    const storage = new MemorySnapshotStorage();
    for (const document of both) {
      await storage.writeVersionedDocument(SEASON, VERSION, document);
    }
    expect(await check(storage)).toEqual(refusal('release-unavailable'));
  });

  it('when the inventory read fails', async () => {
    expect(
      await check(throwingOn(await release(), { inventory: true })),
    ).toEqual(refusal('release-unavailable'));
  });
});

describe('a malformed document is refused', () => {
  const tooMany = Array.from({ length: maximumStandingsRows + 1 }, (_, index) =>
    driverRow(`driver-${index + 1}`, 'mclaren', index + 1),
  );
  const cases: ReadonlyArray<readonly [string, StoredSnapshot[]]> = [
    [
      'a driver table that is not a list',
      [driverTable(), stored('standings:constructors', { rows: [] })],
    ],
    [
      'a driver row that fails the contract',
      [driverTable([{ ...DRIVERS[0], points: 'ten' }]), constructorTable()],
    ],
    [
      'a constructor row that fails the contract',
      [driverTable(), constructorTable([{ ...CONSTRUCTORS[0], position: 0 }])],
    ],
    [
      'a driver row with an unknown field',
      [driverTable([{ ...DRIVERS[0], round: 12 }]), constructorTable()],
    ],
    [
      'a driver row for another season',
      [
        driverTable([{ ...DRIVERS[0], season: SEASON - 1 }]),
        constructorTable(),
      ],
    ],
    [
      'a constructor row for another season',
      [
        driverTable(),
        constructorTable([{ ...CONSTRUCTORS[0], season: SEASON + 1 }]),
      ],
    ],
    [
      'a driver listed twice',
      [
        driverTable([DRIVERS[0], { ...DRIVERS[0], position: 2 }]),
        constructorTable(),
      ],
    ],
    [
      'a constructor listed twice',
      [
        driverTable(),
        constructorTable([
          CONSTRUCTORS[0],
          { ...CONSTRUCTORS[0], position: 2 },
        ]),
      ],
    ],
    [
      'a driver table over the row bound',
      [driverTable(tooMany), constructorTable()],
    ],
    [
      'a table stored under the other table name',
      [
        driverTable(),
        { ...driverTable(), documentName: 'standings:constructors' },
      ],
    ],
    [
      'a table with no envelope meta',
      [driverTable(), { ...constructorTable(), meta: undefined as never }],
    ],
  ];

  it.each(cases)('on %s', async (_label, tables) => {
    expect(
      await check(
        await release({
          documents: [classifiedRound(1, ROUND_ONE), ...tables],
        }),
      ),
    ).toEqual(refusal('standings-invalid'));
  });

  it('on a malformed race-results document', async () => {
    expect(
      await check(
        await release({
          documents: [
            stored('grand-prix:1:results', { status: 'final' }),
            driverTable(),
            constructorTable(),
          ],
        }),
      ),
    ).toEqual(refusal('release-invalid'));
  });

  it('on an inventory naming a standings document twice', async () => {
    const documents = [
      classifiedRound(1, ROUND_ONE),
      driverTable(),
      constructorTable(),
    ];
    expect(
      await check(
        await release({
          documents,
          inventory: [
            ...documents.map(({ documentName }) => documentName),
            'standings:drivers',
          ],
        }),
      ),
    ).toEqual(refusal('release-invalid'));
  });

  it('on a malformed inventory', async () => {
    const storage = new Proxy(await release(), {
      get(target, property, receiver) {
        if (property === 'readVersionInventory') return async () => 42;
        const value: unknown = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    expect(await check(storage)).toEqual(refusal('release-invalid'));
  });
});

describe('only a sequencer-active, authoritative release is examined', () => {
  it('refuses a legacy authority without reading anything', async () => {
    const view = readOnly(await release());
    expect(
      await checkStandingsPredecessor(
        legacyPublicationAuthority,
        view.storage,
        SEASON,
      ),
    ).toEqual(refusal('authority-not-sequenced'));
    expect(view.used.size).toBe(0);
  });

  it('refuses a selected sequencer that cannot be reached', async () => {
    const view = readOnly(await release());
    expect(
      await checkStandingsPredecessor(
        unavailableSequencerAuthority,
        view.storage,
        SEASON,
      ),
    ).toEqual(refusal('authority-unavailable'));
    expect(view.used.size).toBe(0);
  });

  const notActive: ReadonlyArray<
    readonly [string, SeasonAuthority | 'throw', string]
  > = [
    ['a failed authority read', 'throw', 'authority-unavailable'],
    [
      'an unavailable answer',
      { cutoverState: 'unavailable', authoritative: false },
      'authority-unavailable',
    ],
    [
      'an uninitialized season',
      { cutoverState: 'uninitialized', authoritative: false },
      'authority-not-active',
    ],
    ['a seeded, unactivated season', seededAuthority, 'authority-not-active'],
    [
      'an active answer that is not authoritative',
      { ...activeAuthority(), authoritative: false },
      'authority-not-active',
    ],
  ];

  it.each(notActive)(
    'refuses %s before reading the release',
    async (_label, answer, reason) => {
      const view = readOnly(await release());
      const { authority, calls } = scriptedAuthority(answer);
      expect(
        await checkStandingsPredecessor(authority, view.storage, SEASON),
      ).toEqual(refusal(reason));
      expect(calls).toEqual(['readAuthority']);
      expect(view.used.size).toBe(0);
    },
  );

  it('confirms the release is still active once it has been read', async () => {
    const { authority, calls } = scriptedAuthority(activeAuthority());
    expect((await check(await release(), authority)).kind).toBe('coherent');
    expect(calls).toEqual(['readAuthority', 'readAuthority']);
  });

  it.each([
    [
      'another version became active',
      activeAuthority(OTHER_VERSION),
      'authority-changed',
    ],
    [
      'the season stopped being authoritative',
      { ...activeAuthority(), authoritative: false },
      'authority-changed',
    ],
    ['the authority can no longer answer', 'throw', 'authority-unavailable'],
  ] as const)(
    'refuses a verdict when %s during the check',
    async (_label, after, reason) => {
      const { authority } = scriptedAuthority(activeAuthority(), after);
      expect(await check(await release(), authority)).toEqual(refusal(reason));
    },
  );
});

/** The mock baseline with every race classification made unavailable. */
function unclassified(set: GeneratedSnapshotSet): GeneratedSnapshotSet {
  return {
    ...set,
    documents: set.documents.map((document) =>
      /^grand-prix:\d+:results$/.test(document.documentName)
        ? {
            ...document,
            data: {
              ...(document.data as Record<string, unknown>),
              status: 'unavailable',
              entries: [],
              fastestLap: null,
            },
          }
        : document,
    ),
  };
}

/** A release's two standings tables replaced by empty ones. */
function withoutStandings(set: GeneratedSnapshotSet): GeneratedSnapshotSet {
  return {
    ...set,
    documents: set.documents.map((document) =>
      document.documentName === 'standings:drivers' ||
      document.documentName === 'standings:constructors'
        ? { ...document, data: [] }
        : document,
    ),
  };
}

describe.each(sequencerTransports)(
  'against a real sequencer (%s transport)',
  (transport) => {
    it('passes the mock-style predecessor staging holds: round 12 classified, both tables non-empty', async () => {
      const context = await sequencedContext({ transport });
      const writes = context.storage.writeLog.length;
      const before = await context.port.readAuthority(SEASON);

      const result = await checkStandingsPredecessor(
        { mode: 'sequencer', port: context.port },
        context.storage,
        SEASON,
      );

      expect(result).toEqual({
        kind: 'coherent',
        season: SEASON,
        activeVersion: SEED_VERSION,
        classifiedRace: 'present',
        standings: 'non-empty',
      });
      expectBounded(result);
      // Nothing written, and the authority is exactly as it was.
      expect(context.storage.writeLog).toHaveLength(writes);
      expect(await context.port.readAuthority(SEASON)).toEqual(before);
    });

    it('passes an empty pre-season predecessor', async () => {
      const context = await sequencedContext({
        transport,
        seedTransform: (set) => withoutStandings(unclassified(set)),
      });
      expect(
        await checkStandingsPredecessor(
          { mode: 'sequencer', port: context.port },
          context.storage,
          SEASON,
        ),
      ).toMatchObject({
        kind: 'coherent',
        classifiedRace: 'absent',
        standings: 'empty',
      });
    });

    it('refuses the mock standings over a release with no classified round', async () => {
      const context = await sequencedContext({
        transport,
        seedTransform: unclassified,
      });
      expect(
        await checkStandingsPredecessor(
          { mode: 'sequencer', port: context.port },
          context.storage,
          SEASON,
        ),
      ).toEqual(refusal('standings-without-classified-round'));
    });

    it('refuses the mock classification with its standings emptied', async () => {
      const context = await sequencedContext({
        transport,
        seedTransform: withoutStandings,
      });
      expect(
        await checkStandingsPredecessor(
          { mode: 'sequencer', port: context.port },
          context.storage,
          SEASON,
        ),
      ).toEqual(refusal('classified-round-without-standings'));
    });

    it.each(['seeded', 'none'] as const)(
      'refuses a season whose cutover is %s, though the legacy pointer names a release',
      async (cutover) => {
        const context = await sequencedContext({ transport, cutover });
        expect(await context.storage.getActiveVersion(SEASON)).toBe(
          SEED_VERSION,
        );
        expect(
          await checkStandingsPredecessor(
            { mode: 'sequencer', port: context.port },
            context.storage,
            SEASON,
          ),
        ).toEqual(refusal('authority-not-active'));
      },
    );
  },
);
