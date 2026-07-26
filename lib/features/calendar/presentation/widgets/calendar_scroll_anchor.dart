import 'package:flutter/material.dart';

/// Where the anchored item sits in the viewport: near the top, with earlier
/// items still reachable above it and later items below.
const double kCalendarAnchorAlignment = 0.15;

/// Positions a lazily-built list at one item **exactly once** per screen
/// lifetime.
///
/// A lazy list cannot simply `ensureVisible` an item that has not been built
/// yet, so this converges deterministically instead of waiting on a timer:
///
/// 1. if the anchored item is already built, scroll it into view instantly;
/// 2. otherwise jump to a proportional estimate of its offset and try again on
///    the next frame — each jump builds more children, so the estimate improves;
/// 3. give up after [_maxPasses] frames and keep the estimated position.
///
/// There is no delay, no animation and no dependency on layout settling, so the
/// behaviour is reproducible in a widget test. [start] is idempotent: later
/// stream emissions, refreshes and returns from a detail screen never reposition
/// the list, and the user's own scrolling is preserved because the owning
/// [State] (and therefore the controller) outlives them.
class CalendarScrollAnchor {
  CalendarScrollAnchor({required this.controller, required this.anchorKey});

  final ScrollController controller;

  /// Key attached to the item that should be brought into view.
  final GlobalKey anchorKey;

  static const int _maxPasses = 3;

  bool _started = false;
  int _passes = 0;

  /// Whether the one-time positioning has already been requested.
  bool get started => _started;

  /// Requests the one-time positioning for [index] of [itemCount] items.
  /// Does nothing when it has already run, or when the target is the first item
  /// (the list already starts there).
  void start({required int index, required int itemCount}) {
    if (_started) return;
    _started = true;
    if (index <= 0 || itemCount <= 1) return;
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _step(index: index, itemCount: itemCount),
    );
  }

  void _step({required int index, required int itemCount}) {
    if (!controller.hasClients) return;

    final BuildContext? target = anchorKey.currentContext;
    if (target != null) {
      Scrollable.ensureVisible(
        target,
        alignment: kCalendarAnchorAlignment,
        duration: Duration.zero,
      );
      return;
    }

    if (_passes >= _maxPasses) return;
    _passes++;

    final ScrollPosition position = controller.position;
    final double estimate =
        position.maxScrollExtent * index / (itemCount - 1).clamp(1, itemCount);
    final double clamped = estimate.clamp(
      position.minScrollExtent,
      position.maxScrollExtent,
    );
    if ((clamped - position.pixels).abs() > 0.5) controller.jumpTo(clamped);

    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _step(index: index, itemCount: itemCount),
    );
  }
}
