import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/environment/app_environment.dart';
import '../../../../core/theme/tokens/tokens.dart';
import '../../application/providers.dart';

/// A small non-production build badge (e.g. `DEV` / `STAGING`) that identifies
/// the running environment in-app, independently of the "Sample data" fixture
/// banner. It is never shown in production (the label returns nothing there),
/// and is rendered by [EnvironmentBadgeOverlay] as an overlay so it never
/// affects layout, navigation or safe areas.
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
          color: GvColors.surfaceElevated,
          borderRadius: GvRadii.pillAll,
          border: Border.all(color: GvColors.accentSecondary),
        ),
        child: Text(
          environment.label,
          style: GvTypography.label.copyWith(
            color: GvColors.accentSecondary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

/// Overlays [child] with a [GvEnvironmentBadge] at the top centre. The badge
/// sits inside the safe area and ignores pointer events, so it never covers the
/// system insets, blocks the floating navigation, or intercepts content taps.
/// In production the badge renders nothing, so the overlay is a no-op there.
class EnvironmentBadgeOverlay extends StatelessWidget {
  const EnvironmentBadgeOverlay({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: <Widget>[
        child,
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            bottom: false,
            child: IgnorePointer(
              child: Padding(
                padding: const EdgeInsets.only(top: GvSpacing.xs),
                child: const Align(
                  alignment: Alignment.topCenter,
                  child: GvEnvironmentBadge(),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
