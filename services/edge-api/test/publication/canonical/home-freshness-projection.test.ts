import { describe, expect, it } from 'vitest';

import { canonicalRevisionText } from '../../../src/publication/snapshot-revision';
import type { SnapshotRevisionInput } from '../../../src/publication/snapshot-revision';

/**
 * Corrects the P2 finding on PR #14 (review thread `PRRT_kwDOTb8J4M6fbck-`,
 * comment `3937532921`): the standalone `home` document's canonical schema
 * excluded `HomeData.freshness` wholesale, so a genuine curated
 * `contentVersion` bump - the same value `BootstrapData.contentVersion`
 * already includes - never moved the `home` document's revision.
 *
 * `freshness` is no longer excluded wholesale. It projects onto a nested
 * schema of its own, declared as the required `freshness` field of `home`:
 * only `contentVersion` is read; `generatedAt`, `sourceUpdatedAt`,
 * `staleAfter` and `stale` stay excluded, because they are exactly the
 * derived and time-varying signals ADR 0020 D1.7 names.
 */

function homeInput(freshness: unknown): SnapshotRevisionInput {
  return {
    documentName: 'home',
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
  };
}

interface FreshnessOverrides {
  generatedAt?: string;
  sourceUpdatedAt?: string | null;
  staleAfter?: string | null;
  contentVersion?: string | null;
  stale?: boolean | null;
}

const freshness = (overrides: FreshnessOverrides = {}) => ({
  generatedAt: '2026-07-18T12:00:00.000Z',
  sourceUpdatedAt: '2026-07-18T11:00:00.000Z',
  staleAfter: '2026-07-18T12:15:00.000Z',
  contentVersion: '2026.07.18.1',
  stale: false,
  ...overrides,
});

describe('home document: selective freshness projection', () => {
  it('changes the revision when only contentVersion changes', () => {
    const first = canonicalRevisionText(homeInput(freshness()));
    const second = canonicalRevisionText(
      homeInput(freshness({ contentVersion: '2026.09.03.4' })),
    );
    expect(second).not.toBe(first);
  });

  it('separates a null contentVersion from a non-null one', () => {
    const withValue = canonicalRevisionText(homeInput(freshness()));
    const withNull = canonicalRevisionText(
      homeInput(freshness({ contentVersion: null })),
    );
    expect(withNull).not.toBe(withValue);
  });

  it('does not change the revision when only generatedAt changes', () => {
    const first = canonicalRevisionText(homeInput(freshness()));
    const second = canonicalRevisionText(
      homeInput(freshness({ generatedAt: '2026-09-03T09:30:00.000Z' })),
    );
    expect(second).toBe(first);
  });

  it('does not change the revision when only sourceUpdatedAt changes', () => {
    const first = canonicalRevisionText(homeInput(freshness()));
    const second = canonicalRevisionText(
      homeInput(freshness({ sourceUpdatedAt: '2026-09-03T09:00:00.000Z' })),
    );
    expect(second).toBe(first);
  });

  it('does not change the revision when only staleAfter changes', () => {
    const first = canonicalRevisionText(homeInput(freshness()));
    const second = canonicalRevisionText(
      homeInput(freshness({ staleAfter: '2026-09-03T09:45:00.000Z' })),
    );
    expect(second).toBe(first);
  });

  it('does not change the revision when only stale changes', () => {
    const first = canonicalRevisionText(homeInput(freshness()));
    const second = canonicalRevisionText(homeInput(freshness({ stale: true })));
    expect(second).toBe(first);
  });

  it('still gives equal revisions when every excluded field changes at once and contentVersion is held fixed', () => {
    const first = canonicalRevisionText(homeInput(freshness()));
    const second = canonicalRevisionText(
      homeInput(
        freshness({
          generatedAt: '2026-09-03T09:30:00.000Z',
          sourceUpdatedAt: '2026-09-03T09:00:00.000Z',
          staleAfter: '2026-09-03T09:45:00.000Z',
          stale: true,
        }),
      ),
    );
    expect(second).toBe(first);
  });

  it('separates a required freshness that is absent from one that is null', () => {
    const present = canonicalRevisionText(homeInput(freshness()));
    const withoutFreshness = {
      ...(homeInput(freshness()).data as Record<string, unknown>),
    };
    delete withoutFreshness.freshness;
    const absent = canonicalRevisionText({
      documentName: 'home',
      schemaVersion: 1,
      data: withoutFreshness,
    });
    const nullFreshness = canonicalRevisionText(homeInput(null));
    expect(new Set([present, absent, nullFreshness]).size).toBe(3);
  });
});
