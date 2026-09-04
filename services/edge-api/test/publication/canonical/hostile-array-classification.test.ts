import { describe, expect, it } from 'vitest';

import {
  canonicalRevisionText,
  snapshotRevision,
} from '../../../src/publication/snapshot-revision';
import type { SnapshotRevisionInput } from '../../../src/publication/snapshot-revision';

/**
 * Corrects the P2 finding on PR #14 (review thread `PRRT_kwDOTb8J4M6fbclB`,
 * comment `3937532923`): `Array.isArray` throws a `TypeError` on a revoked
 * `Proxy` - "Cannot perform 'IsArray' on a proxy that has been revoked" - and
 * that call was unguarded in both `projectObject` and `projectList`, so a
 * revoked proxy anywhere in `data` made `canonicalRevisionText` throw instead
 * of producing the documented bounded `invalid:unreadable` marker.
 *
 * The array classification is now centralized in one helper shared by both
 * call sites, contained exactly like every other reflective operation this
 * module performs on untrusted input.
 */

function seasonInput(data: unknown): SnapshotRevisionInput {
  return { documentName: 'season', schemaVersion: 1, data };
}

function calendarInput(data: unknown): SnapshotRevisionInput {
  return { documentName: 'calendar', schemaVersion: 1, data };
}

function grandPrixInput(
  overrides: Record<string, unknown> = {},
): SnapshotRevisionInput {
  return {
    documentName: 'grand-prix:1',
    schemaVersion: 1,
    data: {
      id: 'gp-2026-1',
      season: 2026,
      round: 1,
      eventSlug: 'x',
      name: 'x',
      officialName: null,
      circuitId: 'x',
      status: 'x',
      format: 'x',
      startDate: null,
      endDate: null,
      timezone: null,
      sessions: [],
      hasResults: false,
      media: null,
      ...overrides,
    },
  };
}

function driverDetailInput(
  overrides: Record<string, unknown> = {},
): SnapshotRevisionInput {
  return {
    documentName: 'driver:x',
    schemaVersion: 1,
    data: {
      driver: {
        id: 'x',
        fullName: 'x',
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
      ...overrides,
    },
  };
}

/** A proxy that throws `TypeError` from `Array.isArray` and every trap. */
function revokedProxy(target: object = {}): object {
  const { proxy, revoke } = Proxy.revocable(target, {});
  revoke();
  return proxy;
}

describe('canonical projection: revoked-proxy array-classification containment', () => {
  it('does not throw when top-level data for an object schema is a revoked proxy', () => {
    expect(() =>
      canonicalRevisionText(seasonInput(revokedProxy({}))),
    ).not.toThrow();
  });

  it('does not throw when top-level data for a list schema is a revoked proxy', () => {
    expect(() =>
      canonicalRevisionText(calendarInput(revokedProxy([]))),
    ).not.toThrow();
  });

  it('does not throw when a nested list-valued field is a revoked proxy', () => {
    expect(() =>
      canonicalRevisionText(grandPrixInput({ sessions: revokedProxy([]) })),
    ).not.toThrow();
  });

  it('does not throw when a nested object-valued field is a revoked proxy', () => {
    expect(() =>
      canonicalRevisionText(
        driverDetailInput({ seasonEntry: revokedProxy({}) }),
      ),
    ).not.toThrow();
  });

  it('does not throw when one element of a list is a revoked proxy', () => {
    const goodSession = {
      id: 's1',
      type: 'race',
      name: null,
      startTime: null,
      endTime: null,
      status: 'scheduled',
    };
    expect(() =>
      canonicalRevisionText(
        grandPrixInput({ sessions: [goodSession, revokedProxy({})] }),
      ),
    ).not.toThrow();
  });

  it('never rejects from snapshotRevision for a revoked proxy in either an object or a list position', async () => {
    await expect(
      snapshotRevision(seasonInput(revokedProxy({}))),
    ).resolves.toMatch(/^sha256:[0-9a-f]{64}$/);
    await expect(
      snapshotRevision(calendarInput(revokedProxy([]))),
    ).resolves.toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('marks a revoked proxy as the bounded unreadable marker at its exact position, never as a type mismatch', () => {
    const text = canonicalRevisionText(
      driverDetailInput({ seasonEntry: revokedProxy({}) }),
    );
    expect(text).toContain('k11:seasonEntry!10:unreadable');
  });

  it('gives a readable ordinary array in an object position the bounded type marker, not unreadable', () => {
    const text = canonicalRevisionText(seasonInput([]));
    expect(text).toContain('!4:type');
    expect(text).not.toContain('unreadable');
  });

  it('gives a readable non-array in a list position the bounded type marker, not unreadable', () => {
    const text = canonicalRevisionText(calendarInput({}));
    expect(text).toContain('!4:type');
    expect(text).not.toContain('unreadable');
  });

  it('does not leak an exception message through a revoked proxy or a throwing trap', () => {
    const throwingTrapProxy = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('gridview://secret-key');
        },
      },
    );
    const text = canonicalRevisionText(
      driverDetailInput({
        seasonEntry: throwingTrapProxy,
        standing: revokedProxy({}),
      }),
    );
    expect(text).not.toContain('secret-key');
  });

  it('remains deterministic across repeated calls for a revoked proxy in a nested list field', () => {
    const input = grandPrixInput({ sessions: revokedProxy([]) });
    const first = canonicalRevisionText(input);
    const second = canonicalRevisionText(input);
    expect(second).toBe(first);
  });

  it('still classifies an ordinary array, an ordinary record and a null-prototype record without throwing', () => {
    expect(() => canonicalRevisionText(calendarInput([]))).not.toThrow();
    expect(() => canonicalRevisionText(seasonInput({}))).not.toThrow();
    expect(() =>
      canonicalRevisionText(seasonInput(Object.create(null))),
    ).not.toThrow();
  });

  it('still refuses a non-array exotic object in a list position as a type mismatch, not unreadable', () => {
    expect(() =>
      canonicalRevisionText(calendarInput(new Date(0))),
    ).not.toThrow();
    expect(() => canonicalRevisionText(calendarInput(new Map()))).not.toThrow();
    const text = canonicalRevisionText(calendarInput(new Date(0)));
    expect(text).toContain('!4:type');
  });
});
