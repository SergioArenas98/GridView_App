import type { Env } from '../config/environment';
import { KvSnapshotStorage } from './kv';
import { getSharedLocalStorage } from './local';
import type { SnapshotStorage } from './types';

export function resolveStorage(env: Env): SnapshotStorage {
  if (env.__LOCAL_STORAGE) return env.__LOCAL_STORAGE;
  if (env.GRIDVIEW_DATA) return new KvSnapshotStorage(env.GRIDVIEW_DATA);
  return getSharedLocalStorage();
}
