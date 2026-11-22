import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'primer_catalogue_geometry.dart';
import 'primer_catalogue_rows.dart';
import 'primer_catalogue_shared.dart';

/// Development-only preview of the first Primer V2 components (Step 55B.1).
///
/// The same specimens render in a Dark and a Light panel, each declaring its
/// theme through [GvPrimerSurface] rather than a nested [ThemeData]. Nothing
/// here is used by a production screen. Gallery copy is English and
/// untranslated, like the rest of the catalogue; the Spanish lines are sample
/// content for glyph and wrapping review.
class PrimerCatalogueSection extends StatelessWidget {
  const PrimerCatalogueSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const GvSectionHeader(
          title: 'Primer V2 preview (not active in the app)',
        ),
        const SizedBox(height: GvSpacing.xs),
        for (final (String name, GvPrimerRoles roles)
            in <(String, GvPrimerRoles)>[
              ('Dark', GvPrimerRoles.dark),
              ('Light', GvPrimerRoles.light),
            ]) ...<Widget>[
          PrimerThemePanel(
            key: ValueKey<String>('primer-panel-$name'),
            name: name,
            roles: roles,
          ),
          const SizedBox(height: GvSpacing.md),
        ],
      ],
    );
  }
}

/// One theme's specimens. Public so tests can pump a single panel.
class PrimerThemePanel extends StatelessWidget {
  const PrimerThemePanel({
    super.key,
    required this.name,
    required this.roles,
    this.spanish = false,
  });

  final String name;
  final GvPrimerRoles roles;

  /// Renders the editorial row specimens with the Spanish fixture words.
  final bool spanish;

  @override
  Widget build(BuildContext context) {
    return GvPrimerSurface(
      kind: GvPrimerSurfaceKind.page,
      roles: roles,
      child: ColoredBox(
        color: roles.surface.page,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _specimens(),
            // Editorial rows are full width, as on a screen (Step 55B.3).
            PrimerEditorialRowsSection(spanish: spanish),
            // Shared detail and state components (Step 55B.4).
            PrimerSharedComponentsSection(spanish: spanish),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _specimens() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _Caption('Primer V2 $name'),
          const _Caption('Archivo typography'),
          const _TypeSpecimens(),
          const _Caption('Surface contexts'),
          const _SurfaceSpecimens(),
          const _Caption('Status chips'),
          const _ChipSpecimens(),
          const _Caption(
            'Live: isolated specimen, contextual validation '
            'pending (LT-7)',
          ),
          const Wrap(
            children: <Widget>[
              GvPrimerStatusChip(label: 'Live', kind: GvPrimerChipKind.live),
            ],
          ),
          const _Caption(
            'Selected and unselected colour roles (12° cut '
            'pending XS-27)',
          ),
          const _SelectionSpecimens(),
          const _Caption('Segmented control (Standings, Explore)'),
          const PrimerSelectorSpecimen(
            segments: <String>['Drivers', 'Constructors'],
          ),
          const SizedBox(height: 8),
          const PrimerSelectorSpecimen(
            segments: <String>['Drivers', 'Teams', 'Circuits'],
            initialIndex: 1,
            optionPadding: 10,
          ),
          const _Caption('Bottom navigation (not the app bar yet)'),
          const PrimerNavSpecimen(),
          const _Caption('12° livery cut'),
          const PrimerCutSpecimens(),
          const _Caption('Status icons (14px at 100%, 18px at 200%)'),
          const PrimerStatusIconSpecimens(),
          const _Caption('Focus: static focused rings'),
          const _FocusStatic(),
          const _Caption('Focus: keyboard targets (Tab to reach)'),
          const _FocusTargets(),
        ],
      ),
    );
  }
}

class _Caption extends StatelessWidget {
  const _Caption(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final GvPrimerSurfaceData s = GvPrimerSurface.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      child: Text(
        text,
        style: GvPrimerTypography.archivo(
          size: 13,
          weight: 700,
        ).copyWith(color: s.roles.text.accent),
      ),
    );
  }
}

class _TypeSpecimens extends StatelessWidget {
  const _TypeSpecimens();

  static const String sample = 'Gran Premio de España · ¿Qué? ¡Sí! Ñandú';

  @override
  Widget build(BuildContext context) {
    final Color fg = GvPrimerSurface.of(context).foreground;
    Widget line(
      String label,
      int weight, {
      double width = 100,
      double size = 15,
    }) => Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text(
        '$label  $sample',
        key: ValueKey<String>('primer-type-$weight-${width.round()}'),
        style: GvPrimerTypography.archivo(
          size: size,
          weight: weight,
          width: width,
        ).copyWith(color: fg),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        line('400', 400),
        line('600', 600),
        line('650', 650),
        line('700', 700),
        line('750', 750),
        line('800', 800),
        line('850', 850),
        line('800 wdth 72', 800, width: 72),
        line('700 wdth 118', 700, width: 118),
        Text(
          '0123456789 · 1:23.456',
          style: GvPrimerTypography.archivo(
            size: 15,
            weight: 700,
            tabularFigures: true,
          ).copyWith(color: fg),
        ),
      ],
    );
  }
}

class _SurfaceSpecimens extends StatelessWidget {
  const _SurfaceSpecimens();

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).themeRoles;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _SurfaceBox(
          label: 'Band',
          kind: GvPrimerSurfaceKind.page,
          color: roles.surface.band,
          chip: const GvPrimerStatusChip(
            label: 'Upcoming',
            kind: GvPrimerChipKind.known,
          ),
        ),
        _SurfaceBox(
          label: 'Inverse plane (championship / leader)',
          kind: GvPrimerSurfaceKind.inverse,
          gradient: roles.surface.inverse.toGradient(),
          chip: const GvPrimerStatusChip(
            label: 'Provisional',
            kind: GvPrimerChipKind.known,
          ),
        ),
        if (roles.brightness == Brightness.light)
          const _SurfaceBox(
            label: 'Graphite band (GP heading)',
            kind: GvPrimerSurfaceKind.graphiteBand,
            color: GvPrimerPalette.graphite800,
            chip: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: <Widget>[
                GvPrimerStatusChip(
                  label: 'Final',
                  kind: GvPrimerChipKind.finalResult,
                ),
                GvPrimerStatusChip(
                  label: 'Status unknown',
                  kind: GvPrimerChipKind.unknown,
                ),
              ],
            ),
          ),
        _SurfaceBox(
          label: 'Red Oxide selection surface',
          kind: GvPrimerSurfaceKind.brand,
          color: roles.fill.brand.fill,
        ),
      ],
    );
  }
}

class _SurfaceBox extends StatelessWidget {
  const _SurfaceBox({
    required this.label,
    required this.kind,
    this.color,
    this.gradient,
    this.chip,
  });

  final String label;
  final GvPrimerSurfaceKind kind;
  final Color? color;
  final Gradient? gradient;
  final Widget? chip;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: DecoratedBox(
        decoration: BoxDecoration(color: color, gradient: gradient),
        child: GvPrimerSurface(
          kind: kind,
          child: Builder(
            builder: (BuildContext context) {
              final GvPrimerSurfaceData s = GvPrimerSurface.of(context);
              return Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      label,
                      style: GvPrimerTypography.archivo(
                        size: 15,
                        weight: 700,
                      ).copyWith(color: s.foreground),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Secondary text and accent',
                      style: GvPrimerTypography.body.copyWith(
                        color: kind == GvPrimerSurfaceKind.brand
                            ? s.foreground
                            : s.roles.text.secondary,
                      ),
                    ),
                    if (chip != null) ...<Widget>[
                      const SizedBox(height: 8),
                      chip!,
                    ],
                    const SizedBox(height: 8),
                    GvPrimerFocusRing(
                      visible: true,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        child: Text(
                          'Focused',
                          style: GvPrimerTypography.chipLabel.copyWith(
                            color: s.foreground,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _ChipSpecimens extends StatelessWidget {
  const _ChipSpecimens();

  @override
  Widget build(BuildContext context) {
    return const Wrap(
      spacing: 6,
      runSpacing: 6,
      children: <Widget>[
        GvPrimerStatusChip(label: 'Upcoming', kind: GvPrimerChipKind.known),
        GvPrimerStatusChip(
          label: 'Completed',
          kind: GvPrimerChipKind.completed,
        ),
        GvPrimerStatusChip(label: 'Provisional', kind: GvPrimerChipKind.known),
        GvPrimerStatusChip(
          label: 'Not available',
          kind: GvPrimerChipKind.known,
        ),
        GvPrimerStatusChip(
          label: 'Status unknown',
          kind: GvPrimerChipKind.unknown,
        ),
        GvPrimerStatusChip(
          label: 'Formato desconocido',
          kind: GvPrimerChipKind.unknown,
        ),
        GvPrimerStatusChip(
          label: 'Cancelled',
          kind: GvPrimerChipKind.cancelled,
        ),
        GvPrimerStatusChip(label: 'Aplazado', kind: GvPrimerChipKind.postponed),
        GvPrimerStatusChip(label: 'Final', kind: GvPrimerChipKind.finalResult),
        GvPrimerStatusChip(
          label: 'Finalizado',
          kind: GvPrimerChipKind.completed,
        ),
        GvPrimerStatusChip(
          label: 'Sprint weekend',
          kind: GvPrimerChipKind.context,
        ),
        GvPrimerStatusChip(
          label: 'DNF',
          kind: GvPrimerChipKind.known,
          size: GvPrimerChipSize.small,
        ),
        GvPrimerStatusChip(
          label: 'Lapped',
          kind: GvPrimerChipKind.known,
          size: GvPrimerChipSize.small,
        ),
      ],
    );
  }
}

class _SelectionSpecimens extends StatelessWidget {
  const _SelectionSpecimens();

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles r = GvPrimerSurface.of(context).roles;
    final GvPrimerSelectorRoles sel = r.selector;
    Widget option(String label, {required bool selected}) => Expanded(
      child: ColoredBox(
        color: selected ? sel.selectedSlab : sel.container,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style:
                GvPrimerTypography.archivo(
                  size: 15,
                  weight: selected ? 800 : 600,
                ).copyWith(
                  color: selected ? sel.selectedLabel : sel.unselectedLabel,
                ),
          ),
        ),
      ),
    );
    return Row(
      children: <Widget>[
        option('Drivers', selected: true),
        option('Teams', selected: false),
      ],
    );
  }
}

class _FocusStatic extends StatelessWidget {
  const _FocusStatic();

  @override
  Widget build(BuildContext context) {
    final GvPrimerSurfaceData s = GvPrimerSurface.of(context);
    Widget specimen(String label, GvPrimerFocusGeometry g) => Padding(
      padding: const EdgeInsets.all(6),
      child: GvPrimerFocusRing(
        visible: true,
        geometry: g,
        child: Container(
          constraints: const BoxConstraints(minWidth: 96, minHeight: 48),
          alignment: Alignment.center,
          color: s.roles.surface.band,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            label,
            style: GvPrimerTypography.chipLabel.copyWith(color: s.foreground),
          ),
        ),
      ),
    );
    return Wrap(
      children: <Widget>[
        specimen('Standard +3', GvPrimerFocusGeometry.standard),
        specimen('Row −3', GvPrimerFocusGeometry.row),
        specimen('Team link −2', GvPrimerFocusGeometry.teamLink),
        specimen('Explore −4', GvPrimerFocusGeometry.homeExplore),
        specimen('Leader +2', GvPrimerFocusGeometry.leaderRow),
        specimen(
          'Back ${s.roles.focus.backButtonOffset.round()}',
          GvPrimerFocusGeometry.backButton(s.roles),
        ),
        const _SelectorCrossingSpecimen(),
      ],
    );
  }
}

/// The LT-4 / DK-3 case: an unselected selector option, focused, whose ring
/// crosses the tip of the neighbouring selected slab. Dark draws the Chalk
/// unselected ring; Light draws the Graphite ring over a 5px band backing.
/// The slab here is a plain block standing in for the 12° tip (XS-27).
class _SelectorCrossingSpecimen extends StatelessWidget {
  const _SelectorCrossingSpecimen();

  @override
  Widget build(BuildContext context) {
    final GvPrimerSelectorRoles sel = GvPrimerSurface.of(
      context,
    ).roles.selector;
    return Padding(
      padding: const EdgeInsets.all(6),
      child: ColoredBox(
        color: sel.container,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              color: sel.selectedSlab,
              child: Text(
                'Sel',
                style: GvPrimerTypography.archivo(
                  size: 13,
                  weight: 800,
                ).copyWith(color: sel.selectedLabel),
              ),
            ),
            // The focused option overlaps the slab tip by 4px.
            Flexible(
              child: Transform.translate(
                offset: const Offset(-4, 0),
                child: GvPrimerFocusRing(
                  visible: true,
                  geometry: GvPrimerFocusGeometry.selector,
                  color: sel.unselectedFocus,
                  backingSurface: sel.container,
                  child: Stack(
                    children: <Widget>[
                      Positioned(
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        child: ColoredBox(color: sel.selectedSlab),
                      ),
                      Container(
                        constraints: const BoxConstraints(minHeight: 48),
                        alignment: Alignment.center,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          'Unselected, crossing',
                          style: GvPrimerTypography.archivo(
                            size: 13,
                            weight: 600,
                          ).copyWith(color: sel.unselectedLabel),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FocusTargets extends StatelessWidget {
  const _FocusTargets();

  @override
  Widget build(BuildContext context) {
    final GvPrimerSurfaceData s = GvPrimerSurface.of(context);
    Widget target(
      String label,
      GvPrimerFocusGeometry g,
      GvPrimerTargetRole role,
    ) => Padding(
      padding: const EdgeInsets.all(6),
      child: GvPrimerFocusTarget(
        role: role,
        geometry: g,
        onActivate: () {},
        child: Container(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            label,
            style: GvPrimerTypography.chipLabel.copyWith(
              color: s.roles.text.accent,
            ),
          ),
        ),
      ),
    );
    return Wrap(
      children: <Widget>[
        target(
          'Explore link',
          GvPrimerFocusGeometry.homeExplore,
          GvPrimerTargetRole.link,
        ),
        target(
          'Team link',
          GvPrimerFocusGeometry.teamLink,
          GvPrimerTargetRole.link,
        ),
        target(
          'Button',
          GvPrimerFocusGeometry.standard,
          GvPrimerTargetRole.button,
        ),
      ],
    );
  }
}
