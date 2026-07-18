// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'meta_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$MetaDto {

 String get apiVersion; String get generatedAt; String get requestId; int? get schemaVersion; int? get season; String? get sourceUpdatedAt; String? get staleAfter; String? get contentVersion;
/// Create a copy of MetaDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MetaDtoCopyWith<MetaDto> get copyWith => _$MetaDtoCopyWithImpl<MetaDto>(this as MetaDto, _$identity);

  /// Serializes this MetaDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MetaDto&&(identical(other.apiVersion, apiVersion) || other.apiVersion == apiVersion)&&(identical(other.generatedAt, generatedAt) || other.generatedAt == generatedAt)&&(identical(other.requestId, requestId) || other.requestId == requestId)&&(identical(other.schemaVersion, schemaVersion) || other.schemaVersion == schemaVersion)&&(identical(other.season, season) || other.season == season)&&(identical(other.sourceUpdatedAt, sourceUpdatedAt) || other.sourceUpdatedAt == sourceUpdatedAt)&&(identical(other.staleAfter, staleAfter) || other.staleAfter == staleAfter)&&(identical(other.contentVersion, contentVersion) || other.contentVersion == contentVersion));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,apiVersion,generatedAt,requestId,schemaVersion,season,sourceUpdatedAt,staleAfter,contentVersion);

@override
String toString() {
  return 'MetaDto(apiVersion: $apiVersion, generatedAt: $generatedAt, requestId: $requestId, schemaVersion: $schemaVersion, season: $season, sourceUpdatedAt: $sourceUpdatedAt, staleAfter: $staleAfter, contentVersion: $contentVersion)';
}


}

/// @nodoc
abstract mixin class $MetaDtoCopyWith<$Res>  {
  factory $MetaDtoCopyWith(MetaDto value, $Res Function(MetaDto) _then) = _$MetaDtoCopyWithImpl;
@useResult
$Res call({
 String apiVersion, String generatedAt, String requestId, int? schemaVersion, int? season, String? sourceUpdatedAt, String? staleAfter, String? contentVersion
});




}
/// @nodoc
class _$MetaDtoCopyWithImpl<$Res>
    implements $MetaDtoCopyWith<$Res> {
  _$MetaDtoCopyWithImpl(this._self, this._then);

  final MetaDto _self;
  final $Res Function(MetaDto) _then;

/// Create a copy of MetaDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? apiVersion = null,Object? generatedAt = null,Object? requestId = null,Object? schemaVersion = freezed,Object? season = freezed,Object? sourceUpdatedAt = freezed,Object? staleAfter = freezed,Object? contentVersion = freezed,}) {
  return _then(_self.copyWith(
apiVersion: null == apiVersion ? _self.apiVersion : apiVersion // ignore: cast_nullable_to_non_nullable
as String,generatedAt: null == generatedAt ? _self.generatedAt : generatedAt // ignore: cast_nullable_to_non_nullable
as String,requestId: null == requestId ? _self.requestId : requestId // ignore: cast_nullable_to_non_nullable
as String,schemaVersion: freezed == schemaVersion ? _self.schemaVersion : schemaVersion // ignore: cast_nullable_to_non_nullable
as int?,season: freezed == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int?,sourceUpdatedAt: freezed == sourceUpdatedAt ? _self.sourceUpdatedAt : sourceUpdatedAt // ignore: cast_nullable_to_non_nullable
as String?,staleAfter: freezed == staleAfter ? _self.staleAfter : staleAfter // ignore: cast_nullable_to_non_nullable
as String?,contentVersion: freezed == contentVersion ? _self.contentVersion : contentVersion // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [MetaDto].
extension MetaDtoPatterns on MetaDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MetaDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MetaDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MetaDto value)  $default,){
final _that = this;
switch (_that) {
case _MetaDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MetaDto value)?  $default,){
final _that = this;
switch (_that) {
case _MetaDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String apiVersion,  String generatedAt,  String requestId,  int? schemaVersion,  int? season,  String? sourceUpdatedAt,  String? staleAfter,  String? contentVersion)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MetaDto() when $default != null:
return $default(_that.apiVersion,_that.generatedAt,_that.requestId,_that.schemaVersion,_that.season,_that.sourceUpdatedAt,_that.staleAfter,_that.contentVersion);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String apiVersion,  String generatedAt,  String requestId,  int? schemaVersion,  int? season,  String? sourceUpdatedAt,  String? staleAfter,  String? contentVersion)  $default,) {final _that = this;
switch (_that) {
case _MetaDto():
return $default(_that.apiVersion,_that.generatedAt,_that.requestId,_that.schemaVersion,_that.season,_that.sourceUpdatedAt,_that.staleAfter,_that.contentVersion);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String apiVersion,  String generatedAt,  String requestId,  int? schemaVersion,  int? season,  String? sourceUpdatedAt,  String? staleAfter,  String? contentVersion)?  $default,) {final _that = this;
switch (_that) {
case _MetaDto() when $default != null:
return $default(_that.apiVersion,_that.generatedAt,_that.requestId,_that.schemaVersion,_that.season,_that.sourceUpdatedAt,_that.staleAfter,_that.contentVersion);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MetaDto implements MetaDto {
  const _MetaDto({required this.apiVersion, required this.generatedAt, required this.requestId, this.schemaVersion, this.season, this.sourceUpdatedAt, this.staleAfter, this.contentVersion});
  factory _MetaDto.fromJson(Map<String, dynamic> json) => _$MetaDtoFromJson(json);

@override final  String apiVersion;
@override final  String generatedAt;
@override final  String requestId;
@override final  int? schemaVersion;
@override final  int? season;
@override final  String? sourceUpdatedAt;
@override final  String? staleAfter;
@override final  String? contentVersion;

/// Create a copy of MetaDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MetaDtoCopyWith<_MetaDto> get copyWith => __$MetaDtoCopyWithImpl<_MetaDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MetaDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MetaDto&&(identical(other.apiVersion, apiVersion) || other.apiVersion == apiVersion)&&(identical(other.generatedAt, generatedAt) || other.generatedAt == generatedAt)&&(identical(other.requestId, requestId) || other.requestId == requestId)&&(identical(other.schemaVersion, schemaVersion) || other.schemaVersion == schemaVersion)&&(identical(other.season, season) || other.season == season)&&(identical(other.sourceUpdatedAt, sourceUpdatedAt) || other.sourceUpdatedAt == sourceUpdatedAt)&&(identical(other.staleAfter, staleAfter) || other.staleAfter == staleAfter)&&(identical(other.contentVersion, contentVersion) || other.contentVersion == contentVersion));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,apiVersion,generatedAt,requestId,schemaVersion,season,sourceUpdatedAt,staleAfter,contentVersion);

@override
String toString() {
  return 'MetaDto(apiVersion: $apiVersion, generatedAt: $generatedAt, requestId: $requestId, schemaVersion: $schemaVersion, season: $season, sourceUpdatedAt: $sourceUpdatedAt, staleAfter: $staleAfter, contentVersion: $contentVersion)';
}


}

/// @nodoc
abstract mixin class _$MetaDtoCopyWith<$Res> implements $MetaDtoCopyWith<$Res> {
  factory _$MetaDtoCopyWith(_MetaDto value, $Res Function(_MetaDto) _then) = __$MetaDtoCopyWithImpl;
@override @useResult
$Res call({
 String apiVersion, String generatedAt, String requestId, int? schemaVersion, int? season, String? sourceUpdatedAt, String? staleAfter, String? contentVersion
});




}
/// @nodoc
class __$MetaDtoCopyWithImpl<$Res>
    implements _$MetaDtoCopyWith<$Res> {
  __$MetaDtoCopyWithImpl(this._self, this._then);

  final _MetaDto _self;
  final $Res Function(_MetaDto) _then;

/// Create a copy of MetaDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? apiVersion = null,Object? generatedAt = null,Object? requestId = null,Object? schemaVersion = freezed,Object? season = freezed,Object? sourceUpdatedAt = freezed,Object? staleAfter = freezed,Object? contentVersion = freezed,}) {
  return _then(_MetaDto(
apiVersion: null == apiVersion ? _self.apiVersion : apiVersion // ignore: cast_nullable_to_non_nullable
as String,generatedAt: null == generatedAt ? _self.generatedAt : generatedAt // ignore: cast_nullable_to_non_nullable
as String,requestId: null == requestId ? _self.requestId : requestId // ignore: cast_nullable_to_non_nullable
as String,schemaVersion: freezed == schemaVersion ? _self.schemaVersion : schemaVersion // ignore: cast_nullable_to_non_nullable
as int?,season: freezed == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int?,sourceUpdatedAt: freezed == sourceUpdatedAt ? _self.sourceUpdatedAt : sourceUpdatedAt // ignore: cast_nullable_to_non_nullable
as String?,staleAfter: freezed == staleAfter ? _self.staleAfter : staleAfter // ignore: cast_nullable_to_non_nullable
as String?,contentVersion: freezed == contentVersion ? _self.contentVersion : contentVersion // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
