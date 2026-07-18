// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'view_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$DataFreshnessDto {

 String get generatedAt; String? get sourceUpdatedAt; String? get staleAfter; String? get contentVersion; bool? get stale;
/// Create a copy of DataFreshnessDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DataFreshnessDtoCopyWith<DataFreshnessDto> get copyWith => _$DataFreshnessDtoCopyWithImpl<DataFreshnessDto>(this as DataFreshnessDto, _$identity);

  /// Serializes this DataFreshnessDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DataFreshnessDto&&(identical(other.generatedAt, generatedAt) || other.generatedAt == generatedAt)&&(identical(other.sourceUpdatedAt, sourceUpdatedAt) || other.sourceUpdatedAt == sourceUpdatedAt)&&(identical(other.staleAfter, staleAfter) || other.staleAfter == staleAfter)&&(identical(other.contentVersion, contentVersion) || other.contentVersion == contentVersion)&&(identical(other.stale, stale) || other.stale == stale));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,generatedAt,sourceUpdatedAt,staleAfter,contentVersion,stale);

@override
String toString() {
  return 'DataFreshnessDto(generatedAt: $generatedAt, sourceUpdatedAt: $sourceUpdatedAt, staleAfter: $staleAfter, contentVersion: $contentVersion, stale: $stale)';
}


}

/// @nodoc
abstract mixin class $DataFreshnessDtoCopyWith<$Res>  {
  factory $DataFreshnessDtoCopyWith(DataFreshnessDto value, $Res Function(DataFreshnessDto) _then) = _$DataFreshnessDtoCopyWithImpl;
@useResult
$Res call({
 String generatedAt, String? sourceUpdatedAt, String? staleAfter, String? contentVersion, bool? stale
});




}
/// @nodoc
class _$DataFreshnessDtoCopyWithImpl<$Res>
    implements $DataFreshnessDtoCopyWith<$Res> {
  _$DataFreshnessDtoCopyWithImpl(this._self, this._then);

  final DataFreshnessDto _self;
  final $Res Function(DataFreshnessDto) _then;

/// Create a copy of DataFreshnessDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? generatedAt = null,Object? sourceUpdatedAt = freezed,Object? staleAfter = freezed,Object? contentVersion = freezed,Object? stale = freezed,}) {
  return _then(_self.copyWith(
generatedAt: null == generatedAt ? _self.generatedAt : generatedAt // ignore: cast_nullable_to_non_nullable
as String,sourceUpdatedAt: freezed == sourceUpdatedAt ? _self.sourceUpdatedAt : sourceUpdatedAt // ignore: cast_nullable_to_non_nullable
as String?,staleAfter: freezed == staleAfter ? _self.staleAfter : staleAfter // ignore: cast_nullable_to_non_nullable
as String?,contentVersion: freezed == contentVersion ? _self.contentVersion : contentVersion // ignore: cast_nullable_to_non_nullable
as String?,stale: freezed == stale ? _self.stale : stale // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}

}


/// Adds pattern-matching-related methods to [DataFreshnessDto].
extension DataFreshnessDtoPatterns on DataFreshnessDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DataFreshnessDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DataFreshnessDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DataFreshnessDto value)  $default,){
final _that = this;
switch (_that) {
case _DataFreshnessDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DataFreshnessDto value)?  $default,){
final _that = this;
switch (_that) {
case _DataFreshnessDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String generatedAt,  String? sourceUpdatedAt,  String? staleAfter,  String? contentVersion,  bool? stale)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DataFreshnessDto() when $default != null:
return $default(_that.generatedAt,_that.sourceUpdatedAt,_that.staleAfter,_that.contentVersion,_that.stale);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String generatedAt,  String? sourceUpdatedAt,  String? staleAfter,  String? contentVersion,  bool? stale)  $default,) {final _that = this;
switch (_that) {
case _DataFreshnessDto():
return $default(_that.generatedAt,_that.sourceUpdatedAt,_that.staleAfter,_that.contentVersion,_that.stale);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String generatedAt,  String? sourceUpdatedAt,  String? staleAfter,  String? contentVersion,  bool? stale)?  $default,) {final _that = this;
switch (_that) {
case _DataFreshnessDto() when $default != null:
return $default(_that.generatedAt,_that.sourceUpdatedAt,_that.staleAfter,_that.contentVersion,_that.stale);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DataFreshnessDto implements DataFreshnessDto {
  const _DataFreshnessDto({required this.generatedAt, this.sourceUpdatedAt, this.staleAfter, this.contentVersion, this.stale});
  factory _DataFreshnessDto.fromJson(Map<String, dynamic> json) => _$DataFreshnessDtoFromJson(json);

@override final  String generatedAt;
@override final  String? sourceUpdatedAt;
@override final  String? staleAfter;
@override final  String? contentVersion;
@override final  bool? stale;

/// Create a copy of DataFreshnessDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DataFreshnessDtoCopyWith<_DataFreshnessDto> get copyWith => __$DataFreshnessDtoCopyWithImpl<_DataFreshnessDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DataFreshnessDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DataFreshnessDto&&(identical(other.generatedAt, generatedAt) || other.generatedAt == generatedAt)&&(identical(other.sourceUpdatedAt, sourceUpdatedAt) || other.sourceUpdatedAt == sourceUpdatedAt)&&(identical(other.staleAfter, staleAfter) || other.staleAfter == staleAfter)&&(identical(other.contentVersion, contentVersion) || other.contentVersion == contentVersion)&&(identical(other.stale, stale) || other.stale == stale));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,generatedAt,sourceUpdatedAt,staleAfter,contentVersion,stale);

@override
String toString() {
  return 'DataFreshnessDto(generatedAt: $generatedAt, sourceUpdatedAt: $sourceUpdatedAt, staleAfter: $staleAfter, contentVersion: $contentVersion, stale: $stale)';
}


}

/// @nodoc
abstract mixin class _$DataFreshnessDtoCopyWith<$Res> implements $DataFreshnessDtoCopyWith<$Res> {
  factory _$DataFreshnessDtoCopyWith(_DataFreshnessDto value, $Res Function(_DataFreshnessDto) _then) = __$DataFreshnessDtoCopyWithImpl;
@override @useResult
$Res call({
 String generatedAt, String? sourceUpdatedAt, String? staleAfter, String? contentVersion, bool? stale
});




}
/// @nodoc
class __$DataFreshnessDtoCopyWithImpl<$Res>
    implements _$DataFreshnessDtoCopyWith<$Res> {
  __$DataFreshnessDtoCopyWithImpl(this._self, this._then);

  final _DataFreshnessDto _self;
  final $Res Function(_DataFreshnessDto) _then;

/// Create a copy of DataFreshnessDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? generatedAt = null,Object? sourceUpdatedAt = freezed,Object? staleAfter = freezed,Object? contentVersion = freezed,Object? stale = freezed,}) {
  return _then(_DataFreshnessDto(
generatedAt: null == generatedAt ? _self.generatedAt : generatedAt // ignore: cast_nullable_to_non_nullable
as String,sourceUpdatedAt: freezed == sourceUpdatedAt ? _self.sourceUpdatedAt : sourceUpdatedAt // ignore: cast_nullable_to_non_nullable
as String?,staleAfter: freezed == staleAfter ? _self.staleAfter : staleAfter // ignore: cast_nullable_to_non_nullable
as String?,contentVersion: freezed == contentVersion ? _self.contentVersion : contentVersion // ignore: cast_nullable_to_non_nullable
as String?,stale: freezed == stale ? _self.stale : stale // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}


}


/// @nodoc
mixin _$StatusDataDto {

 String get status; String get service; String get environment; String get apiVersion; int? get currentSeason; String? get lastSuccessfulSyncAt; int? get snapshotAgeSeconds; bool get maintenance;
/// Create a copy of StatusDataDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StatusDataDtoCopyWith<StatusDataDto> get copyWith => _$StatusDataDtoCopyWithImpl<StatusDataDto>(this as StatusDataDto, _$identity);

  /// Serializes this StatusDataDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StatusDataDto&&(identical(other.status, status) || other.status == status)&&(identical(other.service, service) || other.service == service)&&(identical(other.environment, environment) || other.environment == environment)&&(identical(other.apiVersion, apiVersion) || other.apiVersion == apiVersion)&&(identical(other.currentSeason, currentSeason) || other.currentSeason == currentSeason)&&(identical(other.lastSuccessfulSyncAt, lastSuccessfulSyncAt) || other.lastSuccessfulSyncAt == lastSuccessfulSyncAt)&&(identical(other.snapshotAgeSeconds, snapshotAgeSeconds) || other.snapshotAgeSeconds == snapshotAgeSeconds)&&(identical(other.maintenance, maintenance) || other.maintenance == maintenance));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,service,environment,apiVersion,currentSeason,lastSuccessfulSyncAt,snapshotAgeSeconds,maintenance);

@override
String toString() {
  return 'StatusDataDto(status: $status, service: $service, environment: $environment, apiVersion: $apiVersion, currentSeason: $currentSeason, lastSuccessfulSyncAt: $lastSuccessfulSyncAt, snapshotAgeSeconds: $snapshotAgeSeconds, maintenance: $maintenance)';
}


}

/// @nodoc
abstract mixin class $StatusDataDtoCopyWith<$Res>  {
  factory $StatusDataDtoCopyWith(StatusDataDto value, $Res Function(StatusDataDto) _then) = _$StatusDataDtoCopyWithImpl;
@useResult
$Res call({
 String status, String service, String environment, String apiVersion, int? currentSeason, String? lastSuccessfulSyncAt, int? snapshotAgeSeconds, bool maintenance
});




}
/// @nodoc
class _$StatusDataDtoCopyWithImpl<$Res>
    implements $StatusDataDtoCopyWith<$Res> {
  _$StatusDataDtoCopyWithImpl(this._self, this._then);

  final StatusDataDto _self;
  final $Res Function(StatusDataDto) _then;

/// Create a copy of StatusDataDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,Object? service = null,Object? environment = null,Object? apiVersion = null,Object? currentSeason = freezed,Object? lastSuccessfulSyncAt = freezed,Object? snapshotAgeSeconds = freezed,Object? maintenance = null,}) {
  return _then(_self.copyWith(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,service: null == service ? _self.service : service // ignore: cast_nullable_to_non_nullable
as String,environment: null == environment ? _self.environment : environment // ignore: cast_nullable_to_non_nullable
as String,apiVersion: null == apiVersion ? _self.apiVersion : apiVersion // ignore: cast_nullable_to_non_nullable
as String,currentSeason: freezed == currentSeason ? _self.currentSeason : currentSeason // ignore: cast_nullable_to_non_nullable
as int?,lastSuccessfulSyncAt: freezed == lastSuccessfulSyncAt ? _self.lastSuccessfulSyncAt : lastSuccessfulSyncAt // ignore: cast_nullable_to_non_nullable
as String?,snapshotAgeSeconds: freezed == snapshotAgeSeconds ? _self.snapshotAgeSeconds : snapshotAgeSeconds // ignore: cast_nullable_to_non_nullable
as int?,maintenance: null == maintenance ? _self.maintenance : maintenance // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [StatusDataDto].
extension StatusDataDtoPatterns on StatusDataDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StatusDataDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StatusDataDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StatusDataDto value)  $default,){
final _that = this;
switch (_that) {
case _StatusDataDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StatusDataDto value)?  $default,){
final _that = this;
switch (_that) {
case _StatusDataDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String status,  String service,  String environment,  String apiVersion,  int? currentSeason,  String? lastSuccessfulSyncAt,  int? snapshotAgeSeconds,  bool maintenance)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StatusDataDto() when $default != null:
return $default(_that.status,_that.service,_that.environment,_that.apiVersion,_that.currentSeason,_that.lastSuccessfulSyncAt,_that.snapshotAgeSeconds,_that.maintenance);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String status,  String service,  String environment,  String apiVersion,  int? currentSeason,  String? lastSuccessfulSyncAt,  int? snapshotAgeSeconds,  bool maintenance)  $default,) {final _that = this;
switch (_that) {
case _StatusDataDto():
return $default(_that.status,_that.service,_that.environment,_that.apiVersion,_that.currentSeason,_that.lastSuccessfulSyncAt,_that.snapshotAgeSeconds,_that.maintenance);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String status,  String service,  String environment,  String apiVersion,  int? currentSeason,  String? lastSuccessfulSyncAt,  int? snapshotAgeSeconds,  bool maintenance)?  $default,) {final _that = this;
switch (_that) {
case _StatusDataDto() when $default != null:
return $default(_that.status,_that.service,_that.environment,_that.apiVersion,_that.currentSeason,_that.lastSuccessfulSyncAt,_that.snapshotAgeSeconds,_that.maintenance);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _StatusDataDto implements StatusDataDto {
  const _StatusDataDto({required this.status, required this.service, required this.environment, required this.apiVersion, this.currentSeason, this.lastSuccessfulSyncAt, this.snapshotAgeSeconds, required this.maintenance});
  factory _StatusDataDto.fromJson(Map<String, dynamic> json) => _$StatusDataDtoFromJson(json);

@override final  String status;
@override final  String service;
@override final  String environment;
@override final  String apiVersion;
@override final  int? currentSeason;
@override final  String? lastSuccessfulSyncAt;
@override final  int? snapshotAgeSeconds;
@override final  bool maintenance;

/// Create a copy of StatusDataDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StatusDataDtoCopyWith<_StatusDataDto> get copyWith => __$StatusDataDtoCopyWithImpl<_StatusDataDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StatusDataDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _StatusDataDto&&(identical(other.status, status) || other.status == status)&&(identical(other.service, service) || other.service == service)&&(identical(other.environment, environment) || other.environment == environment)&&(identical(other.apiVersion, apiVersion) || other.apiVersion == apiVersion)&&(identical(other.currentSeason, currentSeason) || other.currentSeason == currentSeason)&&(identical(other.lastSuccessfulSyncAt, lastSuccessfulSyncAt) || other.lastSuccessfulSyncAt == lastSuccessfulSyncAt)&&(identical(other.snapshotAgeSeconds, snapshotAgeSeconds) || other.snapshotAgeSeconds == snapshotAgeSeconds)&&(identical(other.maintenance, maintenance) || other.maintenance == maintenance));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,service,environment,apiVersion,currentSeason,lastSuccessfulSyncAt,snapshotAgeSeconds,maintenance);

@override
String toString() {
  return 'StatusDataDto(status: $status, service: $service, environment: $environment, apiVersion: $apiVersion, currentSeason: $currentSeason, lastSuccessfulSyncAt: $lastSuccessfulSyncAt, snapshotAgeSeconds: $snapshotAgeSeconds, maintenance: $maintenance)';
}


}

/// @nodoc
abstract mixin class _$StatusDataDtoCopyWith<$Res> implements $StatusDataDtoCopyWith<$Res> {
  factory _$StatusDataDtoCopyWith(_StatusDataDto value, $Res Function(_StatusDataDto) _then) = __$StatusDataDtoCopyWithImpl;
@override @useResult
$Res call({
 String status, String service, String environment, String apiVersion, int? currentSeason, String? lastSuccessfulSyncAt, int? snapshotAgeSeconds, bool maintenance
});




}
/// @nodoc
class __$StatusDataDtoCopyWithImpl<$Res>
    implements _$StatusDataDtoCopyWith<$Res> {
  __$StatusDataDtoCopyWithImpl(this._self, this._then);

  final _StatusDataDto _self;
  final $Res Function(_StatusDataDto) _then;

/// Create a copy of StatusDataDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,Object? service = null,Object? environment = null,Object? apiVersion = null,Object? currentSeason = freezed,Object? lastSuccessfulSyncAt = freezed,Object? snapshotAgeSeconds = freezed,Object? maintenance = null,}) {
  return _then(_StatusDataDto(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,service: null == service ? _self.service : service // ignore: cast_nullable_to_non_nullable
as String,environment: null == environment ? _self.environment : environment // ignore: cast_nullable_to_non_nullable
as String,apiVersion: null == apiVersion ? _self.apiVersion : apiVersion // ignore: cast_nullable_to_non_nullable
as String,currentSeason: freezed == currentSeason ? _self.currentSeason : currentSeason // ignore: cast_nullable_to_non_nullable
as int?,lastSuccessfulSyncAt: freezed == lastSuccessfulSyncAt ? _self.lastSuccessfulSyncAt : lastSuccessfulSyncAt // ignore: cast_nullable_to_non_nullable
as String?,snapshotAgeSeconds: freezed == snapshotAgeSeconds ? _self.snapshotAgeSeconds : snapshotAgeSeconds // ignore: cast_nullable_to_non_nullable
as int?,maintenance: null == maintenance ? _self.maintenance : maintenance // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$HomeDataDto {

 DataFreshnessDto get freshness; GrandPrixSummaryDto? get featuredEvent; SessionDto? get featuredSession; GrandPrixSummaryDto? get latestCompletedEvent; DriverStandingDto? get driverLeader; ConstructorStandingDto? get constructorLeader; List<GrandPrixSummaryDto> get upcomingEvents;
/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$HomeDataDtoCopyWith<HomeDataDto> get copyWith => _$HomeDataDtoCopyWithImpl<HomeDataDto>(this as HomeDataDto, _$identity);

  /// Serializes this HomeDataDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is HomeDataDto&&(identical(other.freshness, freshness) || other.freshness == freshness)&&(identical(other.featuredEvent, featuredEvent) || other.featuredEvent == featuredEvent)&&(identical(other.featuredSession, featuredSession) || other.featuredSession == featuredSession)&&(identical(other.latestCompletedEvent, latestCompletedEvent) || other.latestCompletedEvent == latestCompletedEvent)&&(identical(other.driverLeader, driverLeader) || other.driverLeader == driverLeader)&&(identical(other.constructorLeader, constructorLeader) || other.constructorLeader == constructorLeader)&&const DeepCollectionEquality().equals(other.upcomingEvents, upcomingEvents));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,freshness,featuredEvent,featuredSession,latestCompletedEvent,driverLeader,constructorLeader,const DeepCollectionEquality().hash(upcomingEvents));

@override
String toString() {
  return 'HomeDataDto(freshness: $freshness, featuredEvent: $featuredEvent, featuredSession: $featuredSession, latestCompletedEvent: $latestCompletedEvent, driverLeader: $driverLeader, constructorLeader: $constructorLeader, upcomingEvents: $upcomingEvents)';
}


}

/// @nodoc
abstract mixin class $HomeDataDtoCopyWith<$Res>  {
  factory $HomeDataDtoCopyWith(HomeDataDto value, $Res Function(HomeDataDto) _then) = _$HomeDataDtoCopyWithImpl;
@useResult
$Res call({
 DataFreshnessDto freshness, GrandPrixSummaryDto? featuredEvent, SessionDto? featuredSession, GrandPrixSummaryDto? latestCompletedEvent, DriverStandingDto? driverLeader, ConstructorStandingDto? constructorLeader, List<GrandPrixSummaryDto> upcomingEvents
});


$DataFreshnessDtoCopyWith<$Res> get freshness;$GrandPrixSummaryDtoCopyWith<$Res>? get featuredEvent;$SessionDtoCopyWith<$Res>? get featuredSession;$GrandPrixSummaryDtoCopyWith<$Res>? get latestCompletedEvent;$DriverStandingDtoCopyWith<$Res>? get driverLeader;$ConstructorStandingDtoCopyWith<$Res>? get constructorLeader;

}
/// @nodoc
class _$HomeDataDtoCopyWithImpl<$Res>
    implements $HomeDataDtoCopyWith<$Res> {
  _$HomeDataDtoCopyWithImpl(this._self, this._then);

  final HomeDataDto _self;
  final $Res Function(HomeDataDto) _then;

/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? freshness = null,Object? featuredEvent = freezed,Object? featuredSession = freezed,Object? latestCompletedEvent = freezed,Object? driverLeader = freezed,Object? constructorLeader = freezed,Object? upcomingEvents = null,}) {
  return _then(_self.copyWith(
freshness: null == freshness ? _self.freshness : freshness // ignore: cast_nullable_to_non_nullable
as DataFreshnessDto,featuredEvent: freezed == featuredEvent ? _self.featuredEvent : featuredEvent // ignore: cast_nullable_to_non_nullable
as GrandPrixSummaryDto?,featuredSession: freezed == featuredSession ? _self.featuredSession : featuredSession // ignore: cast_nullable_to_non_nullable
as SessionDto?,latestCompletedEvent: freezed == latestCompletedEvent ? _self.latestCompletedEvent : latestCompletedEvent // ignore: cast_nullable_to_non_nullable
as GrandPrixSummaryDto?,driverLeader: freezed == driverLeader ? _self.driverLeader : driverLeader // ignore: cast_nullable_to_non_nullable
as DriverStandingDto?,constructorLeader: freezed == constructorLeader ? _self.constructorLeader : constructorLeader // ignore: cast_nullable_to_non_nullable
as ConstructorStandingDto?,upcomingEvents: null == upcomingEvents ? _self.upcomingEvents : upcomingEvents // ignore: cast_nullable_to_non_nullable
as List<GrandPrixSummaryDto>,
  ));
}
/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DataFreshnessDtoCopyWith<$Res> get freshness {
  
  return $DataFreshnessDtoCopyWith<$Res>(_self.freshness, (value) {
    return _then(_self.copyWith(freshness: value));
  });
}/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GrandPrixSummaryDtoCopyWith<$Res>? get featuredEvent {
    if (_self.featuredEvent == null) {
    return null;
  }

  return $GrandPrixSummaryDtoCopyWith<$Res>(_self.featuredEvent!, (value) {
    return _then(_self.copyWith(featuredEvent: value));
  });
}/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SessionDtoCopyWith<$Res>? get featuredSession {
    if (_self.featuredSession == null) {
    return null;
  }

  return $SessionDtoCopyWith<$Res>(_self.featuredSession!, (value) {
    return _then(_self.copyWith(featuredSession: value));
  });
}/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GrandPrixSummaryDtoCopyWith<$Res>? get latestCompletedEvent {
    if (_self.latestCompletedEvent == null) {
    return null;
  }

  return $GrandPrixSummaryDtoCopyWith<$Res>(_self.latestCompletedEvent!, (value) {
    return _then(_self.copyWith(latestCompletedEvent: value));
  });
}/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DriverStandingDtoCopyWith<$Res>? get driverLeader {
    if (_self.driverLeader == null) {
    return null;
  }

  return $DriverStandingDtoCopyWith<$Res>(_self.driverLeader!, (value) {
    return _then(_self.copyWith(driverLeader: value));
  });
}/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConstructorStandingDtoCopyWith<$Res>? get constructorLeader {
    if (_self.constructorLeader == null) {
    return null;
  }

  return $ConstructorStandingDtoCopyWith<$Res>(_self.constructorLeader!, (value) {
    return _then(_self.copyWith(constructorLeader: value));
  });
}
}


/// Adds pattern-matching-related methods to [HomeDataDto].
extension HomeDataDtoPatterns on HomeDataDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _HomeDataDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _HomeDataDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _HomeDataDto value)  $default,){
final _that = this;
switch (_that) {
case _HomeDataDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _HomeDataDto value)?  $default,){
final _that = this;
switch (_that) {
case _HomeDataDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( DataFreshnessDto freshness,  GrandPrixSummaryDto? featuredEvent,  SessionDto? featuredSession,  GrandPrixSummaryDto? latestCompletedEvent,  DriverStandingDto? driverLeader,  ConstructorStandingDto? constructorLeader,  List<GrandPrixSummaryDto> upcomingEvents)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _HomeDataDto() when $default != null:
return $default(_that.freshness,_that.featuredEvent,_that.featuredSession,_that.latestCompletedEvent,_that.driverLeader,_that.constructorLeader,_that.upcomingEvents);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( DataFreshnessDto freshness,  GrandPrixSummaryDto? featuredEvent,  SessionDto? featuredSession,  GrandPrixSummaryDto? latestCompletedEvent,  DriverStandingDto? driverLeader,  ConstructorStandingDto? constructorLeader,  List<GrandPrixSummaryDto> upcomingEvents)  $default,) {final _that = this;
switch (_that) {
case _HomeDataDto():
return $default(_that.freshness,_that.featuredEvent,_that.featuredSession,_that.latestCompletedEvent,_that.driverLeader,_that.constructorLeader,_that.upcomingEvents);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( DataFreshnessDto freshness,  GrandPrixSummaryDto? featuredEvent,  SessionDto? featuredSession,  GrandPrixSummaryDto? latestCompletedEvent,  DriverStandingDto? driverLeader,  ConstructorStandingDto? constructorLeader,  List<GrandPrixSummaryDto> upcomingEvents)?  $default,) {final _that = this;
switch (_that) {
case _HomeDataDto() when $default != null:
return $default(_that.freshness,_that.featuredEvent,_that.featuredSession,_that.latestCompletedEvent,_that.driverLeader,_that.constructorLeader,_that.upcomingEvents);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _HomeDataDto implements HomeDataDto {
  const _HomeDataDto({required this.freshness, this.featuredEvent, this.featuredSession, this.latestCompletedEvent, this.driverLeader, this.constructorLeader, required final  List<GrandPrixSummaryDto> upcomingEvents}): _upcomingEvents = upcomingEvents;
  factory _HomeDataDto.fromJson(Map<String, dynamic> json) => _$HomeDataDtoFromJson(json);

@override final  DataFreshnessDto freshness;
@override final  GrandPrixSummaryDto? featuredEvent;
@override final  SessionDto? featuredSession;
@override final  GrandPrixSummaryDto? latestCompletedEvent;
@override final  DriverStandingDto? driverLeader;
@override final  ConstructorStandingDto? constructorLeader;
 final  List<GrandPrixSummaryDto> _upcomingEvents;
@override List<GrandPrixSummaryDto> get upcomingEvents {
  if (_upcomingEvents is EqualUnmodifiableListView) return _upcomingEvents;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_upcomingEvents);
}


/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$HomeDataDtoCopyWith<_HomeDataDto> get copyWith => __$HomeDataDtoCopyWithImpl<_HomeDataDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$HomeDataDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _HomeDataDto&&(identical(other.freshness, freshness) || other.freshness == freshness)&&(identical(other.featuredEvent, featuredEvent) || other.featuredEvent == featuredEvent)&&(identical(other.featuredSession, featuredSession) || other.featuredSession == featuredSession)&&(identical(other.latestCompletedEvent, latestCompletedEvent) || other.latestCompletedEvent == latestCompletedEvent)&&(identical(other.driverLeader, driverLeader) || other.driverLeader == driverLeader)&&(identical(other.constructorLeader, constructorLeader) || other.constructorLeader == constructorLeader)&&const DeepCollectionEquality().equals(other._upcomingEvents, _upcomingEvents));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,freshness,featuredEvent,featuredSession,latestCompletedEvent,driverLeader,constructorLeader,const DeepCollectionEquality().hash(_upcomingEvents));

@override
String toString() {
  return 'HomeDataDto(freshness: $freshness, featuredEvent: $featuredEvent, featuredSession: $featuredSession, latestCompletedEvent: $latestCompletedEvent, driverLeader: $driverLeader, constructorLeader: $constructorLeader, upcomingEvents: $upcomingEvents)';
}


}

/// @nodoc
abstract mixin class _$HomeDataDtoCopyWith<$Res> implements $HomeDataDtoCopyWith<$Res> {
  factory _$HomeDataDtoCopyWith(_HomeDataDto value, $Res Function(_HomeDataDto) _then) = __$HomeDataDtoCopyWithImpl;
@override @useResult
$Res call({
 DataFreshnessDto freshness, GrandPrixSummaryDto? featuredEvent, SessionDto? featuredSession, GrandPrixSummaryDto? latestCompletedEvent, DriverStandingDto? driverLeader, ConstructorStandingDto? constructorLeader, List<GrandPrixSummaryDto> upcomingEvents
});


@override $DataFreshnessDtoCopyWith<$Res> get freshness;@override $GrandPrixSummaryDtoCopyWith<$Res>? get featuredEvent;@override $SessionDtoCopyWith<$Res>? get featuredSession;@override $GrandPrixSummaryDtoCopyWith<$Res>? get latestCompletedEvent;@override $DriverStandingDtoCopyWith<$Res>? get driverLeader;@override $ConstructorStandingDtoCopyWith<$Res>? get constructorLeader;

}
/// @nodoc
class __$HomeDataDtoCopyWithImpl<$Res>
    implements _$HomeDataDtoCopyWith<$Res> {
  __$HomeDataDtoCopyWithImpl(this._self, this._then);

  final _HomeDataDto _self;
  final $Res Function(_HomeDataDto) _then;

/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? freshness = null,Object? featuredEvent = freezed,Object? featuredSession = freezed,Object? latestCompletedEvent = freezed,Object? driverLeader = freezed,Object? constructorLeader = freezed,Object? upcomingEvents = null,}) {
  return _then(_HomeDataDto(
freshness: null == freshness ? _self.freshness : freshness // ignore: cast_nullable_to_non_nullable
as DataFreshnessDto,featuredEvent: freezed == featuredEvent ? _self.featuredEvent : featuredEvent // ignore: cast_nullable_to_non_nullable
as GrandPrixSummaryDto?,featuredSession: freezed == featuredSession ? _self.featuredSession : featuredSession // ignore: cast_nullable_to_non_nullable
as SessionDto?,latestCompletedEvent: freezed == latestCompletedEvent ? _self.latestCompletedEvent : latestCompletedEvent // ignore: cast_nullable_to_non_nullable
as GrandPrixSummaryDto?,driverLeader: freezed == driverLeader ? _self.driverLeader : driverLeader // ignore: cast_nullable_to_non_nullable
as DriverStandingDto?,constructorLeader: freezed == constructorLeader ? _self.constructorLeader : constructorLeader // ignore: cast_nullable_to_non_nullable
as ConstructorStandingDto?,upcomingEvents: null == upcomingEvents ? _self._upcomingEvents : upcomingEvents // ignore: cast_nullable_to_non_nullable
as List<GrandPrixSummaryDto>,
  ));
}

/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DataFreshnessDtoCopyWith<$Res> get freshness {
  
  return $DataFreshnessDtoCopyWith<$Res>(_self.freshness, (value) {
    return _then(_self.copyWith(freshness: value));
  });
}/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GrandPrixSummaryDtoCopyWith<$Res>? get featuredEvent {
    if (_self.featuredEvent == null) {
    return null;
  }

  return $GrandPrixSummaryDtoCopyWith<$Res>(_self.featuredEvent!, (value) {
    return _then(_self.copyWith(featuredEvent: value));
  });
}/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SessionDtoCopyWith<$Res>? get featuredSession {
    if (_self.featuredSession == null) {
    return null;
  }

  return $SessionDtoCopyWith<$Res>(_self.featuredSession!, (value) {
    return _then(_self.copyWith(featuredSession: value));
  });
}/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GrandPrixSummaryDtoCopyWith<$Res>? get latestCompletedEvent {
    if (_self.latestCompletedEvent == null) {
    return null;
  }

  return $GrandPrixSummaryDtoCopyWith<$Res>(_self.latestCompletedEvent!, (value) {
    return _then(_self.copyWith(latestCompletedEvent: value));
  });
}/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DriverStandingDtoCopyWith<$Res>? get driverLeader {
    if (_self.driverLeader == null) {
    return null;
  }

  return $DriverStandingDtoCopyWith<$Res>(_self.driverLeader!, (value) {
    return _then(_self.copyWith(driverLeader: value));
  });
}/// Create a copy of HomeDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConstructorStandingDtoCopyWith<$Res>? get constructorLeader {
    if (_self.constructorLeader == null) {
    return null;
  }

  return $ConstructorStandingDtoCopyWith<$Res>(_self.constructorLeader!, (value) {
    return _then(_self.copyWith(constructorLeader: value));
  });
}
}


/// @nodoc
mixin _$BootstrapDataDto {

 SeasonDto get season; List<GrandPrixSummaryDto> get calendar; List<SeasonDriverSummaryDto> get drivers; List<SeasonConstructorSummaryDto> get constructors; List<CircuitSummaryDto> get circuits; List<DriverStandingDto> get driverStandings; List<ConstructorStandingDto> get constructorStandings; HomeDataDto get home; String? get contentVersion; String? get mediaVersion;
/// Create a copy of BootstrapDataDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BootstrapDataDtoCopyWith<BootstrapDataDto> get copyWith => _$BootstrapDataDtoCopyWithImpl<BootstrapDataDto>(this as BootstrapDataDto, _$identity);

  /// Serializes this BootstrapDataDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BootstrapDataDto&&(identical(other.season, season) || other.season == season)&&const DeepCollectionEquality().equals(other.calendar, calendar)&&const DeepCollectionEquality().equals(other.drivers, drivers)&&const DeepCollectionEquality().equals(other.constructors, constructors)&&const DeepCollectionEquality().equals(other.circuits, circuits)&&const DeepCollectionEquality().equals(other.driverStandings, driverStandings)&&const DeepCollectionEquality().equals(other.constructorStandings, constructorStandings)&&(identical(other.home, home) || other.home == home)&&(identical(other.contentVersion, contentVersion) || other.contentVersion == contentVersion)&&(identical(other.mediaVersion, mediaVersion) || other.mediaVersion == mediaVersion));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,season,const DeepCollectionEquality().hash(calendar),const DeepCollectionEquality().hash(drivers),const DeepCollectionEquality().hash(constructors),const DeepCollectionEquality().hash(circuits),const DeepCollectionEquality().hash(driverStandings),const DeepCollectionEquality().hash(constructorStandings),home,contentVersion,mediaVersion);

@override
String toString() {
  return 'BootstrapDataDto(season: $season, calendar: $calendar, drivers: $drivers, constructors: $constructors, circuits: $circuits, driverStandings: $driverStandings, constructorStandings: $constructorStandings, home: $home, contentVersion: $contentVersion, mediaVersion: $mediaVersion)';
}


}

/// @nodoc
abstract mixin class $BootstrapDataDtoCopyWith<$Res>  {
  factory $BootstrapDataDtoCopyWith(BootstrapDataDto value, $Res Function(BootstrapDataDto) _then) = _$BootstrapDataDtoCopyWithImpl;
@useResult
$Res call({
 SeasonDto season, List<GrandPrixSummaryDto> calendar, List<SeasonDriverSummaryDto> drivers, List<SeasonConstructorSummaryDto> constructors, List<CircuitSummaryDto> circuits, List<DriverStandingDto> driverStandings, List<ConstructorStandingDto> constructorStandings, HomeDataDto home, String? contentVersion, String? mediaVersion
});


$SeasonDtoCopyWith<$Res> get season;$HomeDataDtoCopyWith<$Res> get home;

}
/// @nodoc
class _$BootstrapDataDtoCopyWithImpl<$Res>
    implements $BootstrapDataDtoCopyWith<$Res> {
  _$BootstrapDataDtoCopyWithImpl(this._self, this._then);

  final BootstrapDataDto _self;
  final $Res Function(BootstrapDataDto) _then;

/// Create a copy of BootstrapDataDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? season = null,Object? calendar = null,Object? drivers = null,Object? constructors = null,Object? circuits = null,Object? driverStandings = null,Object? constructorStandings = null,Object? home = null,Object? contentVersion = freezed,Object? mediaVersion = freezed,}) {
  return _then(_self.copyWith(
season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as SeasonDto,calendar: null == calendar ? _self.calendar : calendar // ignore: cast_nullable_to_non_nullable
as List<GrandPrixSummaryDto>,drivers: null == drivers ? _self.drivers : drivers // ignore: cast_nullable_to_non_nullable
as List<SeasonDriverSummaryDto>,constructors: null == constructors ? _self.constructors : constructors // ignore: cast_nullable_to_non_nullable
as List<SeasonConstructorSummaryDto>,circuits: null == circuits ? _self.circuits : circuits // ignore: cast_nullable_to_non_nullable
as List<CircuitSummaryDto>,driverStandings: null == driverStandings ? _self.driverStandings : driverStandings // ignore: cast_nullable_to_non_nullable
as List<DriverStandingDto>,constructorStandings: null == constructorStandings ? _self.constructorStandings : constructorStandings // ignore: cast_nullable_to_non_nullable
as List<ConstructorStandingDto>,home: null == home ? _self.home : home // ignore: cast_nullable_to_non_nullable
as HomeDataDto,contentVersion: freezed == contentVersion ? _self.contentVersion : contentVersion // ignore: cast_nullable_to_non_nullable
as String?,mediaVersion: freezed == mediaVersion ? _self.mediaVersion : mediaVersion // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of BootstrapDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SeasonDtoCopyWith<$Res> get season {
  
  return $SeasonDtoCopyWith<$Res>(_self.season, (value) {
    return _then(_self.copyWith(season: value));
  });
}/// Create a copy of BootstrapDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$HomeDataDtoCopyWith<$Res> get home {
  
  return $HomeDataDtoCopyWith<$Res>(_self.home, (value) {
    return _then(_self.copyWith(home: value));
  });
}
}


/// Adds pattern-matching-related methods to [BootstrapDataDto].
extension BootstrapDataDtoPatterns on BootstrapDataDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BootstrapDataDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BootstrapDataDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BootstrapDataDto value)  $default,){
final _that = this;
switch (_that) {
case _BootstrapDataDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BootstrapDataDto value)?  $default,){
final _that = this;
switch (_that) {
case _BootstrapDataDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( SeasonDto season,  List<GrandPrixSummaryDto> calendar,  List<SeasonDriverSummaryDto> drivers,  List<SeasonConstructorSummaryDto> constructors,  List<CircuitSummaryDto> circuits,  List<DriverStandingDto> driverStandings,  List<ConstructorStandingDto> constructorStandings,  HomeDataDto home,  String? contentVersion,  String? mediaVersion)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BootstrapDataDto() when $default != null:
return $default(_that.season,_that.calendar,_that.drivers,_that.constructors,_that.circuits,_that.driverStandings,_that.constructorStandings,_that.home,_that.contentVersion,_that.mediaVersion);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( SeasonDto season,  List<GrandPrixSummaryDto> calendar,  List<SeasonDriverSummaryDto> drivers,  List<SeasonConstructorSummaryDto> constructors,  List<CircuitSummaryDto> circuits,  List<DriverStandingDto> driverStandings,  List<ConstructorStandingDto> constructorStandings,  HomeDataDto home,  String? contentVersion,  String? mediaVersion)  $default,) {final _that = this;
switch (_that) {
case _BootstrapDataDto():
return $default(_that.season,_that.calendar,_that.drivers,_that.constructors,_that.circuits,_that.driverStandings,_that.constructorStandings,_that.home,_that.contentVersion,_that.mediaVersion);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( SeasonDto season,  List<GrandPrixSummaryDto> calendar,  List<SeasonDriverSummaryDto> drivers,  List<SeasonConstructorSummaryDto> constructors,  List<CircuitSummaryDto> circuits,  List<DriverStandingDto> driverStandings,  List<ConstructorStandingDto> constructorStandings,  HomeDataDto home,  String? contentVersion,  String? mediaVersion)?  $default,) {final _that = this;
switch (_that) {
case _BootstrapDataDto() when $default != null:
return $default(_that.season,_that.calendar,_that.drivers,_that.constructors,_that.circuits,_that.driverStandings,_that.constructorStandings,_that.home,_that.contentVersion,_that.mediaVersion);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _BootstrapDataDto implements BootstrapDataDto {
  const _BootstrapDataDto({required this.season, required final  List<GrandPrixSummaryDto> calendar, required final  List<SeasonDriverSummaryDto> drivers, required final  List<SeasonConstructorSummaryDto> constructors, required final  List<CircuitSummaryDto> circuits, required final  List<DriverStandingDto> driverStandings, required final  List<ConstructorStandingDto> constructorStandings, required this.home, this.contentVersion, this.mediaVersion}): _calendar = calendar,_drivers = drivers,_constructors = constructors,_circuits = circuits,_driverStandings = driverStandings,_constructorStandings = constructorStandings;
  factory _BootstrapDataDto.fromJson(Map<String, dynamic> json) => _$BootstrapDataDtoFromJson(json);

@override final  SeasonDto season;
 final  List<GrandPrixSummaryDto> _calendar;
@override List<GrandPrixSummaryDto> get calendar {
  if (_calendar is EqualUnmodifiableListView) return _calendar;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_calendar);
}

 final  List<SeasonDriverSummaryDto> _drivers;
@override List<SeasonDriverSummaryDto> get drivers {
  if (_drivers is EqualUnmodifiableListView) return _drivers;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_drivers);
}

 final  List<SeasonConstructorSummaryDto> _constructors;
@override List<SeasonConstructorSummaryDto> get constructors {
  if (_constructors is EqualUnmodifiableListView) return _constructors;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_constructors);
}

 final  List<CircuitSummaryDto> _circuits;
@override List<CircuitSummaryDto> get circuits {
  if (_circuits is EqualUnmodifiableListView) return _circuits;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_circuits);
}

 final  List<DriverStandingDto> _driverStandings;
@override List<DriverStandingDto> get driverStandings {
  if (_driverStandings is EqualUnmodifiableListView) return _driverStandings;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_driverStandings);
}

 final  List<ConstructorStandingDto> _constructorStandings;
@override List<ConstructorStandingDto> get constructorStandings {
  if (_constructorStandings is EqualUnmodifiableListView) return _constructorStandings;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_constructorStandings);
}

@override final  HomeDataDto home;
@override final  String? contentVersion;
@override final  String? mediaVersion;

/// Create a copy of BootstrapDataDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BootstrapDataDtoCopyWith<_BootstrapDataDto> get copyWith => __$BootstrapDataDtoCopyWithImpl<_BootstrapDataDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BootstrapDataDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BootstrapDataDto&&(identical(other.season, season) || other.season == season)&&const DeepCollectionEquality().equals(other._calendar, _calendar)&&const DeepCollectionEquality().equals(other._drivers, _drivers)&&const DeepCollectionEquality().equals(other._constructors, _constructors)&&const DeepCollectionEquality().equals(other._circuits, _circuits)&&const DeepCollectionEquality().equals(other._driverStandings, _driverStandings)&&const DeepCollectionEquality().equals(other._constructorStandings, _constructorStandings)&&(identical(other.home, home) || other.home == home)&&(identical(other.contentVersion, contentVersion) || other.contentVersion == contentVersion)&&(identical(other.mediaVersion, mediaVersion) || other.mediaVersion == mediaVersion));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,season,const DeepCollectionEquality().hash(_calendar),const DeepCollectionEquality().hash(_drivers),const DeepCollectionEquality().hash(_constructors),const DeepCollectionEquality().hash(_circuits),const DeepCollectionEquality().hash(_driverStandings),const DeepCollectionEquality().hash(_constructorStandings),home,contentVersion,mediaVersion);

@override
String toString() {
  return 'BootstrapDataDto(season: $season, calendar: $calendar, drivers: $drivers, constructors: $constructors, circuits: $circuits, driverStandings: $driverStandings, constructorStandings: $constructorStandings, home: $home, contentVersion: $contentVersion, mediaVersion: $mediaVersion)';
}


}

/// @nodoc
abstract mixin class _$BootstrapDataDtoCopyWith<$Res> implements $BootstrapDataDtoCopyWith<$Res> {
  factory _$BootstrapDataDtoCopyWith(_BootstrapDataDto value, $Res Function(_BootstrapDataDto) _then) = __$BootstrapDataDtoCopyWithImpl;
@override @useResult
$Res call({
 SeasonDto season, List<GrandPrixSummaryDto> calendar, List<SeasonDriverSummaryDto> drivers, List<SeasonConstructorSummaryDto> constructors, List<CircuitSummaryDto> circuits, List<DriverStandingDto> driverStandings, List<ConstructorStandingDto> constructorStandings, HomeDataDto home, String? contentVersion, String? mediaVersion
});


@override $SeasonDtoCopyWith<$Res> get season;@override $HomeDataDtoCopyWith<$Res> get home;

}
/// @nodoc
class __$BootstrapDataDtoCopyWithImpl<$Res>
    implements _$BootstrapDataDtoCopyWith<$Res> {
  __$BootstrapDataDtoCopyWithImpl(this._self, this._then);

  final _BootstrapDataDto _self;
  final $Res Function(_BootstrapDataDto) _then;

/// Create a copy of BootstrapDataDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? season = null,Object? calendar = null,Object? drivers = null,Object? constructors = null,Object? circuits = null,Object? driverStandings = null,Object? constructorStandings = null,Object? home = null,Object? contentVersion = freezed,Object? mediaVersion = freezed,}) {
  return _then(_BootstrapDataDto(
season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as SeasonDto,calendar: null == calendar ? _self._calendar : calendar // ignore: cast_nullable_to_non_nullable
as List<GrandPrixSummaryDto>,drivers: null == drivers ? _self._drivers : drivers // ignore: cast_nullable_to_non_nullable
as List<SeasonDriverSummaryDto>,constructors: null == constructors ? _self._constructors : constructors // ignore: cast_nullable_to_non_nullable
as List<SeasonConstructorSummaryDto>,circuits: null == circuits ? _self._circuits : circuits // ignore: cast_nullable_to_non_nullable
as List<CircuitSummaryDto>,driverStandings: null == driverStandings ? _self._driverStandings : driverStandings // ignore: cast_nullable_to_non_nullable
as List<DriverStandingDto>,constructorStandings: null == constructorStandings ? _self._constructorStandings : constructorStandings // ignore: cast_nullable_to_non_nullable
as List<ConstructorStandingDto>,home: null == home ? _self.home : home // ignore: cast_nullable_to_non_nullable
as HomeDataDto,contentVersion: freezed == contentVersion ? _self.contentVersion : contentVersion // ignore: cast_nullable_to_non_nullable
as String?,mediaVersion: freezed == mediaVersion ? _self.mediaVersion : mediaVersion // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of BootstrapDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SeasonDtoCopyWith<$Res> get season {
  
  return $SeasonDtoCopyWith<$Res>(_self.season, (value) {
    return _then(_self.copyWith(season: value));
  });
}/// Create a copy of BootstrapDataDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$HomeDataDtoCopyWith<$Res> get home {
  
  return $HomeDataDtoCopyWith<$Res>(_self.home, (value) {
    return _then(_self.copyWith(home: value));
  });
}
}


/// @nodoc
mixin _$ContentManifestDto {

 String get contentVersion; String? get mediaVersion; List<int> get supportedSeasons; String? get attributionVersion; int get minimumApiSchemaVersion;
/// Create a copy of ContentManifestDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ContentManifestDtoCopyWith<ContentManifestDto> get copyWith => _$ContentManifestDtoCopyWithImpl<ContentManifestDto>(this as ContentManifestDto, _$identity);

  /// Serializes this ContentManifestDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ContentManifestDto&&(identical(other.contentVersion, contentVersion) || other.contentVersion == contentVersion)&&(identical(other.mediaVersion, mediaVersion) || other.mediaVersion == mediaVersion)&&const DeepCollectionEquality().equals(other.supportedSeasons, supportedSeasons)&&(identical(other.attributionVersion, attributionVersion) || other.attributionVersion == attributionVersion)&&(identical(other.minimumApiSchemaVersion, minimumApiSchemaVersion) || other.minimumApiSchemaVersion == minimumApiSchemaVersion));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,contentVersion,mediaVersion,const DeepCollectionEquality().hash(supportedSeasons),attributionVersion,minimumApiSchemaVersion);

@override
String toString() {
  return 'ContentManifestDto(contentVersion: $contentVersion, mediaVersion: $mediaVersion, supportedSeasons: $supportedSeasons, attributionVersion: $attributionVersion, minimumApiSchemaVersion: $minimumApiSchemaVersion)';
}


}

/// @nodoc
abstract mixin class $ContentManifestDtoCopyWith<$Res>  {
  factory $ContentManifestDtoCopyWith(ContentManifestDto value, $Res Function(ContentManifestDto) _then) = _$ContentManifestDtoCopyWithImpl;
@useResult
$Res call({
 String contentVersion, String? mediaVersion, List<int> supportedSeasons, String? attributionVersion, int minimumApiSchemaVersion
});




}
/// @nodoc
class _$ContentManifestDtoCopyWithImpl<$Res>
    implements $ContentManifestDtoCopyWith<$Res> {
  _$ContentManifestDtoCopyWithImpl(this._self, this._then);

  final ContentManifestDto _self;
  final $Res Function(ContentManifestDto) _then;

/// Create a copy of ContentManifestDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? contentVersion = null,Object? mediaVersion = freezed,Object? supportedSeasons = null,Object? attributionVersion = freezed,Object? minimumApiSchemaVersion = null,}) {
  return _then(_self.copyWith(
contentVersion: null == contentVersion ? _self.contentVersion : contentVersion // ignore: cast_nullable_to_non_nullable
as String,mediaVersion: freezed == mediaVersion ? _self.mediaVersion : mediaVersion // ignore: cast_nullable_to_non_nullable
as String?,supportedSeasons: null == supportedSeasons ? _self.supportedSeasons : supportedSeasons // ignore: cast_nullable_to_non_nullable
as List<int>,attributionVersion: freezed == attributionVersion ? _self.attributionVersion : attributionVersion // ignore: cast_nullable_to_non_nullable
as String?,minimumApiSchemaVersion: null == minimumApiSchemaVersion ? _self.minimumApiSchemaVersion : minimumApiSchemaVersion // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [ContentManifestDto].
extension ContentManifestDtoPatterns on ContentManifestDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ContentManifestDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ContentManifestDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ContentManifestDto value)  $default,){
final _that = this;
switch (_that) {
case _ContentManifestDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ContentManifestDto value)?  $default,){
final _that = this;
switch (_that) {
case _ContentManifestDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String contentVersion,  String? mediaVersion,  List<int> supportedSeasons,  String? attributionVersion,  int minimumApiSchemaVersion)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ContentManifestDto() when $default != null:
return $default(_that.contentVersion,_that.mediaVersion,_that.supportedSeasons,_that.attributionVersion,_that.minimumApiSchemaVersion);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String contentVersion,  String? mediaVersion,  List<int> supportedSeasons,  String? attributionVersion,  int minimumApiSchemaVersion)  $default,) {final _that = this;
switch (_that) {
case _ContentManifestDto():
return $default(_that.contentVersion,_that.mediaVersion,_that.supportedSeasons,_that.attributionVersion,_that.minimumApiSchemaVersion);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String contentVersion,  String? mediaVersion,  List<int> supportedSeasons,  String? attributionVersion,  int minimumApiSchemaVersion)?  $default,) {final _that = this;
switch (_that) {
case _ContentManifestDto() when $default != null:
return $default(_that.contentVersion,_that.mediaVersion,_that.supportedSeasons,_that.attributionVersion,_that.minimumApiSchemaVersion);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ContentManifestDto implements ContentManifestDto {
  const _ContentManifestDto({required this.contentVersion, this.mediaVersion, required final  List<int> supportedSeasons, this.attributionVersion, required this.minimumApiSchemaVersion}): _supportedSeasons = supportedSeasons;
  factory _ContentManifestDto.fromJson(Map<String, dynamic> json) => _$ContentManifestDtoFromJson(json);

@override final  String contentVersion;
@override final  String? mediaVersion;
 final  List<int> _supportedSeasons;
@override List<int> get supportedSeasons {
  if (_supportedSeasons is EqualUnmodifiableListView) return _supportedSeasons;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_supportedSeasons);
}

@override final  String? attributionVersion;
@override final  int minimumApiSchemaVersion;

/// Create a copy of ContentManifestDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ContentManifestDtoCopyWith<_ContentManifestDto> get copyWith => __$ContentManifestDtoCopyWithImpl<_ContentManifestDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ContentManifestDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ContentManifestDto&&(identical(other.contentVersion, contentVersion) || other.contentVersion == contentVersion)&&(identical(other.mediaVersion, mediaVersion) || other.mediaVersion == mediaVersion)&&const DeepCollectionEquality().equals(other._supportedSeasons, _supportedSeasons)&&(identical(other.attributionVersion, attributionVersion) || other.attributionVersion == attributionVersion)&&(identical(other.minimumApiSchemaVersion, minimumApiSchemaVersion) || other.minimumApiSchemaVersion == minimumApiSchemaVersion));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,contentVersion,mediaVersion,const DeepCollectionEquality().hash(_supportedSeasons),attributionVersion,minimumApiSchemaVersion);

@override
String toString() {
  return 'ContentManifestDto(contentVersion: $contentVersion, mediaVersion: $mediaVersion, supportedSeasons: $supportedSeasons, attributionVersion: $attributionVersion, minimumApiSchemaVersion: $minimumApiSchemaVersion)';
}


}

/// @nodoc
abstract mixin class _$ContentManifestDtoCopyWith<$Res> implements $ContentManifestDtoCopyWith<$Res> {
  factory _$ContentManifestDtoCopyWith(_ContentManifestDto value, $Res Function(_ContentManifestDto) _then) = __$ContentManifestDtoCopyWithImpl;
@override @useResult
$Res call({
 String contentVersion, String? mediaVersion, List<int> supportedSeasons, String? attributionVersion, int minimumApiSchemaVersion
});




}
/// @nodoc
class __$ContentManifestDtoCopyWithImpl<$Res>
    implements _$ContentManifestDtoCopyWith<$Res> {
  __$ContentManifestDtoCopyWithImpl(this._self, this._then);

  final _ContentManifestDto _self;
  final $Res Function(_ContentManifestDto) _then;

/// Create a copy of ContentManifestDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? contentVersion = null,Object? mediaVersion = freezed,Object? supportedSeasons = null,Object? attributionVersion = freezed,Object? minimumApiSchemaVersion = null,}) {
  return _then(_ContentManifestDto(
contentVersion: null == contentVersion ? _self.contentVersion : contentVersion // ignore: cast_nullable_to_non_nullable
as String,mediaVersion: freezed == mediaVersion ? _self.mediaVersion : mediaVersion // ignore: cast_nullable_to_non_nullable
as String?,supportedSeasons: null == supportedSeasons ? _self._supportedSeasons : supportedSeasons // ignore: cast_nullable_to_non_nullable
as List<int>,attributionVersion: freezed == attributionVersion ? _self.attributionVersion : attributionVersion // ignore: cast_nullable_to_non_nullable
as String?,minimumApiSchemaVersion: null == minimumApiSchemaVersion ? _self.minimumApiSchemaVersion : minimumApiSchemaVersion // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
