import { describe, expect, it } from 'vitest';

import {
  buildWranglerTailCommand,
  buildTailDiagnostic,
  childProcessError,
  createTailCollector,
  normalizeAndValidateBaseUrl,
  resolveWranglerEntrypoint,
  terminateChild,
  waitForExpectedOperations,
  waitForTailReadiness,
} from '../../scripts/staging-observability-check.mjs';

describe('staging observability command construction', () => {
  it('builds the Windows command by invoking the Wrangler JS entrypoint directly', () => {
    const command = buildWranglerTailCommand('win32');

    // The tail must NOT be launched through the cmd.exe .cmd wrapper: Node
    // re-escapes the pre-quoted cmd line with backslash-quotes that cmd.exe
    // cannot parse, which killed the tail within ~40ms and collapsed readiness.
    expect(command.category).toBe('wrangler-tail');
    expect(command.mode).toBe('direct-dist-cli');
    expect(command.entrypointName).toBe(
      'node_modules/wrangler/wrangler-dist/cli.js',
    );
    expect(command.command).toBe(process.execPath);
    expect(command.command.toLowerCase()).not.toContain('cmd.exe');
    expect(command.args[0]).toBe('--no-warnings');
    expect(command.args[1]).toBe(resolveWranglerEntrypoint());
    expect(command.args.slice(2)).toEqual([
      'tail',
      'gridview-api-staging',
      '--format',
      'json',
    ]);
    expect(command.args).not.toContain('--env');
    expect(command.args).not.toContain('/c');
    expect(JSON.stringify(command).toLowerCase()).not.toContain('wrangler.cmd');
    expect(JSON.stringify(command)).not.toContain('sampling-rate');
    expect(command.options.shell).toBe(false);
    expect(command.options.windowsHide).toBe(true);
  });

  it('builds the Unix command using the same local Wrangler entrypoint', () => {
    const command = buildWranglerTailCommand('linux');

    expect(command.category).toBe('wrangler-tail');
    expect(command.mode).toBe('direct-dist-cli');
    expect(command.entrypointName).toBe(
      'node_modules/wrangler/wrangler-dist/cli.js',
    );
    expect(command.command).toBe(process.execPath);
    expect(command.args[0]).toBe('--no-warnings');
    expect(command.args[1]).toBe(resolveWranglerEntrypoint());
    expect(command.args[1]).toMatch(/wrangler-dist[\\/]cli\.js$/);
    expect(command.args.slice(2)).toEqual([
      'tail',
      'gridview-api-staging',
      '--format',
      'json',
    ]);
    expect(command.options.shell).toBe(false);
    expect(command.options.windowsHide).toBe(false);
  });

  it('validates the staging base URL before the workflow starts', () => {
    expect(
      normalizeAndValidateBaseUrl(
        'https://gridview-api-staging.sejuma18.workers.dev/v1/status',
      ),
    ).toBe('https://gridview-api-staging.sejuma18.workers.dev');
    expect(() =>
      normalizeAndValidateBaseUrl(
        'http://gridview-api-staging.sejuma18.workers.dev',
      ),
    ).toThrow('https');
    expect(() => normalizeAndValidateBaseUrl('https://example.com')).toThrow(
      'gridview-api-staging.sejuma18.workers.dev',
    );
  });

  it('reports child process failures by command category only', () => {
    const error = childProcessError(
      'wrangler-tail',
      Object.assign(new Error('secret test-token Authorization header'), {
        code: 'EINVAL',
      }),
    );

    expect(error.message).toBe('wrangler-tail failed to start or run: EINVAL');
    expect(error.message).not.toContain('secret');
    expect(error.message).not.toContain('Authorization');
    expect(error.message).not.toContain('test-token');
  });

  it('does not pass the admin token environment variable to Wrangler tail', () => {
    const previous = process.env.GRIDVIEW_STAGING_ADMIN_TOKEN;
    process.env.GRIDVIEW_STAGING_ADMIN_TOKEN = 'token-not-for-wrangler';

    try {
      const command = buildWranglerTailCommand('linux');

      expect(command.options.env.GRIDVIEW_STAGING_ADMIN_TOKEN).toBeUndefined();
      expect(JSON.stringify(command)).not.toContain('token-not-for-wrangler');
    } finally {
      if (previous === undefined) {
        delete process.env.GRIDVIEW_STAGING_ADMIN_TOKEN;
      } else {
        process.env.GRIDVIEW_STAGING_ADMIN_TOKEN = previous;
      }
    }
  });
});

describe('staging observability tail parsing', () => {
  it('parses representative Wrangler JSON tail records with application logs', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      `${wranglerTailRecord([
        JSON.stringify({
          operation: 'request.completed',
          requestId: 'request-id-not-reported',
          status: 200,
        }),
      ])}\n`,
    );

    const diagnostic = buildTailDiagnostic(collector, 'admin-token');

    expect(diagnostic.tailOutputLinesReceived).toBe(1);
    expect(diagnostic.tailRecordsReceived).toBe(1);
    expect(diagnostic.tailRecordsParsedSuccessfully).toBe(1);
    expect(diagnostic.structuredApplicationLogEvents).toBe(1);
    expect(diagnostic.parserShapeMismatches).toBe(0);
    expect(diagnostic.observedOperationNames).toEqual(['request.completed']);
    expect(JSON.stringify(diagnostic)).not.toContain('request-id-not-reported');
  });

  it('parses pretty-printed Wrangler JSON tail records', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      `${JSON.stringify(
        JSON.parse(
          wranglerTailRecord([
            JSON.stringify({ operation: 'request.completed' }),
          ]),
        ),
        null,
        4,
      )}\n`,
    );

    const diagnostic = buildTailDiagnostic(collector, 'admin-token');

    expect(diagnostic.tailOutputLinesReceived).toBeGreaterThan(1);
    expect(diagnostic.tailRecordsReceived).toBe(1);
    expect(diagnostic.tailRecordsParsedSuccessfully).toBe(1);
    expect(diagnostic.tailRecordKinds).toEqual(['wrangler-tail-event']);
    expect(diagnostic.observedOperationNames).toEqual(['request.completed']);
  });

  it('reports zero-event diagnostics without inventing operations', () => {
    const diagnostic = buildTailDiagnostic(
      createTailCollector(),
      'admin-token',
    );

    expect(diagnostic.tailRecordsReceived).toBe(0);
    expect(diagnostic.tailRecordsParsedSuccessfully).toBe(0);
    expect(diagnostic.structuredApplicationLogEvents).toBe(0);
    expect(diagnostic.observedOperationNames).toEqual([]);
  });

  it('reports incomplete pretty JSON fragments without exposing line contents', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      [
        '{',
        '    "outcome": "ok",',
        '    "scriptName": "gridview-api-staging"',
        '',
      ].join('\n'),
    );

    const diagnostic = buildTailDiagnostic(collector, 'admin-token');

    expect(diagnostic.tailOutputLinesReceived).toBe(3);
    expect(diagnostic.tailRecordsReceived).toBe(0);
    expect(diagnostic.tailRecordsParsedSuccessfully).toBe(0);
    expect(diagnostic.tailIncompleteJsonFragment).toBe(true);
    expect(JSON.stringify(diagnostic)).not.toContain('gridview-api-staging');
  });

  it('distinguishes parser-shape mismatches from missing tail records', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      `${JSON.stringify({
        outcome: 'ok',
        eventTimestamp: '2026-07-20T20:30:00.000Z',
        logs: [{ level: 'log', message: ['plain log text'] }],
      })}\n`,
    );

    const diagnostic = buildTailDiagnostic(collector, 'admin-token');

    expect(diagnostic.tailRecordsReceived).toBe(1);
    expect(diagnostic.tailRecordsParsedSuccessfully).toBe(1);
    expect(diagnostic.structuredApplicationLogEvents).toBe(0);
    expect(diagnostic.parserShapeMismatches).toBe(1);
    expect(diagnostic.observedOperationNames).toEqual([]);
  });

  it('extracts operation names without retaining log payload contents', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      `${wranglerTailRecord([
        JSON.stringify({
          operation: 'sync.started',
          privatePayload: 'payload-not-reported',
        }),
      ])}\n`,
    );

    const diagnostic = buildTailDiagnostic(collector, 'admin-token');

    expect(diagnostic.observedOperationNames).toEqual(['sync.started']);
    expect(JSON.stringify(diagnostic)).not.toContain('payload-not-reported');
  });

  it('reports allowlisted Wrangler stderr summaries without raw output', () => {
    const collector = createTailCollector();
    collector.push(
      'stderr',
      'Required Worker name missing. Please specify the Worker name in wrangler.toml.\n',
    );

    const diagnostic = buildTailDiagnostic(collector, 'admin-token');

    expect(diagnostic.tailTextLineSummaries).toEqual([
      'stderr:required-worker-name-missing',
    ]);
    expect(JSON.stringify(diagnostic)).not.toContain('wrangler.toml');
  });

  it('reports invalid sampling-rate errors without raw stderr', () => {
    const collector = createTailCollector();
    collector.push(
      'stderr',
      'A sampling rate must be between 0 and 1 in order to have any effect.\n',
    );

    const diagnostic = buildTailDiagnostic(collector, 'admin-token');

    expect(diagnostic.tailTextLineSummaries).toEqual([
      'stderr:invalid-sampling-rate',
    ]);
    expect(JSON.stringify(diagnostic)).not.toContain('in order to have');
  });

  it('reports missing remote Worker errors without raw API output', () => {
    const collector = createTailCollector();
    collector.push(
      'stderr',
      'A request to the Cloudflare API (/accounts/account/workers/scripts/gridview-api-staging-staging/tails) failed. This Worker does not exist on your account. [code: 10007]\n',
    );

    const diagnostic = buildTailDiagnostic(collector, 'admin-token');

    expect(diagnostic.tailTextLineSummaries).toEqual([
      'stderr:tail-api-error',
      'stderr:worker-not-found',
    ]);
    expect(JSON.stringify(diagnostic)).not.toContain(
      'gridview-api-staging-staging',
    );
  });
});

describe('staging observability tail coordination', () => {
  it('waits for tail readiness before returning to drive traffic', async () => {
    const collector = createTailCollector();
    let probeCount = 0;

    const readiness = await waitForTailReadiness({
      base: 'https://gridview-api-staging.sejuma18.workers.dev',
      collector,
      token: 'admin-token',
      timeoutMs: 100,
      intervalMs: 1,
      probeFetch: async () => {
        probeCount += 1;
        if (probeCount === 2) {
          collector.push(
            'stdout',
            `${wranglerTailRecord([
              JSON.stringify({ operation: 'request.completed' }),
            ])}\n`,
          );
        }
        return { status: 200 };
      },
    });

    expect(readiness.confirmed).toBe(true);
    expect(probeCount).toBeGreaterThanOrEqual(2);
    expect(readiness.probeStatuses).toEqual([200, 200]);
  });

  it('stops readiness probes when the tail child exits early', async () => {
    const collector = createTailCollector();
    let probeCount = 0;
    let tailRunning = true;

    const readiness = await waitForTailReadiness({
      base: 'https://gridview-api-staging.sejuma18.workers.dev',
      collector,
      token: 'admin-token',
      timeoutMs: 100,
      intervalMs: 1,
      shouldContinue: () => tailRunning,
      probeFetch: async () => {
        probeCount += 1;
        tailRunning = false;
        return { status: 200 };
      },
    });

    expect(readiness.confirmed).toBe(false);
    expect(probeCount).toBe(1);
    expect(readiness.probeStatuses).toEqual([200]);
  });

  it('allows delayed event delivery during the bounded drain window', async () => {
    const collector = createTailCollector();
    setTimeout(() => {
      collector.push(
        'stdout',
        `${wranglerTailRecord([
          ...[
            'request.completed',
            'sync.started',
            'sync.completed',
            'publication.completed',
            'cache.purge',
            'rollback.completed',
          ].map((operation) => JSON.stringify({ operation })),
        ])}\n`,
      );
    }, 10);

    const drain = await waitForExpectedOperations({
      collector,
      token: 'admin-token',
      timeoutMs: 100,
      intervalMs: 1,
    });

    expect(drain.completed).toBe(true);
    expect(drain.tail.observedOperationNames).toEqual([
      'cache.purge',
      'publication.completed',
      'request.completed',
      'rollback.completed',
      'sync.completed',
      'sync.started',
    ]);
  });

  it('returns a timeout diagnostic when expected operations never arrive', async () => {
    const collector = createTailCollector();

    const drain = await waitForExpectedOperations({
      collector,
      token: 'admin-token',
      timeoutMs: 2,
      intervalMs: 1,
    });

    expect(drain.completed).toBe(false);
    expect(drain.tail.tailRecordsReceived).toBe(0);
    expect(drain.tail.observedOperationNames).toEqual([]);
  });

  it('terminates tail children during cleanup paths', () => {
    const child = {
      killed: false,
      kill() {
        this.killed = true;
      },
    };

    terminateChild(child);

    expect(child.killed).toBe(true);
  });
});

describe('staging observability redaction', () => {
  // A realistic-looking secret with digits so credential heuristics can match
  // it. It is only ever a test literal — never a real token.
  const ADMIN_TOKEN = 'stg_2f9c1e7b4a6d8f0c3b5e9a1d7c4f6e2b';
  const BEARER_VALUE = 'Bearer sk_live_9f8e7d6c5b4a3210';

  it('rejects the exact admin token value appearing in logs', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      `${tailRecordWith({
        logObjects: [{ operation: 'request.completed', note: ADMIN_TOKEN }],
      })}\n`,
    );

    const diagnostic = buildTailDiagnostic(collector, ADMIN_TOKEN);

    expect(diagnostic.redaction.containsAdminToken).toBe(true);
    expect(
      diagnostic.redactionFindings.some(
        (finding) => finding.category === 'admin-token-value',
      ),
    ).toBe(true);
  });

  it('rejects a Bearer credential value appearing in logs', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      `${tailRecordWith({
        logObjects: [{ operation: 'request.completed', sample: BEARER_VALUE }],
      })}\n`,
    );

    const diagnostic = buildTailDiagnostic(collector, 'unrelated-token');

    expect(diagnostic.redaction.containsBearerCredential).toBe(true);
    expect(diagnostic.redaction.containsAdminToken).toBe(false);
  });

  it('rejects an authorization field that carries a real credential value', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      `${tailRecordWith({ requestHeaders: { authorization: BEARER_VALUE } })}\n`,
    );

    const diagnostic = buildTailDiagnostic(collector, 'unrelated-token');

    expect(diagnostic.redaction.containsAuthorizationHeaderValue).toBe(true);
    const finding = diagnostic.redactionFindings.find(
      (entry) => entry.category === 'authorization-header-value',
    );
    expect(finding).toBeDefined();
    expect(finding.fieldPath).toMatch(/authorization/i);
  });

  it('accepts the bare word "unauthorized" as benign metadata', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      `${tailRecordWith({
        logObjects: [
          {
            operation: 'request.completed',
            status: 401,
            failureCategory: 'unauthorized',
          },
        ],
      })}\n`,
    );

    const diagnostic = buildTailDiagnostic(collector, 'admin-token');

    expect(Object.values(diagnostic.redaction).some(Boolean)).toBe(false);
    expect(diagnostic.redactionFindings).toEqual([]);
  });

  it('accepts an "authorization_failed" failure category', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      `${tailRecordWith({
        logObjects: [
          {
            operation: 'request.completed',
            failureCategory: 'authorization_failed',
            reason: 'missing_authorization',
          },
        ],
      })}\n`,
    );

    const diagnostic = buildTailDiagnostic(collector, 'admin-token');

    expect(Object.values(diagnostic.redaction).some(Boolean)).toBe(false);
  });

  it('accepts a 401 request-completed event with a redacted authorization header', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      `${tailRecordWith({
        requestHeaders: { authorization: '[redacted]' },
        logObjects: [{ operation: 'request.completed', status: 401 }],
      })}\n`,
    );

    const diagnostic = buildTailDiagnostic(collector, 'admin-token');

    expect(diagnostic.observedOperationNames).toEqual(['request.completed']);
    expect(Object.values(diagnostic.redaction).some(Boolean)).toBe(false);
  });

  it('accepts a redacted authorization field emitted by the logging policy', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      `${tailRecordWith({
        logObjects: [
          { operation: 'request.completed', authorization: '[redacted]' },
        ],
        requestHeaders: { authorization: '[redacted]' },
      })}\n`,
    );

    const diagnostic = buildTailDiagnostic(collector, 'admin-token');

    expect(diagnostic.redaction.containsAuthorizationHeaderValue).toBe(false);
    expect(diagnostic.redactionFindings).toEqual([]);
    expect(diagnostic.tailRecordsParsedSuccessfully).toBe(1);
  });

  it('never includes secret values in the sanitized diagnostic or failure output', () => {
    const collector = createTailCollector();
    collector.push(
      'stdout',
      `${tailRecordWith({
        logObjects: [{ operation: 'request.completed' }],
        requestHeaders: { authorization: `Bearer ${ADMIN_TOKEN}` },
      })}\n`,
    );

    const diagnostic = buildTailDiagnostic(collector, ADMIN_TOKEN);

    // The leak is detected...
    expect(Object.values(diagnostic.redaction).some(Boolean)).toBe(true);
    expect(diagnostic.redaction.containsAdminToken).toBe(true);
    expect(diagnostic.redaction.containsAuthorizationHeaderValue).toBe(true);

    // ...but nothing in the sanitized output echoes the secret value.
    expect(JSON.stringify(diagnostic)).not.toContain(ADMIN_TOKEN);
    const categories = [
      ...new Set(
        diagnostic.redactionFindings.map((finding) => finding.category),
      ),
    ].sort();
    const failureMessage = `Sensitive or unsafe content was found in the tailed logs: ${categories.join(
      ', ',
    )}`;
    expect(failureMessage).not.toContain(ADMIN_TOKEN);
    for (const finding of diagnostic.redactionFindings) {
      expect(JSON.stringify(finding)).not.toContain(ADMIN_TOKEN);
    }
  });
});

function tailRecordWith({ logObjects = [], requestHeaders } = {}) {
  const request = {
    method: 'GET',
    url: 'https://gridview-api-staging.sejuma18.workers.dev/v1/status',
  };
  if (requestHeaders) request.headers = requestHeaders;
  return JSON.stringify({
    outcome: 'ok',
    scriptName: 'gridview-api-staging',
    eventTimestamp: '2026-07-20T20:30:00.000Z',
    event: { request },
    logs: logObjects.map((logObject) => ({
      level: 'log',
      message: [
        typeof logObject === 'string' ? logObject : JSON.stringify(logObject),
      ],
      timestamp: 1784579400000,
    })),
    exceptions: [],
    diagnosticsChannelEvents: [],
  });
}

function wranglerTailRecord(messages) {
  return JSON.stringify({
    outcome: 'ok',
    scriptName: 'gridview-api-staging',
    eventTimestamp: '2026-07-20T20:30:00.000Z',
    event: {
      request: {
        method: 'GET',
        url: 'https://gridview-api-staging.sejuma18.workers.dev/v1/status',
      },
    },
    logs: messages.map((message) => ({
      level: 'log',
      message: [message],
      timestamp: 1784579400000,
    })),
    exceptions: [],
    diagnosticsChannelEvents: [],
  });
}
