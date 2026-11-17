import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import type { SeedArtifact } from '../../../src/identity/catalog/model';
import { IdentityCatalog } from '../../../src/identity/durable-object';
import { composeCoordinatedRuntime } from '../../../src/sync/coordinated/composition';
import { verifyUnderLease } from '../../../src/sync/coordinated/operator/verification';
import { sqliteHost } from '../../identity/catalog/sqlite-support';
import {
  setup,
  installation,
  validateAndActivate,
} from '../../identity/catalog/u4-support';
import { profileProposal } from '../../identity/catalog/u6-support';
import {
  ObservationHarness,
  HOUR,
  PRE_SEASON,
  tickAfter,
} from './observation/support';
import { forbidNetwork } from '../../identity/discovery/support';
vi.mock('../../../src/sync/coordinated/composition', async (original) => {
  const actual =
    await original<
      typeof import('../../../src/sync/coordinated/composition')
    >();
  return {
    ...actual,
    composeCoordinatedRuntime: vi.fn(actual.composeCoordinatedRuntime),
  };
});
let seed: SeedArtifact;
const hosts: ReturnType<typeof sqliteHost>[] = [];
beforeAll(async () => {
  seed = await prepareSeed(loadCorpus());
});
beforeEach(forbidNetwork);
afterEach(() => {
  for (const h of hosts.splice(0)) h.db.close();
  vi.unstubAllGlobals();
});
async function staged() {
  const h = await ObservationHarness.create({
    transport: 'local',
    seed: 'unclassified',
  });
  await h.run(PRE_SEASON);
  await h.run(new Date(Date.parse(PRE_SEASON) + HOUR).toISOString());
  h.server.results.set(1, 'A');
  for (const hours of [5, 9, 15, 24]) await h.run(tickAfter(1, hours));
  h.server.results.set(1, 'C');
  h.server.results.set(2, 'A');
  await h.run(tickAfter(2, 5));
  await h.run(tickAfter(2, 9));
  const record = (await h.record(1))!;
  if (!record.stagedCorrection) throw Error('no staged fixture');
  h.clock.set(tickAfter(2, 10));
  return {
    h,
    record,
    command: {
      season: 2026,
      round: 1,
      operationId: crypto.randomUUID(),
      expectedStagedRevision: record.stagedCorrection.revision,
      expectedVerificationGeneration: record.verificationGeneration,
    },
  };
}
it('verification keeps R10 mappings/profiles/metadata across mid-request R11 activation; the next operation pins R11 and identical replay sends nothing', async () => {
  const host = sqliteHost();
  hosts.push(host);
  const f = await setup(host.storage, seed),
    next = await profileProposal(f);
  const object = new IdentityCatalog(
    { storage: host.storage },
    { IDENTITY_INSTALLATION_ID: installation },
    true,
  );
  const fetch = vi.fn((url: string, init: RequestInit) =>
    object.fetch(new Request(url, init)),
  );
  const identity = {
    mode: 'runtime' as const,
    installationId: installation,
    namespace: { idFromName: (s: string) => s, get: () => ({ fetch }) },
  };
  const { h, record, command } = await staged(),
    dependencies = h.dependencies(),
    beforePublication = h.publishGuarded.mock.calls.length,
    beforeRequests = h.server.requests.length;
  let activated = false;
  const runtime = {
    ...dependencies,
    ledger: dependencies.ledger!,
    identity,
    transport: async (req: Request) => {
      if (!activated) {
        activated = true;
        await validateAndActivate(f, next.revisionId);
      }
      return h.server.transport(req);
    },
  };
  const deps = { runtime, sequencer: h.sequencer, storage: h.storage };
  const a = await verifyUnderLease(command, deps),
    aContext = vi.mocked(composeCoordinatedRuntime).mock.calls.at(-1)![1]!;
  expect(a).toMatchObject({
    status: 'verified',
    providerRequests: 1,
    leaseRelease: 'released',
  });
  expect(aContext.revisionId).toBe(f.root.revisionId);
  expect(
    aContext.participants.driverById(seed.snapshot.drivers[0]!.profile.id)
      ?.fullName,
  ).toBe(seed.snapshot.drivers[0]!.profile.fullName);
  const b = await verifyUnderLease(
      { ...command, operationId: crypto.randomUUID() },
      deps,
    ),
    bContext = vi.mocked(composeCoordinatedRuntime).mock.calls.at(-1)![1]!;
  expect(b).toMatchObject({
    status: 'verified',
    providerRequests: 1,
    leaseRelease: 'released',
  });
  expect(bContext.revisionId).toBe(next.revisionId);
  expect(
    bContext.participants.driverById(seed.snapshot.drivers[0]!.profile.id)
      ?.fullName,
  ).toBe('Synthetic U6 Reviewed Profile');
  expect(h.server.requests.slice(beforeRequests)).toEqual([
    '/1/results/',
    '/1/results/',
  ]);
  expect(h.publishGuarded).toHaveBeenCalledTimes(beforePublication);
  expect((await h.record(1))?.contentRevision).toBe(record.contentRevision);
  expect((await h.record(1))?.stagedCorrection).toEqual(
    record.stagedCorrection,
  );
  const pins = fetch.mock.calls.length;
  expect(await verifyUnderLease(command, deps)).toMatchObject({
    status: 'already-applied',
    providerRequests: 0,
  });
  expect(fetch).toHaveBeenCalledTimes(pins);
});
it('verification runtime admission failure releases its lease, sends no request, and writes no verification or publication', async () => {
  const { h, command } = await staged(),
    dependencies = h.dependencies(),
    before = await h.record(1),
    requests = h.server.requests.length,
    publications = h.publishGuarded.mock.calls.length;
  const result = await verifyUnderLease(command, {
    runtime: {
      ...dependencies,
      ledger: dependencies.ledger!,
      identity: { mode: 'runtime' },
    },
    sequencer: h.sequencer,
    storage: h.storage,
  });
  expect(result).toMatchObject({
    status: 'precondition-failed',
    reason: 'catalog-unavailable',
    providerRequests: 0,
    leaseRelease: 'released',
  });
  expect(h.server.requests).toHaveLength(requests);
  expect(h.publishGuarded).toHaveBeenCalledTimes(publications);
  expect(await h.record(1)).toEqual(before);
  const lease = await h.freshLedger().acquireLease(2026);
  expect(lease.outcome).toBe('acquired');
  if (lease.outcome === 'acquired')
    await h
      .freshLedger()
      .releaseLease({ season: 2026, fence: lease.lease.fence });
});
it('recovers the same verification pin under a new lease after an uncertain record write and later catalog activation', async () => {
  const host = sqliteHost();
  hosts.push(host);
  const f = await setup(host.storage, seed),
    next = await profileProposal(f);
  const object = new IdentityCatalog(
    { storage: host.storage },
    { IDENTITY_INSTALLATION_ID: installation },
    true,
  );
  const identity = {
    mode: 'runtime' as const,
    installationId: installation,
    namespace: {
      idFromName: (s: string) => s,
      get: () => ({
        fetch: (url: string, init: RequestInit) =>
          object.fetch(new Request(url, init)),
      }),
    },
  };
  const { h, command } = await staged(),
    dependencies = h.dependencies(),
    base = dependencies.ledger!;
  const failing = Object.create(base) as typeof base;
  failing.verify = async () => ({ outcome: 'unavailable' });
  const uncertain = await verifyUnderLease(command, {
    runtime: { ...dependencies, ledger: failing, identity },
    sequencer: h.sequencer,
    storage: h.storage,
  });
  expect(uncertain).toMatchObject({
    status: 'ledger-unavailable',
    providerRequests: 1,
    leaseRelease: 'released',
  });
  const original = vi.mocked(composeCoordinatedRuntime).mock.calls.at(-1)![1]!;
  await validateAndActivate(f, next.revisionId);
  const recovered = await verifyUnderLease(command, {
    runtime: { ...dependencies, ledger: base, identity },
    sequencer: h.sequencer,
    storage: h.storage,
  });
  expect(recovered).toMatchObject({
    status: 'verified',
    providerRequests: 1,
    leaseRelease: 'released',
  });
  const restored = vi.mocked(composeCoordinatedRuntime).mock.calls.at(-1)![1]!;
  expect(restored.runId).toBe(command.operationId);
  expect(restored.pin).toEqual(original.pin);
  expect(restored.revisionId).toBe(f.root.revisionId);
  expect(
    host.db.prepare('SELECT COUNT(*) n FROM identity_run_pins').get(),
  ).toEqual({ n: 1 });
});
