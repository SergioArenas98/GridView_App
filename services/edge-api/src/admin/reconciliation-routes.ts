/**
 * The authenticated reconciliation operator routes (PR-E2; operator
 * disposition decision pack A1-A5, OD-1 to OD-8).
 *
 * ```
 * GET  /internal/admin/reconciliation?season=YYYY
 * POST /internal/admin/reconciliation/hold
 * POST /internal/admin/reconciliation/release-hold
 * POST /internal/admin/reconciliation/clear-block
 * POST /internal/admin/reconciliation/disposition
 * ```
 *
 * Plus, in coordinated mode only, the hold-gated `POST /internal/admin/rollback`
 * (`handleCoordinatedRollback`).
 *
 * All sit under `/internal/admin/`, so `handleAdminRequest` has enforced
 * `ADMIN_TOKEN` before any is reached. None is in the public OpenAPI
 * document, and every response is `Cache-Control: no-store`.
 *
 * Each request is checked in a fixed order, and a refusal at one step reaches
 * nothing after it: the method, then the complete request (closed keys and
 * bounded values), then availability - `PROVIDER_MODE = coordinated` and a
 * resolved ledger - and only then the ledger. The season always comes from
 * the request, never from `meta:current-season`.
 *
 * `resolveReconciliationLedger` answers `null` in every environment, so every
 * deployed Worker answers each of these `503` `reconciliation-unavailable`
 * with `ledger-unbound`, having read nothing.
 *
 * Nothing here publishes, sends a provider request, writes Workers KV or
 * purges a cache - except the coordinated rollback, which is the existing
 * rollback, run only under an operator hold.
 */

import { jsonResponse } from '../http/envelope';
import type { Logger, LogEvent } from '../logging/logger';
import type { PublicationCommands } from '../publication/commands';
import type { Clock } from '../runtime/clock';
import type {
  LedgerSnapshot,
  SeasonOperatorAction,
} from '../sync/coordinated/ledger/model';
import type { ReconciliationLedgerPort } from '../sync/coordinated/ledger-port';
import {
  OPERATOR_AUTH_METHOD,
  disposeUnderLease,
  operateUnderLease,
  rollbackUnderHold,
  type OperatorActionResult,
} from '../sync/coordinated/operator';
import {
  decodeDisposition,
  decodeInspectionQuery,
  decodeSeasonAction,
  readOperatorBody,
  type OperatorRequestProblem,
} from './reconciliation-requests';
import {
  backlogView,
  inspectionView,
  roundView,
  seasonView,
} from './reconciliation-view';

export const reconciliationInspectPath = '/internal/admin/reconciliation';
export const reconciliationDispositionPath =
  '/internal/admin/reconciliation/disposition';

const seasonActionPaths: Readonly<Record<string, SeasonOperatorAction>> = {
  '/internal/admin/reconciliation/hold': 'hold',
  '/internal/admin/reconciliation/release-hold': 'release-hold',
  '/internal/admin/reconciliation/clear-block': 'clear-block',
};

export function isReconciliationPath(pathname: string): boolean {
  return (
    pathname === reconciliationInspectPath ||
    pathname === reconciliationDispositionPath ||
    Object.hasOwn(seasonActionPaths, pathname)
  );
}

export const RECONCILIATION_INSPECT_OPERATION = 'reconciliation.inspect';
export const RECONCILIATION_OPERATOR_OPERATION =
  'reconciliation.operator-action';

/** What the operator routes reach the ledger through. */
export interface OperatorReconciliation {
  /** Whether `PROVIDER_MODE` is `coordinated`. */
  readonly coordinated: boolean;
  /** The resolved ledger; `null` in every environment today. */
  readonly ledger: ReconciliationLedgerPort | null;
}

/** Why the operator surface is unavailable, in this order. Closed. */
export type ReconciliationUnavailableReason =
  'provider-mode-not-coordinated' | 'ledger-unbound';

export interface ReconciliationRouteContext {
  readonly reconciliation: OperatorReconciliation;
  readonly logger: Logger;
  readonly requestId: string;
}

export async function handleReconciliationRequest(
  request: Request,
  url: URL,
  context: ReconciliationRouteContext,
): Promise<Response> {
  const inspect = url.pathname === reconciliationInspectPath;
  const method = inspect ? 'GET' : 'POST';
  if (request.method !== method) {
    return methodNotAllowed(context.requestId, method);
  }
  if (inspect) return handleInspection(url, context);

  const body = await readOperatorBody(request);
  if (!body.ok) return invalidRequest(context.requestId, body.problem);
  const action = seasonActionPaths[url.pathname];
  if (action !== undefined) {
    const command = decodeSeasonAction(body.value, action);
    if (!command.ok) return invalidRequest(context.requestId, command.problem);
    const audit = {
      season: command.value.season,
      operatorAction: action,
      operationId: command.value.operationId,
    };
    const ledger = available(context, mutation(audit));
    if (ledger instanceof Response) return ledger;
    const result = await operateUnderLease(ledger, command.value);
    return answer(context, audit, result, (snapshot) => seasonView(snapshot));
  }

  const command = decodeDisposition(body.value);
  if (!command.ok) return invalidRequest(context.requestId, command.problem);
  const { season, round } = command.value;
  const audit = {
    season,
    round,
    operatorAction: command.value.action,
    operationId: command.value.operationId,
  };
  const ledger = available(context, mutation(audit));
  if (ledger instanceof Response) return ledger;
  const result = await disposeUnderLease(ledger, command.value);
  return answer(context, audit, result, (snapshot) => {
    const record = snapshot.classifications.find(
      (entry) => entry.record.round === round,
    );
    return {
      ...seasonView(snapshot),
      round: record === undefined ? null : roundView(record),
      backlog: backlogView(snapshot),
    };
  });
}

async function handleInspection(
  url: URL,
  context: ReconciliationRouteContext,
): Promise<Response> {
  const season = decodeInspectionQuery(url);
  if (!season.ok) return invalidRequest(context.requestId, season.problem);
  const ledger = available(context, {
    season: season.value,
    operatorAction: 'inspect',
  });
  if (ledger instanceof Response) return ledger;

  // Takes no lease and writes nothing.
  const read = await ledger.readSeason(season.value);
  const status =
    read.outcome === 'read'
      ? 'read'
      : read.outcome === 'rejected'
        ? 'refused'
        : 'ledger-unavailable';
  context.logger.info({
    operation: RECONCILIATION_INSPECT_OPERATION,
    requestId: context.requestId,
    season: season.value,
    operatorAction: 'inspect',
    operatorOutcome: status,
    ...(read.outcome === 'rejected' ? { ledgerRejection: read.reason } : {}),
  });
  if (read.outcome === 'read') {
    return data(context.requestId, 200, {
      status,
      ...inspectionView(read.snapshot),
    });
  }
  return data(
    context.requestId,
    read.outcome === 'rejected' ? 409 : 503,
    read.outcome === 'rejected' ? { status, reason: read.reason } : { status },
  );
}

/**
 * What a refusal's audit line names. A mutation carries its authentication
 * method and, when it has one, its operation ID, so a refused action can be
 * matched to the operator's private evidence. An inspection carries neither.
 */
interface RefusalAudit {
  readonly season: number;
  readonly round?: number;
  readonly operatorAction: string;
  readonly operationId?: string;
  readonly operatorAuthMethod?: typeof OPERATOR_AUTH_METHOD;
}

function mutation(audit: Omit<RefusalAudit, 'operatorAuthMethod'>) {
  return { ...audit, operatorAuthMethod: OPERATOR_AUTH_METHOD };
}

/**
 * The ledger, or the `503` that refuses before it is reached. Every missing
 * condition is reported, not only the first.
 */
function available(
  context: ReconciliationRouteContext,
  audit: RefusalAudit,
): ReconciliationLedgerPort | Response {
  const { coordinated, ledger } = context.reconciliation;
  const reasons: ReconciliationUnavailableReason[] = [];
  if (!coordinated) reasons.push('provider-mode-not-coordinated');
  if (ledger === null) reasons.push('ledger-unbound');
  if (reasons.length === 0 && ledger !== null) return ledger;
  context.logger.warn({
    operation: RECONCILIATION_OPERATOR_OPERATION,
    requestId: context.requestId,
    ...audit,
    operatorOutcome: 'reconciliation-unavailable',
    failureCategory: 'reconciliation-unavailable',
    coordinationMissingDependencies: reasons,
  });
  return data(context.requestId, 503, {
    status: 'reconciliation-unavailable',
    reasons,
  });
}

interface Audit {
  readonly season: number;
  readonly round?: number;
  readonly operatorAction: string;
  readonly operationId: string;
}

/** One audit line and one bounded answer per operator transition. */
function answer(
  context: ReconciliationRouteContext,
  audit: Audit,
  result: OperatorActionResult,
  view: (snapshot: LedgerSnapshot) => object,
): Response {
  const leaseRelease =
    'leaseRelease' in result && result.leaseRelease !== null
      ? result.leaseRelease
      : null;
  context.logger.warn({
    operation: RECONCILIATION_OPERATOR_OPERATION,
    requestId: context.requestId,
    ...audit,
    operatorAuthMethod: OPERATOR_AUTH_METHOD,
    operatorOutcome: result.status,
    ...(result.status === 'refused' ? { ledgerRejection: result.reason } : {}),
    ...(leaseRelease === null ? {} : { leaseRelease }),
  });
  const receipt = {
    status: result.status,
    action: audit.operatorAction,
    operationId: audit.operationId,
    season: audit.season,
    ...(audit.round === undefined ? {} : { round: audit.round }),
  };
  switch (result.status) {
    case 'applied':
    case 'already-applied':
      return data(context.requestId, 200, {
        ...receipt,
        state: view(result.snapshot),
        leaseRelease,
      });
    case 'run-in-progress':
      return data(context.requestId, 409, receipt);
    case 'refused':
      return data(context.requestId, 409, {
        ...receipt,
        reason: result.reason,
        leaseRelease,
      });
    case 'ledger-unavailable':
    case 'outcome-unknown':
      return data(context.requestId, 503, { ...receipt, leaseRelease });
  }
}

export interface CoordinatedRollbackContext extends ReconciliationRouteContext {
  readonly publisher: PublicationCommands;
  readonly clock: Clock;
}

/**
 * `POST /internal/admin/rollback` in coordinated mode (OD-3): the existing
 * rollback, run once and only while an operator holds the season, under the
 * season's lease. The D14/D15 guard applies unchanged, so a guard refusal is
 * the existing `409` with the hold kept. Without a resolved ledger the hold
 * cannot be verified, so the rollback is refused and the publisher is never
 * reached.
 */
export async function handleCoordinatedRollback(
  season: number,
  targetVersion: string | undefined,
  context: CoordinatedRollbackContext,
): Promise<Response> {
  const ledger = available(
    context,
    mutation({ season, operatorAction: 'rollback' }),
  );
  if (ledger instanceof Response) return ledger;
  const outcome = await rollbackUnderHold(
    targetVersion === undefined ? { season } : { season, targetVersion },
    {
      ledger,
      clock: context.clock,
      rollback: (target, version) =>
        context.publisher.rollback(target, version),
    },
  );
  const event: LogEvent = {
    operation: RECONCILIATION_OPERATOR_OPERATION,
    requestId: context.requestId,
    season,
    operatorAction: 'rollback',
    operatorAuthMethod: OPERATOR_AUTH_METHOD,
    operatorOutcome: outcome.status,
    ...(outcome.status === 'attempted' || outcome.status === 'lease-expired'
      ? { operatorHoldState: 'held' }
      : outcome.status === 'not-held'
        ? { operatorHoldState: 'not-held' }
        : {}),
    ...(outcome.status === 'attempted'
      ? { publicationStatus: outcome.result.status }
      : {}),
    ...(outcome.status === 'ledger-unavailable' &&
    outcome.ledgerRejection !== null
      ? { ledgerRejection: outcome.ledgerRejection }
      : {}),
    ...('leaseRelease' in outcome
      ? { leaseRelease: outcome.leaseRelease }
      : {}),
  };
  context.logger.warn(event);
  switch (outcome.status) {
    case 'attempted':
      // The existing answer, unchanged: the rollback's own result.
      return data(
        context.requestId,
        outcome.result.status === 'applied' ? 200 : 409,
        outcome.result,
      );
    case 'not-held':
      return data(context.requestId, 409, {
        status: 'publication-not-held',
        season,
        rollbackCalls: 0,
        leaseRelease: outcome.leaseRelease,
      });
    case 'lease-expired':
      return data(context.requestId, 409, {
        status: 'lease-expired',
        season,
        rollbackCalls: 0,
        leaseRelease: outcome.leaseRelease,
      });
    case 'run-in-progress':
      return data(context.requestId, 409, {
        status: 'run-in-progress',
        season,
        rollbackCalls: 0,
      });
    case 'ledger-unavailable':
      return data(context.requestId, 503, {
        status: 'ledger-unavailable',
        season,
        rollbackCalls: 0,
      });
  }
}

function data(requestId: string, status: number, body: unknown): Response {
  return jsonResponse({ data: body, requestId }, status, requestId, noStore());
}

function invalidRequest(
  requestId: string,
  problem: OperatorRequestProblem,
): Response {
  return jsonResponse(
    { error: { code: 'INVALID_PARAMETER', message: problem, requestId } },
    400,
    requestId,
    noStore(),
  );
}

function methodNotAllowed(requestId: string, allow: string): Response {
  return jsonResponse(
    {
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'The requested method is not allowed.',
        requestId,
      },
    },
    405,
    requestId,
    { ...noStore(), Allow: allow },
  );
}

function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store' };
}
