// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import 'error_reporter.dart';
import 'observability_policy.dart';
import 'observed_failure.dart';

/// Applies [NonFatalThrottle] to non-fatal reports.
///
/// Fatal errors are never throttled: a crash is singular and losing one would
/// be worse than a duplicate. Only non-fatals — which a retry loop can emit
/// repeatedly — are suppressed.
class ThrottledErrorReporter implements ErrorReporter {
  ThrottledErrorReporter(
    this._inner, {
    required DateTime Function() now,
    NonFatalThrottle? throttle,
  }) : _now = now,
       _throttle = throttle ?? NonFatalThrottle();

  final ErrorReporter _inner;
  final DateTime Function() _now;
  final NonFatalThrottle _throttle;

  @override
  void recordFatal(FlutterErrorDetails details) => _inner.recordFatal(details);

  @override
  void recordNonFatal(ObservedFailure failure) {
    if (!_throttle.allow(failure, _now())) return;
    _inner.recordNonFatal(failure);
  }
}
