import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/media.dart';
import '../../shared/presentation/domain_status.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';
import 'widgets/settings_rows.dart';

/// The credits GridView is required to show, built from locally persisted media
/// metadata and the actually-configured data source.
///
/// A pure read: it issues no request of its own, so it works offline as soon as
/// the content manifest has been synchronised once. Credits are deduplicated
/// across size variants, and an asset with no attribution text simply does not
/// appear — an absent credit is never rendered as a credit for "unknown".
///
/// Only the configured data source is acknowledged. No third-party Formula 1
/// provider is named, because none is configured: naming a Phase 9 candidate
/// here would be a claim the build cannot support.
class AcknowledgementsScreen extends ConsumerWidget {
  const AcknowledgementsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool usesMockData = ref.watch(usesMockDataProvider);
    final List<MediaAttribution> credits =
        ref.watch(mediaAttributionsProvider).value ??
        const <MediaAttribution>[];

    return GvScreenScaffold(
      title: l10n.settingsAcknowledgements,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        children: <Widget>[
          Text(l10n.settingsAboutUnofficial, style: context.gvText.bodyM),
          const SizedBox(height: GvSpacing.lg),

          GvScreenSection(
            title: l10n.settingsAcknowledgementsData,
            child: GvInfoCard(
              children: <Widget>[
                GvSettingsField(
                  label: l10n.settingsDataSource,
                  value: usesMockData
                      ? l10n.settingsDataSourceSample
                      : l10n.settingsDataSourceRemote,
                ),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          GvScreenSection(
            title: l10n.settingsAcknowledgementsMedia,
            child: credits.isEmpty
                ? GvInfoCard(
                    children: <Widget>[
                      Text(
                        l10n.settingsAcknowledgementsEmpty,
                        style: context.gvText.bodyM,
                      ),
                    ],
                  )
                : GvInfoCard(
                    children: <Widget>[
                      for (final MediaAttribution credit in credits)
                        GvSettingsField(
                          label: mediaCategoryLabel(l10n, credit.category),
                          value: <String>[
                            credit.attribution,
                            ?credit.license,
                          ].join(' · '),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
