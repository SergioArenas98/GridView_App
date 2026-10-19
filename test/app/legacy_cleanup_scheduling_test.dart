import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/bootstrap.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/observability/firebase/firebase_observability.dart';
import 'package:gridview/core/observability/observability_bootstrap.dart';
import 'package:gridview/core/preferences/preference_store.dart';
import 'package:gridview/core/preferences/preferences_repository.dart';

/// Legacy storage is removed only after this launch has rendered a frame.
void main() {
  testWidgets('legacy cleanup runs after the first frame, not before', (
    WidgetTester tester,
  ) async {
    final List<String> steps = <String>[];
    final Completer<FirebaseAdapters?> never = Completer<FirebaseAdapters?>();

    final ObservabilityBootstrap boot = await runBootstrap(
      BootstrapOperations(
        environment: AppEnvironment.production,
        installObservability: () => installObservability(
          environment: AppEnvironment.production,
          activator: () => never.future,
        ),
        ensureTimeZones: () {},
        openPreferences:
            ({
              void Function(PreferenceDiagnostic diagnostic)? onDiagnostic,
            }) async {
              steps.add('preferences');
              return AppPreferencesRepository(store: InMemoryPreferenceStore());
            },
        // The real shell needs a database; a placeholder frame is enough to
        // prove ordering against the first frame.
        runApplication: (Widget _) {
          steps.add('runApp');
          runApp(const SizedBox.shrink());
        },
        cleanUpLegacyStorage: () async => steps.add('cleanup'),
      ),
    );

    expect(steps, <String>['preferences', 'runApp']);

    // On a device `runApp` always schedules the warm-up frame; the test binding
    // does not, so the first frame is requested here.
    tester.binding.scheduleFrame();
    await tester.pump();
    expect(steps, <String>['preferences', 'runApp', 'cleanup']);

    tester.binding.scheduleFrame();
    await tester.pump();
    expect(steps.where((String s) => s == 'cleanup'), hasLength(1));

    boot.handlers.restore();
  });
}
