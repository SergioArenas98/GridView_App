/**
 * Closed, bounded facts about which layer answered a provider request
 * (Cloudflare-to-Jolpica 429 investigation, 2026-11-05).
 *
 * Jolpica F1 is served through Cloudflare. A `429` can come from two layers,
 * and they leave different marks:
 *
 * - **Jolpica's application** (Django REST Framework throttles, 4/s and 500/h
 *   for anonymous callers, keyed on the client address): body
 *   `{"detail":"Request was throttled."}`, and **no** `Retry-After`, because
 *   its throttles return no wait. A `django-ratelimit` refusal answers
 *   `{"error":"ratelimited"}`.
 * - **Cloudflare's edge** (a rate limiting rule on Jolpica's zone): error
 *   1015. Since 2026-03-12 Cloudflare sends `Retry-After` on it and, for a
 *   client that asks for JSON (GridView does), an RFC 9457 body whose
 *   `error_code` is `1015`.
 *
 * Every function here maps provider bytes to a fixed vocabulary. None of them
 * returns, logs or echoes a provider string, so a hostile header or body can
 * never reach the logs.
 */

/** A 429 body is read only this far. Both known refusal bodies are far smaller. */
export const refusalBodyLimitBytes = 4096;

export type ProviderRefusalBody =
  /** DRF `Throttled`: Jolpica's application throttle. */
  | 'jolpica-throttled'
  /** `django-ratelimit`'s refusal view. */
  | 'jolpica-ratelimited'
  /** Cloudflare error 1015: a rate limiting rule at the edge. */
  | 'cloudflare-1015'
  /** Another Cloudflare-generated 1xxx error. */
  | 'cloudflare-other'
  | 'empty'
  /** Larger than `refusalBodyLimitBytes`; the rest was not read. */
  | 'oversize'
  /** The body could not be read (stream error, timeout, abort). */
  | 'unreadable'
  | 'other';

export type ProviderRefusalLayer = 'application' | 'edge' | 'unknown';

export type ProviderRetryAfterForm = 'absent' | 'delta' | 'date' | 'invalid';

const throttledDetail = /^Request was throttled\b/;
/** Cloudflare's text and HTML pages: `error code: 1015`, `Error 1015`. */
const cloudflareErrorCodeText = /\berror\s*(?:code:?\s*)?(1\d{3})\b/i;

function cloudflareClass(code: number): ProviderRefusalBody | null {
  if (!Number.isInteger(code) || code < 1000 || code > 1999) return null;
  return code === 1015 ? 'cloudflare-1015' : 'cloudflare-other';
}

function classifyJson(value: unknown): ProviderRefusalBody | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.detail === 'string' &&
    throttledDetail.test(record.detail)
  ) {
    return 'jolpica-throttled';
  }
  if (record.error === 'ratelimited') return 'jolpica-ratelimited';
  const code = record.error_code;
  if (typeof code === 'number') return cloudflareClass(code);
  if (typeof code === 'string' && /^\d{4}$/.test(code)) {
    return cloudflareClass(Number.parseInt(code, 10));
  }
  return null;
}

/**
 * Classifies a refusal body already read (at most `refusalBodyLimitBytes`).
 * `null` means it was larger than that.
 */
export function classifyRefusalBody(text: string | null): ProviderRefusalBody {
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

export function refusalLayerOf(
  body: ProviderRefusalBody,
): ProviderRefusalLayer {
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

/** Which form the raw `Retry-After` took. Its parsed instant is logged apart. */
export function retryAfterFormOf(value: string | null): ProviderRetryAfterForm {
  if (value === null) return 'absent';
  const trimmed = value.trim();
  if (trimmed === '') return 'invalid';
  if (/^\d+$/.test(trimmed)) return 'delta';
  return Number.isNaN(Date.parse(trimmed)) ? 'invalid' : 'date';
}

const cacheStatuses: ReadonlySet<string> = new Set([
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

/**
 * `cf-cache-status` from a closed set. A `HIT` never reached Jolpica's
 * application, so it consumed nothing of the application's limits.
 */
export function cacheStatusOf(value: string | null): string {
  if (value === null) return 'absent';
  const upper = value.trim().toUpperCase();
  return cacheStatuses.has(upper) ? upper : 'other';
}

const cfRayPattern = /^([0-9a-f]{16})-([A-Z]{3})$/;

/** The Cloudflare data centre that answered, from `cf-ray`. */
export function edgeColoOf(cfRay: string | null): string | undefined {
  return cfRay === null ? undefined : cfRayPattern.exec(cfRay.trim())?.[2];
}

/** `cf-ray` only when it has Cloudflare's exact shape, so Jolpica can look it up. */
export function rayOf(cfRay: string | null): string | undefined {
  if (cfRay === null) return undefined;
  const trimmed = cfRay.trim();
  return cfRayPattern.test(trimmed) ? trimmed : undefined;
}

export function serverClassOf(value: string | null): string {
  if (value === null) return 'absent';
  return value.trim().toLowerCase() === 'cloudflare' ? 'cloudflare' : 'other';
}

/** The media type of a refusal, from a closed set. */
export function bodyMediaOf(contentType: string | null): string {
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

/** Facts any answer carries: whether Cloudflare's cache served it, and where. */
export function edgeFactsOf(headers: Headers): {
  readonly providerCacheStatus: string;
  readonly providerEdgeColo?: string;
} {
  const colo = edgeColoOf(headers.get('cf-ray'));
  return {
    providerCacheStatus: cacheStatusOf(headers.get('cf-cache-status')),
    ...(colo ? { providerEdgeColo: colo } : {}),
  };
}

/** Everything logged about a 429, given the body text already read (or not). */
export function refusalFactsOf(
  headers: Headers,
  body: ProviderRefusalBody,
): Record<string, string> {
  const ray = rayOf(headers.get('cf-ray'));
  return {
    ...edgeFactsOf(headers),
    providerRefusalLayer: refusalLayerOf(body),
    providerRefusalBody: body,
    providerRetryAfterForm: retryAfterFormOf(headers.get('Retry-After')),
    providerServer: serverClassOf(headers.get('server')),
    providerBodyMedia: bodyMediaOf(headers.get('Content-Type')),
    ...(ray ? { providerRay: ray } : {}),
  };
}
