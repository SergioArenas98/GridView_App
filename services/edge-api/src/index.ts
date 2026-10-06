import { isInternalPath } from './admin/auth';
import { handleAdminRequest, type AdminSynchronization } from './admin/router';
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
  type GuardedPublicationCommands,
  type PublicationCommands,
} from './publication/commands';
import { CutoverPausedPublicationCommands } from './publication/cutover/admission';
import type { CutoverControl } from './publication/cutover/control';
import { CutoverPreparationService } from './publication/cutover/service';
import { SnapshotPublisher } from './publication/publisher';
import { SequencedPublicationService } from './publication/sequenced/service';
import { handlePublicRequest } from './public/router';
import { resolveProvider } from './providers/factory';
import {
  resolveProviderRateLimiter,
  unboundRateLimiter,
} from './providers/http/factory';
import { systemClock } from './runtime/clock';
import { handleStatus } from './routes/status';
import { resolveStorage } from './storage/factory';
import type { CoordinatedRuntimeDependencies } from './sync/coordinated/composition';
import { resolveReconciliationLedger } from './sync/coordinated/ledger-port';
import {
  runCoordinatedSync,
  type CoordinatedSyncDependencies,
} from './sync/coordinated/run';
import { SynchronizationService } from './sync/sync-service';
import { runtimeSnapshotValidator } from './validation/snapshot-validator';

export type { Env };

/**
 * Durable Object class registered as the `PROVIDER_RATE_LIMITER` binding
 * (ADR 0021). It must be a named export of the Worker's main module for
 * Wrangler to resolve `class_name`.
 *
 * Exporting it does not provision or start anything, and where a deployment has
 * bound the namespace nothing reserves through it. Only a composed coordinated
 * runtime reserves, and composition requires `PROVIDER_MODE=coordinated` plus
 * a bound reconciliation ledger, which no committed environment binds.
 * Provider requests are governed by that mode and those dependencies, not by
 * this export or its binding.
 */
export { ProviderRateLimiter } from './providers/http/provider-rate-limiter';

/**
 * Durable Object class registered as the `SEASON_PUBLICATION_SEQUENCER` binding
 * for `env.staging` only (ADR 0025 D1, D12). Wrangler resolves a Durable Object
 * class through a named export of the Worker's main module, so any deployment
 * that binds the namespace needs this export to exist.
 *
 * **Exported is not enabled.** Exporting it creates no namespace, deploys
 * nothing, seeds no season and activates none, and a provisioned namespace is
 * not an invoked object. Production declares no such binding at all, and
 * development and production leave `SEASON_PUBLICATION_AUTHORITY` unset - so
 * there `resolvePublicationAuthority` returns `legacy`, no code path performs
 * the lookup, and every cutover operation is refused at the authority-mode
 * gate. Only `env.staging` selects `sequencer`. Which environment has the
 * namespace provisioned, and which authority and cutover control are committed
 * and deployed where, is recorded in `docs/technical/GridView_Environments.md`.
 */
export { SeasonPublicationSequencer } from './publication/sequencer/durable-object';

/**
 * The global reconciliation ledger's Durable Object class (G9 storage
 * foundation, runtime activation decision O-6).
 *
 * **Exported is not registered, and registered would not be bound.** No
 * `[exports.ReconciliationLedger]` entry, migration or binding declares it in
 * any environment, and Wrangler provisions a Durable Object class only from
 * such a declaration, so this export creates no namespace. Its client is
 * constructed only for a bound `RECONCILIATION_LEDGER` namespace, which no
 * committed environment declares, so `resolveReconciliationLedger` answers
 * `null` and every coordinated run still stops at `ledger-unbound`.
 */
export { ReconciliationLedger } from './sync/coordinated/ledger/durable-object';

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
      const authority = resolvePublicationAuthority(env, config);
      const validator = env.__SNAPSHOT_VALIDATOR ?? runtimeSnapshotValidator;
      const { commands: publisher, guarded } = buildPublicationCommands(
        authority,
        config,
        storage,
        validator,
        purger,
        logger,
        clock,
        url.origin,
      );
      const synchronization: AdminSynchronization = coordinatedMode(config)
        ? {
            mode: 'coordinated',
            run: (season) =>
              runCoordinatedSync(
                { season, trigger: 'manual', ...runSignal(env) },
                coordinatedSyncDependencies(
                  env,
                  authority,
                  guarded,
                  url.origin,
                  storage,
                  logger,
                  clock,
                ),
              ),
          }
        : {
            mode: 'whole-season',
            sync: new SynchronizationService(
              storage,
              resolveProvider(env, config, clock),
              publisher,
              clock,
              logger,
            ),
          };

      let response: Response;
      if (isInternalPath(url.pathname)) {
        response = await handleAdminRequest(request, {
          env,
          storage,
          synchronization,
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
          authority,
          // The operator routes and the coordinated rollback (PR-E2), and
          // the verification (PR-E3), which composes the coordinated runtime
          // from the same gated dependencies as a run. Without a bound
          // `RECONCILIATION_LEDGER` - every committed environment - the
          // resolver answers `null`, so each refuses as `ledger-unbound`.
          reconciliation: {
            coordinated: coordinatedMode(config),
            ledger: resolveReconciliationLedger(env),
            verification: {
              dependencies: coordinatedDependencies(
                env,
                authority,
                guarded,
                url.origin,
                logger,
                clock,
              ),
              authority,
              storage,
            },
          },
          clock,
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
        response = await handleStatus(
          request,
          env,
          storage,
          clock,
          requestId,
          authority,
        );
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
    if (coordinatedMode(config)) {
      await runScheduledCoordinated(env, config, storage, clock, logger);
      return;
    }
    const purger = resolveCachePurger(env, config);
    const provider = resolveProvider(env, config, clock);
    const { commands: publisher } = buildPublicationCommands(
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
 * The single provider-mode check in front of every coordinated path. In
 * `mock` and `none` it is false, and neither the coordinated run nor its
 * composition is ever reached, so nothing coordinated is constructed.
 */
function coordinatedMode(config: RuntimeConfig): boolean {
  return config.providerMode === 'coordinated';
}

/**
 * The scheduled coordinated run. A missing `PUBLIC_BASE_URL` is not a
 * configuration error here: the run reports `purge-origin-missing` among its
 * bounded reasons instead, and no publication surface is built without it.
 */
async function runScheduledCoordinated(
  env: Env,
  config: RuntimeConfig,
  storage: import('./storage/types').SnapshotStorage,
  clock: import('./runtime/clock').Clock,
  logger: import('./logging/logger').Logger,
): Promise<void> {
  const authority = resolvePublicationAuthority(env, config);
  const purgeOrigin = config.publicBaseUrl;
  const guarded =
    purgeOrigin === null
      ? null
      : buildPublicationCommands(
          authority,
          config,
          storage,
          env.__SNAPSHOT_VALIDATOR ?? runtimeSnapshotValidator,
          resolveCachePurger(env, config),
          logger,
          clock,
          purgeOrigin,
        ).guarded;
  const season = (await storage.getCurrentSeason()) ?? 2026;
  await runCoordinatedSync(
    { season, trigger: 'scheduled', ...runSignal(env) },
    coordinatedSyncDependencies(
      env,
      authority,
      guarded,
      purgeOrigin,
      storage,
      logger,
      clock,
    ),
  );
}

/**
 * The facts the coordinated composition gates on. Resolving them constructs
 * no transport or port, performs no Durable Object lookup and makes no
 * request; a bound namespace yields only its client. The reconciliation
 * ledger is present only for a bound `RECONCILIATION_LEDGER` namespace, which
 * no committed environment declares, so there it is absent.
 *
 * `__PROVIDER_TRANSPORT` and `__PACER_SLEEP` are test hooks: with neither, a
 * composed runtime sends through the runtime `fetch` and paces with a timer.
 */
function coordinatedDependencies(
  env: Env,
  authority: PublicationAuthority,
  guarded: GuardedPublicationCommands | null,
  purgeOrigin: string | null,
  logger: import('./logging/logger').Logger,
  clock: import('./runtime/clock').Clock,
): CoordinatedRuntimeDependencies {
  const limiter = resolveProviderRateLimiter(env);
  return {
    limiter: limiter === unboundRateLimiter ? null : limiter,
    authorityMode: authority.mode,
    guarded,
    purgeOrigin,
    ledger: resolveReconciliationLedger(env),
    transport: env.__PROVIDER_TRANSPORT,
    sleep: env.__PACER_SLEEP,
    logger,
    clock,
  };
}

/**
 * What a coordinated run reads beyond the gated facts: the sequencer the
 * season's authority and active release are read from - present exactly when
 * the authority is a reachable sequencer - and the storage the release's
 * documents are read from. Resolving them constructs nothing either.
 */
function coordinatedSyncDependencies(
  env: Env,
  authority: PublicationAuthority,
  guarded: GuardedPublicationCommands | null,
  purgeOrigin: string | null,
  storage: import('./storage/types').SnapshotStorage,
  logger: import('./logging/logger').Logger,
  clock: import('./runtime/clock').Clock,
): CoordinatedSyncDependencies {
  return {
    ...coordinatedDependencies(
      env,
      authority,
      guarded,
      purgeOrigin,
      logger,
      clock,
    ),
    sequencer: authority.mode === 'sequencer' ? authority.port : null,
    storage,
    // A test hook, like `__PACER_SLEEP`: with none, the run budget times its
    // deadline with a timer, armed only once a run holds its lease.
    ...(env.__RUN_BUDGET_TIMER ? { budgetTimer: env.__RUN_BUDGET_TIMER } : {}),
  };
}

/**
 * A coordinated run's caller cancellation, from the `__COORDINATED_RUN_SIGNAL`
 * test hook only. A deployed Worker's one cancellation source is the run
 * budget the orchestration starts under the lease. The request's own signal
 * is deliberately never read (RB-8): a disconnect is never a cooperative
 * cancellation. The platform may still end the execution after one; that is
 * a hard stop, which the existing lease, `publishing` mark and sidecar
 * recovery cover.
 */
function runSignal(env: Env): { readonly signal?: AbortSignal } {
  return env.__COORDINATED_RUN_SIGNAL
    ? { signal: env.__COORDINATED_RUN_SIGNAL }
    : {};
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
 * When `SEASON_PUBLICATION_CUTOVER_CONTROL` names a season, the **cutover
 * admission boundary** (ADR 0025 D12) refuses that season's publication and
 * rollback before any publisher is reached. Where it sits depends on the phase:
 *
 * - `seed:` - and `activate:` under any authority other than a reachable
 *   sequencer - wraps the whole surface, so the season is refused
 *   unconditionally.
 * - `activate:` under a reachable sequencer puts the boundary in the sequenced
 *   service's **legacy fallback slot** instead. The service reads the season's
 *   durable authority once per command: only a positive `active`,
 *   authoritative answer runs the two-phase protocol; `uninitialized` and
 *   `seeded` fall through to the boundary and are refused; an unreadable or
 *   `unavailable` authority fails closed inside the service. Either way the
 *   controlled season never reaches `SnapshotPublisher`, so the activation
 *   request itself - not a further configuration change - is what resumes its
 *   mutators, and they resume through the sequencer only.
 *
 * Absent, the surface built above is returned unchanged. Which environment sets
 * the control, committed and deployed, is recorded in
 * `docs/technical/GridView_Environments.md`.
 *
 * `guarded` is the same `SequencedPublicationService` instance, exposed
 * through its guarded entry point, whenever the authority is a reachable
 * sequencer: in the `seed:` and `activate:` phases alike, and with no control
 * at all. It is `null` under every other authority. The guarded entry point
 * has no legacy fallback and refuses any season whose sequencer authority is
 * not `active`, so exposing it outside the cutover admission boundary admits
 * nothing that boundary refuses. Only the coordinated runtime reads it.
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
): PublicationSurface {
  const control = config.publicationCutoverControl;
  if (authority.mode === 'sequencer-unavailable') {
    return {
      commands: closedForCutover(
        control,
        new UnavailableSequencerPublicationCommands(),
      ),
      guarded: null,
    };
  }
  const legacy = new SnapshotPublisher(
    storage,
    validator,
    purger,
    logger,
    purgeOrigin,
  );
  if (authority.mode !== 'sequencer') {
    return { commands: closedForCutover(control, legacy), guarded: null };
  }
  const sequenced = (fallback: PublicationCommands) =>
    new SequencedPublicationService({
      port: authority.port,
      fallback,
      storage,
      validator,
      purger,
      logger,
      clock,
      purgeOrigin,
    });
  if (control.kind === 'activate') {
    const service = sequenced(
      new CutoverPausedPublicationCommands(legacy, control.season),
    );
    return { commands: service, guarded: service };
  }
  const service = sequenced(legacy);
  return { commands: closedForCutover(control, service), guarded: service };
}

interface PublicationSurface {
  readonly commands: PublicationCommands;
  readonly guarded: GuardedPublicationCommands | null;
}

/**
 * Closes new legacy mutation admission for the one season the cutover control
 * names, and for no other (ADR 0025 D12 step 1), around the whole surface.
 *
 * Applied whenever a season is named and the activate-phase sequencer path
 * above does not apply - it never depends on a reachable sequencer port. A
 * refusal mutates nothing, and the unsafe direction here is the other one: an
 * operator who believes a season is paused must not find it openly mutable
 * because some *other* setting was also wrong.
 */
function closedForCutover(
  control: CutoverControl,
  commands: PublicationCommands,
): PublicationCommands {
  if (control.kind === 'disabled') return commands;
  return new CutoverPausedPublicationCommands(commands, control.season);
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
