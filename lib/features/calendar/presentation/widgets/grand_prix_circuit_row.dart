import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';

/// The Grand Prix's circuit as one navigation row (`gpd.css` `.cx`, GP11 +
/// GP17, DD G-3; Step 55C.12): the "Circuit" kicker, the circuit's name, the
/// accent "View circuit" action and the arrow disc, 14px padding on the
/// gutter, at least 72px tall, a `line.subtle` hairline below. It sits flush
/// under the identity band.
///
/// The whole row is one link named [semanticLabel] ("View circuit, Circuit de
/// Spa-Francorchamps", or the plain action when the name is unresolved); the
/// visible words are hidden from semantics so they are read once. An
/// unresolved [name] is simply absent and the row still navigates (G-3).
/// Focus ring 3px inside (rows); hover `state.hover`, pressed
/// `state.pressed.row` (XT-5).
class GrandPrixCircuitRow extends StatelessWidget {
  const GrandPrixCircuitRow({
    super.key,
    required this.kicker,
    required this.action,
    required this.semanticLabel,
    required this.onOpen,
    this.name,
  });

  /// "Circuit" / "Circuito".
  final String kicker;

  /// The resolved circuit name, or `null` when it is not known locally.
  final String? name;

  /// "View circuit" / "Ver circuito".
  final String action;
  final String semanticLabel;
  final VoidCallback onOpen;

  /// `min-height: 72px` including the padding.
  static const double minHeight = 72;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final String? circuit = name;
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: roles.line.subtle)),
      ),
      child: GvPrimerFocusTarget(
        key: const ValueKey<String>('gp-circuit-link'),
        onActivate: onOpen,
        role: GvPrimerTargetRole.link,
        semanticLabel: semanticLabel,
        geometry: GvPrimerFocusGeometry.row,
        pressedColor: roles.state.pressedRow,
        hoverColor: roles.state.hover,
        child: ExcludeSemantics(
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: minHeight),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: GvPrimerLayout.gutter,
                vertical: 14,
              ),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(
                          kicker,
                          style: GvPrimerTypography.archivo(
                            size: 13,
                            weight: 600,
                            height: 1.3,
                          ).copyWith(color: roles.text.secondary),
                        ),
                        if (circuit != null) ...<Widget>[
                          const SizedBox(height: 2),
                          Text(
                            circuit,
                            key: const ValueKey<String>('gp-circuit-name'),
                            textScaler: TextScaler.noScaling,
                            style: GvPrimerTypography.archivo(
                              size: GvPrimerTypography.cappedSize(
                                scaler,
                                19,
                                30,
                              ),
                              weight: 800,
                              width: 84,
                              height: 1.15,
                            ).copyWith(color: roles.text.primary),
                          ),
                        ],
                        const SizedBox(height: 4),
                        Text(
                          action,
                          style: GvPrimerTypography.archivo(
                            size: 14,
                            weight: 700,
                            height: 1.3,
                          ).copyWith(color: roles.text.accent),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  const GvPrimerArrowDisc(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
