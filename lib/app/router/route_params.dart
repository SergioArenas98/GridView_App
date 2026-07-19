/// Validation for route parameters at the navigation boundary.
///
/// Every value that arrives through a URL is untrusted (deep link, restored
/// state, manual entry). These validators return `null` for anything invalid so
/// the router can render a controlled not-found / invalid-route state instead of
/// throwing. They never coerce a bad value into a plausible-looking one.
abstract final class RouteParams {
  RouteParams._();

  // Seasons GridView could plausibly address. Deliberately generous so future
  // seasons deep-link without a code change, but bounded to reject garbage.
  static const int minSeason = 1950;
  static const int maxSeason = 2100;

  // A Grand Prix round within a season. Real calendars are ~24; the ceiling is
  // padded but still rejects absurd values.
  static const int minRound = 1;
  static const int maxRound = 30;

  static const int _maxIdLength = 64;

  /// Lowercase kebab identifiers, prefix-free (e.g. `max-verstappen`,
  /// `spa-francorchamps`). Matches the curated-content ID convention.
  static final RegExp _entityId = RegExp(r'^[a-z0-9]+(?:-[a-z0-9]+)*$');

  /// Parses a season, or `null` if it is not an integer in range.
  static int? season(String? raw) {
    final int? value = int.tryParse(raw ?? '');
    if (value == null || value < minSeason || value > maxSeason) return null;
    return value;
  }

  /// Parses a round, or `null` if it is not an integer in range.
  static int? round(String? raw) {
    final int? value = int.tryParse(raw ?? '');
    if (value == null || value < minRound || value > maxRound) return null;
    return value;
  }

  /// Returns the entity id unchanged when it is a valid kebab identifier, else
  /// `null`. Used for driverId / constructorId / circuitId.
  static String? entityId(String? raw) {
    if (raw == null || raw.isEmpty || raw.length > _maxIdLength) return null;
    if (!_entityId.hasMatch(raw)) return null;
    return raw;
  }
}
