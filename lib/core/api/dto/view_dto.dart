import 'package:freezed_annotation/freezed_annotation.dart';

import 'event_dto.dart';
import 'season_dto.dart';
import 'standing_dto.dart';
import 'summary_dto.dart';

part 'view_dto.freezed.dart';
part 'view_dto.g.dart';

@freezed
abstract class DataFreshnessDto with _$DataFreshnessDto {
  const factory DataFreshnessDto({
    required String generatedAt,
    String? sourceUpdatedAt,
    String? staleAfter,
    String? contentVersion,
    bool? stale,
  }) = _DataFreshnessDto;

  factory DataFreshnessDto.fromJson(Map<String, dynamic> json) =>
      _$DataFreshnessDtoFromJson(json);
}

@freezed
abstract class StatusDataDto with _$StatusDataDto {
  const factory StatusDataDto({
    required String status,
    required String service,
    required String environment,
    required String apiVersion,
    int? currentSeason,
    String? lastSuccessfulSyncAt,
    int? snapshotAgeSeconds,
    required bool maintenance,
  }) = _StatusDataDto;

  factory StatusDataDto.fromJson(Map<String, dynamic> json) =>
      _$StatusDataDtoFromJson(json);
}

@freezed
abstract class HomeDataDto with _$HomeDataDto {
  const factory HomeDataDto({
    required DataFreshnessDto freshness,
    GrandPrixSummaryDto? featuredEvent,
    SessionDto? featuredSession,
    GrandPrixSummaryDto? latestCompletedEvent,
    DriverStandingDto? driverLeader,
    ConstructorStandingDto? constructorLeader,
    required List<GrandPrixSummaryDto> upcomingEvents,
  }) = _HomeDataDto;

  factory HomeDataDto.fromJson(Map<String, dynamic> json) =>
      _$HomeDataDtoFromJson(json);
}

@freezed
abstract class BootstrapDataDto with _$BootstrapDataDto {
  const factory BootstrapDataDto({
    required SeasonDto season,
    required List<GrandPrixSummaryDto> calendar,
    required List<SeasonDriverSummaryDto> drivers,
    required List<SeasonConstructorSummaryDto> constructors,
    required List<CircuitSummaryDto> circuits,
    required List<DriverStandingDto> driverStandings,
    required List<ConstructorStandingDto> constructorStandings,
    required HomeDataDto home,
    String? contentVersion,
    String? mediaVersion,
  }) = _BootstrapDataDto;

  factory BootstrapDataDto.fromJson(Map<String, dynamic> json) =>
      _$BootstrapDataDtoFromJson(json);
}

@freezed
abstract class ContentManifestDto with _$ContentManifestDto {
  const factory ContentManifestDto({
    required String contentVersion,
    String? mediaVersion,
    required List<int> supportedSeasons,
    String? attributionVersion,
    required int minimumApiSchemaVersion,
  }) = _ContentManifestDto;

  factory ContentManifestDto.fromJson(Map<String, dynamic> json) =>
      _$ContentManifestDtoFromJson(json);
}
