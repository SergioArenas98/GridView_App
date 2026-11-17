import { createHash } from 'node:crypto';
import { uuidPattern } from '../../src/admin/identity/guards.mjs';
export class OperatorError extends Error {}
export function localConfiguration(env) {
  let url;
  try {
    url = new URL(env.GRIDVIEW_IDENTITY_URL);
  } catch {
    throw new OperatorError(
      'Set GRIDVIEW_IDENTITY_URL to the approved HTTPS origin (or a loopback local test server).',
    );
  }
  if (
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      )) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new OperatorError(
      'GRIDVIEW_IDENTITY_URL must be an HTTPS origin without a path, query or credentials. HTTP is allowed only on loopback.',
    );
  const installation = env.GRIDVIEW_IDENTITY_INSTALLATION_ID;
  if (!uuidPattern.test(installation ?? ''))
    throw new OperatorError(
      'Set GRIDVIEW_IDENTITY_INSTALLATION_ID to the approved installation UUID.',
    );
  const token = env.GRIDVIEW_IDENTITY_TOKEN;
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token ?? ''))
    throw new OperatorError(
      'Load your individual credential into the process environment GRIDVIEW_IDENTITY_TOKEN. Never pass it as an argument or put it in review JSON.',
    );
  return { origin: url.origin, installation, token };
}
export function secretFilter(token) {
  const digest = createHash('sha256')
    .update(token ?? '')
    .digest('hex');
  return (text) =>
    String(text)
      .replaceAll(token || '\u0000', '[redacted]')
      .replaceAll(digest, '[redacted]');
}
export function identityClient(config, transport = fetch) {
  return async function call(path, body) {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('#'))
      throw new OperatorError('Invalid identity operation path.');
    let response;
    try {
      response = await transport(
        config.origin + '/internal/admin/identity' + path,
        {
          method: body ? 'POST' : 'GET',
          headers: {
            Authorization: 'Bearer ' + config.token,
            ...(body
              ? {
                  'Content-Type': 'application/json',
                  'Idempotency-Key': body.operationId,
                }
              : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new OperatorError(
        body
          ? 'Network response is uncertain. Do not create another operation ID. Inspect this operation receipt, then deliberately resend the identical file and operation ID if needed.'
          : 'Cannot reach the identity API. Check the approved URL and local server; no retry was made.',
      );
    }
    const cap = 2 * 1024 * 1024,
      reader = response.body?.getReader();
    if (!reader)
      throw new OperatorError(
        'The server returned an empty response. Inspect the receipt before retrying a mutation.',
      );
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > cap) throw Error();
        chunks.push(chunk.value);
      }
    } catch {
      await reader.cancel().catch(() => {});
      throw new OperatorError(
        'Response exceeded its limit or was interrupted. Inspect the operation receipt before retrying a mutation.',
      );
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    const text = new TextDecoder().decode(bytes);
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new OperatorError(
        'Server response was not valid JSON. Inspect the operation receipt before retrying a mutation.',
      );
    }
    if (!response.ok) {
      const code =
        value?.error?.code ??
        (value?.data?.valid === false ? 'CATALOG_INVALID' : value?.data?.code);
      const safe =
        typeof code === 'string' && /^[A-Z_]{1,80}$/.test(code)
          ? code
          : 'UNEXPECTED_RESPONSE';
      const hints = {
        UNAUTHORIZED: 'Credential is missing, expired, disabled or unknown.',
        ROLE_REQUIRED:
          'Use a separately authorized credential with the required role.',
        CANDIDATE_STALE:
          'Inspect the candidate again and review its new version.',
        EVIDENCE_CHANGED:
          'Inspect the evidence again and review the new evidence head.',
        CATALOG_HEAD_CONFLICT:
          'Inspect the current head. Prepare a newly reviewed request with a new operation ID.',
        IDEMPOTENCY_CONFLICT:
          'This operation ID already names different request bytes. Inspect its receipt; do not overwrite the old file.',
        CANONICAL_ID_RESERVED:
          'This canonical ID is already used or permanently reserved. Review another explicit ID; never reuse it.',
        VALIDATION_STALE:
          'Validate the exact proposal and inspect its report before activation.',
        ADMIN_RATE_LIMITED:
          'Wait for the Retry-After interval, then retry deliberately with the same request.',
        CATALOG_CAPACITY:
          'Stop new approvals and arrange capacity/export review.',
      };
      throw new OperatorError(
        safe +
          ': ' +
          (hints[safe] ??
            'Inspect the failed operation and its evidence before taking another action.') +
          (response.headers.get('Retry-After')
            ? ' Retry-After: ' +
              response.headers.get('Retry-After') +
              ' seconds.'
            : ''),
      );
    }
    if (
      !value ||
      typeof value !== 'object' ||
      Object.keys(value).sort().join() !== 'data,replayed,requestId' ||
      typeof value.requestId !== 'string' ||
      typeof value.replayed !== 'boolean'
    )
      throw new OperatorError(
        'The server response did not match the closed identity contract.',
      );
    if (
      value.data?.schemaVersion !== 1 ||
      value.data?.installationId !== config.installation
    )
      throw new OperatorError(
        'Server schema version or installation identity does not match the configured installation.',
      );
    return value;
  };
}
