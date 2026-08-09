import {
  ALL_SCOPES,
  KIND_SCOPE,
  SCOPE_CATALOG,
  SCOPE_GROUPS,
  SCOPE_KIND,
} from '../src/constants/scopes';
import { VAULT_KINDS } from '../src/constants/vault';

describe('scope catalog', () => {
  it('covers exactly the scopes the provider supports', () => {
    expect(SCOPE_CATALOG.map((meta) => meta.scope).sort()).toEqual([...ALL_SCOPES].sort());
  });

  // A missing label is how given_name and family_name fell out of the old
  // hand-written table in oidc/views.ts.
  it('gives every scope a label, a kind and a sample', () => {
    for (const meta of SCOPE_CATALOG) {
      expect(typeof meta.label).toBe('string');
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.kind).toBe(SCOPE_KIND[meta.scope]);
      expect(meta.sample).toBeDefined();
      expect(SCOPE_GROUPS).toContain(meta.group);
    }
  });

  it('maps every vault kind to a real scope or to null', () => {
    for (const kind of VAULT_KINDS) {
      const scope = KIND_SCOPE[kind];
      if (scope !== null) expect(ALL_SCOPES).toContain(scope);
    }
  });

  // avatar can be stored but has no claim, so it must report as unshareable
  // rather than be silently absent.
  it('reports avatar as unshareable', () => {
    expect(KIND_SCOPE.avatar).toBeNull();
  });
});
