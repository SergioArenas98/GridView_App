/** U1 drafts only: no durable candidate state, approval, import or public identity. */
import type { CoordinatedResource } from '../../providers/coordination/resource';
import type { ProviderMappingKey } from '../../providers/mappings/mapping-key';
import type {
  DriversDecodeResult,
  ConstructorsDecodeResult,
} from '../../providers/jolpica/participants-payload';
import type { ResultsDecodeResult } from '../../providers/jolpica/results-payload';
import type {
  StandingsDecodeResult,
  DecodedDriverStanding,
  DecodedConstructorStanding,
} from '../../providers/jolpica/standings-payload';
import type { CalendarDecodeResult } from '../../providers/jolpica/calendar-payload';
import type { CircuitsDecodeResult } from '../../providers/jolpica/circuits-payload';

export type IdentityHash = `sha256:${string}`;
export type CatalogReference =
  | { readonly mode: 'bundled'; readonly catalogHash: IdentityHash }
  | {
      readonly mode: 'runtime';
      readonly revisionId: string;
      readonly catalogHash: IdentityHash;
    };
export interface ObservationContext {
  readonly runId: string;
  readonly requestOrdinal: number;
  readonly observedAt: string;
  readonly catalogRef: CatalogReference;
  readonly transportKind: 'direct' | 'proxy' | 'controlled' | 'offline-replay';
  readonly synthetic: boolean;
}
interface DecodedRequest {
  readonly season: number;
  readonly requestedLimit: number;
}
export type DecodedJolpicaResource = DecodedRequest &
  (
    | {
        readonly endpointKind: 'season-drivers';
        readonly decoded: DriversDecodeResult;
      }
    | {
        readonly endpointKind: 'season-constructors';
        readonly decoded: ConstructorsDecodeResult;
      }
    | {
        readonly endpointKind: 'race-results';
        readonly round: number;
        readonly decoded: ResultsDecodeResult;
      }
    | {
        readonly endpointKind: 'driver-standings';
        readonly decoded: StandingsDecodeResult<DecodedDriverStanding>;
      }
    | {
        readonly endpointKind: 'constructor-standings';
        readonly decoded: StandingsDecodeResult<DecodedConstructorStanding>;
      }
    | {
        readonly endpointKind: 'season-calendar';
        readonly decoded: CalendarDecodeResult;
      }
    | {
        readonly endpointKind: 'season-circuits';
        readonly decoded: CircuitsDecodeResult;
      }
  );
export type JolpicaEndpointKind = DecodedJolpicaResource['endpointKind'];
export interface IdentityKeyReference {
  readonly key: ProviderMappingKey;
  readonly resource: CoordinatedResource;
  readonly round: number | null;
  readonly sessionType: 'race' | null;
  /** Only drivers have a descriptive source location; never a URL. */
  readonly driverPath: readonly string[] | null;
}
export type EvidenceField =
  | 'givenName'
  | 'familyName'
  | 'fullName'
  | 'dateOfBirth'
  | 'nationality'
  | 'shortCode'
  | 'permanentNumber';
export type EvidenceSourceField = Exclude<EvidenceField, 'shortCode'> | 'code';
export interface ObservedClaim<
  S extends EvidenceSourceField = EvidenceSourceField,
> {
  readonly value: string;
  readonly sourceField: S;
}
/** Jolpica numbers remain strings, never canonical permanent-number integers. */
export interface IdentityEvidenceProjection {
  readonly givenName?: ObservedClaim<'givenName'>;
  readonly familyName?: ObservedClaim<'familyName'>;
  readonly fullName?: ObservedClaim<'fullName'>;
  readonly dateOfBirth?: ObservedClaim<'dateOfBirth'>;
  readonly nationality?: ObservedClaim<'nationality'>;
  readonly shortCode?: ObservedClaim<'code'>;
  readonly permanentNumber?: ObservedClaim<'permanentNumber'>;
}
export interface OmittedEvidenceField {
  readonly field: EvidenceField;
  readonly reason:
    | 'invalid-type'
    | 'invalid-value'
    | 'too-long'
    | 'unsafe-property'
    | 'unsupported-field';
}
export interface ProviderObservationProvenance {
  readonly kind: 'provider-observation';
  readonly decoderVersion: 'jolpica-strict/1';
  readonly extractorVersion: 'jolpica-identity/1';
  readonly decoderSucceeded: true;
  readonly provider: 'jolpica';
  readonly transportKind: ObservationContext['transportKind'];
  readonly synthetic: boolean;
}
/** The reference U1 discovers; durable lifecycle/decisions belong to U2+. */
export interface ResolutionCandidateReference {
  readonly candidateId: IdentityHash;
  readonly key: ProviderMappingKey;
}
export interface IdentityObservationDraft extends ResolutionCandidateReference {
  readonly schemaVersion: 1;
  readonly observationId: IdentityHash;
  readonly runId: string;
  readonly requestOrdinal: number;
  readonly resource: CoordinatedResource;
  readonly endpointKind: JolpicaEndpointKind;
  readonly round: number | null;
  readonly sessionType: 'race' | null;
  readonly observedAt: string;
  /** U2 assigns ingestion time. U1 must not invent a durable timestamp. */
  readonly recordedAt: null;
  readonly catalogRef: CatalogReference;
  readonly evidence: IdentityEvidenceProjection;
  readonly evidenceDigest: IdentityHash;
  readonly provenance: ProviderObservationProvenance;
  readonly omittedFields: readonly OmittedEvidenceField[];
}
const observationBrand: unique symbol = Symbol('U1 identity observation');
export type IdentityObservation = IdentityObservationDraft & {
  readonly [observationBrand]: true;
};
/** Called only with detached, allowlisted data built by the extractor. */
export function sealObservation(
  draft: IdentityObservationDraft,
): IdentityObservation {
  Object.defineProperty(draft, observationBrand, { value: true });
  const freeze = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  };
  freeze(draft);
  return draft as IdentityObservation;
}
export function isSealedObservation(
  value: unknown,
): value is IdentityObservation {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      Object.getOwnPropertyDescriptor(value, observationBrand)?.value ===
        true &&
      Object.isFrozen(value)
    );
  } catch {
    return false;
  }
}
export type DiscoveryResult =
  | {
      readonly status: 'collected';
      readonly observations: readonly IdentityObservation[];
    }
  | {
      readonly status: 'skipped';
      readonly reason:
        | 'decode-failed'
        | 'decode-mismatch'
        | 'unsafe-input'
        | 'invalid-context'
        | 'resolution-fault'
        | 'capacity';
      readonly observations: readonly [];
    };
