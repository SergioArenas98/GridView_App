import { build } from 'esbuild';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const serviceRoot = resolve(__dirname, '../../..');
async function graph(entryPoints: string[]) {
  const result = await build({
    absWorkingDir: serviceRoot,
    entryPoints,
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    target: 'es2024',
    conditions: ['workerd', 'worker', 'browser'],
    outdir: 'unused-u1-bundle-output',
    logLevel: 'silent',
  });
  if (!result.metafile) throw new Error('Missing bundle graph.');
  return result.metafile;
}

describe('U1 stays pure under U2 shadow integration', () => {
  it('reaches exactly the reviewed discovery modules after U2 wiring', async () => {
    const built = await graph(['src/index.ts']);
    expect(
      Object.keys(built.inputs)
        .filter((p) => p.replace(/\\/g, '/').includes('identity/discovery/'))
        .sort(),
    ).toEqual(
      ['boundary', 'collector', 'extract-jolpica', 'keys', 'model', 'persist']
        .map((name) => 'src/identity/discovery/' + name + '.ts')
        .sort(),
    );
  });

  it('depends on utilities/decoders only, never transport, bindings, storage or bundled mappings', async () => {
    const built = await graph([
      'src/identity/discovery/collector.ts',
      'src/identity/discovery/extract-jolpica.ts',
      'src/identity/discovery/keys.ts',
    ]);
    const names = Object.keys(built.inputs).map((p) => p.replace(/\\/g, '/'));
    expect(
      names.some((p) => p.endsWith('providers/mappings/mapping-key.ts')),
    ).toBe(true);
    expect(names.some((p) => p.endsWith('ingest/canonical-json.ts'))).toBe(
      true,
    );
    expect(
      names.filter((p) =>
        /(?:content\/|node_modules\/|src\/(?:storage|admin|sync)\/|providers\/http\/|providers\/mappings\/(?:index|mapping-registry)\.ts|publication\/(?:sequencer|sequenced)\/)/.test(
          p,
        ),
      ),
    ).toEqual([]);
    expect(
      Object.values(built.inputs).flatMap((input) =>
        input.imports.filter((edge) => edge.external),
      ),
    ).toEqual([]);
  });
});
