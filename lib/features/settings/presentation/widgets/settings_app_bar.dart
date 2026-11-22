import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../shared/presentation/widgets/primer_detail_app_bar.dart';
import 'settings_primer_text.dart';

/// The Settings app bar (Step 55C.13A, `settings.css` `.chrome` + `.dbar`;
/// HEADER-AND-HEADING-DECISIONS variant C).
///
/// The detail bar's geometry (48px back column, 4px gap, 56px minimum plus
/// the `line.subtle` hairline, 6px left and 16px right padding, on the page
/// colour) with the Settings title rule:
/// - the title is the page heading (`header`, names the route), 21px
///   (1.3125rem) weight 800 `wdth` 88, line height 1.25, **not capped**, so
///   200% text reaches it;
/// - it wraps between words and is never truncated; one word wider than the
///   column narrows the width axis 88 → 76 → 66 → 62 (S-2), never the size
///   ([SettingsFitText]); a **single-word** title still too wide at 62 takes
///   the reference's last-resort scale, at most 13% below its
///   system-scaled size, and keeps the approved size and wraps when even
///   that would not fit (owner decision SF-10R, Step 55C.13BR2);
/// - the back action is the circular Primer Back of the detail screens
///   ([PrimerDetailBackButton], unchanged): it exists only when the route can
///   pop, calls `Navigator.maybePop`, and its name is the platform's "Back".
///
/// The environment strip stays the app-level overlay above it (unchanged).
class SettingsAppBar extends StatelessWidget {
  const SettingsAppBar({super.key, required this.title, this.backKey});

  final String title;

  /// The key of the back action's focus target.
  final Key? backKey;

  /// The bar's minimum height without the hairline.
  static const double minHeight = 56;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final ModalRoute<Object?>? route = ModalRoute.of(context);
    final bool canPop =
        (route?.canPop ?? false) || (route?.impliesAppBarDismissal ?? false);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: roles.surface.page,
        border: Border(bottom: BorderSide(color: roles.line.subtle)),
      ),
      child: Padding(
        // 4px below plus the 1px hairline, which paints over the box edge.
        padding: const EdgeInsets.fromLTRB(6, 4, GvPrimerLayout.gutter, 5),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: minHeight - 8),
          child: Row(
            children: <Widget>[
              SizedBox(
                width: GvPrimerLayout.minTarget,
                child: canPop
                    ? PrimerDetailBackButton(targetKey: backKey)
                    : null,
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Semantics(
                  namesRoute: true,
                  header: true,
                  child: SettingsFitText(
                    title,
                    role: SettingsType.appBarTitle,
                    color: roles.text.primary,
                    // SF-10R: a single word still too wide at wdth 62 may
                    // shrink by at most 13% to stay on one line.
                    maxSingleWordReduction:
                        SettingsType.appBarTitleMaxReduction,
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

/// The frame of a migrated Settings screen: the page colour, the
/// [SettingsAppBar] pinned above one primary scrollable, no bottom
/// navigation (Settings lives on the root navigator).
///
/// [body] receives the bottom padding it must leave below its content: the
/// prototype's 40px plus the bottom safe-area inset (`.page`).
class SettingsPrimerScaffold extends StatelessWidget {
  const SettingsPrimerScaffold({
    super.key,
    required this.title,
    required this.body,
    this.backKey,
  });

  final String title;
  final Key? backKey;
  final Widget Function(BuildContext context, double bottomPadding) body;

  /// `.page { padding-bottom: calc(40px + env(safe-area-inset-bottom)) }`.
  static const double endPadding = 40;

  @override
  Widget build(BuildContext context) {
    final double bottomInset = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      backgroundColor: context.gvPrimer.surface.page,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            SettingsAppBar(title: title, backKey: backKey),
            Expanded(child: body(context, endPadding + bottomInset)),
          ],
        ),
      ),
    );
  }
}
