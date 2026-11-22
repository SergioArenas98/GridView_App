import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../l10n/app_localizations.dart';
import '../../shared/application/fixture_data_identity_provider.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/media.dart';
import '../../shared/presentation/domain_status.dart';
import '../application/data_source_attributions.dart';
import '../domain/data_source_attribution.dart';
import 'widgets/data_source_attribution_card.dart';
import 'widgets/fixture_data_label.dart';
import 'widgets/settings_app_bar.dart';
import 'widgets/settings_group.dart';
import 'widgets/settings_information.dart';

/// The credits GridView is required to show, built from the actually-configured
/// data source, the repository-owned data-source attribution record and locally
/// persisted media metadata.
///
/// A pure read: it issues no request of its own, so it works offline as soon as
/// the content manifest has been synchronised once. Credits are deduplicated
/// across size variants, and an asset with no attribution text simply does not
/// appear — an absent credit is never rendered as a credit for "unknown".
///
/// Third-party data sources are credited from the attribution record (ADR 0019
/// decision 5), each with its own status. No status claims that provider data
/// is being served or retrieved live: a dormant source is credited as not
/// connected, and an active one as published only in operator-run batches.
///
/// Primer V2 (Step 55C.13B, `settings/information/acknowledgements.html`,
/// `light-rollout-b2/info-acknowledgements-*`): the independence statement,
/// then the Data, Data sources and Images sections under kicker headings,
/// flat on the page. The truth conditions are unchanged.
class AcknowledgementsScreen extends ConsumerWidget {
  const AcknowledgementsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool usesMockData = ref.watch(usesMockDataProvider);
    final String? fixtureLabel = fixtureDataSourceLabel(
      l10n,
      ref.watch(fixtureDataIdentityProvider).value,
    );
    final AsyncValue<List<MediaAttribution>> credits = ref.watch(
      mediaAttributionsProvider,
    );
    final AsyncValue<DataSourceAttributions> sources = ref.watch(
      dataSourceAttributionsProvider,
    );

    return SettingsPrimerScaffold(
      title: l10n.settingsAcknowledgements,
      body: (BuildContext context, double bottomPadding) =>
          SingleChildScrollView(
            padding: EdgeInsets.only(
              top: settingsInformationTop,
              bottom: bottomPadding,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                SettingsProse(l10n.settingsAboutUnofficial),
                SettingsGroup.information(
                  title: l10n.settingsAcknowledgementsData,
                  children: <Widget>[
                    SettingsFactList(
                      facts: <SettingsFact>[
                        SettingsFact(
                          label: l10n.settingsDataSource,
                          value: usesMockData
                              ? fixtureLabel ?? l10n.settingsDataSourceSample
                              : l10n.settingsDataSourceRemote,
                        ),
                      ],
                    ),
                  ],
                ),
                ?_sources(l10n, sources),
                SettingsGroup.information(
                  title: l10n.settingsAcknowledgementsMedia,
                  children: <Widget>[_credits(l10n, credits)],
                ),
              ],
            ),
          ),
    );
  }

  /// The data-source attribution section, one block per source, 40px apart.
  ///
  /// The record is bundled with the app, so it resolves almost at once. Until
  /// it has, a neutral static skeleton is shown rather than a claim about which
  /// sources exist. A record that cannot be read says so plainly, in the
  /// Primer notice; it is never rendered as "no sources". An empty record
  /// renders no section at all.
  Widget? _sources(
    AppLocalizations l10n,
    AsyncValue<DataSourceAttributions> sources,
  ) {
    final Widget content;
    if (sources.hasValue) {
      final List<DataSourceAttribution> resolved = sources.requireValue.sources;
      if (resolved.isEmpty) return null;
      content = Column(
        key: sourcesKey,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (int i = 0; i < resolved.length; i++) ...<Widget>[
            if (i > 0) const SizedBox(height: 40),
            DataSourceAttributionCard(source: resolved[i]),
          ],
        ],
      );
    } else if (sources.hasError) {
      content = SettingsInfoNotice(
        l10n.settingsSourcesUnavailable,
        key: sourcesUnavailableKey,
      );
    } else {
      content = SettingsInfoLoading(
        key: sourcesResolvingKey,
        semanticLabel: l10n.a11yLoading,
      );
    }
    return SettingsGroup.information(
      title: l10n.settingsAcknowledgementsSources,
      children: <Widget>[content],
    );
  }

  /// The credits section.
  ///
  /// "No attributions are stored yet" is a **statement about stored data**, so it
  /// may only be made once the read has actually answered. While it is in flight
  /// this renders a neutral static skeleton instead: claiming there are no
  /// credits before knowing would be asserting something the screen has not yet
  /// established, and for a legal notice that is the worst possible moment to be
  /// wrong. A stream error is treated the same way — unknown, not empty.
  Widget _credits(
    AppLocalizations l10n,
    AsyncValue<List<MediaAttribution>> credits,
  ) {
    final List<MediaAttribution>? resolved = credits.hasValue
        ? credits.requireValue
        : null;
    if (resolved == null) {
      return SettingsInfoLoading(
        key: resolvingKey,
        semanticLabel: l10n.a11yLoading,
      );
    }
    if (resolved.isEmpty) {
      return SettingsInfoEmpty(
        l10n.settingsAcknowledgementsEmpty,
        key: emptyKey,
      );
    }
    return SettingsFactList(
      key: creditsKey,
      facts: <SettingsFact>[
        for (final MediaAttribution credit in resolved)
          SettingsFact(
            // The subject of the credit, localized. Never the media id, the
            // owner id, the URL or the wire category token. The credit text
            // is the rights holder's own and its language is not known, so
            // it is not marked.
            label: mediaCategoryLabel(l10n, credit.category),
            value: <String>[credit.attribution, ?credit.license].join(' · '),
          ),
      ],
    );
  }

  /// Which of the three credit states is rendered. Test-visible only.
  static const Key resolvingKey = ValueKey<String>(
    'acknowledgements-resolving',
  );
  static const Key emptyKey = ValueKey<String>('acknowledgements-empty');
  static const Key creditsKey = ValueKey<String>('acknowledgements-credits');

  /// Which of the three data-source states is rendered. Test-visible only.
  static const Key sourcesResolvingKey = ValueKey<String>(
    'acknowledgements-sources-resolving',
  );
  static const Key sourcesUnavailableKey = ValueKey<String>(
    'acknowledgements-sources-unavailable',
  );
  static const Key sourcesKey = ValueKey<String>('acknowledgements-sources');
}
