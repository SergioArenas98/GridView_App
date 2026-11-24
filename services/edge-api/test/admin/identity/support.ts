import { createHash, randomBytes } from 'node:crypto';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { sha256Hex, utf8 } from '../../../src/ingest/canonical-json';
import type { CatalogPrincipal } from '../../../src/identity/catalog/review';
import type { Env } from '../../../src/config/environment';
import { IdentityCatalog } from '../../../src/identity/durable-object';
import { sqliteHost } from '../../identity/catalog/sqlite-support';
import { createHarness } from '../../support/edge-harness';
import worker from '../../../src/index';
import {
  candidate,
  setup,
  installation,
} from '../../identity/catalog/u4-support';
export { installation };
export function credential(
  roles: CatalogPrincipal['roles'] = ['reader', 'reviewer', 'activator'],
  principalId = 'synthetic-owner',
  credentialId = crypto.randomUUID(),
) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    entry: {
      principalId,
      credentialId,
      tokenSha256: createHash('sha256').update(token).digest('hex'),
      roles,
      disabled: false,
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
  };
}
/** Existing validators and full source closure, but every canonical driver and
 * profile used by U5 approval tests is explicitly synthetic. No content write. */
export async function syntheticSeed() {
  const sources = loadCorpus();
  const registry = JSON.parse(
    sources.find((s) => s.path.includes('registries/drivers.'))!.text,
  ) as {
    drivers: {
      id: string;
      fullName: string;
      givenName?: string;
      familyName?: string;
    }[];
  };
  const replacements = new Map<string, string>();
  registry.drivers.forEach((d, i) => {
    replacements.set(d.id, 'synthetic-driver-' + (i + 1));
    replacements.set('2026-' + d.id, '2026-synthetic-driver-' + (i + 1));
    replacements.set(d.fullName, 'Synthetic Driver ' + (i + 1));
  });
  const replace = (v: unknown): unknown =>
    typeof v === 'string'
      ? (replacements.get(v) ?? v)
      : Array.isArray(v)
        ? v.map(replace)
        : v && typeof v === 'object'
          ? Object.fromEntries(
              Object.entries(v).map(([k, x]) => [k, replace(x)]),
            )
          : v;
  for (const s of sources) {
    const doc = replace(JSON.parse(s.text)) as {
      kind: string;
      entries?: {
        id: string;
        season: number;
        driverId: string;
        startRound: number | null;
      }[];
    };
    if (doc.kind === 'driver-registry')
      for (const [i, d] of (
        doc as unknown as { drivers: Record<string, unknown>[] }
      ).drivers.entries())
        Object.assign(d, {
          fullName: 'Synthetic Driver ' + (i + 1),
          givenName: 'Synthetic',
          familyName: 'Fixture ' + (i + 1),
          shortCode: null,
          nationality: null,
          countryCode: null,
          dateOfBirth: null,
          placeOfBirth: null,
          biography: null,
        });
    if (doc.kind === 'driver-season-entries')
      for (const e of doc.entries!)
        e.id =
          e.season +
          '-' +
          e.driverId +
          (e.startRound === null ? '' : '-' + e.startRound);
    s.text = JSON.stringify(doc);
    s.fileHash = `sha256:${await sha256Hex(utf8(s.text))}`;
    s.exactCommit = null;
  }
  return prepareSeed(sources);
}
export async function harness(seed: Awaited<ReturnType<typeof syntheticSeed>>) {
  const host = sqliteHost(),
    f = await setup(host.storage, seed);
  const owner = credential(),
    reader = credential(['reader'], 'synthetic-reader'),
    reviewer = credential(['reader', 'reviewer'], 'synthetic-reviewer'),
    activator = credential(['reader', 'activator'], 'synthetic-activator');
  const config: Env = {
    IDENTITY_ADMIN_MODE: 'review',
    IDENTITY_INSTALLATION_ID: installation,
    IDENTITY_REVIEWER_CREDENTIALS: JSON.stringify([
      owner.entry,
      reader.entry,
      reviewer.entry,
      activator.entry,
    ]),
  };
  const object = new IdentityCatalog({ storage: host.storage }, config, true);
  const pending = new Set<Promise<Response>>();
  const namespace = {
    idFromName: (name: string) => name,
    get: () => ({
      async fetch(url: string, init: RequestInit) {
        const response = object.fetch(new Request(url, init));
        pending.add(response);
        try {
          return await response;
        } finally {
          pending.delete(response);
        }
      },
    }),
  };
  const edge = createHarness();
  Object.assign(edge.env, config, { IDENTITY_CATALOG: namespace });
  const call = async (
    path: string,
    body?: unknown,
    token = owner.token,
    extra: Record<string, string> = {},
  ) =>
    worker.fetch(
      new Request('https://api.gridview.test/internal/admin/identity' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          ...(body === undefined
            ? {}
            : {
                'Content-Type': 'application/json',
                'Idempotency-Key':
                  (body as { operationId?: string }).operationId ?? '',
              }),
          ...extra,
        },
        ...(body === undefined
          ? {}
          : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
      }),
      edge.env,
    );
  const envelope = <T>(payload: T) => ({
    schemaVersion: 1,
    installationId: installation,
    operationId: crypto.randomUUID(),
    expectedActiveRevisionId: f.workflow.head().activeRevisionId,
    expectedActivationSequence: f.workflow.head().activationSequence,
    reason: 'Explicit synthetic local U5 mechanism review.',
    payload,
  });
  const addCandidate = async (name = 'synthetic_u5_candidate') =>
    candidate(f.store, name);
  return {
    ...f,
    host,
    async dispose() {
      // A namespace timeout does not cancel a mutation. Drain it before closing
      // the real SQLite connection, including when an assertion has failed.
      await Promise.allSettled([...pending]);
      host.db.close();
    },
    config,
    object,
    namespace,
    edge,
    owner,
    reader,
    reviewer,
    activator,
    call,
    envelope,
    addCandidate,
  };
}
