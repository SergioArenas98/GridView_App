import 'package:flutter/material.dart';

import '../theme/theme.dart';

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
      decoration: BoxDecoration(
        color: context.gvColors.surfaceElevatedAlt,
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

/// One segment: a pointer target, a keyboard stop and a D-pad stop.
///
/// [FocusableActionDetector] is the smallest Flutter-native way to make a
/// hand-built control operable without a pointer — it contributes focus,
/// traversal, the platform activation intents and a focus-highlight callback,
/// and it paints nothing. An [InkWell] would have needed a Material surface
/// this control does not have, and would have added a splash the goldens do
/// not record.
class _Segment extends StatefulWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_Segment> createState() => _SegmentState();
}

class _SegmentState extends State<_Segment> {
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
    return Semantics(
      button: true,
      selected: selected,
      label: widget.label,
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
            child: AnimatedContainer(
              // Reduced motion is an accessibility setting: a user who asked
              // the platform to remove animations gets the resolved state in
              // the same frame rather than a transition they cannot refuse.
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : GvMotion.fast,
              curve: GvMotion.standard,
              constraints: const BoxConstraints(
                minHeight: GvLayout.minTouchTarget,
              ),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: selected
                    ? context.gvColors.accentPrimary
                    : Colors.transparent,
                borderRadius: GvRadii.pillAll,
              ),
              // A foreground decoration, so the ring cannot inset the label or
              // change the segment's size — and it exists only while keyboard
              // focus is actually on this segment.
              foregroundDecoration: _focused
                  ? BoxDecoration(
                      borderRadius: GvRadii.pillAll,
                      border: Border.all(
                        color: selected
                            ? context.gvColors.onAccentPrimary
                            : context.gvColors.accentPrimary,
                        width: 2,
                      ),
                    )
                  : null,
              child: Text(
                widget.label,
                overflow: TextOverflow.ellipsis,
                style: context.gvText.label.copyWith(
                  fontSize: 14,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected
                      ? context.gvColors.onAccentPrimary
                      : context.gvColors.textSecondary,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
