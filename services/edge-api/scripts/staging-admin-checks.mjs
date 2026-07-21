#!/usr/bin/env node

const baseUrl = process.argv[2];
const token = process.env.GRIDVIEW_STAGING_ADMIN_TOKEN;

if (!baseUrl) {
  console.error('Usage: node scripts/staging-admin-checks.mjs <base-url>');
  process.exit(2);
}

if (!token) {
  console.error(
    'GRIDVIEW_STAGING_ADMIN_TOKEN must be set in the local environment.',
  );
  process.exit(2);
}

const base = normalizeBaseUrl(baseUrl);
const results = [];

try {
  await checkUnauthorizedResponses();
  await checkValidAdminRead();
  await checkStateChangingGetRejected();
  await checkPublicPathsCannotWrite();
  await checkCachePurge();

  for (const result of results) {
    console.log(`ok ${result}`);
  }
  console.log(`summary: ${results.length} staging admin checks passed`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function checkUnauthorizedResponses() {
  const missing = await fetch(url('/internal/admin/sync/status'));
  const invalid = await fetch(url('/internal/admin/sync/status'), {
    headers: { Authorization: 'Bearer invalid-token-for-admin-check' },
  });

  assertStatus(missing, 401, 'missing authorization');
  assertStatus(invalid, 401, 'invalid authorization');
  const missingText = await missing.text();
  const invalidText = await invalid.text();
  const missingBody = JSON.parse(missingText);
  const invalidBody = JSON.parse(invalidText);
  assert(
    missingBody.error?.code === invalidBody.error?.code &&
      missingBody.error?.message === invalidBody.error?.message,
    'unauthorized responses are generic',
  );
  assertNoSecret(missingText, 'missing authorization response');
  assertNoSecret(invalidText, 'invalid authorization response');
  results.push('missing/invalid authorization');
}

async function checkValidAdminRead() {
  const response = await adminFetch('/internal/admin/sync/status');
  assertStatus(response, 200, 'valid admin sync status');
  const text = await response.text();
  assertNoSecret(text, 'valid admin response');
  const body = JSON.parse(text);
  assert(body.data, 'valid admin status returns data');
  assert(body.requestId, 'valid admin status returns requestId');
  results.push('valid authorization');
}

async function checkStateChangingGetRejected() {
  const response = await adminFetch('/internal/admin/sync/full', {
    method: 'GET',
  });
  assertStatus(response, 405, 'GET sync/full');
  assertNoSecret(await response.text(), 'GET sync/full response');
  results.push('state-changing admin GET rejected');
}

async function checkPublicPathsCannotWrite() {
  const response = await fetch(url('/v1/seasons/2026/calendar'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assertStatus(response, 405, 'public POST with admin token');
  assertNoSecret(await response.text(), 'public POST response');
  results.push('public paths cannot write');
}

async function checkCachePurge() {
  const response = await adminFetch('/internal/admin/cache/purge', {
    method: 'POST',
  });
  assert(
    response.status === 200 || response.status === 207,
    `cache purge expected HTTP 200 or 207, got ${response.status}`,
  );
  const text = await response.text();
  assertNoSecret(text, 'cache purge response');
  const body = JSON.parse(text);
  assert(Array.isArray(body.data?.urls), 'cache purge returns URL list');
  assert(
    body.data.urls.every((item) => item.startsWith(base)),
    'cache purge only reports staging public URLs',
  );
  results.push('cache purge authorization');
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

function assertNoSecret(text, label) {
  assert(!text.includes(token), `${label} must not include ADMIN_TOKEN`);
  assert(
    !text.includes('invalid-token-for-admin-check'),
    `${label} must not include invalid token`,
  );
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

function assertStatus(response, expected, label) {
  assert(
    response.status === expected,
    `${label} expected HTTP ${expected}, got ${response.status}`,
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
