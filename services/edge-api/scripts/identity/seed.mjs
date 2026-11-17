// Local-only review artifact generation. No bindings, transports or activation.
import { build } from 'esbuild';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { loadCorpus } from './corpus.mjs';
if (process.argv.length !== 4 || process.argv[2] !== '--out')
  throw Error('Usage: node scripts/identity/seed.mjs --out <local-directory>');
globalThis.fetch = () => {
  throw Error('Identity seed tool forbids network');
};
const temp = await mkdtemp(join(tmpdir(), 'gridview-u3-build-'));
try {
  const module = join(temp, 'artifacts.cjs');
  await build({
    absWorkingDir: resolve(import.meta.dirname, '../..'),
    entryPoints: ['scripts/identity/artifacts.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: module,
  });
  const output = await createRequire(import.meta.url)(module).artifacts(
    loadCorpus(),
  );
  const directory = resolve(process.argv[3]);
  // Preflight all outputs before writing; never overwrite a different artifact.
  for (const [name, text] of Object.entries(output)) {
    try {
      if ((await readFile(join(directory, name), 'utf8')) !== text)
        throw Error('Conflicting artifact: ' + name);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  await mkdir(directory, { recursive: true });
  for (const [name, text] of Object.entries(output))
    await writeFile(join(directory, name), text);
  console.log(
    JSON.stringify({ directory, files: Object.keys(output), activated: false }),
  );
} finally {
  const rel = relative(resolve(tmpdir()), resolve(temp));
  if (
    !isAbsolute(rel) &&
    !rel.startsWith('..') &&
    basename(temp).startsWith('gridview-u3-build-')
  )
    await rm(temp, { recursive: true, force: true });
}
