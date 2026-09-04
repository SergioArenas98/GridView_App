import { describe, expect, it } from 'vitest';

import { MockFormulaOneProvider } from '../../../src/providers/mock/mock-provider';
import { FixedClock } from '../../../src/runtime/clock';
import { generateSnapshotSet } from '../../../src/snapshots/generator';
import type { GeneratedSnapshotSet } from '../../../src/snapshots/generator';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import {
  canonicalFormatVersion,
  canonicalRevisionText,
  revisionInputForDocument,
  snapshotRevision,
  snapshotRevisionAlgorithm,
} from '../../../src/publication/snapshot-revision';

const clock = new FixedClock(new Date('2026-07-18T12:00:00.000Z'));

async function seasonSource(
  overrides: { sourceUpdatedAt?: string; contentVersion?: string } = {},
): Promise<ProviderSeasonSource> {
  return new MockFormulaOneProvider({
    clock,
    sourceUpdatedAt: overrides.sourceUpdatedAt,
    contentVersion: overrides.contentVersion,
  }).fetchSeasonSource(2026, [
    'season-calendar',
    'event-schedule',
    'profiles',
    'standings',
    'results',
    'home-rebuild',
  ]);
}

async function revisionsOf(set: GeneratedSnapshotSet) {
  const revisions = new Map<string, string>();
  for (const document of set.documents) {
    revisions.set(
      document.documentName,
      await snapshotRevision(revisionInputForDocument(document)),
    );
  }
  return revisions;
}

describe('snapshot revision identity', () => {
  it('pins the canonical format exactly', () => {
    expect(canonicalFormatVersion).toBe('gv-canon/1');
    expect(
      canonicalRevisionText({
        documentName: 'content:manifest',
        schemaVersion: 1,
        data: {
          contentVersion: '2026.1',
          mediaVersion: null,
          supportedSeasons: [2026],
          attributionVersion: null,
          minimumApiSchemaVersion: 1,
        },
      }),
    ).toBe(
      'gv-canon/1{k4:data{k18:attributionVersionn' +
        'k14:contentVersions6:2026.1' +
        'k12:mediaVersionn' +
        'k23:minimumApiSchemaVersion#1:1' +
        'k16:supportedSeasons[#4:2026]}' +
        'k12:documentNames16:content:manifest' +
        'k13:schemaVersion#1:1}',
    );
  });

  it('pins the hash algorithm and its output encoding', async () => {
    expect(snapshotRevisionAlgorithm).toBe('sha256');
    const input = {
      documentName: 'content:manifest' as const,
      schemaVersion: 1,
      data: {
        contentVersion: '2026.1',
        mediaVersion: null,
        supportedSeasons: [2026],
        attributionVersion: null,
        minimumApiSchemaVersion: 1,
      },
    };
    const text = canonicalRevisionText(input);
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(text),
    );
    const expected = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    expect(await snapshotRevision(input)).toBe(`sha256:${expected}`);
  });

  it('gives every generated document a revision, and the same one twice', async () => {
    const source = await seasonSource();
    const first = await revisionsOf(
      generateSnapshotSet(source, clock.now().toISOString(), 'v1'),
    );
    const second = await revisionsOf(
      generateSnapshotSet(source, clock.now().toISOString(), 'v1'),
    );
    expect(first.size).toBeGreaterThan(10);
    for (const [name, revision] of first) {
      expect(revision).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(second.get(name)).toBe(revision);
    }
  });

  it('does not move when only the generation time changes', async () => {
    const source = await seasonSource();
    const early = await revisionsOf(
      generateSnapshotSet(source, '2026-07-18T12:00:00.000Z', 'v1'),
    );
    const late = await revisionsOf(
      generateSnapshotSet(source, '2026-09-03T09:30:00.000Z', 'v2'),
    );
    for (const [name, revision] of early) {
      expect(late.get(name)).toBe(revision);
    }
  });

  it('does not move when only the provider source timestamp changes', async () => {
    const base = await seasonSource({
      sourceUpdatedAt: '2026-07-18T10:00:00.000Z',
    });
    const shifted = await seasonSource({
      sourceUpdatedAt: '2026-07-18T11:00:00.000Z',
    });
    const before = await revisionsOf(
      generateSnapshotSet(base, '2026-07-18T12:00:00.000Z', 'v1'),
    );
    const after = await revisionsOf(
      generateSnapshotSet(shifted, '2026-07-18T12:00:00.000Z', 'v2'),
    );
    for (const [name, revision] of before) {
      expect(after.get(name)).toBe(revision);
    }
  });

  it('moves the home, bootstrap and manifest revisions when only the curated content version changes, and nothing else', async () => {
    const base = await seasonSource({ contentVersion: '2026.07.18.1' });
    const bumped = await seasonSource({ contentVersion: '2026.09.03.4' });
    const before = await revisionsOf(
      generateSnapshotSet(base, '2026-07-18T12:00:00.000Z', 'v1'),
    );
    const after = await revisionsOf(
      generateSnapshotSet(bumped, '2026-07-18T12:00:00.000Z', 'v2'),
    );

    // `home` carries the curated version only inside `freshness`, which the
    // mock's overrides thread through to `BootstrapData.home.freshness` too
    // (the same generated `home` object), and `bootstrap`/`content:manifest`
    // carry it at their own top level.
    expect(after.get('home')).not.toBe(before.get('home'));
    expect(after.get('bootstrap')).not.toBe(before.get('bootstrap'));
    expect(after.get('content:manifest')).not.toBe(
      before.get('content:manifest'),
    );

    const untouched = [...before.keys()].filter(
      (name) =>
        name !== 'home' && name !== 'bootstrap' && name !== 'content:manifest',
    );
    expect(untouched.length).toBeGreaterThan(0);
    for (const name of untouched) {
      expect(after.get(name)).toBe(before.get(name));
    }
  });

  it('moves for a removal, and only for the documents it touches', async () => {
    const source = await seasonSource();
    const reduced: ProviderSeasonSource = {
      ...source,
      driverStandings: source.driverStandings.slice(0, -1),
    };
    const before = await revisionsOf(
      generateSnapshotSet(source, '2026-07-18T12:00:00.000Z', 'v1'),
    );
    const after = await revisionsOf(
      generateSnapshotSet(reduced, '2026-07-18T12:00:00.000Z', 'v2'),
    );

    expect(after.get('standings:drivers')).not.toBe(
      before.get('standings:drivers'),
    );
    expect(after.get('bootstrap')).not.toBe(before.get('bootstrap'));
    expect(after.get('calendar')).toBe(before.get('calendar'));
    expect(after.get('circuits')).toBe(before.get('circuits'));
    expect(after.get('season')).toBe(before.get('season'));
  });

  it('cannot collide a removal with the snapshot it removed from', async () => {
    const source = await seasonSource();
    const one = await snapshotRevision({
      documentName: 'standings:drivers',
      schemaVersion: 1,
      data: source.driverStandings,
    });
    const fewer = await snapshotRevision({
      documentName: 'standings:drivers',
      schemaVersion: 1,
      data: source.driverStandings.slice(0, -1),
    });
    const empty = await snapshotRevision({
      documentName: 'standings:drivers',
      schemaVersion: 1,
      data: [],
    });
    expect(new Set([one, fewer, empty]).size).toBe(3);
  });

  it('separates snapshot keys carrying identical data', async () => {
    const data = {
      driver: {
        id: 'alex-albon',
        fullName: 'Alex Albon',
        givenName: null,
        familyName: null,
        shortCode: null,
        permanentNumber: null,
        nationality: null,
        countryCode: null,
        dateOfBirth: null,
        placeOfBirth: null,
        biography: null,
        media: null,
      },
      seasonEntry: null,
      constructor: null,
      standing: null,
    };
    const first = await snapshotRevision({
      documentName: 'driver:alex-albon',
      schemaVersion: 1,
      data,
    });
    const second = await snapshotRevision({
      documentName: 'driver:carlos-sainz',
      schemaVersion: 1,
      data,
    });
    expect(second).not.toBe(first);
  });

  it('derives its input from a stored document without reading the envelope', async () => {
    const source = await seasonSource();
    const set = generateSnapshotSet(source, '2026-07-18T12:00:00.000Z', 'v1');
    const document = set.documents.find(
      (candidate) => candidate.documentName === 'season',
    );
    expect(document).toBeDefined();
    const input = revisionInputForDocument(
      document as (typeof set.documents)[number],
    );
    expect(input.documentName).toBe('season');
    expect(input.schemaVersion).toBe(1);
    expect(input.data).toBe(document?.data);
    expect(Object.keys(input).sort()).toEqual([
      'data',
      'documentName',
      'schemaVersion',
    ]);
  });

  it('never throws at its public boundary', async () => {
    await expect(
      snapshotRevision({
        documentName: 'season',
        schemaVersion: Number.NaN,
        data: undefined,
      }),
    ).resolves.toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
