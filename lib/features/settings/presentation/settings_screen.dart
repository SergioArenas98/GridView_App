import 'package:flutter/material.dart';

import '../../../app/environment/app_environment.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../dev/catalogue/component_catalogue_screen.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';

/// Settings skeleton (App Flow §13). Theme is shown as dark-only for v1. The
/// component-catalogue entry appears only outside production so the catalogue
/// stays unreachable in production builds.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key, this.environmentOverride});

  /// Test seam only. Production builds pass nothing, so the developer section is
  /// gated on the real compile-time [AppEnvironment.current].
  final AppEnvironment? environmentOverride;

  // Mirrors pubspec `version: 1.2.1+7`. Shown as a static placeholder in this
  // data-independent skeleton (no package_info dependency is introduced).
  static const String _versionLabel = '1.2.1 (7)';

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AppEnvironment environment =
        environmentOverride ?? AppEnvironment.current;

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
            title: l10n.settingsSectionGeneral,
            child: GvInfoCard(
              children: <Widget>[
                GvDetailField(
                  label: l10n.settingsLanguage,
                  value: l10n.settingsLanguageValue,
                ),
                GvDetailField(
                  label: l10n.settingsTheme,
                  value: l10n.settingsThemeValue,
                ),
                Padding(
                  padding: const EdgeInsets.only(top: GvSpacing.xxs),
                  child: Text(
                    l10n.settingsThemeNote,
                    style: GvTypography.caption,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          GvScreenSection(
            title: l10n.settingsSectionAbout,
            child: GvInfoCard(
              children: <Widget>[
                GvDetailField(label: l10n.settingsPrivacy, value: ''),
                GvDetailField(label: l10n.settingsAcknowledgements, value: ''),
                GvDetailField(
                  label: l10n.settingsVersion,
                  value: _versionLabel,
                ),
              ],
            ),
          ),

          // Developer-only entry to the component catalogue (dev/staging only).
          if (!environment.isProduction) ...<Widget>[
            const SizedBox(height: GvSpacing.xl),
            GvScreenSection(
              title: l10n.settingsSectionDeveloper,
              child: GvContentCard(
                onTap: () => ComponentCatalogueScreen.open(context),
                child: Row(
                  children: <Widget>[
                    const Icon(
                      Icons.widgets_outlined,
                      size: GvIconSizes.lg,
                      color: GvColors.accentSecondary,
                    ),
                    const SizedBox(width: GvSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            l10n.settingsComponentCatalogue,
                            style: GvTypography.cardTitle,
                          ),
                          const SizedBox(height: GvSpacing.xxs),
                          Text(
                            l10n.settingsComponentCatalogueDescription,
                            style: GvTypography.bodyM,
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: GvColors.textMuted),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
