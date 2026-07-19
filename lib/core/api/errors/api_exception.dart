import 'api_failure.dart';

/// The single exception type thrown by the remote data source.
///
/// It carries a provider-agnostic [ApiFailure] so the repository/application
/// boundary catches exactly one type and maps it to typed domain state. Raw Dio
/// exceptions, SQLite errors and server text never propagate past this
/// boundary (TRD §20.1).
class GridViewApiException implements Exception {
  const GridViewApiException(this.failure);

  final ApiFailure failure;

  @override
  String toString() => 'GridViewApiException(${failure.kind})';
}
