import { describe, expect, it } from 'vitest';

import {
  canonicalRevisionText,
  snapshotRevision,
} from '../../../src/publication/snapshot-revision';
import type { SnapshotRevisionInput } from '../../../src/publication/snapshot-revision';

/**
 * Canonical serialization of the revision input (ADR 0020 D1.7).
 *
 * The input is **constructed** from a schema rather than filtered out of an
 * envelope, so an excluded field is excluded because nothing ever reads it -
 * not because a deny-list happened to name it.
 */

function sessionInput(sessions: unknown): SnapshotRevisionInput {
  return {
    documentName: 'grand-prix:1',
    schemaVersion: 1,
    data: {
      id: 'gp-2026-1',
      season: 2026,
      round: 1,
      eventSlug: 'australian-grand-prix',
      name: 'Australian Grand Prix',
      officialName: null,
      circuitId: 'albert-park',
      status: 'scheduled',
      format: 'conventional',
      startDate: '2026-03-06',
      endDate: '2026-03-08',
      timezone: 'Australia/Melbourne',
      sessions,
      hasResults: false,
      media: null,
    },
  };
}

const session = (id: string, startTime: string | null) => ({
  id,
  type: 'race',
  name: null,
  startTime,
  endTime: null,
  status: 'scheduled',
});

const mediaAsset = (id: string) => ({
  id,
  entityType: 'driver',
  entityId: 'alex-albon',
  category: 'portrait',
  format: 'image',
  variants: { thumbnail: { url: 'https://m.test/a.png', width: 1, height: 1 } },
  aspectRatio: 1,
  version: '1',
  attribution: null,
  license: null,
  fallbackCategory: null,
});

function driverInput(media: unknown): SnapshotRevisionInput {
  return {
    documentName: 'driver:alex-albon',
    schemaVersion: 1,
    data: {
      driver: {
        id: 'alex-albon',
        fullName: 'Alex Albon',
        givenName: 'Alex',
        familyName: 'Albon',
        shortCode: 'ALB',
        permanentNumber: 23,
        nationality: 'Thai',
        countryCode: 'TH',
        dateOfBirth: '1996-03-23',
        placeOfBirth: 'London',
        biography: null,
        media,
      },
      seasonEntry: null,
      constructor: null,
      standing: null,
    },
  };
}

describe('canonical revision serialization', () => {
  it('is independent of property insertion order at every nesting level', () => {
    const straight = canonicalRevisionText(
      sessionInput([session('s1', '2026-03-08T05:00:00Z')]),
    );
    const shuffled = canonicalRevisionText({
      documentName: 'grand-prix:1',
      schemaVersion: 1,
      data: {
        media: null,
        hasResults: false,
        sessions: [
          {
            status: 'scheduled',
            endTime: null,
            startTime: '2026-03-08T05:00:00Z',
            name: null,
            type: 'race',
            id: 's1',
          },
        ],
        timezone: 'Australia/Melbourne',
        endDate: '2026-03-08',
        startDate: '2026-03-06',
        format: 'conventional',
        status: 'scheduled',
        circuitId: 'albert-park',
        officialName: null,
        name: 'Australian Grand Prix',
        eventSlug: 'australian-grand-prix',
        round: 1,
        season: 2026,
        id: 'gp-2026-1',
      },
    });
    expect(shuffled).toBe(straight);
  });

  it('treats an ordered array as content: a permutation is a new revision', () => {
    const forward = canonicalRevisionText(
      sessionInput([session('s1', null), session('s2', null)]),
    );
    const reversed = canonicalRevisionText(
      sessionInput([session('s2', null), session('s1', null)]),
    );
    expect(reversed).not.toBe(forward);
  });

  it('sorts an unordered array by its stable identity', () => {
    const forward = canonicalRevisionText(
      driverInput([mediaAsset('m1'), mediaAsset('m2')]),
    );
    const reversed = canonicalRevisionText(
      driverInput([mediaAsset('m2'), mediaAsset('m1')]),
    );
    expect(reversed).toBe(forward);
  });

  it('still detects an addition, a removal and a membership change', () => {
    const two = canonicalRevisionText(
      driverInput([mediaAsset('m1'), mediaAsset('m2')]),
    );
    const one = canonicalRevisionText(driverInput([mediaAsset('m1')]));
    const swapped = canonicalRevisionText(
      driverInput([mediaAsset('m1'), mediaAsset('m3')]),
    );
    const none = canonicalRevisionText(driverInput([]));
    expect(new Set([two, one, swapped, none]).size).toBe(4);
  });

  it('separates an empty collection from an absent one', () => {
    expect(canonicalRevisionText(driverInput([]))).not.toBe(
      canonicalRevisionText(driverInput(null)),
    );
  });

  it('canonicalizes equivalent instants to one revision', () => {
    const utc = canonicalRevisionText(
      sessionInput([session('s1', '2026-03-08T05:00:00Z')]),
    );
    for (const equivalent of [
      '2026-03-08t05:00:00z',
      '2026-03-08T05:00:00.000Z',
      '2026-03-08T07:00:00+02:00',
      '2026-03-08T00:00:00-05:00',
    ]) {
      expect(
        canonicalRevisionText(sessionInput([session('s1', equivalent)])),
      ).toBe(utc);
    }
  });

  it('keeps sub-millisecond instants distinct', () => {
    const a = canonicalRevisionText(
      sessionInput([session('s1', '2026-03-08T05:00:00.0001Z')]),
    );
    const b = canonicalRevisionText(
      sessionInput([session('s1', '2026-03-08T05:00:00.0002Z')]),
    );
    expect(a).not.toBe(b);
    expect(a).not.toBe(
      canonicalRevisionText(
        sessionInput([session('s1', '2026-03-08T05:00:00Z')]),
      ),
    );
  });

  it('excludes every envelope and provenance field by construction', () => {
    const base = sessionInput([session('s1', null)]);
    const polluted: SnapshotRevisionInput = {
      ...base,
      data: {
        ...(base.data as Record<string, unknown>),
        requestId: 'req-1',
        generatedAt: '2026-07-18T12:00:00.000Z',
        sourceUpdatedAt: '2026-07-18T12:00:00.000Z',
        snapshotObservedAt: '2026-07-18T12:00:00.000Z',
        staleAfter: '2026-07-18T12:15:00.000Z',
        etag: 'W/"gv1-abc"',
        stale: true,
        contentVersion: '2026.07.18.1',
        fetchedAt: '2026-07-18T11:59:00.000Z',
        reconciledAt: '2026-07-18T11:59:30.000Z',
        providerSourceId: 'jolpica',
        pendingRevision: 'sha256:deadbeef',
      },
    };
    expect(canonicalRevisionText(polluted)).toBe(canonicalRevisionText(base));
  });

  it('excludes the four volatile freshness fields carried inside the home payload, but includes the stable contentVersion', () => {
    // Full coverage of this selective projection - every individual field,
    // null vs non-null, absent vs null - lives in
    // `home-freshness-projection.test.ts`. This test pins the general
    // "envelope-shaped fields inside `data`" exclusion at the same site the
    // wholesale-exclusion version of this test used to.
    const home = (freshness: unknown) => ({
      documentName: 'home' as const,
      schemaVersion: 1,
      data: {
        freshness,
        featuredEvent: null,
        featuredSession: null,
        latestCompletedEvent: null,
        driverLeader: null,
        constructorLeader: null,
        upcomingEvents: [],
      },
    });
    const first = canonicalRevisionText(
      home({
        generatedAt: '2026-07-18T12:00:00.000Z',
        sourceUpdatedAt: '2026-07-18T11:00:00.000Z',
        staleAfter: '2026-07-18T12:15:00.000Z',
        contentVersion: '2026.07.18.1',
        stale: false,
      }),
    );
    // The four derived/time-varying fields all change; contentVersion is
    // held fixed - the revision must not move.
    const volatileFieldsChanged = canonicalRevisionText(
      home({
        generatedAt: '2026-09-03T09:30:00.000Z',
        sourceUpdatedAt: '2026-09-03T09:00:00.000Z',
        staleAfter: '2026-09-03T09:45:00.000Z',
        contentVersion: '2026.07.18.1',
        stale: true,
      }),
    );
    expect(volatileFieldsChanged).toBe(first);

    // Only contentVersion changes - the revision must move, because it is
    // stable curated public data, not freshness.
    const contentVersionChanged = canonicalRevisionText(
      home({
        generatedAt: '2026-07-18T12:00:00.000Z',
        sourceUpdatedAt: '2026-07-18T11:00:00.000Z',
        staleAfter: '2026-07-18T12:15:00.000Z',
        contentVersion: '2026.09.03.4',
        stale: false,
      }),
    );
    expect(contentVersionChanged).not.toBe(first);
  });

  it('makes a schemaVersion change a new revision', () => {
    const one = canonicalRevisionText(sessionInput([session('s1', null)]));
    const two = canonicalRevisionText({
      ...sessionInput([session('s1', null)]),
      schemaVersion: 2,
    });
    expect(two).not.toBe(one);
  });

  it('separates a required field that is absent from one that is null', () => {
    const present = canonicalRevisionText(sessionInput([session('s1', null)]));
    const withoutName = canonicalRevisionText({
      documentName: 'grand-prix:1',
      schemaVersion: 1,
      data: (() => {
        const data = {
          ...(sessionInput([session('s1', null)]).data as Record<
            string,
            unknown
          >),
        };
        delete data.name;
        return data;
      })(),
    });
    const nullName = canonicalRevisionText({
      documentName: 'grand-prix:1',
      schemaVersion: 1,
      data: {
        ...(sessionInput([session('s1', null)]).data as Record<
          string,
          unknown
        >),
        name: null,
      },
    });
    expect(new Set([present, withoutName, nullName]).size).toBe(3);
  });

  it('treats an absent optional field and an explicit null identically', () => {
    const absent = canonicalRevisionText(
      driverInput([
        {
          ...mediaAsset('m1'),
          variants: {
            thumbnail: { url: 'https://m.test/a.png', width: 1, height: 1 },
          },
        },
      ]),
    );
    const explicit = canonicalRevisionText(
      driverInput([
        {
          ...mediaAsset('m1'),
          variants: {
            thumbnail: { url: 'https://m.test/a.png', width: 1, height: 1 },
            card: null,
            detail: null,
            hero: null,
          },
        },
      ]),
    );
    expect(explicit).toBe(absent);
  });

  it('repeats across clones and independent calls', () => {
    const input = sessionInput([session('s1', '2026-03-08T05:00:00Z')]);
    const clone = structuredClone(input) as SnapshotRevisionInput;
    expect(canonicalRevisionText(clone)).toBe(canonicalRevisionText(input));
    expect(canonicalRevisionText(input)).toBe(canonicalRevisionText(input));
  });

  it('contains a hostile accessor without invoking it', () => {
    let invoked = 0;
    const data = {
      ...(sessionInput([session('s1', null)]).data as Record<string, unknown>),
    };
    Object.defineProperty(data, 'name', {
      enumerable: true,
      configurable: true,
      get() {
        invoked += 1;
        return 'Australian Grand Prix';
      },
    });
    const text = canonicalRevisionText({
      documentName: 'grand-prix:1',
      schemaVersion: 1,
      data,
    });
    expect(invoked).toBe(0);
    expect(typeof text).toBe('string');
    // An accessor is not an own data property, so it reads as absent - never
    // as the value the getter would have produced.
    expect(text).not.toContain('Australian Grand Prix');
  });

  it('contains a hostile proxy rather than throwing', () => {
    const hostile = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('gridview://secret-key');
        },
        ownKeys() {
          throw new Error('gridview://secret-key');
        },
        getPrototypeOf() {
          throw new Error('gridview://secret-key');
        },
      },
    );
    expect(() =>
      canonicalRevisionText({
        documentName: 'grand-prix:1',
        schemaVersion: 1,
        data: hostile,
      }),
    ).not.toThrow();
    const text = canonicalRevisionText({
      documentName: 'grand-prix:1',
      schemaVersion: 1,
      data: hostile,
    });
    expect(text).not.toContain('secret-key');
  });

  it('never throws for a value of the wrong shape', () => {
    for (const data of [
      null,
      undefined,
      42,
      'text',
      [],
      new Date(0),
      new Map(),
      Object.create(null),
    ]) {
      expect(() =>
        canonicalRevisionText({
          documentName: 'season',
          schemaVersion: 1,
          data,
        }),
      ).not.toThrow();
    }
  });

  it('produces a stable digest for the same canonical text', async () => {
    const input = sessionInput([session('s1', '2026-03-08T05:00:00Z')]);
    const first = await snapshotRevision(input);
    const second = await snapshotRevision(structuredClone(input));
    expect(first).toBe(second);
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
