// The media publication gate.
//
// Every refusal here is a hard stop, never a warning. The gate is the only thing
// standing between "an image file exists in a working directory" and "GridView
// distributes it", so it fails closed: an asset the register does not mention is
// refused, and so is one whose record is incomplete in any way that matters.

export type MediaOwnerType =
  'driver' | 'constructor' | 'circuit' | 'grand_prix';

export type MediaRightsCategory =
  'portrait' | 'logo' | 'car' | 'circuit_layout' | 'hero' | 'thumbnail';

export type AttributionPlacement = 'none' | 'central' | 'adjacent';

export type ApprovalStatus = 'approved' | 'pending' | 'rejected' | 'expired';

export interface MediaRightsRecord {
  readonly assetId: string;
  readonly entityType: MediaOwnerType;
  readonly entityId: string;
  readonly category: MediaRightsCategory;
  readonly version: string;
  readonly sourceFile: string;
  readonly sourceReference: string;
  readonly rightsHolder: string;
  readonly licenceBasis: string;
  readonly attribution: string | null;
  readonly attributionPlacement: AttributionPlacement;
  readonly territories: readonly string[];
  readonly expiresAt: string | null;
  readonly approvedForCommercialUse: boolean;
  readonly derivativesAllowed: boolean;
  readonly approvalStatus: ApprovalStatus;
  readonly provenanceNote: string;
}

export interface MediaRightsRegister {
  readonly kind: 'media-rights';
  readonly status: 'authoritative' | 'mock' | 'development';
  readonly note?: string;
  readonly assets: readonly MediaRightsRecord[];
}

/// What the publication is for. The gate cannot judge a permission without
/// knowing the use being asked of it.
export interface IntendedUse {
  /// Whether the release is commercial. GridView ships on a public store, so a
  /// real publication is always commercial; the flag exists so the rule is
  /// stated rather than assumed.
  readonly commercial: boolean;

  /// ISO 3166-1 alpha-2 of the intended release territory, or `WORLDWIDE`.
  readonly territory: string;

  /// The instant the gate is evaluated at. Injected rather than read from the
  /// clock, so an expiry test is deterministic.
  readonly at: Date;
}

export type RightsRefusalCode =
  | 'no-rights-record'
  | 'not-approved'
  | 'commercial-use-not-approved'
  | 'derivatives-not-permitted'
  | 'permission-expired'
  | 'attribution-missing'
  | 'attribution-placement-unsupported'
  | 'territory-not-permitted'
  | 'source-master-missing'
  | 'source-master-invalid'
  | 'duplicate-rights-record';

export interface RightsRefusal {
  readonly assetId: string;
  readonly code: RightsRefusalCode;
  readonly detail: string;
}

export type RightsDecision =
  | { readonly allowed: true; readonly record: MediaRightsRecord }
  | { readonly allowed: false; readonly refusals: readonly RightsRefusal[] };

/// Whether the source master exists and is a plausible image. Injected so the
/// gate stays pure and testable without a filesystem.
export interface SourceMasterProbe {
  (sourceFile: string): Promise<{ exists: boolean; valid: boolean }>;
}

/// Evaluates one asset against the register.
///
/// Collects **every** applicable refusal rather than stopping at the first, so an
/// operator sees the whole problem instead of fixing one field at a time.
export async function decideRights(
  assetId: string,
  register: MediaRightsRegister,
  use: IntendedUse,
  probe: SourceMasterProbe,
): Promise<RightsDecision> {
  const matches = register.assets.filter(
    (record) => record.assetId === assetId,
  );

  if (matches.length === 0) {
    return {
      allowed: false,
      refusals: [
        {
          assetId,
          code: 'no-rights-record',
          detail:
            'No rights record exists for this asset. Absence is a refusal: the gate fails closed.',
        },
      ],
    };
  }
  if (matches.length > 1) {
    // Two records for one asset means two different answers to "may we publish
    // this". Refusing is the only safe reading.
    return {
      allowed: false,
      refusals: [
        {
          assetId,
          code: 'duplicate-rights-record',
          detail: `${matches.length} rights records claim this asset; exactly one is required.`,
        },
      ],
    };
  }

  const record = matches[0]!;
  const refusals: RightsRefusal[] = [];
  const refuse = (code: RightsRefusalCode, detail: string): void => {
    refusals.push({ assetId, code, detail });
  };

  if (record.approvalStatus !== 'approved') {
    refuse(
      'not-approved',
      `Approval status is "${record.approvalStatus}"; only "approved" permits publication.`,
    );
  }
  if (use.commercial && !record.approvedForCommercialUse) {
    refuse(
      'commercial-use-not-approved',
      'The release is commercial but the record does not approve commercial use.',
    );
  }
  if (!record.derivativesAllowed) {
    // Processing resizes and converts. There is no publication path that does
    // not derive, so this is not a warning.
    refuse(
      'derivatives-not-permitted',
      'Processing resizes and converts the master, which this record does not permit.',
    );
  }
  if (record.expiresAt !== null) {
    const expiry = Date.parse(record.expiresAt);
    if (Number.isNaN(expiry)) {
      refuse(
        'permission-expired',
        'The expiry date could not be parsed, so the permission cannot be shown to be current.',
      );
    } else if (expiry <= use.at.getTime()) {
      refuse(
        'permission-expired',
        `The permission lapsed at ${record.expiresAt}.`,
      );
    }
  }
  if (record.attributionPlacement === 'adjacent') {
    // GridView shows credits on a central acknowledgements screen. Treating that
    // as satisfying an adjacent-attribution licence would be a false claim about
    // compliance, so the asset is simply not publishable under the current UI.
    refuse(
      'attribution-placement-unsupported',
      'This licence requires attribution adjacent to the image. GridView implements a central acknowledgements screen only, so the asset is not publishable until adjacent attribution is explicitly implemented.',
    );
  }
  if (
    record.attributionPlacement !== 'none' &&
    (record.attribution === null || record.attribution.trim() === '')
  ) {
    refuse(
      'attribution-missing',
      'Attribution is required by this record but no credit text is supplied.',
    );
  }
  if (!permitsTerritory(record.territories, use.territory)) {
    refuse(
      'territory-not-permitted',
      `Release territory "${use.territory}" is not covered by this record.`,
    );
  }

  const master = await probe(record.sourceFile);
  if (!master.exists) {
    refuse('source-master-missing', 'The source master does not exist.');
  } else if (!master.valid) {
    refuse(
      'source-master-invalid',
      'The source master is not a readable image in a supported format.',
    );
  }

  if (refusals.length > 0) return { allowed: false, refusals };
  return { allowed: true, record };
}

/// Whether [territories] covers [territory]. `WORLDWIDE` in the record covers
/// everything; a `WORLDWIDE` release needs an explicit worldwide grant, because a
/// list of individual countries is not a worldwide permission.
export function permitsTerritory(
  territories: readonly string[],
  territory: string,
): boolean {
  if (territories.includes('WORLDWIDE')) return true;
  if (territory === 'WORLDWIDE') return false;
  return territories.includes(territory);
}

/// Every asset id the register approves for [use], with a valid master.
///
/// Used by the publication tooling to answer "what may we publish" without
/// having to trust a caller's own list.
export async function approvedAssetIds(
  register: MediaRightsRegister,
  use: IntendedUse,
  probe: SourceMasterProbe,
): Promise<string[]> {
  const ids: string[] = [];
  for (const record of register.assets) {
    const decision = await decideRights(record.assetId, register, use, probe);
    if (decision.allowed) ids.push(record.assetId);
  }
  return ids.sort();
}
