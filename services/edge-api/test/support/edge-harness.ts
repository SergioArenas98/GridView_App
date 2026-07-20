import worker, { type Env } from '../../src/index';
import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import { CapturingLogger } from '../../src/logging/logger';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import { FixedClock } from '../../src/runtime/clock';
import { MemorySnapshotStorage } from '../../src/storage/local';
import type { SnapshotValidator } from '../../src/validation/snapshot-validator';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';

export interface EdgeHarness {
  env: Env;
  storage: MemorySnapshotStorage;
  provider: MockFormulaOneProvider;
  logger: CapturingLogger;
  purger: MemoryCachePurgeAdapter;
  clock: FixedClock;
}

export function createHarness(
  overrides: Partial<{
    adminToken: string;
    environment: string;
    providerMode: string;
    provider: MockFormulaOneProvider;
    validator: SnapshotValidator;
  }> = {},
): EdgeHarness {
  const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
  const storage = new MemorySnapshotStorage();
  const logger = new CapturingLogger();
  const purger = new MemoryCachePurgeAdapter();
  const provider =
    overrides.provider ??
    new MockFormulaOneProvider({
      clock,
      sourceUpdatedAt: '2026-07-18T11:55:00.000Z',
      contentVersion: '2026.07.18.1',
    });
  const env: Env = {
    ENVIRONMENT: overrides.environment ?? 'development',
    PROVIDER_MODE: overrides.providerMode ?? 'mock',
    ADMIN_TOKEN: overrides.adminToken ?? 'local-test-token',
    __LOCAL_STORAGE: storage,
    __CLOCK: clock,
    __LOGGER: logger,
    __PROVIDER: provider,
    __CACHE_PURGER: purger,
    __SNAPSHOT_VALIDATOR: overrides.validator ?? runtimeSnapshotValidator,
  };
  return { env, storage, provider, logger, purger, clock };
}

export function request(
  path: string,
  method = 'GET',
  init: RequestInit = {},
): Request {
  return new Request(`https://api.gridview.test${path}`, { ...init, method });
}

export function adminRequest(
  path: string,
  token = 'local-test-token',
  body?: unknown,
  method = 'POST',
): Request {
  return request(path, method, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function seedPublishedSnapshot(
  harness: EdgeHarness,
): Promise<void> {
  const response = await worker.fetch(
    adminRequest('/internal/admin/sync/full'),
    harness.env,
  );
  if (response.status !== 200) {
    throw new Error(`Seed sync failed with HTTP ${response.status}`);
  }
}
