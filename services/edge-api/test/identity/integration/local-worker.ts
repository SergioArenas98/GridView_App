/** U8 test bundle only. Never export these inspection/fault surfaces in a deployment. */
import worker from '../../../src/index';
import type { Env } from '../../../src/config/environment';
import {
  IdentityCatalog as Catalog,
  type IdentityDurableState,
  type IdentityEnvironment,
} from '../../../src/identity/durable-object';
import { catalogStorageBytes } from '../../../src/identity/storage-accounting';
import { IdentityClient } from '../../../src/identity/client';
import { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import { CapturingLogger } from '../../../src/logging/logger';
import { DurableObjectSeasonPublicationSequencer } from '../../../src/publication/sequencer/durable-object';
import { genesisFingerprint } from '../../../src/publication/cutover/genesis';
import { admitIdentityContext } from '../../../src/identity/catalog/run-context';
import type { PinRequest } from '../../../src/identity/catalog/pin-contract';
export { SeasonPublicationSequencer } from '../../../src/publication/sequencer/durable-object';
export { ReconciliationLedger } from '../../../src/sync/coordinated/ledger/durable-object';

export class IdentityCatalog extends Catalog {
  constructor(
    private readonly testState: IdentityDurableState,
    env: IdentityEnvironment & {
      U8_REJECT_SYNTHETIC?: boolean;
      U8_INTERRUPT_MIGRATION?: boolean;
    },
  ) {
    const original = testState.storage;
    const storage = env.U8_INTERRUPT_MIGRATION
      ? {
          transactionSync: <T>(run: () => T) => original.transactionSync(run),
          sql: {
            exec(query: string, ...bindings: (string | number | null)[]) {
              if (query.startsWith('CREATE TABLE identity_catalog_revisions'))
                throw Error('U8 interrupted before migration commit');
              return original.sql.exec(query, ...bindings);
            },
          },
        }
      : original;
    super({ storage }, env, !env.U8_REJECT_SYNTHETIC);
  }
  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/__test/inspect') {
      const sql = this.testState.storage.sql;
      const tables = sql
        .exec(
          "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'identity_%' ORDER BY name",
        )
        .toArray();
      const rows: Record<string, unknown> = {};
      for (const table of tables) {
        const name = String(table.name);
        if (!/^identity_[a-z_]+$/.test(name)) throw Error('Invalid table');
        rows[name] = sql
          .exec('SELECT * FROM ' + name + ' ORDER BY rowid')
          .toArray();
      }
      return Response.json({
        rows,
        logicalBytes: catalogStorageBytes(this.testState.storage),
        databaseSize: (
          this.testState.storage as unknown as { sql: { databaseSize: number } }
        ).sql.databaseSize,
      });
    }
    if (path === '/__test/fault') {
      const { fault } = (await request.json()) as { fault: string };
      const sql = this.testState.storage.sql;
      // Deliberately finite corruption hooks; no arbitrary SQL endpoint.
      if (fault === 'newer-schema')
        sql.exec('UPDATE identity_catalog_migrations SET version=99').toArray();
      else if (fault === 'invalid-active')
        sql
          .exec(
            "UPDATE identity_catalog_head SET body=json_set(body,'$.activeRevisionId','00000000-0000-4000-8000-000000000000')",
          )
          .toArray();
      else if (fault === 'migration-interruption')
        sql
          .exec(
            "CREATE TRIGGER u8_interrupt BEFORE INSERT ON identity_catalog_migrations BEGIN SELECT RAISE(ABORT,'u8 migration interrupted'); END",
          )
          .toArray();
      else if (fault === 'remove-interruption')
        sql.exec('DROP TRIGGER u8_interrupt').toArray();
      else throw Error('Unsupported fault');
      return Response.json({ injected: fault });
    }
    return super.fetch(request);
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const path = new URL(request.url).pathname;
    if (path === '/__test/context') {
      const started = performance.now();
      try {
        const context = await admitIdentityContext(
          {
            mode: 'runtime',
            installationId: env.IDENTITY_INSTALLATION_ID,
            namespace: env.IDENTITY_CATALOG,
          },
          (await request.json()) as PinRequest,
          new CapturingLogger(),
        );
        return Response.json({
          authority: context.authority,
          revisionId: context.revisionId,
          catalogHash: context.catalogHash,
          datasetVersion: context.datasetVersion,
          pin: context.pin,
          elapsedMs: performance.now() - started,
        });
      } catch (error) {
        return Response.json(
          {
            failure: error instanceof Error ? error.message : 'refused',
            elapsedMs: performance.now() - started,
          },
          { status: 503 },
        );
      }
    }
    if (path === '/__test/observe') {
      return Response.json(
        await new IdentityClient(
          env.IDENTITY_CATALOG!,
          env.IDENTITY_INSTALLATION_ID!,
        ).observe(await request.json()),
      );
    }
    if (path === '/__test/genesis') {
      return Response.json(
        await new DurableObjectSeasonPublicationSequencer(
          env.SEASON_PUBLICATION_SEQUENCER!,
        ).commitGenesis({
          season: 2026,
          genesisFingerprint: await genesisFingerprint(
            2026,
            'isolated-synthetic-u8',
          ),
        }),
      );
    }
    if (path.startsWith('/__catalog/')) {
      const objectName =
        request.headers.get('X-U8-Object-Name') ??
        'identity:' + env.IDENTITY_INSTALLATION_ID;
      return env
        .IDENTITY_CATALOG!.get(env.IDENTITY_CATALOG!.idFromName(objectName))
        .fetch('https://identity.invalid/' + path.slice('/__catalog/'.length), {
          method: request.method,
          ...(request.method === 'POST' ? { body: await request.text() } : {}),
        });
    }
    const response = await worker.fetch(request, {
      ...env,
      __CACHE_PURGER: new MemoryCachePurgeAdapter(),
      __LOGGER: new CapturingLogger(),
    });
    if (
      request.headers.get('X-U8-Lose-Response') === '1' &&
      response.status === 200
    ) {
      await response.body?.cancel();
      return Response.json({ error: 'u8-response-lost' }, { status: 503 });
    }
    return response;
  },
};
