/**
 * The production genesis operation (ADR 0025 D12, "Amendment (2026-10-20)";
 * owner decision O-16): its gate, its explicit confirmation, the legacy-release
 * check, retries, concurrent requests and lost or failed writes - through the
 * service, and through the real Worker entry point and admin authentication.
 *
 * Every sequencer is in process and every storage is in memory. Nothing here
 * deploys, provisions or contacts Cloudflare.
 */

import { describe, expect, it } from 'vitest';

import worker, { type Env } from '../../../src/index';
import type { EnvironmentName } from '../../../src/config/environment';
import { CapturingLogger } from '../../../src/logging/logger';
import type { PublicationAuthority } from '../../../src/publication/authority';
import type { CutoverControl } from '../../../src/publication/cutover/control';
import {
  genesisFingerprint,
  genesisFingerprintText,
} from '../../../src/publication/cutover/genesis';
import { CutoverPreparationService } from '../../../src/publication/cutover/service';
import {
  LocalSeasonPublicationSequencer,
  MemorySequencerHost,
  SeasonPublicationCoordinator,
  type SeasonPublicationSequencerPort,
} from '../../../src/publication/sequencer';
import { FixedClock } from '../../../src/runtime/clock';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import {
  adminRequest,
  createHarness,
  request,
} from '../../support/edge-harness';
import { portWith } from '../sequenced/support';
import { OTHER_SEASON, SEASON, checkpointFor } from './support';

const IDENTITY = 'gridview-production-2026-genesis-01';
const GENESIS_PATH = '/internal/admin/publication/cutover/genesis';
const STATUS_PATH = `/internal/admin/publication/cutover/status?season=${SEASON}`;
const genesisControl: CutoverControl = { kind: 'genesis', season: SEASON };

interface Fixture {
  readonly storage: MemorySnapshotStorage;
  readonly host: MemorySequencerHost;
  readonly port: SeasonPublicationSequencerPort;
  readonly logger: CapturingLogger;
  readonly service: CutoverPreparationService;
}

function fixture(
  options: {
    control?: CutoverControl;
    environment?: EnvironmentName;
    authority?: (port: SeasonPublicationSequencerPort) => PublicationAuthority;
    port?: (
      base: SeasonPublicationSequencerPort,
    ) => SeasonPublicationSequencerPort;
    storage?: MemorySnapshotStorage;
  } = {},
): Fixture {
  const clock = new FixedClock(new Date('2026-10-20T12:00:00.000Z'));
  const storage = options.storage ?? new MemorySnapshotStorage();
  const host = new MemorySequencerHost();
  const base = new LocalSeasonPublicationSequencer(
    new SeasonPublicationCoordinator(host, { clock }),
  );
  const port = options.port ? options.port(base) : base;
  const logger = new CapturingLogger();
  const service = new CutoverPreparationService({
    config: {
      environment: options.environment ?? 'production',
      providerMode: 'none',
      publicationAuthorityMode: 'sequencer',
      publicationCutoverControl: options.control ?? genesisControl,
      publicBaseUrl: null,
    },
    authority: options.authority
      ? options.authority(port)
      : { mode: 'sequencer', port },
    storage,
    validator: runtimeSnapshotValidator,
    logger,
    clock,
  });
  return { storage, host, port, logger, service };
}

const command = (
  overrides: Partial<Parameters<CutoverPreparationService['genesis']>[0]> = {},
) => ({
  season: SEASON,
  genesisIdentity: IDENTITY,
  confirmGenesis: true,
  ...overrides,
});

describe('the genesis fingerprint', () => {
  it('is a framed, prefixed digest of the season and the identity', async () => {
    expect(genesisFingerprintText(SEASON, IDENTITY)).toBe(
      `gv-genesis/1|4:2026|${IDENTITY.length}:${IDENTITY}`,
    );
    const fingerprint = await genesisFingerprint(SEASON, IDENTITY);
    expect(fingerprint).toMatch(/^genesis1:[0-9a-f]{64}$/);
    expect(await genesisFingerprint(SEASON, IDENTITY)).toBe(fingerprint);
    expect(await genesisFingerprint(OTHER_SEASON, IDENTITY)).not.toBe(
      fingerprint,
    );
    expect(await genesisFingerprint(SEASON, `${IDENTITY}-b`)).not.toBe(
      fingerprint,
    );
  });
});

describe('the genesis gate', () => {
  it.each([
    ['no control', { kind: 'disabled' } as CutoverControl, 'disabled'],
    [
      'another season',
      { kind: 'genesis', season: OTHER_SEASON } as CutoverControl,
      'season-not-paused',
    ],
    [
      'a seed control',
      { kind: 'seed', season: SEASON } as CutoverControl,
      'phase-not-permitted',
    ],
    [
      'an activation control',
      { kind: 'activate', season: SEASON } as CutoverControl,
      'phase-not-permitted',
    ],
  ])('refuses %s before reading anything', async (_label, control, refusal) => {
    const f = fixture({ control });
    expect(await f.service.genesis(command())).toEqual({
      kind: 'refused',
      refusal,
    });
    expect(f.host.committedKeys()).toEqual([]);
  });

  it('refuses development, and admits production and staging', async () => {
    expect(
      await fixture({ environment: 'development' }).service.genesis(command()),
    ).toEqual({ kind: 'refused', refusal: 'environment-not-permitted' });
    for (const environment of ['production', 'staging'] as const) {
      expect(
        (await fixture({ environment }).service.genesis(command())).kind,
      ).toBe('genesis');
    }
  });

  it('refuses a legacy or unreachable authority', async () => {
    expect(
      await fixture({ authority: () => ({ mode: 'legacy' }) }).service.genesis(
        command(),
      ),
    ).toEqual({ kind: 'refused', refusal: 'authority-mode-not-sequencer' });
    expect(
      await fixture({
        authority: () => ({ mode: 'sequencer-unavailable' }),
      }).service.genesis(command()),
    ).toEqual({ kind: 'refused', refusal: 'sequencer-unavailable' });
  });

  it('requires the literal confirmation and a bounded identity', async () => {
    const f = fixture();
    expect(await f.service.genesis(command({ confirmGenesis: false }))).toEqual(
      { kind: 'failed', failure: 'genesis-not-confirmed' },
    );
    for (const genesisIdentity of ['', 'has space', 'x'.repeat(201)]) {
      expect(await f.service.genesis(command({ genesisIdentity }))).toEqual({
        kind: 'failed',
        failure: 'invalid-genesis-identity',
      });
    }
    expect(f.host.committedKeys()).toEqual([]);
  });

  it('is never reachable through the seed or activation operations', async () => {
    const f = fixture();
    expect(await f.service.seed(checkpointFor())).toEqual({
      kind: 'refused',
      refusal: 'phase-not-permitted',
    });
    expect(await f.service.activate(checkpointFor(), true)).toEqual({
      kind: 'refused',
      refusal: 'phase-not-permitted',
    });
  });
});

describe('genesis applies only to a season with no release', () => {
  it('records the season with no release', async () => {
    const f = fixture();
    const fingerprint = await genesisFingerprint(SEASON, IDENTITY);
    expect(await f.service.genesis(command())).toEqual({
      kind: 'genesis',
      receipt: {
        season: SEASON,
        outcome: 'created',
        cutoverState: 'genesis',
        genesisFingerprint: fingerprint,
      },
    });
    expect(await f.port.readAuthority(SEASON)).toEqual({
      cutoverState: 'genesis',
      authoritative: true,
      activeVersion: null,
      previousVersion: null,
      cutoverFingerprint: fingerprint,
    });
    expect(await f.service.status(SEASON)).toMatchObject({
      state: 'genesis',
      phase: 'genesis',
      admissionClosed: false,
      activeVersion: null,
    });
  });

  it.each([
    ['an active pointer', 'active'],
    ['a previous pointer', 'previous'],
  ] as const)('refuses a season with %s', async (_label, pointer) => {
    const storage = new MemorySnapshotStorage();
    if (pointer === 'active')
      await storage.setActiveVersion(SEASON, 'v-legacy');
    else await storage.setPreviousVersion(SEASON, 'v-legacy');
    const f = fixture({ storage });
    expect(await f.service.genesis(command())).toEqual({
      kind: 'failed',
      failure: 'legacy-release-present',
    });
    expect(f.host.committedKeys()).toEqual([]);
  });

  it('fails closed when a legacy pointer cannot be read', async () => {
    const storage = new MemorySnapshotStorage();
    storage.getPreviousVersion = async () => {
      throw new Error('simulated KV failure');
    };
    const f = fixture({ storage });
    expect(await f.service.genesis(command())).toEqual({
      kind: 'failed',
      failure: 'legacy-state-unreadable',
    });
    expect(f.host.committedKeys()).toEqual([]);
  });

  it('fails closed when the authority cannot be read', async () => {
    const f = fixture({
      port: (base) =>
        portWith(base, {
          readAuthority: async () => {
            throw new Error('simulated transport failure');
          },
        }),
    });
    expect(await f.service.genesis(command())).toEqual({
      kind: 'failed',
      failure: 'authority-unreadable',
    });
    expect(f.host.committedKeys()).toEqual([]);
  });
});

describe('retries and concurrent requests', () => {
  it('answers an identical retry from the sequencer without reading legacy state', async () => {
    const f = fixture();
    await f.service.genesis(command());
    let pointerReads = 0;
    f.storage.getActiveVersion = async () => {
      pointerReads += 1;
      return null;
    };
    expect(await f.service.genesis(command())).toMatchObject({
      kind: 'genesis',
      receipt: { outcome: 'already-genesis', cutoverState: 'genesis' },
    });
    expect(pointerReads).toBe(0);
  });

  it('refuses a second genesis under another identity', async () => {
    const f = fixture();
    await f.service.genesis(command());
    expect(
      await f.service.genesis(command({ genesisIdentity: `${IDENTITY}-b` })),
    ).toEqual({ kind: 'failed', failure: 'sequencer-state-present' });
  });

  it('settles two concurrent identical requests on one genesis', async () => {
    const f = fixture();
    const [first, second] = await Promise.all([
      f.service.genesis(command()),
      f.service.genesis(command()),
    ]);
    const outcomes = [first, second].map((result) =>
      result.kind === 'genesis' ? result.receipt.outcome : result.kind,
    );
    expect(outcomes.sort()).toEqual(['already-genesis', 'created']);
  });

  it('lets exactly one of two concurrent identities win', async () => {
    const f = fixture();
    const results = await Promise.all([
      f.service.genesis(command()),
      f.service.genesis(command({ genesisIdentity: `${IDENTITY}-b` })),
    ]);
    expect(results.filter((result) => result.kind === 'genesis')).toHaveLength(
      1,
    );
    expect(results.filter((result) => result.kind === 'failed')).toEqual([
      { kind: 'failed', failure: 'sequencer-state-present' },
    ]);
  });
});

describe('lost and failed writes', () => {
  it('reconciles a committed genesis whose answer was lost with one read', async () => {
    const f = fixture({
      port: (base) =>
        portWith(base, {
          commitGenesis: async (request) => {
            await base.commitGenesis(request);
            throw new Error('simulated lost answer');
          },
        }),
    });
    expect(await f.service.genesis(command())).toMatchObject({
      kind: 'genesis',
      receipt: { outcome: 'reconciled', cutoverState: 'genesis' },
    });
  });

  it('reports an unconfirmed genesis when the write did not land, and a retry succeeds', async () => {
    let fail = true;
    const f = fixture({
      port: (base) =>
        portWith(base, {
          commitGenesis: async (request) => {
            if (fail) return { outcome: 'uncertain' };
            return base.commitGenesis(request);
          },
        }),
    });
    expect(await f.service.genesis(command())).toEqual({
      kind: 'failed',
      failure: 'genesis-unconfirmed',
    });
    expect(f.host.committedKeys()).toEqual([]);
    fail = false;
    expect(await f.service.genesis(command())).toMatchObject({
      kind: 'genesis',
      receipt: { outcome: 'created' },
    });
  });

  it('maps a definite refusal without retrying it', async () => {
    let calls = 0;
    const f = fixture({
      port: (base) =>
        portWith(base, {
          commitGenesis: async () => {
            calls += 1;
            return { outcome: 'rejected', reason: 'state-corrupt' };
          },
        }),
    });
    expect(await f.service.genesis(command())).toEqual({
      kind: 'failed',
      failure: 'genesis-rejected',
    });
    expect(calls).toBe(1);
  });
});

describe('the genesis route through the Worker', () => {
  function productionEnv(port: SeasonPublicationSequencerPort): Env {
    const harness = createHarness({
      environment: 'production',
      providerMode: 'none',
    });
    return {
      ...harness.env,
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_PUBLICATION_CUTOVER_CONTROL: `genesis:${SEASON}`,
      __SEASON_PUBLICATION_SEQUENCER: port,
    };
  }

  const freshPort = () =>
    new LocalSeasonPublicationSequencer(
      new SeasonPublicationCoordinator(new MemorySequencerHost()),
    );

  it('requires the admin token', async () => {
    const env = productionEnv(freshPort());
    for (const req of [
      request(GENESIS_PATH, 'POST'),
      adminRequest(GENESIS_PATH, 'wrong', command()),
    ]) {
      const response = await worker.fetch(req, env);
      expect(response.status).toBe(401);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('refuses a malformed body, season or identity with 400', async () => {
    const env = productionEnv(freshPort());
    for (const body of [
      {},
      { ...command(), season: '2026' },
      { ...command(), season: 26 },
      { ...command(), genesisIdentity: 7 },
    ]) {
      const response = await worker.fetch(
        adminRequest(GENESIS_PATH, 'local-test-token', body),
        env,
      );
      expect(response.status).toBe(400);
    }
  });

  it('never accepts a truthy stand-in for the confirmation', async () => {
    const port = freshPort();
    const env = productionEnv(port);
    for (const confirmGenesis of [undefined, 'true', 1, {}]) {
      const response = await worker.fetch(
        adminRequest(GENESIS_PATH, 'local-test-token', {
          ...command(),
          confirmGenesis,
        }),
        env,
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        data: { kind: 'failed', failure: 'genesis-not-confirmed' },
      });
    }
    expect((await port.readAuthority(SEASON)).cutoverState).toBe(
      'uninitialized',
    );
  });

  it('creates the genesis in production and reports it in status', async () => {
    const port = freshPort();
    const env = productionEnv(port);
    const created = await worker.fetch(
      adminRequest(GENESIS_PATH, 'local-test-token', command()),
      env,
    );
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({
      data: { kind: 'genesis', receipt: { outcome: 'created' } },
    });
    const status = await worker.fetch(
      adminRequest(STATUS_PATH, 'local-test-token', undefined, 'GET'),
      env,
    );
    expect(await status.json()).toMatchObject({
      data: { state: 'genesis', phase: 'genesis', activeVersion: null },
    });
  });

  it('is refused by the committed production configuration (no control)', async () => {
    const harness = createHarness({
      environment: 'production',
      providerMode: 'none',
    });
    const response = await worker.fetch(
      adminRequest(GENESIS_PATH, 'local-test-token', command()),
      harness.env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      data: { kind: 'refused', refusal: 'disabled' },
    });
  });
});
