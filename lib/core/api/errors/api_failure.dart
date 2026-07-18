import 'error_dto.dart';

/// Internal, provider-agnostic failure categories (TRD section 20). Server error
/// codes and transport errors map to these; UI copy is derived from the category
/// rather than from raw server text.
enum ApiFailureKind {
  networkUnavailable,
  networkTimeout,
  rateLimited,
  serverUnavailable,
  invalidResponse,
  unsupportedApiVersion,
  notFound,
  invalidRequest,
  maintenance,
  unknown,
}

class ApiFailure {
  const ApiFailure({
    required this.kind,
    this.retryable = false,
    this.requestId,
    this.code,
  });

  final ApiFailureKind kind;
  final bool retryable;
  final String? requestId;
  final String? code;

  /// Maps a server error envelope body to an internal failure category.
  factory ApiFailure.fromError(ErrorDto error) {
    final kind = switch (error.code) {
      'INVALID_PARAMETER' => ApiFailureKind.invalidRequest,
      'SEASON_NOT_FOUND' ||
      'RESOURCE_NOT_FOUND' ||
      'RESOURCE_NOT_AVAILABLE' => ApiFailureKind.notFound,
      'SNAPSHOT_NOT_READY' ||
      'UPSTREAM_UNAVAILABLE' => ApiFailureKind.serverUnavailable,
      'UPSTREAM_RATE_LIMITED' => ApiFailureKind.rateLimited,
      'MAINTENANCE' => ApiFailureKind.maintenance,
      'METHOD_NOT_ALLOWED' ||
      'INTERNAL_ERROR' => ApiFailureKind.invalidResponse,
      _ => ApiFailureKind.unknown,
    };
    return ApiFailure(
      kind: kind,
      retryable: error.retryable,
      requestId: error.requestId,
      code: error.code,
    );
  }
}
