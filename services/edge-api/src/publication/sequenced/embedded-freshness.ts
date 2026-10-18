/**
 * Where a stored document embeds a `DataFreshness` block.
 *
 * Only `HomeData` carries one, and it is published twice: as the `home`
 * document's own `data.freshness`, and inside the copy of Home the bootstrap
 * carries at `data.home.freshness`. Both must carry the release's publication
 * instant (ADR 0025 D4, amended 2026-10-14), so the stamp and the instant
 * readers share this one locator rather than each knowing the shapes.
 *
 * Both blocks are **required** (OpenAPI `HomeData.freshness`,
 * `BootstrapData.home`). A `home` or `bootstrap` document whose block is
 * missing or not an object is `malformed`, never "a document with no block":
 * skipping it would let a release commit without the embedded instant the
 * contract promises.
 */

import type { StoredSnapshot } from '../../storage/types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A Home payload with an object-shaped `freshness` block. */
export function isHomeWithFreshness(value: unknown): value is Record<
  string,
  unknown
> & {
  freshness: Record<string, unknown>;
} {
  return isRecord(value) && isRecord(value.freshness);
}

export type EmbeddedFreshness =
  | { readonly kind: 'blocks'; readonly blocks: Record<string, unknown>[] }
  | { readonly kind: 'malformed' };

const none: EmbeddedFreshness = { kind: 'blocks', blocks: [] };
const malformed: EmbeddedFreshness = { kind: 'malformed' };

/**
 * Every freshness block the document must embed: one for `home`, one for
 * `bootstrap`, none for any other document.
 */
export function embeddedFreshness(document: StoredSnapshot): EmbeddedFreshness {
  const data: unknown = document.data;
  if (document.documentName === 'home') {
    return isHomeWithFreshness(data)
      ? { kind: 'blocks', blocks: [data.freshness] }
      : malformed;
  }
  if (document.documentName === 'bootstrap') {
    return isRecord(data) && isHomeWithFreshness(data.home)
      ? { kind: 'blocks', blocks: [data.home.freshness] }
      : malformed;
  }
  return none;
}
