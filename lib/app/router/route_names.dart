/// Stable route names used by typed navigation helpers.
///
/// These identifiers are internal and must never be derived from — or shown as
/// — user-facing display names (App Flow: "Display names must never be route
/// identifiers"). Route parameters use stable GridView identifiers, not names.
abstract final class RouteNames {
  static const String home = 'home';
  static const String calendar = 'calendar';
  static const String grandPrix = 'grand-prix';
  static const String standingsDrivers = 'standings-drivers';
  static const String standingsConstructors = 'standings-constructors';
  static const String standings = 'standings';
  static const String explore = 'explore';
  static const String exploreDrivers = 'explore-drivers';
  static const String exploreTeams = 'explore-teams';
  static const String exploreCircuits = 'explore-circuits';
  static const String driver = 'driver';
  static const String constructor = 'constructor';
  static const String circuit = 'circuit';
  static const String settings = 'settings';
  static const String notFound = 'not-found';
}
