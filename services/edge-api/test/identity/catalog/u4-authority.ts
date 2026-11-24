import type {
  CatalogAuthority,
  CatalogPrincipal,
} from '../../../src/identity/catalog/review';
/** Test-only principal capability. Body-shaped objects have no authority. */
export function localAuthority() {
  const issued = new WeakMap<object, CatalogPrincipal>();
  const issue = (
    principalId = 'synthetic-reviewer',
    roles: CatalogPrincipal['roles'] = ['reviewer', 'activator'],
  ) => {
    const token = Object.freeze({});
    issued.set(token, {
      principalId,
      credentialId: 'synthetic-credential',
      authMethod: 'test-logical-principal',
      roles,
    });
    return token;
  };
  const authority: CatalogAuthority = {
    isolatedLocalTests: true,
    verify(cap) {
      const p =
        typeof cap === 'object' && cap !== null ? issued.get(cap) : null;
      if (!p) throw Error('unverified-logical-principal');
      return structuredClone(p);
    },
  };
  return { authority, issue };
}
