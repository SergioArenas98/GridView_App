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
import { ownDataProperty } from './own-property';
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
   *
   * **An adapter may reuse its objects, with exactly one limit.** The
   * coordinator takes its own copy of every answer the instant the promise
   * resolves (`readProviderOutcome`), so mutating a returned outcome, refilling
   * one buffer for the *next* request, or holding a payload after answering all
   * change nothing. The one case no copy on this side can undo is an object
   * shared between requests that are **simultaneously in flight**: two live
   * answers aliased to one object have already lost what distinguished them
   * before either could be observed. That only arises above
   * `defaultMaxConcurrentOperations`, which is 1, and an adapter that answers
   * concurrent requests must give each its own object.
   */
  fetchResource(
    request: ProviderResourceRequest,
  ): Promise<ProviderResourceOutcome>;
}

/**
 * A non-empty reference of at most `transportReferenceMaxLength` code points.
 *
 * The bound is decided before the string is walked. A UTF-16 unit count is not
 * a code point count, but it brackets one: every code point is one or two
 * units, so a string longer than twice the bound is over it and one no longer
 * than the bound is under it, both without inspecting a character. Only the
 * narrow band between those two needs counting, and that count stops the
 * moment it exceeds the bound. Materializing the whole string first - which is
 * what spreading it does - would make an adapter-supplied value decide how much
 * work this boundary performs, which is exactly what a bound exists to prevent.
 */
function isBoundedReference(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0) return false;
  if (value.length > transportReferenceMaxLength * 2) return false;
  if (value.length <= transportReferenceMaxLength) return true;
  let codePoints = 0;
  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index);
    index += codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
    codePoints += 1;
    if (codePoints > transportReferenceMaxLength) return false;
  }
  return true;
}

/** The exact own properties a transport attempt declares. */
const attemptKeys = ['reference', 'outcome'] as const;

/**
 * A transport attempt is a **closed runtime shape**, like the outcome that
 * carries it.
 *
 * It is the value the whole run's accounting is keyed by: two outcomes sharing
 * one reference are counted once, and a reference claiming two endings fails
 * the run closed. Admitting it on the strength of two readable fields would let
 * an adapter hang a URL, a response body or a provider identifier on the one
 * object the coordinator retains and compares - enumerable, non-enumerable or
 * symbol-keyed, none of which a two-field check can see.
 *
 * Nothing is coerced, a required field inherited from a prototype is not an
 * attempt, and a throwing accessor is contained here rather than escaping into
 * attribution.
 */
function readAttempt(outcome: object): NormalizedTransportAttempt | null {
  const field = ownDataProperty(outcome, 'attempt');
  if (field === null) return null;
  const value = field.value;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const allowed = new Set<string>(attemptKeys);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) return null;
  }
  // Absent, inherited and accessor-backed are all `null` here, so the required
  // -own-property rule and the read-once rule are the same single step.
  const reference = ownDataProperty(value, 'reference');
  const attemptOutcome = ownDataProperty(value, 'outcome');
  if (reference === null || attemptOutcome === null) return null;
  if (!isBoundedReference(reference.value)) return null;
  if (!isAttemptOutcome(attemptOutcome.value)) return null;
  return { reference: reference.value, outcome: attemptOutcome.value };
}

function isAttemptOutcome(value: unknown): value is ProviderAttemptOutcome {
  return (
    value === 'successful' || value === 'failed' || value === 'rate-limited'
  );
}

/**
 * A candidate payload has to be a plain object before anything asks what it
 * contains.
 *
 * `typeof null === 'object'` and `typeof [] === 'object'` are both true, so
 * without this neither is refused here: `null` reaches a property read and an
 * array reaches a discriminant comparison it can only fail by accident. The
 * payload's actual contract is still decided by `payloadMatchesResource`; this
 * is only the precondition that makes asking meaningful.
 */
function isCandidatePayload(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
function readSuccessfulAttempt(
  outcome: object,
): NormalizedTransportAttempt | null {
  const attempt = readAttempt(outcome);
  return attempt !== null && attempt.outcome === 'successful' ? attempt : null;
}

/**
 * One optional retry hint, taken once and validated once.
 *
 * Three answers, not two: the key may be legitimately **absent**, may carry a
 * valid instant, or may be present as something a scheduler must never be
 * handed. The outer `null` is the third - it means the whole outcome is
 * malformed - so an invalid hint can never be silently downgraded to "no
 * hint", and an accessor can never answer an instant to validation and a URL,
 * a token or an unbounded string to the log line that carries it.
 *
 * `retryAt: undefined` remains an accepted absence: it is an own data property
 * whose value is exactly what "no hint" means, and the declared shape already
 * admits the key.
 */
function readOptionalInstant(
  outcome: object,
  key: 'retryAt' | 'retryAfter',
): { readonly value: string | null } | null {
  const descriptor = Object.getOwnPropertyDescriptor(outcome, key);
  if (descriptor === undefined) return { value: null };
  if (!('value' in descriptor)) return null;
  const hint: unknown = descriptor.value;
  if (hint === undefined) return { value: null };
  return isInstant(hint) ? { value: hint } : null;
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
  record: object,
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

/** One transport attempt, as **the coordinator's own** copied primitives. */
export interface NormalizedTransportAttempt {
  readonly reference: string;
  readonly outcome: ProviderAttemptOutcome;
}

/**
 * The coordinator's detached copy of one candidate payload.
 *
 * A closed two-state answer rather than a nullable payload: `null` is a value
 * a payload could in principle carry, so "could not be detached" needs to be
 * unrepresentable as data.
 */
export type CandidatePayloadSnapshot =
  | { readonly detached: true; readonly payload: unknown }
  | { readonly detached: false };

/**
 * What the coordinator keeps of an adapter's answer.
 *
 * Structurally the same union as `ProviderResourceOutcome`, with two
 * deliberate differences: every field is a value this module copied out of the
 * adapter's object rather than a reference into it, and the optional retry
 * hints are resolved to `string | null` so no consumer has to re-read them.
 * Nothing downstream ever holds the adapter's object again.
 */
export type NormalizedProviderOutcome =
  | {
      readonly outcome: 'candidate';
      readonly attempt: NormalizedTransportAttempt;
      readonly payload: CandidatePayloadSnapshot;
    }
  | {
      readonly outcome: 'not-attempted';
      readonly reason: NotAttemptedReason;
      readonly retryAt: string | null;
    }
  | {
      readonly outcome: 'failed';
      readonly attempt: NormalizedTransportAttempt;
      readonly reason: AttemptedFailureReason;
      readonly retryAfter: string | null;
    }
  | {
      readonly outcome: 'mapping-failure';
      readonly attempt: NormalizedTransportAttempt;
    };

/**
 * Takes the coordinator's own copy of one candidate payload.
 *
 * `structuredClone` is the platform's own deep-detachment primitive, supported
 * by both the Workers runtime and the Node test runtime. It is used in
 * preference to a JSON round trip because a round trip is a *normalization*,
 * not a copy: it drops `undefined` members, coerces values through `toJSON`,
 * and turns unsupported values into silently different data. Every normalized
 * contract payload is JSON-like - plain objects, arrays, strings, numbers,
 * booleans and `null`, with no date, map, set, typed array or class instance
 * anywhere - so structured cloning preserves each one exactly, while a value
 * outside that contract fails loudly here instead of quietly changing.
 *
 * **Its own containment, deliberately.** A non-cloneable payload is a
 * malformed *payload*, not an untrustworthy *outcome*: the request behind it
 * really left GridView and its attempt has already been validated. Letting the
 * throw escape to the enclosing boundary would discard that attempt and
 * under-report a real request, so the failure is answered as data here and the
 * attempt survives.
 */
function detachPayload(payload: unknown): CandidatePayloadSnapshot {
  try {
    return { detached: true, payload: structuredClone(payload) };
  } catch {
    // Adapter-controlled: the thrown value is never read, logged or re-raised.
    return { detached: false };
  }
}

/**
 * Parses an adapter outcome into a value the coordinator owns.
 *
 * An adapter is an input boundary: it may be a future third-party-shaped
 * module, a fixture double or a partially migrated implementation. A malformed
 * outcome must fail closed as an unavailable contribution, never throw out of
 * the coordinator and never be partially believed. Returns `null` for anything
 * that is not a well-formed outcome, and **never throws**.
 *
 * **Why a parser and not a predicate.** Validating leaves the adapter owning
 * every value, and validation and use are not the same moment: attribution
 * runs after the whole plan has executed. An adapter that refills one object
 * for its next request, mutates what it returned, or answers from a getter can
 * therefore change what a checked outcome *says* between the check and the
 * use - turning a candidate into a failure, hiding a real request behind
 * another request's reference, or handing a validated instant to `isInstant`
 * and an unbounded provider string to the log line. So each declared field is
 * taken **once**, through `Object.getOwnPropertyDescriptor`, and the copied
 * primitives are what the coordinator keeps. Aliasing is a property of the
 * boundary, not of any one implementation on the far side of it.
 *
 * The order is fixed and each step is a precondition for the next:
 *
 * 1. **A non-null, non-array object.** Nothing else can be an outcome.
 * 2. **The discriminant, as an own data property.** It decides which shape
 *    applies, so it is the only field read before shape closure - and it is
 *    read the same way as every other, because a getter-backed discriminant
 *    could otherwise select one shape and then be a different variant.
 * 3. **Shape closure.** Exactly the own keys this variant declares, every
 *    required one present, and no key another variant declares reachable even
 *    through the prototype. `Reflect.ownKeys` sees symbol-keyed and
 *    non-enumerable own properties; `in` sees planted prototype fields.
 * 4. **Each declared field, once, as an own data property.** An inherited or
 *    accessor-backed declared field is not this variant either.
 * 5. **Value validation of what was taken** - never of a second read.
 * 6. **Internal consistency.** A `candidate` and a `mapping-failure` require a
 *    `successful` attempt, and an attempted failure must pair its reason with
 *    an attempt outcome `attemptOutcomesForFailureReason` allows. An outcome
 *    claiming usable data while reporting failed transport, or a `429` reason
 *    over a successful transport, describes no possible run.
 * 7. **Detachment of the payload**, so the value bound to the resource is the
 *    value published.
 *
 * The payload's match against the *requested resource* is checked separately
 * by `payloadMatchesResource`, against the detached snapshot returned here, so
 * a structurally valid outcome carrying another resource's data is still
 * rejected - and cannot become a third value afterwards.
 */
export function readProviderOutcome(
  value: unknown,
): NormalizedProviderOutcome | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    const discriminant = ownDataProperty(value, 'outcome');
    if (discriminant === null) return null;
    const variant = discriminant.value;
    if (!isOutcomeVariant(variant)) return null;
    // Shape closure decides membership before any other field is taken, so
    // nothing on a malformed outcome - least of all an attempt it must not
    // carry - is inspected, registered or counted.
    if (!hasClosedShape(value, variant)) return null;

    switch (variant) {
      case 'candidate': {
        // A contradictory candidate is a coordination failure, not an
        // attempted one: nothing it claims can be believed, including its own
        // attempt record, so no request activity is invented from it either.
        const attempt = readSuccessfulAttempt(value);
        if (attempt === null) return null;
        const payload = ownDataProperty(value, 'payload');
        if (payload === null || !isCandidatePayload(payload.value)) return null;
        return {
          outcome: 'candidate',
          attempt,
          payload: detachPayload(payload.value),
        };
      }
      case 'not-attempted': {
        const reason = ownDataProperty(value, 'reason');
        if (
          reason === null ||
          !(notAttemptedReasons as readonly unknown[]).includes(reason.value)
        ) {
          return null;
        }
        const retryAt = readOptionalInstant(value, 'retryAt');
        if (retryAt === null) return null;
        return {
          outcome: 'not-attempted',
          reason: reason.value as NotAttemptedReason,
          retryAt: retryAt.value,
        };
      }
      case 'failed': {
        const attempt = readAttempt(value);
        if (attempt === null) return null;
        const reason = ownDataProperty(value, 'reason');
        if (reason === null || !isAttemptedFailureReason(reason.value)) {
          return null;
        }
        if (
          !attemptOutcomesForFailureReason(reason.value).includes(
            attempt.outcome,
          )
        ) {
          return null;
        }
        const retryAfter = readOptionalInstant(value, 'retryAfter');
        if (retryAfter === null) return null;
        return {
          outcome: 'failed',
          attempt,
          reason: reason.value,
          retryAfter: retryAfter.value,
        };
      }
      case 'mapping-failure': {
        // The mapping boundary runs on a response that was read, so the
        // request behind it always succeeded (see
        // `ProviderTransportAttempt.outcome`).
        const attempt = readSuccessfulAttempt(value);
        return attempt === null
          ? null
          : { outcome: 'mapping-failure', attempt };
      }
    }
  } catch {
    // A hostile proxy: `ownKeys`, `has` and `getOwnPropertyDescriptor` are all
    // adapter-reachable traps. The thrown value is never read, logged or
    // re-raised - it can embed a URL, a provider body or a stack.
    return null;
  }
}

/**
 * Whether an adapter outcome is well formed.
 *
 * A thin view over `readProviderOutcome`, so the predicate and the parser can
 * never disagree about what the boundary accepts.
 */
export function isWellFormedOutcome(value: unknown): boolean {
  return readProviderOutcome(value) !== null;
}
