import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/environment/app_environment.dart';
import '../../../../core/theme/theme.dart';
import '../../application/providers.dart';

/// A small non-production build badge (e.g. `DEV` / `STAGING`) that identifies
/// the running environment in-app, independently of the "Sample data" fixture
/// banner. It is never shown in production (the label returns nothing there),
/// and is rendered by [EnvironmentBadgeOverlay] in a strip of its own so it
/// never covers a screen's title.
class GvEnvironmentBadge extends ConsumerWidget {
  const GvEnvironmentBadge({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppEnvironment environment = ref.watch(appEnvironmentProvider);
    if (environment.isProduction) return const SizedBox.shrink();

    return Semantics(
      label: 'Build environment: ${environment.label}',
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: GvSpacing.sm,
          vertical: GvSpacing.xxs,
        ),
        decoration: BoxDecoration(
          color: context.gvColors.surfaceElevated,
          borderRadius: GvRadii.pillAll,
          border: Border.all(color: context.gvColors.accentSecondary),
        ),
        child: Text(
          environment.label,
          style: context.gvText.label.copyWith(
            color: context.gvColors.accentSecondary,
            fontWeight: FontWeight.w700,
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
/// The strip ignores pointer events and adopts the app bar's colours and system
/// overlay style, so the status bar stays legible.
///
/// In production the badge does not exist and [child] is returned unchanged,
/// so production layout is exactly what it would be without this widget.
class EnvironmentBadgeOverlay extends ConsumerWidget {
  const EnvironmentBadgeOverlay({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(appEnvironmentProvider).isProduction) return child;

    final ThemeData theme = Theme.of(context);
    final SystemUiOverlayStyle? overlayStyle =
        theme.appBarTheme.systemOverlayStyle;
    final Widget strip = Material(
      key: const ValueKey<String>('environment-badge-strip'),
      color: theme.appBarTheme.backgroundColor ?? theme.scaffoldBackgroundColor,
      child: SafeArea(
        bottom: false,
        child: IgnorePointer(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: GvSpacing.xs),
            child: const Center(child: GvEnvironmentBadge()),
          ),
        ),
      ),
    );
    return Column(
      children: <Widget>[
        if (overlayStyle == null)
          strip
        else
          AnnotatedRegion<SystemUiOverlayStyle>(
            value: overlayStyle,
            child: strip,
          ),
        Expanded(
          child: MediaQuery.removePadding(
            context: context,
            removeTop: true,
            child: child,
          ),
        ),
      ],
    );
  }
}
