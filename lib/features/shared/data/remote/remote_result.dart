import '../../../../core/api/envelope/meta_dto.dart';
import '../../../../core/api/errors/api_failure.dart';

/// The typed outcome of a conditional remote read.
///
/// This is the single result type crossing the remote-data boundary. It models
/// the three conditional-request outcomes explicitly:
///
/// - [RemoteModified] — HTTP 200: a fresh representation, with its parsed data,
///   response `meta`, entity tag and correlation id.
/// - [RemoteNotModified] — HTTP 304: the caller's cached representation is still
///   valid. It carries **no body** and is a first-class success, never an
///   exception.
/// - [RemoteFailure] — a typed, provider-agnostic [ApiFailure]. Raw transport
///   types (Dio), server text and SQLite errors never appear here.
///
/// No Dio `Response`, `DioException` or `CancelToken` is ever exposed through
/// this type.
sealed class RemoteResult<T> {
  const RemoteResult();
}

/// HTTP 200 — a fresh representation.
class RemoteModified<T> extends RemoteResult<T> {
  const RemoteModified({
    required this.data,
    required this.meta,
    this.etag,
    this.requestId,
  });

  /// The parsed `data` payload (a DTO or a list of DTOs).
  final T data;

  /// The parsed response `meta` (provenance + api version + request id).
  final MetaDto meta;

  /// The response entity tag, to persist for the next conditional request.
  final String? etag;

  /// The `X-Request-Id`, preserved for development-safe diagnostics.
  final String? requestId;
}

/// HTTP 304 — the cached representation is still valid. Carries no body.
class RemoteNotModified<T> extends RemoteResult<T> {
  const RemoteNotModified({this.etag, this.requestId});

  /// A replacement entity tag if the server supplied one, else null. When null,
  /// the previously stored ETag remains valid.
  final String? etag;

  final String? requestId;
}

/// A typed transport or contract failure. Cached data (if any) is preserved by
/// the caller; [failure] carries the provider-agnostic reason.
class RemoteFailure<T> extends RemoteResult<T> {
  const RemoteFailure(this.failure);

  final ApiFailure failure;
}
