/**
 * The read-only A3.5 staging predecessor gate
 * ([ADR 0023](../../../../../docs/adr/0023-multi-source-provider-coordination.md)
 * A3.5 item 2, "Staging precondition").
 *
 * The empty-standings replacement argument holds only when the authoritative
 * predecessor is **coherent**: its driver and constructor standings are both
 * non-empty exactly when it has at least one classified race round. This reads
 * the release the sequencer reports active and authoritative, and checks that
 * correspondence. It is an operator check run before activation, not part of
 * any publication path: it writes nothing, repairs nothing and never rewrites
 * the active release.
 *
 * **What it cannot establish.** A published standings document carries no
 * round, so this cannot prove which round an existing table describes. A
 * non-empty table beside a classified round passes even if it was bound to
 * another round. Only the emptiness correspondence is checked.
 *
 * Classified rounds come from the same `readPredecessorGuard` read D14 uses, so
 * "classified" here is exactly what D14 compares: a `race` result whose status
 * is `final` or `provisional`.
 *
 * Every refusal fails closed. An unreadable release is never read as an empty
 * one, and the legacy `active:{season}` pointer is never read: a Worker without
 * a sequencer is refused. A result carries only the season, the active version
 * and closed values: no row, identity or document content.
 */

import {
  validateConstructorStanding,
  validateDriverStanding,
} from '../../contract/normalized';
import type { PublicationAuthority } from '../authority';
import type { SeasonPublicationSequencerPort } from '../sequencer/port';
import { readStoredInventory } from '../version-inventory';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../storage/types';
import { isEnvelopeFor, readPredecessorGuard } from './predecessor';

/** The closed refusals. Each is a bounded code, never a value read. */
export const standingsPredecessorRefusals = [
  /** This Worker runs the legacy authority; there is no sequencer to ask. */
  'authority-not-sequenced',
  /** The sequencer was selected but could not answer for the season. */
  'authority-unavailable',
  /** The season is not `active` and authoritative on the sequencer. */
  'authority-not-active',
  /** The inventory or a document could not be read, or read as absent. */
  'release-unavailable',
  /** The inventory or a results document is not a valid release's. */
  'release-invalid',
  /** The release does not name both standings documents. */
  'standings-missing',
  /** A standings document is not a valid standings table for the season. */
  'standings-invalid',
  /** One standings table is empty and the other is not. */
  'standings-tables-disagree',
  /** Both tables have rows and no race round is classified. */
  'standings-without-classified-round',
  /** A race round is classified and both tables are empty. */
  'classified-round-without-standings',
  /** The active release changed while it was being checked. */
  'authority-changed',
] as const;

export type StandingsPredecessorRefusal =
  (typeof standingsPredecessorRefusals)[number];

export type StandingsPredecessorCheck =
  | {
      readonly kind: 'coherent';
      readonly season: number;
      /** The release checked, still active when the check finished. */
      readonly activeVersion: string;
      /** Whether the release has at least one classified race round. */
      readonly classifiedRace: 'present' | 'absent';
      /** Both tables, which agree. */
      readonly standings: 'non-empty' | 'empty';
    }
  | {
      readonly kind: 'refused';
      readonly season: number;
      readonly reason: StandingsPredecessorRefusal;
    };

/** The most rows one published standings table may carry here. */
export const maximumStandingsRows = 100;

const driverStandingsDocument: SnapshotDocumentName = 'standings:drivers';
const constructorStandingsDocument: SnapshotDocumentName =
  'standings:constructors';

export async function checkStandingsPredecessor(
  authority: PublicationAuthority,
  storage: SnapshotStorage,
  season: number,
): Promise<StandingsPredecessorCheck> {
  const refused = (
    reason: StandingsPredecessorRefusal,
  ): StandingsPredecessorCheck => ({ kind: 'refused', season, reason });

  if (authority.mode === 'legacy') return refused('authority-not-sequenced');
  if (authority.mode === 'sequencer-unavailable') {
    return refused('authority-unavailable');
  }

  const active = await readActiveVersion(authority.port, season);
  if (active.kind === 'refused') return refused(active.reason);
  const version = active.version;

  const inventory = await readStoredInventory(storage, season, version);
  if (inventory.kind === 'unreadable' || inventory.kind === 'absent') {
    return refused('release-unavailable');
  }
  if (inventory.kind === 'malformed') return refused('release-invalid');
  const standingsNames = inventory.documents.filter(
    (name) =>
      name === driverStandingsDocument || name === constructorStandingsDocument,
  );
  if (new Set(standingsNames).size !== standingsNames.length) {
    return refused('release-invalid');
  }
  if (standingsNames.length !== 2) return refused('standings-missing');

  let results: Awaited<ReturnType<typeof readPredecessorGuard>>;
  try {
    results = await readPredecessorGuard(storage, season, version);
  } catch {
    return refused('release-unavailable');
  }
  if (results.kind === 'unavailable') return refused('release-unavailable');
  if (results.kind === 'invalid') return refused('release-invalid');

  const drivers = await readTable(storage, season, version, 'drivers');
  if (drivers.kind !== 'read') return refused(drivers.kind);
  const constructors = await readTable(
    storage,
    season,
    version,
    'constructors',
  );
  if (constructors.kind !== 'read') return refused(constructors.kind);

  const hasStandings = drivers.rows > 0;
  if (hasStandings !== constructors.rows > 0) {
    return refused('standings-tables-disagree');
  }
  const hasClassifiedRace = results.guard.classifiedRounds.length > 0;
  if (hasStandings && !hasClassifiedRace) {
    return refused('standings-without-classified-round');
  }
  if (!hasStandings && hasClassifiedRace) {
    return refused('classified-round-without-standings');
  }

  // The documents are immutable, but the verdict is about the *active*
  // release: a version superseded mid-check is not reported as checked.
  const after = await readActiveVersion(authority.port, season);
  if (after.kind === 'refused') {
    return refused(
      after.reason === 'authority-unavailable'
        ? 'authority-unavailable'
        : 'authority-changed',
    );
  }
  if (after.version !== version) return refused('authority-changed');

  return {
    kind: 'coherent',
    season,
    activeVersion: version,
    classifiedRace: hasClassifiedRace ? 'present' : 'absent',
    standings: hasStandings ? 'non-empty' : 'empty',
  };
}

type ActiveVersionRead =
  | { readonly kind: 'read'; readonly version: string }
  | {
      readonly kind: 'refused';
      readonly reason: 'authority-unavailable' | 'authority-not-active';
    };

async function readActiveVersion(
  port: SeasonPublicationSequencerPort,
  season: number,
): Promise<ActiveVersionRead> {
  let authority: Awaited<ReturnType<typeof port.readAuthority>>;
  try {
    authority = await port.readAuthority(season);
  } catch {
    return { kind: 'refused', reason: 'authority-unavailable' };
  }
  if (authority.cutoverState === 'unavailable') {
    return { kind: 'refused', reason: 'authority-unavailable' };
  }
  if (authority.cutoverState !== 'active' || !authority.authoritative) {
    return { kind: 'refused', reason: 'authority-not-active' };
  }
  return { kind: 'read', version: authority.activeVersion };
}

type TableRead =
  | { readonly kind: 'read'; readonly rows: number }
  | { readonly kind: 'release-unavailable' | 'standings-invalid' };

/**
 * One standings table's row count, after the envelope and every row pass the
 * normalized contract for this season. Only the count leaves.
 */
async function readTable(
  storage: SnapshotStorage,
  season: number,
  version: string,
  table: 'drivers' | 'constructors',
): Promise<TableRead> {
  const name =
    table === 'drivers'
      ? driverStandingsDocument
      : constructorStandingsDocument;
  let document: StoredSnapshot | null;
  try {
    document = await storage.readVersionedDocument(season, version, name);
  } catch {
    return { kind: 'release-unavailable' };
  }
  // A null read is Workers KV eventual visibility, never an empty table.
  if (document === null) return { kind: 'release-unavailable' };
  if (!isEnvelopeFor(document, name)) return { kind: 'standings-invalid' };

  const rows: unknown = document.data;
  if (!Array.isArray(rows) || rows.length > maximumStandingsRows) {
    return { kind: 'standings-invalid' };
  }
  const validate =
    table === 'drivers' ? validateDriverStanding : validateConstructorStanding;
  const identities = new Set<unknown>();
  for (const [index, row] of rows.entries()) {
    if (validate(row, `data[${index}]`).length > 0) {
      return { kind: 'standings-invalid' };
    }
    const standing = row as {
      season: number;
      driverId?: string;
      constructorId: string | null;
    };
    if (standing.season !== season) return { kind: 'standings-invalid' };
    const identity =
      table === 'drivers' ? standing.driverId : standing.constructorId;
    if (identities.has(identity)) return { kind: 'standings-invalid' };
    identities.add(identity);
  }
  return { kind: 'read', rows: rows.length };
}
