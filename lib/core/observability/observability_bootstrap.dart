import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../app/environment/app_environment.dart';
import 'deferred_observability.dart';
import 'firebase/firebase_observability.dart';
import 'global_error_handlers.dart';
import 'observability.dart';
import 'observability_status.dart';

/// Produces the platform adapters, or null when activation is not possible.
///
/// The injection seam. Production passes the real Firebase activation; tests
/// pass a function that succeeds, fails, or never completes — so every startup
/// path is exercised without a Firebase project, a network or a platform
/// channel.
typedef ObservabilityActivator = Future<FirebaseAdapters?> Function();

/// What [installObservability] hands back.
class ObservabilityBootstrap {
  const ObservabilityBootstrap({
    required this.surface,
    required this.handlers,
    required this.activation,
  });

  /// The surface to publish into the provider graph.
  final Observability surface;

  /// The installed global handlers, so a test can hand ownership back.
  final GlobalErrorHandlerRegistration handlers;

  /// Completes when activation has resolved one way or the other.
  ///
  /// **Production never awaits this.** It exists so a test can assert what
  /// happened after activation without polling, and so the fact that the app
  /// does not wait is visible at the call site rather than implied.
  final Future<void> activation;
}

/// Installs global error routing and starts observability activation.
///
/// Ordering, and why:
///
/// 1. the deferred delegates are created and the global handlers are installed
///    against them **synchronously**, so from this point on every framework and
///    uncaught asynchronous error has an owner — including errors thrown by the
///    rest of startup;
/// 2. if the build is not eligible, the delegates are settled inert immediately
///    and nothing else happens;
/// 3. otherwise activation starts in the background and is **never awaited**.
///
/// Errors arriving during step 3's window are buffered by
/// [DeferredErrorReporter] and replayed on adoption, or discarded if activation
/// fails. Nothing here issues a request, opens a database, schedules
/// synchronization or touches media.
ObservabilityBootstrap installObservability({
  required AppEnvironment environment,
  ObservabilityActivator? activator,
  DateTime Function() now = DateTime.now,
  int bufferLimit = kDefaultStartupBufferLimit,
}) {
  final DeferredErrorReporter reporter = DeferredErrorReporter(
    bufferLimit: bufferLimit,
  );
  final DeferredPerformanceTracer tracer = DeferredPerformanceTracer();
  final GlobalErrorHandlerRegistration handlers = installGlobalErrorHandlers(
    reporter,
  );

  final ValueNotifier<ObservabilityStatus> status =
      ValueNotifier<ObservabilityStatus>(ObservabilityStatus.disabledByPolicy);

  final Observability surface = Observability(
    reporter: reporter,
    tracer: tracer,
    status: status,
  );

  if (!isObservabilityEligible(environment)) {
    reporter.disable();
    tracer.disable();
    return ObservabilityBootstrap(
      surface: surface,
      handlers: handlers,
      activation: Future<void>.value(),
    );
  }

  status.value = ObservabilityStatus.pending;
  final ObservabilityActivator activate =
      activator ?? () => activateFirebaseObservability(now: now);

  return ObservabilityBootstrap(
    surface: surface,
    handlers: handlers,
    activation: _activate(activate, reporter, tracer, status),
  );
}

/// Resolves activation exactly once, and can never throw.
///
/// A throw here would become an uncaught asynchronous error, which the handlers
/// installed moments earlier would route straight back into the reporter that
/// just failed to activate.
Future<void> _activate(
  ObservabilityActivator activate,
  DeferredErrorReporter reporter,
  DeferredPerformanceTracer tracer,
  ValueNotifier<ObservabilityStatus> status,
) async {
  FirebaseAdapters? adapters;
  try {
    adapters = await activate();
  } catch (_) {
    adapters = null;
  }

  if (adapters == null) {
    reporter.disable();
    tracer.disable();
    status.value = ObservabilityStatus.unavailable;
    return;
  }

  // Adoption flushes the startup buffer; both are one-way.
  reporter.adopt(adapters.reporter);
  tracer.adopt(adapters.tracer);
  status.value = ObservabilityStatus.activated;
}
