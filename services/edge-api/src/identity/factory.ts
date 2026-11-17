import type { Env } from '../config/environment';
import { resolveIdentityDiscoveryMode } from '../config/environment';
import type { Logger } from '../logging/logger';
import type { IdentityRunContext } from './catalog/run-context';
import type { IdentityHash } from './discovery/model';
import { IdentityClient, type IdentityNamespace } from './client';
import { uuidPattern } from './wire-decoders';
import {
  createShadowDiscovery,
  discoveryDiagnostic,
  type BackgroundTasks,
  type DiscoverySession,
} from './discovery/persist';
import { hashIdentityProjection } from './discovery/keys';
import {
  curatedMappingDocuments,
  curatedRegistries,
} from '../providers/mappings';
export function identityClientFor(
  env: Pick<Env, 'IDENTITY_CATALOG' | 'IDENTITY_INSTALLATION_ID'>,
): IdentityClient | null {
  const namespace = env.IDENTITY_CATALOG as IdentityNamespace | undefined;
  if (
    !namespace ||
    typeof namespace.idFromName !== 'function' ||
    typeof namespace.get !== 'function' ||
    typeof env.IDENTITY_INSTALLATION_ID !== 'string' ||
    !uuidPattern.test(env.IDENTITY_INSTALLATION_ID)
  )
    return null;
  return new IdentityClient(namespace, env.IDENTITY_INSTALLATION_ID);
}
export async function shadowDiscoveryFor(
  env: Env,
  logger: Logger,
  clock: () => number,
  background?: BackgroundTasks,
  runContext?: IdentityRunContext,
): Promise<DiscoverySession | null> {
  try {
    if (resolveIdentityDiscoveryMode(env.IDENTITY_DISCOVERY_MODE) === 'off')
      return null;
    if (!background) {
      discoveryDiagnostic(logger, 'background-unavailable');
      return null;
    }
    const client = identityClientFor(env);
    if (!client) {
      discoveryDiagnostic(logger, 'unavailable');
      return null;
    }
    const registries = runContext ? null : curatedRegistries();
    // Exact bundled resolver context, not a runtime catalog revision or dataset.
    const catalogHash = runContext
      ? (runContext.catalogHash as IdentityHash)
      : await hashIdentityProjection({
          format: 'gridview-bundled-resolution/1',
          mappings: curatedMappingDocuments(),
          registries: Object.fromEntries(
            Object.entries(registries!).map(([entity, ids]) => [
              entity,
              [...ids].sort(),
            ]),
          ),
        });
    const transportKind =
      env.CONTROLLED_PROVIDER_SOURCE === 'kv'
        ? 'controlled'
        : env.JOLPICA_TRANSPORT === 'proxy'
          ? 'proxy'
          : 'direct';
    return createShadowDiscovery({
      client,
      context: {
        runId: runContext?.runId ?? crypto.randomUUID(),
        catalogRef:
          runContext?.authority === 'runtime'
            ? {
                mode: 'runtime',
                revisionId: runContext.revisionId!,
                catalogHash: runContext.catalogHash as IdentityHash,
              }
            : { mode: 'bundled', catalogHash },
        transportKind,
        synthetic:
          transportKind === 'controlled' ||
          env.__PROVIDER_TRANSPORT !== undefined,
      },
      clock,
      logger,
      background,
    });
  } catch {
    discoveryDiagnostic(logger, 'invalid-configuration');
    return null;
  }
}
