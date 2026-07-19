import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/envelope/api_response.dart';
import 'package:gridview/core/api/errors/api_exception.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/shared/data/remote/gridview_api.dart';

import 'fixtures.dart';

/// A programmable [GridViewApi] fake for provider/controller/widget tests. No
/// live transport; every response and failure is scripted.
class FakeGridViewApi implements GridViewApi {
  ApiResponse<HomeDataDto> Function()? home;
  ApiResponse<GrandPrixDto> Function()? grandPrix;
  ApiFailure? homeFailure;
  ApiFailure? grandPrixFailure;
  int homeCalls = 0;
  int grandPrixCalls = 0;

  @override
  bool get usesMockData => false;

  @override
  Future<ApiResponse<HomeDataDto>> fetchHome({int? season}) async {
    homeCalls++;
    if (homeFailure != null) throw GridViewApiException(homeFailure!);
    return (home ?? homeResponseFixture)();
  }

  @override
  Future<ApiResponse<GrandPrixDto>> fetchGrandPrix({
    required int season,
    required int round,
  }) async {
    grandPrixCalls++;
    if (grandPrixFailure != null) throw GridViewApiException(grandPrixFailure!);
    return (grandPrix ?? grandPrixResponseFixture)();
  }
}

ApiResponse<HomeDataDto> homeResponseFixture({
  String generatedAt = '2026-07-18T12:00:00Z',
  String? staleAfter = '2026-07-18T12:15:00Z',
  bool stale = false,
}) {
  final Map<String, dynamic> json = loadFixture('home/pre-event.json');
  final Map<String, dynamic> freshness =
      (json['data'] as Map<String, dynamic>)['freshness']
          as Map<String, dynamic>;
  freshness['generatedAt'] = generatedAt;
  freshness['staleAfter'] = staleAfter;
  freshness['stale'] = stale;
  (json['meta'] as Map<String, dynamic>)['generatedAt'] = generatedAt;
  return ApiResponse.parse<HomeDataDto>(
    json,
    (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
  );
}

ApiResponse<GrandPrixDto> grandPrixResponseFixture({
  String fixture = 'grand-prix/sprint-weekend.json',
}) {
  final Map<String, dynamic> json = loadFixture(fixture);
  return ApiResponse.parse<GrandPrixDto>(
    json,
    (Object? d) => GrandPrixDto.fromJson(d! as Map<String, dynamic>),
  );
}
