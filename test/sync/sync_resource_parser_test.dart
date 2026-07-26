import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/sync/domain/sync_resource.dart';
import 'package:gridview/features/sync/domain/sync_resource_parser.dart';

void main() {
  group('canonical keys round-trip', () {
    final Map<String, SyncResource> cases = <String, SyncResource>{
      ResourceKey.bootstrap(): const BootstrapSyncResource(),
      ResourceKey.currentSeason(): const CurrentSeasonSyncResource(),
      ResourceKey.season(2026): const SeasonMetadataSyncResource(2026),
      ResourceKey.home(): const HomeSyncResource(),
      ResourceKey.calendar(2026): const CalendarSyncResource(2026),
      ResourceKey.driverStandings(2026): const DriverStandingsSyncResource(
        2026,
      ),
      ResourceKey.constructorStandings(2026):
          const ConstructorStandingsSyncResource(2026),
      ResourceKey.drivers(2026): const SeasonDriversSyncResource(2026),
      ResourceKey.constructors(2026): const SeasonConstructorsSyncResource(
        2026,
      ),
      ResourceKey.circuits(2026): const SeasonCircuitsSyncResource(2026),
      ResourceKey.contentManifest(): const ContentManifestSyncResource(),
      ResourceKey.grandPrix(2026, 13): const GrandPrixSyncResource(2026, 13),
      ResourceKey.grandPrixResults(2026, 13):
          const GrandPrixResultsSyncResource(2026, 13),
      ResourceKey.driver('max-verstappen', 2026):
          const DriverDetailSyncResource('max-verstappen', 2026),
      ResourceKey.constructor('red-bull', 2026):
          const ConstructorDetailSyncResource('red-bull', 2026),
      ResourceKey.circuit('spa-francorchamps', 2026):
          const CircuitDetailSyncResource('spa-francorchamps', 2026),
    };

    cases.forEach((String key, SyncResource expected) {
      test('$key parses to ${expected.runtimeType}', () {
        final SyncResource parsed = SyncResourceParser.parse(key);
        expect(parsed.runtimeType, expected.runtimeType);
        expect(parsed.key, key, reason: 'the key must round-trip exactly');
        expect(parsed.season, expected.season);
      });
    });
  });

  group('unknown and malformed keys are survivable', () {
    const List<String> bad = <String>[
      '',
      'nonsense',
      'season',
      'season:',
      'season:not-a-year',
      'season:1800',
      'season:2200',
      'home',
      'home:2026',
      'calendar:2026:extra',
      'standings:teams:2026',
      'standings:drivers',
      'content:other',
      'bootstrap:2026',
      'grand-prix:2026',
      'grand-prix:2026:0',
      'grand-prix:2026:31',
      'grand-prix:2026:abc',
      'driver:Max Verstappen:2026',
      'driver:max-verstappen',
      'circuit::2026',
      // An additive key a newer app version might introduce.
      'weather:2026:13',
    ];

    for (final String key in bad) {
      test('"$key" resolves to an unsupported resource', () {
        final SyncResource parsed = SyncResourceParser.parse(key);
        expect(parsed, isA<UnsupportedSyncResource>());
        expect(parsed.isAutomaticCore, isFalse);
        expect(parsed.key, key, reason: 'the stored key is preserved verbatim');
      });
    }
  });

  group('automatic vs on-demand eligibility', () {
    test('core current-season resources are automatic', () {
      for (final String key in <String>[
        ResourceKey.currentSeason(),
        ResourceKey.season(2026),
        ResourceKey.home(),
        ResourceKey.calendar(2026),
        ResourceKey.driverStandings(2026),
        ResourceKey.constructorStandings(2026),
        ResourceKey.drivers(2026),
        ResourceKey.constructors(2026),
        ResourceKey.circuits(2026),
        ResourceKey.contentManifest(),
      ]) {
        expect(
          SyncResourceParser.parse(key).isAutomaticCore,
          isTrue,
          reason: '$key is part of the automatic core set',
        );
      }
    });

    test('details and bootstrap are never swept automatically', () {
      for (final String key in <String>[
        ResourceKey.bootstrap(),
        ResourceKey.grandPrix(2026, 13),
        ResourceKey.grandPrixResults(2026, 13),
        ResourceKey.driver('max-verstappen', 2026),
        ResourceKey.constructor('red-bull', 2026),
        ResourceKey.circuit('spa-francorchamps', 2026),
      ]) {
        expect(
          SyncResourceParser.parse(key).isAutomaticCore,
          isFalse,
          reason: '$key stays on demand',
        );
      }
    });
  });
}
