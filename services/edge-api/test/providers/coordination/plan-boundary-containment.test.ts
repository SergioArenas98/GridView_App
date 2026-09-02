/**
 * A plan is an untrusted runtime boundary, not a typed value.
 *
 * `CoordinationPlan` proves nothing at runtime: a caller can hand over a
 * proxy, an object whose `season` getter throws, a `resources` that is not
 * iterable, or an entry carrying a symbol-keyed or non-enumerable property.
 * The coordinator's contract is that **nothing here can throw** and that a
 * rejected plan attempts nothing - so every one of those has to become a
 * bounded `plan-rejected` result with no port call, no accounting and no
 * hostile detail in the logs.
 *
 * Validation that reaches through `Object.keys`, a bare `for...of` and direct
 * property reads cannot make that promise: each of those is a call into
 * caller-controlled code.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  MultiSourceCoordinator,
  isCoordinatedResource,
  type CoordinationPlan,
  type CoordinatedResource,
} from '../../../src/providers/coordination';
import { SEASON, completePort, seasonFixture, type FakePort } from './support';

interface Subject {
  subject: MultiSourceCoordinator;
  logger: CapturingLogger;
  port: FakePort;
}

async function subjectFor(): Promise<Subject> {
  const source = await seasonFixture();
  const port = completePort('jolpica', source);
  const logger = new CapturingLogger();
  return {
    port,
    logger,
    subject: new MultiSourceCoordinator({ ports: [port], logger }),
  };
}

/** An object whose `ownKeys` trap throws when anything enumerates it. */
function hostileOwnKeys(target: object): object {
  return new Proxy(target, {
    ownKeys() {
      throw new Error('ownKeys exploded');
    },
  });
}

/** An object whose named property getter throws when it is read. */
function throwingGetter(base: object, property: string): object {
  return Object.defineProperty({ ...base }, property, {
    enumerable: true,
    configurable: true,
    get() {
      throw new Error(`${property} getter exploded`);
    },
  });
}

const validResource: CoordinatedResource = {
  kind: 'season-calendar',
  season: SEASON,
};

/** Every plan the boundary must reject without touching a port. */
function hostilePlans(): { label: string; plan: unknown }[] {
  const symbolKeyed: Record<string | symbol, unknown> = {
    kind: 'season-calendar',
    season: SEASON,
  };
  symbolKeyed[Symbol('smuggled')] = 'value';

  const nonEnumerable = Object.defineProperty(
    { kind: 'season-calendar', season: SEASON },
    'round',
    { value: 7, enumerable: false },
  );

  const prototypeBorne = Object.create({ round: 7 }) as Record<string, unknown>;
  prototypeBorne.kind = 'event-schedule';
  prototypeBorne.season = SEASON;

  return [
    { label: 'null plan', plan: null },
    { label: 'array plan', plan: [] },
    { label: 'string plan', plan: 'plan' },
    { label: 'missing season', plan: { resources: [validResource] } },
    { label: 'missing resources', plan: { season: SEASON } },
    {
      label: 'extra root field',
      plan: { season: SEASON, resources: [validResource], mode: 'live' },
    },
    { label: 'NaN season', plan: { season: Number.NaN, resources: [] } },
    { label: 'fractional season', plan: { season: 2026.5, resources: [] } },
    { label: 'infinite season', plan: { season: Infinity, resources: [] } },
    { label: 'string season', plan: { season: '2026', resources: [] } },
    {
      label: 'boxed season',
      plan: { season: Object(SEASON) as number, resources: [] },
    },
    { label: 'out-of-domain season', plan: { season: 1000, resources: [] } },
    {
      label: 'non-iterable resources',
      plan: { season: SEASON, resources: { length: 1 } },
    },
    {
      label: 'string resources',
      plan: { season: SEASON, resources: 'season-calendar' },
    },
    {
      label: 'throwing season getter',
      plan: throwingGetter({ resources: [] }, 'season'),
    },
    {
      label: 'throwing resources getter',
      plan: throwingGetter({ season: SEASON }, 'resources'),
    },
    {
      label: 'throwing ownKeys plan',
      plan: hostileOwnKeys({ season: SEASON, resources: [] }),
    },
    {
      label: 'throwing ownKeys resource',
      plan: {
        season: SEASON,
        resources: [
          hostileOwnKeys({ kind: 'season-calendar', season: SEASON }),
        ],
      },
    },
    {
      label: 'throwing resource getter',
      plan: {
        season: SEASON,
        resources: [throwingGetter({ kind: 'season-calendar' }, 'season')],
      },
    },
    {
      label: 'symbol-keyed resource property',
      plan: { season: SEASON, resources: [symbolKeyed] },
    },
    {
      label: 'non-enumerable resource property',
      plan: { season: SEASON, resources: [nonEnumerable] },
    },
    {
      label: 'prototype-borne resource property',
      plan: { season: SEASON, resources: [prototypeBorne] },
    },
    {
      label: 'throwing resources iterator',
      plan: {
        season: SEASON,
        resources: {
          [Symbol.iterator]() {
            throw new Error('iterator exploded');
          },
        },
      },
    },
  ];
}

describe('every malformed plan becomes a bounded rejection', () => {
  for (const { label, plan } of hostilePlans()) {
    it(`rejects ${label} without calling a port`, async () => {
      const { subject, port, logger } = await subjectFor();

      const run = await subject.coordinate({
        plan: plan as CoordinationPlan,
      });

      expect(run.status).toBe('plan-rejected');
      expect(run.planProblem).not.toBeNull();
      expect(run.resources).toEqual([]);
      expect(run.accounting.lifetime.total).toBe(0);
      expect(port.requests).toHaveLength(0);
      expect(logger.serialized()).not.toContain('exploded');
      expect(logger.serialized()).not.toContain('smuggled');
    });
  }

  it('keeps a valid plan working unchanged', async () => {
    const { subject, port } = await subjectFor();

    const run = await subject.coordinate({
      plan: { season: SEASON, resources: [validResource] },
    });

    expect(run.status).toBe('completed');
    expect(run.planProblem).toBeNull();
    expect(port.requests).toHaveLength(1);
  });
});

describe('resource shape closure matches the outcome boundary', () => {
  it('rejects a symbol-keyed own property on a resource identity', () => {
    const record: Record<string | symbol, unknown> = {
      kind: 'season-calendar',
      season: SEASON,
    };
    record[Symbol('smuggled')] = 'value';

    expect(isCoordinatedResource(record)).toBe(false);
  });

  it('rejects a non-enumerable own property on a resource identity', () => {
    const record = Object.defineProperty(
      { kind: 'season-calendar', season: SEASON },
      'round',
      { value: 7, enumerable: false },
    );

    expect(isCoordinatedResource(record)).toBe(false);
  });

  it('rejects a required field reachable only through the prototype', () => {
    const record = Object.create({ season: SEASON }) as Record<string, unknown>;
    record.kind = 'season-calendar';

    expect(isCoordinatedResource(record)).toBe(false);
  });

  it('does not invoke a getter merely to decide shape', () => {
    let reads = 0;
    const record = Object.defineProperty(
      { kind: 'season-calendar' },
      'season',
      {
        enumerable: true,
        get() {
          reads += 1;
          return SEASON;
        },
      },
    );
    // Extra properties make the shape wrong; the decision must not have
    // required reading the accessor to reach it.
    Object.defineProperty(record, 'round', { value: 1, enumerable: true });

    expect(isCoordinatedResource(record)).toBe(false);
    expect(reads).toBe(0);
  });

  it('accepts a plain valid identity unchanged', () => {
    expect(isCoordinatedResource(validResource)).toBe(true);
  });
});
