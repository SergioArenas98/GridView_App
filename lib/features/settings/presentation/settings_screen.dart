import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/environment/app_environment.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/preferences/preference_values.dart';
import '../../../core/preferences/preferences_providers.dart';
import '../../../core/theme/theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../dev/catalogue/component_catalogue_screen.dart';
import '../../shared/application/providers.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';
import '../application/external_links.dart';
import '../domain/preference_labels.dart';
import 'information_screens.dart';
import 'widgets/settings_rows.dart';

/// The Settings root (App Flow §13, Phase 8 §8).
///
/// A secondary screen: it lives on the root navigator, outside bottom
/// navigation, so opening it never changes the active branch and Android back
/// always returns to the exact origin — including its scroll position — rather
/// than to a default tab.
///
/// Each preference row shows its own current value in localized copy and opens a
/// focused selection screen; a wire token is never shown as display copy. The
/// Developer section exists only outside production, so the component catalogue
/// stays unreachable in production builds.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key, this.environmentOverride});

  /// Test seam only. Production builds pass nothing, so the developer section is
  /// gated on the real compile-time [AppEnvironment.current].
  final AppEnvironment? environmentOverride;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AppEnvironment environment =
        environmentOverride ?? ref.watch(appEnvironmentProvider);
    final AppPreferences preferences = ref.watch(appPreferencesProvider);
    final ExternalLink? contact = ref
        .watch(externalLinkConfigProvider)
        .supportContact;

    return GvScreenScaffold(
      title: l10n.settingsTitle,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        children: <Widget>[
          GvScreenSection(
            title: l10n.settingsSectionPreferences,
            child: GvInfoCard(
              children: <Widget>[
                GvSettingsRow(
                  key: const ValueKey<String>('settings-language'),
                  title: l10n.settingsLanguage,
                  value: PreferenceLabels.language(l10n, preferences.language),
                  onTap: () => context.push(RoutePaths.settingsLanguage),
                ),
                GvSettingsRow(
                  key: const ValueKey<String>('settings-theme'),
                  title: l10n.settingsTheme,
                  value: PreferenceLabels.theme(l10n, preferences.theme),
                  onTap: () => context.push(RoutePaths.settingsTheme),
                ),
                GvSettingsRow(
                  key: const ValueKey<String>('settings-time'),
                  title: l10n.settingsTimeDisplay,
                  value: PreferenceLabels.timeDisplay(
                    l10n,
                    preferences.timeDisplay,
                  ),
                  onTap: () => context.push(RoutePaths.settingsTime),
                ),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          GvScreenSection(
            title: l10n.settingsSectionDataApp,
            child: GvInfoCard(
              children: <Widget>[
                GvSettingsRow(
                  key: const ValueKey<String>('settings-data'),
                  title: l10n.settingsDataAndUpdates,
                  onTap: () => context.push(RoutePaths.settingsData),
                ),
                GvSettingsRow(
                  key: const ValueKey<String>('settings-acknowledgements'),
                  title: l10n.settingsAcknowledgements,
                  onTap: () =>
                      context.push(RoutePaths.settingsAcknowledgements),
                ),
                GvSettingsRow(
                  key: const ValueKey<String>('settings-about'),
                  title: l10n.settingsAppInformation,
                  onTap: () => context.push(RoutePaths.settingsAbout),
                ),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          GvScreenSection(
            title: l10n.settingsSectionPrivacySupport,
            child: GvInfoCard(
              children: <Widget>[
                GvSettingsRow(
                  key: const ValueKey<String>('settings-privacy'),
                  title: l10n.settingsPrivacyAndLegal,
                  onTap: () => context.push(RoutePaths.settingsPrivacy),
                ),
                // Feedback is an action rather than a route. With no configured
                // contact the row states so instead of offering a dead control.
                GvSettingsRow(
                  key: const ValueKey<String>('settings-feedback'),
                  title: l10n.settingsFeedback,
                  description: contact == null
                      ? l10n.settingsFeedbackUnavailable
                      : null,
                  icon: contact == null ? null : Icons.mail_outline,
                  onTap: contact == null
                      ? null
                      : () => openExternalLink(context, ref, contact),
                ),
              ],
            ),
          ),

          if (!environment.isProduction) ...<Widget>[
            const SizedBox(height: GvSpacing.xl),
            GvScreenSection(
              title: l10n.settingsSectionDeveloper,
              child: GvInfoCard(
                children: <Widget>[
                  GvSettingsRow(
                    key: const ValueKey<String>('settings-catalogue'),
                    title: l10n.settingsComponentCatalogue,
                    description: l10n.settingsComponentCatalogueDescription,
                    icon: Icons.widgets_outlined,
                    onTap: () => ComponentCatalogueScreen.open(context),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
