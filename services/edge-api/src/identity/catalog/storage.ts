import { canonicalJson } from '../../ingest/canonical-json';
import { canonicalKey } from '../../providers/mappings/mapping-key';
import { hashIdentityProjection } from '../discovery/keys';
import { initialize, type IdentityStorage } from '../schema';
import { requireCatalog, type SeedArtifact } from './model';
import { validateSeed } from './validate';

/** Local-only U3 repository. No production host invokes it, no active pointer. */
export class SeedStore {
  constructor(
    private readonly storage: IdentityStorage,
    installation: string,
  ) {
    initialize(storage, installation);
    storage.transactionSync(() => {
      storage.sql
        .exec(
          'CREATE TABLE IF NOT EXISTS identity_seed (id INTEGER PRIMARY KEY CHECK(id=0), schema_version INTEGER NOT NULL, content_hash TEXT NOT NULL, export_hash TEXT NOT NULL, body TEXT NOT NULL)',
        )
        .toArray();
      storage.sql
        .exec(
          'CREATE TABLE IF NOT EXISTS identity_seed_bindings (exact_key TEXT PRIMARY KEY, seed INTEGER NOT NULL REFERENCES identity_seed(id), target TEXT NOT NULL, binding_id TEXT NOT NULL UNIQUE)',
        )
        .toArray();
    });
  }
  async import(input: unknown): Promise<'imported' | 'replayed'> {
    const seed = await validateSeed(input),
      body = canonicalJson(seed),
      hash = await hashIdentityProjection(seed);
    return this.storage.transactionSync(() => {
      const existing = this.storage.sql
        .exec('SELECT * FROM identity_seed')
        .toArray();
      if (existing.length) {
        requireCatalog(
          existing.length === 1 &&
            existing[0]!.schema_version === 1 &&
            existing[0]!.body === body &&
            existing[0]!.export_hash === hash,
          'seed-conflict',
        );
        this.checkIndex(seed);
        return 'replayed';
      }
      requireCatalog(
        this.storage.sql
          .exec('SELECT exact_key FROM identity_seed_bindings LIMIT 1')
          .toArray().length === 0,
        'seed-not-empty',
      );
      this.storage.sql
        .exec(
          'INSERT INTO identity_seed VALUES(0,1,?,?,?)',
          seed.contentHash,
          hash,
          body,
        )
        .toArray();
      for (const b of seed.snapshot.bindings)
        this.storage.sql
          .exec(
            'INSERT INTO identity_seed_bindings VALUES(?,0,?,?)',
            canonicalKey(b.key),
            b.targetId,
            b.bindingId,
          )
          .toArray();
      this.checkIndex(seed);
      return 'imported';
    });
  }
  private checkIndex(seed: SeedArtifact): void {
    const actual = this.storage.sql
      .exec(
        'SELECT exact_key,target,binding_id FROM identity_seed_bindings ORDER BY exact_key',
      )
      .toArray();
    const expected = seed.snapshot.bindings.map((b) => ({
      exact_key: canonicalKey(b.key),
      target: b.targetId,
      binding_id: b.bindingId,
    }));
    requireCatalog(
      canonicalJson(actual) === canonicalJson(expected),
      'seed-index',
    );
  }
  async read(): Promise<SeedArtifact | null> {
    const rows = this.storage.sql.exec('SELECT * FROM identity_seed').toArray();
    if (!rows.length) return null;
    requireCatalog(
      rows.length === 1 &&
        rows[0]!.schema_version === 1 &&
        typeof rows[0]!.body === 'string',
      'seed-storage-schema',
    );
    const seed = await validateSeed(JSON.parse(rows[0]!.body));
    requireCatalog(
      rows[0]!.content_hash === seed.contentHash &&
        rows[0]!.export_hash === (await hashIdentityProjection(seed)),
      'seed-storage-hash',
    );
    this.checkIndex(seed);
    return seed;
  }
}
