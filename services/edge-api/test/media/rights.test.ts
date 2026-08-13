import { describe, expect, it } from 'vitest';

import {
  approvedAssetIds,
  decideRights,
  permitsTerritory,
  type RightsRefusalCode,
} from '../../scripts/media/rights.ts';
import {
  corruptMaster,
  missingMaster,
  presentMaster,
  register,
  rightsRecord,
  testUse,
} from './support.ts';

/// The refusal codes a decision produced, for concise assertions.
async function refusals(
  ...args: Parameters<typeof decideRights>
): Promise<RightsRefusalCode[]> {
  const decision = await decideRights(...args);
  return decision.allowed ? [] : decision.refusals.map((r) => r.code);
}

describe('media rights gate', () => {
  it('approves a complete, current, commercially cleared record', async () => {
    const decision = await decideRights(
      'test-shape-portrait-v1',
      register(rightsRecord()),
      testUse,
      presentMaster,
    );
    expect(decision.allowed).toBe(true);
  });

  it('refuses an asset with no record at all', async () => {
    // Absence is the most important refusal: the gate fails closed, so an asset
    // nobody has thought about cannot be published by accident.
    expect(
      await refusals('unlisted-asset', register(), testUse, presentMaster),
    ).toEqual(['no-rights-record']);
  });

  it('refuses when two records claim the same asset', async () => {
    // Two records mean two different answers to "may we publish this".
    expect(
      await refusals(
        'test-shape-portrait-v1',
        register(rightsRecord(), rightsRecord({ approvalStatus: 'rejected' })),
        testUse,
        presentMaster,
      ),
    ).toEqual(['duplicate-rights-record']);
  });

  it.each(['pending', 'rejected', 'expired'] as const)(
    'refuses approval status %s',
    async (approvalStatus) => {
      expect(
        await refusals(
          'test-shape-portrait-v1',
          register(rightsRecord({ approvalStatus })),
          testUse,
          presentMaster,
        ),
      ).toContain('not-approved');
    },
  );

  it('refuses a commercial release without commercial approval', async () => {
    expect(
      await refusals(
        'test-shape-portrait-v1',
        register(rightsRecord({ approvedForCommercialUse: false })),
        testUse,
        presentMaster,
      ),
    ).toContain('commercial-use-not-approved');
  });

  it('allows a non-commercial use without commercial approval', async () => {
    const decision = await decideRights(
      'test-shape-portrait-v1',
      register(rightsRecord({ approvedForCommercialUse: false })),
      { ...testUse, commercial: false },
      presentMaster,
    );
    expect(decision.allowed).toBe(true);
  });

  it('refuses when derivatives are not permitted', async () => {
    // Every publication path resizes and converts, so this is absolute.
    expect(
      await refusals(
        'test-shape-portrait-v1',
        register(rightsRecord({ derivativesAllowed: false })),
        testUse,
        presentMaster,
      ),
    ).toContain('derivatives-not-permitted');
  });

  it('refuses a lapsed permission', async () => {
    expect(
      await refusals(
        'test-shape-portrait-v1',
        register(rightsRecord({ expiresAt: '2026-07-31T23:59:59.000Z' })),
        testUse,
        presentMaster,
      ),
    ).toContain('permission-expired');
  });

  it('allows a permission that has not lapsed yet', async () => {
    const decision = await decideRights(
      'test-shape-portrait-v1',
      register(rightsRecord({ expiresAt: '2026-09-01T00:00:00.000Z' })),
      testUse,
      presentMaster,
    );
    expect(decision.allowed).toBe(true);
  });

  it('refuses an unparseable expiry rather than assuming it is current', async () => {
    expect(
      await refusals(
        'test-shape-portrait-v1',
        register(rightsRecord({ expiresAt: 'whenever' })),
        testUse,
        presentMaster,
      ),
    ).toContain('permission-expired');
  });

  it('refuses missing attribution when the record requires it', async () => {
    expect(
      await refusals(
        'test-shape-portrait-v1',
        register(rightsRecord({ attribution: '   ' })),
        testUse,
        presentMaster,
      ),
    ).toContain('attribution-missing');
  });

  it('allows a genuinely attribution-free licence', async () => {
    const decision = await decideRights(
      'test-shape-portrait-v1',
      register(
        rightsRecord({ attribution: null, attributionPlacement: 'none' }),
      ),
      testUse,
      presentMaster,
    );
    expect(decision.allowed).toBe(true);
  });

  it('refuses a licence requiring adjacent attribution', async () => {
    // GridView shows credits centrally. Treating that as satisfying an adjacent
    // requirement would be a false compliance claim, so the asset is simply not
    // publishable under the current UI model.
    expect(
      await refusals(
        'test-shape-portrait-v1',
        register(rightsRecord({ attributionPlacement: 'adjacent' })),
        testUse,
        presentMaster,
      ),
    ).toContain('attribution-placement-unsupported');
  });

  it('refuses a release outside the permitted territory', async () => {
    expect(
      await refusals(
        'test-shape-portrait-v1',
        register(rightsRecord({ territories: ['GB', 'IE'] })),
        { ...testUse, territory: 'ES' },
        presentMaster,
      ),
    ).toContain('territory-not-permitted');
  });

  it('refuses a missing source master', async () => {
    expect(
      await refusals(
        'test-shape-portrait-v1',
        register(rightsRecord()),
        testUse,
        missingMaster,
      ),
    ).toContain('source-master-missing');
  });

  it('refuses an unreadable source master', async () => {
    expect(
      await refusals(
        'test-shape-portrait-v1',
        register(rightsRecord()),
        testUse,
        corruptMaster,
      ),
    ).toContain('source-master-invalid');
  });

  it('reports every applicable refusal rather than stopping at the first', async () => {
    const codes = await refusals(
      'test-shape-portrait-v1',
      register(
        rightsRecord({
          approvalStatus: 'pending',
          approvedForCommercialUse: false,
          derivativesAllowed: false,
          attribution: null,
        }),
      ),
      testUse,
      missingMaster,
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        'not-approved',
        'commercial-use-not-approved',
        'derivatives-not-permitted',
        'attribution-missing',
        'source-master-missing',
      ]),
    );
  });
});

describe('territory rules', () => {
  it('treats WORLDWIDE in the record as covering any territory', () => {
    expect(permitsTerritory(['WORLDWIDE'], 'ES')).toBe(true);
    expect(permitsTerritory(['WORLDWIDE'], 'WORLDWIDE')).toBe(true);
  });

  it('does not treat a list of countries as a worldwide grant', () => {
    // A worldwide release needs an explicit worldwide permission; enumerating
    // some countries is not the same statement.
    expect(permitsTerritory(['GB', 'ES'], 'WORLDWIDE')).toBe(false);
  });

  it('matches an explicitly listed territory', () => {
    expect(permitsTerritory(['GB', 'ES'], 'ES')).toBe(true);
    expect(permitsTerritory(['GB', 'ES'], 'FR')).toBe(false);
  });
});

describe('approved inventory', () => {
  it('lists only the assets that pass the gate, sorted', async () => {
    const approved = await approvedAssetIds(
      register(
        rightsRecord({ assetId: 'shape-b-portrait-v1' }),
        rightsRecord({ assetId: 'shape-a-portrait-v1' }),
        rightsRecord({
          assetId: 'shape-c-portrait-v1',
          approvalStatus: 'pending',
        }),
      ),
      testUse,
      presentMaster,
    );
    expect(approved).toEqual(['shape-a-portrait-v1', 'shape-b-portrait-v1']);
  });

  it('is empty for an empty register', async () => {
    expect(await approvedAssetIds(register(), testUse, presentMaster)).toEqual(
      [],
    );
  });
});
