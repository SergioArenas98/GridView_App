import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../../src/index';
import { IdentityCatalog } from '../../../src/identity/durable-object';
import { IdentityClient } from '../../../src/identity/client';
import { sqliteHost } from './sqlite-support';
import { createHarness } from '../../support/edge-harness';
const request = (path: string, init: RequestInit = {}) =>
  new Request('https://api.gridview.test' + path, init);
import {
  context,
  driverInput,
  driversEnvelope,
  forbidNetwork,
} from '../discovery/support';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
const installation = '33333333-3333-4333-8333-333333333333';
beforeEach(forbidNetwork);
afterEach(() => vi.unstubAllGlobals());
describe('authenticated read-only shadow inspection', () => {
  it('keeps candidate data private and refuses shared-token acknowledgement or activation', async () => {
    const h = sqliteHost();
    const object = new IdentityCatalog(
      { storage: h.storage },
      { IDENTITY_INSTALLATION_ID: installation },
    );
    const names: string[] = [];
    const namespace = {
      idFromName: (name: string) => {
        names.push(name);
        return name;
      },
      get: () => ({
        fetch: (url: string, init: RequestInit) =>
          object.fetch(new Request(url, init)),
      }),
    };
    const client = new IdentityClient(namespace, installation);
    const body = driversEnvelope([
      { driverId: 'synthetic_private', givenName: 'Private Synthetic' },
    ]);
    const observations = (
      await extractJolpicaObservations(
        driverInput(body),
        body,
        context,
        providerMappingRegistry(),
      )
    ).observations;
    await client.observe({ observations });
    const harness = createHarness();
    Object.assign(harness.env, {
      IDENTITY_ADMIN_MODE: 'read-only',
      IDENTITY_INSTALLATION_ID: installation,
      IDENTITY_CATALOG: namespace,
      ADMIN_TOKEN: 'local-only',
    });
    const url = '/internal/admin/identity/candidates';
    expect((await worker.fetch(request(url), harness.env)).status).toBe(401);
    const auth = { Authorization: 'Bearer local-only' };
    const response = await worker.fetch(
      request(url, { headers: auth }),
      harness.env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const list = (await response.json()) as {
      data: { items: { candidateId: string }[] };
    };
    const id = list.data.items[0]!.candidateId;
    for (const suffix of ['', '/evidence', '/observations']) {
      await client.inspect({
        candidateId: id as `sha256:${string}`,
        section:
          suffix === ''
            ? 'candidate'
            : suffix === '/evidence'
              ? 'evidence'
              : 'observations',
        cursor: null,
        limit: 16,
      });
      const detail = await worker.fetch(
        request(url + '/' + id + suffix, { headers: auth }),
        harness.env,
      );
      expect(detail.status).toBe(200);
    }
    for (const suffix of ['/acknowledge', '/approve', '/activate']) {
      expect(
        (
          await worker.fetch(
            request(url + '/' + id + suffix, {
              method: 'POST',
              headers: auth,
              body: '{}',
            }),
            harness.env,
          )
        ).status,
      ).toBe(405);
    }
    expect(
      (
        await worker.fetch(
          request('/internal/admin/identity/health', { headers: auth }),
          harness.env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await worker.fetch(
          request(url + '?limit=101', { headers: auth }),
          harness.env,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await worker.fetch(
          request(url + '?unread=true&unread=false', { headers: auth }),
          harness.env,
        )
      ).status,
    ).toBe(400);
    expect(names.every((name) => name === 'identity:' + installation)).toBe(
      true,
    );
    expect(fetch).not.toHaveBeenCalled();
    h.db.close();
  });
  it('rejects cross-installation requests and malformed internal commands', async () => {
    const h = sqliteHost();
    const object = new IdentityCatalog(
      { storage: h.storage },
      { IDENTITY_INSTALLATION_ID: installation },
    );
    for (const payload of [
      {
        schemaVersion: 1,
        installationId: '44444444-4444-4444-8444-444444444444',
        command: 'health',
        payload: {},
      },
      {
        schemaVersion: 1,
        installationId: installation,
        command: 'health',
        payload: {},
        extra: true,
      },
    ]) {
      expect(
        (
          await object.fetch(
            new Request('http://local', {
              method: 'POST',
              body: JSON.stringify(payload),
            }),
          )
        ).status,
      ).toBe(400);
    }
    h.db.close();
  });
});
