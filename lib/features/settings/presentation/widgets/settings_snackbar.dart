import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/gv_primer_livery_cut.dart';
import '../../../../l10n/app_localizations.dart';
import '../../application/external_links.dart';
import 'settings_primer_text.dart';

/// The Primer V2 inverse snackbar, local to the migrated Settings screens
/// (Step 55C.13A, owner decision 55C.13A-15; `settings.css` `.snack`, token
/// map §4.9): `snackbar.fill` / `snackbar.on` (Chalk with a Graphite message
/// in Dark, Graphite with Chalk in Light), a 4px Red Oxide seam at 12°, radius
/// 8, 16px from the screen edges.
///
/// It is shown through the ordinary [ScaffoldMessengerState] as a floating
/// [SnackBar] whose own fill, elevation, padding and clip are cleared, so the
/// application-wide `SnackBarTheme` is not modified and the Material snackbar
/// keeps its queue, timing, dismissal and its live region (the [SnackBar]
/// wraps its content in `Semantics(liveRegion: true)`).
///
/// [messenger] is captured by the caller **before** any asynchronous work,
/// so a theme or language change that rebuilds the tree in the meantime
/// cannot leave the caller with a stale context. A messenger that is no
/// longer mounted shows nothing.
void showSettingsSnackbar(ScaffoldMessengerState messenger, String message) {
  if (!messenger.mounted) return;
  messenger.showSnackBar(
    SnackBar(
      content: SettingsSnackbarContent(message: message),
      behavior: SnackBarBehavior.floating,
      backgroundColor: Colors.transparent,
      elevation: 0,
      padding: EdgeInsets.zero,
      margin: const EdgeInsets.fromLTRB(
        GvPrimerLayout.gutter,
        0,
        GvPrimerLayout.gutter,
        16,
      ),
      clipBehavior: Clip.none,
      shape: const RoundedRectangleBorder(),
    ),
  );
}

/// Opens an allow-listed external destination through the injected
/// launcher, reporting a failed hand-off with the Primer snackbar
/// (`settingsOpenFailed`). The URL and any platform exception are never
/// shown.
///
/// Used by every Settings destination outside GridView: Send feedback on the
/// root, the attribution links and the privacy policy (Step 55C.13B, owner
/// decision SF-15).
Future<void> openSettingsExternalLink(
  BuildContext context,
  WidgetRef ref,
  ExternalLink link,
) async {
  final AppLocalizations l10n = AppLocalizations.of(context);
  final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
  final bool opened = await ref.read(externalLinkLauncherProvider).open(link);
  if (opened) return;
  showSettingsSnackbar(messenger, l10n.settingsOpenFailed);
}

/// The snackbar's visible content: the inverse plane, the seam and the
/// message. Colours resolve where the snackbar is shown, so it follows the
/// theme that is active when it appears (and while it stays).
class SettingsSnackbarContent extends StatelessWidget {
  const SettingsSnackbarContent({super.key, required this.message});

  final String message;

  /// `box-shadow: 0 16px 32px -12px`: black at 70% in Dark (`settings.css`),
  /// Graphite at 45% in Light (`light-b2.css` 2c). A shadow of the snackbar
  /// only; no role exists for it.
  static List<BoxShadow> shadowFor(Brightness brightness) => <BoxShadow>[
    BoxShadow(
      offset: const Offset(0, 16),
      blurRadius: 32,
      spreadRadius: -12,
      color: brightness == Brightness.dark
          ? const Color(0xB3000000)
          : const Color(0x73141518),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).themeRoles;
    final GvPrimerActionRoles action = roles.action;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: action.snackbar.fill,
        borderRadius: const BorderRadius.all(
          Radius.circular(GvPrimerLayout.radiusSm),
        ),
        boxShadow: shadowFor(roles.brightness),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              // The oxide seam: decorative (LT-3), skewed like every 12°
              // element, never clipped.
              ExcludeSemantics(
                child: SizedBox(
                  width: 4,
                  child: DecoratedBox(
                    decoration: ShapeDecoration(
                      color: action.snackbarSeam,
                      shape: const GvLiveryCut(radius: 1),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
                  style: SettingsType.snackbar.style().copyWith(
                    color: action.snackbar.on,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
