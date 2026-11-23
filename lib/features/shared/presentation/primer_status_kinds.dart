import '../../../core/widgets/widgets.dart';
import '../domain/entities/enums.dart';

/// Maps a domain [EventStatus] onto the Primer V2 chip vocabulary (token map
/// §4.7, VS-1) for the screens migrated after Home (Step 55C.2 onward).
///
/// The localized word always comes from `requiredEventStatusLabel`; the kind
/// only chooses the outline, fill and decorative icon, so meaning is never the
/// shape alone. An unknown status is always the dashed outline and is never
/// promoted to a known one, whatever the date. (Home keeps an identical
/// private copy from Step 55C.1, unchanged in this step.)
GvPrimerChipKind primerEventStatusKind(EventStatus status) => switch (status) {
  EventStatus.completed => GvPrimerChipKind.completed,
  EventStatus.inProgress => GvPrimerChipKind.live,
  EventStatus.upcoming || EventStatus.scheduled => GvPrimerChipKind.known,
  EventStatus.postponed => GvPrimerChipKind.postponed,
  EventStatus.cancelled => GvPrimerChipKind.cancelled,
  EventStatus.unknown => GvPrimerChipKind.unknown,
};

/// The Primer V2 chip for a session status on Grand Prix Detail (`gpd.css`
/// S02, Step 55C.12), or `null` where the prototype prints the word as plain
/// secondary text under the session name (Scheduled, Completed).
///
/// Live is the Ember fill; Cancelled and Postponed are the alert outlines
/// with their icons; an unknown session status is the dashed outline (VS-1).
/// The localized word always comes from `requiredSessionStatusLabel`.
GvPrimerChipKind? primerSessionStatusKind(SessionStatus status) =>
    switch (status) {
      SessionStatus.scheduled || SessionStatus.completed => null,
      SessionStatus.live => GvPrimerChipKind.live,
      SessionStatus.cancelled => GvPrimerChipKind.cancelled,
      SessionStatus.postponed => GvPrimerChipKind.postponed,
      SessionStatus.unknown => GvPrimerChipKind.unknown,
    };

/// The Primer V2 chip for a classification status (R02, Step 55C.12): Final
/// is the filled inverse chip with its check; Provisional and Not available
/// are the known outline (word only: no dagger, VS-2 rejected); an unknown
/// status is dashed (VS-1). The word comes from `resultStatusLabel`.
GvPrimerChipKind primerResultStatusKind(ResultStatus status) =>
    switch (status) {
      ResultStatus.finalResult => GvPrimerChipKind.finalResult,
      ResultStatus.provisional ||
      ResultStatus.unavailable => GvPrimerChipKind.known,
      ResultStatus.unknown => GvPrimerChipKind.unknown,
    };

/// The Primer V2 chip for a finish status (R07, Step 55C.12), or `null` for
/// Finished, which is hidden visually and kept in the row's label. Lapped,
/// DNF, DNS, DSQ and DNQ are the known outline; an unknown finish is dashed
/// (VS-1). The word comes from `finishStatusLabel`.
GvPrimerChipKind? primerFinishStatusKind(FinishStatus status) =>
    switch (status) {
      FinishStatus.finished => null,
      FinishStatus.lapped ||
      FinishStatus.dnf ||
      FinishStatus.dns ||
      FinishStatus.dsq ||
      FinishStatus.dnq => GvPrimerChipKind.known,
      FinishStatus.unknown => GvPrimerChipKind.unknown,
    };
