// Closed facts about a Jolpica refusal, computed exactly as the staging Worker
// computes them, so a GitHub runner's answer and the Worker's answer to the
// same request compare field by field (Cloudflare-to-Jolpica comparison,
// 2026-11-05).
//
// This is a plain-JavaScript mirror of
//   src/providers/http/refusal-evidence.ts     (layer, body class, forms)
//   src/providers/http/refusal-fingerprint.ts  (header marks, body hash, title)
// because the workflow checks out only this directory and runs Node without a
// build. test/scripts/jolpica-refusal-facts-parity.test.mjs feeds the same
// responses to both and requires identical output.
//
// Every function maps provider bytes to a fixed vocabulary, a count, a length
// or a SHA-256. No header value, body text or address is ever returned.

import { createHash } from 'node:crypto';

/** A refusal body is read only this far, as in the Worker. */
export const refusalBodyLimitBytes = 4096;

const throttledDetail = /^Request was throttled\b/;
const cloudflareErrorCodeText = /\berror\s*(?:code:?\s*)?(1\d{3})\b/i;

function cloudflareClass(code) {
  if (!Number.isInteger(code) || code < 1000 || code > 1999) return null;
  return code === 1015 ? 'cloudflare-1015' : 'cloudflare-other';
}

function classifyJson(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  if (typeof value.detail === 'string' && throttledDetail.test(value.detail)) {
    return 'jolpica-throttled';
  }
  if (value.error === 'ratelimited') return 'jolpica-ratelimited';
  const code = value.error_code;
  if (typeof code === 'number') return cloudflareClass(code);
  if (typeof code === 'string' && /^\d{4}$/.test(code)) {
    return cloudflareClass(Number.parseInt(code, 10));
  }
  return null;
}

/** The Worker's closed body class; `null` text means larger than the limit. */
export function classifyRefusalBody(text) {
  if (text === null) return 'oversize';
  const trimmed = text.trim();
  if (trimmed === '') return 'empty';
  if (trimmed.startsWith('{')) {
    try {
      const fromJson = classifyJson(JSON.parse(trimmed));
      if (fromJson) return fromJson;
    } catch {
      // Not JSON after all; the text patterns below still apply.
    }
  }
  const match = cloudflareErrorCodeText.exec(trimmed);
  if (match?.[1]) {
    return cloudflareClass(Number.parseInt(match[1], 10)) ?? 'other';
  }
  return 'other';
}

export function refusalLayerOf(body) {
  switch (body) {
    case 'jolpica-throttled':
    case 'jolpica-ratelimited':
      return 'application';
    case 'cloudflare-1015':
    case 'cloudflare-other':
      return 'edge';
    default:
      return 'unknown';
  }
}

export function retryAfterFormOf(value) {
  if (value === null) return 'absent';
  const trimmed = value.trim();
  if (trimmed === '') return 'invalid';
  if (/^\d+$/.test(trimmed)) return 'delta';
  return Number.isNaN(Date.parse(trimmed)) ? 'invalid' : 'date';
}

const cacheStatuses = new Set([
  'HIT',
  'MISS',
  'EXPIRED',
  'STALE',
  'BYPASS',
  'REVALIDATED',
  'UPDATING',
  'DYNAMIC',
  'NONE',
]);

export function cacheStatusOf(value) {
  if (value === null) return 'absent';
  const upper = value.trim().toUpperCase();
  return cacheStatuses.has(upper) ? upper : 'other';
}

const cfRayPattern = /^([0-9a-f]{16})-([A-Z]{3})$/;

export function edgeColoOf(cfRay) {
  return cfRay === null ? undefined : cfRayPattern.exec(cfRay.trim())?.[2];
}

export function rayOf(cfRay) {
  if (cfRay === null) return undefined;
  const trimmed = cfRay.trim();
  return cfRayPattern.test(trimmed) ? trimmed : undefined;
}

export function serverClassOf(value) {
  if (value === null) return 'absent';
  return value.trim().toLowerCase() === 'cloudflare' ? 'cloudflare' : 'other';
}

export function bodyMediaOf(contentType) {
  if (contentType === null) return 'absent';
  const media = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  switch (media) {
    case 'application/json':
      return 'json';
    case 'application/problem+json':
      return 'problem-json';
    case 'text/html':
      return 'html';
    case 'text/plain':
      return 'text';
    case 'text/markdown':
      return 'markdown';
    default:
      return 'other';
  }
}

/** The Worker's `refusalFactsOf`: the same keys, the same values. */
export function refusalFactsOf(headers, body) {
  const colo = edgeColoOf(headers.get('cf-ray'));
  const ray = rayOf(headers.get('cf-ray'));
  return {
    providerCacheStatus: cacheStatusOf(headers.get('cf-cache-status')),
    ...(colo ? { providerEdgeColo: colo } : {}),
    providerRefusalLayer: refusalLayerOf(body),
    providerRefusalBody: body,
    providerRetryAfterForm: retryAfterFormOf(headers.get('Retry-After')),
    providerServer: serverClassOf(headers.get('server')),
    providerBodyMedia: bodyMediaOf(headers.get('Content-Type')),
    ...(ray ? { providerRay: ray } : {}),
  };
}

export const refusalHeaderMarks = [
  'age',
  'allow',
  'alt-svc',
  'cache-control',
  'cf-cache-status',
  'cf-mitigated',
  'cf-ray',
  'connection',
  'content-encoding',
  'content-language',
  'content-length',
  'content-security-policy',
  'content-type',
  'cross-origin-opener-policy',
  'date',
  'etag',
  'expires',
  'last-modified',
  'location',
  'nel',
  'ratelimit',
  'ratelimit-limit',
  'ratelimit-policy',
  'ratelimit-remaining',
  'ratelimit-reset',
  'referrer-policy',
  'report-to',
  'retry-after',
  'server',
  'server-timing',
  'set-cookie',
  'speculation-rules',
  'strict-transport-security',
  'transfer-encoding',
  'vary',
  'via',
  'x-cache',
  'x-content-type-options',
  'x-frame-options',
  'x-powered-by',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'x-request-id',
  'x-served-by',
];

export const refusalHeaderFamilies = [
  ['x-amz-cf-', 'x-amz-cf-*'],
  ['x-amzn-', 'x-amzn-*'],
  ['x-amz-', 'x-amz-*'],
  ['x-envoy-', 'x-envoy-*'],
  ['x-nginx-', 'x-nginx-*'],
];

const markSet = new Set(refusalHeaderMarks);

export function headerMarksOf(headers) {
  const marks = new Set();
  let otherHeaders = 0;
  for (const [rawName] of headers) {
    const name = rawName.toLowerCase();
    if (markSet.has(name)) {
      marks.add(name);
      continue;
    }
    const family = refusalHeaderFamilies.find(([prefix]) =>
      name.startsWith(prefix),
    );
    if (family) marks.add(family[1]);
    else otherHeaders += 1;
  }
  return { headerMarks: [...marks].sort(), otherHeaders };
}

const titlePattern = /<title[^>]*>([^<]{0,300})<\/title>/i;

export function titleClassOf(text) {
  if (text === null) return 'absent';
  const match = titlePattern.exec(text);
  if (!match) return 'absent';
  const title = (match[1] ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (title === '') return 'absent';
  if (/too many requests|\b429\b/.test(title)) return 'too-many-requests';
  if (/rate.?limit/.test(title)) return 'rate-limited';
  if (/access denied/.test(title)) return 'access-denied';
  if (/attention required/.test(title)) return 'attention-required';
  if (/just a moment/.test(title)) return 'just-a-moment';
  if (/forbidden|\b403\b/.test(title)) return 'forbidden';
  if (/service unavailable|\b503\b/.test(title)) return 'service-unavailable';
  return 'other';
}

/** `bytes` is `null` when the body was larger than `refusalBodyLimitBytes`. */
export function refusalFingerprintOf(headers, bytes) {
  const marks = headerMarksOf(headers);
  if (bytes === null) {
    return { ...marks, bodyBytes: null, bodySha256: null, title: 'absent' };
  }
  return {
    ...marks,
    bodyBytes: bytes.byteLength,
    bodySha256: createHash('sha256').update(bytes).digest('hex'),
    title: titleClassOf(new TextDecoder().decode(bytes)),
  };
}
