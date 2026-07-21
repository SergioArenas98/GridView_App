#!/usr/bin/env node

const baseUrl = process.argv[2];
const token = process.env.GRIDVIEW_STAGING_ADMIN_TOKEN;

if (!baseUrl) {
  console.error(
    'Usage: node scripts/staging-authenticated-workflow.mjs <base-url>',
  );
  process.exit(2);
}

if (!token) {
  console.error(
    'GRIDVIEW_STAGING_ADMIN_TOKEN must be set in the local environment.',
  );
  process.exit(2);
}

const base = normalizeBaseUrl(baseUrl);
const summary = {
  adminSecurity: {},
  sync: {},
  caching: {},
  rollback: {},
};

try {
  await verifyAdminSecurity();
  await verifyPublicationAndRollback();
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function verifyAdminSecurity() {
  const missing = await fetch(url('/internal/admin/sync/status'));
  const invalid = await fetch(url('/internal/admin/sync/status'), {
    headers: { Authorization: 'Bearer invalid-token-for-admin-workflow' },
  });
  assertStatus(missing, 401, 'missing admin authorization');
  assertStatus(invalid, 401, 'invalid admin authorization');
  const missingBody = await missing.json();
  const invalidBody = await invalid.json();
  assert(
    missingBody.error?.code === invalidBody.error?.code &&
      missingBody.error?.message === invalidBody.error?.message,
    'missing and invalid admin auth must be generic',
  );

  const valid = await adminFetch('/internal/admin/sync/status');
  assertStatus(valid, 200, 'valid admin authorization');
  const validText = await valid.text();
  assertNoSecret(validText, 'valid admin status response');
  const statusBody = JSON.parse(validText);

  const stateChangingGet = await adminFetch('/internal/admin/sync/full', {
    method: 'GET',
  });
  assertStatus(stateChangingGet, 405, 'state-changing admin GET');

  const publicWrite = await fetch(url('/v1/seasons/2026/calendar'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assertStatus(publicWrite, 405, 'public path state-changing request');

  const invalidCors = await fetch(url('/internal/admin/sync/full'), {
    method: 'OPTIONS',
  });
  assert(
    !invalidCors.headers.has('access-control-allow-origin'),
    'admin CORS must not expose administrative operations',
  );

  const cachePurge = await adminFetch('/internal/admin/cache/purge', {
    method: 'POST',
  });
  assert(
    cachePurge.status === 200 || cachePurge.status === 207,
    `cache purge expected HTTP 200 or 207, got ${cachePurge.status}`,
  );
  const purgeText = await cachePurge.text();
  assertNoSecret(purgeText, 'cache purge response');
  const purgeBody = JSON.parse(purgeText);
  assert(
    purgeBody.data.urls.every((item) => item.startsWith(base)),
    'cache purge must only report staging public URLs',
  );

  summary.adminSecurity = {
    missingAuthorization: missing.status,
    invalidAuthorization: invalid.status,
    validAuthorization: valid.status,
    stateChangingGet: stateChangingGet.status,
    publicWriteAttempt: publicWrite.status,
    adminCorsExposed: invalidCors.headers.has('access-control-allow-origin'),
    cachePurgeStatus: cachePurge.status,
    activeVersionBeforeWorkflow: statusBody.data?.activeVersion ?? null,
    previousVersionBeforeWorkflow: statusBody.data?.previousVersion ?? null,
  };
}

async function verifyPublicationAndRollback() {
  const beforeHome = await fetch(url('/v1/home?season=2026'));
  assertStatus(beforeHome, 200, 'home before second sync');
  const beforeEtag = beforeHome.headers.get('etag');

  const sync = await adminFetch('/internal/admin/sync/full', {
    method: 'POST',
  });
  assertStatus(sync, 200, 'second full sync');
  const syncText = await sync.text();
  assertNoSecret(syncText, 'second full sync response');
  const syncBody = JSON.parse(syncText);
  assert(
    syncBody.data?.publicationStatus === 'applied',
    'second sync must publish a complete release',
  );

  const afterHome = await fetch(url('/v1/home?season=2026'));
  assertStatus(afterHome, 200, 'home after second sync');
  const afterEtag = afterHome.headers.get('etag');

  const statusAfterSync = await adminFetch('/internal/admin/sync/status');
  assertStatus(statusAfterSync, 200, 'sync status after second sync');
  const statusAfterSyncBody = await statusAfterSync.json();
  const activeAfterSync = statusAfterSyncBody.data?.activeVersion ?? null;
  const previousAfterSync = statusAfterSyncBody.data?.previousVersion ?? null;
  assert(activeAfterSync, 'active version must exist after second sync');
  assert(previousAfterSync, 'previous version must exist after second sync');

  const notModified = await fetch(url('/v1/home?season=2026'), {
    headers: { 'If-None-Match': afterEtag },
  });
  assertStatus(notModified, 304, 'home If-None-Match after second sync');
  assert((await notModified.text()) === '', '304 response must have no body');

  const missingRollback = await adminFetch('/internal/admin/rollback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: 'missing-release-for-staging-check' }),
  });
  assertStatus(missingRollback, 409, 'rollback to missing release');
  const statusAfterMissingRollback = await adminFetch(
    '/internal/admin/sync/status',
  );
  const afterMissingBody = await statusAfterMissingRollback.json();
  assert(
    afterMissingBody.data?.activeVersion === activeAfterSync,
    'missing rollback must leave active version unchanged',
  );

  const rollback = await adminFetch('/internal/admin/rollback', {
    method: 'POST',
  });
  assertStatus(rollback, 200, 'rollback to previous release');
  const rollbackText = await rollback.text();
  assertNoSecret(rollbackText, 'rollback response');
  const rollbackBody = JSON.parse(rollbackText);

  const statusAfterRollback = await adminFetch('/internal/admin/sync/status');
  const statusAfterRollbackBody = await statusAfterRollback.json();
  assert(
    statusAfterRollbackBody.data?.activeVersion === previousAfterSync,
    'rollback must activate the previous release',
  );

  const rolledBackHome = await fetch(url('/v1/home?season=2026'));
  assertStatus(rolledBackHome, 200, 'home after rollback');

  summary.sync = {
    secondPublicationStatus: syncBody.data.publicationStatus,
    secondReleaseVersion: syncBody.data.releaseVersion,
    providerCallCount: syncBody.data.providerCallCount,
    activeAfterSync,
    previousAfterSync,
  };
  summary.caching = {
    etagBeforeSecondSync: beforeEtag,
    etagAfterSecondSync: afterEtag,
    etagChangedAfterSecondSync: beforeEtag !== afterEtag,
    notModifiedStatus: notModified.status,
    notModifiedBodyEmpty: true,
  };
  summary.rollback = {
    missingRollbackStatus: missingRollback.status,
    activePreservedAfterMissingRollback:
      afterMissingBody.data?.activeVersion === activeAfterSync,
    rollbackStatus: rollback.status,
    rollbackPublicationStatus: rollbackBody.data?.status,
    activeAfterRollback: statusAfterRollbackBody.data?.activeVersion,
    previousAfterRollback: statusAfterRollbackBody.data?.previousVersion,
    rolledBackHomeEtag: rolledBackHome.headers.get('etag'),
  };
}

function adminFetch(path, init = {}) {
  return fetch(url(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

function normalizeBaseUrl(value) {
  const parsed = new URL(value);
  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function url(path) {
  return `${base}${path}`;
}

function assertNoSecret(text, label) {
  assert(!text.includes(token), `${label} must not include ADMIN_TOKEN`);
  assert(
    !text.includes('invalid-token-for-admin-workflow'),
    `${label} must not include invalid token`,
  );
}

function assertStatus(response, expected, label) {
  assert(
    response.status === expected,
    `${label} expected HTTP ${expected}, got ${response.status}`,
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
