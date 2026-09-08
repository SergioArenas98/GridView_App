/**
 * The two `SequencerHost` implementations: the SQLite-backed Durable Object
 * storage adapter, and an in-memory one with the same transactional semantics.
 *
 * Both must satisfy the same contract: every write a `transactionSync` callback
 * performs is applied atomically, and **all** of them are discarded if the
 * callback throws. The in-memory host exists so the state machine's atomicity
 * and rollback behaviour can be proven deterministically in the repository's
 * plain-Node test runner, which has no Workers runtime.
 */

import type { SequencerHost, SequencerRecordStore } from './store';

/**
 * The subset of `DurableObjectState` the sequencer uses.
 *
 * `DurableObjectState` is structurally assignable to it, so the real object
 * needs no adapter of its own beyond `durableObjectSequencerHost` below, and
 * nothing here imports `cloudflare:workers` - which is what keeps the module
 * loadable in a plain-Node test runner.
 */
export interface SequencerDurableHost {
  storage: {
    transactionSync<T>(closure: () => T): T;
    kv: {
      get<T = unknown>(key: string): T | undefined;
      put<T>(key: string, value: T): void;
      delete(key: string): boolean;
      list<T = unknown>(options?: {
        prefix?: string;
      }): Iterable<readonly [string, T]>;
    };
  };
}

/**
 * Wraps SQLite-backed Durable Object storage.
 *
 * `transactionSync` is only available on SQLite-backed Durable Objects, which
 * is the storage mode this class is declared with - the same mode
 * `ProviderRateLimiter` uses, and the one required on the Workers Free plan.
 * Its callback must complete synchronously; the port's synchronous shape makes
 * that a type-level guarantee rather than a convention.
 */
export function durableObjectSequencerHost(
  state: SequencerDurableHost,
): SequencerHost {
  const store: SequencerRecordStore = {
    get: (key) => state.storage.kv.get(key),
    put: (key, value) => state.storage.kv.put(key, value),
    delete: (key) => {
      state.storage.kv.delete(key);
    },
    list: (prefix) => state.storage.kv.list({ prefix }),
  };
  return {
    transactionSync: (run) => state.storage.transactionSync(() => run(store)),
  };
}

/**
 * An in-memory host with the same atomicity and rollback semantics.
 *
 * The transaction operates on a copy; the copy replaces the committed map only
 * when the callback returns. A throw therefore discards every write the
 * callback made, which is what the Durable Object's own `transactionSync`
 * guarantees and what the state machine's failure paths are tested against.
 *
 * Values are structurally cloned on write, so a caller cannot retain a
 * reference into committed state and mutate it afterwards - the same property
 * the storage boundary has in production, where every value is serialized.
 */
export class MemorySequencerHost implements SequencerHost {
  private committed = new Map<string, unknown>();
  /** Transactions that completed, for restart and atomicity assertions. */
  private depth = 0;

  transactionSync<T>(run: (store: SequencerRecordStore) => T): T {
    if (this.depth > 0) {
      throw new Error('nested sequencer transaction');
    }
    const working = new Map(this.committed);
    this.depth += 1;
    try {
      const result = run(storeOver(working));
      this.committed = working;
      return result;
    } finally {
      this.depth -= 1;
    }
  }

  /** A fresh host over the same committed bytes, as a restart would see them. */
  restart(): MemorySequencerHost {
    const restarted = new MemorySequencerHost();
    restarted.committed = new Map(this.committed);
    return restarted;
  }

  /** Committed keys, for capacity and retirement assertions. Never logged. */
  committedKeys(): string[] {
    return [...this.committed.keys()].sort();
  }

  /** One committed value, for durable-corruption tests. */
  peek(key: string): unknown {
    return this.committed.get(key);
  }

  /** Replaces one committed value, to simulate a corrupt durable record. */
  poke(key: string, value: unknown): void {
    this.committed.set(key, value);
  }
}

function storeOver(values: Map<string, unknown>): SequencerRecordStore {
  return {
    get: (key) => values.get(key),
    put: (key, value) => {
      values.set(key, structuredClone(value));
    },
    delete: (key) => {
      values.delete(key);
    },
    list: (prefix) =>
      [...values.entries()].filter(([key]) => key.startsWith(prefix)),
  };
}
