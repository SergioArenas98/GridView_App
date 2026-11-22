import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import 'home_primer_parts.dart';

/// One Explore shortcut.
@immutable
class HomeExploreLink {
  const HomeExploreLink({
    required this.key,
    required this.label,
    required this.semanticLabel,
    required this.glyph,
    required this.onOpen,
  });

  final String key;
  final String label;
  final String semanticLabel;

  /// The approved Primer V2 pictogram (drivers, teams or circuits).
  final GvPrimerGlyph glyph;
  final VoidCallback onOpen;
}

/// The Explore shortcuts (`refinement-01` `.explore`): one segmented strip on
/// the band, three links split by `line.strong` separators; at or below 16.5em
/// of width (large text) it becomes a list with horizontal rules. Each link is
/// a ≥ 48dp target with an accent icon, a weight-700 label, `state.hover` /
/// `state.pressed.control` fills and the focus ring 4px **inside** the link
/// (XT-1), so the strip's rounded clip never cuts it.
class HomeExploreStrip extends StatelessWidget {
  const HomeExploreStrip({super.key, required this.links});

  final List<HomeExploreLink> links;

  static const double narrowEm = 16.5;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        GvPrimerSectionTitle(l10n.homeQuickLinks),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            final bool narrow =
                constraints.maxWidth <=
                GvPrimerLayout.containerEm(
                  MediaQuery.textScalerOf(context),
                  narrowEm,
                );
            final List<Widget> items = <Widget>[
              for (int i = 0; i < links.length; i++)
                _link(context, roles, links[i], narrow, separated: i > 0),
            ];
            return DecoratedBox(
              decoration: BoxDecoration(
                color: roles.surface.band,
                border: Border.all(color: roles.line.subtle),
                borderRadius: BorderRadius.circular(GvPrimerLayout.radiusMd),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(
                  GvPrimerLayout.radiusMd - 1,
                ),
                child: narrow
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: items,
                      )
                    : IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: <Widget>[
                            for (final Widget item in items)
                              Expanded(child: item),
                          ],
                        ),
                      ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _link(
    BuildContext context,
    GvPrimerRoles roles,
    HomeExploreLink link,
    bool narrow, {
    required bool separated,
  }) {
    final Widget icon = GvPrimerIcon(
      link.glyph,
      size: 24,
      color: roles.text.accent,
    );
    final Widget label = Text(
      link.label,
      style: homeTextStyle(weight: 700, height: 1.3, color: roles.text.primary),
    );
    final Widget body = narrow
        ? ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: <Widget>[
                  icon,
                  const SizedBox(width: 14),
                  Expanded(child: label),
                ],
              ),
            ),
          )
        : ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 84),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: <Widget>[icon, const SizedBox(height: 10), label],
              ),
            ),
          );
    return Stack(
      children: <Widget>[
        Positioned.fill(
          child: GvPrimerFocusTarget(
            key: ValueKey<String>(link.key),
            onActivate: link.onOpen,
            role: GvPrimerTargetRole.link,
            semanticLabel: link.semanticLabel,
            geometry: GvPrimerFocusGeometry.homeExplore,
            hoverColor: roles.surface.raised,
            pressedColor: roles.state.pressedControl,
            child: const SizedBox.expand(),
          ),
        ),
        IgnorePointer(child: ExcludeSemantics(child: body)),
        if (separated)
          Positioned(
            left: narrow ? 16 : 0,
            right: narrow ? 16 : null,
            top: narrow ? 0 : 12,
            bottom: narrow ? null : 12,
            child: SizedBox(
              width: narrow ? null : 1,
              height: narrow ? 1 : null,
              child: ColoredBox(color: roles.line.strong),
            ),
          ),
      ],
    );
  }
}
