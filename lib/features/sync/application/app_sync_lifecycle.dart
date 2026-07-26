import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_sync_coordinator.dart';
import 'sync_providers.dart';

/// Bridges Flutter's application lifecycle to the [AppSyncCoordinator].
///
/// It is the composition root's job, not a screen's: mounted once around the
/// app, it starts the single startup run **after the first frame** and forwards
/// genuine background → resumed transitions. It holds no `BuildContext` beyond
/// its own `State` and passes none to the coordinator, repositories or
/// providers.
///
/// Rebuilds never trigger synchronization: only
/// [WidgetsBindingObserver.didChangeAppLifecycleState] does, and only when the
/// app actually came back from a backgrounded state.
class AppSyncLifecycleScope extends ConsumerStatefulWidget {
  const AppSyncLifecycleScope({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AppSyncLifecycleScope> createState() =>
      _AppSyncLifecycleScopeState();
}

class _AppSyncLifecycleScopeState extends ConsumerState<AppSyncLifecycleScope>
    with WidgetsBindingObserver {
  /// Whether the app has actually been backgrounded since the last resume.
  ///
  /// `inactive` alone does not count: on iOS it fires for a transient overlay
  /// (control centre, an incoming call banner), and treating that as a return
  /// from the background would refresh on every glance.
  bool _wasBackgrounded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Rendering never waits for the network: the run is scheduled after the
    // first frame, and nothing here is awaited.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(ref.read(appSyncCoordinatorProvider).start());
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final AppSyncCoordinator coordinator = ref.read(appSyncCoordinatorProvider);
    switch (state) {
      case AppLifecycleState.resumed:
        if (!_wasBackgrounded) return;
        _wasBackgrounded = false;
        unawaited(coordinator.onForeground());
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        // Deliberately in the background: stop scheduling, abort what is in
        // flight and never continue synchronizing while backgrounded.
        _wasBackgrounded = true;
        coordinator.cancel();
      case AppLifecycleState.inactive:
        break;
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
