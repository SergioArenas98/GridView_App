/**
 * Ordered multi-request outcomes and interrupted executions (ADR 0023
 * amendment A1).
 *
 * One resource execution may make more than one real provider request - the
 * Jolpica season participants are two endpoints. Every request it made is
 * reported once, in transport order, and counted exactly once; a step that
 * never reached transport is never an attempt; and an execution that stopped
 * between two requests is its own closed outcome rather than a success, a
 * failure it never had or "nothing was attempted".
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  MultiSourceCoordinator,
  coordinationFor,
  interruptionReasons,
  isWellFormedOutcome,
  maxTransportAttemptsPerOutcome,
  notAttemptedReasons,
  readProviderOutcome,
  type CoordinatedResource,
  type CoordinationRun,
  type ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import {
  FakePort,
  SEASON,
  attempt,
  payloadFor,
  seasonFixture,
  seasonResources,
} from './support';

const PARTICIPANTS = seasonResources[1] as CoordinatedResource;
const STANDINGS = seasonResources[3] as CoordinatedResource;
const RETRY_AT = '2026-07-20T12:00:30.000Z';

function coordinate(
  ports: FakePort[],
  resources: readonly CoordinatedResource[] = [PARTICIPANTS],
): Promise<CoordinationRun> {
  return new MultiSourceCoordinator({
    ports,
    logger: new CapturingLogger(),
  }).coordinate({ plan: { season: SEASON, resources } });
}

function jolpica(run: CoordinationRun, resource = PARTICIPANTS) {
  return coordinationFor(run, resource)?.contributions.find(
    (entry) => entry.source === 'jolpica',
  );
}

function counts(
  total: number,
  successful: number,
  failed: number,
  rateLimited: number,
) {
  return { total, successful, failed, rateLimited };
}

async function participantsPayload(): Promise<unknown> {
  const payload = payloadFor(await seasonFixture(), PARTICIPANTS);
  if (payload === null) throw new Error('fixture gap');
  return payload;
}

function answering(outcome: unknown): FakePort {
  return new FakePort('jolpica', () => outcome as ProviderResourceOutcome);
}

describe('every real request of one execution is counted exactly once', () => {
  it('counts a two-request candidate as two successful requests', async () => {
    const run = await coordinate([
      answering({
        outcome: 'candidate',
        attempts: [attempt('drivers'), attempt('constructors')],
        payload: await participantsPayload(),
      }),
    ]);

    expect(run.status).toBe('completed');
    expect(run.accounting.lifetime).toEqual(counts(2, 2, 0, 0));
    expect(run.accounting.bySource).toEqual({ jolpica: counts(2, 2, 0, 0) });
    expect(run.accounting.byJobCategory).toEqual({
      profiles: counts(2, 2, 0, 0),
    });
    expect(coordinationFor(run, PARTICIPANTS)?.selection.outcome).toBe(
      'selected',
    );
    // One contribution, however many requests it needed.
    expect(run.counts.attempted).toBe(1);
  });

  it('counts a first success and a second provider failure as one of each', async () => {
    const run = await coordinate([
      answering({
        outcome: 'failed',
        attempts: [attempt('drivers'), attempt('constructors', 'failed')],
        reason: 'provider-unavailable',
      }),
    ]);

    expect(run.accounting.lifetime).toEqual(counts(2, 1, 1, 0));
    expect(jolpica(run)).toMatchObject({
      status: 'failed',
      attempted: true,
      reason: 'provider-unavailable',
      payload: null,
    });
    expect(coordinationFor(run, PARTICIPANTS)?.selection.outcome).toBe(
      'unavailable',
    );
  });

  it('counts a first success and a second 429 as one success and one rate-limited request', async () => {
    const run = await coordinate([
      answering({
        outcome: 'failed',
        attempts: [attempt('drivers'), attempt('constructors', 'rate-limited')],
        reason: 'provider-rate-limited',
        retryAfter: RETRY_AT,
      }),
    ]);

    expect(run.accounting.lifetime).toEqual(counts(2, 1, 0, 1));
    expect(jolpica(run)).toMatchObject({
      status: 'failed',
      attempted: true,
      reason: 'provider-rate-limited',
      retryAfter: RETRY_AT,
    });
  });

  it('counts a second response that was read but invalid as two successful requests', async () => {
    const run = await coordinate([
      answering({
        outcome: 'failed',
        attempts: [attempt('drivers'), attempt('constructors')],
        reason: 'invalid-payload',
      }),
    ]);

    expect(run.accounting.lifetime).toEqual(counts(2, 2, 0, 0));
    expect(jolpica(run)?.reason).toBe('invalid-payload');
  });

  it('counts a mapping failure after two requests as two successful requests', async () => {
    const run = await coordinate([
      answering({
        outcome: 'mapping-failure',
        attempts: [attempt('drivers'), attempt('constructors')],
      }),
    ]);

    expect(run.accounting.lifetime).toEqual(counts(2, 2, 0, 0));
    expect(jolpica(run)).toMatchObject({
      status: 'failed',
      attempted: true,
      reason: 'mapping-unresolved',
    });
  });

  it('keeps a single-request resource at exactly its previous totals', async () => {
    const source = await seasonFixture();
    const payload = payloadFor(source, STANDINGS);
    const run = await coordinate(
      [
        answering({
          outcome: 'candidate',
          attempts: [attempt('j-1')],
          payload,
        }),
      ],
      [STANDINGS],
    );

    expect(run.accounting.lifetime).toEqual(counts(1, 1, 0, 0));
    expect(run.accounting.byJobCategory).toEqual({
      standings: counts(1, 1, 0, 0),
    });
    expect(run.counts.attempted).toBe(1);
  });
});

describe('an interrupted execution records only the requests it made', () => {
  for (const reason of interruptionReasons) {
    it(`records the first request and no attempt for a ${reason} second step`, async () => {
      const run = await coordinate([
        answering({
          outcome: 'interrupted',
          attempts: [attempt('drivers')],
          reason,
          ...(reason === 'rate-limit-deferred' ? { retryAt: RETRY_AT } : {}),
        }),
      ]);

      // The refused step reserved nothing that left GridView and is not a
      // provider request: exactly one request, and it succeeded.
      expect(run.accounting.lifetime).toEqual(counts(1, 1, 0, 0));
      const contribution = jolpica(run);
      expect(contribution).toMatchObject({
        status: 'interrupted',
        attempted: true,
        reason,
        payload: null,
        retryAt: reason === 'rate-limit-deferred' ? RETRY_AT : null,
      });
      // Never selectable, never publishable.
      expect(coordinationFor(run, PARTICIPANTS)?.selection).toEqual({
        outcome: 'unavailable',
        reason: 'no-usable-candidate',
      });
      expect(run.counts.attempted).toBe(1);
      expect(run.counts.notAttempted).toBe(1);
    });
  }

  it('is not the same thing as nothing attempted', async () => {
    const interrupted = await coordinate([
      answering({
        outcome: 'interrupted',
        attempts: [attempt('drivers')],
        reason: 'cancelled',
      }),
    ]);
    const skipped = await coordinate([
      answering({ outcome: 'not-attempted', reason: 'cancelled' }),
    ]);

    expect(jolpica(interrupted)?.attempted).toBe(true);
    expect(jolpica(skipped)?.attempted).toBe(false);
    expect(interrupted.accounting.lifetime.total).toBe(1);
    expect(skipped.accounting.lifetime.total).toBe(0);
  });
});

describe('the attempt collection is a closed, ordered, bounded shape', () => {
  it('preserves transport order in the coordinator’s own copy', () => {
    const normalized = readProviderOutcome({
      outcome: 'failed',
      attempts: [attempt('first'), attempt('second', 'failed')],
      reason: 'provider-unavailable',
    });

    expect(normalized?.outcome === 'failed' && normalized.attempts).toEqual([
      { reference: 'first', outcome: 'successful' },
      { reference: 'second', outcome: 'failed' },
    ]);
  });

  it('cannot be reordered or extended by the adapter after answering', async () => {
    const source = await seasonFixture();
    const attempts = [attempt('drivers'), attempt('constructors', 'failed')];
    const port = new FakePort('jolpica', (request) => {
      if (request.resource.kind === 'season-participants') {
        return {
          outcome: 'failed',
          attempts,
          reason: 'provider-unavailable',
        } as unknown as ProviderResourceOutcome;
      }
      // The adapter refills its buffer while answering the next request:
      // reversed and extended with a request that never happened.
      attempts.reverse();
      attempts.push(attempt('phantom', 'rate-limited'));
      return {
        outcome: 'candidate',
        attempts: [attempt('standings')],
        payload: payloadFor(source, request.resource),
      } as ProviderResourceOutcome;
    });

    const run = await coordinate([port], [PARTICIPANTS, STANDINGS]);

    expect(attempts.map((entry) => entry.reference)).toEqual([
      'constructors',
      'drivers',
      'phantom',
    ]);
    // Accounted from the copy taken on arrival: drivers, constructors,
    // standings - no phantom, no reordering, nothing counted twice.
    expect(run.accounting.lifetime).toEqual(counts(3, 2, 1, 0));
    expect(jolpica(run)?.reason).toBe('provider-unavailable');
  });

  it('refuses a duplicate reference inside one outcome and counts nothing', async () => {
    const run = await coordinate([
      answering({
        outcome: 'candidate',
        attempts: [attempt('same'), attempt('same')],
        payload: await participantsPayload(),
      }),
    ]);

    expect(jolpica(run)).toMatchObject({
      status: 'failed',
      attempted: false,
      reason: 'malformed-outcome',
    });
    expect(run.accounting.lifetime).toEqual(counts(0, 0, 0, 0));
  });

  it('registers nothing from an outcome that conflicts with an earlier request', async () => {
    const source = await seasonFixture();
    let calls = 0;
    const port = new FakePort('jolpica', (request) => {
      calls += 1;
      if (calls === 1) {
        return {
          outcome: 'candidate',
          attempts: [attempt('r-1')],
          payload: payloadFor(source, request.resource),
        } as ProviderResourceOutcome;
      }
      // `r-2` is new, but `r-1` now claims a different ending.
      return {
        outcome: 'failed',
        attempts: [attempt('r-2'), attempt('r-1', 'failed')],
        reason: 'provider-unavailable',
      };
    });

    const run = await coordinate([port], [STANDINGS, PARTICIPANTS]);

    expect(run.status).toBe('invariant-violated');
    expect(jolpica(run)?.reason).toBe('coordination-invariant');
    // Only the first operation's request is counted, once.
    expect(run.accounting.lifetime).toEqual(counts(1, 1, 0, 0));
  });

  it('counts a request two outcomes share once, even inside a longer collection', async () => {
    const source = await seasonFixture();
    const port = new FakePort('jolpica', (request) =>
      request.resource.kind === 'driver-standings'
        ? ({
            outcome: 'candidate',
            attempts: [attempt('shared')],
            payload: payloadFor(source, request.resource),
          } as ProviderResourceOutcome)
        : ({
            outcome: 'candidate',
            attempts: [attempt('shared'), attempt('own')],
            payload: payloadFor(source, request.resource),
          } as ProviderResourceOutcome),
    );

    const run = await coordinate([port], [STANDINGS, PARTICIPANTS]);

    expect(run.accounting.lifetime).toEqual(counts(2, 2, 0, 0));
  });

  const refused: Record<string, unknown> = {
    'an empty candidate collection': {
      outcome: 'candidate',
      attempts: [],
      payload: {},
    },
    'an empty failure collection': {
      outcome: 'failed',
      attempts: [],
      reason: 'provider-unavailable',
    },
    'an empty mapping-failure collection': {
      outcome: 'mapping-failure',
      attempts: [],
    },
    'an empty interrupted collection': {
      outcome: 'interrupted',
      attempts: [],
      reason: 'cancelled',
    },
    'a legacy singular attempt': {
      outcome: 'mapping-failure',
      attempt: attempt('r'),
    },
    'a bare attempt object instead of a collection': {
      outcome: 'mapping-failure',
      attempts: attempt('r'),
    },
    'a malformed element': {
      outcome: 'mapping-failure',
      attempts: [attempt('r'), { reference: 'x' }],
    },
    'an element with an undeclared field': {
      outcome: 'mapping-failure',
      attempts: [{ reference: 'r', outcome: 'successful', url: 'x' }],
    },
    'a candidate whose second request failed': {
      outcome: 'candidate',
      attempts: [attempt('a'), attempt('b', 'failed')],
      payload: {},
    },
    'a mapping failure over a rate-limited request': {
      outcome: 'mapping-failure',
      attempts: [attempt('a'), attempt('b', 'rate-limited')],
    },
    'a failure whose earlier request also failed': {
      outcome: 'failed',
      attempts: [attempt('a', 'failed'), attempt('b', 'failed')],
      reason: 'provider-unavailable',
    },
    'a 429 reason over a successful final request': {
      outcome: 'failed',
      attempts: [attempt('a'), attempt('b')],
      reason: 'provider-rate-limited',
    },
    'an interruption over a failed request': {
      outcome: 'interrupted',
      attempts: [attempt('a', 'failed')],
      reason: 'cancelled',
    },
    'an interruption carrying a payload': {
      outcome: 'interrupted',
      attempts: [attempt('a')],
      reason: 'cancelled',
      payload: {},
    },
    'an interruption with an invalid retryAt': {
      outcome: 'interrupted',
      attempts: [attempt('a')],
      reason: 'rate-limit-deferred',
      retryAt: 'soon',
    },
    'an interruption carrying retryAfter': {
      outcome: 'interrupted',
      attempts: [attempt('a')],
      reason: 'rate-limit-deferred',
      retryAfter: RETRY_AT,
    },
    'a not-attempted outcome carrying attempts': {
      outcome: 'not-attempted',
      reason: 'cancelled',
      attempts: [attempt('a')],
    },
    'a not-attempted outcome carrying an empty collection': {
      outcome: 'not-attempted',
      reason: 'cancelled',
      attempts: [],
    },
    'more attempts than the bound': {
      outcome: 'mapping-failure',
      attempts: Array.from(
        { length: maxTransportAttemptsPerOutcome + 1 },
        (_, index) => attempt(`r-${index}`),
      ),
    },
  };

  for (const [name, outcome] of Object.entries(refused)) {
    it(`refuses ${name}`, () => {
      expect(isWellFormedOutcome(outcome)).toBe(false);
    });
  }

  it('accepts exactly the bound', () => {
    expect(
      isWellFormedOutcome({
        outcome: 'mapping-failure',
        attempts: Array.from(
          { length: maxTransportAttemptsPerOutcome },
          (_, index) => attempt(`r-${index}`),
        ),
      }),
    ).toBe(true);
  });

  it('refuses every reason that cannot interrupt an execution', () => {
    const others = [
      ...notAttemptedReasons.filter(
        (reason) =>
          !(interruptionReasons as readonly string[]).includes(reason),
      ),
      'provider-unavailable',
      'invalid-payload',
      'adapter-error',
    ];
    expect(others).toContain('source-locked');
    for (const reason of others) {
      expect(
        isWellFormedOutcome({
          outcome: 'interrupted',
          attempts: [attempt('a')],
          reason,
        }),
        reason,
      ).toBe(false);
    }
  });

  it('refuses a sparse collection', () => {
    const attempts: unknown[] = [attempt('a')];
    attempts[2] = attempt('c');
    expect(isWellFormedOutcome({ outcome: 'mapping-failure', attempts })).toBe(
      false,
    );
  });

  it('refuses a collection carrying an extra own property', () => {
    const attempts = Object.assign([attempt('a')], { url: 'x' });
    expect(isWellFormedOutcome({ outcome: 'mapping-failure', attempts })).toBe(
      false,
    );
  });

  it('refuses a collection carrying a symbol-keyed property', () => {
    const attempts: unknown[] = [attempt('a')];
    Object.defineProperty(attempts, Symbol('smuggled'), {
      value: 'value',
      enumerable: true,
    });
    expect(isWellFormedOutcome({ outcome: 'mapping-failure', attempts })).toBe(
      false,
    );
  });

  it('refuses an accessor-backed element without invoking it', () => {
    let invoked = false;
    const attempts: unknown[] = [attempt('a')];
    Object.defineProperty(attempts, '0', {
      enumerable: true,
      get() {
        invoked = true;
        return attempt('a');
      },
    });
    expect(isWellFormedOutcome({ outcome: 'mapping-failure', attempts })).toBe(
      false,
    );
    expect(invoked).toBe(false);
  });

  it('refuses an element inherited from the prototype', () => {
    const attempts: unknown[] = new Array(1);
    Object.setPrototypeOf(
      attempts,
      Object.assign(Object.create(Array.prototype) as object, {
        0: attempt('a'),
      }),
    );
    expect(isWellFormedOutcome({ outcome: 'mapping-failure', attempts })).toBe(
      false,
    );
  });

  it('contains a hostile collection proxy', () => {
    const attempts = new Proxy([attempt('a')], {
      ownKeys() {
        throw new Error('hostile');
      },
    });
    expect(() =>
      isWellFormedOutcome({ outcome: 'mapping-failure', attempts }),
    ).not.toThrow();
    expect(isWellFormedOutcome({ outcome: 'mapping-failure', attempts })).toBe(
      false,
    );
  });
});
