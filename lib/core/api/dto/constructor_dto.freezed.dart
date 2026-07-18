// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'constructor_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ConstructorDto {

 String get id; String get name; String? get shortName; String? get nationality; String? get countryCode; String? get colorPrimary; String? get biography; List<MediaAssetDto>? get media;
/// Create a copy of ConstructorDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ConstructorDtoCopyWith<ConstructorDto> get copyWith => _$ConstructorDtoCopyWithImpl<ConstructorDto>(this as ConstructorDto, _$identity);

  /// Serializes this ConstructorDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ConstructorDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.shortName, shortName) || other.shortName == shortName)&&(identical(other.nationality, nationality) || other.nationality == nationality)&&(identical(other.countryCode, countryCode) || other.countryCode == countryCode)&&(identical(other.colorPrimary, colorPrimary) || other.colorPrimary == colorPrimary)&&(identical(other.biography, biography) || other.biography == biography)&&const DeepCollectionEquality().equals(other.media, media));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,shortName,nationality,countryCode,colorPrimary,biography,const DeepCollectionEquality().hash(media));

@override
String toString() {
  return 'ConstructorDto(id: $id, name: $name, shortName: $shortName, nationality: $nationality, countryCode: $countryCode, colorPrimary: $colorPrimary, biography: $biography, media: $media)';
}


}

/// @nodoc
abstract mixin class $ConstructorDtoCopyWith<$Res>  {
  factory $ConstructorDtoCopyWith(ConstructorDto value, $Res Function(ConstructorDto) _then) = _$ConstructorDtoCopyWithImpl;
@useResult
$Res call({
 String id, String name, String? shortName, String? nationality, String? countryCode, String? colorPrimary, String? biography, List<MediaAssetDto>? media
});




}
/// @nodoc
class _$ConstructorDtoCopyWithImpl<$Res>
    implements $ConstructorDtoCopyWith<$Res> {
  _$ConstructorDtoCopyWithImpl(this._self, this._then);

  final ConstructorDto _self;
  final $Res Function(ConstructorDto) _then;

/// Create a copy of ConstructorDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? shortName = freezed,Object? nationality = freezed,Object? countryCode = freezed,Object? colorPrimary = freezed,Object? biography = freezed,Object? media = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,shortName: freezed == shortName ? _self.shortName : shortName // ignore: cast_nullable_to_non_nullable
as String?,nationality: freezed == nationality ? _self.nationality : nationality // ignore: cast_nullable_to_non_nullable
as String?,countryCode: freezed == countryCode ? _self.countryCode : countryCode // ignore: cast_nullable_to_non_nullable
as String?,colorPrimary: freezed == colorPrimary ? _self.colorPrimary : colorPrimary // ignore: cast_nullable_to_non_nullable
as String?,biography: freezed == biography ? _self.biography : biography // ignore: cast_nullable_to_non_nullable
as String?,media: freezed == media ? _self.media : media // ignore: cast_nullable_to_non_nullable
as List<MediaAssetDto>?,
  ));
}

}


/// Adds pattern-matching-related methods to [ConstructorDto].
extension ConstructorDtoPatterns on ConstructorDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ConstructorDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ConstructorDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ConstructorDto value)  $default,){
final _that = this;
switch (_that) {
case _ConstructorDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ConstructorDto value)?  $default,){
final _that = this;
switch (_that) {
case _ConstructorDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String? shortName,  String? nationality,  String? countryCode,  String? colorPrimary,  String? biography,  List<MediaAssetDto>? media)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ConstructorDto() when $default != null:
return $default(_that.id,_that.name,_that.shortName,_that.nationality,_that.countryCode,_that.colorPrimary,_that.biography,_that.media);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String? shortName,  String? nationality,  String? countryCode,  String? colorPrimary,  String? biography,  List<MediaAssetDto>? media)  $default,) {final _that = this;
switch (_that) {
case _ConstructorDto():
return $default(_that.id,_that.name,_that.shortName,_that.nationality,_that.countryCode,_that.colorPrimary,_that.biography,_that.media);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String? shortName,  String? nationality,  String? countryCode,  String? colorPrimary,  String? biography,  List<MediaAssetDto>? media)?  $default,) {final _that = this;
switch (_that) {
case _ConstructorDto() when $default != null:
return $default(_that.id,_that.name,_that.shortName,_that.nationality,_that.countryCode,_that.colorPrimary,_that.biography,_that.media);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ConstructorDto implements ConstructorDto {
  const _ConstructorDto({required this.id, required this.name, this.shortName, this.nationality, this.countryCode, this.colorPrimary, this.biography, final  List<MediaAssetDto>? media}): _media = media;
  factory _ConstructorDto.fromJson(Map<String, dynamic> json) => _$ConstructorDtoFromJson(json);

@override final  String id;
@override final  String name;
@override final  String? shortName;
@override final  String? nationality;
@override final  String? countryCode;
@override final  String? colorPrimary;
@override final  String? biography;
 final  List<MediaAssetDto>? _media;
@override List<MediaAssetDto>? get media {
  final value = _media;
  if (value == null) return null;
  if (_media is EqualUnmodifiableListView) return _media;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of ConstructorDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ConstructorDtoCopyWith<_ConstructorDto> get copyWith => __$ConstructorDtoCopyWithImpl<_ConstructorDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ConstructorDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ConstructorDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.shortName, shortName) || other.shortName == shortName)&&(identical(other.nationality, nationality) || other.nationality == nationality)&&(identical(other.countryCode, countryCode) || other.countryCode == countryCode)&&(identical(other.colorPrimary, colorPrimary) || other.colorPrimary == colorPrimary)&&(identical(other.biography, biography) || other.biography == biography)&&const DeepCollectionEquality().equals(other._media, _media));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,shortName,nationality,countryCode,colorPrimary,biography,const DeepCollectionEquality().hash(_media));

@override
String toString() {
  return 'ConstructorDto(id: $id, name: $name, shortName: $shortName, nationality: $nationality, countryCode: $countryCode, colorPrimary: $colorPrimary, biography: $biography, media: $media)';
}


}

/// @nodoc
abstract mixin class _$ConstructorDtoCopyWith<$Res> implements $ConstructorDtoCopyWith<$Res> {
  factory _$ConstructorDtoCopyWith(_ConstructorDto value, $Res Function(_ConstructorDto) _then) = __$ConstructorDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String? shortName, String? nationality, String? countryCode, String? colorPrimary, String? biography, List<MediaAssetDto>? media
});




}
/// @nodoc
class __$ConstructorDtoCopyWithImpl<$Res>
    implements _$ConstructorDtoCopyWith<$Res> {
  __$ConstructorDtoCopyWithImpl(this._self, this._then);

  final _ConstructorDto _self;
  final $Res Function(_ConstructorDto) _then;

/// Create a copy of ConstructorDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? shortName = freezed,Object? nationality = freezed,Object? countryCode = freezed,Object? colorPrimary = freezed,Object? biography = freezed,Object? media = freezed,}) {
  return _then(_ConstructorDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,shortName: freezed == shortName ? _self.shortName : shortName // ignore: cast_nullable_to_non_nullable
as String?,nationality: freezed == nationality ? _self.nationality : nationality // ignore: cast_nullable_to_non_nullable
as String?,countryCode: freezed == countryCode ? _self.countryCode : countryCode // ignore: cast_nullable_to_non_nullable
as String?,colorPrimary: freezed == colorPrimary ? _self.colorPrimary : colorPrimary // ignore: cast_nullable_to_non_nullable
as String?,biography: freezed == biography ? _self.biography : biography // ignore: cast_nullable_to_non_nullable
as String?,media: freezed == media ? _self._media : media // ignore: cast_nullable_to_non_nullable
as List<MediaAssetDto>?,
  ));
}


}

// dart format on
