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

/// The localized label for an event status, always non-null.
///
/// Screens that must give **every** status a controlled presentation (the
/// Calendar list, the Grand Prix hero) use this variant: an unrecognised status
/// reads as an explicit "unknown" label rather than silently disappearing.
String requiredEventStatusLabel(AppLocalizations l10n, EventStatus status) =>
    eventStatusLabel(l10n, status) ?? l10n.eventStateUnknown;

/// The localized label for a weekend format, always non-null.
String weekendFormatLabel(AppLocalizations l10n, WeekendFormat format) =>
    switch (format) {
      WeekendFormat.standard => l10n.weekendFormatStandard,
      WeekendFormat.sprint => l10n.weekendFormatSprint,
      WeekendFormat.unknown => l10n.weekendFormatUnknown,
    };

/// The localized label for a classification's status, always non-null.
String resultStatusLabel(AppLocalizations l10n, ResultStatus status) =>
    switch (status) {
      ResultStatus.provisional => l10n.resultStatusProvisional,
      ResultStatus.finalResult => l10n.resultStatusFinal,
      ResultStatus.unavailable => l10n.resultStatusUnavailable,
      ResultStatus.unknown => l10n.resultStatusUnknown,
    };

/// The localized label for a driver's finish status, always non-null.
String finishStatusLabel(AppLocalizations l10n, FinishStatus status) =>
    switch (status) {
      FinishStatus.finished => l10n.finishStatusFinished,
      FinishStatus.lapped => l10n.finishStatusLapped,
      FinishStatus.dnf => l10n.finishStatusDnf,
      FinishStatus.dns => l10n.finishStatusDns,
      FinishStatus.dsq => l10n.finishStatusDsq,
      FinishStatus.dnq => l10n.finishStatusDnq,
      FinishStatus.unknown => l10n.finishStatusUnknown,
    };

/// The design-system tone for a finish status.
GvStatusTone toneForFinishStatus(FinishStatus status) => switch (status) {
  FinishStatus.finished => GvStatusTone.success,
  FinishStatus.lapped => GvStatusTone.info,
  FinishStatus.dnf ||
  FinishStatus.dns ||
  FinishStatus.dsq ||
  FinishStatus.dnq => GvStatusTone.warning,
  FinishStatus.unknown => GvStatusTone.neutral,
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

/// The localized label for a session status, always non-null.
String requiredSessionStatusLabel(
  AppLocalizations l10n,
  SessionStatus status,
) => sessionStatusLabel(l10n, status) ?? l10n.sessionStateUnknown;

/// A session's display name: the supplied name, else a humanised session type,
/// else a localized fallback for a type this app version does not recognise.
/// Formula 1 session names are not translated (TRD §26).
String sessionDisplayName(AppLocalizations l10n, Session session) {
  final String? name = session.name;
  if (name != null && name.isNotEmpty) return name;
  if (session.type == SessionType.unknown) return l10n.sessionNameUnknown;
  return _humanize(session.type.wire);
}

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
      ApiFailureKind.cancelled ||
      ApiFailureKind.configuration ||
      ApiFailureKind.unknown => l10n.errorGeneric,
    };

/// The localized label for a media category.
///
/// An unrecognised category from the contract falls back to a neutral "Image"
/// rather than exposing its wire token: a category is metadata, never copy.
String mediaCategoryLabel(AppLocalizations l10n, MediaCategory category) =>
    switch (category) {
      MediaCategory.portrait => l10n.mediaCategoryPortrait,
      MediaCategory.logo => l10n.mediaCategoryLogo,
      MediaCategory.car => l10n.mediaCategoryCar,
      MediaCategory.circuitLayout => l10n.mediaCategoryCircuitLayout,
      MediaCategory.hero => l10n.mediaCategoryHero,
      MediaCategory.thumbnail => l10n.mediaCategoryThumbnail,
      MediaCategory.unknown => l10n.mediaCategoryOther,
    };
