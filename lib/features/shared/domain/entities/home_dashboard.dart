import '../media/media_presentation.dart';
import 'calendar_entry.dart';
import 'circuit.dart';
import 'enums.dart';
import 'grand_prix.dart';
import 'media.dart';
import 'race_result.dart';
import 'season.dart';
import 'session.dart';
import 'standing_entry.dart';

/// Where the Home dashboard's featured event came from.
///
/// The distinction is provenance, not presentation: the two sources have
/// different `resource_sync_metadata` records, so a section derived from the
/// calendar must never be attributed to the Home resource (and vice versa).
enum HomeFocusSource {
  /// The persisted Home snapshot's own `focusRound` — the contract-defined,
  /// authoritative Home focus.
  homeSnapshot,

  /// The shared relevant-event rule applied to the materialized season calendar.
  /// Used only when the Home snapshot names no focus round at all; it never
  /// replaces a focus the contract did define.
  calendarFallback,
}

/// The Home dashboard's featured Grand Prix, its host circuit and its ordered
/// sessions, together with where it came from.
class HomeFocus {
  const HomeFocus({
    required this.grandPrix,
    required this.source,
    this.circuit,
  });

  final GrandPrix grandPrix;

  /// The host circuit, or `null` when its row is absent **or** still an
  /// unresolved referential stub. A stub is never a domain circuit, so the hero
  /// simply carries no circuit rather than a name derived from the identifier.
  final Circuit? circuit;

  final HomeFocusSource source;

  int get season => grandPrix.season;
  int get round => grandPrix.round;

  /// The event's own media, read locally. Empty is ordinary: the hero has an
  /// approved circuit fallback, and beyond that a placeholder.
  EntityMedia get eventMedia => EntityMedia.from(
    MediaEntityType.grandPrix,
    grandPrix.id,
    grandPrix.media ?? const <MediaAsset>[],
  );

  /// The host circuit's own media, or `null` when there is no resolved circuit.
  /// Kept separate from [eventMedia] so the hero can say which owner it drew on.
  EntityMedia? get circuitMedia {
    final Circuit? host = circuit;
    if (host == null) return null;
    return EntityMedia.from(
      MediaEntityType.circuit,
      host.id,
      host.media ?? const <MediaAsset>[],
    );
  }

  /// The event's sessions in their persisted order. Authoritative — never
  /// re-sorted, and never filled in with an expected weekend shape.
  List<Session> get sessions => grandPrix.sessions;
}

/// The complete local Home dashboard, composed from the normalized local data.
///
/// A domain-only read model: no Drift rows, no DTOs, no freshness attribution.
/// Each field names exactly one resource's content, and the presentation layer
/// pairs it with **that resource's own** persisted metadata — this model never
/// claims that two differently-sourced modules were synchronised together.
///
/// The contract's `HomeData` carries `latestCompletedEvent`, `driverLeader`,
/// `constructorLeader` and `upcomingEvents` alongside the featured event. None
/// of them is persisted a second time under the Home snapshot: each is
/// reconstructed here from the normalized resource that already owns it (the
/// season calendar, the two standings tables), so one semantic fact never lives
/// in two caches that can disagree.
class HomeDashboardView {
  const HomeDashboardView({
    required this.seasonYear,
    this.season,
    this.focus,
    this.latestCompleted,
    this.latestRaceResult,
    this.upcoming = const <CalendarEntry>[],
    this.driverLeaders = const <DriverStandingEntry>[],
    this.constructorLeaders = const <ConstructorStandingEntry>[],
  });

  /// The season this Home representation describes — the persisted Home
  /// materialization season, never inferred from a featured event.
  final int seasonYear;

  /// Active-season context, when the season row has been synchronised.
  final Season? season;

  /// The relevant Grand Prix, or `null` for a season with nothing to highlight.
  /// Its absence is a valid season-empty Home, never a missing representation.
  final HomeFocus? focus;

  /// The season's most recently finished event, from the **calendar**.
  final CalendarEntry? latestCompleted;

  /// The already-cached **race** classification for [latestCompleted], when one
  /// is stored locally. Never the sprint classification, and never requested by
  /// Home: absent simply means the result resource has not been synchronised.
  final RaceResult? latestRaceResult;

  /// The season's upcoming events in calendar order, from the **calendar**,
  /// already bounded and with cancelled events excluded.
  final List<CalendarEntry> upcoming;

  /// The drivers' rows holding a **confirmed** `position == 1`, in the delivered
  /// order.
  ///
  /// Deliberately only the confirmed leaders rather than the whole table: a
  /// leader is never inferred from a maximum points total or from the first
  /// delivered row. Empty means no confirmed leader exists; more than one entry
  /// is a genuine tie, preserved rather than collapsed.
  final List<DriverStandingEntry> driverLeaders;

  /// The constructors' rows holding a confirmed `position == 1`, same rule.
  final List<ConstructorStandingEntry> constructorLeaders;

  /// Whether this season currently has a relevant event to feature.
  bool get hasFocus => focus != null;
}
