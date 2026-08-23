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
      /** Binding, object or storage failure. Fail closed: issue no request. */
      readonly outcome: 'unavailable';
      readonly sourceId: RealProviderSourceId;
    };

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

function readLedger(
  raw: StoredLedger | undefined,
  sourceId: RealProviderSourceId,
): ReservationLedger {
  if (!raw || raw.sourceId !== sourceId || !Array.isArray(raw.timestamps)) {
    // Missing, corrupt or belonging to another source: start clean rather than
    // adopt state that is not provably this source's.
    return emptyLedger(sourceId);
  }
  return {
    sourceId,
    timestamps: raw.timestamps.filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value),
    ),
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
        return { outcome: 'unavailable', sourceId } as const;
      }
    });
  }

  private async decide(
    sourceId: RealProviderSourceId,
  ): Promise<ReservationOutcome> {
    {
      const at = this.now();
      const stored =
        await this.host.storage.get<StoredLedger>(ledgerStorageKey);
      const ledger = reconcileLedger(
        readLedger(stored, sourceId),
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
      if (!response.ok) return { outcome: 'unavailable', sourceId };
      const decoded = (await response.json()) as ReservationOutcome;
      if (decoded.outcome === 'allowed' || decoded.outcome === 'deferred') {
        if (decoded.sourceId !== sourceId) {
          return { outcome: 'unavailable', sourceId };
        }
        return decoded;
      }
      return { outcome: 'unavailable', sourceId };
    } catch {
      return { outcome: 'unavailable', sourceId };
    }
  }
}
