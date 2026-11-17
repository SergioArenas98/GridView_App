/**
 * U10: required driver identity closure and the season-assembly consumption
 * boundary under the explicit optional-driver inventory policy (design
 * §8.2-8.4, ADR 0030; matrix T23-T29, T33 leak checks). The complete guarded
 * publication cases (T23, T25, T30, T31) are in
 * `identity-closure-publication.test.ts`; shared fixtures are in
 * `identity-closure-support.ts`.
 *
 * Every case runs production code: the pure closure, the real optional-mode
 * `MultiSourceCoordinator` (closed accounting validation and digest recomputed
 * on its detached snapshot), `assembleSeasonSource`, the unchanged
 * `validateSeasonReferences`, `generateSnapshotSet`, `CoordinatedSeasonPublication`
 * and the real `SequencedPublicationService` over both sequencer transports.
 *
 * Synthetic data only: the split-participation season, synthetic catalog
 * hashes and synthetic candidate IDs. No port reaches a network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ConstructorSeasonEntry,
  Driver,
  DriverSeasonEntry,
  DriverStanding,
  RaceResult,
} from '../../../src/contract/types';
import { strictInventoryPolicy } from '../../../src/identity/inventory/model';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  MultiSourceCoordinator,
  assembleSeasonSource,
  type CoordinationRun,
} from '../../../src/providers/coordination';
import {
  closeSeasonDriverIdentities,
  identityClosureProblems,
  requiredDriverIds,
  type PinnedDriverProfiles,
} from '../../../src/providers/coordination/season-identity-closure';
import { seasonRelations } from '../../../src/providers/coordination/season-integrity';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { fullPlan, metadataFor } from './support';
import {
  OTHER_CATALOG,
  UNKNOWN_LABELS,
  policy,
  splitSeason,
  withRows,
  profilesOf,
  accountingFor,
  optionalPort,
  coordinateOptional,
  identityFor,
  without,
  expectNoPrivateLeak,
  type OptionalPortOptions,
} from './identity-closure-support';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('U10 network forbidden');
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

// ---------------------------------------------------------------------------
// 1. Pure closure (design §8.2)
// ---------------------------------------------------------------------------

function closureInput(over: {
  inventory?: Driver[];
  results?: RaceResult[];
  standings?: DriverStanding[];
  entries?: DriverSeasonEntry[];
  lineups?: ConstructorSeasonEntry[];
  profiles?: PinnedDriverProfiles;
}) {
  return {
    inventoryDrivers: over.inventory ?? [],
    results: over.results ?? [],
    driverStandings: over.standings ?? [],
    driverEntries: over.entries ?? [],
    constructorEntries: over.lineups ?? [],
    profiles: over.profiles ?? profilesOf([]),
  };
}

const result = (drivers: string[], fastest: string | null = null): RaceResult =>
  ({
    entries: drivers.map((driverId) => ({ driverId })),
    fastestLap:
      fastest === null ? null : { driverId: fastest, timeMillis: 1, lap: 1 },
  }) as unknown as RaceResult;

describe('U10 pure required-identity closure', () => {
  async function realProfile(): Promise<Driver> {
    // A complete, contract-valid profile from the curated fixture.
    return (await splitSeason()).drivers.find((d) => d.id === 'paul-aron')!;
  }

  it('computes the exact required set from all five reference sources', () => {
    const required = requiredDriverIds({
      results: [result(['race-a', 'race-b'], 'fast-c'), result([], null)],
      driverStandings: [{ driverId: 'standing-d' } as DriverStanding],
      driverEntries: [{ driverId: 'span-e' } as DriverSeasonEntry],
      constructorEntries: [
        { driverLineup: ['lineup-f'] } as ConstructorSeasonEntry,
        { driverLineup: null } as ConstructorSeasonEntry,
      ],
    });
    expect([...required].sort()).toEqual([
      'fast-c',
      'lineup-f',
      'race-a',
      'race-b',
      'span-e',
      'standing-d',
    ]);
  });

  it.each([
    ['race classification', { results: [result(['needed'])] }],
    ['fastest lap', { results: [result([], 'needed')] }],
    ['driver standing', { standings: [{ driverId: 'needed' }] }],
    ['derived span', { entries: [{ driverId: 'needed' }] }],
    ['constructor lineup', { lineups: [{ driverLineup: ['needed'] }] }],
  ])('supplements a profile required only by a %s', async (_, refs) => {
    const base = await realProfile();
    const needed = { ...base, id: 'needed' };
    const closure = closeSeasonDriverIdentities(
      closureInput({
        ...(refs as object),
        profiles: profilesOf([needed]),
      }),
    );
    expect(closure).toEqual({
      ok: true,
      drivers: [needed],
      supplemented: ['needed'],
    });
  });

  it('keeps verified inventory order, appends in exact canonical-ID order and adds nothing unrequired', async () => {
    const base = await realProfile();
    const p = (id: string) => ({ ...base, id });
    const catalog = [
      p('zeta'),
      p('beta'),
      p('alpha-driver'),
      p('alpha-2-driver'),
      p('unrequired-global'),
    ];
    const closure = closeSeasonDriverIdentities(
      closureInput({
        inventory: [p('zeta'), p('beta')],
        results: [result(['alpha-driver', 'beta', 'alpha-2-driver'])],
        profiles: profilesOf(catalog),
      }),
    );
    expect(closure.ok && closure.drivers.map((d) => d.id)).toEqual([
      'zeta',
      'beta',
      'alpha-2-driver',
      'alpha-driver',
    ]);
    expect(closure.ok && closure.supplemented).toEqual([
      'alpha-2-driver',
      'alpha-driver',
    ]);
  });

  it('is deterministic and leaves every input unmodified', async () => {
    const base = await realProfile();
    const input = closureInput({
      inventory: [{ ...base, id: 'kept' }],
      results: [result(['added'])],
      profiles: profilesOf([
        { ...base, id: 'kept' },
        { ...base, id: 'added' },
      ]),
    });
    const before = structuredClone({ ...input, profiles: null });
    const first = closeSeasonDriverIdentities(input);
    const second = closeSeasonDriverIdentities(input);
    expect(second).toEqual(first);
    expect({ ...input, profiles: null }).toEqual(before);
    // Profiles only: no span, team or entry is ever returned.
    expect(Object.keys(first).sort()).toEqual([
      'drivers',
      'ok',
      'supplemented',
    ]);
  });

  it.each([
    ['missing-profile', { missing: ['needed'] }],
    ['unbound-profile', { unbound: ['needed'] }],
  ] as const)('refuses a required identity as %s', async (problem, opts) => {
    const base = await realProfile();
    expect(
      closeSeasonDriverIdentities(
        closureInput({
          results: [result(['needed'])],
          profiles: profilesOf([{ ...base, id: 'needed' }], opts),
        }),
      ),
    ).toEqual({ ok: false, problem });
  });

  it('refuses a contradictory or malformed pinned profile and never synthesizes one', async () => {
    const base = await realProfile();
    const { media, ...rest } = base;
    void media;
    const contradictory = profilesOf([{ ...base, id: 'needed' }], {
      override: { needed: { ...rest, id: 'someone-else' } },
    });
    expect(
      closeSeasonDriverIdentities(
        closureInput({
          results: [result(['needed'])],
          profiles: contradictory,
        }),
      ),
    ).toEqual({ ok: false, problem: 'contradictory-profile' });
    const malformed = profilesOf([{ ...base, id: 'needed' }], {
      override: {
        needed: {
          ...rest,
          id: 'needed',
          permanentNumber: 'not-a-number' as unknown as number,
        },
      },
    });
    expect(
      closeSeasonDriverIdentities(
        closureInput({ results: [result(['needed'])], profiles: malformed }),
      ),
    ).toEqual({ ok: false, problem: 'invalid-profile' });
    // Nothing is made up from the reference itself.
    expect(
      closeSeasonDriverIdentities(
        closureInput({ results: [result(['no-such-driver'])] }),
      ),
    ).toEqual({ ok: false, problem: 'missing-profile' });
  });

  it('refuses duplicate inventory identities and inventory profiles that disagree with the pin', async () => {
    const base = await realProfile();
    const a = { ...base, id: 'dup' };
    expect(
      closeSeasonDriverIdentities(
        closureInput({ inventory: [a, a], profiles: profilesOf([a]) }),
      ),
    ).toEqual({ ok: false, problem: 'duplicate-inventory-driver' });
    expect(
      closeSeasonDriverIdentities(
        closureInput({
          inventory: [{ ...a, fullName: 'Edited after the pin' }],
          profiles: profilesOf([a]),
        }),
      ),
    ).toEqual({ ok: false, problem: 'inventory-profile-mismatch' });
  });

  it('keeps its problem vocabulary closed and its relations appended after the established ones', () => {
    expect(identityClosureProblems).toHaveLength(6);
    expect(seasonRelations.slice(-2)).toEqual([
      'driver-inventory-context',
      'required-driver-profile',
    ]);
    expect(seasonRelations.indexOf('duplicate-identity')).toBe(
      seasonRelations.length - 3,
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Assembly boundary (selected resources -> closure -> public source)
// ---------------------------------------------------------------------------

describe('U10 season assembly consumes private accounting before any public source exists', () => {
  it('T23: assembles an otherwise complete season with unknown inventory-only drivers, inventing nothing', async () => {
    const source = await splitSeason();
    const run = await coordinateOptional(source);
    expect(run.status).toBe('completed');
    const assembly = assembleSeasonSource(
      run,
      metadataFor(source),
      identityFor(source),
    );
    expect(assembly.complete).toBe(true);
    if (!assembly.complete) return;
    expect(assembly.source.drivers.map((d) => d.id)).toEqual(
      source.drivers.map((d) => d.id),
    );
    // Spans come from race rows only: exactly the classified drivers.
    expect(
      [...new Set(assembly.source.driverEntries.map((e) => e.driverId))].sort(),
    ).toEqual([
      'isack-hadjar',
      'liam-lawson',
      'max-verstappen',
      'yuki-tsunoda',
    ]);
    expect(Object.keys(assembly.source).sort()).toEqual(
      Object.keys(source).sort(),
    );
    await expectNoPrivateLeak(assembly.source);
  });

  it('T25: supplements a curated debutant absent from the inventory, after the inventory, with participation from results only', async () => {
    const source = await splitSeason();
    const inventory = without(source, 'yuki-tsunoda');
    const run = await coordinateOptional(source, { inventory });
    const assembly = assembleSeasonSource(
      run,
      metadataFor(source),
      identityFor(source),
    );
    expect(assembly.complete).toBe(true);
    if (!assembly.complete) return;
    const ids = assembly.source.drivers.map((d) => d.id);
    expect(ids.slice(0, inventory.length)).toEqual(inventory.map((d) => d.id));
    expect(ids.slice(inventory.length)).toEqual(['yuki-tsunoda']);
    expect(assembly.source.drivers.at(-1)).toEqual(
      source.drivers.find((d) => d.id === 'yuki-tsunoda'),
    );
    // The split spans of the strict assembly are reproduced exactly.
    const strict = assembleSeasonSource(
      await new MultiSourceCoordinator({
        ports: [await optionalPort(source, { accounting: null })],
        logger: new CapturingLogger(),
      }).coordinate({ plan: fullPlan(source) }),
      metadataFor(source),
    );
    expect(strict.complete).toBe(true);
    if (!strict.complete) return;
    expect(assembly.source.driverEntries).toEqual(strict.source.driverEntries);
  });

  it('T25 strict: the same debutant still withholds a strict season', async () => {
    const source = await splitSeason();
    const run = await new MultiSourceCoordinator({
      ports: [
        await optionalPort(source, {
          inventory: without(source, 'yuki-tsunoda'),
          accounting: null,
        }),
      ],
      logger: new CapturingLogger(),
    }).coordinate({ plan: fullPlan(source) });
    const assembly = assembleSeasonSource(run, metadataFor(source), {
      policy: strictInventoryPolicy,
      profiles: profilesOf(source.drivers),
    });
    expect(assembly).toMatchObject({
      complete: false,
      gap: 'inconsistent-references',
    });
    expect(!assembly.complete && assembly.relations).toContain(
      'result-entry-driver',
    );
  });

  it('closes a standings-only and lineup-only identity with a profile and no span (T26/T27)', async () => {
    const source = await splitSeason();
    // Russell: standings and Mercedes lineup only. Doohan: lineup only.
    const inventory = without(source, 'george-russell', 'jack-doohan');
    const assembly = assembleSeasonSource(
      await coordinateOptional(source, { inventory }),
      metadataFor(source),
      identityFor(source),
    );
    expect(assembly.complete).toBe(true);
    if (!assembly.complete) return;
    expect(assembly.source.drivers.slice(-2).map((d) => d.id)).toEqual([
      'george-russell',
      'jack-doohan',
    ]);
    const spans = assembly.source.driverEntries.map((e) => e.driverId);
    expect(spans).not.toContain('george-russell');
    expect(spans).not.toContain('jack-doohan');
  });

  it('T26: an inventory-only (FP1-style) verified identity keeps a profile but gets no span or team', async () => {
    const source = await splitSeason();
    const assembly = assembleSeasonSource(
      await coordinateOptional(source),
      metadataFor(source),
      identityFor(source),
    );
    expect(assembly.complete).toBe(true);
    if (!assembly.complete) return;
    expect(assembly.source.drivers.map((d) => d.id)).toContain('paul-aron');
    expect(
      assembly.source.driverEntries.filter((e) => e.driverId === 'paul-aron'),
    ).toEqual([]);
    expect(
      assembly.source.constructorEntries.some((c) =>
        (c.driverLineup ?? []).includes('paul-aron'),
      ),
    ).toBe(false);
  });

  it('T27: keeps returning-driver and transfer splits and the null multi-constructor standing', async () => {
    const source = await splitSeason();
    const multi: ProviderSeasonSource = {
      ...source,
      driverStandings: source.driverStandings.map((s) =>
        s.driverId === 'lando-norris' ? { ...s, constructorId: null } : s,
      ),
    };
    const assembly = assembleSeasonSource(
      await coordinateOptional(multi, {
        inventory: without(multi, 'liam-lawson'),
      }),
      metadataFor(multi),
      identityFor(multi),
    );
    expect(assembly.complete).toBe(true);
    if (!assembly.complete) return;
    const lawson = assembly.source.driverEntries
      .filter((e) => e.driverId === 'liam-lawson')
      .map(({ constructorId, startRound, endRound }) => ({
        constructorId,
        startRound,
        endRound,
      }));
    expect(lawson.length).toBeGreaterThan(1);
    expect(new Set(lawson.map((s) => s.constructorId)).size).toBeGreaterThan(1);
    expect(
      assembly.source.driverStandings.find((s) => s.driverId === 'lando-norris')
        ?.constructorId,
    ).toBeNull();
  });

  it('refuses a required identity whose pinned profile is missing or unbound (inconsistent-references)', async () => {
    const source = await splitSeason();
    const run = await coordinateOptional(source, {
      inventory: without(source, 'yuki-tsunoda'),
    });
    for (const opts of [
      { missing: ['yuki-tsunoda'] },
      { unbound: ['yuki-tsunoda'] },
    ]) {
      expect(
        assembleSeasonSource(run, metadataFor(source), {
          policy,
          profiles: profilesOf(source.drivers, opts),
        }),
      ).toEqual({
        complete: false,
        gap: 'inconsistent-references',
        missing: [],
        relations: ['required-driver-profile'],
      });
    }
  });

  it('binds payload, policy and pinned catalog together and refuses every disagreement', async () => {
    const source = await splitSeason();
    const optionalRun = await coordinateOptional(source);
    const strictRun = await new MultiSourceCoordinator({
      ports: [await optionalPort(source, { accounting: null })],
      logger: new CapturingLogger(),
    }).coordinate({ plan: fullPlan(source) });
    const refusal = {
      complete: false,
      gap: 'inconsistent-references',
      missing: [],
      relations: ['driver-inventory-context'],
    };
    // Accounting under a strict policy.
    expect(
      assembleSeasonSource(optionalRun, metadataFor(source), {
        policy: strictInventoryPolicy,
        profiles: profilesOf(source.drivers),
      }),
    ).toEqual(refusal);
    // No accounting under the optional policy.
    expect(
      assembleSeasonSource(strictRun, metadataFor(source), identityFor(source)),
    ).toEqual(refusal);
    // Pinned profiles of another catalog.
    expect(
      assembleSeasonSource(optionalRun, metadataFor(source), {
        policy,
        profiles: profilesOf(source.drivers, { catalogHash: OTHER_CATALOG }),
      }),
    ).toEqual(refusal);
    // An inventory profile edited relative to the pinned profile.
    expect(
      assembleSeasonSource(optionalRun, metadataFor(source), {
        policy,
        profiles: profilesOf(source.drivers, {
          override: {
            'paul-aron': {
              ...profilesOf(source.drivers).driverById('paul-aron')!,
              fullName: 'Changed In Catalog',
            },
          },
        }),
      }),
    ).toEqual(refusal);
    // Pre-U10 callers (no identity inputs) keep the exact U9 refusal.
    expect(assembleSeasonSource(optionalRun, metadataFor(source))).toEqual({
      complete: false,
      gap: 'inconsistent-references',
      missing: [],
      relations: [],
    });
  });

  it('T29: refuses forged accounting that reaches the boundary without the coordinator', async () => {
    const source = await splitSeason();
    const run = await coordinateOptional(source);
    const tamper = (edit: (inventory: Record<string, unknown>) => void) =>
      ({
        ...run,
        resources: run.resources.map((r) => {
          if (
            r.resource.kind !== 'season-participants' ||
            r.selection.outcome !== 'selected'
          )
            return r;
          const payload = structuredClone(r.selection.payload) as unknown as {
            driverInventory: Record<string, unknown>;
          };
          edit(payload.driverInventory);
          return { ...r, selection: { ...r.selection, payload } };
        }),
      }) as CoordinationRun;
    const forgeries: ((i: Record<string, unknown>) => void)[] = [
      (i) => (i.providerRowCount = Number(i.providerRowCount) + 1),
      (i) => (i.catalogHash = OTHER_CATALOG),
      (i) => (i.policyVersion = 2),
      (i) => {
        const u = i.unresolved as unknown[];
        u.push(u[0]);
        i.providerRowCount = Number(i.providerRowCount) + 1;
      },
      (i) => (i.unresolved as unknown[]).reverse(),
      (i) => (i.resolved as unknown[]).reverse(),
      (i) => ((i.unresolved as { reason: string }[])[0]!.reason = 'ambiguous'),
      (i) => (i.extra = true),
    ];
    for (const forge of forgeries) {
      expect(
        assembleSeasonSource(
          tamper(forge),
          metadataFor(source),
          identityFor(source),
        ),
      ).toMatchObject({
        complete: false,
        relations: ['driver-inventory-context'],
      });
    }
  });

  it('T29: the coordinator refuses a forged digest, catalog or mutated detached payload as invalid-payload', async () => {
    const source = await splitSeason();
    const valid = await accountingFor(source.drivers);
    const cases: OptionalPortOptions[] = [
      {
        accounting: {
          ...valid,
          projectionDigest: `sha256:${'e'.repeat(64)}`,
        },
      },
      // Self-consistent, resealed for another catalog: still refused.
      {
        accounting: await accountingFor(
          source.drivers,
          UNKNOWN_LABELS,
          OTHER_CATALOG,
        ),
      },
      { accounting: { ...valid, unresolved: [] } },
    ];
    for (const options of cases) {
      const run = await coordinateOptional(source, options);
      const participants = run.resources.find(
        (r) => r.resource.kind === 'season-participants',
      )!;
      expect(participants.selection.outcome).not.toBe('selected');
      expect(
        assembleSeasonSource(run, metadataFor(source), identityFor(source)),
      ).toMatchObject({ complete: false, gap: 'resource-unavailable' });
    }
  });

  it('T24: an unmapped required race or standings identity fails its whole resource under the optional policy', async () => {
    const source = await splitSeason();
    for (const failing of [
      (kind: string, round?: number) =>
        kind === 'session-classification' && round === 12,
      (kind: string) => kind === 'driver-standings',
    ]) {
      const run = await coordinateOptional(source, { failing });
      const assembly = assembleSeasonSource(
        run,
        metadataFor(source),
        identityFor(source),
      );
      expect(assembly).toMatchObject({
        complete: false,
        gap: 'resource-unavailable',
      });
    }
  });

  it('T28: the driver closure never masks an unknown constructor, missing constructor profile or bad lineup', async () => {
    const source = await splitSeason();
    const unknownTeam = withRows(source, 12, (rows) =>
      rows.map((row, i) =>
        i === 0 ? { ...row, constructorId: 'synthetic-unknown-team' } : row,
      ),
    );
    const a = assembleSeasonSource(
      await coordinateOptional(unknownTeam),
      metadataFor(unknownTeam),
      identityFor(unknownTeam),
    );
    expect(!a.complete && a.relations).toContain('result-entry-constructor');

    const missingConstructor = await coordinateOptional(source, {
      participants: (p) => ({
        ...p,
        constructors: (p.constructors as { id: string }[]).filter(
          (c) => c.id !== 'mclaren',
        ),
      }),
    });
    const b = assembleSeasonSource(
      missingConstructor,
      metadataFor(source),
      identityFor(source),
    );
    expect(b.complete).toBe(false);
    expect(!b.complete && b.gap).toBe('inconsistent-references');

    const badLineup = await coordinateOptional(source, {
      participants: (p) => ({
        ...p,
        constructorEntries: (
          p.constructorEntries as ConstructorSeasonEntry[]
        ).map((c) =>
          c.constructorId === 'sauber'
            ? { ...c, driverLineup: ['synthetic-unprofiled-driver'] }
            : c,
        ),
      }),
    });
    expect(
      assembleSeasonSource(badLineup, metadataFor(source), identityFor(source)),
    ).toMatchObject({
      complete: false,
      relations: ['required-driver-profile'],
    });
  });

  it('strict parity: a strict identity context changes nothing for a strict payload', async () => {
    const source = await splitSeason();
    const run = await new MultiSourceCoordinator({
      ports: [await optionalPort(source, { accounting: null })],
      logger: new CapturingLogger(),
    }).coordinate({ plan: fullPlan(source) });
    const profiles = profilesOf(source.drivers);
    const withContext = assembleSeasonSource(run, metadataFor(source), {
      policy: strictInventoryPolicy,
      profiles,
    });
    expect(withContext).toEqual(assembleSeasonSource(run, metadataFor(source)));
    // The strict path never consults the pinned profiles.
    expect(profiles.lookups).toEqual([]);
  });
});
