/**
 * A closed fingerprint of a provider `429` (Cloudflare-to-Jolpica comparison,
 * 2026-11-05, diagnostic D1).
 *
 * The staging Worker's 429 of 2026-11-05 was HTML, without `Retry-After`, and
 * neither Jolpica's DRF throttle (JSON) nor a standard Cloudflare 1xxx page.
 * Which layer wrote it is unknown. Two refusals - one to the Worker, one to a
 * GitHub runner - can be compared, and Jolpica can match one against its own
 * logs, from facts that never carry a provider string:
 *
 * - **header marks**: which response header *names* are present, out of a
 *   fixed list. A WAF, a load balancer or a proxy leaves names of its own
 *   (`x-amzn-*`, `via`, `x-cache`, `cf-mitigated`, ...). A name not on the
 *   list is only counted. No header value is ever read here.
 * - **body length and SHA-256** of the bytes read (at most
 *   `refusalBodyLimitBytes`). The hash identifies a template without
 *   revealing it; a body that embeds a per-request value (a ray id, a time)
 *   hashes differently every time, and the length still compares.
 * - **title class**: the HTML `<title>`, if any, mapped to a fixed label.
 *
 * `scripts/jolpica-egress/measure.mjs` computes the same fingerprint for the
 * GitHub runner; `test/scripts/jolpica-refusal-facts-parity.test.mjs`
 * holds the two to identical output.
 */

/** Header names recorded when present. Everything else is only counted. */
export const refusalHeaderMarks: readonly string[] = [
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

/**
 * Header-name families recorded as one mark each, checked in order. A name in
 * a family is recorded as the family, never as itself.
 */
export const refusalHeaderFamilies: readonly (readonly [string, string])[] = [
  ['x-amz-cf-', 'x-amz-cf-*'],
  ['x-amzn-', 'x-amzn-*'],
  ['x-amz-', 'x-amz-*'],
  ['x-envoy-', 'x-envoy-*'],
  ['x-nginx-', 'x-nginx-*'],
];

export type RefusalTitleClass =
  | 'absent'
  | 'too-many-requests'
  | 'rate-limited'
  | 'access-denied'
  | 'attention-required'
  | 'just-a-moment'
  | 'forbidden'
  | 'service-unavailable'
  | 'other';

export interface RefusalFingerprint {
  /** Sorted, unique marks from `refusalHeaderMarks` / `refusalHeaderFamilies`. */
  readonly headerMarks: readonly string[];
  /** Header names not on either list. Their names are not recorded. */
  readonly otherHeaders: number;
  /** Bytes read; `null` when the body was larger than the read limit. */
  readonly bodyBytes: number | null;
  /** Lower-case hex SHA-256 of the bytes read; `null` when oversize. */
  readonly bodySha256: string | null;
  readonly title: RefusalTitleClass;
}

const markSet: ReadonlySet<string> = new Set(refusalHeaderMarks);

/** The closed header facts. Never reads a header value. */
export function headerMarksOf(headers: Headers): {
  readonly headerMarks: readonly string[];
  readonly otherHeaders: number;
} {
  const marks = new Set<string>();
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

/** Maps an HTML `<title>` (from at most the bytes read) to a fixed label. */
export function titleClassOf(text: string | null): RefusalTitleClass {
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

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The fingerprint of a refusal whose body has already been read (at most the
 * read limit). `bytes` is `null` when the body was larger than that.
 */
export async function refusalFingerprintOf(
  headers: Headers,
  bytes: Uint8Array | null,
): Promise<RefusalFingerprint> {
  const marks = headerMarksOf(headers);
  if (bytes === null) {
    return { ...marks, bodyBytes: null, bodySha256: null, title: 'absent' };
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return {
    ...marks,
    bodyBytes: bytes.byteLength,
    bodySha256: hex(digest),
    title: titleClassOf(new TextDecoder().decode(bytes)),
  };
}

/** The fingerprint as flat log fields (`LogEvent`). */
export function refusalFingerprintFields(
  fingerprint: RefusalFingerprint,
): Record<string, string | number> {
  return {
    providerRefusalHeaderMarks: fingerprint.headerMarks.join(','),
    providerRefusalOtherHeaders: fingerprint.otherHeaders,
    providerRefusalTitle: fingerprint.title,
    ...(fingerprint.bodyBytes === null
      ? {}
      : { providerRefusalBodyBytes: fingerprint.bodyBytes }),
    ...(fingerprint.bodySha256 === null
      ? {}
      : { providerRefusalBodySha256: fingerprint.bodySha256 }),
  };
}
