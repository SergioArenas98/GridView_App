import type {
  CatalogAuthority,
  CatalogPrincipal,
} from '../../identity/catalog/review';
import { exact, uuidPattern } from '../../identity/wire-decoders';

export interface IdentityAdminEnvironment {
  IDENTITY_ADMIN_MODE?: string;
  IDENTITY_INSTALLATION_ID?: string;
  IDENTITY_REVIEWER_CREDENTIALS?: string;
}
interface Credential {
  credentialId: string;
  tokenSha256: string;
  principalId: string;
  roles: CatalogPrincipal['roles'];
  disabled: boolean;
  expiresAt: string;
}
const label = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
export function credentials(value: string | undefined): Credential[] | null {
  if (!value || value.length > 65536) return null;
  try {
    const rows: unknown = JSON.parse(value);
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100)
      return null;
    const ids = new Set(),
      digests = new Set();
    for (const c of rows) {
      if (
        !exact(c, [
          'credentialId',
          'tokenSha256',
          'principalId',
          'roles',
          'disabled',
          'expiresAt',
        ]) ||
        !label(c.credentialId) ||
        !label(c.principalId) ||
        typeof c.tokenSha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(c.tokenSha256) ||
        typeof c.disabled !== 'boolean' ||
        typeof c.expiresAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(c.expiresAt) ||
        !Number.isFinite(Date.parse(c.expiresAt)) ||
        new Date(c.expiresAt).toISOString() !== c.expiresAt ||
        !Array.isArray(c.roles) ||
        c.roles.length < 1 ||
        c.roles.length > 3 ||
        c.roles.some((r) => !['reader', 'reviewer', 'activator'].includes(r)) ||
        new Set(c.roles).size !== c.roles.length ||
        ids.has(c.credentialId) ||
        digests.has(c.tokenSha256)
      )
        return null;
      ids.add(c.credentialId);
      digests.add(c.tokenSha256);
    }
    return rows as Credential[];
  } catch {
    return null;
  }
}
export function configured(env: IdentityAdminEnvironment): boolean {
  return (
    ['read-only', 'review'].includes(env.IDENTITY_ADMIN_MODE ?? '') &&
    uuidPattern.test(env.IDENTITY_INSTALLATION_ID ?? '') &&
    credentials(env.IDENTITY_REVIEWER_CREDENTIALS) !== null
  );
}
export async function authenticate(
  request: Request,
  env: IdentityAdminEnvironment,
  now = Date.now(),
): Promise<CatalogPrincipal | null> {
  const rows = credentials(env.IDENTITY_REVIEWER_CREDENTIALS);
  const header = request.headers.get('Authorization') ?? '';
  // Exactly 32 random bytes encoded as unpadded base64url, or a longer token.
  if (!rows || !/^Bearer [A-Za-z0-9_-]{43,128}$/.test(header)) return null;
  const hash = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(header.slice(7)),
    ),
  );
  let selected: Credential | null = null;
  for (const row of rows) {
    const expected = Uint8Array.from(row.tokenSha256.match(/../g)!, (x) =>
      parseInt(x, 16),
    );
    // Fixed-length digest comparison; no early exit or plaintext comparison.
    let diff = 0;
    for (let i = 0; i < 32; i++) diff |= hash[i]! ^ expected[i]!;
    const equal =
      typeof crypto.subtle.timingSafeEqual === 'function'
        ? crypto.subtle.timingSafeEqual(hash, expected)
        : diff === 0;
    if (equal && !row.disabled && Date.parse(row.expiresAt) > now)
      selected = row;
  }
  return selected
    ? {
        principalId: selected.principalId,
        credentialId: selected.credentialId,
        roles: [...selected.roles],
        authMethod: 'individual-bearer',
      }
    : null;
}
/** A private object identity is valid only within this one authenticated call.
 * There is deliberately no public issuer, principal header or body decoder. */
export function authenticatedAuthority(
  principal: CatalogPrincipal,
  synthetic = false,
): { authority: CatalogAuthority; capability: object } {
  const capability = Object.freeze({});
  return {
    capability,
    authority: {
      isolatedLocalTests: synthetic,
      verify(value) {
        if (value !== capability) throw Error('unverified-identity-capability');
        return structuredClone(principal);
      },
    },
  };
}
