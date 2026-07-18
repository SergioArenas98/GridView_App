// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'driver_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$DriverDto {

 String get id; String get fullName; String? get givenName; String? get familyName; String? get shortCode; int? get permanentNumber; String? get nationality; String? get countryCode; String? get dateOfBirth; String? get placeOfBirth; String? get biography; List<MediaAssetDto>? get media;
/// Create a copy of DriverDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DriverDtoCopyWith<DriverDto> get copyWith => _$DriverDtoCopyWithImpl<DriverDto>(this as DriverDto, _$identity);

  /// Serializes this DriverDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DriverDto&&(identical(other.id, id) || other.id == id)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.givenName, givenName) || other.givenName == givenName)&&(identical(other.familyName, familyName) || other.familyName == familyName)&&(identical(other.shortCode, shortCode) || other.shortCode == shortCode)&&(identical(other.permanentNumber, permanentNumber) || other.permanentNumber == permanentNumber)&&(identical(other.nationality, nationality) || other.nationality == nationality)&&(identical(other.countryCode, countryCode) || other.countryCode == countryCode)&&(identical(other.dateOfBirth, dateOfBirth) || other.dateOfBirth == dateOfBirth)&&(identical(other.placeOfBirth, placeOfBirth) || other.placeOfBirth == placeOfBirth)&&(identical(other.biography, biography) || other.biography == biography)&&const DeepCollectionEquality().equals(other.media, media));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fullName,givenName,familyName,shortCode,permanentNumber,nationality,countryCode,dateOfBirth,placeOfBirth,biography,const DeepCollectionEquality().hash(media));

@override
String toString() {
  return 'DriverDto(id: $id, fullName: $fullName, givenName: $givenName, familyName: $familyName, shortCode: $shortCode, permanentNumber: $permanentNumber, nationality: $nationality, countryCode: $countryCode, dateOfBirth: $dateOfBirth, placeOfBirth: $placeOfBirth, biography: $biography, media: $media)';
}


}

/// @nodoc
abstract mixin class $DriverDtoCopyWith<$Res>  {
  factory $DriverDtoCopyWith(DriverDto value, $Res Function(DriverDto) _then) = _$DriverDtoCopyWithImpl;
@useResult
$Res call({
 String id, String fullName, String? givenName, String? familyName, String? shortCode, int? permanentNumber, String? nationality, String? countryCode, String? dateOfBirth, String? placeOfBirth, String? biography, List<MediaAssetDto>? media
});




}
/// @nodoc
class _$DriverDtoCopyWithImpl<$Res>
    implements $DriverDtoCopyWith<$Res> {
  _$DriverDtoCopyWithImpl(this._self, this._then);

  final DriverDto _self;
  final $Res Function(DriverDto) _then;

/// Create a copy of DriverDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? fullName = null,Object? givenName = freezed,Object? familyName = freezed,Object? shortCode = freezed,Object? permanentNumber = freezed,Object? nationality = freezed,Object? countryCode = freezed,Object? dateOfBirth = freezed,Object? placeOfBirth = freezed,Object? biography = freezed,Object? media = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,givenName: freezed == givenName ? _self.givenName : givenName // ignore: cast_nullable_to_non_nullable
as String?,familyName: freezed == familyName ? _self.familyName : familyName // ignore: cast_nullable_to_non_nullable
as String?,shortCode: freezed == shortCode ? _self.shortCode : shortCode // ignore: cast_nullable_to_non_nullable
as String?,permanentNumber: freezed == permanentNumber ? _self.permanentNumber : permanentNumber // ignore: cast_nullable_to_non_nullable
as int?,nationality: freezed == nationality ? _self.nationality : nationality // ignore: cast_nullable_to_non_nullable
as String?,countryCode: freezed == countryCode ? _self.countryCode : countryCode // ignore: cast_nullable_to_non_nullable
as String?,dateOfBirth: freezed == dateOfBirth ? _self.dateOfBirth : dateOfBirth // ignore: cast_nullable_to_non_nullable
as String?,placeOfBirth: freezed == placeOfBirth ? _self.placeOfBirth : placeOfBirth // ignore: cast_nullable_to_non_nullable
as String?,biography: freezed == biography ? _self.biography : biography // ignore: cast_nullable_to_non_nullable
as String?,media: freezed == media ? _self.media : media // ignore: cast_nullable_to_non_nullable
as List<MediaAssetDto>?,
  ));
}

}


/// Adds pattern-matching-related methods to [DriverDto].
extension DriverDtoPatterns on DriverDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DriverDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DriverDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DriverDto value)  $default,){
final _that = this;
switch (_that) {
case _DriverDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DriverDto value)?  $default,){
final _that = this;
switch (_that) {
case _DriverDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String fullName,  String? givenName,  String? familyName,  String? shortCode,  int? permanentNumber,  String? nationality,  String? countryCode,  String? dateOfBirth,  String? placeOfBirth,  String? biography,  List<MediaAssetDto>? media)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DriverDto() when $default != null:
return $default(_that.id,_that.fullName,_that.givenName,_that.familyName,_that.shortCode,_that.permanentNumber,_that.nationality,_that.countryCode,_that.dateOfBirth,_that.placeOfBirth,_that.biography,_that.media);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String fullName,  String? givenName,  String? familyName,  String? shortCode,  int? permanentNumber,  String? nationality,  String? countryCode,  String? dateOfBirth,  String? placeOfBirth,  String? biography,  List<MediaAssetDto>? media)  $default,) {final _that = this;
switch (_that) {
case _DriverDto():
return $default(_that.id,_that.fullName,_that.givenName,_that.familyName,_that.shortCode,_that.permanentNumber,_that.nationality,_that.countryCode,_that.dateOfBirth,_that.placeOfBirth,_that.biography,_that.media);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String fullName,  String? givenName,  String? familyName,  String? shortCode,  int? permanentNumber,  String? nationality,  String? countryCode,  String? dateOfBirth,  String? placeOfBirth,  String? biography,  List<MediaAssetDto>? media)?  $default,) {final _that = this;
switch (_that) {
case _DriverDto() when $default != null:
return $default(_that.id,_that.fullName,_that.givenName,_that.familyName,_that.shortCode,_that.permanentNumber,_that.nationality,_that.countryCode,_that.dateOfBirth,_that.placeOfBirth,_that.biography,_that.media);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DriverDto implements DriverDto {
  const _DriverDto({required this.id, required this.fullName, this.givenName, this.familyName, this.shortCode, this.permanentNumber, this.nationality, this.countryCode, this.dateOfBirth, this.placeOfBirth, this.biography, final  List<MediaAssetDto>? media}): _media = media;
  factory _DriverDto.fromJson(Map<String, dynamic> json) => _$DriverDtoFromJson(json);

@override final  String id;
@override final  String fullName;
@override final  String? givenName;
@override final  String? familyName;
@override final  String? shortCode;
@override final  int? permanentNumber;
@override final  String? nationality;
@override final  String? countryCode;
@override final  String? dateOfBirth;
@override final  String? placeOfBirth;
@override final  String? biography;
 final  List<MediaAssetDto>? _media;
@override List<MediaAssetDto>? get media {
  final value = _media;
  if (value == null) return null;
  if (_media is EqualUnmodifiableListView) return _media;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of DriverDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DriverDtoCopyWith<_DriverDto> get copyWith => __$DriverDtoCopyWithImpl<_DriverDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DriverDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DriverDto&&(identical(other.id, id) || other.id == id)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.givenName, givenName) || other.givenName == givenName)&&(identical(other.familyName, familyName) || other.familyName == familyName)&&(identical(other.shortCode, shortCode) || other.shortCode == shortCode)&&(identical(other.permanentNumber, permanentNumber) || other.permanentNumber == permanentNumber)&&(identical(other.nationality, nationality) || other.nationality == nationality)&&(identical(other.countryCode, countryCode) || other.countryCode == countryCode)&&(identical(other.dateOfBirth, dateOfBirth) || other.dateOfBirth == dateOfBirth)&&(identical(other.placeOfBirth, placeOfBirth) || other.placeOfBirth == placeOfBirth)&&(identical(other.biography, biography) || other.biography == biography)&&const DeepCollectionEquality().equals(other._media, _media));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fullName,givenName,familyName,shortCode,permanentNumber,nationality,countryCode,dateOfBirth,placeOfBirth,biography,const DeepCollectionEquality().hash(_media));

@override
String toString() {
  return 'DriverDto(id: $id, fullName: $fullName, givenName: $givenName, familyName: $familyName, shortCode: $shortCode, permanentNumber: $permanentNumber, nationality: $nationality, countryCode: $countryCode, dateOfBirth: $dateOfBirth, placeOfBirth: $placeOfBirth, biography: $biography, media: $media)';
}


}

/// @nodoc
abstract mixin class _$DriverDtoCopyWith<$Res> implements $DriverDtoCopyWith<$Res> {
  factory _$DriverDtoCopyWith(_DriverDto value, $Res Function(_DriverDto) _then) = __$DriverDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String fullName, String? givenName, String? familyName, String? shortCode, int? permanentNumber, String? nationality, String? countryCode, String? dateOfBirth, String? placeOfBirth, String? biography, List<MediaAssetDto>? media
});




}
/// @nodoc
class __$DriverDtoCopyWithImpl<$Res>
    implements _$DriverDtoCopyWith<$Res> {
  __$DriverDtoCopyWithImpl(this._self, this._then);

  final _DriverDto _self;
  final $Res Function(_DriverDto) _then;

/// Create a copy of DriverDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? fullName = null,Object? givenName = freezed,Object? familyName = freezed,Object? shortCode = freezed,Object? permanentNumber = freezed,Object? nationality = freezed,Object? countryCode = freezed,Object? dateOfBirth = freezed,Object? placeOfBirth = freezed,Object? biography = freezed,Object? media = freezed,}) {
  return _then(_DriverDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,givenName: freezed == givenName ? _self.givenName : givenName // ignore: cast_nullable_to_non_nullable
as String?,familyName: freezed == familyName ? _self.familyName : familyName // ignore: cast_nullable_to_non_nullable
as String?,shortCode: freezed == shortCode ? _self.shortCode : shortCode // ignore: cast_nullable_to_non_nullable
as String?,permanentNumber: freezed == permanentNumber ? _self.permanentNumber : permanentNumber // ignore: cast_nullable_to_non_nullable
as int?,nationality: freezed == nationality ? _self.nationality : nationality // ignore: cast_nullable_to_non_nullable
as String?,countryCode: freezed == countryCode ? _self.countryCode : countryCode // ignore: cast_nullable_to_non_nullable
as String?,dateOfBirth: freezed == dateOfBirth ? _self.dateOfBirth : dateOfBirth // ignore: cast_nullable_to_non_nullable
as String?,placeOfBirth: freezed == placeOfBirth ? _self.placeOfBirth : placeOfBirth // ignore: cast_nullable_to_non_nullable
as String?,biography: freezed == biography ? _self.biography : biography // ignore: cast_nullable_to_non_nullable
as String?,media: freezed == media ? _self._media : media // ignore: cast_nullable_to_non_nullable
as List<MediaAssetDto>?,
  ));
}


}

// dart format on
