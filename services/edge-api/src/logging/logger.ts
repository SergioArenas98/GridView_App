export type LogLevel = 'info' | 'warn' | 'error';

/**
 * The closed vocabulary of structured log fields.
 *
 * Every member is a bounded value: a closed enum member, an integer, a boolean,
 * an already-validated instant, or a bounded map of those. There is
 * deliberately **no index signature**: an open `[key: string]: unknown` would
 * make the "no provider payload, response body, URL, header, storage key or
 * raw exception ever reaches a log line" rule a convention that every call site
 * has to remember, instead of one the compiler enforces. Adding a field is a
 * deliberate edit here, where its boundedness is documented alongside it.
 */
export interface LogEvent {
  level?: LogLevel;
  requestId?: string;
  operation: string;
  routeTemplate?: string;
  status?: number;
  durationMs?: number;
  season?: number;
  releaseVersion?: string;
  failureCategory?: string;
  cacheOutcome?: string;
  /** Lifetime attempts by the provider instance driving this operation. */
  providerCallCount?: number;
  /** Attempts made by this operation alone. */
  providerOperationCallCount?: number;
  /** Canonical internal source id. Bounded enum value, never a provider string. */
  providerSourceId?: string | null;
  /** Bounded `sourceId -> integer attempt total`. Never a provider response. */
  providerCallsBySource?: Record<string, number>;
  /** Whether a request actually left GridView for this event. */
  providerRequestAttempted?: boolean;
  /** Local pacing decision: when the limiter says capacity returns. */
  providerRetryAt?: string;
  /** Upstream 429 instruction, already parsed to an absolute UTC instant. */
  providerRetryAfter?: string;
  /** Comma-joined bounded window kinds (`second`, `minute`, `hour`). */
  providerLimitingWindow?: string;
  /** Bounded `window kind -> integer remaining`. Never a provider value. */
  providerWindowHeadroom?: Record<string, number>;
  /** Bounded declared role of a coordinated source: reconciled/provisional. */
  providerSourceRole?: string;
  /** Bounded coordinated resource kind. Never a resource payload. */
  coordinationResource?: string;
  /** Existing bounded synchronization job category. */
  jobCategory?: string;
  /** Bounded contribution or run status. */
  coordinationStatus?: string;
  /** Bounded selection or publication outcome. */
  coordinationOutcome?: string;
  /** Bounded resource kinds a publishable season was missing. */
  coordinationMissing?: string[];
  /**
   * Closed reasons a coordinated run could not start (`limiter-unbound`,
   * `authority-not-sequencer`, `purge-origin-missing`, `ledger-unbound`).
   */
  coordinationMissingDependencies?: string[];
  observationPlan?: string;
  observationStage?: string;
  ledgerRejection?: string;
  /**
   * How a coordinated publication run ended (`published`, `unchanged`,
   * `withheld`, `not-applied`) and its closed next-due decision
   * (`completed`, `retry`, `cadence`, `blocked`, `resolve`). With
   * `publicationStatus` and a closed `failureCategory` only; never a digest,
   * a revision or an instant.
   */
  publicationOutcome?: string;
  publicationNextDue?: string;
  /** A closed withholding cause or publication reason; never a value. */
  publicationReason?: string;
  /** A count per fixed reconciliation policy event category. */
  reconciliationEvents?: Record<string, number>;
  /** Bounded coordinated run trigger: `scheduled` or `manual`. */
  syncTrigger?: string;
  /** Integer counts for one coordination run. */
  coordinationPlanned?: number;
  coordinationSelected?: number;
  coordinationUnavailable?: number;
  coordinationNotAttempted?: number;
  /** Bounded entity kind of an unresolved identity: driver/constructor/circuit. */
  providerMappingEntity?: string;
  /** Bounded upstream field name the identity was keyed on. */
  providerMappingField?: string;
  /** Closed mapping-failure reason. Never a provider string. */
  providerMappingFailure?: string;
  /**
   * Closed sub-reason when a provider mapping key was malformed. Bounded enum
   * value; the malformed provider value itself is deliberately never logged.
   */
  providerMappingKeyProblem?: string;
  /**
   * The exact provider value of an unresolved identity, bounded by the curated
   * schema and truncated again before it is written. This is the one internal
   * diagnostic field a provider identifier may reach, and it exists so an
   * operator can find the entity to curate. It never enters a public response,
   * an OpenAPI example, a fixture, a published snapshot or a cache key.
   */
  providerMappingValue?: string;
  /** Bounded relation names a publishable season failed. Never an identifier. */
  coordinationRelations?: string[];
  /** Bounded internal document name. Never a document body. */
  documentName?: string;
  /** How many contract issues one document produced. */
  issueCount?: number;
  /** Bounded outcome of a post-commit previous-pointer maintenance write. */
  pointerMaintenance?: string;
  /** Bounded publication status: applied, skipped, rejected or failed. */
  publicationStatus?: string;
  /**
   * Bounded season cutover lifecycle value (ADR 0025 D12): `uninitialized`,
   * `seeded` or `active`. Never a fingerprint, a receipt or an operator input.
   */
  cutoverState?: string;
  /**
   * The closed operator action (`inspect`, `hold`, `release-hold`,
   * `clear-block`, a T12 disposition action, or `rollback`) and its closed
   * outcome (`read`, `applied`, `already-applied`, `refused`, ...).
   */
  operatorAction?: string;
  operatorOutcome?: string;
  /**
   * The client-generated lowercase UUID v4 naming one operator action,
   * validated before it is logged. It names the action, never a person.
   */
  operationId?: string;
  /** How the action was authenticated (`shared-admin-token`); never a token. */
  operatorAuthMethod?: string;
  /** Whether the season was held when a coordinated rollback was asked for. */
  operatorHoldState?: string;
  /** `released`, `refused` or `unavailable`. */
  leaseRelease?: string;
  /** A classification round, 1-100. */
  round?: number;
  /**
   * The closed attention conditions (`operator-hold`, `durable-block`,
   * `backlog-warning`, `backlog-full`), with the closed durable block reason
   * and the global review backlog count and capacity.
   */
  reconciliationAttention?: string[];
  durableBlockReason?: string;
  backlogCount?: number;
  backlogCapacity?: number;
  /**
   * An operator verification's closed transition (`candidate-observed`,
   * `check-failed`, ...), which revision it matched (`staged`, `accepted`,
   * `candidate`, `superseded`, `other`), and whether its OD-7 comparison was
   * shown (`compared`) or the closed reason it was not. Never a revision, a
   * driver ID, a field name or a count from the comparison.
   */
  verificationTransition?: string;
  verificationMatch?: string;
  verificationComparison?: string;
}

export interface Logger {
  info(event: LogEvent): void;
  warn(event: LogEvent): void;
  error(event: LogEvent): void;
}

/**
 * Keys redacted wherever they appear, compared against the **lower-cased**
 * key. Every entry must therefore be lower case itself: a camelCase entry
 * such as `adminToken` could never equal `key.toLowerCase()` and would never
 * match.
 */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'authorization',
  'admintoken',
  'token',
  'secret',
  'providerkey',
  'apikey',
  'password',
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase())
      ? '[redacted]'
      : redact(child);
  }
  return out;
}

function write(level: LogLevel, event: LogEvent): void {
  const safe = redact({ ...event, level });
  const line = JSON.stringify(safe);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const consoleLogger: Logger = {
  info: (event) => write('info', event),
  warn: (event) => write('warn', event),
  error: (event) => write('error', event),
};

export class CapturingLogger implements Logger {
  readonly events: LogEvent[] = [];

  info(event: LogEvent): void {
    this.events.push({ ...event, level: 'info' });
  }

  warn(event: LogEvent): void {
    this.events.push({ ...event, level: 'warn' });
  }

  error(event: LogEvent): void {
    this.events.push({ ...event, level: 'error' });
  }

  serialized(): string {
    return JSON.stringify(this.events.map((event) => redact(event)));
  }
}
