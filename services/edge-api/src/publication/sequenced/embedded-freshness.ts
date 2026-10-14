/**
 * Where a stored document embeds a `DataFreshness` block.
 *
 * Only `HomeData` carries one, and it is published twice: as the `home`
 * document's own `data.freshness`, and inside the copy of Home the bootstrap
 * carries at `data.home.freshness`. Both must carry the release's publication
 * instant (ADR 0025 D4, amended 2026-10-14), so the stamp and the instant
 * readers share this one locator rather than each knowing the shapes.
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

/** Every freshness block the document embeds, in a fixed order. */
export function embeddedFreshness(
  document: StoredSnapshot,
): Record<string, unknown>[] {
  const data: unknown = document.data;
  if (document.documentName === 'home' && isHomeWithFreshness(data)) {
    return [data.freshness];
  }
  if (
    document.documentName === 'bootstrap' &&
    isRecord(data) &&
    isHomeWithFreshness(data.home)
  ) {
    return [data.home.freshness];
  }
  return [];
}
