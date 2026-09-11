/**
 * The Durable Object seam: the class, its command surface, and the client a
 * future caller would hold (ADR 0025 D1).
 *
 * The whole seam is exercised without any provisioned resource: a fake
 * namespace dispatches to a real object instance over an in-memory,
 * transactional storage host with the same `transactionSync`/`kv` shape
 * SQLite-backed Durable Object storage exposes.
 *
 * Nothing here proves Cloudflare platform behaviour - not the input gate, not
 * hibernation, not the shutdown guarantee. Those are documented platform
 * properties this repository's test suite cannot force or verify.
 */

import { describe, expect, it } from 'vitest';

import {
  DurableObjectSeasonPublicationSequencer,
  LocalSeasonPublicationSequencer,
  MemorySequencerHost,
  SeasonPublicationCoordinator,
  SeasonPublicationSequencer,
  sequencerCommands,
  sequencerRequestUrl,
  type SequencerDurableHost,
  type SequencerNamespace,
} from '../../../src/publication/sequencer';
import {
  FINGERPRINT,
  OTHER_SEASON,
  SEASON,
  SEED_ACTIVE_VERSION,
  commitment,
  counterSource,
  hexCounterSource,
  prepareRequest,
  seedFor,
} from './support';

const MANIFEST = commitment('manifest-1');

/**
 * The SQLite-backed storage shape the object adapts, over an in-memory map.
 *
 * `transactionSync` applies its callback's writes atomically and discards them
 * all if the callback throws, which is the contract the real API documents.
 */
function durableHost(): SequencerDurableHost & { keys(): string[] } {
  let committed = new Map<string, unknown>();
  let working: Map<string, unknown> | null = null;
  const current = () => working ?? committed;
  return {
    keys: () => [...committed.keys()].sort(),
    storage: {
      transactionSync<T>(closure: () => T): T {
        working = new Map(committed);
        try {
          const result = closure();
          committed = working;
          return result;
        } finally {
          working = null;
        }
      },
      kv: {
        get: <T>(key: string) => current().get(key) as T | undefined,
        put: <T>(key: string, value: T) => {
          current().set(key, structuredClone(value));
        },
        delete: (key: string) => current().delete(key),
        list: <T>({ prefix = '' }: { prefix?: string } = {}) =>
          [...current().entries()].filter(([key]) =>
            key.startsWith(prefix),
          ) as [string, T][],
      },
    },
  };
}

function objectFor(host: SequencerDurableHost): SeasonPublicationSequencer {
  return new SeasonPublicationSequencer(host, {
    token: counterSource('token-'),
    opaqueVersionComponent: hexCounterSource(),
  });
}

/**
 * A namespace that routes by name to one object per season.
 *
 * The stub adapts `(url, init)` into a `Request` exactly as the real
 * `DurableObjectStub.fetch` does before the class's own `fetch` sees it.
 */
function fakeNamespace(): SequencerNamespace & {
  hosts: Map<string, ReturnType<typeof durableHost>>;
} {
  const hosts = new Map<string, ReturnType<typeof durableHost>>();
  const objects = new Map<string, SeasonPublicationSequencer>();
  return {
    hosts,
    idFromName: (name: string) => name,
    get: (id: unknown) => {
      const name = String(id);
      if (!objects.has(name)) {
        const host = durableHost();
        hosts.set(name, host);
        objects.set(name, objectFor(host));
      }
      const object = objects.get(name)!;
      return {
        fetch: (url: string, init: RequestInit) =>
          object.fetch(new Request(url, init)),
      };
    },
  };
}

describe('SeasonPublicationSequencer durable object', () => {
  it('answers the full command surface over its own SQLite-backed storage', async () => {
    const host = durableHost();
    const object = objectFor(host);
    const call = async (command: string, payload: unknown) =>
      (
        await object.fetch(
          new Request(sequencerRequestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, payload }),
          }),
        )
      ).json();

    expect(await call('seed-cutover', seedFor())).toEqual({
      outcome: 'seeded',
    });
    expect(
      await call('activate-cutover', {
        season: SEASON,
        cutoverFingerprint: FINGERPRINT,
      }),
    ).toEqual({ outcome: 'activated' });
    const prepared = (await call('prepare', prepareRequest())) as {
      outcome: string;
      operationEpoch: number;
      operationToken: string;
    };
    expect(prepared.outcome).toBe('prepared');
    expect(
      await call('finalize', {
        season: SEASON,
        operationEpoch: prepared.operationEpoch,
        operationToken: prepared.operationToken,
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toMatchObject({ outcome: 'committed' });
    expect(await call('read-authority', { season: SEASON })).toMatchObject({
      cutoverState: 'active',
      authoritative: true,
      previousVersion: SEED_ACTIVE_VERSION,
    });
    // Bounded per-key rows, not one serialized blob.
    expect(host.keys()).toEqual([
      'authority',
      'committed/calendar',
      'committed/standings:drivers',
      'operation',
    ]);
  });

  it('rejects a non-POST request, malformed JSON and an unknown command', async () => {
    const object = objectFor(durableHost());
    expect((await object.fetch(new Request(sequencerRequestUrl))).status).toBe(
      405,
    );
    expect(
      (
        await object.fetch(
          new Request(sequencerRequestUrl, { method: 'POST', body: 'nope' }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await object.fetch(
          new Request(sequencerRequestUrl, {
            method: 'POST',
            body: JSON.stringify({ command: 'drop-everything' }),
          }),
        )
      ).status,
    ).toBe(400);
  });

  it('keeps its command surface closed', () => {
    expect([...sequencerCommands]).toEqual([
      'read-authority',
      'prepare',
      'finalize',
      'cancel',
      'authorize-cleanup',
      'acknowledge-cleanup',
      'seed-cutover',
      'recover-cutover-seed',
      'activate-cutover',
    ]);
  });
});

describe('the sequencer client', () => {
  it('routes each season to its own object, and they never share authority', async () => {
    const namespace = fakeNamespace();
    const client = new DurableObjectSeasonPublicationSequencer(namespace);

    await client.seedCutover(seedFor());
    await client.activateCutover({
      season: SEASON,
      cutoverFingerprint: FINGERPRINT,
    });
    // The other season is untouched by the first season's cutover.
    expect(await client.readAuthority(OTHER_SEASON)).toEqual({
      cutoverState: 'uninitialized',
      authoritative: false,
    });
    expect(await client.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'active',
      authoritative: true,
    });
    expect([...namespace.hosts.keys()].sort()).toEqual(['2025', '2026']);
  });

  it('drives a whole operation through the port', async () => {
    const namespace = fakeNamespace();
    const client = new DurableObjectSeasonPublicationSequencer(namespace);
    await client.seedCutover(seedFor());
    await client.activateCutover({
      season: SEASON,
      cutoverFingerprint: FINGERPRINT,
    });
    const prepared = await client.prepare(prepareRequest());
    if (prepared.outcome !== 'prepared') throw new Error('expected prepared');
    expect(
      await client.finalize({
        season: SEASON,
        operationEpoch: prepared.operationEpoch,
        operationToken: prepared.operationToken,
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toMatchObject({ outcome: 'committed' });
  });

  it('fails closed on an unreachable object, never as a decision', async () => {
    const unreachable: SequencerNamespace = {
      idFromName: (name) => name,
      get: () => ({
        fetch: async () => {
          throw new Error('binding unavailable');
        },
      }),
    };
    const client = new DurableObjectSeasonPublicationSequencer(unreachable);
    expect(await client.readAuthority(SEASON)).toEqual({
      cutoverState: 'unavailable',
      authoritative: false,
    });
    expect(await client.prepare(prepareRequest())).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
    expect(
      await client.finalize({
        season: SEASON,
        operationEpoch: 1,
        operationToken: 'token-1',
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'state-corrupt' });
    expect(
      await client.authorizeCleanup({
        season: SEASON,
        operationEpoch: 1,
        operationToken: 'token-1',
        candidateVersion: 'pm1-0000000000001-00000001',
      }),
    ).toEqual({ outcome: 'refused', reason: 'state-corrupt' });
    expect(
      await client.activateCutover({
        season: SEASON,
        cutoverFingerprint: FINGERPRINT,
      }),
    ).toEqual({ outcome: 'rejected', reason: 'state-corrupt' });
  });

  it('refuses a version-skewed or partial response rather than believing it', async () => {
    const skewed: SequencerNamespace = {
      idFromName: (name) => name,
      get: () => ({
        fetch: async () =>
          new Response(JSON.stringify({ outcome: 'definitely-committed' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      }),
    };
    const client = new DurableObjectSeasonPublicationSequencer(skewed);
    expect(
      await client.finalize({
        season: SEASON,
        operationEpoch: 1,
        operationToken: 'token-1',
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'state-corrupt' });
  });

  it('satisfies the same port in-process', async () => {
    const host = new MemorySequencerHost();
    const port = new LocalSeasonPublicationSequencer(
      new SeasonPublicationCoordinator(host, {
        token: counterSource('token-'),
        opaqueVersionComponent: hexCounterSource(),
      }),
    );
    await port.seedCutover(seedFor());
    await port.activateCutover({
      season: SEASON,
      cutoverFingerprint: FINGERPRINT,
    });
    const prepared = await port.prepare(prepareRequest());
    if (prepared.outcome !== 'prepared') throw new Error('expected prepared');
    expect(
      await port.cancel({
        season: SEASON,
        operationEpoch: prepared.operationEpoch,
        operationToken: prepared.operationToken,
      }),
    ).toMatchObject({ outcome: 'cancelled' });
    expect(await port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'active',
    });
  });
});
