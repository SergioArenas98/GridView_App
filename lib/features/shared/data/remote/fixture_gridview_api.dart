import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show AssetBundle, rootBundle;

import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/api/dto/view_dto.dart';
import '../../../../core/api/envelope/api_response.dart';
import '../../../../core/api/errors/api_exception.dart';
import '../../../../core/api/errors/api_failure.dart';
import 'gridview_api.dart';
import 'snapshot_contract.dart';

/// Development/staging fixture data source.
///
/// Serves the bundled, OpenAPI-valid snapshot fixtures under
/// `assets/dev_fixtures/` through the exact same envelope + DTO path as the
/// production Dio client, so the architecture (remote DTO -> repository -> Drift
/// -> stream -> UI) is identical. It must never be constructed in a production
/// build — the provider wiring guards this, and [usesMockData] drives a visible
/// dev banner so mock data is never mistaken for authoritative data.
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

  @override
  Future<ApiResponse<HomeDataDto>> fetchHome({int? season}) =>
      _load<HomeDataDto>(
        '$_dir/home.json',
        (Object? data) => HomeDataDto.fromJson(_asMap(data)),
      );

  @override
  Future<ApiResponse<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
  }) => _load<GrandPrixDto>(
    '$_dir/grand-prix-$season-$round.json',
    (Object? data) => GrandPrixDto.fromJson(_asMap(data)),
  );

  Future<ApiResponse<T>> _load<T>(
    String path,
    T Function(Object? data) parse,
  ) async {
    final String raw;
    try {
      raw = await _bundle.loadString(path);
    } catch (_) {
      // A missing fixture models a 404 for that resource.
      throw const GridViewApiException(
        ApiFailure(kind: ApiFailureKind.notFound),
      );
    }
    final ApiResponse<T> parsed;
    try {
      final Map<String, dynamic> json = jsonDecode(raw) as Map<String, dynamic>;
      parsed = ApiResponse.parse<T>(json, parse);
    } catch (_) {
      throw const GridViewApiException(
        ApiFailure(kind: ApiFailureKind.invalidResponse),
      );
    }
    // Home and Grand Prix are snapshot responses: sourceUpdatedAt is required.
    requireSnapshotMeta(parsed.meta);
    return parsed;
  }

  Map<String, dynamic> _asMap(Object? value) => value as Map<String, dynamic>;
}
