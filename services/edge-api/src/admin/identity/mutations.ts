import type { Mutation } from './guards.mjs';
import { hashIdentityProjection } from '../../identity/discovery/keys';
import type { IdentityHash } from '../../identity/discovery/model';
import {
  IdentityAdminWorkflow,
  revisionDelta,
} from '../../identity/catalog/admin-workflow';
import { catalogValidatorVersion } from '../../identity/catalog/activation';
import {
  decodeDossier,
  decodeReview,
  type CatalogPrincipal,
  type DossierInput,
  type DuplicateReview,
} from '../../identity/catalog/review';
import type { ReviewResult } from '../../identity/catalog/workflow';
import type { CatalogRevision } from '../../identity/catalog/revision';
import type { Route } from './requests';
import { AdminError } from './responses';

interface CandidateRef {
  candidateId: IdentityHash;
  expectedCandidateVersion: number;
  expectedEvidenceHead: IdentityHash;
}
interface Support {
  evidenceIds: IdentityHash[];
  dossierId: IdentityHash;
  rationale: string;
}
export function proposalResponse(result: unknown): {
  data: Record<string, unknown>;
  status: number;
} {
  const review = result as ReviewResult;
  const r = review.revision;
  if (!r)
    return {
      status: 200,
      data: {
        candidateVersion: review.decision.expectedCandidateVersion! + 1,
        state:
          review.decision.action === 'reopen'
            ? 'unresolved'
            : review.decision.action === 'reject'
              ? 'rejected'
              : 'quarantined',
        decisionId: review.decision.decisionId,
      },
    };
  return {
    status: 200,
    data: {
      decisionId: review.decision.decisionId,
      proposedRevisionId: r.revisionId,
      catalogHash: r.contentHash,
      datasetVersions: r.snapshot.seasonContent,
      candidateVersion:
        review.decision.expectedCandidateVersion === null
          ? null
          : review.decision.expectedCandidateVersion + 1,
      status: 'proposed',
      ...(review.decision.action === 'create-driver'
        ? { driverId: review.decision.targetId }
        : {}),
    },
  };
}
export async function mutateIdentity(
  w: IdentityAdminWorkflow,
  route: Route,
  r: Mutation,
  p: CatalogPrincipal,
  cap: unknown,
  synthetic: boolean,
): Promise<void> {
  const payload = r.payload,
    id = route.id!,
    context = w.context!;
  const operation = {
    schemaVersion: 1 as const,
    operationId: r.operationId,
    expectedActiveRevisionId: r.expectedActiveRevisionId,
    expectedActivationSequence: r.expectedActivationSequence,
  };
  if (route.operation === 'admission') {
    await w.simple(r, p, 'admission', () =>
      w.admission(
        payload.expectedAdmissionState as string,
        payload.state as 'open' | 'paused',
      ),
    );
    return;
  }
  if (route.operation === 'acknowledge') {
    await w.simple(r, p, 'acknowledge', () =>
      w.acknowledge(
        id as IdentityHash,
        payload.notificationGeneration as number,
        p,
      ),
    );
    return;
  }
  if (route.operation === 'seed') {
    const artifact = payload.seedArtifact as {
      format: string;
      seed: unknown;
      dossier: DossierInput;
    };
    if (
      (await hashIdentityProjection(artifact)) !== payload.seedArtifactHash ||
      (await hashIdentityProjection(artifact.dossier)) !==
        payload.approvedImportDossierId
    )
      throw new AdminError(422, 'CATALOG_INVALID');
    const dossier = decodeDossier(artifact.dossier);
    if (dossier.synthetic && !synthetic)
      throw new AdminError(422, 'EVIDENCE_INSUFFICIENT');
    // Bootstrap references are retained citations or repository records embedded
    // in the seed; no external fetch and no pre-existing store FK is required.
    const evidence = await w.prepareImportDossier(dossier, artifact.seed, p);
    context.effect = (value) =>
      w.attachImportDossier(evidence, (value as CatalogRevision).revisionId);
    const parent = null;
    context.decorate = (result) => {
      const revision = result as CatalogRevision;
      return {
        status: 200,
        data: {
          deltaFromParent: revisionDelta(revision, parent),
          proposedRevisionId: revision.revisionId,
          catalogHash: revision.contentHash,
          datasetVersions: revision.snapshot.seasonContent,
          status: 'proposed',
          parity: { exactSeed: true },
        },
      };
    };
    await w.proposeSeed(
      artifact.seed as never,
      {
        ...operation,
        revisionId: crypto.randomUUID(),
        expectedActiveRevisionId: null,
        expectedActivationSequence: 0,
      },
      cap,
    );
    return;
  }
  if (route.operation === 'import-base') {
    const support = payload.support as Support;
    await w.checkedSupport(support.evidenceIds);
    const parent = await w.readRevision(r.expectedActiveRevisionId!);
    context.decorate = (result) => {
      const revision = result as CatalogRevision;
      return {
        status: 200,
        data: {
          deltaFromParent: revisionDelta(revision, parent),
          proposedRevisionId: revision.revisionId,
          catalogHash: revision.contentHash,
          datasetVersions: revision.snapshot.seasonContent,
          status: 'proposed',
        },
      };
    };
    await w.proposeBaseImport(
      r,
      payload.baseArtifact,
      payload.baseArtifactHash as IdentityHash,
      support.evidenceIds,
      cap,
    );
    return;
  }
  if (['validate', 'activate', 'abandon'].includes(route.operation)) {
    const revision = await w.readRevision(id);
    if (revision.contentHash !== payload.catalogHash)
      throw new AdminError(409, 'CATALOG_HEAD_CONFLICT');
    const cmd = { ...operation, revisionId: id };
    if (route.operation === 'validate') {
      if (payload.expectedValidatorVersion !== catalogValidatorVersion)
        throw new AdminError(422, 'VALIDATION_STALE');
      context.decorate = (value) => {
        const v = value as Awaited<
          ReturnType<IdentityAdminWorkflow['validate']>
        >;
        return {
          status: v.valid ? 200 : 422,
          data: {
            valid: v.valid,
            reportHash: v.reportHash,
            validatorVersion: v.validatorVersion,
            issues: v.issues.map(() => ({
              code: 'CATALOG_INVALID',
              path: 'revision',
            })),
            baseRevisionId: v.baseRevisionId,
          },
        };
      };
      await w.validate(cmd, cap);
    } else if (route.operation === 'activate') {
      const cert = w.certificates(id);
      if (
        !cert ||
        cert.reportHash !== payload.validationReportHash ||
        cert.valid !== true
      )
        throw new AdminError(422, 'VALIDATION_STALE');
      context.decorate = (value) => {
        const result = value as Awaited<
          ReturnType<IdentityAdminWorkflow['activate']>
        >;
        if (result.outcome !== 'activated') {
          const head = w.head();
          return {
            status: 409,
            data: {
              code: 'CATALOG_HEAD_CONFLICT',
              currentActiveRevisionId: head.activeRevisionId,
              currentActivationSequence: head.activationSequence,
            },
          };
        }
        return {
          status: 200,
          data: {
            activeRevisionId: result.revisionId,
            activationSequence: result.activationSequence,
            catalogHash: revision.contentHash,
            activatedAt: w.activationTime(),
            datasetVersions: revision.snapshot.seasonContent,
            ...(result.code ? { code: result.code } : {}),
          },
        };
      };
      await w.activate(
        { ...cmd, certificateId: cert.certificateId as string },
        cap,
      );
    } else {
      context.decorate = () => ({ status: 200, data: { status: 'abandoned' } });
      await w.abandonAuthorized(cmd, p, cap);
    }
    return;
  }
  if (route.operation === 'evidence') {
    const ref = payload.candidate as CandidateRef;
    w.assertHead(r);
    w.assertCandidate(
      ref.candidateId,
      ref.expectedCandidateVersion,
      ref.expectedEvidenceHead,
    );
    let nextHead: IdentityHash;
    context.prepare = async (value) => {
      const e = value as { evidenceId: IdentityHash };
      nextHead = await hashIdentityProjection({
        previous: ref.expectedEvidenceHead,
        dossierId: e.evidenceId,
        duplicateReview: payload.duplicateReview,
      });
    };
    context.effect = (value) => {
      const e = value as { evidenceId: IdentityHash };
      w.assertHead(r);
      w.attachDossier(
        ref.candidateId,
        ref.expectedCandidateVersion,
        ref.expectedEvidenceHead,
        e.evidenceId,
        nextHead,
      );
    };
    context.decorate = (value) => ({
      status: 200,
      data: {
        evidenceId: (value as { evidenceId: IdentityHash }).evidenceId,
        candidateVersion: ref.expectedCandidateVersion + 1,
        evidenceHead: nextHead,
      },
    });
    await w.recordEvidence(
      {
        schemaVersion: 1,
        operationId: r.operationId,
        dossier: decodeDossier({
          claims: payload.claims,
          references: payload.references,
          rationale: r.reason,
          synthetic,
        }),
      },
      cap,
    );
    return;
  }
  let ref: CandidateRef | null = null;
  if (
    ['approve-existing', 'approve-new', 'correction'].includes(route.operation)
  )
    ref = payload.candidate as CandidateRef;
  if (route.operation === 'disposition')
    ref = {
      candidateId: id as IdentityHash,
      expectedCandidateVersion: payload.expectedCandidateVersion as number,
      expectedEvidenceHead: payload.expectedEvidenceHead as IdentityHash,
    };
  const candidate = ref
    ? w.assertCandidate(
        ref.candidateId,
        ref.expectedCandidateVersion,
        ref.expectedEvidenceHead,
      )
    : null;
  const support = payload.support as Support | undefined;
  const target =
    route.operation === 'approve-existing'
      ? payload.targetDriverId
      : route.operation === 'approve-new'
        ? payload.driverId
        : route.operation === 'approve-profile'
          ? id
          : null;
  const evidenceIds =
    support?.evidenceIds ?? (payload.evidenceIds as IdentityHash[]);
  const evidence = await w.checkedSupport(evidenceIds);
  const action =
    route.operation === 'approve-existing'
      ? 'bind-existing'
      : route.operation === 'approve-new'
        ? 'create-driver'
        : route.operation === 'approve-profile'
          ? 'approve-profile'
          : route.operation === 'correction'
            ? 'request-correction'
            : payload.action;
  if (route.operation === 'approve-profile') {
    const revision = await w.readRevision(r.expectedActiveRevisionId!);
    const driver = revision.snapshot.drivers.find(
      (d) => d.anchor.driverId === id,
    );
    if (!driver || driver.profileHash !== payload.expectedProfileHash)
      throw new AdminError(409, 'CANDIDATE_STALE');
  }
  const review = decodeReview({
    ...operation,
    candidateId: ref?.candidateId ?? null,
    expectedCandidateVersion: ref?.expectedCandidateVersion ?? null,
    evidenceHead:
      ref?.expectedEvidenceHead ?? (await hashIdentityProjection(evidence)),
    action,
    targetId: target,
    proposedBindingKey: ['bind-existing', 'create-driver'].includes(
      String(action),
    )
      ? candidate!.key
      : null,
    profile: payload.profile
      ? { ...(payload.profile as Record<string, unknown>), id: target }
      : null,
    evidenceIds,
    reasonCode: payload.reasonCode ?? 'no-approved-provider-mapping',
    rationale: support?.rationale ?? r.reason,
    duplicateReview: (payload.duplicateReview ??
      null) as DuplicateReview | null,
  });
  if (route.operation === 'correction') {
    context.decorate = (value) => ({
      status: 200,
      data: {
        correctionId: (value as { correctionId: string }).correctionId,
        status: 'reported',
      },
    });
    await w.reportCandidateCorrection(r, review, p, cap);
    return;
  }
  context.decorate = proposalResponse;
  await w.review(review, cap);
}
