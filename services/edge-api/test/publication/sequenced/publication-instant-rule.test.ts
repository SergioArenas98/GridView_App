/**
 * The publication-instant rule in isolation (ADR 0025 D4, amended
 * 2026-10-14): the pure `max(clock, active + 1 ms)` derivation, the
 * candidate's uniform generation reading, the stamp, and the reader of an
 * active release's latest instant. The two-phase integration is covered by
 * `publication-instant.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import { stampPublicationInstant } from '../../../src/publication/sequenced/documents';
import {
  candidateGenerationInstant,
  derivePublicationInstant,
  readActivePublicationInstant,
} from '../../../src/publication/sequenced/publication-instant';
import { FixedClock } from '../../../src/runtime/clock';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import type { StoredSnapshot } from '../../../src/storage/types';
import { SEASON, SidecarReadFailingStorage, generatedSet } from './support';

const ACTIVE = '2026-10-14T16:19:54.572Z';

async function documentsAt(instant: string): Promise<StoredSnapshot[]> {
  const set = await generatedSet(new FixedClock(new Date(instant)), 'v', {
    sourceUpdatedAt: '2026-07-10T00:00:00.000Z',
    contentVersion: '2026.07.10.1',
  });
  return set.documents;
}

function named(
  documents: readonly StoredSnapshot[],
  name: string,
): StoredSnapshot {
  const found = documents.find((document) => document.documentName === name);
  if (!found) throw new Error(`no ${name}`);
  return found;
}

function freshnessOf(document: StoredSnapshot): Record<string, unknown> {
  return (document.data as { freshness: Record<string, unknown> }).freshness;
}

async function storedRelease(
  documents: readonly StoredSnapshot[],
  version = 'v-active',
): Promise<MemorySnapshotStorage> {
  const storage = new MemorySnapshotStorage();
  for (const document of documents) {
    await storage.writeVersionedDocument(SEASON, version, document);
  }
  await storage.writeVersionInventory(
    SEASON,
    version,
    documents.map((document) => document.documentName),
  );
  return storage;
}

describe('deriving the publication instant', () => {
  it('keeps a clock reading strictly later than the active release', () => {
    expect(
      derivePublicationInstant('2026-10-14T16:20:00.000Z', ACTIVE),
    ).toEqual({ kind: 'derived', generatedAt: '2026-10-14T16:20:00.000Z' });
  });

  it('steps one millisecond past the active release on an equal clock', () => {
    expect(derivePublicationInstant(ACTIVE, ACTIVE)).toEqual({
      kind: 'derived',
      generatedAt: '2026-10-14T16:19:54.573Z',
    });
  });

  it('steps one millisecond past the active release on a backwards clock', () => {
    expect(
      derivePublicationInstant('2026-10-14T15:00:00.000Z', ACTIVE),
    ).toEqual({ kind: 'derived', generatedAt: '2026-10-14T16:19:54.573Z' });
  });

  it('compares equivalent spellings as one instant', () => {
    expect(
      derivePublicationInstant(ACTIVE, '2026-10-14T17:19:54.572+01:00'),
    ).toEqual({ kind: 'derived', generatedAt: '2026-10-14T16:19:54.573Z' });
  });

  it('floors a sub-millisecond active instant, so the step is still later', () => {
    expect(
      derivePublicationInstant(
        '2026-10-14T16:19:54.000Z',
        '2026-10-14T16:19:54.5725Z',
      ),
    ).toEqual({ kind: 'derived', generatedAt: '2026-10-14T16:19:54.573Z' });
  });

  it('refuses a step past the representable year range as exhausted', () => {
    expect(
      derivePublicationInstant(ACTIVE, '9999-12-31T23:59:59.999Z'),
    ).toEqual({ kind: 'refused', reason: 'exhausted', cause: 'year-range' });
  });

  it('refuses a leap-second active instant it cannot step at millisecond precision', () => {
    expect(
      derivePublicationInstant(
        '2016-12-31T23:59:59.000Z',
        '2016-12-31T23:59:60.500Z',
      ),
    ).toEqual({
      kind: 'refused',
      reason: 'invalid',
      cause: 'leap-second-step',
    });
    // Once the clock is past it, the clock reading is simply used.
    expect(
      derivePublicationInstant(
        '2017-01-01T00:00:01.000Z',
        '2016-12-31T23:59:60.500Z',
      ),
    ).toEqual({ kind: 'derived', generatedAt: '2017-01-01T00:00:01.000Z' });
  });

  it.each([
    ['a malformed clock reading', 'not-a-date', ACTIVE, 'clock-invalid'],
    [
      'a sub-millisecond clock reading',
      '2026-10-14T16:20:00.0001Z',
      ACTIVE,
      'clock-invalid',
    ],
    [
      'a malformed active instant',
      '2026-10-14T16:20:00.000Z',
      'nope',
      'active-instant-invalid',
    ],
  ])('refuses %s as invalid', (_label, clock, active, cause) => {
    expect(derivePublicationInstant(clock, active)).toEqual({
      kind: 'refused',
      reason: 'invalid',
      cause,
    });
  });
});

describe("a candidate's generation instant", () => {
  it('is the one reading every document and Home freshness carry', async () => {
    const documents = await documentsAt(ACTIVE);
    expect(candidateGenerationInstant(documents)).toBe(ACTIVE);
  });

  it('is unknown when two documents disagree', async () => {
    const documents = await documentsAt(ACTIVE);
    const drifted = documents.map((document) =>
      document.documentName === 'circuits'
        ? {
            ...document,
            meta: { ...document.meta, generatedAt: '2026-10-14T16:19:54.573Z' },
          }
        : document,
    );
    expect(candidateGenerationInstant(drifted)).toBeNull();
  });

  it("is unknown when Home's freshness disagrees with its meta", async () => {
    const documents = await documentsAt(ACTIVE);
    const home = named(documents, 'home');
    const drifted = documents.map((document) =>
      document === home
        ? {
            ...home,
            data: {
              ...(home.data as object),
              freshness: { ...freshnessOf(home), generatedAt: 'later' },
            },
          }
        : document,
    );
    expect(candidateGenerationInstant(drifted)).toBeNull();
  });
});

function withNestedHomeInstant(
  documents: readonly StoredSnapshot[],
  instant: string,
): StoredSnapshot[] {
  return documents.map((document) => {
    if (document.documentName !== 'bootstrap') return document;
    const data = document.data as { home: { freshness: object } };
    return {
      ...document,
      data: {
        ...data,
        home: {
          ...data.home,
          freshness: { ...data.home.freshness, generatedAt: instant },
        },
      },
    };
  });
}

function nestedFreshnessOf(document: StoredSnapshot): Record<string, unknown> {
  return (document.data as { home: { freshness: Record<string, unknown> } })
    .home.freshness;
}

describe("the bootstrap's copy of Home", () => {
  it('makes a candidate unknown when its freshness disagrees', async () => {
    const documents = await documentsAt(ACTIVE);
    expect(
      candidateGenerationInstant(
        withNestedHomeInstant(documents, '2026-10-14T16:19:54.573Z'),
      ),
    ).toBeNull();
  });

  it('is stamped with the instant and the bootstrap staleAfter', async () => {
    const documents = await documentsAt(ACTIVE);
    const instant = '2026-10-14T16:19:54.573Z';
    const bootstrap = named(
      stampPublicationInstant(documents, instant) ?? [],
      'bootstrap',
    );
    expect(nestedFreshnessOf(bootstrap)).toMatchObject({
      generatedAt: instant,
      staleAfter: bootstrap.meta.staleAfter,
    });
  });

  it('is restamped even when the bootstrap meta already carries the instant', async () => {
    const documents = withNestedHomeInstant(
      await documentsAt(ACTIVE),
      '2026-10-14T16:00:00.000Z',
    );
    const bootstrap = named(
      stampPublicationInstant(documents, ACTIVE) ?? [],
      'bootstrap',
    );
    expect(nestedFreshnessOf(bootstrap).generatedAt).toBe(ACTIVE);
  });

  it('counts toward the active release instant', async () => {
    const later = '2026-10-14T16:40:00.000Z';
    const storage = await storedRelease(
      withNestedHomeInstant(await documentsAt(ACTIVE), later),
    );
    expect(
      await readActivePublicationInstant(storage, SEASON, 'v-active'),
    ).toEqual({ kind: 'instant', value: later });
  });
});

describe('stamping the instant', () => {
  it('returns every document untouched when it already carries the instant', async () => {
    const documents = await documentsAt(ACTIVE);
    const stamped = stampPublicationInstant(documents, ACTIVE);
    expect(stamped).not.toBeNull();
    stamped?.forEach((document, index) => {
      expect(document).toBe(documents[index]);
    });
  });

  it('moves meta and Home freshness together, preserving each interval', async () => {
    const documents = await documentsAt(ACTIVE);
    const instant = '2026-10-14T16:19:54.573Z';
    const stamped = stampPublicationInstant(documents, instant) ?? [];

    for (const document of stamped) {
      expect(document.meta.generatedAt, document.documentName).toBe(instant);
    }
    expect(named(stamped, 'calendar').meta.staleAfter).toBe(
      '2026-10-14T16:34:54.573Z',
    );
    // The manifest keeps its one-hour interval.
    expect(named(stamped, 'content:manifest').meta.staleAfter).toBe(
      '2026-10-14T17:19:54.573Z',
    );
    const home = named(stamped, 'home');
    expect(freshnessOf(home)).toMatchObject({
      generatedAt: instant,
      staleAfter: home.meta.staleAfter,
    });
    // `sourceUpdatedAt` and `contentVersion` are not the stamp's to move.
    stamped.forEach((document, index) => {
      expect(document.meta.sourceUpdatedAt).toBe(
        documents[index]?.meta.sourceUpdatedAt,
      );
      expect(document.meta.contentVersion).toBe(
        documents[index]?.meta.contentVersion,
      );
    });
  });

  it('refuses when a derived staleAfter would leave the year range', async () => {
    const documents = await documentsAt(ACTIVE);
    expect(
      stampPublicationInstant(documents, '9999-12-31T23:59:00.000Z'),
    ).toBeNull();
  });
});

describe("reading the active release's instant", () => {
  it('is the latest instant any of its documents carries', async () => {
    const documents = await documentsAt(ACTIVE);
    // A release committed before the rule is not promised to be uniform.
    const later = '2026-10-14T16:25:00.000Z';
    const mixed = documents.map((document) =>
      document.documentName === 'grand-prix:14'
        ? { ...document, meta: { ...document.meta, generatedAt: later } }
        : document,
    );
    const storage = await storedRelease(mixed);
    expect(
      await readActivePublicationInstant(storage, SEASON, 'v-active'),
    ).toEqual({ kind: 'instant', value: later });
  });

  it("counts Home's embedded freshness instant", async () => {
    const documents = await documentsAt(ACTIVE);
    const later = '2026-10-14T16:30:00.000Z';
    const home = named(documents, 'home');
    const storage = await storedRelease(
      documents.map((document) =>
        document === home
          ? {
              ...home,
              data: {
                ...(home.data as object),
                freshness: { ...freshnessOf(home), generatedAt: later },
              },
            }
          : document,
      ),
    );
    expect(
      await readActivePublicationInstant(storage, SEASON, 'v-active'),
    ).toEqual({ kind: 'instant', value: later });
  });

  it('is unavailable when a document reads as absent or the inventory cannot be read', async () => {
    const storage = new SidecarReadFailingStorage(
      await storedRelease(await documentsAt(ACTIVE)),
    );
    storage.hiddenDocuments.add('v-active|circuits');
    expect(
      await readActivePublicationInstant(storage, SEASON, 'v-active'),
    ).toEqual({ kind: 'unavailable' });

    storage.hiddenDocuments.clear();
    storage.unreadableInventories.add('v-active');
    expect(
      await readActivePublicationInstant(storage, SEASON, 'v-active'),
    ).toEqual({ kind: 'unavailable' });
  });

  it('is invalid when a document carries an instant that cannot be ordered', async () => {
    const documents = await documentsAt(ACTIVE);
    const storage = await storedRelease(
      documents.map((document) =>
        document.documentName === 'drivers'
          ? { ...document, meta: { ...document.meta, generatedAt: 'garbage' } }
          : document,
      ),
    );
    expect(
      await readActivePublicationInstant(storage, SEASON, 'v-active'),
    ).toEqual({ kind: 'invalid' });
  });
});
