import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/presentation/widgets/mock_data_banner.dart';
import '../../application/explore_state.dart';

/// One Explore notice: its cause (the VS-4 icon) and its words.
@immutable
class ExploreNoticeSpec {
  const ExploreNoticeSpec(this.cause, this.message);

  final GvPrimerNoticeCause cause;
  final String message;

  @override
  bool operator ==(Object other) =>
      other is ExploreNoticeSpec &&
      other.cause == cause &&
      other.message == message;

  @override
  int get hashCode => Object.hash(cause, message);

  @override
  String toString() => 'ExploreNoticeSpec($cause, $message)';
}

/// The selected collection's status facts, read from that collection's own
/// state only (`drivers:<season>`, `constructors:<season>` or
/// `circuits:<season>`): never another category's, never Home's, Calendar's
/// or Standings'.
@immutable
class ExploreStatusFacts {
  const ExploreStatusFacts({
    this.refreshing = false,
    this.failed = false,
    this.stale = false,
    this.lastSuccessAt,
  });

  /// The facts of [state]. Loading and first-load error states carry none:
  /// they are the whole collection area, not a status above content.
  static ExploreStatusFacts of<C>(ExploreCollectionState<C> state) =>
      switch (state) {
        ExploreCollectionReady<C>(
          :final bool refreshing,
          :final ExploreFailure? refreshError,
          :final bool isStale,
          :final DateTime? lastSuccessAt,
        ) =>
          ExploreStatusFacts(
            refreshing: refreshing,
            failed: refreshError != null,
            stale: isStale,
            lastSuccessAt: lastSuccessAt,
          ),
        ExploreCollectionEmpty<C>(
          :final bool refreshing,
          :final ExploreFailure? refreshError,
          :final bool isStale,
          :final DateTime? lastSuccessAt,
        ) =>
          ExploreStatusFacts(
            refreshing: refreshing,
            failed: refreshError != null,
            stale: isStale,
            lastSuccessAt: lastSuccessAt,
          ),
        _ => const ExploreStatusFacts(),
      };

  final bool refreshing;
  final bool failed;

  /// This resource's **own** freshness is stale. A collection materialized by
  /// bootstrap only has no freshness of its own and is never called stale.
  final bool stale;

  /// This resource's **own** last successful check, or `null` when it has
  /// none (a bootstrap-materialized collection claims no check time).
  final DateTime? lastSuccessAt;

  @override
  bool operator ==(Object other) =>
      other is ExploreStatusFacts &&
      other.refreshing == refreshing &&
      other.failed == failed &&
      other.stale == stale &&
      other.lastSuccessAt == lastSuccessAt;

  @override
  int get hashCode => Object.hash(refreshing, failed, stale, lastSuccessAt);
}

/// The selected collection's notices (N-1, N-2, VS-4; DD EF-2).
///
/// Both facts belong to the one selected resource, so a failed refresh over
/// stale data reads as the single combined N-2 notice
/// (`refreshFailedStaleNotice`, "Couldn't refresh. Saved data may be out of
/// date."). Failure alone keeps Explore's existing `exploreUpdateFailed`
/// ("Update failed", alert icon). Staleness alone uses the established
/// stale-data notice Calendar and Standings show, `offlineStaleNotice`
/// ("This data may be out of date — showing the last saved version.", clock
/// icon): Explore's rows are exactly that, the last saved local copy of a
/// resource whose own freshness has expired. Explore has no
/// incomplete-information state.
List<ExploreNoticeSpec> exploreNotices(
  ExploreStatusFacts facts,
  AppLocalizations l10n,
) {
  if (facts.failed && facts.stale) {
    return <ExploreNoticeSpec>[
      ExploreNoticeSpec(
        GvPrimerNoticeCause.failure,
        l10n.refreshFailedStaleNotice,
      ),
    ];
  }
  return <ExploreNoticeSpec>[
    if (facts.failed)
      ExploreNoticeSpec(GvPrimerNoticeCause.failure, l10n.exploreUpdateFailed),
    if (facts.stale)
      ExploreNoticeSpec(GvPrimerNoticeCause.stale, l10n.offlineStaleNotice),
  ];
}

/// The selected collection's status at the start of its own scrolling list
/// (DD EF-1, the Explore application of the SF-1 principle): the
/// last-successful-check caption, the thin progress line while that
/// collection refreshes, the sample-data banner in a fixture build, then its
/// notices. Nothing when none applies. It scrolls with the rows and precedes
/// them in reading order; only the title, season and selector are pinned.
///
/// The caption reads "Last successful check: HH:mm" only from the selected
/// resource's **own** `lastSuccessAt`: never another category's, Home's,
/// Calendar's or Standings', and never a bootstrap time. While a refresh runs
/// it keeps the previous successful time (the progress line says a check is
/// running); Explore has no "Refreshing…" key of its own.
class ExploreStatus extends StatelessWidget {
  const ExploreStatus({super.key, required this.facts, required this.showMock});

  final ExploreStatusFacts facts;
  final bool showMock;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final List<ExploreNoticeSpec> notices = exploreNotices(facts, l10n);
    final DateTime? checked = facts.lastSuccessAt;
    final List<Widget> children = <Widget>[
      if (checked != null)
        Semantics(
          container: true,
          child: Text(
            l10n.lastUpdatedLabel(
              DateFormat.Hm(
                Localizations.localeOf(context).languageCode,
              ).format(checked.toLocal()),
            ),
            key: const ValueKey<String>('explore-freshness'),
            style: GvPrimerTypography.archivo(
              size: 13,
              weight: 400,
              height: 1.35,
            ).copyWith(color: roles.text.secondary),
          ),
        ),
      if (facts.refreshing) const ExploreProgressLine(),
      if (showMock) const MockDataBanner(),
      for (final ExploreNoticeSpec notice in notices)
        GvPrimerNotice(
          key: ValueKey<String>('explore-notice-${notice.cause.name}'),
          cause: notice.cause,
          message: notice.message,
        ),
    ];
    if (children.isEmpty) return const SizedBox.shrink();
    return Padding(
      key: const ValueKey<String>('explore-status'),
      // 10px under the pinned hairline (with the list's 4px top padding,
      // the prototype's `.status { margin-top: 10px }` gap), 12px before the
      // first row, as Standings' status block.
      padding: const EdgeInsets.fromLTRB(
        GvPrimerLayout.gutter,
        6,
        GvPrimerLayout.gutter,
        12,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (final (int i, Widget child) in children.indexed) ...<Widget>[
            if (i > 0) const SizedBox(height: 10),
            child,
          ],
        ],
      ),
    );
  }
}

/// Explore's refreshing indicator (`.progress`): a 2px `line.subtle` track
/// with a 40% `text.accent` bar sweeping across it (1.4s, ease-in-out), the
/// indeterminate line Flutter showed. Under reduced motion it stands still at
/// 30% (`prefers-reduced-motion`). The sweep versus a static pulse is still
/// open (PD-05 / EXP-02). Announced once as "Loading", like the prototype's
/// `role="progressbar"`.
class ExploreProgressLine extends StatefulWidget {
  const ExploreProgressLine({super.key});

  static const double height = 2;
  static const double barFraction = 0.4;
  static const double reducedMotionStart = 0.3;
  static const Duration period = Duration(milliseconds: 1400);

  /// `cubic-bezier(0.65, 0, 0.35, 1)`.
  static const Curve curve = Cubic(0.65, 0, 0.35, 1);

  @override
  State<ExploreProgressLine> createState() => _ExploreProgressLineState();
}

class _ExploreProgressLineState extends State<ExploreProgressLine>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: ExploreProgressLine.period,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.stop();
    } else if (!_controller.isAnimating) {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final bool still = MediaQuery.disableAnimationsOf(context);
    return Semantics(
      container: true,
      label: AppLocalizations.of(context).a11yLoading,
      child: SizedBox(
        key: const ValueKey<String>('explore-progress'),
        height: ExploreProgressLine.height,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(ExploreProgressLine.height),
          child: LayoutBuilder(
            builder: (BuildContext context, BoxConstraints box) {
              final double bar = box.maxWidth * ExploreProgressLine.barFraction;
              Widget line(double left) => Stack(
                children: <Widget>[
                  Positioned.fill(child: ColoredBox(color: roles.line.subtle)),
                  Positioned(
                    left: left,
                    top: 0,
                    bottom: 0,
                    width: bar,
                    child: ColoredBox(
                      key: const ValueKey<String>('explore-progress-bar'),
                      color: roles.text.accent,
                    ),
                  ),
                ],
              );
              if (still) {
                return line(
                  box.maxWidth * ExploreProgressLine.reducedMotionStart,
                );
              }
              return AnimatedBuilder(
                animation: _controller,
                builder: (BuildContext context, Widget? _) {
                  // translateX(-100%) → translateX(250%) of the bar.
                  final double t = ExploreProgressLine.curve.transform(
                    _controller.value,
                  );
                  return line(bar * (-1 + 3.5 * t));
                },
              );
            },
          ),
        ),
      ),
    );
  }
}
