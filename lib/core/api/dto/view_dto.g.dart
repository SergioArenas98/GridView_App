// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'view_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_DataFreshnessDto _$DataFreshnessDtoFromJson(Map<String, dynamic> json) =>
    _DataFreshnessDto(
      generatedAt: json['generatedAt'] as String,
      sourceUpdatedAt: json['sourceUpdatedAt'] as String?,
      staleAfter: json['staleAfter'] as String?,
      contentVersion: json['contentVersion'] as String?,
      stale: json['stale'] as bool?,
    );

Map<String, dynamic> _$DataFreshnessDtoToJson(_DataFreshnessDto instance) =>
    <String, dynamic>{
      'generatedAt': instance.generatedAt,
      'sourceUpdatedAt': instance.sourceUpdatedAt,
      'staleAfter': instance.staleAfter,
      'contentVersion': instance.contentVersion,
      'stale': instance.stale,
    };

_StatusDataDto _$StatusDataDtoFromJson(Map<String, dynamic> json) =>
    _StatusDataDto(
      status: json['status'] as String,
      service: json['service'] as String,
      environment: json['environment'] as String,
      apiVersion: json['apiVersion'] as String,
      currentSeason: (json['currentSeason'] as num?)?.toInt(),
      lastSuccessfulSyncAt: json['lastSuccessfulSyncAt'] as String?,
      snapshotAgeSeconds: (json['snapshotAgeSeconds'] as num?)?.toInt(),
      maintenance: json['maintenance'] as bool,
    );

Map<String, dynamic> _$StatusDataDtoToJson(_StatusDataDto instance) =>
    <String, dynamic>{
      'status': instance.status,
      'service': instance.service,
      'environment': instance.environment,
      'apiVersion': instance.apiVersion,
      'currentSeason': instance.currentSeason,
      'lastSuccessfulSyncAt': instance.lastSuccessfulSyncAt,
      'snapshotAgeSeconds': instance.snapshotAgeSeconds,
      'maintenance': instance.maintenance,
    };

_HomeDataDto _$HomeDataDtoFromJson(Map<String, dynamic> json) => _HomeDataDto(
  freshness: DataFreshnessDto.fromJson(
    json['freshness'] as Map<String, dynamic>,
  ),
  featuredEvent: json['featuredEvent'] == null
      ? null
      : GrandPrixSummaryDto.fromJson(
          json['featuredEvent'] as Map<String, dynamic>,
        ),
  featuredSession: json['featuredSession'] == null
      ? null
      : SessionDto.fromJson(json['featuredSession'] as Map<String, dynamic>),
  latestCompletedEvent: json['latestCompletedEvent'] == null
      ? null
      : GrandPrixSummaryDto.fromJson(
          json['latestCompletedEvent'] as Map<String, dynamic>,
        ),
  driverLeader: json['driverLeader'] == null
      ? null
      : DriverStandingDto.fromJson(
          json['driverLeader'] as Map<String, dynamic>,
        ),
  constructorLeader: json['constructorLeader'] == null
      ? null
      : ConstructorStandingDto.fromJson(
          json['constructorLeader'] as Map<String, dynamic>,
        ),
  upcomingEvents: (json['upcomingEvents'] as List<dynamic>)
      .map((e) => GrandPrixSummaryDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$HomeDataDtoToJson(_HomeDataDto instance) =>
    <String, dynamic>{
      'freshness': instance.freshness,
      'featuredEvent': instance.featuredEvent,
      'featuredSession': instance.featuredSession,
      'latestCompletedEvent': instance.latestCompletedEvent,
      'driverLeader': instance.driverLeader,
      'constructorLeader': instance.constructorLeader,
      'upcomingEvents': instance.upcomingEvents,
    };

_BootstrapDataDto _$BootstrapDataDtoFromJson(
  Map<String, dynamic> json,
) => _BootstrapDataDto(
  season: SeasonDto.fromJson(json['season'] as Map<String, dynamic>),
  calendar: (json['calendar'] as List<dynamic>)
      .map((e) => GrandPrixSummaryDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  drivers: (json['drivers'] as List<dynamic>)
      .map((e) => SeasonDriverSummaryDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  constructors: (json['constructors'] as List<dynamic>)
      .map(
        (e) => SeasonConstructorSummaryDto.fromJson(e as Map<String, dynamic>),
      )
      .toList(),
  circuits: (json['circuits'] as List<dynamic>)
      .map((e) => CircuitSummaryDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  driverStandings: (json['driverStandings'] as List<dynamic>)
      .map((e) => DriverStandingDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  constructorStandings: (json['constructorStandings'] as List<dynamic>)
      .map((e) => ConstructorStandingDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  home: HomeDataDto.fromJson(json['home'] as Map<String, dynamic>),
  contentVersion: json['contentVersion'] as String?,
  mediaVersion: json['mediaVersion'] as String?,
);

Map<String, dynamic> _$BootstrapDataDtoToJson(_BootstrapDataDto instance) =>
    <String, dynamic>{
      'season': instance.season,
      'calendar': instance.calendar,
      'drivers': instance.drivers,
      'constructors': instance.constructors,
      'circuits': instance.circuits,
      'driverStandings': instance.driverStandings,
      'constructorStandings': instance.constructorStandings,
      'home': instance.home,
      'contentVersion': instance.contentVersion,
      'mediaVersion': instance.mediaVersion,
    };

_ContentManifestDto _$ContentManifestDtoFromJson(Map<String, dynamic> json) =>
    _ContentManifestDto(
      contentVersion: json['contentVersion'] as String,
      mediaVersion: json['mediaVersion'] as String?,
      supportedSeasons: (json['supportedSeasons'] as List<dynamic>)
          .map((e) => (e as num).toInt())
          .toList(),
      attributionVersion: json['attributionVersion'] as String?,
      minimumApiSchemaVersion: (json['minimumApiSchemaVersion'] as num).toInt(),
    );

Map<String, dynamic> _$ContentManifestDtoToJson(_ContentManifestDto instance) =>
    <String, dynamic>{
      'contentVersion': instance.contentVersion,
      'mediaVersion': instance.mediaVersion,
      'supportedSeasons': instance.supportedSeasons,
      'attributionVersion': instance.attributionVersion,
      'minimumApiSchemaVersion': instance.minimumApiSchemaVersion,
    };
