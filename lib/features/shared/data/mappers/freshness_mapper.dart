import '../../../../core/api/dto/view_dto.dart';
import '../../../../core/api/envelope/meta_dto.dart';
import '../../domain/entities/freshness.dart';
import 'wire.dart';

/// Maps the standalone `freshness` object (carried by the Home view model) to a
/// domain [DataFreshness]. All instants are normalised to UTC.
DataFreshness freshnessFromDto(DataFreshnessDto dto) => DataFreshness(
  generatedAt: DateTime.parse(dto.generatedAt).toUtc(),
  sourceUpdatedAt: instantFromWire(dto.sourceUpdatedAt),
  staleAfter: instantFromWire(dto.staleAfter),
  contentVersion: dto.contentVersion,
  stale: dto.stale,
);

/// Maps response `meta` provenance to a domain [DataFreshness]. Used where a
/// resource (e.g. Grand Prix detail) does not embed its own freshness object.
DataFreshness freshnessFromMeta(MetaDto meta) => DataFreshness(
  generatedAt: DateTime.parse(meta.generatedAt).toUtc(),
  sourceUpdatedAt: instantFromWire(meta.sourceUpdatedAt),
  staleAfter: instantFromWire(meta.staleAfter),
  contentVersion: meta.contentVersion,
);
