// A named parameter cannot be private, so the fields cannot be initializing
// formals; the callbacks stay private to keep the class's surface minimal.
// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../app/environment/app_environment.dart';
import 'observed_failure.dart';

/// Writes a custom key to the backend's process-global context.
typedef CustomKeyWriter = Future<void> Function(String key, String value);

/// Records a non-fatal, after its context has been written.
typedef NonFatalRecorder = Future<void> Function(ObservedFailure failure);

/// Records a fatal, after its context has been written.
typedef FatalRecorder = Future<void> Function(FlutterErrorDetails details);

/// Sends a report with the **complete** owned custom-key set, every time.
///
/// Crashlytics custom keys are process-global and persist until overwritten, so
/// a key that one report sets is still attached to the next one. Serializing
/// reports fixed concurrent interleaving; it does nothing about this, which is
/// sequential leakage:
///
/// * a preference failure sets `preference=theme`; the next ordinary non-fatal
///   writes the other four keys and inherits `theme`, which has nothing to do
///   with it;
/// * a fatal wrote no keys at all, so it was filed under whatever failure,
///   feature and operation the previous non-fatal happened to leave behind.
///
/// The fix is to stop treating a report as "the keys it has" and start treating
/// it as "the complete key set, always". Every send writes all of [ownedKeys],
/// filling anything the report does not supply with [notApplicable]. No owned
/// key is ever left at a previous report's value, and a key outside the owned
/// set is dropped rather than written, so the attached context is exactly this
/// set with bounded values and nothing else.
///
/// Values are enum-derived or fixed bounded constants — never a message,
/// library, context or stack from the exception.
class NormalizedReportRecorder {
  /// [environment] is written on **fatal** reports, which carry no
  /// [ObservedFailure] to derive it from.
  ///
  /// It is a required parameter rather than an assumed constant on purpose.
  /// `FirebaseErrorReporter` is constructed only by a successful, eligible
  /// production activation, so production is the only value it can legitimately
  /// receive — and stating that at the call site keeps the assumption visible
  /// and checkable instead of hiding a hard-coded `'production'` in here.
  const NormalizedReportRecorder({
    required CustomKeyWriter setCustomKey,
    required NonFatalRecorder recordNonFatal,
    required FatalRecorder recordFatal,
    required AppEnvironment environment,
  }) : _setCustomKey = setCustomKey,
       _recordNonFatal = recordNonFatal,
       _recordFatal = recordFatal,
       _environment = environment;

  final CustomKeyWriter _setCustomKey;
  final NonFatalRecorder _recordNonFatal;
  final FatalRecorder _recordFatal;
  final AppEnvironment _environment;

  /// The value written for an owned key this report does not populate.
  ///
  /// A fixed constant rather than an enum member: it means "this dimension does
  /// not apply to this report", which is a property of the report and not of any
  /// domain enum. It is still bounded — one literal, used everywhere.
  static const String notApplicable = 'notApplicable';

  /// The value written to [ObservedFailure.failureKey] for a fatal.
  ///
  /// Fatals have no [ObservedFailureKind]: they are uncaught errors, not a
  /// classified condition. A fixed constant keeps the dimension usable without
  /// inventing a kind that the domain does not have.
  static const String fatalFailure = 'fatal';

  /// Every custom key this application writes. Nothing else may be set.
  static const List<String> ownedKeys = <String>[
    ObservedFailure.failureKey,
    ObservedFailure.featureKey,
    ObservedFailure.operationKey,
    ObservedFailure.environmentKey,
    ObservedFailure.preferenceKey,
  ];

  /// Writes the full context for [failure], then records it.
  Future<void> sendNonFatal(ObservedFailure failure) async {
    await _writeContext(failure.toAttributes());
    await _recordNonFatal(failure);
  }

  /// Writes a fully neutral context, then records the fatal.
  ///
  /// Neutral, not absent: leaving the keys alone would file the crash under the
  /// last non-fatal's feature and operation, which is worse than saying nothing.
  Future<void> sendFatal(FlutterErrorDetails details) async {
    await _writeContext(<String, String>{
      ObservedFailure.failureKey: fatalFailure,
      ObservedFailure.environmentKey: _environment.name,
    });
    await _recordFatal(details);
  }

  /// Expands [attributes] to the complete owned set and writes every key.
  ///
  /// Starts from a fully neutral template, so an omitted field becomes the
  /// sentinel rather than surviving from the previous report. Keys outside
  /// [ownedKeys] are ignored: this component defines the context, and an
  /// unrecognised key would be unbounded by construction.
  Future<void> _writeContext(Map<String, String> attributes) async {
    final Map<String, String> context = <String, String>{
      for (final String key in ownedKeys) key: notApplicable,
    };
    for (final MapEntry<String, String> entry in attributes.entries) {
      if (context.containsKey(entry.key)) {
        context[entry.key] = entry.value;
      }
    }
    for (final MapEntry<String, String> entry in context.entries) {
      await _setCustomKey(entry.key, entry.value);
    }
  }
}
