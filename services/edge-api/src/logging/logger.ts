export type LogLevel = 'info' | 'warn' | 'error';

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
  /** Bounded entity kind of an unresolved identity: driver/constructor/circuit. */
  providerMappingEntity?: string;
  /** Bounded upstream field name the identity was keyed on. */
  providerMappingField?: string;
  /** Closed mapping-failure reason. Never a provider string. */
  providerMappingFailure?: string;
  /**
   * The exact provider value of an unresolved identity, bounded by the curated
   * schema and truncated again before it is written. This is the one internal
   * diagnostic field a provider identifier may reach, and it exists so an
   * operator can find the entity to curate. It never enters a public response,
   * an OpenAPI example, a fixture, a published snapshot or a cache key.
   */
  providerMappingValue?: string;
  [key: string]: unknown;
}

export interface Logger {
  info(event: LogEvent): void;
  warn(event: LogEvent): void;
  error(event: LogEvent): void;
}

const SENSITIVE_KEYS = new Set([
  'authorization',
  'adminToken',
  'token',
  'secret',
  'providerKey',
  'apiKey',
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
