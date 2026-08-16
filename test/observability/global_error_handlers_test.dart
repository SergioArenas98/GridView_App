import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/observability/deferred_observability.dart';
import 'package:gridview/core/observability/error_reporter.dart';
import 'package:gridview/core/observability/global_error_handlers.dart';

import '../support/fake_observability.dart';

/// Fatal-error routing.
///
/// The property under test is **exactly once**. An asynchronous error passes
/// through both global handlers — `PlatformDispatcher.onError` converts it and
/// `FlutterError.onError` reports it — so the obvious mistake is to report in
/// both and double every async crash.
void main() {
  late RecordingErrorReporter reporter;
  late GlobalErrorHandlerRegistration registration;

  setUp(() {
    reporter = RecordingErrorReporter();
    registration = installGlobalErrorHandlers(reporter);
  });

  tearDown(() {
    // Global handlers are process-wide. A test that leaks them corrupts every
    // test that runs afterwards, so restoration is not optional.
    registration.restore();
  });

  test('a Flutter framework error is reported exactly once', () {
    FlutterError.reportError(
      FlutterErrorDetails(
        exception: StateError('boom'),
        library: 'test',
        context: ErrorDescription('while testing'),
      ),
    );

    expect(reporter.fatals, hasLength(1));
    expect(reporter.fatals.single.exception, isA<StateError>());
  });

  test('an uncaught asynchronous error is reported exactly once', () {
    final bool handled = PlatformDispatcher.instance.onError!(
      StateError('async boom'),
      StackTrace.current,
    );

    expect(handled, isTrue, reason: 'the handler must claim the error');
    expect(
      reporter.fatals,
      hasLength(1),
      reason:
          'PlatformDispatcher.onError converts and FlutterError.onError '
          'reports; reporting in both would duplicate every async crash',
    );
    expect(reporter.fatals.single.exception, isA<StateError>());
    expect(reporter.fatals.single.library, 'gridview');
  });

  test('the previous handler still runs, so debug output survives', () {
    registration.restore();

    final List<Object> seenByPrevious = <Object>[];
    final FlutterExceptionHandler? original = FlutterError.onError;
    FlutterError.onError = (FlutterErrorDetails details) {
      seenByPrevious.add(details.exception);
    };

    final GlobalErrorHandlerRegistration inner = installGlobalErrorHandlers(
      reporter,
    );
    addTearDown(() {
      inner.restore();
      FlutterError.onError = original;
    });

    FlutterError.reportError(
      FlutterErrorDetails(exception: StateError('chained'), library: 'test'),
    );

    expect(seenByPrevious, hasLength(1));
    expect(reporter.fatals, hasLength(1));
  });

  group('ownership-aware restoration', () {
    test('restore puts the previous handlers back', () {
      final FlutterExceptionHandler? installed = FlutterError.onError;
      expect(registration.ownsFlutterHandler, isTrue);
      expect(registration.ownsPlatformHandler, isTrue);

      expect(registration.restore(), isTrue);

      expect(FlutterError.onError, isNot(same(installed)));
      expect(registration.ownsFlutterHandler, isFalse);

      registration = installGlobalErrorHandlers(reporter);
    });

    test('repeated restoration is safe and idempotent', () {
      expect(registration.restore(), isTrue);
      final FlutterExceptionHandler? afterFirst = FlutterError.onError;

      expect(registration.restore(), isTrue);
      expect(registration.restore(), isTrue);
      expect(FlutterError.onError, same(afterFirst));

      registration = installGlobalErrorHandlers(reporter);
    });

    test('a later Flutter handler owner is never overwritten', () {
      // The defect this replaces: restore() reinstated its saved handler
      // unconditionally, deleting whatever a later owner had installed and
      // silently disabling error routing for everything that followed.
      void laterOwner(FlutterErrorDetails details) {}
      FlutterError.onError = laterOwner;

      expect(registration.ownsFlutterHandler, isFalse);
      expect(
        registration.restore(),
        isFalse,
        reason: 'restoration was incomplete because another owner took over',
      );
      expect(
        FlutterError.onError,
        same(laterOwner),
        reason: 'the later owner must survive',
      );

      registration.restore();
      expect(FlutterError.onError, same(laterOwner));

      FlutterError.onError = null;
      registration = installGlobalErrorHandlers(reporter);
    });

    test('a later platform handler owner is never overwritten', () {
      bool laterOwner(Object error, StackTrace stack) => true;
      PlatformDispatcher.instance.onError = laterOwner;

      expect(registration.ownsPlatformHandler, isFalse);
      expect(registration.restore(), isFalse);
      expect(PlatformDispatcher.instance.onError, same(laterOwner));

      PlatformDispatcher.instance.onError = null;
      registration = installGlobalErrorHandlers(reporter);
    });

    test('one half can be restored while the other is left alone', () {
      void laterFlutterOwner(FlutterErrorDetails details) {}
      FlutterError.onError = laterFlutterOwner;

      final Object? platformBefore = PlatformDispatcher.instance.onError;
      expect(registration.restore(), isFalse);

      // Flutter's half belongs to someone else and survived; the platform half
      // was still ours and was restored.
      expect(FlutterError.onError, same(laterFlutterOwner));
      expect(PlatformDispatcher.instance.onError, isNot(same(platformBefore)));

      FlutterError.onError = null;
      registration = installGlobalErrorHandlers(reporter);
    });
  });

  test('a reporter that throws cannot escape the global handler', () {
    registration.restore();
    final GlobalErrorHandlerRegistration broken = installGlobalErrorHandlers(
      GuardedErrorReporter(const ThrowingErrorReporter()),
    );
    addTearDown(broken.restore);

    // The guard is what keeps a broken reporter from turning a reported error
    // into a second, unreported one.
    expect(
      () => FlutterError.reportError(
        FlutterErrorDetails(exception: StateError('x'), library: 'test'),
      ),
      returnsNormally,
    );

    registration = installGlobalErrorHandlers(reporter);
  });

  group('deferred adoption', () {
    test('errors before adoption are buffered and replayed once', () {
      registration.restore();
      final DeferredErrorReporter deferred = DeferredErrorReporter();
      final GlobalErrorHandlerRegistration deferredRegistration =
          installGlobalErrorHandlers(deferred);
      addTearDown(deferredRegistration.restore);

      expect(deferred.hasAdopted, isFalse);
      FlutterError.reportError(
        FlutterErrorDetails(exception: StateError('early'), library: 'test'),
      );
      expect(deferred.bufferedCount, 1);

      deferred.adopt(reporter);
      FlutterError.reportError(
        FlutterErrorDetails(exception: StateError('late'), library: 'test'),
      );

      expect(
        reporter.fatals.map(
          (FlutterErrorDetails d) => (d.exception as StateError).message,
        ),
        <String>['early', 'late'],
        reason: 'the buffered error is replayed, then live ones pass through',
      );

      registration = installGlobalErrorHandlers(reporter);
    });

    test('adoption is one-way: the first real reporter wins', () {
      final DeferredErrorReporter deferred = DeferredErrorReporter();
      final RecordingErrorReporter second = RecordingErrorReporter();

      deferred.adopt(reporter);
      deferred.adopt(second);

      deferred.recordFatal(
        FlutterErrorDetails(exception: StateError('once'), library: 'test'),
      );

      expect(reporter.fatals, hasLength(1));
      expect(second.fatals, isEmpty);
    });

    test('disable after buffering discards rather than replays', () {
      final DeferredErrorReporter deferred = DeferredErrorReporter();
      deferred.recordFatal(
        FlutterErrorDetails(exception: StateError('x'), library: 'test'),
      );

      deferred.disable();
      deferred.adopt(reporter);

      expect(deferred.hasAdopted, isFalse);
      expect(reporter.fatals, isEmpty);
    });
  });
}
