import '../../../core/api/errors/api_failure.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/entities/enums.dart';
import '../domain/entities/session.dart';

/// Maps a domain [EventStatus] to a design-system status tone. Meaning is always
/// reinforced by the localized label, never carried by colour alone.
GvStatusTone toneForEventStatus(EventStatus status) => switch (status) {
  EventStatus.completed => GvStatusTone.success,
  EventStatus.inProgress => GvStatusTone.live,
  EventStatus.upcoming || EventStatus.scheduled => GvStatusTone.info,
  EventStatus.postponed || EventStatus.cancelled => GvStatusTone.warning,
  EventStatus.unknown => GvStatusTone.neutral,
};

/// The localized label for an event status, or `null` when unknown (no chip).
String? eventStatusLabel(AppLocalizations l10n, EventStatus status) =>
    switch (status) {
      EventStatus.completed => l10n.eventStateCompleted,
      EventStatus.inProgress => l10n.eventStateLive,
      EventStatus.upcoming => l10n.eventStateUpcoming,
      EventStatus.scheduled => l10n.eventStateScheduled,
      EventStatus.postponed => l10n.eventStatePostponed,
      EventStatus.cancelled => l10n.eventStateCancelled,
      EventStatus.unknown => null,
    };

/// The localized label for a session status, or `null` when unknown.
String? sessionStatusLabel(AppLocalizations l10n, SessionStatus status) =>
    switch (status) {
      SessionStatus.scheduled => l10n.sessionStateScheduled,
      SessionStatus.live => l10n.eventStateLive,
      SessionStatus.completed => l10n.sessionStateCompleted,
      SessionStatus.cancelled => l10n.eventStateCancelled,
      SessionStatus.postponed => l10n.eventStatePostponed,
      SessionStatus.unknown => null,
    };

/// A session's display name: the supplied name, else a humanised session type.
/// Formula 1 session names are not translated (TRD §26).
String sessionDisplayName(Session session) =>
    session.name ?? _humanize(session.type.wire);

String _humanize(String token) => token
    .split('_')
    .map((String w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
    .join(' ');

/// The localized, user-safe message for a typed failure. Raw server text, Dio
/// exceptions and stack traces never reach the UI (TRD §20.1).
String failureMessage(AppLocalizations l10n, ApiFailure failure) =>
    switch (failure.kind) {
      ApiFailureKind.networkUnavailable => l10n.errorOffline,
      ApiFailureKind.networkTimeout => l10n.errorTimeout,
      ApiFailureKind.rateLimited ||
      ApiFailureKind.serverUnavailable ||
      ApiFailureKind.maintenance => l10n.errorServer,
      ApiFailureKind.notFound => l10n.errorNotFound,
      ApiFailureKind.unsupportedApiVersion => l10n.errorUnsupported,
      ApiFailureKind.invalidResponse ||
      ApiFailureKind.invalidRequest ||
      ApiFailureKind.unknown => l10n.errorGeneric,
    };
