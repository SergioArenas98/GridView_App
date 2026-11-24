import { describe, it, expect } from 'vitest';
import {
  authenticate,
  credentials,
  configured,
  authenticatedAuthority,
} from '../../../src/admin/identity/auth';
import { credential, installation } from './support';
const request = (token: string) =>
  new Request('https://local.test', {
    headers: { Authorization: 'Bearer ' + token },
  });
describe('U5 individual credential contract', () => {
  it('derives actor, credential and roles exclusively from valid server configuration', async () => {
    const c = credential(['reader', 'reviewer', 'activator']);
    const env = { IDENTITY_REVIEWER_CREDENTIALS: JSON.stringify([c.entry]) };
    expect(await authenticate(request(c.token), env)).toMatchObject({
      principalId: c.entry.principalId,
      credentialId: c.entry.credentialId,
      roles: ['reader', 'reviewer', 'activator'],
      authMethod: 'individual-bearer',
    });
    const p = (await authenticate(request(c.token), env))!;
    const a = authenticatedAuthority(p);
    expect(a.authority.verify(a.capability)).toEqual(p);
    expect(() => a.authority.verify({ ...p })).toThrow();
    expect(a.authority.isolatedLocalTests).toBe(false);
  });
  it('rejects missing, malformed, unknown, expired and disabled credentials', async () => {
    const c = credential();
    for (const entry of [
      { ...c.entry, disabled: true },
      { ...c.entry, expiresAt: '2000-01-01T00:00:00.000Z' },
    ])
      expect(
        await authenticate(request(c.token), {
          IDENTITY_REVIEWER_CREDENTIALS: JSON.stringify([entry]),
        }),
      ).toBeNull();
    for (const token of ['', 'not-a-token', credential().token])
      expect(
        await authenticate(request(token), {
          IDENTITY_REVIEWER_CREDENTIALS: JSON.stringify([c.entry]),
        }),
      ).toBeNull();
    expect(await authenticate(request(c.token), {})).toBeNull();
  });
  it('fails closed on malformed configuration, duplicates, role escalation and invalid timestamps', () => {
    const c = credential();
    for (const value of [
      '',
      '{}',
      '[]',
      'not JSON',
      JSON.stringify([c.entry, c.entry]),
      ...[
        { ...c.entry, principalId: 'spoof actor\n' },
        { ...c.entry, roles: ['admin'] },
        { ...c.entry, roles: ['reader', 'reader'] },
        { ...c.entry, tokenSha256: 'bad' },
        { ...c.entry, expiresAt: '2099-02-31T00:00:00.000Z' },
        { ...c.entry, reviewer: 'spoof' },
        { ...c.entry, disabled: 'false' },
      ].map((e) => JSON.stringify([e])),
    ])
      expect(credentials(value)).toBeNull();
    expect(
      configured({
        IDENTITY_ADMIN_MODE: 'review',
        IDENTITY_INSTALLATION_ID: installation,
      }),
    ).toBe(false);
    expect(
      configured({
        IDENTITY_ADMIN_MODE: 'off',
        IDENTITY_INSTALLATION_ID: installation,
        IDENTITY_REVIEWER_CREDENTIALS: JSON.stringify([c.entry]),
      }),
    ).toBe(false);
  });
  it('supports overlapping rotation for one principal while preserving credential attribution', async () => {
    const first = credential(),
      next = credential(first.entry.roles, first.entry.principalId);
    const env = {
      IDENTITY_REVIEWER_CREDENTIALS: JSON.stringify([first.entry, next.entry]),
    };
    const old = await authenticate(request(first.token), env),
      current = await authenticate(request(next.token), env);
    expect(old?.principalId).toBe(current?.principalId);
    expect(old?.credentialId).not.toBe(current?.credentialId);
    first.entry.disabled = true;
    env.IDENTITY_REVIEWER_CREDENTIALS = JSON.stringify([
      first.entry,
      next.entry,
    ]);
    expect(await authenticate(request(first.token), env)).toBeNull();
    expect(await authenticate(request(next.token), env)).not.toBeNull();
  });
});
