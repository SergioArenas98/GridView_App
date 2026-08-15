import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/observability/error_reporter.dart';
import 'package:gridview/core/observability/observability.dart';
import 'package:gridview/core/observability/observability_providers.dart';
import 'package:gridview/core/observability/observability_status.dart';
import 'package:gridview/core/observability/performance_tracer.dart';

/// Environment isolation for observability.
///
/// The rule these tests pin down: **production is the only environment allowed
/// to initialize a real backend**, and everything else — including a build with
/// a malformed `APP_ENV` — resolves to the inert surface. Dev and staging have
/// no Firebase project, and reusing the production one would mix developer
/// noise into the published app's crash data.
void main() {
  group('eligibility', () {
    test('production is eligible', () {
      expect(isObservabilityEligible(AppEnvironment.production), isTrue);
    });

    test('development and staging are not eligible', () {
      expect(isObservabilityEligible(AppEnvironment.development), isFalse);
      expect(isObservabilityEligible(AppEnvironment.staging), isFalse);
    });

    test('a malformed APP_ENV fails closed to an ineligible environment', () {
      // Parsing is total and biased away from production, so a typo, an empty
      // value or a value from a future build can never open a channel to the
      // production Firebase project.
      for (final String raw in <String>[
        '',
        '   ',
        'prod',
        'Production',
        'PRODUCTION',
        'banana',
        'staging ',
      ]) {
        final AppEnvironment parsed = AppEnvironment.parse(raw);
        expect(
          isObservabilityEligible(parsed),
          isFalse,
          reason: 'APP_ENV "$raw" must not be eligible',
        );
      }
    });

    test('only the exact token "production" parses as production', () {
      expect(AppEnvironment.parse('production'), AppEnvironment.production);
    });
  });

  group('default surface', () {
    test('the disabled surface reports and traces nothing', () {
      const Observability disabled = Observability.disabled();
      expect(disabled.reporter, isA<NoopErrorReporter>());
      expect(disabled.tracer, isA<NoopPerformanceTracer>());
      expect(disabled.status.value, ObservabilityStatus.disabledByPolicy);
    });

    test('the provider default is inert, so no test can transmit', () {
      final ProviderContainer container = ProviderContainer();
      addTearDown(container.dispose);

      expect(
        container.read(observabilityProvider).status.value,
        ObservabilityStatus.disabledByPolicy,
      );
      expect(container.read(errorReporterProvider), isA<NoopErrorReporter>());
      expect(
        container.read(performanceTracerProvider),
        isA<NoopPerformanceTracer>(),
      );
      expect(
        container.read(observabilityStatusProvider).value,
        ObservabilityStatus.disabledByPolicy,
      );
    });

    test('the no-op tracer still runs the action it was given', () async {
      const NoopPerformanceTracer tracer = NoopPerformanceTracer();
      bool ran = false;
      final int result = await tracer.trace(TraceName.syncRun, () async {
        ran = true;
        return 7;
      });
      expect(ran, isTrue);
      expect(result, 7);
    });
  });

  group('source boundary', () {
    test('exactly one library file imports Firebase', () {
      // Structural, not stylistic: if Firebase leaks into a widget, repository,
      // DAO, synchronization or media file, dev/staging/test builds stop being
      // able to run without a Firebase project. Asserting it in a test is the
      // only way this stays true as the app grows.
      final Directory lib = Directory('lib');
      final List<String> offenders = <String>[];

      for (final FileSystemEntity entity in lib.listSync(recursive: true)) {
        if (entity is! File || !entity.path.endsWith('.dart')) continue;
        final String source = entity.readAsStringSync();
        if (!source.contains("import 'package:firebase_")) continue;
        offenders.add(entity.path.replaceAll(r'\', '/'));
      }

      expect(offenders, <String>[
        'lib/core/observability/firebase/firebase_observability.dart',
      ]);
    });

    test('no Analytics or advertising DART package is declared', () {
      // Scope, stated precisely: this proves only what the **Dart** dependency
      // graph contains. It says nothing about the Android artifacts, which is
      // where the interesting facts actually are — firebase_perf pulls the
      // native Remote Config and ABT components transitively, and no Dart
      // lockfile can ever show that.
      //
      // The Android facts are asserted where they are visible: the Gradle gate
      // `verify<Variant>FirebaseDependencies` in android/app/build.gradle,
      // which reads Gradle's resolution result and runs as part of every
      // assembled build.
      final List<String> resolved = File('pubspec.lock')
          .readAsLinesSync()
          .where((String line) => RegExp(r'^  [a-z0-9_]+:$').hasMatch(line))
          .map((String line) => line.trim().replaceAll(':', ''))
          .toList();

      expect(resolved, contains('firebase_core'));
      expect(resolved, contains('firebase_crashlytics'));
      expect(resolved, contains('firebase_performance'));

      for (final String forbidden in <String>[
        'firebase_analytics',
        'google_mobile_ads',
        'firebase_remote_config',
        'firebase_messaging',
        'firebase_auth',
      ]) {
        expect(
          resolved,
          isNot(contains(forbidden)),
          reason: 'no Dart $forbidden package is declared',
        );
      }
    });

    test('the Gradle gate owns the Android dependency facts', () {
      // The Dart test above cannot see native artifacts, so the claim lives in
      // Gradle. This asserts the gate exists and encodes the reviewed facts, so
      // deleting or weakening it fails here rather than silently.
      final String gradle = File('android/app/build.gradle').readAsStringSync();

      expect(gradle, contains('verify\${variantName}FirebaseDependencies'));
      // Intentional and transitive-but-documented.
      for (final String expected in <String>[
        'com.google.firebase:firebase-crashlytics',
        'com.google.firebase:firebase-perf',
        'com.google.firebase:firebase-config',
        'com.google.firebase:firebase-abt',
      ]) {
        expect(gradle, contains(expected));
      }
      // Never packaged.
      for (final String forbidden in <String>[
        'com.google.firebase:firebase-analytics',
        'com.google.android.gms:play-services-ads',
        'com.google.firebase:firebase-crashlytics-ndk',
      ]) {
        expect(gradle, contains(forbidden));
      }
    });

    test('the native collection policy is declared for every flavor', () {
      // The Dart eligibility gate runs after Android has already instantiated
      // FirebaseInitProvider, so the manifest is the only boundary that can
      // fail closed before Dart exists. Assert it is present and off.
      final String manifest = File(
        'android/app/src/main/AndroidManifest.xml',
      ).readAsStringSync();

      expect(
        manifest,
        contains('android:name="firebase_crashlytics_collection_enabled"'),
      );
      expect(
        manifest,
        contains('android:name="firebase_performance_collection_enabled"'),
      );
      // Both must be false; production opts in at runtime instead.
      expect(
        RegExp(
          r'firebase_crashlytics_collection_enabled"\s*\r?\n?\s*android:value="false"',
        ).hasMatch(manifest),
        isTrue,
      );
      expect(
        RegExp(
          r'firebase_performance_collection_enabled"\s*\r?\n?\s*android:value="false"',
        ).hasMatch(manifest),
        isTrue,
      );
      // Permanent deactivation would also disable the production build.
      expect(
        manifest.contains(
          '<meta-data\n            android:name="firebase_performance_collection_deactivated"',
        ),
        isFalse,
      );
    });

    test('flavor and APP_ENV are bound by a build gate', () {
      // The flavor -> APP_ENV mapping is declared in the app build script; the
      // parsing and the failure messages live in the extracted environment
      // script, which `:app:verifyAppEnvParser` executes against synthetic
      // input. This test only asserts the wiring still exists in the sources --
      // the behaviour itself is proven by that Gradle task, not by text.
      final String gradle = File('android/app/build.gradle').readAsStringSync();

      expect(gradle, contains('requiredAppEnvForFlavor'));
      expect(gradle, contains('dev       : "development"'));
      expect(gradle, contains('staging   : "staging"'));
      expect(gradle, contains('production: "production"'));
      expect(gradle, contains('gradle/dart_environment.gradle'));
      expect(gradle, contains('gradle/build_policy.gradle'));

      final String environment = File(
        'android/gradle/dart_environment.gradle',
      ).readAsStringSync();

      expect(environment, contains('Flavor/APP_ENV mismatch'));
      expect(environment, contains('Missing --dart-define=APP_ENV'));
    });

    test('the environment gates are not anchored on pre-build', () {
      // AGP keys native-build configuration by build type and ABI alone, and
      // each such task depends on every flavor's pre-build of that type. This
      // project has a native build, so anchoring the gates on
      // `preBuildProvider` makes a dev build run the production validator.
      // `:app:verifyAndroidBuildPolicy` asserts this over the configured task
      // graph; this keeps the mistake from reappearing in review.
      final String gradle = File('android/app/build.gradle').readAsStringSync();

      expect(gradle, contains('variant.mergeResourcesProvider.configure'));
      expect(gradle, isNot(contains('variant.preBuildProvider.configure')));
    });

    test('no Firebase configuration file exists outside production', () {
      final List<String> configs = Directory('android/app/src')
          .listSync(recursive: true)
          .whereType<File>()
          .where((File f) => f.path.endsWith('google-services.json'))
          .map((File f) => f.path.replaceAll(r'\', '/'))
          .toList();

      expect(configs, <String>[
        'android/app/src/production/google-services.json',
      ]);
    });
  });
}
