/**
 * Valid resolution, aliasing, order independence and determinism.
 *
 * Required cases 1-10.
 */

import { describe, expect, it } from 'vitest';

import { key, realRegistry, registryOf, SEASON } from './support';

const registry = realRegistry();

describe('the curated registry resolves every seeded identity', () => {
  it('constructs cleanly from the checked-in content', () => {
    expect(registry.problems).toEqual([]);
    expect(registry.isValid).toBe(true);
    expect(registry.size).toBeGreaterThan(0);
  });

  // Case 1
  it('resolves a Jolpica driverId', () => {
    const result = registry.resolve(
      key<'driver'>({
        season: SEASON,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'norris',
      }),
    );
    expect(result).toEqual({ outcome: 'resolved', gridviewId: 'lando-norris' });
  });

  // Case 2
  it('resolves a Jolpica constructorId', () => {
    const result = registry.resolve(
      key<'constructor'>({
        season: SEASON,
        source: 'jolpica',
        entity: 'constructor',
        providerField: 'constructorId',
        providerValue: 'mclaren',
      }),
    );
    expect(result).toEqual({ outcome: 'resolved', gridviewId: 'mclaren' });
  });

  // Case 3
  it('resolves a Jolpica circuitId whose separator differs from GridView', () => {
    const result = registry.resolve(
      key<'circuit'>({
        season: SEASON,
        source: 'jolpica',
        entity: 'circuit',
        providerField: 'circuitId',
        providerValue: 'albert_park',
      }),
    );
    // The underscore/hyphen difference is curated, never transformed.
    expect(result).toEqual({ outcome: 'resolved', gridviewId: 'albert-park' });
  });

  // Case 4
  it('resolves an OpenF1 driver_number within its season', () => {
    const result = registry.resolve(
      key<'driver'>({
        season: SEASON,
        source: 'openf1',
        entity: 'driver',
        providerField: 'driver_number',
        providerValue: 1,
      }),
    );
    expect(result).toEqual({ outcome: 'resolved', gridviewId: 'lando-norris' });
  });

  // Case 5
  it('resolves an OpenF1 team_name', () => {
    const result = registry.resolve(
      key<'constructor'>({
        season: SEASON,
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue: 'Mercedes',
      }),
    );
    expect(result).toEqual({ outcome: 'resolved', gridviewId: 'mercedes' });
  });

  // Case 6 - an OpenF1 circuit_key resolves through the same typed path.
  // No circuit_key value is recorded in the repository's approved evidence
  // (GridView_Provider_Evaluation.md §8.3 names the field but records no
  // value), so seeding one in curated content would be inventing an
  // identifier. The mechanism is proven on a local fixture instead, and the
  // coverage gap is recorded in mapping-coverage.test.ts.
  it('resolves an OpenF1 circuit_key from a local fixture', () => {
    const fixture = registryOf([
      {
        source: 'openf1',
        entity: 'circuit',
        providerField: 'circuit_key',
        providerValue: 7,
        gridviewId: 'monza',
        evidence: 'local test fixture, not curated content',
      },
    ]);
    expect(fixture.isValid).toBe(true);
    expect(
      fixture.resolve(
        key<'circuit'>({
          season: SEASON,
          source: 'openf1',
          entity: 'circuit',
          providerField: 'circuit_key',
          providerValue: 7,
        }),
      ),
    ).toEqual({ outcome: 'resolved', gridviewId: 'monza' });
  });
});

describe('the four recorded constructor-name disagreements', () => {
  const openF1 = (providerValue: string) =>
    registry.resolve(
      key<'constructor'>({
        season: SEASON,
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue,
      }),
    );

  const jolpica = (providerValue: string) =>
    registry.resolve(
      key<'constructor'>({
        season: SEASON,
        source: 'jolpica',
        entity: 'constructor',
        providerField: 'constructorId',
        providerValue,
      }),
    );

  /**
   * Case 7, and the case-50 regression pin.
   *
   * §8.5 records four constructors whose OpenF1 `team_name` disagrees with
   * Jolpica's `Constructor.name`. Two of them have a canonical GridView
   * identity and resolve. Two of them do not: `content/registries/
   * constructors.mock.json` holds six constructors against the eleven on the
   * recorded grid, and minting `cadillac` or `racing-bulls` from a provider
   * name is exactly the slug invention this design forbids. Those two are
   * pinned as fail-closed instead, and are recorded as acknowledged coverage
   * gaps in the evidence corpus.
   */
  it('resolves the two pairs that have a canonical GridView identity', () => {
    expect(openF1('Alpine')).toEqual({
      outcome: 'resolved',
      gridviewId: 'alpine',
    });
    expect(openF1('Red Bull Racing')).toEqual({
      outcome: 'resolved',
      gridviewId: 'red-bull',
    });
  });

  it('fails closed on the two pairs with no canonical GridView identity', () => {
    for (const value of ['Cadillac', 'Racing Bulls']) {
      const result = openF1(value);
      expect(result.outcome).toBe('unresolved');
      if (result.outcome !== 'unresolved') throw new Error('unreachable');
      expect(result.failure.reason).toBe('unmapped');
    }
  });

  /**
   * The other half of every pair is a Jolpica *display name*, never a lookup
   * key: Jolpica is keyed on its stable `constructorId` slug precisely
   * because its rendered name disagrees with OpenF1. Pinning that these
   * strings never resolve is what stops a future adapter reaching for the
   * name when the slug is inconvenient.
   */
  it('never resolves a Jolpica display name as an identifier', () => {
    for (const displayName of [
      'Alpine F1 Team',
      'Cadillac F1 Team',
      'RB F1 Team',
      'Red Bull',
    ]) {
      expect(jolpica(displayName).outcome).toBe('unresolved');
      expect(openF1(displayName).outcome).toBe('unresolved');
    }
  });
});

describe('aliasing, ordering and determinism', () => {
  // Case 8
  it('lets several explicit keys target one GridView ID', () => {
    // Both are curated entries; neither is derived from the other.
    expect(
      registry.resolve(
        key<'driver'>({
          season: SEASON,
          source: 'jolpica',
          entity: 'driver',
          providerField: 'driverId',
          providerValue: 'norris',
        }),
      ),
    ).toEqual({ outcome: 'resolved', gridviewId: 'lando-norris' });
    expect(
      registry.resolve(
        key<'driver'>({
          season: SEASON,
          source: 'openf1',
          entity: 'driver',
          providerField: 'driver_number',
          providerValue: 1,
        }),
      ),
    ).toEqual({ outcome: 'resolved', gridviewId: 'lando-norris' });

    // And within one source: two distinct team_name spellings, one target.
    const aliases = registryOf([
      {
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue: 'Alpine',
        gridviewId: 'alpine',
        evidence: 'fixture',
      },
      {
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue: 'BWT Alpine',
        gridviewId: 'alpine',
        evidence: 'fixture',
      },
    ]);
    expect(aliases.isValid).toBe(true);
    expect(aliases.size).toBe(2);
    for (const providerValue of ['Alpine', 'BWT Alpine']) {
      expect(
        aliases.resolve(
          key<'constructor'>({
            season: SEASON,
            source: 'openf1',
            entity: 'constructor',
            providerField: 'team_name',
            providerValue,
          }),
        ),
      ).toEqual({ outcome: 'resolved', gridviewId: 'alpine' });
    }
  });

  // Case 9
  it('is unaffected by file order', () => {
    const records = [
      {
        source: 'jolpica',
        entity: 'constructor',
        providerField: 'constructorId',
        providerValue: 'mclaren',
        gridviewId: 'mclaren',
        evidence: 'fixture',
      },
      {
        source: 'jolpica',
        entity: 'constructor',
        providerField: 'constructorId',
        providerValue: 'mercedes',
        gridviewId: 'mercedes',
        evidence: 'fixture',
      },
      {
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue: 'Alpine',
        gridviewId: 'alpine',
        evidence: 'fixture',
      },
    ];

    const forward = registryOf(records);
    const reversed = registryOf([...records].reverse());

    expect(forward.isValid).toBe(true);
    expect(reversed.isValid).toBe(true);
    expect(forward.size).toBe(reversed.size);

    for (const providerValue of ['mclaren', 'mercedes']) {
      const lookup = key<'constructor'>({
        season: SEASON,
        source: 'jolpica',
        entity: 'constructor',
        providerField: 'constructorId',
        providerValue,
      });
      expect(forward.resolve(lookup)).toEqual(reversed.resolve(lookup));
    }
  });

  // Case 10
  it('is deterministic under repeated lookup and writes nothing', () => {
    const lookup = key<'constructor'>({
      season: SEASON,
      source: 'openf1',
      entity: 'constructor',
      providerField: 'team_name',
      providerValue: 'Mercedes',
    });

    const sizeBefore = registry.size;
    const results = Array.from({ length: 25 }, () => registry.resolve(lookup));

    for (const result of results) {
      expect(result).toEqual({ outcome: 'resolved', gridviewId: 'mercedes' });
    }
    // A miss must not populate the index either.
    registry.resolve(
      key<'constructor'>({
        season: SEASON,
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue: 'Nowhere',
      }),
    );
    expect(registry.size).toBe(sizeBefore);
  });
});
