/**
 * Operator recovery route (U11 G5): POST /internal/admin/recovery
 *
 * Reached only after the existing ADMIN_TOKEN check in the admin router.
 * Body: { store, command, season?, at?, bookmark?, expectedCurrentBookmark? }
 *   store: identity-catalog | reconciliation-ledger | publication-sequencer
 *
 * `bookmark` and `bookmark-for-time` only read a PITR bookmark. Scheduling a
 * restore and restarting an object change state, so they are refused unless
 * the deployment sets RECOVERY_RESTORE = "enabled" (no committed staging or
 * production configuration does). Each object is addressed by the exact name
 * the runtime uses, so a recovery can never target a different object.
 */
import type { Env } from '../config/environment';
import { RECONCILIATION_LEDGER_OBJECT_NAME } from '../sync/coordinated/ledger/model';
import {
  decodeRecoveryRequest,
  recoveryObjectPath,
  type RecoveryRequest,
} from '../recovery/pitr';

export const recoveryPath = '/internal/admin/recovery';
/** The Durable Object request URL (an object address, never an outbound origin). */
export const recoveryRequestUrl =
  'https://recovery-object' + recoveryObjectPath;
const stores = [
  'identity-catalog',
  'reconciliation-ledger',
  'publication-sequencer',
] as const;
type Store = (typeof stores)[number];
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface Namespace {
  idFromName(name: string): unknown;
  get(id: unknown): {
    fetch(url: string, init: RequestInit): Promise<Response>;
  };
}

function reply(body: unknown, status: number, requestId: string): Response {
  return new Response(
    JSON.stringify({ ...((body as object) ?? {}), requestId }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  );
}

/** The object a store's runtime uses, or null when it is not bound here. */
function target(
  env: Env,
  store: Store,
  season: unknown,
): { namespace: Namespace; name: string } | null {
  const bound = (n: unknown): n is Namespace =>
    !!n &&
    typeof (n as Namespace).idFromName === 'function' &&
    typeof (n as Namespace).get === 'function';
  if (store === 'identity-catalog') {
    const ns = env.IDENTITY_CATALOG as unknown;
    if (!bound(ns) || !uuid.test(env.IDENTITY_INSTALLATION_ID ?? ''))
      return null;
    return { namespace: ns, name: 'identity:' + env.IDENTITY_INSTALLATION_ID };
  }
  if (store === 'reconciliation-ledger') {
    const ns = env.RECONCILIATION_LEDGER as unknown;
    return bound(ns)
      ? { namespace: ns, name: RECONCILIATION_LEDGER_OBJECT_NAME }
      : null;
  }
  const ns = env.SEASON_PUBLICATION_SEQUENCER as unknown;
  if (!bound(ns) || !Number.isSafeInteger(season)) return null;
  const s = season as number;
  return s >= 1950 && s <= 2100 ? { namespace: ns, name: String(s) } : null;
}

export async function handleRecoveryRequest(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  if (request.method !== 'POST')
    return reply({ error: 'method-not-allowed' }, 405, requestId);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: 'invalid-request' }, 400, requestId);
  }
  const { store, season, ...rest } = body;
  if (!stores.includes(store as Store))
    return reply({ error: 'invalid-store' }, 400, requestId);
  if (
    store === 'publication-sequencer'
      ? season === undefined
      : season !== undefined
  )
    return reply({ error: 'invalid-request' }, 400, requestId);
  const command: RecoveryRequest | null = decodeRecoveryRequest(rest);
  if (!command) return reply({ error: 'invalid-request' }, 400, requestId);
  if (
    (command.command === 'schedule-restore' || command.command === 'restart') &&
    env.RECOVERY_RESTORE !== 'enabled'
  )
    return reply({ error: 'recovery-restore-disabled' }, 403, requestId);
  const object = target(env, store as Store, season);
  if (!object) return reply({ error: 'store-unbound' }, 503, requestId);
  const stub = object.namespace.get(object.namespace.idFromName(object.name));
  let response: Response;
  try {
    response = await stub.fetch(recoveryRequestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rest),
    });
  } catch {
    // A restart aborts the object, so its own response may never arrive.
    if (command.command === 'restart')
      return reply({ store, restarted: 'requested' }, 202, requestId);
    return reply({ error: 'recovery-unavailable' }, 503, requestId);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = { error: 'recovery-unavailable' };
  }
  return reply(
    { store, object: object.name, result: data },
    response.status,
    requestId,
  );
}
