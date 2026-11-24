import type { SeedArtifact } from './model';
import { validateSeed } from './validate';

/** One bounded pure proof, owned by a repository or its catalog DO. Never stores
 * authority, mutable catalog state or an in-flight request's I/O promise. */
export class CatalogOriginProof {
  private bytes: string | null = null;
  private proof: SeedArtifact | null = null;

  async verify(bytes: string): Promise<SeedArtifact> {
    if (bytes === this.bytes && this.proof !== null) return this.proof;
    this.bytes = bytes;
    this.proof = null;
    const proof = await validateSeed(JSON.parse(bytes));
    // A concurrent request may have observed different retained bytes. Its key
    // must never be paired with this proof; failures also never populate it.
    if (this.bytes === bytes) this.proof = proof;
    return proof;
  }
}
