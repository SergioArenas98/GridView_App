import type { IdentityContextConfiguration } from '../identity/catalog/run-context';
import {
  contextFromPin,
  pinAttemptTimeoutMs,
  pinRequestFor,
} from '../identity/catalog/run-context';
import type {
  BatchAdmissionRequest,
  BatchAdmissionReceipt,
} from '../identity/catalog/batch-admission';
import type { PinnedCatalog } from '../identity/catalog/pin-contract';
import { within } from '../identity/discovery/persist';
import { readBoundedJson } from './submission';
import { canonicalJson } from './canonical-json';
const catalogNamespaceOrigin = 'https://identity-catalog';
export class BatchCatalogError extends Error {
  constructor(
    readonly failure: 'runtime-batch-requires-u7' | 'catalog-admission-refused',
  ) {
    super(failure);
  }
}

/** Namespace-only, bounded, retrying exactly the same durable operation. */
export async function batchCatalogCall(
  config: IdentityContextConfiguration,
  path: '/batch-admit' | '/batch-transition',
  body: unknown,
): Promise<unknown> {
  if (!config.namespace || !config.installationId)
    throw Error('catalog-unavailable');
  const call = async () => {
    const stub = config.namespace!.get(
      config.namespace!.idFromName('identity:' + config.installationId),
    );
    const response = await stub.fetch(catalogNamespaceOrigin + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: canonicalJson(body),
    });
    if (!response.ok) {
      const error = await readBoundedJson(
        new Request(catalogNamespaceOrigin + '/error', {
          method: 'POST',
          body: response.body,
          duplex: 'half',
        } as RequestInit),
        1024,
      );
      if (
        error.ok &&
        (error.value as { error?: unknown })?.error ===
          'runtime-batch-requires-u7'
      )
        throw new BatchCatalogError('runtime-batch-requires-u7');
      throw new BatchCatalogError('catalog-admission-refused');
    }
    const parsed = await readBoundedJson(
      new Request('https://identity-catalog/response', {
        method: 'POST',
        body: response.body,
        duplex: 'half',
      } as RequestInit),
      4 * 1024 * 1024,
    );
    if (!parsed.ok) throw Error('catalog-response-invalid');
    return parsed.value;
  };
  for (let n = 0; ; n++) {
    try {
      return await within(call(), pinAttemptTimeoutMs);
    } catch (error) {
      if (n === 1) throw error;
    }
  }
}
export async function admitBatchCatalog(
  config: IdentityContextConfiguration,
  request: BatchAdmissionRequest,
) {
  const result = (await batchCatalogCall(config, '/batch-admit', request)) as {
    receipt: BatchAdmissionReceipt;
    catalog: PinnedCatalog | null;
  };
  if (result.receipt.state === 'complete')
    return { receipt: result.receipt, context: null };
  const context = await contextFromPin(
    result.catalog,
    pinRequestFor(
      {
        runId: request.operationId,
        installationId: request.installationId,
        season: request.season,
        purpose: 'season-batch',
        leaseFence: request.leaseFence,
      },
      request.schemaVersion === 2 ? 'optional-drivers/1' : 'strict/1',
    ),
  );
  return { receipt: result.receipt, context };
}
