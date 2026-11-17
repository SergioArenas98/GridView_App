import { CatalogWorkflow } from '../../../src/identity/catalog/workflow';
import { IdentityStore } from '../../../src/identity/store';
import type {
  ReviewRequest,
  DossierInput,
} from '../../../src/identity/catalog/review';
import type { SeedArtifact } from '../../../src/identity/catalog/model';
import type { IdentityStorage } from '../../../src/identity/schema';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import { context, driverInput, driversEnvelope } from '../discovery/support';
import { hashIdentityProjection } from '../../../src/identity/discovery/keys';
import { localAuthority } from './u4-authority';
export const installation = '33333333-3333-4333-8333-333333333333';
export async function setup(
  storage: IdentityStorage,
  seed: SeedArtifact,
  now = () => Date.parse('2026-11-14T12:00:00.000Z'),
) {
  const a = localAuthority(),
    cap = a.issue(),
    workflow = new CatalogWorkflow(storage, installation, a.authority, now),
    store = new IdentityStore(storage, installation, now);
  const root = await workflow.proposeSeed(
    seed,
    {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      expectedActiveRevisionId: null,
      expectedActivationSequence: 0,
    },
    cap,
  );
  const cert = await workflow.validate(
    {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      revisionId: root.revisionId,
      expectedActiveRevisionId: null,
      expectedActivationSequence: 0,
    },
    cap,
  );
  if (!cert.valid) throw Error(JSON.stringify(cert.issues));
  await workflow.activate(
    {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      revisionId: root.revisionId,
      expectedActiveRevisionId: null,
      expectedActivationSequence: 0,
      certificateId: cert.certificateId,
    },
    cap,
  );
  return { workflow, store, cap, root, ...a };
}
export async function candidate(
  store: IdentityStore,
  id = 'synthetic_u4_driver',
  ordinal = 1,
  givenName = 'Synthetic',
) {
  const body = driversEnvelope([
    { driverId: id, givenName, familyName: 'Example' },
  ]);
  const observations = (
    await extractJolpicaObservations(
      driverInput(body),
      body,
      { ...context, requestOrdinal: ordinal },
      providerMappingRegistry(),
    )
  ).observations;
  if (!observations.length) throw Error('missing synthetic observation');
  await store.observe({
    observations: JSON.parse(JSON.stringify(observations)),
  });
  return {
    observation: observations[0]!,
    candidate: store.inspect({
      candidateId: observations[0]!.candidateId,
      section: 'candidate',
      cursor: null,
      limit: 1,
    }).candidate,
  };
}
export async function bindRequest(
  f: Awaited<ReturnType<typeof setup>>,
  id = 'synthetic_u4_driver',
  target = f.root.snapshot.drivers[0]!.anchor.driverId,
): Promise<ReviewRequest> {
  const c = await candidate(f.store, id);
  const dossier: DossierInput = {
    claims: [
      { field: 'fullName', value: 'Synthetic Example', sourceField: null },
      {
        field: 'canonical-association',
        value: { key: c.candidate.key, targetId: target },
        sourceField: null,
      },
    ],
    references: [
      { kind: 'observation', observationId: c.observation.observationId },
    ],
    rationale: 'Synthetic association reviewed only for local mechanism tests.',
    synthetic: true,
  };
  const e = await f.workflow.recordEvidence(
    { schemaVersion: 1, operationId: crypto.randomUUID(), dossier },
    f.cap,
  );
  return {
    schemaVersion: 1,
    operationId: crypto.randomUUID(),
    expectedActiveRevisionId: f.workflow.head().activeRevisionId!,
    expectedActivationSequence: f.workflow.head().activationSequence,
    candidateId: c.candidate.candidateId,
    expectedCandidateVersion: c.candidate.recordVersion,
    evidenceHead: c.candidate.evidenceHead,
    action: 'bind-existing',
    targetId: target,
    proposedBindingKey: c.candidate.key,
    profile: null,
    evidenceIds: [e.evidenceId],
    reasonCode: 'no-approved-provider-mapping',
    rationale: 'Explicit synthetic review with exact evidence and scope.',
    duplicateReview: null,
  };
}
export async function newDriverRequest(
  f: Awaited<ReturnType<typeof setup>>,
  id = 'synthetic_u4_new',
  target = 'synthetic-new-person',
) {
  const r = await bindRequest(f, id, target);
  r.action = 'create-driver';
  r.profile = {
    ...structuredClone(f.root.snapshot.drivers[0]!.profile),
    id: target,
    fullName: 'Synthetic New Person',
  };
  const dossier: DossierInput = {
    claims: [
      { field: 'fullName', value: r.profile.fullName, sourceField: null },
      {
        field: 'canonical-association',
        value: { key: r.proposedBindingKey!, targetId: target },
        sourceField: null,
      },
    ],
    references: [
      {
        kind: 'citation',
        httpsUrl: 'https://example.invalid/synthetic-person',
        claimSummary: 'Explicit synthetic fixture.',
      },
    ],
    rationale: 'Synthetic duplicate-reviewed creation.',
    synthetic: true,
  };
  const e = await f.workflow.recordEvidence(
    { schemaVersion: 1, operationId: crypto.randomUUID(), dossier },
    f.cap,
  );
  r.evidenceIds = [e.evidenceId];
  r.duplicateReview = {
    catalogHashReviewed: await hashIdentityProjection(
      (await f.workflow.readRevision(r.expectedActiveRevisionId)).snapshot,
    ),
    inspectedCanonicalIds: (
      await f.workflow.readRevision(r.expectedActiveRevisionId)
    ).snapshot.drivers.map((d) => d.anchor.driverId),
    evidenceIds: r.evidenceIds,
    fullCatalogChecked: true,
    idExplicitlyReviewed: true,
    sameNameDistinction: null,
  };
  return r;
}
export function operation(
  f: Awaited<ReturnType<typeof setup>>,
  revisionId: string,
) {
  return {
    schemaVersion: 1 as const,
    operationId: crypto.randomUUID(),
    revisionId,
    expectedActiveRevisionId: f.workflow.head().activeRevisionId,
    expectedActivationSequence: f.workflow.head().activationSequence,
  };
}
export async function validateAndActivate(
  f: Awaited<ReturnType<typeof setup>>,
  revisionId: string,
) {
  const cmd = operation(f, revisionId),
    cert = await f.workflow.validate(cmd, f.cap);
  if (!cert.valid) throw Error(JSON.stringify(cert.issues));
  const request = {
    ...cmd,
    operationId: crypto.randomUUID(),
    certificateId: cert.certificateId,
  };
  return { cert, request, result: await f.workflow.activate(request, f.cap) };
}
