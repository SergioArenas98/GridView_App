/**
 * The adapter outcome union is a runtime trust boundary, not merely a compile
 * time type.
 *
 * `ProviderResourceOutcome` is a closed discriminated union: each variant
 * declares exactly which properties it carries, and the absence of `attempt`
 * on `not-attempted` is the mechanism that makes "not attempted" impossible to
 * miscount as a request. A validator that only recognises enough fields to
 * enter a branch does not enforce that: an adapter can then hand back
 * `not-attempted` carrying a real transport attempt, the coordinator classifies
 * the operation as skipped, and the request it actually made disappears from
 * accounting.
 *
 * These tests pin the union's shape closure per variant, and prove that a
 * malformed outcome stays unattempted, unselected, unassembled and unpublished
 * without inventing request activity from a record already known to be
 * unusable.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  MultiSourceCoordinator,
  attemptOutcomesForFailureReason,
  attemptedFailureReasons,
  coordinationFor,
  isWellFormedOutcome,
  notAttemptedReasons,
  type CoordinatedResource,
  type CoordinationRun,
  type ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import type { ProviderAttemptOutcome } from '../../../src/providers/provider-metrics';
import {
  FakePort,
  SEASON,
  attempt,
  payloadFor,
  raceResource,
  seasonFixture,
  seasonResources,
} from './support';

const RACE = raceResource(12);
const STANDINGS = seasonResources[3] as CoordinatedResource;
const RETRY_AT = '2026-07-20T12:00:30.000Z';
const zero = { total: 0, successful: 0, failed: 0, rateLimited: 0 };

function coordinate(
  ports: FakePort[],
  resources: readonly CoordinatedResource[] = [RACE],
): Promise<CoordinationRun> {
  return new MultiSourceCoordinator({
    ports,
    logger: new CapturingLogger(),
  }).coordinate({ plan: { season: SEASON, resources } });
}

/** Runs one raw adapter answer through the real coordinator. */
function coordinateOutcome(answer: () => unknown): Promise<CoordinationRun> {
  return coordinate([
    new FakePort('jolpica', () => answer() as ProviderResourceOutcome),
  ]);
}

/** One valid instance of every declared variant, keyed for reuse. */
function validOutcomes(payload: unknown): Record<string, unknown> {
  return {
    candidate: {
      outcome: 'candidate',
      attempt: attempt('ref-1'),
      payload,
    },
    'not-attempted': {
      outcome: 'not-attempted',
      reason: 'rate-limit-deferred',
    },
    failed: {
      outcome: 'failed',
      attempt: attempt('ref-2', 'failed'),
      reason: 'provider-unavailable',
    },
    'mapping-failure': {
      outcome: 'mapping-failure',
      attempt: attempt('ref-3'),
    },
  };
}

describe('every declared outcome variant is accepted', () => {
  it('accepts one valid instance of each variant', async () => {
    const source = await seasonFixture();
    for (const [name, outcome] of Object.entries(
      validOutcomes(payloadFor(source, RACE)),
    )) {
      expect(isWellFormedOutcome(outcome), name).toBe(true);
    }
  });

  it('accepts every not-attempted reason, with and without retryAt', () => {
    for (const reason of notAttemptedReasons) {
      expect(isWellFormedOutcome({ outcome: 'not-attempted', reason })).toBe(
        true,
      );
      expect(
        isWellFormedOutcome({
          outcome: 'not-attempted',
          reason,
          retryAt: RETRY_AT,
        }),
      ).toBe(true);
    }
  });

  it('accepts every allowed failure pairing, with and without retryAfter', () => {
    for (const reason of attemptedFailureReasons) {
      for (const outcome of attemptOutcomesForFailureReason(reason)) {
        expect(
          isWellFormedOutcome({
            outcome: 'failed',
            attempt: attempt('r', outcome),
            reason,
          }),
          `${reason}/${outcome}`,
        ).toBe(true);
        expect(
          isWellFormedOutcome({
            outcome: 'failed',
            attempt: attempt('r', outcome),
            reason,
            retryAfter: RETRY_AT,
          }),
          `${reason}/${outcome}+retryAfter`,
        ).toBe(true);
      }
    }
  });
});

describe('a required field is never optional', () => {
  it('rejects each variant with one declared required field removed', async () => {
    const source = await seasonFixture();
    const required: Record<string, readonly string[]> = {
      candidate: ['outcome', 'attempt', 'payload'],
      'not-attempted': ['outcome', 'reason'],
      failed: ['outcome', 'attempt', 'reason'],
      'mapping-failure': ['outcome', 'attempt'],
    };
    const valid = validOutcomes(payloadFor(source, RACE));
    for (const [name, keys] of Object.entries(required)) {
      for (const key of keys) {
        const stripped = { ...(valid[name] as Record<string, unknown>) };
        delete stripped[key];
        expect(isWellFormedOutcome(stripped), `${name} without ${key}`).toBe(
          false,
        );
      }
    }
  });
});

describe('not-attempted cannot carry an attempt', () => {
  const attemptOutcomes: readonly ProviderAttemptOutcome[] = [
    'successful',
    'failed',
    'rate-limited',
  ];

  for (const outcome of attemptOutcomes) {
    it(`rejects a not-attempted outcome carrying a ${outcome} attempt`, () => {
      expect(
        isWellFormedOutcome({
          outcome: 'not-attempted',
          reason: 'rate-limit-deferred',
          attempt: attempt('smuggled', outcome),
        }),
      ).toBe(false);
    });
  }

  it('rejects an explicitly present attempt of undefined', () => {
    // An own property that happens to hold `undefined` is still structurally
    // present, and an adapter that sets one is not producing the declared
    // variant.
    expect(
      isWellFormedOutcome({
        outcome: 'not-attempted',
        reason: 'source-unavailable',
        attempt: undefined,
      }),
    ).toBe(false);
  });

  it('rejects an attempt reachable only through the prototype', () => {
    const hostile = Object.create({ attempt: attempt('inherited') }) as Record<
      string,
      unknown
    >;
    hostile.outcome = 'not-attempted';
    hostile.reason = 'cancelled';
    expect(isWellFormedOutcome(hostile)).toBe(false);
  });
});

describe('unexpected properties are rejected on every variant', () => {
  it('rejects an undeclared field on each variant', async () => {
    const source = await seasonFixture();
    for (const [name, outcome] of Object.entries(
      validOutcomes(payloadFor(source, RACE)),
    )) {
      expect(
        isWellFormedOutcome({
          ...(outcome as Record<string, unknown>),
          smuggled: 'value',
        }),
        name,
      ).toBe(false);
    }
  });

  it('rejects a field another variant declares but this one does not', async () => {
    const source = await seasonFixture();
    const foreign: Record<string, Record<string, unknown>> = {
      candidate: { reason: 'provider-unavailable', retryAt: RETRY_AT },
      'not-attempted': { payload: {}, retryAfter: RETRY_AT },
      failed: { payload: {}, retryAt: RETRY_AT },
      'mapping-failure': { reason: 'provider-unavailable', payload: {} },
    };
    const valid = validOutcomes(payloadFor(source, RACE));
    for (const [name, extras] of Object.entries(foreign)) {
      for (const [key, value] of Object.entries(extras)) {
        expect(
          isWellFormedOutcome({
            ...(valid[name] as Record<string, unknown>),
            [key]: value,
          }),
          `${name} + ${key}`,
        ).toBe(false);
      }
    }
  });
});

describe('a malformed outcome produces no accounting', () => {
  it('fails a not-attempted outcome carrying an attempt closed', async () => {
    const run = await coordinateOutcome(() => ({
      outcome: 'not-attempted',
      reason: 'rate-limit-deferred',
      attempt: attempt('hidden'),
      retryAt: RETRY_AT,
    }));
    const contribution = coordinationFor(run, RACE)?.contributions[0];

    expect(contribution?.status).toBe('failed');
    expect(contribution?.reason).toBe('malformed-outcome');
    expect(contribution?.attempted).toBe(false);
    expect(contribution?.retryAt).toBeNull();
    // The smuggled attempt is never registered as transport activity.
    expect(run.accounting.lifetime).toEqual(zero);
    expect(run.accounting.bySource).toEqual({});
    expect(run.accounting.byJobCategory).toEqual({});
    expect(run.counts.attempted).toBe(0);
    expect(run.counts.selected).toBe(0);
    expect(coordinationFor(run, RACE)?.selection.outcome).toBe('unavailable');
  });

  it('contains an attempt property whose getter throws', async () => {
    const run = await coordinateOutcome(() => {
      const hostile: Record<string, unknown> = {
        outcome: 'not-attempted',
        reason: 'limiter-unavailable',
      };
      Object.defineProperty(hostile, 'attempt', {
        enumerable: true,
        get() {
          throw new Error('hostile accessor');
        },
      });
      return hostile;
    });
    const contribution = coordinationFor(run, RACE)?.contributions[0];

    expect(contribution?.status).toBe('failed');
    expect(contribution?.reason).toBe('malformed-outcome');
    expect(contribution?.attempted).toBe(false);
    expect(run.accounting.lifetime).toEqual(zero);
  });

  it('contains a proxy whose property traps throw', async () => {
    const run = await coordinateOutcome(
      () =>
        new Proxy(
          { outcome: 'not-attempted', reason: 'cancelled' },
          {
            has() {
              throw new Error('hostile has trap');
            },
            ownKeys() {
              throw new Error('hostile ownKeys trap');
            },
          },
        ),
    );
    const contribution = coordinationFor(run, RACE)?.contributions[0];

    expect(contribution?.status).toBe('failed');
    expect(contribution?.reason).toBe('malformed-outcome');
    expect(contribution?.attempted).toBe(false);
    expect(run.accounting.lifetime).toEqual(zero);
  });

  it('never selects, assembles or publishes a malformed candidate', async () => {
    const source = await seasonFixture();
    const run = await coordinateOutcome(() => ({
      outcome: 'candidate',
      attempt: attempt('ref'),
      payload: payloadFor(source, RACE),
      smuggled: true,
    }));

    expect(run.resources[0]?.contributions[0]?.reason).toBe(
      'malformed-outcome',
    );
    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
    expect(run.counts.selected).toBe(0);
    expect(run.accounting.lifetime).toEqual(zero);
  });

  it('keeps hostile values and raw references out of the logs', async () => {
    const logger = new CapturingLogger();
    const port = new FakePort('jolpica', () => ({
      outcome: 'not-attempted',
      reason: 'rate-limit-deferred',
      attempt: attempt('smuggled-reference'),
    }));
    await new MultiSourceCoordinator({ ports: [port], logger }).coordinate({
      plan: { season: SEASON, resources: [RACE] },
    });

    const serialized = logger.serialized();
    expect(serialized).not.toContain('smuggled-reference');
    expect(serialized).not.toContain('hostile');
  });
});

describe('valid accounting is unchanged by the shape closure', () => {
  it('counts every valid attempted variant exactly once', async () => {
    const source = await seasonFixture();
    let sequence = 0;
    const port = new FakePort('jolpica', (request) => {
      sequence += 1;
      const payload = payloadFor(source, request.resource);
      if (payload === null) throw new Error('fixture gap');
      return {
        outcome: 'candidate',
        attempt: attempt(`j-${sequence}`),
        payload,
      };
    });

    const run = await coordinate([port], [RACE, STANDINGS]);

    expect(run.accounting.lifetime).toEqual({
      total: 2,
      successful: 2,
      failed: 0,
      rateLimited: 0,
    });
    expect(run.counts.attempted).toBe(2);
  });

  it('still deduplicates identical same-source references', async () => {
    const source = await seasonFixture();
    const port = new FakePort('jolpica', (request) => {
      const payload = payloadFor(source, request.resource);
      if (payload === null) throw new Error('fixture gap');
      return { outcome: 'candidate', attempt: attempt('shared'), payload };
    });

    const run = await coordinate([port], [RACE, STANDINGS]);

    expect(run.accounting.lifetime).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(run.counts.selected).toBe(2);
  });
});
