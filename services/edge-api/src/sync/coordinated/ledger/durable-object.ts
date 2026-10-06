/**
 * The `ReconciliationLedger` Durable Object class, and the client that would
 * address it (G9 storage foundation; runtime activation decision O-6).
 *
 * One **global** instance, addressed by the stable name `reconciliation`, not
 * one per season: the operator-review backlog capacity is global across
 * seasons, and only one object's transaction can count it atomically. Season
 * leases live inside that one object, so unrelated seasons still never share a
 * lease.
 *
 * ## Exported; registered and bound for staging only
 *
 * The class is a named export of the Worker entry point. **Exporting it
 * provisions nothing**: Wrangler uploads a Durable Object class's lifecycle
 * only from a declared `exports` entry (or a migration). `wrangler.toml`
 * declares one, and the `RECONCILIATION_LEDGER` binding, for `env.staging`
 * only; a deployment of that configuration, not the declaration, would
 * provision the namespace. The client below is constructed only by
 * `ledgerClientFor`, which `resolveReconciliationLedger` calls with that
 * optional binding. Development and production declare no binding, so there
 * the resolver answers `null` and every coordinated run stops at
 * `ledger-unbound`.
 *
 * ## Why the classic `fetch` interface
 *
 * The same reason `ProviderRateLimiter` and `SeasonPublicationSequencer` use
 * it: it needs no `cloudflare:workers` import, so the module stays loadable in
 * the repository's plain-Node test runner.
 *
 * `blockConcurrencyWhile` is deliberately absent. Each command is one
 * synchronous storage transaction with no subrequest inside it, which the
 * input gate already serializes. `rotate-verifications` awaits one digest
 * between a read and its transaction; the transaction re-reads everything it
 * decides on and refuses a history that changed in between, so no
 * interleaved command can make it act on stale state.
 */

import {
  durableObjectSequencerHost,
  type SequencerDurableHost,
} from '../../../publication/sequencer/hosts';
import type { ReconciliationLedgerPort } from '../ledger-port';
import {
  RECONCILIATION_LEDGER_OBJECT_NAME,
  type DispositionRequest,
  type LeaseAcquisition,
  type LeaseRelease,
  type LeaseToken,
  type LedgerCommitOutcome,
  type LedgerCommitRequest,
  type LedgerReadOutcome,
  type LedgerRejection,
  type OperatorActionRequest,
  type OperatorTransitionOutcome,
  type PublishedReconciliationOutcome,
  type PublishedReconciliationRequest,
  type VerificationRequest,
  type VerificationRotationRequest,
} from './model';
import { hasExactLedgerKeys, isLedgerObject } from './records';
import { ReconciliationLedgerStore, type LedgerStoreOptions } from './store';
import {
  decodeLeaseGrant,
  decodeRounds,
  decodeSnapshot,
  isLedgerRejectionReason,
} from './wire-decoders';

/** Internal URL used to address the object. Never logged, never external. */
export const ledgerRequestUrl = 'https://reconciliation-ledger/call';

/** The closed set of commands the object answers. */
export const ledgerCommands = [
  'read-season',
  'acquire-lease',
  'release-lease',
  'commit',
  'reconcile-published',
  'operate',
  'dispose',
  'verify',
  'rotate-verifications',
] as const;

export type LedgerCommand = (typeof ledgerCommands)[number];

function isLedgerCommand(value: unknown): value is LedgerCommand {
  return ledgerCommands.includes(value as LedgerCommand);
}

/**
 * The Durable Object class the global ledger would run as.
 *
 * The store decodes every payload itself, so nothing here trusts a caller's
 * shape, and the object's own clock is the only time source.
 */
export class ReconciliationLedger {
  private readonly store: ReconciliationLedgerStore;

  constructor(state: SequencerDurableHost, options: LedgerStoreOptions = {}) {
    this.store = new ReconciliationLedgerStore(
      durableObjectSequencerHost(state),
      options,
    );
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method-not-allowed' }, 405);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'invalid-request' }, 400);
    }
    if (!isLedgerObject(body) || !isLedgerCommand(body.command)) {
      return jsonResponse({ error: 'invalid-command' }, 400);
    }
    try {
      return jsonResponse(await this.dispatch(body.command, body.payload), 200);
    } catch {
      // A storage failure must never read as a decision, and the raw error -
      // which can embed a storage key or a stack - never crosses.
      return jsonResponse({ error: 'ledger-unavailable' }, 500);
    }
  }

  private dispatch(command: LedgerCommand, payload: unknown): unknown {
    switch (command) {
      case 'read-season':
        return this.store.readSeason(payload);
      case 'acquire-lease':
        return this.store.acquireLease(payload);
      case 'release-lease':
        return this.store.releaseLease(payload);
      case 'commit':
        return this.store.commit(payload);
      case 'reconcile-published':
        return this.store.reconcilePublishedRevisions(payload);
      case 'operate':
        return this.store.operate(payload);
      case 'dispose':
        return this.store.dispose(payload);
      case 'verify':
        return this.store.verify(payload);
      case 'rotate-verifications':
        return this.store.rotateVerifications(payload);
    }
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * The minimum namespace surface the client needs. `DurableObjectNamespace` is
 * structurally assignable to it; a test supplies a fake one that dispatches
 * to a real object instance.
 */
export interface LedgerNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): {
    fetch(url: string, init: RequestInit): Promise<Response>;
  };
}

/**
 * Whether `binding` has the namespace surface the client needs. A binding
 * Wrangler supplies as a Durable Object namespace always has it; a variable,
 * a KV namespace or any other value under the same name does not.
 */
function isLedgerNamespace(binding: unknown): binding is LedgerNamespace {
  if (typeof binding !== 'object' || binding === null) return false;
  const candidate = binding as Partial<Record<keyof LedgerNamespace, unknown>>;
  return (
    typeof candidate.idFromName === 'function' &&
    typeof candidate.get === 'function'
  );
}

/**
 * The ledger client for an environment's optional `RECONCILIATION_LEDGER`
 * binding, or `null`.
 *
 * Fails closed: an absent binding, or one without a namespace's surface,
 * answers `null` - the caller's `ledger-unbound` - and never a client that
 * could act on something else. Constructing the client performs no lookup and
 * sends nothing; a namespace that later fails to answer is the client's own
 * bounded `unavailable` or `uncertain` outcome.
 */
export function ledgerClientFor(
  binding: unknown,
): ReconciliationLedgerPort | null {
  return isLedgerNamespace(binding)
    ? new DurableObjectReconciliationLedger(binding)
    : null;
}

/**
 * Routes every call to the one global ledger object.
 *
 * A transport, dispatch or decoding failure resolves to a bounded outcome,
 * never an exception and never something a caller could mistake for a
 * decision: `unavailable` for a read, an acquisition or a release, and
 * `uncertain` for a commit, a reconciliation or an operator transition, whose
 * write may have applied before its answer was lost. A response that decodes but describes another
 * season is treated the same way.
 */
export class DurableObjectReconciliationLedger implements ReconciliationLedgerPort {
  readonly ledger = 'reconciliation' as const;

  constructor(private readonly namespace: LedgerNamespace) {}

  async readSeason(season: number): Promise<LedgerReadOutcome> {
    const value = await this.call('read-season', { season });
    const rejection = decodeRejection(value);
    if (rejection !== null) return rejection;
    if (isOutcome(value, 'read', ['snapshot'])) {
      const snapshot = decodeSnapshot(value.snapshot, season);
      if (snapshot !== null) return { outcome: 'read', snapshot };
    }
    return { outcome: 'unavailable' };
  }

  async acquireLease(season: number): Promise<LeaseAcquisition> {
    const value = await this.call('acquire-lease', { season });
    const rejection = decodeRejection(value);
    if (rejection !== null) return rejection;
    if (isOutcome(value, 'acquired', ['lease', 'snapshot'])) {
      const lease = decodeLeaseGrant(value.lease, season);
      const snapshot = decodeSnapshot(value.snapshot, season);
      if (lease !== null && snapshot !== null) {
        return { outcome: 'acquired', lease, snapshot };
      }
    }
    return { outcome: 'unavailable' };
  }

  async releaseLease(lease: LeaseToken): Promise<LeaseRelease> {
    const value = await this.call('release-lease', lease);
    const rejection = decodeRejection(value);
    if (rejection !== null) return rejection;
    if (isOutcome(value, 'released', [])) return { outcome: 'released' };
    return { outcome: 'unavailable' };
  }

  async commit(request: LedgerCommitRequest): Promise<LedgerCommitOutcome> {
    const value = await this.call('commit', request);
    const rejection = decodeRejection(value);
    if (rejection !== null) return rejection;
    if (isOutcome(value, 'committed', ['snapshot'])) {
      const snapshot = decodeSnapshot(value.snapshot, request.lease.season);
      if (snapshot !== null) return { outcome: 'committed', snapshot };
    }
    return { outcome: 'uncertain' };
  }

  async reconcilePublishedRevisions(
    request: PublishedReconciliationRequest,
  ): Promise<PublishedReconciliationOutcome> {
    const value = await this.call('reconcile-published', request);
    const rejection = decodeRejection(value);
    if (rejection !== null) return rejection;
    if (isOutcome(value, 'reconciled', ['snapshot', 'unrecordedRounds'])) {
      const snapshot = decodeSnapshot(value.snapshot, request.lease.season);
      const unrecordedRounds = decodeRounds(value.unrecordedRounds);
      if (snapshot !== null && unrecordedRounds !== null) {
        return { outcome: 'reconciled', snapshot, unrecordedRounds };
      }
    }
    return { outcome: 'uncertain' };
  }

  async operate(
    request: OperatorActionRequest,
  ): Promise<OperatorTransitionOutcome> {
    return this.transition('operate', request, request.lease.season);
  }

  async dispose(
    request: DispositionRequest,
  ): Promise<OperatorTransitionOutcome> {
    return this.transition('dispose', request, request.lease.season);
  }

  async verify(
    request: VerificationRequest,
  ): Promise<OperatorTransitionOutcome> {
    return this.transition('verify', request, request.lease.season);
  }

  async rotateVerifications(
    request: VerificationRotationRequest,
  ): Promise<OperatorTransitionOutcome> {
    return this.transition(
      'rotate-verifications',
      request,
      request.lease.season,
    );
  }

  private async transition(
    command: 'operate' | 'dispose' | 'verify' | 'rotate-verifications',
    request:
      | OperatorActionRequest
      | DispositionRequest
      | VerificationRequest
      | VerificationRotationRequest,
    season: number,
  ): Promise<OperatorTransitionOutcome> {
    const value = await this.call(command, request);
    const rejection = decodeRejection(value);
    if (rejection !== null) return rejection;
    for (const outcome of ['applied', 'already-applied'] as const) {
      if (isOutcome(value, outcome, ['snapshot'])) {
        const snapshot = decodeSnapshot(value.snapshot, season);
        if (snapshot !== null) return { outcome, snapshot };
      }
    }
    return { outcome: 'uncertain' };
  }

  private async call(
    command: LedgerCommand,
    payload: unknown,
  ): Promise<unknown> {
    try {
      // `idFromName` is deterministic, so every isolate in every location
      // reaches the same single object.
      const stub = this.namespace.get(
        this.namespace.idFromName(RECONCILIATION_LEDGER_OBJECT_NAME),
      );
      const response = await stub.fetch(ledgerRequestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, payload }),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }
}

function isOutcome(
  value: unknown,
  outcome: string,
  fields: readonly string[],
): value is Record<string, unknown> {
  return (
    isLedgerObject(value) &&
    hasExactLedgerKeys(value, ['outcome', ...fields]) &&
    value.outcome === outcome
  );
}

function decodeRejection(value: unknown): LedgerRejection | null {
  if (
    isOutcome(value, 'rejected', ['reason']) &&
    isLedgerRejectionReason(value.reason)
  ) {
    return { outcome: 'rejected', reason: value.reason };
  }
  return null;
}
