// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'standing_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$DriverStandingDto {

 int get season; String get driverId; String? get constructorId; int? get position; double get points; int? get wins; int? get podiums; bool? get provisional;
/// Create a copy of DriverStandingDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DriverStandingDtoCopyWith<DriverStandingDto> get copyWith => _$DriverStandingDtoCopyWithImpl<DriverStandingDto>(this as DriverStandingDto, _$identity);

  /// Serializes this DriverStandingDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DriverStandingDto&&(identical(other.season, season) || other.season == season)&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.position, position) || other.position == position)&&(identical(other.points, points) || other.points == points)&&(identical(other.wins, wins) || other.wins == wins)&&(identical(other.podiums, podiums) || other.podiums == podiums)&&(identical(other.provisional, provisional) || other.provisional == provisional));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,season,driverId,constructorId,position,points,wins,podiums,provisional);

@override
String toString() {
  return 'DriverStandingDto(season: $season, driverId: $driverId, constructorId: $constructorId, position: $position, points: $points, wins: $wins, podiums: $podiums, provisional: $provisional)';
}


}

/// @nodoc
abstract mixin class $DriverStandingDtoCopyWith<$Res>  {
  factory $DriverStandingDtoCopyWith(DriverStandingDto value, $Res Function(DriverStandingDto) _then) = _$DriverStandingDtoCopyWithImpl;
@useResult
$Res call({
 int season, String driverId, String? constructorId, int? position, double points, int? wins, int? podiums, bool? provisional
});




}
/// @nodoc
class _$DriverStandingDtoCopyWithImpl<$Res>
    implements $DriverStandingDtoCopyWith<$Res> {
  _$DriverStandingDtoCopyWithImpl(this._self, this._then);

  final DriverStandingDto _self;
  final $Res Function(DriverStandingDto) _then;

/// Create a copy of DriverStandingDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? season = null,Object? driverId = null,Object? constructorId = freezed,Object? position = freezed,Object? points = null,Object? wins = freezed,Object? podiums = freezed,Object? provisional = freezed,}) {
  return _then(_self.copyWith(
season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,driverId: null == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String,constructorId: freezed == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String?,position: freezed == position ? _self.position : position // ignore: cast_nullable_to_non_nullable
as int?,points: null == points ? _self.points : points // ignore: cast_nullable_to_non_nullable
as double,wins: freezed == wins ? _self.wins : wins // ignore: cast_nullable_to_non_nullable
as int?,podiums: freezed == podiums ? _self.podiums : podiums // ignore: cast_nullable_to_non_nullable
as int?,provisional: freezed == provisional ? _self.provisional : provisional // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}

}


/// Adds pattern-matching-related methods to [DriverStandingDto].
extension DriverStandingDtoPatterns on DriverStandingDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DriverStandingDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DriverStandingDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DriverStandingDto value)  $default,){
final _that = this;
switch (_that) {
case _DriverStandingDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DriverStandingDto value)?  $default,){
final _that = this;
switch (_that) {
case _DriverStandingDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int season,  String driverId,  String? constructorId,  int? position,  double points,  int? wins,  int? podiums,  bool? provisional)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DriverStandingDto() when $default != null:
return $default(_that.season,_that.driverId,_that.constructorId,_that.position,_that.points,_that.wins,_that.podiums,_that.provisional);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int season,  String driverId,  String? constructorId,  int? position,  double points,  int? wins,  int? podiums,  bool? provisional)  $default,) {final _that = this;
switch (_that) {
case _DriverStandingDto():
return $default(_that.season,_that.driverId,_that.constructorId,_that.position,_that.points,_that.wins,_that.podiums,_that.provisional);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int season,  String driverId,  String? constructorId,  int? position,  double points,  int? wins,  int? podiums,  bool? provisional)?  $default,) {final _that = this;
switch (_that) {
case _DriverStandingDto() when $default != null:
return $default(_that.season,_that.driverId,_that.constructorId,_that.position,_that.points,_that.wins,_that.podiums,_that.provisional);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DriverStandingDto implements DriverStandingDto {
  const _DriverStandingDto({required this.season, required this.driverId, this.constructorId, this.position, required this.points, this.wins, this.podiums, this.provisional});
  factory _DriverStandingDto.fromJson(Map<String, dynamic> json) => _$DriverStandingDtoFromJson(json);

@override final  int season;
@override final  String driverId;
@override final  String? constructorId;
@override final  int? position;
@override final  double points;
@override final  int? wins;
@override final  int? podiums;
@override final  bool? provisional;

/// Create a copy of DriverStandingDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DriverStandingDtoCopyWith<_DriverStandingDto> get copyWith => __$DriverStandingDtoCopyWithImpl<_DriverStandingDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DriverStandingDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DriverStandingDto&&(identical(other.season, season) || other.season == season)&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.position, position) || other.position == position)&&(identical(other.points, points) || other.points == points)&&(identical(other.wins, wins) || other.wins == wins)&&(identical(other.podiums, podiums) || other.podiums == podiums)&&(identical(other.provisional, provisional) || other.provisional == provisional));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,season,driverId,constructorId,position,points,wins,podiums,provisional);

@override
String toString() {
  return 'DriverStandingDto(season: $season, driverId: $driverId, constructorId: $constructorId, position: $position, points: $points, wins: $wins, podiums: $podiums, provisional: $provisional)';
}


}

/// @nodoc
abstract mixin class _$DriverStandingDtoCopyWith<$Res> implements $DriverStandingDtoCopyWith<$Res> {
  factory _$DriverStandingDtoCopyWith(_DriverStandingDto value, $Res Function(_DriverStandingDto) _then) = __$DriverStandingDtoCopyWithImpl;
@override @useResult
$Res call({
 int season, String driverId, String? constructorId, int? position, double points, int? wins, int? podiums, bool? provisional
});




}
/// @nodoc
class __$DriverStandingDtoCopyWithImpl<$Res>
    implements _$DriverStandingDtoCopyWith<$Res> {
  __$DriverStandingDtoCopyWithImpl(this._self, this._then);

  final _DriverStandingDto _self;
  final $Res Function(_DriverStandingDto) _then;

/// Create a copy of DriverStandingDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? season = null,Object? driverId = null,Object? constructorId = freezed,Object? position = freezed,Object? points = null,Object? wins = freezed,Object? podiums = freezed,Object? provisional = freezed,}) {
  return _then(_DriverStandingDto(
season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,driverId: null == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String,constructorId: freezed == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String?,position: freezed == position ? _self.position : position // ignore: cast_nullable_to_non_nullable
as int?,points: null == points ? _self.points : points // ignore: cast_nullable_to_non_nullable
as double,wins: freezed == wins ? _self.wins : wins // ignore: cast_nullable_to_non_nullable
as int?,podiums: freezed == podiums ? _self.podiums : podiums // ignore: cast_nullable_to_non_nullable
as int?,provisional: freezed == provisional ? _self.provisional : provisional // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}


}


/// @nodoc
mixin _$ConstructorStandingDto {

 int get season; String get constructorId; int? get position; double get points; int? get wins; bool? get provisional;
/// Create a copy of ConstructorStandingDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ConstructorStandingDtoCopyWith<ConstructorStandingDto> get copyWith => _$ConstructorStandingDtoCopyWithImpl<ConstructorStandingDto>(this as ConstructorStandingDto, _$identity);

  /// Serializes this ConstructorStandingDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ConstructorStandingDto&&(identical(other.season, season) || other.season == season)&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.position, position) || other.position == position)&&(identical(other.points, points) || other.points == points)&&(identical(other.wins, wins) || other.wins == wins)&&(identical(other.provisional, provisional) || other.provisional == provisional));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,season,constructorId,position,points,wins,provisional);

@override
String toString() {
  return 'ConstructorStandingDto(season: $season, constructorId: $constructorId, position: $position, points: $points, wins: $wins, provisional: $provisional)';
}


}

/// @nodoc
abstract mixin class $ConstructorStandingDtoCopyWith<$Res>  {
  factory $ConstructorStandingDtoCopyWith(ConstructorStandingDto value, $Res Function(ConstructorStandingDto) _then) = _$ConstructorStandingDtoCopyWithImpl;
@useResult
$Res call({
 int season, String constructorId, int? position, double points, int? wins, bool? provisional
});




}
/// @nodoc
class _$ConstructorStandingDtoCopyWithImpl<$Res>
    implements $ConstructorStandingDtoCopyWith<$Res> {
  _$ConstructorStandingDtoCopyWithImpl(this._self, this._then);

  final ConstructorStandingDto _self;
  final $Res Function(ConstructorStandingDto) _then;

/// Create a copy of ConstructorStandingDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? season = null,Object? constructorId = null,Object? position = freezed,Object? points = null,Object? wins = freezed,Object? provisional = freezed,}) {
  return _then(_self.copyWith(
season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,constructorId: null == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String,position: freezed == position ? _self.position : position // ignore: cast_nullable_to_non_nullable
as int?,points: null == points ? _self.points : points // ignore: cast_nullable_to_non_nullable
as double,wins: freezed == wins ? _self.wins : wins // ignore: cast_nullable_to_non_nullable
as int?,provisional: freezed == provisional ? _self.provisional : provisional // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}

}


/// Adds pattern-matching-related methods to [ConstructorStandingDto].
extension ConstructorStandingDtoPatterns on ConstructorStandingDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ConstructorStandingDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ConstructorStandingDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ConstructorStandingDto value)  $default,){
final _that = this;
switch (_that) {
case _ConstructorStandingDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ConstructorStandingDto value)?  $default,){
final _that = this;
switch (_that) {
case _ConstructorStandingDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int season,  String constructorId,  int? position,  double points,  int? wins,  bool? provisional)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ConstructorStandingDto() when $default != null:
return $default(_that.season,_that.constructorId,_that.position,_that.points,_that.wins,_that.provisional);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int season,  String constructorId,  int? position,  double points,  int? wins,  bool? provisional)  $default,) {final _that = this;
switch (_that) {
case _ConstructorStandingDto():
return $default(_that.season,_that.constructorId,_that.position,_that.points,_that.wins,_that.provisional);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int season,  String constructorId,  int? position,  double points,  int? wins,  bool? provisional)?  $default,) {final _that = this;
switch (_that) {
case _ConstructorStandingDto() when $default != null:
return $default(_that.season,_that.constructorId,_that.position,_that.points,_that.wins,_that.provisional);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ConstructorStandingDto implements ConstructorStandingDto {
  const _ConstructorStandingDto({required this.season, required this.constructorId, this.position, required this.points, this.wins, this.provisional});
  factory _ConstructorStandingDto.fromJson(Map<String, dynamic> json) => _$ConstructorStandingDtoFromJson(json);

@override final  int season;
@override final  String constructorId;
@override final  int? position;
@override final  double points;
@override final  int? wins;
@override final  bool? provisional;

/// Create a copy of ConstructorStandingDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ConstructorStandingDtoCopyWith<_ConstructorStandingDto> get copyWith => __$ConstructorStandingDtoCopyWithImpl<_ConstructorStandingDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ConstructorStandingDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ConstructorStandingDto&&(identical(other.season, season) || other.season == season)&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.position, position) || other.position == position)&&(identical(other.points, points) || other.points == points)&&(identical(other.wins, wins) || other.wins == wins)&&(identical(other.provisional, provisional) || other.provisional == provisional));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,season,constructorId,position,points,wins,provisional);

@override
String toString() {
  return 'ConstructorStandingDto(season: $season, constructorId: $constructorId, position: $position, points: $points, wins: $wins, provisional: $provisional)';
}


}

/// @nodoc
abstract mixin class _$ConstructorStandingDtoCopyWith<$Res> implements $ConstructorStandingDtoCopyWith<$Res> {
  factory _$ConstructorStandingDtoCopyWith(_ConstructorStandingDto value, $Res Function(_ConstructorStandingDto) _then) = __$ConstructorStandingDtoCopyWithImpl;
@override @useResult
$Res call({
 int season, String constructorId, int? position, double points, int? wins, bool? provisional
});




}
/// @nodoc
class __$ConstructorStandingDtoCopyWithImpl<$Res>
    implements _$ConstructorStandingDtoCopyWith<$Res> {
  __$ConstructorStandingDtoCopyWithImpl(this._self, this._then);

  final _ConstructorStandingDto _self;
  final $Res Function(_ConstructorStandingDto) _then;

/// Create a copy of ConstructorStandingDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? season = null,Object? constructorId = null,Object? position = freezed,Object? points = null,Object? wins = freezed,Object? provisional = freezed,}) {
  return _then(_ConstructorStandingDto(
season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,constructorId: null == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String,position: freezed == position ? _self.position : position // ignore: cast_nullable_to_non_nullable
as int?,points: null == points ? _self.points : points // ignore: cast_nullable_to_non_nullable
as double,wins: freezed == wins ? _self.wins : wins // ignore: cast_nullable_to_non_nullable
as int?,provisional: freezed == provisional ? _self.provisional : provisional // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}


}

// dart format on
