// U11 operator checks for a staging catalog export. Skipped unless the
// matching environment variable is set; isolated local Miniflare only, and
// every outbound request is refused by the harness.
//
//   GRIDVIEW_U11_REHEARSAL_OUT=<new file>  Write a LOCAL rehearsal export bound
//     to the staging installation UUID (bootstrap seed, activator validation
//     and activation, reader export). Never a staging artifact.
//   GRIDVIEW_U11_EXPORT=<file> GRIDVIEW_U11_RESULT=<new file>
//     Isolated restore check (S3): verify the export offline for the staging
//     installation, confirm exact R0 content, reconstruct R0 in a NEW local
//     installation and compare the catalog snapshot. Writes a result summary.
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertNoExternalNetwork,
  guardNetwork,
  localInstallation,
} from './support.mjs';
import { catalogValidatorVersion } from '../../../src/identity/catalog/activation';
import { verifyCatalogFile } from '../../../scripts/identity/catalog-file';

const stagingInstallation = 'c45d60b8-a723-4b6e-8530-750592af2b94';
// Exact R0 catalog content hash (identity runbook, "R0 catalog is").
const r0CatalogHash =
  'sha256:8a2a62d8412fdfd71cfd5138b4f87682f33a690d21c3d5eec46153bfbda39851';
const { GRIDVIEW_U11_REHEARSAL_OUT, GRIDVIEW_U11_EXPORT, GRIDVIEW_U11_RESULT } =
  process.env;
const hosts = [];
afterEach(async () => {
  for (const h of hosts.splice(0)) await h.stop();
});

function credential(credentialId, roles) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    entry: {
      credentialId,
      tokenSha256: createHash('sha256').update(token).digest('hex'),
      principalId: 'local-rehearsal',
      roles,
      disabled: false,
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
  };
}

async function installation(index, installationId) {
  const reader = credential('local-read', ['reader']);
  const activator = credential('local-activate', ['reader', 'activator']);
  const bootstrap = credential('local-bootstrap', [
    'reader',
    'reviewer',
    'activator',
  ]);
  const h = await localInstallation(index, {
    installation: installationId,
    person: bootstrap,
    bindings: {
      IDENTITY_REVIEWER_CREDENTIALS: JSON.stringify(
        [reader, activator, bootstrap].map((c) => c.entry),
      ),
    },
  });
  hosts.push(h);
  const s = await h.seed();
  const id = s.proposal.proposedRevisionId;
  const call = async (path, body, token) => {
    const r = await h.raw(path, body, token);
    expect(r.status, JSON.stringify(r.value).slice(0, 400)).toBe(200);
    return r.value.data;
  };
  const report = await call(
    '/revisions/' + id + '/validate',
    h.request(s.head, {
      catalogHash: s.proposal.catalogHash,
      expectedValidatorVersion: catalogValidatorVersion,
    }),
    activator.token,
  );
  await call(
    '/revisions/' + id + '/activate',
    h.request(s.head, {
      catalogHash: s.proposal.catalogHash,
      validationReportHash: report.reportHash,
    }),
    activator.token,
  );
  return call('/revisions/' + id + '/export', undefined, reader.token);
}

describe.skipIf(!GRIDVIEW_U11_REHEARSAL_OUT)(
  'U11 local rehearsal export',
  () => {
    it('writes a local export bound to the staging installation UUID', async () => {
      guardNetwork();
      const exported = await installation(0, stagingInstallation);
      await verifyCatalogFile(
        new TextEncoder().encode(JSON.stringify(exported)),
        {
          installationId: stagingInstallation,
          season: 2026,
        },
      );
      await writeFile(GRIDVIEW_U11_REHEARSAL_OUT, JSON.stringify(exported), {
        flag: 'wx',
      });
      assertNoExternalNetwork();
    }, 120000);
  },
);

describe.skipIf(!GRIDVIEW_U11_EXPORT || !GRIDVIEW_U11_RESULT)(
  'U11 isolated restore check (S3)',
  () => {
    it('verifies the export and reconstructs exact R0 in a new installation', async () => {
      guardNetwork();
      const bytes = await readFile(GRIDVIEW_U11_EXPORT);
      const wrapper = JSON.parse(new TextDecoder().decode(bytes));
      const verified = await verifyCatalogFile(bytes, {
        installationId: stagingInstallation,
        season: 2026,
      });
      expect(wrapper.revision.sequence).toBe(1);
      expect(wrapper.revision.parentRevisionId).toBeNull();
      expect(wrapper.revision.contentHash).toBe(r0CatalogHash);
      const fresh = await installation(1);
      expect(fresh.installationId).not.toBe(stagingInstallation);
      expect(fresh.revision.revisionId).not.toBe(wrapper.revision.revisionId);
      const snapshotEqual =
        JSON.stringify(fresh.revision.snapshot) ===
        JSON.stringify(wrapper.revision.snapshot);
      expect(snapshotEqual).toBe(true);
      expect(fresh.revision.contentHash).toBe(wrapper.revision.contentHash);
      const result = {
        check: 'u11-s3-isolated-restore',
        exportFileSha256: createHash('sha256').update(bytes).digest('hex'),
        exportHash: wrapper.exportHash,
        installationId: wrapper.installationId,
        revisionId: wrapper.revision.revisionId,
        sequence: wrapper.revision.sequence,
        contentHash: wrapper.revision.contentHash,
        r0CatalogHashMatches: wrapper.revision.contentHash === r0CatalogHash,
        reference: verified.reference,
        reconstructedInstallation: fresh.installationId,
        reconstructedContentHash: fresh.revision.contentHash,
        snapshotEqual,
        evidenceCreators: wrapper.evidence.map((e) => e.createdBy.roles),
        verdict: 'pass',
      };
      await writeFile(GRIDVIEW_U11_RESULT, JSON.stringify(result, null, 2), {
        flag: 'wx',
      });
      assertNoExternalNetwork();
    }, 120000);
  },
);
