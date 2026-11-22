import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/environment/app_environment.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/data_source_config.dart';
import '../../../core/observability/diagnostics_policy.dart';
import '../../../core/observability/observability_activation.dart';
import '../../../core/observability/observability_providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/fixture_data_identity_provider.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/fixture_data_identity.dart';
import '../application/app_info.dart';
import '../application/external_links.dart';
import 'widgets/fixture_data_label.dart';
import 'widgets/settings_app_bar.dart';
import 'widgets/settings_external_link_row.dart';
import 'widgets/settings_group.dart';
import 'widgets/settings_information.dart';
import 'widgets/settings_navigation_row.dart';
import 'widgets/settings_snackbar.dart';

/// The scrolling body every information screen shares: [children] stacked
/// from 20px below the app bar, with the Settings end padding below.
Widget _informationBody(double bottomPadding, List<Widget> children) =>
    SingleChildScrollView(
      padding: EdgeInsets.only(
        top: settingsInformationTop,
        bottom: bottomPadding,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    );

/// What the application is reading and how it stays usable offline.
///
/// Read-only and deliberately incurious: it reports only safe product facts and
/// never a base URL, query parameter, ETag, request id, resource key, entity id,
/// token or namespace. It also performs no refresh — opening Settings must not
/// cause network work.
///
/// Primer V2 (Step 55C.13B, `settings/information/data*.html`,
/// `light-rollout-b2/info-data-*`): four facts, then the explanation.
class DataSettingsScreen extends ConsumerWidget {
  const DataSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AppEnvironment environment = ref.watch(appEnvironmentProvider);
    final DataSourceMode mode = ref.watch(dataSourceModeProvider);
    final bool usesMockData = ref.watch(usesMockDataProvider);
    final FixtureDataIdentity? fixtureData = ref
        .watch(fixtureDataIdentityProvider)
        .value;
    final int? season = ref.watch(currentSeasonProvider).value;

    return SettingsPrimerScaffold(
      title: l10n.settingsDataAndUpdates,
      body: (BuildContext context, double bottomPadding) =>
          _informationBody(bottomPadding, <Widget>[
            SettingsFactList(
              facts: <SettingsFact>[
                SettingsFact(
                  label: l10n.settingsDataEnvironment,
                  value: environment.label,
                ),
                SettingsFact(
                  label: l10n.settingsDataSource,
                  value: _dataSource(l10n, mode, usesMockData, fixtureData),
                ),
                SettingsFact(
                  label: l10n.settingsDataApiVersion,
                  value: kGridViewApiVersion,
                  kind: SettingsFactKind.number,
                ),
                // An unresolved season is an answer about missing data, set
                // quieter than a value; a season is never guessed.
                SettingsFact(
                  label: l10n.settingsDataCurrentSeason,
                  value:
                      season?.toString() ??
                      l10n.settingsDataCurrentSeasonUnresolved,
                  kind: season == null
                      ? SettingsFactKind.pending
                      : SettingsFactKind.number,
                ),
              ],
            ),
            SettingsProse(
              _explanation(l10n, mode, usesMockData, fixtureData),
              top: 24,
            ),
          ]),
    );
  }

  /// How the data stays current.
  ///
  /// Only a build that reads the GridView service (`DATA_SOURCE=remote`)
  /// downloads anything, so only it promises downloads. A fixture build never
  /// updates: a frozen capture states its capture date, and any other bundled
  /// data (sample, synthetic, unverified or not yet identified) says so
  /// neutrally. Fixture data is served only in fixture mode, so either signal
  /// identifies a fixture build; production refuses fixture mode but is still
  /// not promised downloads.
  String _explanation(
    AppLocalizations l10n,
    DataSourceMode mode,
    bool usesMockData,
    FixtureDataIdentity? fixtureData,
  ) {
    if (mode == DataSourceMode.remote && !usesMockData) {
      return l10n.settingsDataOfflineExplanation;
    }
    return switch (fixtureData) {
      FrozenCaptureData(:final DateTime capturedAt) when usesMockData =>
        l10n.settingsDataFrozenExplanation(captureDateLabel(capturedAt)),
      _ => l10n.settingsDataBundledExplanation,
    };
  }

  /// The active source, described in product terms.
  ///
  /// Sample data can only ever be reported outside production: production never
  /// constructs the fixture source at all.
  String _dataSource(
    AppLocalizations l10n,
    DataSourceMode mode,
    bool usesMockData,
    FixtureDataIdentity? fixtureData,
  ) {
    if (usesMockData) {
      return fixtureDataSourceLabel(l10n, fixtureData) ??
          l10n.settingsDataSourceSample;
    }
    return switch (mode) {
      DataSourceMode.remote => l10n.settingsDataSourceRemote,
      DataSourceMode.fixture => l10n.settingsDataSourceUnavailable,
    };
  }
}

/// The application's own identity, read from real package metadata.
///
/// Primer V2 (Step 55C.13B, `settings/information/about*.html`): the facts,
/// then the independence statement.
class AboutSettingsScreen extends ConsumerWidget {
  const AboutSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AppInfo info = ref.watch(appInfoProvider).value ?? AppInfo.unknown;

    return SettingsPrimerScaffold(
      title: l10n.settingsAppInformation,
      body: (BuildContext context, double bottomPadding) =>
          _informationBody(bottomPadding, <Widget>[
            SettingsFactList(
              facts: <SettingsFact>[
                SettingsFact(
                  label: l10n.settingsAboutApplication,
                  value: info.appName,
                ),
                // Absent until the real metadata resolves: a version is
                // reported, never guessed. An empty value is omitted.
                SettingsFact(
                  label: l10n.settingsVersion,
                  value: info.version,
                  kind: SettingsFactKind.number,
                ),
                SettingsFact(
                  label: l10n.settingsAboutBuild,
                  value: info.buildNumber,
                  kind: SettingsFactKind.number,
                ),
              ],
            ),
            SettingsProse(l10n.settingsAboutUnofficial, top: 24),
          ]),
    );
  }
}

/// What GridView actually does with data, stated from the services that are
/// really enabled in this build rather than from a draft policy.
///
/// Primer V2 (Step 55C.13B, `settings/information/privacy*.html`, owner
/// decision SF-16): the independence statement; the "Privacy" section with
/// the three fixed build statements, the current-session line under a
/// dashed rule and the diagnostics note; then the policy action or, outside
/// production, the missing-policy explanation.
class PrivacySettingsScreen extends ConsumerWidget {
  const PrivacySettingsScreen({super.key});

  /// The current-session line, present only with something truthful to say.
  static const Key sessionKey = ValueKey<String>('settings-privacy-session');

  /// The non-production missing-policy explanation.
  static const Key policyUnavailableKey = ValueKey<String>(
    'settings-privacy-policy-unavailable',
  );

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

    return SettingsPrimerScaffold(
      title: l10n.settingsPrivacyAndLegal,
      body: (BuildContext context, double bottomPadding) =>
          _informationBody(bottomPadding, <Widget>[
            SettingsProse(l10n.settingsAboutUnofficial),
            // "Privacy", not a repeat of the screen title (SF-16, DD SI-03).
            SettingsGroup.information(
              title: l10n.settingsPrivacy,
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
                SettingsFactList(
                  facts: <SettingsFact>[
                    SettingsFact(
                      label: l10n.settingsPrivacyCrashReporting,
                      value: _policyValue(l10n, diagnostics),
                    ),
                    SettingsFact(
                      label: l10n.settingsPrivacyPerformance,
                      value: _policyValue(l10n, diagnostics),
                    ),
                    SettingsFact(
                      label: l10n.settingsPrivacyAdvertising,
                      value: l10n.settingsPrivacyDisabled,
                    ),
                  ],
                ),
                // The one honest live claim: whether *this app's own* reporting
                // could be confirmed during this session. Worded so it can
                // never be read as a statement about platform collection, and
                // omitted entirely when there is nothing to say — a build with
                // no diagnostics policy, or one whose adapters were never even
                // going to activate, has no session to report on.
                //
                // After Advertising, under the dashed rule and directly above
                // the note that qualifies it (SF-16): a runtime reading, set
                // apart from the fixed build statements.
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
                        return SettingsFactList(
                          key: sessionKey,
                          leadingRule: SettingsFactRule.dashed,
                          facts: <SettingsFact>[
                            SettingsFact(
                              label: l10n.settingsPrivacySessionReporting,
                              value: session,
                            ),
                          ],
                        );
                      },
                ),
                // The honest part the status alone cannot carry: the
                // diagnostic components ship in every build of the app, and
                // what the policy controls is transmission, not presence.
                SettingsProse.note(l10n.settingsPrivacyDiagnosticsNote),
              ],
            ),
            if (policy != null)
              Padding(
                padding: const EdgeInsets.only(top: 24),
                child: SettingsExternalLinkRow(
                  key: const ValueKey<String>('settings-privacy-policy'),
                  title: l10n.settingsPrivacyPolicyOpen,
                  divider: true,
                  onActivate: () =>
                      openSettingsExternalLink(context, ref, policy),
                ),
              )
            // With no configured policy, production shows nothing at all: the
            // reader cannot act on it and a self-explaining absence reads as a
            // fault. Outside production the status is useful to whoever
            // builds: a static row in the action's position, its wording
            // unchanged (SF-13).
            else if (explainsAbsence)
              Padding(
                padding: const EdgeInsets.only(top: 24),
                child: SettingsNavigationRow(
                  key: policyUnavailableKey,
                  title: l10n.settingsPrivacyPolicyUnavailable,
                  trailing: SettingsRowTrailing.none,
                  divider: true,
                ),
              ),
          ]),
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
    // With no diagnostics policy there is no session to qualify, and the rows
    // above already say everything true about the build.
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
