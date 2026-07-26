import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/time/timezones.dart';
import '../features/sync/application/app_sync_lifecycle.dart';
import 'app.dart';

/// Initializes essential services and global error handling, then runs the
/// application.
///
/// The shell starts fully offline: no network client, Firebase, advertising
/// or backend dependency is initialized here. Those integrations are added in
/// later phases behind this single entry point.
Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    // Crash reporting is integrated in Phase 8 (Firebase tasks).
  };

  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    // Forwarded to crash reporting once it exists (Phase 8). Until then the
    // error is surfaced in logs so it is never silently lost.
    debugPrint('Uncaught error: $error\n$stack');
    return true;
  };

  // Load the IANA timezone database so session times can render in event-local
  // time before the first Home refresh completes.
  ensureTimeZonesInitialized();

  // The ProviderScope owns the app's dependency graph (database, remote data
  // source, repositories, controllers) for its lifetime.
  //
  // [AppSyncLifecycleScope] is mounted here, at the composition root, so the
  // single application-level synchronization owner is wired once and never by a
  // screen. It schedules the startup run *after the first frame*: the shell and
  // any cached content render before a byte of network work begins.
  runApp(
    const ProviderScope(child: AppSyncLifecycleScope(child: GridViewApp())),
  );
}
