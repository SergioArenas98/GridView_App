import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterEach,
  beforeAll,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { localInstallation, evidence, reviewedProfile } from './support.mjs';
import { coldBackup, restoreColdCopy } from './recovery.mjs';
import { verifyCatalogFile } from '../../../scripts/identity/catalog-file';
import { generateSeasonBatch } from '../../../scripts/season-batch/generate';
import { inputFor } from '../../season-batch/support';
import { guardNetwork, assertNoExternalNetwork } from './support.mjs';
const hosts = [];
afterEach(async () => {
  for (const h of hosts.splice(0)) await h.stop();
  vi.unstubAllGlobals();
});

describe.sequential(
  'U8 isolated operational recovery and independent reconstruction',
  () => {
    let h,
      initialized,
      revision,
      wrapper,
      rootWrapper,
      request,
      pin,
      submission,
      recovered,
      publicBefore,
      state,
      manifest,
      expected,
      restored,
      target,
      restoreMs;
    beforeAll(async () => {
      h = await localInstallation();
    }, 30000);
    afterAll(async () => {
      await h?.stop();
      await restored?.stop();
    });
    it('seeds, independently validates and activates exact R0', async () => {
      initialized = await h.initialize();
      revision = initialized.proposal.proposedRevisionId;
    });
    it('exports, pins and publishes a complete guarded synthetic batch with lost-response recovery', async () => {
      guardNetwork();
      wrapper = await h.export(revision);
      request = h.pinRequest();
      pin = await h.pin(request);
      rootWrapper = wrapper;
      const batch = await generateSeasonBatch({
        ...inputFor(),
        identityMode: 'runtime',
        installationId: h.installation,
        catalogExport: new TextEncoder().encode(JSON.stringify(wrapper)),
      });
      expect(batch.ok).toBe(true);
      expect((await (await h.fetch('/__test/genesis')).json()).outcome).toBe(
        'created',
      );
      submission = {
        kind: 'gridview-season-batch-submission',
        schemaVersion: 2,
        operationId: crypto.randomUUID(),
        season: 2026,
        expectedActiveVersion: null,
        reviewedManifestSha256: batch.manifest.sha256,
        manifest: JSON.parse(batch.manifest.text),
        artifact: JSON.parse(batch.artifact.text),
      };
      // Lost success is deliberately not treated as rollback; recover this SAME ID.
      expect((await h.ingest(submission, true)).status).toBe(503);
      recovered = await h.ingest(submission);
      expect(recovered.value.data).toMatchObject({
        outcome: 'publication',
        publication: { status: 'applied' },
      });
      publicBefore = await (await h.fetch('/v1/seasons/2026/drivers')).json();
      state = await h.inspect();
      expect(state.rows.identity_batch_receipts).toHaveLength(1);
    });
    it('retains publication and original batch receipt after a separately reviewed runtime-only activation', async () => {
      guardNetwork();
      const next = await reviewedProfile(
        h,
        wrapper,
        'Synthetic U8 Recovery Profile',
      );
      await h.activation(next.head, next.proposal, next.validation);
      revision = next.proposal.proposedRevisionId;
      wrapper = await h.export(revision);
      state = await h.inspect();
      expect(
        JSON.parse(state.rows.identity_catalog_head[0].body)
          .hasRuntimeOnlyActivation,
      ).toBe(true);
      expect(state.rows.identity_catalog_revisions).toHaveLength(2);
      expect(state.rows.identity_batch_receipts).toHaveLength(1);
      expect(
        (await (await h.fetch('/v1/seasons/2026/drivers')).json()).data,
      ).toEqual(publicBefore.data);
    });
    it('creates a verified cold-copy and restores exact operational tables into an empty isolated store', async () => {
      guardNetwork();
      const checkpoint = {
        activationSequence: 2,
        catalogHash: wrapper.revision.contentHash,
        runtimeOnly: JSON.parse(state.rows.identity_catalog_head[0].body)
          .hasRuntimeOnlyActivation,
      };
      await h.stop();
      manifest = await coldBackup(h.root, wrapper, checkpoint);
      target = await mkdtemp(join(tmpdir(), 'gridview-u8-restore-'));
      expected = {
        installationId: h.installation,
        activeRevisionId: revision,
        activationSequence: 2,
      };
    });
    it('verifies the complete backup before copying into an empty target', async () => {
      guardNetwork();
      const started = performance.now();
      await restoreColdCopy(h.root, target, manifest, expected);
      restoreMs = performance.now() - started;
    });
    it('keeps every backup byte unchanged and reuses the identical artifact for a second isolated restore', async () => {
      guardNetwork();
      expect(
        (await coldBackup(h.root, wrapper, manifest.checkpoint)).files,
      ).toEqual(manifest.files);
      const secondTarget = await mkdtemp(join(tmpdir(), 'gridview-u8-reuse-'));
      await restoreColdCopy(h.root, secondTarget, manifest, expected);
      expect(
        (await coldBackup(h.root, wrapper, manifest.checkpoint)).files,
      ).toEqual(manifest.files);
    });
    it('reopens the isolated cold copy and recovers operational receipts and publication', async () => {
      guardNetwork();
      restored = await localInstallation(0, { root: target });
      // New credentials were supplied out of band, not copied from the backup.
      expect(restored.person.token).not.toBe(h.person.token);
      expect(restored.operatorToken).not.toBe(h.operatorToken);
      expect(
        (await restored.raw('/health', undefined, h.person.token)).status,
      ).toBe(401);
      expect(
        (
          await restored.fetch('/internal/admin/season/ingest', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + h.operatorToken },
            body: JSON.stringify(submission),
          })
        ).status,
      ).toBe(401);
      const restoredState = await restored.inspect();
      expect(restoredState.rows).toEqual(state.rows);
      expect(await restored.pin(request)).toEqual(pin);
      expect((await restored.ingest(submission)).value.data).toEqual(
        recovered.value.data,
      );
      const publicAfter = await (
        await restored.fetch('/v1/seasons/2026/drivers')
      ).json();
      expect(publicAfter.data).toEqual(publicBefore.data);
      expect((await restored.admin('/health')).activationSequence).toBe(2);
      await expect(
        restoreColdCopy(h.root, target, manifest, expected),
      ).rejects.toThrow('Nonempty');
      await evidence('operational-restore', {
        restoreMs,
        physicalFiles: await restored.files(),
        preservedTables: Object.keys(state.rows),
        publicParity: true,
      });
    });
    it('reconstructs only R0 semantics in a NEW installation without imported operational authority', async () => {
      guardNetwork();
      // Reconstruction has new installation/namespace/credentials. Revision export
      // supplies source closure, NOT operational receipts or activation authority.
      const fresh = await localInstallation(1);
      hosts.push(fresh);
      await expect(
        verifyCatalogFile(new TextEncoder().encode(JSON.stringify(wrapper)), {
          installationId: fresh.installation,
          season: 2026,
        }),
      ).rejects.toThrow();
      const reconstructionStarted = performance.now();
      const reconstructed = await fresh.initialize();
      const freshExport = await fresh.export(
        reconstructed.proposal.proposedRevisionId,
      );
      expect(freshExport.revision.snapshot).toEqual(
        rootWrapper.revision.snapshot,
      );
      expect(freshExport.installationId).not.toBe(wrapper.installationId);
      expect(freshExport.revision.revisionId).not.toBe(revision);
      expect((await fresh.inspect()).rows.identity_run_pins).toBeUndefined();
      const receipt = await fresh.admin(
        '/operations/' +
          initialized.activation.request.operationId +
          '?family=activate',
      );
      expect(receipt.state).toBe('unknown');
      // Keep verifiable recovery material in the isolated temp directory; no token.
      const artifactPath = join(
        await mkdtemp(join(tmpdir(), 'gridview-u8-artifact-')),
        'u8-recovery-manifest.json',
      );
      await writeFile(artifactPath, JSON.stringify(manifest, null, 2));
      expect(
        (await readFile(artifactPath, 'utf8')).includes(h.person.token),
      ).toBe(false);
      await evidence('restore', {
        reconstructionMs: performance.now() - reconstructionStarted,
        artifactPath,
        manifest,
        physicalFiles: await restored.files(),
        publicParity: true,
        preservedTables: Object.keys(state.rows),
      });
      assertNoExternalNetwork();
    });

    it.each([
      'corrupt',
      'incomplete',
      'incompatible',
      'wrong-installation',
      'outdated',
      'provenance',
      'path',
    ])('rejects %s recovery before target writes', async (fault) => {
      guardNetwork();
      const bad = structuredClone(manifest),
        target = await mkdtemp(join(tmpdir(), 'gridview-u8-refused-'));
      if (fault === 'corrupt') bad.files[0].sha256 = '0'.repeat(64);
      if (fault === 'incomplete') bad.files.pop();
      if (fault === 'incompatible') bad.schemaVersion = 99;
      if (fault === 'wrong-installation')
        bad.installationId = crypto.randomUUID();
      if (fault === 'outdated') bad.checkpoint.activationSequence = 0;
      if (fault === 'provenance') bad.catalogExport.lineage.seed.sources.pop();
      if (fault === 'path') bad.files[0].path = '../escape.sqlite';
      await expect(
        restoreColdCopy(h.root, target, bad, expected),
      ).rejects.toThrow();
      expect(await readdir(target)).toEqual([]);
    });
  },
);
