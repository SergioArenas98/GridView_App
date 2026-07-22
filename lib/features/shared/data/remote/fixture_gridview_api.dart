import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show AssetBundle, rootBundle;

import '../../../../core/api/dto/circuit_dto.dart';
import '../../../../core/api/dto/detail_dto.dart';
import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/api/dto/result_dto.dart';
import '../../../../core/api/dto/season_dto.dart';
import '../../../../core/api/dto/standing_dto.dart';
import '../../../../core/api/dto/summary_dto.dart';
import '../../../../core/api/dto/view_dto.dart';
import '../../../../core/api/envelope/api_response.dart';
import '../../../../core/api/errors/api_failure.dart';
import 'gridview_api.dart';
import 'remote_cancellation.dart';
import 'remote_result.dart';
import 'snapshot_contract.dart';

/// Development/staging fixture data source.
///
/// Serves the bundled, OpenAPI-valid snapshot fixtures under
/// `assets/dev_fixtures/` through the exact same envelope + DTO path as the
/// production Dio client, so the architecture (remote DTO -> repository -> Drift
/// -> stream -> UI) is identical. It supports conditional requests by deriving a
/// stable ETag from the fixture content and returning [RemoteNotModified] when
/// the caller's `If-None-Match` matches. A missing fixture models a 404
/// ([ApiFailureKind.notFound]).
///
/// It must never be constructed in a production build — the provider wiring
/// guards this, and [usesMockData] drives a visible dev banner so mock data is
/// never mistaken for authoritative data.
class FixtureGridViewApi implements GridViewApi {
  FixtureGridViewApi({AssetBundle? bundle}) : _bundle = bundle ?? rootBundle {
    if (kReleaseMode) {
      // Defence in depth: a release build must never reach this constructor.
      debugPrint('WARNING: FixtureGridViewApi constructed in release mode.');
    }
  }

  final AssetBundle _bundle;

  static const String _dir = 'assets/dev_fixtures';

  @override
  bool get usesMockData => true;

  // --- Health -------------------------------------------------------------

  @override
  Future<RemoteResult<StatusDataDto>> fetchStatus({
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<StatusDataDto>(
    'status.json',
    (Object? d) => StatusDataDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
    requireSnapshot: false,
  );

  // --- Aggregate ----------------------------------------------------------

  @override
  Future<RemoteResult<BootstrapDataDto>> fetchBootstrap({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<BootstrapDataDto>(
    season == null ? 'bootstrap.json' : 'bootstrap-$season.json',
    (Object? d) => BootstrapDataDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<HomeDataDto>> fetchHome({
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<HomeDataDto>(
    'home.json',
    (Object? d) => HomeDataDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Seasons ------------------------------------------------------------

  @override
  Future<RemoteResult<SeasonDto>> fetchCurrentSeason({
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<SeasonDto>(
    'season-current.json',
    (Object? d) => SeasonDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<SeasonDto>> fetchSeason({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<SeasonDto>(
    'season-$season.json',
    (Object? d) => SeasonDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Calendar -----------------------------------------------------------

  @override
  Future<RemoteResult<List<GrandPrixSummaryDto>>> fetchCalendar({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<List<GrandPrixSummaryDto>>(
    'calendar-$season.json',
    (Object? d) =>
        _list(d, (Map<String, dynamic> e) => GrandPrixSummaryDto.fromJson(e)),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<GrandPrixDto>(
    'grand-prix-$season-$round.json',
    (Object? d) => GrandPrixDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<RaceResultDto>> fetchGrandPrixResults({
    required int season,
    required int round,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<RaceResultDto>(
    'results-$season-$round.json',
    (Object? d) => RaceResultDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Standings ----------------------------------------------------------

  @override
  Future<RemoteResult<List<DriverStandingDto>>> fetchDriverStandings({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<List<DriverStandingDto>>(
    'standings-drivers-$season.json',
    (Object? d) =>
        _list(d, (Map<String, dynamic> e) => DriverStandingDto.fromJson(e)),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<List<ConstructorStandingDto>>> fetchConstructorStandings({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<List<ConstructorStandingDto>>(
    'standings-constructors-$season.json',
    (Object? d) => _list(
      d,
      (Map<String, dynamic> e) => ConstructorStandingDto.fromJson(e),
    ),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Drivers ------------------------------------------------------------

  @override
  Future<RemoteResult<List<SeasonDriverSummaryDto>>> fetchSeasonDrivers({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<List<SeasonDriverSummaryDto>>(
    'drivers-$season.json',
    (Object? d) => _list(
      d,
      (Map<String, dynamic> e) => SeasonDriverSummaryDto.fromJson(e),
    ),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<DriverDetailDto>> fetchDriver({
    required String driverId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<DriverDetailDto>(
    'driver-$driverId.json',
    (Object? d) => DriverDetailDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Constructors -------------------------------------------------------

  @override
  Future<RemoteResult<List<SeasonConstructorSummaryDto>>>
  fetchSeasonConstructors({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<List<SeasonConstructorSummaryDto>>(
    'constructors-$season.json',
    (Object? d) => _list(
      d,
      (Map<String, dynamic> e) => SeasonConstructorSummaryDto.fromJson(e),
    ),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<ConstructorDetailDto>> fetchConstructor({
    required String constructorId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<ConstructorDetailDto>(
    'constructor-$constructorId.json',
    (Object? d) => ConstructorDetailDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Circuits -----------------------------------------------------------

  @override
  Future<RemoteResult<List<CircuitDto>>> fetchSeasonCircuits({
    required int season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<List<CircuitDto>>(
    'circuits-$season.json',
    (Object? d) => _list(d, (Map<String, dynamic> e) => CircuitDto.fromJson(e)),
    etag: etag,
    cancellation: cancellation,
  );

  @override
  Future<RemoteResult<CircuitDetailDto>> fetchCircuit({
    required String circuitId,
    int? season,
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<CircuitDetailDto>(
    'circuit-$circuitId.json',
    (Object? d) => CircuitDetailDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Content ------------------------------------------------------------

  @override
  Future<RemoteResult<ContentManifestDto>> fetchContentManifest({
    String? etag,
    RemoteCancellation? cancellation,
  }) => _load<ContentManifestDto>(
    'content-manifest.json',
    (Object? d) => ContentManifestDto.fromJson(_asMap(d)),
    etag: etag,
    cancellation: cancellation,
  );

  // --- Core loader --------------------------------------------------------

  Future<RemoteResult<T>> _load<T>(
    String file,
    T Function(Object? data) parse, {
    String? etag,
    RemoteCancellation? cancellation,
    bool requireSnapshot = true,
  }) async {
    if (cancellation?.isCancelled ?? false) {
      return const _Cancelled().cast<T>();
    }

    final String raw;
    try {
      raw = await _bundle.loadString('$_dir/$file');
    } catch (_) {
      // A missing fixture models a 404 for that resource.
      return RemoteFailure<T>(const ApiFailure(kind: ApiFailureKind.notFound));
    }

    final String currentEtag = _weakEtag(raw);
    if (etag != null && etag == currentEtag) {
      return RemoteNotModified<T>(etag: currentEtag);
    }

    final ApiResponse<T> parsed;
    try {
      final Map<String, dynamic> json = jsonDecode(raw) as Map<String, dynamic>;
      parsed = ApiResponse.parse<T>(json, parse);
    } catch (_) {
      return RemoteFailure<T>(
        const ApiFailure(kind: ApiFailureKind.invalidResponse),
      );
    }
    if (requireSnapshot && !snapshotMetaIsValid(parsed.meta)) {
      return RemoteFailure<T>(
        const ApiFailure(kind: ApiFailureKind.invalidResponse),
      );
    }
    return RemoteModified<T>(
      data: parsed.data,
      meta: parsed.meta,
      etag: currentEtag,
      requestId: parsed.meta.requestId,
    );
  }

  /// A stable, weak entity tag derived from the fixture content (FNV-1a), so
  /// dev mode exercises the same conditional-request path as production.
  static String _weakEtag(String raw) {
    int hash = 0x811c9dc5;
    for (int i = 0; i < raw.length; i++) {
      hash ^= raw.codeUnitAt(i) & 0xff;
      hash = (hash * 0x01000193) & 0xffffffff;
    }
    return 'W/"fixture-${hash.toRadixString(16)}"';
  }

  static List<D> _list<D>(
    Object? data,
    D Function(Map<String, dynamic> element) fromJson,
  ) {
    final List<dynamic> items = data! as List<dynamic>;
    return items
        .map((Object? e) => fromJson(e! as Map<String, dynamic>))
        .toList(growable: false);
  }

  Map<String, dynamic> _asMap(Object? value) => value! as Map<String, dynamic>;
}

/// A cancelled fixture read, reusable across result types.
class _Cancelled {
  const _Cancelled();
  RemoteResult<T> cast<T>() =>
      RemoteFailure<T>(const ApiFailure(kind: ApiFailureKind.cancelled));
}
