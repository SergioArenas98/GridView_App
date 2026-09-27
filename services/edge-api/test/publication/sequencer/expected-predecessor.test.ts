/**
 * The D16 binding inside the sequencer (ADR 0026 D16, ADR 0025 D4): the
 * mandatory expected-predecessor compare-and-swap in `prepare`, the returned
 * `priorVersion`, and the `finalize` invariant that the bound predecessor is
 * still the active release.
 *
 * Every assertion is over the coordinator's own durable state. A refusal must
 * leave that state byte-for-byte unchanged: no epoch, no record, no row.
 */

import { describe, expect, it } from 'vitest';

import {
  maximumManifestSize,
  operationStorageKey,
  type ExpectedPredecessor,
  type PrepareRequest,
} from '../../../src/publication/sequencer';
import {
  SEED_ACTIVE_VERSION,
  SEED_HIGH_WATER_MARK,
  SEASON,
  activeSequencer,
  commitment,
  currentPredecessor,
  keyRevision,
  keyState,
  prepareRequest,
  rev,
  seedFor,
  seededPredecessor,
  type Harness,
} from './support';

const MANIFEST = commitment('manifest-1');

/** A seed whose release committed two results documents and two others. */
function seedWithResults() {
  return seedFor({
    perKeyState: [
      keyState('calendar', rev('calendar-1'), SEED_HIGH_WATER_MARK),
      keyState('grand-prix:1:results', rev('results-1'), SEED_HIGH_WATER_MARK),
      keyState('grand-prix:2:results', rev('results-2'), SEED_HIGH_WATER_MARK),
      keyState('standings:drivers', rev('standings-1'), SEED_HIGH_WATER_MARK),
    ],
  });
}

const seededResults: ExpectedPredecessor = {
  activeVersion: SEED_ACTIVE_VERSION,
  guardDocuments: [
    keyRevision('grand-prix:1:results', rev('results-1')),
    keyRevision('grand-prix:2:results', rev('results-2')),
  ],
};

/** Every durable key and value, for "nothing was written" assertions. */
function durableState(harness: Harness): string {
  return JSON.stringify(
    harness.host.committedKeys().map((key) => [key, harness.host.peek(key)]),
  );
}

function refusedWithoutWriting(
  harness: Harness,
  request: PrepareRequest,
  reason: string,
): void {
  const before = durableState(harness);
  expect(harness.sequencer.prepare(request)).toEqual({
    outcome: 'rejected',
    reason,
  });
  expect(durableState(harness)).toBe(before);
}

describe('prepare binds the predecessor the candidate was compared against', () => {
  it('admits the exact active version and results revisions, and returns priorVersion', () => {
    const harness = activeSequencer({}, seedWithResults());
    const prepared = harness.sequencer.prepare(
      prepareRequest({ expectedPredecessor: seededResults }),
    );
    expect(prepared).toMatchObject({
      outcome: 'prepared',
      priorVersion: SEED_ACTIVE_VERSION,
    });
    expect(harness.host.peek(operationStorageKey)).toMatchObject({
      priorVersion: SEED_ACTIVE_VERSION,
    });
  });

  it('compares only results rows: other committed documents are not part of the binding', () => {
    const harness = activeSequencer({}, seedWithResults());
    // `calendar` and `standings:drivers` are committed too, and absent here.
    expect(
      harness.sequencer.prepare(
        prepareRequest({ expectedPredecessor: seededResults }),
      ).outcome,
    ).toBe('prepared');
  });

  it('admits an empty binding for a release that committed no results document', () => {
    const harness = activeSequencer();
    expect(
      harness.sequencer.prepare(
        prepareRequest({ expectedPredecessor: seededPredecessor() }),
      ).outcome,
    ).toBe('prepared');
  });

  it('refuses a stale active version with no epoch allocated and nothing written', () => {
    const harness = activeSequencer({}, seedWithResults());
    refusedWithoutWriting(
      harness,
      prepareRequest({
        expectedPredecessor: {
          ...seededResults,
          activeVersion: '20260801T000000000-bbbbbbbb',
        },
      }),
      'stale-predecessor',
    );
    expect(
      harness.sequencer.prepare(
        prepareRequest({ expectedPredecessor: seededResults }),
      ),
    ).toMatchObject({ outcome: 'prepared', operationEpoch: 1 });
  });

  const mismatches: Array<[string, ExpectedPredecessor]> = [
    [
      'a different revision for a committed results document',
      {
        activeVersion: SEED_ACTIVE_VERSION,
        guardDocuments: [
          keyRevision('grand-prix:1:results', rev('results-1')),
          keyRevision('grand-prix:2:results', rev('results-TAMPERED')),
        ],
      },
    ],
    [
      'a committed results document left out',
      {
        activeVersion: SEED_ACTIVE_VERSION,
        guardDocuments: [keyRevision('grand-prix:1:results', rev('results-1'))],
      },
    ],
    [
      'a results document the release never committed',
      {
        activeVersion: SEED_ACTIVE_VERSION,
        guardDocuments: [
          ...seededResults.guardDocuments,
          keyRevision('grand-prix:3:results', rev('results-3')),
        ],
      },
    ],
    [
      'an empty binding for a release that committed results',
      seededPredecessor(),
    ],
  ];

  it.each(mismatches)(
    'refuses %s as predecessor-guard-mismatch, writing nothing',
    (_label, expectedPredecessor) => {
      const harness = activeSequencer({}, seedWithResults());
      refusedWithoutWriting(
        harness,
        prepareRequest({ expectedPredecessor }),
        'predecessor-guard-mismatch',
      );
    },
  );

  it('checks the binding before single-flight, and single-flight still holds', () => {
    const harness = activeSequencer({}, seedWithResults());
    const live = harness.sequencer.prepare(
      prepareRequest({ expectedPredecessor: seededResults }),
    );
    expect(live.outcome).toBe('prepared');
    // A second candidate compared against the same, still-active predecessor
    // waits on the live operation.
    expect(
      harness.sequencer.prepare(
        prepareRequest({ expectedPredecessor: seededResults }),
      ),
    ).toMatchObject({ outcome: 'rejected', reason: 'operation-in-progress' });
    // One compared against something else is stale whatever else is live.
    refusedWithoutWriting(
      harness,
      prepareRequest({
        expectedPredecessor: {
          ...seededResults,
          activeVersion: '20260801T000000000-bbbbbbbb',
        },
      }),
      'stale-predecessor',
    );
  });

  it('re-anchors on the committed release: its own revisions bind the next prepare', () => {
    const harness = activeSequencer({}, seedWithResults());
    const first = harness.sequencer.prepare(
      prepareRequest({
        expectedPredecessor: seededResults,
        perKeyRevisions: [
          keyRevision('calendar', rev('calendar-1')),
          keyRevision('grand-prix:1:results', rev('results-1-NEW')),
        ],
      }),
    );
    if (first.outcome !== 'prepared') throw new Error('expected prepared');
    expect(
      harness.sequencer.finalize({
        season: SEASON,
        operationEpoch: first.operationEpoch,
        operationToken: first.operationToken,
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toMatchObject({ outcome: 'committed' });

    // The old version is stale; the new version with the old rows mismatches.
    refusedWithoutWriting(
      harness,
      prepareRequest({ expectedPredecessor: seededResults }),
      'stale-predecessor',
    );
    refusedWithoutWriting(
      harness,
      prepareRequest({
        expectedPredecessor: {
          ...seededResults,
          activeVersion: first.candidateVersion,
        },
      }),
      'predecessor-guard-mismatch',
    );
    const anchored = currentPredecessor(harness);
    expect(anchored).toEqual({
      activeVersion: first.candidateVersion,
      guardDocuments: [
        keyRevision('grand-prix:1:results', rev('results-1-NEW')),
      ],
    });
    expect(
      harness.sequencer.prepare(
        prepareRequest({ expectedPredecessor: anchored }),
      ),
    ).toMatchObject({
      outcome: 'prepared',
      priorVersion: first.candidateVersion,
    });
  });
});

describe('the binding is mandatory and bounded', () => {
  const tooMany = Array.from({ length: maximumManifestSize + 1 }, (_, index) =>
    keyRevision(`grand-prix:${index + 1}:results`, rev(`r-${index}`)),
  ).sort((left, right) => (left.documentName < right.documentName ? -1 : 1));

  const malformed: Array<[string, unknown]> = [
    ['absent', undefined],
    ['null', null],
    ['not an object', 'v1'],
    [
      'with a malformed active version',
      { activeVersion: 'not a version', guardDocuments: [] },
    ],
    ['without a guard document list', { activeVersion: SEED_ACTIVE_VERSION }],
    [
      'with guard documents out of UTF-8 order',
      {
        activeVersion: SEED_ACTIVE_VERSION,
        guardDocuments: [...seededResults.guardDocuments].reverse(),
      },
    ],
    [
      'with a repeated guard document',
      {
        activeVersion: SEED_ACTIVE_VERSION,
        guardDocuments: [
          seededResults.guardDocuments[0],
          seededResults.guardDocuments[0],
        ],
      },
    ],
    [
      'naming a document that is not a results document',
      {
        activeVersion: SEED_ACTIVE_VERSION,
        guardDocuments: [keyRevision('calendar', rev('calendar-1'))],
      },
    ],
    [
      'with a malformed revision',
      {
        activeVersion: SEED_ACTIVE_VERSION,
        guardDocuments: [
          { documentName: 'grand-prix:1:results', revision: 'sha256:nope' },
        ],
      },
    ],
    [
      'with more guard documents than a manifest admits',
      { activeVersion: SEED_ACTIVE_VERSION, guardDocuments: tooMany },
    ],
  ];

  it.each(malformed)(
    'refuses an expectedPredecessor %s before any durable read or write',
    (_label, expectedPredecessor) => {
      const harness = activeSequencer({}, seedWithResults());
      refusedWithoutWriting(
        harness,
        {
          ...prepareRequest(),
          expectedPredecessor,
        } as unknown as PrepareRequest,
        'invalid-expected-predecessor',
      );
    },
  );
});

describe('finalize asserts the bound predecessor is still active', () => {
  it('refuses to commit when the durable priorVersion no longer names the active release', () => {
    const harness = activeSequencer({}, seedWithResults());
    const prepared = harness.sequencer.prepare(
      prepareRequest({ expectedPredecessor: seededResults }),
    );
    if (prepared.outcome !== 'prepared') throw new Error('expected prepared');
    // Structurally unreachable; simulated as a corrupted durable record.
    const record = harness.host.peek(operationStorageKey) as Record<
      string,
      unknown
    >;
    harness.host.poke(operationStorageKey, {
      ...record,
      priorVersion: '20260801T000000000-bbbbbbbb',
    });
    const before = durableState(harness);

    expect(
      harness.sequencer.finalize({
        season: SEASON,
        operationEpoch: prepared.operationEpoch,
        operationToken: prepared.operationToken,
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'predecessor-changed' });
    expect(durableState(harness)).toBe(before);
    expect(harness.sequencer.readAuthority(SEASON)).toMatchObject({
      activeVersion: SEED_ACTIVE_VERSION,
    });
  });

  it('keeps the existing identity checks ahead of the invariant', () => {
    const harness = activeSequencer({}, seedWithResults());
    const prepared = harness.sequencer.prepare(
      prepareRequest({ expectedPredecessor: seededResults }),
    );
    if (prepared.outcome !== 'prepared') throw new Error('expected prepared');
    const record = harness.host.peek(operationStorageKey) as Record<
      string,
      unknown
    >;
    harness.host.poke(operationStorageKey, {
      ...record,
      priorVersion: '20260801T000000000-bbbbbbbb',
    });
    expect(
      harness.sequencer.finalize({
        season: SEASON,
        operationEpoch: prepared.operationEpoch,
        operationToken: 'not-the-token',
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'stale-identity' });
    expect(
      harness.sequencer.finalize({
        season: SEASON,
        operationEpoch: prepared.operationEpoch,
        operationToken: prepared.operationToken,
        completionAttestation: { manifestCommitment: commitment('other') },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'manifest-commitment-mismatch' });
  });

  it('commits normally when the invariant holds', () => {
    const harness = activeSequencer({}, seedWithResults());
    const prepared = harness.sequencer.prepare(
      prepareRequest({ expectedPredecessor: seededResults }),
    );
    if (prepared.outcome !== 'prepared') throw new Error('expected prepared');
    expect(
      harness.sequencer.finalize({
        season: SEASON,
        operationEpoch: prepared.operationEpoch,
        operationToken: prepared.operationToken,
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toMatchObject({
      outcome: 'committed',
      result: { previousVersion: SEED_ACTIVE_VERSION },
    });
  });
});
