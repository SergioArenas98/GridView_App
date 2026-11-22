import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/environment/app_environment.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/preferences/preference_values.dart';
import '../../../core/preferences/preferences_providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../dev/catalogue/component_catalogue_screen.dart';
import '../../shared/application/providers.dart';
import '../application/external_links.dart';
import '../domain/preference_labels.dart';
import 'widgets/settings_app_bar.dart';
import 'widgets/settings_group.dart';
import 'widgets/settings_navigation_row.dart';
import 'widgets/settings_snackbar.dart';

/// The Settings root (App Flow §13, Phase 8 §8), in Primer V2 (Step 55C.13A;
/// `settings/index.html`, `production-no-contact.html`,
/// `non-production.html`).
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
///
/// Groups, order and conditional rows are unchanged; only the presentation
/// moved to Primer V2: flat rows with inset hairlines, kicker headings, the
/// label-and-value preference rows with the small 12° mark, the mail glyph on
/// Send feedback, and no decorative icon on the catalogue row.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key, this.environmentOverride});

  /// Test seam only. Production builds pass nothing, so the developer section is
  /// gated on the real compile-time [AppEnvironment.current].
  final AppEnvironment? environmentOverride;

  /// The back action's key.
  static const Key backKey = ValueKey<String>('settings-back');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AppEnvironment environment =
        environmentOverride ?? ref.watch(appEnvironmentProvider);
    final AppPreferences preferences = ref.watch(appPreferencesProvider);
    final ExternalLink? contact = ref
        .watch(externalLinkConfigProvider)
        .supportContact;

    // Awaited by the row, so it can take keyboard focus back after Back.
    Future<void> open(String location) => context.push<void>(location);

    return SettingsPrimerScaffold(
      title: l10n.settingsTitle,
      backKey: backKey,
      body: (BuildContext context, double bottomPadding) => SingleChildScrollView(
        // `.page`: 4px above the first group.
        padding: EdgeInsets.only(top: 4, bottom: bottomPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            SettingsGroup(
              first: true,
              title: l10n.settingsSectionPreferences,
              children: <Widget>[
                SettingsNavigationRow(
                  key: const ValueKey<String>('settings-language'),
                  title: l10n.settingsLanguage,
                  value: PreferenceLabels.language(l10n, preferences.language),
                  onActivate: () => open(RoutePaths.settingsLanguage),
                ),
                SettingsNavigationRow(
                  key: const ValueKey<String>('settings-theme'),
                  title: l10n.settingsTheme,
                  value: PreferenceLabels.theme(l10n, preferences.theme),
                  onActivate: () => open(RoutePaths.settingsTheme),
                  divider: true,
                ),
                SettingsNavigationRow(
                  key: const ValueKey<String>('settings-time'),
                  title: l10n.settingsTimeDisplay,
                  value: PreferenceLabels.timeDisplay(
                    l10n,
                    preferences.timeDisplay,
                  ),
                  onActivate: () => open(RoutePaths.settingsTime),
                  divider: true,
                ),
              ],
            ),
            SettingsGroup(
              title: l10n.settingsSectionDataApp,
              children: <Widget>[
                SettingsNavigationRow(
                  key: const ValueKey<String>('settings-data'),
                  title: l10n.settingsDataAndUpdates,
                  onActivate: () => open(RoutePaths.settingsData),
                ),
                SettingsNavigationRow(
                  key: const ValueKey<String>('settings-acknowledgements'),
                  title: l10n.settingsAcknowledgements,
                  onActivate: () => open(RoutePaths.settingsAcknowledgements),
                  divider: true,
                ),
                SettingsNavigationRow(
                  key: const ValueKey<String>('settings-about'),
                  title: l10n.settingsAppInformation,
                  onActivate: () => open(RoutePaths.settingsAbout),
                  divider: true,
                ),
              ],
            ),
            SettingsGroup(
              title: l10n.settingsSectionPrivacySupport,
              children: <Widget>[
                SettingsNavigationRow(
                  key: const ValueKey<String>('settings-privacy'),
                  title: l10n.settingsPrivacyAndLegal,
                  onActivate: () => open(RoutePaths.settingsPrivacy),
                ),
                // Feedback is an action rather than a route.
                //
                // With a configured contact it is a normal row with the mail
                // glyph in place of the chevron. With none, production omits it
                // entirely — a row that explains its own absence reads as a
                // fault to a user who cannot act on it — while dev and staging
                // state the status, which is useful to whoever is building.
                // Either way there is never a control that cannot open anything.
                if (contact != null)
                  SettingsNavigationRow(
                    key: const ValueKey<String>('settings-feedback'),
                    title: l10n.settingsFeedback,
                    trailing: SettingsRowTrailing.mail,
                    onActivate: () =>
                        openSettingsExternalLink(context, ref, contact),
                    divider: true,
                  )
                else if (showsConfigurationStatus(environment))
                  SettingsNavigationRow(
                    key: const ValueKey<String>('settings-feedback'),
                    title: l10n.settingsFeedback,
                    description: l10n.settingsFeedbackUnavailable,
                    trailing: SettingsRowTrailing.none,
                    divider: true,
                  ),
              ],
            ),
            if (!environment.isProduction)
              SettingsGroup(
                title: l10n.settingsSectionDeveloper,
                dashed: true,
                children: <Widget>[
                  SettingsNavigationRow(
                    key: const ValueKey<String>('settings-catalogue'),
                    title: l10n.settingsComponentCatalogue,
                    description: l10n.settingsComponentCatalogueDescription,
                    onActivate: () async =>
                        ComponentCatalogueScreen.open(context),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
