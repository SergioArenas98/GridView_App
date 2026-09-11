import {
  parseCutoverControl,
  type CutoverControl,
} from '../publication/cutover/control';

const validEnvironments = ['development', 'staging', 'production'] as const;
const validProviderModes = ['mock', 'none'] as const;

/**
 * Which authority decides `activeVersion`/`previousVersion` for a season
 * (ADR 0025 D6, D12).
 *
 * `legacy` - the existing Workers KV `active:{season}`/`previous:{season}`
 * pointers, written by `SnapshotPublisher` and read by the public router. This
 * is the default and the only value any deployed environment uses.
 *
 * `sequencer` - the two-phase `SeasonPublicationSequencer` protocol
 * (ADR 0025). Selecting it only makes the integrated path *constructible*; the
 * sequencer itself still refuses every mutator until a season's cutover has
 * reached `cutoverState: 'active'`, which no environment has performed. It
 * exists so the Integration path can be exercised end to end in tests.
 */
export type EnvironmentName = (typeof validEnvironments)[number];
export type ProviderMode = (typeof validProviderModes)[number];
export type PublicationAuthorityMode = 'legacy' | 'sequencer';

interface TestOnlyBindings {
  __LOCAL_STORAGE?: import('../storage/types').SnapshotStorage;
  __PROVIDER_RATE_LIMITER?: import('../providers/http/provider-rate-limiter').ProviderRateLimiterClient;
  __CLOCK?: import('../runtime/clock').Clock;
  __LOGGER?: import('../logging/logger').Logger;
  __PROVIDER?: import('../providers/formula-one-provider').FormulaOneProvider;
  __CACHE_PURGER?: import('../cache/purge').CachePurgeAdapter;
  __SNAPSHOT_VALIDATOR?: import('../validation/snapshot-validator').SnapshotValidator;
  /**
   * An in-process season publication sequencer port (ADR 0025). Test-only: the
   * Integration path is disabled by default and no environment provisions the
   * Durable Object, so this is how a test drives the two-phase protocol.
   */
  __SEASON_PUBLICATION_SEQUENCER?: import('../publication/sequencer/port').SeasonPublicationSequencerPort;
  /**
   * The bounded retry budget the cutover preparation service reads a
   * checkpoint-named release with. Test-only, so a test drives the exhaustion
   * path deterministically instead of waiting on the real backoff.
   */
  __CUTOVER_RETRY?: import('../publication/cutover/migration').CutoverRetryPolicy;
}

/** Bindings and variables available to the Worker. */
export interface Env extends TestOnlyBindings {
  ENVIRONMENT?: string;
  PROVIDER_MODE?: string;
  /**
   * Selects the season publication authority (ADR 0025). Only the exact string
   * `sequencer` selects the two-phase protocol; anything else - including an
   * absent, empty or misspelled value - resolves to `legacy`, and the resolver
   * never throws on it. No `wrangler.toml` variable sets this in any
   * environment; it exists for the Integration path's own tests.
   */
  SEASON_PUBLICATION_AUTHORITY?: string;
  /**
   * The one cutover control (ADR 0025 D12 step 1). **Unset in every committed
   * environment**, which disables every cutover operation and pauses no season.
   *
   * `seed:<season>` and `activate:<season>` each close that one season's legacy
   * mutation admission and permit exactly one of the two cutover operations. A
   * malformed non-empty value is a bounded `ConfigurationError`, never a silent
   * disable - see `publication/cutover/control.ts`.
   */
  SEASON_PUBLICATION_CUTOVER_CONTROL?: string;
  /**
   * Durable Object namespace backing the per-season publication sequencer
   * (ADR 0025 D1). Optional in the type because **no environment has one
   * provisioned**: `wrangler.toml` now *declares* the class export and a
   * `SEASON_PUBLICATION_SEQUENCER` binding for `env.staging` so a future,
   * separately authorized deployment can create it, but nothing has been
   * deployed and no namespace exists. Production declares no such binding at
   * all. Its absence is only reached when `SEASON_PUBLICATION_AUTHORITY` was
   * explicitly set to `sequencer`, and the resolver then fails closed to
   * `sequencer-unavailable` rather than falling back to the legacy authority.
   */
  SEASON_PUBLICATION_SEQUENCER?: DurableObjectNamespace;
  PUBLIC_BASE_URL?: string;
  ADMIN_TOKEN?: string;
  MOCK_PROVIDER_FAILURE?: string;
  MOCK_PROVIDER_INVALID_DATA?: string;
  MOCK_PROVIDER_SOURCE_UPDATED_AT?: string;
  MOCK_PROVIDER_CONTENT_VERSION?: string;
  GRIDVIEW_DATA?: KVNamespace;
  /**
   * Durable Object namespace backing the per-source provider reservation
   * coordinator (ADR 0021). Optional in the type because no environment has it
   * provisioned yet and nothing has been deployed; the resolver fails closed
   * when it is absent.
   */
  PROVIDER_RATE_LIMITER?: DurableObjectNamespace;
}

/**
 * Resolves the configured environment name.
 *
 * Unknown or missing values fall back to `development` so a misconfigured
 * deployment can never report itself as production.
 */
export function resolveEnvironment(value: string | undefined): EnvironmentName {
  if ((validEnvironments as readonly string[]).includes(value ?? '')) {
    return value as EnvironmentName;
  }
  console.warn(
    `Unknown ENVIRONMENT value "${value ?? ''}"; falling back to "development"`,
  );
  return 'development';
}

export interface RuntimeConfig {
  environment: EnvironmentName;
  providerMode: ProviderMode;
  publicationAuthorityMode: PublicationAuthorityMode;
  /**
   * Which season, if any, is closed to new legacy mutation admission while it
   * is being cut over, and which single cutover operation is permitted
   * (ADR 0025 D12). `disabled` in every committed environment.
   */
  publicationCutoverControl: CutoverControl;
  publicBaseUrl: string | null;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function resolveProviderMode(
  value: string | undefined,
  environment: EnvironmentName,
): ProviderMode {
  if (value === undefined) {
    if (environment === 'production') return 'none';
    if (environment === 'development') return 'mock';
    throw new ConfigurationError(
      'PROVIDER_MODE must be set explicitly for staging.',
    );
  }
  const mode = value;
  if (!(validProviderModes as readonly string[]).includes(mode)) {
    throw new ConfigurationError(`Unknown PROVIDER_MODE "${mode}".`);
  }
  if (environment === 'production' && mode === 'mock') {
    throw new ConfigurationError(
      'The mock provider cannot be selected in production.',
    );
  }
  return mode as ProviderMode;
}

/**
 * Resolves the publication authority mode.
 *
 * Fails safe rather than closed: only the exact string `sequencer` opts in, and
 * every other value - absent, empty, misspelled, wrong case - resolves to
 * `legacy` with no exception. A misconfiguration therefore keeps the existing
 * behaviour rather than breaking the Worker, which is the right direction for a
 * mode no deployed environment is meant to set.
 */
export function resolvePublicationAuthorityMode(
  value: string | undefined,
): PublicationAuthorityMode {
  return value === 'sequencer' ? 'sequencer' : 'legacy';
}

/**
 * Resolves the cutover control, failing closed on a malformed non-empty value.
 *
 * An operator who mistyped the control believes a season is paused. Resolving
 * that to `disabled` would leave the season openly mutable underneath them, so
 * it is a configuration failure instead - the same bounded one an unknown
 * `PROVIDER_MODE` produces, which the Worker maps to a 500 carrying no raw
 * value in either the response or the log line. The supplied value is
 * deliberately not echoed.
 */
export function resolvePublicationCutoverControl(
  value: string | undefined,
): CutoverControl {
  const control = parseCutoverControl(value);
  if (control === null) {
    throw new ConfigurationError(
      'SEASON_PUBLICATION_CUTOVER_CONTROL must be "seed:<supported season>" or "activate:<supported season>".',
    );
  }
  return control;
}

export function resolveRuntimeConfig(env: Env): RuntimeConfig {
  const environment = resolveEnvironment(env.ENVIRONMENT);
  return {
    environment,
    providerMode: resolveProviderMode(env.PROVIDER_MODE, environment),
    publicationAuthorityMode: resolvePublicationAuthorityMode(
      env.SEASON_PUBLICATION_AUTHORITY,
    ),
    publicationCutoverControl: resolvePublicationCutoverControl(
      env.SEASON_PUBLICATION_CUTOVER_CONTROL,
    ),
    publicBaseUrl: resolvePublicBaseUrl(env.PUBLIC_BASE_URL, environment),
  };
}

function resolvePublicBaseUrl(
  value: string | undefined,
  environment: EnvironmentName,
): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      throw new ConfigurationError('PUBLIC_BASE_URL must use https.');
    }
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new ConfigurationError(`Invalid PUBLIC_BASE_URL for ${environment}.`);
  }
}
