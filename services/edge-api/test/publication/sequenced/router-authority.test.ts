/**
 * The sequencer-authoritative public read path (ADR 0025 D6; Phase 9B-6b
 * task §9). The legacy path is covered by `default-off.test.ts` and the
 * existing router suite.
 */

import { describe, expect, it } from 'vitest';

import type { PublicationAuthority } from '../../../src/publication/authority';
import type { SeasonPublicationSequencerPort } from '../../../src/publication/sequencer';
import { handlePublicRequest } from '../../../src/public/router';
import { readStoredInventory } from '../../../src/publication/version-inventory';
import {
  SEASON,
  SEED_VERSION,
  SidecarReadFailingStorage,
  generatedSet,
  sequencedContext,
} from './support';

function request(path: string): Request {
  return new Request(`https://api.gridview.local${path}`);
}

/** A port whose authority lookup can be made to throw or report `unavailable`. */
function riggedPort(
  inner: SeasonPublicationSequencerPort,
  mode: 'ok' | 'throw' | 'unavailable',
): SeasonPublicationSequencerPort {
  return {
    ...inner,
    readAuthority: async (season: number) => {
      if (mode === 'throw') throw new Error('lookup down');
      if (mode === 'unavailable') {
        return { cutoverState: 'unavailable', authoritative: false };
      }
      return inner.readAuthority(season);
    },
  };
}

async function activeContext() {
  const ctx = await sequencedContext();
  const published = await ctx.service.publish(
    await generatedSet(ctx.clock, 'x', {
      sourceUpdatedAt: '2026-07-20T00:00:00.000Z',
      contentVersion: '2026.07.20.a',
    }),
  );
  if (published.status !== 'applied') throw new Error('setup publish failed');
  return { ctx, activeVersion: published.version };
}

describe('sequencer-authoritative routing', () => {
  it('serves a document the active inventory names and can read', async () => {
    const { ctx } = await activeContext();
    const authority: PublicationAuthority = {
      mode: 'sequencer',
      port: ctx.port,
    };
    const result = await handlePublicRequest(
      request('/v1/seasons/2026'),
      ctx.storage,
      'req',
      authority,
    );
    expect(result.response.status).toBe(200);
    expect(result.cacheOutcome).toBe('hit');
  });

  it('returns not-found for a route the active inventory excludes, without a previous lookup', async () => {
    const { ctx, activeVersion } = await activeContext();
    // Make the previous version (SEED) *contain* a ghost detail route.
    const seedInventory = await readStoredInventory(
      ctx.storage,
      SEASON,
      SEED_VERSION,
    );
    if (seedInventory.kind !== 'documents') throw new Error('seed inventory');
    await ctx.storage.writeVersionInventory(SEASON, SEED_VERSION, [
      ...seedInventory.documents,
      'driver:ghost',
    ]);
    await ctx.storage.writeVersionedDocument(SEASON, SEED_VERSION, {
      documentName: 'driver:ghost',
      data: {},
      resourceIdentity: 'v1:2026:driver:ghost',
      meta: {
        apiVersion: '1',
        schemaVersion: 1,
        generatedAt: '2026-07-10T00:00:00.000Z',
        sourceUpdatedAt: '2026-07-10T00:00:00.000Z',
        staleAfter: '2026-07-10T00:15:00.000Z',
        contentVersion: '2026.07.10.1',
        season: SEASON,
      } as never,
    });

    const view = new SidecarReadFailingStorage(ctx.storage);
    const result = await handlePublicRequest(
      request('/v1/drivers/ghost'),
      view,
      'req',
      { mode: 'sequencer', port: ctx.port },
    );

    expect(result.response.status).toBe(404);
    // The active inventory was read; the previous version's was not.
    expect(view.inventoryReads).toEqual([activeVersion]);
    expect(view.inventoryReads).not.toContain(SEED_VERSION);
  });

  it('falls back to the previous version only when its inventory also names the document', async () => {
    const { ctx, activeVersion } = await activeContext();
    // A detail route present in both the active and the previous (SEED) version.
    const inventory = await readStoredInventory(
      ctx.storage,
      SEASON,
      activeVersion,
    );
    if (inventory.kind !== 'documents') throw new Error('active inventory');
    const detail = inventory.documents.find((name) =>
      name.startsWith('grand-prix:'),
    );
    if (!detail) throw new Error('no grand-prix detail route');

    const view = new SidecarReadFailingStorage(ctx.storage);
    view.hiddenDocuments.add(`${activeVersion}|${detail}`);

    const path = `/v1/seasons/2026/grand-prix/${detail.split(':')[1]}`;
    const served = await handlePublicRequest(request(path), view, 'req', {
      mode: 'sequencer',
      port: ctx.port,
    });
    // SEED is the previous version and its inventory also names the route.
    expect(served.response.status).toBe(200);

    // Now hide it at the previous version too: no blind fallback.
    view.hiddenDocuments.add(`${SEED_VERSION}|${detail}`);
    const notServed = await handlePublicRequest(request(path), view, 'req2', {
      mode: 'sequencer',
      port: ctx.port,
    });
    expect(notServed.response.status).toBe(404);
  });

  it('returns a bounded degraded response when the active inventory is unreadable', async () => {
    const { ctx, activeVersion } = await activeContext();
    const view = new SidecarReadFailingStorage(ctx.storage);
    view.unreadableInventories.add(activeVersion);

    const result = await handlePublicRequest(
      request('/v1/seasons/2026'),
      view,
      'req',
      { mode: 'sequencer', port: ctx.port },
    );
    expect(result.response.status).toBe(503);
  });

  it('fails closed when the authoritative lookup itself is unavailable', async () => {
    const { ctx } = await activeContext();
    for (const mode of ['throw', 'unavailable'] as const) {
      const result = await handlePublicRequest(
        request('/v1/seasons/2026'),
        ctx.storage,
        'req',
        { mode: 'sequencer', port: riggedPort(ctx.port, mode) },
      );
      expect(result.response.status).toBe(503);
    }
  });

  it('never lets an internal sidecar or inventory name become a public route', async () => {
    const { ctx } = await activeContext();
    for (const path of [
      '/v1/seasons/2026/__inventory',
      '/v1/seasons/2026/__publication_metadata',
      '/v1/drivers/__publication_metadata',
    ]) {
      const result = await handlePublicRequest(
        request(path),
        ctx.storage,
        'r',
        {
          mode: 'sequencer',
          port: ctx.port,
        },
      );
      // Resolved as an invalid/unknown route, never dispatched to a document.
      expect([400, 404]).toContain(result.response.status);
    }
  });
});
