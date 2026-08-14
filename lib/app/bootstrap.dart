import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/observability/observability_bootstrap.dart';
import '../core/observability/observability_providers.dart';
import '../core/preferences/preferences_providers.dart';
import '../core/preferences/preferences_repository.dart';
import '../core/time/timezones.dart';
import '../features/sync/application/app_sync_lifecycle.dart';
import 'app.dart';
import 'environment/app_environment.dart';

/// Initializes essential local services and global error handling, then runs the
/// application.
///
/// The shell starts fully offline: no network client, advertising or backend
/// dependency is initialized here. Only two things are awaited, and both are
/// local and bounded:
///
/// * the IANA timezone database, so session times can render in event-local time
///   before the first Home refresh completes;
/// * the user's persisted preferences, so the first frame already has the right
///   theme and language instead of flashing the defaults and correcting itself.
///
/// A preference store that cannot be opened is **not** a launch failure: the
/// repository falls back to safe defaults and the shell still renders.
///
/// ## Observability is not on this path
///
/// Firebase is **never awaited before `runApp`**. The global error handlers are
/// installed synchronously against a [DeferredErrorReporter], so an error thrown
/// during startup already has an owner, and the platform SDK is then activated
/// in the background. Whether that activation succeeds, fails or never returns,
/// the first frame is unaffected — the delegate simply stays inert.
///
/// Nothing here issues a request, schedules synchronization or touches media:
/// activation initializes the SDK and hands back a reporter, and that is all.
Future<void> bootstrap({AppEnvironment? environment}) async {
  WidgetsFlutterBinding.ensureInitialized();

  final AppEnvironment env = environment ?? AppEnvironment.current;

  // Installs the global handlers synchronously and starts activation in the
  // background. `bootstrap` deliberately ignores `activation`: observability
  // may take as long as it likes, or never finish at all, and the first frame
  // is unaffected either way.
  final ObservabilityBootstrap observability = installObservability(
    environment: env,
  );

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
        // The app and the global error handlers share one reporter, so a crash
        // and a selected non-fatal can never take different paths.
        observabilityProvider.overrideWithValue(observability.surface),
      ].cast(),
      child: const AppSyncLifecycleScope(child: GridViewApp()),
    ),
  );
}
