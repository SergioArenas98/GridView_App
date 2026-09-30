/**
 * The ledger's closed, versioned record model and its strict runtime
 * validation. Every refusal leaves storage byte-for-byte unchanged.
 */

import { describe, expect, it } from 'vitest';

import {
  MAXIMUM_COMMIT_WRITES,
  MAXIMUM_ROUND,
  SUPERSEDED_REVISION_CAPACITY,
  isLedgerInstant,
  ledgerKeys,
} from '../../../../src/sync/coordinated/ledger';
import {
  decodeClassificationRecord,
  decodeSeasonRecord,
} from '../../../../src/sync/coordinated/ledger/records';
import { decodeCommitRequest } from '../../../../src/sync/coordinated/ledger/requests';
import {
  OTHER_SEASON,
  SEASON,
  classification,
  commitRequest,
  committedBytes,
  lease,
  ledgerFixture,
  rev,
  seasonRecord,
  write,
} from './support';

describe('the classification record schema', () => {
  it('accepts a complete record and returns a fresh copy', () => {
    const record = classification(1, {
      candidateRevision: rev('candidate'),
      candidateFirstSeenAt: '2026-03-08T09:00:00.000Z',
      markers: ['pending', 'staged'],
      stagedCorrection: {
        revision: rev('staged'),
        firstSeenAt: '2026-03-09T09:00:00.000Z',
        uncorroborated: false,
      },
      supersededRevisions: [rev('old-1'), rev('old-2')],
      terminalReason: 'settled',
    });
    const decoded = decodeClassificationRecord(record);

    expect(decoded).toEqual({ ok: true, value: record });
    expect(decoded.ok && decoded.value).not.toBe(record);
  });

  it.each([
    ['a raw provider body', { payload: '{"MRData":{}}' }],
    ['a normalized payload', { document: { results: [] } }],
    ['a driver name', { driverName: 'A Driver' }],
    ['a URL', { url: 'https://example.invalid/results' }],
    ['headers', { headers: { etag: '"x"' } }],
    ['a credential', { authorization: 'Bearer token' }],
  ])('refuses an extra key carrying %s', (_label, extra) => {
    expect(
      decodeClassificationRecord({ ...classification(1), ...extra }),
    ).toEqual({ ok: false, reason: 'invalid-record' });
  });

  it.each([
    ['a missing key', (r: Record<string, unknown>) => delete r.settledAt],
    [
      'another schema version',
      (r: Record<string, unknown>) => (r.schemaVersion = 2),
    ],
    ['another kind', (r: Record<string, unknown>) => (r.kind = 'season')],
    [
      'a sprint session',
      (r: Record<string, unknown>) => (r.sessionType = 'sprint'),
    ],
    ['round 0', (r: Record<string, unknown>) => (r.round = 0)],
    [
      'a round past the bound',
      (r: Record<string, unknown>) => (r.round = MAXIMUM_ROUND + 1),
    ],
    ['a fractional round', (r: Record<string, unknown>) => (r.round = 1.5)],
    ['a season before 1900', (r: Record<string, unknown>) => (r.season = 1899)],
    ['check index 18', (r: Record<string, unknown>) => (r.checkIndex = 18)],
    [
      'a negative check index',
      (r: Record<string, unknown>) => (r.checkIndex = -1),
    ],
    [
      '18 confirmations',
      (r: Record<string, unknown>) => (r.consecutiveConfirmations = 18),
    ],
    [
      '4 unstable sightings',
      (r: Record<string, unknown>) => (r.unstableSightings = 4),
    ],
    [
      'an offset instant',
      (r: Record<string, unknown>) =>
        (r.anchor = '2026-03-08T05:00:00.000+01:00'),
    ],
    [
      'an instant without milliseconds',
      (r: Record<string, unknown>) => (r.nextDueAt = '2026-03-08T09:00:00Z'),
    ],
    [
      'an impossible date',
      (r: Record<string, unknown>) =>
        (r.settledAt = '2026-02-30T00:00:00.000Z'),
    ],
    [
      'a URL as a revision',
      (r: Record<string, unknown>) =>
        (r.candidateRevision = 'https://example.invalid'),
    ],
    [
      'an uppercase revision',
      (r: Record<string, unknown>) =>
        (r.publishedRevision = rev('x').toUpperCase()),
    ],
    [
      'a normalized document as the accepted content',
      (r: Record<string, unknown>) => (r.contentRevision = { results: [] }),
    ],
    [
      'a missing accepted content revision',
      (r: Record<string, unknown>) => delete r.contentRevision,
    ],
    [
      'an unknown anchor kind',
      (r: Record<string, unknown>) => (r.anchorKind = 'date'),
    ],
    [
      'an unknown review state',
      (r: Record<string, unknown>) => (r.reviewState = 'locked'),
    ],
    [
      'an unknown terminal reason',
      (r: Record<string, unknown>) => (r.terminalReason = 'abandoned'),
    ],
    [
      'an unknown marker',
      (r: Record<string, unknown>) => (r.markers = ['flagged']),
    ],
    [
      'unsorted markers',
      (r: Record<string, unknown>) => (r.markers = ['staged', 'pending']),
    ],
    [
      'a duplicate marker',
      (r: Record<string, unknown>) => (r.markers = ['pending', 'pending']),
    ],
    [
      'a candidate without its first sighting',
      (r: Record<string, unknown>) => (r.candidateRevision = rev('c')),
    ],
    [
      'a first sighting without a candidate',
      (r: Record<string, unknown>) =>
        (r.candidateFirstSeenAt = '2026-03-08T09:00:00.000Z'),
    ],
    [
      'a correction with an extra key',
      (r: Record<string, unknown>) =>
        (r.stagedCorrection = {
          revision: rev('s'),
          firstSeenAt: '2026-03-08T09:00:00.000Z',
          uncorroborated: true,
          body: 'x',
        }),
    ],
    [
      'a correction with a string flag',
      (r: Record<string, unknown>) =>
        (r.competingCorrection = {
          revision: rev('s'),
          firstSeenAt: '2026-03-08T09:00:00.000Z',
          uncorroborated: 'no',
        }),
    ],
    [
      'a duplicate superseded revision',
      (r: Record<string, unknown>) =>
        (r.supersededRevisions = [rev('a'), rev('a')]),
    ],
    [
      'a superseded non-revision',
      (r: Record<string, unknown>) => (r.supersededRevisions = ['payload']),
    ],
    [
      'a non-array history',
      (r: Record<string, unknown>) => (r.supersededRevisions = rev('a')),
    ],
  ])('refuses %s', (_label, mutate) => {
    const record = { ...classification(1) } as Record<string, unknown>;
    mutate(record);
    expect(decodeClassificationRecord(record)).toEqual({
      ok: false,
      reason: 'invalid-record',
    });
  });

  it('reports a history past its capacity as a capacity refusal', () => {
    const history = Array.from(
      { length: SUPERSEDED_REVISION_CAPACITY + 1 },
      (_, index) => rev(`old-${index}`),
    );
    expect(
      decodeClassificationRecord(
        classification(1, { supersededRevisions: history }),
      ),
    ).toEqual({ ok: false, reason: 'revision-history-capacity' });
    expect(
      decodeClassificationRecord(
        classification(1, { supersededRevisions: history.slice(1) }),
      ).ok,
    ).toBe(true);
  });
});

describe('the season record schema', () => {
  it('accepts a complete record', () => {
    const record = seasonRecord({
      publicationDueAt: '2026-09-27T13:17:00.000Z',
      calendarAnchors: [
        {
          round: 1,
          anchor: '2026-03-08T04:00:00.000Z',
          anchorKind: 'date-time',
        },
        {
          round: 2,
          anchor: '2026-03-15T23:59:59.000Z',
          anchorKind: 'date-eod',
        },
      ],
    });
    expect(decodeSeasonRecord(record)).toEqual({ ok: true, value: record });
  });

  it('accepts the publication state: last publication, ordering input and each disposition', () => {
    const lastPublication = {
      digest: rev('candidate'),
      activeVersion: 'pm1-0000000001-00000001',
      publishedAt: '2026-09-27T12:00:00.000Z',
      confirmedAt: '2026-09-28T12:00:00.000Z',
    };
    for (const publicationDisposition of [
      null,
      {
        state: 'publishing',
        since: '2026-09-28T12:00:00.000Z',
        digest: null,
        orderingInput: null,
      },
      {
        state: 'publishing',
        since: '2026-09-28T12:00:00.000Z',
        digest: rev('next'),
        orderingInput: '2026-09-28T12:00:00.001Z',
      },
      {
        state: 'blocked',
        since: '2026-09-28T12:00:00.000Z',
        reason: 'guard-participation-fact-removed',
      },
    ]) {
      const record = seasonRecord({
        lastOrderingInput: '2026-09-28T12:00:00.001Z',
        lastPublication,
        publicationDisposition,
      });
      expect(decodeSeasonRecord(record)).toEqual({ ok: true, value: record });
    }
  });

  it('accepts an observed calendar with no races, distinct from none observed', () => {
    for (const calendarAnchors of [null, []]) {
      const record = seasonRecord({ calendarAnchors });
      expect(decodeSeasonRecord(record)).toEqual({ ok: true, value: record });
    }
  });

  it.each([
    [
      'a missing refresh resource',
      (r: Record<string, unknown>) => {
        const refresh = { ...(r.refresh as Record<string, unknown>) };
        delete refresh.circuits;
        r.refresh = refresh;
      },
    ],
    [
      'an extra refresh resource',
      (r: Record<string, unknown>) => {
        r.refresh = {
          ...(r.refresh as Record<string, unknown>),
          media: r.refresh,
        };
      },
    ],
    [
      'a refresh record carrying a body',
      (r: Record<string, unknown>) => {
        const refresh = { ...(r.refresh as Record<string, unknown>) };
        refresh.calendar = {
          observedRevision: null,
          lastAttemptedAt: null,
          lastSuccessAt: null,
          nextDueAt: null,
          body: '{}',
        };
        r.refresh = refresh;
      },
    ],
    [
      'an ordering input that is not a canonical instant',
      (r: Record<string, unknown>) => (r.lastOrderingInput = '2026-09-27'),
    ],
    [
      'a missing ordering input',
      (r: Record<string, unknown>) => delete r.lastOrderingInput,
    ],
    [
      'a last publication without its digest',
      (r: Record<string, unknown>) =>
        (r.lastPublication = {
          activeVersion: 'pm1-0000000001-00000001',
          publishedAt: '2026-09-27T12:00:00.000Z',
          confirmedAt: '2026-09-27T12:00:00.000Z',
        }),
    ],
    [
      'a last publication confirmed before it was published',
      (r: Record<string, unknown>) =>
        (r.lastPublication = {
          digest: rev('candidate'),
          activeVersion: 'pm1-0000000001-00000001',
          publishedAt: '2026-09-27T12:00:00.000Z',
          confirmedAt: '2026-09-27T11:59:59.999Z',
        }),
    ],
    [
      'a last publication naming no version',
      (r: Record<string, unknown>) =>
        (r.lastPublication = {
          digest: rev('candidate'),
          activeVersion: '../active',
          publishedAt: '2026-09-27T12:00:00.000Z',
          confirmedAt: '2026-09-27T12:00:00.000Z',
        }),
    ],
    [
      'a reservation with a digest but no ordering input',
      (r: Record<string, unknown>) =>
        (r.publicationDisposition = {
          state: 'publishing',
          since: '2026-09-27T12:00:00.000Z',
          digest: rev('candidate'),
          orderingInput: null,
        }),
    ],
    [
      'a block with an open-ended reason',
      (r: Record<string, unknown>) =>
        (r.publicationDisposition = {
          state: 'blocked',
          since: '2026-09-27T12:00:00.000Z',
          reason: 'the provider said so',
        }),
    ],
    [
      'a block carrying a digest',
      (r: Record<string, unknown>) =>
        (r.publicationDisposition = {
          state: 'blocked',
          since: '2026-09-27T12:00:00.000Z',
          reason: 'classification-staged',
          digest: rev('candidate'),
        }),
    ],
    [
      'a disposition in an unknown state',
      (r: Record<string, unknown>) =>
        (r.publicationDisposition = {
          state: 'published',
          since: '2026-09-27T12:00:00.000Z',
        }),
    ],
    [
      'a missing calendar',
      (r: Record<string, unknown>) => delete r.calendarAnchors,
    ],
    [
      'an anchor carrying a race name',
      (r: Record<string, unknown>) =>
        (r.calendarAnchors = [
          {
            round: 1,
            anchor: '2026-03-08T04:00:00.000Z',
            anchorKind: 'date-time',
            raceName: 'A Grand Prix',
          },
        ]),
    ],
    [
      'anchors out of round order',
      (r: Record<string, unknown>) =>
        (r.calendarAnchors = [
          {
            round: 2,
            anchor: '2026-03-15T04:00:00.000Z',
            anchorKind: 'date-time',
          },
          {
            round: 1,
            anchor: '2026-03-08T04:00:00.000Z',
            anchorKind: 'date-time',
          },
        ]),
    ],
    [
      'two anchors for one round',
      (r: Record<string, unknown>) =>
        (r.calendarAnchors = [
          {
            round: 1,
            anchor: '2026-03-08T04:00:00.000Z',
            anchorKind: 'date-time',
          },
          {
            round: 1,
            anchor: '2026-03-09T04:00:00.000Z',
            anchorKind: 'date-time',
          },
        ]),
    ],
    [
      'an anchor with a provider date string',
      (r: Record<string, unknown>) =>
        (r.calendarAnchors = [
          { round: 1, anchor: '2026-03-08', anchorKind: 'date-eod' },
        ]),
    ],
    [
      'more anchors than rounds',
      (r: Record<string, unknown>) =>
        (r.calendarAnchors = Array.from(
          { length: MAXIMUM_ROUND + 1 },
          (_, index) => ({
            round: index + 1,
            anchor: '2026-03-08T04:00:00.000Z',
            anchorKind: 'date-time',
          }),
        )),
    ],
  ])('refuses %s', (_label, mutate) => {
    const record = { ...seasonRecord() } as Record<string, unknown>;
    mutate(record);
    expect(decodeSeasonRecord(record)).toEqual({
      ok: false,
      reason: 'invalid-record',
    });
  });
});

describe('canonical instants', () => {
  it('accepts only the toISOString spelling', () => {
    expect(isLedgerInstant('2026-09-27T12:00:00.000Z')).toBe(true);
    for (const value of [
      '2026-09-27T12:00:00Z',
      '2026-09-27T12:00:00.0000Z',
      '2026-09-27 12:00:00.000Z',
      '2026-09-27T24:00:00.000Z',
      '+002026-09-27T12:00:00.000Z',
      1_790_000_000_000,
      null,
    ]) {
      expect(isLedgerInstant(value), String(value)).toBe(false);
    }
  });
});

describe('commit requests', () => {
  const token = { season: SEASON, fence: 1 };

  it('refuses a duplicate record in one request', () => {
    expect(
      decodeCommitRequest(
        commitRequest(token, {
          classifications: [write(classification(3)), write(classification(3))],
        }),
      ),
    ).toEqual({ ok: false, reason: 'duplicate-record' });
    expect(
      decodeCommitRequest(
        commitRequest(token, {
          backlogInsertions: [{ round: 3, revision: rev('s') }],
          backlogRemovals: [{ round: 3, revision: rev('s') }],
        }),
      ),
    ).toEqual({ ok: false, reason: 'duplicate-record' });
    // One backlog change per resource, even under different revisions.
    for (const parts of [
      {
        backlogInsertions: [
          { round: 3, revision: rev('a') },
          { round: 3, revision: rev('b') },
        ],
      },
      {
        backlogInsertions: [{ round: 3, revision: rev('a') }],
        backlogRemovals: [{ round: 3, revision: rev('b') }],
      },
    ]) {
      expect(decodeCommitRequest(commitRequest(token, parts))).toEqual({
        ok: false,
        reason: 'duplicate-record',
      });
    }
  });

  it.each([
    [
      'a record from another season',
      commitRequest(token, {
        classifications: [write(classification(1, {}, OTHER_SEASON))],
      }),
    ],
    [
      'a season record from another season',
      commitRequest(token, {
        seasonRecord: write(seasonRecord({}, OTHER_SEASON)),
      }),
    ],
    [
      'a negative expected version',
      commitRequest(token, { classifications: [write(classification(1), -1)] }),
    ],
    [
      'a missing field',
      {
        lease: token,
        classifications: [],
        backlogInsertions: [],
        backlogRemovals: [],
      },
    ],
    ['an extra field', { ...commitRequest(token), note: 'x' }],
    ['a malformed lease', commitRequest({ season: SEASON, fence: 0 })],
    [
      'too many writes',
      commitRequest(token, {
        classifications: Array.from(
          { length: MAXIMUM_COMMIT_WRITES + 1 },
          (_, i) => write(classification((i % MAXIMUM_ROUND) + 1)),
        ),
      }),
    ],
    [
      'a backlog reference past the round bound',
      commitRequest(token, {
        backlogInsertions: [{ round: MAXIMUM_ROUND + 1, revision: rev('s') }],
      }),
    ],
  ])('refuses %s as an invalid request', (_label, request) => {
    expect(decodeCommitRequest(request)).toEqual({
      ok: false,
      reason: 'invalid-request',
    });
  });

  it('refuses an out-of-bound record inside a request as an invalid record', () => {
    expect(
      decodeCommitRequest(
        commitRequest(token, {
          classifications: [write(classification(1, { checkIndex: 99 }))],
        }),
      ),
    ).toEqual({ ok: false, reason: 'invalid-record' });
  });
});

describe('schema refusals through the store change nothing', () => {
  it('leaves storage byte-for-byte unchanged for every refused request', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fixture.ledger.commit(
      commitRequest(token, { classifications: [write(classification(1))] }),
    );
    const before = committedBytes(fixture.host);

    const refused = [
      commitRequest(token, {
        classifications: [write({ ...classification(2), payload: 'x' }, 0)],
      }),
      commitRequest(token, {
        classifications: [write(classification(2)), write(classification(2))],
      }),
      commitRequest(token, {
        classifications: [
          write(classification(2)),
          write(classification(MAXIMUM_ROUND + 1)),
        ],
      }),
      { lease: token },
      'not an object',
    ];
    for (const request of refused) {
      const outcome = fixture.store.commit(request);
      expect(outcome.outcome).toBe('rejected');
      expect(committedBytes(fixture.host)).toBe(before);
    }
  });

  it('reports corrupt stored state rather than acting on it', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fixture.ledger.commit(
      commitRequest(token, { classifications: [write(classification(1))] }),
    );
    const key = ledgerKeys.classification(SEASON, 1);
    const stored = fixture.host.peek(key) as {
      version: number;
      record: object;
    };
    fixture.host.poke(key, {
      ...stored,
      record: { ...stored.record, body: '{}' },
    });
    const before = committedBytes(fixture.host);

    expect(await fixture.ledger.readSeason(SEASON)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [write(classification(1, { checkIndex: 1 }), 1)],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'state-corrupt' });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('refuses a record stored under a key it does not belong to', async () => {
    const fixture = ledgerFixture();
    fixture.host.poke(ledgerKeys.classification(SEASON, 2), {
      version: 1,
      record: classification(3),
    });
    expect(await fixture.ledger.readSeason(SEASON)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
    // A corrupt season also refuses a lease: the lease write is rolled back.
    expect(await fixture.ledger.acquireLease(SEASON)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
    expect(fixture.host.peek(ledgerKeys.lease(SEASON))).toBeUndefined();
  });

  it('refuses an invalid season request', async () => {
    const fixture = ledgerFixture();
    expect(fixture.store.readSeason({ season: '2026' })).toEqual({
      outcome: 'rejected',
      reason: 'invalid-request',
    });
    expect(fixture.store.acquireLease({ season: 2026, extra: 1 })).toEqual({
      outcome: 'rejected',
      reason: 'invalid-request',
    });
    expect(fixture.host.committedKeys()).toEqual([]);
  });
});
