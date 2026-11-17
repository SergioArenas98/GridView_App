// Matches the established offline identity seed tooling: bundle repository
// validators locally. Temporary files contain code only, never user data.
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute, basename } from 'node:path';
import { createRequire } from 'node:module';
let validator;
export async function validateLocalProposal(request, operation) {
  if (!validator) validator = load();
  return (await validator).validateLocalProposal(request, operation);
}
async function load() {
  const temp = await mkdtemp(join(tmpdir(), 'gridview-u5-validator-'));
  try {
    const built = await build({
      absWorkingDir: resolve(import.meta.dirname, '../..'),
      entryPoints: ['scripts/identity/validation.ts'],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'cjs',
    });
    const path = join(temp, 'validator.cjs');
    await writeFile(path, built.outputFiles[0].text);
    return createRequire(import.meta.url)(path);
  } finally {
    const rel = relative(resolve(tmpdir()), resolve(temp));
    if (
      !isAbsolute(rel) &&
      !rel.startsWith('..') &&
      basename(temp).startsWith('gridview-u5-validator-')
    )
      await rm(temp, { recursive: true, force: true });
  }
}
