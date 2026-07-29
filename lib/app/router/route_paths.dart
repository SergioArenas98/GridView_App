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

  /// Standings branch root. Season-agnostic: the screen resolves the active
  /// season from presentation data (and, in later phases, the local database).
  /// No season is encoded here.
  static const String standings = '/standings';

  // --- Patterns registered on the router ----------------------------------
  /// Relative to [calendar]; full pattern `/calendar/:season/:round`.
  static const String grandPrixRelative = ':season/:round';
  static const String standingsDriversPattern = '/standings/drivers/:season';
  static const String standingsConstructorsPattern =
      '/standings/constructors/:season';

  /// Explore's three route-addressable categories.
  ///
  /// They are **siblings** of [explore] rather than children of it, so selecting
  /// a category replaces the Explore page within its branch instead of stacking
  /// a second one on top. [explore] itself is the season-agnostic branch root and
  /// opens the default category.
  static const String exploreDriversPattern = '/explore/drivers';
  static const String exploreTeamsPattern = '/explore/teams';
  static const String exploreCircuitsPattern = '/explore/circuits';

  static const String driverPattern = '/drivers/:driverId';
  static const String constructorPattern = '/constructors/:constructorId';
  static const String circuitPattern = '/circuits/:circuitId';
  static const String settings = '/settings';

  // --- Settings sub-screens ------------------------------------------------
  // Registered as children of [settings] on the root navigator, so each one
  // pushes above the shell and Android back walks straight back to the origin
  // the user opened Settings from.
  static const String settingsLanguageRelative = 'language';
  static const String settingsThemeRelative = 'theme';
  static const String settingsTimeRelative = 'time';
  static const String settingsDataRelative = 'data';
  static const String settingsAcknowledgementsRelative = 'acknowledgements';
  static const String settingsPrivacyRelative = 'privacy';
  static const String settingsAboutRelative = 'about';

  static const String settingsLanguage = '/settings/language';
  static const String settingsTheme = '/settings/theme';
  static const String settingsTime = '/settings/time';
  static const String settingsData = '/settings/data';
  static const String settingsAcknowledgements = '/settings/acknowledgements';
  static const String settingsPrivacy = '/settings/privacy';
  static const String settingsAbout = '/settings/about';

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
