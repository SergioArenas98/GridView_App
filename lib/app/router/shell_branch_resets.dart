import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Pending "open this branch at its initial location" requests for the
/// primary shell's branches (NF-02, Step 55C.15), and the invalid pages each
/// branch is currently showing (NF-03, Step 55C.16R).
///
/// `StatefulShellRoute` keeps each branch's last location so that selecting a
/// branch restores it. That is the intended behaviour for valid locations,
/// but it also keeps an *invalid* one: after leaving an invalid Standings
/// season (`/standings/drivers/abc`) through "Go to Home" (NF-02) or through
/// another tab (NF-03), the Standings branch still holds that location, and
/// the next Standings selection restored the "Invalid link" screen.
///
/// go_router has no public API to rewrite a branch's stored location without
/// navigating to it, so the shell decides at selection time instead: it opens
/// the branch's initial location, exactly as re-selecting the active branch
/// already does, when either
///
/// - a recovery recorded a request for that branch ([request]), or
/// - the branch's navigator is still showing an invalid page, which the page
///   reports itself through [ShellBranchInvalidPage] while it is mounted.
///
/// Every other branch, and every valid location, keeps its normal
/// restoration. One instance per router, created by `buildGridViewRouter`
/// alongside the navigator keys.
class ShellBranchResets {
  final Set<int> _pending = <int>{};

  /// Invalid pages currently mounted per branch. A count rather than a flag,
  /// because when one invalid page replaces another the new page mounts
  /// before the old one is disposed.
  final Map<int, int> _invalidPages = <int, int>{};

  /// Records that the branch at [index] must open at its initial location the
  /// next time the user selects it.
  void request(int index) => _pending.add(index);

  /// Whether a reset is pending for [index], without consuming it.
  bool isPending(int index) => _pending.contains(index);

  /// Returns whether a reset was pending for [index] and clears it.
  bool consume(int index) => _pending.remove(index);

  /// Drops a pending reset for [index]: the branch was just activated by some
  /// other navigation (a deep link or an in-app `go`), which replaced its
  /// stored location, so there is nothing stale left to reset.
  void discard(int index) => _pending.remove(index);

  /// An invalid page was mounted in the branch at [index].
  void invalidPageMounted(int index) =>
      _invalidPages[index] = (_invalidPages[index] ?? 0) + 1;

  /// An invalid page in the branch at [index] was removed (popped, replaced,
  /// or the branch was reset).
  void invalidPageRemoved(int index) {
    final int remaining = (_invalidPages[index] ?? 0) - 1;
    if (remaining > 0) {
      _invalidPages[index] = remaining;
    } else {
      _invalidPages.remove(index);
    }
  }

  /// Whether the branch at [index] is currently showing an invalid page.
  bool hasInvalidPage(int index) => _invalidPages.containsKey(index);

  /// Whether selecting the branch at [index] must open its initial location.
  /// Consumes a pending [request]; an invalid page stays reported until it is
  /// removed.
  bool shouldReset(int index) => consume(index) || hasInvalidPage(index);
}

/// Marks its [child] as an invalid page of the shell branch it is shown in,
/// for as long as it is mounted (NF-03).
///
/// The branch is the one whose navigator holds this page, found through the
/// navigator itself, never inferred from a URL or a hard-coded index. Outside
/// a shell branch (for example above the shell, on the root navigator) it
/// reports nothing. Presentation is unchanged: [child] is returned as is.
class ShellBranchInvalidPage extends StatefulWidget {
  const ShellBranchInvalidPage({
    super.key,
    required this.resets,
    required this.child,
  });

  final ShellBranchResets resets;
  final Widget child;

  @override
  State<ShellBranchInvalidPage> createState() => _ShellBranchInvalidPageState();
}

class _ShellBranchInvalidPageState extends State<ShellBranchInvalidPage> {
  /// The branch this page reported to, or null when it is in none.
  int? _branch;
  bool _resolved = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_resolved) return;
    _resolved = true;
    final StatefulNavigationShellState? shell = StatefulNavigationShell.maybeOf(
      context,
    );
    final NavigatorState? navigator = Navigator.maybeOf(context);
    if (shell == null || navigator == null) return;
    final int index = shell.widget.route.branches.indexWhere(
      (StatefulShellBranch b) => b.navigatorKey.currentState == navigator,
    );
    if (index < 0) return;
    _branch = index;
    widget.resets.invalidPageMounted(index);
  }

  @override
  void dispose() {
    final int? branch = _branch;
    if (branch != null) widget.resets.invalidPageRemoved(branch);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
