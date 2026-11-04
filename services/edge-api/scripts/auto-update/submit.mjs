// Credentialed steps of the automatic season-batch path (PROOF OF CONCEPT, dormant).
//
// The only two calls that carry a GridView credential:
//   - GET  /internal/admin/publication/cutover/status  (which release is active)
//   - POST /internal/admin/season/ingest              (the guarded ingest)
// Both go only to an allow-listed staging origin. The token is passed in by
// the caller, is never returned, logged or placed in an error, and nothing is
// retried: the ingest's `expectedActiveVersion` CAS makes a lost answer safe to
// leave unresolved, and an unknown outcome stops automation for a human.

export const allowedOrigins = Object.freeze([
  'https://gridview-api-staging.sejuma18.workers.dev',
]);
export const cutoverStatusPath = '/internal/admin/publication/cutover/status';
export const ingestPath = '/internal/admin/season/ingest';
export const maxAnswerBytes = 64 * 1024;
export const ingestTimeoutMs = 120_000;
export const statusTimeoutMs = 15_000;

// The Worker validates the version itself; this only bounds what is echoed.
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function tokenUsable(token) {
  return (
    typeof token === 'string' &&
    token.length >= 32 &&
    token.length <= 512 &&
    /^[\x21-\x7e]+$/.test(token)
  );
}

async function boundedJson(response) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxAnswerBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function checkCall(origin, token) {
  if (!allowedOrigins.includes(origin)) return 'origin-not-allowed';
  if (!tokenUsable(token)) return 'token-unusable';
  return null;
}

/** The active release version, or a closed failure. One GET, no retry. */
export async function readActiveVersion({ transport, origin, token, season }) {
  const refusal = checkCall(origin, token);
  if (refusal !== null) return { ok: false, failure: refusal };
  let response;
  try {
    response = await transport(
      `${origin}${cutoverStatusPath}?season=${season}`,
      {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(statusTimeoutMs),
      },
    );
  } catch {
    return { ok: false, failure: 'network-or-timeout' };
  }
  const body = await boundedJson(response);
  if (response.status !== 200)
    return { ok: false, failure: 'status-refused', status: response.status };
  const data = body?.data;
  if (
    data?.state !== 'active' ||
    data?.authoritative !== true ||
    data?.admissionClosed !== false
  ) {
    return { ok: false, failure: 'season-not-open' };
  }
  if (
    typeof data.activeVersion !== 'string' ||
    !versionPattern.test(data.activeVersion)
  ) {
    return { ok: false, failure: 'version-malformed' };
  }
  return { ok: true, activeVersion: data.activeVersion };
}

/**
 * The single guarded ingest POST. Outcomes:
 * - `applied`: committed; the answer names the new version.
 * - `refused`: the Worker answered a closed refusal (4xx). Nothing committed.
 * - `ambiguous`: no answer, a 5xx, or an answer that cannot be read. It may or
 *   may not have committed; never retried.
 */
export async function submitIngest({ transport, origin, token, bodyText }) {
  const refusal = checkCall(origin, token);
  if (refusal !== null) return { outcome: 'refused-locally', reason: refusal };
  if (typeof bodyText !== 'string' || bodyText.length === 0) {
    return { outcome: 'refused-locally', reason: 'body-missing' };
  }
  let response;
  try {
    response = await transport(`${origin}${ingestPath}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: bodyText,
      signal: AbortSignal.timeout(ingestTimeoutMs),
    });
  } catch {
    return { outcome: 'ambiguous', reason: 'network-or-timeout' };
  }
  const body = await boundedJson(response);
  const { status } = response;
  if (status === 200) {
    const version = body?.data?.publication?.version;
    if (
      body?.data?.publication?.status === 'applied' &&
      typeof version === 'string' &&
      versionPattern.test(version)
    ) {
      return { outcome: 'applied', version };
    }
    return { outcome: 'ambiguous', reason: 'answer-unreadable', status };
  }
  if (status >= 400 && status < 500) {
    const stage =
      typeof body?.data?.stage === 'string'
        ? body.data.stage.slice(0, 32)
        : null;
    const reason =
      typeof body?.data?.reason === 'string'
        ? body.data.reason.slice(0, 64)
        : null;
    const publication =
      typeof body?.data?.publication?.status === 'string'
        ? body.data.publication.status.slice(0, 32)
        : null;
    return { outcome: 'refused', status, stage, reason, publication };
  }
  return { outcome: 'ambiguous', reason: 'server-error', status };
}
