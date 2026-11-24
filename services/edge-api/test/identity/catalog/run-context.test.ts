import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import type { SeedArtifact } from '../../../src/identity/catalog/model';
import {
  CatalogRunPins,
  initializePins,
  type PinRequest,
} from '../../../src/identity/catalog/pin';
import {
  admitIdentityContext,
  bundledRunContext,
  contextFromPin,
  resolveIdentityCatalogMode,
} from '../../../src/identity/catalog/run-context';
import { IdentityCatalog } from '../../../src/identity/durable-object';
import { CapturingLogger } from '../../../src/logging/logger';
import { hashIdentityProjection } from '../../../src/identity/discovery/keys';
import { canonicalJson } from '../../../src/ingest/canonical-json';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import { sqliteHost } from './sqlite-support';
import {
  setup,
  installation,
  newDriverRequest,
  validateAndActivate,
} from './u4-support';
import { forbidNetwork } from '../discovery/support';
import { profileProposal } from './u6-support';
let seed: SeedArtifact;
const hosts: ReturnType<typeof sqliteHost>[] = [];
const host = () => {
  const h = sqliteHost();
  hosts.push(h);
  return h;
};
const request = (): PinRequest => ({
  schemaVersion: 1,
  runId: crypto.randomUUID(),
  installationId: installation,
  season: 2026,
  purpose: 'manual',
  leaseFence: 1,
});
const logger = new CapturingLogger();
beforeAll(async () => {
  seed = await prepareSeed(loadCorpus('p0'));
});
beforeEach(forbidNetwork);
afterEach(() => {
  for (const h of hosts.splice(0)) h.db.close();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('U6 complete contexts and durable pins', () => {
  it('defaults only to bundled and preserves exact R0 projection, profiles, mappings and strict unknown behavior', async () => {
    expect(resolveIdentityCatalogMode()).toBe('bundled');
    for (const v of ['', 'Runtime', 'auto'])
      expect(() => resolveIdentityCatalogMode(v)).toThrow();
    const h = host(),
      f = await setup(h.storage, seed),
      r = request();
    const wire = await new CatalogRunPins(h.storage, installation).pinRun(r);
    const [bundled, runtime] = await Promise.all([
      bundledRunContext(r),
      contextFromPin(wire, r),
    ]);
    expect(runtime.seasonProjectionHash).toBe(
      seed.snapshot.seasonContent[0]!.seasonProjectionHash,
    );
    expect(bundled.effectiveSeasonProjection).toEqual(
      runtime.effectiveSeasonProjection,
    );
    expect(bundled.baseContentDigest).toBe(runtime.baseContentDigest);
    expect(bundled.seasonMetadata).toEqual(runtime.seasonMetadata);
    expect(runtime.revisionId).toBe(f.root.revisionId);
    for (const b of seed.snapshot.bindings)
      expect(runtime.registry.resolve(b.key)).toEqual(
        providerMappingRegistry().resolve(b.key),
      );
    for (const d of seed.snapshot.drivers)
      expect(runtime.participants.driverById(d.profile.id)).toEqual(
        bundled.participants.driverById(d.profile.id),
      );
    for (const u of seed.snapshot.unresolved)
      expect(runtime.registry.resolve(u.key)).toMatchObject({
        outcome: 'unresolved',
        failure: { reason: 'unmapped' },
      });
    expect(Object.isFrozen(runtime)).toBe(true);
    expect(Object.isFrozen(runtime.effectiveSeasonProjection.drivers[0])).toBe(
      true,
    );
    expect(() => {
      (runtime.events as Map<string, string>).set('x', 'x');
    }).toThrow();
    const profile = runtime.participants.driverById(
      seed.snapshot.drivers[0]!.profile.id,
    )!;
    profile.fullName = 'Mutation';
    expect(runtime.participants.driverById(profile.id)!.fullName).not.toBe(
      'Mutation',
    );
  });
  it('returns the original receipt after activation and permits a later run to pin the new complete revision', async () => {
    const h = host(),
      f = await setup(h.storage, seed),
      pins = new CatalogRunPins(h.storage, installation, f.authority),
      r = request();
    const a = await pins.pinRun(r),
      context = await contextFromPin(a, r);
    const review = await newDriverRequest(f),
      next = await f.workflow.review(review, f.cap);
    await validateAndActivate(f, next.revision!.revisionId);
    expect(await pins.pinRun(r)).toEqual(a);
    expect(
      await new CatalogRunPins(h.storage, installation, f.authority).pinRun(r),
    ).toEqual(a);
    const b = await pins.pinRun(request());
    expect(b.pin.revisionId).toBe(next.revision!.revisionId);
    expect(context.participants.driverById('synthetic-new-person')).toBeNull();
    const updated = await contextFromPin(b, b.pin.request);
    expect(
      updated.participants.driverById('synthetic-new-person'),
    ).not.toBeNull();
    expect(updated.datasetVersion).not.toBe(context.datasetVersion);
    expect(context.registry.resolve(review.proposedBindingKey!)).toMatchObject({
      outcome: 'unresolved',
    });
    expect(updated.registry.resolve(review.proposedBindingKey!)).toMatchObject({
      outcome: 'resolved',
    });
  });
  it.each(['season', 'purpose', 'installationId'] as const)(
    'rejects conflicting run reuse: %s',
    async (field) => {
      const h = host();
      await setup(h.storage, seed);
      const pins = new CatalogRunPins(h.storage, installation),
        r = request();
      await pins.pinRun(r);
      const changes = {
        season: 2027,
        purpose: 'scheduled',
        leaseFence: 2,
        installationId: crypto.randomUUID(),
      };
      await expect(
        pins.pinRun({ ...r, [field]: changes[field] }),
      ).rejects.toThrow();
      expect(
        h.db.prepare('SELECT COUNT(*) n FROM identity_run_pins').get(),
      ).toEqual({ n: 1 });
    },
  );
  it('retains the original catalog and admitting fence when the same execution reacquires its independent season lease', async () => {
    const h = host();
    await setup(h.storage, seed);
    const pins = new CatalogRunPins(h.storage, installation),
      r = request(),
      original = await pins.pinRun(r);
    expect(await pins.pinRun({ ...r, leaseFence: 2 })).toEqual(original);
    expect(original.pin.request.leaseFence).toBe(1);
  });
  it('refuses paused/new head admission but recovers an acknowledged pin while paused', async () => {
    const h = host(),
      f = await setup(h.storage, seed),
      pins = new CatalogRunPins(h.storage, installation),
      r = request();
    const original = await pins.pinRun(r);
    h.db
      .prepare('UPDATE identity_catalog_head SET body=?')
      .run(canonicalJson({ ...f.workflow.head(), admissionState: 'paused' }));
    expect(await pins.pinRun(r)).toEqual(original);
    await expect(pins.pinRun(request())).rejects.toThrow(
      'pin-admission-paused',
    );
  });
  it.each([
    'missing-revision',
    'changed-profile',
    'missing-profile-index',
    'receipt-hash',
    'season-index',
  ] as const)(
    'invalidates the complete pin after corruption: %s',
    async (fault) => {
      const h = host(),
        f = await setup(h.storage, seed),
        pins = new CatalogRunPins(h.storage, installation),
        r = request();
      await pins.pinRun(r);
      if (fault === 'missing-revision') {
        h.db.exec('PRAGMA foreign_keys=OFF');
        h.db
          .prepare('DELETE FROM identity_catalog_revisions WHERE id=?')
          .run(f.root.revisionId);
      }
      if (fault === 'changed-profile') {
        const bad = structuredClone(f.root);
        bad.snapshot.drivers[0]!.profile.fullName = 'Forged';
        bad.contentHash = await hashIdentityProjection(bad.snapshot);
        h.db
          .prepare(
            'UPDATE identity_catalog_revisions SET body=?,hash=? WHERE id=?',
          )
          .run(canonicalJson(bad), bad.contentHash, bad.revisionId);
      }
      if (fault === 'missing-profile-index')
        h.db.exec('DELETE FROM identity_catalog_drivers');
      if (fault === 'receipt-hash')
        h.db.exec(
          "UPDATE identity_run_pins SET hash='sha256:" + '0'.repeat(64) + "'",
        );
      if (fault === 'season-index')
        h.db.exec('DELETE FROM identity_catalog_seasons');
      await expect(pins.pinRun(r)).rejects.toThrow();
    },
  );
  it('refuses missing head and incorrect installation before persisting a pin', async () => {
    const h = host(),
      pins = new CatalogRunPins(h.storage, installation);
    await expect(pins.pinRun(request())).rejects.toThrow('pin-no-active-head');
    await expect(
      pins.pinRun({ ...request(), installationId: crypto.randomUUID() }),
    ).rejects.toThrow('pin-installation-mismatch');
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_run_pins').get(),
    ).toEqual({ n: 0 });
  });
  it('rolls back a failed pin write and recovers exactly once', async () => {
    const h = host();
    await setup(h.storage, seed);
    const pins = new CatalogRunPins(h.storage, installation),
      r = request();
    initializePins(h.storage);
    h.db.exec(
      "CREATE TRIGGER fail_pin BEFORE INSERT ON identity_run_pins BEGIN SELECT RAISE(ABORT,'synthetic'); END",
    );
    await expect(pins.pinRun(r)).rejects.toThrow();
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_run_pins').get(),
    ).toEqual({ n: 0 });
    h.db.exec('DROP TRIGGER fail_pin');
    await pins.pinRun(r);
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_run_pins').get(),
    ).toEqual({ n: 1 });
  });
  it('uses an identical run-ID retry after a successful pin response is lost', async () => {
    const h = host();
    await setup(h.storage, seed);
    const object = new IdentityCatalog(
        { storage: h.storage },
        { IDENTITY_INSTALLATION_ID: installation },
      ),
      bodies: string[] = [];
    let lost = true;
    const namespace = {
      idFromName: (name: string) => {
        expect(name).toBe('identity:' + installation);
        return name;
      },
      get: () => ({
        fetch: async (url: string, init: RequestInit) => {
          bodies.push(String(init.body));
          const response = await object.fetch(new Request(url, init));
          if (lost) {
            lost = false;
            throw Error('lost-response');
          }
          return response;
        },
      }),
    };
    const r = request();
    const context = await admitIdentityContext(
      { mode: 'runtime', installationId: installation, namespace },
      r,
      logger,
    );
    expect(context.authority).toBe('runtime');
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toBe(bodies[1]);
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_run_pins').get(),
    ).toEqual({ n: 1 });
    namespace.get = () => ({
      fetch: async () => {
        throw Error('outage');
      },
    });
    expect(
      context.participants.driverById(seed.snapshot.drivers[0]!.profile.id),
    ).not.toBeNull();
  });
  it('bounds two uncertain attempts at exactly ten seconds each and stops on cancellation', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    const config = {
      mode: 'runtime' as const,
      installationId: installation,
      namespace: { idFromName: (s: string) => s, get: () => ({ fetch }) },
    };
    const pending = admitIdentityContext(config, request(), logger);
    const assertion = expect(pending).rejects.toMatchObject({
      failure: 'catalog-unavailable',
    });
    await vi.advanceTimersByTimeAsync(9999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    const controller = new AbortController();
    controller.abort();
    await expect(
      admitIdentityContext(
        config,
        { ...request(), signal: controller.signal },
        logger,
      ),
    ).rejects.toMatchObject({ failure: 'catalog-unavailable' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('keeps compare diagnostics separate from authoritative bundled context', async () => {
    const h = host();
    const f = await setup(h.storage, seed);
    const object = new IdentityCatalog(
      { storage: h.storage },
      { IDENTITY_INSTALLATION_ID: installation },
      true,
    );
    const config = {
      mode: 'compare' as const,
      installationId: installation,
      namespace: {
        idFromName: (s: string) => s,
        get: () => ({
          fetch: (url: string, init: RequestInit) =>
            object.fetch(new Request(url, init)),
        }),
      },
    };
    const context = await admitIdentityContext(config, request(), logger);
    expect(context).toMatchObject({
      authority: 'bundled',
      mode: 'compare',
      comparison: 'equal',
      revisionId: null,
    });
    expect(
      (await admitIdentityContext({ mode: 'compare' }, request(), logger))
        .comparison,
    ).toBe('unavailable');
    const next = await profileProposal(f);
    await validateAndActivate(f, next.revisionId);
    const changed = await admitIdentityContext(config, request(), logger);
    expect(changed.comparison).toBe('different');
    expect(
      changed.participants.driverById(seed.snapshot.drivers[0]!.profile.id)
        ?.fullName,
    ).toBe(seed.snapshot.drivers[0]!.profile.fullName);
  });
  it('rejects partial, unknown and inconsistent context response fields', async () => {
    const h = host();
    await setup(h.storage, seed);
    const r = request(),
      wire = await new CatalogRunPins(h.storage, installation).pinRun(r);
    for (const bad of [
      { pin: wire.pin },
      { ...wire, extra: 1 },
      { ...wire, pin: { ...wire.pin, datasetVersion: '2026.01.01.1' } },
      { ...wire, lineage: '{}' },
    ])
      await expect(contextFromPin(bad, r)).rejects.toThrow();
  });
});
