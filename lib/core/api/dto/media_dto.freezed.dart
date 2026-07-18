// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'media_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$MediaVariantDto {

 String get url; int? get width; int? get height;
/// Create a copy of MediaVariantDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MediaVariantDtoCopyWith<MediaVariantDto> get copyWith => _$MediaVariantDtoCopyWithImpl<MediaVariantDto>(this as MediaVariantDto, _$identity);

  /// Serializes this MediaVariantDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MediaVariantDto&&(identical(other.url, url) || other.url == url)&&(identical(other.width, width) || other.width == width)&&(identical(other.height, height) || other.height == height));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,url,width,height);

@override
String toString() {
  return 'MediaVariantDto(url: $url, width: $width, height: $height)';
}


}

/// @nodoc
abstract mixin class $MediaVariantDtoCopyWith<$Res>  {
  factory $MediaVariantDtoCopyWith(MediaVariantDto value, $Res Function(MediaVariantDto) _then) = _$MediaVariantDtoCopyWithImpl;
@useResult
$Res call({
 String url, int? width, int? height
});




}
/// @nodoc
class _$MediaVariantDtoCopyWithImpl<$Res>
    implements $MediaVariantDtoCopyWith<$Res> {
  _$MediaVariantDtoCopyWithImpl(this._self, this._then);

  final MediaVariantDto _self;
  final $Res Function(MediaVariantDto) _then;

/// Create a copy of MediaVariantDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? url = null,Object? width = freezed,Object? height = freezed,}) {
  return _then(_self.copyWith(
url: null == url ? _self.url : url // ignore: cast_nullable_to_non_nullable
as String,width: freezed == width ? _self.width : width // ignore: cast_nullable_to_non_nullable
as int?,height: freezed == height ? _self.height : height // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [MediaVariantDto].
extension MediaVariantDtoPatterns on MediaVariantDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MediaVariantDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MediaVariantDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MediaVariantDto value)  $default,){
final _that = this;
switch (_that) {
case _MediaVariantDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MediaVariantDto value)?  $default,){
final _that = this;
switch (_that) {
case _MediaVariantDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String url,  int? width,  int? height)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MediaVariantDto() when $default != null:
return $default(_that.url,_that.width,_that.height);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String url,  int? width,  int? height)  $default,) {final _that = this;
switch (_that) {
case _MediaVariantDto():
return $default(_that.url,_that.width,_that.height);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String url,  int? width,  int? height)?  $default,) {final _that = this;
switch (_that) {
case _MediaVariantDto() when $default != null:
return $default(_that.url,_that.width,_that.height);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MediaVariantDto implements MediaVariantDto {
  const _MediaVariantDto({required this.url, this.width, this.height});
  factory _MediaVariantDto.fromJson(Map<String, dynamic> json) => _$MediaVariantDtoFromJson(json);

@override final  String url;
@override final  int? width;
@override final  int? height;

/// Create a copy of MediaVariantDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MediaVariantDtoCopyWith<_MediaVariantDto> get copyWith => __$MediaVariantDtoCopyWithImpl<_MediaVariantDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MediaVariantDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MediaVariantDto&&(identical(other.url, url) || other.url == url)&&(identical(other.width, width) || other.width == width)&&(identical(other.height, height) || other.height == height));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,url,width,height);

@override
String toString() {
  return 'MediaVariantDto(url: $url, width: $width, height: $height)';
}


}

/// @nodoc
abstract mixin class _$MediaVariantDtoCopyWith<$Res> implements $MediaVariantDtoCopyWith<$Res> {
  factory _$MediaVariantDtoCopyWith(_MediaVariantDto value, $Res Function(_MediaVariantDto) _then) = __$MediaVariantDtoCopyWithImpl;
@override @useResult
$Res call({
 String url, int? width, int? height
});




}
/// @nodoc
class __$MediaVariantDtoCopyWithImpl<$Res>
    implements _$MediaVariantDtoCopyWith<$Res> {
  __$MediaVariantDtoCopyWithImpl(this._self, this._then);

  final _MediaVariantDto _self;
  final $Res Function(_MediaVariantDto) _then;

/// Create a copy of MediaVariantDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? url = null,Object? width = freezed,Object? height = freezed,}) {
  return _then(_MediaVariantDto(
url: null == url ? _self.url : url // ignore: cast_nullable_to_non_nullable
as String,width: freezed == width ? _self.width : width // ignore: cast_nullable_to_non_nullable
as int?,height: freezed == height ? _self.height : height // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$MediaVariantsDto {

 MediaVariantDto? get thumbnail; MediaVariantDto? get card; MediaVariantDto? get detail; MediaVariantDto? get hero;
/// Create a copy of MediaVariantsDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MediaVariantsDtoCopyWith<MediaVariantsDto> get copyWith => _$MediaVariantsDtoCopyWithImpl<MediaVariantsDto>(this as MediaVariantsDto, _$identity);

  /// Serializes this MediaVariantsDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MediaVariantsDto&&(identical(other.thumbnail, thumbnail) || other.thumbnail == thumbnail)&&(identical(other.card, card) || other.card == card)&&(identical(other.detail, detail) || other.detail == detail)&&(identical(other.hero, hero) || other.hero == hero));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,thumbnail,card,detail,hero);

@override
String toString() {
  return 'MediaVariantsDto(thumbnail: $thumbnail, card: $card, detail: $detail, hero: $hero)';
}


}

/// @nodoc
abstract mixin class $MediaVariantsDtoCopyWith<$Res>  {
  factory $MediaVariantsDtoCopyWith(MediaVariantsDto value, $Res Function(MediaVariantsDto) _then) = _$MediaVariantsDtoCopyWithImpl;
@useResult
$Res call({
 MediaVariantDto? thumbnail, MediaVariantDto? card, MediaVariantDto? detail, MediaVariantDto? hero
});


$MediaVariantDtoCopyWith<$Res>? get thumbnail;$MediaVariantDtoCopyWith<$Res>? get card;$MediaVariantDtoCopyWith<$Res>? get detail;$MediaVariantDtoCopyWith<$Res>? get hero;

}
/// @nodoc
class _$MediaVariantsDtoCopyWithImpl<$Res>
    implements $MediaVariantsDtoCopyWith<$Res> {
  _$MediaVariantsDtoCopyWithImpl(this._self, this._then);

  final MediaVariantsDto _self;
  final $Res Function(MediaVariantsDto) _then;

/// Create a copy of MediaVariantsDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? thumbnail = freezed,Object? card = freezed,Object? detail = freezed,Object? hero = freezed,}) {
  return _then(_self.copyWith(
thumbnail: freezed == thumbnail ? _self.thumbnail : thumbnail // ignore: cast_nullable_to_non_nullable
as MediaVariantDto?,card: freezed == card ? _self.card : card // ignore: cast_nullable_to_non_nullable
as MediaVariantDto?,detail: freezed == detail ? _self.detail : detail // ignore: cast_nullable_to_non_nullable
as MediaVariantDto?,hero: freezed == hero ? _self.hero : hero // ignore: cast_nullable_to_non_nullable
as MediaVariantDto?,
  ));
}
/// Create a copy of MediaVariantsDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MediaVariantDtoCopyWith<$Res>? get thumbnail {
    if (_self.thumbnail == null) {
    return null;
  }

  return $MediaVariantDtoCopyWith<$Res>(_self.thumbnail!, (value) {
    return _then(_self.copyWith(thumbnail: value));
  });
}/// Create a copy of MediaVariantsDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MediaVariantDtoCopyWith<$Res>? get card {
    if (_self.card == null) {
    return null;
  }

  return $MediaVariantDtoCopyWith<$Res>(_self.card!, (value) {
    return _then(_self.copyWith(card: value));
  });
}/// Create a copy of MediaVariantsDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MediaVariantDtoCopyWith<$Res>? get detail {
    if (_self.detail == null) {
    return null;
  }

  return $MediaVariantDtoCopyWith<$Res>(_self.detail!, (value) {
    return _then(_self.copyWith(detail: value));
  });
}/// Create a copy of MediaVariantsDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MediaVariantDtoCopyWith<$Res>? get hero {
    if (_self.hero == null) {
    return null;
  }

  return $MediaVariantDtoCopyWith<$Res>(_self.hero!, (value) {
    return _then(_self.copyWith(hero: value));
  });
}
}


/// Adds pattern-matching-related methods to [MediaVariantsDto].
extension MediaVariantsDtoPatterns on MediaVariantsDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MediaVariantsDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MediaVariantsDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MediaVariantsDto value)  $default,){
final _that = this;
switch (_that) {
case _MediaVariantsDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MediaVariantsDto value)?  $default,){
final _that = this;
switch (_that) {
case _MediaVariantsDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( MediaVariantDto? thumbnail,  MediaVariantDto? card,  MediaVariantDto? detail,  MediaVariantDto? hero)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MediaVariantsDto() when $default != null:
return $default(_that.thumbnail,_that.card,_that.detail,_that.hero);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( MediaVariantDto? thumbnail,  MediaVariantDto? card,  MediaVariantDto? detail,  MediaVariantDto? hero)  $default,) {final _that = this;
switch (_that) {
case _MediaVariantsDto():
return $default(_that.thumbnail,_that.card,_that.detail,_that.hero);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( MediaVariantDto? thumbnail,  MediaVariantDto? card,  MediaVariantDto? detail,  MediaVariantDto? hero)?  $default,) {final _that = this;
switch (_that) {
case _MediaVariantsDto() when $default != null:
return $default(_that.thumbnail,_that.card,_that.detail,_that.hero);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MediaVariantsDto implements MediaVariantsDto {
  const _MediaVariantsDto({this.thumbnail, this.card, this.detail, this.hero});
  factory _MediaVariantsDto.fromJson(Map<String, dynamic> json) => _$MediaVariantsDtoFromJson(json);

@override final  MediaVariantDto? thumbnail;
@override final  MediaVariantDto? card;
@override final  MediaVariantDto? detail;
@override final  MediaVariantDto? hero;

/// Create a copy of MediaVariantsDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MediaVariantsDtoCopyWith<_MediaVariantsDto> get copyWith => __$MediaVariantsDtoCopyWithImpl<_MediaVariantsDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MediaVariantsDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MediaVariantsDto&&(identical(other.thumbnail, thumbnail) || other.thumbnail == thumbnail)&&(identical(other.card, card) || other.card == card)&&(identical(other.detail, detail) || other.detail == detail)&&(identical(other.hero, hero) || other.hero == hero));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,thumbnail,card,detail,hero);

@override
String toString() {
  return 'MediaVariantsDto(thumbnail: $thumbnail, card: $card, detail: $detail, hero: $hero)';
}


}

/// @nodoc
abstract mixin class _$MediaVariantsDtoCopyWith<$Res> implements $MediaVariantsDtoCopyWith<$Res> {
  factory _$MediaVariantsDtoCopyWith(_MediaVariantsDto value, $Res Function(_MediaVariantsDto) _then) = __$MediaVariantsDtoCopyWithImpl;
@override @useResult
$Res call({
 MediaVariantDto? thumbnail, MediaVariantDto? card, MediaVariantDto? detail, MediaVariantDto? hero
});


@override $MediaVariantDtoCopyWith<$Res>? get thumbnail;@override $MediaVariantDtoCopyWith<$Res>? get card;@override $MediaVariantDtoCopyWith<$Res>? get detail;@override $MediaVariantDtoCopyWith<$Res>? get hero;

}
/// @nodoc
class __$MediaVariantsDtoCopyWithImpl<$Res>
    implements _$MediaVariantsDtoCopyWith<$Res> {
  __$MediaVariantsDtoCopyWithImpl(this._self, this._then);

  final _MediaVariantsDto _self;
  final $Res Function(_MediaVariantsDto) _then;

/// Create a copy of MediaVariantsDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? thumbnail = freezed,Object? card = freezed,Object? detail = freezed,Object? hero = freezed,}) {
  return _then(_MediaVariantsDto(
thumbnail: freezed == thumbnail ? _self.thumbnail : thumbnail // ignore: cast_nullable_to_non_nullable
as MediaVariantDto?,card: freezed == card ? _self.card : card // ignore: cast_nullable_to_non_nullable
as MediaVariantDto?,detail: freezed == detail ? _self.detail : detail // ignore: cast_nullable_to_non_nullable
as MediaVariantDto?,hero: freezed == hero ? _self.hero : hero // ignore: cast_nullable_to_non_nullable
as MediaVariantDto?,
  ));
}

/// Create a copy of MediaVariantsDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MediaVariantDtoCopyWith<$Res>? get thumbnail {
    if (_self.thumbnail == null) {
    return null;
  }

  return $MediaVariantDtoCopyWith<$Res>(_self.thumbnail!, (value) {
    return _then(_self.copyWith(thumbnail: value));
  });
}/// Create a copy of MediaVariantsDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MediaVariantDtoCopyWith<$Res>? get card {
    if (_self.card == null) {
    return null;
  }

  return $MediaVariantDtoCopyWith<$Res>(_self.card!, (value) {
    return _then(_self.copyWith(card: value));
  });
}/// Create a copy of MediaVariantsDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MediaVariantDtoCopyWith<$Res>? get detail {
    if (_self.detail == null) {
    return null;
  }

  return $MediaVariantDtoCopyWith<$Res>(_self.detail!, (value) {
    return _then(_self.copyWith(detail: value));
  });
}/// Create a copy of MediaVariantsDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MediaVariantDtoCopyWith<$Res>? get hero {
    if (_self.hero == null) {
    return null;
  }

  return $MediaVariantDtoCopyWith<$Res>(_self.hero!, (value) {
    return _then(_self.copyWith(hero: value));
  });
}
}


/// @nodoc
mixin _$MediaAssetDto {

 String get id; String get entityType; String? get entityId; String get category; String get format; MediaVariantsDto get variants; double? get aspectRatio; String get version; String? get attribution; String? get license; String? get fallbackCategory;
/// Create a copy of MediaAssetDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MediaAssetDtoCopyWith<MediaAssetDto> get copyWith => _$MediaAssetDtoCopyWithImpl<MediaAssetDto>(this as MediaAssetDto, _$identity);

  /// Serializes this MediaAssetDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MediaAssetDto&&(identical(other.id, id) || other.id == id)&&(identical(other.entityType, entityType) || other.entityType == entityType)&&(identical(other.entityId, entityId) || other.entityId == entityId)&&(identical(other.category, category) || other.category == category)&&(identical(other.format, format) || other.format == format)&&(identical(other.variants, variants) || other.variants == variants)&&(identical(other.aspectRatio, aspectRatio) || other.aspectRatio == aspectRatio)&&(identical(other.version, version) || other.version == version)&&(identical(other.attribution, attribution) || other.attribution == attribution)&&(identical(other.license, license) || other.license == license)&&(identical(other.fallbackCategory, fallbackCategory) || other.fallbackCategory == fallbackCategory));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,entityType,entityId,category,format,variants,aspectRatio,version,attribution,license,fallbackCategory);

@override
String toString() {
  return 'MediaAssetDto(id: $id, entityType: $entityType, entityId: $entityId, category: $category, format: $format, variants: $variants, aspectRatio: $aspectRatio, version: $version, attribution: $attribution, license: $license, fallbackCategory: $fallbackCategory)';
}


}

/// @nodoc
abstract mixin class $MediaAssetDtoCopyWith<$Res>  {
  factory $MediaAssetDtoCopyWith(MediaAssetDto value, $Res Function(MediaAssetDto) _then) = _$MediaAssetDtoCopyWithImpl;
@useResult
$Res call({
 String id, String entityType, String? entityId, String category, String format, MediaVariantsDto variants, double? aspectRatio, String version, String? attribution, String? license, String? fallbackCategory
});


$MediaVariantsDtoCopyWith<$Res> get variants;

}
/// @nodoc
class _$MediaAssetDtoCopyWithImpl<$Res>
    implements $MediaAssetDtoCopyWith<$Res> {
  _$MediaAssetDtoCopyWithImpl(this._self, this._then);

  final MediaAssetDto _self;
  final $Res Function(MediaAssetDto) _then;

/// Create a copy of MediaAssetDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? entityType = null,Object? entityId = freezed,Object? category = null,Object? format = null,Object? variants = null,Object? aspectRatio = freezed,Object? version = null,Object? attribution = freezed,Object? license = freezed,Object? fallbackCategory = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,entityType: null == entityType ? _self.entityType : entityType // ignore: cast_nullable_to_non_nullable
as String,entityId: freezed == entityId ? _self.entityId : entityId // ignore: cast_nullable_to_non_nullable
as String?,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,format: null == format ? _self.format : format // ignore: cast_nullable_to_non_nullable
as String,variants: null == variants ? _self.variants : variants // ignore: cast_nullable_to_non_nullable
as MediaVariantsDto,aspectRatio: freezed == aspectRatio ? _self.aspectRatio : aspectRatio // ignore: cast_nullable_to_non_nullable
as double?,version: null == version ? _self.version : version // ignore: cast_nullable_to_non_nullable
as String,attribution: freezed == attribution ? _self.attribution : attribution // ignore: cast_nullable_to_non_nullable
as String?,license: freezed == license ? _self.license : license // ignore: cast_nullable_to_non_nullable
as String?,fallbackCategory: freezed == fallbackCategory ? _self.fallbackCategory : fallbackCategory // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of MediaAssetDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MediaVariantsDtoCopyWith<$Res> get variants {
  
  return $MediaVariantsDtoCopyWith<$Res>(_self.variants, (value) {
    return _then(_self.copyWith(variants: value));
  });
}
}


/// Adds pattern-matching-related methods to [MediaAssetDto].
extension MediaAssetDtoPatterns on MediaAssetDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MediaAssetDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MediaAssetDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MediaAssetDto value)  $default,){
final _that = this;
switch (_that) {
case _MediaAssetDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MediaAssetDto value)?  $default,){
final _that = this;
switch (_that) {
case _MediaAssetDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String entityType,  String? entityId,  String category,  String format,  MediaVariantsDto variants,  double? aspectRatio,  String version,  String? attribution,  String? license,  String? fallbackCategory)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MediaAssetDto() when $default != null:
return $default(_that.id,_that.entityType,_that.entityId,_that.category,_that.format,_that.variants,_that.aspectRatio,_that.version,_that.attribution,_that.license,_that.fallbackCategory);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String entityType,  String? entityId,  String category,  String format,  MediaVariantsDto variants,  double? aspectRatio,  String version,  String? attribution,  String? license,  String? fallbackCategory)  $default,) {final _that = this;
switch (_that) {
case _MediaAssetDto():
return $default(_that.id,_that.entityType,_that.entityId,_that.category,_that.format,_that.variants,_that.aspectRatio,_that.version,_that.attribution,_that.license,_that.fallbackCategory);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String entityType,  String? entityId,  String category,  String format,  MediaVariantsDto variants,  double? aspectRatio,  String version,  String? attribution,  String? license,  String? fallbackCategory)?  $default,) {final _that = this;
switch (_that) {
case _MediaAssetDto() when $default != null:
return $default(_that.id,_that.entityType,_that.entityId,_that.category,_that.format,_that.variants,_that.aspectRatio,_that.version,_that.attribution,_that.license,_that.fallbackCategory);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MediaAssetDto implements MediaAssetDto {
  const _MediaAssetDto({required this.id, required this.entityType, this.entityId, required this.category, required this.format, required this.variants, this.aspectRatio, required this.version, this.attribution, this.license, this.fallbackCategory});
  factory _MediaAssetDto.fromJson(Map<String, dynamic> json) => _$MediaAssetDtoFromJson(json);

@override final  String id;
@override final  String entityType;
@override final  String? entityId;
@override final  String category;
@override final  String format;
@override final  MediaVariantsDto variants;
@override final  double? aspectRatio;
@override final  String version;
@override final  String? attribution;
@override final  String? license;
@override final  String? fallbackCategory;

/// Create a copy of MediaAssetDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MediaAssetDtoCopyWith<_MediaAssetDto> get copyWith => __$MediaAssetDtoCopyWithImpl<_MediaAssetDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MediaAssetDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MediaAssetDto&&(identical(other.id, id) || other.id == id)&&(identical(other.entityType, entityType) || other.entityType == entityType)&&(identical(other.entityId, entityId) || other.entityId == entityId)&&(identical(other.category, category) || other.category == category)&&(identical(other.format, format) || other.format == format)&&(identical(other.variants, variants) || other.variants == variants)&&(identical(other.aspectRatio, aspectRatio) || other.aspectRatio == aspectRatio)&&(identical(other.version, version) || other.version == version)&&(identical(other.attribution, attribution) || other.attribution == attribution)&&(identical(other.license, license) || other.license == license)&&(identical(other.fallbackCategory, fallbackCategory) || other.fallbackCategory == fallbackCategory));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,entityType,entityId,category,format,variants,aspectRatio,version,attribution,license,fallbackCategory);

@override
String toString() {
  return 'MediaAssetDto(id: $id, entityType: $entityType, entityId: $entityId, category: $category, format: $format, variants: $variants, aspectRatio: $aspectRatio, version: $version, attribution: $attribution, license: $license, fallbackCategory: $fallbackCategory)';
}


}

/// @nodoc
abstract mixin class _$MediaAssetDtoCopyWith<$Res> implements $MediaAssetDtoCopyWith<$Res> {
  factory _$MediaAssetDtoCopyWith(_MediaAssetDto value, $Res Function(_MediaAssetDto) _then) = __$MediaAssetDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String entityType, String? entityId, String category, String format, MediaVariantsDto variants, double? aspectRatio, String version, String? attribution, String? license, String? fallbackCategory
});


@override $MediaVariantsDtoCopyWith<$Res> get variants;

}
/// @nodoc
class __$MediaAssetDtoCopyWithImpl<$Res>
    implements _$MediaAssetDtoCopyWith<$Res> {
  __$MediaAssetDtoCopyWithImpl(this._self, this._then);

  final _MediaAssetDto _self;
  final $Res Function(_MediaAssetDto) _then;

/// Create a copy of MediaAssetDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? entityType = null,Object? entityId = freezed,Object? category = null,Object? format = null,Object? variants = null,Object? aspectRatio = freezed,Object? version = null,Object? attribution = freezed,Object? license = freezed,Object? fallbackCategory = freezed,}) {
  return _then(_MediaAssetDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,entityType: null == entityType ? _self.entityType : entityType // ignore: cast_nullable_to_non_nullable
as String,entityId: freezed == entityId ? _self.entityId : entityId // ignore: cast_nullable_to_non_nullable
as String?,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,format: null == format ? _self.format : format // ignore: cast_nullable_to_non_nullable
as String,variants: null == variants ? _self.variants : variants // ignore: cast_nullable_to_non_nullable
as MediaVariantsDto,aspectRatio: freezed == aspectRatio ? _self.aspectRatio : aspectRatio // ignore: cast_nullable_to_non_nullable
as double?,version: null == version ? _self.version : version // ignore: cast_nullable_to_non_nullable
as String,attribution: freezed == attribution ? _self.attribution : attribution // ignore: cast_nullable_to_non_nullable
as String?,license: freezed == license ? _self.license : license // ignore: cast_nullable_to_non_nullable
as String?,fallbackCategory: freezed == fallbackCategory ? _self.fallbackCategory : fallbackCategory // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of MediaAssetDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$MediaVariantsDtoCopyWith<$Res> get variants {
  
  return $MediaVariantsDtoCopyWith<$Res>(_self.variants, (value) {
    return _then(_self.copyWith(variants: value));
  });
}
}

// dart format on
