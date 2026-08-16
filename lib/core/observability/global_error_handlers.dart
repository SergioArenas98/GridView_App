// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import 'error_reporter.dart';

/// The `PlatformDispatcher.onError` signature. `ErrorCallback` is not exported
/// by `flutter/foundation`, so the function type is written out.
typedef _PlatformErrorHandler = bool Function(Object, StackTrace);

/// Undoes an [installGlobalErrorHandlers] call — but only if this component is
/// still the owner.
///
/// Global handlers are process-wide state with no ownership protocol: whoever
/// assigns last wins. A naive `restore()` that reinstates its saved handlers
/// unconditionally will happily delete a *later* owner's handlers, which in a
/// test suite silently disables error routing for every test that follows.
///
/// So restoration is conditional. Each handler is put back only if the value
/// currently installed is still the exact closure this registration installed.
/// If someone else has taken over, that half is left alone. Restoration is
/// idempotent: calling it repeatedly is safe and does nothing after the first
/// successful restore.
class GlobalErrorHandlerRegistration {
  GlobalErrorHandlerRegistration._({
    required FlutterExceptionHandler? previousFlutterOnError,
    required _PlatformErrorHandler? previousPlatformOnError,
    required FlutterExceptionHandler installedFlutterOnError,
    required _PlatformErrorHandler installedPlatformOnError,
  }) : _previousFlutterOnError = previousFlutterOnError,
       _previousPlatformOnError = previousPlatformOnError,
       _installedFlutterOnError = installedFlutterOnError,
       _installedPlatformOnError = installedPlatformOnError;

  final FlutterExceptionHandler? _previousFlutterOnError;
  final _PlatformErrorHandler? _previousPlatformOnError;
  final FlutterExceptionHandler _installedFlutterOnError;
  final _PlatformErrorHandler _installedPlatformOnError;

  /// Whether this registration still owns `FlutterError.onError`.
  bool get ownsFlutterHandler =>
      identical(FlutterError.onError, _installedFlutterOnError);

  /// Whether this registration still owns `PlatformDispatcher.onError`.
  bool get ownsPlatformHandler =>
      identical(PlatformDispatcher.instance.onError, _installedPlatformOnError);

  /// Reinstates the previous handlers, per handler, only where this
  /// registration is still the installed owner.
  ///
  /// Returns true when both halves were restored (or had already been restored
  /// by an earlier call); false when at least one was left alone because
  /// another owner had replaced it.
  bool restore() {
    bool complete = true;

    if (ownsFlutterHandler) {
      FlutterError.onError = _previousFlutterOnError;
    } else if (!identical(FlutterError.onError, _previousFlutterOnError)) {
      complete = false;
    }

    if (ownsPlatformHandler) {
      PlatformDispatcher.instance.onError = _previousPlatformOnError;
    } else if (!identical(
      PlatformDispatcher.instance.onError,
      _previousPlatformOnError,
    )) {
      complete = false;
    }

    return complete;
  }
}

/// Routes framework and platform errors into [reporter].
///
/// ## Ownership
///
/// Exactly one boundary *reports*, and the other only *converts*:
///
/// * **`FlutterError.onError` — the single reporting owner.** Every fatal error
///   is recorded here and nowhere else.
/// * **`PlatformDispatcher.instance.onError` — capture and convert.** An
///   uncaught asynchronous error on the root isolate is wrapped in
///   [FlutterErrorDetails] and handed to `FlutterError.reportError`, which
///   invokes `FlutterError.onError`. It never calls the reporter itself, and it
///   returns `true` to claim the error.
///
/// That is why an asynchronous error is reported exactly once despite passing
/// through both handlers: the second one has no reporting of its own to do. A
/// reporting call added to `PlatformDispatcher.onError` would double every
/// async crash.
///
/// No `runZonedGuarded` is involved. The existing entry point initializes the
/// binding directly and awaits only local work, so there is nothing a custom
/// zone would capture that these two handlers do not — and introducing one
/// risks the binding/zone mismatch that arises when the binding is created in a
/// different zone from the one that runs the app.
///
/// Flutter's normal presentation is preserved: the previous `onError` is called
/// exactly once per error, before reporting, so debug builds keep printing the
/// red-box details even if reporting is slow or inert.
GlobalErrorHandlerRegistration installGlobalErrorHandlers(
  ErrorReporter reporter,
) {
  final FlutterExceptionHandler? previousOnError = FlutterError.onError;
  final _PlatformErrorHandler? previousPlatformOnError =
      PlatformDispatcher.instance.onError;

  void handleFlutterError(FlutterErrorDetails details) {
    // Presentation first: whatever Flutter would normally have done still
    // happens, even if reporting is slow or inert.
    previousOnError?.call(details);
    reporter.recordFatal(details);
  }

  bool handlePlatformError(Object error, StackTrace stack) {
    // Convert only. Reporting belongs to FlutterError.onError, which
    // reportError invokes — see the ownership note above.
    FlutterError.reportError(
      FlutterErrorDetails(
        exception: error,
        stack: stack,
        library: 'gridview',
        context: ErrorDescription('in an unhandled asynchronous callback'),
      ),
    );
    return true;
  }

  FlutterError.onError = handleFlutterError;
  PlatformDispatcher.instance.onError = handlePlatformError;

  return GlobalErrorHandlerRegistration._(
    previousFlutterOnError: previousOnError,
    previousPlatformOnError: previousPlatformOnError,
    installedFlutterOnError: handleFlutterError,
    installedPlatformOnError: handlePlatformError,
  );
}
