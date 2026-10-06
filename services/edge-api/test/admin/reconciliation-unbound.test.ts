/**
 * With the real resolver - no mock, no test hook - every reconciliation
 * operator route, the verification (PR-E3) and the coordinated rollback
 * refuse as `ledger-unbound`, and nothing is requested, published, written
 * or purged (PR-E2).
 *
 * The staging Worker here selects `coordinated` with every other dependency
 * bound: a counting limiter, a counting transport, a reachable sequencer
 * holding season 2026 `active`, and a purge origin. Only the ledger is
 * missing, because nothing can bind one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../../src/index';
import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import { CapturingLogger } from '../../src/logging/logger';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../src/providers/http/provider-rate-limiter';
import { SequencedPublicationService } from '../../src/publication/sequenced/service';
import { resolveReconciliationLedger } from '../../src/sync/coordinated/ledger-port';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import { SEASON, sequencedContext } from '../publication/sequenced/support';
import { createHarness } from '../support/edge-harness';
import {
  ADMIN_TOKEN,
  OP,
  PUBLIC_BASE_URL,
  call,
  paths,
} from './reconciliation-support';

class CountingLimiter implements ProviderRateLimiterClient {
  calls = 0;
  async reserve(
    sourceId: Parameters<ProviderRateLimiterClient['reserve']>[0],
  ): Promise<ReservationOutcome> {
    this.calls += 1;
    return { outcome: 'allowed', sourceId, headroom: [] };
  }
}

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const storageWrites = [
  'writeVersionedDocument',
  'writeVersionInventory',
  'writePublicationMetadata',
  'deletePublicationMetadata',
  'setActiveVersion',
  'setPreviousVersion',
  'setCurrentSeason',
  'setSyncState',
  'setQuotaState',
  'setContentMetadata',
  'deleteUnpublishedVersion',
] as const;

const seasonAction = {
  season: SEASON,
  expectedSeasonRecordVersion: 0,
  operationId: OP[0],
};
const operatorRoutes: readonly [string, string, unknown?][] = [
  ['GET', paths.inspect(SEASON)],
  ['POST', paths.hold, seasonAction],
  ['POST', paths.releaseHold, seasonAction],
  ['POST', paths.clearBlock, seasonAction],
  [
    'POST',
    paths.disposition,
    {
      season: SEASON,
      round: 3,
      action: 'accept-staged',
      operationId: OP[1],
      expected: {
        recordVersion: 1,
        contentRevision: `sha256:${'a'.repeat(64)}`,
        stagedRevision: `sha256:${'b'.repeat(64)}`,
        competingRevision: null,
      },
    },
  ],
  [
    'POST',
    paths.verification,
    {
      season: SEASON,
      round: 3,
      operationId: OP[2],
      expectedStagedRevision: `sha256:${'b'.repeat(64)}`,
      expectedVerificationGeneration: 0,
    },
  ],
  ['GET', paths.verificationHistory(SEASON, 3)],
  [
    'POST',
    paths.verificationRotation,
    {
      season: SEASON,
      round: 3,
      operationId: OP[3],
      expected: {
        recordVersion: 1,
        verificationGeneration: 0,
        historyDigest: `sha256:${'d'.repeat(64)}`,
      },
      historyArchived: true,
    },
  ],
];

describe('the real resolver leaves every operator route ledger-unbound', () => {
  it('answers null without a RECONCILIATION_LEDGER binding', () => {
    expect(resolveReconciliationLedger({})).toBeNull();
  });

  it('refuses every operator route and the coordinated rollback, with no provider, publication or storage action', async () => {
    const ctx = await sequencedContext({ cutover: 'active' });
    const limiter = new CountingLimiter();
    let transportCalls = 0;
    const logger = new CapturingLogger();
    const purger = new MemoryCachePurgeAdapter();
    const env: Env = {
      ENVIRONMENT: 'staging',
      PROVIDER_MODE: 'coordinated',
      PUBLIC_BASE_URL,
      ADMIN_TOKEN,
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_PUBLICATION_CUTOVER_CONTROL: `activate:${SEASON}`,
      __SEASON_PUBLICATION_SEQUENCER: ctx.port,
      __LOCAL_STORAGE: ctx.storage,
      __CACHE_PURGER: purger,
      __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
      __CLOCK: ctx.clock,
      __LOGGER: logger,
      __PROVIDER_RATE_LIMITER: limiter,
      __PROVIDER_TRANSPORT: async () => {
        transportCalls += 1;
        return new Response('{}', { status: 503 });
      },
    };
    const writes = storageWrites.map((method) => vi.spyOn(ctx.storage, method));
    const commands = (['prepare', 'finalize', 'cancel'] as const).map(
      (command) => vi.spyOn(ctx.port, command),
    );
    const rollback = vi.spyOn(
      SequencedPublicationService.prototype,
      'rollback',
    );
    const purge = vi.spyOn(purger, 'purgePublicUrls');
    const before = await ctx.port.readAuthority(SEASON);

    for (const [method, path, body] of [
      ...operatorRoutes,
      ['POST', paths.rollback(SEASON), {}] as const,
    ]) {
      const answer = await call(env, method, path, body);
      expect(answer.status, path).toBe(503);
      expect(answer.cacheControl, path).toBe('no-store');
      expect(answer.body.data, path).toEqual({
        status: 'reconciliation-unavailable',
        reasons: ['ledger-unbound'],
      });
    }

    // No provider request, reservation or global fetch...
    expect(limiter.calls).toBe(0);
    expect(transportCalls).toBe(0);
    expect(globalFetch).not.toHaveBeenCalled();
    // ...no rollback, sequencer command, storage write or cache purge.
    expect(rollback).not.toHaveBeenCalled();
    for (const spy of [...commands, ...writes, purge]) {
      expect(spy).not.toHaveBeenCalled();
    }
    expect(await ctx.port.readAuthority(SEASON)).toEqual(before);
    // One bounded warn line per refusal, naming the missing ledger.
    const lines = logger.events.filter((event) =>
      event.operation.startsWith('reconciliation.'),
    );
    expect(lines.map((line) => line.operatorAction)).toEqual([
      'inspect',
      'hold',
      'release-hold',
      'clear-block',
      'accept-staged',
      'verify',
      'inspect-verification-history',
      'rotate-verifications',
      'rollback',
    ]);
    for (const line of lines) {
      expect(line).toMatchObject({
        level: 'warn',
        operation: 'reconciliation.operator-action',
        operatorOutcome: 'reconciliation-unavailable',
        coordinationMissingDependencies: ['ledger-unbound'],
      });
    }
    // A refused mutation stays auditable: its operation ID (when it has one)
    // and authentication method. The inspection carries neither.
    expect(
      lines.map(({ round, operationId, operatorAuthMethod }) => ({
        round,
        operationId,
        operatorAuthMethod,
      })),
    ).toEqual([
      {
        round: undefined,
        operationId: undefined,
        operatorAuthMethod: undefined,
      },
      ...[0, 0, 0].map((index) => ({
        round: undefined,
        operationId: OP[index],
        operatorAuthMethod: 'shared-admin-token',
      })),
      {
        round: 3,
        operationId: OP[1],
        operatorAuthMethod: 'shared-admin-token',
      },
      {
        round: 3,
        operationId: OP[2],
        operatorAuthMethod: 'shared-admin-token',
      },
      { round: 3, operationId: undefined, operatorAuthMethod: undefined },
      {
        round: 3,
        operationId: OP[3],
        operatorAuthMethod: 'shared-admin-token',
      },
      {
        round: undefined,
        operationId: undefined,
        operatorAuthMethod: 'shared-admin-token',
      },
    ]);
  });

  it.each([
    ['development', 'mock'],
    ['staging', 'mock'],
    ['staging', 'none'],
    ['production', 'none'],
  ])(
    'refuses every operator route under %s / %s, reporting both missing conditions',
    async (environment, providerMode) => {
      const harness = createHarness({ environment, providerMode });
      harness.env.PUBLIC_BASE_URL = PUBLIC_BASE_URL;

      for (const [method, path, body] of operatorRoutes) {
        const answer = await call(harness.env, method, path, body);
        expect(answer.status, path).toBe(503);
        expect(answer.body.data, path).toEqual({
          status: 'reconciliation-unavailable',
          reasons: ['provider-mode-not-coordinated', 'ledger-unbound'],
        });
      }
      expect(globalFetch).not.toHaveBeenCalled();
    },
  );
});
