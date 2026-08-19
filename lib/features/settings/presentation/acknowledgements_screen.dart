import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
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
    final AsyncValue<List<MediaAttribution>> credits = ref.watch(
      mediaAttributionsProvider,
    );

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
            child: _credits(context, l10n, credits),
          ),
        ],
      ),
    );
  }

  /// The credits section.
  ///
  /// "No attributions are stored yet" is a **statement about stored data**, so it
  /// may only be made once the read has actually answered. While it is in flight
  /// this renders a neutral reserved block instead: claiming there are no credits
  /// before knowing would be asserting something the screen has not yet
  /// established, and for a legal notice that is the worst possible moment to be
  /// wrong. A stream error is treated the same way — unknown, not empty.
  Widget _credits(
    BuildContext context,
    AppLocalizations l10n,
    AsyncValue<List<MediaAttribution>> credits,
  ) {
    final List<MediaAttribution>? resolved = credits.hasValue
        ? credits.requireValue
        : null;
    if (resolved == null) {
      return GvInfoCard(
        key: resolvingKey,
        children: <Widget>[
          GvLoadingSemantics(
            label: l10n.a11yLoading,
            child: const GvSkeletonBlock(height: 20),
          ),
        ],
      );
    }
    if (resolved.isEmpty) {
      return GvInfoCard(
        key: emptyKey,
        children: <Widget>[
          Text(l10n.settingsAcknowledgementsEmpty, style: context.gvText.bodyM),
        ],
      );
    }
    return GvInfoCard(
      key: creditsKey,
      children: <Widget>[
        for (final MediaAttribution credit in resolved)
          GvSettingsField(
            // The subject of the credit, localized. Never the media id, the owner
            // id, the URL or the wire category token.
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
}
