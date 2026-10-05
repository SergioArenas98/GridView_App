/**
 * Giving a season lease back after an operator action, on every path.
 *
 * An operator action holds the lease only for its one ledger operation. A
 * release that fails is reported, never raised: the lease then expires on
 * the ledger's own clock within `LEASE_TTL_MS`, and the action's outcome
 * stands either way.
 */

import type { LeaseToken } from '../ledger/model';
import type { ReconciliationLedgerPort } from '../ledger-port';

export type LeaseReleaseResult = 'released' | 'refused' | 'unavailable';

export async function releaseSeasonLease(
  ledger: ReconciliationLedgerPort,
  lease: LeaseToken,
): Promise<LeaseReleaseResult> {
  try {
    const outcome = await ledger.releaseLease(lease);
    if (outcome.outcome === 'released') return 'released';
    return outcome.outcome === 'rejected' ? 'refused' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
