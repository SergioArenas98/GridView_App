#!/usr/bin/env node

const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error('Usage: node scripts/staging-smoke.mjs <base-url>');
  process.exit(2);
}

const base = normalizeBaseUrl(baseUrl);
const relevantHeaders = ['etag', 'cache-control', 'last-modified'];

const publicRoutes = [
  route('/v1/status', { snapshot: false, stableIds: ['gridview-edge-api'] }),
  route('/v1/bootstrap?season=2026', {
    stableIds: ['max-verstappen', 'ferrari', 'monza'],
  }),
  route('/v1/home?season=2026', { stableIds: ['2026-belgian-grand-prix'] }),
  route('/v1/seasons/current', { stableIds: ['2026'] }),
  route('/v1/seasons/2026', { stableIds: ['2026'] }),
  route('/v1/seasons/2026/calendar', {
    stableIds: ['2026-belgian-grand-prix', 'spa-francorchamps'],
  }),
  route('/v1/seasons/2026/grand-prix/13', {
    stableIds: ['2026-belgian-grand-prix', 'spa-francorchamps'],
  }),
  route('/v1/seasons/2026/grand-prix/13/results', {
    stableIds: ['2026-belgian-grand-prix-race-results'],
  }),
  route('/v1/seasons/2026/standings/drivers', {
    stableIds: ['max-verstappen', 'mclaren'],
  }),
  route('/v1/seasons/2026/standings/constructors', {
    stableIds: ['mclaren', 'ferrari'],
  }),
  route('/v1/seasons/2026/drivers', {
    stableIds: ['max-verstappen', 'lando-norris'],
  }),
  route('/v1/drivers/max-verstappen?season=2026', {
    stableIds: ['max-verstappen', 'red-bull'],
  }),
  route('/v1/seasons/2026/constructors', {
    stableIds: ['ferrari', 'mclaren'],
  }),
  route('/v1/constructors/ferrari?season=2026', {
    stableIds: ['ferrari', 'charles-leclerc'],
  }),
  route('/v1/seasons/2026/circuits', {
    stableIds: ['monza', 'spa-francorchamps'],
  }),
  route('/v1/circuits/monza?season=2026', {
    stableIds: ['monza', '2026-italian-grand-prix'],
  }),
  route('/v1/content/manifest', {
    stableIds: ['2026.07.18.1'],
  }),
];

const controlledErrors = [
  { path: '/v1/seasons/2200/calendar', status: 400 },
  { path: '/v1/seasons/2026/grand-prix/0', status: 400 },
  { path: '/v1/drivers/Max%20Verstappen?season=2026', status: 400 },
  { path: '/v1/drivers/unknown-driver?season=2026', status: 404 },
  { path: '/v1/nope', status: 404 },
];

const results = [];

try {
  for (const item of publicRoutes) {
    await checkPublicGet(item);
    await checkPublicHead(item);
  }
  await checkNotModified('/v1/home?season=2026');
  for (const item of controlledErrors) {
    await checkControlledError(item.path, item.status);
  }
  await checkUnsupportedMethod();

  for (const result of results) {
    console.log(`ok ${result}`);
  }
  console.log(`summary: ${results.length} staging smoke checks passed`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function route(path, options = {}) {
  return {
    path,
    snapshot: options.snapshot ?? true,
    stableIds: options.stableIds ?? [],
  };
}

async function checkPublicGet(item) {
  const response = await fetch(url(item.path));
  assertStatus(response, 200, `GET ${item.path}`);
  assert(
    response.headers.get('x-request-id'),
    `GET ${item.path} has X-Request-ID`,
  );
  const text = await response.text();
  const body = parseJson(text, `GET ${item.path}`);
  assertEnvelope(body, response, item.path, item.snapshot);
  assertNoInternalIdentifiers(text, item.path);
  for (const id of item.stableIds) {
    assert(text.includes(id), `GET ${item.path} includes stable id ${id}`);
  }
  if (item.snapshot) {
    assert(
      typeof body.meta.sourceUpdatedAt === 'string',
      `GET ${item.path} exposes sourceUpdatedAt`,
    );
  }
  results.push(`GET ${item.path}`);
}

async function checkPublicHead(item) {
  const get = await fetch(url(item.path));
  const head = await fetch(url(item.path), { method: 'HEAD' });
  assertStatus(head, get.status, `HEAD ${item.path}`);
  assert(
    head.headers.get('x-request-id'),
    `HEAD ${item.path} has X-Request-ID`,
  );
  for (const header of relevantHeaders) {
    const getValue = get.headers.get(header);
    const headValue = head.headers.get(header);
    if (getValue !== null || headValue !== null) {
      assert(headValue === getValue, `HEAD ${item.path} ${header} matches GET`);
    }
  }
  assert((await head.text()) === '', `HEAD ${item.path} has empty body`);
  results.push(`HEAD ${item.path}`);
}

async function checkNotModified(path) {
  const first = await fetch(url(path));
  assertStatus(first, 200, `GET ${path} for ETag`);
  const etag = first.headers.get('etag');
  assert(etag?.startsWith('W/"'), `GET ${path} returns weak ETag`);
  const second = await fetch(url(path));
  assert(
    second.headers.get('etag') === etag,
    `GET ${path} repeats same semantic ETag`,
  );
  const notModified = await fetch(url(path), {
    headers: { 'If-None-Match': etag },
  });
  assertStatus(notModified, 304, `GET ${path} If-None-Match`);
  assert(
    notModified.headers.get('x-request-id'),
    `304 ${path} has X-Request-ID`,
  );
  assert((await notModified.text()) === '', `304 ${path} has empty body`);
  results.push(`ETag/304 ${path}`);
}

async function checkControlledError(path, expectedStatus) {
  const response = await fetch(url(path));
  assertStatus(response, expectedStatus, `GET ${path}`);
  assert(
    response.headers.get('cache-control') === 'no-store',
    `GET ${path} error is not long-lived cached`,
  );
  const text = await response.text();
  const body = parseJson(text, `GET ${path}`);
  assert(body.error, `GET ${path} returns error envelope`);
  assert(
    typeof body.error.requestId === 'string',
    `GET ${path} error has requestId`,
  );
  assertNoInternalIdentifiers(text, path);
  results.push(`controlled error ${path}`);
}

async function checkUnsupportedMethod() {
  const response = await fetch(url('/v1/seasons/2026/calendar'), {
    method: 'POST',
  });
  assertStatus(response, 405, 'POST /v1/seasons/2026/calendar');
  assert(response.headers.get('allow') === 'GET, HEAD', '405 exposes Allow');
  assert(
    response.headers.get('cache-control') === 'no-store',
    '405 is not long-lived cached',
  );
  const body = parseJson(
    await response.text(),
    'POST /v1/seasons/2026/calendar',
  );
  assert(
    body.error?.code === 'METHOD_NOT_ALLOWED',
    '405 error code is controlled',
  );
  results.push('unsupported method');
}

function assertEnvelope(body, response, path, snapshot) {
  assert(body.data !== undefined, `GET ${path} has data envelope`);
  assert(body.meta, `GET ${path} has meta envelope`);
  assert(body.meta.apiVersion === '1', `GET ${path} has apiVersion`);
  assert(
    typeof body.meta.generatedAt === 'string',
    `GET ${path} has generatedAt`,
  );
  assert(
    body.meta.requestId === response.headers.get('x-request-id'),
    `GET ${path} requestId matches X-Request-ID`,
  );
  if (!snapshot) return;
  assert(
    typeof body.meta.contentVersion === 'string',
    `GET ${path} has contentVersion`,
  );
}

function assertNoInternalIdentifiers(text, label) {
  const forbidden = [
    'providerId',
    'providerMapping',
    'mock-development-provider',
    'snapshot:',
    'active:',
    'previous:',
    'GRIDVIEW_DATA',
    'ADMIN_TOKEN',
  ];
  for (const token of forbidden) {
    assert(!text.includes(token), `${label} does not expose ${token}`);
  }
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

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} did not return JSON`);
  }
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
