import { describe, expect, it, vi } from 'vitest';

import {
  allowedOrigins,
  readActiveVersion,
  submitIngest,
} from '../../scripts/auto-update/submit.mjs';

const origin = allowedOrigins[0]!;
const token = 'T'.repeat(40);
const json = (value: unknown, status: number) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function recording(answer: () => Response | Error) {
  const calls: { url: string; init: RequestInit }[] = [];
  const transport = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const value = answer();
    if (value instanceof Error) throw value;
    return value;
  });
  return { transport, calls };
}

/** A response whose headers arrive and whose body stream then fails. */
const broken = (status: number) =>
  new Response(
    new ReadableStream({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('{"data":'));
        controller.error(new Error('connection reset'));
      },
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );

describe('a body that fails after the headers (Codex P2 on #107)', () => {
  it('makes the ingest answer ambiguous, never an exception', async () => {
    const { transport } = recording(() => broken(200));
    expect(
      await submitIngest({ transport, origin, token, bodyText: '{}' }),
    ).toEqual({
      outcome: 'ambiguous',
      reason: 'answer-unreadable',
      status: 200,
    });
  });

  it('makes the cutover read a failure, never an exception', async () => {
    const { transport } = recording(() => broken(200));
    expect(
      await readActiveVersion({ transport, origin, token, season: 2026 }),
    ).toEqual({
      ok: false,
      failure: 'network-or-timeout',
    });
  });
});

describe('the credentialed calls', () => {
  it('send nothing to an origin that is not allow-listed, or with an unusable token', async () => {
    const { transport } = recording(() => json({}, 200));
    expect(
      await submitIngest({
        transport,
        origin: 'https://gridview-api-production.sejuma18.workers.dev',
        token,
        bodyText: '{}',
      }),
    ).toEqual({ outcome: 'refused-locally', reason: 'origin-not-allowed' });
    expect(
      await submitIngest({
        transport,
        origin,
        token: undefined,
        bodyText: '{}',
      }),
    ).toEqual({ outcome: 'refused-locally', reason: 'token-unusable' });
    expect(
      await submitIngest({ transport, origin, token: 'short', bodyText: '{}' }),
    ).toEqual({ outcome: 'refused-locally', reason: 'token-unusable' });
    expect(
      await readActiveVersion({
        transport,
        origin: 'http://localhost:8787',
        token,
        season: 2026,
      }),
    ).toEqual({ ok: false, failure: 'origin-not-allowed' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('POSTs once, with the bearer token only in the Authorization header, no redirects', async () => {
    const { transport, calls } = recording(() =>
      json(
        {
          data: {
            outcome: 'publication',
            publication: {
              status: 'applied',
              version: 'pm1-000000000001e-0badc0de',
            },
          },
        },
        200,
      ),
    );
    const result = await submitIngest({
      transport,
      origin,
      token,
      bodyText: '{"kind":"x"}',
    });
    expect(result).toEqual({
      outcome: 'applied',
      version: 'pm1-000000000001e-0badc0de',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${origin}/internal/admin/season/ingest`);
    expect(calls[0]!.init).toMatchObject({
      method: 'POST',
      redirect: 'manual',
      body: '{"kind":"x"}',
    });
    expect(
      (calls[0]!.init.headers as Record<string, string>).Authorization,
    ).toBe(`Bearer ${token}`);
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it.each([
    [
      'a closed refusal',
      () =>
        json(
          {
            data: {
              outcome: 'refused',
              stage: 'admission',
              reason: 'provider-mode-coordinated',
            },
          },
          409,
        ),
      {
        outcome: 'refused',
        status: 409,
        stage: 'admission',
        reason: 'provider-mode-coordinated',
      },
    ],
    [
      'a stale CAS',
      () =>
        json(
          {
            data: { outcome: 'publication', publication: { status: 'stale' } },
          },
          409,
        ),
      { outcome: 'refused', status: 409, publication: 'stale' },
    ],
    [
      'a server error',
      () => json({}, 503),
      { outcome: 'ambiguous', reason: 'server-error', status: 503 },
    ],
    [
      'a lost answer',
      () => new Error('timeout'),
      { outcome: 'ambiguous', reason: 'network-or-timeout' },
    ],
    [
      'an unreadable 200',
      () => new Response('<html>', { status: 200 }),
      { outcome: 'ambiguous', reason: 'answer-unreadable', status: 200 },
    ],
  ])(
    'reports %s without retrying and without the token',
    async (_name, answer, expected) => {
      const { transport } = recording(answer);
      const result = await submitIngest({
        transport,
        origin,
        token,
        bodyText: '{}',
      });
      expect(result).toMatchObject(expected);
      expect(transport).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain(token);
    },
  );

  it('reads the active version only from an open, authoritative season', async () => {
    const status = (data: Record<string, unknown>) =>
      recording(() => json({ data }, 200)).transport;
    const open = {
      state: 'active',
      authoritative: true,
      admissionClosed: false,
      activeVersion: 'pm1-000000000001d-aed72435',
    };
    expect(
      await readActiveVersion({
        transport: status(open),
        origin,
        token,
        season: 2026,
      }),
    ).toEqual({ ok: true, activeVersion: 'pm1-000000000001d-aed72435' });
    expect(
      await readActiveVersion({
        transport: status({ ...open, admissionClosed: true }),
        origin,
        token,
        season: 2026,
      }),
    ).toEqual({ ok: false, failure: 'season-not-open' });
    expect(
      await readActiveVersion({
        transport: status({ ...open, activeVersion: 'not a version!' }),
        origin,
        token,
        season: 2026,
      }),
    ).toEqual({ ok: false, failure: 'version-malformed' });
  });
});
