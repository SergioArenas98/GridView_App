/**
 * Sensitive-key redaction. Keys are compared lower-cased, so every entry must
 * be lower case: the camelCase `adminToken`, `providerKey` and `apiKey`
 * entries could never match and redacted nothing.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CapturingLogger,
  SENSITIVE_KEYS,
  consoleLogger,
  type LogEvent,
} from '../../src/logging/logger';

const secret = 'do-not-log-this-value';

/** Sensitive keys in every casing a caller might write. */
const sensitive: Record<string, string> = {
  adminToken: secret,
  ADMIN_TOKEN_UNUSED: 'not sensitive by name',
  AdminToken: secret,
  providerKey: secret,
  apiKey: secret,
  APIKEY: secret,
  Authorization: secret,
  token: secret,
  Secret: secret,
  password: secret,
};

function eventWith(fields: Record<string, unknown>): LogEvent {
  // The closed `LogEvent` has no such keys; the redaction is the backstop for
  // a value that reaches a log line anyway, so this bypasses the type.
  return { operation: 'probe', ...fields } as unknown as LogEvent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger redaction', () => {
  it('lists every sensitive key in lower case, so each can match', () => {
    expect(SENSITIVE_KEYS.size).toBeGreaterThan(0);
    for (const key of SENSITIVE_KEYS) {
      expect(key).toBe(key.toLowerCase());
    }
    for (const key of ['admintoken', 'providerkey', 'apikey']) {
      expect(SENSITIVE_KEYS.has(key), key).toBe(true);
    }
  });

  it('redacts camelCase and any other casing of a sensitive key', () => {
    const logger = new CapturingLogger();
    logger.warn(eventWith(sensitive));
    const line = JSON.parse(logger.serialized())[0] as Record<string, unknown>;

    for (const key of Object.keys(sensitive)) {
      if (key === 'ADMIN_TOKEN_UNUSED') continue;
      expect(line[key], key).toBe('[redacted]');
    }
    expect(line['ADMIN_TOKEN_UNUSED']).toBe('not sensitive by name');
    expect(JSON.stringify(line)).not.toContain(secret);
  });

  it('redacts nested keys, and writes nothing sensitive through the console logger', () => {
    const lines: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((line: string) => {
      lines.push(line);
    });

    consoleLogger.error(
      eventWith({ nested: { adminToken: secret, list: [{ apiKey: secret }] } }),
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(secret);
    expect(JSON.parse(lines[0] as string)).toMatchObject({
      operation: 'probe',
      level: 'error',
      nested: { adminToken: '[redacted]', list: [{ apiKey: '[redacted]' }] },
    });
  });

  it('leaves ordinary bounded fields untouched', () => {
    const logger = new CapturingLogger();
    logger.info({
      operation: 'sync.coordinated.withheld',
      season: 2026,
      coordinationMissingDependencies: ['ledger-unbound'],
      syncTrigger: 'manual',
    });
    expect(JSON.parse(logger.serialized())).toEqual([
      {
        operation: 'sync.coordinated.withheld',
        level: 'info',
        season: 2026,
        coordinationMissingDependencies: ['ledger-unbound'],
        syncTrigger: 'manual',
      },
    ]);
  });
});
