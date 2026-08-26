/**
 * Failure containment: isolation between resources, the real mapping boundary,
 * malformed adapter answers and thrown adapter errors.
 *
 * Required cases 15-19.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  MultiSourceCoordinator,
  coordinationFor,
  isWellFormedOutcome,
  type CoordinatedResource,
  type CoordinationRun,
  type ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import {
  key,
  realRegistry,
  registryOf,
  SEASON as MAPPING_SEASON,
} from '../mappings/support';
import {
  FakePort,
  SEASON,
  attempt,
  payloadFor,
  raceResource,
  seasonFixture,
  seasonResources,
} from './support';

const CALENDAR = seasonResources[0] as CoordinatedResource;
const PARTICIPANTS = seasonResources[1] as CoordinatedResource;

function coordinate(
  ports: FakePort[],
  resources: readonly CoordinatedResource[],
): Promise<CoordinationRun> {
  return new MultiSourceCoordinator({
    ports,
    logger: new CapturingLogger(),
  }).coordinate({ plan: { season: SEASON, resources } });
}

function candidateFor(
  source: ProviderSeasonSource,
  resource: CoordinatedResource,
  reference: string,
): ProviderResourceOutcome {
  const payload = payloadFor(source, resource);
  if (payload === null) throw new Error('fixture gap');
  return { outcome: 'candidate', attempt: attempt(reference), payload };
}

describe('a failing resource never blocks an independent one', () => {
  // Case 15
  it('keeps healthy resources visible and attributes the failure exactly', async () => {
    const source = await seasonFixture();
    let sequence = 0;
    const port = new FakePort('jolpica', (request) => {
      sequence += 1;
      if (request.resource.kind === 'session-classification') {
        return {
          outcome: 'failed',
          attempt: attempt(`j-${sequence}`, 'failed'),
          reason: 'provider-unavailable',
        };
      }
      return candidateFor(source, request.resource, `j-${sequence}`);
    });

    const run = await coordinate(
      [port],
      [CALENDAR, raceResource(12), PARTICIPANTS],
    );

    expect(coordinationFor(run, CALENDAR)?.selection.outcome).toBe('selected');
    expect(coordinationFor(run, PARTICIPANTS)?.selection.outcome).toBe(
      'selected',
    );
    const failed = coordinationFor(run, raceResource(12));
    expect(failed?.selection.outcome).toBe('unavailable');
    const contribution = failed?.contributions.find(
      (entry) => entry.source === 'jolpica',
    );
    expect(contribution?.reason).toBe('provider-unavailable');
    expect(contribution?.attempted).toBe(true);
    expect(run.counts).toMatchObject({
      planned: 3,
      selected: 2,
      unavailable: 1,
    });
  });
});

describe('the real mapping boundary contains its own failure', () => {
  const registry = realRegistry();

  /**
   * A port that resolves a provider identity through the **real** Phase 9B-3
   * registry before contributing anything, exactly as a future adapter must.
   * The mapping signal is the adapter's own responsibility; the coordinator
   * only sees a bounded `mapping-failure`.
   */
  function mappingPort(
    source: ProviderSeasonSource,
    providerDriverIdFor: (resource: CoordinatedResource) => string,
    resolver = registry,
  ): FakePort {
    let sequence = 0;
    return new FakePort('jolpica', (request) => {
      sequence += 1;
      const resolution = resolver.resolve(
        key<'driver'>({
          season: MAPPING_SEASON,
          source: 'jolpica',
          entity: 'driver',
          providerField: 'driverId',
          providerValue: providerDriverIdFor(request.resource),
        }),
      );
      if (resolution.outcome !== 'resolved') {
        return {
          outcome: 'mapping-failure',
          attempt: attempt(`j-${sequence}`),
        };
      }
      return candidateFor(source, request.resource, `j-${sequence}`);
    });
  }

  // Case 16
  it('fails only the affected resource when one identity is unmapped', async () => {
    const source = await seasonFixture();
    const port = mappingPort(source, (resource) =>
      resource.kind === 'session-classification' ? 'nobody' : 'norris',
    );

    const run = await coordinate([port], [CALENDAR, raceResource(12)]);
    const affected = coordinationFor(run, raceResource(12));

    expect(coordinationFor(run, CALENDAR)?.selection.outcome).toBe('selected');
    expect(affected?.selection.outcome).toBe('unavailable');
    const contribution = affected?.contributions.find(
      (entry) => entry.source === 'jolpica',
    );
    expect(contribution?.reason).toBe('mapping-unresolved');
    // The request left GridView and was answered, so it is still an attempt.
    expect(contribution?.attempted).toBe(true);
  });

  it('resolves an approved mapping to a branded GridView identity', () => {
    const resolution = registry.resolve(
      key<'driver'>({
        season: MAPPING_SEASON,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'norris',
      }),
    );
    expect(resolution.outcome).toBe('resolved');
    if (resolution.outcome !== 'resolved') throw new Error('unreachable');
    expect(resolution.gridviewId).toBe('lando-norris');
  });

  // Case 17
  it('never folds, trims, slugs or guesses an unmapped identity', () => {
    for (const value of [
      'NORRIS',
      ' norris',
      'norris ',
      'Norris',
      'nor',
      'nobody',
    ]) {
      const resolution = registry.resolve(
        key<'driver'>({
          season: MAPPING_SEASON,
          source: 'jolpica',
          entity: 'driver',
          providerField: 'driverId',
          providerValue: value,
        }),
      );
      expect(resolution.outcome).toBe('unresolved');
      expect(resolution).not.toHaveProperty('gridviewId');
    }

    // The GridView identity is never accepted as a provider identity either.
    const reversed = registry.resolve(
      key<'driver'>({
        season: MAPPING_SEASON,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'lando-norris',
      }),
    );
    expect(reversed.outcome).toBe('unresolved');
    expect(reversed).not.toHaveProperty('gridviewId');
  });

  it('signals an invalid key without echoing the invalid value', () => {
    const hostile = '\u0000\u0007 ../../etc/passwd';
    const resolution = registry.resolveUnknown({
      season: MAPPING_SEASON,
      source: 'jolpica',
      entity: 'driver',
      providerField: 'driverId',
      providerValue: hostile,
    });

    expect(resolution.outcome).toBe('unresolved');
    if (resolution.outcome !== 'unresolved') throw new Error('unreachable');
    expect(resolution.failure.reason).toBe('invalid-key');
    expect(resolution.failure.providerValue).toBeNull();
    expect(JSON.stringify(resolution)).not.toContain('passwd');
  });

  it('makes affected work unavailable when the registry itself is invalid', async () => {
    const source = await seasonFixture();
    // One dangling target is enough: the registry exposes no index at all.
    const broken = registryOf([
      {
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'norris',
        gridviewId: 'nobody-at-all',
        evidence: 'test fixture',
      },
    ]);
    expect(broken.isValid).toBe(false);

    const port = mappingPort(source, () => 'norris', broken);
    const run = await coordinate([port], [CALENDAR, raceResource(12)]);

    // Every contribution routed through the broken registry fails closed, and
    // no identity is minted anywhere.
    for (const resource of run.resources) {
      expect(resource.selection.outcome).toBe('unavailable');
      expect(resource.contributions[0]?.reason).toBe('mapping-unresolved');
    }
    expect(JSON.stringify(run)).not.toContain('nobody-at-all');
  });

  it('keeps an unrelated source contributing while mapping fails', async () => {
    const source = await seasonFixture();
    const failingMapper = mappingPort(source, () => 'nobody');
    const run = await coordinate([failingMapper], [CALENDAR, PARTICIPANTS]);

    // Both resources went through the same failing boundary, so both are
    // unavailable - and the run still completed rather than throwing.
    expect(run.status).toBe('completed');
    expect(run.counts.unavailable).toBe(2);
  });

  it('leaves the process-wide curated registry valid and untouched', () => {
    expect(providerMappingRegistry().isValid).toBe(true);
    expect(providerMappingRegistry().size).toBeGreaterThan(0);
  });
});

describe('a defective adapter fails closed instead of throwing', () => {
  // Case 18
  it('rejects a malformed outcome without throwing', async () => {
    const source = await seasonFixture();
    const malformed: unknown[] = [
      null,
      undefined,
      'candidate',
      [],
      {},
      { outcome: 'candidate' },
      {
        outcome: 'candidate',
        attempt: { reference: '', outcome: 'successful' },
      },
      {
        outcome: 'candidate',
        attempt: { reference: 'x'.repeat(65), outcome: 'successful' },
        payload: { kind: 'season-calendar', events: [] },
      },
      {
        outcome: 'candidate',
        attempt: { reference: 'r', outcome: 'exploded' },
        payload: { kind: 'season-calendar', events: [] },
      },
      { outcome: 'not-attempted', reason: 'because-i-said-so' },
      {
        outcome: 'not-attempted',
        reason: 'rate-limit-deferred',
        retryAt: 'soon',
      },
      { outcome: 'failed', attempt: { reference: 'r', outcome: 'failed' } },
      { outcome: 'mapping-failure' },
      {
        outcome: 'brand-new-variant',
        attempt: { reference: 'r', outcome: 'failed' },
      },
    ];

    for (const outcome of malformed) {
      expect(isWellFormedOutcome(outcome)).toBe(false);
      const port = new FakePort(
        'jolpica',
        () => outcome as ProviderResourceOutcome,
      );
      const run = await coordinate([port], [CALENDAR]);

      expect(run.status).toBe('completed');
      expect(run.resources[0]?.selection.outcome).toBe('unavailable');
      expect(run.resources[0]?.contributions[0]?.reason).toBe(
        'malformed-outcome',
      );
      expect(run.accounting.lifetime.total).toBe(0);
    }
    expect(source.calendar.length).toBeGreaterThan(0);
  });

  it('rejects a well-formed answer to a different question', async () => {
    const source = await seasonFixture();
    const wrongResource = new FakePort('jolpica', () => ({
      outcome: 'candidate',
      attempt: attempt('j-1'),
      // Structurally a valid candidate, but for the wrong round.
      payload: payloadFor(source, raceResource(13)) ?? {
        kind: 'season-circuits',
        circuits: [],
      },
    }));

    const run = await coordinate([wrongResource], [raceResource(12)]);

    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
    expect(run.resources[0]?.contributions[0]?.reason).toBe(
      'malformed-outcome',
    );
    // The attempt itself still happened and is still counted once.
    expect(run.accounting.lifetime.total).toBe(1);
  });

  // Case 19
  it('converts a thrown adapter error into a bounded typed outcome', async () => {
    const hostile = new Error(
      'GET https://api.jolpi.ca/ergast/f1/2026/results.json?limit=100 failed',
    );
    const port = new FakePort('jolpica', () => {
      throw hostile;
    });

    const run = await coordinate([port], [CALENDAR]);
    const contribution = run.resources[0]?.contributions[0];

    expect(run.status).toBe('completed');
    expect(contribution?.status).toBe('failed');
    expect(contribution?.reason).toBe('adapter-error');
    expect(contribution?.attempted).toBe(false);
    // Nothing from the thrown value survives anywhere in the result.
    const serialized = JSON.stringify(run);
    expect(serialized).not.toContain('jolpi.ca');
    expect(serialized).not.toContain('limit=100');
    expect(serialized).not.toContain('Error');
  });

  it('fails a conflicting re-use of one transport reference closed', async () => {
    const source = await seasonFixture();
    // Two resources claim the same physical request with different outcomes,
    // which cannot both be true.
    let first = true;
    const port = new FakePort('jolpica', (request) => {
      if (first) {
        first = false;
        return candidateFor(source, request.resource, 'shared');
      }
      return {
        outcome: 'failed',
        attempt: attempt('shared', 'failed'),
        reason: 'provider-unavailable',
      };
    });

    const run = await coordinate([port], [CALENDAR, PARTICIPANTS]);

    expect(coordinationFor(run, CALENDAR)?.selection.outcome).toBe('selected');
    const conflicted = coordinationFor(run, PARTICIPANTS);
    expect(conflicted?.selection.outcome).toBe('unavailable');
    expect(conflicted?.contributions[0]?.reason).toBe('coordination-invariant');
    // The single real request is still counted exactly once.
    expect(run.accounting.lifetime.total).toBe(1);
  });
});
