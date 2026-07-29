import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz;

import '../preferences/preference_values.dart';
import 'device_time_zone.dart';

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

  /// The calendar day this instant falls on in this clock, e.g. "Sun 26 Jul".
  ///
  /// Kept separate from [time] so a day boundary crossed by a timezone
  /// conversion stays visible instead of being collapsed into a bare clock time.
  String get dayLabel => '$weekday $dayMonth';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DisplayedTime &&
          other.weekday == weekday &&
          other.dayMonth == dayMonth &&
          other.time == time &&
          other.zoneLabel == zoneLabel &&
          other.mode == mode;

  @override
  int get hashCode => Object.hash(weekday, dayMonth, time, zoneLabel, mode);
}

/// A session instant rendered under the active time-display policy.
///
/// [primary] is always the value to lead with. [secondary] is only populated in
/// [TimeDisplayPreference.both], and only when it would actually tell the reader
/// something new — an event whose zone equals the device's produces one value,
/// not the same value printed twice.
class PresentedTime {
  const PresentedTime({required this.primary, this.secondary});

  final DisplayedTime primary;
  final DisplayedTime? secondary;

  /// Whether two distinct clocks are being shown.
  bool get hasBoth => secondary != null;

  /// Whether the two clocks fall on different calendar days.
  ///
  /// The UI uses this to keep the full date visible on both lines rather than
  /// abbreviating the second one, so a conversion that moves a session into the
  /// previous or next day is never hidden.
  bool get crossesDay =>
      secondary != null && secondary!.dayLabel != primary.dayLabel;
}

/// Presents UTC session instants and calendar-only event dates.
///
/// This is the **one** presentation-time policy in the application: every live
/// session-time surface goes through it, so Home, Calendar and Grand Prix can
/// never disagree about which clock they are showing. Widgets never convert
/// instants themselves.
///
/// The rules, in full:
///
/// * [TimeDisplayPreference.device] — the device clock, always.
/// * [TimeDisplayPreference.event] — the event's **declared IANA zone**. A zone
///   is never inferred from a country; a missing or unresolvable zone falls back
///   to the device clock and is labelled as the device clock, so an event-zone
///   value is never claimed that was not actually computed.
/// * [TimeDisplayPreference.both] — the event clock led by the device clock as a
///   second line, collapsing to a single value when the two coincide or when the
///   event zone is unavailable.
///
/// Calendar-only dates are formatted from their date components with no timezone
/// conversion at all, so they never shift. A null instant stays null and is
/// simply not rendered: a missing time never becomes midnight.
class SessionTimePresenter {
  const SessionTimePresenter({
    required this.locale,
    this.preference = TimeDisplayPreference.device,
    this.deviceTimeZone = const DeviceTimeZone.system(),
  });

  final String locale;
  final TimeDisplayPreference preference;
  final DeviceTimeZone deviceTimeZone;

  /// Renders [instant] under the active policy, or `null` for a null instant.
  PresentedTime? present(DateTime? instant, {String? eventTimeZone}) {
    if (instant == null) return null;
    final DateTime utc = instant.toUtc();

    final DisplayedTime device = _device(utc);
    final DisplayedTime? event = _event(utc, eventTimeZone);

    return switch (preference) {
      TimeDisplayPreference.device => PresentedTime(primary: device),
      // With no resolvable event zone there is nothing to show but the device
      // clock — and it is labelled as such.
      TimeDisplayPreference.event => PresentedTime(primary: event ?? device),
      TimeDisplayPreference.both => _both(event, device),
    };
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

  PresentedTime _both(DisplayedTime? event, DisplayedTime device) {
    if (event == null) return PresentedTime(primary: device);
    // Identical output in both clocks is one fact, not two. Printing it twice
    // adds a line and no information.
    if (event.time == device.time &&
        event.dayLabel == device.dayLabel &&
        event.zoneLabel == device.zoneLabel) {
      return PresentedTime(primary: event);
    }
    return PresentedTime(primary: event, secondary: device);
  }

  DisplayedTime? _event(DateTime utc, String? eventTimeZone) {
    final tz.Location? location = tryLocation(eventTimeZone);
    if (location == null) return null;
    return _format(
      tz.TZDateTime.from(utc, location),
      SessionTimeZoneMode.event,
    );
  }

  DisplayedTime _device(DateTime utc) =>
      _format(deviceTimeZone.toDeviceTime(utc), SessionTimeZoneMode.device);

  DisplayedTime _format(DateTime local, SessionTimeZoneMode mode) {
    final String name = local.timeZoneName;
    return DisplayedTime(
      weekday: DateFormat.E(locale).format(local),
      dayMonth: DateFormat.MMMd(locale).format(local),
      // `Hm` follows the locale's own 12/24-hour convention, which is why there
      // is no separate 12/24-hour preference.
      time: DateFormat.Hm(locale).format(local),
      zoneLabel: name.isEmpty ? 'local' : name,
      mode: mode,
    );
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
