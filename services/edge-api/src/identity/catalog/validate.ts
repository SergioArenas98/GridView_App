import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import { hashIdentityProjection } from '../discovery/keys';
import { requireCatalog, type SeedArtifact } from './model';
import { boundedJson, exact, freeze, validateSources } from './sources';
import { deriveSnapshot } from './snapshot';

/** Rebuild every derived member/index from the complete strictly validated source
 * closure. Equality rejects unknown fields, omissions and stale/forged indexes. */
export async function validateSeed(input: unknown): Promise<SeedArtifact> {
  const v = boundedJson(input);
  exact(v, [
    'format',
    'catalogSchemaVersion',
    'state',
    'revisionId',
    'sequence',
    'parentRevisionId',
    'contentHash',
    'snapshotByteLength',
    'sources',
    'snapshot',
  ]);
  requireCatalog(
    v.format === 'gridview-identity-seed/1' &&
      v.catalogSchemaVersion === 1 &&
      v.state === 'prepared-unactivated' &&
      v.revisionId === null &&
      v.sequence === 0 &&
      v.parentRevisionId === null,
    'seed-version',
  );
  const { sources, documents } = await validateSources(v.sources);
  requireCatalog(
    canonicalJson(sources) === canonicalJson(v.sources),
    'source-order',
  );
  const snapshot = await deriveSnapshot(sources, documents);
  requireCatalog(
    canonicalJson(snapshot) === canonicalJson(v.snapshot),
    'snapshot-source-parity',
  );
  requireCatalog(
    v.contentHash === (await hashIdentityProjection(snapshot)) &&
      v.snapshotByteLength === utf8(canonicalJson(snapshot)).length,
    'snapshot-hash',
  );
  return freeze(v as unknown as SeedArtifact);
}
