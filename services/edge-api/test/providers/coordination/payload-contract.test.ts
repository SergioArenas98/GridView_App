/**
 * Payload-level dispatch, and the proof that the validator is not vacuous.
 *
 * The dispatch is total over the seven `CoordinatedPayload` variants. The
 * non-vacuity half matters more than the rejection half: a validator that
 * rejects nonsense but also rejects the only data GridView actually ships
 * would be a gate that cannot be opened, so the curated mock season and every
 * checked-in public fixture are validated here as controls.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  validateCoordinatedPayload,
  coordinatedResourceKinds,
  type CoordinatedPayload,
} from '../../../src/providers/coordination';
import {
  validateCircuit,
  validateConstructor,
  validateConstructorSeasonEntry,
  validateConstructorStanding,
  validateDriver,
  validateDriverSeasonEntry,
  validateDriverStanding,
  validateGrandPrix,
  validateRaceResult,
} from '../../../src/contract/normalized';
import {
  payloadFor,
  seasonFixture,
  seasonResources,
  SEASON,
  raceResource,
} from './support';

describe('dispatch is total over the payload vocabulary', () => {
  it('validates a payload for every coordinated resource kind', async () => {
    const source = await seasonFixture();
    const covered = new Set<string>();

    for (const resource of [
      ...seasonResources,
      {
        kind: 'event-schedule',
        season: SEASON,
        round: source.calendar[0]?.round ?? 1,
      } as const,
      raceResource(source.calendar[0]?.round ?? 1),
    ]) {
      const payload = payloadFor(source, resource);
      expect(payload).not.toBeNull();
      expect(
        validateCoordinatedPayload(payload as CoordinatedPayload, 'payload'),
      ).toEqual([]);
      covered.add(resource.kind);
    }

    expect([...covered].sort()).toEqual([...coordinatedResourceKinds].sort());
  });

  it('refuses an unknown own property on the payload wrapper', async () => {
    const source = await seasonFixture();
    const payload = {
      ...(payloadFor(source, seasonResources[0]!) as CoordinatedPayload),
      upstreamCursor: 'page-2',
    } as unknown as CoordinatedPayload;

    expect(
      validateCoordinatedPayload(payload, 'payload').map((issue) => issue.code),
    ).toEqual(['unknown-property']);
  });

  it('reports a failure inside a collection at its own structural path', async () => {
    const source = await seasonFixture();
    const payload = {
      kind: 'season-calendar',
      events: [{ ...source.calendar[0]!, round: 0 }],
    } as unknown as CoordinatedPayload;

    const issues = validateCoordinatedPayload(payload, 'payload');

    expect(issues.map((issue) => `${issue.path}:${issue.code}`)).toEqual([
      'payload.events[0].round:range',
    ]);
  });

  it('reports every independently invalid element, bounded and ordered', async () => {
    const source = await seasonFixture();
    const payload = {
      kind: 'driver-standings',
      standings: [
        { ...source.driverStandings[0]!, position: 0 },
        { ...source.driverStandings[1]!, points: Number.NaN },
      ],
    } as unknown as CoordinatedPayload;

    expect(
      validateCoordinatedPayload(payload, 'payload').map((issue) => issue.path),
    ).toEqual(['payload.standings[0].position', 'payload.standings[1].points']);
  });
});

describe('the curated mock season is contract-valid', () => {
  it('validates every entity the mock provider emits', async () => {
    const source = await seasonFixture();
    const issues = [
      ...source.calendar.flatMap((event, index) =>
        validateGrandPrix(event, `calendar[${index}]`),
      ),
      ...source.drivers.flatMap((entity, index) =>
        validateDriver(entity, `drivers[${index}]`),
      ),
      ...source.constructors.flatMap((entity, index) =>
        validateConstructor(entity, `constructors[${index}]`),
      ),
      ...source.circuits.flatMap((entity, index) =>
        validateCircuit(entity, `circuits[${index}]`),
      ),
      ...source.driverEntries.flatMap((entity, index) =>
        validateDriverSeasonEntry(entity, `driverEntries[${index}]`),
      ),
      ...source.constructorEntries.flatMap((entity, index) =>
        validateConstructorSeasonEntry(entity, `constructorEntries[${index}]`),
      ),
      ...source.driverStandings.flatMap((entity, index) =>
        validateDriverStanding(entity, `driverStandings[${index}]`),
      ),
      ...source.constructorStandings.flatMap((entity, index) =>
        validateConstructorStanding(entity, `constructorStandings[${index}]`),
      ),
      ...source.results.flatMap((entity, index) =>
        validateRaceResult(entity, `results[${index}]`),
      ),
    ];

    expect(issues).toEqual([]);
  });

  it('covers a non-empty season, so the control cannot pass vacuously', async () => {
    const source = await seasonFixture();

    expect(source.calendar.length).toBeGreaterThan(0);
    expect(source.drivers.length).toBeGreaterThan(0);
    expect(source.driverStandings.length).toBeGreaterThan(0);
    expect(source.results.length).toBeGreaterThan(0);
  });

  it('carries media on at least one entity, so the nested rules are exercised', async () => {
    const source = await seasonFixture();
    const withMedia = source.drivers.filter(
      (entity) => entity.media !== null && entity.media.length > 0,
    );

    expect(withMedia.length).toBeGreaterThan(0);
    for (const entity of withMedia) {
      expect(validateDriver(entity, 'driver')).toEqual([]);
    }
  });
});

describe('the checked-in public fixtures are contract-valid', () => {
  const fixtureRoot = join(__dirname, '..', '..', 'fixtures', 'api', 'v1');

  /**
   * The two fixtures that must **not** pass, and why.
   *
   * Both exist to prove the **tolerant-consumer** half of the contract: a
   * client receiving a future server's additive fields ignores them, and one
   * receiving an unrecognised enum member maps it to `unknown`
   * (`test/contract/parse.test.ts`, and the Flutter mapping tests). That is
   * the reading direction.
   *
   * This validator governs the **producing** direction - what an adapter may
   * hand the coordinator - where an unrecognised field is an unvalidated value
   * that would be published verbatim, and a raw upstream enum token is the
   * provider's vocabulary reaching a public document instead of the
   * additive-safe `unknown` the adapter is required to normalize it to. Both
   * rules are correct at once; these two are excluded from the control set
   * deliberately, and their rejection is asserted below rather than assumed.
   */
  const consumerToleranceFixtures = [
    join('grand-prix', 'unknown-additive.json'),
    join('grand-prix', 'unknown-enum-status.json'),
  ];

  function fixtureFiles(directory: string): string[] {
    return readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) return fixtureFiles(path);
      return path.endsWith('.json') ? [path] : [];
    });
  }

  function payloadOf(path: string): unknown {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    return (parsed as { data?: unknown }).data ?? null;
  }

  function grandPrixFixtures(): string[] {
    return fixtureFiles(fixtureRoot).filter((path) => {
      if (consumerToleranceFixtures.some((name) => path.endsWith(name)))
        return false;
      const data = payloadOf(path);
      return (
        typeof data === 'object' &&
        data !== null &&
        !Array.isArray(data) &&
        'sessions' in data
      );
    });
  }

  function raceResultFixtures(): string[] {
    return fixtureFiles(fixtureRoot).filter((path) => {
      const data = payloadOf(path);
      return (
        typeof data === 'object' &&
        data !== null &&
        !Array.isArray(data) &&
        'entries' in data &&
        'sessionType' in data
      );
    });
  }

  it('finds fixtures of each shape to check', () => {
    expect(grandPrixFixtures().length).toBeGreaterThan(0);
    expect(raceResultFixtures().length).toBeGreaterThan(0);
  });

  it('validates every production Grand Prix fixture', () => {
    const issues = grandPrixFixtures().flatMap((path) =>
      validateGrandPrix(payloadOf(path), 'data').map(
        (issue) => `${path}:${issue.path}:${issue.code}`,
      ),
    );

    expect(issues).toEqual([]);
  });

  it('validates every race-result fixture', () => {
    const issues = raceResultFixtures().flatMap((path) =>
      validateRaceResult(payloadOf(path), 'data').map(
        (issue) => `${path}:${issue.path}:${issue.code}`,
      ),
    );

    expect(issues).toEqual([]);
  });

  it('accepts the fixture that carries only null optionals', () => {
    const detail = payloadOf(
      join(fixtureRoot, 'drivers', 'detail-missing-optional.json'),
    );
    const entity = (detail as { driver?: unknown }).driver;

    expect(validateDriver(entity, 'data')).toEqual([]);
  });

  it('refuses the additive-field tolerance fixture, which is the closed rule working', () => {
    const data = payloadOf(
      join(fixtureRoot, 'grand-prix', 'unknown-additive.json'),
    );
    const issues = validateGrandPrix(data, 'data');

    expect(issues.map((issue) => `${issue.path}:${issue.code}`)).toEqual([
      'data:unknown-property',
      'data:unknown-property',
      'data.sessions[0]:unknown-property',
    ]);
  });

  it('refuses a raw upstream enum token an adapter failed to normalize', () => {
    const data = payloadOf(
      join(fixtureRoot, 'grand-prix', 'unknown-enum-status.json'),
    );
    const issues = validateGrandPrix(data, 'data');

    expect(issues.map((issue) => `${issue.path}:${issue.code}`)).toEqual([
      'data.status:enum',
      'data.sessions[0].type:enum',
    ]);
  });

  it('accepts the additive-safe unknown member the adapter is required to emit', () => {
    const data = payloadOf(
      join(fixtureRoot, 'grand-prix', 'unknown-enum-status.json'),
    );
    const normalized = {
      ...(data as Record<string, unknown>),
      status: 'unknown',
      sessions: [
        {
          ...((data as { sessions: Record<string, unknown>[] }).sessions[0] ??
            {}),
          type: 'unknown',
        },
      ],
    };

    expect(validateGrandPrix(normalized, 'data')).toEqual([]);
  });
});
