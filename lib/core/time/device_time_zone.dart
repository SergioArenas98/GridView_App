import 'package:timezone/timezone.dart' as tz;

/// The clock the device itself is on, as an injectable conversion.
///
/// Production uses [DeviceTimeZone.system], which defers to the platform and so
/// handles the device's own daylight-saving transitions correctly for instants
/// arbitrarily far in the future. Tests and goldens use [DeviceTimeZone.iana] to
/// pin an exact zone, because `DateTime.toLocal()` would otherwise make every
/// rendered session time depend on the host machine — a developer in Madrid and
/// a CI runner in UTC would produce different pixels for the same fixture.
///
/// A pinned zone that cannot be resolved falls back to the platform clock rather
/// than throwing: an unusable zone name must never be able to break time
/// rendering.
class DeviceTimeZone {
  /// The platform's own local time zone.
  const DeviceTimeZone.system() : _ianaName = null;

  /// A pinned IANA zone, e.g. `Europe/Madrid`.
  const DeviceTimeZone.iana(String name) : _ianaName = name;

  final String? _ianaName;

  /// Converts a UTC [instant] to the device clock.
  DateTime toDeviceTime(DateTime instant) {
    final DateTime utc = instant.toUtc();
    final String? name = _ianaName;
    if (name != null) {
      final tz.Location? location = tryLocation(name);
      if (location != null) return tz.TZDateTime.from(utc, location);
    }
    return utc.toLocal();
  }
}

/// Resolves an IANA zone name, or `null` when it is unknown or malformed.
///
/// A time zone only ever comes from an explicit IANA name — never inferred from
/// a country — so an unresolvable one simply means "no event zone".
tz.Location? tryLocation(String? name) {
  if (name == null || name.isEmpty) return null;
  try {
    return tz.getLocation(name);
  } on Object {
    return null;
  }
}
