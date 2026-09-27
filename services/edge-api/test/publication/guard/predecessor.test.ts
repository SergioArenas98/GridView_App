/**
 * Reading the authoritative predecessor's guard from its immutable versioned
 * documents (ADR 0026 D14-D16).
 *
 * Missing or unreadable data is `unavailable` and invalid data is `invalid` -
 * neither is ever an empty predecessor. The revisions returned are the ones
 * `prepare` compares against the sequencer's committed rows.
 */

import { describe, expect, it } from 'vitest';

import { readPredecessorGuard } from '../../../src/publication/guard/predecessor';
import {
  revisionInputForDocument,
  snapshotRevision,
} from '../../../src/publication/snapshot-revision';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../../src/storage/types';
import {
  ROUND_ONE,
  ROUND_TWO,
  SEASON,
  calendarDocument,
  classifiedRound,
  stored,
  unavailableRound,
} from './support';

const VERSION = 'v-predecessor';

async function release(
  documents: readonly StoredSnapshot[],
  names: readonly string[] = documents.map((document) => document.documentName),
): Promise<MemorySnapshotStorage> {
  const storage = new MemorySnapshotStorage();
  for (const document of documents) {
    await storage.writeVersionedDocument(SEASON, VERSION, document);
  }
  await storage.writeVersionInventory(
    SEASON,
    VERSION,
    names as SnapshotDocumentName[],
  );
  return storage;
}

/** A storage view whose reads of the named keys throw. */
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

describe('reading the predecessor guard', () => {
  it('derives the guard and binds every results document, in canonical order', async () => {
    const documents = [
      calendarDocument(),
      unavailableRound(10),
      classifiedRound(2, ROUND_TWO),
      classifiedRound(1, ROUND_ONE),
    ];
    const read = await readPredecessorGuard(
      await release(documents),
      SEASON,
      VERSION,
    );
    if (read.kind !== 'read') throw new Error('expected a read predecessor');

    expect(read.guard.classifiedRounds).toEqual([1, 2]);
    expect(read.guard.facts).toHaveLength(ROUND_ONE.length + ROUND_TWO.length);
    // Every results document - classified or not - and nothing else, sorted by
    // UTF-8 bytes: `0` (0x30) precedes `:` (0x3a), so `grand-prix:10:…` sorts
    // before `grand-prix:1:…`, which sorts before `grand-prix:2:…`.
    const expected = [];
    for (const document of [documents[1]!, documents[3]!, documents[2]!]) {
      expected.push({
        documentName: document.documentName,
        revision: await snapshotRevision(revisionInputForDocument(document)),
      });
    }
    expect(read.guardDocuments).toEqual(expected);
  });

  it('reads a zero-classified predecessor as an empty guard, not as absent', async () => {
    const read = await readPredecessorGuard(
      await release([calendarDocument(), unavailableRound(1)]),
      SEASON,
      VERSION,
    );
    expect(read).toMatchObject({
      kind: 'read',
      guard: { classifiedRounds: [], facts: [] },
    });
  });

  it('reads nothing but the inventory and the results documents', async () => {
    // The calendar is named but was never written: it is not a guard input.
    const storage = await release(
      [classifiedRound(1, ROUND_ONE)],
      ['calendar', 'grand-prix:1:results'],
    );
    expect((await readPredecessorGuard(storage, SEASON, VERSION)).kind).toBe(
      'read',
    );
  });
});

describe('an unreadable predecessor is unavailable, never empty', () => {
  it('when the inventory is absent', async () => {
    const storage = new MemorySnapshotStorage();
    await storage.writeVersionedDocument(
      SEASON,
      VERSION,
      classifiedRound(1, ROUND_ONE),
    );
    expect(await readPredecessorGuard(storage, SEASON, VERSION)).toEqual({
      kind: 'unavailable',
    });
  });

  it('when the inventory read fails', async () => {
    const storage = throwingOn(await release([classifiedRound(1, ROUND_ONE)]), {
      inventory: true,
    });
    expect(await readPredecessorGuard(storage, SEASON, VERSION)).toEqual({
      kind: 'unavailable',
    });
  });

  it('when a results document is absent', async () => {
    const storage = await release(
      [classifiedRound(1, ROUND_ONE)],
      ['grand-prix:1:results', 'grand-prix:2:results'],
    );
    expect(await readPredecessorGuard(storage, SEASON, VERSION)).toEqual({
      kind: 'unavailable',
    });
  });

  it('when a results document read fails', async () => {
    const storage = throwingOn(await release([classifiedRound(1, ROUND_ONE)]), {
      document: 'grand-prix:1:results',
    });
    expect(await readPredecessorGuard(storage, SEASON, VERSION)).toEqual({
      kind: 'unavailable',
    });
  });
});

describe('an invalid predecessor fails closed', () => {
  const cases: Array<[string, () => Promise<SnapshotStorage>]> = [
    [
      'a malformed inventory',
      async () =>
        new Proxy(await release([classifiedRound(1, ROUND_ONE)]), {
          get(target, property, receiver) {
            if (property === 'readVersionInventory') return async () => 42;
            const value: unknown = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        }),
    ],
    ['an empty inventory', async () => release([], [])],
    [
      'an inventory naming a results document twice',
      async () =>
        release(
          [classifiedRound(1, ROUND_ONE)],
          ['grand-prix:1:results', 'grand-prix:1:results'],
        ),
    ],
    [
      'a document stored under another name',
      async () => renamedOnRead(await release([classifiedRound(1, ROUND_ONE)])),
    ],
    [
      'a document with no envelope meta',
      async () =>
        release([
          { ...classifiedRound(1, ROUND_ONE), meta: undefined as never },
        ]),
    ],
    [
      'a malformed results body',
      async () =>
        release([stored('grand-prix:1:results', { status: 'final' })]),
    ],
    [
      'a duplicate driver row',
      async () =>
        release([
          classifiedRound(1, [
            ['max-verstappen', 'red-bull'],
            ['max-verstappen', 'red-bull'],
          ]),
        ]),
    ],
    [
      'an out-of-range round',
      async () =>
        release([
          stored('grand-prix:101:results', {
            ...(classifiedRound(1, ROUND_ONE).data as object),
            round: 101,
          }),
        ]),
    ],
  ];

  it.each(cases)('on %s', async (_label, build) => {
    expect(await readPredecessorGuard(await build(), SEASON, VERSION)).toEqual({
      kind: 'invalid',
    });
  });
});

/** A view whose document reads return an envelope claiming another name. */
function renamedOnRead(inner: MemorySnapshotStorage): SnapshotStorage {
  return new Proxy(inner, {
    get(target, property, receiver) {
      if (property === 'readVersionedDocument') {
        return async (season: number, version: string, name: string) => {
          const document = await target.readVersionedDocument(
            season,
            version,
            name as SnapshotDocumentName,
          );
          return (
            document && { ...document, documentName: 'grand-prix:2:results' }
          );
        };
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
