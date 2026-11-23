import 'package:flutter/material.dart';

import '../theme/gv_primer_components.dart';
import '../theme/gv_primer_surface.dart';
import '../theme/tokens/gv_primer_typography.dart';
import 'gv_primer_fit.dart';
import 'gv_primer_focus.dart';
import 'gv_primer_livery_cut.dart';

/// The Primer V2 segmented selector (Standings championship, Explore
/// category; `selector.css`, DK-2, DK-3, LT-4).
///
/// - Selection: a flat Red Oxide slab cut at 12° (no gradient, no underline,
///   no extra tick), Chalk label at weight 800; unselected labels
///   `text.secondary` at 600 on the band container.
/// - Semantics: each option is a button with the `selected` flag, as the
///   legacy control.
/// - Keyboard: every option is a Tab / D-pad stop; Enter and Space select.
/// - Focus: a ring 3px inside the option. Selected: Chalk on the slab.
///   Unselected: Chalk (Dark) or Graphite over a 5px band backing (Light),
///   painted above the neighbouring slab's tip.
/// - Fit: regular → condensed (`wdth` 72) → stacked (one column, wrapping).
///
/// Slabs are drawn in a layer under every option, so a focus ring or backing
/// is never covered by a neighbour's slab; the slab layer mirrors the option
/// layout exactly and carries no semantics or hit testing.
class GvPrimerSegmentedControl extends StatelessWidget {
  const GvPrimerSegmentedControl({
    super.key,
    required this.segments,
    required this.selectedIndex,
    required this.onChanged,
    this.optionPadding = 12,
  }) : assert(segments.length >= 2);

  final List<String> segments;
  final int selectedIndex;
  final ValueChanged<int> onChanged;

  /// Horizontal padding inside each option: 12 (Standings) or 10 (Explore);
  /// the prototypes differ and whether that is intended is not recorded.
  final double optionPadding;

  static const double _containerPadding = 3;
  static const double _border = 1;
  static const double _radius = 12;
  static const double _fontSize = 15;

  /// The slab extends 4px past each side of its option (`inset: 0 -4px`).
  static const double slabOverhang = 4;

  @override
  Widget build(BuildContext context) {
    final GvPrimerSurfaceData surface = GvPrimerSurface.of(context);
    final GvPrimerSelectorRoles sel = surface.roles.selector;
    final TextScaler scaler = MediaQuery.textScalerOf(context);

    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double inner =
            constraints.maxWidth - 2 * (_border + _containerPadding);
        final GvPrimerFit fit = gvPrimerChooseFit(
          labels: segments,
          fontSize: _fontSize,
          maxLabelWidth: inner / segments.length - 2 * optionPadding,
          textScaler: scaler,
        );
        Widget layer({required bool slabs}) => _SegmentLayer(
          segments: segments,
          selectedIndex: selectedIndex,
          fit: fit,
          optionPadding: optionPadding,
          slabs: slabs,
          roles: sel,
          onChanged: onChanged,
        );
        return Container(
          decoration: BoxDecoration(
            color: sel.container,
            borderRadius: BorderRadius.circular(_radius),
            border: Border.all(color: surface.roles.line.subtle),
          ),
          child: ClipRRect(
            // `overflow: hidden` clips the slab overhang at the padding box.
            borderRadius: BorderRadius.circular(_radius - _border),
            child: Padding(
              padding: const EdgeInsets.all(_containerPadding),
              child: Stack(
                children: <Widget>[
                  ExcludeSemantics(
                    child: IgnorePointer(child: layer(slabs: true)),
                  ),
                  layer(slabs: false),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _SegmentLayer extends StatelessWidget {
  const _SegmentLayer({
    required this.segments,
    required this.selectedIndex,
    required this.fit,
    required this.optionPadding,
    required this.slabs,
    required this.roles,
    required this.onChanged,
  });

  final List<String> segments;
  final int selectedIndex;
  final GvPrimerFit fit;
  final double optionPadding;
  final bool slabs;
  final GvPrimerSelectorRoles roles;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final List<Widget> cells = <Widget>[
      for (int i = 0; i < segments.length; i++)
        _Segment(
          label: segments[i],
          selected: i == selectedIndex,
          fit: fit,
          optionPadding: optionPadding,
          slabOnly: slabs,
          roles: roles,
          onTap: () => onChanged(i),
        ),
    ];
    if (fit == GvPrimerFit.stacked) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: cells,
      );
    }
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[for (final Widget c in cells) Expanded(child: c)],
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.fit,
    required this.optionPadding,
    required this.slabOnly,
    required this.roles,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final GvPrimerFit fit;
  final double optionPadding;
  final bool slabOnly;
  final GvPrimerSelectorRoles roles;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bool stacked = fit == GvPrimerFit.stacked;
    final Widget text = Text(
      label,
      textAlign: TextAlign.center,
      maxLines: stacked ? null : 1,
      softWrap: stacked,
      style:
          GvPrimerTypography.archivo(
            size: GvPrimerSegmentedControl._fontSize,
            weight: selected ? 800 : 600,
            width: gvPrimerFitWidth(fit),
            height: 1.2,
          ).copyWith(
            color: slabOnly
                ? const Color(0x00000000)
                : (selected ? roles.selectedLabel : roles.unselectedLabel),
          ),
    );
    final Widget cell = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 48),
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: optionPadding, vertical: 8),
        child: Center(child: text),
      ),
    );

    if (slabOnly) {
      return Stack(
        clipBehavior: Clip.none,
        children: <Widget>[
          if (selected)
            Positioned(
              left: -GvPrimerSegmentedControl.slabOverhang,
              right: -GvPrimerSegmentedControl.slabOverhang,
              top: 0,
              bottom: 0,
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  color: roles.selectedSlab,
                  shape: const GvLiveryCut(radius: 6),
                ),
              ),
            ),
          cell,
        ],
      );
    }
    return GvPrimerFocusTarget(
      selected: selected,
      onActivate: onTap,
      geometry: GvPrimerFocusGeometry.selector,
      ringColor: selected ? roles.selectedFocus : roles.unselectedFocus,
      backingSurface: selected ? null : roles.container,
      child: cell,
    );
  }
}
