import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';

void main() {
  test('season-scoped keys use the documented canonical form', () {
    expect(ResourceKey.home(2026), 'home:2026');
    expect(ResourceKey.calendar(2026), 'calendar:2026');
    expect(ResourceKey.driverStandings(2026), 'standings:drivers:2026');
    expect(
      ResourceKey.constructorStandings(2026),
      'standings:constructors:2026',
    );
    expect(ResourceKey.drivers(2026), 'drivers:2026');
    expect(
      ResourceKey.driver('max-verstappen', 2026),
      'driver:max-verstappen:2026',
    );
    expect(ResourceKey.constructors(2026), 'constructors:2026');
    expect(
      ResourceKey.constructor('ferrari', 2026),
      'constructor:ferrari:2026',
    );
    expect(ResourceKey.circuits(2026), 'circuits:2026');
    expect(
      ResourceKey.circuit('spa-francorchamps', 2026),
      'circuit:spa-francorchamps:2026',
    );
    expect(ResourceKey.grandPrix(2026, 13), 'grand-prix:2026:13');
    expect(
      ResourceKey.grandPrixResults(2026, 13),
      'grand-prix-results:2026:13',
    );
  });

  test('every season-scoped key differs across two seasons (no collision)', () {
    List<String> keysFor(int season) => <String>[
      ResourceKey.home(season),
      ResourceKey.calendar(season),
      ResourceKey.driverStandings(season),
      ResourceKey.constructorStandings(season),
      ResourceKey.drivers(season),
      ResourceKey.driver('max-verstappen', season),
      ResourceKey.constructors(season),
      ResourceKey.constructor('ferrari', season),
      ResourceKey.circuits(season),
      ResourceKey.circuit('spa-francorchamps', season),
      ResourceKey.grandPrix(season, 13),
      ResourceKey.grandPrixResults(season, 13),
    ];

    final List<String> k2025 = keysFor(2025);
    final List<String> k2026 = keysFor(2026);

    // No key from 2025 equals any key from 2026.
    expect(k2025.toSet().intersection(k2026.toSet()), isEmpty);
    // Each position differs across the two seasons.
    for (int i = 0; i < k2025.length; i++) {
      expect(k2025[i], isNot(k2026[i]));
    }
    // The same entity in two seasons yields distinct, season-embedded keys.
    expect(
      ResourceKey.driver('max-verstappen', 2025),
      isNot(ResourceKey.driver('max-verstappen', 2026)),
    );
  });
}
