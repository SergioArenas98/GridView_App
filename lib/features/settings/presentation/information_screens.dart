import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/environment/app_environment.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/data_source_config.dart';
import '../../../core/observability/observability_providers.dart';
import '../../../core/observability/observability_status.dart';
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
    final bool explainsAbsence = showsConfigurationStatus(
      ref.watch(appEnvironmentProvider),
    );
    final ValueListenable<ObservabilityStatus> observability = ref.watch(
      observabilityStatusProvider,
    );

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
                // Crash reporting and performance monitoring are one surface
                // (`Observability`), so they share one source of truth.
                //
                // That source is the *live* status, not build eligibility. An
                // eligible build is not a running service: activation happens
                // after the first frame and can fail, so a value derived from
                // `APP_ENV` alone would tell the reader diagnostics were being
                // collected when nothing had started or everything had failed.
                // `ValueListenableBuilder` is what lets the row correct itself
                // when activation resolves.
                ValueListenableBuilder<ObservabilityStatus>(
                  valueListenable: observability,
                  builder:
                      (BuildContext context, ObservabilityStatus status, _) {
                        return Column(
                          children: <Widget>[
                            GvSettingsField(
                              label: l10n.settingsPrivacyCrashReporting,
                              value: _observabilityStatus(l10n, status),
                            ),
                            GvSettingsField(
                              label: l10n.settingsPrivacyPerformance,
                              value: _observabilityStatus(l10n, status),
                            ),
                          ],
                        );
                      },
                ),
                GvSettingsField(
                  label: l10n.settingsPrivacyAdvertising,
                  value: _status(l10n, enabled: false),
                ),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.md),
          // The honest part the status alone cannot carry: the diagnostic
          // components ship in every build of the app, and what the policy
          // controls is transmission, not presence.
          Text(
            l10n.settingsPrivacyDiagnosticsNote,
            style: context.gvText.caption,
          ),
          if (policy != null) ...<Widget>[
            const SizedBox(height: GvSpacing.lg),
            GvSettingsRow(
              key: const ValueKey<String>('settings-privacy-policy'),
              title: l10n.settingsPrivacyPolicyOpen,
              icon: Icons.open_in_new,
              onTap: () => openExternalLink(context, ref, policy),
            ),
          ]
          // With no configured policy, production shows nothing at all: the
          // reader cannot act on it and a self-explaining absence reads as a
          // fault. Outside production the status is useful to whoever builds.
          else if (explainsAbsence) ...<Widget>[
            const SizedBox(height: GvSpacing.lg),
            Text(
              l10n.settingsPrivacyPolicyUnavailable,
              style: context.gvText.bodyM,
            ),
          ],
        ],
      ),
    );
  }

  String _status(AppLocalizations l10n, {required bool enabled}) =>
      enabled ? l10n.settingsPrivacyEnabled : l10n.settingsPrivacyDisabled;

  /// Maps the live activation state to user-facing copy.
  ///
  /// Four states, four honest answers. `activated` says the app's reporting is
  /// running — it deliberately does not claim any payload reached a server,
  /// which the app cannot observe and therefore must not assert.
  String _observabilityStatus(
    AppLocalizations l10n,
    ObservabilityStatus status,
  ) => switch (status) {
    ObservabilityStatus.disabledByPolicy => l10n.settingsPrivacyDisabled,
    ObservabilityStatus.pending => l10n.settingsPrivacyStarting,
    ObservabilityStatus.activated => l10n.settingsPrivacyEnabled,
    ObservabilityStatus.unavailable => l10n.settingsPrivacyUnavailable,
  };
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
