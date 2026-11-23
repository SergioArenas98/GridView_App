import 'dart:math' as math;

import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// Where the anchored item sits in the viewport: near the top, with earlier
/// items still reachable above it and later items below.
const double kCalendarAnchorAlignment = 0.15;

/// The Calendar's one-time initial positioning, decided **exactly once** per
/// screen lifetime (per branch session: the owning [State], and therefore
/// this object and the controller, outlive tab switches and Grand Prix detail
/// visits).
///
/// The owner calls exactly one of [revealNotice], [revealItem] or [keep] on the
/// first useful render; every later call of any of them does nothing, so later
/// Drift emissions, background refreshes, a notice appearing afterwards and
/// returns from a detail screen never reposition the list.
///
/// - [revealNotice] (owner-approved N-6, Step 55C.2.1): the Calendar opened with
///   a failure or stale-data notice, so the first notice is brought fully into
///   the viewport below the pinned header, scrolling only as far as needed.
///   At the content's start it is usually already visible, and nothing moves.
/// - [revealItem]: no notice, so the current or next Grand Prix is brought into
///   view. A lazy list cannot `ensureVisible` an item it has not built, so this
///   converges deterministically: if the item is built, reveal it; otherwise
///   jump to a proportional estimate of its offset and try again on the next
///   frame (each jump builds more children), giving up after [_maxPasses]
///   frames at the estimated position.
/// - [keep]: nothing to position; the decision is still spent.
///
/// [jumpToItem] is separate: the user-initiated XS-19 action ("Go to next /
/// current Grand Prix"). It runs the same convergence towards the same target
/// with the same alignment, only when the user activates it, and immediately
/// (no animation). It also spends a still-pending automatic decision, so
/// nothing automatic can follow it.
///
/// The user's own scrolling always wins. Every scroll the user starts (a drag,
/// a pull, a wheel, or any movement while no positioning is in progress) is
/// reported through [handleScrollNotification]; once seen, no pending or later
/// positioning step moves the list. A position that is no longer the
/// controller's initial offset when positioning starts (a restored or
/// user-moved one) is kept too.
///
/// There is no timer, no delay and no animation: steps run on post-frame
/// callbacks only, at most `1 + _maxPasses` of them, each moving the list once
/// at most and always towards one fixed target, so nothing can oscillate.
class CalendarScrollAnchor {
  CalendarScrollAnchor({
    required this.controller,
    required this.anchorKey,
    required this.noticeKey,
  });

  final ScrollController controller;

  /// Key attached to the current or next Grand Prix row.
  final GlobalKey anchorKey;

  /// Key attached to the first notice of the scrolling status block.
  final GlobalKey noticeKey;

  static const int _maxPasses = 3;

  bool _decided = false;
  bool _userScrolled = false;
  bool _positioning = false;
  bool _moving = false;

  /// The positioning run whose steps may still move the list; 0 when none.
  /// A user scroll, or a newer run, ends the current one.
  int _activeRun = 0;
  int _runs = 0;

  /// Whether the one-time decision has been taken.
  bool get decided => _decided;

  /// Whether the user has scrolled the list themselves.
  bool get userScrolled => _userScrolled;

  /// Brings the first notice fully into view (N-6), once.
  void revealNotice() {
    if (!_claim()) return;
    final int run = _startRun();
    WidgetsBinding.instance.addPostFrameCallback((_) => _revealNotice(run));
  }

  /// Brings [index] of [itemCount] list items into view, once. Does nothing
  /// beyond spending the decision when the target is the first item (the list
  /// already starts there).
  void revealItem({required int index, required int itemCount}) {
    if (!_claim()) return;
    if (index <= 0 || itemCount <= 1) return;
    final int run = _startRun();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _step(run, index: index, itemCount: itemCount, automatic: true),
    );
  }

  /// Spends the one-time decision without moving anything.
  void keep() => _claim();

  /// The user-initiated jump to [index] of [itemCount] list items (XS-19).
  /// Moves the list at once when the item is built; otherwise converges over
  /// at most three further frames, which a user scroll cancels.
  void jumpToItem({required int index, required int itemCount}) {
    _decided = true;
    if (index <= 0 || itemCount <= 1 || !controller.hasClients) return;
    final int run = _startRun();
    _step(run, index: index, itemCount: itemCount, automatic: false);
  }

  int _startRun() {
    _positioning = true;
    return _activeRun = ++_runs;
  }

  void _endRun(int run) {
    if (_activeRun != run) return;
    _activeRun = 0;
    _positioning = false;
  }

  /// Records a user-initiated scroll of the list (depth 0 only). Returns false
  /// so the notification keeps bubbling (the refresh indicator needs it).
  bool handleScrollNotification(ScrollNotification notification) {
    if (_moving || notification.depth != 0) return false;
    final bool user = switch (notification) {
      ScrollStartNotification(:final DragStartDetails? dragDetails) =>
        dragDetails != null || !_positioning,
      UserScrollNotification(:final ScrollDirection direction) =>
        direction != ScrollDirection.idle,
      OverscrollNotification(:final DragUpdateDetails? dragDetails) =>
        dragDetails != null,
      _ => false,
    };
    if (user) {
      _userScrolled = true;
      _activeRun = 0;
      _positioning = false;
    }
    return false;
  }

  bool _claim() {
    if (_decided) return false;
    _decided = true;
    return !_userScrolled;
  }

  /// Whether a step of [run] may still move the list. Automatic runs also
  /// yield to any earlier user scroll and, on their first step, to a position
  /// that is not the initial offset.
  bool _mayMove(int run, {required bool automatic, required bool firstStep}) {
    if (_activeRun != run || !controller.hasClients) return false;
    if (!automatic) return true;
    if (_userScrolled) return false;
    // A restored or already-moved position is the user's, not ours to replace.
    if (firstStep &&
        (controller.position.pixels - controller.initialScrollOffset).abs() >
            0.5) {
      return false;
    }
    return true;
  }

  void _jumpTo(double offset) {
    _moving = true;
    try {
      controller.jumpTo(offset);
    } finally {
      _moving = false;
    }
  }

  void _revealNotice(int run) {
    final bool may = _mayMove(run, automatic: true, firstStep: true);
    _endRun(run);
    if (!may) return;
    final RenderObject? notice = noticeKey.currentContext?.findRenderObject();
    if (notice == null || !notice.attached) return;
    final RenderAbstractViewport? viewport = RenderAbstractViewport.maybeOf(
      notice,
    );
    if (viewport == null) return;
    final ScrollPosition position = controller.position;
    // The smallest move that shows the whole notice: none when it is already
    // in view; its bottom at the viewport's end when it lies below; its top at
    // the viewport's start when it is taller than the viewport.
    final double topAligned = viewport.getOffsetToReveal(notice, 0).offset;
    final double bottomAligned = viewport.getOffsetToReveal(notice, 1).offset;
    final double target = math
        .min(math.max(position.pixels, bottomAligned), topAligned)
        .clamp(position.minScrollExtent, position.maxScrollExtent);
    if ((target - position.pixels).abs() > 0.5) _jumpTo(target);
  }

  void _step(
    int run, {
    required int index,
    required int itemCount,
    required bool automatic,
    int passes = 0,
  }) {
    if (!_mayMove(run, automatic: automatic, firstStep: passes == 0)) {
      _endRun(run);
      return;
    }

    final BuildContext? target = anchorKey.currentContext;
    if (target != null) {
      _endRun(run);
      // A row taller than the viewport (the emphasised row at large text on a
      // narrow screen) is aligned by its top: the usual alignment would push
      // its start, round and name, above the viewport.
      final RenderObject? row = target.findRenderObject();
      final bool taller =
          row is RenderBox &&
          row.hasSize &&
          row.size.height > controller.position.viewportDimension;
      _moving = true;
      try {
        Scrollable.ensureVisible(
          target,
          alignment: taller ? 0 : kCalendarAnchorAlignment,
          duration: Duration.zero,
        );
      } finally {
        _moving = false;
      }
      return;
    }

    if (passes >= _maxPasses) {
      _endRun(run);
      return;
    }

    final ScrollPosition position = controller.position;
    final double estimate =
        position.maxScrollExtent * index / (itemCount - 1).clamp(1, itemCount);
    final double clamped = estimate.clamp(
      position.minScrollExtent,
      position.maxScrollExtent,
    );
    if ((clamped - position.pixels).abs() > 0.5) _jumpTo(clamped);

    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _step(
        run,
        index: index,
        itemCount: itemCount,
        automatic: automatic,
        passes: passes + 1,
      ),
    );
  }
}
