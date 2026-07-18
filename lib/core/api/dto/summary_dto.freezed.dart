// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'summary_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$DriverSummaryDto {

 String get id; String get fullName; String? get shortCode; int? get permanentNumber; String? get countryCode;
/// Create a copy of DriverSummaryDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DriverSummaryDtoCopyWith<DriverSummaryDto> get copyWith => _$DriverSummaryDtoCopyWithImpl<DriverSummaryDto>(this as DriverSummaryDto, _$identity);

  /// Serializes this DriverSummaryDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DriverSummaryDto&&(identical(other.id, id) || other.id == id)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.shortCode, shortCode) || other.shortCode == shortCode)&&(identical(other.permanentNumber, permanentNumber) || other.permanentNumber == permanentNumber)&&(identical(other.countryCode, countryCode) || other.countryCode == countryCode));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fullName,shortCode,permanentNumber,countryCode);

@override
String toString() {
  return 'DriverSummaryDto(id: $id, fullName: $fullName, shortCode: $shortCode, permanentNumber: $permanentNumber, countryCode: $countryCode)';
}


}

/// @nodoc
abstract mixin class $DriverSummaryDtoCopyWith<$Res>  {
  factory $DriverSummaryDtoCopyWith(DriverSummaryDto value, $Res Function(DriverSummaryDto) _then) = _$DriverSummaryDtoCopyWithImpl;
@useResult
$Res call({
 String id, String fullName, String? shortCode, int? permanentNumber, String? countryCode
});




}
/// @nodoc
class _$DriverSummaryDtoCopyWithImpl<$Res>
    implements $DriverSummaryDtoCopyWith<$Res> {
  _$DriverSummaryDtoCopyWithImpl(this._self, this._then);

  final DriverSummaryDto _self;
  final $Res Function(DriverSummaryDto) _then;

/// Create a copy of DriverSummaryDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? fullName = null,Object? shortCode = freezed,Object? permanentNumber = freezed,Object? countryCode = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,shortCode: freezed == shortCode ? _self.shortCode : shortCode // ignore: cast_nullable_to_non_nullable
as String?,permanentNumber: freezed == permanentNumber ? _self.permanentNumber : permanentNumber // ignore: cast_nullable_to_non_nullable
as int?,countryCode: freezed == countryCode ? _self.countryCode : countryCode // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [DriverSummaryDto].
extension DriverSummaryDtoPatterns on DriverSummaryDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DriverSummaryDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DriverSummaryDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DriverSummaryDto value)  $default,){
final _that = this;
switch (_that) {
case _DriverSummaryDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DriverSummaryDto value)?  $default,){
final _that = this;
switch (_that) {
case _DriverSummaryDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String fullName,  String? shortCode,  int? permanentNumber,  String? countryCode)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DriverSummaryDto() when $default != null:
return $default(_that.id,_that.fullName,_that.shortCode,_that.permanentNumber,_that.countryCode);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String fullName,  String? shortCode,  int? permanentNumber,  String? countryCode)  $default,) {final _that = this;
switch (_that) {
case _DriverSummaryDto():
return $default(_that.id,_that.fullName,_that.shortCode,_that.permanentNumber,_that.countryCode);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String fullName,  String? shortCode,  int? permanentNumber,  String? countryCode)?  $default,) {final _that = this;
switch (_that) {
case _DriverSummaryDto() when $default != null:
return $default(_that.id,_that.fullName,_that.shortCode,_that.permanentNumber,_that.countryCode);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DriverSummaryDto implements DriverSummaryDto {
  const _DriverSummaryDto({required this.id, required this.fullName, this.shortCode, this.permanentNumber, this.countryCode});
  factory _DriverSummaryDto.fromJson(Map<String, dynamic> json) => _$DriverSummaryDtoFromJson(json);

@override final  String id;
@override final  String fullName;
@override final  String? shortCode;
@override final  int? permanentNumber;
@override final  String? countryCode;

/// Create a copy of DriverSummaryDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DriverSummaryDtoCopyWith<_DriverSummaryDto> get copyWith => __$DriverSummaryDtoCopyWithImpl<_DriverSummaryDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DriverSummaryDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DriverSummaryDto&&(identical(other.id, id) || other.id == id)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.shortCode, shortCode) || other.shortCode == shortCode)&&(identical(other.permanentNumber, permanentNumber) || other.permanentNumber == permanentNumber)&&(identical(other.countryCode, countryCode) || other.countryCode == countryCode));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fullName,shortCode,permanentNumber,countryCode);

@override
String toString() {
  return 'DriverSummaryDto(id: $id, fullName: $fullName, shortCode: $shortCode, permanentNumber: $permanentNumber, countryCode: $countryCode)';
}


}

/// @nodoc
abstract mixin class _$DriverSummaryDtoCopyWith<$Res> implements $DriverSummaryDtoCopyWith<$Res> {
  factory _$DriverSummaryDtoCopyWith(_DriverSummaryDto value, $Res Function(_DriverSummaryDto) _then) = __$DriverSummaryDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String fullName, String? shortCode, int? permanentNumber, String? countryCode
});




}
/// @nodoc
class __$DriverSummaryDtoCopyWithImpl<$Res>
    implements _$DriverSummaryDtoCopyWith<$Res> {
  __$DriverSummaryDtoCopyWithImpl(this._self, this._then);

  final _DriverSummaryDto _self;
  final $Res Function(_DriverSummaryDto) _then;

/// Create a copy of DriverSummaryDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? fullName = null,Object? shortCode = freezed,Object? permanentNumber = freezed,Object? countryCode = freezed,}) {
  return _then(_DriverSummaryDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,shortCode: freezed == shortCode ? _self.shortCode : shortCode // ignore: cast_nullable_to_non_nullable
as String?,permanentNumber: freezed == permanentNumber ? _self.permanentNumber : permanentNumber // ignore: cast_nullable_to_non_nullable
as int?,countryCode: freezed == countryCode ? _self.countryCode : countryCode // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$ConstructorSummaryDto {

 String get id; String get name; String? get shortName; String? get colorPrimary;
/// Create a copy of ConstructorSummaryDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ConstructorSummaryDtoCopyWith<ConstructorSummaryDto> get copyWith => _$ConstructorSummaryDtoCopyWithImpl<ConstructorSummaryDto>(this as ConstructorSummaryDto, _$identity);

  /// Serializes this ConstructorSummaryDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ConstructorSummaryDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.shortName, shortName) || other.shortName == shortName)&&(identical(other.colorPrimary, colorPrimary) || other.colorPrimary == colorPrimary));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,shortName,colorPrimary);

@override
String toString() {
  return 'ConstructorSummaryDto(id: $id, name: $name, shortName: $shortName, colorPrimary: $colorPrimary)';
}


}

/// @nodoc
abstract mixin class $ConstructorSummaryDtoCopyWith<$Res>  {
  factory $ConstructorSummaryDtoCopyWith(ConstructorSummaryDto value, $Res Function(ConstructorSummaryDto) _then) = _$ConstructorSummaryDtoCopyWithImpl;
@useResult
$Res call({
 String id, String name, String? shortName, String? colorPrimary
});




}
/// @nodoc
class _$ConstructorSummaryDtoCopyWithImpl<$Res>
    implements $ConstructorSummaryDtoCopyWith<$Res> {
  _$ConstructorSummaryDtoCopyWithImpl(this._self, this._then);

  final ConstructorSummaryDto _self;
  final $Res Function(ConstructorSummaryDto) _then;

/// Create a copy of ConstructorSummaryDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? shortName = freezed,Object? colorPrimary = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,shortName: freezed == shortName ? _self.shortName : shortName // ignore: cast_nullable_to_non_nullable
as String?,colorPrimary: freezed == colorPrimary ? _self.colorPrimary : colorPrimary // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [ConstructorSummaryDto].
extension ConstructorSummaryDtoPatterns on ConstructorSummaryDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ConstructorSummaryDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ConstructorSummaryDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ConstructorSummaryDto value)  $default,){
final _that = this;
switch (_that) {
case _ConstructorSummaryDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ConstructorSummaryDto value)?  $default,){
final _that = this;
switch (_that) {
case _ConstructorSummaryDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String? shortName,  String? colorPrimary)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ConstructorSummaryDto() when $default != null:
return $default(_that.id,_that.name,_that.shortName,_that.colorPrimary);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String? shortName,  String? colorPrimary)  $default,) {final _that = this;
switch (_that) {
case _ConstructorSummaryDto():
return $default(_that.id,_that.name,_that.shortName,_that.colorPrimary);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String? shortName,  String? colorPrimary)?  $default,) {final _that = this;
switch (_that) {
case _ConstructorSummaryDto() when $default != null:
return $default(_that.id,_that.name,_that.shortName,_that.colorPrimary);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ConstructorSummaryDto implements ConstructorSummaryDto {
  const _ConstructorSummaryDto({required this.id, required this.name, this.shortName, this.colorPrimary});
  factory _ConstructorSummaryDto.fromJson(Map<String, dynamic> json) => _$ConstructorSummaryDtoFromJson(json);

@override final  String id;
@override final  String name;
@override final  String? shortName;
@override final  String? colorPrimary;

/// Create a copy of ConstructorSummaryDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ConstructorSummaryDtoCopyWith<_ConstructorSummaryDto> get copyWith => __$ConstructorSummaryDtoCopyWithImpl<_ConstructorSummaryDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ConstructorSummaryDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ConstructorSummaryDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.shortName, shortName) || other.shortName == shortName)&&(identical(other.colorPrimary, colorPrimary) || other.colorPrimary == colorPrimary));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,shortName,colorPrimary);

@override
String toString() {
  return 'ConstructorSummaryDto(id: $id, name: $name, shortName: $shortName, colorPrimary: $colorPrimary)';
}


}

/// @nodoc
abstract mixin class _$ConstructorSummaryDtoCopyWith<$Res> implements $ConstructorSummaryDtoCopyWith<$Res> {
  factory _$ConstructorSummaryDtoCopyWith(_ConstructorSummaryDto value, $Res Function(_ConstructorSummaryDto) _then) = __$ConstructorSummaryDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String? shortName, String? colorPrimary
});




}
/// @nodoc
class __$ConstructorSummaryDtoCopyWithImpl<$Res>
    implements _$ConstructorSummaryDtoCopyWith<$Res> {
  __$ConstructorSummaryDtoCopyWithImpl(this._self, this._then);

  final _ConstructorSummaryDto _self;
  final $Res Function(_ConstructorSummaryDto) _then;

/// Create a copy of ConstructorSummaryDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? shortName = freezed,Object? colorPrimary = freezed,}) {
  return _then(_ConstructorSummaryDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,shortName: freezed == shortName ? _self.shortName : shortName // ignore: cast_nullable_to_non_nullable
as String?,colorPrimary: freezed == colorPrimary ? _self.colorPrimary : colorPrimary // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$CircuitSummaryDto {

 String get id; String get name; String? get locality; String? get countryCode;
/// Create a copy of CircuitSummaryDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CircuitSummaryDtoCopyWith<CircuitSummaryDto> get copyWith => _$CircuitSummaryDtoCopyWithImpl<CircuitSummaryDto>(this as CircuitSummaryDto, _$identity);

  /// Serializes this CircuitSummaryDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CircuitSummaryDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.locality, locality) || other.locality == locality)&&(identical(other.countryCode, countryCode) || other.countryCode == countryCode));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,locality,countryCode);

@override
String toString() {
  return 'CircuitSummaryDto(id: $id, name: $name, locality: $locality, countryCode: $countryCode)';
}


}

/// @nodoc
abstract mixin class $CircuitSummaryDtoCopyWith<$Res>  {
  factory $CircuitSummaryDtoCopyWith(CircuitSummaryDto value, $Res Function(CircuitSummaryDto) _then) = _$CircuitSummaryDtoCopyWithImpl;
@useResult
$Res call({
 String id, String name, String? locality, String? countryCode
});




}
/// @nodoc
class _$CircuitSummaryDtoCopyWithImpl<$Res>
    implements $CircuitSummaryDtoCopyWith<$Res> {
  _$CircuitSummaryDtoCopyWithImpl(this._self, this._then);

  final CircuitSummaryDto _self;
  final $Res Function(CircuitSummaryDto) _then;

/// Create a copy of CircuitSummaryDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? locality = freezed,Object? countryCode = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,locality: freezed == locality ? _self.locality : locality // ignore: cast_nullable_to_non_nullable
as String?,countryCode: freezed == countryCode ? _self.countryCode : countryCode // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CircuitSummaryDto].
extension CircuitSummaryDtoPatterns on CircuitSummaryDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CircuitSummaryDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CircuitSummaryDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CircuitSummaryDto value)  $default,){
final _that = this;
switch (_that) {
case _CircuitSummaryDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CircuitSummaryDto value)?  $default,){
final _that = this;
switch (_that) {
case _CircuitSummaryDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String? locality,  String? countryCode)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CircuitSummaryDto() when $default != null:
return $default(_that.id,_that.name,_that.locality,_that.countryCode);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String? locality,  String? countryCode)  $default,) {final _that = this;
switch (_that) {
case _CircuitSummaryDto():
return $default(_that.id,_that.name,_that.locality,_that.countryCode);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String? locality,  String? countryCode)?  $default,) {final _that = this;
switch (_that) {
case _CircuitSummaryDto() when $default != null:
return $default(_that.id,_that.name,_that.locality,_that.countryCode);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CircuitSummaryDto implements CircuitSummaryDto {
  const _CircuitSummaryDto({required this.id, required this.name, this.locality, this.countryCode});
  factory _CircuitSummaryDto.fromJson(Map<String, dynamic> json) => _$CircuitSummaryDtoFromJson(json);

@override final  String id;
@override final  String name;
@override final  String? locality;
@override final  String? countryCode;

/// Create a copy of CircuitSummaryDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CircuitSummaryDtoCopyWith<_CircuitSummaryDto> get copyWith => __$CircuitSummaryDtoCopyWithImpl<_CircuitSummaryDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CircuitSummaryDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CircuitSummaryDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.locality, locality) || other.locality == locality)&&(identical(other.countryCode, countryCode) || other.countryCode == countryCode));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,locality,countryCode);

@override
String toString() {
  return 'CircuitSummaryDto(id: $id, name: $name, locality: $locality, countryCode: $countryCode)';
}


}

/// @nodoc
abstract mixin class _$CircuitSummaryDtoCopyWith<$Res> implements $CircuitSummaryDtoCopyWith<$Res> {
  factory _$CircuitSummaryDtoCopyWith(_CircuitSummaryDto value, $Res Function(_CircuitSummaryDto) _then) = __$CircuitSummaryDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String? locality, String? countryCode
});




}
/// @nodoc
class __$CircuitSummaryDtoCopyWithImpl<$Res>
    implements _$CircuitSummaryDtoCopyWith<$Res> {
  __$CircuitSummaryDtoCopyWithImpl(this._self, this._then);

  final _CircuitSummaryDto _self;
  final $Res Function(_CircuitSummaryDto) _then;

/// Create a copy of CircuitSummaryDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? locality = freezed,Object? countryCode = freezed,}) {
  return _then(_CircuitSummaryDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,locality: freezed == locality ? _self.locality : locality // ignore: cast_nullable_to_non_nullable
as String?,countryCode: freezed == countryCode ? _self.countryCode : countryCode // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$SeasonDriverSummaryDto {

 String get driverId; String get fullName; String? get shortCode; int? get permanentNumber; int? get raceNumber; String? get countryCode; String get constructorId; String? get role;
/// Create a copy of SeasonDriverSummaryDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SeasonDriverSummaryDtoCopyWith<SeasonDriverSummaryDto> get copyWith => _$SeasonDriverSummaryDtoCopyWithImpl<SeasonDriverSummaryDto>(this as SeasonDriverSummaryDto, _$identity);

  /// Serializes this SeasonDriverSummaryDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SeasonDriverSummaryDto&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.shortCode, shortCode) || other.shortCode == shortCode)&&(identical(other.permanentNumber, permanentNumber) || other.permanentNumber == permanentNumber)&&(identical(other.raceNumber, raceNumber) || other.raceNumber == raceNumber)&&(identical(other.countryCode, countryCode) || other.countryCode == countryCode)&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.role, role) || other.role == role));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,driverId,fullName,shortCode,permanentNumber,raceNumber,countryCode,constructorId,role);

@override
String toString() {
  return 'SeasonDriverSummaryDto(driverId: $driverId, fullName: $fullName, shortCode: $shortCode, permanentNumber: $permanentNumber, raceNumber: $raceNumber, countryCode: $countryCode, constructorId: $constructorId, role: $role)';
}


}

/// @nodoc
abstract mixin class $SeasonDriverSummaryDtoCopyWith<$Res>  {
  factory $SeasonDriverSummaryDtoCopyWith(SeasonDriverSummaryDto value, $Res Function(SeasonDriverSummaryDto) _then) = _$SeasonDriverSummaryDtoCopyWithImpl;
@useResult
$Res call({
 String driverId, String fullName, String? shortCode, int? permanentNumber, int? raceNumber, String? countryCode, String constructorId, String? role
});




}
/// @nodoc
class _$SeasonDriverSummaryDtoCopyWithImpl<$Res>
    implements $SeasonDriverSummaryDtoCopyWith<$Res> {
  _$SeasonDriverSummaryDtoCopyWithImpl(this._self, this._then);

  final SeasonDriverSummaryDto _self;
  final $Res Function(SeasonDriverSummaryDto) _then;

/// Create a copy of SeasonDriverSummaryDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? driverId = null,Object? fullName = null,Object? shortCode = freezed,Object? permanentNumber = freezed,Object? raceNumber = freezed,Object? countryCode = freezed,Object? constructorId = null,Object? role = freezed,}) {
  return _then(_self.copyWith(
driverId: null == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,shortCode: freezed == shortCode ? _self.shortCode : shortCode // ignore: cast_nullable_to_non_nullable
as String?,permanentNumber: freezed == permanentNumber ? _self.permanentNumber : permanentNumber // ignore: cast_nullable_to_non_nullable
as int?,raceNumber: freezed == raceNumber ? _self.raceNumber : raceNumber // ignore: cast_nullable_to_non_nullable
as int?,countryCode: freezed == countryCode ? _self.countryCode : countryCode // ignore: cast_nullable_to_non_nullable
as String?,constructorId: null == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String,role: freezed == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [SeasonDriverSummaryDto].
extension SeasonDriverSummaryDtoPatterns on SeasonDriverSummaryDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SeasonDriverSummaryDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SeasonDriverSummaryDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SeasonDriverSummaryDto value)  $default,){
final _that = this;
switch (_that) {
case _SeasonDriverSummaryDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SeasonDriverSummaryDto value)?  $default,){
final _that = this;
switch (_that) {
case _SeasonDriverSummaryDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String driverId,  String fullName,  String? shortCode,  int? permanentNumber,  int? raceNumber,  String? countryCode,  String constructorId,  String? role)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SeasonDriverSummaryDto() when $default != null:
return $default(_that.driverId,_that.fullName,_that.shortCode,_that.permanentNumber,_that.raceNumber,_that.countryCode,_that.constructorId,_that.role);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String driverId,  String fullName,  String? shortCode,  int? permanentNumber,  int? raceNumber,  String? countryCode,  String constructorId,  String? role)  $default,) {final _that = this;
switch (_that) {
case _SeasonDriverSummaryDto():
return $default(_that.driverId,_that.fullName,_that.shortCode,_that.permanentNumber,_that.raceNumber,_that.countryCode,_that.constructorId,_that.role);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String driverId,  String fullName,  String? shortCode,  int? permanentNumber,  int? raceNumber,  String? countryCode,  String constructorId,  String? role)?  $default,) {final _that = this;
switch (_that) {
case _SeasonDriverSummaryDto() when $default != null:
return $default(_that.driverId,_that.fullName,_that.shortCode,_that.permanentNumber,_that.raceNumber,_that.countryCode,_that.constructorId,_that.role);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SeasonDriverSummaryDto implements SeasonDriverSummaryDto {
  const _SeasonDriverSummaryDto({required this.driverId, required this.fullName, this.shortCode, this.permanentNumber, this.raceNumber, this.countryCode, required this.constructorId, this.role});
  factory _SeasonDriverSummaryDto.fromJson(Map<String, dynamic> json) => _$SeasonDriverSummaryDtoFromJson(json);

@override final  String driverId;
@override final  String fullName;
@override final  String? shortCode;
@override final  int? permanentNumber;
@override final  int? raceNumber;
@override final  String? countryCode;
@override final  String constructorId;
@override final  String? role;

/// Create a copy of SeasonDriverSummaryDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SeasonDriverSummaryDtoCopyWith<_SeasonDriverSummaryDto> get copyWith => __$SeasonDriverSummaryDtoCopyWithImpl<_SeasonDriverSummaryDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SeasonDriverSummaryDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SeasonDriverSummaryDto&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.shortCode, shortCode) || other.shortCode == shortCode)&&(identical(other.permanentNumber, permanentNumber) || other.permanentNumber == permanentNumber)&&(identical(other.raceNumber, raceNumber) || other.raceNumber == raceNumber)&&(identical(other.countryCode, countryCode) || other.countryCode == countryCode)&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.role, role) || other.role == role));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,driverId,fullName,shortCode,permanentNumber,raceNumber,countryCode,constructorId,role);

@override
String toString() {
  return 'SeasonDriverSummaryDto(driverId: $driverId, fullName: $fullName, shortCode: $shortCode, permanentNumber: $permanentNumber, raceNumber: $raceNumber, countryCode: $countryCode, constructorId: $constructorId, role: $role)';
}


}

/// @nodoc
abstract mixin class _$SeasonDriverSummaryDtoCopyWith<$Res> implements $SeasonDriverSummaryDtoCopyWith<$Res> {
  factory _$SeasonDriverSummaryDtoCopyWith(_SeasonDriverSummaryDto value, $Res Function(_SeasonDriverSummaryDto) _then) = __$SeasonDriverSummaryDtoCopyWithImpl;
@override @useResult
$Res call({
 String driverId, String fullName, String? shortCode, int? permanentNumber, int? raceNumber, String? countryCode, String constructorId, String? role
});




}
/// @nodoc
class __$SeasonDriverSummaryDtoCopyWithImpl<$Res>
    implements _$SeasonDriverSummaryDtoCopyWith<$Res> {
  __$SeasonDriverSummaryDtoCopyWithImpl(this._self, this._then);

  final _SeasonDriverSummaryDto _self;
  final $Res Function(_SeasonDriverSummaryDto) _then;

/// Create a copy of SeasonDriverSummaryDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? driverId = null,Object? fullName = null,Object? shortCode = freezed,Object? permanentNumber = freezed,Object? raceNumber = freezed,Object? countryCode = freezed,Object? constructorId = null,Object? role = freezed,}) {
  return _then(_SeasonDriverSummaryDto(
driverId: null == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,shortCode: freezed == shortCode ? _self.shortCode : shortCode // ignore: cast_nullable_to_non_nullable
as String?,permanentNumber: freezed == permanentNumber ? _self.permanentNumber : permanentNumber // ignore: cast_nullable_to_non_nullable
as int?,raceNumber: freezed == raceNumber ? _self.raceNumber : raceNumber // ignore: cast_nullable_to_non_nullable
as int?,countryCode: freezed == countryCode ? _self.countryCode : countryCode // ignore: cast_nullable_to_non_nullable
as String?,constructorId: null == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String,role: freezed == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$SeasonConstructorSummaryDto {

 String get constructorId; String get name; String? get fullName; String? get shortName; String? get colorPrimary; String? get colorSecondary; String? get powerUnit; List<String>? get driverLineup;
/// Create a copy of SeasonConstructorSummaryDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SeasonConstructorSummaryDtoCopyWith<SeasonConstructorSummaryDto> get copyWith => _$SeasonConstructorSummaryDtoCopyWithImpl<SeasonConstructorSummaryDto>(this as SeasonConstructorSummaryDto, _$identity);

  /// Serializes this SeasonConstructorSummaryDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SeasonConstructorSummaryDto&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.name, name) || other.name == name)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.shortName, shortName) || other.shortName == shortName)&&(identical(other.colorPrimary, colorPrimary) || other.colorPrimary == colorPrimary)&&(identical(other.colorSecondary, colorSecondary) || other.colorSecondary == colorSecondary)&&(identical(other.powerUnit, powerUnit) || other.powerUnit == powerUnit)&&const DeepCollectionEquality().equals(other.driverLineup, driverLineup));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,constructorId,name,fullName,shortName,colorPrimary,colorSecondary,powerUnit,const DeepCollectionEquality().hash(driverLineup));

@override
String toString() {
  return 'SeasonConstructorSummaryDto(constructorId: $constructorId, name: $name, fullName: $fullName, shortName: $shortName, colorPrimary: $colorPrimary, colorSecondary: $colorSecondary, powerUnit: $powerUnit, driverLineup: $driverLineup)';
}


}

/// @nodoc
abstract mixin class $SeasonConstructorSummaryDtoCopyWith<$Res>  {
  factory $SeasonConstructorSummaryDtoCopyWith(SeasonConstructorSummaryDto value, $Res Function(SeasonConstructorSummaryDto) _then) = _$SeasonConstructorSummaryDtoCopyWithImpl;
@useResult
$Res call({
 String constructorId, String name, String? fullName, String? shortName, String? colorPrimary, String? colorSecondary, String? powerUnit, List<String>? driverLineup
});




}
/// @nodoc
class _$SeasonConstructorSummaryDtoCopyWithImpl<$Res>
    implements $SeasonConstructorSummaryDtoCopyWith<$Res> {
  _$SeasonConstructorSummaryDtoCopyWithImpl(this._self, this._then);

  final SeasonConstructorSummaryDto _self;
  final $Res Function(SeasonConstructorSummaryDto) _then;

/// Create a copy of SeasonConstructorSummaryDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? constructorId = null,Object? name = null,Object? fullName = freezed,Object? shortName = freezed,Object? colorPrimary = freezed,Object? colorSecondary = freezed,Object? powerUnit = freezed,Object? driverLineup = freezed,}) {
  return _then(_self.copyWith(
constructorId: null == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,fullName: freezed == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String?,shortName: freezed == shortName ? _self.shortName : shortName // ignore: cast_nullable_to_non_nullable
as String?,colorPrimary: freezed == colorPrimary ? _self.colorPrimary : colorPrimary // ignore: cast_nullable_to_non_nullable
as String?,colorSecondary: freezed == colorSecondary ? _self.colorSecondary : colorSecondary // ignore: cast_nullable_to_non_nullable
as String?,powerUnit: freezed == powerUnit ? _self.powerUnit : powerUnit // ignore: cast_nullable_to_non_nullable
as String?,driverLineup: freezed == driverLineup ? _self.driverLineup : driverLineup // ignore: cast_nullable_to_non_nullable
as List<String>?,
  ));
}

}


/// Adds pattern-matching-related methods to [SeasonConstructorSummaryDto].
extension SeasonConstructorSummaryDtoPatterns on SeasonConstructorSummaryDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SeasonConstructorSummaryDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SeasonConstructorSummaryDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SeasonConstructorSummaryDto value)  $default,){
final _that = this;
switch (_that) {
case _SeasonConstructorSummaryDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SeasonConstructorSummaryDto value)?  $default,){
final _that = this;
switch (_that) {
case _SeasonConstructorSummaryDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String constructorId,  String name,  String? fullName,  String? shortName,  String? colorPrimary,  String? colorSecondary,  String? powerUnit,  List<String>? driverLineup)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SeasonConstructorSummaryDto() when $default != null:
return $default(_that.constructorId,_that.name,_that.fullName,_that.shortName,_that.colorPrimary,_that.colorSecondary,_that.powerUnit,_that.driverLineup);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String constructorId,  String name,  String? fullName,  String? shortName,  String? colorPrimary,  String? colorSecondary,  String? powerUnit,  List<String>? driverLineup)  $default,) {final _that = this;
switch (_that) {
case _SeasonConstructorSummaryDto():
return $default(_that.constructorId,_that.name,_that.fullName,_that.shortName,_that.colorPrimary,_that.colorSecondary,_that.powerUnit,_that.driverLineup);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String constructorId,  String name,  String? fullName,  String? shortName,  String? colorPrimary,  String? colorSecondary,  String? powerUnit,  List<String>? driverLineup)?  $default,) {final _that = this;
switch (_that) {
case _SeasonConstructorSummaryDto() when $default != null:
return $default(_that.constructorId,_that.name,_that.fullName,_that.shortName,_that.colorPrimary,_that.colorSecondary,_that.powerUnit,_that.driverLineup);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SeasonConstructorSummaryDto implements SeasonConstructorSummaryDto {
  const _SeasonConstructorSummaryDto({required this.constructorId, required this.name, this.fullName, this.shortName, this.colorPrimary, this.colorSecondary, this.powerUnit, final  List<String>? driverLineup}): _driverLineup = driverLineup;
  factory _SeasonConstructorSummaryDto.fromJson(Map<String, dynamic> json) => _$SeasonConstructorSummaryDtoFromJson(json);

@override final  String constructorId;
@override final  String name;
@override final  String? fullName;
@override final  String? shortName;
@override final  String? colorPrimary;
@override final  String? colorSecondary;
@override final  String? powerUnit;
 final  List<String>? _driverLineup;
@override List<String>? get driverLineup {
  final value = _driverLineup;
  if (value == null) return null;
  if (_driverLineup is EqualUnmodifiableListView) return _driverLineup;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of SeasonConstructorSummaryDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SeasonConstructorSummaryDtoCopyWith<_SeasonConstructorSummaryDto> get copyWith => __$SeasonConstructorSummaryDtoCopyWithImpl<_SeasonConstructorSummaryDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SeasonConstructorSummaryDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SeasonConstructorSummaryDto&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.name, name) || other.name == name)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.shortName, shortName) || other.shortName == shortName)&&(identical(other.colorPrimary, colorPrimary) || other.colorPrimary == colorPrimary)&&(identical(other.colorSecondary, colorSecondary) || other.colorSecondary == colorSecondary)&&(identical(other.powerUnit, powerUnit) || other.powerUnit == powerUnit)&&const DeepCollectionEquality().equals(other._driverLineup, _driverLineup));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,constructorId,name,fullName,shortName,colorPrimary,colorSecondary,powerUnit,const DeepCollectionEquality().hash(_driverLineup));

@override
String toString() {
  return 'SeasonConstructorSummaryDto(constructorId: $constructorId, name: $name, fullName: $fullName, shortName: $shortName, colorPrimary: $colorPrimary, colorSecondary: $colorSecondary, powerUnit: $powerUnit, driverLineup: $driverLineup)';
}


}

/// @nodoc
abstract mixin class _$SeasonConstructorSummaryDtoCopyWith<$Res> implements $SeasonConstructorSummaryDtoCopyWith<$Res> {
  factory _$SeasonConstructorSummaryDtoCopyWith(_SeasonConstructorSummaryDto value, $Res Function(_SeasonConstructorSummaryDto) _then) = __$SeasonConstructorSummaryDtoCopyWithImpl;
@override @useResult
$Res call({
 String constructorId, String name, String? fullName, String? shortName, String? colorPrimary, String? colorSecondary, String? powerUnit, List<String>? driverLineup
});




}
/// @nodoc
class __$SeasonConstructorSummaryDtoCopyWithImpl<$Res>
    implements _$SeasonConstructorSummaryDtoCopyWith<$Res> {
  __$SeasonConstructorSummaryDtoCopyWithImpl(this._self, this._then);

  final _SeasonConstructorSummaryDto _self;
  final $Res Function(_SeasonConstructorSummaryDto) _then;

/// Create a copy of SeasonConstructorSummaryDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? constructorId = null,Object? name = null,Object? fullName = freezed,Object? shortName = freezed,Object? colorPrimary = freezed,Object? colorSecondary = freezed,Object? powerUnit = freezed,Object? driverLineup = freezed,}) {
  return _then(_SeasonConstructorSummaryDto(
constructorId: null == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,fullName: freezed == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String?,shortName: freezed == shortName ? _self.shortName : shortName // ignore: cast_nullable_to_non_nullable
as String?,colorPrimary: freezed == colorPrimary ? _self.colorPrimary : colorPrimary // ignore: cast_nullable_to_non_nullable
as String?,colorSecondary: freezed == colorSecondary ? _self.colorSecondary : colorSecondary // ignore: cast_nullable_to_non_nullable
as String?,powerUnit: freezed == powerUnit ? _self.powerUnit : powerUnit // ignore: cast_nullable_to_non_nullable
as String?,driverLineup: freezed == driverLineup ? _self._driverLineup : driverLineup // ignore: cast_nullable_to_non_nullable
as List<String>?,
  ));
}


}

// dart format on
