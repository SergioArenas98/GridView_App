import 'package:flutter/material.dart';

import '../theme/theme.dart';

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
            color: context.gvColors.surfaceElevated,
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

/// One destination: a pointer target, a keyboard stop and a D-pad stop.
///
/// [FocusableActionDetector] is the smallest Flutter-native way to make a
/// hand-built control operable without a pointer — it contributes focus,
/// traversal, the platform activation intents and a focus-highlight callback,
/// and it paints nothing of its own. An [InkWell] would have needed a Material
/// surface this pill does not have, and would have added a splash the goldens
/// do not record.
class _NavItem extends StatefulWidget {
  const _NavItem({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final GvBottomNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> {
  bool _focused = false;

  late final Map<Type, Action<Intent>> _actions = <Type, Action<Intent>>{
    // Enter, Space and the game/D-pad centre button all arrive as
    // ActivateIntent through the app's default shortcuts; a Material-style
    // button activation arrives as ButtonActivateIntent.
    ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: _activate),
    ButtonActivateIntent: CallbackAction<ButtonActivateIntent>(
      onInvoke: _activate,
    ),
  };

  Object? _activate(Intent intent) {
    widget.onTap();
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final bool selected = widget.selected;
    final Color color = selected
        ? context.gvColors.accentPrimary
        : context.gvColors.textMuted;
    return Semantics(
      button: true,
      selected: selected,
      label: widget.item.label,
      onTap: widget.onTap,
      child: ExcludeSemantics(
        child: FocusableActionDetector(
          actions: _actions,
          mouseCursor: SystemMouseCursors.click,
          onShowFocusHighlight: (bool value) {
            if (value != _focused) setState(() => _focused = value);
          },
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: widget.onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                minHeight: GvLayout.minTouchTarget,
              ),
              // A foreground decoration, so the ring cannot inset the icon or
              // the label or change the destination's size — and it exists
              // only while keyboard focus is actually on this destination. A
              // Container with nothing but a null foreground decoration builds
              // to its child unchanged, so the resting tree is what it was.
              child: Container(
                foregroundDecoration: _focused
                    ? BoxDecoration(
                        borderRadius: GvRadii.lgAll,
                        border: Border.all(
                          color: context.gvColors.accentPrimary,
                          width: 2,
                        ),
                      )
                    : null,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    Icon(widget.item.icon, size: GvIconSizes.lg, color: color),
                    const SizedBox(height: GvSpacing.xxs),
                    Text(
                      widget.item.label,
                      overflow: TextOverflow.ellipsis,
                      style: context.gvText.caption.copyWith(
                        color: color,
                        fontWeight: selected
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
