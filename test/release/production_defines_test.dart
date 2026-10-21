import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The committed production build configuration
/// (`config/dart_defines/production.json`, passed with
/// `--dart-define-from-file`) is the only define source a release build uses
/// (docs/release/production-release-plan.md).
///
/// These guards keep it a production configuration: the exact environment
/// token the Gradle gate requires, an HTTPS production endpoint and never a
/// staging or development one (Implementation Plan §15.6), a published privacy
/// policy, and no fixture mode.
void main() {
  late Map<String, Object?> defines;

  setUpAll(() {
    defines =
        jsonDecode(
              File('config/dart_defines/production.json').readAsStringSync(),
            )
            as Map<String, Object?>;
  });

  test('declares only the keys a production release needs', () {
    expect(defines.keys.toSet(), <String>{
      'APP_ENV',
      'API_BASE_URL',
      'PRIVACY_POLICY_URL',
    });
  });

  test('APP_ENV is the exact production token', () {
    expect(defines['APP_ENV'], 'production');
  });

  test('API_BASE_URL is the HTTPS production Worker, never staging', () {
    final Uri uri = Uri.parse(defines['API_BASE_URL']! as String);
    expect(uri.scheme, 'https');
    expect(uri.host, 'gridview-api-production.sejuma18.workers.dev');
    expect(uri.path, isEmpty);
    expect(uri.host, isNot(contains('staging')));
    expect(uri.host, isNot(contains('-dev')));
  });

  test('PRIVACY_POLICY_URL is the published HTTPS policy', () {
    final Uri uri = Uri.parse(defines['PRIVACY_POLICY_URL']! as String);
    expect(uri.scheme, 'https');
    expect(uri.host, 'gridview.netlify.app');
  });
}
