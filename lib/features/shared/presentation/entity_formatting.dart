import 'package:intl/intl.dart';

import '../../../l10n/app_localizations.dart';
import '../domain/entities/enums.dart';
import 'result_formatting.dart';

/// Locale-aware, loss-free formatting for entity profile and collection values.
///
/// It builds on the existing [ResultFormatter] (points, elapsed durations)
/// rather than restating those rules, and follows the same contract: **every
/// helper returns `null` for a missing value**, so a caller simply omits the
/// field. A missing statistic is never rendered as a zero, and a confirmed zero
/// always keeps its zero.
///
/// Nothing here ever falls back to a stable identifier: an unavailable name is
/// localized copy or nothing at all.
class EntityFormatter {
  EntityFormatter(this.locale, this.l10n) : _results = ResultFormatter(locale);

  final String locale;
  final AppLocalizations l10n;
  final ResultFormatter _results;

  /// Championship points, fractional-capable, trailing zeros dropped.
  String? points(double? value) => _results.points(value);

  /// A whole-number statistic (wins, podiums, corners, a year is [year]).
  /// `null` in, `null` out — never `0`.
  String? count(int? value) =>
      value == null ? null : NumberFormat.decimalPattern(locale).format(value);

  /// A calendar year, formatted without digit grouping (`1950`, not `1.950`).
  String? year(int? value) => value?.toString();

  /// A championship position, or the localized unranked label when the
  /// competitor has none. Never `0`, never blank.
  String position(int? value) =>
      value == null ? l10n.positionUnranked : value.toString();

  /// A circuit length: the stored metres converted to a localized kilometre
  /// display. The stored value itself is never modified.
  String? kilometres(int? metres) {
    if (metres == null) return null;
    final String value = NumberFormat.decimalPattern(
      locale,
    ).format(metres / 1000);
    return l10n.lengthKilometers(value);
  }

  /// A lap-record time, using the shared deterministic duration formatter.
  String? lapTime(Duration? value) => _results.elapsed(value);

  /// A driver's role. An unsupplied or unrecognised role reads as an explicit
  /// localized fallback rather than silently disappearing.
  String role(DriverRole? value) => switch (value) {
    DriverRole.race => l10n.driverRoleRace,
    DriverRole.reserve => l10n.driverRoleReserve,
    DriverRole.test => l10n.driverRoleTest,
    DriverRole.unknown || null => l10n.driverRoleUnknown,
  };

  /// A circuit's racing direction. Unknown uses a localized safe fallback.
  String direction(CircuitDirection? value) => switch (value) {
    CircuitDirection.clockwise => l10n.circuitDirectionClockwise,
    CircuitDirection.counterClockwise => l10n.circuitDirectionCounterClockwise,
    CircuitDirection.unknown || null => l10n.circuitDirectionUnknown,
  };

  /// A participation span. Both bounds absent means the whole season; one bound
  /// means a mid-season arrival or exit; both means an exact range. A span is
  /// never flattened into a false "current" statement.
  String participationSpan({int? startRound, int? endRound}) {
    if (startRound == null && endRound == null) {
      return l10n.participationFullSeason;
    }
    if (startRound != null && endRound != null) {
      return l10n.participationRoundRange(startRound, endRound);
    }
    return startRound != null
        ? l10n.participationFromRound(startRound)
        : l10n.participationUntilRound(endRound!);
  }

  /// A calendar-only `YYYY-MM-DD` date, formatted from its components with no
  /// timezone conversion so the shown date never shifts.
  String? calendarDate(String? value) {
    final DateTime? date = _parseCalendarDate(value);
    return date == null ? null : DateFormat.yMMMd(locale).format(date);
  }

  /// A joined detail line, omitting every absent part so a missing value never
  /// leaves a dangling separator.
  static String? joinDetails(List<String?> parts, {String separator = ' · '}) {
    final List<String> present = parts
        .whereType<String>()
        .where((String p) => p.trim().isNotEmpty)
        .toList(growable: false);
    return present.isEmpty ? null : present.join(separator);
  }

  static DateTime? _parseCalendarDate(String? value) {
    if (value == null) return null;
    final List<String> parts = value.split('-');
    if (parts.length != 3) return null;
    final int? y = int.tryParse(parts[0]);
    final int? m = int.tryParse(parts[1]);
    final int? d = int.tryParse(parts[2]);
    if (y == null || m == null || d == null) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return DateTime(y, m, d);
  }
}
