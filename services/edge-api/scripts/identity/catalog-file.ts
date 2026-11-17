import { canonicalJson } from '../../src/ingest/canonical-json';
import { hashIdentityProjection } from '../../src/identity/discovery/keys';
import {
  catalogLimits,
  requireCatalog,
} from '../../src/identity/catalog/model';
import { boundedJson, exact } from '../../src/identity/catalog/sources';
import { contextFromExport } from '../../src/identity/catalog/run-context';
import { catalogReference } from '../../src/ingest/catalog-reference';
import { isHash } from '../../src/identity/wire-decoders';
import {
  decodeDossier,
  instant,
  textBound,
} from '../../src/identity/catalog/review';

/** exportSha256 is the verified U5 exportHash, copied verbatim with its prefix.
 * Formatting is not authority; complete U3/U4 lineage is still mandatory. */
export async function verifyCatalogFile(
  bytes: Uint8Array,
  expected: {
    installationId: string;
    season: number;
    /** U10: the whole generation's explicit policy; absent is strict. */
    inventoryPolicy?: 'strict/1' | 'optional-drivers/1';
  },
) {
  requireCatalog(
    bytes.byteLength > 0 && bytes.byteLength <= catalogLimits.exportBytes,
    'catalog-file-capacity',
  );
  const wrapper = boundedJson(
    JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes),
    ),
  );
  exact(wrapper, [
    'schemaVersion',
    'format',
    'installationId',
    'revision',
    'decisions',
    'evidence',
    'lineage',
    'exportHash',
  ]);
  const { exportHash, ...body } = wrapper;
  requireCatalog(
    body.schemaVersion === 1 &&
      body.format === 'gridview-identity-admin-export/1' &&
      body.installationId === expected.installationId &&
      isHash(exportHash) &&
      exportHash === (await hashIdentityProjection(body)),
    'catalog-file-wrapper',
  );
  exact(body.lineage, ['format', 'seed', 'revision', 'history', 'decisions']);
  const equal = (a: unknown, b: unknown) =>
    canonicalJson(a) === canonicalJson(b);
  requireCatalog(
    equal(body.revision, body.lineage.revision) &&
      equal(body.decisions, body.lineage.decisions) &&
      Array.isArray(body.evidence),
    'catalog-file-contradiction',
  );
  // Referenced reviewed evidence must be present in the wrapper, with identical bodies.
  exact(body.revision, [
    'revisionId',
    'sequence',
    'parentRevisionId',
    'parentContentHash',
    'catalogSchemaVersion',
    'contentHash',
    'createdAt',
    'createdByPrincipal',
    'decisionIds',
    'baseContentDigest',
    'snapshotByteLength',
    'candidateHeads',
    'snapshot',
  ]);
  const snapshot = body.revision.snapshot as { reviewEvidence?: unknown[] };
  for (const e of snapshot.reviewEvidence ?? [])
    requireCatalog(
      body.evidence.some((x) => equal(x, e)),
      'catalog-file-evidence',
    );
  const seen = new Set<string>();
  for (const evidence of body.evidence) {
    exact(evidence, [
      'claims',
      'references',
      'rationale',
      'synthetic',
      'evidenceId',
      'kind',
      'createdAt',
      'createdBy',
      'projectionDigest',
      'closure',
    ]);
    const {
      evidenceId,
      kind,
      createdAt,
      createdBy,
      projectionDigest,
      closure,
      ...input
    } = evidence;
    const dossier = decodeDossier(input);
    instant(createdAt);
    exact(createdBy, ['principalId', 'credentialId', 'authMethod', 'roles']);
    textBound(createdBy.principalId, 200);
    textBound(createdBy.credentialId, 200);
    requireCatalog(
      typeof evidenceId === 'string' &&
        !seen.has(evidenceId) &&
        kind === 'review-dossier' &&
        ['test-logical-principal', 'individual-bearer'].includes(
          String(createdBy.authMethod),
        ) &&
        Array.isArray(createdBy.roles) &&
        createdBy.roles.includes('reviewer') &&
        Array.isArray(closure) &&
        closure.length === dossier.references.length &&
        projectionDigest === (await hashIdentityProjection(dossier)),
      'catalog-file-evidence',
    );
    seen.add(evidenceId);
    for (const [i, c] of closure.entries()) {
      exact(c, ['reference', 'body']);
      requireCatalog(
        equal(c.reference, dossier.references[i]),
        'catalog-file-evidence-closure',
      );
    }
    requireCatalog(
      evidenceId ===
        (await hashIdentityProjection({
          kind,
          createdAt,
          createdBy,
          projectionDigest,
          closure,
          ...dossier,
        })),
      'catalog-file-evidence-integrity',
    );
  }
  const context = await contextFromExport(
    canonicalJson(body.lineage),
    expected,
  );
  return Object.freeze({
    context,
    reference: catalogReference(context, exportHash),
  });
}
