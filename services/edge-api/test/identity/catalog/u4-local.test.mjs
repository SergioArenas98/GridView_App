import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, relative, isAbsolute, basename } from 'node:path';
import { it, expect } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import { context, driverInput, driversEnvelope } from '../discovery/support';
const installation = '33333333-3333-4333-8333-333333333333';
async function host() {
  const root = await mkdtemp(join(tmpdir(), 'gridview-u4-sqlite-'));
  const bundle = await build({
    absWorkingDir: resolve(import.meta.dirname, '../../..'),
    entryPoints: ['test/identity/catalog/u4-local-worker.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2024',
  });
  const start = (bindings = {}) =>
    new Miniflare({
      modules: true,
      script: bundle.outputFiles[0].text,
      compatibilityDate: '2026-07-01',
      bindings: { IDENTITY_INSTALLATION_ID: installation, ...bindings },
      durableObjects: {
        IDENTITY_CATALOG: { className: 'U4TestHost', useSQLite: true },
      },
      durableObjectsPersist: root,
      outboundService() {
        throw Error('U4 network forbidden');
      },
    });
  const dispose = async () => {
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (
      !isAbsolute(rel) &&
      !rel.startsWith('..') &&
      basename(root).startsWith('gridview-u4-sqlite-')
    )
      await rm(root, { recursive: true, force: true });
  };
  return { root, start, dispose };
}
async function call(mf, method, input, command) {
  const response = await mf.dispatchFetch('http://local/u4', {
    method: 'POST',
    body: JSON.stringify({ method, input, command }),
  });
  const data = await response.json();
  if (response.status !== 200) throw Error(data.error);
  return data.result;
}
async function observe(mf) {
  const body = driversEnvelope([
    {
      driverId: 'synthetic_persisted',
      givenName: 'Synthetic',
      familyName: 'Persisted',
    },
  ]);
  const observations = (
    await extractJolpicaObservations(
      driverInput(body),
      body,
      context,
      providerMappingRegistry(),
    )
  ).observations;
  const request = async (command, payload) =>
    (
      await mf.dispatchFetch('http://local/observe', {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: 1,
          installationId: installation,
          command,
          payload,
        }),
      })
    ).json();
  expect((await request('observe-batch', { observations })).data.created).toBe(
    1,
  );
  return {
    observation: observations[0],
    candidate: (
      await request('inspect', {
        candidateId: observations[0].candidateId,
        section: 'candidate',
        cursor: null,
        limit: 1,
      })
    ).data.candidate,
    request,
  };
}
it('migrates existing U2 SQLite DO data, preserves R0 and review history through restart, and recovers a lost activation response', async () => {
  const h = await host();
  let mf;
  try {
    mf = h.start({ TEST_U2_ONLY: true });
    const c = await observe(mf);
    await mf.dispose();
    mf = h.start();
    const seed = await prepareSeed(loadCorpus()),
      root = await call(mf, 'seed', seed, {
        schemaVersion: 1,
        operationId: crypto.randomUUID(),
        revisionId: crypto.randomUUID(),
        expectedActiveRevisionId: null,
        expectedActivationSequence: 0,
      });
    const rootCmd = {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      revisionId: root.revisionId,
      expectedActiveRevisionId: null,
      expectedActivationSequence: 0,
    };
    const cert0 = await call(mf, 'validate', rootCmd);
    expect(cert0.valid).toBe(true);
    await call(mf, 'activate', {
      ...rootCmd,
      operationId: crypto.randomUUID(),
      certificateId: cert0.certificateId,
    });
    const target = seed.snapshot.drivers[0].anchor.driverId;
    const e = await call(mf, 'evidence', {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      dossier: {
        claims: [
          {
            field: 'fullName',
            value: 'Synthetic Persisted',
            sourceField: null,
          },
          {
            field: 'canonical-association',
            value: { key: c.candidate.key, targetId: target },
            sourceField: null,
          },
        ],
        references: [
          { kind: 'observation', observationId: c.observation.observationId },
        ],
        rationale: 'Synthetic persisted review.',
        synthetic: true,
      },
    });
    const reviewRequest = {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      expectedActiveRevisionId: root.revisionId,
      expectedActivationSequence: 1,
      candidateId: c.candidate.candidateId,
      expectedCandidateVersion: c.candidate.recordVersion,
      evidenceHead: c.candidate.evidenceHead,
      action: 'bind-existing',
      targetId: target,
      proposedBindingKey: c.candidate.key,
      profile: null,
      evidenceIds: [e.evidenceId],
      reasonCode: 'no-approved-provider-mapping',
      rationale: 'Synthetic persisted association.',
      duplicateReview: null,
    };
    const p = await call(mf, 'review', reviewRequest),
      cmd = {
        schemaVersion: 1,
        operationId: crypto.randomUUID(),
        revisionId: p.revision.revisionId,
        expectedActiveRevisionId: root.revisionId,
        expectedActivationSequence: 1,
      },
      cert = await call(mf, 'validate', cmd);
    expect(cert.valid).toBe(true);
    const activation = {
      ...cmd,
      operationId: crypto.randomUUID(),
      certificateId: cert.certificateId,
    };
    await call(mf, 'activate', activation); // Deliberately discard the response.
    const exported = await call(mf, 'export', p.revision.revisionId);
    await mf.dispose();
    mf = h.start();
    const recovered = await call(mf, 'activate', activation);
    expect(recovered).toMatchObject({
      outcome: 'activated',
      activationSequence: 2,
    });
    expect(
      await call(mf, 'operation', {
        principalId: 'synthetic-reviewer',
        family: 'activate',
        operationId: activation.operationId,
      }),
    ).toEqual(recovered);
    expect(await call(mf, 'review', reviewRequest)).toEqual(p);
    expect(await call(mf, 'export', p.revision.revisionId)).toBe(exported);
    expect((await call(mf, 'head')).activationSequence).toBe(2);
    const inspected = await (
      await mf.dispatchFetch('http://local/observe', {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: 1,
          installationId: installation,
          command: 'inspect',
          payload: {
            candidateId: c.candidate.candidateId,
            section: 'candidate',
            cursor: null,
            limit: 1,
          },
        }),
      })
    ).json();
    expect(inspected.data.candidate).toMatchObject({
      state: 'resolved',
      observationCount: 1,
      resolvedRevisionId: p.revision.revisionId,
    });
    expect(
      (await readdir(h.root, { recursive: true })).some((p) =>
        p.endsWith('.sqlite'),
      ),
    ).toBe(true);
  } finally {
    await mf?.dispose();
    await h.dispose();
  }
}, 30000);
it('rolls back a real SQLite DO activation interruption, restarts and commits the identical operation once', async () => {
  const h = await host();
  let mf;
  try {
    mf = h.start();
    const seed = await prepareSeed(loadCorpus());
    const root = await call(mf, 'seed', seed, {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      expectedActiveRevisionId: null,
      expectedActivationSequence: 0,
    });
    const cmd = {
        schemaVersion: 1,
        operationId: crypto.randomUUID(),
        revisionId: root.revisionId,
        expectedActiveRevisionId: null,
        expectedActivationSequence: 0,
      },
      cert = await call(mf, 'validate', cmd),
      activation = {
        ...cmd,
        operationId: crypto.randomUUID(),
        certificateId: cert.certificateId,
      };
    expect(cert.valid).toBe(true);
    await mf.dispose();
    // Constructor's U2 INSERT OR IGNORE is write 1. Activation head is write 2,
    // status is write 3; throw after the head update but before the commit.
    mf = h.start({ TEST_FAIL_WRITE: 3 });
    await expect(call(mf, 'activate', activation)).rejects.toThrow(
      'synthetic-u4-interruption',
    );
    expect((await call(mf, 'head')).activeRevisionId).toBeNull();
    expect(
      await call(mf, 'operation', {
        principalId: 'synthetic-reviewer',
        family: 'activate',
        operationId: activation.operationId,
      }),
    ).toBeNull();
    await mf.dispose();
    mf = h.start();
    expect((await call(mf, 'activate', activation)).outcome).toBe('activated');
    expect((await call(mf, 'activate', activation)).activationSequence).toBe(1);
  } finally {
    await mf?.dispose();
    await h.dispose();
  }
}, 30000);
