import { quotaPolicyFor } from '../provider-source';
import {
  currentHeadroom,
  emptyLedger,
  isRealProviderSourceId,
  reconcileLedger,
  reserve,
  type LimitingWindow,
  type RealProviderSourceId,
  type ReservationLedger,
  type WindowHeadroom,
} from './reservation-engine';

/**
 * The authoritative, globally consistent per-source reservation coordinator
 * (gap G7).
 *
 * One Durable Object **identity per canonical real source**, derived with
 * `idFromName(sourceId)`, so every GridView isolate in every Cloudflare
 * location contends for the same single budget. See ADR 0021 for why isolate
 * state, Workers KV and the Workers Rate Limiting binding were all rejected as
 * the authority.
 *
 * The object never sleeps, retries or holds a request until capacity returns:
 * it answers immediately with a decision and, when deferred, a deterministic
 * `retryAt` for a future scheduler to use.
 *
 * ## Upstream hold (AU-4 step 2, 2026-11-03)
 *
 * The windows count only GridView's own sends, so they cannot see what the
 * provider is enforcing. On staging, Jolpica answered `429` to 20 of 23
 * requests paced inside its published limits, and every later reservation was
 * still `allowed`. The object therefore also keeps an **upstream hold**: the
 * HTTP boundary reports each `429` (`recordRateLimit`), and until the hold
 * ends every reservation for that source - from any run, isolate or trigger -
 * is `deferred` with `cause: 'provider-hold'`. The hold honours `Retry-After`,
 * is never shorter than `minimumUpstreamHoldMillis` (a `429` without the
 * header is the common case) and never longer than `maximumUpstreamHoldMillis`
 * (a provider-controlled header must not silence GridView indefinitely). A
 * later report can only extend it.
 */

/** Storage key holding the reservation ledger for this object's source. */
const ledgerStorageKey = 'reservation-ledger';

/** Storage key holding the upstream hold for this object's source. */
const upstreamHoldStorageKey = 'upstream-hold';

/** Internal URL used to address the object. Never logged, never external. */
export const reservationRequestUrl = 'https://provider-rate-limiter/reserve';

/** Internal URL a `429` is reported to. Never logged, never external. */
export const rateLimitReportUrl = 'https://provider-rate-limiter/rate-limited';

/**
 * The shortest upstream hold. Chosen, not published: Jolpica sent no
 * `Retry-After` on most of the observed `429`s and about 10 s on the rest.
 */
export const minimumUpstreamHoldMillis = 60_000;

/** The longest upstream hold, whatever `Retry-After` asks for. */
export const maximumUpstreamHoldMillis = 6 * 60 * 60 * 1000;

/**
 * When an upstream hold reported at `at` ends: the provider's `Retry-After`
 * instant when it is a valid instant, bounded to
 * [`minimumUpstreamHoldMillis`, `maximumUpstreamHoldMillis`] after `at`.
 * Pure, so the object and the per-run pacer compute the same instant.
 */
export function upstreamHoldUntil(at: Date, retryAfter: string | null): number {
  const atMillis = at.getTime();
  const floor = atMillis + minimumUpstreamHoldMillis;
  const ceiling = atMillis + maximumUpstreamHoldMillis;
  const requested = retryAfter === null ? Number.NaN : Date.parse(retryAfter);
  if (!Number.isFinite(requested)) return floor;
  return Math.min(ceiling, Math.max(floor, requested));
}

export type ReservationOutcome =
  | {
      readonly outcome: 'allowed';
      readonly sourceId: RealProviderSourceId;
      readonly headroom: readonly WindowHeadroom[];
    }
  | {
      readonly outcome: 'deferred';
      readonly sourceId: RealProviderSourceId;
      readonly retryAt: string;
      /** Empty for an upstream hold: no GridView window is exhausted. */
      readonly limitingWindows: readonly LimitingWindow[];
      readonly headroom: readonly WindowHeadroom[];
      /** Present only when an upstream hold, not a window, defers. */
      readonly cause?: 'provider-hold';
    }
  | {
      /** Fail closed: issue no request. */
      readonly outcome: 'unavailable';
      readonly sourceId: RealProviderSourceId;
      /** Bounded cause. Never carries a stored value, key or object id. */
      readonly reason: ReservationUnavailableReason;
    };

/** Closed set of reasons the limiter could not grant. */
export type ReservationUnavailableReason =
  /** No binding, unreachable object, or an unusable response. */
  | 'limiter-unreachable'
  /** The object's storage read or write failed. */
  | 'storage-failure'
  /** Persisted state exists but is not usable. See `readLedger`. */
  | 'state-corrupt';

/**
 * The subset of `DurableObjectState` the coordinator uses. `DurableObjectState`
 * is structurally assignable to it, so tests can supply an in-memory fake
 * without a Workers runtime.
 */
export interface ReservationHost {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
  };
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

interface StoredLedger {
  sourceId?: unknown;
  timestamps?: unknown;
}

/**
 * A reservation timestamp must be a finite, non-negative integer number of
 * milliseconds: that is the only thing the object's own clock can have
 * written. Anything else is corruption, not an old entry.
 */
function isReservationTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

type LedgerRead =
  /** Nothing stored yet. A genuinely new source starts with full capacity. */
  | { readonly kind: 'missing' }
  | { readonly kind: 'valid'; readonly ledger: ReservationLedger }
  /** Present but unusable. Must fail closed, never be reinterpreted. */
  | { readonly kind: 'corrupt' };

/**
 * Classifies the stored record without ever repairing it.
 *
 * **Absent and invalid are different things.** Missing state means a new
 * source and may start empty. Present-but-invalid state must fail closed:
 * dropping an unreadable entry would *reduce the active count* and hand back
 * capacity whose safety cannot be established, and adopting a record written
 * for another source would let one budget be spent as another's.
 *
 * Nothing here deletes, resets, relabels or rewrites the stored value. A
 * corrupt ledger blocks that source until it is repaired out of band; there is
 * deliberately no automatic recovery path.
 */
function readLedger(
  raw: StoredLedger | undefined,
  sourceId: RealProviderSourceId,
): LedgerRead {
  // Absence is `undefined` and nothing else. A stored `null` is a value that
  // is *present* and unusable - it says nothing about prior usage - so
  // initialising an empty ledger from it would hand back capacity that may
  // already have been spent.
  if (raw === undefined) return { kind: 'missing' };
  if (raw === null) return { kind: 'corrupt' };
  if (typeof raw !== 'object') return { kind: 'corrupt' };
  // A record belonging to another source is never adopted, and never
  // relabelled to this one.
  if (raw.sourceId !== sourceId) return { kind: 'corrupt' };
  if (!Array.isArray(raw.timestamps)) return { kind: 'corrupt' };
  if (!raw.timestamps.every(isReservationTimestamp)) return { kind: 'corrupt' };
  return {
    kind: 'valid',
    ledger: { sourceId, timestamps: raw.timestamps },
  };
}

interface StoredHold {
  sourceId?: unknown;
  until?: unknown;
}

type HoldRead =
  | { readonly kind: 'none' }
  | { readonly kind: 'valid'; readonly until: number }
  | { readonly kind: 'corrupt' };

/**
 * Classifies the stored upstream hold exactly as `readLedger` classifies the
 * ledger: absence is no hold, anything present and unusable fails closed and
 * is never rewritten, and a record for another source is never adopted.
 */
function readHold(
  raw: StoredHold | undefined,
  sourceId: RealProviderSourceId,
): HoldRead {
  if (raw === undefined) return { kind: 'none' };
  if (raw === null || typeof raw !== 'object') return { kind: 'corrupt' };
  if (raw.sourceId !== sourceId) return { kind: 'corrupt' };
  if (!isReservationTimestamp(raw.until)) return { kind: 'corrupt' };
  return { kind: 'valid', until: raw.until };
}

/** The answer to a `429` report. */
export type RateLimitReportOutcome =
  | {
      readonly outcome: 'held';
      readonly sourceId: RealProviderSourceId;
      /** When the hold, after this report, ends. */
      readonly until: string;
    }
  | {
      readonly outcome: 'unavailable';
      readonly sourceId: RealProviderSourceId;
      readonly reason: ReservationUnavailableReason;
    };

/**
 * The reservation logic, independent of the Durable Object wrapper so it can
 * be driven directly by tests over a fake host and a fixed clock.
 */
export class ReservationCoordinator {
  constructor(
    private readonly host: ReservationHost,
    /** Trusted time source. Production uses the runtime clock, never a caller. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
    // `blockConcurrencyWhile` serializes the whole read-modify-write, so two
    // in-flight reservations can never both read the same pre-state and
    // oversubscribe a window.
    //
    // The callback body is wrapped so it CANNOT throw. Cloudflare documents
    // that an exception escaping `blockConcurrencyWhile` terminates and resets
    // the Durable Object, so a transient storage error or a corrupt ledger
    // would tear down the shared limiter for every caller instead of failing
    // this one request. Failing closed to `unavailable` keeps the object alive
    // and still issues no provider request.
    return this.host.blockConcurrencyWhile(async () => {
      try {
        return await this.decide(sourceId);
      } catch {
        return {
          outcome: 'unavailable',
          sourceId,
          reason: 'storage-failure',
        } as const;
      }
    });
  }

  /**
   * Records that the provider answered `429` for `sourceId`, holding every
   * reservation for it until `upstreamHoldUntil(now, retryAfter)` - or longer,
   * if a hold already runs past that. Serialized like `reserve`, and equally
   * unable to throw out of `blockConcurrencyWhile`.
   */
  async recordRateLimit(
    sourceId: RealProviderSourceId,
    retryAfter: string | null,
  ): Promise<RateLimitReportOutcome> {
    return this.host.blockConcurrencyWhile(async () => {
      try {
        const at = this.now();
        const read = readHold(
          await this.host.storage.get<StoredHold>(upstreamHoldStorageKey),
          sourceId,
        );
        if (read.kind === 'corrupt') {
          return {
            outcome: 'unavailable',
            sourceId,
            reason: 'state-corrupt',
          } as const;
        }
        const reported = upstreamHoldUntil(at, retryAfter);
        const until =
          read.kind === 'valid' ? Math.max(read.until, reported) : reported;
        if (read.kind !== 'valid' || until !== read.until) {
          await this.host.storage.put(upstreamHoldStorageKey, {
            sourceId,
            until,
          });
        }
        return {
          outcome: 'held',
          sourceId,
          until: new Date(until).toISOString(),
        } as const;
      } catch {
        return {
          outcome: 'unavailable',
          sourceId,
          reason: 'storage-failure',
        } as const;
      }
    });
  }

  private async decide(
    sourceId: RealProviderSourceId,
  ): Promise<ReservationOutcome> {
    const at = this.now();
    const stored = await this.host.storage.get<StoredLedger>(ledgerStorageKey);
    const read = readLedger(stored, sourceId);
    if (read.kind === 'corrupt') {
      // Fail closed and leave the record exactly as found.
      return { outcome: 'unavailable', sourceId, reason: 'state-corrupt' };
    }
    const hold = readHold(
      await this.host.storage.get<StoredHold>(upstreamHoldStorageKey),
      sourceId,
    );
    if (hold.kind === 'corrupt') {
      return { outcome: 'unavailable', sourceId, reason: 'state-corrupt' };
    }
    const ledger = reconcileLedger(
      read.kind === 'valid' ? read.ledger : emptyLedger(sourceId),
      sourceId,
      at,
    );
    if (hold.kind === 'valid' && hold.until > at.getTime()) {
      // The provider asked GridView to stop. No window is consumed and the
      // ledger is not written: a held reservation is not a reservation.
      return {
        outcome: 'deferred',
        sourceId,
        retryAt: new Date(hold.until).toISOString(),
        limitingWindows: [],
        headroom: currentHeadroom(ledger, quotaPolicyFor(sourceId), at),
        cause: 'provider-hold',
      };
    }
    const decision = reserve(ledger, quotaPolicyFor(sourceId), at);

    if (decision.outcome === 'allowed') {
      await this.host.storage.put(ledgerStorageKey, {
        sourceId,
        timestamps: decision.ledger.timestamps,
      });
      return {
        outcome: 'allowed',
        sourceId,
        headroom: decision.headroom,
      };
    }

    // Deferred: no window was mutated. Persist the pruned ledger only when
    // pruning actually removed something, so a denial stays side-effect free
    // with respect to capacity while storage stays bounded.
    if (decision.ledger.timestamps.length !== ledger.timestamps.length) {
      await this.host.storage.put(ledgerStorageKey, {
        sourceId,
        timestamps: decision.ledger.timestamps,
      });
    }
    return {
      outcome: 'deferred',
      sourceId,
      retryAt: decision.retryAt,
      limitingWindows: decision.limitingWindows,
      headroom: decision.headroom,
    };
  }
}

/**
 * The Durable Object class registered as `PROVIDER_RATE_LIMITER`.
 *
 * Uses the classic `(state, env)` + `fetch` object interface, which needs no
 * `cloudflare:workers` import and therefore stays loadable in the repository's
 * plain-Node test runner.
 *
 * The reservation timestamp is taken from the object's own clock. The request
 * body carries only the canonical source id, so **a caller cannot choose the
 * reservation time**.
 */
export class ProviderRateLimiter {
  private readonly coordinator: ReservationCoordinator;

  constructor(state: ReservationHost) {
    this.coordinator = new ReservationCoordinator(state);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method-not-allowed' }, 405);
    }
    let sourceId: unknown;
    let retryAfter: unknown;
    try {
      const body = (await request.json()) as {
        sourceId?: unknown;
        retryAfter?: unknown;
      };
      sourceId = body.sourceId;
      retryAfter = body.retryAfter;
    } catch {
      return jsonResponse({ error: 'invalid-request' }, 400);
    }
    if (!isRealProviderSourceId(sourceId)) {
      // Source identity fails closed before any state is read or mutated.
      return jsonResponse({ error: 'invalid-source' }, 400);
    }
    if (
      new URL(request.url).pathname === new URL(rateLimitReportUrl).pathname
    ) {
      // `null` or a canonical instant, nothing else: a malformed value is
      // refused rather than read as "no Retry-After".
      const instant = retryAfter === null ? null : decodeInstant(retryAfter);
      if (retryAfter !== null && instant === null) {
        return jsonResponse({ error: 'invalid-request' }, 400);
      }
      try {
        const outcome = await this.coordinator.recordRateLimit(
          sourceId,
          instant,
        );
        return jsonResponse(outcome, 200);
      } catch {
        return jsonResponse({ error: 'reservation-unavailable' }, 500);
      }
    }
    try {
      const outcome = await this.coordinator.reserve(sourceId);
      return jsonResponse(outcome, 200);
    } catch {
      // A storage or coordination failure must never read as "allowed". The
      // client maps a non-OK response to `unavailable`, and the HTTP boundary
      // then issues no provider request. The raw error is never surfaced.
      return jsonResponse({ error: 'reservation-unavailable' }, 500);
    }
  }
}

const unavailableReasons: readonly ReservationUnavailableReason[] = [
  'limiter-unreachable',
  'storage-failure',
  'state-corrupt',
];

function unreachable(sourceId: RealProviderSourceId): ReservationOutcome {
  return { outcome: 'unavailable', sourceId, reason: 'limiter-unreachable' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown, limit: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= limit
  );
}

/**
 * Validates headroom against the **current typed policy** for the source:
 * exactly one entry per declared window, no duplicate, no unknown window, and
 * an integer remaining count within that window's published limit.
 *
 * A version-skewed object that omits a window, invents one, or reports an
 * impossible count is therefore rejected rather than partially believed.
 */
function decodeHeadroom(
  value: unknown,
  sourceId: RealProviderSourceId,
): WindowHeadroom[] | null {
  if (!Array.isArray(value)) return null;
  const policy = quotaPolicyFor(sourceId);
  if (value.length !== policy.windows.length) return null;

  const decoded: WindowHeadroom[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const windowPolicy = policy.windows.find(
      (candidate) => candidate.window === entry.window,
    );
    if (!windowPolicy) return null;
    if (seen.has(windowPolicy.window)) return null;
    seen.add(windowPolicy.window);
    if (entry.limit !== windowPolicy.limit) return null;
    if (!isCount(entry.remaining, windowPolicy.limit)) return null;
    decoded.push({
      window: windowPolicy.window,
      limit: windowPolicy.limit,
      remaining: entry.remaining,
    });
  }
  return decoded.length === policy.windows.length ? decoded : null;
}

/** A syntactically valid, finite ISO-8601 UTC instant. */
function decodeInstant(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  // Round-tripping rejects a lax string that `Date.parse` would accept but
  // that is not the ISO UTC form the object emits.
  return new Date(parsed).toISOString() === value ? value : null;
}

function decodeLimitingWindows(
  value: unknown,
  sourceId: RealProviderSourceId,
): LimitingWindow[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const policy = quotaPolicyFor(sourceId);
  if (value.length > policy.windows.length) return null;

  const decoded: LimitingWindow[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const windowPolicy = policy.windows.find(
      (candidate) => candidate.window === entry.window,
    );
    if (!windowPolicy) return null;
    if (seen.has(windowPolicy.window)) return null;
    seen.add(windowPolicy.window);
    if (entry.limit !== windowPolicy.limit) return null;
    const retryAt = decodeInstant(entry.retryAt);
    if (retryAt === null) return null;
    decoded.push({
      window: windowPolicy.window,
      limit: windowPolicy.limit,
      retryAt,
    });
  }
  return decoded;
}

/**
 * Exhaustively decodes a Durable Object response before any field is used.
 *
 * Every downstream consumer - `headroomCounts` included - receives only a
 * value produced here, so a partial, version-skewed, cross-source or malformed
 * body cannot reach it, throw into synchronization, or be mistaken for a
 * granted reservation. Anything that fails validation becomes `null`, which
 * the caller maps to the fail-closed `limiter-unreachable` outcome.
 *
 * `retryAt` is checked for syntactic and numeric validity only. It is
 * deliberately **not** required to be in the future: the object's clock and
 * the client's can differ, and rejecting a legitimate decision over ordinary
 * skew would fail unpredictably in the wrong direction.
 */
export function decodeReservationOutcome(
  value: unknown,
  sourceId: RealProviderSourceId,
): ReservationOutcome | null {
  if (!isRecord(value)) return null;
  // An outcome naming another source is never trusted, whatever else it says.
  if (value.sourceId !== sourceId) return null;

  if (value.outcome === 'allowed') {
    const headroom = decodeHeadroom(value.headroom, sourceId);
    if (!headroom) return null;
    return { outcome: 'allowed', sourceId, headroom };
  }

  if (value.outcome === 'deferred') {
    const headroom = decodeHeadroom(value.headroom, sourceId);
    if (!headroom) return null;
    const retryAt = decodeInstant(value.retryAt);
    if (retryAt === null) return null;
    if (value.cause === 'provider-hold') {
      // A hold exhausts no window, so it names none.
      if (!Array.isArray(value.limitingWindows)) return null;
      if (value.limitingWindows.length !== 0) return null;
      return {
        outcome: 'deferred',
        sourceId,
        retryAt,
        limitingWindows: [],
        headroom,
        cause: 'provider-hold',
      };
    }
    // A window deferral carries no cause; any other value is version skew.
    if (value.cause !== undefined) return null;
    const limitingWindows = decodeLimitingWindows(
      value.limitingWindows,
      sourceId,
    );
    if (!limitingWindows) return null;
    return {
      outcome: 'deferred',
      sourceId,
      retryAt,
      limitingWindows,
      headroom,
    };
  }

  if (value.outcome === 'unavailable') {
    if (
      !unavailableReasons.includes(value.reason as ReservationUnavailableReason)
    ) {
      return null;
    }
    return {
      outcome: 'unavailable',
      sourceId,
      reason: value.reason as ReservationUnavailableReason,
    };
  }

  return null;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Client seam so the HTTP boundary can be tested without a Workers runtime. */
export interface ProviderRateLimiterClient {
  reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome>;
  /**
   * Reports that the provider answered `429` (`retryAfter`: its parsed
   * `Retry-After`, or `null`). Optional: a client that cannot hold - a test
   * double, the unbound limiter - simply has none. Must never throw; the
   * HTTP boundary also guards the call.
   */
  recordRateLimited?(
    sourceId: RealProviderSourceId,
    retryAfter: string | null,
  ): Promise<void>;
}

/**
 * Routes a reservation to the single global Durable Object for that source.
 *
 * Any binding, dispatch, transport or decoding failure resolves to
 * `unavailable`, which the HTTP boundary treats as fail-closed: no provider
 * request is issued.
 */
export class DurableObjectRateLimiterClient implements ProviderRateLimiterClient {
  constructor(private readonly namespace: DurableObjectNamespace) {}

  async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
    try {
      // `idFromName` is deterministic, so every isolate in every location
      // reaches the same object for this source.
      const id = this.namespace.idFromName(sourceId);
      const stub = this.namespace.get(id);
      const response = await stub.fetch(reservationRequestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });
      if (!response.ok) {
        return unreachable(sourceId);
      }
      // Every field is validated before anything downstream sees it.
      // Malformed JSON, a partial body, an unknown outcome or reason, a
      // cross-source answer or an impossible count all fail closed here.
      return (
        decodeReservationOutcome(await response.json(), sourceId) ??
        unreachable(sourceId)
      );
    } catch {
      return unreachable(sourceId);
    }
  }

  /**
   * Reports a `429` to the source's object. Best effort and silent: a lost
   * report leaves the per-run pacer's own hold in force for the rest of the
   * run, and the global hold simply does not start.
   */
  async recordRateLimited(
    sourceId: RealProviderSourceId,
    retryAfter: string | null,
  ): Promise<void> {
    try {
      const stub = this.namespace.get(this.namespace.idFromName(sourceId));
      const response = await stub.fetch(rateLimitReportUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, retryAfter }),
      });
      await response.body?.cancel();
    } catch {
      // Nothing to surface: see above.
    }
  }
}
