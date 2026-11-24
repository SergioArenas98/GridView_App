import { canonicalJson } from '../../ingest/canonical-json';
import { hashIdentityProjection } from '../discovery/keys';
import { requireCatalog } from './model';
import { boundedJson, exact } from './sources';
import { textBound, uuid, type ReviewDecision } from './review';
import {
  decodeCorrection,
  type IdentityCorrection,
  type CorrectionStatus,
} from './correction';
import { CatalogRevisionStore } from './revision-store';

/** Internal U4 storage mechanism; no external administration interface. */
export class CatalogCorrectionStore extends CatalogRevisionStore {
  protected correctionDecision(id: string): ReviewDecision {
    return this.body('decisions', id) as ReviewDecision;
  }
  async reportCorrection(
    input: Parameters<typeof decodeCorrection>[0],
    cap: unknown,
  ): Promise<IdentityCorrection> {
    const p = this.actor(cap, 'reviewer'),
      r = decodeCorrection(input),
      replay = await this.replay<IdentityCorrection>(
        p,
        'correction',
        r.operationId,
        r,
      );
    if (replay) return replay;
    const decision = this.correctionDecision(r.decisionId);
    requireCatalog(
      decision.action === 'request-correction' &&
        decision.principalId === p.principalId &&
        r.evidenceIds.every((id) => decision.evidenceIds.includes(id)),
      'correction-decision',
    );
    await this.evidence(r.evidenceIds);
    const time = this.time(),
      result: IdentityCorrection = {
        ...r,
        correctionId: crypto.randomUUID(),
        principalId: p.principalId,
        credentialId: p.credentialId,
        createdAt: time,
        status: 'reported',
      };
    return this.commit(
      p,
      'correction',
      r.operationId,
      r,
      result,
      await hashIdentityProjection(result),
      () => {
        for (const id of r.affectedDriverIds)
          requireCatalog(
            this.rows('SELECT id FROM identity_catalog_anchors WHERE id=?', id)
              .length,
            'correction-driver-missing',
          );
        for (const id of r.affectedRevisionIds) this.rawRevision(id);
        for (const id of r.affectedBindingIds)
          requireCatalog(
            this.rows(
              'SELECT body FROM identity_catalog_bindings WHERE body LIKE ?',
              '%' + id + '%',
            ).some(
              (row) =>
                (JSON.parse(String(row.body)) as { bindingId: string })
                  .bindingId === id,
            ),
            'correction-binding-missing',
          );
        for (const season of r.affectedSeasons)
          requireCatalog(
            this.rows(
              'SELECT season FROM identity_catalog_seasons WHERE season=? LIMIT 1',
              season,
            ).length,
            'correction-season-missing',
          );
        this.rows(
          'INSERT INTO identity_catalog_corrections VALUES(?,?)',
          result.correctionId,
          canonicalJson(result),
        );
        this.rows(
          'INSERT INTO identity_catalog_correction_events VALUES(?,?,?)',
          result.correctionId,
          result.correctionId,
          canonicalJson({
            status: 'reported',
            principalId: p.principalId,
            credentialId: p.credentialId,
            createdAt: time,
          }),
        );
        const head = this.head();
        head.admissionState = 'paused';
        this.rows(
          'UPDATE identity_catalog_head SET body=? WHERE id=1',
          canonicalJson(head),
        );
      },
      time,
    );
  }
  async correctionStatus(
    input: {
      schemaVersion: 1;
      operationId: string;
      correctionId: string;
      expectedEventId: string;
      status: Exclude<CorrectionStatus, 'reported'>;
      rationale: string;
    },
    cap: unknown,
  ): Promise<{ eventId: string; status: CorrectionStatus }> {
    const p = this.actor(cap, 'reviewer'),
      v = boundedJson(input);
    exact(v, [
      'schemaVersion',
      'operationId',
      'correctionId',
      'expectedEventId',
      'status',
      'rationale',
    ]);
    uuid(v.operationId);
    uuid(v.correctionId);
    uuid(v.expectedEventId);
    textBound(v.rationale);
    requireCatalog(
      v.schemaVersion === 1 &&
        ['contained', 'requires-separate-plan', 'closed-no-change'].includes(
          v.status as string,
        ),
      'correction-status',
    );
    const replay = await this.replay<{
      eventId: string;
      status: CorrectionStatus;
    }>(p, 'correction-status', v.operationId, v);
    if (replay) return replay;
    const correctionId = v.correctionId,
      expectedEventId = v.expectedEventId;
    const result = {
        eventId: crypto.randomUUID(),
        status: v.status as CorrectionStatus,
      },
      time = this.time();
    return this.commit(
      p,
      'correction-status',
      v.operationId,
      v,
      result,
      await hashIdentityProjection(result),
      () => {
        this.body('corrections', correctionId);
        requireCatalog(
          this.rows(
            'SELECT id FROM identity_catalog_correction_events WHERE correction=? ORDER BY rowid DESC LIMIT 1',
            correctionId,
          )[0]?.id === expectedEventId,
          'correction-status-conflict',
        );
        this.rows(
          'INSERT INTO identity_catalog_correction_events VALUES(?,?,?)',
          result.eventId,
          correctionId,
          canonicalJson({
            ...v,
            createdAt: time,
            principalId: p.principalId,
            credentialId: p.credentialId,
          }),
        );
      },
      time,
    );
  }
}
