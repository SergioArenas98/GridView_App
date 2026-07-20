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
  providerCallCount?: number;
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
