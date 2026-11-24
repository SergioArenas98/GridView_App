import { providerMappingRegistry } from '../../../src/providers/mappings';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { harness, syntheticSeed, credential, installation } from './support';
import { hashIdentityProjection } from '../../../src/identity/discovery/keys';
import { catalogValidatorVersion } from '../../../src/identity/catalog/activation';
import worker from '../../../src/index';
import { serveIdentityAdmin } from '../../../src/admin/identity/service';
import { IdentityAdminWorkflow } from '../../../src/identity/catalog/admin-workflow';
import { authenticatedAuthority } from '../../../src/admin/identity/auth';
import { verifyRevisionExport } from '../../../src/identity/catalog/revision-export';
import { sqliteHost } from '../../identity/catalog/sqlite-support';
let seed: Awaited<ReturnType<typeof syntheticSeed>>,
  f: Awaited<ReturnType<typeof harness>>;
beforeAll(async () => {
  seed = await syntheticSeed();
}, 30000);
beforeEach(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw Error('U5 external network forbidden');
    }),
  );
  f = await harness(seed);
}, 30000);
afterEach(async () => {
  await f?.dispose();
  vi.unstubAllGlobals();
});
async function data(response: Response) {
  expect(
    response.status,
    response.status === 200 ? undefined : await response.clone().text(),
  ).toBe(200);
  return ((await response.json()) as { data: Record<string, unknown> }).data;
}
async function reviewProposal(
  name = 'synthetic_u5_binding',
  target = 'synthetic-driver-1',
  newDriver = false,
) {
  const c = (await f.addCandidate(name)).candidate;
  const ref = {
    candidateId: c.candidateId,
    expectedCandidateVersion: c.recordVersion,
    expectedEvidenceHead: c.evidenceHead,
  };
  const evidence = await data(
    await f.call(
      '/evidence',
      f.envelope({
        candidate: ref,
        kind: 'review-dossier',
        claims: [
          {
            field: 'fullName',
            value: 'Synthetic New Person',
            sourceField: null,
          },
          {
            field: 'canonical-association',
            value: { key: c.key, targetId: target },
            sourceField: null,
          },
        ],
        references: [
          {
            kind: 'citation',
            httpsUrl: 'https://example.invalid/synthetic-u5',
            claimSummary: 'Synthetic local mechanism fixture.',
          },
        ],
        duplicateReview: null,
      }),
      f.reviewer.token,
    ),
  );
  const support = {
    evidenceIds: [evidence.evidenceId],
    dossierId: evidence.evidenceId,
    rationale: 'Exact synthetic association reviewed locally.',
  };
  const current = {
    candidateId: c.candidateId,
    expectedCandidateVersion: evidence.candidateVersion,
    expectedEvidenceHead: evidence.evidenceHead,
  };
  const payload = newDriver
    ? {
        candidate: current,
        driverId: target,
        profile: {
          fullName: 'Synthetic New Person',
          givenName: 'Synthetic',
          familyName: 'Person',
          shortCode: null,
          permanentNumber: null,
          nationality: null,
          countryCode: null,
          dateOfBirth: null,
          placeOfBirth: null,
          biography: null,
        },
        support,
        duplicateReview: {
          catalogHashReviewed: f.root.contentHash,
          inspectedCanonicalIds: f.root.snapshot.drivers.map(
            (d) => d.anchor.driverId,
          ),
          evidenceIds: support.evidenceIds,
          fullCatalogChecked: true,
          idExplicitlyReviewed: true,
          sameNameDistinction: null,
        },
      }
    : { candidate: current, targetDriverId: target, support };
  const request = f.envelope(payload),
    path = newDriver ? '/drivers/approve' : '/bindings/approve';
  const proposed = await data(await f.call(path, request, f.reviewer.token));
  return { c, ref: current, evidence, support, request, path, proposed };
}
describe('U5 authenticated local administrative HTTP API', () => {
  it('separates reader, reviewer and activator and denies identity authority on legacy operations', async () => {
    expect((await f.call('/health', undefined, f.reader.token)).status).toBe(
      200,
    );
    const admission = f.envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    for (const token of [f.reader.token, f.reviewer.token])
      expect((await f.call('/admission', admission, token)).status).toBe(403);
    expect(
      (await f.call('/admission', admission, f.activator.token)).status,
    ).toBe(200);
    const c = (await f.addCandidate()).candidate;
    const disposition = f.envelope({
      expectedCandidateVersion: c.recordVersion,
      expectedEvidenceHead: c.evidenceHead,
      action: 'quarantine',
      reasonCode: 'insufficient-evidence',
      evidenceIds: [],
    });
    for (const token of [f.reader.token, f.activator.token])
      expect(
        (
          await f.call(
            '/candidates/' + c.candidateId + '/disposition',
            disposition,
            token,
          )
        ).status,
      ).toBe(403);
    for (const path of [
      '/internal/admin/sync/full',
      '/internal/admin/rollback',
      '/internal/admin/reconciliation',
      '/internal/admin/cache/purge',
      '/internal/admin/season/ingest',
    ])
      expect(
        (
          await worker.fetch(
            new Request('https://local.test' + path, {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + f.owner.token },
              body: '{}',
            }),
            f.edge.env,
          )
        ).status,
      ).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps shared tokens read-only only in the explicit shadow compatibility mode', async () => {
    const body = f.envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    expect(
      (await f.call('/admission', body, f.edge.env.ADMIN_TOKEN!)).status,
    ).toBe(401);
    expect(
      (await f.call('/health', undefined, f.edge.env.ADMIN_TOKEN!)).status,
    ).toBe(401);
    f.edge.env.IDENTITY_ADMIN_MODE = 'read-only';
    expect(
      (await f.call('/health', undefined, f.edge.env.ADMIN_TOKEN!)).status,
    ).toBe(200);
    expect(
      (await f.call('/admission', body, f.edge.env.ADMIN_TOKEN!)).status,
    ).toBe(405);
    expect((await f.call('/admission', body, f.owner.token)).status).toBe(403);
  });
  it('rejects spoofed principals, credential IDs, roles, timestamps and unknown request fields', async () => {
    const body = f.envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    for (const extra of [
      { principalId: 'spoof' },
      { credentialId: 'spoof' },
      { roles: ['activator'] },
      { reviewer: 'spoof' },
      { createdAt: '2026-11-15T00:00:00Z' },
    ])
      expect((await f.call('/admission', { ...body, ...extra })).status).toBe(
        400,
      );
    expect(
      (
        await f.call('/admission', {
          ...body,
          payload: { ...body.payload, principalId: 'spoof' },
        })
      ).status,
    ).toBe(400);
    const response = await f.call('/admission', body, f.activator.token, {
      'X-Reviewer': 'spoof',
      'X-Credential-ID': 'spoof',
    });
    expect(response.status).toBe(200);
    const audit = f.host.db
      .prepare(
        'SELECT body FROM identity_catalog_audit ORDER BY sequence DESC LIMIT 1',
      )
      .get() as { body: string };
    expect(audit.body).toContain(f.activator.entry.principalId);
    expect(audit.body).not.toContain('spoof');
    expect(audit.body).toContain(f.activator.entry.credentialId);
  });
  it('performs exact review, separate validation and activation, export and replay with durable attribution', async () => {
    const p = await reviewProposal();
    expect(f.workflow.head().activeRevisionId).toBe(f.root.revisionId);
    expect(p.proposed).toMatchObject({
      status: 'proposed',
      schemaVersion: 1,
      installationId: installation,
    });
    const replay = await f.call(p.path, p.request, f.reviewer.token);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      replayed: true,
      data: p.proposed,
    });
    expect(
      (
        await f.call(
          p.path,
          { ...p.request, reason: 'Changed review bytes' },
          f.reviewer.token,
        )
      ).status,
    ).toBe(409);
    const id = p.proposed.proposedRevisionId as string;
    const activation = f.envelope({
      catalogHash: p.proposed.catalogHash,
      validationReportHash: 'sha256:' + '0'.repeat(64),
    });
    expect(
      (
        await f.call(
          '/revisions/' + id + '/activate',
          activation,
          f.activator.token,
        )
      ).status,
    ).toBe(422);
    const validation = f.envelope({
      catalogHash: p.proposed.catalogHash,
      expectedValidatorVersion: catalogValidatorVersion,
    });
    expect(
      (
        await f.call(
          '/revisions/' + id + '/validate',
          validation,
          f.reviewer.token,
        )
      ).status,
    ).toBe(403);
    const certificate = await data(
      await f.call(
        '/revisions/' + id + '/validate',
        validation,
        f.activator.token,
      ),
    );
    expect(certificate.valid).toBe(true);
    expect(f.workflow.head().activeRevisionId).toBe(f.root.revisionId);
    const request = f.envelope({
      catalogHash: p.proposed.catalogHash,
      validationReportHash: certificate.reportHash,
    });
    const result = await data(
      await f.call(
        '/revisions/' + id + '/activate',
        request,
        f.activator.token,
      ),
    );
    expect(result.activationSequence).toBe(2);
    expect(f.workflow.head().activeRevisionId).toBe(id);
    expect(
      (
        await f.call(
          '/revisions/' + id + '/activate',
          request,
          f.activator.token,
        )
      ).status,
    ).toBe(200);
    const receipt = await data(
      await f.call(
        '/operations/' + request.operationId + '?family=activate',
        undefined,
        f.activator.token,
      ),
    );
    expect(receipt.state).toBe('committed');
    const exported = await data(
      await f.call('/revisions/' + id + '/export', undefined, f.reader.token),
    );
    const { exportHash, ...projection } = exported;
    expect(exportHash).toBe(await hashIdentityProjection(projection));
    expect(
      (await verifyRevisionExport(JSON.stringify(exported.lineage))).revisionId,
    ).toBe(id);
    expect(providerMappingRegistry().resolve(p.c.key).outcome).toBe(
      'unresolved',
    );
    expect(f.edge.provider.requestMetrics().lifetime.total).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('allows one individual with both roles to review and activate through distinct operations', async () => {
    const c = (await f.addCandidate('synthetic_single_owner')).candidate;
    const r = f.envelope({
      expectedCandidateVersion: c.recordVersion,
      expectedEvidenceHead: c.evidenceHead,
      action: 'reject',
      reasonCode: 'invalid-provider-record',
      evidenceIds: [],
    });
    expect(
      (
        await f.call(
          '/candidates/' + c.candidateId + '/disposition',
          r,
          f.owner.token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await f.call(
          '/admission',
          f.envelope({ expectedAdmissionState: 'open', state: 'paused' }),
          f.owner.token,
        )
      ).status,
    ).toBe(200);
    const events = f.host.db
      .prepare(
        "SELECT body FROM identity_catalog_audit WHERE json_extract(body,'$.authMethod')='individual-bearer'",
      )
      .all() as { body: string }[];
    expect(events).toHaveLength(2);
    expect(
      events.every(
        (e) => JSON.parse(e.body).principalId === f.owner.entry.principalId,
      ),
    ).toBe(true);
  });
  it('creates only an explicitly reviewed synthetic canonical ID and profile', async () => {
    const p = await reviewProposal(
      'synthetic_u5_new_key',
      'synthetic-new-person',
      true,
    );
    await expect(
      f.workflow.readRevision(p.proposed.proposedRevisionId as string),
    ).resolves.toBeDefined();
    const r = await data(
      await f.call('/revisions/' + p.proposed.proposedRevisionId),
    );
    expect(
      (
        r.revision as {
          snapshot: { drivers: { anchor: { driverId: string } }[] };
        }
      ).snapshot.drivers.some(
        (d) => d.anchor.driverId === 'synthetic-new-person',
      ),
    ).toBe(true);
    expect(f.workflow.head().activeRevisionId).toBe(f.root.revisionId);
    await data(
      await f.call(
        '/revisions/' + p.proposed.proposedRevisionId + '/abandon',
        f.envelope({ catalogHash: p.proposed.catalogHash }),
      ),
    );
    const current = (await data(await f.call('/candidates/' + p.c.candidateId)))
      .candidate as { recordVersion: number };
    const reserved = await f.call(p.path, {
      ...p.request,
      operationId: crypto.randomUUID(),
      payload: {
        ...p.request.payload,
        candidate: {
          ...p.request.payload.candidate,
          expectedCandidateVersion: current.recordVersion,
        },
      },
    });
    expect(reserved.status).toBe(409);
    expect(await reserved.json()).toMatchObject({
      error: { code: 'CANONICAL_ID_RESERVED' },
    });
    expect(f.workflow.head().activeRevisionId).toBe(f.root.revisionId);
  });
  it('detects candidate versions, evidence heads and stale proposal validation', async () => {
    const c = (await f.addCandidate()).candidate;
    const base = {
      expectedCandidateVersion: c.recordVersion,
      expectedEvidenceHead: c.evidenceHead,
      action: 'quarantine',
      reasonCode: 'insufficient-evidence',
      evidenceIds: [],
    };
    expect(
      (
        await f.call(
          '/candidates/' + c.candidateId + '/disposition',
          f.envelope({ ...base, expectedCandidateVersion: 999 }),
        )
      ).status,
    ).toBe(409);
    expect(
      await (
        await f.call(
          '/candidates/' + c.candidateId + '/disposition',
          f.envelope({
            ...base,
            expectedEvidenceHead: 'sha256:' + '0'.repeat(64),
          }),
        )
      ).json(),
    ).toMatchObject({ error: { code: 'EVIDENCE_CHANGED' } });
    const p = await reviewProposal('synthetic_stale_proposal');
    // A new explicit dossier changes the reviewed head after proposal creation.
    const evidence = f.envelope({
      candidate: {
        ...p.ref,
        expectedCandidateVersion: Number(p.proposed.candidateVersion),
      },
      kind: 'review-dossier',
      claims: [
        {
          field: 'fullName',
          value: 'Synthetic New Evidence',
          sourceField: null,
        },
      ],
      references: [
        {
          kind: 'citation',
          httpsUrl: 'https://example.invalid/new-evidence',
          claimSummary: 'Synthetic newer claim.',
        },
      ],
      duplicateReview: null,
    });
    expect((await f.call('/evidence', evidence)).status).toBe(200);
    const invalid = await f.call(
      '/revisions/' + p.proposed.proposedRevisionId + '/validate',
      f.envelope({
        catalogHash: p.proposed.catalogHash,
        expectedValidatorVersion: catalogValidatorVersion,
      }),
    );
    expect(invalid.status).toBe(422);
    const invalidBody = (await invalid.json()) as {
      error: { details: { operationId: string } };
    };
    expect(invalidBody).toMatchObject({
      error: { code: 'CATALOG_INVALID', details: { valid: false } },
    });
    const failedReceipt = await data(
      await f.call(
        '/operations/' +
          invalidBody.error.details.operationId +
          '?family=validate',
      ),
    );
    expect(failedReceipt.result).toMatchObject({
      status: 422,
      data: { valid: false },
    });
    expect(f.workflow.head().activeRevisionId).toBe(f.root.revisionId);
  });
  it('retains quarantine/reject, requires eligible explicit reopening and cannot resolve a race row', async () => {
    const c = (await f.addCandidate()).candidate;
    const r = f.envelope({
      expectedCandidateVersion: c.recordVersion,
      expectedEvidenceHead: c.evidenceHead,
      action: 'quarantine',
      reasonCode: 'insufficient-evidence',
      evidenceIds: [],
    });
    const quarantined = await data(
      await f.call('/candidates/' + c.candidateId + '/disposition', r),
    );
    expect(quarantined.state).toBe('quarantined');
    expect(f.workflow.head().activeRevisionId).toBe(f.root.revisionId);
    const reopened = await data(
      await f.call(
        '/candidates/' + c.candidateId + '/disposition',
        f.envelope({
          ...r.payload,
          expectedCandidateVersion: quarantined.candidateVersion,
          action: 'reopen',
          reasonCode: 'new-evidence',
        }),
      ),
    );
    expect(reopened.state).toBe('unresolved');
  });
  it('acknowledges notifications atomically through individual reader authority and rejects stale generations', async () => {
    const c = (await f.addCandidate()).candidate;
    const request = f.envelope({ notificationGeneration: 1 });
    expect(
      (await data(await f.call('/notifications', undefined, f.reader.token)))
        .items,
    ).toHaveLength(1);
    expect(
      (
        await f.call(
          '/candidates/' + c.candidateId + '/acknowledge',
          request,
          f.reader.token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await f.call(
          '/candidates/' + c.candidateId + '/acknowledge',
          request,
          f.reader.token,
        )
      ).status,
    ).toBe(200);
    expect(
      (await data(await f.call('/notifications', undefined, f.reader.token)))
        .items,
    ).toHaveLength(0);
    expect(
      (
        await f.call(
          '/candidates/' + c.candidateId + '/acknowledge',
          f.envelope({ notificationGeneration: 2 }),
          f.reader.token,
        )
      ).status,
    ).toBe(409);
    const newer = (await f.addCandidate('synthetic_notification_generations'))
      .candidate;
    const disposition = {
      expectedCandidateVersion: newer.recordVersion,
      expectedEvidenceHead: newer.evidenceHead,
      action: 'quarantine',
      reasonCode: 'insufficient-evidence',
      evidenceIds: [],
    };
    const quarantined = await data(
      await f.call(
        '/candidates/' + newer.candidateId + '/disposition',
        f.envelope(disposition),
      ),
    );
    await data(
      await f.call(
        '/candidates/' + newer.candidateId + '/disposition',
        f.envelope({
          ...disposition,
          expectedCandidateVersion: quarantined.candidateVersion,
          action: 'reopen',
          reasonCode: 'new-evidence',
        }),
      ),
    );
    const backlog = await data(
      await f.call('/notifications', undefined, f.reader.token),
    );
    expect(backlog.items).toEqual([
      expect.objectContaining({
        candidateId: newer.candidateId,
        generation: 2,
      }),
    ]);
    await data(
      await f.call(
        '/candidates/' + newer.candidateId + '/acknowledge',
        f.envelope({ notificationGeneration: 2 }),
        f.reader.token,
      ),
    );
    expect(
      (await data(await f.call('/notifications', undefined, f.reader.token)))
        .items,
    ).toHaveLength(0);
  });
  it('validates query filters and uses stable installation/filter-bound pagination', async () => {
    for (const key of [
      'synthetic_page_one',
      'synthetic_page_two',
      'synthetic_page_three',
    ])
      await f.addCandidate(key);
    const first = await data(
      await f.call('/candidates?limit=1&source=jolpica'),
    );
    expect(first.items as unknown[]).toHaveLength(1);
    const cursor = first.nextCursor as string;
    await f.addCandidate('synthetic_later_candidate');
    const second = await data(
      await f.call(
        '/candidates?limit=100&source=jolpica&cursor=' +
          encodeURIComponent(cursor),
      ),
    );
    expect(second.asOfSequence).toBe(first.asOfSequence);
    expect(second.items as unknown[]).toHaveLength(2);
    expect(
      (
        await f.call(
          '/candidates?source=openf1&cursor=' + encodeURIComponent(cursor),
        )
      ).status,
    ).toBe(400);
    for (const query of [
      '?limit=101',
      '?limit=0',
      '?limit=01',
      '?season=abc',
      '?raw=true',
      '?source=JOLPICA',
      '?state=verified',
      '?limit=1&limit=2',
      '?cursor=malformed',
    ])
      expect((await f.call('/candidates' + query)).status).toBe(400);
  });
  it('bounds request bytes, rejects malformed/closed JSON and requires the exact idempotency header', async () => {
    expect((await f.call('/admission', '{')).status).toBe(400);
    expect(
      (await f.call('/admission', 'x'.repeat(256 * 1024 + 1))).status,
    ).toBe(413);
    expect(
      (
        await f.call(
          '/admission',
          f.envelope({ expectedAdmissionState: 'open', state: 'paused' }),
          f.owner.token,
          { 'Idempotency-Key': crypto.randomUUID() },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call(
          '/admission',
          f.envelope({ expectedAdmissionState: 'open', state: 'paused' }),
          f.owner.token,
          { 'Content-Type': 'text/plain' },
        )
      ).status,
    ).toBe(400);
    expect(
      (await f.call('/seed', 'x'.repeat(2 * 1024 * 1024 + 1))).status,
    ).toBe(413);
    const request = f.envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    request.installationId = crypto.randomUUID();
    expect((await f.call('/admission', request)).status).toBe(409);
  });
  it('isolates operation receipts by principal and allows an activator to inspect another actor explicitly', async () => {
    const request = f.envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    await f.call('/admission', request);
    expect(
      (
        await data(
          await f.call(
            '/operations/' + request.operationId + '?family=admission',
            undefined,
            f.reader.token,
          ),
        )
      ).state,
    ).toBe('unknown');
    expect(
      (
        await f.call(
          '/operations/' +
            request.operationId +
            '?family=admission&principalId=' +
            f.owner.entry.principalId,
          undefined,
          f.reader.token,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await data(
          await f.call(
            '/operations/' +
              request.operationId +
              '?family=admission&principalId=' +
              f.owner.entry.principalId,
            undefined,
            f.activator.token,
          ),
        )
      ).state,
    ).toBe('committed');
  });
  it('preserves receipts and historical credential attribution after rotation and revocation', async () => {
    const request = f.envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    await f.call('/admission', request);
    const rotated = credential(f.owner.entry.roles, f.owner.entry.principalId);
    f.owner.entry.disabled = true;
    const value = JSON.stringify([f.owner.entry, rotated.entry]);
    f.edge.env.IDENTITY_REVIEWER_CREDENTIALS = value;
    f.config.IDENTITY_REVIEWER_CREDENTIALS = value;
    expect((await f.call('/health')).status).toBe(401);
    expect((await f.call('/admission', request, rotated.token)).status).toBe(
      200,
    );
    const history = await data(
      await f.call(
        '/history?principalId=' + f.owner.entry.principalId,
        undefined,
        rotated.token,
      ),
    );
    expect(JSON.stringify(history)).toContain(f.owner.entry.credentialId);
    expect(JSON.stringify(history)).not.toContain(rotated.entry.tokenSha256);
  });
  it('fails closed without required configuration or storage and exposes no public identity route', async () => {
    for (const field of [
      'IDENTITY_ADMIN_MODE',
      'IDENTITY_INSTALLATION_ID',
      'IDENTITY_REVIEWER_CREDENTIALS',
      'IDENTITY_CATALOG',
    ] as const) {
      const value = f.edge.env[field];
      delete f.edge.env[field];
      expect((await f.call('/health')).status).toBe(503);
      Object.assign(f.edge.env, { [field]: value });
    }
    expect(
      (
        await worker.fetch(
          new Request('https://local.test/v1/identity/candidates'),
          f.edge.env,
        )
      ).status,
    ).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('sanitizes logs and errors even when a credential is spoofed as a request ID or path', async () => {
    const r = await f.call('/health', undefined, f.owner.token, {
      'X-Request-ID': f.owner.token,
    });
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(r.headers.has('Access-Control-Allow-Origin')).toBe(false);
    await f.call('/' + f.owner.token);
    const serialized = JSON.stringify(f.edge.logger.events);
    expect(serialized).not.toContain(f.owner.token);
    expect(serialized).not.toContain(f.owner.entry.tokenSha256);
    expect(
      await (await f.call('/evidence/' + ('sha256:' + '0'.repeat(64)))).text(),
    ).not.toContain('stack');
  });
  it('enforces durable credential and installation rate windows with recovery and replay as a read', async () => {
    const authority = authenticatedAuthority(
      {
        principalId: f.owner.entry.principalId,
        credentialId: f.owner.entry.credentialId,
        authMethod: 'individual-bearer',
        roles: f.owner.entry.roles,
      },
      true,
    );
    let now = Date.now();
    const w = new IdentityAdminWorkflow(
      f.host.storage,
      installation,
      authority.authority,
      () => now,
    );
    for (let i = 0; i < 60; i++)
      w.rate(
        {
          principalId: 'x',
          credentialId: 'rate-test',
          authMethod: 'individual-bearer',
          roles: ['reader'],
        },
        false,
      );
    expect(() =>
      w.rate(
        {
          principalId: 'x',
          credentialId: 'rate-test',
          authMethod: 'individual-bearer',
          roles: ['reader'],
        },
        false,
      ),
    ).toThrow('ADMIN_RATE_LIMITED');
    now += 60000;
    expect(() =>
      w.rate(
        {
          principalId: 'x',
          credentialId: 'rate-test',
          authMethod: 'individual-bearer',
          roles: ['reader'],
        },
        false,
      ),
    ).not.toThrow();
    const request = f.envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    expect((await f.call('/admission', request)).status).toBe(200);
    for (let i = 0; i < 5; i++)
      expect((await f.call('/admission', request)).status).toBe(200);
    const row = f.host.db
      .prepare(
        'SELECT writes FROM identity_admin_rates WHERE credential=? ORDER BY window DESC',
      )
      .get(f.owner.entry.credentialId) as { writes: number };
    expect(row.writes).toBe(1);
  });
  it('prepares an explicit reviewed synthetic seed without activating it', async () => {
    const h = sqliteHost();
    try {
      const artifact = {
        format: 'gridview-reviewed-seed/1',
        seed,
        dossier: {
          claims: [
            {
              field: 'fullName',
              value: 'Synthetic Seed Review',
              sourceField: null,
            },
          ],
          references: [
            {
              kind: 'citation',
              httpsUrl: 'https://example.invalid/synthetic-seed',
              claimSummary: 'Synthetic isolated bootstrap.',
            },
          ],
          rationale: 'Reviewed synthetic source closure.',
          synthetic: true,
        },
      };
      const request = {
        ...f.envelope({
          seedArtifact: artifact,
          seedArtifactHash: await hashIdentityProjection(artifact),
          approvedImportDossierId: await hashIdentityProjection(
            artifact.dossier,
          ),
        }),
        expectedActiveRevisionId: null,
        expectedActivationSequence: 0,
      };
      const call = (path: string, body: unknown) =>
        serveIdentityAdmin(
          new Request('https://local.test/internal/admin/identity' + path, {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + f.owner.token,
              'Content-Type': 'application/json',
              'Idempotency-Key': (body as { operationId: string }).operationId,
            },
            body: JSON.stringify(body),
          }),
          f.config,
          h.storage,
          true,
        );
      const proposed = await data(await call('/seed', request));
      expect(proposed.status).toBe('proposed');
      const certificate = await data(
        await call('/revisions/' + proposed.proposedRevisionId + '/validate', {
          ...request,
          operationId: crypto.randomUUID(),
          payload: {
            catalogHash: proposed.catalogHash,
            expectedValidatorVersion: catalogValidatorVersion,
          },
        }),
      );
      expect(certificate.valid).toBe(true);
      const stored = h.db
        .prepare('SELECT body FROM identity_catalog_head')
        .get() as { body: string };
      expect(JSON.parse(stored.body).activeRevisionId).toBeNull();
    } finally {
      h.db.close();
    }
  });
  it('approves a profile under the same canonical ID with exact profile-hash concurrency', async () => {
    const p = await reviewProposal('synthetic_profile_support');
    const driver = f.root.snapshot.drivers.find(
      (d) => d.anchor.driverId === 'synthetic-driver-1',
    )!;
    const { id, ...profile } = driver.profile;
    const request = f.envelope({
      expectedProfileHash: driver.profileHash,
      profile: { ...profile, fullName: 'Synthetic New Person' },
      support: p.support,
    });
    expect(
      (
        await f.call('/drivers/' + id + '/profiles', {
          ...request,
          operationId: crypto.randomUUID(),
          payload: {
            ...request.payload,
            expectedProfileHash: 'sha256:' + '0'.repeat(64),
          },
        })
      ).status,
    ).toBe(409);
    const proposal = await data(
      await f.call('/drivers/' + id + '/profiles', request),
    );
    expect(proposal.status).toBe('proposed');
    const inspected = await f.workflow.readRevision(
      proposal.proposedRevisionId as string,
    );
    expect(
      inspected.snapshot.drivers.find((d) => d.anchor.driverId === id)?.profile
        .fullName,
    ).toBe('Synthetic New Person');
    expect(f.workflow.head().activeRevisionId).toBe(f.root.revisionId);
  });
  it('records a correction and its review decision atomically, pauses admission and preserves the active head', async () => {
    const p = await reviewProposal('synthetic_correction');
    const request = f.envelope({
      candidate: {
        ...p.ref,
        expectedCandidateVersion: p.proposed.candidateVersion,
      },
      affectedDriverIds: ['synthetic-driver-1'],
      affectedBindingIds: [],
      affectedRevisionIds: [f.root.revisionId],
      affectedSeasons: [2026],
      publishedVersions: [],
      reasonCode: 'invalid-association',
      evidenceIds: p.support.evidenceIds,
    });
    const correction = await data(await f.call('/corrections', request));
    expect(correction.status).toBe('reported');
    expect(f.workflow.head()).toMatchObject({
      admissionState: 'paused',
      activeRevisionId: f.root.revisionId,
    });
    const count = f.host.db
      .prepare('SELECT COUNT(*) n FROM identity_catalog_corrections')
      .get() as { n: number };
    expect(count.n).toBe(1);
    expect((await f.call('/corrections', request)).status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('restricts abandonment to the original reviewer or an activator', async () => {
    const p = await reviewProposal('synthetic_abandon');
    const request = f.envelope({ catalogHash: p.proposed.catalogHash });
    expect(
      (
        await f.call(
          '/revisions/' + p.proposed.proposedRevisionId + '/abandon',
          request,
          f.owner.token,
        )
      ).status,
    ).toBe(200);
    const q = await reviewProposal('synthetic_abandon_second');
    const other = credential(
      ['reader', 'reviewer'],
      'synthetic-other-reviewer',
    );
    const entries = JSON.parse(f.config.IDENTITY_REVIEWER_CREDENTIALS!);
    entries.push(other.entry);
    f.config.IDENTITY_REVIEWER_CREDENTIALS = JSON.stringify(entries);
    f.edge.env.IDENTITY_REVIEWER_CREDENTIALS =
      f.config.IDENTITY_REVIEWER_CREDENTIALS;
    expect(
      (
        await f.call(
          '/revisions/' + q.proposed.proposedRevisionId + '/abandon',
          f.envelope({ catalogHash: q.proposed.catalogHash }),
          other.token,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await f.call(
          '/revisions/' + q.proposed.proposedRevisionId + '/abandon',
          f.envelope({ catalogHash: q.proposed.catalogHash }),
          f.activator.token,
        )
      ).status,
    ).toBe(200);
  });
  it('prepares a sealed reviewed base import while retaining runtime bindings and profiles', async () => {
    const p = await reviewProposal('synthetic_base_survival');
    const validation = await data(
      await f.call(
        '/revisions/' + p.proposed.proposedRevisionId + '/validate',
        f.envelope({
          catalogHash: p.proposed.catalogHash,
          expectedValidatorVersion: catalogValidatorVersion,
        }),
      ),
    );
    await data(
      await f.call(
        '/revisions/' + p.proposed.proposedRevisionId + '/activate',
        f.envelope({
          catalogHash: p.proposed.catalogHash,
          validationReportHash: validation.reportHash,
        }),
      ),
    );
    const parent = await f.workflow.readRevision(
      p.proposed.proposedRevisionId as string,
    );
    const request = f.envelope({
      baseArtifact: seed,
      baseArtifactHash: await hashIdentityProjection(seed),
      support: p.support,
    });
    const imported = await data(await f.call('/base-imports', request));
    const proposal = await f.workflow.readRevision(
      imported.proposedRevisionId as string,
    );
    expect(proposal.snapshot.drivers).toEqual(parent.snapshot.drivers);
    expect(proposal.snapshot.bindings).toEqual(parent.snapshot.bindings);
    expect(f.workflow.head().activeRevisionId).toBe(parent.revisionId);
    expect(
      (
        await verifyRevisionExport(
          await f.workflow.exportRevision(proposal.revisionId),
        )
      ).revisionId,
    ).toBe(proposal.revisionId);
  });
  it('returns a bounded availability error instead of an oversized response', async () => {
    const original = IdentityAdminWorkflow.prototype.revisionInfo;
    const spy = vi
      .spyOn(IdentityAdminWorkflow.prototype, 'revisionInfo')
      .mockImplementation(async function (
        this: IdentityAdminWorkflow,
        id: string,
      ) {
        const info = await original.call(this, id);
        return {
          ...info,
          deltaFromParent: {
            ...info.deltaFromParent,
            seasons: [
              {
                season: 2026,
                previousDatasetVersion: 'x'.repeat(2 * 1024 * 1024),
                datasetVersion: 'synthetic',
                changed: true,
              },
            ],
          },
        };
      });
    try {
      const response = await f.call('/revisions/' + f.root.revisionId);
      expect(response.status).toBe(503);
      expect((await response.text()).length).toBeLessThan(1024);
    } finally {
      spy.mockRestore();
    }
  });
  it('applies the aggregate installation limit across otherwise eligible credentials', async () => {
    const a = authenticatedAuthority(
      {
        principalId: 'synthetic-rate-owner',
        credentialId: 'synthetic-rate',
        authMethod: 'individual-bearer',
        roles: ['reader'],
      },
      true,
    );
    const w = new IdentityAdminWorkflow(
      f.host.storage,
      installation,
      a.authority,
      () => Date.parse('2090-01-01T00:00:00Z'),
    );
    for (let actor = 0; actor < 5; actor++)
      for (let i = 0; i < 60; i++)
        w.rate(
          {
            principalId: 'synthetic-rate-' + actor,
            credentialId: 'synthetic-rate-' + actor,
            authMethod: 'individual-bearer',
            roles: ['reader'],
          },
          false,
        );
    expect(() =>
      w.rate(
        {
          principalId: 'synthetic-other',
          credentialId: 'synthetic-other',
          authMethod: 'individual-bearer',
          roles: ['reader'],
        },
        false,
      ),
    ).toThrow('ADMIN_RATE_LIMITED');
  });
  it('returns HTTP rate limits with Retry-After and recovers in the next window', async () => {
    for (let i = 0; i < 60; i++)
      expect(
        (await f.call('/notifications', undefined, f.reader.token)).status,
      ).toBe(200);
    const limited = await f.call('/notifications', undefined, f.reader.token);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
    try {
      expect(
        (await f.call('/notifications', undefined, f.reader.token)).status,
      ).toBe(200);
    } finally {
      clock.mockRestore();
    }
  });
  it('rolls back a mutation when its HTTP receipt cannot be retained and recovers with the same request', async () => {
    const request = f.envelope({
        expectedAdmissionState: 'open',
        state: 'paused',
      }),
      before = f.workflow.head();
    const exec = f.host.storage.sql.exec.bind(f.host.storage.sql);
    const spy = vi
      .spyOn(f.host.storage.sql, 'exec')
      .mockImplementation((q, ...args) => {
        if (q.startsWith('INSERT INTO identity_admin_receipts'))
          throw Error('synthetic receipt fault');
        return exec(q, ...args);
      });
    try {
      expect((await f.call('/admission', request)).status).toBe(503);
      expect(f.workflow.head()).toEqual(before);
    } finally {
      spy.mockRestore();
    }
    expect((await f.call('/admission', request)).status).toBe(200);
    expect(f.workflow.head().admissionState).toBe('paused');
  });
  it('replays concurrent identical mutations once without creating a second audit record', async () => {
    const request = f.envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    const responses = await Promise.all([
      f.call('/admission', request),
      f.call('/admission', request),
    ]);
    expect(responses.every((r) => r.status === 200)).toBe(true);
    const bodies = await Promise.all(responses.map((r) => r.json()));
    expect(bodies).toEqual(
      expect.arrayContaining([expect.objectContaining({ replayed: true })]),
    );
    const row = f.host.db
      .prepare(
        "SELECT COUNT(*) n FROM identity_catalog_audit WHERE json_extract(body,'$.operationId')=?",
      )
      .get(request.operationId) as { n: number };
    expect(row.n).toBe(1);
  });
  it('rejects current token/digest material in otherwise valid request text before persistence', async () => {
    for (const secret of [f.owner.token, f.owner.entry.tokenSha256])
      expect(
        (
          await f.call('/admission', {
            ...f.envelope({ expectedAdmissionState: 'open', state: 'paused' }),
            reason: secret,
          })
        ).status,
      ).toBe(400);
    const rows = f.host.db
      .prepare('SELECT body FROM identity_catalog_audit')
      .all();
    expect(JSON.stringify(rows)).not.toContain(f.owner.token);
    expect(JSON.stringify(rows)).not.toContain(f.owner.entry.tokenSha256);
  });
  it('allows the authenticated actor or an activator to recover receipts without requiring the separate reader role', async () => {
    const request = f.envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    expect((await f.call('/admission', request)).status).toBe(200);
    f.owner.entry.roles = ['reviewer'];
    f.activator.entry.roles = ['activator'];
    const value = JSON.stringify([
      f.owner.entry,
      f.reader.entry,
      f.reviewer.entry,
      f.activator.entry,
    ]);
    f.config.IDENTITY_REVIEWER_CREDENTIALS = value;
    f.edge.env.IDENTITY_REVIEWER_CREDENTIALS = value;
    expect(
      (
        await data(
          await f.call(
            '/operations/' + request.operationId + '?family=admission',
          ),
        )
      ).state,
    ).toBe('committed');
    expect((await f.call('/health')).status).toBe(403);
    expect(
      (
        await data(
          await f.call(
            '/operations/' +
              request.operationId +
              '?family=admission&principalId=' +
              f.owner.entry.principalId,
            undefined,
            f.activator.token,
          ),
        )
      ).state,
    ).toBe('committed');
  });
  it('never reuses an immutable source proof when the retained origin bytes change or disappear', async () => {
    await f.workflow.readRevision(f.root.revisionId);
    const row = f.host.db
      .prepare('SELECT body FROM identity_catalog_origin WHERE id=1')
      .get() as { body: string };
    const altered = JSON.parse(row.body);
    altered.snapshot.drivers[0].profile.fullName = 'Tampered synthetic origin';
    f.host.db
      .prepare('UPDATE identity_catalog_origin SET body=? WHERE id=1')
      .run(JSON.stringify(altered));
    await expect(f.workflow.readRevision(f.root.revisionId)).rejects.toThrow();
    f.host.db
      .prepare('UPDATE identity_catalog_origin SET body=? WHERE id=1')
      .run(row.body);
    await expect(f.workflow.readRevision(f.root.revisionId)).resolves.toEqual(
      f.root,
    );
    f.host.db
      .prepare('UPDATE identity_catalog_origin SET body=? WHERE id=1')
      .run('{');
    await expect(f.workflow.readRevision(f.root.revisionId)).rejects.toThrow();
    await expect(f.workflow.readRevision(f.root.revisionId)).rejects.toThrow();
    f.host.db
      .prepare('UPDATE identity_catalog_origin SET body=? WHERE id=1')
      .run(row.body);
    f.host.db.prepare('DELETE FROM identity_catalog_origin WHERE id=1').run();
    await expect(f.workflow.readRevision(f.root.revisionId)).rejects.toThrow(
      'catalog-storage-schema',
    );
  });
});
