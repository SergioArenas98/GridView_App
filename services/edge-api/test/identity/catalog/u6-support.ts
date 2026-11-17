import { setup } from './u4-support';
import { hashIdentityProjection } from '../../../src/identity/discovery/keys';
export async function profileProposal(f: Awaited<ReturnType<typeof setup>>) {
  const profile = {
    ...f.root.snapshot.drivers[0]!.profile,
    fullName: 'Synthetic U6 Reviewed Profile',
  };
  const e = await f.workflow.recordEvidence(
    {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      dossier: {
        claims: [
          { field: 'fullName', value: profile.fullName, sourceField: null },
        ],
        references: [
          {
            kind: 'citation',
            httpsUrl: 'https://example.invalid/u6-profile',
            claimSummary: 'Isolated synthetic local fixture.',
          },
        ],
        rationale: 'Synthetic local reviewed profile.',
        synthetic: true,
      },
    },
    f.cap,
  );
  const head = f.workflow.head();
  const result = await f.workflow.review(
    {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      expectedActiveRevisionId: head.activeRevisionId!,
      expectedActivationSequence: head.activationSequence,
      action: 'approve-profile',
      candidateId: null,
      expectedCandidateVersion: null,
      proposedBindingKey: null,
      targetId: profile.id,
      profile,
      evidenceIds: [e.evidenceId],
      evidenceHead: await hashIdentityProjection([e]),
      reasonCode: 'no-approved-provider-mapping',
      rationale: 'Synthetic U6 profile review.',
      duplicateReview: null,
    },
    f.cap,
  );
  return result.revision!;
}
