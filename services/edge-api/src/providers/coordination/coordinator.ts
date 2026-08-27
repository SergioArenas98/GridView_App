/**
 * The multi-source provider coordinator (gap G4).
 *
 * It is the **only** component that knows both sources exist. It executes an
 * explicit plan of logical resources, drives each independent port at most
 * once per (resource, source) pair, selects between reconciled and provisional
 * candidates by declared role alone, and returns a typed partial result.
 *
 * What it deliberately does **not** do:
 *
 * - It does not decide what is due. Scheduling stays with `sync/scheduler.ts`,
 *   and event offsets and cadence remain gap G5.
 * - It does not publish, write an active pointer or touch storage. Publication
 *   stays with `publication/publisher.ts`.
 * - It does not resolve provider identities. Mapping is the adapter's own
 *   fail-closed boundary, and its signal is raised there.
 * - It does not persist provenance or a provisional/reconciled record state.
 *   That is gap G9.
 * - It does not reserve capacity or issue transport. Both belong to the
 *   hardened HTTP boundary the adapters call.
 *
 * **Nothing here can throw.** A malformed adapter answer, a thrown adapter
 * error or a violated invariant becomes a bounded typed contribution and the
 * affected resource becomes unavailable; every other resource continues.
 */

import type { Logger } from '../../logging/logger';
import {
  ProviderRequestLedger,
  emptyRequestMetrics,
  type ProviderAttemptOutcome,
  type ProviderRequestMetrics,
} from '../provider-metrics';
import type { SyncJobCategory } from '../../storage/types';
import {
  contributionEvent,
  runEvent,
  selectionEvent,
} from './coordination-signal';
import type {
  CoordinationCounts,
  CoordinationOutcomeReason,
  CoordinationRun,
  ContributionStatus,
  PlanProblem,
  ResourceCoordination,
  ResourceSelection,
  SourceContribution,
} from './outcome';
import {
  isWellFormedOutcome,
  type ProviderResourceOutcome,
  type ProviderResourcePort,
} from './port';
import {
  isCoordinatedResource,
  jobCategoryForResource,
  payloadMatchesResource,
  resourceKey,
  type CoordinatedPayload,
  type CoordinatedResource,
} from './resource';
import {
  coordinatedSourceIds,
  decideProvisionalEligibility,
  rolePrecedenceOf,
  sourceRoleOf,
  sourceSelectable,
  sourceSupportsResource,
  type CoordinatedSourceId,
  type ProvisionalEligibility,
  type SourceRole,
} from './source-policy';

/** An explicit list of logical resources to coordinate for one season. */
export interface CoordinationPlan {
  readonly season: number;
  readonly resources: readonly CoordinatedResource[];
}

export interface CoordinationRequest {
  readonly plan: CoordinationPlan;
  /** Caller cancellation. Distinct from any transport timeout. */
  readonly signal?: AbortSignal;
}

/**
 * Deliberately small. The synchronization service is sequential today, so the
 * default preserves that exactly; a caller may raise it for genuinely
 * independent work, but never without a ceiling.
 */
export const defaultMaxConcurrentOperations = 1;
export const maxAllowedConcurrentOperations = 4;

export interface MultiSourceCoordinatorOptions {
  /** At most one port per source. A second port for a source is a wiring bug. */
  readonly ports: readonly ProviderResourcePort[];
  readonly logger: Logger;
  /**
   * The already-decided provisional session-end bound.
   *
   * Omitted, `undefined`, `null` or malformed all mean **locked**, which is
   * the only state any production wiring can produce: no bound is recorded
   * anywhere in the repository (ADR 0020 §5, D5.8).
   */
  readonly provisionalSessionEndBound?: unknown;
  readonly maxConcurrentOperations?: number;
}

export class CoordinatorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoordinatorConfigurationError';
  }
}

/** One (resource, source) pair the coordinator will decide on. */
interface Operation {
  readonly resource: CoordinatedResource;
  readonly source: CoordinatedSourceId;
  readonly role: SourceRole;
  readonly jobCategory: SyncJobCategory;
}

/** What one operation produced, before deterministic post-processing. */
type OperationResult =
  | { readonly kind: 'answered'; readonly outcome: ProviderResourceOutcome }
  | { readonly kind: 'threw' }
  | { readonly kind: 'not-executed' };

/** One physical outbound request, and every job category it served. */
interface TransportRecord {
  readonly source: CoordinatedSourceId;
  readonly outcome: ProviderAttemptOutcome;
  readonly jobCategories: Set<SyncJobCategory>;
}

export class MultiSourceCoordinator {
  private readonly ports: ReadonlyMap<
    CoordinatedSourceId,
    ProviderResourcePort
  >;
  private readonly logger: Logger;
  private readonly eligibility: ProvisionalEligibility;
  private readonly maxConcurrent: number;

  constructor(options: MultiSourceCoordinatorOptions) {
    const ports = new Map<CoordinatedSourceId, ProviderResourcePort>();
    for (const port of options.ports) {
      if (ports.has(port.sourceId)) {
        // Two ports for one source would make attribution ambiguous and could
        // double-drive a single budget. There is no safe default, so this
        // fails at wiring time rather than silently picking one.
        throw new CoordinatorConfigurationError(
          'Exactly one provider port per source is permitted.',
        );
      }
      ports.set(port.sourceId, port);
    }
    this.ports = ports;
    this.logger = options.logger;
    this.eligibility = decideProvisionalEligibility(
      options.provisionalSessionEndBound,
    );
    const requested =
      options.maxConcurrentOperations ?? defaultMaxConcurrentOperations;
    if (
      !Number.isSafeInteger(requested) ||
      requested < 1 ||
      requested > maxAllowedConcurrentOperations
    ) {
      throw new CoordinatorConfigurationError(
        'Coordination concurrency must be a small positive bounded integer.',
      );
    }
    this.maxConcurrent = requested;
  }

  async coordinate(request: CoordinationRequest): Promise<CoordinationRun> {
    const { plan } = request;
    const planProblem = validatePlan(plan);
    if (planProblem !== null) {
      // Fail closed before anything runs: no reservation, no adapter call, no
      // accounting write, and no partially valid subset that could conceal the
      // violation.
      const run = rejectedRun(plan, planProblem);
      this.logger.warn(runEvent(run));
      return run;
    }

    const operations = this.expand(plan);
    const results = await this.execute(operations, request.signal);
    const cancelled = request.signal?.aborted === true;

    const contributions = this.attribute(operations, results);
    const resources = this.decide(plan, operations, contributions.list);

    const run: CoordinationRun = {
      season: plan.season,
      status: cancelled ? 'cancelled' : 'completed',
      planProblem: null,
      resources,
      accounting: contributions.metrics,
      counts: countsFor(plan, resources, contributions.list),
    };

    for (const contribution of contributions.list) {
      // A statically unsupported pairing is policy, not a run outcome, and
      // logging one line per non-capable pair every run would be noise.
      if (contribution.reason === 'resource-unsupported') continue;
      this.logger.info(contributionEvent(contribution));
    }
    for (const resource of resources)
      this.logger.info(selectionEvent(resource));
    this.logger.info(runEvent(run));
    return run;
  }

  /**
   * Expands the plan into (resource, source) operations.
   *
   * The order is fixed: plan order for resources, then the declared source
   * order. Both are inputs to execution only - neither can influence selection,
   * which consults the role table alone.
   */
  private expand(plan: CoordinationPlan): Operation[] {
    const operations: Operation[] = [];
    for (const resource of plan.resources) {
      for (const source of coordinatedSourceIds) {
        operations.push({
          resource,
          source,
          role: sourceRoleOf(source),
          jobCategory: jobCategoryForResource(resource.kind),
        });
      }
    }
    return operations;
  }

  /**
   * Runs the operations through a bounded pool.
   *
   * A fixed number of workers pull from one shared cursor, so at most
   * `maxConcurrent` operations are ever in flight. There is no
   * `Promise.all(operations.map(...))` anywhere: that would place the whole
   * plan in flight at once and defeat every pacing control below it.
   *
   * Results are written into a pre-sized slot array by operation index, so
   * completion order cannot influence the outcome.
   */
  private async execute(
    operations: readonly Operation[],
    signal: AbortSignal | undefined,
  ): Promise<OperationResult[]> {
    const results: OperationResult[] = operations.map(() => ({
      kind: 'not-executed',
    }));
    let cursor = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        // Cancellation stops *scheduling*. Work already in flight is owned by
        // the HTTP boundary, which received the same signal.
        if (signal?.aborted) return;
        const index = cursor++;
        if (index >= operations.length) return;
        const operation = operations[index];
        if (operation === undefined) return;
        results[index] = await this.runOperation(operation, signal);
      }
    };
    const workers = Math.min(this.maxConcurrent, operations.length);
    await Promise.all(
      Array.from({ length: Math.max(workers, 0) }, () => worker()),
    );
    return results;
  }

  /**
   * Decides one operation.
   *
   * Every guard below happens **before** the port is touched, so a cancelled,
   * unsupported, locked or unwired operation cannot reserve capacity, issue
   * transport or produce an attempt.
   */
  private async runOperation(
    operation: Operation,
    signal: AbortSignal | undefined,
  ): Promise<OperationResult> {
    if (signal?.aborted) return { kind: 'not-executed' };

    if (!sourceSupportsResource(operation.source, operation.resource.kind)) {
      return notAttempted('resource-unsupported');
    }
    if (!sourceSelectable(operation.source, this.eligibility)) {
      // The provisional source with no recorded session-end bound. Skipped
      // whole, with no exception for a baseline, metadata, discovery or
      // health request (ADR 0020 D5.1-D5.2).
      return notAttempted('source-locked');
    }
    const port = this.ports.get(operation.source);
    if (port === undefined) return notAttempted('source-unavailable');

    try {
      const outcome = await port.fetchResource({
        source: operation.source,
        resource: operation.resource,
        ...(signal ? { signal } : {}),
      });
      return { kind: 'answered', outcome };
    } catch {
      // The thrown value is never read, logged or re-raised: it can embed a
      // URL, a provider body or a stack.
      return { kind: 'threw' };
    }
  }

  /**
   * Converts raw results into contributions and accounting, deterministically.
   *
   * Processed in operation-index order, never completion order. That is what
   * makes both the transport-reference deduplication and the first-writer-wins
   * conflict rule reproducible.
   */
  private attribute(
    operations: readonly Operation[],
    results: readonly OperationResult[],
  ): { list: SourceContribution[]; metrics: ProviderRequestMetrics } {
    const list: SourceContribution[] = [];
    const transports = new Map<string, TransportRecord>();

    operations.forEach((operation, index) => {
      const result = results[index] ?? { kind: 'not-executed' as const };
      try {
        list.push(this.contributionFor(operation, result, transports));
      } catch {
        // Reading the adapter's own answer threw - an accessor, a proxy or an
        // exotic object. Nothing it claims can be believed, including any
        // attempt, so it fails closed as malformed and is never counted. This
        // is what keeps "nothing here can throw" true for a hostile value and
        // not merely for a badly shaped one.
        list.push(
          contribution(operation, 'failed', false, 'malformed-outcome'),
        );
      }
    });

    return { list, metrics: toMetrics(transports) };
  }

  private contributionFor(
    operation: Operation,
    result: OperationResult,
    transports: Map<string, TransportRecord>,
  ): SourceContribution {
    if (result.kind === 'not-executed') {
      return contribution(operation, 'skipped', false, 'cancelled');
    }
    if (result.kind === 'threw') {
      return contribution(operation, 'failed', false, 'adapter-error');
    }

    const outcome = result.outcome;
    if (!isWellFormedOutcome(outcome)) {
      return contribution(operation, 'failed', false, 'malformed-outcome');
    }

    if (outcome.outcome === 'not-attempted') {
      const status: ContributionStatus =
        outcome.reason === 'rate-limit-deferred' ? 'deferred' : 'skipped';
      return contribution(operation, status, false, outcome.reason, {
        retryAt: outcome.retryAt ?? null,
      });
    }

    // Every remaining variant carries an attempt, so it is registered before
    // the contribution is classified. A conflicting re-use of one reference is
    // an invariant violation and fails the *later* contribution closed.
    const conflict = registerTransport(transports, operation, outcome.attempt);
    if (conflict) {
      return contribution(operation, 'failed', false, 'coordination-invariant');
    }

    if (outcome.outcome === 'failed') {
      return contribution(operation, 'failed', true, outcome.reason, {
        retryAfter: outcome.retryAfter ?? null,
      });
    }
    if (outcome.outcome === 'mapping-failure') {
      // Contained here, and reported by the mapping boundary itself.
      return contribution(operation, 'failed', true, 'mapping-unresolved');
    }

    if (!payloadMatchesResource(operation.resource, outcome.payload)) {
      // A structurally valid answer to a different question. Never selected.
      return contribution(operation, 'failed', true, 'malformed-outcome');
    }
    return contribution(operation, 'candidate', true, null, {
      payload: outcome.payload,
    });
  }

  /**
   * Selects one candidate per resource.
   *
   * The **only** inputs are the declared source role and the typed resource
   * identity. Arrival time, completion order, plan order, payload size,
   * truthiness, display-name similarity and string comparison are all
   * unreachable from here by construction.
   */
  private decide(
    plan: CoordinationPlan,
    operations: readonly Operation[],
    contributions: readonly SourceContribution[],
  ): ResourceCoordination[] {
    return plan.resources.map((resource) => {
      const key = resourceKey(resource);
      const mine = contributions.filter(
        (_, index) =>
          operations[index] !== undefined &&
          resourceKey(operations[index].resource) === key,
      );
      return {
        resource,
        jobCategory: jobCategoryForResource(resource.kind),
        selection: select(mine),
        contributions: mine,
      };
    });
  }
}

function select(
  contributions: readonly SourceContribution[],
): ResourceSelection {
  let best: SourceContribution | null = null;
  for (const candidate of contributions) {
    if (candidate.status !== 'candidate' || candidate.payload === null)
      continue;
    if (
      best === null ||
      rolePrecedenceOf(candidate.role) < rolePrecedenceOf(best.role)
    ) {
      best = candidate;
    }
  }
  if (best === null || best.payload === null) {
    return { outcome: 'unavailable', reason: 'no-usable-candidate' };
  }
  return {
    outcome: 'selected',
    source: best.source,
    role: best.role,
    payload: best.payload,
  };
}

/**
 * The identity of one physical request: its **source and** its reference.
 *
 * A transport reference is a token one adapter generates for itself. Adapters
 * are independent by construction - neither imports, calls or knows about the
 * other - so they share no namespace and cannot agree to avoid each other's
 * tokens. Two sources emitting the same token is therefore an ordinary
 * coincidence, never evidence about one request, and the two must not be able
 * to interact at all. Length-prefixed for the same injectivity-by-
 * construction reason as `resourceKey`.
 */
function transportKey(source: CoordinatedSourceId, reference: string): string {
  return (
    source.length +
    ':' +
    source +
    ';' +
    reference.length +
    ':' +
    reference +
    ';'
  );
}

/**
 * Registers one transport attempt, returning `true` when the claim conflicts
 * with an already-registered one **from the same source**.
 *
 * A repeated reference from the same source with the same outcome is
 * legitimate: one request served more than one derived resource, and it is
 * counted once while contributing its job category to that single attempt. The
 * same reference claiming a different outcome cannot describe one request, so
 * the later claim fails closed.
 *
 * The same reference from a *different* source is never deduplicated and never
 * treated as a conflict: they are two independent physical requests, each
 * counted and attributed in full.
 */
function registerTransport(
  transports: Map<string, TransportRecord>,
  operation: Operation,
  attempt: {
    readonly reference: string;
    readonly outcome: ProviderAttemptOutcome;
  },
): boolean {
  const key = transportKey(operation.source, attempt.reference);
  const existing = transports.get(key);
  if (existing === undefined) {
    transports.set(key, {
      source: operation.source,
      outcome: attempt.outcome,
      jobCategories: new Set([operation.jobCategory]),
    });
    return false;
  }
  if (existing.outcome !== attempt.outcome) {
    return true;
  }
  existing.jobCategories.add(operation.jobCategory);
  return false;
}

/** Folds the deduplicated transport records into the existing metrics shape. */
function toMetrics(
  transports: ReadonlyMap<string, TransportRecord>,
): ProviderRequestMetrics {
  if (transports.size === 0) return emptyRequestMetrics();
  const ledger = new ProviderRequestLedger();
  for (const record of transports.values()) {
    ledger.record({
      sourceId: record.source,
      outcome: record.outcome,
      jobCategories: [...record.jobCategories],
    });
  }
  return ledger.snapshot();
}

function contribution(
  operation: Operation,
  status: ContributionStatus,
  attempted: boolean,
  reason: CoordinationOutcomeReason | null,
  extra: {
    retryAt?: string | null;
    retryAfter?: string | null;
    payload?: CoordinatedPayload;
  } = {},
): SourceContribution {
  return {
    source: operation.source,
    role: operation.role,
    resource: operation.resource,
    jobCategory: operation.jobCategory,
    status,
    attempted,
    reason,
    retryAt: extra.retryAt ?? null,
    retryAfter: extra.retryAfter ?? null,
    payload: extra.payload ?? null,
  };
}

function notAttempted(
  reason: 'resource-unsupported' | 'source-locked' | 'source-unavailable',
): OperationResult {
  return { kind: 'answered', outcome: { outcome: 'not-attempted', reason } };
}

/**
 * Validates the plan before any execution.
 *
 * The duplicate rule is **reject the whole plan**, not canonicalize it. A
 * duplicate is a caller defect, and silently collapsing it would hide the
 * defect while quietly changing what was asked for. Rejecting fails closed
 * with nothing attempted, which no partial execution can do.
 */
function validatePlan(plan: CoordinationPlan): PlanProblem | null {
  // Each class of violation is decided over the whole plan before the next is
  // considered, so the reported problem is a property of the plan's contents
  // and a fixed precedence - never of the order the entries happen to be in.
  // It also means the duplicate key set is only ever built for a plan whose
  // every entry is already a validated, in-season, closed-shape identity, so
  // nothing unbounded or caller-shaped can be accumulated here.
  for (const resource of plan.resources) {
    if (!isCoordinatedResource(resource)) return 'invalid-resource';
  }
  for (const resource of plan.resources) {
    if (resource.season !== plan.season) return 'season-mismatch';
  }
  const seen = new Set<string>();
  for (const resource of plan.resources) {
    const key = resourceKey(resource);
    if (seen.has(key)) return 'duplicate-resource';
    seen.add(key);
  }
  return null;
}

function rejectedRun(
  plan: CoordinationPlan,
  problem: PlanProblem,
): CoordinationRun {
  return {
    season: plan.season,
    status: 'plan-rejected',
    planProblem: problem,
    resources: [],
    accounting: emptyRequestMetrics(),
    counts: {
      planned: plan.resources.length,
      selected: 0,
      unavailable: 0,
      attempted: 0,
      notAttempted: 0,
    },
  };
}

function countsFor(
  plan: CoordinationPlan,
  resources: readonly ResourceCoordination[],
  contributions: readonly SourceContribution[],
): CoordinationCounts {
  let selected = 0;
  for (const resource of resources) {
    if (resource.selection.outcome === 'selected') selected += 1;
  }
  let attempted = 0;
  for (const contribution of contributions) {
    if (contribution.attempted) attempted += 1;
  }
  return {
    planned: plan.resources.length,
    selected,
    unavailable: resources.length - selected,
    attempted,
    notAttempted: contributions.length - attempted,
  };
}
