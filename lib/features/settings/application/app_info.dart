import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// The application's own identity, read from real package metadata.
///
/// Never a hardcoded version string: a stale literal in the Settings screen is
/// worse than no version at all, because it is confidently wrong.
class AppInfo {
  const AppInfo({
    required this.appName,
    required this.version,
    required this.buildNumber,
  });

  /// The value shown before the real metadata has been read. It states nothing
  /// it cannot back up rather than guessing a version.
  static const AppInfo unknown = AppInfo(
    appName: 'GridView',
    version: '',
    buildNumber: '',
  );

  final String appName;
  final String version;
  final String buildNumber;

  /// Whether real metadata was resolved.
  bool get isResolved => version.isNotEmpty;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AppInfo &&
          other.appName == appName &&
          other.version == version &&
          other.buildNumber == buildNumber;

  @override
  int get hashCode => Object.hash(appName, version, buildNumber);
}

/// Reads the application's package metadata. Injected so tests never touch a
/// platform channel.
abstract interface class AppInfoReader {
  Future<AppInfo> read();
}

/// The production reader, backed by `package_info_plus`.
class PackageAppInfoReader implements AppInfoReader {
  const PackageAppInfoReader();

  @override
  Future<AppInfo> read() async {
    final PackageInfo info = await PackageInfo.fromPlatform();
    return AppInfo(
      appName: info.appName,
      version: info.version,
      buildNumber: info.buildNumber,
    );
  }
}

/// A deterministic reader for tests.
class FakeAppInfoReader implements AppInfoReader {
  const FakeAppInfoReader(this.info, {this.fails = false});

  final AppInfo info;
  final bool fails;

  @override
  Future<AppInfo> read() async {
    if (fails) throw StateError('package metadata unavailable');
    return info;
  }
}

/// The package-metadata reader for the active build.
final Provider<AppInfoReader> appInfoReaderProvider = Provider<AppInfoReader>(
  (Ref ref) => const PackageAppInfoReader(),
);

/// The application's identity.
///
/// A platform channel that fails resolves to [AppInfo.unknown] rather than
/// surfacing an error: not knowing the build number must never break the
/// Settings screen.
final FutureProvider<AppInfo> appInfoProvider = FutureProvider<AppInfo>((
  Ref ref,
) async {
  try {
    return await ref.watch(appInfoReaderProvider).read();
  } on Object {
    return AppInfo.unknown;
  }
});
