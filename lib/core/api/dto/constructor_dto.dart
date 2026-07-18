import 'package:freezed_annotation/freezed_annotation.dart';

import 'media_dto.dart';

part 'constructor_dto.freezed.dart';
part 'constructor_dto.g.dart';

@freezed
abstract class ConstructorDto with _$ConstructorDto {
  const factory ConstructorDto({
    required String id,
    required String name,
    String? shortName,
    String? nationality,
    String? countryCode,
    String? colorPrimary,
    String? biography,
    List<MediaAssetDto>? media,
  }) = _ConstructorDto;

  factory ConstructorDto.fromJson(Map<String, dynamic> json) =>
      _$ConstructorDtoFromJson(json);
}
