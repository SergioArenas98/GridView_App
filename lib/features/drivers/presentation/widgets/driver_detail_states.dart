import 'package:flutter/widgets.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../shared/application/entity_detail_state.dart';
import '../../../shared/presentation/widgets/primer_detail_notices.dart';
import '../../../shared/presentation/widgets/primer_detail_states.dart';

/// The Driver Detail notice model is the shared detail notice
/// ([DetailNoticeSpec], extracted in Step 55C.10). The Driver names stay as
/// aliases so existing tests keep compiling unchanged.
typedef DriverNoticeSpec = DetailNoticeSpec;

/// The notices of a ready Driver Detail: the shared N-1 / N-2 rule
/// ([detailNotices]) for the one `driver:<id>:<season>` resource.
List<DetailNoticeSpec> driverDetailNotices(
  EntityDetailReady<Object?> ready,
  AppLocalizations l10n,
) => detailNotices(ready, l10n);

/// The Driver Detail loading placeholder (`dd.css` `.skel`, DRV-01 item 9):
/// the shared detail skeleton with a 176px plate block closed by a
/// hairline.
class DriverDetailSkeleton extends StatelessWidget {
  const DriverDetailSkeleton({super.key});

  /// Plate block height (`.skel__plate`, border included).
  static const double plateHeight = 176;

  /// Row height (`.skel__row`).
  static const double rowHeight = PrimerDetailSkeleton.rowHeight;

  @override
  Widget build(BuildContext context) => const PrimerDetailSkeleton(
    blockHeight: plateHeight,
    blockDivider: true,
    listKey: ValueKey<String>('driver-detail-skeleton'),
  );
}
