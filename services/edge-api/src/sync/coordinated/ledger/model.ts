/**
 * The G9 reconciliation ledger's closed, versioned record model (ADR 0020
 * obligations 2 and 3; runtime activation decision O-6).
 *
 * **Storage only.** These types say what the ledger may hold and which
 * outcomes its operations report. They encode no §10.4.1 transition,
 * corroboration, settling, due-work planning or publication decision; those
 * belong to the later G9/G5 change that computes new records and commits them
 * through this storage.
 *
 * Every stored value is bounded and closed: identifiers, canonical UTC
 * instants, bounded counters, closed states and `sha256:` revision hashes.
 * Nothing here can carry a provider response, a normalized payload, a name, a
 * URL, a header or a credential - the decoders in `records.ts` refuse any key
 * or value outside this model.
 */

/** Bumped only together with a decoder that reads every earlier version. */
export const LEDGER_SCHEMA_VERSION = 1;

/**
 * The stable name the one global ledger object is addressed by
 * (`idFromName`), once a later, separately authorized change binds it.
 */
export const RECONCILIATION_LEDGER_OBJECT_NAME = 'reconciliation';

/**
 * The operator-review backlog capacity, global across seasons (ADR 0020 §4,
 * obligation 2). No automatic eviction and no age-based deletion: an insertion
 * that would exceed it is refused.
 */
export const BACKLOG_CAPACITY = 60;

/**
 * The bounded superseded-revision history per classification resource.
 *
 * The history is append-only: an insertion beyond it is refused, never made
 * room for by evicting an older revision, because a forgotten revision could
 * otherwise be applied again (ADR 0020 D2.2).
 */
export const SUPERSEDED_REVISION_CAPACITY = 16;

/** How long an acquired season lease stays valid on the ledger's own clock. */
export const LEASE_TTL_MS = 10 * 60 * 1000;

/** The highest round a record may name. Far above any real season. */
export const MAXIMUM_ROUND = 100;

/** The §10.4.1 cadence has at most 17 checks. */
export const MAXIMUM_CHECK_INDEX = 17;
export const MAXIMUM_CONSECUTIVE_CONFIRMATIONS = 17;

/** The unstable-source event is raised at the third sighting. */
export const MAXIMUM_UNSTABLE_SIGHTINGS = 3;

/** The most classification records, or backlog changes, one commit carries. */
export const MAXIMUM_COMMIT_WRITES = MAXIMUM_ROUND;

/** `sha256:<64 lowercase hex>`, the shape `snapshotRevision` produces. */
export type RevisionHash = string;

/** A canonical UTC instant exactly as `Date.prototype.toISOString` spells it. */
export type LedgerInstant = string;

export const anchorKinds = ['date-time', 'date-eod'] as const;
export type AnchorKind = (typeof anchorKinds)[number];

export const provenanceStates = ['absent', 'reconciled'] as const;
export type ProvenanceState = (typeof provenanceStates)[number];

export const reviewStates = ['absent', 'unsettled', 'settled'] as const;
export type ReviewState = (typeof reviewStates)[number];

/** Markers on the review axis, stored sorted and without duplicates. */
export const classificationMarkers = [
  'pending',
  'review_locked',
  'staged',
] as const;
export type ClassificationMarker = (typeof classificationMarkers)[number];

export const terminalReasons = [
  'settled',
  'settled-on-deadline',
  'never-reconciled-abandoned',
] as const;
export type TerminalReason = (typeof terminalReasons)[number];

/** A staged or competing correction: a revision hash, never a payload. */
export interface CorrectionSlot {
  readonly revision: RevisionHash;
  readonly firstSeenAt: LedgerInstant;
  readonly uncorroborated: boolean;
}

/**
 * One race classification resource, key `classification:{season}:{round}`.
 *
 * `publishedRevision` is a **cache** of the authoritative release. An ordinary
 * commit can never change it; only `reconcilePublishedRevisions`, which takes
 * its values from the authoritative release, writes it. The ledger is never a
 * second publication authority.
 */
export interface ClassificationRecord {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION;
  readonly kind: 'classification';
  readonly season: number;
  readonly round: number;
  readonly sessionType: 'race';
  readonly anchor: LedgerInstant;
  readonly anchorKind: AnchorKind;
  readonly checkIndex: number;
  readonly lastAttemptedAt: LedgerInstant | null;
  readonly lastSuccessfulObservationAt: LedgerInstant | null;
  readonly nextDueAt: LedgerInstant | null;
  readonly limiterDeferralUntil: LedgerInstant | null;
  readonly publishedRevision: RevisionHash | null;
  readonly candidateRevision: RevisionHash | null;
  readonly candidateFirstSeenAt: LedgerInstant | null;
  readonly consecutiveConfirmations: number;
  readonly provenance: ProvenanceState;
  readonly reviewState: ReviewState;
  readonly markers: readonly ClassificationMarker[];
  readonly stagedCorrection: CorrectionSlot | null;
  readonly competingCorrection: CorrectionSlot | null;
  readonly supersededRevisions: readonly RevisionHash[];
  readonly sourceObservedAt: LedgerInstant | null;
  readonly settledAt: LedgerInstant | null;
  readonly terminalReason: TerminalReason | null;
  readonly lastSweptAt: LedgerInstant | null;
  readonly lastPriorityAttemptAt: LedgerInstant | null;
  readonly unstableSightings: number;
}

/** The season-level resources carried as refresh state. */
export const refreshResources = [
  'calendar',
  'circuits',
  'constructor-standings',
  'driver-standings',
  'participants',
] as const;
export type RefreshResource = (typeof refreshResources)[number];

export interface RefreshRecord {
  readonly observedRevision: RevisionHash | null;
  readonly lastAttemptedAt: LedgerInstant | null;
  readonly lastSuccessAt: LedgerInstant | null;
  readonly nextDueAt: LedgerInstant | null;
}

/** One season's refresh state, key `season:{season}`. */
export interface SeasonRecord {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION;
  readonly kind: 'season';
  readonly season: number;
  readonly refresh: Readonly<Record<RefreshResource, RefreshRecord>>;
  readonly publicationDueAt: LedgerInstant | null;
}

/** One operator-review backlog entry, key `backlog:{season}:{round}:{revision}`. */
export interface BacklogEntry {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION;
  readonly kind: 'backlog-entry';
  readonly season: number;
  readonly round: number;
  readonly revision: RevisionHash;
  readonly enteredAt: LedgerInstant;
}

/**
 * Where the season's cached published revisions came from, key
 * `published:{season}`. Written only by `reconcilePublishedRevisions`.
 */
export interface PublishedReconciliation {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION;
  readonly kind: 'published-reconciliation';
  readonly season: number;
  readonly activeVersion: string;
  readonly reconciledAt: LedgerInstant;
}

/**
 * One season's lease, key `lease:{season}`. Kept after release so the fencing
 * token only ever grows and is never handed out twice.
 */
export interface LeaseRecord {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION;
  readonly kind: 'lease';
  readonly season: number;
  readonly fence: number;
  readonly state: 'held' | 'released';
  readonly acquiredAt: LedgerInstant;
  readonly expiresAt: LedgerInstant;
}

/** What a caller presents to write: the season and its fencing token. */
export interface LeaseToken {
  readonly season: number;
  readonly fence: number;
}

export interface LeaseGrant extends LeaseToken {
  readonly expiresAt: LedgerInstant;
}

/** A stored record with the version a conditional update must name. */
export interface Versioned<T> {
  readonly version: number;
  readonly record: T;
}

export interface LedgerSnapshot {
  readonly season: number;
  readonly seasonRecord: Versioned<SeasonRecord> | null;
  /** Sorted by round. */
  readonly classifications: readonly Versioned<ClassificationRecord>[];
  readonly published: PublishedReconciliation | null;
  readonly lease: {
    readonly fence: number;
    readonly state: 'held' | 'released' | 'expired';
    readonly expiresAt: LedgerInstant;
  } | null;
  readonly backlog: {
    /** Global, across every season. */
    readonly count: number;
    readonly capacity: typeof BACKLOG_CAPACITY;
    /** This season's entries, sorted by round then revision. */
    readonly entries: readonly BacklogEntry[];
  };
}

/** Why an operation was refused. A closed set, safe for logs. */
export const ledgerRejectionReasons = [
  'invalid-request',
  'invalid-record',
  'duplicate-record',
  'lease-held',
  'lease-not-held',
  'lease-superseded',
  'lease-expired',
  'fence-exhausted',
  'version-conflict',
  'revision-history-capacity',
  'revision-history-rewrite',
  'superseded-revision-reapplied',
  'published-revision-not-reconciled',
  'backlog-capacity-exceeded',
  'backlog-duplicate',
  'backlog-entry-missing',
  'backlog-orphan',
  'state-corrupt',
] as const;
export type LedgerRejectionReason = (typeof ledgerRejectionReasons)[number];

export type LedgerRejection = {
  readonly outcome: 'rejected';
  readonly reason: LedgerRejectionReason;
};

/** The ledger could not be reached, or answered something undecodable. */
export type LedgerUnavailable = {
  readonly outcome: 'unavailable';
};

/**
 * A write whose answer was lost: it may or may not have committed. Never a
 * rejection, so a caller re-reads instead of assuming nothing changed.
 */
export type LedgerUncertain = { readonly outcome: 'uncertain' };

export type LedgerReadOutcome =
  | { readonly outcome: 'read'; readonly snapshot: LedgerSnapshot }
  | LedgerRejection
  | LedgerUnavailable;

export type LeaseAcquisition =
  | {
      readonly outcome: 'acquired';
      readonly lease: LeaseGrant;
      readonly snapshot: LedgerSnapshot;
    }
  | LedgerRejection
  | LedgerUnavailable;

export type LeaseRelease =
  { readonly outcome: 'released' } | LedgerRejection | LedgerUnavailable;

/** One conditional write: `expectedVersion` 0 means "must not exist yet". */
export interface ConditionalWrite<T> {
  readonly expectedVersion: number;
  readonly record: T;
}

export interface BacklogReference {
  readonly round: number;
  readonly revision: RevisionHash;
}

export interface LedgerCommitRequest {
  readonly lease: LeaseToken;
  readonly seasonRecord: ConditionalWrite<SeasonRecord> | null;
  readonly classifications: readonly ConditionalWrite<ClassificationRecord>[];
  readonly backlogInsertions: readonly BacklogReference[];
  readonly backlogRemovals: readonly BacklogReference[];
}

export type LedgerCommitOutcome =
  | {
      readonly outcome: 'committed';
      readonly snapshot: LedgerSnapshot;
    }
  | LedgerRejection
  | LedgerUnavailable
  | LedgerUncertain;

/** One classified round of the authoritative release, and its revision. */
export interface AuthoritativeRevision {
  readonly round: number;
  readonly revision: RevisionHash;
}

export interface PublishedReconciliationRequest {
  readonly lease: LeaseToken;
  /** The authoritative release the revisions were read from. */
  readonly activeVersion: string;
  /** Every classified round of that release. A round not listed has none. */
  readonly revisions: readonly AuthoritativeRevision[];
}

export type PublishedReconciliationOutcome =
  | {
      readonly outcome: 'reconciled';
      readonly snapshot: LedgerSnapshot;
      /** Rounds the release classifies that the ledger holds no record for. */
      readonly unrecordedRounds: readonly number[];
    }
  | LedgerRejection
  | LedgerUnavailable
  | LedgerUncertain;
