/**
 * The default-off boundary (Phase 9B-6b, task §9): an absent or unrecognised
 * `SEASON_PUBLICATION_AUTHORITY` value keeps the exact legacy publication and
 * routing behaviour, and no code path performs a Durable Object lookup.
 */

import { describe, expect, it } from 'vitest';

import { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  legacyPublicationAuthority,
  resolvePublicationAuthority,
} from '../../../src/publication/authority';
import { resolvePublicationAuthorityMode } from '../../../src/config/environment';
import { SnapshotPublisher } from '../../../src/publication/publisher';
import { SequencedPublicationService } from '../../../src/publication/sequenced/service';
import { handlePublicRequest } from '../../../src/public/router';
import { FixedClock } from '../../../src/runtime/clock';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import { countingPort, generatedSet, SEASON } from './support';

const legacyConfig = {
  environment: 'development' as const,
  providerMode: 'mock' as const,
  publicationAuthorityMode: 'legacy' as const,
  publicBaseUrl: null,
};

describe('authority mode resolution', () => {
  it('resolves to legacy for every value except the exact string "sequencer"', () => {
    for (const value of [
      undefined,
      '',
      'legacy',
      'SEQUENCER',
      ' sequencer',
      'seq',
    ]) {
      expect(resolvePublicationAuthorityMode(value)).toBe('legacy');
    }
    expect(resolvePublicationAuthorityMode('sequencer')).toBe('sequencer');
  });

  it('returns the legacy authority when nothing selects the sequencer', () => {
    expect(resolvePublicationAuthority({}, legacyConfig)).toBe(
      legacyPublicationAuthority,
    );
  });

  it('falls back to legacy when the mode is requested but no port is reachable', () => {
    const authority = resolvePublicationAuthority(
      { SEASON_PUBLICATION_AUTHORITY: 'sequencer' },
      { ...legacyConfig, publicationAuthorityMode: 'sequencer' },
    );
    expect(authority.mode).toBe('legacy');
  });

  it('selects the sequencer only with the mode set and a test port present', () => {
    const port = countingPort();
    const authority = resolvePublicationAuthority(
      { __SEASON_PUBLICATION_SEQUENCER: port },
      { ...legacyConfig, publicationAuthorityMode: 'sequencer' },
    );
    expect(authority.mode).toBe('sequencer');
  });
});

describe('legacy publication behaviour is unchanged', () => {
  async function context() {
    const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
    const storage = new MemorySnapshotStorage();
    const logger = new CapturingLogger();
    const purger = new MemoryCachePurgeAdapter();
    const publisher = new SnapshotPublisher(
      storage,
      runtimeSnapshotValidator,
      purger,
      logger,
    );
    return { clock, storage, logger, purger, publisher };
  }

  it('publishes exactly as before, writing the legacy active pointer', async () => {
    const { clock, storage, publisher } = await context();
    const result = await publisher.publish(await generatedSet(clock, 'v1'));

    expect(result.status).toBe('applied');
    expect(result.version).toBe('v1');
    expect(result.pointerMaintenance).toBe('not-required');
    expect(await storage.getActiveVersion(SEASON)).toBe('v1');
  });

  it('serves a public route without an authority argument and without a lookup', async () => {
    const { clock, storage, publisher } = await context();
    await publisher.publish(await generatedSet(clock, 'v1'));

    const request = new Request('https://api.gridview.local/v1/seasons/2026');
    const noArg = await handlePublicRequest(request, storage, 'req-1');
    const legacyArg = await handlePublicRequest(
      request,
      storage,
      'req-2',
      legacyPublicationAuthority,
    );

    expect(noArg.response.status).toBe(200);
    expect(legacyArg.response.status).toBe(200);
    expect(noArg.cacheOutcome).toBe('hit');
  });
});

describe('a non-active sequencer season keeps legacy behaviour', () => {
  it('the router never consults an inventory and serves the legacy pointer', async () => {
    const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
    const storage = new MemorySnapshotStorage();
    const logger = new CapturingLogger();
    const purger = new MemoryCachePurgeAdapter();
    const publisher = new SnapshotPublisher(
      storage,
      runtimeSnapshotValidator,
      purger,
      logger,
    );
    await publisher.publish(await generatedSet(clock, 'v1'));

    // A port that reports every season `uninitialized`.
    const port = countingPort();
    const result = await handlePublicRequest(
      new Request('https://api.gridview.local/v1/seasons/2026'),
      storage,
      'req-1',
      { mode: 'sequencer', port },
    );

    expect(result.response.status).toBe(200);
    expect(port.calls).toEqual(['readAuthority']);
    // No inventory read for a document the active version does record - the
    // legacy path went straight to `readVersionedDocument`.
    expect(
      storage.writeLog.filter((key) => key.includes(':__inventory')).length,
    ).toBe(1); // only the one the publish itself wrote
  });

  it('the sequenced service delegates publish and rollback to the legacy fallback', async () => {
    const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
    const storage = new MemorySnapshotStorage();
    const logger = new CapturingLogger();
    const purger = new MemoryCachePurgeAdapter();
    const legacy = new SnapshotPublisher(
      storage,
      runtimeSnapshotValidator,
      purger,
      logger,
    );
    await legacy.publish(await generatedSet(clock, 'v1'));

    const port = countingPort();
    const service = new SequencedPublicationService({
      port,
      fallback: legacy,
      storage,
      validator: runtimeSnapshotValidator,
      purger,
      logger,
      clock,
    });

    const published = await service.publish(
      await generatedSet(clock, 'v2', {
        sourceUpdatedAt: '2026-07-21T00:00:00.000Z',
      }),
    );
    expect(published.status).toBe('applied');
    expect(published.version).toBe('v2'); // the legacy caller-minted version
    expect(await storage.getActiveVersion(SEASON)).toBe('v2');
    // The service asked once, saw `uninitialized`, and never called `prepare`.
    expect(port.calls).toEqual(['readAuthority']);
  });
});
