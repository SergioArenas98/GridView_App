import '../../../core/api/errors/api_failure.dart';

/// Transient refresh status owned by a feature controller: whether a background
/// refresh is running and the last refresh failure (if any). Content itself
/// always comes from the Drift-backed streams, never from this object.
class RefreshStatus {
  const RefreshStatus({this.inProgress = false, this.lastFailure});

  final bool inProgress;
  final ApiFailure? lastFailure;

  static const RefreshStatus idle = RefreshStatus();
  static const RefreshStatus running = RefreshStatus(inProgress: true);

  RefreshStatus failed(ApiFailure failure) =>
      RefreshStatus(lastFailure: failure);
}
