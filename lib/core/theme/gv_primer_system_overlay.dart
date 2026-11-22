import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'gv_primer_roles.dart';

/// The Android / iOS system-bar style for a Primer V2 theme (XS-35,
/// Step 55C.16R), built only from existing Primer roles:
///
/// - **Status bar:** transparent, so the Primer page or environment strip
///   behind it shows through; icons inverse to the theme (light icons on
///   Dark, dark icons on Light) so they stay legible.
/// - **System navigation bar:** the Primer navigation surface (`surface.nav`,
///   translucent) composited over the page surface (`surface.page`), so on
///   devices that still paint a separate navigation-bar strip (Android 14
///   and earlier with three-button navigation) it continues the Primer
///   bottom navigation instead of a legacy or platform colour. Icons inverse
///   to the theme. Where Android enforces edge-to-edge (Android 15+ with
///   target SDK 35+), the platform ignores the colour and the app's own
///   surfaces, which already extend into the inset, show through.
///
/// Contrast enforcement and the divider are left to the platform defaults,
/// as before the migration.
SystemUiOverlayStyle gvPrimerSystemOverlayStyle(GvPrimerRoles roles) {
  final bool dark = roles.brightness == Brightness.dark;
  final Brightness icons = dark ? Brightness.light : Brightness.dark;
  return SystemUiOverlayStyle(
    statusBarColor: const Color(0x00000000),
    // iOS reads the bar's own brightness, which is the theme's.
    statusBarBrightness: roles.brightness,
    statusBarIconBrightness: icons,
    systemNavigationBarColor: Color.alphaBlend(
      roles.surface.nav,
      roles.surface.page,
    ),
    systemNavigationBarIconBrightness: icons,
  );
}

/// Applies [gvPrimerSystemOverlayStyle] for the current theme to the whole
/// application, whatever the route shows.
///
/// Before the Primer V2 migration every screen's Material `AppBar` applied
/// the theme's system overlay style. Primer screens have no `AppBar`, so
/// production builds fell back to Flutter's `MaterialApp` default (a black
/// navigation bar in both themes), while development and staging builds
/// took the legacy style from the environment strip. This region is now the
/// one owner, in every environment: it sits above the router (and the
/// strip), so a route change never reverts it, and it rebuilds with the
/// theme, so switching theme updates the bars on the next frame.
///
/// It paints nothing and changes no layout, inset or edge-to-edge behaviour.
class GvPrimerSystemOverlay extends StatelessWidget {
  const GvPrimerSystemOverlay({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: gvPrimerSystemOverlayStyle(context.gvPrimer),
    child: child,
  );
}
