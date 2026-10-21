/**
 * What a request's own log lines may carry (ADR 0028 D8, production logging
 * decision D-L).
 *
 * Production persists Workers Logs for the automatic path's observability,
 * with Cloudflare's invocation logs off, so the only persisted lines are the
 * Worker's own. Those must carry **no personal data and no credential**:
 *
 * - **Public routes** - the app's traffic - write nothing on success in
 *   production. A failure writes `request.failed` with its route template,
 *   status, duration and closed category, and **without** a request ID: the
 *   ID is returned to the client, which may keep it with a crash report, and
 *   a persisted line carrying it could then be linked to an installation.
 *   Every other environment keeps both lines unchanged.
 * - **Internal routes** - the operator's admin traffic, never an app user's -
 *   keep both lines everywhere: they describe the operator's own actions.
 *
 * Separately, a caller-supplied `X-Request-ID` is adopted only when it has
 * the shape of an opaque token, so a client can never place free text
 * (a name, an e-mail address, a credential) into a response or a log line
 * through it. Anything else is replaced by a generated UUID.
 */

import type { LogEvent } from './logger';

/**
 * An opaque token: 1-64 letters, digits and hyphens. A UUID and the app's
 * `gv-<hex>-<hex>` fit; an e-mail address, a name with spaces, a header value
 * with a colon or a line break do not.
 */
const OPAQUE_REQUEST_ID = /^[0-9A-Za-z-]{1,64}$/;

export function requestIdFor(
  header: string | null,
  generate: () => string,
): string {
  return header !== null && OPAQUE_REQUEST_ID.test(header)
    ? header
    : generate();
}

/**
 * `complete`: both request lines, with the request ID. `operational`: no
 * success line, and a failure line without the request ID.
 */
export type RequestLogScope = 'complete' | 'operational';

export function requestLogScope(
  environment: string | undefined,
  internalPath: boolean,
): RequestLogScope {
  return environment === 'production' && !internalPath
    ? 'operational'
    : 'complete';
}

/** The `request.completed` line for `scope`, or `null` when none is written. */
export function completedLine(
  scope: RequestLogScope,
  event: LogEvent,
): LogEvent | null {
  return scope === 'complete' ? event : null;
}

/** The `request.failed` line for `scope`: always written, ID only when complete. */
export function failedLine(scope: RequestLogScope, event: LogEvent): LogEvent {
  if (scope === 'complete') return event;
  const operational = { ...event };
  delete operational.requestId;
  return operational;
}
