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
 * POST /internal/admin/reconciliation/verification
 * GET  /internal/admin/reconciliation/verification-history?season=YYYY&round=N
 * POST /internal/admin/reconciliation/verification-rotation
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
 * `resolveReconciliationLedger` answers `null` wherever no
 * `RECONCILIATION_LEDGER` namespace is bound, and there each of these answers
 * `503` `reconciliation-unavailable` with `ledger-unbound`, having read
 * nothing. Binding availability is environment-specific (see
 * `docs/technical/GridView_Environments.md`). Where a namespace is bound but
 * the mode is `mock` or `none`, each refuses with
 * `provider-mode-not-coordinated` alone, again having read nothing.
 *
 * Nothing here publishes, sends a provider request, writes Workers KV or
 * purges a cache - except the coordinated rollback, which is the existing
 * rollback, run only under an operator hold, and the verification (PR-E3),
 * which sends one classification request through the composed coordinated
 * runtime and writes only the verified classification record. The
 * verification also needs that runtime to compose: without the limiter, the
 * sequencer authority or a purge origin it answers `503`
 * `coordinated-runtime-unavailable` before reading the ledger. The
 * verification history read and the rotation (PR-E4) reach no provider.
 */

import { jsonResponse } from '../http/envelope';
import type { Logger, LogEvent } from '../logging/logger';
import type { PublicationAuthority } from '../publication/authority';
import type { PublicationCommands } from '../publication/commands';
import type { Clock } from '../runtime/clock';
import type { SnapshotStorage } from '../storage/types';
import type { CoordinatedRuntimeDependencies } from '../sync/coordinated/composition';
import type {
  LedgerSnapshot,
  SeasonOperatorAction,
} from '../sync/coordinated/ledger/model';
import type { ReconciliationLedgerPort } from '../sync/coordinated/ledger-port';
import { verificationHistoryDigest } from '../sync/coordinated/ledger/verification';
import {
  OPERATOR_AUTH_METHOD,
  disposeUnderLease,
  operateUnderLease,
  rollbackUnderHold,
  rotateUnderLease,
  verifyUnderLease,
  type OperatorActionResult,
  type VerificationResult,
} from '../sync/coordinated/operator';
import {
  decodeDisposition,
  decodeHistoryQuery,
  decodeInspectionQuery,
  decodeSeasonAction,
  decodeVerification,
  decodeVerificationRotation,
  readOperatorBody,
  type OperatorRequestProblem,
} from './reconciliation-requests';
import {
  backlogView,
  inspectionView,
  rotationReceipt,
  roundView,
  seasonView,
  verificationHistoryView,
} from './reconciliation-view';

export const reconciliationInspectPath = '/internal/admin/reconciliation';
export const reconciliationDispositionPath =
  '/internal/admin/reconciliation/disposition';
export const reconciliationVerificationPath =
  '/internal/admin/reconciliation/verification';
export const reconciliationVerificationHistoryPath =
  '/internal/admin/reconciliation/verification-history';
export const reconciliationVerificationRotationPath =
  '/internal/admin/reconciliation/verification-rotation';

const seasonActionPaths: Readonly<Record<string, SeasonOperatorAction>> = {
  '/internal/admin/reconciliation/hold': 'hold',
  '/internal/admin/reconciliation/release-hold': 'release-hold',
  '/internal/admin/reconciliation/clear-block': 'clear-block',
};

export function isReconciliationPath(pathname: string): boolean {
  return (
    pathname === reconciliationInspectPath ||
    pathname === reconciliationDispositionPath ||
    pathname === reconciliationVerificationPath ||
    pathname === reconciliationVerificationHistoryPath ||
    pathname === reconciliationVerificationRotationPath ||
    Object.hasOwn(seasonActionPaths, pathname)
  );
}

export const RECONCILIATION_INSPECT_OPERATION = 'reconciliation.inspect';
export const RECONCILIATION_OPERATOR_OPERATION =
  'reconciliation.operator-action';
export const RECONCILIATION_VERIFICATION_OPERATION =
  'reconciliation.verification';
export const RECONCILIATION_ROTATION_OPERATION =
  'reconciliation.verification-rotation';

/** What the operator routes reach the ledger through. */
export interface OperatorReconciliation {
  /** Whether `PROVIDER_MODE` is `coordinated`. */
  readonly coordinated: boolean;
  /** The resolved ledger; `null` wherever no namespace is bound. */
  readonly ledger: ReconciliationLedgerPort | null;
  /** What a verification composes its one request from (PR-E3). */
  readonly verification: VerificationEnvironment;
}

/**
 * The coordinated runtime's gated dependencies - the same ones a coordinated
 * run composes from - with the publication authority and storage the
 * published comparison base is read from. Resolving them builds nothing.
 */
export interface VerificationEnvironment {
  readonly dependencies: CoordinatedRuntimeDependencies;
  readonly authority: PublicationAuthority;
  readonly storage: SnapshotStorage;
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
  const history = url.pathname === reconciliationVerificationHistoryPath;
  const inspect = url.pathname === reconciliationInspectPath;
  const method = inspect || history ? 'GET' : 'POST';
  if (request.method !== method) {
    return methodNotAllowed(context.requestId, method);
  }
  if (inspect) return handleInspection(url, context);
  if (history) return handleVerificationHistory(url, context);

  const body = await readOperatorBody(request);
  if (!body.ok) return invalidRequest(context.requestId, body.problem);
  if (url.pathname === reconciliationVerificationPath) {
    return handleVerification(body.value, context);
  }
  if (url.pathname === reconciliationVerificationRotationPath) {
    return handleVerificationRotation(body.value, context);
  }
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
 * `GET /internal/admin/reconciliation/verification-history?season=&round=`
 * (PR-E4): one round's whole verification history and its digest, read
 * without a lease and writing nothing. It is what an operator archives
 * privately before a rotation, and the only answer that carries the digest
 * a rotation must name. The audit line names the round and the outcome
 * only: never an entry, an operation ID, a revision or the digest.
 */
async function handleVerificationHistory(
  url: URL,
  context: ReconciliationRouteContext,
): Promise<Response> {
  const query = decodeHistoryQuery(url);
  if (!query.ok) return invalidRequest(context.requestId, query.problem);
  const { season, round } = query.value;
  const operatorAction = 'inspect-verification-history';
  const ledger = available(context, { season, round, operatorAction });
  if (ledger instanceof Response) return ledger;

  const read = await ledger.readSeason(season);
  const entry =
    read.outcome === 'read'
      ? (read.snapshot.classifications.find(
          (candidate) => candidate.record.round === round,
        ) ?? null)
      : null;
  const status =
    read.outcome === 'read'
      ? entry === null
        ? 'not-recorded'
        : 'read'
      : read.outcome === 'rejected'
        ? 'refused'
        : 'ledger-unavailable';
  context.logger.info({
    operation: RECONCILIATION_INSPECT_OPERATION,
    requestId: context.requestId,
    season,
    round,
    operatorAction,
    operatorOutcome: status,
    ...(read.outcome === 'rejected' ? { ledgerRejection: read.reason } : {}),
  });
  if (entry !== null) {
    return data(context.requestId, 200, {
      status,
      ...verificationHistoryView(
        entry,
        await verificationHistoryDigest(entry.record.verifications),
      ),
    });
  }
  if (read.outcome === 'read') {
    return data(context.requestId, 404, { status, season, round });
  }
  return data(
    context.requestId,
    read.outcome === 'rejected' ? 409 : 503,
    read.outcome === 'rejected' ? { status, reason: read.reason } : { status },
  );
}

/**
 * `POST /internal/admin/reconciliation/verification-rotation` (PR-E4): one
 * rotation of a round's full verification history into the next generation.
 * No runtime is composed and no provider can be reached. The ledger makes
 * every check in the rotation's one transaction: the lease, the generation,
 * the record version, the archived history's digest, the operator hold, the
 * review lock, a full history and a generation that can still be raised.
 *
 * The answer's receipt names both generations, the cleared count and the
 * digest, never the cleared entries: those were archived from the history
 * route before, so a lost answer loses no evidence. The audit line carries
 * counters and closed values only.
 */
async function handleVerificationRotation(
  body: unknown,
  context: ReconciliationRouteContext,
): Promise<Response> {
  const command = decodeVerificationRotation(body);
  if (!command.ok) return invalidRequest(context.requestId, command.problem);
  const { season, round, operationId } = command.value;
  const audit = {
    season,
    round,
    operatorAction: 'rotate-verifications',
    operationId,
  };
  const ledger = available(context, mutation(audit));
  if (ledger instanceof Response) return ledger;

  const result = await rotateUnderLease(ledger, command.value);
  const stored =
    'snapshot' in result
      ? result.snapshot.classifications.find(
          (entry) => entry.record.round === round,
        )
      : undefined;
  const receipt = stored === undefined ? null : rotationReceipt(stored.record);
  const leaseRelease =
    'leaseRelease' in result && result.leaseRelease !== null
      ? result.leaseRelease
      : null;
  context.logger.warn({
    operation: RECONCILIATION_ROTATION_OPERATION,
    requestId: context.requestId,
    ...audit,
    operatorAuthMethod: OPERATOR_AUTH_METHOD,
    operatorOutcome: result.status,
    ...(result.status === 'refused' ? { ledgerRejection: result.reason } : {}),
    ...(receipt === null
      ? {}
      : {
          verificationGenerationFrom: receipt.fromGeneration,
          verificationGenerationTo: receipt.toGeneration,
          verificationClearedCount: receipt.clearedCount,
        }),
    ...(leaseRelease === null ? {} : { leaseRelease }),
  });
  const answered = {
    status: result.status,
    action: audit.operatorAction,
    operationId,
    season,
    round,
  };
  switch (result.status) {
    case 'applied':
    case 'already-applied':
      return data(context.requestId, 200, {
        ...answered,
        receipt,
        state: {
          ...seasonView(result.snapshot),
          round: stored === undefined ? null : roundView(stored),
        },
        leaseRelease,
      });
    case 'run-in-progress':
      return data(context.requestId, 409, answered);
    case 'refused':
      return data(context.requestId, 409, {
        ...answered,
        reason: result.reason,
        leaseRelease,
      });
    case 'ledger-unavailable':
    case 'outcome-unknown':
      return data(context.requestId, 503, { ...answered, leaseRelease });
  }
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

/**
 * `POST /internal/admin/reconciliation/verification` (PR-E3): one operator
 * verification of one staged correction (T11-T11c), with the OD-7 comparison.
 *
 * Checked in order: the token (by the admin router), the method, the strict
 * body, `coordinated` mode and a resolved ledger, then the coordinated
 * runtime's own gate (`verifyUnderLease`) - all before the ledger is read or
 * anything could send a request. The audit line carries closed values only: never a revision,
 * a driver ID, a field name or a count from the comparison.
 */
async function handleVerification(
  body: unknown,
  context: ReconciliationRouteContext,
): Promise<Response> {
  const command = decodeVerification(body);
  if (!command.ok) return invalidRequest(context.requestId, command.problem);
  const { season, round, operationId } = command.value;
  const audit = { season, round, operatorAction: 'verify', operationId };
  const ledger = available(context, mutation(audit));
  if (ledger instanceof Response) return ledger;

  const environment = context.reconciliation.verification;
  const authority = environment.authority;
  const result = await verifyUnderLease(command.value, {
    runtime: { ...environment.dependencies, ledger },
    sequencer: authority.mode === 'sequencer' ? authority.port : null,
    storage: environment.storage,
  });
  logVerification(context, audit, result);
  return data(context.requestId, verificationStatus(result), {
    status: result.status,
    action: 'verify',
    operationId,
    season,
    round,
    providerRequests: result.providerRequests,
    ...verificationBody(result),
  });
}

function verificationStatus(result: VerificationResult): number {
  switch (result.status) {
    case 'verified':
    case 'already-applied':
      return 200;
    case 'provider-failed':
    case 'observation-refused':
      return 502;
    case 'deferred':
      return 429;
    case 'precondition-failed':
    case 'run-in-progress':
    case 'refused':
      return 409;
    case 'not-attempted':
    case 'ledger-unavailable':
    case 'outcome-unknown':
    case 'coordinated-runtime-unavailable':
      return 503;
  }
}

/** The bounded answer: closed values, the review state and the OD-7 content. */
function verificationBody(result: VerificationResult): object {
  const leaseRelease = 'leaseRelease' in result ? result.leaseRelease : null;
  switch (result.status) {
    case 'verified':
    case 'provider-failed':
    case 'already-applied':
      return {
        transition: result.transition,
        match: result.match,
        record: result.record,
        comparison: result.comparison,
        leaseRelease,
      };
    case 'deferred':
      return { retryAt: result.retryAt, leaseRelease };
    case 'not-attempted':
    case 'observation-refused':
    case 'precondition-failed':
    case 'refused':
      return { reason: result.reason, leaseRelease };
    case 'coordinated-runtime-unavailable':
      return { reasons: result.reasons };
    case 'run-in-progress':
    case 'ledger-unavailable':
    case 'outcome-unknown':
      return { leaseRelease };
  }
}

/**
 * One audit line per verification: closed outcomes and the request count.
 * Never the comparison's driver IDs, field names or counts, and no revision.
 */
function logVerification(
  context: ReconciliationRouteContext,
  audit: Audit,
  result: VerificationResult,
): void {
  const leaseRelease = 'leaseRelease' in result ? result.leaseRelease : null;
  const recorded =
    result.status === 'verified' ||
    result.status === 'provider-failed' ||
    result.status === 'already-applied';
  const event: LogEvent = {
    operation: RECONCILIATION_VERIFICATION_OPERATION,
    requestId: context.requestId,
    ...audit,
    operatorAuthMethod: OPERATOR_AUTH_METHOD,
    operatorOutcome: result.status,
    providerOperationCallCount: result.providerRequests,
    ...(recorded
      ? {
          verificationTransition: result.transition,
          ...(result.match === null ? {} : { verificationMatch: result.match }),
          verificationComparison:
            result.comparison.status === 'compared'
              ? 'compared'
              : result.comparison.reason,
        }
      : {}),
    ...(result.status === 'deferred'
      ? { providerRetryAt: result.retryAt }
      : {}),
    ...(result.status === 'refused' ? { ledgerRejection: result.reason } : {}),
    ...(result.status === 'coordinated-runtime-unavailable'
      ? {
          failureCategory: result.status,
          coordinationMissingDependencies: [...result.reasons],
        }
      : {}),
    ...((result.status === 'precondition-failed' ||
      result.status === 'observation-refused') &&
    result.reason !== null
      ? { failureCategory: result.reason }
      : {}),
    ...(leaseRelease === null ? {} : { leaseRelease }),
  };
  context.logger.warn(event);
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
