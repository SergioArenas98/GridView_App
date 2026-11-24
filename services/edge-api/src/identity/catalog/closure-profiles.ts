/**
 * U10: the pinned driver-profile view required-identity closure reads.
 *
 * Built once from an **admitted** `IdentityRunContext`. Every lookup answers
 * from that context's immutable profiles and verified bindings, so a catalog
 * activation after admission can never change what one run supplements, and no
 * lookup reaches a current head, a namespace or the network.
 */

import type { CuratedDriver } from '../../providers/jolpica/curated-participants';
import {
  assertIdentityRunContext,
  type IdentityRunContext,
} from './run-context';

/**
 * Structurally the coordination package's `PinnedDriverProfiles`; declared
 * here so this module adds no import edge into that package (the
 * coordination-containment consumer list stays exact).
 */
export interface PinnedDriverProfileView {
  readonly catalogHash: string;
  driverById(id: string): CuratedDriver | null;
  isVerifiedSeasonDriver(id: string): boolean;
}

export function pinnedDriverProfiles(
  context: IdentityRunContext,
): PinnedDriverProfileView {
  assertIdentityRunContext(context);
  const bound = new Set(
    context.verifiedBindings
      .filter(
        (b) =>
          b.key.season === context.season &&
          b.key.source === 'jolpica' &&
          b.key.entity === 'driver',
      )
      .map((b) => b.targetId),
  );
  return Object.freeze({
    catalogHash: context.catalogHash,
    driverById: (id: string) => context.participants.driverById(id),
    isVerifiedSeasonDriver: (id: string) => bound.has(id),
  });
}
