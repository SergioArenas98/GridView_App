import type { CachePurgeAdapter } from '../cache/purge';
import { publicUrlsForDocuments } from '../cache/purge';
import type { Env } from '../config/environment';
import { jsonResponse } from '../http/envelope';
import type { Logger } from '../logging/logger';
import type { SnapshotPublisher } from '../publication/publisher';
import type { SynchronizationService } from '../sync/sync-service';
import { emptySyncState } from '../sync/sync-service';
import type { SnapshotStorage, SyncJobCategory } from '../storage/types';
import { adminAuthOk, unauthorized } from './auth';

interface AdminContext {
  env: Env;
  storage: SnapshotStorage;
  sync: SynchronizationService;
  publisher: SnapshotPublisher;
  purger: CachePurgeAdapter;
  logger: Logger;
  requestId: string;
  purgeOrigin: string;
}

export async function handleAdminRequest(
  request: Request,
  context: AdminContext,
): Promise<Response> {
  if (!adminAuthOk(request, context.env)) {
    return unauthorized(context.requestId);
  }

  const url = new URL(request.url);
  if (request.method === 'GET') {
    if (url.pathname === '/internal/admin/quota') {
      return jsonResponse(
        {
          data: await context.storage.getQuotaState(),
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
  if (url.pathname === '/internal/admin/sync/full') {
    const result = await context.sync.run({
      season,
      trigger: 'manual-full',
      forceJobs: allSyncJobs(),
    });
    return ok(result, context.requestId);
  }
  if (url.pathname === '/internal/admin/sync/resource') {
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
      await context.sync.run({
        season,
        trigger: 'manual-resource',
        forceJobs: [job],
      }),
      context.requestId,
    );
  }
  if (url.pathname === '/internal/admin/rebuild/home') {
    return ok(
      await context.sync.run({
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
    const result = await context.publisher.rollback(season, version);
    return ok(
      result,
      context.requestId,
      result.status === 'applied' ? 200 : 409,
    );
  }
  if (url.pathname === '/internal/admin/cache/purge') {
    const activeVersion = await context.storage.getActiveVersion(season);
    const calendar =
      activeVersion === null
        ? null
        : await context.storage.readVersionedDocument(
            season,
            activeVersion,
            'calendar',
          );
    const docs = ['bootstrap', 'home', 'calendar'] as const;
    const result = await context.purger.purgePublicUrls(
      publicUrlsForDocuments(context.purgeOrigin, season, [
        ...docs,
        ...(Array.isArray(calendar?.data)
          ? (calendar.data as Array<{ round: number }>).flatMap((event) => [
              `grand-prix:${event.round}` as const,
              `grand-prix:${event.round}:results` as const,
            ])
          : []),
      ]),
    );
    context.logger.info({
      operation: 'cache.purge',
      requestId: context.requestId,
      season,
      cacheOutcome: result.ok ? 'purged' : 'purge-failed',
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
