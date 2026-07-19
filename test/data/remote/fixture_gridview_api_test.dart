import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_exception.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/shared/data/remote/fixture_gridview_api.dart';

/// An [AssetBundle] backed by the real `assets/dev_fixtures/*` files on disk, so
/// the fixture source is tested against the shipped assets without needing a
/// Flutter asset manifest.
class _DiskDevFixtureBundle extends AssetBundle {
  @override
  Future<ByteData> load(String key) async {
    final Uint8List bytes = await File(key).readAsBytes();
    return ByteData.view(bytes.buffer);
  }

  @override
  Future<String> loadString(String key, {bool cache = true}) {
    final File file = File(key);
    if (!file.existsSync()) {
      throw Exception('Asset not found: $key');
    }
    return file.readAsString();
  }
}

void main() {
  final FixtureGridViewApi api = FixtureGridViewApi(
    bundle: _DiskDevFixtureBundle(),
  );

  test('is visibly flagged as mock data', () {
    expect(api.usesMockData, isTrue);
  });

  test('fetchHome serves the featured Grand Prix', () async {
    final response = await api.fetchHome();
    expect(response.meta.apiVersion, '1');
    expect(response.data.featuredEvent?.id, '2026-belgian-grand-prix');
    expect(response.data.featuredEvent?.round, 13);
  });

  test('fetchGrandPrix serves the matching round', () async {
    final response = await api.fetchGrandPrix(season: 2026, round: 13);
    expect(response.data.id, '2026-belgian-grand-prix');
    expect(response.data.sessions, hasLength(5));
    expect(response.data.format, 'sprint');
  });

  test('an unknown round maps to a notFound failure', () async {
    await expectLater(
      api.fetchGrandPrix(season: 2026, round: 99),
      throwsA(
        isA<GridViewApiException>().having(
          (GridViewApiException e) => e.failure.kind,
          'kind',
          ApiFailureKind.notFound,
        ),
      ),
    );
  });

  group('shipped dev fixtures are contract-valid', () {
    final Map<String, String> files = <String, String>{
      'home.json': 'home',
      'grand-prix-2026-12.json': 'grand-prix',
      'grand-prix-2026-13.json': 'grand-prix',
    };

    for (final MapEntry<String, String> entry in files.entries) {
      test('${entry.key} parses with apiVersion 1 and no provider ids', () {
        final String raw = File(
          'assets/dev_fixtures/${entry.key}',
        ).readAsStringSync();
        final Map<String, dynamic> json =
            jsonDecode(raw) as Map<String, dynamic>;
        expect(
          (json['meta'] as Map<String, dynamic>)['apiVersion'],
          '1',
          reason: '${entry.key} must declare apiVersion 1',
        );
        // No provider identifiers may leak into a public fixture.
        expect(
          raw.toLowerCase().contains('providerid') ||
              raw.toLowerCase().contains('apisports'),
          isFalse,
          reason: '${entry.key} must not contain provider identifiers',
        );
      });
    }
  });
}
