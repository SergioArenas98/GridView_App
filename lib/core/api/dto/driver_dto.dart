import 'package:freezed_annotation/freezed_annotation.dart';

import 'media_dto.dart';

part 'driver_dto.freezed.dart';
part 'driver_dto.g.dart';

@freezed
abstract class DriverDto with _$DriverDto {
  const factory DriverDto({
    required String id,
    required String fullName,
    String? givenName,
    String? familyName,
    String? shortCode,
    int? permanentNumber,
    String? nationality,
    String? countryCode,
    String? dateOfBirth,
    String? placeOfBirth,
    String? biography,
    List<MediaAssetDto>? media,
  }) = _DriverDto;

  factory DriverDto.fromJson(Map<String, dynamic> json) =>
      _$DriverDtoFromJson(json);
}
