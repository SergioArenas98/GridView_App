// U11 P1 preparation: the G3 sequence with role-split credentials. Isolated
// local Miniflare only; every outbound request is refused by the harness.
//
// Finding (2026-11-22): a seed records its approved import dossier with
// createdBy = the seeding principal, and the offline catalog-file verifier
// (G4 comparisons, isolated restore, runtime batch generation) requires every
// exported dossier's creator to hold `reviewer`. A seed by a credential
// without `reviewer` therefore yields a catalog whose export can never be
// verified offline, and an installation only accepts one seed. These tests
// pin both behaviours so the G3 credential choice cannot regress silently.
import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertNoExternalNetwork,
  guardNetwork,
  localInstallation,
} from './support.mjs';
import { catalogValidatorVersion } from '../../../src/identity/catalog/activation';
import { verifyCatalogFile } from '../../../scripts/identity/catalog-file';

function credential(credentialId, roles) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    entry: {
      credentialId,
      tokenSha256: createHash('sha256').update(token).digest('hex'),
      principalId: 'product-owner',
      roles,
      disabled: false,
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
  };
}

/** Seeds with `seeder`; validates and activates with `activator`; exports with `reader`. */
async function g3(h, activator, reader) {
  const s = await h.seed();
  const id = s.proposal.proposedRevisionId;
  const validated = await h.raw(
    '/revisions/' + id + '/validate',
    h.request(s.head, {
      catalogHash: s.proposal.catalogHash,
      expectedValidatorVersion: catalogValidatorVersion,
    }),
    activator.token,
  );
  expect(validated.status, JSON.stringify(validated.value)).toBe(200);
  const activated = await h.raw(
    '/revisions/' + id + '/activate',
    h.request(s.head, {
      catalogHash: s.proposal.catalogHash,
      validationReportHash: validated.value.data.reportHash,
    }),
    activator.token,
  );
  expect(activated.status, JSON.stringify(activated.value)).toBe(200);
  const exported = await h.raw(
    '/revisions/' + id + '/export',
    undefined,
    reader.token,
  );
  expect(exported.status).toBe(200);
  return exported.value.data;
}

const verify = (h, exported) =>
  verifyCatalogFile(new TextEncoder().encode(JSON.stringify(exported)), {
    installationId: h.installation,
    season: 2026,
  });

for (const variant of [
  {
    name: 'seed by the activator credential (reader+activator)',
    seederRoles: null,
    exportVerifies: false,
  },
  {
    name: 'seed by a single-use bootstrap credential (reader+reviewer+activator)',
    seederRoles: ['reader', 'reviewer', 'activator'],
    exportVerifies: true,
  },
])
  describe.sequential(`U11 G3 role split: ${variant.name}`, () => {
    const reader = credential('stg-po-read-1', ['reader']);
    const reviewer = credential('stg-po-review-1', ['reader', 'reviewer']);
    const activator = credential('stg-po-activate-1', ['reader', 'activator']);
    const seeder = variant.seederRoles
      ? credential('stg-po-bootstrap-1', variant.seederRoles)
      : activator;
    let h, exported;

    beforeAll(async () => {
      guardNetwork();
      const entries = [reader, reviewer, activator, seeder]
        .filter((c, i, all) => all.indexOf(c) === i)
        .map((c) => c.entry);
      h = await localInstallation(0, {
        person: seeder,
        bindings: { IDENTITY_REVIEWER_CREDENTIALS: JSON.stringify(entries) },
      });
    }, 30000);
    afterAll(async () => {
      await h?.stop();
    });

    it('authenticates every credential and refuses seed without activator', async () => {
      for (const c of [reader, reviewer, activator, seeder])
        expect((await h.raw('/health', undefined, c.token)).status).toBe(200);
      const head = await h.admin('/health');
      const probe = h.request(head, {
        seedArtifact: { format: 'gridview-reviewed-seed/1' },
        seedArtifactHash: 'sha256:' + '0'.repeat(64),
        approvedImportDossierId: 'sha256:' + '0'.repeat(64),
      });
      for (const c of [reader, reviewer])
        expect([400, 403]).toContain(
          (await h.raw('/seed', probe, c.token)).status,
        );
    });

    it('completes seed, validate, activate and reader export', async () => {
      exported = await g3(h, activator, reader);
      expect(exported.evidence.map((e) => e.createdBy.roles)).toContainEqual(
        seeder.entry.roles,
      );
    }, 60000);

    it(`offline export verification ${variant.exportVerifies ? 'passes' : 'is refused'}`, async () => {
      if (variant.exportVerifies)
        expect((await verify(h, exported)).reference).toBeTruthy();
      else
        await expect(verify(h, exported)).rejects.toThrow(
          /catalog-file-evidence/,
        );
    });

    it('pins the active revision on the runtime path', async () => {
      expect(await h.pin()).toBeTruthy();
      assertNoExternalNetwork();
    });
  });
