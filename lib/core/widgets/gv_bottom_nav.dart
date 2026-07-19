import 'package:flutter/material.dart';

import '../theme/tokens/tokens.dart';

/// A destination in [GvBottomNav].
class GvBottomNavItem {
  const GvBottomNavItem({required this.icon, required this.label});

  final IconData icon;
  final String label;
}

/// Elevated pill-style bottom navigation visual component. Data-agnostic: it
/// renders items and reports selection; it owns no routing.
class GvBottomNav extends StatelessWidget {
  const GvBottomNav({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.onSelect,
  });

  final List<GvBottomNavItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: GvSpacing.md,
          vertical: GvSpacing.xs,
        ),
        child: Container(
          decoration: BoxDecoration(
            color: GvColors.surfaceElevated,
            borderRadius: GvRadii.xlAll,
            boxShadow: GvElevation.low,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: GvSpacing.xs,
            vertical: GvSpacing.xs,
          ),
          child: Row(
            children: <Widget>[
              for (int i = 0; i < items.length; i++)
                Expanded(
                  child: _NavItem(
                    item: items[i],
                    selected: i == selectedIndex,
                    onTap: () => onSelect(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final GvBottomNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final Color color = selected ? GvColors.accentPrimary : GvColors.textMuted;
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      onTap: onTap,
      child: ExcludeSemantics(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Icon(item.icon, size: GvIconSizes.lg, color: color),
                const SizedBox(height: GvSpacing.xxs),
                Text(
                  item.label,
                  overflow: TextOverflow.ellipsis,
                  style: GvTypography.caption.copyWith(
                    color: color,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
