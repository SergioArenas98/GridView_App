/**
 * The release-wide `sourceOrderingInput` of a coordinated publication
 * (runtime activation decision O-13).
 *
 * It is the run's observation instant - taken once every response arrived -
 * lifted to one millisecond past the season's last reserved value when the
 * clock repeated or went backwards. The ledger commits the reservation under
 * the run's fenced lease and refuses any value that does not strictly
 * increase, so no two coordinated releases of a season share or reverse an
 * ordering value.
 *
 * Only the release-wide input is chosen here. Every document's own
 * `sourceUpdatedAt` stays the per-key `snapshotObservedAt` the sequencer
 * assigns in `prepare`, unchanged for an unchanged revision; neither
 * `generatedAt` nor `fetchedAt` is ever used.
 */

import type { LedgerInstant } from '../ledger/model';

export function nextOrderingInput(
  observedAt: Date,
  last: LedgerInstant | null,
): LedgerInstant {
  const floor = last === null ? Number.NEGATIVE_INFINITY : Date.parse(last) + 1;
  return new Date(Math.max(observedAt.getTime(), floor)).toISOString();
}
