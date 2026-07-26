import 'dart:async';

import 'package:gridview/core/api/dto/circuit_dto.dart';
import 'package:gridview/core/api/dto/detail_dto.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/result_dto.dart';
import 'package:gridview/core/api/dto/season_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/dto/summary_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/envelope/api_response.dart';
import 'package:gridview/features/shared/data/remote/remote_cancellation.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';

import 'fake_api.dart';
import 'fixtures.dart';

/// A programmable [GridViewApi] fake for repository behaviour, domain,
/// concurrency and persistence tests.
///
/// Each endpoint under test is scripted with a responder that receives the
/// `If-None-Match` etag the repository sent, so a test can implement true
/// conditional behaviour (return [RemoteNotModified] when the etags match) and
/// assert on the etag that was persisted. Every endpoint records a call count
/// and the last etag it saw. Unscripted endpoints inherit the base `notFound`.
class ScriptedGridViewApi extends BaseFakeGridViewApi {
  ScriptedGridViewApi({this.usesMockData = false});

  @override
  final bool usesMockData;

  final Map<String, int> calls = <String, int>{};
  final Map<String, String?> lastEtag = <String, String?>{};

  // Scriptable responders. Each takes the sent etag and returns a result
  // (synchronously, or as a Future to model an in-flight request).
  FutureOr<RemoteResult<BootstrapDataDto>> Function(String? etag)? bootstrap;
  FutureOr<RemoteResult<SeasonDto>> Function(String? etag)? currentSeason;
  FutureOr<RemoteResult<SeasonDto>> Function(String? etag)? season;
  FutureOr<RemoteResult<HomeDataDto>> Function(String? etag)? home;
  FutureOr<RemoteResult<List<GrandPrixSummaryDto>>> Function(String? etag)?
  calendar;
  FutureOr<RemoteResult<GrandPrixDto>> Function(String? etag)? grandPrix;
  FutureOr<RemoteResult<RaceResultDto>> Function(String? etag)? results;
  FutureOr<RemoteResult<List<DriverStandingDto>>> Function(String? etag)?
  driverStandings;
  FutureOr<RemoteResult<List<ConstructorStandingDto>>> Function(String? etag)?
  constructorStandings;
  FutureOr<RemoteResult<List<SeasonDriverSummaryDto>>> Function(String? etag)?
  seasonDrivers;
  FutureOr<RemoteResult<DriverDetailDto>> Function(String? etag)? driver;
  FutureOr<RemoteResult<List<SeasonConstructorSummaryDto>>> Function(
    String? etag,
  )?
  seasonConstructors;
  FutureOr<RemoteResult<ConstructorDetailDto>> Function(String? etag)?
  constructor;
  FutureOr<RemoteResult<List<CircuitDto>>> Function(String? etag)?
  seasonCircuits;
  FutureOr<RemoteResult<CircuitDetailDto>> Function(String? etag)? circuit;
  FutureOr<RemoteResult<ContentManifestDto>> Function(String? etag)?
  contentManifest;

  int callsFor(String endpoint) => calls[endpoint] ?? 0;

  Future<RemoteResult<T>> _dispatch<T>(
    String name,
    String? etag,
    FutureOr<RemoteResult<T>> Function(String? etag)? responder,
  ) async {
    calls[name] = (calls[name] ?? 0) + 1;
    lastEtag[name] = etag;
    if (responder == null) return notFound<T>();
    return responder(etag);
  }

  @override
  Future<RemoteResult<BootstrapDataDto>> fetchBootstrap({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('bootstrap', etag, bootstrap);

  @override
  Future<RemoteResult<SeasonDto>> fetchCurrentSeason({
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('currentSeason', etag, currentSeason);

  @override
  Future<RemoteResult<SeasonDto>> fetchSeason({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('season', etag, this.season);

  @override
  Future<RemoteResult<HomeDataDto>> fetchHome({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('home', etag, home);

  @override
  Future<RemoteResult<List<GrandPrixSummaryDto>>> fetchCalendar({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('calendar', etag, calendar);

  @override
  Future<RemoteResult<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('grandPrix', etag, grandPrix);

  @override
  Future<RemoteResult<RaceResultDto>> fetchGrandPrixResults({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('results', etag, results);

  @override
  Future<RemoteResult<List<DriverStandingDto>>> fetchDriverStandings({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('driverStandings', etag, driverStandings);

  @override
  Future<RemoteResult<List<ConstructorStandingDto>>> fetchConstructorStandings({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('constructorStandings', etag, constructorStandings);

  @override
  Future<RemoteResult<List<SeasonDriverSummaryDto>>> fetchSeasonDrivers({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('seasonDrivers', etag, seasonDrivers);

  @override
  Future<RemoteResult<DriverDetailDto>> fetchDriver({
    required String driverId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('driver', etag, driver);

  @override
  Future<RemoteResult<List<SeasonConstructorSummaryDto>>>
  fetchSeasonConstructors({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('seasonConstructors', etag, seasonConstructors);

  @override
  Future<RemoteResult<ConstructorDetailDto>> fetchConstructor({
    required String constructorId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('constructor', etag, constructor);

  @override
  Future<RemoteResult<List<CircuitDto>>> fetchSeasonCircuits({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('seasonCircuits', etag, seasonCircuits);

  @override
  Future<RemoteResult<CircuitDetailDto>> fetchCircuit({
    required String circuitId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('circuit', etag, circuit);

  @override
  Future<RemoteResult<ContentManifestDto>> fetchContentManifest({
    String? etag,
    RemoteCancellation? cancellation,
  }) async => _dispatch('contentManifest', etag, contentManifest);
}

// --- Result builders from shared fixtures -------------------------------

/// Parses a fixture envelope and returns a [RemoteModified] with [etag], letting
/// the test override the snapshot provenance in `meta`.
RemoteModified<T> modifiedFromFixture<T>(
  String path,
  T Function(Object? data) parse, {
  String etag = 'W/"v1"',
  String? sourceUpdatedAt,
  String? generatedAt,
  String? staleAfter,
}) {
  final Map<String, dynamic> json = loadFixture(path);
  final Map<String, dynamic> meta = json['meta'] as Map<String, dynamic>;
  if (sourceUpdatedAt != null) meta['sourceUpdatedAt'] = sourceUpdatedAt;
  if (generatedAt != null) meta['generatedAt'] = generatedAt;
  if (staleAfter != null) meta['staleAfter'] = staleAfter;
  final ApiResponse<T> parsed = ApiResponse.parse<T>(json, parse);
  return RemoteModified<T>(
    data: parsed.data,
    meta: parsed.meta,
    etag: etag,
    requestId: parsed.meta.requestId,
  );
}

/// Builds a [RemoteModified] from an in-memory envelope map (already mutated by
/// the test), rather than reloading it from disk.
RemoteModified<T> modifiedFromJson<T>(
  Map<String, dynamic> json,
  T Function(Object? data) parse, {
  String etag = 'W/"v1"',
}) {
  final ApiResponse<T> parsed = ApiResponse.parse<T>(json, parse);
  return RemoteModified<T>(
    data: parsed.data,
    meta: parsed.meta,
    etag: etag,
    requestId: parsed.meta.requestId,
  );
}

/// Builds a [RemoteModified] list result from an in-memory envelope map.
RemoteModified<List<D>> modifiedListFromJson<D>(
  Map<String, dynamic> json,
  D Function(Map<String, dynamic> element) fromJson, {
  String etag = 'W/"v1"',
}) => modifiedFromJson<List<D>>(
  json,
  (Object? data) => (data! as List<dynamic>)
      .map((Object? e) => fromJson(e! as Map<String, dynamic>))
      .toList(growable: false),
  etag: etag,
);

/// Parses a fixture whose `data` is a JSON array.
RemoteModified<List<D>> modifiedListFromFixture<D>(
  String path,
  D Function(Map<String, dynamic> element) fromJson, {
  String etag = 'W/"v1"',
  String? sourceUpdatedAt,
  String? generatedAt,
}) => modifiedFromFixture<List<D>>(
  path,
  (Object? data) => (data! as List<dynamic>)
      .map((Object? e) => fromJson(e! as Map<String, dynamic>))
      .toList(growable: false),
  etag: etag,
  sourceUpdatedAt: sourceUpdatedAt,
  generatedAt: generatedAt,
);
