import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz;

/// Which clock a session time is presented in.
enum SessionTimeZoneMode {
  /// The event-local IANA timezone (e.g. `Europe/Brussels`).
  event,

  /// The user's device-local timezone.
  device,
}

/// A formatted, timezone-labelled session time. All fields are already
/// localised; [zoneLabel] and [mode] let the UI state which clock is shown.
class DisplayedTime {
  const DisplayedTime({
    required this.weekday,
    required this.dayMonth,
    required this.time,
    required this.zoneLabel,
    required this.mode,
  });

  final String weekday; // e.g. "Sun"
  final String dayMonth; // e.g. "26 Jul"
  final String time; // e.g. "15:00"
  final String zoneLabel; // e.g. "CEST"
  final SessionTimeZoneMode mode;
}

/// Presents UTC session instants and calendar-only event dates.
///
/// Instants are converted to the requested clock; the default deterministic
/// rule is event-local time when the event timezone is known and resolvable,
/// otherwise the device clock. Time zones are only ever taken from the explicit
/// IANA zone — never inferred from a country. Calendar-only dates are formatted
/// from their date components with no timezone conversion, so they never shift.
class SessionTimePresenter {
  const SessionTimePresenter({
    required this.locale,
    this.preferred = SessionTimeZoneMode.event,
  });

  final String locale;
  final SessionTimeZoneMode preferred;

  /// Formats a UTC [instant] in the event zone (when [eventTimeZone] resolves)
  /// or the device zone. Returns `null` for a null instant.
  DisplayedTime? formatInstant(DateTime? instant, {String? eventTimeZone}) {
    if (instant == null) return null;
    final DateTime utc = instant.toUtc();

    if (preferred == SessionTimeZoneMode.event && eventTimeZone != null) {
      final tz.Location? location = _tryLocation(eventTimeZone);
      if (location != null) {
        final tz.TZDateTime local = tz.TZDateTime.from(utc, location);
        return DisplayedTime(
          weekday: DateFormat.E(locale).format(local),
          dayMonth: DateFormat.MMMd(locale).format(local),
          time: DateFormat.Hm(locale).format(local),
          zoneLabel: local.timeZoneName,
          mode: SessionTimeZoneMode.event,
        );
      }
    }

    final DateTime device = utc.toLocal();
    return DisplayedTime(
      weekday: DateFormat.E(locale).format(device),
      dayMonth: DateFormat.MMMd(locale).format(device),
      time: DateFormat.Hm(locale).format(device),
      zoneLabel: _deviceLabel(device),
      mode: SessionTimeZoneMode.device,
    );
  }

  /// Formats a calendar-only event date range (`YYYY-MM-DD` strings) with no
  /// timezone conversion, so the shown dates never shift.
  String? formatDateRange(String? startDate, String? endDate) {
    final DateTime? start = _parseCalendarDate(startDate);
    final DateTime? end = _parseCalendarDate(endDate);
    if (start == null && end == null) return null;
    final DateFormat fmt = DateFormat.MMMEd(locale);
    if (start != null && end != null) {
      if (start == end) return fmt.format(start);
      return '${DateFormat.MMMd(locale).format(start)} – ${fmt.format(end)}';
    }
    return fmt.format((start ?? end)!);
  }

  tz.Location? _tryLocation(String zone) {
    try {
      return tz.getLocation(zone);
    } catch (_) {
      return null;
    }
  }

  String _deviceLabel(DateTime deviceLocal) {
    final String name = deviceLocal.timeZoneName;
    return name.isEmpty ? 'local' : name;
  }

  /// Parses a `YYYY-MM-DD` calendar date into a plain local date (components
  /// only). Never applies timezone conversion. Returns `null` for null/invalid.
  DateTime? _parseCalendarDate(String? value) {
    if (value == null) return null;
    final List<String> parts = value.split('-');
    if (parts.length != 3) return null;
    final int? y = int.tryParse(parts[0]);
    final int? m = int.tryParse(parts[1]);
    final int? d = int.tryParse(parts[2]);
    if (y == null || m == null || d == null) return null;
    return DateTime(y, m, d);
  }
}
