import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';

void main() {
  group('AppEnvironment.parse', () {
    test('returns production for "production"', () {
      expect(AppEnvironment.parse('production'), AppEnvironment.production);
    });

    test('returns staging for "staging"', () {
      expect(AppEnvironment.parse('staging'), AppEnvironment.staging);
    });

    test('falls back to development for missing or unknown values', () {
      expect(AppEnvironment.parse(''), AppEnvironment.development);
      expect(AppEnvironment.parse('prod'), AppEnvironment.development);
      expect(AppEnvironment.parse('PRODUCTION'), AppEnvironment.development);
      expect(AppEnvironment.parse('release'), AppEnvironment.development);
    });
  });

  group('AppEnvironment', () {
    test('only production reports isProduction', () {
      expect(AppEnvironment.production.isProduction, isTrue);
      expect(AppEnvironment.staging.isProduction, isFalse);
      expect(AppEnvironment.development.isProduction, isFalse);
    });

    test('exposes a distinct technical label per environment', () {
      final Set<String> labels = AppEnvironment.values
          .map((AppEnvironment e) => e.label)
          .toSet();
      expect(labels, hasLength(AppEnvironment.values.length));
    });
  });
}
