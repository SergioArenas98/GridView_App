import { applyReviewedBase, type BaseImportDecision } from './base-import';
import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import { hashIdentityProjection } from '../discovery/keys';
import { catalogLimits, requireCatalog } from './model';
import { boundedJson, exact, records, freeze } from './sources';
import { validateSeed } from './validate';
import {
  applyDecision,
  decodeDecision,
  decodeRevision,
  type CatalogRevision,
} from './revision';
import {
  decodeDossier,
  instant,
  textBound,
  type ReviewEvidence,
} from './review';
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
/** Offline re-import verification. Rebuild the entire immutable lineage from
 * exact R0 sources and reviewed decisions; this never writes or activates. */
export async function verifyRevisionExport(
  text: string,
): Promise<CatalogRevision> {
  requireCatalog(
    utf8(text).length <= catalogLimits.exportBytes,
    'revision-export-capacity',
  );
  const v = boundedJson(JSON.parse(text));
  exact(v, ['format', 'seed', 'revision', 'history', 'decisions']);
  requireCatalog(
    v.format === 'gridview-identity-revision-export/1',
    'revision-export-version',
  );
  const seed = await validateSeed(v.seed),
    last = decodeRevision(v.revision),
    history = records(v.history),
    decisions = records(v.decisions);
  requireCatalog(
    history.length > 0 &&
      history.length <= 4096 &&
      decisions.length === history.length,
    'revision-export-lineage',
  );
  const evidence = last.snapshot.reviewEvidence ?? [];
  for (const e of evidence) {
    const detached = boundedJson(e);
    exact(detached, [
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
    } = detached;
    const d = decodeDossier(input);
    instant(createdAt);
    exact(createdBy, ['principalId', 'credentialId', 'authMethod', 'roles']);
    textBound(createdBy.principalId, 200);
    textBound(createdBy.credentialId, 200);
    requireCatalog(
      kind === 'review-dossier' &&
        ['test-logical-principal', 'individual-bearer'].includes(
          createdBy.authMethod as string,
        ) &&
        Array.isArray(createdBy.roles) &&
        createdBy.roles.includes('reviewer') &&
        Array.isArray(closure) &&
        closure.length === d.references.length,
      'export-evidence-schema',
    );
    for (let i = 0; i < closure.length; i++) {
      const c = closure[i];
      exact(c, ['reference', 'body']);
      requireCatalog(
        same(c.reference, d.references[i]),
        'export-evidence-closure',
      );
    }
    requireCatalog(
      projectionDigest === (await hashIdentityProjection(d)) &&
        evidenceId ===
          (await hashIdentityProjection({
            kind,
            createdAt,
            createdBy,
            projectionDigest,
            closure,
            ...d,
          })),
      'export-evidence-integrity',
    );
  }
  let previous: CatalogRevision | null = null;
  for (let i = 0; i < history.length; i++) {
    const h = history[i]!;
    exact(h, [
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
      'seasonContent',
    ]);
    const { seasonContent, ...header } = h;
    const decision = decisions[i]!;
    requireCatalog(
      Array.isArray(header.decisionIds) &&
        header.decisionIds.length === 1 &&
        header.decisionIds[0] === decision.decisionId,
      'export-decision-closure',
    );
    let snapshot = structuredClone(seed.snapshot);
    if (previous === null) {
      exact(decision, [
        'decisionId',
        'action',
        'operationId',
        'principalId',
        'credentialId',
        'authMethod',
        'decidedAt',
        'contentHash',
      ]);
      requireCatalog(
        header.parentRevisionId === null &&
          header.parentContentHash === null &&
          header.sequence === 1 &&
          decision.action === 'import-seed' &&
          decision.contentHash === seed.contentHash &&
          decision.principalId === header.createdByPrincipal &&
          decision.decidedAt === header.createdAt,
        'export-seed-lineage',
      );
    } else {
      const d =
        decision.action === 'import-base'
          ? (decision as unknown as BaseImportDecision)
          : decodeDecision(decision);
      requireCatalog(
        header.parentRevisionId === previous.revisionId &&
          header.parentContentHash === previous.contentHash &&
          header.sequence === previous.sequence + 1 &&
          d.baseRevisionId === previous.revisionId &&
          d.principalId === header.createdByPrincipal &&
          d.decidedAt === header.createdAt,
        'export-parent-lineage',
      );
      const supports = evidence.filter((e) =>
        d.evidenceIds.includes(e.evidenceId),
      );
      snapshot =
        d.action === 'import-base'
          ? await applyReviewedBase(
              previous.snapshot,
              d,
              supports as ReviewEvidence[],
            )
          : await applyDecision(
              previous.snapshot,
              d,
              supports as ReviewEvidence[],
            );
      const seasons = records(seasonContent);
      requireCatalog(
        seasons.length === snapshot.seasonContent.length,
        'export-season-closure',
      );
      for (const s of snapshot.seasonContent) {
        const next = seasons.find((x) => x.season === s.season);
        requireCatalog(
          next &&
            next.seasonProjectionHash === s.seasonProjectionHash &&
            typeof next.datasetVersion === 'string',
          'export-season-projection',
        );
        const old = previous.snapshot.seasonContent.find(
          (x) => x.season === s.season,
        )!;
        requireCatalog(
          s.seasonProjectionHash === old.seasonProjectionHash
            ? next.datasetVersion === old.datasetVersion
            : /^\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/.test(next.datasetVersion) &&
                next.datasetVersion.startsWith(
                  String(header.createdAt).slice(0, 10).replaceAll('-', '.') +
                    '.',
                ),
          'export-dataset-label',
        );
        s.datasetVersion = next.datasetVersion;
      }
    }
    requireCatalog(
      same(snapshot.seasonContent, seasonContent),
      'export-season-integrity',
    );
    const reconstructed = decodeRevision({ ...header, snapshot });
    requireCatalog(
      reconstructed.contentHash === (await hashIdentityProjection(snapshot)) &&
        reconstructed.snapshotByteLength ===
          utf8(canonicalJson(snapshot)).length,
      'export-revision-integrity',
    );
    previous = reconstructed;
  }
  requireCatalog(same(previous, last), 'export-complete-snapshot');
  return freeze(last);
}
