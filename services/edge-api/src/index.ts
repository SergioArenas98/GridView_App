import { isInternalPath } from './admin/auth';
import { handleAdminRequest } from './admin/router';
import {
  CloudflareCacheApiPurgeAdapter,
  getSharedMemoryPurger,
  type CachePurgeAdapter,
} from './cache/purge';
import {
  ConfigurationError,
  resolveRuntimeConfig,
  type Env,
  type RuntimeConfig,
} from './config/environment';
import { errorResponse } from './http/envelope';
import { consoleLogger } from './logging/logger';
import {
  resolvePublicationAuthority,
  type PublicationAuthority,
} from './publication/authority';
import {
  UnavailableSequencerPublicationCommands,
  type PublicationCommands,
} from './publication/commands';
import { CutoverPausedPublicationCommands } from './publication/cutover/admission';
import { CutoverPreparationService } from './publication/cutover/service';
import { SnapshotPublisher } from './publication/publisher';
import { SequencedPublicationService } from './publication/sequenced/service';
import { handlePublicRequest } from './public/router';
import { resolveProvider } from './providers/factory';
import { systemClock } from './runtime/clock';
import { handleStatus } from './routes/status';
import { resolveStorage } from './storage/factory';
import { SynchronizationService } from './sync/sync-service';
import { runtimeSnapshotValidator } from './validation/snapshot-validator';

export type { Env };

/**
 * Durable Object class registered as the `PROVIDER_RATE_LIMITER` binding
 * (ADR 0021). It must be a named export of the Worker's main module for
 * Wrangler to resolve `class_name`.
 *
 * Exporting it does not provision or start anything: no environment has the
 * namespace bound yet, no adapter calls the hardened HTTP boundary, and no
 * provider request is possible.
 */
export { ProviderRateLimiter } from './providers/http/provider-rate-limiter';

/**
 * Durable Object class registered as the `SEASON_PUBLICATION_SEQUENCER` binding
 * for `env.staging` only (ADR 0025 D1, D12). Wrangler resolves a Durable Object
 * class through a named export of the Worker's main module, so a future,
 * separately authorized staging deployment needs this export to exist.
 *
 * **Declared, not provisioned.** Exporting it creates no namespace, deploys
 * nothing, seeds no season and activates none. Production declares no such
 * binding at all, `SEASON_PUBLICATION_AUTHORITY` is unset in every committed
 * environment - so `resolvePublicationAuthority` returns `legacy` and no code
 * path performs the lookup - and `SEASON_PUBLICATION_CUTOVER_CONTROL` is unset
 * too, so no season is paused and no cutover operation is permitted.
 */
export { SeasonPublicationSequencer } from './publication/sequencer/durable-object';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = Date.now();
    const requestId =
      request.headers.get('X-Request-ID') ?? crypto.randomUUID();
    const url = new URL(request.url);
    const isHead = request.method === 'HEAD';
    const logger = env.__LOGGER ?? consoleLogger;
    const clock = env.__CLOCK ?? systemClock;

    let routeTemplate = 'unknown';
    let cacheOutcome = 'miss';

    try {
      const config = resolveRuntimeConfig(env);
      const storage = resolveStorage(env);
      const purger = resolveCachePurger(env, config);
      const provider = resolveProvider(env, config, clock);
      const authority = resolvePublicationAuthority(env, config);
      const validator = env.__SNAPSHOT_VALIDATOR ?? runtimeSnapshotValidator;
      const publisher = buildPublicationCommands(
        authority,
        config,
        storage,
        validator,
        purger,
        logger,
        clock,
        url.origin,
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
          purgeOrigin: url.origin,
          // Always constructed, and disabled by its own gate: with no cutover
          // control set it refuses every operation before reading anything.
          cutover: new CutoverPreparationService({
            config,
            authority,
            storage,
            validator,
            logger,
            clock,
            retry: env.__CUTOVER_RETRY,
          }),
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
        const result = await handlePublicRequest(
          request,
          storage,
          requestId,
          authority,
        );
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

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    context?: ExecutionContext,
  ): Promise<void> {
    const task = runScheduled(env);
    if (context) {
      context.waitUntil(task);
      return;
    }
    await task;
  },
} satisfies ExportedHandler<Env>;

async function runScheduled(env: Env): Promise<void> {
  const clock = env.__CLOCK ?? systemClock;
  const logger = env.__LOGGER ?? consoleLogger;
  try {
    const config = resolveRuntimeConfig(env);
    const storage = resolveStorage(env);
    const purger = resolveCachePurger(env, config);
    const provider = resolveProvider(env, config, clock);
    const publisher = buildPublicationCommands(
      resolvePublicationAuthority(env, config),
      config,
      storage,
      env.__SNAPSHOT_VALIDATOR ?? runtimeSnapshotValidator,
      purger,
      logger,
      clock,
      scheduledPurgeOrigin(config),
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
}

/**
 * The publication command surface for this request.
 *
 * The default (`authority.mode === 'legacy'`) returns the exact
 * `SnapshotPublisher` this Worker has always constructed, with no sequencer
 * port and no Durable Object lookup anywhere in its paths. Only an explicit
 * `SEASON_PUBLICATION_AUTHORITY=sequencer` with a reachable port wraps it in the
 * two-phase service, which itself still delegates back to this same
 * `SnapshotPublisher` for any season that is not `cutoverState: 'active'`
 * (ADR 0025 D12).
 *
 * That same explicit selection **without** a reachable port gets the bounded
 * unavailable surface instead. The legacy publisher is never constructed there:
 * an operator who selected the sequencer must not have their KV pointers
 * mutated by a deployment that lost the binding.
 *
 * Whatever surface results is finally wrapped by the **cutover admission
 * boundary** when `SEASON_PUBLICATION_CUTOVER_CONTROL` names a season
 * (ADR 0025 D12 step 1), so that season's publication and rollback are refused
 * before any publisher is reached. No committed environment sets it, so the
 * default build returns exactly what it returns today.
 */
function buildPublicationCommands(
  authority: PublicationAuthority,
  config: RuntimeConfig,
  storage: import('./storage/types').SnapshotStorage,
  validator: import('./validation/snapshot-validator').SnapshotValidator,
  purger: CachePurgeAdapter,
  logger: import('./logging/logger').Logger,
  clock: import('./runtime/clock').Clock,
  purgeOrigin: string,
): PublicationCommands {
  return closedForCutover(
    config,
    buildAuthorityCommands(
      authority,
      storage,
      validator,
      purger,
      logger,
      clock,
      purgeOrigin,
    ),
  );
}

/**
 * Closes new legacy mutation admission for the one season the cutover control
 * names, and for no other (ADR 0025 D12 step 1).
 *
 * The boundary is applied whenever a season is named - it never depends on the
 * authority mode or on a reachable sequencer port. A refusal mutates nothing,
 * and the unsafe direction here is the other one: an operator who believes a
 * season is paused must not find it openly mutable because some *other* setting
 * was also wrong.
 */
function closedForCutover(
  config: RuntimeConfig,
  commands: PublicationCommands,
): PublicationCommands {
  const control = config.publicationCutoverControl;
  if (control.kind === 'disabled') return commands;
  return new CutoverPausedPublicationCommands(commands, control.season);
}

function buildAuthorityCommands(
  authority: PublicationAuthority,
  storage: import('./storage/types').SnapshotStorage,
  validator: import('./validation/snapshot-validator').SnapshotValidator,
  purger: CachePurgeAdapter,
  logger: import('./logging/logger').Logger,
  clock: import('./runtime/clock').Clock,
  purgeOrigin: string,
): PublicationCommands {
  if (authority.mode === 'sequencer-unavailable') {
    return new UnavailableSequencerPublicationCommands();
  }
  const legacy = new SnapshotPublisher(
    storage,
    validator,
    purger,
    logger,
    purgeOrigin,
  );
  if (authority.mode !== 'sequencer') return legacy;
  return new SequencedPublicationService({
    port: authority.port,
    fallback: legacy,
    storage,
    validator,
    purger,
    logger,
    clock,
    purgeOrigin,
  });
}

function resolveCachePurger(
  env: Env,
  config: RuntimeConfig,
): CachePurgeAdapter {
  if (env.__CACHE_PURGER) return env.__CACHE_PURGER;
  if (config.environment === 'staging' || config.environment === 'production') {
    return new CloudflareCacheApiPurgeAdapter();
  }
  return getSharedMemoryPurger();
}

function scheduledPurgeOrigin(config: RuntimeConfig): string {
  if (config.publicBaseUrl) return config.publicBaseUrl;
  if (config.environment === 'staging' || config.environment === 'production') {
    throw new ConfigurationError(
      'PUBLIC_BASE_URL is required for scheduled publication cache deletion.',
    );
  }
  return 'https://api.gridview.local';
}
