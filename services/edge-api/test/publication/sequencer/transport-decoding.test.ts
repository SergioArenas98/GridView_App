/**
 * The client fully decodes every Durable Object transport response before
 * acting on it (ADR 0025 D1, D9; review findings on `durable-object.ts` and
 * `wire-decoders.ts`).
 *
 * Reproduced defect: the old `outcomeOr` helper accepted any object whose
 * `outcome` was a permitted discriminant, so `{ outcome: 'committed' }` with no
 * `result` and no `replayed` became a successful `FinalizeOutcome`, and partial
 * `prepared` / `authorized` / authority responses were believed the same way.
 *
 * Residual defect (R1): shape validation alone still admitted responses the
 * protocol cannot produce - a `prepared` outcome whose `candidateVersion`
 * belongs to a different epoch than `operationEpoch`, an empty or
 * duplicate-bearing assignment set, an assignment set for a manifest other than
 * the one requested, and a `seeded`/`active` authority with no active version
 * or fingerprint. Every safety-critical cross-field invariant is checked here
 * now; the request-binding one is checked on the client, where the request
 * lives.
 *
 * Each decoder is exercised directly with its every successful variant and
 * representative malformed forms: a permitted discriminant with missing
 * required fields, a wrong nested field type, an unknown/unbounded reason
 * string, an invalid epoch, an invalid version/identifier, an inconsistent
 * authority, and an epoch/version pair that disagree.
 */

import { describe, expect, it } from 'vitest';

import {
  DurableObjectSeasonPublicationSequencer,
  decodeCancelOutcome,
  decodeCleanupAuthorization,
  decodeCutoverActivationOutcome,
  decodeCutoverSeedOutcome,
  decodeFinalizeOutcome,
  decodePrepareOutcome,
  decodeSeasonAuthority,
  maximumOperationEpoch,
  type SequencerNamespace,
} from '../../../src/publication/sequencer';
import { SEASON, commitment, prepareRequest, rev } from './support';

/** The reserved-namespace version the epoch encoding binds to `epoch`. */
const versionForEpoch = (epoch: number, opaque = '00000001'): string =>
  `pm1-${epoch.toString(16).padStart(13, '0')}-${opaque}`;

const VERSION = versionForEpoch(1);
const INSTANT = '2026-09-02T00:00:00.000Z';
const REVISION = rev('k');
const COMMITTED = {
  activeVersion: VERSION,
  previousVersion: null,
  operationKind: 'ordinary-publication',
  committedAt: INSTANT,
};

interface Case {
  readonly name: string;
  readonly input: unknown;
  readonly accepted: boolean;
}

function table(
  decoder: (value: unknown) => unknown,
  cases: readonly Case[],
): void {
  for (const testCase of cases) {
    it(testCase.name, () => {
      const decoded = decoder(testCase.input);
      if (testCase.accepted) {
        expect(decoded).not.toBeNull();
        expect(decoded).toEqual(testCase.input);
      } else {
        // A malformed response either decodes to null (client then falls back)
        // or, when it drops an unrelated field, is not echoed verbatim.
        if (decoded !== null) expect(decoded).not.toEqual(testCase.input);
      }
    });
  }
}

describe('decodeSeasonAuthority', () => {
  table(decodeSeasonAuthority, [
    {
      name: 'accepts uninitialized',
      input: { cutoverState: 'uninitialized', authoritative: false },
      accepted: true,
    },
    {
      name: 'accepts unavailable',
      input: { cutoverState: 'unavailable', authoritative: false },
      accepted: true,
    },
    {
      name: 'accepts seeded (never authoritative)',
      input: {
        cutoverState: 'seeded',
        authoritative: false,
        activeVersion: VERSION,
        previousVersion: null,
        cutoverFingerprint: 'cutover-2026-a1',
      },
      accepted: true,
    },
    {
      name: 'accepts active (authoritative)',
      input: {
        cutoverState: 'active',
        authoritative: true,
        activeVersion: VERSION,
        previousVersion: null,
        cutoverFingerprint: 'cutover-2026-a1',
      },
      accepted: true,
    },
    {
      name: 'rejects active with authoritative:false',
      input: {
        cutoverState: 'active',
        authoritative: false,
        activeVersion: VERSION,
        previousVersion: null,
        cutoverFingerprint: null,
      },
      accepted: false,
    },
    {
      name: 'rejects seeded claiming authoritative:true',
      input: {
        cutoverState: 'seeded',
        authoritative: true,
        activeVersion: VERSION,
        previousVersion: null,
        cutoverFingerprint: null,
      },
      accepted: false,
    },
    {
      name: 'rejects uninitialized claiming authoritative:true',
      input: { cutoverState: 'uninitialized', authoritative: true },
      accepted: false,
    },
    {
      name: 'rejects active with a colon-bearing version',
      input: {
        cutoverState: 'active',
        authoritative: true,
        activeVersion: 'has:colons',
        previousVersion: null,
        cutoverFingerprint: null,
      },
      accepted: false,
    },
    {
      name: 'rejects seeded with a null activeVersion',
      input: {
        cutoverState: 'seeded',
        authoritative: false,
        activeVersion: null,
        previousVersion: null,
        cutoverFingerprint: 'cutover-2026-a1',
      },
      accepted: false,
    },
    {
      name: 'rejects seeded with a null cutoverFingerprint',
      input: {
        cutoverState: 'seeded',
        authoritative: false,
        activeVersion: VERSION,
        previousVersion: null,
        cutoverFingerprint: null,
      },
      accepted: false,
    },
    {
      name: 'rejects active with a null activeVersion',
      input: {
        cutoverState: 'active',
        authoritative: true,
        activeVersion: null,
        previousVersion: null,
        cutoverFingerprint: 'cutover-2026-a1',
      },
      accepted: false,
    },
    {
      name: 'rejects an unknown cutover state',
      input: { cutoverState: 'frozen', authoritative: false },
      accepted: false,
    },
  ]);
});

describe('decodePrepareOutcome', () => {
  table(decodePrepareOutcome, [
    {
      name: 'accepts a complete prepared outcome',
      input: {
        outcome: 'prepared',
        operationEpoch: 3,
        operationToken: 'token-3',
        candidateVersion: versionForEpoch(3),
        assignedTimestamps: [
          { documentName: 'calendar', revision: REVISION, observedAt: INSTANT },
        ],
        deadline: INSTANT,
      },
      accepted: true,
    },
    {
      name: 'rejects prepared whose candidateVersion belongs to another epoch',
      input: {
        outcome: 'prepared',
        operationEpoch: 3,
        operationToken: 'token-3',
        candidateVersion: versionForEpoch(1),
        assignedTimestamps: [
          { documentName: 'calendar', revision: REVISION, observedAt: INSTANT },
        ],
        deadline: INSTANT,
      },
      accepted: false,
    },
    {
      name: 'rejects prepared with an empty assignedTimestamps set',
      input: {
        outcome: 'prepared',
        operationEpoch: 3,
        operationToken: 'token-3',
        candidateVersion: versionForEpoch(3),
        assignedTimestamps: [],
        deadline: INSTANT,
      },
      accepted: false,
    },
    {
      name: 'rejects prepared with duplicate assignedTimestamps document names',
      input: {
        outcome: 'prepared',
        operationEpoch: 3,
        operationToken: 'token-3',
        candidateVersion: versionForEpoch(3),
        assignedTimestamps: [
          { documentName: 'calendar', revision: REVISION, observedAt: INSTANT },
          { documentName: 'calendar', revision: REVISION, observedAt: INSTANT },
        ],
        deadline: INSTANT,
      },
      accepted: false,
    },
    {
      name: 'rejects prepared whose retiredCleanup epoch/version disagree',
      input: {
        outcome: 'prepared',
        operationEpoch: 3,
        operationToken: 'token-3',
        candidateVersion: versionForEpoch(3),
        assignedTimestamps: [
          { documentName: 'calendar', revision: REVISION, observedAt: INSTANT },
        ],
        deadline: INSTANT,
        retiredCleanup: {
          operationEpoch: 2,
          candidateVersion: versionForEpoch(1),
        },
      },
      accepted: false,
    },
    {
      name: 'accepts prepared with a consistent retiredCleanup handle',
      input: {
        outcome: 'prepared',
        operationEpoch: 3,
        operationToken: 'token-3',
        candidateVersion: versionForEpoch(3),
        assignedTimestamps: [
          { documentName: 'calendar', revision: REVISION, observedAt: INSTANT },
        ],
        deadline: INSTANT,
        retiredCleanup: {
          operationEpoch: 2,
          candidateVersion: versionForEpoch(2),
        },
      },
      accepted: true,
    },
    {
      name: 'rejects prepared missing operationToken',
      input: {
        outcome: 'prepared',
        operationEpoch: 3,
        candidateVersion: VERSION,
        assignedTimestamps: [],
        deadline: INSTANT,
      },
      accepted: false,
    },
    {
      name: 'rejects prepared with a wrong-typed epoch',
      input: {
        outcome: 'prepared',
        operationEpoch: 'three',
        operationToken: 'token-3',
        candidateVersion: VERSION,
        assignedTimestamps: [],
        deadline: INSTANT,
      },
      accepted: false,
    },
    {
      name: 'rejects prepared with an out-of-range epoch',
      input: {
        outcome: 'prepared',
        operationEpoch: maximumOperationEpoch + 1,
        operationToken: 'token-3',
        candidateVersion: VERSION,
        assignedTimestamps: [],
        deadline: INSTANT,
      },
      accepted: false,
    },
    {
      name: 'rejects prepared whose assignedTimestamps member is malformed',
      input: {
        outcome: 'prepared',
        operationEpoch: 3,
        operationToken: 'token-3',
        candidateVersion: VERSION,
        assignedTimestamps: [
          {
            documentName: 'calendar',
            revision: 'not-a-revision',
            observedAt: INSTANT,
          },
        ],
        deadline: INSTANT,
      },
      accepted: false,
    },
    {
      name: 'accepts rejected with a known reason',
      input: { outcome: 'rejected', reason: 'authority-not-active' },
      accepted: true,
    },
    {
      name: 'rejects an unknown reason string',
      input: { outcome: 'rejected', reason: 'the-vibes-were-off' },
      accepted: false,
    },
    {
      name: 'accepts operation-in-progress with a valid liveOperation',
      input: {
        outcome: 'rejected',
        reason: 'operation-in-progress',
        liveOperation: {
          operationEpoch: 2,
          candidateVersion: versionForEpoch(2),
        },
      },
      accepted: true,
    },
    {
      name: 'rejects operation-in-progress without its liveOperation',
      input: { outcome: 'rejected', reason: 'operation-in-progress' },
      accepted: false,
    },
    {
      name: 'rejects operation-in-progress whose liveOperation epoch/version disagree',
      input: {
        outcome: 'rejected',
        reason: 'operation-in-progress',
        liveOperation: {
          operationEpoch: 2,
          candidateVersion: versionForEpoch(1),
        },
      },
      accepted: false,
    },
    {
      name: 'accepts pending-cleanup-required with a consistent pendingCleanup',
      input: {
        outcome: 'rejected',
        reason: 'pending-cleanup-required',
        pendingCleanup: {
          operationEpoch: 2,
          candidateVersion: versionForEpoch(2),
        },
      },
      accepted: true,
    },
    {
      name: 'rejects pending-cleanup-required whose pendingCleanup epoch/version disagree',
      input: {
        outcome: 'rejected',
        reason: 'pending-cleanup-required',
        pendingCleanup: {
          operationEpoch: 2,
          candidateVersion: versionForEpoch(9),
        },
      },
      accepted: false,
    },
    {
      name: 'accepts rejected with timestamp-space-exhausted',
      input: { outcome: 'rejected', reason: 'timestamp-space-exhausted' },
      accepted: true,
    },
    {
      name: 'drops liveOperation carried on an unrelated reason',
      input: {
        outcome: 'rejected',
        reason: 'season-mismatch',
        liveOperation: {
          operationEpoch: 2,
          candidateVersion: versionForEpoch(2),
        },
      },
      accepted: false,
    },
  ]);
});

describe('decodeFinalizeOutcome', () => {
  table(decodeFinalizeOutcome, [
    {
      name: 'accepts a complete committed outcome',
      input: { outcome: 'committed', result: COMMITTED, replayed: false },
      accepted: true,
    },
    {
      name: 'rejects committed with no result or replayed',
      input: { outcome: 'committed' },
      accepted: false,
    },
    {
      name: 'rejects committed with a non-boolean replayed',
      input: { outcome: 'committed', result: COMMITTED, replayed: 'yes' },
      accepted: false,
    },
    {
      name: 'rejects committed whose nested result has a bad committedAt',
      input: {
        outcome: 'committed',
        result: { ...COMMITTED, committedAt: '2026-13-40T99:99:99Z' },
        replayed: true,
      },
      accepted: false,
    },
    {
      name: 'accepts a complete superseded outcome',
      input: {
        outcome: 'superseded',
        currentOperationEpoch: 5,
        activeVersion: VERSION,
        previousVersion: null,
      },
      accepted: true,
    },
    {
      name: 'rejects superseded with an invalid epoch',
      input: {
        outcome: 'superseded',
        currentOperationEpoch: 0,
        activeVersion: VERSION,
        previousVersion: null,
      },
      accepted: false,
    },
    {
      name: 'accepts rejected with a known reason',
      input: { outcome: 'rejected', reason: 'preparation-expired' },
      accepted: true,
    },
    {
      name: 'rejects rejected with an unknown reason',
      input: { outcome: 'rejected', reason: 'nope' },
      accepted: false,
    },
  ]);
});

describe('decodeCancelOutcome', () => {
  table(decodeCancelOutcome, [
    {
      name: 'accepts cancelled with a version',
      input: { outcome: 'cancelled', candidateVersion: VERSION },
      accepted: true,
    },
    {
      name: 'accepts already-cancelled with a version',
      input: { outcome: 'already-cancelled', candidateVersion: VERSION },
      accepted: true,
    },
    {
      name: 'rejects cancelled without a version',
      input: { outcome: 'cancelled' },
      accepted: false,
    },
    {
      name: 'accepts superseded with an epoch',
      input: { outcome: 'superseded', currentOperationEpoch: 4 },
      accepted: true,
    },
    {
      name: 'rejects an unknown reason',
      input: { outcome: 'rejected', reason: 'made-up' },
      accepted: false,
    },
  ]);
});

describe('decodeCleanupAuthorization', () => {
  table(decodeCleanupAuthorization, [
    {
      name: 'accepts authorized with a version',
      input: { outcome: 'authorized', candidateVersion: VERSION },
      accepted: true,
    },
    {
      name: 'rejects authorized without a version',
      input: { outcome: 'authorized' },
      accepted: false,
    },
    {
      name: 'rejects authorized with a colon-bearing version',
      input: { outcome: 'authorized', candidateVersion: 'has:colons' },
      accepted: false,
    },
    {
      name: 'accepts refused with a known reason',
      input: { outcome: 'refused', reason: 'version-is-authoritative' },
      accepted: true,
    },
    {
      name: 'rejects refused with an unknown reason',
      input: { outcome: 'refused', reason: 'because' },
      accepted: false,
    },
  ]);
});

describe('decodeCutoverSeedOutcome', () => {
  table(decodeCutoverSeedOutcome, [
    { name: 'accepts seeded', input: { outcome: 'seeded' }, accepted: true },
    {
      name: 'accepts already-seeded',
      input: { outcome: 'already-seeded' },
      accepted: true,
    },
    {
      name: 'accepts already-active',
      input: { outcome: 'already-active' },
      accepted: true,
    },
    {
      name: 'accepts rejected with a known reason',
      input: { outcome: 'rejected', reason: 'conflicting-cutover-seed' },
      accepted: true,
    },
    {
      name: 'rejects rejected with an unknown reason',
      input: { outcome: 'rejected', reason: 'meh' },
      accepted: false,
    },
    {
      name: 'rejects an unknown outcome',
      input: { outcome: 'seededish' },
      accepted: false,
    },
  ]);
});

describe('decodeCutoverActivationOutcome', () => {
  table(decodeCutoverActivationOutcome, [
    {
      name: 'accepts activated',
      input: { outcome: 'activated' },
      accepted: true,
    },
    {
      name: 'accepts already-active',
      input: { outcome: 'already-active' },
      accepted: true,
    },
    {
      name: 'accepts rejected with a known reason',
      input: { outcome: 'rejected', reason: 'cutover-fingerprint-mismatch' },
      accepted: true,
    },
    {
      name: 'rejects rejected with an unknown reason',
      input: { outcome: 'rejected', reason: 'nah' },
      accepted: false,
    },
  ]);
});

describe('the client maps an undecodable response to its bounded fallback', () => {
  const responding = (body: unknown): SequencerNamespace => ({
    idFromName: (name) => name,
    get: () => ({
      fetch: async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    }),
  });

  it('never turns a partial committed body into a decision', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      responding({ outcome: 'committed' }),
    );
    expect(
      await client.finalize({
        season: SEASON,
        operationEpoch: 1,
        operationToken: 'token-1',
        completionAttestation: { manifestCommitment: commitment('m') },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'state-corrupt' });
  });

  it('never turns a partial prepared body into an allocation', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      responding({ outcome: 'prepared', operationEpoch: 1 }),
    );
    expect(await client.prepare(prepareRequest())).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
  });

  it('never turns an inconsistent authority into an authoritative answer', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      responding({ cutoverState: 'active', authoritative: false }),
    );
    expect(await client.readAuthority(SEASON)).toEqual({
      cutoverState: 'unavailable',
      authoritative: false,
    });
  });

  it('preserves the transport-failure fallback', async () => {
    const unreachable: SequencerNamespace = {
      idFromName: (name) => name,
      get: () => ({
        fetch: async () => {
          throw new Error('binding unavailable');
        },
      }),
    };
    const client = new DurableObjectSeasonPublicationSequencer(unreachable);
    expect(await client.seedCutover({ season: SEASON } as never)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
  });

  // R1: a response can be individually well-formed yet not correspond to the
  // request the client sent, or name a version another epoch owns. The client
  // holds the request, so it binds these and maps every failure to the same
  // bounded fallback the decoders' `null` already maps to.
  const request = prepareRequest();
  const wellFormedPreparedFor = (
    epoch: number,
    assignedTimestamps: unknown,
  ) => ({
    outcome: 'prepared' as const,
    operationEpoch: epoch,
    operationToken: `token-${epoch}`,
    candidateVersion: versionForEpoch(epoch),
    assignedTimestamps,
    deadline: INSTANT,
  });

  it('rejects a prepared response whose assignments are for another manifest', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      responding(
        wellFormedPreparedFor(1, [
          {
            documentName: 'not-in-request',
            revision: REVISION,
            observedAt: INSTANT,
          },
          { documentName: 'also-not', revision: REVISION, observedAt: INSTANT },
        ]),
      ),
    );
    expect(await client.prepare(request)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
  });

  it('rejects a prepared response whose assignment revisions do not match the request', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      responding(
        wellFormedPreparedFor(
          1,
          request.perKeyRevisions.map((entry) => ({
            documentName: entry.documentName,
            revision: rev('a-different-revision'),
            observedAt: INSTANT,
          })),
        ),
      ),
    );
    expect(await client.prepare(request)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
  });

  it('accepts a prepared response whose assignments match the request', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      responding(
        wellFormedPreparedFor(
          1,
          request.perKeyRevisions.map((entry) => ({
            documentName: entry.documentName,
            revision: entry.revision,
            observedAt: INSTANT,
          })),
        ),
      ),
    );
    expect((await client.prepare(request)).outcome).toBe('prepared');
  });

  it('rejects a cancelled response whose candidateVersion belongs to another epoch', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      responding({
        outcome: 'cancelled',
        candidateVersion: versionForEpoch(2),
      }),
    );
    expect(
      await client.cancel({
        season: SEASON,
        operationEpoch: 5,
        operationToken: 'token-5',
      }),
    ).toEqual({ outcome: 'rejected', reason: 'state-corrupt' });
  });

  it('rejects a committed response whose activeVersion belongs to another epoch', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      responding({
        outcome: 'committed',
        result: { ...COMMITTED, activeVersion: versionForEpoch(2) },
        replayed: false,
      }),
    );
    expect(
      await client.finalize({
        season: SEASON,
        operationEpoch: 5,
        operationToken: 'token-5',
        completionAttestation: { manifestCommitment: commitment('m') },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'state-corrupt' });
  });

  it('rejects an authorized cleanup whose version belongs to another epoch', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      responding({
        outcome: 'authorized',
        candidateVersion: versionForEpoch(2),
      }),
    );
    expect(
      await client.authorizeCleanup({
        season: SEASON,
        operationEpoch: 5,
        operationToken: 'token-5',
        candidateVersion: versionForEpoch(5),
      }),
    ).toEqual({ outcome: 'refused', reason: 'state-corrupt' });
  });

  // An `authorized` response must name the exact deletion target the request
  // named - not merely another version that encodes the same epoch. Bound
  // through the one shared client method for both request forms.
  describe('cleanup authorization is bound to the exact requested version', () => {
    const requestedA = versionForEpoch(5, 'aaaaaaaa');
    const responseB = versionForEpoch(5, 'bbbbbbbb'); // same epoch, different opaque
    const currentRecordRequest = {
      season: SEASON,
      operationEpoch: 5,
      operationToken: 'token-5',
      candidateVersion: requestedA,
    };
    const pendingSlotRequest = {
      season: SEASON,
      operationEpoch: 5,
      candidateVersion: requestedA,
    };

    it('rejects a same-epoch different-version authorized response for a current-record request', async () => {
      const client = new DurableObjectSeasonPublicationSequencer(
        responding({ outcome: 'authorized', candidateVersion: responseB }),
      );
      expect(await client.authorizeCleanup(currentRecordRequest)).toEqual({
        outcome: 'refused',
        reason: 'state-corrupt',
      });
    });

    it('rejects a same-epoch different-version authorized response for a pending-slot request', async () => {
      const client = new DurableObjectSeasonPublicationSequencer(
        responding({ outcome: 'authorized', candidateVersion: responseB }),
      );
      expect(await client.authorizeCleanup(pendingSlotRequest)).toEqual({
        outcome: 'refused',
        reason: 'state-corrupt',
      });
    });

    it('accepts an authorized response naming the exact requested version', async () => {
      const client = new DurableObjectSeasonPublicationSequencer(
        responding({ outcome: 'authorized', candidateVersion: requestedA }),
      );
      expect(await client.authorizeCleanup(currentRecordRequest)).toEqual({
        outcome: 'authorized',
        candidateVersion: requestedA,
      });
      const pendingClient = new DurableObjectSeasonPublicationSequencer(
        responding({ outcome: 'authorized', candidateVersion: requestedA }),
      );
      expect(await pendingClient.authorizeCleanup(pendingSlotRequest)).toEqual({
        outcome: 'authorized',
        candidateVersion: requestedA,
      });
    });

    it('fails closed when the exact version is returned but the request epoch is incompatible', async () => {
      // requestedA encodes epoch 5; the request claims epoch 6.
      const client = new DurableObjectSeasonPublicationSequencer(
        responding({ outcome: 'authorized', candidateVersion: requestedA }),
      );
      expect(
        await client.authorizeCleanup({
          season: SEASON,
          operationEpoch: 6,
          operationToken: 'token-6',
          candidateVersion: requestedA,
        }),
      ).toEqual({ outcome: 'refused', reason: 'state-corrupt' });
    });
  });
});
