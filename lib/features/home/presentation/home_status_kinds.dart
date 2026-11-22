import '../../../core/widgets/widgets.dart';
import '../../shared/domain/entities/enums.dart';

/// Maps Home's domain statuses onto the Primer V2 chip vocabulary (token map
/// §4.7, VS-1). The localized word always comes from the existing formatter;
/// the kind only chooses the outline, fill and decorative icon, so meaning is
/// never carried by the shape alone. An unknown value is always the dashed
/// outline and is never promoted to a known state.

GvPrimerChipKind homeEventStatusKind(EventStatus status) => switch (status) {
  EventStatus.completed => GvPrimerChipKind.completed,
  EventStatus.inProgress => GvPrimerChipKind.live,
  EventStatus.upcoming || EventStatus.scheduled => GvPrimerChipKind.known,
  EventStatus.postponed => GvPrimerChipKind.postponed,
  EventStatus.cancelled => GvPrimerChipKind.cancelled,
  EventStatus.unknown => GvPrimerChipKind.unknown,
};

GvPrimerChipKind homeSessionStatusKind(SessionStatus status) =>
    switch (status) {
      SessionStatus.scheduled => GvPrimerChipKind.known,
      SessionStatus.live => GvPrimerChipKind.live,
      SessionStatus.completed => GvPrimerChipKind.completed,
      SessionStatus.cancelled => GvPrimerChipKind.cancelled,
      SessionStatus.postponed => GvPrimerChipKind.postponed,
      SessionStatus.unknown => GvPrimerChipKind.unknown,
    };

/// Whether the latest-result section's "Final" chip already says everything
/// its event-status chip would: only a **completed** event whose stored
/// classification is **final**. Every other pairing keeps both chips, so an
/// unknown, postponed or cancelled event, or a provisional, unavailable or
/// unknown classification, is never hidden. Presentation only: the stored
/// statuses are unchanged.
bool homeFinalResultCoversEvent(EventStatus event, ResultStatus? result) =>
    event == EventStatus.completed && result == ResultStatus.finalResult;

GvPrimerChipKind homeResultStatusKind(ResultStatus status) => switch (status) {
  ResultStatus.finalResult => GvPrimerChipKind.finalResult,
  ResultStatus.provisional ||
  ResultStatus.unavailable => GvPrimerChipKind.known,
  ResultStatus.unknown => GvPrimerChipKind.unknown,
};
