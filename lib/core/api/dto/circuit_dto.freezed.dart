// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'circuit_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$LapRecordDto {

 String? get driverId; int? get timeMillis; int? get year;
/// Create a copy of LapRecordDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$LapRecordDtoCopyWith<LapRecordDto> get copyWith => _$LapRecordDtoCopyWithImpl<LapRecordDto>(this as LapRecordDto, _$identity);

  /// Serializes this LapRecordDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is LapRecordDto&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.timeMillis, timeMillis) || other.timeMillis == timeMillis)&&(identical(other.year, year) || other.year == year));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,driverId,timeMillis,year);

@override
String toString() {
  return 'LapRecordDto(driverId: $driverId, timeMillis: $timeMillis, year: $year)';
}


}

/// @nodoc
abstract mixin class $LapRecordDtoCopyWith<$Res>  {
  factory $LapRecordDtoCopyWith(LapRecordDto value, $Res Function(LapRecordDto) _then) = _$LapRecordDtoCopyWithImpl;
@useResult
$Res call({
 String? driverId, int? timeMillis, int? year
});




}
/// @nodoc
class _$LapRecordDtoCopyWithImpl<$Res>
    implements $LapRecordDtoCopyWith<$Res> {
  _$LapRecordDtoCopyWithImpl(this._self, this._then);

  final LapRecordDto _self;
  final $Res Function(LapRecordDto) _then;

/// Create a copy of LapRecordDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? driverId = freezed,Object? timeMillis = freezed,Object? year = freezed,}) {
  return _then(_self.copyWith(
driverId: freezed == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String?,timeMillis: freezed == timeMillis ? _self.timeMillis : timeMillis // ignore: cast_nullable_to_non_nullable
as int?,year: freezed == year ? _self.year : year // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [LapRecordDto].
extension LapRecordDtoPatterns on LapRecordDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _LapRecordDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _LapRecordDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _LapRecordDto value)  $default,){
final _that = this;
switch (_that) {
case _LapRecordDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _LapRecordDto value)?  $default,){
final _that = this;
switch (_that) {
case _LapRecordDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? driverId,  int? timeMillis,  int? year)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _LapRecordDto() when $default != null:
return $default(_that.driverId,_that.timeMillis,_that.year);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? driverId,  int? timeMillis,  int? year)  $default,) {final _that = this;
switch (_that) {
case _LapRecordDto():
return $default(_that.driverId,_that.timeMillis,_that.year);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? driverId,  int? timeMillis,  int? year)?  $default,) {final _that = this;
switch (_that) {
case _LapRecordDto() when $default != null:
return $default(_that.driverId,_that.timeMillis,_that.year);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _LapRecordDto implements LapRecordDto {
  const _LapRecordDto({this.driverId, this.timeMillis, this.year});
  factory _LapRecordDto.fromJson(Map<String, dynamic> json) => _$LapRecordDtoFromJson(json);

@override final  String? driverId;
@override final  int? timeMillis;
@override final  int? year;

/// Create a copy of LapRecordDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$LapRecordDtoCopyWith<_LapRecordDto> get copyWith => __$LapRecordDtoCopyWithImpl<_LapRecordDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$LapRecordDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _LapRecordDto&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.timeMillis, timeMillis) || other.timeMillis == timeMillis)&&(identical(other.year, year) || other.year == year));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,driverId,timeMillis,year);

@override
String toString() {
  return 'LapRecordDto(driverId: $driverId, timeMillis: $timeMillis, year: $year)';
}


}

/// @nodoc
abstract mixin class _$LapRecordDtoCopyWith<$Res> implements $LapRecordDtoCopyWith<$Res> {
  factory _$LapRecordDtoCopyWith(_LapRecordDto value, $Res Function(_LapRecordDto) _then) = __$LapRecordDtoCopyWithImpl;
@override @useResult
$Res call({
 String? driverId, int? timeMillis, int? year
});




}
/// @nodoc
class __$LapRecordDtoCopyWithImpl<$Res>
    implements _$LapRecordDtoCopyWith<$Res> {
  __$LapRecordDtoCopyWithImpl(this._self, this._then);

  final _LapRecordDto _self;
  final $Res Function(_LapRecordDto) _then;

/// Create a copy of LapRecordDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? driverId = freezed,Object? timeMillis = freezed,Object? year = freezed,}) {
  return _then(_LapRecordDto(
driverId: freezed == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String?,timeMillis: freezed == timeMillis ? _self.timeMillis : timeMillis // ignore: cast_nullable_to_non_nullable
as int?,year: freezed == year ? _self.year : year // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$CircuitDto {

 String get id; String get name; String? get locality; String? get country; String? get countryCode; double? get latitude; double? get longitude; int? get lengthMeters; int? get cornerCount; String? get direction; int? get firstGrandPrixYear; LapRecordDto? get lapRecord; List<MediaAssetDto>? get media;
/// Create a copy of CircuitDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CircuitDtoCopyWith<CircuitDto> get copyWith => _$CircuitDtoCopyWithImpl<CircuitDto>(this as CircuitDto, _$identity);

  /// Serializes this CircuitDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CircuitDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.locality, locality) || other.locality == locality)&&(identical(other.country, country) || other.country == country)&&(identical(other.countryCode, countryCode) || other.countryCode == countryCode)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.lengthMeters, lengthMeters) || other.lengthMeters == lengthMeters)&&(identical(other.cornerCount, cornerCount) || other.cornerCount == cornerCount)&&(identical(other.direction, direction) || other.direction == direction)&&(identical(other.firstGrandPrixYear, firstGrandPrixYear) || other.firstGrandPrixYear == firstGrandPrixYear)&&(identical(other.lapRecord, lapRecord) || other.lapRecord == lapRecord)&&const DeepCollectionEquality().equals(other.media, media));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,locality,country,countryCode,latitude,longitude,lengthMeters,cornerCount,direction,firstGrandPrixYear,lapRecord,const DeepCollectionEquality().hash(media));

@override
String toString() {
  return 'CircuitDto(id: $id, name: $name, locality: $locality, country: $country, countryCode: $countryCode, latitude: $latitude, longitude: $longitude, lengthMeters: $lengthMeters, cornerCount: $cornerCount, direction: $direction, firstGrandPrixYear: $firstGrandPrixYear, lapRecord: $lapRecord, media: $media)';
}


}

/// @nodoc
abstract mixin class $CircuitDtoCopyWith<$Res>  {
  factory $CircuitDtoCopyWith(CircuitDto value, $Res Function(CircuitDto) _then) = _$CircuitDtoCopyWithImpl;
@useResult
$Res call({
 String id, String name, String? locality, String? country, String? countryCode, double? latitude, double? longitude, int? lengthMeters, int? cornerCount, String? direction, int? firstGrandPrixYear, LapRecordDto? lapRecord, List<MediaAssetDto>? media
});


$LapRecordDtoCopyWith<$Res>? get lapRecord;

}
/// @nodoc
class _$CircuitDtoCopyWithImpl<$Res>
    implements $CircuitDtoCopyWith<$Res> {
  _$CircuitDtoCopyWithImpl(this._self, this._then);

  final CircuitDto _self;
  final $Res Function(CircuitDto) _then;

/// Create a copy of CircuitDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? locality = freezed,Object? country = freezed,Object? countryCode = freezed,Object? latitude = freezed,Object? longitude = freezed,Object? lengthMeters = freezed,Object? cornerCount = freezed,Object? direction = freezed,Object? firstGrandPrixYear = freezed,Object? lapRecord = freezed,Object? media = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,locality: freezed == locality ? _self.locality : locality // ignore: cast_nullable_to_non_nullable
as String?,country: freezed == country ? _self.country : country // ignore: cast_nullable_to_non_nullable
as String?,countryCode: freezed == countryCode ? _self.countryCode : countryCode // ignore: cast_nullable_to_non_nullable
as String?,latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,lengthMeters: freezed == lengthMeters ? _self.lengthMeters : lengthMeters // ignore: cast_nullable_to_non_nullable
as int?,cornerCount: freezed == cornerCount ? _self.cornerCount : cornerCount // ignore: cast_nullable_to_non_nullable
as int?,direction: freezed == direction ? _self.direction : direction // ignore: cast_nullable_to_non_nullable
as String?,firstGrandPrixYear: freezed == firstGrandPrixYear ? _self.firstGrandPrixYear : firstGrandPrixYear // ignore: cast_nullable_to_non_nullable
as int?,lapRecord: freezed == lapRecord ? _self.lapRecord : lapRecord // ignore: cast_nullable_to_non_nullable
as LapRecordDto?,media: freezed == media ? _self.media : media // ignore: cast_nullable_to_non_nullable
as List<MediaAssetDto>?,
  ));
}
/// Create a copy of CircuitDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$LapRecordDtoCopyWith<$Res>? get lapRecord {
    if (_self.lapRecord == null) {
    return null;
  }

  return $LapRecordDtoCopyWith<$Res>(_self.lapRecord!, (value) {
    return _then(_self.copyWith(lapRecord: value));
  });
}
}


/// Adds pattern-matching-related methods to [CircuitDto].
extension CircuitDtoPatterns on CircuitDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CircuitDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CircuitDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CircuitDto value)  $default,){
final _that = this;
switch (_that) {
case _CircuitDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CircuitDto value)?  $default,){
final _that = this;
switch (_that) {
case _CircuitDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String? locality,  String? country,  String? countryCode,  double? latitude,  double? longitude,  int? lengthMeters,  int? cornerCount,  String? direction,  int? firstGrandPrixYear,  LapRecordDto? lapRecord,  List<MediaAssetDto>? media)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CircuitDto() when $default != null:
return $default(_that.id,_that.name,_that.locality,_that.country,_that.countryCode,_that.latitude,_that.longitude,_that.lengthMeters,_that.cornerCount,_that.direction,_that.firstGrandPrixYear,_that.lapRecord,_that.media);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String? locality,  String? country,  String? countryCode,  double? latitude,  double? longitude,  int? lengthMeters,  int? cornerCount,  String? direction,  int? firstGrandPrixYear,  LapRecordDto? lapRecord,  List<MediaAssetDto>? media)  $default,) {final _that = this;
switch (_that) {
case _CircuitDto():
return $default(_that.id,_that.name,_that.locality,_that.country,_that.countryCode,_that.latitude,_that.longitude,_that.lengthMeters,_that.cornerCount,_that.direction,_that.firstGrandPrixYear,_that.lapRecord,_that.media);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String? locality,  String? country,  String? countryCode,  double? latitude,  double? longitude,  int? lengthMeters,  int? cornerCount,  String? direction,  int? firstGrandPrixYear,  LapRecordDto? lapRecord,  List<MediaAssetDto>? media)?  $default,) {final _that = this;
switch (_that) {
case _CircuitDto() when $default != null:
return $default(_that.id,_that.name,_that.locality,_that.country,_that.countryCode,_that.latitude,_that.longitude,_that.lengthMeters,_that.cornerCount,_that.direction,_that.firstGrandPrixYear,_that.lapRecord,_that.media);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CircuitDto implements CircuitDto {
  const _CircuitDto({required this.id, required this.name, this.locality, this.country, this.countryCode, this.latitude, this.longitude, this.lengthMeters, this.cornerCount, this.direction, this.firstGrandPrixYear, this.lapRecord, final  List<MediaAssetDto>? media}): _media = media;
  factory _CircuitDto.fromJson(Map<String, dynamic> json) => _$CircuitDtoFromJson(json);

@override final  String id;
@override final  String name;
@override final  String? locality;
@override final  String? country;
@override final  String? countryCode;
@override final  double? latitude;
@override final  double? longitude;
@override final  int? lengthMeters;
@override final  int? cornerCount;
@override final  String? direction;
@override final  int? firstGrandPrixYear;
@override final  LapRecordDto? lapRecord;
 final  List<MediaAssetDto>? _media;
@override List<MediaAssetDto>? get media {
  final value = _media;
  if (value == null) return null;
  if (_media is EqualUnmodifiableListView) return _media;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of CircuitDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CircuitDtoCopyWith<_CircuitDto> get copyWith => __$CircuitDtoCopyWithImpl<_CircuitDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CircuitDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CircuitDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.locality, locality) || other.locality == locality)&&(identical(other.country, country) || other.country == country)&&(identical(other.countryCode, countryCode) || other.countryCode == countryCode)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.lengthMeters, lengthMeters) || other.lengthMeters == lengthMeters)&&(identical(other.cornerCount, cornerCount) || other.cornerCount == cornerCount)&&(identical(other.direction, direction) || other.direction == direction)&&(identical(other.firstGrandPrixYear, firstGrandPrixYear) || other.firstGrandPrixYear == firstGrandPrixYear)&&(identical(other.lapRecord, lapRecord) || other.lapRecord == lapRecord)&&const DeepCollectionEquality().equals(other._media, _media));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,locality,country,countryCode,latitude,longitude,lengthMeters,cornerCount,direction,firstGrandPrixYear,lapRecord,const DeepCollectionEquality().hash(_media));

@override
String toString() {
  return 'CircuitDto(id: $id, name: $name, locality: $locality, country: $country, countryCode: $countryCode, latitude: $latitude, longitude: $longitude, lengthMeters: $lengthMeters, cornerCount: $cornerCount, direction: $direction, firstGrandPrixYear: $firstGrandPrixYear, lapRecord: $lapRecord, media: $media)';
}


}

/// @nodoc
abstract mixin class _$CircuitDtoCopyWith<$Res> implements $CircuitDtoCopyWith<$Res> {
  factory _$CircuitDtoCopyWith(_CircuitDto value, $Res Function(_CircuitDto) _then) = __$CircuitDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String? locality, String? country, String? countryCode, double? latitude, double? longitude, int? lengthMeters, int? cornerCount, String? direction, int? firstGrandPrixYear, LapRecordDto? lapRecord, List<MediaAssetDto>? media
});


@override $LapRecordDtoCopyWith<$Res>? get lapRecord;

}
/// @nodoc
class __$CircuitDtoCopyWithImpl<$Res>
    implements _$CircuitDtoCopyWith<$Res> {
  __$CircuitDtoCopyWithImpl(this._self, this._then);

  final _CircuitDto _self;
  final $Res Function(_CircuitDto) _then;

/// Create a copy of CircuitDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? locality = freezed,Object? country = freezed,Object? countryCode = freezed,Object? latitude = freezed,Object? longitude = freezed,Object? lengthMeters = freezed,Object? cornerCount = freezed,Object? direction = freezed,Object? firstGrandPrixYear = freezed,Object? lapRecord = freezed,Object? media = freezed,}) {
  return _then(_CircuitDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,locality: freezed == locality ? _self.locality : locality // ignore: cast_nullable_to_non_nullable
as String?,country: freezed == country ? _self.country : country // ignore: cast_nullable_to_non_nullable
as String?,countryCode: freezed == countryCode ? _self.countryCode : countryCode // ignore: cast_nullable_to_non_nullable
as String?,latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,lengthMeters: freezed == lengthMeters ? _self.lengthMeters : lengthMeters // ignore: cast_nullable_to_non_nullable
as int?,cornerCount: freezed == cornerCount ? _self.cornerCount : cornerCount // ignore: cast_nullable_to_non_nullable
as int?,direction: freezed == direction ? _self.direction : direction // ignore: cast_nullable_to_non_nullable
as String?,firstGrandPrixYear: freezed == firstGrandPrixYear ? _self.firstGrandPrixYear : firstGrandPrixYear // ignore: cast_nullable_to_non_nullable
as int?,lapRecord: freezed == lapRecord ? _self.lapRecord : lapRecord // ignore: cast_nullable_to_non_nullable
as LapRecordDto?,media: freezed == media ? _self._media : media // ignore: cast_nullable_to_non_nullable
as List<MediaAssetDto>?,
  ));
}

/// Create a copy of CircuitDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$LapRecordDtoCopyWith<$Res>? get lapRecord {
    if (_self.lapRecord == null) {
    return null;
  }

  return $LapRecordDtoCopyWith<$Res>(_self.lapRecord!, (value) {
    return _then(_self.copyWith(lapRecord: value));
  });
}
}

// dart format on
