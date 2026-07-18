// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'detail_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$DriverDetailDto {

 DriverDto get driver; DriverSeasonEntryDto? get seasonEntry; ConstructorSummaryDto? get constructor; DriverStandingDto? get standing;
/// Create a copy of DriverDetailDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DriverDetailDtoCopyWith<DriverDetailDto> get copyWith => _$DriverDetailDtoCopyWithImpl<DriverDetailDto>(this as DriverDetailDto, _$identity);

  /// Serializes this DriverDetailDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DriverDetailDto&&(identical(other.driver, driver) || other.driver == driver)&&(identical(other.seasonEntry, seasonEntry) || other.seasonEntry == seasonEntry)&&(identical(other.constructor, constructor) || other.constructor == constructor)&&(identical(other.standing, standing) || other.standing == standing));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,driver,seasonEntry,constructor,standing);

@override
String toString() {
  return 'DriverDetailDto(driver: $driver, seasonEntry: $seasonEntry, constructor: $constructor, standing: $standing)';
}


}

/// @nodoc
abstract mixin class $DriverDetailDtoCopyWith<$Res>  {
  factory $DriverDetailDtoCopyWith(DriverDetailDto value, $Res Function(DriverDetailDto) _then) = _$DriverDetailDtoCopyWithImpl;
@useResult
$Res call({
 DriverDto driver, DriverSeasonEntryDto? seasonEntry, ConstructorSummaryDto? constructor, DriverStandingDto? standing
});


$DriverDtoCopyWith<$Res> get driver;$DriverSeasonEntryDtoCopyWith<$Res>? get seasonEntry;$ConstructorSummaryDtoCopyWith<$Res>? get constructor;$DriverStandingDtoCopyWith<$Res>? get standing;

}
/// @nodoc
class _$DriverDetailDtoCopyWithImpl<$Res>
    implements $DriverDetailDtoCopyWith<$Res> {
  _$DriverDetailDtoCopyWithImpl(this._self, this._then);

  final DriverDetailDto _self;
  final $Res Function(DriverDetailDto) _then;

/// Create a copy of DriverDetailDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? driver = null,Object? seasonEntry = freezed,Object? constructor = freezed,Object? standing = freezed,}) {
  return _then(_self.copyWith(
driver: null == driver ? _self.driver : driver // ignore: cast_nullable_to_non_nullable
as DriverDto,seasonEntry: freezed == seasonEntry ? _self.seasonEntry : seasonEntry // ignore: cast_nullable_to_non_nullable
as DriverSeasonEntryDto?,constructor: freezed == constructor ? _self.constructor : constructor // ignore: cast_nullable_to_non_nullable
as ConstructorSummaryDto?,standing: freezed == standing ? _self.standing : standing // ignore: cast_nullable_to_non_nullable
as DriverStandingDto?,
  ));
}
/// Create a copy of DriverDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DriverDtoCopyWith<$Res> get driver {
  
  return $DriverDtoCopyWith<$Res>(_self.driver, (value) {
    return _then(_self.copyWith(driver: value));
  });
}/// Create a copy of DriverDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DriverSeasonEntryDtoCopyWith<$Res>? get seasonEntry {
    if (_self.seasonEntry == null) {
    return null;
  }

  return $DriverSeasonEntryDtoCopyWith<$Res>(_self.seasonEntry!, (value) {
    return _then(_self.copyWith(seasonEntry: value));
  });
}/// Create a copy of DriverDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConstructorSummaryDtoCopyWith<$Res>? get constructor {
    if (_self.constructor == null) {
    return null;
  }

  return $ConstructorSummaryDtoCopyWith<$Res>(_self.constructor!, (value) {
    return _then(_self.copyWith(constructor: value));
  });
}/// Create a copy of DriverDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DriverStandingDtoCopyWith<$Res>? get standing {
    if (_self.standing == null) {
    return null;
  }

  return $DriverStandingDtoCopyWith<$Res>(_self.standing!, (value) {
    return _then(_self.copyWith(standing: value));
  });
}
}


/// Adds pattern-matching-related methods to [DriverDetailDto].
extension DriverDetailDtoPatterns on DriverDetailDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DriverDetailDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DriverDetailDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DriverDetailDto value)  $default,){
final _that = this;
switch (_that) {
case _DriverDetailDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DriverDetailDto value)?  $default,){
final _that = this;
switch (_that) {
case _DriverDetailDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( DriverDto driver,  DriverSeasonEntryDto? seasonEntry,  ConstructorSummaryDto? constructor,  DriverStandingDto? standing)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DriverDetailDto() when $default != null:
return $default(_that.driver,_that.seasonEntry,_that.constructor,_that.standing);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( DriverDto driver,  DriverSeasonEntryDto? seasonEntry,  ConstructorSummaryDto? constructor,  DriverStandingDto? standing)  $default,) {final _that = this;
switch (_that) {
case _DriverDetailDto():
return $default(_that.driver,_that.seasonEntry,_that.constructor,_that.standing);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( DriverDto driver,  DriverSeasonEntryDto? seasonEntry,  ConstructorSummaryDto? constructor,  DriverStandingDto? standing)?  $default,) {final _that = this;
switch (_that) {
case _DriverDetailDto() when $default != null:
return $default(_that.driver,_that.seasonEntry,_that.constructor,_that.standing);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DriverDetailDto implements DriverDetailDto {
  const _DriverDetailDto({required this.driver, this.seasonEntry, this.constructor, this.standing});
  factory _DriverDetailDto.fromJson(Map<String, dynamic> json) => _$DriverDetailDtoFromJson(json);

@override final  DriverDto driver;
@override final  DriverSeasonEntryDto? seasonEntry;
@override final  ConstructorSummaryDto? constructor;
@override final  DriverStandingDto? standing;

/// Create a copy of DriverDetailDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DriverDetailDtoCopyWith<_DriverDetailDto> get copyWith => __$DriverDetailDtoCopyWithImpl<_DriverDetailDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DriverDetailDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DriverDetailDto&&(identical(other.driver, driver) || other.driver == driver)&&(identical(other.seasonEntry, seasonEntry) || other.seasonEntry == seasonEntry)&&(identical(other.constructor, constructor) || other.constructor == constructor)&&(identical(other.standing, standing) || other.standing == standing));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,driver,seasonEntry,constructor,standing);

@override
String toString() {
  return 'DriverDetailDto(driver: $driver, seasonEntry: $seasonEntry, constructor: $constructor, standing: $standing)';
}


}

/// @nodoc
abstract mixin class _$DriverDetailDtoCopyWith<$Res> implements $DriverDetailDtoCopyWith<$Res> {
  factory _$DriverDetailDtoCopyWith(_DriverDetailDto value, $Res Function(_DriverDetailDto) _then) = __$DriverDetailDtoCopyWithImpl;
@override @useResult
$Res call({
 DriverDto driver, DriverSeasonEntryDto? seasonEntry, ConstructorSummaryDto? constructor, DriverStandingDto? standing
});


@override $DriverDtoCopyWith<$Res> get driver;@override $DriverSeasonEntryDtoCopyWith<$Res>? get seasonEntry;@override $ConstructorSummaryDtoCopyWith<$Res>? get constructor;@override $DriverStandingDtoCopyWith<$Res>? get standing;

}
/// @nodoc
class __$DriverDetailDtoCopyWithImpl<$Res>
    implements _$DriverDetailDtoCopyWith<$Res> {
  __$DriverDetailDtoCopyWithImpl(this._self, this._then);

  final _DriverDetailDto _self;
  final $Res Function(_DriverDetailDto) _then;

/// Create a copy of DriverDetailDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? driver = null,Object? seasonEntry = freezed,Object? constructor = freezed,Object? standing = freezed,}) {
  return _then(_DriverDetailDto(
driver: null == driver ? _self.driver : driver // ignore: cast_nullable_to_non_nullable
as DriverDto,seasonEntry: freezed == seasonEntry ? _self.seasonEntry : seasonEntry // ignore: cast_nullable_to_non_nullable
as DriverSeasonEntryDto?,constructor: freezed == constructor ? _self.constructor : constructor // ignore: cast_nullable_to_non_nullable
as ConstructorSummaryDto?,standing: freezed == standing ? _self.standing : standing // ignore: cast_nullable_to_non_nullable
as DriverStandingDto?,
  ));
}

/// Create a copy of DriverDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DriverDtoCopyWith<$Res> get driver {
  
  return $DriverDtoCopyWith<$Res>(_self.driver, (value) {
    return _then(_self.copyWith(driver: value));
  });
}/// Create a copy of DriverDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DriverSeasonEntryDtoCopyWith<$Res>? get seasonEntry {
    if (_self.seasonEntry == null) {
    return null;
  }

  return $DriverSeasonEntryDtoCopyWith<$Res>(_self.seasonEntry!, (value) {
    return _then(_self.copyWith(seasonEntry: value));
  });
}/// Create a copy of DriverDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConstructorSummaryDtoCopyWith<$Res>? get constructor {
    if (_self.constructor == null) {
    return null;
  }

  return $ConstructorSummaryDtoCopyWith<$Res>(_self.constructor!, (value) {
    return _then(_self.copyWith(constructor: value));
  });
}/// Create a copy of DriverDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DriverStandingDtoCopyWith<$Res>? get standing {
    if (_self.standing == null) {
    return null;
  }

  return $DriverStandingDtoCopyWith<$Res>(_self.standing!, (value) {
    return _then(_self.copyWith(standing: value));
  });
}
}


/// @nodoc
mixin _$ConstructorDetailDto {

 ConstructorDto get constructor; ConstructorSeasonEntryDto? get seasonEntry; ConstructorStandingDto? get standing; List<DriverSummaryDto>? get lineup;
/// Create a copy of ConstructorDetailDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ConstructorDetailDtoCopyWith<ConstructorDetailDto> get copyWith => _$ConstructorDetailDtoCopyWithImpl<ConstructorDetailDto>(this as ConstructorDetailDto, _$identity);

  /// Serializes this ConstructorDetailDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ConstructorDetailDto&&(identical(other.constructor, constructor) || other.constructor == constructor)&&(identical(other.seasonEntry, seasonEntry) || other.seasonEntry == seasonEntry)&&(identical(other.standing, standing) || other.standing == standing)&&const DeepCollectionEquality().equals(other.lineup, lineup));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,constructor,seasonEntry,standing,const DeepCollectionEquality().hash(lineup));

@override
String toString() {
  return 'ConstructorDetailDto(constructor: $constructor, seasonEntry: $seasonEntry, standing: $standing, lineup: $lineup)';
}


}

/// @nodoc
abstract mixin class $ConstructorDetailDtoCopyWith<$Res>  {
  factory $ConstructorDetailDtoCopyWith(ConstructorDetailDto value, $Res Function(ConstructorDetailDto) _then) = _$ConstructorDetailDtoCopyWithImpl;
@useResult
$Res call({
 ConstructorDto constructor, ConstructorSeasonEntryDto? seasonEntry, ConstructorStandingDto? standing, List<DriverSummaryDto>? lineup
});


$ConstructorDtoCopyWith<$Res> get constructor;$ConstructorSeasonEntryDtoCopyWith<$Res>? get seasonEntry;$ConstructorStandingDtoCopyWith<$Res>? get standing;

}
/// @nodoc
class _$ConstructorDetailDtoCopyWithImpl<$Res>
    implements $ConstructorDetailDtoCopyWith<$Res> {
  _$ConstructorDetailDtoCopyWithImpl(this._self, this._then);

  final ConstructorDetailDto _self;
  final $Res Function(ConstructorDetailDto) _then;

/// Create a copy of ConstructorDetailDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? constructor = null,Object? seasonEntry = freezed,Object? standing = freezed,Object? lineup = freezed,}) {
  return _then(_self.copyWith(
constructor: null == constructor ? _self.constructor : constructor // ignore: cast_nullable_to_non_nullable
as ConstructorDto,seasonEntry: freezed == seasonEntry ? _self.seasonEntry : seasonEntry // ignore: cast_nullable_to_non_nullable
as ConstructorSeasonEntryDto?,standing: freezed == standing ? _self.standing : standing // ignore: cast_nullable_to_non_nullable
as ConstructorStandingDto?,lineup: freezed == lineup ? _self.lineup : lineup // ignore: cast_nullable_to_non_nullable
as List<DriverSummaryDto>?,
  ));
}
/// Create a copy of ConstructorDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConstructorDtoCopyWith<$Res> get constructor {
  
  return $ConstructorDtoCopyWith<$Res>(_self.constructor, (value) {
    return _then(_self.copyWith(constructor: value));
  });
}/// Create a copy of ConstructorDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConstructorSeasonEntryDtoCopyWith<$Res>? get seasonEntry {
    if (_self.seasonEntry == null) {
    return null;
  }

  return $ConstructorSeasonEntryDtoCopyWith<$Res>(_self.seasonEntry!, (value) {
    return _then(_self.copyWith(seasonEntry: value));
  });
}/// Create a copy of ConstructorDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConstructorStandingDtoCopyWith<$Res>? get standing {
    if (_self.standing == null) {
    return null;
  }

  return $ConstructorStandingDtoCopyWith<$Res>(_self.standing!, (value) {
    return _then(_self.copyWith(standing: value));
  });
}
}


/// Adds pattern-matching-related methods to [ConstructorDetailDto].
extension ConstructorDetailDtoPatterns on ConstructorDetailDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ConstructorDetailDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ConstructorDetailDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ConstructorDetailDto value)  $default,){
final _that = this;
switch (_that) {
case _ConstructorDetailDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ConstructorDetailDto value)?  $default,){
final _that = this;
switch (_that) {
case _ConstructorDetailDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ConstructorDto constructor,  ConstructorSeasonEntryDto? seasonEntry,  ConstructorStandingDto? standing,  List<DriverSummaryDto>? lineup)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ConstructorDetailDto() when $default != null:
return $default(_that.constructor,_that.seasonEntry,_that.standing,_that.lineup);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ConstructorDto constructor,  ConstructorSeasonEntryDto? seasonEntry,  ConstructorStandingDto? standing,  List<DriverSummaryDto>? lineup)  $default,) {final _that = this;
switch (_that) {
case _ConstructorDetailDto():
return $default(_that.constructor,_that.seasonEntry,_that.standing,_that.lineup);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ConstructorDto constructor,  ConstructorSeasonEntryDto? seasonEntry,  ConstructorStandingDto? standing,  List<DriverSummaryDto>? lineup)?  $default,) {final _that = this;
switch (_that) {
case _ConstructorDetailDto() when $default != null:
return $default(_that.constructor,_that.seasonEntry,_that.standing,_that.lineup);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ConstructorDetailDto implements ConstructorDetailDto {
  const _ConstructorDetailDto({required this.constructor, this.seasonEntry, this.standing, final  List<DriverSummaryDto>? lineup}): _lineup = lineup;
  factory _ConstructorDetailDto.fromJson(Map<String, dynamic> json) => _$ConstructorDetailDtoFromJson(json);

@override final  ConstructorDto constructor;
@override final  ConstructorSeasonEntryDto? seasonEntry;
@override final  ConstructorStandingDto? standing;
 final  List<DriverSummaryDto>? _lineup;
@override List<DriverSummaryDto>? get lineup {
  final value = _lineup;
  if (value == null) return null;
  if (_lineup is EqualUnmodifiableListView) return _lineup;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of ConstructorDetailDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ConstructorDetailDtoCopyWith<_ConstructorDetailDto> get copyWith => __$ConstructorDetailDtoCopyWithImpl<_ConstructorDetailDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ConstructorDetailDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ConstructorDetailDto&&(identical(other.constructor, constructor) || other.constructor == constructor)&&(identical(other.seasonEntry, seasonEntry) || other.seasonEntry == seasonEntry)&&(identical(other.standing, standing) || other.standing == standing)&&const DeepCollectionEquality().equals(other._lineup, _lineup));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,constructor,seasonEntry,standing,const DeepCollectionEquality().hash(_lineup));

@override
String toString() {
  return 'ConstructorDetailDto(constructor: $constructor, seasonEntry: $seasonEntry, standing: $standing, lineup: $lineup)';
}


}

/// @nodoc
abstract mixin class _$ConstructorDetailDtoCopyWith<$Res> implements $ConstructorDetailDtoCopyWith<$Res> {
  factory _$ConstructorDetailDtoCopyWith(_ConstructorDetailDto value, $Res Function(_ConstructorDetailDto) _then) = __$ConstructorDetailDtoCopyWithImpl;
@override @useResult
$Res call({
 ConstructorDto constructor, ConstructorSeasonEntryDto? seasonEntry, ConstructorStandingDto? standing, List<DriverSummaryDto>? lineup
});


@override $ConstructorDtoCopyWith<$Res> get constructor;@override $ConstructorSeasonEntryDtoCopyWith<$Res>? get seasonEntry;@override $ConstructorStandingDtoCopyWith<$Res>? get standing;

}
/// @nodoc
class __$ConstructorDetailDtoCopyWithImpl<$Res>
    implements _$ConstructorDetailDtoCopyWith<$Res> {
  __$ConstructorDetailDtoCopyWithImpl(this._self, this._then);

  final _ConstructorDetailDto _self;
  final $Res Function(_ConstructorDetailDto) _then;

/// Create a copy of ConstructorDetailDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? constructor = null,Object? seasonEntry = freezed,Object? standing = freezed,Object? lineup = freezed,}) {
  return _then(_ConstructorDetailDto(
constructor: null == constructor ? _self.constructor : constructor // ignore: cast_nullable_to_non_nullable
as ConstructorDto,seasonEntry: freezed == seasonEntry ? _self.seasonEntry : seasonEntry // ignore: cast_nullable_to_non_nullable
as ConstructorSeasonEntryDto?,standing: freezed == standing ? _self.standing : standing // ignore: cast_nullable_to_non_nullable
as ConstructorStandingDto?,lineup: freezed == lineup ? _self._lineup : lineup // ignore: cast_nullable_to_non_nullable
as List<DriverSummaryDto>?,
  ));
}

/// Create a copy of ConstructorDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConstructorDtoCopyWith<$Res> get constructor {
  
  return $ConstructorDtoCopyWith<$Res>(_self.constructor, (value) {
    return _then(_self.copyWith(constructor: value));
  });
}/// Create a copy of ConstructorDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConstructorSeasonEntryDtoCopyWith<$Res>? get seasonEntry {
    if (_self.seasonEntry == null) {
    return null;
  }

  return $ConstructorSeasonEntryDtoCopyWith<$Res>(_self.seasonEntry!, (value) {
    return _then(_self.copyWith(seasonEntry: value));
  });
}/// Create a copy of ConstructorDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ConstructorStandingDtoCopyWith<$Res>? get standing {
    if (_self.standing == null) {
    return null;
  }

  return $ConstructorStandingDtoCopyWith<$Res>(_self.standing!, (value) {
    return _then(_self.copyWith(standing: value));
  });
}
}


/// @nodoc
mixin _$CircuitDetailDto {

 CircuitDto get circuit; GrandPrixSummaryDto? get grandPrix;
/// Create a copy of CircuitDetailDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CircuitDetailDtoCopyWith<CircuitDetailDto> get copyWith => _$CircuitDetailDtoCopyWithImpl<CircuitDetailDto>(this as CircuitDetailDto, _$identity);

  /// Serializes this CircuitDetailDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CircuitDetailDto&&(identical(other.circuit, circuit) || other.circuit == circuit)&&(identical(other.grandPrix, grandPrix) || other.grandPrix == grandPrix));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,circuit,grandPrix);

@override
String toString() {
  return 'CircuitDetailDto(circuit: $circuit, grandPrix: $grandPrix)';
}


}

/// @nodoc
abstract mixin class $CircuitDetailDtoCopyWith<$Res>  {
  factory $CircuitDetailDtoCopyWith(CircuitDetailDto value, $Res Function(CircuitDetailDto) _then) = _$CircuitDetailDtoCopyWithImpl;
@useResult
$Res call({
 CircuitDto circuit, GrandPrixSummaryDto? grandPrix
});


$CircuitDtoCopyWith<$Res> get circuit;$GrandPrixSummaryDtoCopyWith<$Res>? get grandPrix;

}
/// @nodoc
class _$CircuitDetailDtoCopyWithImpl<$Res>
    implements $CircuitDetailDtoCopyWith<$Res> {
  _$CircuitDetailDtoCopyWithImpl(this._self, this._then);

  final CircuitDetailDto _self;
  final $Res Function(CircuitDetailDto) _then;

/// Create a copy of CircuitDetailDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? circuit = null,Object? grandPrix = freezed,}) {
  return _then(_self.copyWith(
circuit: null == circuit ? _self.circuit : circuit // ignore: cast_nullable_to_non_nullable
as CircuitDto,grandPrix: freezed == grandPrix ? _self.grandPrix : grandPrix // ignore: cast_nullable_to_non_nullable
as GrandPrixSummaryDto?,
  ));
}
/// Create a copy of CircuitDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CircuitDtoCopyWith<$Res> get circuit {
  
  return $CircuitDtoCopyWith<$Res>(_self.circuit, (value) {
    return _then(_self.copyWith(circuit: value));
  });
}/// Create a copy of CircuitDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GrandPrixSummaryDtoCopyWith<$Res>? get grandPrix {
    if (_self.grandPrix == null) {
    return null;
  }

  return $GrandPrixSummaryDtoCopyWith<$Res>(_self.grandPrix!, (value) {
    return _then(_self.copyWith(grandPrix: value));
  });
}
}


/// Adds pattern-matching-related methods to [CircuitDetailDto].
extension CircuitDetailDtoPatterns on CircuitDetailDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CircuitDetailDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CircuitDetailDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CircuitDetailDto value)  $default,){
final _that = this;
switch (_that) {
case _CircuitDetailDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CircuitDetailDto value)?  $default,){
final _that = this;
switch (_that) {
case _CircuitDetailDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( CircuitDto circuit,  GrandPrixSummaryDto? grandPrix)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CircuitDetailDto() when $default != null:
return $default(_that.circuit,_that.grandPrix);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( CircuitDto circuit,  GrandPrixSummaryDto? grandPrix)  $default,) {final _that = this;
switch (_that) {
case _CircuitDetailDto():
return $default(_that.circuit,_that.grandPrix);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( CircuitDto circuit,  GrandPrixSummaryDto? grandPrix)?  $default,) {final _that = this;
switch (_that) {
case _CircuitDetailDto() when $default != null:
return $default(_that.circuit,_that.grandPrix);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CircuitDetailDto implements CircuitDetailDto {
  const _CircuitDetailDto({required this.circuit, this.grandPrix});
  factory _CircuitDetailDto.fromJson(Map<String, dynamic> json) => _$CircuitDetailDtoFromJson(json);

@override final  CircuitDto circuit;
@override final  GrandPrixSummaryDto? grandPrix;

/// Create a copy of CircuitDetailDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CircuitDetailDtoCopyWith<_CircuitDetailDto> get copyWith => __$CircuitDetailDtoCopyWithImpl<_CircuitDetailDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CircuitDetailDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CircuitDetailDto&&(identical(other.circuit, circuit) || other.circuit == circuit)&&(identical(other.grandPrix, grandPrix) || other.grandPrix == grandPrix));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,circuit,grandPrix);

@override
String toString() {
  return 'CircuitDetailDto(circuit: $circuit, grandPrix: $grandPrix)';
}


}

/// @nodoc
abstract mixin class _$CircuitDetailDtoCopyWith<$Res> implements $CircuitDetailDtoCopyWith<$Res> {
  factory _$CircuitDetailDtoCopyWith(_CircuitDetailDto value, $Res Function(_CircuitDetailDto) _then) = __$CircuitDetailDtoCopyWithImpl;
@override @useResult
$Res call({
 CircuitDto circuit, GrandPrixSummaryDto? grandPrix
});


@override $CircuitDtoCopyWith<$Res> get circuit;@override $GrandPrixSummaryDtoCopyWith<$Res>? get grandPrix;

}
/// @nodoc
class __$CircuitDetailDtoCopyWithImpl<$Res>
    implements _$CircuitDetailDtoCopyWith<$Res> {
  __$CircuitDetailDtoCopyWithImpl(this._self, this._then);

  final _CircuitDetailDto _self;
  final $Res Function(_CircuitDetailDto) _then;

/// Create a copy of CircuitDetailDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? circuit = null,Object? grandPrix = freezed,}) {
  return _then(_CircuitDetailDto(
circuit: null == circuit ? _self.circuit : circuit // ignore: cast_nullable_to_non_nullable
as CircuitDto,grandPrix: freezed == grandPrix ? _self.grandPrix : grandPrix // ignore: cast_nullable_to_non_nullable
as GrandPrixSummaryDto?,
  ));
}

/// Create a copy of CircuitDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CircuitDtoCopyWith<$Res> get circuit {
  
  return $CircuitDtoCopyWith<$Res>(_self.circuit, (value) {
    return _then(_self.copyWith(circuit: value));
  });
}/// Create a copy of CircuitDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GrandPrixSummaryDtoCopyWith<$Res>? get grandPrix {
    if (_self.grandPrix == null) {
    return null;
  }

  return $GrandPrixSummaryDtoCopyWith<$Res>(_self.grandPrix!, (value) {
    return _then(_self.copyWith(grandPrix: value));
  });
}
}

// dart format on
