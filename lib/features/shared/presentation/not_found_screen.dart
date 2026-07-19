import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_paths.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import 'widgets/screen_scaffold.dart';

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
class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({super.key, this.kind = NotFoundKind.unknownRoute});

  final NotFoundKind kind;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool invalid = kind == NotFoundKind.invalidParameters;
    return GvScreenScaffold(
      // The app bar shows the app name; the specific reason is in the body so it
      // reads once, clearly.
      title: l10n.appTitle,
      body: GvErrorState(
        icon: invalid ? Icons.link_off_outlined : Icons.explore_off_outlined,
        title: invalid ? l10n.invalidRouteTitle : l10n.notFoundTitle,
        message: invalid ? l10n.invalidRouteMessage : l10n.notFoundMessage,
        retryLabel: l10n.notFoundGoHome,
        onRetry: () => context.go(RoutePaths.home),
      ),
    );
  }
}
