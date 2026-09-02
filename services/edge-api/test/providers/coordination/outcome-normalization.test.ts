/**
 * The coordinator owns a **normalized snapshot** of every adapter outcome.
 *
 * Closing an outcome's shape decides what it *was* when it was inspected. It
 * does not decide what it *is* when the value is used, and the two are not the
 * same moment: attribution deliberately runs after the whole plan has executed,
 * and several declared fields were read once to validate them and then read
 * again to consume them. Between those two reads an adapter can refill a reused
 * object, mutate what it returned, or answer differently from an accessor.
 *
 * The invariant this file pins:
 *
 * > Every value the coordinator uses after an outcome crosses the port boundary
 * > - the variant, the attempt reference, the attempt outcome, the failure
 * > reason, the retry hints and the payload - is a coordinator-owned copy taken
 * > once, and is the same value that was validated.
 *
 * It is the outcome-wide completion of the payload rule already pinned by
 * `candidate-payload-snapshot.test.ts`, and it is deliberately distinct from
 * deep normalized-contract validation, which stays an adapter responsibility
 * and an activation gate (ADR 0023 D14).
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  MultiSourceCoordinator,
  type CoordinatedResource,
  type CoordinationRun,
  type ProviderResourceOutcome,
  type SourceContribution,
} from '../../../src/providers/coordination';
import {
  FakePort,
  SEASON,
  attempt,
  seasonFixture,
  seasonResources,
  testOnlyProvisionalBound,
} from './support';

const DRIVER_STANDINGS = seasonResources[3] as CoordinatedResource;
const CONSTRUCTOR_STANDINGS = seasonResources[4] as CoordinatedResource;

const INSTANT = '2026-09-01T00:00:00.000Z';
/** A provider-controlled string that must never reach a log or a contribution. */
const HOSTILE = 'https://provider.invalid/secret?token=LEAKED';

function standings(kind: string): Record<string, unknown> {
  return { kind, standings: [{ season: SEASON, position: 1, points: 25 }] };
}

function coordinate(
  ports: readonly FakePort[],
  resources: readonly CoordinatedResource[],
  logger = new CapturingLogger(),
  maxConcurrentOperations?: number,
): Promise<CoordinationRun> {
  return new MultiSourceCoordinator({
    ports,
    logger,
    ...(maxConcurrentOperations === undefined
      ? {}
      : { maxConcurrentOperations }),
  }).coordinate({ plan: { season: SEASON, resources } });
}

/** A jolpica port answering every request with one factory-built outcome. */
function port(
  make: (request: { readonly resource: CoordinatedResource }) => unknown,
): FakePort {
  return new FakePort(
    'jolpica',
    (request) => make(request) as ProviderResourceOutcome,
  );
}

function jolpica(
  run: CoordinationRun,
  index = 0,
): SourceContribution | undefined {
  return run.resources[index]?.contributions.find(
    (entry) => entry.source === 'jolpica',
  );
}

/**
 * Every trusted attempt is counted in exactly one bucket.
 *
 * An attempt outcome that survived validation is one of three known values, so
 * a total that exceeds its buckets means an unvalidated value reached the
 * ledger.
 */
function expectBalancedAccounting(run: CoordinationRun): void {
  const buckets = [
    run.accounting.lifetime,
    ...Object.values(run.accounting.bySource),
    ...Object.values(run.accounting.byJobCategory),
  ];
  for (const bucket of buckets) {
    expect(bucket.total).toBe(
      bucket.successful + bucket.failed + bucket.rateLimited,
    );
  }
}

function loggedText(logger: CapturingLogger): string {
  return JSON.stringify(logger.events) + logger.serialized();
}

describe('a stateful accessor cannot answer one value to validation and another to accounting', () => {
  it('rejects an attempt getter answering successful and then failed', async () => {
    let reads = 0;
    const run = await coordinate(
      [
        port(() => ({
          outcome: 'candidate',
          get attempt() {
            reads += 1;
            return reads <= 1
              ? { reference: 'j-1', outcome: 'successful' }
              : { reference: 'j-1', outcome: 'failed' };
          },
          payload: standings('driver-standings'),
        })),
      ],
      [DRIVER_STANDINGS],
    );

    expect(jolpica(run)?.status).toBe('failed');
    expect(jolpica(run)?.reason).toBe('malformed-outcome');
    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
    expectBalancedAccounting(run);
  });

  it('rejects an attempt getter that changes reference and outcome', async () => {
    let reads = 0;
    const run = await coordinate(
      [
        port(() => ({
          outcome: 'candidate',
          get attempt() {
            reads += 1;
            return reads <= 1
              ? { reference: 'j-1', outcome: 'successful' }
              : { reference: 'j-9', outcome: 'rate-limited' };
          },
          payload: standings('driver-standings'),
        })),
      ],
      [DRIVER_STANDINGS],
    );

    expect(jolpica(run)?.status).toBe('failed');
    expect(jolpica(run)?.reason).toBe('malformed-outcome');
    expect(run.accounting.lifetime.rateLimited).toBe(0);
    expectBalancedAccounting(run);
  });

  it('rejects a second read carrying an overlong reference and unknown outcome', async () => {
    let reads = 0;
    const run = await coordinate(
      [
        port(() => ({
          outcome: 'candidate',
          get attempt() {
            reads += 1;
            return reads <= 1
              ? { reference: 'j-1', outcome: 'successful' }
              : { reference: 'E'.repeat(300), outcome: 'not-an-outcome' };
          },
          payload: standings('driver-standings'),
        })),
      ],
      [DRIVER_STANDINGS],
    );

    expect(jolpica(run)?.status).toBe('failed');
    expect(jolpica(run)?.reason).toBe('malformed-outcome');
    expectBalancedAccounting(run);
  });

  it('rejects an accessor-backed payload', async () => {
    const run = await coordinate(
      [
        port(() => ({
          outcome: 'candidate',
          attempt: attempt('j-1'),
          get payload() {
            return standings('driver-standings');
          },
        })),
      ],
      [DRIVER_STANDINGS],
    );

    expect(jolpica(run)?.reason).toBe('malformed-outcome');
    expect(jolpica(run)?.attempted).toBe(false);
    expect(run.accounting.lifetime.total).toBe(0);
  });

  it('rejects an accessor-backed reason and discriminant', async () => {
    const reasonRun = await coordinate(
      [
        port(() => ({
          outcome: 'not-attempted',
          get reason() {
            return 'rate-limit-deferred';
          },
        })),
      ],
      [DRIVER_STANDINGS],
    );
    expect(jolpica(reasonRun)?.reason).toBe('malformed-outcome');

    const variantRun = await coordinate(
      [
        port(() => ({
          get outcome() {
            return 'not-attempted';
          },
          reason: 'limiter-unavailable',
        })),
      ],
      [DRIVER_STANDINGS],
    );
    expect(jolpica(variantRun)?.reason).toBe('malformed-outcome');
  });

  it('rejects a declared field reachable only through the prototype', async () => {
    const run = await coordinate(
      [
        port(() => {
          const answer = Object.create({
            payload: standings('driver-standings'),
          }) as Record<string, unknown>;
          answer.outcome = 'candidate';
          answer.attempt = attempt('j-1');
          return answer;
        }),
      ],
      [DRIVER_STANDINGS],
    );

    expect(jolpica(run)?.reason).toBe('malformed-outcome');
    expect(run.accounting.lifetime.total).toBe(0);
  });
});

describe('a reused adapter object cannot rewrite an answer already given', () => {
  it('counts two real requests behind one reused attempt object', async () => {
    const shared: Record<string, unknown> = {
      reference: '',
      outcome: 'successful',
    };
    let sequence = 0;
    const run = await coordinate(
      [
        port((request) => {
          sequence += 1;
          shared.reference = `j-${sequence}`;
          return {
            outcome: 'candidate',
            attempt: shared,
            payload: standings(request.resource.kind),
          };
        }),
      ],
      [DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS],
    );

    expect(sequence).toBe(2);
    expect(run.counts.selected).toBe(2);
    // Two physical requests left GridView. Neither may be concealed by the
    // other having overwritten the object that described it.
    expect(run.accounting.lifetime.total).toBe(2);
    expect(run.accounting.lifetime.successful).toBe(2);
    expectBalancedAccounting(run);
  });

  it('counts two real requests behind one reused outcome object', async () => {
    const shared: Record<string, unknown> = {
      outcome: 'candidate',
      attempt: attempt('j-0'),
      payload: standings('driver-standings'),
    };
    let sequence = 0;
    const run = await coordinate(
      [
        port((request) => {
          sequence += 1;
          shared.attempt = attempt(`j-${sequence}`);
          shared.payload = standings(request.resource.kind);
          return shared;
        }),
      ],
      [DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS],
    );

    expect(sequence).toBe(2);
    expect(run.accounting.lifetime.total).toBe(2);
    expectBalancedAccounting(run);
  });

  it('keeps a candidate mutated into a failure after it was answered', async () => {
    const held: Record<string, unknown>[] = [];
    let sequence = 0;
    const run = await coordinate(
      [
        port((request) => {
          sequence += 1;
          const answer: Record<string, unknown> = {
            outcome: 'candidate',
            attempt: attempt(`j-${sequence}`),
            payload: standings(request.resource.kind),
          };
          held.push(answer);
          if (sequence === 2) {
            const first = held[0] as Record<string, unknown>;
            delete first.payload;
            first.outcome = 'failed';
            first.reason = 'provider-unavailable';
            first.attempt = attempt('j-1', 'failed');
          }
          return answer;
        }),
      ],
      [DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS],
    );

    expect(run.counts.selected).toBe(2);
    expect(jolpica(run, 0)?.status).toBe('candidate');
    expect(run.accounting.lifetime.successful).toBe(2);
    expect(run.accounting.lifetime.failed).toBe(0);
    expectBalancedAccounting(run);
  });

  it('keeps a failure mutated into a candidate after it was answered', async () => {
    const held: Record<string, unknown>[] = [];
    let sequence = 0;
    const run = await coordinate(
      [
        port((request) => {
          sequence += 1;
          const answer: Record<string, unknown> = {
            outcome: 'failed',
            attempt: attempt(`j-${sequence}`, 'failed'),
            reason: 'provider-unavailable',
          };
          held.push(answer);
          if (sequence === 2) {
            const first = held[0] as Record<string, unknown>;
            delete first.reason;
            first.outcome = 'candidate';
            first.attempt = attempt('j-1', 'successful');
            first.payload = standings(request.resource.kind);
          }
          return answer;
        }),
      ],
      [DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS],
    );

    expect(run.counts.selected).toBe(0);
    expect(jolpica(run, 0)?.status).toBe('failed');
    expect(jolpica(run, 0)?.reason).toBe('provider-unavailable');
    expect(run.accounting.lifetime.failed).toBe(2);
    expect(run.accounting.lifetime.successful).toBe(0);
    expectBalancedAccounting(run);
  });

  it('keeps a retained answer stable after coordinate() returns', async () => {
    const answer: Record<string, unknown> = {
      outcome: 'not-attempted',
      reason: 'rate-limit-deferred',
      retryAt: INSTANT,
    };
    const run = await coordinate([port(() => answer)], [DRIVER_STANDINGS]);
    answer.reason = 'limiter-unavailable';
    answer.retryAt = HOSTILE;

    expect(jolpica(run)?.reason).toBe('rate-limit-deferred');
    expect(jolpica(run)?.retryAt).toBe(INSTANT);
  });

  it('closes the reused-object window at the sequential default', async () => {
    // `defaultMaxConcurrentOperations` is 1, so a request only begins after the
    // previous answer has been normalized. Reuse is fully closed here.
    const shared: Record<string, unknown> = {
      reference: '',
      outcome: 'successful',
    };
    let sequence = 0;
    const run = await coordinate(
      [
        port((request) => {
          sequence += 1;
          shared.reference = `j-${sequence}`;
          return {
            outcome: 'candidate',
            attempt: shared,
            payload: standings(request.resource.kind),
          };
        }),
      ],
      [DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS],
      new CapturingLogger(),
      1,
    );

    expect(sequence).toBe(2);
    expect(run.accounting.lifetime.total).toBe(2);
    expectBalancedAccounting(run);
  });

  it('stays bounded and self-consistent at every permitted pool size', async () => {
    // Above a pool of one, an adapter that mutates a single object shared
    // between *simultaneously in-flight* requests has aliased its own two
    // answers before either could be observed - the distinguishing value no
    // longer exists anywhere. That is the adapter contract `fetchResource`
    // states, not a coordinator gap. What the coordinator still guarantees at
    // any pool size is that nothing it reports is internally contradictory and
    // that two contributions never share one payload object.
    for (const maxConcurrentOperations of [1, 2, 4]) {
      const shared: Record<string, unknown> = {
        reference: '',
        outcome: 'successful',
      };
      let sequence = 0;
      const run = await coordinate(
        [
          port((request) => {
            sequence += 1;
            shared.reference = `j-${sequence}`;
            return {
              outcome: 'candidate',
              attempt: shared,
              payload: standings(request.resource.kind),
            };
          }),
        ],
        [DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS],
        new CapturingLogger(),
        maxConcurrentOperations,
      );

      const label = `pool ${maxConcurrentOperations}`;
      expect(run.status, label).toBe('completed');
      expect(run.counts.selected, label).toBe(2);
      expect(run.accounting.lifetime.total, label).toBeLessThanOrEqual(
        sequence,
      );
      expect(run.accounting.lifetime.total, label).toBeGreaterThan(0);
      expectBalancedAccounting(run);

      const first = jolpica(run, 0)?.payload;
      const second = jolpica(run, 1)?.payload;
      expect(first, label).not.toBeNull();
      expect(second, label).not.toBeNull();
      expect(first, label).not.toBe(second);
    }
  });
});

describe('retry metadata is a validated, coordinator-owned instant', () => {
  it('never lets a retryAt getter inject a provider string into a log', async () => {
    const logger = new CapturingLogger();
    let reads = 0;
    const run = await coordinate(
      [
        port(() => ({
          outcome: 'not-attempted',
          reason: 'rate-limit-deferred',
          get retryAt() {
            reads += 1;
            return reads <= 2 ? INSTANT : HOSTILE;
          },
        })),
      ],
      [DRIVER_STANDINGS],
      logger,
    );

    expect(jolpica(run)?.retryAt).not.toBe(HOSTILE);
    expect(loggedText(logger)).not.toContain(HOSTILE);
  });

  it('never lets a retryAfter getter inject a provider string into a log', async () => {
    const logger = new CapturingLogger();
    let reads = 0;
    const run = await coordinate(
      [
        port(() => ({
          outcome: 'failed',
          attempt: attempt('j-1', 'rate-limited'),
          reason: 'provider-rate-limited',
          get retryAfter() {
            reads += 1;
            return reads <= 2 ? INSTANT : `${'X'.repeat(120)}-LEAKED`;
          },
        })),
      ],
      [DRIVER_STANDINGS],
      logger,
    );

    // The accessor is refused outright, so there is no hint at all rather than
    // an unvalidated one.
    expect(jolpica(run)?.retryAfter).toBeNull();
    expect(jolpica(run)?.reason).toBe('malformed-outcome');
    expect(loggedText(logger)).not.toContain('LEAKED');
  });

  it('carries an honest retry hint through unchanged', async () => {
    const deferred = await coordinate(
      [
        port(() => ({
          outcome: 'not-attempted',
          reason: 'rate-limit-deferred',
          retryAt: INSTANT,
        })),
      ],
      [DRIVER_STANDINGS],
    );
    expect(jolpica(deferred)?.status).toBe('deferred');
    expect(jolpica(deferred)?.retryAt).toBe(INSTANT);

    const limited = await coordinate(
      [
        port(() => ({
          outcome: 'failed',
          attempt: attempt('j-1', 'rate-limited'),
          reason: 'provider-rate-limited',
          retryAfter: INSTANT,
        })),
      ],
      [DRIVER_STANDINGS],
    );
    expect(jolpica(limited)?.retryAfter).toBe(INSTANT);
    expect(limited.accounting.lifetime.rateLimited).toBe(1);
    expectBalancedAccounting(limited);
  });
});

describe('ordinary outcomes are unchanged by normalization', () => {
  it('accepts every declared variant on its ordinary path', async () => {
    const candidate = await coordinate(
      [
        port(() => ({
          outcome: 'candidate',
          attempt: attempt('j-1'),
          payload: standings('driver-standings'),
        })),
      ],
      [DRIVER_STANDINGS],
    );
    expect(jolpica(candidate)?.status).toBe('candidate');
    expect(candidate.accounting.lifetime.successful).toBe(1);

    const notAttempted = await coordinate(
      [
        port(() => ({
          outcome: 'not-attempted',
          reason: 'limiter-unavailable',
        })),
      ],
      [DRIVER_STANDINGS],
    );
    expect(jolpica(notAttempted)?.status).toBe('skipped');
    expect(jolpica(notAttempted)?.attempted).toBe(false);
    expect(notAttempted.accounting.lifetime.total).toBe(0);

    const failed = await coordinate(
      [
        port(() => ({
          outcome: 'failed',
          attempt: attempt('j-1', 'failed'),
          reason: 'provider-unavailable',
        })),
      ],
      [DRIVER_STANDINGS],
    );
    expect(jolpica(failed)?.reason).toBe('provider-unavailable');
    expect(failed.accounting.lifetime.failed).toBe(1);

    const mapping = await coordinate(
      [port(() => ({ outcome: 'mapping-failure', attempt: attempt('j-1') }))],
      [DRIVER_STANDINGS],
    );
    expect(jolpica(mapping)?.reason).toBe('mapping-unresolved');
    expect(mapping.accounting.lifetime.successful).toBe(1);

    for (const run of [candidate, notAttempted, failed, mapping]) {
      expectBalancedAccounting(run);
    }
  });

  it('still deduplicates one reference serving two resources', async () => {
    const run = await coordinate(
      [
        port((request) => ({
          outcome: 'candidate',
          attempt: attempt('shared-1'),
          payload: standings(request.resource.kind),
        })),
      ],
      [DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS],
    );

    expect(run.counts.selected).toBe(2);
    expect(run.accounting.lifetime.total).toBe(1);
    expectBalancedAccounting(run);
  });

  it('still taints a run whose one reference claims two endings', async () => {
    let sequence = 0;
    const run = await coordinate(
      [
        port((request) => {
          sequence += 1;
          return sequence === 1
            ? {
                outcome: 'candidate',
                attempt: attempt('shared-1', 'successful'),
                payload: standings(request.resource.kind),
              }
            : {
                outcome: 'failed',
                attempt: attempt('shared-1', 'failed'),
                reason: 'provider-unavailable',
              };
        }),
      ],
      [DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS],
    );

    expect(run.status).toBe('invariant-violated');
    expectBalancedAccounting(run);
  });

  it('still contains a payload that cannot be detached, keeping its request counted', async () => {
    const logger = new CapturingLogger();
    const run = await coordinate(
      [
        port(() => ({
          outcome: 'candidate',
          attempt: attempt('j-1'),
          payload: {
            ...standings('driver-standings'),
            notify: () => undefined,
          },
        })),
      ],
      [DRIVER_STANDINGS],
      logger,
    );

    expect(jolpica(run)?.status).toBe('failed');
    expect(jolpica(run)?.reason).toBe('malformed-outcome');
    // The request really left GridView, so it stays counted exactly once.
    expect(jolpica(run)?.attempted).toBe(true);
    expect(run.accounting.lifetime.total).toBe(1);
    expect(run.accounting.lifetime.successful).toBe(1);
    expect(run.status).toBe('completed');
    expectBalancedAccounting(run);
    expect(loggedText(logger)).not.toContain('notify');
  });

  it('lets a healthy fallback carry the resource when the reconciled answer is untrustworthy', async () => {
    const source = await seasonFixture();
    let reads = 0;
    const reconciled = port(() => ({
      outcome: 'candidate',
      get attempt() {
        reads += 1;
        return reads <= 1
          ? { reference: 'j-1', outcome: 'successful' }
          : { reference: 'j-1', outcome: 'failed' };
      },
      payload: standings('driver-standings'),
    }));
    const provisional = new FakePort(
      'openf1',
      () =>
        ({
          outcome: 'candidate',
          attempt: attempt('o-1'),
          payload: {
            kind: 'driver-standings',
            standings: source.driverStandings,
          },
        }) as ProviderResourceOutcome,
    );

    const run = await new MultiSourceCoordinator({
      ports: [reconciled, provisional],
      logger: new CapturingLogger(),
      provisionalSessionEndBound: testOnlyProvisionalBound,
    }).coordinate({ plan: { season: SEASON, resources: [DRIVER_STANDINGS] } });

    const selection = run.resources[0]?.selection;
    expect(selection?.outcome).toBe('selected');
    if (selection?.outcome !== 'selected') return;
    expect(selection.source).toBe('openf1');
    expectBalancedAccounting(run);
  });
});

describe('hidden and hostile properties stay contained', () => {
  it('rejects symbol-keyed and non-enumerable extras on an outcome', async () => {
    const symbolRun = await coordinate(
      [
        port(() => {
          const answer: Record<string | symbol, unknown> = {
            outcome: 'candidate',
            attempt: attempt('j-1'),
            payload: standings('driver-standings'),
          };
          answer[Symbol('smuggled')] = HOSTILE;
          return answer;
        }),
      ],
      [DRIVER_STANDINGS],
    );
    expect(jolpica(symbolRun)?.reason).toBe('malformed-outcome');
    expect(symbolRun.accounting.lifetime.total).toBe(0);

    const hiddenRun = await coordinate(
      [
        port(() =>
          Object.defineProperty(
            {
              outcome: 'candidate',
              attempt: attempt('j-1'),
              payload: standings('driver-standings'),
            },
            'url',
            { value: HOSTILE, enumerable: false },
          ),
        ),
      ],
      [DRIVER_STANDINGS],
    );
    expect(jolpica(hiddenRun)?.reason).toBe('malformed-outcome');
    expect(hiddenRun.accounting.lifetime.total).toBe(0);
  });

  it('contains a proxy whose ownKeys trap throws', async () => {
    const logger = new CapturingLogger();
    const run = await coordinate(
      [
        port(
          () =>
            new Proxy(
              { outcome: 'not-attempted', reason: 'cancelled' },
              {
                ownKeys() {
                  throw new Error(HOSTILE);
                },
              },
            ),
        ),
      ],
      [DRIVER_STANDINGS],
      logger,
    );

    expect(jolpica(run)?.reason).toBe('malformed-outcome');
    expect(run.status).toBe('completed');
    expect(loggedText(logger)).not.toContain('provider.invalid');
  });

  it('contains a proxy whose getOwnPropertyDescriptor trap throws', async () => {
    const logger = new CapturingLogger();
    const run = await coordinate(
      [
        port(
          () =>
            new Proxy(
              {
                outcome: 'candidate',
                attempt: attempt('j-1'),
                payload: standings('driver-standings'),
              },
              {
                getOwnPropertyDescriptor() {
                  throw new Error(HOSTILE);
                },
              },
            ),
        ),
      ],
      [DRIVER_STANDINGS],
      logger,
    );

    expect(jolpica(run)?.reason).toBe('malformed-outcome');
    expect(run.status).toBe('completed');
    expect(loggedText(logger)).not.toContain('provider.invalid');
  });

  it('never writes an adapter reference, payload or thrown value to a log', async () => {
    const logger = new CapturingLogger();
    await coordinate(
      [
        port(() => ({
          outcome: 'candidate',
          attempt: attempt('reference-must-not-be-logged'),
          payload: {
            kind: 'driver-standings',
            standings: [{ season: SEASON, note: HOSTILE }],
          },
        })),
      ],
      [DRIVER_STANDINGS],
      logger,
    );

    const text = loggedText(logger);
    expect(text).not.toContain('reference-must-not-be-logged');
    expect(text).not.toContain(HOSTILE);
  });
});

describe('cancellation and unexecuted operations are unaffected', () => {
  it('reports a cancelled operation without inventing an attempt', async () => {
    const controller = new AbortController();
    controller.abort();
    const called: string[] = [];
    const run = await new MultiSourceCoordinator({
      ports: [
        new FakePort(
          'jolpica',
          (request) =>
            ({
              outcome: 'candidate',
              attempt: attempt('j-1'),
              payload: standings(
                (called.push(request.resource.kind),
                request.resource.kind) as string,
              ),
            }) as ProviderResourceOutcome,
        ),
      ],
      logger: new CapturingLogger(),
    }).coordinate({
      plan: { season: SEASON, resources: [DRIVER_STANDINGS] },
      signal: controller.signal,
    });

    expect(called).toEqual([]);
    expect(run.status).toBe('cancelled');
    expect(jolpica(run)?.reason).toBe('cancelled');
    expect(run.accounting.lifetime.total).toBe(0);
    expectBalancedAccounting(run);
  });
});
