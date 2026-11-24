import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import { catalogLimits, requireCatalog, type SeedArtifact } from './model';
import { validateSeed } from './validate';
export async function exportSeed(seed: unknown): Promise<string> {
  return canonicalJson(await validateSeed(seed));
}
export async function importSeed(text: string): Promise<SeedArtifact> {
  requireCatalog(
    typeof text === 'string' && utf8(text).length <= catalogLimits.exportBytes,
    'export-capacity',
  );
  return validateSeed(JSON.parse(text));
}
