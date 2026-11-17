import {
  IdentityCatalog,
  type IdentityDurableState,
  type IdentityEnvironment,
} from '../../../src/identity/durable-object';
import { SeedStore } from '../../../src/identity/catalog/storage';
import { importSeed, exportSeed } from '../../../src/identity/catalog/export';
export class SeedTestHost extends IdentityCatalog {
  private readonly seed: SeedStore;
  constructor(
    state: IdentityDurableState,
    env: IdentityEnvironment & { TEST_FAIL?: boolean },
  ) {
    super(state, env);
    const storage = {
      ...state.storage,
      transactionSync: <T>(fn: () => T) => state.storage.transactionSync(fn),
      sql: {
        exec: (q: string, ...args: (string | number | null)[]) => {
          if (
            env.TEST_FAIL &&
            q.startsWith('INSERT INTO identity_seed_bindings')
          )
            throw Error('synthetic interrupted seed');
          return state.storage.sql.exec(q, ...args);
        },
      },
    };
    this.seed = new SeedStore(storage, env.IDENTITY_INSTALLATION_ID!);
  }
  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/seed')
        return Response.json({
          result: await this.seed.import(
            await importSeed(await request.text()),
          ),
        });
      if (path === '/export') {
        const seed = await this.seed.read();
        return new Response(seed ? await exportSeed(seed) : 'null');
      }
      return super.fetch(request);
    } catch {
      return Response.json({ error: 'seed-refused' }, { status: 409 });
    }
  }
}
export default {
  fetch(request: Request, env: { IDENTITY_CATALOG: DurableObjectNamespace }) {
    return env.IDENTITY_CATALOG.get(
      env.IDENTITY_CATALOG.idFromName('isolated-u3'),
    ).fetch(request);
  },
};
