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
 *
 * **An answered outcome is the coordinator's own normalized copy.** The instant
 * an adapter's answer crosses this boundary it is parsed by
 * `readProviderOutcome`: its shape is closed, each declared field is taken once
 * as an own data property, the values taken are validated, and a candidate's
 * payload is detached. Everything afterwards - transport registration, request
 * accounting, classification, resource binding, selection, assembly,
 * publication and every log line - reads that copy. The adapter's object is
 * never retained and never read twice, so an adapter that mutates what it
 * returned, reuses one object across requests or answers through an accessor
 * cannot change what its answer means. This is an aliasing and
 * time-of-check/time-of-use guarantee, and is distinct from deep
 * normalized-contract validation, which stays an adapter responsibility and an
 * activation gate (ADR 0023 D14).
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
  readProviderOutcome,
  type NormalizedProviderOutcome,
  type NormalizedTransportAttempt,
  type ProviderResourcePort,
} from './port';
import {
  jobCategoryForResource,
  payloadMatchesResource,
  readCoordinatedResource,
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

/**
 * What one operation produced, before deterministic post-processing.
 *
 * An answered operation carries the coordinator's **normalized** outcome - not
 * the adapter's object. Every field was taken once at the boundary, so what
 * attribution reads is a fact about the request that produced it rather than
 * whatever the adapter's object happens to say by the time the whole plan has
 * finished executing.
 *
 * `malformed` is a distinct kind rather than a normalized variant: an answer
 * whose shape could not be trusted supports no claim at all, including any
 * attempt it appeared to carry, so nothing about it may be counted.
 */
type OperationResult =
  | { readonly kind: 'answered'; readonly outcome: NormalizedProviderOutcome }
  | { readonly kind: 'malformed' }
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
    const validation = validatePlan(request.plan);
    if (!validation.ok) {
      // Fail closed before anything runs: no reservation, no adapter call, no
      // accounting write, and no partially valid subset that could conceal the
      // violation.
      const run = rejectedRun(
        validation.season,
        validation.planned,
        validation.problem,
      );
      this.logger.warn(runEvent(run));
      return run;
    }
    // Everything below executes the plan that was **validated**, never the
    // object the caller handed over: each identity is a plain frozen copy whose
    // fields were read once, so no accessor can answer differently on a second
    // read and no unvalidated value can ride along.
    const plan = validation.plan;

    const operations = this.expand(plan);
    const results = await this.execute(operations, request.signal);
    const cancelled = request.signal?.aborted === true;

    const contributions = this.attribute(operations, results);
    const resources = this.decide(plan, operations, contributions.list);

    // A same-source transport contradiction is a property of the **run**, not
    // of one contribution. Two outcomes claiming one physical request with
    // different endings cannot both be true, so the run's request accounting is
    // already corrupted; letting the other source's healthy candidate carry the
    // resource would publish a complete-looking season on top of an impossible
    // adapter history (ADR 0023 D7/D9). The conflicting contribution is still
    // rejected where it happens, and the run additionally becomes unpublishable.
    const tainted = contributions.list.some(
      (contribution) => contribution.reason === 'coordination-invariant',
    );

    const run: CoordinationRun = {
      season: plan.season,
      status: cancelled
        ? 'cancelled'
        : tainted
          ? 'invariant-violated'
          : 'completed',
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
      const answer: unknown = await port.fetchResource({
        source: operation.source,
        resource: operation.resource,
        ...(signal ? { signal } : {}),
      });
      // Normalized **here**, the instant the answer crosses the boundary, and
      // not later during attribution. Attribution runs after the whole plan has
      // executed, so an adapter that refills one object for its next request
      // would otherwise have rewritten this answer before anything ever looked
      // at it. Taking the coordinator's own copy on arrival is what makes each
      // answer a fact about the request that produced it.
      const outcome = readProviderOutcome(answer);
      return outcome === null
        ? { kind: 'malformed' }
        : { kind: 'answered', outcome };
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
        // Unreachable by construction: every value read below is a primitive
        // this package copied at the port boundary, so no accessor, proxy or
        // exotic object survives to be read here. Retained because "nothing
        // here can throw" is a guarantee about the boundary, not about the
        // current shape of the code behind it - a malformed result is never
        // counted, whichever step declined to believe it.
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
    if (result.kind === 'malformed') {
      // The answer's own shape could not be trusted, so nothing it appeared to
      // claim is believed - including any attempt. No request activity is
      // invented from it.
      return contribution(operation, 'failed', false, 'malformed-outcome');
    }

    // Everything below reads the coordinator's normalized copy. The adapter's
    // object is unreachable from here, so no field can have changed since it
    // was validated and none is read a second time.
    const outcome = result.outcome;

    if (outcome.outcome === 'not-attempted') {
      const status: ContributionStatus =
        outcome.reason === 'rate-limit-deferred' ? 'deferred' : 'skipped';
      return contribution(operation, status, false, outcome.reason, {
        retryAt: outcome.retryAt,
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
        retryAfter: outcome.retryAfter,
      });
    }
    if (outcome.outcome === 'mapping-failure') {
      // Contained here, and reported by the mapping boundary itself.
      return contribution(operation, 'failed', true, 'mapping-unresolved');
    }

    // **Bind the detached snapshot, and keep exactly that value.** The adapter
    // still owns the object it returned, so a reference to it is not a fact:
    // it can be mutated after this contribution is classified, can be one
    // reused buffer a later request already rewrote, or can be an accessor
    // that answers differently on a second read. Validating the adapter's own
    // object and copying it afterwards would close none of those - the copy
    // could be taken from a value the check never saw. So the snapshot taken
    // on arrival is what the binding check reads, and the same snapshot is
    // what is stored, selected and later assembled.
    const snapshot = outcome.payload;
    if (!snapshot.detached) {
      // A payload that cannot be detached - a function-valued field, a hostile
      // proxy, an exotic value - is not usable data, so it fails closed as the
      // malformed outcome it is. The request itself really happened and is
      // already registered above, so it stays an *attempted* contribution and
      // the run's request accounting is unchanged.
      return contribution(operation, 'failed', true, 'malformed-outcome');
    }
    const candidate = snapshot.payload;
    if (!payloadMatchesResource(operation.resource, candidate)) {
      // A structurally valid answer to a different question. Never selected.
      return contribution(operation, 'failed', true, 'malformed-outcome');
    }
    return contribution(operation, 'candidate', true, null, {
      payload: candidate,
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
  attempt: NormalizedTransportAttempt,
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
  // Already normalized: this outcome is the coordinator's own, no adapter was
  // reached, and there is no payload to detach.
  return {
    kind: 'answered',
    outcome: { outcome: 'not-attempted', reason, retryAt: null },
  };
}

/** The exact own properties a plan declares. */
const planKeys = ['season', 'resources'] as const;

/** The season reported for a plan whose own season could never be read. */
const unknownPlanSeason = 0;

/**
 * The outcome of validating one plan.
 *
 * On success it carries the **normalized** plan the coordinator will execute.
 * On failure it carries whatever was safely established before the violation,
 * so the rejection can still be reported with bounded counts.
 */
type PlanValidation =
  | { readonly ok: true; readonly plan: CoordinationPlan }
  | {
      readonly ok: false;
      readonly problem: PlanProblem;
      readonly season: number;
      readonly planned: number;
    };

function planRejected(
  problem: PlanProblem,
  season: number,
  planned: number,
): PlanValidation {
  return { ok: false, problem, season, planned };
}

/**
 * Validates the plan before any execution.
 *
 * **A plan is an untrusted runtime boundary, not a typed value.** The
 * `CoordinationPlan` type proves nothing at runtime: a caller can hand over a
 * proxy whose `ownKeys` trap throws, an object whose `season` getter throws, a
 * `resources` that is not an array, or an entry carrying a symbol-keyed or
 * prototype-borne field. Every one of those has to become a bounded rejection
 * with **no port call, no accounting and no hostile detail in any log line** -
 * so reflection, iteration and property access are all performed inside
 * containment rather than trusted to behave.
 *
 * The duplicate rule is **reject the whole plan**, not canonicalize it. A
 * duplicate is a caller defect, and silently collapsing it would hide the
 * defect while quietly changing what was asked for. Rejecting fails closed
 * with nothing attempted, which no partial execution can do.
 */
function validatePlan(value: unknown): PlanValidation {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return planRejected('invalid-plan', unknownPlanSeason, 0);
    }
    const allowed = new Set<string>(planKeys);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !allowed.has(key)) {
        return planRejected('invalid-plan', unknownPlanSeason, 0);
      }
    }
    for (const key of planKeys) {
      if (!Object.hasOwn(value, key)) {
        return planRejected('invalid-plan', unknownPlanSeason, 0);
      }
    }

    const record = value as Record<string, unknown>;
    const season = record.season;
    if (!isPlanSeason(season)) {
      return planRejected('invalid-season', unknownPlanSeason, 0);
    }
    const declared = record.resources;
    if (!Array.isArray(declared)) {
      return planRejected('invalid-plan', season, 0);
    }

    // Index access rather than iteration: `Array.isArray` is true of a proxy
    // over an array, so a spread would run a caller-supplied iterator. Any
    // trap that throws is contained by the enclosing block.
    const resources: CoordinatedResource[] = [];
    for (let index = 0; index < declared.length; index += 1) {
      const resource = readCoordinatedResource(declared[index]);
      if (resource === null) {
        return planRejected('invalid-resource', season, declared.length);
      }
      resources.push(resource);
    }

    // Each class of violation is decided over the whole plan before the next is
    // considered, so the reported problem is a property of the plan's contents
    // and a fixed precedence - never of the order the entries happen to be in.
    // It also means the duplicate key set is only ever built for a plan whose
    // every entry is already a validated, in-season, closed-shape identity, so
    // nothing unbounded or caller-shaped can be accumulated here.
    for (const resource of resources) {
      if (resource.season !== season) {
        return planRejected('season-mismatch', season, resources.length);
      }
    }
    const seen = new Set<string>();
    for (const resource of resources) {
      const key = resourceKey(resource);
      if (seen.has(key)) {
        return planRejected('duplicate-resource', season, resources.length);
      }
      seen.add(key);
    }
    return { ok: true, plan: { season, resources } };
  } catch {
    // A hostile proxy or accessor somewhere in the plan. The thrown value is
    // never read, logged or re-raised: it is caller-controlled.
    return planRejected('invalid-plan', unknownPlanSeason, 0);
  }
}

/** The supported season domain, matching a resource identity's own bound. */
function isPlanSeason(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1950 &&
    value <= 2100
  );
}

function rejectedRun(
  season: number,
  planned: number,
  problem: PlanProblem,
): CoordinationRun {
  return {
    season,
    status: 'plan-rejected',
    planProblem: problem,
    resources: [],
    accounting: emptyRequestMetrics(),
    counts: {
      planned,
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
