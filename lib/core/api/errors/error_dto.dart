import 'package:freezed_annotation/freezed_annotation.dart';

part 'error_dto.freezed.dart';
part 'error_dto.g.dart';

/// Error body DTO. `code` is carried as a raw string; the mapper resolves it to
/// an internal failure category (see api_failure.dart).
@freezed
abstract class ErrorDto with _$ErrorDto {
  const factory ErrorDto({
    required String code,
    required String message,
    required bool retryable,
    required String requestId,
  }) = _ErrorDto;

  factory ErrorDto.fromJson(Map<String, dynamic> json) =>
      _$ErrorDtoFromJson(json);
}

@freezed
abstract class ErrorEnvelopeDto with _$ErrorEnvelopeDto {
  const factory ErrorEnvelopeDto({required ErrorDto error}) = _ErrorEnvelopeDto;

  factory ErrorEnvelopeDto.fromJson(Map<String, dynamic> json) =>
      _$ErrorEnvelopeDtoFromJson(json);
}
