import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/environment/app_environment.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../application/providers.dart';

/// A small non-production build badge (`DEV` / `STAGING`) that identifies
/// the running environment in-app, independently of the fixture-data banner.
/// It is never shown in production, and [EnvironmentBadgeOverlay] places it
/// in a strip of its own so it never covers a screen's title.
///
/// Primer V2 (Step 55C.15), from the Settings prototype `.envbadge`
/// (`settings/settings.css`, difference 11) with one owner change (Step
/// 55C.15R, D3): the outline is **continuous**, not dashed, because a dashed
/// outline means "unknown value" elsewhere in Primer V2 (VS-1). A pill with a
/// 1.5px solid `text.secondary` outline outside 2 × 10 padding, Archivo 13px
/// weight 700, line height 1.3, letter spacing 0.02em, in `text.primary`.
/// DEV and STAGING share the treatment and differ by their text, as before.
///
/// Semantics: one node, "Build environment: DEV" (the prototype's
/// `role="img"` label). The visible text is excluded so the value is not read
/// twice. The label stays unlocalized, as before (SETT-08).
class GvEnvironmentBadge extends ConsumerWidget {
  const GvEnvironmentBadge({super.key});

  static const double _fontSize = 13;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppEnvironment environment = ref.watch(appEnvironmentProvider);
    if (environment.isProduction) return const SizedBox.shrink();

    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return Semantics(
      container: true,
      label: 'Build environment: ${environment.label}',
      excludeSemantics: true,
      child: CustomPaint(
        foregroundPainter: GvPrimerOutlinePainter(
          outline: GvPrimerOutline(color: roles.text.secondary, dashed: false),
          radius: 999,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: 10 + GvPrimerMetrics.statusOutlineWidth,
            vertical: 2 + GvPrimerMetrics.statusOutlineWidth,
          ),
          child: Text(
            environment.label,
            style:
                GvPrimerTypography.archivo(
                  size: _fontSize,
                  weight: 700,
                  height: 1.3,
                ).copyWith(
                  color: roles.text.primary,
                  letterSpacing: 0.02 * _fontSize,
                ),
          ),
        ),
      ),
    );
  }
}

/// Places a [GvEnvironmentBadge] in a strip above [child] in non-production
/// builds.
///
/// The strip takes the top safe area (the status bar) and the badge's own
/// height, and [child] lays out below it with no top padding left to consume.
/// Every app bar therefore starts under the badge instead of beneath it, so the
/// badge can never overlap a title, whatever the screen, language or text size.
///
/// Primer V2 (Step 55C.15), from the Settings prototype `.envstrip`: the
/// page surface, the badge centred, `max(6px, safe-area-inset-top)` above it,
/// the gutter at the sides and 2px below. The prototype's extra 4px at the top
/// of the app bar that follows the strip (`.envstrip + .dbar`) is part of
/// the strip here, so no screen's own header changes. The strip ignores pointer
/// events. It sets no system overlay style of its own: the application-level
/// `GvPrimerSystemOverlay` above it owns the system bars in every environment
/// (XS-35, Step 55C.16R), so the status bar over the strip stays legible.
///
/// In production the badge does not exist and [child] is returned unchanged,
/// so production layout is exactly what it would be without this widget.
class EnvironmentBadgeOverlay extends ConsumerWidget {
  const EnvironmentBadgeOverlay({super.key, required this.child});

  final Widget child;

  /// Minimum space above the badge when the status-bar inset is smaller.
  static const double minTop = 6;

  /// Space below the badge: the prototype's 2px plus the 4px it adds to the
  /// following app bar.
  static const double bottom = 6;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(appEnvironmentProvider).isProduction) return child;

    final EdgeInsets insets = MediaQuery.paddingOf(context);
    // A Material, not a bare box: the strip sits above the navigator, outside
    // every screen's Material, and its text must not inherit the app's
    // fallback error text style.
    final Widget strip = Material(
      key: const ValueKey<String>('environment-badge-strip'),
      color: context.gvPrimer.surface.page,
      child: IgnorePointer(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            GvPrimerLayout.gutter + insets.left,
            insets.top > minTop ? insets.top : minTop,
            GvPrimerLayout.gutter + insets.right,
            bottom,
          ),
          child: const Center(child: GvEnvironmentBadge()),
        ),
      ),
    );
    return Column(
      children: <Widget>[
        strip,
        Expanded(
          // A semantics container around the app: every route's modal
          // barrier carries a BlockSemantics, which drops whatever was painted
          // before it in the same container. Without this boundary that is
          // the strip, and the badge's label never reached a screen reader
          // (pre-existing, found in Step 55C.15). No layout effect.
          child: Semantics(
            container: true,
            child: MediaQuery.removePadding(
              context: context,
              removeTop: true,
              child: child,
            ),
          ),
        ),
      ],
    );
  }
}
