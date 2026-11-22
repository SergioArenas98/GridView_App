// U11 P1 preparation: the G3 sequence with role-split credentials. Isolated
// local Miniflare only; every outbound request is refused by the harness.
//
// Finding (2026-11-22): a seed records its approved import dossier with
// createdBy = the seeding principal, and the offline catalog-file verifier
// (G4 comparisons, isolated restore, runtime batch generation) requires every
// exported dossier's creator to hold `reviewer`. A seed by a credential
// without `reviewer` therefore yields a catalog whose export can never be
// verified offline, and an installation only accepts one seed. These tests
// pin the verification behaviour for both seeder choices, so the G3
// credential choice cannot regress silently.
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
        // Role is checked before mode and body (routes.ts), so this is a role refusal.
        expect((await h.raw('/seed', probe, c.token)).status).toBe(403);
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

// D12-A lifecycle: the bootstrap credential is removed from the credentials
// secret immediately after the seed (a restart with the 3-entry value models
// the staging secret put). Validation, activation, export, offline
// verification and pinning must not depend on the revoked credential.
describe.sequential('U11 G3 D12-A: bootstrap revoked after the seed', () => {
  const reader = credential('stg-po-read-1', ['reader']);
  const reviewer = credential('stg-po-review-1', ['reader', 'reviewer']);
  const activator = credential('stg-po-activate-1', ['reader', 'activator']);
  const bootstrap = credential('stg-po-bootstrap-1', [
    'reader',
    'reviewer',
    'activator',
  ]);
  const base = [reader, reviewer, activator].map((c) => c.entry);
  let h, seeded, exported;

  beforeAll(async () => {
    guardNetwork();
    h = await localInstallation(0, {
      person: bootstrap,
      bindings: {
        IDENTITY_REVIEWER_CREDENTIALS: JSON.stringify([
          ...base,
          bootstrap.entry,
        ]),
      },
    });
  }, 30000);
  afterAll(async () => {
    await h?.stop();
  });

  it('seeds with the bootstrap credential, then revokes it', async () => {
    seeded = await h.seed();
    expect(seeded.proposal.status).toBe('proposed');
    // V4 readback before revocation, as the reader credential.
    const receipt = await h.raw(
      '/operations/' + seeded.request.operationId + '?family=seed',
      undefined,
      reader.token,
    );
    expect(receipt.status, JSON.stringify(receipt.value)).toBe(200);
    expect(receipt.value.data.state).toBe('committed');
    const proposal = await h.raw(
      '/revisions/' + seeded.proposal.proposedRevisionId,
      undefined,
      reader.token,
    );
    expect(proposal.status).toBe(200);
    await h.stop();
    await h.start({ IDENTITY_REVIEWER_CREDENTIALS: JSON.stringify(base) });
    expect((await h.raw('/health', undefined, bootstrap.token)).status).toBe(
      401,
    );
    expect((await h.raw('/health', undefined, activator.token)).status).toBe(
      200,
    );
  }, 60000);

  it('keeps the seeded proposal and refuses any write by the revoked credential', async () => {
    const id = seeded.proposal.proposedRevisionId;
    const r = await h.raw('/revisions/' + id, undefined, reader.token);
    expect(r.status).toBe(200);
    const attempt = await h.raw(
      '/revisions/' + id + '/validate',
      h.request(seeded.head, {
        catalogHash: seeded.proposal.catalogHash,
        expectedValidatorVersion: catalogValidatorVersion,
      }),
      bootstrap.token,
    );
    expect(attempt.status).toBe(401);
  });

  it('validates, activates and exports with the ordinary credentials', async () => {
    const id = seeded.proposal.proposedRevisionId;
    const validated = await h.raw(
      '/revisions/' + id + '/validate',
      h.request(seeded.head, {
        catalogHash: seeded.proposal.catalogHash,
        expectedValidatorVersion: catalogValidatorVersion,
      }),
      activator.token,
    );
    expect(validated.status, JSON.stringify(validated.value)).toBe(200);
    const activated = await h.raw(
      '/revisions/' + id + '/activate',
      h.request(seeded.head, {
        catalogHash: seeded.proposal.catalogHash,
        validationReportHash: validated.value.data.reportHash,
      }),
      activator.token,
    );
    expect(activated.status, JSON.stringify(activated.value)).toBe(200);
    const r = await h.raw(
      '/revisions/' + id + '/export',
      undefined,
      reader.token,
    );
    expect(r.status).toBe(200);
    exported = r.value.data;
  }, 60000);

  it('the export still verifies offline and the revision pins', async () => {
    expect((await verify(h, exported)).reference).toBeTruthy();
    expect(await h.pin()).toBeTruthy();
    assertNoExternalNetwork();
  });
});
