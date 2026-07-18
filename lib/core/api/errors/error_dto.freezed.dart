// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'error_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ErrorDto {

 String get code; String get message; bool get retryable; String get requestId;
/// Create a copy of ErrorDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ErrorDtoCopyWith<ErrorDto> get copyWith => _$ErrorDtoCopyWithImpl<ErrorDto>(this as ErrorDto, _$identity);

  /// Serializes this ErrorDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ErrorDto&&(identical(other.code, code) || other.code == code)&&(identical(other.message, message) || other.message == message)&&(identical(other.retryable, retryable) || other.retryable == retryable)&&(identical(other.requestId, requestId) || other.requestId == requestId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,code,message,retryable,requestId);

@override
String toString() {
  return 'ErrorDto(code: $code, message: $message, retryable: $retryable, requestId: $requestId)';
}


}

/// @nodoc
abstract mixin class $ErrorDtoCopyWith<$Res>  {
  factory $ErrorDtoCopyWith(ErrorDto value, $Res Function(ErrorDto) _then) = _$ErrorDtoCopyWithImpl;
@useResult
$Res call({
 String code, String message, bool retryable, String requestId
});




}
/// @nodoc
class _$ErrorDtoCopyWithImpl<$Res>
    implements $ErrorDtoCopyWith<$Res> {
  _$ErrorDtoCopyWithImpl(this._self, this._then);

  final ErrorDto _self;
  final $Res Function(ErrorDto) _then;

/// Create a copy of ErrorDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? code = null,Object? message = null,Object? retryable = null,Object? requestId = null,}) {
  return _then(_self.copyWith(
code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,retryable: null == retryable ? _self.retryable : retryable // ignore: cast_nullable_to_non_nullable
as bool,requestId: null == requestId ? _self.requestId : requestId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [ErrorDto].
extension ErrorDtoPatterns on ErrorDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ErrorDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ErrorDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ErrorDto value)  $default,){
final _that = this;
switch (_that) {
case _ErrorDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ErrorDto value)?  $default,){
final _that = this;
switch (_that) {
case _ErrorDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String code,  String message,  bool retryable,  String requestId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ErrorDto() when $default != null:
return $default(_that.code,_that.message,_that.retryable,_that.requestId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String code,  String message,  bool retryable,  String requestId)  $default,) {final _that = this;
switch (_that) {
case _ErrorDto():
return $default(_that.code,_that.message,_that.retryable,_that.requestId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String code,  String message,  bool retryable,  String requestId)?  $default,) {final _that = this;
switch (_that) {
case _ErrorDto() when $default != null:
return $default(_that.code,_that.message,_that.retryable,_that.requestId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ErrorDto implements ErrorDto {
  const _ErrorDto({required this.code, required this.message, required this.retryable, required this.requestId});
  factory _ErrorDto.fromJson(Map<String, dynamic> json) => _$ErrorDtoFromJson(json);

@override final  String code;
@override final  String message;
@override final  bool retryable;
@override final  String requestId;

/// Create a copy of ErrorDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ErrorDtoCopyWith<_ErrorDto> get copyWith => __$ErrorDtoCopyWithImpl<_ErrorDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ErrorDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ErrorDto&&(identical(other.code, code) || other.code == code)&&(identical(other.message, message) || other.message == message)&&(identical(other.retryable, retryable) || other.retryable == retryable)&&(identical(other.requestId, requestId) || other.requestId == requestId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,code,message,retryable,requestId);

@override
String toString() {
  return 'ErrorDto(code: $code, message: $message, retryable: $retryable, requestId: $requestId)';
}


}

/// @nodoc
abstract mixin class _$ErrorDtoCopyWith<$Res> implements $ErrorDtoCopyWith<$Res> {
  factory _$ErrorDtoCopyWith(_ErrorDto value, $Res Function(_ErrorDto) _then) = __$ErrorDtoCopyWithImpl;
@override @useResult
$Res call({
 String code, String message, bool retryable, String requestId
});




}
/// @nodoc
class __$ErrorDtoCopyWithImpl<$Res>
    implements _$ErrorDtoCopyWith<$Res> {
  __$ErrorDtoCopyWithImpl(this._self, this._then);

  final _ErrorDto _self;
  final $Res Function(_ErrorDto) _then;

/// Create a copy of ErrorDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? code = null,Object? message = null,Object? retryable = null,Object? requestId = null,}) {
  return _then(_ErrorDto(
code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,retryable: null == retryable ? _self.retryable : retryable // ignore: cast_nullable_to_non_nullable
as bool,requestId: null == requestId ? _self.requestId : requestId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ErrorEnvelopeDto {

 ErrorDto get error;
/// Create a copy of ErrorEnvelopeDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ErrorEnvelopeDtoCopyWith<ErrorEnvelopeDto> get copyWith => _$ErrorEnvelopeDtoCopyWithImpl<ErrorEnvelopeDto>(this as ErrorEnvelopeDto, _$identity);

  /// Serializes this ErrorEnvelopeDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ErrorEnvelopeDto&&(identical(other.error, error) || other.error == error));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,error);

@override
String toString() {
  return 'ErrorEnvelopeDto(error: $error)';
}


}

/// @nodoc
abstract mixin class $ErrorEnvelopeDtoCopyWith<$Res>  {
  factory $ErrorEnvelopeDtoCopyWith(ErrorEnvelopeDto value, $Res Function(ErrorEnvelopeDto) _then) = _$ErrorEnvelopeDtoCopyWithImpl;
@useResult
$Res call({
 ErrorDto error
});


$ErrorDtoCopyWith<$Res> get error;

}
/// @nodoc
class _$ErrorEnvelopeDtoCopyWithImpl<$Res>
    implements $ErrorEnvelopeDtoCopyWith<$Res> {
  _$ErrorEnvelopeDtoCopyWithImpl(this._self, this._then);

  final ErrorEnvelopeDto _self;
  final $Res Function(ErrorEnvelopeDto) _then;

/// Create a copy of ErrorEnvelopeDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? error = null,}) {
  return _then(_self.copyWith(
error: null == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as ErrorDto,
  ));
}
/// Create a copy of ErrorEnvelopeDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ErrorDtoCopyWith<$Res> get error {
  
  return $ErrorDtoCopyWith<$Res>(_self.error, (value) {
    return _then(_self.copyWith(error: value));
  });
}
}


/// Adds pattern-matching-related methods to [ErrorEnvelopeDto].
extension ErrorEnvelopeDtoPatterns on ErrorEnvelopeDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ErrorEnvelopeDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ErrorEnvelopeDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ErrorEnvelopeDto value)  $default,){
final _that = this;
switch (_that) {
case _ErrorEnvelopeDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ErrorEnvelopeDto value)?  $default,){
final _that = this;
switch (_that) {
case _ErrorEnvelopeDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ErrorDto error)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ErrorEnvelopeDto() when $default != null:
return $default(_that.error);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ErrorDto error)  $default,) {final _that = this;
switch (_that) {
case _ErrorEnvelopeDto():
return $default(_that.error);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ErrorDto error)?  $default,) {final _that = this;
switch (_that) {
case _ErrorEnvelopeDto() when $default != null:
return $default(_that.error);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ErrorEnvelopeDto implements ErrorEnvelopeDto {
  const _ErrorEnvelopeDto({required this.error});
  factory _ErrorEnvelopeDto.fromJson(Map<String, dynamic> json) => _$ErrorEnvelopeDtoFromJson(json);

@override final  ErrorDto error;

/// Create a copy of ErrorEnvelopeDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ErrorEnvelopeDtoCopyWith<_ErrorEnvelopeDto> get copyWith => __$ErrorEnvelopeDtoCopyWithImpl<_ErrorEnvelopeDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ErrorEnvelopeDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ErrorEnvelopeDto&&(identical(other.error, error) || other.error == error));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,error);

@override
String toString() {
  return 'ErrorEnvelopeDto(error: $error)';
}


}

/// @nodoc
abstract mixin class _$ErrorEnvelopeDtoCopyWith<$Res> implements $ErrorEnvelopeDtoCopyWith<$Res> {
  factory _$ErrorEnvelopeDtoCopyWith(_ErrorEnvelopeDto value, $Res Function(_ErrorEnvelopeDto) _then) = __$ErrorEnvelopeDtoCopyWithImpl;
@override @useResult
$Res call({
 ErrorDto error
});


@override $ErrorDtoCopyWith<$Res> get error;

}
/// @nodoc
class __$ErrorEnvelopeDtoCopyWithImpl<$Res>
    implements _$ErrorEnvelopeDtoCopyWith<$Res> {
  __$ErrorEnvelopeDtoCopyWithImpl(this._self, this._then);

  final _ErrorEnvelopeDto _self;
  final $Res Function(_ErrorEnvelopeDto) _then;

/// Create a copy of ErrorEnvelopeDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? error = null,}) {
  return _then(_ErrorEnvelopeDto(
error: null == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as ErrorDto,
  ));
}

/// Create a copy of ErrorEnvelopeDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ErrorDtoCopyWith<$Res> get error {
  
  return $ErrorDtoCopyWith<$Res>(_self.error, (value) {
    return _then(_self.copyWith(error: value));
  });
}
}

// dart format on
