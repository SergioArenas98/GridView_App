import type { CachePurgeAdapter } from '../cache/purge';
import type { Env } from '../config/environment';
import { jsonResponse } from '../http/envelope';
import type { Logger } from '../logging/logger';
import type { PublicationAuthority } from '../publication/authority';
import type { PublicationCommands } from '../publication/commands';
import type { CutoverPreparationService } from '../publication/cutover/service';
import type { Clock } from '../runtime/clock';
import type { CoordinatedSyncOutcome } from '../sync/coordinated/run';
import type { SynchronizationService } from '../sync/sync-service';
import { emptySyncState } from '../sync/sync-service';
import {
  providerSourceIds,
  type ProviderSourceId,
} from '../providers/provider-source';
import type {
  QuotaState,
  SnapshotStorage,
  SyncJobCategory,
} from '../storage/types';
import { adminAuthOk, unauthorized } from './auth';
import { handleCutoverRequest, isCutoverPath } from './cutover-routes';
import {
  handleCoordinatedRollback,
  handleReconciliationRequest,
  isReconciliationPath,
  type OperatorReconciliation,
} from './reconciliation-routes';
import {
  handleStandingsPredecessorRequest,
  standingsPredecessorPath,
} from './standings-predecessor-route';

/**
 * How the admin sync routes synchronize, fixed by `PROVIDER_MODE`.
 *
 * - `whole-season` (`mock`, `none`): the existing `SynchronizationService`.
 * - `coordinated`: `sync/full` is a manual coordinated run, a forced
 *   publication run that never advances scheduled due times (O-8), through
 *   the same `runCoordinatedSync` the scheduled handler uses. It answers 503
 *   when the run is refused before the orchestration (`ledger-unbound` in
 *   every environment today), and otherwise 200 with the run's closed
 *   outcome, as the whole-season sync answers 200 with its own result.
 *   `sync/resource` and `rebuild/home` are refused as `SYNC_MODE_UNSUPPORTED`,
 *   because a coordinated publication cannot be a subset of the season and
 *   `home-rebuild` must never become a provider request.
 */
export type AdminSynchronization =
  | { readonly mode: 'whole-season'; readonly sync: SynchronizationService }
  | {
      readonly mode: 'coordinated';
      readonly run: (season: number) => Promise<CoordinatedSyncOutcome>;
    };

interface AdminContext {
  env: Env;
  storage: SnapshotStorage;
  synchronization: AdminSynchronization;
  publisher: PublicationCommands;
  purger: CachePurgeAdapter;
  logger: Logger;
  requestId: string;
  purgeOrigin: string;
  /**
   * The staging cutover preparation surface (ADR 0025 D12). Always constructed;
   * it refuses every operation itself while the cutover control is unset or
   * `SEASON_PUBLICATION_AUTHORITY` is not `sequencer`, which is what every
   * deployed environment leaves it as - `env.staging` has deployed `seed:2026`
   * (closing season 2026's legacy admission) since 2026-09-12, but
   * `SEASON_PUBLICATION_AUTHORITY` remains unset everywhere regardless.
   */
  cutover: CutoverPreparationService;
  /**
   * The resolved season publication authority, read only by the A3.5 staging
   * predecessor gate. Every other route reaches it through `publisher` or
   * `cutover`.
   */
  authority: PublicationAuthority;
  /**
   * The reconciliation ledger the operator routes and the coordinated
   * rollback reach (PR-E2). Its ledger is `null` in every environment, so
   * each of them refuses as `ledger-unbound` before reading anything.
   */
  reconciliation: OperatorReconciliation;
  clock: Clock;
}

export async function handleAdminRequest(
  request: Request,
  context: AdminContext,
): Promise<Response> {
  if (!adminAuthOk(request, context.env)) {
    return unauthorized(context.requestId);
  }

  const url = new URL(request.url);
  // Dispatched before the shared season resolution below: a cutover names its
  // season explicitly, and must never inherit `meta:current-season`.
  if (isCutoverPath(url.pathname)) {
    return handleCutoverRequest(
      request,
      url,
      context.cutover,
      context.requestId,
    );
  }
  // Also names its season explicitly, and is read-only.
  if (url.pathname === standingsPredecessorPath) {
    return handleStandingsPredecessorRequest(request, url, context);
  }
  // Names its season explicitly too, and validates it before any ledger read.
  if (isReconciliationPath(url.pathname)) {
    return handleReconciliationRequest(request, url, context);
  }
  if (request.method === 'GET') {
    if (url.pathname === '/internal/admin/quota') {
      // Source-aware: one entry per canonical source, so a source with no
      // modelled state reports `null` rather than borrowing another one's.
      const bySource: Partial<Record<ProviderSourceId, QuotaState | null>> = {};
      for (const sourceId of providerSourceIds) {
        bySource[sourceId] = await context.storage.getQuotaState(sourceId);
      }
      return jsonResponse(
        {
          data: { sources: bySource },
          requestId: context.requestId,
        },
        200,
        context.requestId,
        noStore(),
      );
    }
    if (url.pathname === '/internal/admin/sync/status') {
      const season = await resolveAdminSeason(request, context.storage);
      const state =
        (await context.storage.getSyncState(season)) ?? emptySyncState(season);
      return jsonResponse(
        {
          data: {
            currentSeason: await context.storage.getCurrentSeason(),
            activeVersion: await context.storage.getActiveVersion(season),
            previousVersion: await context.storage.getPreviousVersion(season),
            retainedVersions: await context.storage.listVersions(season),
            sync: state,
          },
          requestId: context.requestId,
        },
        200,
        context.requestId,
        noStore(),
      );
    }
    return methodNotAllowed(context.requestId, 'GET, POST');
  }

  if (request.method !== 'POST') {
    return methodNotAllowed(context.requestId, 'GET, POST');
  }

  const season = await resolveAdminSeason(request, context.storage);
  const synchronization = context.synchronization;
  if (
    synchronization.mode === 'coordinated' &&
    (url.pathname === '/internal/admin/sync/resource' ||
      url.pathname === '/internal/admin/rebuild/home')
  ) {
    return jsonResponse(
      {
        error: {
          code: 'SYNC_MODE_UNSUPPORTED',
          message: 'This synchronization route is not available in this mode.',
          requestId: context.requestId,
        },
      },
      409,
      context.requestId,
      noStore(),
    );
  }
  if (url.pathname === '/internal/admin/sync/full') {
    if (synchronization.mode === 'coordinated') {
      const outcome = await synchronization.run(season);
      return ok(
        outcome,
        context.requestId,
        outcome.status === 'coordinated-runtime-unavailable' ? 503 : 200,
      );
    }
    const result = await synchronization.sync.run({
      season,
      trigger: 'manual-full',
      forceJobs: allSyncJobs(),
    });
    return ok(result, context.requestId);
  }
  if (
    synchronization.mode === 'whole-season' &&
    url.pathname === '/internal/admin/sync/resource'
  ) {
    const body = await readJson(request);
    const job = jobForResource(
      typeof body.resource === 'string' ? body.resource : '',
    );
    if (!job) {
      return jsonResponse(
        {
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Invalid admin resource.',
            requestId: context.requestId,
          },
        },
        400,
        context.requestId,
        noStore(),
      );
    }
    return ok(
      await synchronization.sync.run({
        season,
        trigger: 'manual-resource',
        forceJobs: [job],
      }),
      context.requestId,
    );
  }
  if (
    synchronization.mode === 'whole-season' &&
    url.pathname === '/internal/admin/rebuild/home'
  ) {
    return ok(
      await synchronization.sync.run({
        season,
        trigger: 'manual-home',
        forceJobs: ['home-rebuild'],
      }),
      context.requestId,
    );
  }
  if (url.pathname === '/internal/admin/rollback') {
    const body = await readJson(request);
    const version = typeof body.version === 'string' ? body.version : undefined;
    if (synchronization.mode === 'coordinated') {
      // OD-3: only under an operator hold, so drift cannot republish what
      // the rollback replaced. `mock` and `none` keep the path below.
      return handleCoordinatedRollback(season, version, context);
    }
    const result = await context.publisher.rollback(season, version);
    return ok(
      result,
      context.requestId,
      result.status === 'applied' ? 200 : 409,
    );
  }
  if (url.pathname === '/internal/admin/cache/purge') {
    // The publisher owns the active version's exact inventory and the public
    // route mapping, so an operator purge covers exactly what the active
    // release carries rather than a hand-maintained subset of it. It moves no
    // pointer and contains its own storage and purge failures.
    const result = await context.publisher.purgeActiveVersion(season);
    context.logger.info({
      operation: 'cache.purge',
      requestId: context.requestId,
      season,
      cacheOutcome: result.ok ? 'purged' : 'purge-failed',
      ...(result.reason === null ? {} : { failureCategory: result.reason }),
    });
    return ok(result, context.requestId, result.ok ? 200 : 207);
  }
  return jsonResponse(
    {
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested admin resource does not exist.',
        requestId: context.requestId,
      },
    },
    404,
    context.requestId,
    noStore(),
  );
}

async function resolveAdminSeason(
  request: Request,
  storage: SnapshotStorage,
): Promise<number> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get('season');
  if (fromQuery && /^\d{4}$/.test(fromQuery)) return Number(fromQuery);
  return (await storage.getCurrentSeason()) ?? 2026;
}

function allSyncJobs(): SyncJobCategory[] {
  return [
    'season-calendar',
    'event-schedule',
    'profiles',
    'standings',
    'results',
    'home-rebuild',
  ];
}

function jobForResource(value: string): SyncJobCategory | null {
  const map: Record<string, SyncJobCategory> = {
    calendar: 'season-calendar',
    schedule: 'event-schedule',
    profiles: 'profiles',
    standings: 'standings',
    results: 'results',
    home: 'home-rebuild',
  };
  return map[value] ?? null;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function ok(data: unknown, requestId: string, status = 200): Response {
  return jsonResponse({ data, requestId }, status, requestId, noStore());
}

function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store' };
}

function methodNotAllowed(requestId: string, allow: string): Response {
  return jsonResponse(
    {
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'The requested method is not allowed.',
        requestId,
      },
    },
    405,
    requestId,
    { ...noStore(), Allow: allow },
  );
}
