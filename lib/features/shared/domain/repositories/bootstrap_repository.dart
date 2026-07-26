import '../../data/remote/remote_cancellation.dart';
import '../refresh_result.dart';

/// Domain-facing repository for the first-launch aggregate (`GET /v1/bootstrap`).
///
/// Bootstrap is one conditional HTTP resource like any other: it owns a single
/// canonical key, a single ETag and a single snapshot provenance. A modified
/// response is applied as **one** transaction covering every compact family the
/// contract defines, so the local database never holds a half-applied bootstrap.
abstract interface class BootstrapRepository {
  /// Whether a bootstrap representation is locally materialized: a recorded
  /// successful bootstrap **and** the current-season identity its stored data
  /// needs in order to render. A legitimately empty collection inside an
  /// otherwise materialized bootstrap still counts as materialized.
  Future<bool> isMaterialized();

  /// Runs one conditional bootstrap synchronization for the server's current
  /// season.
  ///
  /// [bypassValidator] is the low-level option that drops the stored
  /// `If-None-Match`; ordinary automatic and user-initiated refreshes keep the
  /// validator and must not set it.
  Future<RefreshResult> refreshBootstrap({
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  });
}
