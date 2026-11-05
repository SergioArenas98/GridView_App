/**
 * The 429 diagnostic fields (PR #108 layer facts plus the 2026-11-05
 * fingerprint) against the structured-logging policy
 * (`docs/technical/GridView_Backend_Operations.md`, "Structured Logging"):
 * bounded fields only - closed enum members, integers, a well-formed ray, a
 * SHA-256 digest - and never a provider body, header value, credential,
 * internal KV key or address. The staging tail checker
 * (`scripts/staging-observability-check.mjs`) must find nothing in them.
 *
 * The refusal below is hostile on purpose: its body and headers carry every
 * kind of value the policy forbids, so a field that echoed provider bytes
 * would fail here.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../src/logging/logger.ts';
import { ProviderHttpClient } from '../../src/providers/http/provider-http-client.ts';
import {
  refusalHeaderFamilies,
  refusalHeaderMarks,
} from '../../src/providers/http/refusal-fingerprint.ts';
import { scanRedaction } from '../../scripts/staging-observability-check.mjs';

const hostileBody = [
  '<!DOCTYPE html><html><head><title>Bearer sk_live_0123456789abcdef</title></head><body>',
  'Your IP 203.0.113.77 / 2a06:98c0:3600::103 was blocked.',
  'snapshot:2026:home pointer:current providerMapping=x',
  'Authorization: Bearer abcdefghij0123456789',
  '</body></html>',
].join('\n');

const hostileHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  server: 'cloudflare',
  'cf-ray': 'a55adea84dba9d4b-DUB',
  'cf-cache-status': 'BYPASS',
  'set-cookie': 'session=Bearer-0123456789abcdef; Path=/',
  'x-amzn-requestid': 'Bearer 0123456789abcdefghij',
  'x-forwarded-for': '203.0.113.77',
  authorization: 'Bearer 0123456789abcdefghij',
};

/** Every key a 429 line may carry, and the shape its value must have. */
const allowed = {
  level: /^warn$/,
  operation: /^provider\.request\.rate_limited$/,
  providerSourceId: /^jolpica$/,
  providerRequestAttempted: 'boolean',
  status: 'integer',
  durationMs: 'integer',
  providerCacheStatus:
    /^(HIT|MISS|EXPIRED|STALE|BYPASS|REVALIDATED|UPDATING|DYNAMIC|NONE|absent|other)$/,
  providerEdgeColo: /^[A-Z]{3}$/,
  providerRay: /^[0-9a-f]{16}-[A-Z]{3}$/,
  providerRefusalLayer: /^(application|edge|unknown)$/,
  providerRefusalBody:
    /^(jolpica-throttled|jolpica-ratelimited|cloudflare-1015|cloudflare-other|empty|oversize|unreadable|other)$/,
  providerRetryAfterForm: /^(absent|delta|date|invalid)$/,
  providerServer: /^(cloudflare|other|absent)$/,
  providerBodyMedia: /^(json|problem-json|html|text|markdown|other|absent)$/,
  providerRefusalHeaderMarks: 'marks',
  providerRefusalOtherHeaders: 'integer',
  providerRefusalTitle:
    /^(absent|too-many-requests|rate-limited|access-denied|attention-required|just-a-moment|forbidden|service-unavailable|other)$/,
  providerRefusalBodyBytes: 'integer',
  providerRefusalBodySha256: /^[0-9a-f]{64}$/,
};

const markVocabulary = new Set([
  ...refusalHeaderMarks,
  ...refusalHeaderFamilies.map(([, mark]) => mark),
]);

async function refusedLine() {
  const logger = new CapturingLogger();
  const client = new ProviderHttpClient({
    transport: async () =>
      new Response(hostileBody, { status: 429, headers: hostileHeaders }),
    limiter: {
      async reserve(sourceId) {
        return { outcome: 'allowed', sourceId, headroom: [] };
      },
      async recordRateLimited() {},
    },
    logger,
    now: () => new Date('2026-11-05T12:00:00.000Z'),
  });
  const result = await client.getJson({
    sourceId: 'jolpica',
    path: '/ergast/f1/2026/races/',
    query: { limit: 100 },
  });
  const line = logger.events.find(
    (event) => event.operation === 'provider.request.rate_limited',
  );
  return { line, result, logger };
}

describe('the 429 diagnostic fields follow the structured-logging policy', () => {
  it('carries only allow-listed keys with bounded values', async () => {
    const { line } = await refusedLine();
    expect(line).toBeDefined();
    for (const [key, value] of Object.entries(line)) {
      const rule = allowed[key];
      expect(rule, `unexpected key ${key}`).toBeDefined();
      if (rule === 'boolean') expect(typeof value, key).toBe('boolean');
      else if (rule === 'integer')
        expect(Number.isInteger(value), key).toBe(true);
      else if (rule === 'marks') {
        expect(typeof value, key).toBe('string');
        for (const mark of value.split(',')) {
          expect(markVocabulary.has(mark), mark).toBe(true);
        }
      } else expect(String(value), key).toMatch(rule);
    }
    // The fingerprint is present, so the check above really covered it.
    expect(line).toHaveProperty('providerRefusalBodySha256');
    // `authorization`, `x-forwarded-for` are counted, never named.
    expect(line.providerRefusalOtherHeaders).toBe(2);
    expect(line.providerRefusalTitle).toBe('other');
  });

  it('never echoes a provider value, credential, address or KV key, and the staging tail checker finds nothing', async () => {
    const { logger, result } = await refusedLine();
    const serialized = logger.serialized() + JSON.stringify(result);
    for (const forbidden of [
      'Bearer',
      'sk_live',
      '0123456789abcdef',
      '203.0.113.77',
      '2a06:98c0',
      'snapshot:',
      'pointer:',
      'providerMapping',
      'session=',
      'blocked',
    ]) {
      expect(serialized, forbidden).not.toContain(forbidden);
    }
    const scan = scanRedaction(
      JSON.parse(logger.serialized()),
      serialized,
      'staging-admin-token-value',
    );
    expect(scan.findings).toEqual([]);
  });
});
