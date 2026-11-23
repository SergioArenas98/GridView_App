import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/theme.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/application/fixture_data_identity_provider.dart';
import '../../../shared/domain/fixture_data_identity.dart';
import '../../application/external_links.dart';
import '../../domain/data_source_attribution.dart';
import 'settings_external_link_row.dart';
import 'settings_information.dart';
import 'settings_primer_text.dart';
import 'settings_snackbar.dart';

/// The attribution one data source is owed (GridView_Provider_Evaluation.md
/// §7.6.2): its name, how data from it can reach GridView, the
/// modification and licence notices, any notice the licensor supplied, and
/// links to the project, its terms and the licence.
///
/// The source's own values — name, licence name and notices — are shown as
/// published, never translated. Only GridView's explanatory copy is localized.
///
/// Primer V2 (Step 55C.13B, `information.css` `.source`): no card. The
/// provider name is a heading (22px, 800, `wdth` 96), the notices follow as
/// reading text 12px apart, supplied notices as prose facts under a
/// hairline, then the external-link rows. Licence tokens such as "BY-NC-SA"
/// wrap naturally; nothing is inserted into or replaced in a legal string
/// (owner decision SF-14).
class DataSourceAttributionCard extends ConsumerWidget {
  const DataSourceAttributionCard({super.key, required this.source});

  final DataSourceAttribution source;

  /// The language of the record's free text (licence title and supplied
  /// notices), for screen-reader pronunciation only (SF-13).
  ///
  /// The record is repository-owned and bundled (ADR 0019): it has a single,
  /// unlocalized value per field, written in English (`data-sources-v3`;
  /// DESIGN-DECISIONS SI-02, backlog SETT-20). It carries no language tag, so
  /// a localized record would need this revisited. The source name and the
  /// licence name are identifiers and are not marked.
  static const Locale recordTextLocale = Locale('en');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ExternalLink? terms = source.termsLink;
    final FixtureDataIdentity? fixtureData = ref
        .watch(fixtureDataIdentityProvider)
        .value;
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final List<String> notices = <String>[
      _status(l10n, fixtureData),
      l10n.settingsSourceModified,
      l10n.settingsSourceLicenseNotice(source.name, source.licenseName),
      l10n.settingsSourceNotEndorsed(source.name),
    ];
    Future<void> open(ExternalLink link) =>
        openSettingsExternalLink(context, ref, link);
    return Padding(
      key: ValueKey<String>('data-source-${source.sourceId}'),
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GvPrimerLayout.gutter,
            ),
            child: Semantics(
              header: true,
              child: Text(
                source.name,
                style: SettingsType.sourceName.style().copyWith(
                  color: roles.text.primary,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          for (int i = 0; i < notices.length; i++)
            SettingsProse(notices[i], top: i == 0 ? 0 : 12),
          // Licensor-supplied notices, retained verbatim when present
          // (CC BY-NC-SA 4.0 §3(a)(1)(A)). An absent notice renders as
          // nothing, and with none the list renders nothing at all.
          Padding(
            padding: EdgeInsets.only(top: _hasSuppliedNotice ? 12 : 0),
            child: SettingsFactList(
              leadingRule: SettingsFactRule.hairline,
              facts: <SettingsFact>[
                SettingsFact(
                  label: l10n.settingsSourceCredit,
                  value: source.creatorDesignation,
                  kind: SettingsFactKind.prose,
                  valueLocale: recordTextLocale,
                ),
                SettingsFact(
                  label: l10n.settingsSourceCopyright,
                  value: source.copyrightNotice,
                  kind: SettingsFactKind.prose,
                  valueLocale: recordTextLocale,
                ),
                SettingsFact(
                  label: l10n.settingsSourceNotice,
                  value: source.warrantyDisclaimerNotice,
                  kind: SettingsFactKind.prose,
                  valueLocale: recordTextLocale,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SettingsExternalLinkRow(
            key: ValueKey<String>('data-source-${source.sourceId}-project'),
            title: l10n.settingsSourceProject,
            address: displayLink(source.sourceLink),
            divider: true,
            onActivate: () => open(source.sourceLink),
          ),
          if (terms != null)
            SettingsExternalLinkRow(
              key: ValueKey<String>('data-source-${source.sourceId}-terms'),
              title: l10n.settingsSourceTerms,
              address: displayLink(terms),
              divider: true,
              onActivate: () => open(terms),
            ),
          SettingsExternalLinkRow(
            key: ValueKey<String>('data-source-${source.sourceId}-license'),
            title: l10n.settingsSourceLicense,
            value: source.licenseName,
            description: source.licenseTitle,
            descriptionLocale: recordTextLocale,
            divider: true,
            onActivate: () => open(source.licenseLink),
          ),
        ],
      ),
    );
  }

  bool get _hasSuppliedNotice => <String?>[
    source.creatorDesignation,
    source.copyrightNotice,
    source.warrantyDisclaimerNotice,
  ].any((String? notice) => notice != null && notice.isNotEmpty);

  /// How data from this source can reach this build.
  ///
  /// A test-only frozen-data build bundles a fixed snapshot of the source's
  /// data, so it says exactly that, with the capture date, whatever the
  /// record's status: it neither claims live retrieval nor that no data from
  /// the source is shown. Every other build follows the record.
  String _status(AppLocalizations l10n, FixtureDataIdentity? fixtureData) {
    if (fixtureData case FrozenCaptureData(
      :final Set<String> sourceIds,
      :final DateTime capturedAt,
    ) when sourceIds.contains(source.sourceId)) {
      return l10n.settingsSourceStatusFrozen(captureDateLabel(capturedAt));
    }
    return switch (source.status) {
      // None claims that data from the source is being served: the build
      // cannot know whether the service has published anything from it yet.
      DataSourceStatus.dormant => l10n.settingsSourceStatusDormant,
      DataSourceStatus.active => l10n.settingsSourceStatusActive,
      DataSourceStatus.automatic => l10n.settingsSourceStatusAutomatic,
    };
  }

  /// A link as the reader sees it: host and path, without the scheme or a
  /// trailing slash. The full URL is what is opened.
  static String displayLink(ExternalLink link) {
    final String path = link.uri.path.endsWith('/')
        ? link.uri.path.substring(0, link.uri.path.length - 1)
        : link.uri.path;
    return '${link.uri.host}$path';
  }
}
