import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/preferences/preferences_providers.dart';
import '../core/preferences/preferences_repository.dart';
import '../core/time/timezones.dart';
import '../features/sync/application/app_sync_lifecycle.dart';
import 'app.dart';

/// Initializes essential local services and global error handling, then runs the
/// application.
///
/// The shell starts fully offline: no network client, Firebase, advertising or
/// backend dependency is initialized here. Only two things are awaited, and both
/// are local and bounded:
///
/// * the IANA timezone database, so session times can render in event-local time
///   before the first Home refresh completes;
/// * the user's persisted preferences, so the first frame already has the right
///   theme and language instead of flashing the defaults and correcting itself.
///
/// A preference store that cannot be opened is **not** a launch failure: the
/// repository falls back to safe defaults and the shell still renders.
Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  installGlobalErrorHandlers();

  // Load the IANA timezone database once. Local, synchronous and bounded.
  ensureTimeZonesInitialized();

  // Preferences are local essential startup state: no network is involved and
  // there is no blocking fixed-duration splash.
  final AppPreferencesRepository preferences =
      await AppPreferencesRepository.open();

  // The ProviderScope owns the app's dependency graph (preferences, database,
  // remote data source, repositories, controllers) for its lifetime.
  //
  // [AppSyncLifecycleScope] is mounted here, at the composition root, so the
  // single application-level synchronization owner is wired once and never by a
  // screen. It schedules the startup run *after the first frame*: the shell and
  // any cached content render before a byte of network work begins.
  runApp(
    ProviderScope(
      // `Override` is not exported by flutter_riverpod's show-list, so the list
      // literal is left unannotated rather than typed.
      overrides: <dynamic>[
        appPreferencesRepositoryProvider.overrideWithValue(preferences),
      ].cast(),
      child: const AppSyncLifecycleScope(child: GridViewApp()),
    ),
  );
}

/// Routes framework and platform errors into the application's error handling.
///
/// Kept separate from [bootstrap] so tests can install the same handlers without
/// starting the app. Flutter's normal debug presentation is preserved: an error
/// is reported *in addition to* being printed, never instead of it.
void installGlobalErrorHandlers() {
  final FlutterExceptionHandler? previousOnError = FlutterError.onError;

  FlutterError.onError = (FlutterErrorDetails details) {
    previousOnError?.call(details);
  };

  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    FlutterError.reportError(
      FlutterErrorDetails(
        exception: error,
        stack: stack,
        library: 'gridview',
        context: ErrorDescription('in an unhandled asynchronous callback'),
      ),
    );
    return true;
  };
}
