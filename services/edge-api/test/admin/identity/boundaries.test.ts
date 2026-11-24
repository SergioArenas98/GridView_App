import { build } from 'esbuild';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
it('includes no test issuer in the production Worker and gives synchronization/public reads no catalog administration dependency', async () => {
  const options = {
    absWorkingDir: resolve(import.meta.dirname, '../../..'),
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm' as const,
  };
  const production = await build({ ...options, entryPoints: ['src/index.ts'] });
  expect(
    Object.keys(production.metafile!.inputs).some((p) =>
      p.replaceAll('\\', '/').startsWith('test/'),
    ),
  ).toBe(false);
  expect(
    Object.keys(production.metafile!.inputs).filter((p) =>
      p.replaceAll('\\', '/').startsWith('scripts/'),
    ),
  ).toEqual([]);
  expect(production.outputFiles).toHaveLength(1);
  expect(production.outputFiles![0]!.text).not.toContain(
    'unverified-logical-principal',
  );
  const consumers = await build({
    ...options,
    entryPoints: [
      'src/sync/coordinated/composition.ts',
      'src/sync/coordinated/run.ts',
      'src/public/router.ts',
    ],
    outdir: 'never-written',
  });
  const consumerInputs = Object.keys(consumers.metafile!.inputs).map((p) =>
    p.replaceAll('\\', '/'),
  );
  expect(consumerInputs).toContain('src/identity/catalog/run-context.ts');
  expect(
    consumerInputs.filter((p) =>
      /identity\/(admin|durable-object)|identity\/catalog\/(pin|workflow|repository|revision-store|admin-workflow)\.ts$/.test(
        p,
      ),
    ),
  ).toEqual([]);
  const publicRead = await build({
    ...options,
    entryPoints: ['src/public/router.ts'],
  });
  expect(
    Object.keys(publicRead.metafile!.inputs).filter((p) =>
      p.replaceAll('\\', '/').includes('identity/'),
    ),
  ).toEqual([]);
});
