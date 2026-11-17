import {
  afterAll,
  beforeAll,
  afterEach,
  beforeEach,
  expect,
  it,
  vi,
} from 'vitest';
import {
  localInstallation,
  namespaceBridge,
  reviewedProfile,
  evidence,
} from './support.mjs';
import { EntryPointHarness } from '../../sync/coordinated/entry-points/support';
import {
  tickAfter,
  seasonPaths,
} from '../../sync/coordinated/observation/support';
import { guardNetwork, assertNoExternalNetwork } from './support.mjs';
import { composeCoordinatedRuntime } from '../../../src/sync/coordinated/composition';
import { admitIdentityContext } from '../../../src/identity/catalog/run-context';
import { CapturingLogger } from '../../../src/logging/logger';
const injected = vi.hoisted(() => ({ ledger: null }));
vi.mock('../../../src/sync/coordinated/ledger-port', async (original) => ({
  ...(await original()),
  resolveReconciliationLedger: () => injected.ledger?.() ?? null,
}));
vi.mock('../../../src/sync/coordinated/composition', async (original) => {
  const actual = await original();
  return {
    ...actual,
    composeCoordinatedRuntime: vi.fn(actual.composeCoordinatedRuntime),
  };
});
let catalog, root, wrapper;
beforeAll(async () => {
  catalog = await localInstallation();
}, 30000);
it('U8 explicitly initializes and activates R0 before controlled mode comparisons', async () => {
  root = await catalog.initialize();
  wrapper = await catalog.export(root.proposal.proposedRevisionId);
});
afterAll(async () => catalog?.stop());
beforeEach(() => {
  guardNetwork();
  vi.mocked(composeCoordinatedRuntime).mockClear();
});
afterEach(() => vi.unstubAllGlobals());
const current = () => vi.mocked(composeCoordinatedRuntime).mock.calls.at(-1)[1];
async function documents(h) {
  const version = h.activeVersion(),
    names = await h.harness.storage.readVersionInventory(2026, version);
  return Promise.all(
    names.map((name) =>
      h.harness.storage.readVersionedDocument(2026, version, name),
    ),
  );
}
async function harness(mode) {
  const h = await EntryPointHarness.create('durable-object', (binding) => {
    injected.ledger = binding;
  });
  await h.published();
  Object.assign(h.env, {
    IDENTITY_CATALOG_MODE: mode,
    IDENTITY_INSTALLATION_ID: catalog.installation,
    IDENTITY_CATALOG: namespaceBridge(catalog),
  });
  return h;
}

it.each([1, 2, 3])(
  'U8 complete deterministic run %s has exact request, limiter, normalized/public and reconciliation parity under bundled/compare/R0',
  async (round) => {
    const outputs = [],
      diagnostics = [];
    for (const mode of ['bundled', 'compare', 'runtime']) {
      const h = await harness(mode);
      for (let r = 1; r <= round; r++) h.server.results.set(r, 'A');
      const result = await h.manual(tickAfter(round, 6));
      const ctx = current();
      expect(ctx.authority).toBe(mode === 'runtime' ? 'runtime' : 'bundled');
      if (mode === 'compare') expect(ctx.comparison).toBe('equal');
      expect(result.requests.slice(0, 6)).toEqual(seasonPaths);
      expect(
        result.requests.filter((p) => p.endsWith('/results/')),
      ).toHaveLength(round);
      expect(result.reservations).toBe(6 + round);
      expect(result.finalizes).toBe(1);
      outputs.push({
        requests: result.requests,
        reservations: result.reservations,
        prepares: result.prepares,
        finalizes: result.finalizes,
        snapshot: await h.snapshot(),
        documents: await documents(h),
        profiles: ctx.canonicalProfiles,
        bindings: ctx.verifiedBindings,
        projection: ctx.effectiveSeasonProjection,
        metadata: ctx.seasonMetadata,
      });
      diagnostics.push({
        mode,
        requests: result.requests,
        reservations: result.reservations,
        documentCount: outputs.at(-1).documents.length,
        authority: ctx.authority,
        comparison: ctx.comparison ?? null,
        dataset: ctx.datasetVersion,
      });
    }
    expect(outputs[1]).toEqual(outputs[0]);
    expect(outputs[2]).toEqual(outputs[0]);
    await evidence('compare-round-' + round, {
      runs: diagnostics,
      semanticDifferences: 0,
    });
    assertNoExternalNetwork();
  },
);

it('U8 compare outage remains diagnostic and runtime outage fails before provider or publication admission', async () => {
  const outcomes = [];
  for (const mode of ['bundled', 'compare', 'runtime']) {
    const h = await harness(mode);
    h.server.results.set(1, 'A');
    h.env.IDENTITY_CATALOG = {
      idFromName: (x) => x,
      get: () => ({
        fetch: () => {
          throw Error('isolated catalog outage');
        },
      }),
    };
    const active = h.activeVersion(),
      result = await h.manual(tickAfter(1, 6));
    if (mode === 'runtime') {
      expect(result.requests).toEqual([]);
      expect(result.finalizes).toBe(0);
      expect(result.prepares).toBe(0);
      expect(h.activeVersion()).toBe(active);
      expect(result.ledgerCalls.at(-1)).toBe('releaseLease');
      expect(result.body.data).toMatchObject({
        status: 'failed',
        stage: 'identity',
        failure: 'catalog-unavailable',
      });
    } else {
      if (mode === 'compare') expect(current().comparison).toBe('unavailable');
      outcomes.push({
        requests: result.requests,
        snapshot: await h.snapshot(),
        documents: await documents(h),
      });
    }
  }
  expect(outcomes[1]).toEqual(outcomes[0]);
});

it('U8 hold/drain preserves blocks through runtime selection and controlled parity-safe bundled recovery', async () => {
  const h = await harness('bundled');
  h.server.results.set(1, 'A');
  await h.manual(tickAfter(1, 6));
  h.env.IDENTITY_CATALOG_MODE = 'compare';
  await h.manual(tickAfter(1, 7));
  expect(current().comparison).toBe('equal');
  await h.operate(tickAfter(1, 8), 'hold');
  let snapshot = await h.snapshot();
  expect(snapshot.lease.state).toBe('released');
  expect(snapshot.seasonRecord.record.operatorHold).not.toBeNull();
  expect(snapshot.seasonRecord.record.durableBlock).toBeNull();
  expect(snapshot.seasonRecord.record.publicationDisposition?.state).not.toBe(
    'publishing',
  );
  const authority = await h.harness.sequencer.readAuthority(2026);
  expect(authority.operation?.state).not.toBe('prepared');
  const active = h.activeVersion(),
    oldDocuments = await documents(h);
  for (const mode of ['runtime', 'bundled']) {
    h.env.IDENTITY_CATALOG_MODE = mode;
    const held = await h.manual(tickAfter(1, 9));
    expect(held.requests).toEqual([]);
    expect(held.finalizes).toBe(0);
    expect(h.activeVersion()).toBe(active);
    expect(
      (await h.snapshot()).seasonRecord.record.operatorHold,
    ).not.toBeNull();
  }
  // Fresh runtime execution is separately tested above. A hold is never
  // bypassed/released to manufacture publication for the transition exercise.
  await h.block(tickAfter(1, 10));
  h.env.IDENTITY_CATALOG_MODE = 'runtime';
  const blocked = await h.manual(tickAfter(1, 11));
  expect(blocked.requests).toEqual([]);
  expect(blocked.prepares).toBe(0);
  snapshot = await h.snapshot();
  expect(snapshot.seasonRecord.record.durableBlock).not.toBeNull();
  expect(await documents(h)).toEqual(oldDocuments);
  await evidence('hold-drain', {
    lease: snapshot.lease,
    held: true,
    durableBlockPreserved: true,
    publicationDisposition: snapshot.seasonRecord.record.publicationDisposition,
    paritySafeBundledReturn: true,
    activeUnchanged: true,
  });
});

it('U8 pins before provider calls, ignores mid-run mode/activation changes, and requires forward recovery after synthetic runtime-only publication', async () => {
  const h = await harness('runtime');
  h.server.results.set(1, 'A');
  const proposal = await reviewedProfile(catalog, wrapper);
  const baseTransport = h.server.transport;
  let changed = false;
  h.env.__PROVIDER_TRANSPORT = async (request) => {
    const pinned = current();
    expect(pinned.pin).not.toBeNull();
    expect(pinned.revisionId).toBe(root.proposal.proposedRevisionId);
    if (!changed) {
      changed = true;
      await catalog.activation(
        proposal.head,
        proposal.proposal,
        proposal.validation,
      );
      h.env.IDENTITY_CATALOG_MODE = 'bundled';
      h.env.IDENTITY_CATALOG.available = false;
    }
    return baseTransport(request);
  };
  const a = await h.manual(tickAfter(1, 6));
  expect(a.finalizes).toBe(1);
  const oldContext = current(),
    oldDocs = await documents(h),
    oldRound = await h.round(1);
  expect(oldContext.revisionId).toBe(root.proposal.proposedRevisionId);
  expect(JSON.stringify(oldDocs)).not.toContain(
    'Synthetic U8 Reviewed Profile',
  );
  expect(h.env.IDENTITY_CATALOG.calls).toHaveLength(1);
  h.env.IDENTITY_CATALOG.available = true;
  h.env.__PROVIDER_TRANSPORT = baseTransport;
  h.env.IDENTITY_CATALOG_MODE = 'runtime';
  const b = await h.manual(tickAfter(1, 7));
  expect(b.finalizes).toBe(1);
  const next = current(),
    nextDocs = await documents(h),
    nextRound = await h.round(1);
  expect(next.revisionId).toBe(proposal.proposal.proposedRevisionId);
  expect(next.datasetVersion).not.toBe(oldContext.datasetVersion);
  expect(JSON.stringify(nextDocs)).toContain('Synthetic U8 Reviewed Profile');
  expect(
    nextDocs.find((d) => d.documentName === 'grand-prix:1:results').data,
  ).toEqual(
    oldDocs.find((d) => d.documentName === 'grand-prix:1:results').data,
  );
  expect(nextRound.contentRevision).toEqual(oldRound.contentRevision);
  expect(nextRound.stagedCorrection).toBeNull();
  const state = await catalog.inspect(),
    head = JSON.parse(state.rows.identity_catalog_head[0].body);
  expect(head.hasRuntimeOnlyActivation).toBe(true);
  const compare = await admitIdentityContext(
    {
      mode: 'compare',
      installationId: catalog.installation,
      namespace: namespaceBridge(catalog),
    },
    catalog.pinRequest(),
    new CapturingLogger(),
  );
  expect(compare.authority).toBe('bundled');
  expect(compare.comparison).toBe('different');
  // An old activation replay recovers its historical receipt, never rewinds head.
  expect(
    (await catalog.raw(root.activation.path, root.activation.request)).status,
  ).toBe(200);
  expect((await catalog.admin('/health')).activeRevisionId).toBe(
    next.revisionId,
  );
  const backwards = await catalog.raw(root.activation.path, {
    ...root.activation.request,
    operationId: crypto.randomUUID(),
    expectedActiveRevisionId: next.revisionId,
    expectedActivationSequence: 2,
  });
  expect(backwards.status).not.toBe(200);
  expect((await catalog.admin('/health')).activeRevisionId).toBe(
    next.revisionId,
  );
  await evidence('runtime-forward-recovery', {
    oldRevision: oldContext.revisionId,
    nextRevision: next.revisionId,
    oldDataset: oldContext.datasetVersion,
    newDataset: next.datasetVersion,
    unchangedClassification: true,
    comparison: compare.comparison,
    irreversibleLegacyClosure: head.hasRuntimeOnlyActivation,
    backwardActivationStatus: backwards.status,
  });
});
