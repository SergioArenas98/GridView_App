import { operationFamily, uuidPattern } from './guards.mjs';
import type { IdentityStorage } from '../../identity/schema';
import type { CatalogOriginProof } from '../../identity/catalog/origin-proof';
import {
  IdentityAdminWorkflow,
  type AdminCommit,
  type AdminReceipt,
} from '../../identity/catalog/admin-workflow';
import { hashIdentityProjection } from '../../identity/discovery/keys';
import {
  authenticate,
  authenticatedAuthority,
  configured,
  credentials,
  type IdentityAdminEnvironment,
} from './auth';
import { mutationFor, queries, routeFor } from './requests';
import {
  AdminError,
  artifactLimit,
  errorFor,
  failure,
  reply,
} from './responses';
import { readIdentity } from './reads';
import { mutateIdentity } from './mutations';

/** Called only by the private catalog namespace, and independently verifies the
 * individual credential. No body/header actor metadata crosses this boundary. */
export async function serveIdentityAdmin(
  request: Request,
  env: IdentityAdminEnvironment,
  storage: IdentityStorage,
  syntheticTests = false,
  now: () => number = Date.now,
  originProof?: CatalogOriginProof,
): Promise<Response> {
  const forwardedId = request.headers.get('X-Identity-Request-Id');
  const requestId =
    forwardedId && uuidPattern.test(forwardedId)
      ? forwardedId
      : crypto.randomUUID();
  let workflow: IdentityAdminWorkflow | undefined;
  let context: AdminCommit | undefined;
  let principal: Awaited<ReturnType<typeof authenticate>> = null;
  try {
    if (!configured(env)) throw new AdminError(503, 'CATALOG_UNAVAILABLE');
    principal = await authenticate(request, env, now());
    if (!principal) throw new AdminError(401, 'UNAUTHORIZED');
    const url = new URL(request.url),
      route = routeFor(url.pathname, request.method),
      q = queries(url, route.operation);
    if (
      route.operation !== 'operations-detail' &&
      !principal.roles.includes(route.role) &&
      !(route.operation === 'abandon' && principal.roles.includes('activator'))
    )
      throw new AdminError(403, 'ROLE_REQUIRED');
    const { authority, capability } = authenticatedAuthority(
      principal,
      syntheticTests,
    );
    workflow = new IdentityAdminWorkflow(
      storage,
      env.IDENTITY_INSTALLATION_ID!,
      authority,
      now,
      originProof,
    );
    if (request.method === 'GET') {
      workflow.rate(principal, false);
      const data = {
        schemaVersion: 1,
        installationId: workflow.installation,
        ...((await readIdentity(
          workflow,
          route,
          q,
          principal,
          env.IDENTITY_ADMIN_MODE!,
        )) as Record<string, unknown>),
      };
      return reply(
        { data, requestId, replayed: false },
        200,
        {},
        ['export', 'revisions-detail'].includes(route.operation)
          ? artifactLimit
          : undefined,
      );
    }
    if (env.IDENTITY_ADMIN_MODE !== 'review')
      throw new AdminError(403, 'IDENTITY_WRITES_DISABLED');
    const mutation = await mutationFor(request, route);
    const token = request.headers.get('Authorization')!.slice(7);
    const digest = credentials(env.IDENTITY_REVIEWER_CREDENTIALS)!.find(
      (c) => c.credentialId === principal!.credentialId,
    )!.tokenSha256;
    const serialized = JSON.stringify(mutation);
    if (serialized.includes(token) || serialized.includes(digest))
      throw new AdminError(400, 'INVALID_REQUEST');
    if (mutation.installationId !== workflow.installation)
      throw new AdminError(409, 'INSTALLATION_MISMATCH');
    const hash = await hashIdentityProjection({
      path: url.pathname,
      request: mutation,
    });
    const previous = workflow.receiptFor(
      principal.principalId,
      operationFamily(route.operation),
      mutation.operationId,
    );
    workflow.rate(principal, !previous);
    if (previous) {
      if (previous.requestHash !== hash)
        throw new AdminError(409, 'IDEMPOTENCY_CONFLICT');
      return receiptReply(previous, requestId);
    }
    context = {
      request: mutation,
      family: operationFamily(route.operation),
      operation: route.operation,
      path: url.pathname,
      hash,
      decorate: () => {
        throw new AdminError(503, 'CATALOG_UNAVAILABLE');
      },
    };
    workflow.context = context;
    await mutateIdentity(
      workflow,
      route,
      mutation,
      principal,
      capability,
      syntheticTests,
    );
    const receipt = workflow.receiptFor(
      principal.principalId,
      operationFamily(route.operation),
      mutation.operationId,
    );
    if (!receipt) throw new AdminError(503, 'CATALOG_UNAVAILABLE');
    return receiptReply(receipt, requestId, !context.committedHere);
  } catch (error) {
    const safe = errorFor(error);
    // A concurrent identical call may have committed while this call awaited
    // hashing/validation. Recover its immutable HTTP receipt, never rerun it.
    if (workflow && context && principal) {
      const original = workflow.receiptFor(
        principal.principalId,
        context.family,
        context.request.operationId,
      );
      if (original?.requestHash === context.hash)
        return receiptReply(original, requestId);
    }
    if (workflow && context && principal) {
      try {
        await workflow.reject(principal, context, safe);
        const rejected = workflow.receiptFor(
          principal.principalId,
          context.family,
          context.request.operationId,
        );
        if (rejected?.requestHash === context.hash)
          return receiptReply(rejected, requestId, false);
      } catch {
        return failure(new AdminError(503, 'CATALOG_CAPACITY'), requestId);
      }
    }
    return failure(safe, requestId);
  }
}

function receiptReply(
  receipt: AdminReceipt,
  requestId: string,
  replayed = true,
): Response {
  const data = receipt.data as Record<string, unknown>;
  if (receipt.status >= 400) {
    const code =
      typeof data.code === 'string'
        ? data.code
        : data.valid === false
          ? 'CATALOG_INVALID'
          : 'INVALID_REQUEST';
    const fields = [
      'operationId',
      'auditEventSequence',
      'valid',
      'reportHash',
      'validatorVersion',
      'issues',
      'baseRevisionId',
      'currentActiveRevisionId',
      'currentActivationSequence',
    ];
    const details = Object.fromEntries(
      fields.filter((k) => Object.hasOwn(data, k)).map((k) => [k, data[k]]),
    );
    return reply(
      {
        error: {
          code,
          message: code.replaceAll('_', ' ').toLowerCase() + '.',
          requestId,
          ...(Object.hasOwn(data, 'operationId') ? { details } : {}),
        },
        ...(replayed ? { replayed: true } : {}),
      },
      receipt.status,
    );
  }
  return reply({ data: receipt.data, requestId, replayed }, receipt.status);
}
