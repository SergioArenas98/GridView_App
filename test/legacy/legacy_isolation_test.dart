import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The legacy Hive cache must never be read into the reconstruction.
///
/// The cleanup deletes the box files without opening them; these guards keep
/// it that way by making a Hive dependency, or code that opens a box, fail CI.
void main() {
  test('pubspec declares no Hive package', () {
    final String pubspec = File('pubspec.yaml').readAsStringSync();
    expect(RegExp(r'^\s+hive\w*:', multiLine: true).hasMatch(pubspec), isFalse);
  });

  test('no application source imports Hive', () {
    final List<String> offenders = <String>[
      for (final FileSystemEntity entity in Directory(
        'lib',
      ).listSync(recursive: true))
        if (entity is File &&
            entity.path.endsWith('.dart') &&
            entity.readAsStringSync().contains('package:hive'))
          entity.path,
    ];
    expect(offenders, isEmpty);
  });
}
