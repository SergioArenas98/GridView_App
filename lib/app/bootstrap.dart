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

  await runBootstrap(
    BootstrapOperations(
      installObservability: () => installObservability(environment: env),
      ensureTimeZones: ensureTimeZonesInitialized,
      openPreferences: AppPreferencesRepository.open,
      runApplication: runApp,
    ),
  );
}

/// The four startup operations [bootstrap] performs, as injectable functions.
///
/// This exists so the **ordering itself** can be tested. Startup order is the
/// whole contract here — handlers before anything that can fail, timezones and
/// preferences before the first frame, activation never blocking it — and a
/// test that rebuilt an equivalent sequence would only prove that the copy was
/// ordered correctly. [runBootstrap] owns the order; production and tests both
/// call it, differing only in what these four functions do.
@visibleForTesting
class BootstrapOperations {
  const BootstrapOperations({
    required this.installObservability,
    required this.ensureTimeZones,
    required this.openPreferences,
    required this.runApplication,
  });

  /// Installs global error routing and starts activation in the background.
  final ObservabilityBootstrap Function() installObservability;

  /// Loads the IANA timezone database. Local, synchronous and bounded.
  final void Function() ensureTimeZones;

  /// Opens the persisted preferences. Local and bounded; never a launch
  /// failure, because the repository falls back to documented defaults.
  final Future<AppPreferencesRepository> Function() openPreferences;

  /// Hands the composed application to the framework.
  final void Function(Widget app) runApplication;
}

/// The real startup orchestration, shared by production and its tests.
///
/// Returns the [ObservabilityBootstrap] so a caller that cares — only a test
/// does — can await `activation` and inspect what happened afterwards.
/// Production discards it, which is precisely the point: nothing here awaits
/// activation, so the first frame cannot be delayed by it.
@visibleForTesting
Future<ObservabilityBootstrap> runBootstrap(
  BootstrapOperations operations,
) async {
  // First, and synchronously. From this point every framework and uncaught
  // asynchronous error has an owner — including one thrown by the two startup
  // steps below, which run after this line for exactly that reason.
  final ObservabilityBootstrap observability = operations
      .installObservability();

  operations.ensureTimeZones();

  final AppPreferencesRepository preferences = await operations
      .openPreferences();

  // The ProviderScope owns the app's dependency graph (preferences, database,
  // remote data source, repositories, controllers) for its lifetime.
  //
  // [AppSyncLifecycleScope] is mounted here, at the composition root, so the
  // single application-level synchronization owner is wired once and never by a
  // screen. It schedules the startup run *after the first frame*: the shell and
  // any cached content render before a byte of network work begins.
  operations.runApplication(
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

  return observability;
}
