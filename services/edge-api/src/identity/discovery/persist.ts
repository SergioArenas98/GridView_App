import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import type { ProviderMappingRegistry } from '../../providers/mappings/mapping-registry';
import type { Logger } from '../../logging/logger';
import type { IdentityPort } from '../port';
import { IdentityError } from '../port';
import type {
  DecodedJolpicaResource,
  IdentityObservationDraft,
  ObservationContext,
} from './model';
import { extractJolpicaObservations } from './extract-jolpica';
import { createIdentityObservationCollector } from './collector';
export interface DiscoverySink {
  capture(
    input: DecodedJolpicaResource,
    body: unknown,
    registry: ProviderMappingRegistry,
  ): void;
}
export interface DiscoverySession extends DiscoverySink {
  finish(): void;
  drain(): Promise<void>;
}
export type BackgroundTasks = { waitUntil(task: Promise<unknown>): void };
export type DiscoveryReason =
  | 'unavailable'
  | 'timeout'
  | 'invalid-configuration'
  | 'background-unavailable'
  | 'extraction-skipped'
  | 'collector-full'
  | 'extraction-busy';
export function discoveryDiagnostic(
  logger: Logger,
  reason: DiscoveryReason,
  capacity = false,
): void {
  try {
    logger.warn({
      operation: capacity
        ? 'identity.discovery.capacity_exceeded'
        : reason === 'extraction-skipped'
          ? 'identity.discovery.skipped'
          : 'identity.discovery.persistence_failed',
      identityDiscoveryReason: reason,
    });
  } catch {
    /* Diagnostics cannot affect ingestion. */
  }
}
/** Defensive seam: even an injected collector that throws cannot change a port outcome. */
export function captureDiscovery(
  sink: DiscoverySink | undefined,
  input: DecodedJolpicaResource,
  body: unknown,
  registry: ProviderMappingRegistry,
): void {
  if (!sink) return;
  try {
    sink.capture(input, body, registry);
  } catch {
    /* Shadow capture has no authority. */
  }
}
export async function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), Math.max(1, ms));
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
export function createShadowDiscovery(options: {
  client: IdentityPort;
  context: Omit<ObservationContext, 'requestOrdinal' | 'observedAt'>;
  clock: () => number;
  logger: Logger;
  background?: BackgroundTasks;
}): DiscoverySession {
  const collector = createIdentityObservationCollector();
  const pending = new Set<Promise<void>>();
  const reported = new Set<string>();
  let persisted = 0,
    replayed = 0,
    skippedCaptures = 0;
  const report = (reason: DiscoveryReason, capacity = false): void => {
    const key = reason + String(capacity);
    if (reported.has(key)) return;
    reported.add(key);
    discoveryDiagnostic(options.logger, reason, capacity);
  };
  let ordinal = 0,
    finished = false,
    expired = false,
    draining: Promise<void> | null = null,
    captures = 0;
  const drain = (): Promise<void> => {
    if (draining) return draining;
    finished = true;
    draining = (async () => {
      const deadline = Date.now() + 2000;
      try {
        await within(Promise.all([...pending]), deadline - Date.now());
        const observations = collector.snapshot();
        let at = 0;
        while (at < observations.length) {
          const batch: IdentityObservationDraft[] = [];
          while (at < observations.length && batch.length < 100) {
            const next = observations[at]!;
            if (
              utf8(canonicalJson({ observations: [...batch, next] }))
                .byteLength >
              256 * 1024 - 512
            )
              break;
            batch.push(next);
            at++;
          }
          if (!batch.length) throw new Error('capacity');
          for (let attempt = 0; attempt < 2; attempt++) {
            const remaining = deadline - Date.now();
            if (remaining <= 0) throw new Error('timeout');
            let settled = false;
            const write = options.client
              .observe({ observations: batch })
              .finally(() => {
                settled = true;
              });
            try {
              const result = await within(write, remaining);
              persisted += result.persisted;
              replayed += result.replayed;
              if (result.dropped) report('collector-full', true);
              break;
            } catch (error) {
              // A timed-out call may still commit: never start another in-flight call.
              if (!settled || attempt === 1) throw error;
            }
          }
        }
      } catch (error) {
        report(
          Date.now() >= deadline ? 'timeout' : 'unavailable',
          error instanceof IdentityError && error.code === 'capacity',
        );
      } finally {
        expired = true;
        const stats = collector.stats();
        try {
          options.logger.info({
            operation: 'identity.discovery.observed',
            identityCollected: stats.collected,
            identityDropped: stats.dropped,
            identityPersisted: persisted,
            identityReplayed: replayed,
            identitySkippedCaptures: skippedCaptures,
          });
        } catch {
          /* Aggregate diagnostics are best-effort too. */
        }
      }
    })();
    return draining;
  };
  return {
    capture(input, body, registry) {
      if (finished) return;
      ordinal++;
      if (pending.size >= 8 || captures >= 2000) {
        skippedCaptures = Math.min(
          Number.MAX_SAFE_INTEGER,
          skippedCaptures + 1,
        );
        report('extraction-busy', true);
        return;
      }
      captures++;
      const task = extractJolpicaObservations(
        input,
        body,
        {
          ...options.context,
          requestOrdinal: ordinal,
          observedAt: new Date(options.clock()).toISOString(),
        },
        registry,
      )
        .then((result) => {
          if (expired) return;
          if (result.status === 'skipped') {
            report('extraction-skipped');
            return;
          }
          for (const observation of result.observations) {
            if (collector.collect(observation) === 'capacity')
              report('collector-full', true);
          }
        })
        .catch(() => report('extraction-skipped'));
      pending.add(task);
      void task.finally(() => pending.delete(task));
    },
    drain,
    finish() {
      if (finished) return;
      // Start one caught task only. Offline callers explicitly await drain().
      if (!options.background) {
        finished = true;
        expired = true;
        report('background-unavailable');
        return;
      }
      try {
        options.background.waitUntil(drain());
      } catch {
        report('background-unavailable');
      }
    },
  };
}
