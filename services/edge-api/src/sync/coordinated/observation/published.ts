/**
 * The authoritative release's classification revisions (decision pack §6.6
 * step 2): what `reconcilePublishedRevisions` writes into the ledger's
 * `publishedRevision` cache before anything is planned.
 *
 * The sequencer is asked once which release is active, and that release's
 * `grand-prix:{round}:results` documents are read and hashed by the same
 * predecessor read the D14-D16 guard uses. Nothing here is a provider request.
 *
 * Every refusal fails closed. A season the sequencer does not hold as
 * **active and authoritative** - uninitialized, seeded but not activated, or
 * unreadable - is refused, and so is a release whose results cannot be read
 * or are not a valid release's results. The ledger is never reconciled from
 * anything but the authority, and an unreadable release is never read as an
 * empty one.
 */

import { readPredecessorGuard } from '../../../publication/guard/predecessor';
import { roundOfResultsDocument } from '../../../publication/guard/participation-guard';
import type { SeasonPublicationSequencerPort } from '../../../publication/sequencer/port';
import type { SnapshotStorage } from '../../../storage/types';
import type { AuthoritativeRevision } from '../ledger/model';

export const publishedReadRefusals = [
  /** The sequencer could not answer for the season. */
  'authority-unavailable',
  /** The season is not active and authoritative on the sequencer. */
  'authority-not-authoritative',
  /** The active release's results could not be read. */
  'published-release-unavailable',
  /** What was read is not a valid release's results. */
  'published-release-invalid',
] as const;

export type PublishedReadRefusal = (typeof publishedReadRefusals)[number];

export type PublishedRevisionsRead =
  | {
      readonly kind: 'read';
      readonly activeVersion: string;
      /** Sorted by round. */
      readonly revisions: readonly AuthoritativeRevision[];
    }
  | { readonly kind: 'refused'; readonly reason: PublishedReadRefusal };

const refused = (reason: PublishedReadRefusal): PublishedRevisionsRead => ({
  kind: 'refused',
  reason,
});

export async function readPublishedRevisions(
  sequencer: SeasonPublicationSequencerPort,
  storage: SnapshotStorage,
  season: number,
): Promise<PublishedRevisionsRead> {
  let authority: Awaited<ReturnType<typeof sequencer.readAuthority>>;
  try {
    authority = await sequencer.readAuthority(season);
  } catch {
    return refused('authority-unavailable');
  }
  if (authority.cutoverState === 'unavailable') {
    return refused('authority-unavailable');
  }
  if (authority.cutoverState !== 'active' || !authority.authoritative) {
    return refused('authority-not-authoritative');
  }

  let read: Awaited<ReturnType<typeof readPredecessorGuard>>;
  try {
    read = await readPredecessorGuard(storage, season, authority.activeVersion);
  } catch {
    return refused('published-release-unavailable');
  }
  if (read.kind === 'unavailable') {
    return refused('published-release-unavailable');
  }
  if (read.kind === 'invalid') return refused('published-release-invalid');

  const revisions: AuthoritativeRevision[] = [];
  for (const document of read.guardDocuments) {
    const round = roundOfResultsDocument(document.documentName);
    if (round === null) return refused('published-release-invalid');
    revisions.push({ round, revision: document.revision });
  }
  revisions.sort((left, right) => left.round - right.round);
  return { kind: 'read', activeVersion: authority.activeVersion, revisions };
}
