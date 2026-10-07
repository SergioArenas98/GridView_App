import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/circuit_dto.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/summary_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/shared/application/fixture_data_identity_provider.dart';
import 'package:gridview/features/shared/data/remote/fixture_gridview_api.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/fixture_data_identity.dart';

/// The bundled fixtures, through the same `FixtureGridViewApi` -> envelope ->
/// DTO path a `DATA_SOURCE=fixture` build uses.
///
/// In the repository this covers the committed sample fixtures. The frozen
/// test-APK build procedure runs this same file inside its throwaway export,
/// after injecting converted fixtures, so every converted file is proved to
/// load into its DTO, and the set is proved complete, before an APK is built.

const String _dir = 'assets/dev_fixtures/';

/// The committed sample fixtures: hand-written mock data.
const Set<String> _sampleFixtures = <String>{
  'grand-prix-2026-12.json',
  'grand-prix-2026-13.json',
  'home.json',
};

typedef _Load = Future<RemoteResult<Object?>> Function(FixtureGridViewApi api);

/// The API call that requests [name], or `null` for a name no call requests.
/// The inverse of `FixtureGridViewApi`'s file naming.
_Load? _loaderFor(String name) {
  RegExpMatch? match(String pattern) =>
      RegExp('^$pattern\\.json\$').firstMatch(name);
  int group(RegExpMatch m, int i) => int.parse(m.group(i)!);

  switch (name) {
    case 'status.json':
      return (FixtureGridViewApi api) => api.fetchStatus();
    case 'bootstrap.json':
      return (FixtureGridViewApi api) => api.fetchBootstrap();
    case 'home.json':
      return (FixtureGridViewApi api) => api.fetchHome();
    case 'season-current.json':
      return (FixtureGridViewApi api) => api.fetchCurrentSeason();
    case 'content-manifest.json':
      return (FixtureGridViewApi api) => api.fetchContentManifest();
  }
  final Map<String, _Load Function(int season)> seasonal =
      <String, _Load Function(int season)>{
        'bootstrap': (int s) =>
            (FixtureGridViewApi api) => api.fetchBootstrap(season: s),
        'season': (int s) =>
            (FixtureGridViewApi api) => api.fetchSeason(season: s),
        'calendar': (int s) =>
            (FixtureGridViewApi api) => api.fetchCalendar(season: s),
        'drivers': (int s) =>
            (FixtureGridViewApi api) => api.fetchSeasonDrivers(season: s),
        'constructors': (int s) =>
            (FixtureGridViewApi api) => api.fetchSeasonConstructors(season: s),
        'circuits': (int s) =>
            (FixtureGridViewApi api) => api.fetchSeasonCircuits(season: s),
        'standings-drivers': (int s) =>
            (FixtureGridViewApi api) => api.fetchDriverStandings(season: s),
        'standings-constructors': (int s) =>
            (FixtureGridViewApi api) =>
                api.fetchConstructorStandings(season: s),
      };
  for (final MapEntry<String, _Load Function(int)> entry in seasonal.entries) {
    final RegExpMatch? m = match('${entry.key}-(\\d{4})');
    if (m != null) return entry.value(group(m, 1));
  }
  final RegExpMatch? grandPrix = match('grand-prix-(\\d{4})-([1-9]\\d*)');
  if (grandPrix != null) {
    return (FixtureGridViewApi api) => api.fetchGrandPrix(
      season: group(grandPrix, 1),
      round: group(grandPrix, 2),
    );
  }
  final RegExpMatch? results = match('results-(\\d{4})-([1-9]\\d*)');
  if (results != null) {
    return (FixtureGridViewApi api) => api.fetchGrandPrixResults(
      season: group(results, 1),
      round: group(results, 2),
    );
  }
  final RegExpMatch? entity = match(
    '(driver|constructor|circuit)-([a-z0-9]+(?:-[a-z0-9]+)*)',
  );
  if (entity != null) {
    final String id = entity.group(2)!;
    return switch (entity.group(1)) {
      'driver' => (FixtureGridViewApi api) => api.fetchDriver(driverId: id),
      'constructor' => (FixtureGridViewApi api) => api.fetchConstructor(
        constructorId: id,
      ),
      _ => (FixtureGridViewApi api) => api.fetchCircuit(circuitId: id),
    };
  }
  return null;
}

Future<Set<String>> _bundledNames() async {
  final AssetManifest manifest = await AssetManifest.loadFromAssetBundle(
    rootBundle,
  );
  return manifest
      .listAssets()
      .where((String path) => path.startsWith(_dir))
      .map((String path) => path.substring(_dir.length))
      .toSet();
}

Future<T> _modified<T>(Future<RemoteResult<T>> call, String what) async {
  final RemoteResult<T> result = await call;
  if (result is! RemoteModified<T>) {
    fail('$what did not load into its DTO: $result');
  }
  return result.data;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('every bundled fixture loads through FixtureGridViewApi into its '
      'DTO', () async {
    final Set<String> names = await _bundledNames();
    expect(names, isNotEmpty);
    final FixtureGridViewApi api = FixtureGridViewApi();
    for (final String name in names) {
      if (name == 'frozen-dataset.json') continue;
      final _Load? load = _loaderFor(name);
      expect(load, isNotNull, reason: '$name is requested by no API call');
      final RemoteResult<Object?> result = await load!(api);
      expect(result, isA<RemoteModified<Object?>>(), reason: name);
    }
  });

  test(
    'the bundle is the committed samples, or a complete frozen set',
    () async {
      final Set<String> names = await _bundledNames();
      if (!names.contains('frozen-dataset.json')) {
        // The repository: sample data only, never presented as captured data.
        expect(names, _sampleFixtures);
        expect(
          await loadFixtureDataIdentity(rootBundle),
          isA<SampleFixtureData>(),
        );
        return;
      }

      // A frozen build's export: exactly the files the descriptor lists.
      final FrozenDatasetDescriptor descriptor =
          FrozenDatasetDescriptor.fromJson(
            jsonDecode(await rootBundle.loadString(frozenDatasetAsset)),
          );
      final Set<String> listed = descriptor.files
          .map((FrozenFixtureFile f) => f.name)
          .toSet();
      expect(names.difference(<String>{'frozen-dataset.json'}), listed);
      for (final FrozenFixtureFile file in descriptor.files) {
        final ByteData bytes = await rootBundle.load('$_dir${file.name}');
        expect(bytes.lengthInBytes, file.byteLength, reason: file.name);
      }
      final int season = switch (descriptor.identity) {
        FrozenCaptureData(:final int season) => season,
        _ => int.parse(
          RegExp(
            r'calendar-(\d{4})\.json',
          ).firstMatch(listed.join(' '))!.group(1)!,
        ),
      };

      // Everything the app's screens can request for that season.
      for (final String required in <String>[
        'bootstrap.json',
        'bootstrap-$season.json',
        'home.json',
        'season-current.json',
        'season-$season.json',
        'calendar-$season.json',
        'drivers-$season.json',
        'constructors-$season.json',
        'circuits-$season.json',
        'standings-drivers-$season.json',
        'standings-constructors-$season.json',
        'content-manifest.json',
      ]) {
        expect(listed, contains(required));
      }
      final FixtureGridViewApi api = FixtureGridViewApi();
      final List<GrandPrixSummaryDto> calendar = await _modified(
        api.fetchCalendar(season: season),
        'calendar',
      );
      expect(calendar, isNotEmpty);
      for (final GrandPrixSummaryDto event in calendar) {
        expect(listed, contains('grand-prix-$season-${event.round}.json'));
        if (event.hasResults) {
          expect(listed, contains('results-$season-${event.round}.json'));
        }
      }
      final List<SeasonDriverSummaryDto> drivers = await _modified(
        api.fetchSeasonDrivers(season: season),
        'drivers',
      );
      for (final SeasonDriverSummaryDto driver in drivers) {
        expect(listed, contains('driver-${driver.driverId}.json'));
      }
      final List<SeasonConstructorSummaryDto> constructors = await _modified(
        api.fetchSeasonConstructors(season: season),
        'constructors',
      );
      for (final SeasonConstructorSummaryDto constructor in constructors) {
        expect(
          listed,
          contains('constructor-${constructor.constructorId}.json'),
        );
      }
      final List<CircuitDto> circuits = await _modified(
        api.fetchSeasonCircuits(season: season),
        'circuits',
      );
      for (final CircuitDto circuit in circuits) {
        expect(listed, contains('circuit-${circuit.id}.json'));
      }
      // The Worker computes /v1/status; a frozen build has no status document.
      final RemoteResult<Object?> status = await api.fetchStatus();
      expect(
        status,
        isA<RemoteFailure<Object?>>().having(
          (RemoteFailure<Object?> f) => f.failure.kind,
          'kind',
          ApiFailureKind.notFound,
        ),
      );
    },
  );
}
