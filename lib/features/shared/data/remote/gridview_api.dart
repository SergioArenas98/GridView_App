import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/api/dto/view_dto.dart';
import '../../../../core/api/envelope/api_response.dart';

/// The remote GridView API boundary for the vertical slice.
///
/// Implementations return parsed success envelopes (`data` + `meta`) or throw a
/// [GridViewApiException] carrying a typed failure. Nothing provider-specific
/// and no transport type (Dio, HTTP) crosses this interface.
abstract interface class GridViewApi {
  /// Whether this data source serves non-authoritative mock data. `true` only
  /// for the dev/staging fixture source; always `false` in production.
  bool get usesMockData;

  /// `GET /v1/home` — the precomputed Home view model. [season] is the season
  /// year, or `null` to request the current season.
  Future<ApiResponse<HomeDataDto>> fetchHome({int? season});

  /// `GET /v1/seasons/{season}/grand-prix/{round}` — full Grand Prix detail.
  Future<ApiResponse<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
  });
}
