import { uuidPattern, isHash } from '../identity/wire-decoders';
import {
  assertIdentityRunContext,
  type IdentityRunContext,
} from '../identity/catalog/run-context';
import { canonicalJson } from './canonical-json';
import { batchInventoryPolicyFor } from '../identity/inventory/model';
import type { ProviderSeasonSource } from '../providers/formula-one-provider';

export interface CatalogReference {
  readonly format: 'gridview-identity-catalog-ref/1';
  readonly installationId: string;
  readonly revisionId: string;
  readonly catalogHash: string;
  readonly seasonProjectionHash: string;
  readonly datasetVersion: string;
  readonly baseContentDigest: string;
  /** Verified canonical U5 exportHash, including its sha256: prefix. */
  readonly exportSha256: string;
  readonly inventoryPolicy: 'strict-v1' | 'optional-driver-inventory-v1';
}
const keys = [
  'format',
  'installationId',
  'revisionId',
  'catalogHash',
  'seasonProjectionHash',
  'datasetVersion',
  'baseContentDigest',
  'exportSha256',
  'inventoryPolicy',
];
export function decodeCatalogReference(
  value: unknown,
): CatalogReference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).length !== keys.length ||
    !keys.every((k) => Object.hasOwn(v, k)) ||
    v.format !== 'gridview-identity-catalog-ref/1' ||
    typeof v.installationId !== 'string' ||
    !uuidPattern.test(v.installationId) ||
    typeof v.revisionId !== 'string' ||
    !uuidPattern.test(v.revisionId) ||
    !isHash(v.catalogHash) ||
    !isHash(v.seasonProjectionHash) ||
    !isHash(v.baseContentDigest) ||
    typeof v.datasetVersion !== 'string' ||
    v.datasetVersion.length > 32 ||
    !/^\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/.test(v.datasetVersion) ||
    !isHash(v.exportSha256) ||
    !['strict-v1', 'optional-driver-inventory-v1'].includes(
      String(v.inventoryPolicy),
    )
  )
    return null;
  return v as unknown as CatalogReference;
}
export function catalogReference(
  context: IdentityRunContext,
  exportSha256: string,
): CatalogReference {
  assertIdentityRunContext(context);
  // The policy is the admitted context's own, never a caller's label: a
  // strict context can only produce `strict-v1` and vice versa.
  const inventoryPolicy = batchInventoryPolicyFor(
    context.inventoryPolicyVersion,
  );
  if (inventoryPolicy === null) throw Error('catalog-reference-invalid');
  const result = decodeCatalogReference({
    format: 'gridview-identity-catalog-ref/1',
    installationId: context.installationId,
    revisionId: context.revisionId,
    catalogHash: context.catalogHash,
    seasonProjectionHash: context.seasonProjectionHash,
    datasetVersion: context.datasetVersion,
    baseContentDigest: context.baseContentDigest,
    exportSha256,
    inventoryPolicy,
  });
  if (!result) throw Error('catalog-reference-invalid');
  return Object.freeze(result);
}
export function matchesCatalog(
  reference: CatalogReference,
  context: IdentityRunContext,
  season: number,
): boolean {
  assertIdentityRunContext(context);
  // Exact equality with the reference the pinned context itself produces,
  // including `inventoryPolicy`: the reviewed artifact's policy must be the
  // installation's trusted effective policy, in both directions.
  return (
    context.authority === 'runtime' &&
    context.season === season &&
    canonicalJson(reference) ===
      canonicalJson(catalogReference(context, reference.exportSha256))
  );
}
/** Checks normalized catalog-owned fields, never claims to replay raw provider identity. */
export function catalogProfilesMatch(
  source: ProviderSeasonSource,
  context: IdentityRunContext,
): boolean {
  assertIdentityRunContext(context);
  const equal = (a: unknown, b: unknown) =>
    canonicalJson(a) === canonicalJson(b);
  const allowed = (entity: string, id: string) =>
    context.verifiedBindings.some(
      (b) =>
        b.key.season === source.season &&
        b.key.source === 'jolpica' &&
        b.key.entity === entity &&
        b.targetId === id,
    );
  // Existing Jolpica media policy: every canonical profile has explicit null media.
  if (
    !source.drivers.every((d) => {
      const profile = context.participants.driverById(d.id);
      return (
        profile &&
        allowed('driver', d.id) &&
        equal(d, { ...profile, media: null })
      );
    }) ||
    !source.constructors.every((c) => {
      const profile = context.participants.constructorById(c.id);
      return (
        profile &&
        allowed('constructor', c.id) &&
        equal(c, { ...profile, media: null })
      );
    }) ||
    !source.circuits.every((c) => {
      const profile = context.circuits.get(c.id);
      return (
        profile &&
        allowed('circuit', c.id) &&
        equal(c, { ...profile, media: null })
      );
    })
  )
    return false;
  for (const event of source.calendar) {
    const binding = context.verifiedBindings.find(
      (b) =>
        b.key.season === source.season &&
        b.key.source === 'jolpica' &&
        b.key.entity === 'event' &&
        b.targetId === event.eventSlug,
    );
    if (
      !binding ||
      typeof binding.key.providerValue !== 'object' ||
      binding.key.providerValue === null
    )
      return false;
    const locator = binding.key.providerValue as {
      round: number;
      circuitId: string;
    };
    const circuit = context.registry.resolve({
      season: source.season,
      source: 'jolpica',
      entity: 'circuit',
      providerField: 'circuitId',
      providerValue: locator.circuitId,
    });
    if (
      event.name !== context.events.get(event.eventSlug) ||
      event.round !== locator.round ||
      event.season !== source.season ||
      circuit.outcome !== 'resolved' ||
      event.circuitId !== circuit.gridviewId ||
      event.media !== null ||
      event.officialName !== null ||
      event.startDate !== null ||
      event.endDate !== null ||
      event.timezone !== null
    )
      return false;
  }
  return true;
}
