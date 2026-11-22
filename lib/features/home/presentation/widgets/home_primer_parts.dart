import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';

/// Small Home-only Primer V2 compositions (Step 55C.1) that the frozen
/// specification defers to the screen: the text link, the livery tag, the
/// stretched-link panel and the display-type helpers. Each reads its colours
/// from the surface it sits on ([GvPrimerSurface]); none adds a colour.

/// The two literal parts of a localized template around one placeholder, so a
/// composition can style the value apart from its words without hardcoding
/// either or assuming a word order ("Round {round}" → "Round ", "").
({String before, String after}) homeTemplateParts(
  String Function(String placeholder) template,
) {
  const String marker = '\u0000';
  final String filled = template(marker);
  final int at = filled.indexOf(marker);
  if (at < 0) return (before: filled, after: '');
  return (
    before: filled.substring(0, at),
    after: filled.substring(at + marker.length),
  );
}

/// A Primer display style written `min(<size>, <cap>px)`: already scaled by
/// the reader's text scale and capped, so render it with
/// [TextScaler.noScaling] ([HomeDisplayText] does).
TextStyle homeDisplayStyle(
  TextScaler scaler, {
  required double size,
  required double cap,
  required int weight,
  double width = 100,
  double? height,
  double tracking = 0,
  bool tabular = false,
}) {
  final double px = GvPrimerTypography.cappedSize(scaler, size, cap);
  return GvPrimerTypography.archivo(
    size: px,
    weight: weight,
    width: width,
    height: height,
    tabularFigures: tabular,
  ).copyWith(letterSpacing: tracking * px);
}

/// Text in a capped display size (see [homeDisplayStyle]).
class HomeDisplayText extends StatelessWidget {
  const HomeDisplayText(
    this.text, {
    super.key,
    required this.size,
    required this.cap,
    required this.weight,
    required this.color,
    this.width = 100,
    this.height,
    this.tracking = 0,
    this.tabular = false,
    this.textAlign,
  });

  final String text;
  final double size;
  final double cap;
  final int weight;
  final Color color;
  final double width;
  final double? height;
  final double tracking;
  final bool tabular;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) => Text(
    text,
    textAlign: textAlign,
    textScaler: TextScaler.noScaling,
    style: homeDisplayStyle(
      MediaQuery.textScalerOf(context),
      size: size,
      cap: cap,
      weight: weight,
      width: width,
      height: height,
      tracking: tracking,
      tabular: tabular,
    ).copyWith(color: color),
  );
}

/// Gives one standalone piece of text its own semantics node, so it is read on
/// its own, in visual order, instead of being folded into the enclosing
/// section's node (where it would be read before that section's headings).
class HomeReadable extends StatelessWidget {
  const HomeReadable({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) =>
      Semantics(container: true, child: child);
}

/// Body-scale Archivo text (scales with the reader's text size, no cap).
TextStyle homeTextStyle({
  double size = GvPrimerLayout.bodyFontSize,
  int weight = 400,
  double height = 1.45,
  double width = 100,
  required Color color,
}) => GvPrimerTypography.archivo(
  size: size,
  weight: weight,
  width: width,
  height: height,
).copyWith(color: color);

/// The Primer text link (`shared/components/text-link.css`): weight 700 label
/// and a trailing arrow, at least 48px tall, 8px apart; the label in the
/// surface's primary colour, or its accent colour with [accent]
/// (`.text-link--ember`). One link node with a 3px outer focus ring.
class HomeTextLink extends StatelessWidget {
  const HomeTextLink({
    super.key,
    required this.label,
    required this.onActivate,
    this.accent = false,
    this.semanticLabel,
    this.expand = false,
  });

  final String label;
  final VoidCallback onActivate;
  final bool accent;
  final String? semanticLabel;

  /// Stretch the link across its row with the arrow at the far end
  /// (`.leader__link`).
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final Color color = accent ? roles.text.accent : roles.text.primary;
    final Widget text = Text(
      label,
      style: homeTextStyle(weight: 700, height: 1.3, color: color),
    );
    return GvPrimerFocusTarget(
      onActivate: onActivate,
      role: GvPrimerTargetRole.link,
      semanticLabel: semanticLabel ?? label,
      child: ExcludeSemantics(
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: GvPrimerLayout.minTarget,
            minWidth: GvPrimerLayout.minTarget,
          ),
          child: Row(
            mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
            children: <Widget>[
              if (expand) Expanded(child: text) else Flexible(child: text),
              SizedBox(width: expand ? 12 : 8),
              GvPrimerIcon(GvPrimerGlyph.arrowRight, size: 24, color: color),
            ],
          ),
        ),
      ),
    );
  }
}

/// The livery tag (`shared/components/tag.css`): a flat Red Oxide 12°
/// parallelogram behind a 13px weight-700 Chalk word ("Winner"), the
/// client-derived key fact. The word is read; the shape is decoration.
class HomeLiveryTag extends StatelessWidget {
  const HomeLiveryTag(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    final GvPrimerPair brand = GvPrimerSurface.of(context).roles.fill.brand;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: brand.fill,
        shape: const GvLiveryCut(),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 6, 18, 6),
        child: Text(
          label,
          style: homeTextStyle(
            size: 13,
            weight: 700,
            height: 1.2,
            color: brand.on,
          ),
        ),
      ),
    );
  }
}

/// A panel whose whole area opens one destination while only its visible link
/// is focusable and announced (`.hero__action::after { inset: 0 }`).
///
/// The panel's own text stays readable in order, headings included; the
/// [HomeStretchedLinkAnchor] inside it is the single link node, last in the
/// reading order. A tap anywhere on the panel activates it; Enter, Space and
/// the D-pad centre activate the focused anchor. While the anchor shows
/// keyboard focus, the ring is drawn around the whole panel
/// (`.hero:has(.hero__action:focus-visible)`) with [ringGeometry].
class HomeStretchedLink extends StatefulWidget {
  const HomeStretchedLink({
    super.key,
    required this.onOpen,
    required this.child,
    this.ringGeometry = GvPrimerFocusGeometry.standard,
  });

  final VoidCallback onOpen;
  final GvPrimerFocusGeometry ringGeometry;
  final Widget child;

  @override
  State<HomeStretchedLink> createState() => _HomeStretchedLinkState();
}

class _HomeStretchedLinkState extends State<HomeStretchedLink> {
  bool _ring = false;

  void _setRing(bool value) {
    if (value != _ring) setState(() => _ring = value);
  }

  @override
  Widget build(BuildContext context) => _StretchedScope(
    onOpen: widget.onOpen,
    onRing: _setRing,
    child: GvPrimerFocusRing(
      visible: _ring,
      geometry: widget.ringGeometry,
      child: Stack(
        children: <Widget>[
          widget.child,
          Positioned.fill(
            child: ExcludeSemantics(
              child: MouseRegion(
                cursor: SystemMouseCursors.click,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: widget.onOpen,
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _StretchedScope extends InheritedWidget {
  const _StretchedScope({
    required this.onOpen,
    required this.onRing,
    required super.child,
  });

  final VoidCallback onOpen;
  final ValueChanged<bool> onRing;

  @override
  bool updateShouldNotify(_StretchedScope oldWidget) =>
      onOpen != oldWidget.onOpen;
}

/// The focusable, announced link inside a [HomeStretchedLink].
class HomeStretchedLinkAnchor extends StatefulWidget {
  const HomeStretchedLinkAnchor({
    super.key,
    required this.semanticLabel,
    required this.child,
  });

  final String semanticLabel;
  final Widget child;

  @override
  State<HomeStretchedLinkAnchor> createState() =>
      _HomeStretchedLinkAnchorState();
}

class _HomeStretchedLinkAnchorState extends State<HomeStretchedLinkAnchor> {
  final FocusNode _node = FocusNode(debugLabel: 'HomeStretchedLink');
  bool _highlight = false;

  @override
  void initState() {
    super.initState();
    _node.addListener(_report);
  }

  @override
  void dispose() {
    _node
      ..removeListener(_report)
      ..dispose();
    super.dispose();
  }

  _StretchedScope? get _scope =>
      context.getInheritedWidgetOfExactType<_StretchedScope>();

  void _report() => _scope?.onRing(_highlight && _node.hasPrimaryFocus);

  void _open() => _scope?.onOpen();

  @override
  Widget build(BuildContext context) {
    final VoidCallback? open = _scope == null ? null : _open;
    return Semantics(
      container: true,
      link: true,
      label: widget.semanticLabel,
      onTap: open,
      child: ExcludeSemantics(
        child: FocusableActionDetector(
          focusNode: _node,
          actions: <Type, Action<Intent>>{
            ActivateIntent: CallbackAction<ActivateIntent>(
              onInvoke: (_) {
                open?.call();
                return null;
              },
            ),
            ButtonActivateIntent: CallbackAction<ButtonActivateIntent>(
              onInvoke: (_) {
                open?.call();
                return null;
              },
            ),
          },
          onShowFocusHighlight: (bool value) {
            _highlight = value;
            _report();
          },
          child: widget.child,
        ),
      ),
    );
  }
}
