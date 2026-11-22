import { describe, expect, it, vi } from 'vitest';
import {
  decodeRecoveryRequest,
  handleRecoveryCommand,
  type RecoveryHost,
} from '../../src/recovery/pitr';
import { handleRecoveryRequest } from '../../src/admin/recovery-route';
import type { Env } from '../../src/config/environment';

const B0 = '0000007b-0000b26e-00001538-0c3e87bb37b3db5cc52eedb93cd3b96b';
const B1 = '0000007b-0000b26f-00001539-1d4f98cc48c4ec6dd63fefc04de4ca7c';
const now = Date.parse('2026-11-22T16:00:00.000Z');

function host(current = B1) {
  const calls: string[] = [];
  const h: RecoveryHost = {
    storage: {
      getCurrentBookmark: vi.fn(async () => current),
      getBookmarkForTime: vi.fn(async () => B0),
      onNextSessionRestoreBookmark: vi.fn(async (b: string) => {
        calls.push('restore:' + b);
        return 'undo-' + B1;
      }),
    },
    abort: vi.fn(() => {
      calls.push('abort');
    }),
  };
  return { h, calls };
}
const post = (body: unknown) =>
  new Request('https://recovery.internal/__gridview/recovery', {
    method: 'POST',
    body: JSON.stringify(body),
  });
const json = async (r: Response) => ({
  status: r.status,
  body: await r.json(),
});

describe('PITR command handler', () => {
  it('reads the current bookmark without scheduling anything', async () => {
    const { h, calls } = host();
    expect(
      await json(await handleRecoveryCommand(post({ command: 'bookmark' }), h)),
    ).toEqual({
      status: 200,
      body: { bookmark: B1 },
    });
    expect(calls).toEqual([]);
  });

  it('reads a bookmark for a time inside the 30-day retention only', async () => {
    const { h } = host();
    const inside = await handleRecoveryCommand(
      post({ command: 'bookmark-for-time', at: '2026-11-20T00:00:00.000Z' }),
      h,
      () => now,
    );
    expect(inside.status).toBe(200);
    for (const at of ['2026-10-01T00:00:00.000Z', '2026-11-23T00:00:00.000Z'])
      expect(
        (
          await handleRecoveryCommand(
            post({ command: 'bookmark-for-time', at }),
            h,
            () => now,
          )
        ).status,
      ).toBe(400);
  });

  it('schedules a restore only against the exact current bookmark and returns the undo bookmark', async () => {
    const { h, calls } = host(B1);
    const moved = await json(
      await handleRecoveryCommand(
        post({
          command: 'schedule-restore',
          bookmark: B0,
          expectedCurrentBookmark: B0,
        }),
        h,
      ),
    );
    expect(moved).toEqual({
      status: 409,
      body: { error: 'bookmark-moved', current: B1 },
    });
    expect(calls).toEqual([]);
    const ok = await json(
      await handleRecoveryCommand(
        post({
          command: 'schedule-restore',
          bookmark: B0,
          expectedCurrentBookmark: B1,
        }),
        h,
      ),
    );
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      scheduled: B0,
      scheduledFrom: B1,
      undoBookmark: 'undo-' + B1,
    });
    expect(calls).toEqual(['restore:' + B0]);
  });

  it('restarts only on an explicit restart command', async () => {
    const { h, calls } = host();
    expect(
      (await handleRecoveryCommand(post({ command: 'restart' }), h)).status,
    ).toBe(200);
    expect(calls).toEqual(['abort']);
  });

  it('answers pitr-unsupported where the platform offers no PITR (local development)', async () => {
    const bare: RecoveryHost = { storage: {} };
    for (const body of [
      { command: 'bookmark' },
      {
        command: 'schedule-restore',
        bookmark: B0,
        expectedCurrentBookmark: B1,
      },
      { command: 'restart' },
    ])
      expect((await handleRecoveryCommand(post(body), bare)).status).toBe(501);
  });

  it('refuses unknown commands, extra fields and malformed bookmarks', () => {
    expect(decodeRecoveryRequest({ command: 'delete' })).toBeNull();
    expect(decodeRecoveryRequest({ command: 'bookmark', extra: 1 })).toBeNull();
    expect(
      decodeRecoveryRequest({
        command: 'schedule-restore',
        bookmark: 'x y',
        expectedCurrentBookmark: B1,
      }),
    ).toBeNull();
    expect(
      decodeRecoveryRequest({ command: 'bookmark-for-time', at: '2026-11-20' }),
    ).toBeNull();
  });

  it('never leaks a storage error', async () => {
    const h: RecoveryHost = {
      storage: {
        getCurrentBookmark: async () => {
          throw new Error('secret storage key /x');
        },
      },
    };
    expect(
      await json(await handleRecoveryCommand(post({ command: 'bookmark' }), h)),
    ).toEqual({
      status: 500,
      body: { error: 'recovery-unavailable' },
    });
  });
});

describe('operator recovery route', () => {
  function namespace() {
    const seen: { name: string; body: unknown }[] = [];
    let lastName = '';
    return {
      seen,
      idFromName(name: string) {
        lastName = name;
        return name;
      },
      get() {
        const name = lastName;
        return {
          async fetch(_url: string, init: RequestInit) {
            seen.push({ name, body: JSON.parse(String(init.body)) });
            return new Response(JSON.stringify({ bookmark: B1 }), {
              status: 200,
            });
          },
        };
      },
    };
  }
  const env = (extra: Partial<Env> = {}) => {
    const catalog = namespace(),
      ledger = namespace(),
      sequencer = namespace();
    return {
      catalog,
      ledger,
      sequencer,
      env: {
        IDENTITY_CATALOG: catalog,
        IDENTITY_INSTALLATION_ID: 'c45d60b8-a723-4b6e-8530-750592af2b94',
        RECONCILIATION_LEDGER: ledger,
        SEASON_PUBLICATION_SEQUENCER: sequencer,
        ...extra,
      } as unknown as Env,
    };
  };
  const call = (e: Env, body: unknown) =>
    handleRecoveryRequest(
      new Request('https://x/internal/admin/recovery', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      e,
      'req-1',
    );

  it('addresses exactly the runtime object of each store', async () => {
    const t = env();
    await call(t.env, { store: 'identity-catalog', command: 'bookmark' });
    await call(t.env, { store: 'reconciliation-ledger', command: 'bookmark' });
    await call(t.env, {
      store: 'publication-sequencer',
      season: 2026,
      command: 'bookmark',
    });
    expect(t.catalog.seen[0].name).toBe(
      'identity:c45d60b8-a723-4b6e-8530-750592af2b94',
    );
    expect(t.ledger.seen[0].name).toBe('reconciliation');
    expect(t.sequencer.seen[0].name).toBe('2026');
    expect(t.catalog.seen[0].body).toEqual({ command: 'bookmark' });
  });

  it('refuses restore and restart unless RECOVERY_RESTORE is enabled', async () => {
    const off = env();
    for (const body of [
      {
        store: 'reconciliation-ledger',
        command: 'schedule-restore',
        bookmark: B0,
        expectedCurrentBookmark: B1,
      },
      { store: 'reconciliation-ledger', command: 'restart' },
    ]) {
      const r = await call(off.env, body);
      expect(r.status).toBe(403);
      expect(await r.json()).toMatchObject({
        error: 'recovery-restore-disabled',
      });
    }
    expect(off.ledger.seen).toEqual([]);
    const on = env({ RECOVERY_RESTORE: 'enabled' } as Partial<Env>);
    expect(
      (
        await call(on.env, {
          store: 'reconciliation-ledger',
          command: 'schedule-restore',
          bookmark: B0,
          expectedCurrentBookmark: B1,
        })
      ).status,
    ).toBe(200);
  });

  it('refuses unknown stores, missing or stray seasons and unbound stores', async () => {
    const t = env();
    expect(
      (await call(t.env, { store: 'kv', command: 'bookmark' })).status,
    ).toBe(400);
    expect(
      (
        await call(t.env, {
          store: 'publication-sequencer',
          command: 'bookmark',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call(t.env, {
          store: 'reconciliation-ledger',
          season: 2026,
          command: 'bookmark',
        })
      ).status,
    ).toBe(400);
    const unbound = {
      IDENTITY_INSTALLATION_ID: 'c45d60b8-a723-4b6e-8530-750592af2b94',
    } as unknown as Env;
    expect(
      (await call(unbound, { store: 'identity-catalog', command: 'bookmark' }))
        .status,
    ).toBe(503);
  });
});
