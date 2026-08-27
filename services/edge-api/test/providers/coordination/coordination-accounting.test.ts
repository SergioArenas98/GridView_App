/**
 * Exact provider request accounting across a coordination run.
 *
 * Required cases 20-23.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  MultiSourceCoordinator,
  coordinationFor,
  type CoordinatedResource,
  type CoordinationRun,
} from '../../../src/providers/coordination';
import {
  FakePort,
  SEASON,
  attempt,
  payloadFor,
  raceResource,
  seasonFixture,
  seasonResources,
  testOnlyProvisionalBound,
} from './support';

const STANDINGS = seasonResources[3] as CoordinatedResource;
const RACE = raceResource(12);

function coordinate(
  ports: FakePort[],
  resources: readonly CoordinatedResource[],
  bound?: unknown,
): Promise<CoordinationRun> {
  return new MultiSourceCoordinator({
    ports,
    logger: new CapturingLogger(),
    ...(bound === undefined ? {} : { provisionalSessionEndBound: bound }),
  }).coordinate({ plan: { season: SEASON, resources } });
}

const zero = { total: 0, successful: 0, failed: 0, rateLimited: 0 };

describe('a request GridView never sent is never an attempt', () => {
  // Case 20
  it('keeps a limiter deferral not-attempted and retains retryAt', async () => {
    const retryAt = '2026-07-20T12:00:30.000Z';
    const port = new FakePort('jolpica', () => ({
      outcome: 'not-attempted',
      reason: 'rate-limit-deferred',
      retryAt,
    }));

    const run = await coordinate([port], [RACE]);
    const contribution = coordinationFor(run, RACE)?.contributions.find(
      (entry) => entry.source === 'jolpica',
    );

    expect(contribution?.status).toBe('deferred');
    expect(contribution?.attempted).toBe(false);
    expect(contribution?.retryAt).toBe(retryAt);
    expect(run.accounting.lifetime).toEqual(zero);
    expect(run.accounting.bySource).toEqual({});
    expect(run.counts.attempted).toBe(0);
  });

  it('discards a retry hint that is not an absolute UTC instant', async () => {
    for (const retryAt of ['soon', '2026-07-20T12:00:30Z', '', '12:00:30']) {
      const port = new FakePort('jolpica', () => ({
        outcome: 'not-attempted',
        reason: 'rate-limit-deferred',
        retryAt,
      }));
      const run = await coordinate([port], [RACE]);
      // A malformed hint makes the whole outcome malformed rather than being
      // silently dropped, so nothing downstream can schedule on a bad value.
      expect(run.resources[0]?.contributions[0]?.reason).toBe(
        'malformed-outcome',
      );
      expect(run.resources[0]?.contributions[0]?.retryAt).toBeNull();
    }
  });

  it('never counts a limiter-unavailable or locked source', async () => {
    const jolpica = new FakePort('jolpica', () => ({
      outcome: 'not-attempted',
      reason: 'limiter-unavailable',
    }));
    const openf1 = new FakePort('openf1', () => {
      throw new Error('the locked source must never be called');
    });

    const run = await coordinate([jolpica, openf1], [RACE]);

    expect(run.accounting.lifetime).toEqual(zero);
    expect(openf1.requests).toHaveLength(0);
  });
});

describe('an attempted request is counted exactly once', () => {
  // Case 21
  it('counts an upstream 429 as attempted and attributes it to its source', async () => {
    const source = await seasonFixture();
    const jolpica = new FakePort('jolpica', (request) => ({
      outcome: 'candidate',
      attempt: attempt('j-1'),
      payload: payloadFor(source, request.resource) ?? {
        kind: 'season-circuits',
        circuits: [],
      },
    }));
    const openf1 = new FakePort('openf1', () => ({
      outcome: 'failed',
      attempt: attempt('o-1', 'rate-limited'),
      reason: 'provider-rate-limited',
      retryAfter: '2026-07-20T12:01:00.000Z',
    }));

    const run = await coordinate(
      [jolpica, openf1],
      [RACE],
      testOnlyProvisionalBound,
    );
    const provisional = coordinationFor(run, RACE)?.contributions.find(
      (entry) => entry.source === 'openf1',
    );

    expect(provisional?.attempted).toBe(true);
    expect(provisional?.reason).toBe('provider-rate-limited');
    expect(provisional?.retryAfter).toBe('2026-07-20T12:01:00.000Z');
    expect(run.accounting.bySource).toEqual({
      jolpica: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
      openf1: { total: 1, successful: 0, failed: 0, rateLimited: 1 },
    });
    expect(run.accounting.lifetime).toEqual({
      total: 2,
      successful: 1,
      failed: 0,
      rateLimited: 1,
    });
  });

  // Case 22
  it('counts one attempt per real request, per source and per job category', async () => {
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

    const run = await coordinate([port], [RACE, STANDINGS, raceResource(13)]);

    expect(port.requests).toHaveLength(3);
    expect(run.accounting.lifetime.total).toBe(3);
    expect(run.accounting.byJobCategory).toEqual({
      results: { total: 2, successful: 2, failed: 0, rateLimited: 0 },
      standings: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
    });
    expect(run.counts.attempted).toBe(3);
  });

  // Case 23
  it('counts one request serving two derived resources exactly once', async () => {
    const source = await seasonFixture();
    // Both resources are answered from the same physical response, so both
    // outcomes carry the same transport reference.
    const port = new FakePort('jolpica', (request) => {
      const payload = payloadFor(source, request.resource);
      if (payload === null) throw new Error('fixture gap');
      return { outcome: 'candidate', attempt: attempt('shared'), payload };
    });

    const run = await coordinate([port], [RACE, STANDINGS]);

    expect(port.requests).toHaveLength(2);
    // Two consumers, one outbound request, one attempt.
    expect(run.accounting.lifetime).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(run.accounting.bySource).toEqual({
      jolpica: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
    });
    // ...credited to every job category it served, which is why these do not
    // sum to the total.
    expect(run.accounting.byJobCategory).toEqual({
      results: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
      standings: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
    });
    // Both resources still resolved independently.
    expect(run.counts.selected).toBe(2);
  });

  it('keeps the two sources accounted separately under a shared reference', async () => {
    const source = await seasonFixture();
    const payload = payloadFor(source, RACE);
    if (payload === null) throw new Error('fixture gap');
    // A transport reference is a token one adapter mints for itself. The two
    // adapters are independent, so they share no namespace and cannot avoid
    // each other's tokens: the same string from both is a coincidence, not a
    // claim about one request. Neither deduplicated, nor treated as a
    // conflict - two real requests, counted twice and attributed separately.
    const jolpica = new FakePort('jolpica', () => ({
      outcome: 'candidate',
      attempt: attempt('shared'),
      payload,
    }));
    const openf1 = new FakePort('openf1', () => ({
      outcome: 'candidate',
      attempt: attempt('shared'),
      payload,
    }));

    const run = await coordinate(
      [jolpica, openf1],
      [RACE],
      testOnlyProvisionalBound,
    );
    const provisional = run.resources[0]?.contributions.find(
      (entry) => entry.source === 'openf1',
    );

    expect(provisional?.status).toBe('candidate');
    expect(provisional?.reason).toBeNull();
    expect(provisional?.attempted).toBe(true);
    expect(run.accounting.bySource).toEqual({
      jolpica: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
      openf1: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
    });
    expect(run.accounting.lifetime.total).toBe(2);
    // The reconciled source still wins the resource itself.
    expect(run.resources[0]?.selection).toMatchObject({
      outcome: 'selected',
      source: 'jolpica',
      role: 'reconciled',
    });
  });

  it('never lets one source’s token collapse another source’s request', async () => {
    const source = await seasonFixture();
    const A = RACE;
    const B = STANDINGS;
    // The reconciled source happens to mint, for resource B, the very token
    // the provisional source already used for resource A. Before this was
    // scoped by source, that coincidence discarded the reconciled candidate
    // and let the provisional one be selected in its place.
    let issued = 0;
    const jolpica = new FakePort('jolpica', (request) => {
      issued += 1;
      const payload = payloadFor(source, request.resource);
      if (payload === null) throw new Error('fixture gap');
      return {
        outcome: 'candidate',
        attempt: attempt(issued === 1 ? 'j-1' : 'collision'),
        payload,
      };
    });
    let provisionalIssued = 0;
    const openf1 = new FakePort('openf1', (request) => {
      provisionalIssued += 1;
      const payload = payloadFor(source, request.resource);
      if (payload === null) throw new Error('fixture gap');
      return {
        outcome: 'candidate',
        attempt: attempt(provisionalIssued === 1 ? 'collision' : 'o-2'),
        payload,
      };
    });

    const run = await coordinate(
      [jolpica, openf1],
      [A, B],
      testOnlyProvisionalBound,
    );

    for (const resource of run.resources) {
      expect(resource.selection).toMatchObject({
        outcome: 'selected',
        source: 'jolpica',
        role: 'reconciled',
      });
      for (const contribution of resource.contributions) {
        expect(contribution.reason).not.toBe('coordination-invariant');
      }
    }
    // Four physical requests: two per source, none collapsed into another's.
    expect(jolpica.requests).toHaveLength(2);
    expect(openf1.requests).toHaveLength(2);
    expect(run.accounting.lifetime.total).toBe(4);
    expect(run.counts.attempted).toBe(4);
  });

  it('still fails a same-source reference claiming two outcomes closed', async () => {
    const source = await seasonFixture();
    const payload = payloadFor(source, RACE);
    if (payload === null) throw new Error('fixture gap');
    let call = 0;
    // One source, one token, two contradictory claims about how the single
    // request it names ended. Both cannot be true, so the later fails closed.
    const jolpica = new FakePort('jolpica', () => {
      call += 1;
      return call === 1
        ? { outcome: 'candidate', attempt: attempt('one'), payload }
        : {
            outcome: 'failed',
            attempt: attempt('one', 'failed'),
            reason: 'provider-unavailable',
          };
    });

    const run = await coordinate([jolpica], [RACE, STANDINGS]);
    const second = run.resources[1]?.contributions.find(
      (entry) => entry.source === 'jolpica',
    );

    expect(second?.reason).toBe('coordination-invariant');
    expect(second?.attempted).toBe(false);
    expect(run.accounting.bySource).toEqual({
      jolpica: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
    });
  });
});
