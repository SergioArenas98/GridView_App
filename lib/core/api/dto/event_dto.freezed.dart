// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'event_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SessionDto {

 String get id; String get type; String? get name; String? get startTime; String? get endTime; String get status;
/// Create a copy of SessionDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionDtoCopyWith<SessionDto> get copyWith => _$SessionDtoCopyWithImpl<SessionDto>(this as SessionDto, _$identity);

  /// Serializes this SessionDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionDto&&(identical(other.id, id) || other.id == id)&&(identical(other.type, type) || other.type == type)&&(identical(other.name, name) || other.name == name)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,type,name,startTime,endTime,status);

@override
String toString() {
  return 'SessionDto(id: $id, type: $type, name: $name, startTime: $startTime, endTime: $endTime, status: $status)';
}


}

/// @nodoc
abstract mixin class $SessionDtoCopyWith<$Res>  {
  factory $SessionDtoCopyWith(SessionDto value, $Res Function(SessionDto) _then) = _$SessionDtoCopyWithImpl;
@useResult
$Res call({
 String id, String type, String? name, String? startTime, String? endTime, String status
});




}
/// @nodoc
class _$SessionDtoCopyWithImpl<$Res>
    implements $SessionDtoCopyWith<$Res> {
  _$SessionDtoCopyWithImpl(this._self, this._then);

  final SessionDto _self;
  final $Res Function(SessionDto) _then;

/// Create a copy of SessionDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? type = null,Object? name = freezed,Object? startTime = freezed,Object? endTime = freezed,Object? status = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,name: freezed == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String?,startTime: freezed == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String?,endTime: freezed == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [SessionDto].
extension SessionDtoPatterns on SessionDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SessionDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SessionDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SessionDto value)  $default,){
final _that = this;
switch (_that) {
case _SessionDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SessionDto value)?  $default,){
final _that = this;
switch (_that) {
case _SessionDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String type,  String? name,  String? startTime,  String? endTime,  String status)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SessionDto() when $default != null:
return $default(_that.id,_that.type,_that.name,_that.startTime,_that.endTime,_that.status);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String type,  String? name,  String? startTime,  String? endTime,  String status)  $default,) {final _that = this;
switch (_that) {
case _SessionDto():
return $default(_that.id,_that.type,_that.name,_that.startTime,_that.endTime,_that.status);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String type,  String? name,  String? startTime,  String? endTime,  String status)?  $default,) {final _that = this;
switch (_that) {
case _SessionDto() when $default != null:
return $default(_that.id,_that.type,_that.name,_that.startTime,_that.endTime,_that.status);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SessionDto implements SessionDto {
  const _SessionDto({required this.id, required this.type, this.name, this.startTime, this.endTime, required this.status});
  factory _SessionDto.fromJson(Map<String, dynamic> json) => _$SessionDtoFromJson(json);

@override final  String id;
@override final  String type;
@override final  String? name;
@override final  String? startTime;
@override final  String? endTime;
@override final  String status;

/// Create a copy of SessionDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionDtoCopyWith<_SessionDto> get copyWith => __$SessionDtoCopyWithImpl<_SessionDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SessionDto&&(identical(other.id, id) || other.id == id)&&(identical(other.type, type) || other.type == type)&&(identical(other.name, name) || other.name == name)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,type,name,startTime,endTime,status);

@override
String toString() {
  return 'SessionDto(id: $id, type: $type, name: $name, startTime: $startTime, endTime: $endTime, status: $status)';
}


}

/// @nodoc
abstract mixin class _$SessionDtoCopyWith<$Res> implements $SessionDtoCopyWith<$Res> {
  factory _$SessionDtoCopyWith(_SessionDto value, $Res Function(_SessionDto) _then) = __$SessionDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String type, String? name, String? startTime, String? endTime, String status
});




}
/// @nodoc
class __$SessionDtoCopyWithImpl<$Res>
    implements _$SessionDtoCopyWith<$Res> {
  __$SessionDtoCopyWithImpl(this._self, this._then);

  final _SessionDto _self;
  final $Res Function(_SessionDto) _then;

/// Create a copy of SessionDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? type = null,Object? name = freezed,Object? startTime = freezed,Object? endTime = freezed,Object? status = null,}) {
  return _then(_SessionDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,name: freezed == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String?,startTime: freezed == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String?,endTime: freezed == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$GrandPrixDto {

 String get id; int get season; int get round; String get eventSlug; String get name; String? get officialName; String get circuitId; String get status; String get format; String? get startDate; String? get endDate; String? get timezone; List<SessionDto> get sessions; bool get hasResults; List<MediaAssetDto>? get media;
/// Create a copy of GrandPrixDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GrandPrixDtoCopyWith<GrandPrixDto> get copyWith => _$GrandPrixDtoCopyWithImpl<GrandPrixDto>(this as GrandPrixDto, _$identity);

  /// Serializes this GrandPrixDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GrandPrixDto&&(identical(other.id, id) || other.id == id)&&(identical(other.season, season) || other.season == season)&&(identical(other.round, round) || other.round == round)&&(identical(other.eventSlug, eventSlug) || other.eventSlug == eventSlug)&&(identical(other.name, name) || other.name == name)&&(identical(other.officialName, officialName) || other.officialName == officialName)&&(identical(other.circuitId, circuitId) || other.circuitId == circuitId)&&(identical(other.status, status) || other.status == status)&&(identical(other.format, format) || other.format == format)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&const DeepCollectionEquality().equals(other.sessions, sessions)&&(identical(other.hasResults, hasResults) || other.hasResults == hasResults)&&const DeepCollectionEquality().equals(other.media, media));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,season,round,eventSlug,name,officialName,circuitId,status,format,startDate,endDate,timezone,const DeepCollectionEquality().hash(sessions),hasResults,const DeepCollectionEquality().hash(media));

@override
String toString() {
  return 'GrandPrixDto(id: $id, season: $season, round: $round, eventSlug: $eventSlug, name: $name, officialName: $officialName, circuitId: $circuitId, status: $status, format: $format, startDate: $startDate, endDate: $endDate, timezone: $timezone, sessions: $sessions, hasResults: $hasResults, media: $media)';
}


}

/// @nodoc
abstract mixin class $GrandPrixDtoCopyWith<$Res>  {
  factory $GrandPrixDtoCopyWith(GrandPrixDto value, $Res Function(GrandPrixDto) _then) = _$GrandPrixDtoCopyWithImpl;
@useResult
$Res call({
 String id, int season, int round, String eventSlug, String name, String? officialName, String circuitId, String status, String format, String? startDate, String? endDate, String? timezone, List<SessionDto> sessions, bool hasResults, List<MediaAssetDto>? media
});




}
/// @nodoc
class _$GrandPrixDtoCopyWithImpl<$Res>
    implements $GrandPrixDtoCopyWith<$Res> {
  _$GrandPrixDtoCopyWithImpl(this._self, this._then);

  final GrandPrixDto _self;
  final $Res Function(GrandPrixDto) _then;

/// Create a copy of GrandPrixDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? season = null,Object? round = null,Object? eventSlug = null,Object? name = null,Object? officialName = freezed,Object? circuitId = null,Object? status = null,Object? format = null,Object? startDate = freezed,Object? endDate = freezed,Object? timezone = freezed,Object? sessions = null,Object? hasResults = null,Object? media = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,round: null == round ? _self.round : round // ignore: cast_nullable_to_non_nullable
as int,eventSlug: null == eventSlug ? _self.eventSlug : eventSlug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,officialName: freezed == officialName ? _self.officialName : officialName // ignore: cast_nullable_to_non_nullable
as String?,circuitId: null == circuitId ? _self.circuitId : circuitId // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,format: null == format ? _self.format : format // ignore: cast_nullable_to_non_nullable
as String,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as String?,endDate: freezed == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as String?,timezone: freezed == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String?,sessions: null == sessions ? _self.sessions : sessions // ignore: cast_nullable_to_non_nullable
as List<SessionDto>,hasResults: null == hasResults ? _self.hasResults : hasResults // ignore: cast_nullable_to_non_nullable
as bool,media: freezed == media ? _self.media : media // ignore: cast_nullable_to_non_nullable
as List<MediaAssetDto>?,
  ));
}

}


/// Adds pattern-matching-related methods to [GrandPrixDto].
extension GrandPrixDtoPatterns on GrandPrixDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GrandPrixDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GrandPrixDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GrandPrixDto value)  $default,){
final _that = this;
switch (_that) {
case _GrandPrixDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GrandPrixDto value)?  $default,){
final _that = this;
switch (_that) {
case _GrandPrixDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  int season,  int round,  String eventSlug,  String name,  String? officialName,  String circuitId,  String status,  String format,  String? startDate,  String? endDate,  String? timezone,  List<SessionDto> sessions,  bool hasResults,  List<MediaAssetDto>? media)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GrandPrixDto() when $default != null:
return $default(_that.id,_that.season,_that.round,_that.eventSlug,_that.name,_that.officialName,_that.circuitId,_that.status,_that.format,_that.startDate,_that.endDate,_that.timezone,_that.sessions,_that.hasResults,_that.media);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  int season,  int round,  String eventSlug,  String name,  String? officialName,  String circuitId,  String status,  String format,  String? startDate,  String? endDate,  String? timezone,  List<SessionDto> sessions,  bool hasResults,  List<MediaAssetDto>? media)  $default,) {final _that = this;
switch (_that) {
case _GrandPrixDto():
return $default(_that.id,_that.season,_that.round,_that.eventSlug,_that.name,_that.officialName,_that.circuitId,_that.status,_that.format,_that.startDate,_that.endDate,_that.timezone,_that.sessions,_that.hasResults,_that.media);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  int season,  int round,  String eventSlug,  String name,  String? officialName,  String circuitId,  String status,  String format,  String? startDate,  String? endDate,  String? timezone,  List<SessionDto> sessions,  bool hasResults,  List<MediaAssetDto>? media)?  $default,) {final _that = this;
switch (_that) {
case _GrandPrixDto() when $default != null:
return $default(_that.id,_that.season,_that.round,_that.eventSlug,_that.name,_that.officialName,_that.circuitId,_that.status,_that.format,_that.startDate,_that.endDate,_that.timezone,_that.sessions,_that.hasResults,_that.media);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GrandPrixDto implements GrandPrixDto {
  const _GrandPrixDto({required this.id, required this.season, required this.round, required this.eventSlug, required this.name, this.officialName, required this.circuitId, required this.status, required this.format, this.startDate, this.endDate, this.timezone, required final  List<SessionDto> sessions, required this.hasResults, final  List<MediaAssetDto>? media}): _sessions = sessions,_media = media;
  factory _GrandPrixDto.fromJson(Map<String, dynamic> json) => _$GrandPrixDtoFromJson(json);

@override final  String id;
@override final  int season;
@override final  int round;
@override final  String eventSlug;
@override final  String name;
@override final  String? officialName;
@override final  String circuitId;
@override final  String status;
@override final  String format;
@override final  String? startDate;
@override final  String? endDate;
@override final  String? timezone;
 final  List<SessionDto> _sessions;
@override List<SessionDto> get sessions {
  if (_sessions is EqualUnmodifiableListView) return _sessions;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_sessions);
}

@override final  bool hasResults;
 final  List<MediaAssetDto>? _media;
@override List<MediaAssetDto>? get media {
  final value = _media;
  if (value == null) return null;
  if (_media is EqualUnmodifiableListView) return _media;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of GrandPrixDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GrandPrixDtoCopyWith<_GrandPrixDto> get copyWith => __$GrandPrixDtoCopyWithImpl<_GrandPrixDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GrandPrixDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _GrandPrixDto&&(identical(other.id, id) || other.id == id)&&(identical(other.season, season) || other.season == season)&&(identical(other.round, round) || other.round == round)&&(identical(other.eventSlug, eventSlug) || other.eventSlug == eventSlug)&&(identical(other.name, name) || other.name == name)&&(identical(other.officialName, officialName) || other.officialName == officialName)&&(identical(other.circuitId, circuitId) || other.circuitId == circuitId)&&(identical(other.status, status) || other.status == status)&&(identical(other.format, format) || other.format == format)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&const DeepCollectionEquality().equals(other._sessions, _sessions)&&(identical(other.hasResults, hasResults) || other.hasResults == hasResults)&&const DeepCollectionEquality().equals(other._media, _media));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,season,round,eventSlug,name,officialName,circuitId,status,format,startDate,endDate,timezone,const DeepCollectionEquality().hash(_sessions),hasResults,const DeepCollectionEquality().hash(_media));

@override
String toString() {
  return 'GrandPrixDto(id: $id, season: $season, round: $round, eventSlug: $eventSlug, name: $name, officialName: $officialName, circuitId: $circuitId, status: $status, format: $format, startDate: $startDate, endDate: $endDate, timezone: $timezone, sessions: $sessions, hasResults: $hasResults, media: $media)';
}


}

/// @nodoc
abstract mixin class _$GrandPrixDtoCopyWith<$Res> implements $GrandPrixDtoCopyWith<$Res> {
  factory _$GrandPrixDtoCopyWith(_GrandPrixDto value, $Res Function(_GrandPrixDto) _then) = __$GrandPrixDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, int season, int round, String eventSlug, String name, String? officialName, String circuitId, String status, String format, String? startDate, String? endDate, String? timezone, List<SessionDto> sessions, bool hasResults, List<MediaAssetDto>? media
});




}
/// @nodoc
class __$GrandPrixDtoCopyWithImpl<$Res>
    implements _$GrandPrixDtoCopyWith<$Res> {
  __$GrandPrixDtoCopyWithImpl(this._self, this._then);

  final _GrandPrixDto _self;
  final $Res Function(_GrandPrixDto) _then;

/// Create a copy of GrandPrixDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? season = null,Object? round = null,Object? eventSlug = null,Object? name = null,Object? officialName = freezed,Object? circuitId = null,Object? status = null,Object? format = null,Object? startDate = freezed,Object? endDate = freezed,Object? timezone = freezed,Object? sessions = null,Object? hasResults = null,Object? media = freezed,}) {
  return _then(_GrandPrixDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,round: null == round ? _self.round : round // ignore: cast_nullable_to_non_nullable
as int,eventSlug: null == eventSlug ? _self.eventSlug : eventSlug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,officialName: freezed == officialName ? _self.officialName : officialName // ignore: cast_nullable_to_non_nullable
as String?,circuitId: null == circuitId ? _self.circuitId : circuitId // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,format: null == format ? _self.format : format // ignore: cast_nullable_to_non_nullable
as String,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as String?,endDate: freezed == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as String?,timezone: freezed == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String?,sessions: null == sessions ? _self._sessions : sessions // ignore: cast_nullable_to_non_nullable
as List<SessionDto>,hasResults: null == hasResults ? _self.hasResults : hasResults // ignore: cast_nullable_to_non_nullable
as bool,media: freezed == media ? _self._media : media // ignore: cast_nullable_to_non_nullable
as List<MediaAssetDto>?,
  ));
}


}


/// @nodoc
mixin _$GrandPrixSummaryDto {

 String get id; int get season; int get round; String get eventSlug; String get name; String get circuitId; String? get circuitName; String get status; String get format; String? get startDate; String? get endDate; String? get timezone; bool get hasResults;
/// Create a copy of GrandPrixSummaryDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GrandPrixSummaryDtoCopyWith<GrandPrixSummaryDto> get copyWith => _$GrandPrixSummaryDtoCopyWithImpl<GrandPrixSummaryDto>(this as GrandPrixSummaryDto, _$identity);

  /// Serializes this GrandPrixSummaryDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GrandPrixSummaryDto&&(identical(other.id, id) || other.id == id)&&(identical(other.season, season) || other.season == season)&&(identical(other.round, round) || other.round == round)&&(identical(other.eventSlug, eventSlug) || other.eventSlug == eventSlug)&&(identical(other.name, name) || other.name == name)&&(identical(other.circuitId, circuitId) || other.circuitId == circuitId)&&(identical(other.circuitName, circuitName) || other.circuitName == circuitName)&&(identical(other.status, status) || other.status == status)&&(identical(other.format, format) || other.format == format)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&(identical(other.hasResults, hasResults) || other.hasResults == hasResults));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,season,round,eventSlug,name,circuitId,circuitName,status,format,startDate,endDate,timezone,hasResults);

@override
String toString() {
  return 'GrandPrixSummaryDto(id: $id, season: $season, round: $round, eventSlug: $eventSlug, name: $name, circuitId: $circuitId, circuitName: $circuitName, status: $status, format: $format, startDate: $startDate, endDate: $endDate, timezone: $timezone, hasResults: $hasResults)';
}


}

/// @nodoc
abstract mixin class $GrandPrixSummaryDtoCopyWith<$Res>  {
  factory $GrandPrixSummaryDtoCopyWith(GrandPrixSummaryDto value, $Res Function(GrandPrixSummaryDto) _then) = _$GrandPrixSummaryDtoCopyWithImpl;
@useResult
$Res call({
 String id, int season, int round, String eventSlug, String name, String circuitId, String? circuitName, String status, String format, String? startDate, String? endDate, String? timezone, bool hasResults
});




}
/// @nodoc
class _$GrandPrixSummaryDtoCopyWithImpl<$Res>
    implements $GrandPrixSummaryDtoCopyWith<$Res> {
  _$GrandPrixSummaryDtoCopyWithImpl(this._self, this._then);

  final GrandPrixSummaryDto _self;
  final $Res Function(GrandPrixSummaryDto) _then;

/// Create a copy of GrandPrixSummaryDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? season = null,Object? round = null,Object? eventSlug = null,Object? name = null,Object? circuitId = null,Object? circuitName = freezed,Object? status = null,Object? format = null,Object? startDate = freezed,Object? endDate = freezed,Object? timezone = freezed,Object? hasResults = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,round: null == round ? _self.round : round // ignore: cast_nullable_to_non_nullable
as int,eventSlug: null == eventSlug ? _self.eventSlug : eventSlug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,circuitId: null == circuitId ? _self.circuitId : circuitId // ignore: cast_nullable_to_non_nullable
as String,circuitName: freezed == circuitName ? _self.circuitName : circuitName // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,format: null == format ? _self.format : format // ignore: cast_nullable_to_non_nullable
as String,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as String?,endDate: freezed == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as String?,timezone: freezed == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String?,hasResults: null == hasResults ? _self.hasResults : hasResults // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [GrandPrixSummaryDto].
extension GrandPrixSummaryDtoPatterns on GrandPrixSummaryDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GrandPrixSummaryDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GrandPrixSummaryDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GrandPrixSummaryDto value)  $default,){
final _that = this;
switch (_that) {
case _GrandPrixSummaryDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GrandPrixSummaryDto value)?  $default,){
final _that = this;
switch (_that) {
case _GrandPrixSummaryDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  int season,  int round,  String eventSlug,  String name,  String circuitId,  String? circuitName,  String status,  String format,  String? startDate,  String? endDate,  String? timezone,  bool hasResults)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GrandPrixSummaryDto() when $default != null:
return $default(_that.id,_that.season,_that.round,_that.eventSlug,_that.name,_that.circuitId,_that.circuitName,_that.status,_that.format,_that.startDate,_that.endDate,_that.timezone,_that.hasResults);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  int season,  int round,  String eventSlug,  String name,  String circuitId,  String? circuitName,  String status,  String format,  String? startDate,  String? endDate,  String? timezone,  bool hasResults)  $default,) {final _that = this;
switch (_that) {
case _GrandPrixSummaryDto():
return $default(_that.id,_that.season,_that.round,_that.eventSlug,_that.name,_that.circuitId,_that.circuitName,_that.status,_that.format,_that.startDate,_that.endDate,_that.timezone,_that.hasResults);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  int season,  int round,  String eventSlug,  String name,  String circuitId,  String? circuitName,  String status,  String format,  String? startDate,  String? endDate,  String? timezone,  bool hasResults)?  $default,) {final _that = this;
switch (_that) {
case _GrandPrixSummaryDto() when $default != null:
return $default(_that.id,_that.season,_that.round,_that.eventSlug,_that.name,_that.circuitId,_that.circuitName,_that.status,_that.format,_that.startDate,_that.endDate,_that.timezone,_that.hasResults);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GrandPrixSummaryDto implements GrandPrixSummaryDto {
  const _GrandPrixSummaryDto({required this.id, required this.season, required this.round, required this.eventSlug, required this.name, required this.circuitId, this.circuitName, required this.status, required this.format, this.startDate, this.endDate, this.timezone, required this.hasResults});
  factory _GrandPrixSummaryDto.fromJson(Map<String, dynamic> json) => _$GrandPrixSummaryDtoFromJson(json);

@override final  String id;
@override final  int season;
@override final  int round;
@override final  String eventSlug;
@override final  String name;
@override final  String circuitId;
@override final  String? circuitName;
@override final  String status;
@override final  String format;
@override final  String? startDate;
@override final  String? endDate;
@override final  String? timezone;
@override final  bool hasResults;

/// Create a copy of GrandPrixSummaryDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GrandPrixSummaryDtoCopyWith<_GrandPrixSummaryDto> get copyWith => __$GrandPrixSummaryDtoCopyWithImpl<_GrandPrixSummaryDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GrandPrixSummaryDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _GrandPrixSummaryDto&&(identical(other.id, id) || other.id == id)&&(identical(other.season, season) || other.season == season)&&(identical(other.round, round) || other.round == round)&&(identical(other.eventSlug, eventSlug) || other.eventSlug == eventSlug)&&(identical(other.name, name) || other.name == name)&&(identical(other.circuitId, circuitId) || other.circuitId == circuitId)&&(identical(other.circuitName, circuitName) || other.circuitName == circuitName)&&(identical(other.status, status) || other.status == status)&&(identical(other.format, format) || other.format == format)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&(identical(other.hasResults, hasResults) || other.hasResults == hasResults));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,season,round,eventSlug,name,circuitId,circuitName,status,format,startDate,endDate,timezone,hasResults);

@override
String toString() {
  return 'GrandPrixSummaryDto(id: $id, season: $season, round: $round, eventSlug: $eventSlug, name: $name, circuitId: $circuitId, circuitName: $circuitName, status: $status, format: $format, startDate: $startDate, endDate: $endDate, timezone: $timezone, hasResults: $hasResults)';
}


}

/// @nodoc
abstract mixin class _$GrandPrixSummaryDtoCopyWith<$Res> implements $GrandPrixSummaryDtoCopyWith<$Res> {
  factory _$GrandPrixSummaryDtoCopyWith(_GrandPrixSummaryDto value, $Res Function(_GrandPrixSummaryDto) _then) = __$GrandPrixSummaryDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, int season, int round, String eventSlug, String name, String circuitId, String? circuitName, String status, String format, String? startDate, String? endDate, String? timezone, bool hasResults
});




}
/// @nodoc
class __$GrandPrixSummaryDtoCopyWithImpl<$Res>
    implements _$GrandPrixSummaryDtoCopyWith<$Res> {
  __$GrandPrixSummaryDtoCopyWithImpl(this._self, this._then);

  final _GrandPrixSummaryDto _self;
  final $Res Function(_GrandPrixSummaryDto) _then;

/// Create a copy of GrandPrixSummaryDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? season = null,Object? round = null,Object? eventSlug = null,Object? name = null,Object? circuitId = null,Object? circuitName = freezed,Object? status = null,Object? format = null,Object? startDate = freezed,Object? endDate = freezed,Object? timezone = freezed,Object? hasResults = null,}) {
  return _then(_GrandPrixSummaryDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,season: null == season ? _self.season : season // ignore: cast_nullable_to_non_nullable
as int,round: null == round ? _self.round : round // ignore: cast_nullable_to_non_nullable
as int,eventSlug: null == eventSlug ? _self.eventSlug : eventSlug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,circuitId: null == circuitId ? _self.circuitId : circuitId // ignore: cast_nullable_to_non_nullable
as String,circuitName: freezed == circuitName ? _self.circuitName : circuitName // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,format: null == format ? _self.format : format // ignore: cast_nullable_to_non_nullable
as String,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as String?,endDate: freezed == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as String?,timezone: freezed == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String?,hasResults: null == hasResults ? _self.hasResults : hasResults // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
