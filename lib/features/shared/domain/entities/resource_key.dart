/// Builds the canonical resource keys used by [ResourceSyncState] and the
/// `resource_sync_metadata` table.
///
/// Every season-scoped resource embeds its season, so keys never collide across
/// seasons (`home:2025` vs `home:2026`, `driver:max-verstappen:2025` vs
/// `driver:max-verstappen:2026`). Keys are assembled from stable identifiers
/// only — never a display name — through this single builder rather than
/// hand-assembled strings scattered across the codebase.
class ResourceKey {
  const ResourceKey._();

  static String home(int season) => 'home:$season';

  static String calendar(int season) => 'calendar:$season';

  static String driverStandings(int season) => 'standings:drivers:$season';

  static String constructorStandings(int season) =>
      'standings:constructors:$season';

  static String drivers(int season) => 'drivers:$season';

  static String driver(String driverId, int season) =>
      'driver:$driverId:$season';

  static String constructors(int season) => 'constructors:$season';

  static String constructor(String constructorId, int season) =>
      'constructor:$constructorId:$season';

  static String circuits(int season) => 'circuits:$season';

  static String circuit(String circuitId, int season) =>
      'circuit:$circuitId:$season';

  static String grandPrix(int season, int round) => 'grand-prix:$season:$round';

  static String grandPrixResults(int season, int round) =>
      'grand-prix-results:$season:$round';
}
