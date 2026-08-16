import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/environment/app_environment.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/data_source_config.dart';
import '../../../core/observability/diagnostics_policy.dart';
import '../../../core/observability/observability_activation.dart';
import '../../../core/observability/observability_providers.dart';
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
    final ValueListenable<ObservabilityActivation> observability = ref.watch(
      observabilityActivationProvider,
    );
    final DiagnosticsPolicy diagnostics = diagnosticsPolicyFor(
      ref.watch(appEnvironmentProvider),
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
                // Crash reporting and performance monitoring state the build's
                // **policy**, not a live service reading.
                //
                // Policy is the only thing the app can assert truthfully. It
                // cannot read the platform's collection state, and it must not
                // infer it: a production installation that activated once
                // leaves a persisted collection override behind, so a later
                // launch may already be collecting before Dart runs, and a
                // failed activation today proves nothing about it. Reporting
                // "disabled" from a failed activation would therefore be a
                // guess presented as a fact.
                GvSettingsField(
                  label: l10n.settingsPrivacyCrashReporting,
                  value: _policyValue(l10n, diagnostics),
                ),
                GvSettingsField(
                  label: l10n.settingsPrivacyPerformance,
                  value: _policyValue(l10n, diagnostics),
                ),
                // The one honest live claim: whether *this app's own* reporting
                // could be confirmed during this session. Worded so it can
                // never be read as a statement about platform collection, and
                // omitted entirely when there is nothing to say — a build with
                // no diagnostics policy, or one whose adapters were never even
                // going to activate, has no session to report on.
                //
                // `ValueListenableBuilder` because activation resolves after
                // the first frame: a value captured at composition time would
                // say "starting" forever.
                ValueListenableBuilder<ObservabilityActivation>(
                  valueListenable: observability,
                  builder:
                      (
                        BuildContext context,
                        ObservabilityActivation activation,
                        _,
                      ) {
                        final String? session = _sessionValue(
                          l10n,
                          diagnostics,
                          activation,
                        );
                        if (session == null) return const SizedBox.shrink();
                        return GvSettingsField(
                          label: l10n.settingsPrivacySessionReporting,
                          value: session,
                        );
                      },
                ),
                GvSettingsField(
                  label: l10n.settingsPrivacyAdvertising,
                  value: l10n.settingsPrivacyDisabled,
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

  /// What the **build** is configured to do. Fixed for the life of the app.
  String _policyValue(AppLocalizations l10n, DiagnosticsPolicy policy) =>
      switch (policy) {
        DiagnosticsPolicy.none => l10n.settingsPrivacyDisabled,
        DiagnosticsPolicy.production => l10n.settingsPrivacyConfigured,
      };

  /// What **this session's** own reporting did, or null when there is nothing
  /// truthful to say about it.
  ///
  /// `unavailable` deliberately reads as "not confirmed" rather than
  /// "disabled": the app could not attach its reporter this time, which is not
  /// evidence that platform collection is off.
  String? _sessionValue(
    AppLocalizations l10n,
    DiagnosticsPolicy policy,
    ObservabilityActivation activation,
  ) {
    // With no diagnostics policy there is no session to qualify, and the two
    // rows above already say everything true about the build.
    if (policy != DiagnosticsPolicy.production) return null;

    return switch (activation) {
      // A configured build whose adapters were never going to activate has
      // nothing to report either way. Silence beats inventing a state.
      ObservabilityActivation.notConfigured => null,
      ObservabilityActivation.pending => l10n.settingsPrivacyStarting,
      ObservabilityActivation.active => l10n.settingsPrivacySessionActive,
      ObservabilityActivation.unavailable =>
        l10n.settingsPrivacySessionUnconfirmed,
    };
  }
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
