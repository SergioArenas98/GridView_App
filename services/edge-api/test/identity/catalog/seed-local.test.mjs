import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename, relative, isAbsolute } from 'node:path';
import { it, expect } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { exportSeed } from '../../../src/identity/catalog/export';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import { context, driverInput, driversEnvelope } from '../discovery/support';

it('imports R0 atomically in real SQLite DO storage and preserves seed, provenance and candidates across restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gridview-u3-sqlite-'));
  let mf;
  try {
    const bundle = await build({
      absWorkingDir: resolve(import.meta.dirname, '../../..'),
      entryPoints: ['test/identity/catalog/seed-local-worker.ts'],
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2024',
    });
    const start = (fail = false) =>
      new Miniflare({
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: '2026-07-01',
        bindings: {
          IDENTITY_INSTALLATION_ID: '33333333-3333-4333-8333-333333333333',
          TEST_FAIL: fail,
        },
        durableObjects: {
          IDENTITY_CATALOG: { className: 'SeedTestHost', useSQLite: true },
        },
        durableObjectsPersist: root,
        outboundService: () => {
          throw Error('U3 network forbidden');
        },
      });
    const text = await exportSeed(await prepareSeed(loadCorpus()));
    mf = start(true);
    expect(
      (
        await mf.dispatchFetch('http://local/seed', {
          method: 'POST',
          body: text,
        })
      ).status,
    ).toBe(409);
    expect(
      await (await mf.dispatchFetch('http://local/export')).json(),
    ).toBeNull();
    await mf.dispose();
    mf = start();
    const body = driversEnvelope([{ driverId: 'gabriele_mini' }]);
    const observations = (
      await extractJolpicaObservations(
        driverInput(body),
        body,
        context,
        providerMappingRegistry(),
      )
    ).observations;
    const call = async (command, payload = {}) =>
      (
        await mf.dispatchFetch('http://local/call', {
          method: 'POST',
          body: JSON.stringify({
            schemaVersion: 1,
            installationId: '33333333-3333-4333-8333-333333333333',
            command,
            payload,
          }),
        })
      ).json();
    expect((await call('observe-batch', { observations })).data.created).toBe(
      1,
    );
    expect(
      await (
        await mf.dispatchFetch('http://local/seed', {
          method: 'POST',
          body: text,
        })
      ).json(),
    ).toEqual({ result: 'imported' });
    await mf.dispose();
    mf = start();
    expect(await (await mf.dispatchFetch('http://local/export')).text()).toBe(
      text,
    );
    expect(
      await (
        await mf.dispatchFetch('http://local/seed', {
          method: 'POST',
          body: text,
        })
      ).json(),
    ).toEqual({ result: 'replayed' });
    const candidate = (
      await call('inspect', {
        candidateId: observations[0].candidateId,
        section: 'candidate',
        cursor: null,
        limit: 16,
      })
    ).data.candidate;
    expect(candidate.state).toBe('unresolved');
    expect(candidate.observationCount).toBe(1);
    expect(
      (await readdir(root, { recursive: true })).some((p) =>
        p.endsWith('.sqlite'),
      ),
    ).toBe(true);
    const original = await (
      await mf.dispatchFetch('http://local/export')
    ).text();
    await mf.dispose();
    mf = start();
    expect(
      await (
        await mf.dispatchFetch('http://local/seed', {
          method: 'POST',
          body: original,
        })
      ).json(),
    ).toEqual({ result: 'replayed' });
  } finally {
    await mf?.dispose();
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (
      !isAbsolute(rel) &&
      !rel.startsWith('..') &&
      basename(root).startsWith('gridview-u3-sqlite-')
    )
      await rm(root, { recursive: true, force: true });
  }
}, 30000);
