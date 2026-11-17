import { canonicalJson } from '../../ingest/canonical-json';
import { hashIdentityProjection } from '../discovery/keys';
import type { IdentityHash } from '../discovery/model';
import { requireCatalog } from './model';
import { boundedJson, exact } from './sources';
import {
  decodeDossier,
  instant,
  textBound,
  uuid,
  type ReviewEvidence,
  type EvidenceReference,
} from './review';
import { CatalogRepository } from './repository';
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
interface EvidenceOperation {
  schemaVersion: 1;
  operationId: string;
  dossier: Parameters<typeof decodeDossier>[0];
}
/** Internal U4 storage mechanism; no external administration interface. */
export class CatalogEvidenceStore extends CatalogRepository {
  protected async reference(ref: EvidenceReference): Promise<unknown> {
    if (ref.kind === 'observation') {
      const r = this.rows(
        'SELECT body FROM identity_observations WHERE id=?',
        ref.observationId,
      )[0];
      requireCatalog(r, 'evidence-observation-missing');
      return JSON.parse(String(r.body));
    }
    if (ref.kind === 'repository') {
      const seed = await this.validatedOrigin();
      const source = seed.sources.find(
        (s) => s.path === ref.path && s.fileHash === ref.fileSha256,
      );
      requireCatalog(source, 'evidence-repository-source');
      let value: unknown = JSON.parse(source.text);
      for (const part of ref.recordPointer.slice(1).split('/')) {
        requireCatalog(
          value !== null &&
            typeof value === 'object' &&
            Object.hasOwn(value, part),
          'evidence-repository-pointer',
        );
        value = (value as Record<string, unknown>)[part];
      }
      return { fileHash: source.fileHash, value };
    }
    return { citationOnly: true };
  }
  async recordEvidence(
    input: EvidenceOperation,
    cap: unknown,
  ): Promise<ReviewEvidence> {
    const p = this.actor(cap, 'reviewer'),
      v = boundedJson(input);
    exact(v, ['schemaVersion', 'operationId', 'dossier']);
    requireCatalog(v.schemaVersion === 1, 'evidence-version');
    uuid(v.operationId);
    const request = { ...v, dossier: decodeDossier(v.dossier) };
    const replay = await this.replay<ReviewEvidence>(
      p,
      'evidence',
      v.operationId,
      request,
    );
    if (replay) return replay;
    const closure: ReviewEvidence['closure'] = [];
    let synthetic = request.dossier.synthetic;
    for (const ref of request.dossier.references) {
      const body = await this.reference(ref);
      closure.push({ reference: ref, body });
      if (ref.kind === 'observation') {
        const b = body as {
          provenance: { synthetic: boolean; transportKind: string };
        };
        synthetic ||=
          b.provenance.synthetic ||
          ['controlled', 'offline-replay'].includes(b.provenance.transportKind);
      }
    }
    const projectionDigest = await hashIdentityProjection(request.dossier),
      createdAt = this.time();
    const content = {
      ...request.dossier,
      synthetic,
      kind: 'review-dossier' as const,
      createdAt,
      createdBy: p,
      projectionDigest,
      closure,
    };
    // Hash the effective synthetic marker as well as the reviewed claim set.
    content.projectionDigest = await hashIdentityProjection({
      ...request.dossier,
      synthetic,
    });
    const result = {
      ...content,
      evidenceId: await hashIdentityProjection(content),
    };
    return this.commit(
      p,
      'evidence',
      v.operationId,
      request,
      result,
      await hashIdentityProjection(result),
      () => {
        for (const c of closure)
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
              'evidence-reference-stale',
            );
        this.rows(
          'INSERT INTO identity_catalog_dossiers VALUES(?,?)',
          result.evidenceId,
          canonicalJson(result),
        );
        this.protect([result]);
      },
      createdAt,
    );
  }
  protected protect(evidence: ReviewEvidence[]): void {
    for (const e of evidence)
      for (const r of e.references)
        if (r.kind === 'observation') {
          this.rows(
            'UPDATE identity_observations SET protected=1 WHERE id=?',
            r.observationId,
          );
          const row = this.rows(
            'SELECT candidate,body FROM identity_observations WHERE id=?',
            r.observationId,
          )[0];
          requireCatalog(row, 'evidence-observation-missing');
          const o = JSON.parse(String(row.body)) as { evidenceDigest: string };
          this.rows(
            'UPDATE identity_evidence SET protected=1 WHERE candidate=? AND id=?',
            String(row.candidate),
            o.evidenceDigest,
          );
        }
  }
  protected async evidence(ids: IdentityHash[]): Promise<ReviewEvidence[]> {
    const result: ReviewEvidence[] = [];
    for (const id of ids) {
      const v = boundedJson(this.body('dossiers', id));
      exact(v, [
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
        ...dossier
      } = v;
      const d = decodeDossier(dossier);
      instant(createdAt);
      requireCatalog(
        kind === 'review-dossier' &&
          evidenceId === id &&
          Array.isArray(closure) &&
          closure.length === d.references.length,
        'dossier-schema',
      );
      exact(createdBy, ['principalId', 'credentialId', 'authMethod', 'roles']);
      textBound(createdBy.principalId, 200);
      textBound(createdBy.credentialId, 200);
      requireCatalog(
        ['test-logical-principal', 'individual-bearer'].includes(
          createdBy.authMethod as string,
        ) &&
          Array.isArray(createdBy.roles) &&
          createdBy.roles.includes('reviewer'),
        'dossier-actor',
      );
      for (let i = 0; i < closure.length; i++) {
        const c = closure[i];
        exact(c, ['reference', 'body']);
        requireCatalog(same(c.reference, d.references[i]), 'dossier-closure');
      }
      requireCatalog(
        projectionDigest === (await hashIdentityProjection(d)) &&
          id ===
            (await hashIdentityProjection({
              kind,
              createdAt,
              createdBy,
              projectionDigest,
              closure,
              ...d,
            })),
        'dossier-integrity',
      );
      requireCatalog(
        !d.synthetic || this.authority?.isolatedLocalTests,
        'synthetic-evidence-forbidden',
      );
      result.push(v as unknown as ReviewEvidence);
    }
    return result;
  }
}
