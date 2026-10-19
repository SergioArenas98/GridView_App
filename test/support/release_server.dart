import 'package:gridview/core/api/dto/circuit_dto.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/result_dto.dart';
import 'package:gridview/core/api/dto/season_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/dto/summary_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';

import 'scripted_api.dart';

/// A published release as the scripted server serves it: one publication
/// instant on every document (ADR 0025 D4, amendment of 2026-10-14).
///
/// Core documents carry a long `staleAfter` on purpose: the calendar horizon
/// a manually published batch gets (ADR 0005, amendment of 2026-10-19). With
/// a 15-minute expiry an old copy would usually be due again by its own
/// expiry, which would hide the rule under test.
class Release {
  const Release(
    this.label,
    this.generatedAt, {
    required this.manifestExpiry,
    this.coreExpiry = defaultCoreExpiry,
  });

  final String label;
  final String generatedAt;
  final String manifestExpiry;
  final String coreExpiry;

  static const String defaultCoreExpiry = '2026-07-25T00:00:00Z';

  String etag(String endpoint) => 'W/"$label-$endpoint"';
}

/// How an edge cache answers for one endpoint.
enum Cache {
  /// Honest: a `304` only when the client's validator is this release's.
  conditional,

  /// A stale cache that ignores the validator and serves its stored `200`.
  stale200,
}

typedef Served = ({Release release, Cache cache});

RemoteResult<T> _answer<T>(
  String endpoint,
  String path,
  T Function(Object? data) parse,
  Served served,
  String? sentEtag, {
  bool manifest = false,
}) {
  final Release r = served.release;
  if (served.cache == Cache.conditional && sentEtag == r.etag(endpoint)) {
    return RemoteNotModified<T>();
  }
  return modifiedFromFixture<T>(
    path,
    parse,
    etag: r.etag(endpoint),
    generatedAt: r.generatedAt,
    staleAfter: manifest ? r.manifestExpiry : r.coreExpiry,
  );
}

T Function(Object? data) _list<D, T extends List<D>>(
  D Function(Map<String, dynamic> e) fromJson,
) =>
    (Object? data) =>
        (data! as List<dynamic>)
                .map((Object? e) => fromJson(e! as Map<String, dynamic>))
                .toList(growable: false)
            as T;

/// Scripts every automatic core endpoint, the manifest and the race results
/// to serve [release], except the endpoints named in [overrides].
///
/// The results endpoint serves the same classification (the fixture's round)
/// in every release, as an unchanged document of a republished batch would be.
void serve(
  ScriptedGridViewApi api,
  Release release, {
  Map<String, Served> overrides = const <String, Served>{},
}) {
  Served s(String endpoint) =>
      overrides[endpoint] ?? (release: release, cache: Cache.conditional);
  SeasonDto season(Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>);

  api
    ..currentSeason = ((String? e) => _answer<SeasonDto>(
      'currentSeason',
      'seasons/current.json',
      season,
      s('currentSeason'),
      e,
    ))
    ..season = ((String? e) => _answer<SeasonDto>(
      'season',
      'seasons/current.json',
      season,
      s('season'),
      e,
    ))
    ..home = ((String? e) => _answer<HomeDataDto>(
      'home',
      'home/pre-event.json',
      (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
      s('home'),
      e,
    ))
    ..calendar = ((String? e) => _answer<List<GrandPrixSummaryDto>>(
      'calendar',
      'calendar/2026.json',
      _list(GrandPrixSummaryDto.fromJson),
      s('calendar'),
      e,
    ))
    ..driverStandings = ((String? e) => _answer<List<DriverStandingDto>>(
      'driverStandings',
      'standings/drivers-fractional.json',
      _list(DriverStandingDto.fromJson),
      s('driverStandings'),
      e,
    ))
    ..constructorStandings = ((String? e) =>
        _answer<List<ConstructorStandingDto>>(
          'constructorStandings',
          'standings/constructors.json',
          _list(ConstructorStandingDto.fromJson),
          s('constructorStandings'),
          e,
        ))
    ..seasonDrivers = ((String? e) => _answer<List<SeasonDriverSummaryDto>>(
      'seasonDrivers',
      'drivers/season-drivers.json',
      _list(SeasonDriverSummaryDto.fromJson),
      s('seasonDrivers'),
      e,
    ))
    ..seasonConstructors = ((String? e) =>
        _answer<List<SeasonConstructorSummaryDto>>(
          'seasonConstructors',
          'constructors/season-constructors.json',
          _list(SeasonConstructorSummaryDto.fromJson),
          s('seasonConstructors'),
          e,
        ))
    ..seasonCircuits = ((String? e) => _answer<List<CircuitDto>>(
      'seasonCircuits',
      'circuits/season-circuits.json',
      _list(CircuitDto.fromJson),
      s('seasonCircuits'),
      e,
    ))
    ..results = ((String? e) => _answer<RaceResultDto>(
      'results',
      'results/race-timing.json',
      (Object? d) => RaceResultDto.fromJson(d! as Map<String, dynamic>),
      s('results'),
      e,
    ))
    ..contentManifest = ((String? e) => _answer<ContentManifestDto>(
      'contentManifest',
      'content/manifest.json',
      (Object? d) => ContentManifestDto.fromJson(d! as Map<String, dynamic>),
      s('contentManifest'),
      e,
      manifest: true,
    ));
}

const List<String> coreEndpoints = <String>[
  'currentSeason',
  'season',
  'home',
  'calendar',
  'driverStandings',
  'constructorStandings',
  'seasonDrivers',
  'seasonConstructors',
  'seasonCircuits',
];

/// The calls a run made, by endpoint. Race results and Grand Prix details are
/// counted too, so an unexpected detail request shows in every expectation.
Map<String, int> callsOf(ScriptedGridViewApi api) => <String, int>{
  for (final String e in <String>[
    ...coreEndpoints,
    'contentManifest',
    'results',
    'grandPrix',
  ])
    if (api.callsFor(e) > 0) e: api.callsFor(e),
};
