/**
 * Candidate version identifiers, and the namespace that makes a missing
 * publication-metadata sidecar decidable
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D3).
 *
 * A reader must be able to decide whether a version was *supposed* to carry a
 * sidecar, and the sidecar key reading `null` can never answer that: Workers KV
 * document storage is eventually consistent (ADR 0010), so a record that has
 * not yet propagated reads exactly like one that was never written. Uniformity
 * of `meta.sourceUpdatedAt` cannot answer it either - once the observation
 * clock is active every key changed in one `prepare` call shares a timestamp,
 * so a release in which everything changed is uniform, and that value is a
 * per-key activation time rather than a release-wide ordering input.
 *
 * So the **identifier itself** carries the discriminator:
 *
 * ```text
 * pm1-<operationEpoch, injectively encoded>-<opaque component>
 * ```
 *
 * `pm1` is "publication metadata, record schema generation 1".
 *
 * **Uniqueness is structural, not probabilistic.** The epoch component is a
 * fixed-width, zero-padded hexadecimal encoding of the allocating
 * `operationEpoch`, which is injective: distinct epochs always produce distinct
 * identifiers, by construction. `operationEpoch` is durable and strictly
 * increasing per season, so no version a retired epoch owned can ever be
 * allocated again. The opaque component may add entropy, but the no-reuse
 * property must never rest on it, and never on an eventually consistent
 * Workers KV preflight read.
 *
 * The prefix is **colon-free, deliberately**:
 * `parseVersionFromSnapshotKey` reads a version as everything between
 * `snapshot:{season}:` and the next `:`, so a marker containing `:` would break
 * key parsing. A `-`-delimited prefix does not.
 *
 * Today's generator (`sync-service.ts`, `releaseVersionFor`) emits
 * `<ISO-8601 stripped of "-:.TZ">-<8 hex>`, which always begins with a digit,
 * so every already-published version is legacy-format by construction and none
 * can collide with the reserved prefix.
 */

/** The reserved namespace marker. Never a public field. */
export const sidecarRequiredVersionPrefix = 'pm1';

/**
 * Width of the epoch component, in hexadecimal digits.
 *
 * 13 digits address every epoch representable as an exact JavaScript integer
 * (`Number.MAX_SAFE_INTEGER` is 2^53 - 1, which is 14 hex digits wide but never
 * reachable here). Fixed width is what makes the encoding injective *and*
 * decodable: a variable-width encoding would let `pm1-1-…` and `pm1-01-…` name
 * the same epoch.
 */
const epochHexWidth = 13;

/** The largest epoch this encoding represents without truncation. */
export const maximumOperationEpoch = 16 ** epochHexWidth - 1;

/** Width of the opaque component, in hexadecimal digits. */
const opaqueHexWidth = 8;

const candidateVersionPattern = new RegExp(
  `^${sidecarRequiredVersionPrefix}-([0-9a-f]{${epochHexWidth}})-([0-9a-f]{${opaqueHexWidth}})$`,
);

/**
 * Whether a version was required to carry a publication-metadata sidecar.
 *
 * `sidecar-required` - allocated by this protocol, so an absent sidecar means
 * *not readable right now*, never *never written*: a reader must fail closed.
 *
 * `legacy-format` - predates the sidecar, so an absent record is a known
 * historical state and the bounded legacy fallback applies.
 *
 * A historical identifier that accidentally resembles the reserved format is
 * classified `sidecar-required` and therefore rejected conservatively when its
 * sidecar is absent. Safety takes precedence over rollback availability: an
 * operator selects a different target rather than the system guessing an
 * ordering baseline.
 */
export type VersionNamespace = 'sidecar-required' | 'legacy-format';

export function versionNamespace(version: string): VersionNamespace {
  return candidateVersionPattern.test(version)
    ? 'sidecar-required'
    : 'legacy-format';
}

/**
 * The epoch a candidate version belongs to, or `null` when the identifier is
 * not in the reserved namespace.
 *
 * Decoding exists so a test can assert ownership directly rather than inferring
 * it. Nothing in the protocol needs to decode an identifier to be safe: the
 * durable operation record already names the version its epoch owns.
 */
export function epochOfCandidateVersion(version: string): number | null {
  const parts = candidateVersionPattern.exec(version);
  if (parts === null) return null;
  const epoch = Number.parseInt(parts[1] as string, 16);
  return Number.isSafeInteger(epoch) ? epoch : null;
}

/** Source of the opaque component. Injected so tests stay deterministic. */
export type OpaqueVersionComponent = () => string;

/**
 * The default opaque component: eight hexadecimal digits from the runtime's own
 * randomness, in the same shape today's generator already uses.
 */
export const randomOpaqueVersionComponent: OpaqueVersionComponent = () =>
  crypto.randomUUID().replace(/-/g, '').slice(0, opaqueHexWidth);

/**
 * Allocates the candidate version for one operation epoch.
 *
 * Throws for an epoch this encoding cannot represent injectively. That is a
 * programming error rather than an input the protocol admits: the caller never
 * supplies an epoch, and the sequencer refuses to allocate one past the
 * representable range before it reaches here.
 */
export function candidateVersionForEpoch(
  operationEpoch: number,
  opaque: OpaqueVersionComponent = randomOpaqueVersionComponent,
): string {
  if (
    !Number.isSafeInteger(operationEpoch) ||
    operationEpoch < 1 ||
    operationEpoch > maximumOperationEpoch
  ) {
    throw new RangeError('operationEpoch is outside the representable range');
  }
  const epochComponent = operationEpoch
    .toString(16)
    .padStart(epochHexWidth, '0');
  const opaqueComponent = normalizeOpaque(opaque());
  return `${sidecarRequiredVersionPrefix}-${epochComponent}-${opaqueComponent}`;
}

/**
 * Forces the opaque component into the declared shape.
 *
 * The component carries no safety property, so a short, long or
 * non-hexadecimal value is normalized rather than rejected - what must never
 * vary is the identifier's *shape*, because that is what the namespace
 * discriminator reads.
 */
function normalizeOpaque(value: string): string {
  const hex = value.toLowerCase().replace(/[^0-9a-f]/g, '');
  return hex.padEnd(opaqueHexWidth, '0').slice(0, opaqueHexWidth);
}
