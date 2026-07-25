import '../refresh_result.dart';

/// Domain-facing repository for the curated content/media manifest.
///
/// The manifest is metadata (versions + supported seasons + minimum schema); no
/// image bytes are ever downloaded. Only the approved metadata is tracked — its
/// content version is persisted in the resource sync metadata so the app can
/// decide whether long-lived profile content needs refreshing.
abstract interface class ContentRepository {
  /// The last successfully synchronized content version, or null.
  Future<String?> readContentVersion();
  Future<RefreshResult> refreshContentManifest({bool forceRefresh = false});
}
