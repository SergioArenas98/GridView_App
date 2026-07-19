/// Route path patterns and typed location builders.
///
/// Patterns (with `:param` placeholders) are used to register routes in the
/// [GoRouter]. Builders produce concrete locations from validated values so
/// call sites never hand-concatenate URLs. Parameters are stable GridView
/// identifiers, never display names.
abstract final class RoutePaths {
  // --- Branch roots -------------------------------------------------------
  static const String home = '/';
  static const String calendar = '/calendar';
  static const String explore = '/explore';

  // --- Patterns registered on the router ----------------------------------
  /// Relative to [calendar]; full pattern `/calendar/:season/:round`.
  static const String grandPrixRelative = ':season/:round';
  static const String standingsDriversPattern = '/standings/drivers/:season';
  static const String standingsConstructorsPattern =
      '/standings/constructors/:season';

  /// Relative to [explore].
  static const String exploreDriversRelative = 'drivers';
  static const String exploreTeamsRelative = 'teams';
  static const String exploreCircuitsRelative = 'circuits';

  static const String driverPattern = '/drivers/:driverId';
  static const String constructorPattern = '/constructors/:constructorId';
  static const String circuitPattern = '/circuits/:circuitId';
  static const String settings = '/settings';

  // --- Typed location builders --------------------------------------------
  static String grandPrix({required int season, required int round}) =>
      '/calendar/$season/$round';

  static String standingsDrivers(int season) => '/standings/drivers/$season';

  static String standingsConstructors(int season) =>
      '/standings/constructors/$season';

  static String exploreDrivers() => '/explore/drivers';

  static String exploreTeams() => '/explore/teams';

  static String exploreCircuits() => '/explore/circuits';

  static String driver(String driverId) => '/drivers/$driverId';

  static String constructor(String constructorId) =>
      '/constructors/$constructorId';

  static String circuit(String circuitId) => '/circuits/$circuitId';
}
