import '../../../core/time/session_time.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/domain/entities/calendar_entry.dart';
import '../../shared/presentation/result_formatting.dart';
import '../domain/home_session_focus.dart';
import '../domain/home_temporal_state.dart';

/// Presentation helpers shared by the Home modules.
///
/// Everything here is a pure mapping from an already-composed read model to
/// plain, already-formatted strings. Nothing is invented: a value the contract
/// did not supply stays `null` and is simply not rendered, and no identifier is
/// ever humanised into a display name.
class HomeFormatter {
  /// [time] is the one application-wide presentation-time policy, supplied by
  /// the caller rather than constructed here, so Home cannot end up applying a
  /// different Device/Event/Both policy from Calendar or Grand Prix.
  HomeFormatter(this.l10n, String locale, SessionTimePresenter time)
    : _numbers = ResultFormatter(locale),
      _time = time;

  final AppLocalizations l10n;
  final ResultFormatter _numbers;
  final SessionTimePresenter _time;

  SessionTimePresenter get time => _time;

  /// A championship points total for display, locale-formatted and never
  /// rounded. Points are required by the contract, so a confirmed zero renders
  /// as zero.
  String points(double value) => l10n.homePointsValue(pointsNumber(value));

  /// The bare locale-formatted points number, without the compact unit.
  ///
  /// Screen readers get the spoken form ("241 points") rather than the compact
  /// visual one ("241 pts"), so the two are deliberately separate.
  String pointsNumber(double value) => _numbers.points(value)!;

  /// The hero's section title for the current temporal phase.
  String heroTitle(HomeTemporalPhase phase) => switch (phase) {
    HomeTemporalPhase.preEvent => l10n.homeNextGrandPrix,
    HomeTemporalPhase.raceWeekend => l10n.homeCurrentGrandPrix,
    HomeTemporalPhase.postRace => l10n.homeLatestGrandPrix,
  };

  /// The label introducing the focused session.
  String sessionFocusLabel(HomeSessionFocus focus) =>
      focus.isLive ? l10n.homeCurrentSession : l10n.homeNextSession;

  /// A deterministic, localized relative-timing label, or `null` when there is
  /// nothing truthful to say.
  ///
  /// This is **never** the only way to read a session time: the explicit
  /// localized date and time are always rendered alongside it. Resolution
  /// coarsens with distance (minutes, then hours, then days) so the label is
  /// stable between rebuilds and needs no timer — Home adds no second-by-second
  /// countdown, no polling and no background clock.
  String? relativeStart(HomeSessionFocus? focus, DateTime now) {
    if (focus == null) return null;
    if (focus.isLive) return l10n.homeLiveNow;
    final DateTime? start = focus.session.startTime;
    // No start time means no timing claim at all — never midnight, never zero.
    if (start == null) return null;
    final Duration remaining = start.difference(now);
    if (remaining.isNegative) return null;
    if (remaining.inMinutes < 1) return l10n.homeStartingSoon;
    if (remaining.inHours < 1) {
      return l10n.homeStartsInMinutes(remaining.inMinutes);
    }
    if (remaining.inDays < 1) return l10n.homeStartsInHours(remaining.inHours);
    return l10n.homeStartsInDays(remaining.inDays);
  }

  /// The circuit / location line for an event, built only from values that
  /// exist. An unresolved circuit contributes nothing rather than an identifier.
  String? locationLine(CalendarEntry entry) {
    final List<String> parts = <String>[
      ?entry.circuitName,
      ?_place(entry.locality, entry.country),
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  /// The weekend's calendar-only date range, with no timezone conversion, so the
  /// shown dates never shift.
  String? dateRange(String? startDate, String? endDate) =>
      _time.formatDateRange(startDate, endDate);

  String? _place(String? locality, String? country) {
    final List<String> parts = <String>[?locality, ?country];
    return parts.isEmpty ? null : parts.join(', ');
  }
}
