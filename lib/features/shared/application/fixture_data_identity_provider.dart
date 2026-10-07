import 'dart:convert';

import 'package:flutter/services.dart'
    show AssetBundle, AssetManifest, rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/fixture_data_identity.dart';
import 'providers.dart';

/// The descriptor a test-only frozen-data build bundles beside its fixtures.
/// The committed repository never contains it.
const String frozenDatasetAsset = 'assets/dev_fixtures/frozen-dataset.json';

/// The bundle the fixture identity is read from. Overridable in tests.
final Provider<AssetBundle> fixtureAssetBundleProvider = Provider<AssetBundle>(
  (Ref ref) => rootBundle,
);

/// Identifies the bundled fixtures from [bundle].
///
/// No descriptor in the asset manifest means the committed sample fixtures.
/// A descriptor that is listed but cannot be read or decoded is
/// [UnverifiedFixtureData]: it is never quietly reported as sample data, nor
/// as captured data.
Future<FixtureDataIdentity> loadFixtureDataIdentity(AssetBundle bundle) async {
  final AssetManifest manifest = await AssetManifest.loadFromAssetBundle(
    bundle,
  );
  if (!manifest.listAssets().contains(frozenDatasetAsset)) {
    return const SampleFixtureData();
  }
  try {
    final String raw = await bundle.loadString(
      frozenDatasetAsset,
      cache: false,
    );
    return FrozenDatasetDescriptor.fromJson(jsonDecode(raw)).identity;
  } catch (_) {
    return const UnverifiedFixtureData();
  }
}

/// What the bundled fixture data is, or `null` when the build does not serve
/// fixtures at all.
///
/// Only a fixture build reads the descriptor: production never constructs the
/// fixture source, and a remote build never looks at bundled data, so neither
/// reads anything here.
final FutureProvider<FixtureDataIdentity?> fixtureDataIdentityProvider =
    FutureProvider<FixtureDataIdentity?>((Ref ref) async {
      if (!ref.watch(usesMockDataProvider)) return null;
      return loadFixtureDataIdentity(ref.watch(fixtureAssetBundleProvider));
    });
