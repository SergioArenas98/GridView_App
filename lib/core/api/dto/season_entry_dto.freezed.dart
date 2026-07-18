// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'season_entry_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$DriverSeasonEntryDto {

 String get id; int get season; String get driverId; String get constructorId; int? get raceNumber; String? get role; String? get shortCode; int? get startRound; int? get endRound;
/// Create a copy of DriverSeasonEntryDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DriverSeasonEntryDtoCopyWith<DriverSeasonEntryDto> get copyWith => _$DriverSeasonEntryDtoCopyWithImpl<DriverSeasonEntryDto>(this as DriverSeasonEntryDto, _$identity);

  /// Serializes this DriverSeasonEntryDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DriverSeasonEntryDto&&(identical(other.id, id) || other.id == id)&&(identical(other.season, season) || other.season == season)&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.raceNumber, raceNumber) || other.raceNumber == raceNumber)&&(identical(other.role, role) || other.role == role)&&(identical(other.shortCode, shortCode) || other.shortCode == shortCode)&&(identical(other.startRound, startRound) || other.startRound == startRound)&&(identical(other.endRound, endRound) || other.endRound == endRound));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,season,driverId,constructorId,raceNumber,role,shortCode,startRound,endRound);

@override
String toString() {
  return 'DriverSeasonEntryDto(id: $id, season: $season, driverId: $driverId, constructorId: $constructorId, raceNumber: $raceNumber, role: $role, shortCode: $shortCode, startRound: $startRound, endRound: $endRound)';
}


}

/// @nodoc
abstract mixin class $DriverSeasonEntryDtoCopyWith<$Res>  {
  factory $DriverSeasonEntryDtoCopyWith(DriverSeasonEntryDto value, $Res Function(DriverSeasonEntryDto) _then) = _$DriverSeasonEntryDtoCopyWithImpl;
@useResult
$Res call({
 String id, int season, String driverId, String constructorId, int? raceNumber, String? role, String? shortCode, int? startRound, int? endRound
});




}
/// @nodoc
class _$DriverSeasonEntryDtoCopyWithImpl<$Res>
    implements $DriverSeasonEntryDtoCopyWith<$Res> {
  _$DriverSeasonEntryDtoCopyWithImpl(this._self, this._then);

  final DriverSeasonEntryDto _self;
  final $Res Function(DriverSeasonEntryDto) _then;

/// Create a copy of DriverSeasonEntryDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? season = null,Object? driverId = null,Object? constructorId = null,Object? raceNumber = freezed,Object? role = freezed,Object? shortCode = freezed,Object? startRound = freezed,Object? endRound = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,driverId: null == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String,constructorId: null == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String,raceNumber: freezed == raceNumber ? _self.raceNumber : raceNumber // ignore: cast_nullable_to_non_nullable
as int?,role: freezed == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String?,shortCode: freezed == shortCode ? _self.shortCode : shortCode // ignore: cast_nullable_to_non_nullable
as String?,startRound: freezed == startRound ? _self.startRound : startRound // ignore: cast_nullable_to_non_nullable
as int?,endRound: freezed == endRound ? _self.endRound : endRound // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [DriverSeasonEntryDto].
extension DriverSeasonEntryDtoPatterns on DriverSeasonEntryDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DriverSeasonEntryDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DriverSeasonEntryDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DriverSeasonEntryDto value)  $default,){
final _that = this;
switch (_that) {
case _DriverSeasonEntryDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DriverSeasonEntryDto value)?  $default,){
final _that = this;
switch (_that) {
case _DriverSeasonEntryDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  int season,  String driverId,  String constructorId,  int? raceNumber,  String? role,  String? shortCode,  int? startRound,  int? endRound)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DriverSeasonEntryDto() when $default != null:
return $default(_that.id,_that.season,_that.driverId,_that.constructorId,_that.raceNumber,_that.role,_that.shortCode,_that.startRound,_that.endRound);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  int season,  String driverId,  String constructorId,  int? raceNumber,  String? role,  String? shortCode,  int? startRound,  int? endRound)  $default,) {final _that = this;
switch (_that) {
case _DriverSeasonEntryDto():
return $default(_that.id,_that.season,_that.driverId,_that.constructorId,_that.raceNumber,_that.role,_that.shortCode,_that.startRound,_that.endRound);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  int season,  String driverId,  String constructorId,  int? raceNumber,  String? role,  String? shortCode,  int? startRound,  int? endRound)?  $default,) {final _that = this;
switch (_that) {
case _DriverSeasonEntryDto() when $default != null:
return $default(_that.id,_that.season,_that.driverId,_that.constructorId,_that.raceNumber,_that.role,_that.shortCode,_that.startRound,_that.endRound);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DriverSeasonEntryDto implements DriverSeasonEntryDto {
  const _DriverSeasonEntryDto({required this.id, required this.season, required this.driverId, required this.constructorId, this.raceNumber, this.role, this.shortCode, this.startRound, this.endRound});
  factory _DriverSeasonEntryDto.fromJson(Map<String, dynamic> json) => _$DriverSeasonEntryDtoFromJson(json);

@override final  String id;
@override final  int season;
@override final  String driverId;
@override final  String constructorId;
@override final  int? raceNumber;
@override final  String? role;
@override final  String? shortCode;
@override final  int? startRound;
@override final  int? endRound;

/// Create a copy of DriverSeasonEntryDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DriverSeasonEntryDtoCopyWith<_DriverSeasonEntryDto> get copyWith => __$DriverSeasonEntryDtoCopyWithImpl<_DriverSeasonEntryDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DriverSeasonEntryDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DriverSeasonEntryDto&&(identical(other.id, id) || other.id == id)&&(identical(other.season, season) || other.season == season)&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.raceNumber, raceNumber) || other.raceNumber == raceNumber)&&(identical(other.role, role) || other.role == role)&&(identical(other.shortCode, shortCode) || other.shortCode == shortCode)&&(identical(other.startRound, startRound) || other.startRound == startRound)&&(identical(other.endRound, endRound) || other.endRound == endRound));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,season,driverId,constructorId,raceNumber,role,shortCode,startRound,endRound);

@override
String toString() {
  return 'DriverSeasonEntryDto(id: $id, season: $season, driverId: $driverId, constructorId: $constructorId, raceNumber: $raceNumber, role: $role, shortCode: $shortCode, startRound: $startRound, endRound: $endRound)';
}


}

/// @nodoc
abstract mixin class _$DriverSeasonEntryDtoCopyWith<$Res> implements $DriverSeasonEntryDtoCopyWith<$Res> {
  factory _$DriverSeasonEntryDtoCopyWith(_DriverSeasonEntryDto value, $Res Function(_DriverSeasonEntryDto) _then) = __$DriverSeasonEntryDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, int season, String driverId, String constructorId, int? raceNumber, String? role, String? shortCode, int? startRound, int? endRound
});




}
/// @nodoc
class __$DriverSeasonEntryDtoCopyWithImpl<$Res>
    implements _$DriverSeasonEntryDtoCopyWith<$Res> {
  __$DriverSeasonEntryDtoCopyWithImpl(this._self, this._then);

  final _DriverSeasonEntryDto _self;
  final $Res Function(_DriverSeasonEntryDto) _then;

/// Create a copy of DriverSeasonEntryDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? season = null,Object? driverId = null,Object? constructorId = null,Object? raceNumber = freezed,Object? role = freezed,Object? shortCode = freezed,Object? startRound = freezed,Object? endRound = freezed,}) {
  return _then(_DriverSeasonEntryDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,driverId: null == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String,constructorId: null == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String,raceNumber: freezed == raceNumber ? _self.raceNumber : raceNumber // ignore: cast_nullable_to_non_nullable
as int?,role: freezed == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String?,shortCode: freezed == shortCode ? _self.shortCode : shortCode // ignore: cast_nullable_to_non_nullable
as String?,startRound: freezed == startRound ? _self.startRound : startRound // ignore: cast_nullable_to_non_nullable
as int?,endRound: freezed == endRound ? _self.endRound : endRound // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$ConstructorSeasonEntryDto {

 String get id; int get season; String get constructorId; String? get fullName; String? get shortName; String? get colorPrimary; String? get colorSecondary; String? get powerUnit; String? get teamPrincipal; String? get base; String? get chassis; List<String>? get driverLineup;
/// Create a copy of ConstructorSeasonEntryDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ConstructorSeasonEntryDtoCopyWith<ConstructorSeasonEntryDto> get copyWith => _$ConstructorSeasonEntryDtoCopyWithImpl<ConstructorSeasonEntryDto>(this as ConstructorSeasonEntryDto, _$identity);

  /// Serializes this ConstructorSeasonEntryDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ConstructorSeasonEntryDto&&(identical(other.id, id) || other.id == id)&&(identical(other.season, season) || other.season == season)&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.shortName, shortName) || other.shortName == shortName)&&(identical(other.colorPrimary, colorPrimary) || other.colorPrimary == colorPrimary)&&(identical(other.colorSecondary, colorSecondary) || other.colorSecondary == colorSecondary)&&(identical(other.powerUnit, powerUnit) || other.powerUnit == powerUnit)&&(identical(other.teamPrincipal, teamPrincipal) || other.teamPrincipal == teamPrincipal)&&(identical(other.base, base) || other.base == base)&&(identical(other.chassis, chassis) || other.chassis == chassis)&&const DeepCollectionEquality().equals(other.driverLineup, driverLineup));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,season,constructorId,fullName,shortName,colorPrimary,colorSecondary,powerUnit,teamPrincipal,base,chassis,const DeepCollectionEquality().hash(driverLineup));

@override
String toString() {
  return 'ConstructorSeasonEntryDto(id: $id, season: $season, constructorId: $constructorId, fullName: $fullName, shortName: $shortName, colorPrimary: $colorPrimary, colorSecondary: $colorSecondary, powerUnit: $powerUnit, teamPrincipal: $teamPrincipal, base: $base, chassis: $chassis, driverLineup: $driverLineup)';
}


}

/// @nodoc
abstract mixin class $ConstructorSeasonEntryDtoCopyWith<$Res>  {
  factory $ConstructorSeasonEntryDtoCopyWith(ConstructorSeasonEntryDto value, $Res Function(ConstructorSeasonEntryDto) _then) = _$ConstructorSeasonEntryDtoCopyWithImpl;
@useResult
$Res call({
 String id, int season, String constructorId, String? fullName, String? shortName, String? colorPrimary, String? colorSecondary, String? powerUnit, String? teamPrincipal, String? base, String? chassis, List<String>? driverLineup
});




}
/// @nodoc
class _$ConstructorSeasonEntryDtoCopyWithImpl<$Res>
    implements $ConstructorSeasonEntryDtoCopyWith<$Res> {
  _$ConstructorSeasonEntryDtoCopyWithImpl(this._self, this._then);

  final ConstructorSeasonEntryDto _self;
  final $Res Function(ConstructorSeasonEntryDto) _then;

/// Create a copy of ConstructorSeasonEntryDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? season = null,Object? constructorId = null,Object? fullName = freezed,Object? shortName = freezed,Object? colorPrimary = freezed,Object? colorSecondary = freezed,Object? powerUnit = freezed,Object? teamPrincipal = freezed,Object? base = freezed,Object? chassis = freezed,Object? driverLineup = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,constructorId: null == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String,fullName: freezed == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String?,shortName: freezed == shortName ? _self.shortName : shortName // ignore: cast_nullable_to_non_nullable
as String?,colorPrimary: freezed == colorPrimary ? _self.colorPrimary : colorPrimary // ignore: cast_nullable_to_non_nullable
as String?,colorSecondary: freezed == colorSecondary ? _self.colorSecondary : colorSecondary // ignore: cast_nullable_to_non_nullable
as String?,powerUnit: freezed == powerUnit ? _self.powerUnit : powerUnit // ignore: cast_nullable_to_non_nullable
as String?,teamPrincipal: freezed == teamPrincipal ? _self.teamPrincipal : teamPrincipal // ignore: cast_nullable_to_non_nullable
as String?,base: freezed == base ? _self.base : base // ignore: cast_nullable_to_non_nullable
as String?,chassis: freezed == chassis ? _self.chassis : chassis // ignore: cast_nullable_to_non_nullable
as String?,driverLineup: freezed == driverLineup ? _self.driverLineup : driverLineup // ignore: cast_nullable_to_non_nullable
as List<String>?,
  ));
}

}


/// Adds pattern-matching-related methods to [ConstructorSeasonEntryDto].
extension ConstructorSeasonEntryDtoPatterns on ConstructorSeasonEntryDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ConstructorSeasonEntryDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ConstructorSeasonEntryDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ConstructorSeasonEntryDto value)  $default,){
final _that = this;
switch (_that) {
case _ConstructorSeasonEntryDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ConstructorSeasonEntryDto value)?  $default,){
final _that = this;
switch (_that) {
case _ConstructorSeasonEntryDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  int season,  String constructorId,  String? fullName,  String? shortName,  String? colorPrimary,  String? colorSecondary,  String? powerUnit,  String? teamPrincipal,  String? base,  String? chassis,  List<String>? driverLineup)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ConstructorSeasonEntryDto() when $default != null:
return $default(_that.id,_that.season,_that.constructorId,_that.fullName,_that.shortName,_that.colorPrimary,_that.colorSecondary,_that.powerUnit,_that.teamPrincipal,_that.base,_that.chassis,_that.driverLineup);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  int season,  String constructorId,  String? fullName,  String? shortName,  String? colorPrimary,  String? colorSecondary,  String? powerUnit,  String? teamPrincipal,  String? base,  String? chassis,  List<String>? driverLineup)  $default,) {final _that = this;
switch (_that) {
case _ConstructorSeasonEntryDto():
return $default(_that.id,_that.season,_that.constructorId,_that.fullName,_that.shortName,_that.colorPrimary,_that.colorSecondary,_that.powerUnit,_that.teamPrincipal,_that.base,_that.chassis,_that.driverLineup);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  int season,  String constructorId,  String? fullName,  String? shortName,  String? colorPrimary,  String? colorSecondary,  String? powerUnit,  String? teamPrincipal,  String? base,  String? chassis,  List<String>? driverLineup)?  $default,) {final _that = this;
switch (_that) {
case _ConstructorSeasonEntryDto() when $default != null:
return $default(_that.id,_that.season,_that.constructorId,_that.fullName,_that.shortName,_that.colorPrimary,_that.colorSecondary,_that.powerUnit,_that.teamPrincipal,_that.base,_that.chassis,_that.driverLineup);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ConstructorSeasonEntryDto implements ConstructorSeasonEntryDto {
  const _ConstructorSeasonEntryDto({required this.id, required this.season, required this.constructorId, this.fullName, this.shortName, this.colorPrimary, this.colorSecondary, this.powerUnit, this.teamPrincipal, this.base, this.chassis, final  List<String>? driverLineup}): _driverLineup = driverLineup;
  factory _ConstructorSeasonEntryDto.fromJson(Map<String, dynamic> json) => _$ConstructorSeasonEntryDtoFromJson(json);

@override final  String id;
@override final  int season;
@override final  String constructorId;
@override final  String? fullName;
@override final  String? shortName;
@override final  String? colorPrimary;
@override final  String? colorSecondary;
@override final  String? powerUnit;
@override final  String? teamPrincipal;
@override final  String? base;
@override final  String? chassis;
 final  List<String>? _driverLineup;
@override List<String>? get driverLineup {
  final value = _driverLineup;
  if (value == null) return null;
  if (_driverLineup is EqualUnmodifiableListView) return _driverLineup;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of ConstructorSeasonEntryDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ConstructorSeasonEntryDtoCopyWith<_ConstructorSeasonEntryDto> get copyWith => __$ConstructorSeasonEntryDtoCopyWithImpl<_ConstructorSeasonEntryDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ConstructorSeasonEntryDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ConstructorSeasonEntryDto&&(identical(other.id, id) || other.id == id)&&(identical(other.season, season) || other.season == season)&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.shortName, shortName) || other.shortName == shortName)&&(identical(other.colorPrimary, colorPrimary) || other.colorPrimary == colorPrimary)&&(identical(other.colorSecondary, colorSecondary) || other.colorSecondary == colorSecondary)&&(identical(other.powerUnit, powerUnit) || other.powerUnit == powerUnit)&&(identical(other.teamPrincipal, teamPrincipal) || other.teamPrincipal == teamPrincipal)&&(identical(other.base, base) || other.base == base)&&(identical(other.chassis, chassis) || other.chassis == chassis)&&const DeepCollectionEquality().equals(other._driverLineup, _driverLineup));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,season,constructorId,fullName,shortName,colorPrimary,colorSecondary,powerUnit,teamPrincipal,base,chassis,const DeepCollectionEquality().hash(_driverLineup));

@override
String toString() {
  return 'ConstructorSeasonEntryDto(id: $id, season: $season, constructorId: $constructorId, fullName: $fullName, shortName: $shortName, colorPrimary: $colorPrimary, colorSecondary: $colorSecondary, powerUnit: $powerUnit, teamPrincipal: $teamPrincipal, base: $base, chassis: $chassis, driverLineup: $driverLineup)';
}


}

/// @nodoc
abstract mixin class _$ConstructorSeasonEntryDtoCopyWith<$Res> implements $ConstructorSeasonEntryDtoCopyWith<$Res> {
  factory _$ConstructorSeasonEntryDtoCopyWith(_ConstructorSeasonEntryDto value, $Res Function(_ConstructorSeasonEntryDto) _then) = __$ConstructorSeasonEntryDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, int season, String constructorId, String? fullName, String? shortName, String? colorPrimary, String? colorSecondary, String? powerUnit, String? teamPrincipal, String? base, String? chassis, List<String>? driverLineup
});




}
/// @nodoc
class __$ConstructorSeasonEntryDtoCopyWithImpl<$Res>
    implements _$ConstructorSeasonEntryDtoCopyWith<$Res> {
  __$ConstructorSeasonEntryDtoCopyWithImpl(this._self, this._then);

  final _ConstructorSeasonEntryDto _self;
  final $Res Function(_ConstructorSeasonEntryDto) _then;

/// Create a copy of ConstructorSeasonEntryDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? season = null,Object? constructorId = null,Object? fullName = freezed,Object? shortName = freezed,Object? colorPrimary = freezed,Object? colorSecondary = freezed,Object? powerUnit = freezed,Object? teamPrincipal = freezed,Object? base = freezed,Object? chassis = freezed,Object? driverLineup = freezed,}) {
  return _then(_ConstructorSeasonEntryDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,constructorId: null == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String,fullName: freezed == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String?,shortName: freezed == shortName ? _self.shortName : shortName // ignore: cast_nullable_to_non_nullable
as String?,colorPrimary: freezed == colorPrimary ? _self.colorPrimary : colorPrimary // ignore: cast_nullable_to_non_nullable
as String?,colorSecondary: freezed == colorSecondary ? _self.colorSecondary : colorSecondary // ignore: cast_nullable_to_non_nullable
as String?,powerUnit: freezed == powerUnit ? _self.powerUnit : powerUnit // ignore: cast_nullable_to_non_nullable
as String?,teamPrincipal: freezed == teamPrincipal ? _self.teamPrincipal : teamPrincipal // ignore: cast_nullable_to_non_nullable
as String?,base: freezed == base ? _self.base : base // ignore: cast_nullable_to_non_nullable
as String?,chassis: freezed == chassis ? _self.chassis : chassis // ignore: cast_nullable_to_non_nullable
as String?,driverLineup: freezed == driverLineup ? _self._driverLineup : driverLineup // ignore: cast_nullable_to_non_nullable
as List<String>?,
  ));
}


}

// dart format on
