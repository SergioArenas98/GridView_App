import 'package:flutter/widgets.dart';

import '../theme/gv_primer_components.dart';
import '../theme/gv_primer_surface.dart';
import '../theme/tokens/gv_primer_layout.dart';
import '../theme/tokens/gv_primer_typography.dart';
import 'gv_primer_icons.dart';

/// The cause a Primer V2 notice reports, which picks its decorative icon
/// (VS-4). The words always come from the caller.
enum GvPrimerNoticeCause {
  /// Refresh failure, and the combined failure + stale notice (N-2): alert.
  failure,

  /// Saved data that may be out of date: clock.
  stale,

  /// Incomplete information (an incomplete profile, Home's "Some information
  /// is unavailable"): help.
  incomplete,
}

/// A Primer V2 notice (`shared/components/notice.css`, token map §4.8, VS-4,
/// N-1, N-2, LT-8).
///
/// A band-filled block with a decorative `line.strong` border, the cause icon
/// in `text.accent` and the caller's message. The text carries the meaning;
/// the icon only reinforces it and is hidden from semantics. The notice is
/// a polite live region (`role="status"`) and is not focusable.
///
/// Presentation only: whether a notice shows, which cause applies and the
/// combined N-2 wording ("Couldn't refresh. Saved data may be out of date.")
/// are decided by the caller; the combined notice uses
/// [GvPrimerNoticeCause.failure]. Placement and ordering (N-1, N-6) belong to
/// the screen.
class GvPrimerNotice extends StatelessWidget {
  const GvPrimerNotice({super.key, required this.cause, required this.message});

  final GvPrimerNoticeCause cause;
  final String message;

  /// The icon of each cause (VS-4).
  static GvPrimerGlyph glyphFor(GvPrimerNoticeCause cause) => switch (cause) {
    GvPrimerNoticeCause.failure => GvPrimerGlyph.alert,
    GvPrimerNoticeCause.stale => GvPrimerGlyph.clock,
    GvPrimerNoticeCause.incomplete => GvPrimerGlyph.help,
  };

  /// Icon size (`.notice .icon`).
  static const double iconSize = 20;

  @override
  Widget build(BuildContext context) {
    final GvPrimerNoticeRoles roles = GvPrimerSurface.of(context).roles.notice;
    return Semantics(
      container: true,
      liveRegion: true,
      label: message,
      child: ExcludeSemantics(
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: roles.fill,
            border: Border.all(color: roles.border),
            borderRadius: BorderRadius.circular(GvPrimerLayout.radiusSm),
          ),
          child: Padding(
            // 10 × 12 inside the 1px border.
            padding: const EdgeInsets.fromLTRB(13, 11, 13, 11),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                // `margin-top: -1px`: the icon sits 1px above the text top.
                Transform.translate(
                  offset: const Offset(0, -1),
                  child: GvPrimerIcon(
                    glyphFor(cause),
                    size: iconSize,
                    color: roles.icon,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    message,
                    style: GvPrimerTypography.archivo(
                      size: 14,
                      weight: 400,
                      height: 1.35,
                    ).copyWith(color: roles.text),
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
