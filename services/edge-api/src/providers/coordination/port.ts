/**
 * The per-source provider port: one independent adapter seam per source.
 *
 * A port is asked for **one resource at a time** and answers with **one typed
 * outcome**. It never receives the plan, never sees another source's outcome,
 * never decides which source wins, and never publishes. That is what makes
 * "either source can be removed without changing the public contract"
 * (GridView_Provider_Evaluation.md §10.10) true by construction rather than by
 * convention.
 *
 * No adapter implements this yet. It is the seam a Jolpica adapter and a
 * fixture-only OpenF1 adapter will implement, and the only thing the
 * coordinator drives.
 */

import type { ProviderAttemptOutcome } from '../provider-metrics';
import type { CoordinatedPayload, CoordinatedResource } from './resource';
import type { CoordinatedSourceId } from './source-policy';

/** What the coordinator asks one source for. */
export interface ProviderResourceRequest {
  readonly source: CoordinatedSourceId;
  readonly resource: CoordinatedResource;
  /** Caller cancellation, propagated to the hardened HTTP boundary. */
  readonly signal?: AbortSignal;
}

/**
 * Upper bound on a transport reference. It is an adapter-generated correlation
 * token, never a URL, a storage key, an object id or a provider value, and it
 * is never logged - but it is still bounded, because an unbounded string from
 * a boundary has no business being retained even in memory.
 */
export const transportReferenceMaxLength = 64;

/**
 * The one outbound request an outcome was derived from.
 *
 * **Why a reference and not a boolean.** One Jolpica read can legitimately
 * serve more than one logical resource - a single classification response
 * carries the entries several derived consumers need. Counting once per
 * consumer would inflate quota usage for a request that left GridView once.
 * Two outcomes that share a reference are therefore counted once, and the
 * coordinator - not the adapter - is what enforces that.
 *
 * A `not-attempted` outcome has no attempt field at all, so "not attempted"
 * can never be miscounted as an attempt. That is enforced at runtime, not only
 * in the type: `isWellFormedOutcome` validates the union as a **closed** set of
 * shapes, so an adapter that hands back `not-attempted` carrying an `attempt`
 * is rejected as malformed rather than silently accounted as a skip.
 */
export interface ProviderTransportAttempt {
  /** Correlates outcomes that came from the same physical request. */
  readonly reference: string;
  /**
   * How the request itself ended. A mapping failure that followed a 200 is
   * still a `successful` **attempt**: the request left GridView, consumed
   * window capacity and was answered. Only the resource contribution failed.
   */
  readonly outcome: ProviderAttemptOutcome;
}

/**
 * Reasons GridView did **not** send anything.
 *
 * None of these may be counted as a provider request, may reserve capacity, or
 * may write a provider failure timestamp.
 */
export const notAttemptedReasons = [
  /** Policy lock: no justified session-end bound is recorded (ADR 0020 §5). */
  'source-locked',
  /** No port is registered for this source in this run. */
  'source-unavailable',
  /** Outside the source's declared capability. */
  'resource-unsupported',
  /** The global limiter declined; `retryAt` may accompany it. */
  'rate-limit-deferred',
  /** The limiter could not answer. Fail closed. */
  'limiter-unavailable',
  /** The caller cancelled before this operation could start or send. */
  'cancelled',
] as const;

export type NotAttemptedReason = (typeof notAttemptedReasons)[number];

/**
 * Reasons a request that **was** sent did not yield a usable candidate.
 *
 * Every member implies exactly one attempted provider request.
 */
export const attemptedFailureReasons = [
  /** Upstream answered 429 after the request was attempted. */
  'provider-rate-limited',
  /** Network, timeout, redirect, HTTP status, content type or size failure. */
  'provider-unavailable',
  /** The response was read but did not validate against the contract. */
  'invalid-payload',
] as const;

export type AttemptedFailureReason = (typeof attemptedFailureReasons)[number];

/**
 * How each attempted failure may have ended at the transport layer.
 *
 * A reason and an attempt outcome are two statements about **one** request, so
 * they can contradict each other. One total table decides which pairings
 * describe a request that could actually have happened; nothing compares them
 * ad hoc anywhere else.
 *
 * The sets are derived from what the hardened HTTP boundary
 * (`providers/http/provider-http-client.ts`) can actually produce, not from
 * symmetry:
 *
 * - **`provider-rate-limited` requires `rate-limited`.** It exists for exactly
 *   one situation - upstream answered `429` after the request was attempted -
 *   and the ledger must record that as the rate-limited attempt it was.
 * - **`invalid-payload` requires `successful`.** By its own definition the
 *   response *was read*; only contract validation failed afterwards. A
 *   transport that failed or was refused returned nothing to validate.
 * - **`provider-unavailable` admits `failed` **or** `successful`**, because it
 *   genuinely covers two different endings. `timeout`, `network`,
 *   `redirect-rejected` and `provider-http-error` are transports that did not
 *   complete usefully. But `invalid-content-type`, `response-too-large` and
 *   `malformed-json` are GridView's own policy rejecting a response that
 *   *arrived*, with a status, after a request that left and was answered -
 *   `requestAttempted: true` at the HTTP boundary. Forcing `failed` on those
 *   would make the coordinator contradict the transport layer and under-report
 *   a real answered request. It never admits `rate-limited`: a `429` has its
 *   own reason, so that pairing is still a contradiction.
 */
const allowedAttemptOutcomes: Record<
  AttemptedFailureReason,
  readonly ProviderAttemptOutcome[]
> = {
  'provider-rate-limited': ['rate-limited'],
  'provider-unavailable': ['failed', 'successful'],
  'invalid-payload': ['successful'],
};

/** The attempt outcomes one attempted failure reason may legitimately carry. */
export function attemptOutcomesForFailureReason(
  reason: AttemptedFailureReason,
): readonly ProviderAttemptOutcome[] {
  return allowedAttemptOutcomes[reason];
}

function isAttemptedFailureReason(
  value: unknown,
): value is AttemptedFailureReason {
  return (
    typeof value === 'string' &&
    (attemptedFailureReasons as readonly string[]).includes(value)
  );
}

/**
 * The typed adapter result.
 *
 * Closed by construction, and deliberately not nullable anywhere: "no data"
 * and "nothing was asked" are different facts, and an adapter must not be able
 * to express them as the same absence.
 */
export type ProviderResourceOutcome =
  | {
      readonly outcome: 'candidate';
      readonly attempt: ProviderTransportAttempt;
      readonly payload: CoordinatedPayload;
    }
  | {
      readonly outcome: 'not-attempted';
      readonly reason: NotAttemptedReason;
      /** Local pacing hint. Carried as data only; G5 owns scheduling. */
      readonly retryAt?: string;
    }
  | {
      readonly outcome: 'failed';
      readonly attempt: ProviderTransportAttempt;
      readonly reason: AttemptedFailureReason;
      /** Upstream 429 instruction, already parsed to an absolute instant. */
      readonly retryAfter?: string;
    }
  | {
      /**
       * A provider identity could not be resolved to a GridView identity.
       *
       * The adapter owns the mapping boundary and raises its own bounded
       * Phase 9B-3 signal. Nothing about the failed identity is carried here:
       * the coordinator must contain the failure, not re-report it.
       */
      readonly outcome: 'mapping-failure';
      readonly attempt: ProviderTransportAttempt;
    };

/**
 * One independent source adapter.
 *
 * `sourceId` is the typed identity the coordinator attributes work to. It is
 * read from this field and never from a name, a class or a registration order.
 */
export interface ProviderResourcePort {
  readonly sourceId: CoordinatedSourceId;
  /**
   * Answers with a typed outcome. **An adapter must not throw**, and in
   * particular must not throw once transport may have left GridView: an
   * outcome is the only thing that can report an attempt, so a throw after a
   * request was issued discards that attempt from the coordinator's summary.
   *
   * A throw is therefore an adapter contract violation, and the coordinator
   * treats it as one: it becomes `adapter-error`, and the coordinator makes
   * **no claim either way** about whether transport occurred, because it
   * cannot know. It does not invent an attempt, and the summary is knowingly
   * an under-report in exactly this defect case. Nothing is unsafe about that
   * here - the Durable Object reservation ledger is the pacing authority and
   * already holds any slot a real request consumed, since capacity is
   * reserved before transport and never returned.
   */
  fetchResource(
    request: ProviderResourceRequest,
  ): Promise<ProviderResourceOutcome>;
}

function isBoundedReference(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const codePoints = [...value];
  return (
    codePoints.length > 0 && codePoints.length <= transportReferenceMaxLength
  );
}

function isAttempt(value: unknown): value is ProviderTransportAttempt {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    isBoundedReference(record.reference) &&
    (record.outcome === 'successful' ||
      record.outcome === 'failed' ||
      record.outcome === 'rate-limited')
  );
}

/**
 * A `candidate` may only rest on an attempt that says the transport
 * **succeeded**.
 *
 * The two halves of a candidate are claims about the same request: the payload
 * says "here is usable data" and the attempt says how the request that
 * produced it ended. `candidate` with a `failed` or `rate-limited` attempt
 * describes no possible run - a request that failed returned nothing to
 * normalize, and a rate-limited one was refused - so believing either half
 * would mean selecting, and possibly publishing, a payload while the run's own
 * accounting simultaneously recorded that its request did not succeed.
 *
 * A response that arrived and then failed *after* transport is already
 * expressible without this contradiction: `failed` with `invalid-payload`, or
 * `mapping-failure`, both of which keep their `successful` attempt and are
 * counted as the request they were.
 */
function isSuccessfulAttempt(value: unknown): boolean {
  return isAttempt(value) && value.outcome === 'successful';
}

/**
 * A syntactically valid absolute UTC instant, round-tripped.
 *
 * A retry hint is data a future scheduler may consume, so a lax string that
 * `Date.parse` tolerates but that is not the ISO UTC form is rejected rather
 * than carried forward.
 */
export function isInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString() === value;
}

/** The discriminator values `ProviderResourceOutcome` declares. */
type ProviderOutcomeVariant = ProviderResourceOutcome['outcome'];

/**
 * Every property name any variant of the union declares.
 *
 * A variant's *forbidden* set is derived from this list rather than written
 * out, so a property one variant legitimately carries can never be silently
 * tolerated on another.
 */
const declaredOutcomeKeys = [
  'outcome',
  'attempt',
  'payload',
  'reason',
  'retryAt',
  'retryAfter',
] as const;

type DeclaredOutcomeKey = (typeof declaredOutcomeKeys)[number];

interface OutcomeShape {
  readonly required: readonly DeclaredOutcomeKey[];
  readonly optional: readonly DeclaredOutcomeKey[];
}

/**
 * One centralized description of each variant's exact shape.
 *
 * Keyed by the discriminator, so adding a variant to `ProviderResourceOutcome`
 * without describing its shape here is a compile error rather than a silently
 * unvalidated branch.
 */
const outcomeShapes: Record<ProviderOutcomeVariant, OutcomeShape> = {
  candidate: { required: ['outcome', 'attempt', 'payload'], optional: [] },
  'not-attempted': { required: ['outcome', 'reason'], optional: ['retryAt'] },
  failed: {
    required: ['outcome', 'attempt', 'reason'],
    optional: ['retryAfter'],
  },
  'mapping-failure': { required: ['outcome', 'attempt'], optional: [] },
};

function isOutcomeVariant(value: unknown): value is ProviderOutcomeVariant {
  return typeof value === 'string' && Object.hasOwn(outcomeShapes, value);
}

/**
 * Whether an outcome carries exactly the properties its variant declares.
 *
 * The union is a runtime trust boundary, so "enough fields to enter a branch"
 * is not the contract - the contract is the declared shape. Three checks,
 * because an adapter can smuggle a property in three different ways:
 *
 * - **Every own key is declared by this variant.** `Reflect.ownKeys` covers
 *   non-enumerable and symbol-keyed own properties as well, neither of which
 *   any declared variant has.
 * - **Every required key is an own property.** A required field inherited from
 *   a prototype is not this variant either.
 * - **No key another variant declares is reachable at all.** `in` walks the
 *   prototype chain, which is what makes an `attempt` planted on a prototype
 *   fail closed on `not-attempted` rather than being read later.
 *
 * Presence is decided structurally, never by value: `attempt: undefined` is an
 * own property and is therefore still an attempt-bearing outcome.
 *
 * Nothing here reads a property's *value*, so a throwing accessor cannot fire
 * from this function. A hostile proxy can still throw from `ownKeys` or `has`;
 * that is contained by the coordinator's bounded attribution boundary, exactly
 * as a throwing adapter is.
 */
function hasClosedShape(
  record: Record<string, unknown>,
  variant: ProviderOutcomeVariant,
): boolean {
  const shape = outcomeShapes[variant];
  const allowed = new Set<string>([...shape.required, ...shape.optional]);
  for (const key of Reflect.ownKeys(record)) {
    if (typeof key !== 'string' || !allowed.has(key)) return false;
  }
  for (const key of shape.required) {
    if (!Object.hasOwn(record, key)) return false;
  }
  for (const key of declaredOutcomeKeys) {
    if (!allowed.has(key) && key in record) return false;
  }
  return true;
}

/**
 * Structural validation of an adapter outcome, independent of the payload.
 *
 * An adapter is an input boundary: it may be a future third-party-shaped
 * module, a fixture double or a partially migrated implementation. A malformed
 * outcome must fail closed as an unavailable contribution, never throw out of
 * the coordinator and never be partially believed.
 *
 * An outcome must also be **internally consistent**: a variant's own attempt
 * record has to describe a request that could have produced it. A `candidate`
 * and a `mapping-failure` therefore require a `successful` attempt, and every
 * attempted failure must pair its reason with an attempt outcome
 * `attemptOutcomesForFailureReason` allows. An outcome that claims usable data
 * while reporting that its transport failed, or that reports a `429` reason
 * over a successful transport, fails closed here rather than being selected
 * and reported.
 *
 * An outcome must first be **shape-closed**: exactly the properties its own
 * variant declares, and none another variant declares. That is what makes
 * `not-attempted` genuinely unable to carry an attempt at runtime - the
 * property is rejected before any branch reads it, so a malformed adapter
 * answer can neither hide a real request from accounting nor contribute one.
 *
 * The payload's match against the requested resource is checked separately by
 * `payloadMatchesResource`, so a structurally valid outcome carrying the wrong
 * resource's data is still rejected.
 */
export function isWellFormedOutcome(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const variant = record.outcome;
  if (!isOutcomeVariant(variant)) return false;
  // Shape closure decides membership before any value is read, so nothing on a
  // malformed outcome - least of all an attempt it must not carry - is
  // inspected, registered or counted.
  if (!hasClosedShape(record, variant)) return false;
  switch (variant) {
    case 'candidate':
      // A contradictory candidate is a coordination failure, not an attempted
      // one: nothing the outcome claims can be believed, including its own
      // attempt record, so no request activity is invented from it either.
      return (
        isSuccessfulAttempt(record.attempt) &&
        typeof record.payload === 'object'
      );
    case 'not-attempted':
      return (
        (notAttemptedReasons as readonly unknown[]).includes(record.reason) &&
        (record.retryAt === undefined || isInstant(record.retryAt))
      );
    case 'failed':
      return (
        isAttempt(record.attempt) &&
        isAttemptedFailureReason(record.reason) &&
        attemptOutcomesForFailureReason(record.reason).includes(
          record.attempt.outcome,
        ) &&
        (record.retryAfter === undefined || isInstant(record.retryAfter))
      );
    case 'mapping-failure':
      // The mapping boundary runs on a response that was read, so the request
      // behind it always succeeded (see `ProviderTransportAttempt.outcome`).
      return isSuccessfulAttempt(record.attempt);
  }
}
