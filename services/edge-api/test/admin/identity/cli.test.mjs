import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  parseArguments,
  commandFor,
  readProposal,
  run,
} from '../../../scripts/identity/cli.mjs';
import { localConfiguration } from '../../../scripts/identity/client.mjs';
import { validateMutation } from '../../../src/admin/identity/guards.mjs';
const installation = '33333333-3333-4333-8333-333333333333',
  head = '44444444-4444-4444-8444-444444444444',
  revision = '55555555-5555-4555-8555-555555555555';
const hash = 'sha256:' + '1'.repeat(64),
  candidateId = 'sha256:' + '2'.repeat(64);
const envelope = (payload) => ({
  schemaVersion: 1,
  installationId: installation,
  operationId: crypto.randomUUID(),
  expectedActiveRevisionId: head,
  expectedActivationSequence: 1,
  reason: 'Synthetic operator review.',
  payload,
});
let root, file, env, output;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'gridview-u5-cli-'));
  file = join(root, 'review with spaces.json');
  env = {
    GRIDVIEW_IDENTITY_URL: 'http://127.0.0.1:8787',
    GRIDVIEW_IDENTITY_INSTALLATION_ID: installation,
    GRIDVIEW_IDENTITY_TOKEN: randomBytes(32).toString('base64url'),
  };
  output = [];
});
afterEach(async () => {
  if (
    resolve(root).startsWith(resolve(tmpdir()) + sep) &&
    basename(root).startsWith('gridview-u5-cli-')
  )
    await rm(root, { recursive: true, force: true });
});
const response = (data) =>
  Response.json({
    data: { schemaVersion: 1, installationId: installation, ...data },
    requestId: crypto.randomUUID(),
    replayed: false,
  });
function transport(mutationResult = {}) {
  return vi.fn(async (url, init) => {
    const path = new URL(url).pathname;
    if (init.method === 'POST') return response(mutationResult);
    if (path.endsWith('/health'))
      return response({
        installationId: installation,
        activeRevisionId: head,
        activationSequence: 1,
      });
    if (path.includes('/candidates/'))
      return response({
        candidate: {
          candidateId,
          key: {
            season: 2026,
            source: 'jolpica',
            entity: 'driver',
            providerField: 'driverId',
            providerValue: 'synthetic_cli_key',
          },
        },
      });
    return response({
      revision: { snapshot: { drivers: [] } },
      deltaFromParent: {
        seasons: [
          {
            season: 2026,
            previousDatasetVersion: '2026.11.14.1',
            datasetVersion: '2026.11.15.1',
          },
        ],
      },
      validation: { valid: true },
    });
  });
}
describe('U5 PowerShell-friendly explicit file workflow', () => {
  it('parses ordinary PowerShell argument arrays, paths with spaces and explicit commands', () => {
    const args = parseArguments([
      'approve-existing',
      '--file',
      file,
      '--preview',
    ]);
    expect(args.options.file).toBe(file);
    expect(commandFor(args.position, args.options)).toMatchObject({
      operation: 'approve-existing',
      path: '/bindings/approve',
      write: true,
    });
    for (const args of [
      ['status'],
      ['candidates', 'list'],
      ['candidate', 'inspect', candidateId],
      ['evidence', 'list', candidateId],
      ['revisions', 'list'],
      ['revision', 'inspect', revision],
      ['history'],
      ['notifications', 'list'],
      ['operation', 'inspect', revision, '--family', 'activate'],
    ])
      expect(() => {
        const p = parseArguments(args);
        commandFor(p.position, p.options);
      }).not.toThrow();
    for (const args of [
      ['status', '--token', 'secret'],
      ['status', 'extra'],
      ['status', '--file', file],
      ['activate', revision, '--file'],
      ['approve-new', '--file', file, '--file', file],
      ['status', '--yes'],
    ])
      expect(() => {
        const p = parseArguments(args);
        commandFor(p.position, p.options);
      }).toThrow();
  });
  it('validates UTF-8/BOM JSON files without any HTTP or credential requirement', async () => {
    const request = envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    await writeFile(file, '\uFEFF' + JSON.stringify(request));
    const result = await readProposal(file, 'admission');
    expect(result.request).toEqual(request);
    const network = vi.fn();
    await run(
      ['admission', '--file', file, '--check'],
      {},
      { output: (text) => output.push(text), transport: network },
    );
    expect(network).not.toHaveBeenCalled();
    expect(output.join('\n')).toContain('File contract valid');
  });
  it('rejects malformed JSON, oversized inputs, spoofed actor fields and incomplete payloads before HTTP', async () => {
    for (const value of [
      '{',
      'x'.repeat(256 * 1024 + 1),
      JSON.stringify({
        ...envelope({ expectedAdmissionState: 'open', state: 'paused' }),
        principalId: 'spoof',
      }),
      JSON.stringify(envelope({ state: 'paused' })),
    ]) {
      await writeFile(file, value);
      await expect(readProposal(file, 'admission')).rejects.toThrow(
        'Review file',
      );
    }
  });
  it('requires secure origins, environment-only credentials and installation identity', () => {
    expect(localConfiguration(env).installation).toBe(installation);
    for (const url of [
      'http://example.com',
      'https://user:password@example.com',
      'https://example.com/path',
      'https://example.com?token=value',
    ])
      expect(() =>
        localConfiguration({ ...env, GRIDVIEW_IDENTITY_URL: url }),
      ).toThrow();
    expect(() =>
      localConfiguration({ ...env, GRIDVIEW_IDENTITY_TOKEN: undefined }),
    ).toThrow();
  });
  it('previews the exact proposal, evidence and target without hidden evidence fetches or a POST', async () => {
    const request = envelope({
      candidate: {
        candidateId,
        expectedCandidateVersion: 1,
        expectedEvidenceHead: hash,
      },
      targetDriverId: 'synthetic-driver',
      support: {
        evidenceIds: [hash],
        dossierId: hash,
        rationale: 'Explicit synthetic evidence.',
      },
    });
    await writeFile(file, JSON.stringify(request));
    const network = transport();
    await run(['approve-existing', '--file', file, '--preview'], env, {
      transport: network,
      output: (text) => output.push(text),
    });
    expect(
      network.mock.calls.every(
        ([url, init]) =>
          url.startsWith(
            env.GRIDVIEW_IDENTITY_URL + '/internal/admin/identity/',
          ) && init.method === 'GET',
      ),
    ).toBe(true);
    expect(output.join('\n')).toContain('exactProposedChange');
    expect(output.join('\n')).toContain('synthetic-driver');
    expect(await readFile(file, 'utf8')).toBe(JSON.stringify(request));
  });
  it('displays activation dataset consequences and submits only after exact confirmation', async () => {
    const request = envelope({ catalogHash: hash, validationReportHash: hash });
    await writeFile(file, JSON.stringify(request));
    const network = transport({
      operationId: request.operationId,
      activeRevisionId: revision,
    });
    const confirm = vi.fn(
      async () => 'CONFIRM activate ' + request.operationId,
    );
    await run(['activate', revision, '--file', file], env, {
      transport: network,
      confirm,
      output: (text) => output.push(text),
    });
    expect(confirm).toHaveBeenCalledOnce();
    expect(output.join('\n')).toContain('2026.11.15.1');
    expect(output.join('\n')).toContain(
      'Published race results remain unchanged',
    );
    const posts = network.mock.calls.filter(
      ([, init]) => init.method === 'POST',
    );
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0][1].body)).toEqual(request);
    expect(posts[0][1].headers['Idempotency-Key']).toBe(request.operationId);
  });
  it('does not submit on mismatched confirmation or automatically retry uncertain mutations', async () => {
    const request = envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    await writeFile(file, JSON.stringify(request));
    const network = transport();
    await expect(
      run(['admission', '--file', file], env, {
        transport: network,
        confirm: async () => 'yes',
        output: (text) => output.push(text),
      }),
    ).rejects.toThrow('Confirmation');
    expect(network.mock.calls.some(([, init]) => init.method === 'POST')).toBe(
      false,
    );
    const uncertain = vi.fn(async (url, init) => {
      if (init.method === 'POST') throw Error('private network stack');
      return transport()(url, init);
    });
    await expect(
      run(['admission', '--file', file, '--confirm-reviewed-operation'], env, {
        transport: uncertain,
        output: (text) => output.push(text),
      }),
    ).rejects.toThrow('Network response is uncertain');
    expect(
      uncertain.mock.calls.filter(([, init]) => init.method === 'POST'),
    ).toHaveLength(1);
  });
  it('recovers a known operation receipt explicitly without another mutation', async () => {
    const request = envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    await writeFile(file, JSON.stringify(request));
    const network = vi.fn(async () =>
      response({
        state: 'committed',
        requestHash: hash,
        result: { status: 200 },
      }),
    );
    await run(['admission', '--file', file, '--retry-same-operation'], env, {
      transport: network,
      output: (text) => output.push(text),
    });
    expect(network).toHaveBeenCalledOnce();
    expect(network.mock.calls[0][1].method).toBe('GET');
  });
  it('never prints credentials and rejects accidental secret pastes into review rationale', async () => {
    const request = envelope({
      expectedAdmissionState: 'open',
      state: 'paused',
    });
    request.reason = env.GRIDVIEW_IDENTITY_TOKEN;
    await writeFile(file, JSON.stringify(request));
    const network = vi.fn();
    await expect(
      run(['admission', '--file', file, '--preview'], env, {
        transport: network,
        output: (text) => output.push(text),
      }),
    ).rejects.toThrow('credential material');
    expect(output.join()).not.toContain(env.GRIDVIEW_IDENTITY_TOKEN);
    expect(network).not.toHaveBeenCalled();
    const read = vi.fn(async () =>
      response({ sanitized: env.GRIDVIEW_IDENTITY_TOKEN }),
    );
    await run(['status'], env, {
      transport: read,
      output: (text) => output.push(text),
    });
    expect(output.join()).not.toContain(env.GRIDVIEW_IDENTITY_TOKEN);
  });
  it('requires an explicitly reviewed canonical ID and closed profile; it never derives one from a slug', () => {
    const request = envelope({
      candidate: {
        candidateId,
        expectedCandidateVersion: 1,
        expectedEvidenceHead: hash,
      },
      profile: {},
      support: { evidenceIds: [hash], dossierId: hash, rationale: 'Synthetic' },
      duplicateReview: {},
    });
    expect(() => validateMutation(request, 'approve-new')).toThrow();
  });
});
