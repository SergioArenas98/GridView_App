import { quotaPolicyFor } from '../provider-source';
import {
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
 */

/** Storage key holding the reservation ledger for this object's source. */
const ledgerStorageKey = 'reservation-ledger';

/** Internal URL used to address the object. Never logged, never external. */
export const reservationRequestUrl = 'https://provider-rate-limiter/reserve';

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
      readonly limitingWindows: readonly LimitingWindow[];
      readonly headroom: readonly WindowHeadroom[];
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
    const ledger = reconcileLedger(
      read.kind === 'valid' ? read.ledger : emptyLedger(sourceId),
      sourceId,
      at,
    );
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
    try {
      const body = (await request.json()) as { sourceId?: unknown };
      sourceId = body.sourceId;
    } catch {
      return jsonResponse({ error: 'invalid-request' }, 400);
    }
    if (!isRealProviderSourceId(sourceId)) {
      // Source identity fails closed before any state is read or mutated.
      return jsonResponse({ error: 'invalid-source' }, 400);
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
    const limitingWindows = decodeLimitingWindows(
      value.limitingWindows,
      sourceId,
    );
    if (!limitingWindows) return null;
    const retryAt = decodeInstant(value.retryAt);
    if (retryAt === null) return null;
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
}
