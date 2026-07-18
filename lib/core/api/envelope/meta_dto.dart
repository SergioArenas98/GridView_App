import 'package:freezed_annotation/freezed_annotation.dart';

part 'meta_dto.freezed.dart';
part 'meta_dto.g.dart';

/// Response metadata DTO. Covers all three contract variants (BaseMeta,
/// SnapshotMeta, SeasonSnapshotMeta); the snapshot-only fields are nullable at
/// the DTO boundary and are populated when a response is served from a snapshot.
@freezed
abstract class MetaDto with _$MetaDto {
  const factory MetaDto({
    required String apiVersion,
    required String generatedAt,
    required String requestId,
    int? schemaVersion,
    int? season,
    String? sourceUpdatedAt,
    String? staleAfter,
    String? contentVersion,
  }) = _MetaDto;

  factory MetaDto.fromJson(Map<String, dynamic> json) =>
      _$MetaDtoFromJson(json);
}
