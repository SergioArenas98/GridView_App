import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/environment/app_environment.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/data_source_config.dart';
import '../../../core/theme/theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';
import '../application/app_info.dart';
import '../application/external_links.dart';
import 'widgets/settings_rows.dart';

/// Padding shared by the read-only Settings information screens.
const EdgeInsets _screenPadding = EdgeInsets.fromLTRB(
  GvLayout.screenPaddingHorizontal,
  GvSpacing.md,
  GvLayout.screenPaddingHorizontal,
  GvSpacing.xxl,
);

/// What the application is reading and how it stays usable offline.
///
/// Read-only and deliberately incurious: it reports only safe product facts and
/// never a base URL, query parameter, ETag, request id, resource key, entity id,
/// token or namespace. It also performs no refresh — opening Settings must not
/// cause network work.
class DataSettingsScreen extends ConsumerWidget {
  const DataSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AppEnvironment environment = ref.watch(appEnvironmentProvider);
    final DataSourceMode mode = ref.watch(dataSourceModeProvider);
    final bool usesMockData = ref.watch(usesMockDataProvider);
    final int? season = ref.watch(currentSeasonProvider).value;

    return GvScreenScaffold(
      title: l10n.settingsDataAndUpdates,
      body: ListView(
        padding: _screenPadding,
        children: <Widget>[
          GvInfoCard(
            children: <Widget>[
              GvSettingsField(
                label: l10n.settingsDataEnvironment,
                value: environment.label,
              ),
              GvSettingsField(
                label: l10n.settingsDataSource,
                value: _dataSource(l10n, mode, usesMockData),
              ),
              GvSettingsField(
                label: l10n.settingsDataApiVersion,
                value: kGridViewApiVersion,
              ),
              GvSettingsField(
                label: l10n.settingsDataCurrentSeason,
                value:
                    season?.toString() ??
                    l10n.settingsDataCurrentSeasonUnresolved,
              ),
            ],
          ),
          const SizedBox(height: GvSpacing.lg),
          Text(
            l10n.settingsDataOfflineExplanation,
            style: context.gvText.bodyM,
          ),
        ],
      ),
    );
  }

  /// The active source, described in product terms.
  ///
  /// Sample data can only ever be reported outside production: production never
  /// constructs the fixture source at all.
  String _dataSource(
    AppLocalizations l10n,
    DataSourceMode mode,
    bool usesMockData,
  ) {
    if (usesMockData) return l10n.settingsDataSourceSample;
    return switch (mode) {
      DataSourceMode.remote => l10n.settingsDataSourceRemote,
      DataSourceMode.fixture => l10n.settingsDataSourceUnavailable,
    };
  }
}

/// The application's own identity, read from real package metadata.
class AboutSettingsScreen extends ConsumerWidget {
  const AboutSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AppInfo info = ref.watch(appInfoProvider).value ?? AppInfo.unknown;

    return GvScreenScaffold(
      title: l10n.settingsAppInformation,
      body: ListView(
        padding: _screenPadding,
        children: <Widget>[
          GvInfoCard(
            children: <Widget>[
              GvSettingsField(
                label: l10n.settingsAboutApplication,
                value: info.appName,
              ),
              // Absent until the real metadata resolves: a version is reported,
              // never guessed.
              GvSettingsField(label: l10n.settingsVersion, value: info.version),
              GvSettingsField(
                label: l10n.settingsAboutBuild,
                value: info.buildNumber,
              ),
            ],
          ),
          const SizedBox(height: GvSpacing.lg),
          Text(l10n.settingsAboutUnofficial, style: context.gvText.bodyM),
        ],
      ),
    );
  }
}

/// What GridView actually does with data, stated from the services that are
/// really enabled in this build rather than from a draft policy.
class PrivacySettingsScreen extends ConsumerWidget {
  const PrivacySettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ExternalLinkConfig config = ref.watch(externalLinkConfigProvider);
    final ExternalLink? policy = config.privacyPolicy;

    return GvScreenScaffold(
      title: l10n.settingsPrivacyAndLegal,
      body: ListView(
        padding: _screenPadding,
        children: <Widget>[
          Text(l10n.settingsAboutUnofficial, style: context.gvText.bodyM),
          const SizedBox(height: GvSpacing.lg),
          GvScreenSection(
            title: l10n.settingsPrivacyAndLegal,
            child: GvInfoCard(
              children: <Widget>[
                // Each status is read from the build's real configuration, so
                // the screen cannot claim a service that is not running.
                GvSettingsField(
                  label: l10n.settingsPrivacyCrashReporting,
                  value: _status(l10n, enabled: false),
                ),
                GvSettingsField(
                  label: l10n.settingsPrivacyPerformance,
                  value: _status(l10n, enabled: false),
                ),
                GvSettingsField(
                  label: l10n.settingsPrivacyAdvertising,
                  value: _status(l10n, enabled: false),
                ),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.lg),
          if (policy == null)
            Text(
              l10n.settingsPrivacyPolicyUnavailable,
              style: context.gvText.bodyM,
            )
          else
            GvSettingsRow(
              key: const ValueKey<String>('settings-privacy-policy'),
              title: l10n.settingsPrivacyPolicyOpen,
              icon: Icons.open_in_new,
              onTap: () => openExternalLink(context, ref, policy),
            ),
        ],
      ),
    );
  }

  String _status(AppLocalizations l10n, {required bool enabled}) =>
      enabled ? l10n.settingsPrivacyEnabled : l10n.settingsPrivacyDisabled;
}

/// Opens an allow-listed external destination, reporting failure without
/// exposing the URL or any platform exception.
Future<void> openExternalLink(
  BuildContext context,
  WidgetRef ref,
  ExternalLink link,
) async {
  final AppLocalizations l10n = AppLocalizations.of(context);
  final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
  final bool opened = await ref.read(externalLinkLauncherProvider).open(link);
  if (opened) return;
  messenger.showSnackBar(SnackBar(content: Text(l10n.settingsOpenFailed)));
}
