import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import 'home_primer_parts.dart';

/// The Home app bar (`shared/components/app-bar.css`, primary variant): the
/// GridView wordmark as the page `h1`, the season beside it, the 48dp Refresh
/// and Settings actions, and the freshness caption on its own row.
///
/// It scrolls with the content (`HEADER-AND-HEADING-DECISIONS.md`: "Home
/// scrolls"). Every value is supplied by the screen: the season only once it is
/// known, the caption only when the screen has something truthful to say.
class HomeHeader extends StatelessWidget {
  const HomeHeader({
    super.key,
    required this.onRefresh,
    required this.onOpenSettings,
    this.season,
    this.caption,
  });

  final VoidCallback onRefresh;
  final VoidCallback onOpenSettings;

  /// The season label ("2026 season"), or `null` while no season is known.
  final String? season;

  /// "Last successful check: 4:22", "Refreshing…", or `null` for none.
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return Padding(
      padding: const EdgeInsets.fromLTRB(GvPrimerLayout.gutter, 12, 12, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Wrap(
                  spacing: 10,
                  crossAxisAlignment: WrapCrossAlignment.end,
                  children: <Widget>[
                    Semantics(
                      header: true,
                      child: HomeDisplayText(
                        l10n.appTitle,
                        size: 24,
                        cap: 34,
                        weight: 800,
                        width: 118,
                        height: 1.1,
                        tracking: -0.02,
                        color: roles.text.primary,
                      ),
                    ),
                    if (season case final String label)
                      Padding(
                        // Baseline alignment with the larger wordmark.
                        padding: const EdgeInsets.only(bottom: 2),
                        child: HomeReadable(
                          child: Text(
                            label,
                            style: homeTextStyle(
                              weight: 500,
                              height: 1.3,
                              color: roles.text.secondary,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              HomeIconButton(
                key: const ValueKey<String>('home-refresh'),
                icon: Icons.refresh,
                label: l10n.homeRefreshAction,
                onPressed: onRefresh,
              ),
              const SizedBox(width: 4),
              HomeIconButton(
                icon: Icons.settings_outlined,
                label: l10n.settingsOpen,
                onPressed: onOpenSettings,
              ),
            ],
          ),
          if (caption case final String text)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: HomeReadable(
                child: Text(
                  text,
                  key: const ValueKey<String>('home-freshness'),
                  style: homeTextStyle(
                    size: 13,
                    height: 1.35,
                    color: roles.text.secondary,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The 48dp round app-bar action (`.icon-btn`): a 24dp icon in the primary
/// text colour, `state.hover` from hovering pointers, `state.pressed.control`
/// while pressed (XT-5), the standard 3px outer focus ring, one button node
/// named by [label] and the same tooltip the legacy action had.
class HomeIconButton extends StatelessWidget {
  const HomeIconButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    const BorderRadius round = BorderRadius.all(Radius.circular(24));
    return Tooltip(
      message: label,
      excludeFromSemantics: true,
      child: GvPrimerFocusTarget(
        onActivate: onPressed,
        semanticLabel: label,
        hoverColor: roles.surface.band,
        pressedColor: roles.state.pressedControl,
        fillRadius: round,
        child: SizedBox.square(
          dimension: GvPrimerLayout.minTarget,
          child: Center(child: Icon(icon, size: 24, color: roles.text.primary)),
        ),
      ),
    );
  }
}
