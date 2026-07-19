import 'package:flutter/material.dart';

import '../theme/tokens/tokens.dart';

/// Pill-style segmented control (e.g. Drivers / Constructors). Selected segments
/// are both colour-highlighted and weight-emphasised, and expose a selected
/// semantics flag, so state is not conveyed by colour alone.
class GvSegmentedControl extends StatelessWidget {
  const GvSegmentedControl({
    super.key,
    required this.segments,
    required this.selectedIndex,
    required this.onChanged,
  });

  final List<String> segments;
  final int selectedIndex;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(GvSpacing.xxs),
      decoration: const BoxDecoration(
        color: GvColors.surfaceElevatedAlt,
        borderRadius: GvRadii.pillAll,
      ),
      child: Row(
        children: <Widget>[
          for (int i = 0; i < segments.length; i++)
            Expanded(
              child: _Segment(
                label: segments[i],
                selected: i == selectedIndex,
                onTap: () => onChanged(i),
              ),
            ),
        ],
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      onTap: onTap,
      child: ExcludeSemantics(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: AnimatedContainer(
            duration: GvMotion.fast,
            curve: GvMotion.standard,
            constraints: const BoxConstraints(
              minHeight: GvLayout.minTouchTarget,
            ),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? GvColors.accentPrimary : Colors.transparent,
              borderRadius: GvRadii.pillAll,
            ),
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: GvTypography.label.copyWith(
                fontSize: 14,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected
                    ? GvColors.onAccentPrimary
                    : GvColors.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
