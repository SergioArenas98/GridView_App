import '../../../../core/api/envelope/meta_dto.dart';
import '../../../../core/api/errors/api_exception.dart';
import '../../../../core/api/errors/api_failure.dart';

/// Enforces the snapshot contract at the remote boundary.
///
/// `SnapshotMeta` (and `SeasonSnapshotMeta`, used by every home and Grand Prix
/// response) **requires** `sourceUpdatedAt` — it is the source-revision the
/// conflict rule orders by. A snapshot response missing it is contract-invalid,
/// so it is rejected here as a typed [ApiFailureKind.invalidResponse] failure
/// **before** it can reach the repository, the database or the conflict rule.
/// It must never fall back to `generatedAt` ordering.
void requireSnapshotMeta(MetaDto meta) {
  if (meta.sourceUpdatedAt == null) {
    throw const GridViewApiException(
      ApiFailure(kind: ApiFailureKind.invalidResponse),
    );
  }
}
