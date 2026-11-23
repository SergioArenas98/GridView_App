import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_paths.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import 'widgets/primer_detail_app_bar.dart';

/// Why the not-found screen is being shown.
enum NotFoundKind {
  /// The URL matched no route at all.
  unknownRoute,

  /// The URL matched a route but a parameter failed validation.
  invalidParameters,
}

/// A recoverable screen shown for unknown routes and invalid route parameters.
///
/// It never dead-ends: it always offers a way back to Home. Reaching it is a
/// controlled state, not an exception.
///
/// Primer V2, Dark and Light (Step 55C.14, owner decisions D1-D6). There is
/// no NotFound prototype. The screen is composed from the approved Grand
/// Prix Detail page-state precedent (Step 55C.12, `_PageMessage`): the shared
/// [PrimerDetailAppBar] with the app title, then a detail-size
/// [GvPrimerEmptyState] inside its own scroll view, so 200% text never
/// overflows. The block has the kind's Material icon in `text.secondary`, the
/// title as a heading and the page's one live region, the message, and "Go
/// to Home" as the inverse [GvPrimerButton] without hover (XS-09). The router
/// decides where the screen sits (above the shell, or inside the Standings
/// branch); this widget only presents it.
class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({
    super.key,
    this.kind = NotFoundKind.unknownRoute,
    this.onGoHome,
  });

  final NotFoundKind kind;

  /// Replaces the default "Go to Home" navigation (`go` to Home). The router
  /// supplies it where the screen sits inside a shell branch, so the recovery
  /// can also reset that branch (NF-02). Presentation is unchanged.
  final VoidCallback? onGoHome;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool invalid = kind == NotFoundKind.invalidParameters;
    return Scaffold(
      backgroundColor: context.gvPrimer.surface.page,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            // The app bar shows the app name; the specific reason is in the
            // body so it reads once, clearly. Back exists only when the route
            // can pop.
            PrimerDetailAppBar(
              title: l10n.appTitle,
              backKey: const ValueKey<String>('not-found-back'),
            ),
            Expanded(
              child: _NotFoundBody(
                key: ValueKey<String>(
                  invalid ? 'not-found-invalid' : 'not-found-unknown',
                ),
                icon: invalid
                    ? Icons.link_off_outlined
                    : Icons.explore_off_outlined,
                title: invalid ? l10n.invalidRouteTitle : l10n.notFoundTitle,
                message: invalid
                    ? l10n.invalidRouteMessage
                    : l10n.notFoundMessage,
                actionLabel: l10n.notFoundGoHome,
                onAction: onGoHome ?? () => context.go(RoutePaths.home),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The page state: the detail-size Primer empty block in a scroll view, with
/// the inverse pill for its one action. This is the Grand Prix Detail
/// `_PageMessage` composition, with one addition for semantics.
///
/// A list item merges every descendant into a single semantics node. Without
/// the boundary below, the heading and live region would carry the title and
/// the message as one label. `explicitChildNodes` keeps the legacy
/// `GvErrorState` contract: the title is the heading and the one live region,
/// and the message is its own node. Nothing visual changes, and the shared
/// [GvPrimerEmptyState] is untouched.
class _NotFoundBody extends StatelessWidget {
  const _NotFoundBody({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) => ListView(
    padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
    children: <Widget>[
      Semantics(
        explicitChildNodes: true,
        child: GvPrimerEmptyState(
          icon: icon,
          title: title,
          message: message,
          announceTitle: true,
          action: Align(
            alignment: Alignment.centerLeft,
            child: GvPrimerButton(
              key: const ValueKey<String>('not-found-home'),
              label: actionLabel,
              onPressed: onAction,
            ),
          ),
        ),
      ),
    ],
  );
}
