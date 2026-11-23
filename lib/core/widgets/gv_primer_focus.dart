import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/gv_primer_roles.dart';
import '../theme/gv_primer_surface.dart';
import '../theme/tokens/gv_primer_metrics.dart';

/// Where a Primer V2 focus ring sits relative to its control (token map
/// §4.11). There is deliberately no single global inset: each approved
/// geometry is named for the components it belongs to.
@immutable
class GvPrimerFocusGeometry {
  const GvPrimerFocusGeometry({
    required this.offset,
    this.radius = GvPrimerMetrics.focusRingRadius,
  });

  /// Like CSS `outline-offset`: the ring's inner edge starts this far from
  /// the control's edge (positive outward, negative inward) and the ring is
  /// [GvPrimerMetrics.focusRingWidth] thick, growing outward from there.
  final double offset;

  /// Corner radius of the focused control the ring follows.
  final double radius;

  /// Default: 3px outside.
  static const GvPrimerFocusGeometry standard = GvPrimerFocusGeometry(
    offset: GvPrimerMetrics.focusOffsetDefault,
  );

  /// Rows: 3px inside, following the row link's 4px corner (Calendar
  /// `.ev__link`, Standings `.st__link` and GP `.cl__hit` all set
  /// `:focus-visible { outline-offset: -3px; border-radius: 4px }`; Step
  /// 55B.3 corrects the 6px base radius this geometry used before).
  static const GvPrimerFocusGeometry row = GvPrimerFocusGeometry(
    offset: GvPrimerMetrics.focusOffsetRow,
    radius: 4,
  );

  /// Selector options: 3px inside, following the option's 9px corner
  /// (`selector.css` `.seg__btn { border-radius: 9px }`).
  static const GvPrimerFocusGeometry selector = GvPrimerFocusGeometry(
    offset: GvPrimerMetrics.focusOffsetSelector,
    radius: 9,
  );

  /// GP classification team links: 2px inside (LT-17, both themes),
  /// following the link's own 8px corner (`.cl__team { border-radius:
  /// var(--radius-sm) }`, which wins over the base 6px).
  static const GvPrimerFocusGeometry teamLink = GvPrimerFocusGeometry(
    offset: GvPrimerMetrics.focusOffsetTeamLink,
    radius: 8,
  );

  /// The three Home Explore links: 4px inside (XT-1, these links only).
  static const GvPrimerFocusGeometry homeExplore = GvPrimerFocusGeometry(
    offset: GvPrimerMetrics.focusOffsetHomeExplore,
  );

  /// Bottom-navigation tabs: 2px inside (Step 55B.2.1, navigation only).
  static const GvPrimerFocusGeometry navTab = GvPrimerFocusGeometry(
    offset: GvPrimerMetrics.focusOffsetNavTab,
  );

  /// Around the Standings leader row: 2px outside, following the card's 14px
  /// corner (`.st--leader .st__link:focus-visible { border-radius:
  /// var(--radius-md) }`).
  static const GvPrimerFocusGeometry leaderRow = GvPrimerFocusGeometry(
    offset: GvPrimerMetrics.focusOffsetLeaderRow,
    radius: 14,
  );

  /// Detail back button: 3px Dark, 1px Light (XT-4, LT-11).
  factory GvPrimerFocusGeometry.backButton(GvPrimerRoles roles) =>
      GvPrimerFocusGeometry(offset: roles.focus.backButtonOffset);

  /// The rounded rectangle the ring's centre line follows around [bounds].
  RRect ringPath(Rect bounds) {
    final double centre = offset + GvPrimerMetrics.focusRingWidth / 2;
    return RRect.fromRectAndRadius(
      bounds.inflate(centre),
      Radius.circular(math.max(0, radius + centre)),
    );
  }
}

/// Paints a Primer V2 keyboard-focus ring above its child.
///
/// The ring is a foreground layer, so it is drawn above the child's own
/// decoration (blocks, rail cells, seams); it only paints, so it never
/// changes the child's size, hit area or semantics. It appears and disappears
/// at once (no animation), which also satisfies reduced motion.
///
/// Colour: [color], else the focus colour of the surface the control sits on
/// ([GvPrimerSurface]). Backing: where a ring crosses a fill of another colour
/// (LT-4, LT-5, LT-15), pass the host surface as [backingSurface]; the 5px
/// band is painted under the ring only in themes that use it (Light), and is
/// ignored in Dark, which uses a Chalk ring instead (DK-3).
///
/// An outward ring paints outside the child's box: the caller keeps any
/// clipping ancestor clear of it, or uses an inward geometry inside a
/// clipping container (XT-1).
class GvPrimerFocusRing extends StatelessWidget {
  const GvPrimerFocusRing({
    super.key,
    required this.visible,
    required this.child,
    this.geometry = GvPrimerFocusGeometry.standard,
    this.color,
    this.backingSurface,
  });

  final bool visible;
  final Widget child;
  final GvPrimerFocusGeometry geometry;
  final Color? color;
  final Color? backingSurface;

  @override
  Widget build(BuildContext context) {
    final GvPrimerSurfaceData surface = GvPrimerSurface.of(context);
    final Color? backing = surface.roles.focus.crossingBacking
        ? backingSurface
        : null;
    return CustomPaint(
      foregroundPainter: GvPrimerFocusRingPainter(
        visible: visible,
        color: color ?? surface.focusRing,
        geometry: geometry,
        backing: backing,
      ),
      child: child,
    );
  }
}

/// The painter behind [GvPrimerFocusRing].
class GvPrimerFocusRingPainter extends CustomPainter {
  const GvPrimerFocusRingPainter({
    required this.visible,
    required this.color,
    required this.geometry,
    this.backing,
  });

  final bool visible;
  final Color color;
  final GvPrimerFocusGeometry geometry;

  /// The contextual backing band colour, or `null` for none.
  final Color? backing;

  @override
  void paint(Canvas canvas, Size size) {
    if (!visible || size.isEmpty) return;
    final Rect bounds = Offset.zero & size;
    final Color? band = backing;
    if (band != null) {
      // CSS `box-shadow: inset 0 0 0 5px <surface>` on the control.
      final RRect outer = RRect.fromRectAndRadius(
        bounds,
        Radius.circular(geometry.radius),
      );
      final RRect inner = RRect.fromRectAndRadius(
        bounds.deflate(GvPrimerMetrics.focusBackingWidth),
        Radius.circular(
          math.max(0, geometry.radius - GvPrimerMetrics.focusBackingWidth),
        ),
      );
      canvas.drawDRRect(outer, inner, Paint()..color = band);
    }
    canvas.drawRRect(
      geometry.ringPath(bounds),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = GvPrimerMetrics.focusRingWidth
        ..color = color
        ..isAntiAlias = true,
    );
  }

  @override
  bool shouldRepaint(GvPrimerFocusRingPainter oldDelegate) =>
      oldDelegate.visible != visible ||
      oldDelegate.color != color ||
      oldDelegate.geometry.offset != geometry.offset ||
      oldDelegate.geometry.radius != geometry.radius ||
      oldDelegate.backing != backing;
}

/// The accessible role a [GvPrimerFocusTarget] announces.
enum GvPrimerTargetRole { button, link }

/// A focusable, activatable Primer V2 target that shows [GvPrimerFocusRing]
/// only when the platform's focus highlight is appropriate (keyboard, D-pad,
/// switch input; not after a touch).
///
/// Enter and Space activate it through the app's standard [ActivateIntent]
/// shortcuts, a tap activates it, and it is one semantics node with its
/// [role] and a tap action. It never changes the child's size: the caller
/// owns the ≥ 48×48 target. It does not replace any legacy focus indicator;
/// only Primer V2 components opt in.
///
/// **Label.** Without [semanticLabel] the node merges its child's text into
/// its label. With [semanticLabel] (editorial rows, Step 55B.3) the node is a
/// container labelled with it: the caller hides the visible text it repeats,
/// and a nested target inside the child (the GP team link) stays its own
/// node, as the separate link it is in the prototype.
///
/// **Pressed and hover (XT-5).** [pressedColor] fills the whole target while
/// a pointer presses it, [hoverColor] while a mouse hovers it; both are drawn
/// behind the child, never change geometry, focus ring, selection or
/// semantics, and appear at once (no motion). A press that starts on a nested
/// target presses only that target.
class GvPrimerFocusTarget extends StatefulWidget {
  const GvPrimerFocusTarget({
    super.key,
    required this.child,
    required this.onActivate,
    this.role = GvPrimerTargetRole.button,
    this.geometry = GvPrimerFocusGeometry.standard,
    this.ringColor,
    this.backingSurface,
    this.focusNode,
    this.autofocus = false,
    this.selected,
    this.semanticLabel,
    this.pressedColor,
    this.hoverColor,
    this.fillRadius,
  });

  final Widget child;

  /// Called on tap and on keyboard activation; `null` disables the target.
  final VoidCallback? onActivate;
  final GvPrimerTargetRole role;
  final GvPrimerFocusGeometry geometry;
  final Color? ringColor;
  final Color? backingSurface;
  final FocusNode? focusNode;
  final bool autofocus;

  /// The selected state announced for selectable targets (segments, tabs);
  /// `null` for targets that are not selectable.
  final bool? selected;

  /// The accessible name of a container target (see the class comment).
  final String? semanticLabel;

  /// Fill while pressed (`state.pressed.row` / `state.pressed.control`).
  final Color? pressedColor;

  /// Fill while a mouse hovers (`state.hover`, hovering devices only).
  final Color? hoverColor;

  /// Corner radius of the pressed and hover fill.
  final BorderRadius? fillRadius;

  @override
  State<GvPrimerFocusTarget> createState() => _GvPrimerFocusTargetState();
}

class _GvPrimerFocusTargetState extends State<GvPrimerFocusTarget> {
  /// Keyboard highlight mode with focus on this target or a descendant.
  bool _highlighted = false;

  FocusNode? _ownNode;
  FocusNode get _node =>
      widget.focusNode ?? (_ownNode ??= FocusNode(debugLabel: 'GvPrimer'));

  @override
  void initState() {
    super.initState();
    _node.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(GvPrimerFocusTarget oldWidget) {
    super.didUpdateWidget(oldWidget);
    final FocusNode previous = oldWidget.focusNode ?? _ownNode!;
    if (previous != _node) {
      previous.removeListener(_onFocusChange);
      _node.addListener(_onFocusChange);
    }
  }

  @override
  void dispose() {
    _node.removeListener(_onFocusChange);
    _ownNode?.dispose();
    super.dispose();
  }

  // The ring follows primary focus: a focused nested target (the GP team
  // link inside its row) shows its own ring, not the enclosing row's.
  void _onFocusChange() {
    if (mounted) setState(() {});
  }

  bool _hovered = false;
  bool _pressed = false;

  /// A press on a nested target is in progress: this target stays unpressed.
  bool _nestedPress = false;

  // Enter, Space and the D-pad centre arrive as ActivateIntent through the
  // app's default shortcuts; a Material-style button activation arrives as
  // ButtonActivateIntent (the same pair the legacy controls handle).
  late final Map<Type, Action<Intent>> _actions = <Type, Action<Intent>>{
    ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: _activate),
    ButtonActivateIntent: CallbackAction<ButtonActivateIntent>(
      onInvoke: _activate,
    ),
  };

  Object? _activate(Intent intent) {
    widget.onActivate?.call();
    return null;
  }

  bool get _tracksFill =>
      widget.pressedColor != null || widget.hoverColor != null;

  void _setPressed(bool value) {
    final bool next = value && !_nestedPress;
    if (next != _pressed) setState(() => _pressed = next);
  }

  void _setHovered(bool value) {
    if (value != _hovered) setState(() => _hovered = value);
  }

  void _onPointerDown(PointerDownEvent event) {
    // Runs before any enclosing target's handlers (deepest first).
    context
            .getInheritedWidgetOfExactType<_GvPrimerTargetScope>()
            ?.state
            ._nestedPress =
        true;
  }

  void _onPointerEnd(PointerEvent event) {
    _nestedPress = false;
  }

  @override
  Widget build(BuildContext context) {
    final bool enabled = widget.onActivate != null;
    Widget content = widget.child;
    if (_tracksFill) {
      final Color? fill = enabled
          ? (_pressed ? widget.pressedColor : null) ??
                (_hovered ? widget.hoverColor : null)
          : null;
      content = DecoratedBox(
        decoration: BoxDecoration(color: fill, borderRadius: widget.fillRadius),
        child: content,
      );
    }
    final Widget detector = FocusableActionDetector(
      focusNode: _node,
      autofocus: widget.autofocus,
      enabled: enabled,
      actions: _actions,
      mouseCursor: enabled ? SystemMouseCursors.click : MouseCursor.defer,
      onShowFocusHighlight: (bool value) {
        if (value != _highlighted) setState(() => _highlighted = value);
      },
      // Hover comes from hovering pointers only (`(hover: hover)`), in any
      // focus highlight mode.
      child: MouseRegion(
        onEnter: _tracksFill ? (_) => _setHovered(true) : null,
        onExit: _tracksFill ? (_) => _setHovered(false) : null,
        child: Listener(
          onPointerDown: _onPointerDown,
          onPointerUp: _onPointerEnd,
          onPointerCancel: _onPointerEnd,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: widget.onActivate,
            onTapDown: _tracksFill ? (_) => _setPressed(true) : null,
            onTapUp: _tracksFill ? (_) => _setPressed(false) : null,
            onTapCancel: _tracksFill ? () => _setPressed(false) : null,
            child: GvPrimerFocusRing(
              visible: _highlighted && enabled && _node.hasPrimaryFocus,
              geometry: widget.geometry,
              color: widget.ringColor,
              backingSurface: widget.backingSurface,
              child: _GvPrimerTargetScope(state: this, child: content),
            ),
          ),
        ),
      ),
    );
    final String? label = widget.semanticLabel;
    if (label != null) {
      return Semantics(
        container: true,
        label: label,
        button: widget.role == GvPrimerTargetRole.button,
        link: widget.role == GvPrimerTargetRole.link,
        selected: widget.selected,
        enabled: enabled,
        child: detector,
      );
    }
    return MergeSemantics(
      child: Semantics(
        button: widget.role == GvPrimerTargetRole.button,
        link: widget.role == GvPrimerTargetRole.link,
        selected: widget.selected,
        enabled: enabled,
        child: detector,
      ),
    );
  }
}

/// Lets a nested target tell its enclosing target that a press started on it.
class _GvPrimerTargetScope extends InheritedWidget {
  const _GvPrimerTargetScope({required this.state, required super.child});

  final _GvPrimerFocusTargetState state;

  @override
  bool updateShouldNotify(_GvPrimerTargetScope oldWidget) => false;
}
