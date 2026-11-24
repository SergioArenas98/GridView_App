// U11 G5 recovery wiring through the real Worker router and the real three
// Durable Object classes, in isolated local Miniflare. Cloudflare PITR is not
// available locally: workerd answers getCurrentBookmark() with an all-zero
// bookmark and keeps no durable log, so real restore behaviour is drilled on
// an isolated Cloudflare Worker. Here: routing, object addressing and guards. Every outbound request is refused by the harness.
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertNoExternalNetwork,
  guardNetwork,
  localInstallation,
} from './support.mjs';

const hosts = [];
afterEach(async () => {
  for (const h of hosts.splice(0)) await h.stop();
});
const stores = [
  { store: 'identity-catalog' },
  { store: 'reconciliation-ledger' },
  { store: 'publication-sequencer', season: 2026 },
];
const B = '0000007b-0000b26e-00001538-0c3e87bb37b3db5cc52eedb93cd3b96b';

async function recovery(h, body, token = h.operatorToken) {
  const r = await h.fetch('/internal/admin/recovery', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

describe('U11 operator recovery route, end to end (local)', () => {
  it('reaches each store object and reads a well-formed bookmark', async () => {
    guardNetwork();
    const h = await localInstallation(0);
    hosts.push(h);
    for (const s of stores) {
      const r = await recovery(h, { ...s, command: 'bookmark' });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.result.bookmark).toMatch(/^[A-Za-z0-9-]{8,256}$/);
    }
    assertNoExternalNetwork();
  }, 60000);

  it('requires the operator token and refuses restore without RECOVERY_RESTORE', async () => {
    guardNetwork();
    const h = await localInstallation(0);
    hosts.push(h);
    const wrong = await recovery(
      h,
      { ...stores[1], command: 'bookmark' },
      'A'.repeat(43),
    );
    expect(wrong.status).toBe(401);
    for (const command of [
      { command: 'schedule-restore', bookmark: B, expectedCurrentBookmark: B },
      { command: 'restart' },
    ]) {
      const r = await recovery(h, { ...stores[1], ...command });
      expect(r.status).toBe(403);
      expect(r.body.error).toBe('recovery-restore-disabled');
    }
  }, 60000);

  it('forwards restore commands when enabled, where the object refuses a stale expected bookmark', async () => {
    guardNetwork();
    const h = await localInstallation(0, {
      bindings: { RECOVERY_RESTORE: 'enabled' },
    });
    hosts.push(h);
    const current = (await recovery(h, { ...stores[0], command: 'bookmark' }))
      .body.result.bookmark;
    expect(current).not.toBe(B);
    const r = await recovery(h, {
      ...stores[0],
      command: 'schedule-restore',
      bookmark: B,
      expectedCurrentBookmark: B,
    });
    expect(r.status).toBe(409);
    expect(r.body.result.error).toBe('bookmark-moved');
    // The head moves as the object writes, so only its shape is asserted.
    expect(r.body.result.current).toMatch(/^[A-Za-z0-9-]{8,256}$/);
    assertNoExternalNetwork();
  }, 60000);
});
