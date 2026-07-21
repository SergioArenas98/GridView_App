import {
  ConfigurationError,
  resolveEnvironment,
  type Env,
} from '../config/environment';
import { KvSnapshotStorage } from './kv';
import { getSharedLocalStorage } from './local';
import type { SnapshotStorage } from './types';

export function resolveStorage(env: Env): SnapshotStorage {
  if (env.__LOCAL_STORAGE) return env.__LOCAL_STORAGE;
  if (env.GRIDVIEW_DATA) return new KvSnapshotStorage(env.GRIDVIEW_DATA);
  const environment = resolveEnvironment(env.ENVIRONMENT);
  if (environment === 'staging' || environment === 'production') {
    throw new ConfigurationError(
      `GRIDVIEW_DATA KV binding is required in ${environment}.`,
    );
  }
  return getSharedLocalStorage();
}
