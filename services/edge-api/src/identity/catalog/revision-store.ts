import { applyReviewedBase } from './base-import';
import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import { canonicalKey } from '../discovery/keys';
import { hashIdentityProjection } from '../discovery/keys';
import { integer } from '../wire-decoders';
import { catalogLimits, requireCatalog } from './model';
import { validateSeed } from './validate';
import { boundedJson, exact, freeze } from './sources';
import { uuid } from './review';
import { applyDecision, type CatalogRevision } from './revision';
import { reserveDatasetVersions } from './dataset-version';
import { type RevisionOperation } from './activation';
import { CatalogEvidenceStore } from './evidence-store';
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const size = (a: unknown) => utf8(canonicalJson(a)).length;
interface SeedOperation {
  schemaVersion: 1;
  operationId: string;
  revisionId: string;
  expectedActiveRevisionId: null;
  expectedActivationSequence: 0;
}
/** Internal U4 storage mechanism; no external administration interface. */
export class CatalogRevisionStore extends CatalogEvidenceStore {
  async proposeSeed(
    input: unknown,
    command: SeedOperation,
    cap: unknown,
  ): Promise<CatalogRevision> {
    const p = this.actor(cap, 'activator'),
      cmd = boundedJson(command);
    exact(cmd, [
      'schemaVersion',
      'operationId',
      'revisionId',
      'expectedActiveRevisionId',
      'expectedActivationSequence',
    ]);
    uuid(cmd.operationId);
    uuid(cmd.revisionId);
    requireCatalog(
      cmd.schemaVersion === 1 &&
        cmd.expectedActiveRevisionId === null &&
        cmd.expectedActivationSequence === 0,
      'seed-operation',
    );
    const seed = await validateSeed(input),
      request = { command: cmd, seed };
    const replay = await this.replay<CatalogRevision>(
      p,
      'seed',
      cmd.operationId,
      request,
    );
    if (replay) return replay;
    requireCatalog(
      this.authority?.isolatedLocalTests ||
        p.authMethod === 'individual-bearer',
      'seed-activation-local-only',
    );
    this.expectHead(null, 0);
    const createdAt = this.time(),
      decisionId = crypto.randomUUID();
    const revision: CatalogRevision = {
      revisionId: cmd.revisionId,
      sequence: 1,
      parentRevisionId: null,
      parentContentHash: null,
      catalogSchemaVersion: 1,
      contentHash: seed.contentHash,
      createdAt,
      createdByPrincipal: p.principalId,
      decisionIds: [decisionId],
      baseContentDigest: seed.snapshot.seasonContent[0]!.baseContentDigest,
      snapshotByteLength: seed.snapshotByteLength,
      snapshot: structuredClone(seed.snapshot),
      candidateHeads: [],
    };
    return this.commit(
      p,
      'seed',
      cmd.operationId,
      request,
      revision,
      await hashIdentityProjection(revision),
      () => {
        this.expectHead(null, 0);
        requireCatalog(
          !this.rows('SELECT id FROM identity_catalog_origin').length,
          'seed-already-proposed',
        );
        this.rows(
          'INSERT INTO identity_catalog_origin VALUES(1,?)',
          canonicalJson(seed),
        );
        this.rows(
          'INSERT INTO identity_catalog_decisions VALUES(?,?)',
          decisionId,
          canonicalJson({
            decisionId,
            action: 'import-seed',
            operationId: cmd.operationId,
            principalId: p.principalId,
            credentialId: p.credentialId,
            authMethod: p.authMethod,
            decidedAt: createdAt,
            contentHash: seed.contentHash,
          }),
        );
        this.insertRevision(revision);
        reserveDatasetVersions(
          this.storage,
          revision.snapshot,
          null,
          revision.revisionId,
          createdAt,
        );
        for (const d of revision.snapshot.drivers)
          this.rows(
            'INSERT INTO identity_catalog_anchors VALUES(?,?,?)',
            d.anchor.driverId,
            d.anchor.createdDecisionId,
            canonicalJson(d.anchor),
          );
        for (const b of revision.snapshot.bindings)
          this.rows(
            'INSERT INTO identity_catalog_keys VALUES(?,?,?,0)',
            canonicalKey(b.key),
            b.targetId,
            revision.revisionId,
          );
        this.insertIndexes(revision);
      },
      createdAt,
    );
  }
  protected checkExportCapacity(r: CatalogRevision): void {
    requireCatalog(
      size(this.revisionExport(r)) <= catalogLimits.exportBytes,
      'revision-export-capacity',
    );
  }
  protected revisionExport(r: CatalogRevision) {
    const chain: CatalogRevision[] = [r],
      seen = new Set([r.revisionId]);
    let parent = r.parentRevisionId;
    while (parent !== null) {
      requireCatalog(
        !seen.has(parent) && seen.size < 4096,
        'revision-parent-cycle',
      );
      seen.add(parent);
      const previous = this.rawRevision(parent);
      chain.unshift(previous);
      parent = previous.parentRevisionId;
    }
    return {
      format: 'gridview-identity-revision-export/1',
      seed: this.origin(),
      revision: r,
      history: chain.map(({ snapshot, ...header }) => ({
        ...header,
        seasonContent: snapshot.seasonContent,
      })),
      decisions: chain.flatMap((v) =>
        v.decisionIds.map((id) => {
          const row = this.rows(
            'SELECT body FROM identity_catalog_decisions WHERE id=?',
            id,
          )[0];
          return row
            ? JSON.parse(String(row.body))
            : (r.snapshot.reviewDecisions?.find((d) => d.decisionId === id) ??
                r.snapshot.reviewBaseImports?.find((d) => d.decisionId === id));
        }),
      ),
    };
  }
  async readRevision(
    id: string,
    seen = new Set<string>(),
  ): Promise<CatalogRevision> {
    requireCatalog(!seen.has(id) && seen.size < 4096, 'revision-parent-cycle');
    seen.add(id);
    const r = this.rawRevision(id);
    requireCatalog(
      r.contentHash === (await hashIdentityProjection(r.snapshot)) &&
        r.snapshotByteLength === size(r.snapshot),
      'revision-content-integrity',
    );
    requireCatalog(
      r.decisionIds.length === 1 &&
        new Set(r.candidateHeads.map((c) => c.candidateId)).size ===
          r.candidateHeads.length,
      'revision-decision-closure',
    );
    if (r.parentRevisionId === null) {
      const seed = await this.validatedOrigin();
      requireCatalog(
        same(r.snapshot, seed.snapshot) &&
          r.contentHash === seed.contentHash &&
          r.sequence === 1 &&
          r.parentContentHash === null &&
          r.candidateHeads.length === 0,
        'root-seed-parity',
      );
      const decision = this.body('decisions', r.decisionIds[0]!);
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
        decision.decisionId === r.decisionIds[0] &&
          decision.action === 'import-seed' &&
          decision.contentHash === seed.contentHash &&
          decision.principalId === r.createdByPrincipal &&
          decision.decidedAt === r.createdAt,
        'seed-decision-provenance',
      );
    } else {
      const parent = await this.readRevision(r.parentRevisionId, seen);
      requireCatalog(
        this.status(parent.revisionId) === 'activated' &&
          r.parentContentHash === parent.contentHash &&
          r.sequence === parent.sequence + 1,
        'parent-revision-integrity',
      );
      const d =
        r.snapshot.reviewDecisions?.find(
          (d) => d.decisionId === r.decisionIds[0],
        ) ??
        r.snapshot.reviewBaseImports?.find(
          (d) => d.decisionId === r.decisionIds[0],
        );
      requireCatalog(
        d &&
          same(this.body('decisions', d.decisionId), d) &&
          d.baseRevisionId === parent.revisionId &&
          d.decidedAt === r.createdAt &&
          d.principalId === r.createdByPrincipal,
        'revision-decision-closure',
      );
      const supports = await this.evidence(d.evidenceIds),
        rebuilt =
          d.action === 'import-base'
            ? await applyReviewedBase(parent.snapshot, d, supports)
            : await applyDecision(parent.snapshot, d, supports);
      requireCatalog(
        same(
          r.candidateHeads,
          d.candidateId === null
            ? []
            : [
                {
                  candidateId: d.candidateId,
                  recordVersion: d.expectedCandidateVersion! + 1,
                  evidenceHead: d.evidenceHead,
                },
              ],
        ),
        'revision-reviewed-candidates',
      );
      for (const s of rebuilt.seasonContent) {
        const actual = r.snapshot.seasonContent.find(
          (x) => x.season === s.season,
        )!;
        const old = parent.snapshot.seasonContent.find(
          (x) => x.season === s.season,
        )!;
        const label =
          s.seasonProjectionHash === old.seasonProjectionHash
            ? old.datasetVersion
            : actual.datasetVersion;
        if (s.seasonProjectionHash !== old.seasonProjectionHash)
          requireCatalog(
            this.rows(
              'SELECT revision FROM identity_catalog_labels WHERE season=? AND label=?',
              s.season,
              label,
            )[0]?.revision === r.revisionId &&
              label.startsWith(
                r.createdAt.slice(0, 10).replaceAll('-', '.') + '.',
              ),
            'dataset-reservation-owner',
          );
        requireCatalog(
          actual.datasetVersion === label,
          'dataset-projection-consistency',
        );
        s.datasetVersion = label;
      }
      requireCatalog(same(rebuilt, r.snapshot), 'revision-parent-delta');
    }
    requireCatalog(
      r.baseContentDigest === r.snapshot.seasonContent[0]?.baseContentDigest,
      'revision-base-integrity',
    );
    for (const s of r.snapshot.seasonContent)
      requireCatalog(
        this.rows(
          'SELECT projection FROM identity_catalog_labels WHERE season=? AND label=?',
          s.season,
          s.datasetVersion,
        )[0]?.projection === s.seasonProjectionHash,
        'dataset-reservation-integrity',
      );
    this.checkIndexes(r);
    this.checkExportCapacity(r);
    return freeze(r);
  }
  protected fresh(r: CatalogRevision): void {
    for (const expected of r.candidateHeads) {
      const c = this.candidate(expected.candidateId);
      requireCatalog(
        c.state === 'approved-pending' &&
          c.proposedRevisionId === r.revisionId &&
          c.recordVersion === expected.recordVersion &&
          c.evidenceHead === expected.evidenceHead &&
          !c.overflowed &&
          !c.conflict,
        'candidate-evidence-stale',
      );
    }
    for (const e of r.snapshot.reviewEvidence ?? []) {
      requireCatalog(
        same(this.body('dossiers', e.evidenceId), e),
        'reviewed-evidence-stale',
      );
      for (const c of e.closure)
        if (c.reference.kind === 'observation')
          requireCatalog(
            same(
              JSON.parse(
                String(
                  this.rows(
                    'SELECT body FROM identity_observations WHERE id=?',
                    c.reference.observationId,
                  )[0]?.body,
                ),
              ),
              c.body,
            ),
            'reviewed-evidence-stale',
          );
    }
  }
  protected decodeOperation(
    input: unknown,
    activation = false,
  ): RevisionOperation {
    const v = boundedJson(input);
    exact(
      v,
      activation
        ? [
            'schemaVersion',
            'operationId',
            'revisionId',
            'expectedActiveRevisionId',
            'expectedActivationSequence',
            'certificateId',
          ]
        : [
            'schemaVersion',
            'operationId',
            'revisionId',
            'expectedActiveRevisionId',
            'expectedActivationSequence',
          ],
    );
    requireCatalog(
      v.schemaVersion === 1 && integer(v.expectedActivationSequence),
      'revision-operation',
    );
    uuid(v.operationId);
    uuid(v.revisionId);
    if (v.expectedActiveRevisionId !== null) uuid(v.expectedActiveRevisionId);
    if (activation) uuid(v.certificateId);
    return v as unknown as RevisionOperation;
  }
  async exportRevision(id: string): Promise<string> {
    const revision = await this.readRevision(id);
    this.checkExportCapacity(revision);
    return canonicalJson(this.revisionExport(revision));
  }
}
