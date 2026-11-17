import { DatabaseSync } from 'node:sqlite';
import type { IdentityStorage } from '../../../src/identity/schema';
export function sqliteHost(path = ':memory:') {
  const db = new DatabaseSync(path);
  let fail = false;
  const storage: IdentityStorage = {
    sql: {
      exec(query, ...args) {
        if (fail && query.startsWith('INSERT INTO identity_observations'))
          throw Error('injected write failure');
        return {
          toArray: () =>
            db.prepare(query).all(...args) as Record<string, unknown>[],
        };
      },
    },
    transactionSync<T>(run: () => T): T {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = run();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return {
    db,
    storage,
    failObservation: (value: boolean) => {
      fail = value;
    },
  };
}
