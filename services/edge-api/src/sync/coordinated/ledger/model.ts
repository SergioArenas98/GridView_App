/**
 * The G9 reconciliation ledger's closed, versioned record model (ADR 0020
 * obligations 2 and 3; runtime activation decision O-6).
 *
 * **Storage only.** These types say what the ledger may hold and which
 * outcomes its operations report. They encode no §10.4.1 transition,
 * corroboration, settling, due-work planning or publication decision. Those
 * are the pure policy in `../policy/`, which computes new records that commit
 * through this storage.
 *
 * Schema version 1 was refined in place by PR-C2, before any record was ever
 * stored: the class has never been registered, bound or provisioned in any
 * environment, so no reader of the earlier shape exists. The refinement added
 * `ClassificationRecord.contentRevision` and `SeasonRecord.calendarAnchors`.
 * PR-C4 refined it again, on the same grounds, with the season's publication
 * state: `lastOrderingInput`, `lastPublication` and `publicationDisposition`.
 * PR-E1 refined it a third time, on the same grounds (re-verified at
 * `383d8aa`), with the operator state: `SeasonRecord.operatorHold`,
 * `durableBlock` and `lastOperatorAction`, and
 * `ClassificationRecord.lastDisposition`. PR-E3 refined it a fourth time, on
 * the same grounds (re-verified at `086ed06`), with
 * `ClassificationRecord.lastVerification`. After the first deploy that
 * resolves a ledger, any change needs a versioned decoder and a migration
 * decision instead.
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
 * The backlog count at which an operator is warned, before capacity (OD-8:
 * 48 of the 60 slots). The attention line raises it after every scheduled
 * run (`../operator/attention.ts`, PR-E2).
 */
export const BACKLOG_WARNING_THRESHOLD = 48;

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
 * A client-generated UUID v4, lowercase, naming one operator action. It is
 * what makes a resent action idempotent; it identifies the action, never who
 * took it.
 */
export type OperationId = string;

/**
 * How an operator action was authenticated (OD-2). `shared-admin-token` is
 * the one bearer token every operator shares (ADR 0009), so it names a method
 * and **identifies no individual**. The token itself is never stored.
 */
export const operatorAuthMethods = ['shared-admin-token'] as const;
export type OperatorAuthMethod = (typeof operatorAuthMethods)[number];

/**
 * The §10.4.1 T12 dispositions (OD-4):
 *
 * - `accept-staged` / `accept-competing`: that revision becomes the accepted
 *   content, and the displaced accepted revision joins the superseded
 *   history.
 * - `retain-published` ("keep published"): the accepted content stays, and
 *   the exact staged revision joins the superseded history, so it is
 *   rejected permanently. A different later revision follows the normal
 *   review rules.
 */
export const dispositionActions = [
  'accept-staged',
  'accept-competing',
  'retain-published',
] as const;
export type DispositionAction = (typeof dispositionActions)[number];

/** The last T12 disposition of a resource: replay detection and audit. */
export interface DispositionRecord {
  readonly operationId: OperationId;
  readonly action: DispositionAction;
  readonly at: LedgerInstant;
  readonly authMethod: OperatorAuthMethod;
  /** The staged revision the disposition decided. */
  readonly stagedRevision: RevisionHash;
}

/**
 * What one operator verification found and did (Provider Evaluation §10.4.1
 * T11-T11c, with T5 and T6; PR-E3). Closed, and evaluated in this order:
 *
 * - `superseded-rejected` (T5): a revision in the superseded history. It is
 *   never tracked; a pending candidate is discarded and the confirmation
 *   count is reset, as T5 does everywhere.
 * - `accepted-seen` / `staged-seen` (T11): the accepted or the staged revision
 *   again. Nothing durable changes.
 * - `candidate-corroborated` (T11b): the pending candidate again, on a later
 *   verification. It becomes the competing correction, and the record is
 *   locked for review.
 * - `candidate-observed` (T11): any other revision, first sighting. It is
 *   only the candidate: one sighting never stages anything.
 * - `candidate-discarded` / `candidate-replaced` (T11c): a candidate is
 *   pending and something else was seen - the accepted or staged revision
 *   (discarded), or a third revision (it replaces the candidate).
 * - `check-failed` (T6): the request failed. No revision, candidate, slot or
 *   counter changes; only the attempt is recorded.
 */
export const verificationTransitions = [
  'superseded-rejected',
  'accepted-seen',
  'staged-seen',
  'candidate-corroborated',
  'candidate-observed',
  'candidate-discarded',
  'candidate-replaced',
  'check-failed',
] as const;
export type VerificationTransition = (typeof verificationTransitions)[number];

/**
 * The last completed operator verification of a resource: replay detection
 * and audit. A limiter deferral is not a completed verification and is never
 * recorded here.
 */
export interface VerificationRecord {
  readonly operationId: OperationId;
  readonly at: LedgerInstant;
  readonly authMethod: OperatorAuthMethod;
  /** The staged revision the verification was asked against. */
  readonly stagedRevision: RevisionHash;
  readonly transition: VerificationTransition;
}

/**
 * One race classification resource, key `classification:{season}:{round}`.
 *
 * `publishedRevision` is a **cache** of the authoritative release. An ordinary
 * commit can never change it; only `reconcilePublishedRevisions`, which takes
 * its values from the authoritative release, writes it. The ledger is never a
 * second publication authority.
 *
 * `contentRevision` is the revision the §10.4.1 machine has **accepted** for
 * the resource: what Provider Evaluation §10.4.1 calls the published revision,
 * and ADR 0020 names `contentRevision`. It is set by a first write (T0) or a
 * corroborated change (T3) and is what a publication candidate must carry. It
 * differs from `publishedRevision` until a publication that carries it has
 * been applied and reconciled, or after a rollback.
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
  readonly contentRevision: RevisionHash | null;
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
  /** Written only by the T12 `dispose` operation, never by a commit. */
  readonly lastDisposition: DispositionRecord | null;
  /** Written only by the `verify` operation (T11-T11c), never by a commit. */
  readonly lastVerification: VerificationRecord | null;
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

/**
 * One race's Jolpica anchor from the last observed calendar: the scheduled
 * race start (`date-time`), or its date at 23:59:59 UTC when the start time
 * is absent (`date-eod`). An instant and a round, never a name or a locator.
 */
export interface CalendarAnchor {
  readonly round: number;
  readonly anchor: LedgerInstant;
  readonly anchorKind: AnchorKind;
}

/**
 * The last release the coordinated runtime itself published for a season, or
 * confirmed unchanged (runtime activation decision O-12).
 *
 * `digest` is the candidate digest - sorted document names and snapshot
 * revisions - and `activeVersion` the release that carried it. Recorded by an
 * outcome commit from the sequencer's own answer, never by reconciliation, and
 * never a substitute for the authority: the no-change gate skips only while
 * the authority still serves exactly `activeVersion`.
 */
export interface LastPublication {
  readonly digest: RevisionHash;
  readonly activeVersion: string;
  readonly publishedAt: LedgerInstant;
  /** The last run that found the candidate unchanged, or published it. */
  readonly confirmedAt: LedgerInstant;
}

/**
 * Why a season's publication is held for an operator rather than retried on
 * a timer. Closed and bounded: withholding or refusal reasons that retrying
 * cannot change.
 */
export const publicationBlockReasons = [
  /** A staged correction awaits disposition (O-5(a)). */
  'classification-staged',
  /** A competing correction locked a record for review. */
  'classification-review-locked',
  /** ADR 0026 D14: the candidate drops a classified round. */
  'guard-round-coverage-regression',
  /** ADR 0026 D15: the candidate drops a participation fact. */
  'guard-participation-fact-removed',
  /** ADR 0026 D15: the candidate names another constructor for a fact. */
  'guard-constructor-replaced',
  'guard-candidate-invalid',
  'guard-predecessor-invalid',
  /** The season is not active on the sequencer. */
  'guard-authority-not-sequenced',
  /** A generated document failed contract validation. */
  'contract-validation',
  /** The generator could not build the candidate. */
  'generation-failed',
  /** A reference between curated and observed identities did not resolve. */
  'inconsistent-references',
  /** No curated season metadata exists for the season (O-14). */
  'metadata-unavailable',
] as const;
export type PublicationBlockReason = (typeof publicationBlockReasons)[number];

/**
 * A season's unfinished or held publication, bounded to one slot.
 *
 * - `publishing`: a publication run committed its observations and has not
 *   committed its outcome. `digest` and `orderingInput` are set, together,
 *   only once the run reserved its ordering input immediately before calling
 *   the guarded publisher; before that the run never reached it. The next run
 *   resolves this slot against the authority before planning anything.
 * - `blocked`: publication is held for operator action; no due time is set
 *   for it, so it is never retried on a timer. **Transient**: every run
 *   re-derives it from the records and the guard, and a later run that
 *   completes clears it. A stop that must survive runs is `operatorHold` or
 *   `durableBlock` instead, which no publication run can clear.
 */
export type PublicationDisposition =
  | {
      readonly state: 'publishing';
      readonly since: LedgerInstant;
      readonly digest: RevisionHash | null;
      readonly orderingInput: LedgerInstant | null;
    }
  | {
      readonly state: 'blocked';
      readonly since: LedgerInstant;
      readonly reason: PublicationBlockReason;
    };

/**
 * A deliberate operator hold on a season's publication (OD-3). Set and
 * cleared only by an explicit operator action; while set, no path publishes.
 */
export interface OperatorHold {
  readonly since: LedgerInstant;
  readonly operationId: OperationId;
}

/**
 * Why a season's publication stopped until an operator acts (OD-5). Each is a
 * condition that retrying on a timer could not change and that would
 * otherwise loop hourly:
 *
 * - `classification-superseded`: upstream serves a revision the ledger
 *   superseded, for a settled round. D2.2 keeps it rejected (OD-6).
 * - `backlog-capacity-exceeded`: a correction could not be staged because
 *   the global backlog was full.
 */
export const durableBlockReasons = [
  'classification-superseded',
  'backlog-capacity-exceeded',
] as const;
export type DurableBlockReason = (typeof durableBlockReasons)[number];

/**
 * A stop a run records and only an operator clears. An ordinary commit may
 * set it, never change or clear it.
 */
export interface DurableBlock {
  readonly since: LedgerInstant;
  readonly reason: DurableBlockReason;
}

/** The season-level operator actions (OD-3, OD-5). */
export const seasonOperatorActions = [
  'hold',
  'release-hold',
  'clear-block',
] as const;
export type SeasonOperatorAction = (typeof seasonOperatorActions)[number];

/** The last season-level operator action: replay detection and audit. */
export interface OperatorActionRecord {
  readonly operationId: OperationId;
  readonly action: SeasonOperatorAction;
  readonly at: LedgerInstant;
  readonly authMethod: OperatorAuthMethod;
}

/** One season's refresh state, key `season:{season}`. */
export interface SeasonRecord {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION;
  readonly kind: 'season';
  readonly season: number;
  readonly refresh: Readonly<Record<RefreshResource, RefreshRecord>>;
  readonly publicationDueAt: LedgerInstant | null;
  /**
   * The race anchors of the last successful calendar observation, sorted by
   * round, or `null` when no calendar has been observed yet. The planner
   * schedules from these, never from a calendar read in the same run.
   */
  readonly calendarAnchors: readonly CalendarAnchor[] | null;
  /**
   * The last release-wide `sourceOrderingInput` this season reserved (O-13).
   * The store refuses any write that does not strictly increase it, so two
   * reservations can never share or reverse an ordering value, whatever the
   * run's clock did.
   */
  readonly lastOrderingInput: LedgerInstant | null;
  readonly lastPublication: LastPublication | null;
  readonly publicationDisposition: PublicationDisposition | null;
  /**
   * The operator hold, independent of the transient disposition above: a
   * run that marks the season `publishing`, crashes or completes leaves it
   * exactly as it was. Written only by the operator action.
   */
  readonly operatorHold: OperatorHold | null;
  /** Set by a run, cleared only by the operator action. */
  readonly durableBlock: DurableBlock | null;
  /** Written only by the operator action. */
  readonly lastOperatorAction: OperatorActionRecord | null;
}

/**
 * One operator-review backlog entry, key `backlog:{season}:{round}`.
 *
 * At most one per classification resource, so the capacity counts resources
 * (ADR 0020 §4). `revision` is the staged correction the entry was made for;
 * a competing correction is held on the classification record, never as a
 * second entry.
 */
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
  /** A backlog entry without its newly staged slot, or the reverse. */
  'backlog-staged-mismatch',
  'ordering-input-regression',
  /**
   * D2.5: a commit would clear or change a staged or competing correction,
   * write a disposition, or remove a backlog entry. Only `dispose` may.
   */
  'staged-correction-immutable',
  /** A commit would set, change or clear operator state it may not. */
  'operator-state-immutable',
  /** A publication reservation while a hold or durable block is set. */
  'publication-stopped',
  /** An operation ID already used for a different action. */
  'operation-id-reused',
  /** The record is not in the state the operator action requires. */
  'operator-precondition-failed',
  /**
   * The record already holds a competing correction (`review_locked`), so a
   * verification can only report, and is refused instead (T11d).
   */
  'review-locked',
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

/**
 * One season-level operator action. Fenced by the lease, conditional on the
 * season record version the operator inspected (0: no record yet).
 */
export interface OperatorActionRequest {
  readonly lease: LeaseToken;
  readonly action: SeasonOperatorAction;
  readonly operationId: OperationId;
  readonly authMethod: OperatorAuthMethod;
  readonly expectedVersion: number;
}

/**
 * One T12 disposition. Every `expected` value must equal the stored record,
 * so an operator decides exactly the state they inspected.
 */
export interface DispositionRequest {
  readonly lease: LeaseToken;
  readonly round: number;
  readonly action: DispositionAction;
  readonly operationId: OperationId;
  readonly authMethod: OperatorAuthMethod;
  readonly expected: {
    readonly recordVersion: number;
    readonly contentRevision: RevisionHash;
    readonly stagedRevision: RevisionHash;
    readonly competingRevision: RevisionHash | null;
  };
}

/**
 * What one verification request observed, in the policy's closed vocabulary.
 * A deferral was not attempted: it records only the limiter's retry instant.
 */
export type VerificationObservation =
  | { readonly status: 'observed'; readonly revision: RevisionHash }
  | { readonly status: 'failed' }
  | { readonly status: 'deferred'; readonly retryAt: LedgerInstant };

/**
 * One operator verification of one staged classification resource (T11-T11c).
 * `expected` names the record the operator asked about; a record that moved
 * on is refused, not verified.
 */
export interface VerificationRequest {
  readonly lease: LeaseToken;
  readonly round: number;
  readonly operationId: OperationId;
  readonly authMethod: OperatorAuthMethod;
  readonly expected: {
    readonly recordVersion: number;
    readonly stagedRevision: RevisionHash;
  };
  readonly observation: VerificationObservation;
}

/**
 * What an operator transition did. `already-applied` is a resent operation
 * ID: nothing was written, and the snapshot is the current state.
 */
export type OperatorTransitionOutcome =
  | {
      readonly outcome: 'applied' | 'already-applied';
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
