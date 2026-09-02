/**
 * A constructor season entry has two independent stored identities, and only
 * one of them is checked.
 *
 * `constructor_season_entries` keys rows on the entry's own `id` **and**
 * carries `UNIQUE(season, constructorId)`. The duplicate-identity matrix
 * checks the second and not the first, so two entries that name different
 * constructors while sharing one `id` pass preflight and then collide on a
 * single stored row - the exact failure the driver side already rejects, since
 * `driver-season-entry` is keyed on `entry.id`.
 *
 * Both entry collections must therefore be checked the same way, and the
 * documented legitimate multiplicities must stay accepted.
 */

import { describe, expect, it } from 'vitest';

import { validateSeasonReferences } from '../../../src/providers/coordination';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { seasonFixture } from './support';

function sourceWith(
  base: ProviderSeasonSource,
  overrides: Partial<ProviderSeasonSource>,
): ProviderSeasonSource {
  return { ...base, ...overrides };
}

describe('constructor season entry identity is checked on both keys', () => {
  it('accepts the curated season unchanged', async () => {
    expect(validateSeasonReferences(await seasonFixture())).toEqual([]);
  });

  it('rejects two constructor entries sharing one id', async () => {
    const base = await seasonFixture();
    const [first, second] = base.constructorEntries;
    if (first === undefined || second === undefined) {
      throw new Error('fixture gap');
    }
    // Different constructors, one entry id: `UNIQUE(season, constructorId)`
    // is satisfied while the primary key is not.
    const collided = sourceWith(base, {
      constructorEntries: base.constructorEntries.map((entry) =>
        entry === second ? { ...entry, id: first.id } : entry,
      ),
    });

    expect(validateSeasonReferences(collided)).toContain('duplicate-identity');
  });

  it('still rejects two constructor entries sharing one constructor', async () => {
    const base = await seasonFixture();
    const first = base.constructorEntries[0];
    if (first === undefined) throw new Error('fixture gap');
    const collided = sourceWith(base, {
      constructorEntries: [
        ...base.constructorEntries,
        { ...first, id: `${first.id}-duplicate-team` },
      ],
    });

    expect(validateSeasonReferences(collided)).toContain('duplicate-identity');
  });

  it('rejects the symmetric driver entry collisions', async () => {
    const base = await seasonFixture();
    const [first, second] = base.driverEntries;
    if (first === undefined || second === undefined) {
      throw new Error('fixture gap');
    }
    const collidedId = sourceWith(base, {
      driverEntries: base.driverEntries.map((entry) =>
        entry === second ? { ...entry, id: first.id } : entry,
      ),
    });

    expect(validateSeasonReferences(collidedId)).toContain(
      'duplicate-identity',
    );
  });

  it('keeps split driver participation spans accepted', async () => {
    const base = await seasonFixture();
    const first = base.driverEntries[0];
    if (first === undefined) throw new Error('fixture gap');
    const split = sourceWith(base, {
      driverEntries: [
        ...base.driverEntries,
        { ...first, id: `${first.id}-second-span`, startRound: 14 },
      ],
    });

    expect(validateSeasonReferences(split)).toEqual([]);
  });

  it('keeps a historical circuit lap-record driver accepted', async () => {
    const base = await seasonFixture();
    const [first, ...rest] = base.circuits;
    if (first === undefined) throw new Error('fixture gap');
    const historical = sourceWith(base, {
      circuits: [
        {
          ...first,
          lapRecord: {
            driverId: 'a-retired-driver',
            timeMillis: 78_000,
            year: 2004,
          },
        },
        ...rest,
      ],
    });

    expect(validateSeasonReferences(historical)).toEqual([]);
  });
});
