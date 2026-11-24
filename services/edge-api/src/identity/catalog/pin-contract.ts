import { integer, isHash } from '../wire-decoders';
import { requireCatalog } from './model';
import { boundedJson, exact } from './sources';
import { instant, uuid } from './review';
import { canonicalJson } from '../../ingest/canonical-json';
export const pinPurposes = [
  'scheduled',
  'manual',
  'operator-verification',
  'calendar-diagnostic',
  'season-batch',
] as const;
/**
 * Schema 1 is every strict request, byte-identical to its pre-U10 form, so
 * stored strict pins and receipts are unchanged. Schema 2 (U10) exists only to
 * record the explicit optional-driver inventory policy in the durable pin:
 * because a replay compares the complete stored request, a retry of the same
 * run ID under a different policy is a `pin-run-conflict`, never a silent
 * reinterpretation.
 */
export type PinRequest = PinRequestV1 | PinRequestV2;
interface PinRequestBase {
  runId: string;
  installationId: string;
  season: number;
  purpose: (typeof pinPurposes)[number];
  leaseFence: number | null;
}
export interface PinRequestV1 extends PinRequestBase {
  schemaVersion: 1;
}
export interface PinRequestV2 extends PinRequestBase {
  schemaVersion: 2;
  inventoryPolicy: 'optional-driver-inventory-v1';
}
/** The inventory policy version a pin request records. */
export function pinInventoryPolicyVersion(
  request: PinRequest,
): 'strict/1' | 'optional-drivers/1' {
  return request.schemaVersion === 2 ? 'optional-drivers/1' : 'strict/1';
}
export interface RunPin {
  format: 'gridview-identity-run-pin/1';
  request: PinRequest;
  revisionId: string;
  catalogHash: string;
  seasonProjectionHash: string;
  datasetVersion: string;
  baseContentDigest: string;
  pinnedAt: string;
  snapshotIdentity: string;
}
export interface PinnedCatalog {
  pin: RunPin;
  receiptHash: string;
  lineage: string;
}

/** Lease reacquisition supplies a new fence, not a new logical execution.
 * The receipt always retains the first admitting fence as provenance. */
export function samePinExecution(a: PinRequest, b: PinRequest): boolean {
  const identity = ({ leaseFence, ...context }: PinRequest) => {
    void leaseFence;
    return context;
  };
  return canonicalJson(identity(a)) === canonicalJson(identity(b));
}

export function decodePinRequest(input: unknown): PinRequest {
  const v = boundedJson(input);
  const base = [
    'schemaVersion',
    'runId',
    'installationId',
    'season',
    'purpose',
    'leaseFence',
  ];
  const schema =
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? (v as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  exact(v, schema === 2 ? [...base, 'inventoryPolicy'] : base);
  uuid(v.runId);
  uuid(v.installationId);
  requireCatalog(
    (v.schemaVersion === 1 ||
      (v.schemaVersion === 2 &&
        v.inventoryPolicy === 'optional-driver-inventory-v1')) &&
      integer(v.season, 1950) &&
      (v.season as number) <= 2200 &&
      pinPurposes.includes(v.purpose as PinRequest['purpose']) &&
      (v.leaseFence === null || integer(v.leaseFence, 1)),
    'pin-request',
  );
  return v as unknown as PinRequest;
}
export function decodeRunPin(input: unknown): RunPin {
  const v = boundedJson(input);
  exact(v, [
    'format',
    'request',
    'revisionId',
    'catalogHash',
    'seasonProjectionHash',
    'datasetVersion',
    'baseContentDigest',
    'pinnedAt',
    'snapshotIdentity',
  ]);
  decodePinRequest(v.request);
  uuid(v.revisionId);
  instant(v.pinnedAt);
  requireCatalog(
    v.format === 'gridview-identity-run-pin/1' &&
      isHash(v.catalogHash) &&
      isHash(v.seasonProjectionHash) &&
      isHash(v.baseContentDigest) &&
      /^\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/.test(String(v.datasetVersion)) &&
      v.snapshotIdentity === v.revisionId + ':' + v.catalogHash,
    'pin-receipt',
  );
  return v as unknown as RunPin;
}
