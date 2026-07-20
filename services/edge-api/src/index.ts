import { isInternalPath } from './admin/auth';
import { handleAdminRequest } from './admin/router';
import { getSharedMemoryPurger } from './cache/purge';
import {
  ConfigurationError,
  resolveRuntimeConfig,
  type Env,
} from './config/environment';
import { errorResponse } from './http/envelope';
import { consoleLogger } from './logging/logger';
import { SnapshotPublisher } from './publication/publisher';
import { handlePublicRequest } from './public/router';
import { resolveProvider } from './providers/factory';
import { systemClock } from './runtime/clock';
import { handleStatus } from './routes/status';
import { resolveStorage } from './storage/factory';
import { SynchronizationService } from './sync/sync-service';
import { runtimeSnapshotValidator } from './validation/snapshot-validator';

export type { Env };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = Date.now();
    const requestId =
      request.headers.get('X-Request-ID') ?? crypto.randomUUID();
    const url = new URL(request.url);
    const isHead = request.method === 'HEAD';
    const logger = env.__LOGGER ?? consoleLogger;
    const clock = env.__CLOCK ?? systemClock;
    const storage = resolveStorage(env);
    const purger = env.__CACHE_PURGER ?? getSharedMemoryPurger();

    let routeTemplate = 'unknown';
    let cacheOutcome = 'miss';

    try {
      const config = resolveRuntimeConfig(env);
      const provider = resolveProvider(env, config, clock);
      const publisher = new SnapshotPublisher(
        storage,
        env.__SNAPSHOT_VALIDATOR ?? runtimeSnapshotValidator,
        purger,
        logger,
      );
      const sync = new SynchronizationService(
        storage,
        provider,
        publisher,
        clock,
        logger,
      );

      let response: Response;
      if (isInternalPath(url.pathname)) {
        response = await handleAdminRequest(request, {
          env,
          storage,
          sync,
          publisher,
          purger,
          logger,
          requestId,
        });
        routeTemplate = url.pathname;
      } else if (request.method !== 'GET' && !isHead) {
        response = errorResponse(
          405,
          'METHOD_NOT_ALLOWED',
          'The requested method is not allowed.',
          false,
          requestId,
          { Allow: 'GET, HEAD' },
        );
        routeTemplate = url.pathname;
        cacheOutcome = 'error';
      } else if (url.pathname === '/v1/status') {
        response = await handleStatus(request, env, storage, clock, requestId);
        routeTemplate = '/v1/status';
        cacheOutcome = response.status === 304 ? 'not-modified' : 'hit';
      } else {
        const result = await handlePublicRequest(request, storage, requestId);
        response = result.response;
        routeTemplate = result.routeTemplate;
        cacheOutcome = result.cacheOutcome;
      }

      logger.info({
        operation: 'request.completed',
        requestId,
        routeTemplate,
        status: response.status,
        durationMs: Date.now() - startedAt,
        cacheOutcome,
      });
      return response;
    } catch (error) {
      const response = errorResponse(
        500,
        'INTERNAL_ERROR',
        error instanceof ConfigurationError
          ? 'The service is not correctly configured.'
          : 'An internal error occurred.',
        false,
        requestId,
      );
      logger.error({
        operation: 'request.failed',
        requestId,
        routeTemplate,
        status: response.status,
        durationMs: Date.now() - startedAt,
        failureCategory:
          error instanceof ConfigurationError ? 'configuration' : 'internal',
      });
      return isHead
        ? new Response(null, {
            status: response.status,
            headers: response.headers,
          })
        : response;
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const clock = env.__CLOCK ?? systemClock;
    const logger = env.__LOGGER ?? consoleLogger;
    const storage = resolveStorage(env);
    const purger = env.__CACHE_PURGER ?? getSharedMemoryPurger();
    try {
      const config = resolveRuntimeConfig(env);
      const provider = resolveProvider(env, config, clock);
      const publisher = new SnapshotPublisher(
        storage,
        env.__SNAPSHOT_VALIDATOR ?? runtimeSnapshotValidator,
        purger,
        logger,
      );
      const sync = new SynchronizationService(
        storage,
        provider,
        publisher,
        clock,
        logger,
      );
      const season = (await storage.getCurrentSeason()) ?? 2026;
      await sync.run({ season, trigger: 'scheduled' });
    } catch {
      logger.error({
        operation: 'scheduled.failed',
        failureCategory: 'scheduled-handler',
      });
    }
  },
} satisfies ExportedHandler<Env>;
