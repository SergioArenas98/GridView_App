// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'error_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ErrorDto _$ErrorDtoFromJson(Map<String, dynamic> json) => _ErrorDto(
  code: json['code'] as String,
  message: json['message'] as String,
  retryable: json['retryable'] as bool,
  requestId: json['requestId'] as String,
);

Map<String, dynamic> _$ErrorDtoToJson(_ErrorDto instance) => <String, dynamic>{
  'code': instance.code,
  'message': instance.message,
  'retryable': instance.retryable,
  'requestId': instance.requestId,
};

_ErrorEnvelopeDto _$ErrorEnvelopeDtoFromJson(Map<String, dynamic> json) =>
    _ErrorEnvelopeDto(
      error: ErrorDto.fromJson(json['error'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$ErrorEnvelopeDtoToJson(_ErrorEnvelopeDto instance) =>
    <String, dynamic>{'error': instance.error};
