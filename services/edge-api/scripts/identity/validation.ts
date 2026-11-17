/** Runs offline in the CLI bundle. Reuses the authoritative U3/U4 validators;
 * it never constructs a store, reads credentials or fetches citations. */
import type { Mutation } from '../../src/admin/identity/guards.mjs';
import { decodeDossier, profile } from '../../src/identity/catalog/review';
import { validateSeed } from '../../src/identity/catalog/validate';
import { hashIdentityProjection } from '../../src/identity/discovery/keys';
import { requireCatalog } from '../../src/identity/catalog/model';
export async function validateLocalProposal(
  request: Mutation,
  operation: string,
): Promise<void> {
  const p = request.payload;
  if (operation === 'evidence')
    decodeDossier({
      claims: p.claims,
      references: p.references,
      rationale: request.reason,
      synthetic: true,
    });
  if (operation === 'approve-new' || operation === 'approve-profile')
    profile({
      ...(p.profile as Record<string, unknown>),
      id:
        operation === 'approve-new'
          ? p.driverId
          : 'synthetic-profile-validation',
    });
  if (operation === 'seed') {
    const a = p.seedArtifact as { seed: unknown; dossier: unknown };
    await validateSeed(a.seed);
    decodeDossier(a.dossier);
    requireCatalog(
      p.seedArtifactHash === (await hashIdentityProjection(a)) &&
        p.approvedImportDossierId === (await hashIdentityProjection(a.dossier)),
      'seed-file-integrity',
    );
  }
  if (operation === 'import-base') {
    await validateSeed(p.baseArtifact);
    requireCatalog(
      p.baseArtifactHash === (await hashIdentityProjection(p.baseArtifact)),
      'base-file-integrity',
    );
  }
}
