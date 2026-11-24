/** Fault injection exists only in the local integration test Worker. */
import {
  IdentityCatalog as RuntimeCatalog,
  type IdentityDurableState,
  type IdentityEnvironment,
} from '../../../src/identity/durable-object';
import type { IdentityNamespace } from '../../../src/identity/client';
export class IdentityCatalog extends RuntimeCatalog {
  constructor(
    state: IdentityDurableState,
    env: IdentityEnvironment & { TEST_FAIL?: boolean },
  ) {
    const actual = state.storage;
    super(
      {
        storage: {
          transactionSync: (run) => actual.transactionSync(run),
          sql: {
            exec(query, ...args) {
              if (
                env.TEST_FAIL &&
                query.startsWith('INSERT INTO identity_observations')
              )
                throw Error('local rollback test');
              return actual.sql.exec(query, ...args);
            },
          },
          getAlarm: () => actual.getAlarm!(),
          setAlarm: (at) => actual.setAlarm!(at),
        },
      },
      env,
    );
  }
}
export default {
  fetch(
    request: Request,
    env: {
      IDENTITY_CATALOG: IdentityNamespace;
      IDENTITY_INSTALLATION_ID: string;
    },
  ) {
    return env.IDENTITY_CATALOG.get(
      env.IDENTITY_CATALOG.idFromName(
        'identity:' + env.IDENTITY_INSTALLATION_ID,
      ),
    ).fetch(request.url, { method: request.method, body: request.body });
  },
};
