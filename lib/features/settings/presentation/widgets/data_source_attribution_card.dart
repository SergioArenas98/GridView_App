import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/theme.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/presentation/widgets/screen_sections.dart';
import '../../application/external_links.dart';
import '../../domain/data_source_attribution.dart';
import '../information_screens.dart' show openExternalLink;
import 'settings_rows.dart';

/// The attribution one data source is owed (GridView_Provider_Evaluation.md
/// §7.6.2): its name, whether GridView retrieves data from it yet, the
/// modification and licence notices, any notice the licensor supplied, and
/// links to the project, its terms and the licence.
///
/// The source's own values — name, licence name and notices — are shown as
/// published, never translated. Only GridView's explanatory copy is localized.
class DataSourceAttributionCard extends ConsumerWidget {
  const DataSourceAttributionCard({super.key, required this.source});

  final DataSourceAttribution source;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ExternalLink? terms = source.termsLink;
    return GvInfoCard(
      key: ValueKey<String>('data-source-${source.sourceId}'),
      children: <Widget>[
        _Notices(
          source: source,
          lines: <String>[
            switch (source.status) {
              // A dormant source is credited without claiming that data from
              // it is being served.
              DataSourceStatus.dormant => l10n.settingsSourceStatusDormant,
              DataSourceStatus.active => l10n.settingsSourceStatusActive,
            },
            l10n.settingsSourceModified,
            l10n.settingsSourceLicenseNotice(source.name, source.licenseName),
            l10n.settingsSourceNotEndorsed(source.name),
          ],
        ),
        // Licensor-supplied notices, retained verbatim when present
        // (CC BY-NC-SA 4.0 §3(a)(1)(A)). An absent notice renders as nothing.
        if (source.creatorDesignation != null)
          GvSettingsField(
            label: l10n.settingsSourceCredit,
            value: source.creatorDesignation,
          ),
        if (source.copyrightNotice != null)
          GvSettingsField(
            label: l10n.settingsSourceCopyright,
            value: source.copyrightNotice,
          ),
        if (source.warrantyDisclaimerNotice != null)
          GvSettingsField(
            label: l10n.settingsSourceNotice,
            value: source.warrantyDisclaimerNotice,
          ),
        GvSettingsRow(
          key: ValueKey<String>('data-source-${source.sourceId}-project'),
          title: l10n.settingsSourceProject,
          value: displayLink(source.sourceLink),
          icon: Icons.open_in_new,
          onTap: () => openExternalLink(context, ref, source.sourceLink),
        ),
        if (terms != null)
          GvSettingsRow(
            key: ValueKey<String>('data-source-${source.sourceId}-terms'),
            title: l10n.settingsSourceTerms,
            value: displayLink(terms),
            icon: Icons.open_in_new,
            onTap: () => openExternalLink(context, ref, terms),
          ),
        GvSettingsRow(
          key: ValueKey<String>('data-source-${source.sourceId}-license'),
          title: l10n.settingsSourceLicense,
          value: source.licenseName,
          description: source.licenseTitle,
          icon: Icons.open_in_new,
          onTap: () => openExternalLink(context, ref, source.licenseLink),
        ),
      ],
    );
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

/// The source's name and the notices about it, read as one block.
class _Notices extends StatelessWidget {
  const _Notices({required this.source, required this.lines});

  final DataSourceAttribution source;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: GvSpacing.sm,
        vertical: GvSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Semantics(
            header: true,
            child: Text(source.name, style: context.gvText.cardTitle),
          ),
          for (final String line in lines) ...<Widget>[
            const SizedBox(height: GvSpacing.xs),
            Text(line, style: context.gvText.bodyM),
          ],
        ],
      ),
    );
  }
}
