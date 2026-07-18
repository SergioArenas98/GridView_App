// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'season_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SeasonDto {

 int get year; String? get label; String get status; String? get startDate; String? get endDate; int? get roundCount; int? get currentRound; bool get isCurrent;
/// Create a copy of SeasonDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SeasonDtoCopyWith<SeasonDto> get copyWith => _$SeasonDtoCopyWithImpl<SeasonDto>(this as SeasonDto, _$identity);

  /// Serializes this SeasonDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SeasonDto&&(identical(other.year, year) || other.year == year)&&(identical(other.label, label) || other.label == label)&&(identical(other.status, status) || other.status == status)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate)&&(identical(other.roundCount, roundCount) || other.roundCount == roundCount)&&(identical(other.currentRound, currentRound) || other.currentRound == currentRound)&&(identical(other.isCurrent, isCurrent) || other.isCurrent == isCurrent));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,year,label,status,startDate,endDate,roundCount,currentRound,isCurrent);

@override
String toString() {
  return 'SeasonDto(year: $year, label: $label, status: $status, startDate: $startDate, endDate: $endDate, roundCount: $roundCount, currentRound: $currentRound, isCurrent: $isCurrent)';
}


}

/// @nodoc
abstract mixin class $SeasonDtoCopyWith<$Res>  {
  factory $SeasonDtoCopyWith(SeasonDto value, $Res Function(SeasonDto) _then) = _$SeasonDtoCopyWithImpl;
@useResult
$Res call({
 int year, String? label, String status, String? startDate, String? endDate, int? roundCount, int? currentRound, bool isCurrent
});




}
/// @nodoc
class _$SeasonDtoCopyWithImpl<$Res>
    implements $SeasonDtoCopyWith<$Res> {
  _$SeasonDtoCopyWithImpl(this._self, this._then);

  final SeasonDto _self;
  final $Res Function(SeasonDto) _then;

/// Create a copy of SeasonDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? year = null,Object? label = freezed,Object? status = null,Object? startDate = freezed,Object? endDate = freezed,Object? roundCount = freezed,Object? currentRound = freezed,Object? isCurrent = null,}) {
  return _then(_self.copyWith(
year: null == year ? _self.year : year // ignore: cast_nullable_to_non_nullable
as int,label: freezed == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as String?,endDate: freezed == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as String?,roundCount: freezed == roundCount ? _self.roundCount : roundCount // ignore: cast_nullable_to_non_nullable
as int?,currentRound: freezed == currentRound ? _self.currentRound : currentRound // ignore: cast_nullable_to_non_nullable
as int?,isCurrent: null == isCurrent ? _self.isCurrent : isCurrent // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [SeasonDto].
extension SeasonDtoPatterns on SeasonDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SeasonDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SeasonDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SeasonDto value)  $default,){
final _that = this;
switch (_that) {
case _SeasonDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SeasonDto value)?  $default,){
final _that = this;
switch (_that) {
case _SeasonDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int year,  String? label,  String status,  String? startDate,  String? endDate,  int? roundCount,  int? currentRound,  bool isCurrent)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SeasonDto() when $default != null:
return $default(_that.year,_that.label,_that.status,_that.startDate,_that.endDate,_that.roundCount,_that.currentRound,_that.isCurrent);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int year,  String? label,  String status,  String? startDate,  String? endDate,  int? roundCount,  int? currentRound,  bool isCurrent)  $default,) {final _that = this;
switch (_that) {
case _SeasonDto():
return $default(_that.year,_that.label,_that.status,_that.startDate,_that.endDate,_that.roundCount,_that.currentRound,_that.isCurrent);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int year,  String? label,  String status,  String? startDate,  String? endDate,  int? roundCount,  int? currentRound,  bool isCurrent)?  $default,) {final _that = this;
switch (_that) {
case _SeasonDto() when $default != null:
return $default(_that.year,_that.label,_that.status,_that.startDate,_that.endDate,_that.roundCount,_that.currentRound,_that.isCurrent);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SeasonDto implements SeasonDto {
  const _SeasonDto({required this.year, this.label, required this.status, this.startDate, this.endDate, this.roundCount, this.currentRound, required this.isCurrent});
  factory _SeasonDto.fromJson(Map<String, dynamic> json) => _$SeasonDtoFromJson(json);

@override final  int year;
@override final  String? label;
@override final  String status;
@override final  String? startDate;
@override final  String? endDate;
@override final  int? roundCount;
@override final  int? currentRound;
@override final  bool isCurrent;

/// Create a copy of SeasonDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SeasonDtoCopyWith<_SeasonDto> get copyWith => __$SeasonDtoCopyWithImpl<_SeasonDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SeasonDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SeasonDto&&(identical(other.year, year) || other.year == year)&&(identical(other.label, label) || other.label == label)&&(identical(other.status, status) || other.status == status)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate)&&(identical(other.roundCount, roundCount) || other.roundCount == roundCount)&&(identical(other.currentRound, currentRound) || other.currentRound == currentRound)&&(identical(other.isCurrent, isCurrent) || other.isCurrent == isCurrent));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,year,label,status,startDate,endDate,roundCount,currentRound,isCurrent);

@override
String toString() {
  return 'SeasonDto(year: $year, label: $label, status: $status, startDate: $startDate, endDate: $endDate, roundCount: $roundCount, currentRound: $currentRound, isCurrent: $isCurrent)';
}


}

/// @nodoc
abstract mixin class _$SeasonDtoCopyWith<$Res> implements $SeasonDtoCopyWith<$Res> {
  factory _$SeasonDtoCopyWith(_SeasonDto value, $Res Function(_SeasonDto) _then) = __$SeasonDtoCopyWithImpl;
@override @useResult
$Res call({
 int year, String? label, String status, String? startDate, String? endDate, int? roundCount, int? currentRound, bool isCurrent
});




}
/// @nodoc
class __$SeasonDtoCopyWithImpl<$Res>
    implements _$SeasonDtoCopyWith<$Res> {
  __$SeasonDtoCopyWithImpl(this._self, this._then);

  final _SeasonDto _self;
  final $Res Function(_SeasonDto) _then;

/// Create a copy of SeasonDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? year = null,Object? label = freezed,Object? status = null,Object? startDate = freezed,Object? endDate = freezed,Object? roundCount = freezed,Object? currentRound = freezed,Object? isCurrent = null,}) {
  return _then(_SeasonDto(
year: null == year ? _self.year : year // ignore: cast_nullable_to_non_nullable
as int,label: freezed == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as String?,endDate: freezed == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as String?,roundCount: freezed == roundCount ? _self.roundCount : roundCount // ignore: cast_nullable_to_non_nullable
as int?,currentRound: freezed == currentRound ? _self.currentRound : currentRound // ignore: cast_nullable_to_non_nullable
as int?,isCurrent: null == isCurrent ? _self.isCurrent : isCurrent // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
