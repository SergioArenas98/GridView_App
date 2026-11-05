/**
 * The GitHub runner's refusal facts (`scripts/jolpica-egress/refusal-facts.mjs`)
 * must be the staging Worker's (`refusal-evidence.ts`, `refusal-fingerprint.ts`)
 * byte for byte, or the 2026-11-05 comparison of the two clients compares two
 * different vocabularies. Every case here goes through both.
 */

import { describe, expect, it } from 'vitest';

import {
  classifyRefusalBody,
  refusalBodyLimitBytes,
  refusalFactsOf,
} from '../../src/providers/http/refusal-evidence.ts';
import {
  headerMarksOf,
  refusalFingerprintOf,
  refusalHeaderFamilies,
  refusalHeaderMarks,
  titleClassOf,
} from '../../src/providers/http/refusal-fingerprint.ts';
import * as mirror from '../../scripts/jolpica-egress/refusal-facts.mjs';

const encoder = new TextEncoder();

/** Each case: a refusal body and its headers. */
const cases = [
  {
    name: 'the 2026-11-05 shape: HTML, BYPASS, no Retry-After',
    body: '<!DOCTYPE html><html><head><title>429 Too Many Requests</title></head><body><h1>Too Many Requests</h1></body></html>',
    headers: {
      'content-type': 'text/html; charset=utf-8',
      server: 'cloudflare',
      'cf-ray': 'a55adea84dba9d4b-DUB',
      'cf-cache-status': 'BYPASS',
    },
  },
  {
    name: "Jolpica's DRF throttle",
    body: '{"detail":"Request was throttled."}',
    headers: {
      'content-type': 'application/json',
      server: 'cloudflare',
      'cf-ray': '0123456789abcdef-ATL',
      'cf-cache-status': 'DYNAMIC',
      vary: 'Accept, Cookie',
      allow: 'GET, HEAD, OPTIONS',
      'x-frame-options': 'DENY',
    },
  },
  {
    name: 'Cloudflare 1015 as JSON',
    body: JSON.stringify({ error_code: 1015, title: 'Error 1015' }),
    headers: {
      'content-type': 'application/problem+json',
      'retry-after': '10',
      server: 'cloudflare',
      'cf-ray': 'fedcba9876543210-LHR',
    },
  },
  {
    name: 'Cloudflare 1015 as text',
    body: 'error code: 1015',
    headers: {
      'content-type': 'text/plain',
      'retry-after': 'Thu, 05 Nov 2026 12:00:10 GMT',
    },
  },
  {
    name: 'a WAF-ish HTML page with AWS and unlisted headers',
    body: '<html><head><title>  Access   Denied </title></head></html>',
    headers: {
      'content-type': 'text/html',
      'x-amzn-requestid': 'abc',
      'x-amzn-waf-action': 'block',
      'x-amz-cf-pop': 'DUB56-P1',
      'x-amz-id-2': 'zzz',
      via: '1.1 something',
      'x-cache': 'Error from cloudfront',
      'x-something-new': '1',
      'x-another': '2',
      'cf-mitigated': 'challenge',
    },
  },
  { name: 'empty', body: '', headers: {} },
  {
    name: 'whitespace',
    body: '   \n',
    headers: { 'content-type': 'weird/type' },
  },
  {
    name: 'a title with no class',
    body: '<title>Welcome</title>',
    headers: { 'retry-after': '' },
  },
  { name: 'django-ratelimit', body: '{"error":"ratelimited"}', headers: {} },
  {
    name: 'non-ASCII bytes',
    body: '<title>Trop de requêtes – 429</title>',
    headers: {},
  },
];

async function both(entry, bytes) {
  const workerHeaders = new Headers(entry.headers);
  const mirrorHeaders = new Headers(entry.headers);
  const text = bytes === null ? null : new TextDecoder().decode(bytes);
  const workerBody = classifyRefusalBody(text);
  return {
    worker: {
      body: workerBody,
      facts: refusalFactsOf(workerHeaders, workerBody),
      fingerprint: await refusalFingerprintOf(workerHeaders, bytes),
    },
    mirror: {
      body: mirror.classifyRefusalBody(text),
      facts: mirror.refusalFactsOf(
        mirrorHeaders,
        mirror.classifyRefusalBody(text),
      ),
      fingerprint: mirror.refusalFingerprintOf(mirrorHeaders, bytes),
    },
  };
}

describe('the runner and the Worker record a refusal identically', () => {
  it.each(cases)('$name', async (entry) => {
    const { worker, mirror: runner } = await both(
      entry,
      encoder.encode(entry.body),
    );
    expect(runner).toEqual(worker);
  });

  it('agrees on an oversize body', async () => {
    const { worker, mirror: runner } = await both(cases[0], null);
    expect(worker.body).toBe('oversize');
    expect(runner).toEqual(worker);
  });

  it('shares one read limit, one header list and one family list', () => {
    expect(mirror.refusalBodyLimitBytes).toBe(refusalBodyLimitBytes);
    expect(mirror.refusalHeaderMarks).toEqual(refusalHeaderMarks);
    expect(mirror.refusalHeaderFamilies).toEqual(refusalHeaderFamilies);
  });

  it('the fingerprint of the 2026-11-05 shape is what the comparison reads', async () => {
    const entry = cases[0];
    const bytes = encoder.encode(entry.body);
    expect(
      await refusalFingerprintOf(new Headers(entry.headers), bytes),
    ).toEqual({
      headerMarks: ['cf-cache-status', 'cf-ray', 'content-type', 'server'],
      otherHeaders: 0,
      bodyBytes: bytes.byteLength,
      bodySha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      title: 'too-many-requests',
    });
  });

  it('records header names only by mark or family, never a value or an unlisted name', () => {
    const marks = headerMarksOf(new Headers(cases[4].headers));
    expect(marks).toEqual({
      headerMarks: [
        'cf-mitigated',
        'content-type',
        'via',
        'x-amz-*',
        'x-amz-cf-*',
        'x-amzn-*',
        'x-cache',
      ],
      otherHeaders: 2,
    });
    expect(JSON.stringify(marks)).not.toMatch(/block|DUB56|something|another/);
  });

  it('classifies titles into fixed labels', () => {
    expect(titleClassOf(null)).toBe('absent');
    expect(titleClassOf('<html></html>')).toBe('absent');
    expect(titleClassOf('<title> </title>')).toBe('absent');
    expect(titleClassOf('<TITLE>Rate Limited</TITLE>')).toBe('rate-limited');
    expect(
      titleClassOf('<title>Attention Required! | Cloudflare</title>'),
    ).toBe('attention-required');
    expect(titleClassOf('<title>Just a moment...</title>')).toBe(
      'just-a-moment',
    );
    expect(titleClassOf('<title>403 Forbidden</title>')).toBe('forbidden');
    expect(titleClassOf('<title>503 Service Unavailable</title>')).toBe(
      'service-unavailable',
    );
    expect(titleClassOf('<title>Welcome</title>')).toBe('other');
  });
});
