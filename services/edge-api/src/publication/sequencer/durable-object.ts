/**
 * The `SeasonPublicationSequencer` Durable Object class, and the client that
 * would address it
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D1).
 *
 * One identity per season, `idFromName(String(season))`, so unrelated seasons
 * remain independently concurrent: no operation on 2025 ever blocks, reads or
 * writes state belonging to 2026. `ProviderRateLimiter` is deliberately **not**
 * reused - it coordinates outbound request budget per provider source, this
 * coordinates publication authority per season, and conflating them would make
 * an unrelated limiter change a publication-authority change.
 *
 * ## Nothing here is deployable
 *
 * This module is **not** exported from the Worker entry point, and no
 * `wrangler.toml` binding, `[exports]` entry or migration declares it. Wrangler
 * resolves a Durable Object class through a named export of the Worker's main
 * module; there is none, so this class cannot be instantiated by the runtime.
 * It is a TypeScript module export used by internal tests, which is exactly the
 * scope this slice has.
 *
 * ## Why the classic `fetch` interface
 *
 * The same reason `ProviderRateLimiter` uses it: it needs no
 * `cloudflare:workers` import, so the module stays loadable in the repository's
 * plain-Node test runner and the whole seam can be exercised without a Workers
 * runtime.
 *
 * `blockConcurrencyWhile` is deliberately **absent**. The critical section is
 * one synchronous local storage transaction with no subrequest inside it, which
 * an ordinary input gate already serializes; wrapping it would be leftover
 * machinery from the rejected Workers-KV-authoritative design, and using it
 * around anything longer would risk its 30-second reset.
 */

import { durableObjectSequencerHost, type SequencerDurableHost } from './hosts';
import {
  SeasonPublicationCoordinator,
  type SequencerOptions,
} from './coordinator';
import type {
  CancelOutcome,
  CleanupAcknowledgement,
  CleanupAuthorization,
  CleanupRequest,
  CutoverActivationOutcome,
  CutoverActivationRequest,
  CutoverSeed,
  CutoverSeedOutcome,
  FinalizeOutcome,
  FinalizeRequest,
  OperationIdentity,
  PrepareOutcome,
  PrepareRequest,
  SeasonAuthority,
} from './model';
import type { SeasonPublicationSequencerPort } from './port';
import {
  decodeCancelOutcome,
  decodeCleanupAcknowledgement,
  decodeCleanupAuthorization,
  decodeCutoverActivationOutcome,
  decodeCutoverSeedOutcome,
  decodeFinalizeOutcome,
  decodePrepareOutcome,
  decodeSeasonAuthority,
} from './wire-decoders';

/** Internal URL used to address the object. Never logged, never external. */
export const sequencerRequestUrl = 'https://season-publication-sequencer/call';

/** The closed set of commands the object answers. */
export const sequencerCommands = [
  'read-authority',
  'prepare',
  'finalize',
  'cancel',
  'authorize-cleanup',
  'acknowledge-cleanup',
  'seed-cutover',
  'activate-cutover',
] as const;

export type SequencerCommand = (typeof sequencerCommands)[number];

function isSequencerCommand(value: unknown): value is SequencerCommand {
  return sequencerCommands.includes(value as SequencerCommand);
}

/**
 * The Durable Object class one season's publication authority would run as.
 *
 * The object's own clock is the only time source: a caller supplies neither an
 * observation timestamp nor a deadline.
 */
export class SeasonPublicationSequencer {
  private readonly coordinator: SeasonPublicationCoordinator;

  constructor(state: SequencerDurableHost, options: SequencerOptions = {}) {
    this.coordinator = new SeasonPublicationCoordinator(
      durableObjectSequencerHost(state),
      options,
    );
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method-not-allowed' }, 405);
    }
    let body: { command?: unknown; payload?: unknown };
    try {
      body = (await request.json()) as { command?: unknown; payload?: unknown };
    } catch {
      return jsonResponse({ error: 'invalid-request' }, 400);
    }
    if (!isSequencerCommand(body.command)) {
      return jsonResponse({ error: 'invalid-command' }, 400);
    }
    try {
      return jsonResponse(this.dispatch(body.command, body.payload), 200);
    } catch {
      // A storage or coordination failure must never read as a decision. The
      // client maps a non-OK response to a bounded fail-closed outcome, and the
      // raw error - which can embed a storage key or a stack - never crosses.
      return jsonResponse({ error: 'sequencer-unavailable' }, 500);
    }
  }

  private dispatch(command: SequencerCommand, payload: unknown): unknown {
    const request = (payload ?? {}) as Record<string, never>;
    switch (command) {
      case 'read-authority':
        return this.coordinator.readAuthority(
          (request as unknown as { season: number }).season,
        );
      case 'prepare':
        return this.coordinator.prepare(request as unknown as PrepareRequest);
      case 'finalize':
        return this.coordinator.finalize(request as unknown as FinalizeRequest);
      case 'cancel':
        return this.coordinator.cancel(request as unknown as OperationIdentity);
      case 'authorize-cleanup':
        return this.coordinator.authorizeCleanup(
          request as unknown as CleanupRequest,
        );
      case 'acknowledge-cleanup':
        return this.coordinator.acknowledgeCleanup(
          request as unknown as CleanupRequest,
        );
      case 'seed-cutover':
        return this.coordinator.seedCutover(request as unknown as CutoverSeed);
      case 'activate-cutover':
        return this.coordinator.activateCutover(
          request as unknown as CutoverActivationRequest,
        );
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
 * The minimum namespace surface the client needs.
 *
 * `DurableObjectNamespace` is structurally assignable to it, so a future
 * binding needs no adaptation - and a test can supply a fake namespace that
 * dispatches to a real object instance, proving the whole seam without any
 * provisioned resource.
 */
export interface SequencerNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): {
    fetch(url: string, init: RequestInit): Promise<Response>;
  };
}

/**
 * Routes one season's call to that season's single Durable Object.
 *
 * Every transport, dispatch or decoding failure resolves to a **bounded
 * fail-closed outcome** for the operation attempted, never to an exception and
 * never to something a caller could mistake for a decision. In particular an
 * unreachable sequencer never resolves to `committed`, `authorized`,
 * `activated` or an authoritative version.
 */
export class DurableObjectSeasonPublicationSequencer implements SeasonPublicationSequencerPort {
  constructor(private readonly namespace: SequencerNamespace) {}

  async readAuthority(season: number): Promise<SeasonAuthority> {
    const value = await this.call(season, 'read-authority', { season });
    return (
      decodeSeasonAuthority(value) ?? {
        cutoverState: 'unavailable',
        authoritative: false,
      }
    );
  }

  async prepare(request: PrepareRequest): Promise<PrepareOutcome> {
    const value = await this.call(request.season, 'prepare', request);
    return (
      decodePrepareOutcome(value) ?? {
        outcome: 'rejected',
        reason: 'state-corrupt',
      }
    );
  }

  async finalize(request: FinalizeRequest): Promise<FinalizeOutcome> {
    const value = await this.call(request.season, 'finalize', request);
    return (
      decodeFinalizeOutcome(value) ?? {
        outcome: 'rejected',
        reason: 'state-corrupt',
      }
    );
  }

  async cancel(request: OperationIdentity): Promise<CancelOutcome> {
    const value = await this.call(request.season, 'cancel', request);
    return (
      decodeCancelOutcome(value) ?? {
        outcome: 'rejected',
        reason: 'state-corrupt',
      }
    );
  }

  async authorizeCleanup(
    request: CleanupRequest,
  ): Promise<CleanupAuthorization> {
    const value = await this.call(request.season, 'authorize-cleanup', request);
    return (
      decodeCleanupAuthorization(value) ?? {
        outcome: 'refused',
        reason: 'state-corrupt',
      }
    );
  }

  async acknowledgeCleanup(
    request: CleanupRequest,
  ): Promise<CleanupAcknowledgement> {
    const value = await this.call(
      request.season,
      'acknowledge-cleanup',
      request,
    );
    return (
      decodeCleanupAcknowledgement(value) ?? {
        outcome: 'rejected',
        reason: 'state-corrupt',
      }
    );
  }

  async seedCutover(seed: CutoverSeed): Promise<CutoverSeedOutcome> {
    const value = await this.call(seed.season, 'seed-cutover', seed);
    return (
      decodeCutoverSeedOutcome(value) ?? {
        outcome: 'rejected',
        reason: 'state-corrupt',
      }
    );
  }

  async activateCutover(
    request: CutoverActivationRequest,
  ): Promise<CutoverActivationOutcome> {
    const value = await this.call(request.season, 'activate-cutover', request);
    return (
      decodeCutoverActivationOutcome(value) ?? {
        outcome: 'rejected',
        reason: 'state-corrupt',
      }
    );
  }

  private async call(
    season: number,
    command: SequencerCommand,
    payload: unknown,
  ): Promise<unknown> {
    try {
      // `idFromName` is deterministic, so every isolate in every location
      // reaches the same object for this season - and never another season's.
      const stub = this.namespace.get(
        this.namespace.idFromName(String(season)),
      );
      const response = await stub.fetch(sequencerRequestUrl, {
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
