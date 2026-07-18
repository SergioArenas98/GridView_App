// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'result_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FastestLapDto {

 String? get driverId; int? get timeMillis; int? get lap;
/// Create a copy of FastestLapDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FastestLapDtoCopyWith<FastestLapDto> get copyWith => _$FastestLapDtoCopyWithImpl<FastestLapDto>(this as FastestLapDto, _$identity);

  /// Serializes this FastestLapDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FastestLapDto&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.timeMillis, timeMillis) || other.timeMillis == timeMillis)&&(identical(other.lap, lap) || other.lap == lap));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,driverId,timeMillis,lap);

@override
String toString() {
  return 'FastestLapDto(driverId: $driverId, timeMillis: $timeMillis, lap: $lap)';
}


}

/// @nodoc
abstract mixin class $FastestLapDtoCopyWith<$Res>  {
  factory $FastestLapDtoCopyWith(FastestLapDto value, $Res Function(FastestLapDto) _then) = _$FastestLapDtoCopyWithImpl;
@useResult
$Res call({
 String? driverId, int? timeMillis, int? lap
});




}
/// @nodoc
class _$FastestLapDtoCopyWithImpl<$Res>
    implements $FastestLapDtoCopyWith<$Res> {
  _$FastestLapDtoCopyWithImpl(this._self, this._then);

  final FastestLapDto _self;
  final $Res Function(FastestLapDto) _then;

/// Create a copy of FastestLapDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? driverId = freezed,Object? timeMillis = freezed,Object? lap = freezed,}) {
  return _then(_self.copyWith(
driverId: freezed == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String?,timeMillis: freezed == timeMillis ? _self.timeMillis : timeMillis // ignore: cast_nullable_to_non_nullable
as int?,lap: freezed == lap ? _self.lap : lap // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [FastestLapDto].
extension FastestLapDtoPatterns on FastestLapDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FastestLapDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FastestLapDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FastestLapDto value)  $default,){
final _that = this;
switch (_that) {
case _FastestLapDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FastestLapDto value)?  $default,){
final _that = this;
switch (_that) {
case _FastestLapDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? driverId,  int? timeMillis,  int? lap)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FastestLapDto() when $default != null:
return $default(_that.driverId,_that.timeMillis,_that.lap);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? driverId,  int? timeMillis,  int? lap)  $default,) {final _that = this;
switch (_that) {
case _FastestLapDto():
return $default(_that.driverId,_that.timeMillis,_that.lap);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? driverId,  int? timeMillis,  int? lap)?  $default,) {final _that = this;
switch (_that) {
case _FastestLapDto() when $default != null:
return $default(_that.driverId,_that.timeMillis,_that.lap);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FastestLapDto implements FastestLapDto {
  const _FastestLapDto({this.driverId, this.timeMillis, this.lap});
  factory _FastestLapDto.fromJson(Map<String, dynamic> json) => _$FastestLapDtoFromJson(json);

@override final  String? driverId;
@override final  int? timeMillis;
@override final  int? lap;

/// Create a copy of FastestLapDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FastestLapDtoCopyWith<_FastestLapDto> get copyWith => __$FastestLapDtoCopyWithImpl<_FastestLapDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FastestLapDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FastestLapDto&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.timeMillis, timeMillis) || other.timeMillis == timeMillis)&&(identical(other.lap, lap) || other.lap == lap));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,driverId,timeMillis,lap);

@override
String toString() {
  return 'FastestLapDto(driverId: $driverId, timeMillis: $timeMillis, lap: $lap)';
}


}

/// @nodoc
abstract mixin class _$FastestLapDtoCopyWith<$Res> implements $FastestLapDtoCopyWith<$Res> {
  factory _$FastestLapDtoCopyWith(_FastestLapDto value, $Res Function(_FastestLapDto) _then) = __$FastestLapDtoCopyWithImpl;
@override @useResult
$Res call({
 String? driverId, int? timeMillis, int? lap
});




}
/// @nodoc
class __$FastestLapDtoCopyWithImpl<$Res>
    implements _$FastestLapDtoCopyWith<$Res> {
  __$FastestLapDtoCopyWithImpl(this._self, this._then);

  final _FastestLapDto _self;
  final $Res Function(_FastestLapDto) _then;

/// Create a copy of FastestLapDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? driverId = freezed,Object? timeMillis = freezed,Object? lap = freezed,}) {
  return _then(_FastestLapDto(
driverId: freezed == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String?,timeMillis: freezed == timeMillis ? _self.timeMillis : timeMillis // ignore: cast_nullable_to_non_nullable
as int?,lap: freezed == lap ? _self.lap : lap // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$RaceResultEntryDto {

 String get driverId; String get constructorId; int? get position; int? get gridPosition; double? get points; String get status; int? get laps; int? get elapsedTimeMillis; int? get gapToLeaderMillis; int? get lapsBehind; bool? get fastestLap; String? get dnfReason; String? get gapText;
/// Create a copy of RaceResultEntryDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RaceResultEntryDtoCopyWith<RaceResultEntryDto> get copyWith => _$RaceResultEntryDtoCopyWithImpl<RaceResultEntryDto>(this as RaceResultEntryDto, _$identity);

  /// Serializes this RaceResultEntryDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RaceResultEntryDto&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.position, position) || other.position == position)&&(identical(other.gridPosition, gridPosition) || other.gridPosition == gridPosition)&&(identical(other.points, points) || other.points == points)&&(identical(other.status, status) || other.status == status)&&(identical(other.laps, laps) || other.laps == laps)&&(identical(other.elapsedTimeMillis, elapsedTimeMillis) || other.elapsedTimeMillis == elapsedTimeMillis)&&(identical(other.gapToLeaderMillis, gapToLeaderMillis) || other.gapToLeaderMillis == gapToLeaderMillis)&&(identical(other.lapsBehind, lapsBehind) || other.lapsBehind == lapsBehind)&&(identical(other.fastestLap, fastestLap) || other.fastestLap == fastestLap)&&(identical(other.dnfReason, dnfReason) || other.dnfReason == dnfReason)&&(identical(other.gapText, gapText) || other.gapText == gapText));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,driverId,constructorId,position,gridPosition,points,status,laps,elapsedTimeMillis,gapToLeaderMillis,lapsBehind,fastestLap,dnfReason,gapText);

@override
String toString() {
  return 'RaceResultEntryDto(driverId: $driverId, constructorId: $constructorId, position: $position, gridPosition: $gridPosition, points: $points, status: $status, laps: $laps, elapsedTimeMillis: $elapsedTimeMillis, gapToLeaderMillis: $gapToLeaderMillis, lapsBehind: $lapsBehind, fastestLap: $fastestLap, dnfReason: $dnfReason, gapText: $gapText)';
}


}

/// @nodoc
abstract mixin class $RaceResultEntryDtoCopyWith<$Res>  {
  factory $RaceResultEntryDtoCopyWith(RaceResultEntryDto value, $Res Function(RaceResultEntryDto) _then) = _$RaceResultEntryDtoCopyWithImpl;
@useResult
$Res call({
 String driverId, String constructorId, int? position, int? gridPosition, double? points, String status, int? laps, int? elapsedTimeMillis, int? gapToLeaderMillis, int? lapsBehind, bool? fastestLap, String? dnfReason, String? gapText
});




}
/// @nodoc
class _$RaceResultEntryDtoCopyWithImpl<$Res>
    implements $RaceResultEntryDtoCopyWith<$Res> {
  _$RaceResultEntryDtoCopyWithImpl(this._self, this._then);

  final RaceResultEntryDto _self;
  final $Res Function(RaceResultEntryDto) _then;

/// Create a copy of RaceResultEntryDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? driverId = null,Object? constructorId = null,Object? position = freezed,Object? gridPosition = freezed,Object? points = freezed,Object? status = null,Object? laps = freezed,Object? elapsedTimeMillis = freezed,Object? gapToLeaderMillis = freezed,Object? lapsBehind = freezed,Object? fastestLap = freezed,Object? dnfReason = freezed,Object? gapText = freezed,}) {
  return _then(_self.copyWith(
driverId: null == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String,constructorId: null == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String,position: freezed == position ? _self.position : position // ignore: cast_nullable_to_non_nullable
as int?,gridPosition: freezed == gridPosition ? _self.gridPosition : gridPosition // ignore: cast_nullable_to_non_nullable
as int?,points: freezed == points ? _self.points : points // ignore: cast_nullable_to_non_nullable
as double?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,laps: freezed == laps ? _self.laps : laps // ignore: cast_nullable_to_non_nullable
as int?,elapsedTimeMillis: freezed == elapsedTimeMillis ? _self.elapsedTimeMillis : elapsedTimeMillis // ignore: cast_nullable_to_non_nullable
as int?,gapToLeaderMillis: freezed == gapToLeaderMillis ? _self.gapToLeaderMillis : gapToLeaderMillis // ignore: cast_nullable_to_non_nullable
as int?,lapsBehind: freezed == lapsBehind ? _self.lapsBehind : lapsBehind // ignore: cast_nullable_to_non_nullable
as int?,fastestLap: freezed == fastestLap ? _self.fastestLap : fastestLap // ignore: cast_nullable_to_non_nullable
as bool?,dnfReason: freezed == dnfReason ? _self.dnfReason : dnfReason // ignore: cast_nullable_to_non_nullable
as String?,gapText: freezed == gapText ? _self.gapText : gapText // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [RaceResultEntryDto].
extension RaceResultEntryDtoPatterns on RaceResultEntryDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RaceResultEntryDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RaceResultEntryDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RaceResultEntryDto value)  $default,){
final _that = this;
switch (_that) {
case _RaceResultEntryDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RaceResultEntryDto value)?  $default,){
final _that = this;
switch (_that) {
case _RaceResultEntryDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String driverId,  String constructorId,  int? position,  int? gridPosition,  double? points,  String status,  int? laps,  int? elapsedTimeMillis,  int? gapToLeaderMillis,  int? lapsBehind,  bool? fastestLap,  String? dnfReason,  String? gapText)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RaceResultEntryDto() when $default != null:
return $default(_that.driverId,_that.constructorId,_that.position,_that.gridPosition,_that.points,_that.status,_that.laps,_that.elapsedTimeMillis,_that.gapToLeaderMillis,_that.lapsBehind,_that.fastestLap,_that.dnfReason,_that.gapText);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String driverId,  String constructorId,  int? position,  int? gridPosition,  double? points,  String status,  int? laps,  int? elapsedTimeMillis,  int? gapToLeaderMillis,  int? lapsBehind,  bool? fastestLap,  String? dnfReason,  String? gapText)  $default,) {final _that = this;
switch (_that) {
case _RaceResultEntryDto():
return $default(_that.driverId,_that.constructorId,_that.position,_that.gridPosition,_that.points,_that.status,_that.laps,_that.elapsedTimeMillis,_that.gapToLeaderMillis,_that.lapsBehind,_that.fastestLap,_that.dnfReason,_that.gapText);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String driverId,  String constructorId,  int? position,  int? gridPosition,  double? points,  String status,  int? laps,  int? elapsedTimeMillis,  int? gapToLeaderMillis,  int? lapsBehind,  bool? fastestLap,  String? dnfReason,  String? gapText)?  $default,) {final _that = this;
switch (_that) {
case _RaceResultEntryDto() when $default != null:
return $default(_that.driverId,_that.constructorId,_that.position,_that.gridPosition,_that.points,_that.status,_that.laps,_that.elapsedTimeMillis,_that.gapToLeaderMillis,_that.lapsBehind,_that.fastestLap,_that.dnfReason,_that.gapText);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RaceResultEntryDto implements RaceResultEntryDto {
  const _RaceResultEntryDto({required this.driverId, required this.constructorId, this.position, this.gridPosition, this.points, required this.status, this.laps, this.elapsedTimeMillis, this.gapToLeaderMillis, this.lapsBehind, this.fastestLap, this.dnfReason, this.gapText});
  factory _RaceResultEntryDto.fromJson(Map<String, dynamic> json) => _$RaceResultEntryDtoFromJson(json);

@override final  String driverId;
@override final  String constructorId;
@override final  int? position;
@override final  int? gridPosition;
@override final  double? points;
@override final  String status;
@override final  int? laps;
@override final  int? elapsedTimeMillis;
@override final  int? gapToLeaderMillis;
@override final  int? lapsBehind;
@override final  bool? fastestLap;
@override final  String? dnfReason;
@override final  String? gapText;

/// Create a copy of RaceResultEntryDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RaceResultEntryDtoCopyWith<_RaceResultEntryDto> get copyWith => __$RaceResultEntryDtoCopyWithImpl<_RaceResultEntryDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RaceResultEntryDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RaceResultEntryDto&&(identical(other.driverId, driverId) || other.driverId == driverId)&&(identical(other.constructorId, constructorId) || other.constructorId == constructorId)&&(identical(other.position, position) || other.position == position)&&(identical(other.gridPosition, gridPosition) || other.gridPosition == gridPosition)&&(identical(other.points, points) || other.points == points)&&(identical(other.status, status) || other.status == status)&&(identical(other.laps, laps) || other.laps == laps)&&(identical(other.elapsedTimeMillis, elapsedTimeMillis) || other.elapsedTimeMillis == elapsedTimeMillis)&&(identical(other.gapToLeaderMillis, gapToLeaderMillis) || other.gapToLeaderMillis == gapToLeaderMillis)&&(identical(other.lapsBehind, lapsBehind) || other.lapsBehind == lapsBehind)&&(identical(other.fastestLap, fastestLap) || other.fastestLap == fastestLap)&&(identical(other.dnfReason, dnfReason) || other.dnfReason == dnfReason)&&(identical(other.gapText, gapText) || other.gapText == gapText));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,driverId,constructorId,position,gridPosition,points,status,laps,elapsedTimeMillis,gapToLeaderMillis,lapsBehind,fastestLap,dnfReason,gapText);

@override
String toString() {
  return 'RaceResultEntryDto(driverId: $driverId, constructorId: $constructorId, position: $position, gridPosition: $gridPosition, points: $points, status: $status, laps: $laps, elapsedTimeMillis: $elapsedTimeMillis, gapToLeaderMillis: $gapToLeaderMillis, lapsBehind: $lapsBehind, fastestLap: $fastestLap, dnfReason: $dnfReason, gapText: $gapText)';
}


}

/// @nodoc
abstract mixin class _$RaceResultEntryDtoCopyWith<$Res> implements $RaceResultEntryDtoCopyWith<$Res> {
  factory _$RaceResultEntryDtoCopyWith(_RaceResultEntryDto value, $Res Function(_RaceResultEntryDto) _then) = __$RaceResultEntryDtoCopyWithImpl;
@override @useResult
$Res call({
 String driverId, String constructorId, int? position, int? gridPosition, double? points, String status, int? laps, int? elapsedTimeMillis, int? gapToLeaderMillis, int? lapsBehind, bool? fastestLap, String? dnfReason, String? gapText
});




}
/// @nodoc
class __$RaceResultEntryDtoCopyWithImpl<$Res>
    implements _$RaceResultEntryDtoCopyWith<$Res> {
  __$RaceResultEntryDtoCopyWithImpl(this._self, this._then);

  final _RaceResultEntryDto _self;
  final $Res Function(_RaceResultEntryDto) _then;

/// Create a copy of RaceResultEntryDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? driverId = null,Object? constructorId = null,Object? position = freezed,Object? gridPosition = freezed,Object? points = freezed,Object? status = null,Object? laps = freezed,Object? elapsedTimeMillis = freezed,Object? gapToLeaderMillis = freezed,Object? lapsBehind = freezed,Object? fastestLap = freezed,Object? dnfReason = freezed,Object? gapText = freezed,}) {
  return _then(_RaceResultEntryDto(
driverId: null == driverId ? _self.driverId : driverId // ignore: cast_nullable_to_non_nullable
as String,constructorId: null == constructorId ? _self.constructorId : constructorId // ignore: cast_nullable_to_non_nullable
as String,position: freezed == position ? _self.position : position // ignore: cast_nullable_to_non_nullable
as int?,gridPosition: freezed == gridPosition ? _self.gridPosition : gridPosition // ignore: cast_nullable_to_non_nullable
as int?,points: freezed == points ? _self.points : points // ignore: cast_nullable_to_non_nullable
as double?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,laps: freezed == laps ? _self.laps : laps // ignore: cast_nullable_to_non_nullable
as int?,elapsedTimeMillis: freezed == elapsedTimeMillis ? _self.elapsedTimeMillis : elapsedTimeMillis // ignore: cast_nullable_to_non_nullable
as int?,gapToLeaderMillis: freezed == gapToLeaderMillis ? _self.gapToLeaderMillis : gapToLeaderMillis // ignore: cast_nullable_to_non_nullable
as int?,lapsBehind: freezed == lapsBehind ? _self.lapsBehind : lapsBehind // ignore: cast_nullable_to_non_nullable
as int?,fastestLap: freezed == fastestLap ? _self.fastestLap : fastestLap // ignore: cast_nullable_to_non_nullable
as bool?,dnfReason: freezed == dnfReason ? _self.dnfReason : dnfReason // ignore: cast_nullable_to_non_nullable
as String?,gapText: freezed == gapText ? _self.gapText : gapText // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$RaceResultDto {

 String get id; int get season; int get round; String get grandPrixId; String get sessionType; String get status; List<RaceResultEntryDto> get entries; FastestLapDto? get fastestLap;
/// Create a copy of RaceResultDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RaceResultDtoCopyWith<RaceResultDto> get copyWith => _$RaceResultDtoCopyWithImpl<RaceResultDto>(this as RaceResultDto, _$identity);

  /// Serializes this RaceResultDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RaceResultDto&&(identical(other.id, id) || other.id == id)&&(identical(other.season, season) || other.season == season)&&(identical(other.round, round) || other.round == round)&&(identical(other.grandPrixId, grandPrixId) || other.grandPrixId == grandPrixId)&&(identical(other.sessionType, sessionType) || other.sessionType == sessionType)&&(identical(other.status, status) || other.status == status)&&const DeepCollectionEquality().equals(other.entries, entries)&&(identical(other.fastestLap, fastestLap) || other.fastestLap == fastestLap));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,season,round,grandPrixId,sessionType,status,const DeepCollectionEquality().hash(entries),fastestLap);

@override
String toString() {
  return 'RaceResultDto(id: $id, season: $season, round: $round, grandPrixId: $grandPrixId, sessionType: $sessionType, status: $status, entries: $entries, fastestLap: $fastestLap)';
}


}

/// @nodoc
abstract mixin class $RaceResultDtoCopyWith<$Res>  {
  factory $RaceResultDtoCopyWith(RaceResultDto value, $Res Function(RaceResultDto) _then) = _$RaceResultDtoCopyWithImpl;
@useResult
$Res call({
 String id, int season, int round, String grandPrixId, String sessionType, String status, List<RaceResultEntryDto> entries, FastestLapDto? fastestLap
});


$FastestLapDtoCopyWith<$Res>? get fastestLap;

}
/// @nodoc
class _$RaceResultDtoCopyWithImpl<$Res>
    implements $RaceResultDtoCopyWith<$Res> {
  _$RaceResultDtoCopyWithImpl(this._self, this._then);

  final RaceResultDto _self;
  final $Res Function(RaceResultDto) _then;

/// Create a copy of RaceResultDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? season = null,Object? round = null,Object? grandPrixId = null,Object? sessionType = null,Object? status = null,Object? entries = null,Object? fastestLap = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,round: null == round ? _self.round : round // ignore: cast_nullable_to_non_nullable
as int,grandPrixId: null == grandPrixId ? _self.grandPrixId : grandPrixId // ignore: cast_nullable_to_non_nullable
as String,sessionType: null == sessionType ? _self.sessionType : sessionType // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,entries: null == entries ? _self.entries : entries // ignore: cast_nullable_to_non_nullable
as List<RaceResultEntryDto>,fastestLap: freezed == fastestLap ? _self.fastestLap : fastestLap // ignore: cast_nullable_to_non_nullable
as FastestLapDto?,
  ));
}
/// Create a copy of RaceResultDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FastestLapDtoCopyWith<$Res>? get fastestLap {
    if (_self.fastestLap == null) {
    return null;
  }

  return $FastestLapDtoCopyWith<$Res>(_self.fastestLap!, (value) {
    return _then(_self.copyWith(fastestLap: value));
  });
}
}


/// Adds pattern-matching-related methods to [RaceResultDto].
extension RaceResultDtoPatterns on RaceResultDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RaceResultDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RaceResultDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RaceResultDto value)  $default,){
final _that = this;
switch (_that) {
case _RaceResultDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RaceResultDto value)?  $default,){
final _that = this;
switch (_that) {
case _RaceResultDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  int season,  int round,  String grandPrixId,  String sessionType,  String status,  List<RaceResultEntryDto> entries,  FastestLapDto? fastestLap)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RaceResultDto() when $default != null:
return $default(_that.id,_that.season,_that.round,_that.grandPrixId,_that.sessionType,_that.status,_that.entries,_that.fastestLap);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  int season,  int round,  String grandPrixId,  String sessionType,  String status,  List<RaceResultEntryDto> entries,  FastestLapDto? fastestLap)  $default,) {final _that = this;
switch (_that) {
case _RaceResultDto():
return $default(_that.id,_that.season,_that.round,_that.grandPrixId,_that.sessionType,_that.status,_that.entries,_that.fastestLap);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  int season,  int round,  String grandPrixId,  String sessionType,  String status,  List<RaceResultEntryDto> entries,  FastestLapDto? fastestLap)?  $default,) {final _that = this;
switch (_that) {
case _RaceResultDto() when $default != null:
return $default(_that.id,_that.season,_that.round,_that.grandPrixId,_that.sessionType,_that.status,_that.entries,_that.fastestLap);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RaceResultDto implements RaceResultDto {
  const _RaceResultDto({required this.id, required this.season, required this.round, required this.grandPrixId, required this.sessionType, required this.status, required final  List<RaceResultEntryDto> entries, this.fastestLap}): _entries = entries;
  factory _RaceResultDto.fromJson(Map<String, dynamic> json) => _$RaceResultDtoFromJson(json);

@override final  String id;
@override final  int season;
@override final  int round;
@override final  String grandPrixId;
@override final  String sessionType;
@override final  String status;
 final  List<RaceResultEntryDto> _entries;
@override List<RaceResultEntryDto> get entries {
  if (_entries is EqualUnmodifiableListView) return _entries;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_entries);
}

@override final  FastestLapDto? fastestLap;

/// Create a copy of RaceResultDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RaceResultDtoCopyWith<_RaceResultDto> get copyWith => __$RaceResultDtoCopyWithImpl<_RaceResultDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RaceResultDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RaceResultDto&&(identical(other.id, id) || other.id == id)&&(identical(other.season, season) || other.season == season)&&(identical(other.round, round) || other.round == round)&&(identical(other.grandPrixId, grandPrixId) || other.grandPrixId == grandPrixId)&&(identical(other.sessionType, sessionType) || other.sessionType == sessionType)&&(identical(other.status, status) || other.status == status)&&const DeepCollectionEquality().equals(other._entries, _entries)&&(identical(other.fastestLap, fastestLap) || other.fastestLap == fastestLap));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,season,round,grandPrixId,sessionType,status,const DeepCollectionEquality().hash(_entries),fastestLap);

@override
String toString() {
  return 'RaceResultDto(id: $id, season: $season, round: $round, grandPrixId: $grandPrixId, sessionType: $sessionType, status: $status, entries: $entries, fastestLap: $fastestLap)';
}


}

/// @nodoc
abstract mixin class _$RaceResultDtoCopyWith<$Res> implements $RaceResultDtoCopyWith<$Res> {
  factory _$RaceResultDtoCopyWith(_RaceResultDto value, $Res Function(_RaceResultDto) _then) = __$RaceResultDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, int season, int round, String grandPrixId, String sessionType, String status, List<RaceResultEntryDto> entries, FastestLapDto? fastestLap
});


@override $FastestLapDtoCopyWith<$Res>? get fastestLap;

}
/// @nodoc
class __$RaceResultDtoCopyWithImpl<$Res>
    implements _$RaceResultDtoCopyWith<$Res> {
  __$RaceResultDtoCopyWithImpl(this._self, this._then);

  final _RaceResultDto _self;
  final $Res Function(_RaceResultDto) _then;

/// Create a copy of RaceResultDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? season = null,Object? round = null,Object? grandPrixId = null,Object? sessionType = null,Object? status = null,Object? entries = null,Object? fastestLap = freezed,}) {
  return _then(_RaceResultDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,round: null == round ? _self.round : round // ignore: cast_nullable_to_non_nullable
as int,grandPrixId: null == grandPrixId ? _self.grandPrixId : grandPrixId // ignore: cast_nullable_to_non_nullable
as String,sessionType: null == sessionType ? _self.sessionType : sessionType // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,entries: null == entries ? _self._entries : entries // ignore: cast_nullable_to_non_nullable
as List<RaceResultEntryDto>,fastestLap: freezed == fastestLap ? _self.fastestLap : fastestLap // ignore: cast_nullable_to_non_nullable
as FastestLapDto?,
  ));
}

/// Create a copy of RaceResultDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FastestLapDtoCopyWith<$Res>? get fastestLap {
    if (_self.fastestLap == null) {
    return null;
  }

  return $FastestLapDtoCopyWith<$Res>(_self.fastestLap!, (value) {
    return _then(_self.copyWith(fastestLap: value));
  });
}
}

// dart format on
