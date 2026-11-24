import { hashIdentityProjection } from '../discovery/keys';

/** U5 read-only wrapper and canonical commitment, excluding exportHash itself. */
export async function administrativeExport(
  installationId: string,
  bundle: Record<string, unknown>,
  imports: readonly { revision: string; evidence: unknown }[],
) {
  const history = new Set(
    (bundle.history as { revisionId: string }[]).map((r) => r.revisionId),
  );
  const wrapper = {
    schemaVersion: 1,
    format: 'gridview-identity-admin-export/1',
    installationId,
    revision: bundle.revision,
    decisions: bundle.decisions,
    evidence: [
      ...((bundle.revision as { snapshot: { reviewEvidence?: unknown[] } })
        .snapshot.reviewEvidence ?? []),
      ...imports.filter((r) => history.has(r.revision)).map((r) => r.evidence),
    ],
    lineage: bundle,
  };
  return { ...wrapper, exportHash: await hashIdentityProjection(wrapper) };
}
