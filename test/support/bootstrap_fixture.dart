import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';

import 'fixtures.dart';
import 'scripted_api.dart';

/// Builds a `GET /v1/bootstrap` envelope from the shared contract fixtures.
///
/// The families default to the same payloads the individual endpoints serve, so
/// a bootstrap response and the equivalent per-endpoint responses describe the
/// same season. `circuits` is narrowed to the compact `CircuitSummary` shape the
/// bootstrap contract actually defines (id, name, locality, countryCode) —
/// never the full circuit — which is what makes the compact-merge tests
/// meaningful.
Map<String, dynamic> bootstrapEnvelope({
  int season = 2026,
  bool isCurrent = true,
  List<dynamic>? calendar,
  List<dynamic>? drivers,
  List<dynamic>? constructors,
  List<dynamic>? circuits,
  List<dynamic>? driverStandings,
  List<dynamic>? constructorStandings,
  Map<String, dynamic>? home,
  String generatedAt = '2026-07-18T12:00:00Z',
  String? sourceUpdatedAt = '2026-07-18T11:55:00Z',
  String? staleAfter = '2026-07-18T12:15:00Z',
  String? contentVersion = '2026.07.18.1',
}) {
  return <String, dynamic>{
    'data': <String, dynamic>{
      'season': seasonJson(season, isCurrent: isCurrent),
      'calendar': calendar ?? calendarJson(season),
      'drivers': drivers ?? driversJson(),
      'constructors': constructors ?? constructorsJson(),
      'circuits': circuits ?? circuitSummariesJson(),
      'driverStandings': driverStandings ?? driverStandingsJson(season),
      'constructorStandings':
          constructorStandings ?? constructorStandingsJson(season),
      'home': home ?? homeJson(),
      'contentVersion': contentVersion,
      'mediaVersion': contentVersion,
    },
    'meta': <String, dynamic>{
      'apiVersion': '1',
      'schemaVersion': 1,
      'season': season,
      'generatedAt': generatedAt,
      'sourceUpdatedAt': sourceUpdatedAt,
      'staleAfter': staleAfter,
      'contentVersion': contentVersion,
      'requestId': 'req-test-bootstrap',
    },
  };
}

/// Parses a bootstrap envelope into a [RemoteModified] with [etag].
RemoteModified<BootstrapDataDto> bootstrapModified(
  Map<String, dynamic> envelope, {
  String etag = 'W/"bootstrap-1"',
}) => modifiedFromJson<BootstrapDataDto>(
  envelope,
  (Object? data) => BootstrapDataDto.fromJson(data! as Map<String, dynamic>),
  etag: etag,
);

// --- Family builders --------------------------------------------------------

Map<String, dynamic> seasonJson(int year, {bool isCurrent = true}) {
  final Map<String, dynamic> season = Map<String, dynamic>.from(
    loadFixture('seasons/current.json')['data'] as Map<String, dynamic>,
  );
  season['year'] = year;
  season['isCurrent'] = isCurrent;
  return season;
}

List<dynamic> calendarJson(int season) {
  final List<dynamic> events =
      loadFixture('calendar/2026.json')['data'] as List<dynamic>;
  return <dynamic>[
    for (final Map<String, dynamic> event
        in events.cast<Map<String, dynamic>>())
      Map<String, dynamic>.from(event)
        ..['season'] = season
        ..['id'] = '$season-${event['eventSlug']}',
  ];
}

List<dynamic> driversJson() =>
    loadFixture('drivers/season-drivers.json')['data'] as List<dynamic>;

List<dynamic> constructorsJson() =>
    loadFixture('constructors/season-constructors.json')['data']
        as List<dynamic>;

/// The compact circuit shape bootstrap carries: identity only, never the
/// physical facts the circuit detail owns.
List<dynamic> circuitSummariesJson() {
  final List<dynamic> full =
      loadFixture('circuits/season-circuits.json')['data'] as List<dynamic>;
  return <dynamic>[
    for (final dynamic circuit in full)
      <String, dynamic>{
        'id': (circuit as Map<String, dynamic>)['id'],
        'name': circuit['name'],
        'locality': circuit['locality'],
        'countryCode': circuit['countryCode'],
      },
  ];
}

List<dynamic> driverStandingsJson(int season) {
  final List<dynamic> rows =
      loadFixture('standings/drivers-fractional.json')['data'] as List<dynamic>;
  return <dynamic>[
    for (final dynamic row in rows)
      Map<String, dynamic>.from(row as Map<String, dynamic>)
        ..['season'] = season,
  ];
}

List<dynamic> constructorStandingsJson(int season) {
  final List<dynamic> rows =
      loadFixture('standings/constructors.json')['data'] as List<dynamic>;
  return <dynamic>[
    for (final dynamic row in rows)
      Map<String, dynamic>.from(row as Map<String, dynamic>)
        ..['season'] = season,
  ];
}

Map<String, dynamic> homeJson({int? season}) {
  final Map<String, dynamic> home = Map<String, dynamic>.from(
    loadFixture('home/pre-event.json')['data'] as Map<String, dynamic>,
  );
  if (season == null) return home;
  final Map<String, dynamic>? featured =
      home['featuredEvent'] as Map<String, dynamic>?;
  if (featured != null) {
    final Map<String, dynamic> copy = Map<String, dynamic>.from(featured)
      ..['season'] = season
      ..['id'] = '$season-${featured['eventSlug']}';
    home['featuredEvent'] = copy;
  }
  home['upcomingEvents'] = <dynamic>[];
  return home;
}

/// A Home block with no featured event — the "season with nothing scheduled
/// yet" case the bootstrap contract explicitly permits.
Map<String, dynamic> emptyHomeJson() => <String, dynamic>{
  'freshness': <String, dynamic>{
    'generatedAt': '2026-07-18T12:00:00Z',
    'sourceUpdatedAt': '2026-07-18T11:55:00Z',
    'staleAfter': null,
    'contentVersion': null,
    'stale': null,
  },
  'featuredEvent': null,
  'featuredSession': null,
  'latestCompletedEvent': null,
  'driverLeader': null,
  'constructorLeader': null,
  'upcomingEvents': <dynamic>[],
};
