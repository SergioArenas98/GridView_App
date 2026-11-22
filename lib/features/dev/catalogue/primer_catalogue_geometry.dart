import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// Step 55B.2 catalogue specimens: the 12° cut, the segmented selector, the
/// bottom navigation and the status-icon scaling comparison. Development
/// only; gallery copy is English, sample labels may be Spanish.

/// Interactive segmented selector specimen.
class PrimerSelectorSpecimen extends StatefulWidget {
  const PrimerSelectorSpecimen({
    super.key,
    required this.segments,
    this.initialIndex = 0,
    this.optionPadding = 12,
  });

  final List<String> segments;
  final int initialIndex;
  final double optionPadding;

  @override
  State<PrimerSelectorSpecimen> createState() => _PrimerSelectorSpecimenState();
}

class _PrimerSelectorSpecimenState extends State<PrimerSelectorSpecimen> {
  late int _index = widget.initialIndex;

  @override
  Widget build(BuildContext context) => GvPrimerSegmentedControl(
    segments: widget.segments,
    selectedIndex: _index,
    optionPadding: widget.optionPadding,
    onChanged: (int i) => setState(() => _index = i),
  );
}

/// Interactive bottom-navigation specimen with the app's four destinations
/// in their production order.
class PrimerNavSpecimen extends StatefulWidget {
  const PrimerNavSpecimen({
    super.key,
    this.labels = const <String>['Home', 'Calendar', 'Standings', 'Explore'],
    this.initialIndex = 0,
  });

  final List<String> labels;
  final int initialIndex;

  /// The production shell's destinations in order, with the Primer
  /// Standings glyph in place of the legacy trophy (Step 55B.2.1). The app
  /// shell uses the same destinations since Step 55C.15 (`AppShell`), plus
  /// the selected-label fallback on Standings and Explore, which this
  /// specimen leaves off to show the component's default.
  static List<GvPrimerNavItem> itemsFor(List<String> labels) =>
      <GvPrimerNavItem>[
        GvPrimerNavItem(label: labels[0], icon: Icons.home_outlined),
        GvPrimerNavItem(label: labels[1], icon: Icons.calendar_month_outlined),
        GvPrimerNavItem(label: labels[2], glyph: GvPrimerGlyph.standings),
        GvPrimerNavItem(label: labels[3], icon: Icons.explore_outlined),
      ];

  @override
  State<PrimerNavSpecimen> createState() => _PrimerNavSpecimenState();
}

class _PrimerNavSpecimenState extends State<PrimerNavSpecimen> {
  late int _index = widget.initialIndex;

  @override
  Widget build(BuildContext context) => GvPrimerBottomNav(
    selectedIndex: _index,
    onSelect: (int i) => setState(() => _index = i),
    items: PrimerNavSpecimen.itemsFor(widget.labels),
  );
}

/// The 12° cut primitive at several heights and in its three edge forms.
class PrimerCutSpecimens extends StatelessWidget {
  const PrimerCutSpecimens({super.key});

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles r = GvPrimerSurface.of(context).roles;
    final Color fg = GvPrimerSurface.of(context).foreground;
    Widget shape(String label, GvLiveryCut cut, Size size) => Padding(
      padding: const EdgeInsets.only(right: 12, bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox.fromSize(
            size: size,
            child: DecoratedBox(
              decoration: ShapeDecoration(color: r.fill.brand.fill, shape: cut),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: GvPrimerTypography.archivo(
              size: 13,
              weight: 600,
            ).copyWith(color: fg),
          ),
        ],
      ),
    );
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.end,
      children: <Widget>[
        shape(
          'Nav slab 60×32 r4',
          const GvLiveryCut(radius: 4),
          const Size(60, 32),
        ),
        shape('Slab 48 r6', const GvLiveryCut(radius: 6), const Size(96, 48)),
        shape('Slab 96 r6', const GvLiveryCut(radius: 6), const Size(96, 96)),
        shape('Tag r0', const GvLiveryCut(), const Size(80, 28)),
        shape(
          'Leading 12px bar',
          const GvLiveryCut(edges: GvLiveryCutEdges.leading),
          const Size(120, 12),
        ),
        shape(
          'Leading 3px pin',
          const GvLiveryCut(edges: GvLiveryCutEdges.leading),
          const Size(60, 3),
        ),
        shape(
          'Trailing 48',
          const GvLiveryCut(edges: GvLiveryCutEdges.trailing),
          const Size(56, 48),
        ),
      ],
    );
  }
}

/// The status chips that carry an icon. Their icon follows the approved
/// option B: 14px at 100% text, 18px at 200% (Step 55B.2.1).
class PrimerStatusIconSpecimens extends StatelessWidget {
  const PrimerStatusIconSpecimens({super.key});

  @override
  Widget build(BuildContext context) {
    return const Wrap(
      spacing: 6,
      runSpacing: 6,
      children: <Widget>[
        GvPrimerStatusChip(
          label: 'Completed',
          kind: GvPrimerChipKind.completed,
        ),
        GvPrimerStatusChip(
          label: 'Cancelled',
          kind: GvPrimerChipKind.cancelled,
        ),
        GvPrimerStatusChip(
          label: 'Cancelado',
          kind: GvPrimerChipKind.cancelled,
        ),
        GvPrimerStatusChip(label: 'Aplazado', kind: GvPrimerChipKind.postponed),
        GvPrimerStatusChip(
          label: 'Definitivo',
          kind: GvPrimerChipKind.finalResult,
        ),
        GvPrimerStatusChip(
          label: 'DNF',
          kind: GvPrimerChipKind.known,
          size: GvPrimerChipSize.small,
        ),
      ],
    );
  }
}
