import {
  manifestFragment,
  objectInventory,
  type MediaAssetFragment,
} from './manifest.ts';
import { processMaster, type ProcessedAsset } from './process.ts';
import {
  decideRights,
  type IntendedUse,
  type MediaRightsRegister,
  type RightsRefusal,
  type SourceMasterProbe,
} from './rights.ts';

export type PublicationTarget = 'staging' | 'production';

/// The object store publication writes to.
///
/// An interface rather than an R2 client, so the whole pipeline is exercised in
/// CI against a fake with no credentials, no network and no bucket.
export interface MediaObjectStore {
  /// The content hash of the object already at [objectKey], or `null` when the
  /// key is free. This is what makes immutability enforceable rather than
  /// aspirational.
  head(objectKey: string): Promise<{ contentHash: string } | null>;

  put(objectKey: string, bytes: Buffer, contentType: string): Promise<void>;
}

/// Reads a source master. Injected so a test needs no fixture on disk and a
/// dry-run needs no credentials.
export interface SourceMasterReader {
  (sourceFile: string): Promise<Buffer>;
}

export interface PublicationRequest {
  readonly register: MediaRightsRegister;
  readonly use: IntendedUse;
  readonly target: PublicationTarget;
  readonly publicBaseUrl: string;
  readonly readMaster: SourceMasterReader;
  readonly probeMaster: SourceMasterProbe;
  /// `false` performs no write of any kind. The default, because the safe mode
  /// is the one you get by forgetting to think about it.
  readonly upload?: boolean;
  readonly store?: MediaObjectStore;
  /// Explicit operator authorisation for a production write. Production is
  /// refused without it even when `upload` is true.
  readonly productionAuthorised?: boolean;
}

export type PublicationOutcome = 'dry-run' | 'uploaded' | 'refused' | 'blocked';

export interface PublicationReport {
  readonly outcome: PublicationOutcome;
  readonly target: PublicationTarget;
  readonly uploaded: boolean;
  readonly assets: readonly MediaAssetFragment[];
  readonly objects: ReturnType<typeof objectInventory>;
  readonly refusals: readonly RightsRefusal[];
  readonly reason: string | null;
}

const CONTENT_TYPE: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
};

/// Validates, processes and — only when explicitly asked — uploads.
///
/// The order is the point. Rights are decided first, for **every** asset; then
/// masters are processed; then the immutable-key check runs against the store;
/// and only then does anything get written. A single unapproved asset blocks the
/// whole publication rather than being skipped, because a partial publication
/// against an inventory an operator believed was approved is worse than none.
///
/// Nothing here prints a credential, and nothing here is reachable from ordinary
/// pull-request CI: the dry-run path is what CI runs, and it needs no secret, no
/// bucket and no network.
export async function publishMedia(
  request: PublicationRequest,
): Promise<PublicationReport> {
  const {
    register,
    use,
    target,
    publicBaseUrl,
    readMaster,
    probeMaster,
    upload = false,
    store,
    productionAuthorised = false,
  } = request;

  const empty = {
    target,
    uploaded: false,
    assets: [] as MediaAssetFragment[],
    objects: [] as ReturnType<typeof objectInventory>,
  };

  if (!isHttpsUrl(publicBaseUrl)) {
    return {
      ...empty,
      outcome: 'blocked',
      refusals: [],
      reason:
        'The public media base URL must be an absolute https URL with a host.',
    };
  }
  if (upload && target === 'production' && !productionAuthorised) {
    // Production is refused by default. Reaching it has to be a deliberate,
    // separately stated act.
    return {
      ...empty,
      outcome: 'blocked',
      refusals: [],
      reason:
        'Production publication is refused by default; explicit authorisation is required.',
    };
  }
  if (upload && !store) {
    return {
      ...empty,
      outcome: 'blocked',
      refusals: [],
      reason: 'An upload was requested but no object store was supplied.',
    };
  }

  // 1. Rights, for every asset, before anything is read or written.
  const refusals: RightsRefusal[] = [];
  const approved: (typeof register.assets)[number][] = [];
  for (const record of register.assets) {
    const decision = await decideRights(
      record.assetId,
      register,
      use,
      probeMaster,
    );
    if (decision.allowed) {
      approved.push(decision.record);
    } else {
      refusals.push(...decision.refusals);
    }
  }
  if (refusals.length > 0) {
    return {
      ...empty,
      outcome: 'refused',
      refusals,
      reason: `${refusals.length} rights refusal(s); the publication is blocked in full.`,
    };
  }

  // 2. Process every approved master.
  const processed: ProcessedAsset[] = [];
  for (const record of approved) {
    processed.push(
      await processMaster(await readMaster(record.sourceFile), record),
    );
  }

  const assets = processed.map((asset) =>
    manifestFragment(asset, publicBaseUrl),
  );
  const objects = objectInventory(processed);

  if (!upload) {
    return {
      outcome: 'dry-run',
      target,
      uploaded: false,
      assets,
      objects,
      refusals: [],
      reason: null,
    };
  }

  // 3. Immutability, checked across the whole set before the first write, so a
  // conflict cannot leave half a version uploaded.
  const objectStore = store!;
  for (const asset of processed) {
    for (const variant of asset.variants) {
      const existing = await objectStore.head(variant.objectKey);
      if (existing && existing.contentHash !== variant.contentHash) {
        return {
          outcome: 'blocked',
          target,
          uploaded: false,
          assets,
          objects,
          refusals: [],
          reason: `Object "${variant.objectKey}" already exists with different content. Immutable objects are never overwritten; bump the asset version instead.`,
        };
      }
    }
  }

  // 4. Write. Identical content at an existing key is a no-op rather than a
  // conflict, which keeps a re-run idempotent.
  for (const asset of processed) {
    for (const variant of asset.variants) {
      const existing = await objectStore.head(variant.objectKey);
      if (existing) continue;
      await objectStore.put(
        variant.objectKey,
        variant.bytes,
        CONTENT_TYPE[variant.format] ?? 'application/octet-stream',
      );
    }
  }

  return {
    outcome: 'uploaded',
    target,
    uploaded: true,
    assets,
    objects,
    refusals: [],
    reason: null,
  };
}

/// The same HTTPS rule the client applies to a media URL, so a manifest can never
/// be generated with a URL the app would reject on sight.
export function isHttpsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.hostname === '') return false;
  if (url.username !== '' || url.password !== '') return false;
  return true;
}
