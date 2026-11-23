import 'package:flutter/foundation.dart' show immutable, listEquals;
import 'package:flutter/painting.dart' show Color;

import '../../../core/theme/gv_team_accent.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/domain/entities/standing_entry.dart';
import '../../shared/presentation/result_formatting.dart';
import '../application/standings_state.dart';

/// One standings row reduced to the plain, already-formatted strings the shared
/// Primer V2 row (`GvPrimerStandingsRow`) renders.
///
/// Built once per row per build from a domain read model — no DTO, no Drift row
/// and no repository ever reaches the widget tree. Nothing is invented here: a
/// value the contract did not supply stays `null` (or out of [details]) and is
/// simply not rendered.
@immutable
class StandingsRowView {
  const StandingsRowView({
    required this.entityId,
    required this.position,
    required this.name,
    required this.points,
    required this.isLeader,
    required this.semanticLabel,
    this.nameIsFallback = false,
    this.leaderLabel,
    this.details = const <String>[],
    this.provisionalLabel,
    this.accentColor,
  });

  /// The stable GridView identifier this row navigates to — never a name.
  final String entityId;

  /// The displayed position: the contract value, or the localized unranked
  /// placeholder. Never a zero and never the list index.
  final String position;

  final String name;

  /// [name] is the localized "Name unavailable" fallback.
  final bool nameIsFallback;

  final String points;

  /// True only for a **confirmed** `position == 1`; never derived from the row's
  /// place in the list or from a maximum points total.
  final bool isLeader;

  /// The visible leader kicker (DD S-5, existing copy): "Championship leader",
  /// or "Tied for the championship lead" when several rows hold position 1.
  /// `null` for every other row.
  final String? leaderLabel;

  /// The secondary line's parts, in order: the driver's team (only when the
  /// standing names one) and the wins (only when the contract supplied them;
  /// a confirmed zero is kept).
  final List<String> details;

  /// The row-level provisional marker ("Provisional"), only on the provisional
  /// rows of a table whose rows disagree.
  final String? provisionalLabel;

  /// The row's explicit reading order for a screen reader.
  final String semanticLabel;

  /// The supplied team colour, unchanged; `null` when none is stored.
  final Color? accentColor;

  @override
  bool operator ==(Object other) =>
      other is StandingsRowView &&
      other.entityId == entityId &&
      other.position == position &&
      other.name == name &&
      other.nameIsFallback == nameIsFallback &&
      other.points == points &&
      other.isLeader == isLeader &&
      other.leaderLabel == leaderLabel &&
      listEquals(other.details, details) &&
      other.provisionalLabel == provisionalLabel &&
      other.semanticLabel == semanticLabel &&
      other.accentColor == accentColor;

  @override
  int get hashCode => Object.hash(
    entityId,
    position,
    name,
    nameIsFallback,
    points,
    isLeader,
    leaderLabel,
    Object.hashAll(details),
    provisionalLabel,
    semanticLabel,
    accentColor,
  );
}

/// The shared points/statistics formatting for both championships.
///
/// Points keep their exact numeric value and are formatted with the locale's
/// decimal separator, dropping meaningless trailing zeros (`25.0` → `25`,
/// `25.5` → `25,5` in Spanish). A formatted string is presentation only: it is
/// never parsed back or persisted.
class StandingsFormatter {
  StandingsFormatter(this.l10n, String locale)
    : _numbers = ResultFormatter(locale);

  final AppLocalizations l10n;
  final ResultFormatter _numbers;

  /// A points total. Points are required by the contract, so a confirmed zero
  /// renders as zero.
  String points(double value) => _numbers.points(value)!;

  /// The displayed position, or the localized unranked placeholder when the
  /// standing carries none.
  String position(int? value) =>
      value == null ? l10n.standingsUnrankedPosition : '$value';

  /// The accessible reading of a position. A null position means **unranked**
  /// by contract, so it reads "Unranked" / "Sin clasificar" (DD RK-1, the
  /// existing `positionUnranked`): never silence, never "zero" and never
  /// "Position unavailable".
  String positionSemantics(int? value) => value == null
      ? l10n.positionUnranked
      : l10n.standingsPositionSemantics('$value');

  /// A wins count, or `null` when the contract did not supply one. A confirmed
  /// zero is shown; an absent value is omitted rather than shown as zero.
  String? wins(int? value) =>
      value == null ? null : l10n.standingsWinsLabel(value);

  /// The unit under the leader's points figure ("pts"), taken from the
  /// existing localized compact-points template rather than a new string.
  String get pointsUnit {
    const String marker = '\u0000';
    return l10n.homePointsValue(marker).replaceAll(marker, '').trim();
  }
}

/// How a table's provisional information is presented on its rows.
///
/// Only a genuine disagreement between rows is marked per row; when every row
/// that states it agrees, one concise section-level notice represents the data
/// accurately instead of repeating a chip on every row.
bool marksRowsProvisional(StandingsProvisionalSummary summary) =>
    summary == StandingsProvisionalSummary.mixed;

/// Maps a drivers' standing to its row view.
///
/// [tiedLeaders] is whether the table has more than one confirmed position 1,
/// so tied leaders are announced as tied rather than as *the* leader.
StandingsRowView driverRowView(
  DriverStandingEntry entry, {
  required StandingsFormatter format,
  required bool markProvisional,
  required bool tiedLeaders,
}) {
  final AppLocalizations l10n = format.l10n;
  final String name = entry.driverName ?? l10n.standingsNameUnavailable;
  final String points = format.points(entry.points);
  final String? wins = format.wins(entry.wins);
  final bool provisional = markProvisional && entry.provisional == true;
  final bool leader = entry.position == 1;
  return StandingsRowView(
    entityId: entry.driverId,
    position: format.position(entry.position),
    name: name,
    nameIsFallback: entry.driverName == null,
    points: points,
    details: <String>[?entry.constructorName, ?wins],
    provisionalLabel: provisional ? l10n.standingsProvisionalBadge : null,
    isLeader: leader,
    leaderLabel: leader ? _leaderLabel(l10n, tiedLeaders) : null,
    accentColor: GvTeamAccent.parse(entry.teamColor),
    semanticLabel: _semanticLabel(
      l10n: l10n,
      position: format.positionSemantics(entry.position),
      name: name,
      team: entry.constructorName,
      points: points,
      stat: wins,
      leader: leader,
      tiedLeaders: tiedLeaders,
      provisional: provisional,
    ),
  );
}

/// Maps a constructors' standing to its row view.
StandingsRowView constructorRowView(
  ConstructorStandingEntry entry, {
  required StandingsFormatter format,
  required bool markProvisional,
  required bool tiedLeaders,
}) {
  final AppLocalizations l10n = format.l10n;
  final String name = entry.displayName ?? l10n.standingsNameUnavailable;
  final String points = format.points(entry.points);
  final String? wins = format.wins(entry.wins);
  final bool provisional = markProvisional && entry.provisional == true;
  final bool leader = entry.position == 1;
  return StandingsRowView(
    entityId: entry.constructorId,
    position: format.position(entry.position),
    name: name,
    nameIsFallback: entry.displayName == null,
    points: points,
    details: <String>[?wins],
    provisionalLabel: provisional ? l10n.standingsProvisionalBadge : null,
    isLeader: leader,
    leaderLabel: leader ? _leaderLabel(l10n, tiedLeaders) : null,
    accentColor: GvTeamAccent.parse(entry.teamColor),
    semanticLabel: _semanticLabel(
      l10n: l10n,
      position: format.positionSemantics(entry.position),
      name: name,
      points: points,
      stat: wins,
      leader: leader,
      tiedLeaders: tiedLeaders,
      provisional: provisional,
    ),
  );
}

/// Whether a table has several rows sharing a confirmed position 1.
bool hasTiedLeaders(Iterable<int?> positions) =>
    positions.where((int? p) => p == 1).length > 1;

String _leaderLabel(AppLocalizations l10n, bool tiedLeaders) => tiedLeaders
    ? l10n.standingsTiedLeaderSemantics
    : l10n.standingsLeaderSemantics;

/// Composes a row's reading order: position, name, team (when the standing names
/// one), points, statistics, then status.
String _semanticLabel({
  required AppLocalizations l10n,
  required String position,
  required String name,
  required String points,
  String? team,
  String? stat,
  required bool leader,
  required bool tiedLeaders,
  required bool provisional,
}) {
  final List<String> parts = <String>[
    position,
    name,
    ?team,
    l10n.standingsPointsSemantics(points),
    ?stat,
    if (leader) _leaderLabel(l10n, tiedLeaders),
    if (provisional) l10n.standingsProvisionalBadge,
  ];
  return parts.join(', ');
}
