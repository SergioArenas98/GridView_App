// Step 55C.11: the production Circuit Detail in Primer V2 (Dark and Light).
//
// Presentation only: route, origin season, refresh scope, state, the
// related-event read model and the media contracts are the existing ones and
// are asserted here through the real router, providers and fakes. Every
// value is a test fixture; every name starting "Synthetic" is invented.
//
// Not covered here, deliberately: CR-04 / PD-14 / CIR-02. "No Grand Prix this
// season" is shown exactly as before (no related event in the read model),
// including when the season's calendar is not materialized.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/app/router/entity_navigation.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/media/media_image_loader.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/circuits/application/circuit_event_association.dart';
import 'package:gridview/features/circuits/presentation/circuit_detail_screen.dart';
import 'package:gridview/features/circuits/presentation/widgets/circuit_detail_skeleton.dart';
import 'package:gridview/features/circuits/presentation/widgets/circuit_event_row.dart';
import 'package:gridview/features/circuits/presentation/widgets/circuit_facts.dart';
import 'package:gridview/features/circuits/presentation/widgets/circuit_sheet.dart';
import 'package:gridview/features/shared/application/entity_detail_scope.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_app_bar.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_states.dart';

import '../support/domain_fixtures.dart';
import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';
import '../support/fake_repository.dart';
import '../support/media_fixtures.dart';
import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

const String _spa = '/circuits/spa-francorchamps';

ResourceSyncState? _never(String key) => null;
ResourceSyncState? _stale(String key) =>
    syncedMetadata(key, staleAfter: DateTime.utc(2000));
Future<RefreshResult> _offline(String id, int season) async =>
    const RefreshFailure(ApiFailure(kind: ApiFailureKind.networkUnavailable));
Future<RefreshResult> _notFound(String id, int season) async =>
    const RefreshFailure(ApiFailure(kind: ApiFailureKind.notFound));

/// Unmounts the previous app, so a second scenario in the same test starts
/// with a fresh `ProviderScope`.
Future<void> _reset(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
}

/// Opens Circuit Detail above Home, as from any origin, so Back exists.
Future<(GoRouter, FakeCircuitRepository)> _open(
  WidgetTester tester, {
  CircuitProfile? Function(int season, String id)? profile,
  ResourceSyncState? Function(String key)? metadata,
  Future<RefreshResult> Function(String id, int season)? refresh,
  Size size = const Size(390, 2400),
  double textScale = 1,
  Locale locale = const Locale('en'),
  AppThemePreference theme = AppThemePreference.dark,
  MediaImageLoader? mediaLoader,
  int? currentSeason = 2026,
  String location = _spa,
}) async {
  await _reset(tester);
  final FakeCircuitRepository circuits = FakeCircuitRepository(
    profile:
        profile ??
        (int s, String id) => circuitProfileFixture(season: s, circuitId: id),
    onRefreshDetail: refresh,
  );
  final GoRouter router = await pumpApp(
    tester,
    surfaceSize: size,
    textScale: textScale,
    locale: locale,
    currentSeason: currentSeason,
    preferences: AppPreferences.defaults.copyWith(theme: theme),
    syncMetadata: metadata,
    mediaLoader: mediaLoader,
    circuits: circuits,
  );
  unawaited(router.push(location));
  await tester.pumpAndSettle();
  return (router, circuits);
}

Finder _key(String k) => find.byKey(ValueKey<String>(k));
Finder get _back => _key('circuit-detail-back');
Finder get _link => _key('circuit-related-link');

FocusNode _nodeOf(WidgetTester tester, Finder target) => Focus.of(
  tester.element(
    find.descendant(of: target, matching: find.byType(GestureDetector)).first,
  ),
);

List<String> _traversal(SemanticsNode node) => <String>[
  if (node.label.isNotEmpty) node.label,
  for (final SemanticsNode child in node.debugListChildrenInOrder(
    DebugSemanticsDumpOrder.traversalOrder,
  ))
    ..._traversal(child),
];

/// The visible name with the `.nobr` word joiner removed.
String _shownName(WidgetTester tester) =>
    tester.widget<Text>(_key('circuit-sheet-name')).data!.replaceAll('⁠', '');

List<GvPrimerStatusChip> _chips(WidgetTester tester) => tester
    .widgetList<GvPrimerStatusChip>(find.byType(GvPrimerStatusChip))
    .toList();

CircuitProfile _withMedia(
  int s,
  String id, {
  MediaCategory category = MediaCategory.circuitLayout,
}) {
  final CircuitProfile p = circuitProfileFixture(season: s, circuitId: id);
  return CircuitProfile(
    circuit: p.circuit.copyWithMedia(<MediaAsset>[
      portraitAsset(
        id: '$id-layout-v1',
        owner: id,
        entityType: MediaEntityType.circuit,
        category: category,
      ),
    ]),
    season: p.season,
    relatedGrandPrix: p.relatedGrandPrix,
    lapRecordDriverName: p.lapRecordDriverName,
  );
}

CircuitProfile _long(int s, String id) => circuitProfileFixture(
  season: s,
  circuitId: id,
  name:
      'Synthetic Autódromo Internacional Extraordinarily-Long-Hyphenated '
      'Circuit Name',
  locality: 'Synthetic Municipality of the Very Long Place Name',
  country: 'Synthetic Republic',
  lapRecordDriverName: 'Synthetic Maximilian-Alexander Long-Surname',
  related: relatedGrandPrix(
    season: s,
    name: 'Synthetic Extraordinarily Long Title Sponsor Grand Prix',
  ),
);

// --- CR-04 (Step 55C.11C) ------------------------------------------------------

/// Calendar and bootstrap records under test control; every other resource
/// (the circuit's own key included) keeps the harness default (synced).
class _Cr04Metadata {
  _Cr04Metadata({
    this.calendar = const <int, ResourceSyncState?>{},
    this.bootstrap,
  });

  /// `calendar:<season>` → record (`null` = never synchronised). A season
  /// missing from the map is held loading when [holdCalendar] is set.
  final Map<int, ResourceSyncState?> calendar;
  final ResourceSyncState? bootstrap;
  bool holdCalendar = false;

  final Map<String, StreamController<ResourceSyncState?>> live =
      <String, StreamController<ResourceSyncState?>>{};

  Stream<ResourceSyncState?> call(String key) {
    if (live[key] case final StreamController<ResourceSyncState?> c) {
      return c.stream;
    }
    if (key == ResourceKey.bootstrap()) {
      return Stream<ResourceSyncState?>.value(bootstrap);
    }
    if (key.startsWith('calendar:')) {
      final int season = int.parse(key.split(':').last);
      if (calendar.containsKey(season)) {
        return Stream<ResourceSyncState?>.value(calendar[season]);
      }
      if (holdCalendar) {
        return (live[key] = StreamController<ResourceSyncState?>.broadcast())
            .stream;
      }
      return Stream<ResourceSyncState?>.value(null);
    }
    // Every other resource keeps the harness default (synced).
    return Stream<ResourceSyncState?>.value(syncedMetadata(key));
  }

  /// Makes [key] controllable from the test (emit later).
  StreamController<ResourceSyncState?> control(String key) =>
      live[key] = StreamController<ResourceSyncState?>.broadcast();
}

ResourceSyncState _calendarRecord(int season, {DateTime? staleAfter}) =>
    syncedMetadata(
      ResourceKey.calendar(season),
      season: season,
      staleAfter: staleAfter,
    );

ResourceSyncState _bootstrapRecord(int season) =>
    syncedMetadata(ResourceKey.bootstrap(), season: season);

CircuitProfile _noEvent(int s, String id) =>
    circuitProfileFixture(season: s, circuitId: id, withRelated: false);

/// Opens Circuit Detail with CR-04 inputs: the profile (or a live profile
/// stream), the calendar / bootstrap records, an optional circuit refresh
/// and an optional historical origin season.
Future<FakeRaceWeekendRepository> _openCr04(
  WidgetTester tester, {
  required _Cr04Metadata metadata,
  CircuitProfile? Function(int season, String id)? profile,
  Stream<CircuitProfile?> Function(int season, String id)? profileStream,
  Future<RefreshResult> Function(String id, int season)? refresh,
  int? currentSeason = 2026,
  int? originSeason,
  AppThemePreference theme = AppThemePreference.dark,
  bool settle = true,
}) async {
  await _reset(tester);
  final FakeRaceWeekendRepository calendarRepo = FakeRaceWeekendRepository();
  final GoRouter router = await pumpApp(
    tester,
    surfaceSize: const Size(390, 2400),
    currentSeason: currentSeason,
    preferences: AppPreferences.defaults.copyWith(theme: theme),
    syncMetadataStream: metadata.call,
    repository: calendarRepo,
    circuits: FakeCircuitRepository(
      profile: profileStream == null ? (profile ?? _noEvent) : null,
      profileStream: profileStream,
      onRefreshDetail: refresh,
    ),
  );
  unawaited(
    router.push(
      _spa,
      extra: originSeason == null
          ? null
          : EntityNavigationOrigin('/', season: originSeason),
    ),
  );
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }
  return calendarRepo;
}

/// The visible related-section state: 'A' (event row), 'B' (absence), 'C'
/// (no section at all). Fails on any mixture.
String _relatedState(WidgetTester tester) {
  final bool heading = find
      .text("This season's Grand Prix")
      .evaluate()
      .isNotEmpty;
  final bool row = find.byType(CircuitEventRow).evaluate().isNotEmpty;
  final bool none = find
      .text('No Grand Prix this season')
      .evaluate()
      .isNotEmpty;
  final bool season = _key('circuit-related-season').evaluate().isNotEmpty;
  if (row && heading && season && !none) return 'A';
  if (none && heading && season && !row) return 'B';
  if (!row && !none && !heading && !season) return 'C';
  return 'mixed(heading: $heading, row: $row, none: $none, season: $season)';
}

CircuitEventAssociation _association(WidgetTester tester) {
  final ProviderContainer container = ProviderScope.containerOf(
    tester.element(find.byType(CircuitDetailScreen)),
  );
  final CircuitDetailScreen screen = tester.widget(
    find.byType(CircuitDetailScreen),
  );
  return container.read(
    circuitEventAssociationProvider(
      EntityDetailScope(
        entityId: screen.circuitId,
        originSeason: screen.originSeason,
      ),
    ),
  );
}

void main() {
  group('CR-04 related Grand Prix association (Step 55C.11C)', () {
    testWidgets('1. event + materialized calendar: A', (tester) async {
      await _openCr04(
        tester,
        metadata: _Cr04Metadata(
          calendar: <int, ResourceSyncState?>{2026: _calendarRecord(2026)},
        ),
        profile: (int s, String id) =>
            circuitProfileFixture(season: s, circuitId: id),
      );
      expect(_relatedState(tester), 'A');
      expect(_association(tester), CircuitEventAssociation.linked);
    });

    testWidgets('2 / 12. event from a single snapshot, no calendar: A', (
      tester,
    ) async {
      await _openCr04(
        tester,
        metadata: _Cr04Metadata(),
        profile: (int s, String id) =>
            circuitProfileFixture(season: s, circuitId: id),
      );
      expect(_relatedState(tester), 'A');
      expect(find.text('Belgian Grand Prix'), findsOneWidget);
    });

    testWidgets('3. no event + materialized calendar: B', (tester) async {
      await _openCr04(
        tester,
        metadata: _Cr04Metadata(
          calendar: <int, ResourceSyncState?>{2026: _calendarRecord(2026)},
        ),
      );
      expect(_relatedState(tester), 'B');
      expect(_association(tester), CircuitEventAssociation.confirmedNone);
    });

    testWidgets('4. no event + no materialized calendar: C, all omitted', (
      tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _openCr04(tester, metadata: _Cr04Metadata());
      expect(_relatedState(tester), 'C');
      expect(_association(tester), CircuitEventAssociation.unknown);
      expect(find.bySemanticsLabel('No Grand Prix this season'), findsNothing);
      expect(find.bySemanticsLabel("This season's Grand Prix"), findsNothing);
      // Every other circuit fact stays.
      expect(find.text('Circuit facts'), findsOneWidget);
      expect(find.text('Lap record'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('5. calendar metadata still loading: no premature absence', (
      tester,
    ) async {
      final _Cr04Metadata metadata = _Cr04Metadata()..holdCalendar = true;
      await _openCr04(tester, metadata: metadata, settle: false);
      expect(find.byType(CircuitSheet), findsOneWidget);
      expect(_relatedState(tester), 'C');
      expect(_association(tester), CircuitEventAssociation.resolving);
      // Resolves to a confirmed absence once the record arrives.
      metadata.live[ResourceKey.calendar(2026)]!.add(_calendarRecord(2026));
      await tester.pumpAndSettle();
      expect(_relatedState(tester), 'B');
    });

    testWidgets('6. first launch offline, no calendar or bootstrap: C', (
      tester,
    ) async {
      await _openCr04(tester, metadata: _Cr04Metadata(), refresh: _offline);
      expect(_relatedState(tester), 'C');
      expect(find.byType(GvPrimerNotice), findsWidgets);
      expect(find.text('No Grand Prix this season'), findsNothing);
    });

    testWidgets('7. offline with a bootstrap for this season: B', (
      tester,
    ) async {
      await _openCr04(
        tester,
        metadata: _Cr04Metadata(bootstrap: _bootstrapRecord(2026)),
        refresh: _offline,
      );
      expect(_relatedState(tester), 'B');
    });

    testWidgets('8. bootstrap only for another season: C', (tester) async {
      await _openCr04(
        tester,
        metadata: _Cr04Metadata(bootstrap: _bootstrapRecord(2025)),
      );
      expect(_relatedState(tester), 'C');
    });

    testWidgets('9. materialized calendar, failed circuit refresh: B', (
      tester,
    ) async {
      await _openCr04(
        tester,
        metadata: _Cr04Metadata(
          calendar: <int, ResourceSyncState?>{2026: _calendarRecord(2026)},
        ),
        refresh: _offline,
      );
      expect(_relatedState(tester), 'B');
      expect(find.text('Update failed'), findsOneWidget);
    });

    testWidgets('10. stale but materialized calendar: B (CD-2)', (
      tester,
    ) async {
      await _openCr04(
        tester,
        metadata: _Cr04Metadata(
          calendar: <int, ResourceSyncState?>{
            2026: _calendarRecord(2026, staleAfter: DateTime.utc(2000)),
          },
        ),
      );
      expect(_relatedState(tester), 'B');
    });

    testWidgets('11. historical origin season without its calendar: C', (
      tester,
    ) async {
      await _openCr04(
        tester,
        // The current season's calendar is materialized; 2024's is not.
        metadata: _Cr04Metadata(
          calendar: <int, ResourceSyncState?>{2026: _calendarRecord(2026)},
          bootstrap: _bootstrapRecord(2026),
        ),
        originSeason: 2024,
      );
      expect(
        tester
            .widget<CircuitDetailScreen>(find.byType(CircuitDetailScreen))
            .originSeason,
        2024,
      );
      expect(_relatedState(tester), 'C');
      expect(find.text('2026 season'), findsNothing);

      // The same historical season with its own calendar: B, its own year.
      await _openCr04(
        tester,
        metadata: _Cr04Metadata(
          calendar: <int, ResourceSyncState?>{2024: _calendarRecord(2024)},
        ),
        originSeason: 2024,
      );
      expect(_relatedState(tester), 'B');
      expect(find.text('2024 season'), findsOneWidget);
    });

    testWidgets('13 / 14. calendar sync removes, then adds the event (live)', (
      tester,
    ) async {
      final StreamController<CircuitProfile?> profiles =
          StreamController<CircuitProfile?>.broadcast();
      addTearDown(profiles.close);
      await _openCr04(
        tester,
        metadata: _Cr04Metadata(
          calendar: <int, ResourceSyncState?>{2026: _calendarRecord(2026)},
        ),
        profileStream: (int s, String id) => profiles.stream,
        settle: false,
      );
      profiles.add(circuitProfileFixture(circuitId: 'spa-francorchamps'));
      await tester.pumpAndSettle();
      expect(_relatedState(tester), 'A');

      // An authoritative calendar replacement deletes the event.
      profiles.add(
        circuitProfileFixture(
          circuitId: 'spa-francorchamps',
          withRelated: false,
        ),
      );
      await tester.pumpAndSettle();
      expect(_relatedState(tester), 'B');

      // A later sync adds it back.
      profiles.add(circuitProfileFixture(circuitId: 'spa-francorchamps'));
      await tester.pumpAndSettle();
      expect(_relatedState(tester), 'A');
    });

    testWidgets('15. calendar metadata changes while visible: C → B → C', (
      tester,
    ) async {
      final _Cr04Metadata metadata = _Cr04Metadata();
      final StreamController<ResourceSyncState?> calendar = metadata.control(
        ResourceKey.calendar(2026),
      );
      addTearDown(calendar.close);
      await _openCr04(tester, metadata: metadata, settle: false);
      calendar.add(null);
      await tester.pumpAndSettle();
      expect(_relatedState(tester), 'C');
      calendar.add(_calendarRecord(2026));
      await tester.pumpAndSettle();
      expect(_relatedState(tester), 'B');
      // A data reset clears the record: back to unknown, never a stale claim.
      calendar.add(null);
      await tester.pumpAndSettle();
      expect(_relatedState(tester), 'C');
    });

    testWidgets('opening Circuit Detail never requests the calendar', (
      tester,
    ) async {
      final FakeRaceWeekendRepository repo = await _openCr04(
        tester,
        metadata: _Cr04Metadata(),
      );
      expect(repo.calendarRefreshCount, 0);
    });

    for (final AppThemePreference theme in <AppThemePreference>[
      AppThemePreference.dark,
      AppThemePreference.light,
    ]) {
      testWidgets('${theme.wire}: C keeps the page end 32px under the record', (
        tester,
      ) async {
        await _openCr04(tester, metadata: _Cr04Metadata(), theme: theme);
        expect(_relatedState(tester), 'C');
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('structure', () {
    for (final AppThemePreference theme in <AppThemePreference>[
      AppThemePreference.dark,
      AppThemePreference.light,
    ]) {
      testWidgets('${theme.wire}: shared bar, sheet, Lap record, related', (
        WidgetTester tester,
      ) async {
        await _open(tester, theme: theme);
        expect(find.byType(PrimerDetailAppBar), findsOneWidget);
        expect(find.byType(CircuitSheet), findsOneWidget);
        expect(_shownName(tester), 'Circuit de Spa-Francorchamps');
        expect(find.text('Stavelot, Belgium'), findsOneWidget);
        expect(find.text('Circuit facts'), findsOneWidget);
        // Section order: sheet, then Lap record, then the related section.
        final double sheet = tester.getTopLeft(find.byType(CircuitSheet)).dy;
        final double lap = tester
            .getTopLeft(_key('circuit-section-lap-record'))
            .dy;
        final double rel = tester
            .getTopLeft(_key('circuit-section-related'))
            .dy;
        expect(sheet < lap && lap < rel, isTrue);
        // No legacy hero, card or bottom navigation.
        expect(find.byType(GvHeroCard), findsNothing);
        // No legacy card of any kind (GvInfoCard, retired in Step 55C.13BR,
        // was one).
        expect(find.byType(GvContentCard), findsNothing);
        expect(find.byType(NavigationBar), findsNothing);
        expect(find.byType(RefreshIndicator), findsNothing);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('the season line leads the related section in both states', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      expect(find.text('2026 season'), findsOneWidget);
      expect(find.byType(CircuitEventRow), findsOneWidget);
      await _open(
        tester,
        profile: (int s, String id) =>
            circuitProfileFixture(season: s, circuitId: id, withRelated: false),
      );
      expect(find.text('2026 season'), findsOneWidget);
      expect(find.text('No Grand Prix this season'), findsOneWidget);
      expect(find.byType(CircuitEventRow), findsNothing);
      // No year above the circuit's stable identity.
      expect(
        tester.getTopLeft(find.text('2026 season')).dy,
        greaterThan(tester.getBottomLeft(find.byType(CircuitSheet)).dy),
      );
    });

    testWidgets('the season line follows the ready season (2024)', (
      WidgetTester tester,
    ) async {
      await _open(tester, currentSeason: 2024);
      expect(find.text('2024 season'), findsOneWidget);
      expect(find.text('2026 season'), findsNothing);
    });

    testWidgets('no facts: no kicker, the sheet closes 26px under its text', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => circuitProfileFixture(
          season: s,
          circuitId: id,
          lengthMeters: null,
          cornerCount: null,
          direction: null,
          firstGrandPrixYear: null,
          withLapRecord: false,
        ),
      );
      expect(find.text('Circuit facts'), findsNothing);
      expect(find.text('Lap record'), findsNothing);
      expect(
        tester.getBottomLeft(find.byType(CircuitSheet)).dy -
            tester.getBottomLeft(_key('circuit-sheet-location')).dy,
        closeTo(26, 0.5),
      );
      expect(find.byType(CircuitEventRow), findsOneWidget);
    });
  });

  group('functional gates', () {
    testWidgets('a null direction is omitted; unknown has no glyph', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) =>
            circuitProfileFixture(season: s, circuitId: id, direction: null),
      );
      expect(find.text('Direction'), findsNothing);
      expect(find.text('Direction unavailable'), findsNothing);
      expect(find.text('Corners'), findsOneWidget);

      await _open(
        tester,
        profile: (int s, String id) => circuitProfileFixture(
          season: s,
          circuitId: id,
          direction: CircuitDirection.unknown,
        ),
      );
      expect(find.text('Direction unavailable'), findsOneWidget);
      expect(_key('circuit-direction-glyph'), findsNothing);
    });

    testWidgets('known directions carry the rotate glyph', (
      WidgetTester tester,
    ) async {
      for (final (CircuitDirection d, String word, GvPrimerGlyph glyph)
          in <(CircuitDirection, String, GvPrimerGlyph)>[
            (CircuitDirection.clockwise, 'Clockwise', GvPrimerGlyph.rotateCw),
            (
              CircuitDirection.counterClockwise,
              'Counter-clockwise',
              GvPrimerGlyph.rotateCcw,
            ),
          ]) {
        await _open(
          tester,
          profile: (int s, String id) =>
              circuitProfileFixture(season: s, circuitId: id, direction: d),
        );
        expect(find.text(word), findsOneWidget);
        expect(
          tester.widget<GvPrimerIcon>(_key('circuit-direction-glyph')).glyph,
          glyph,
        );
      }
    });

    testWidgets('a holder appears only with a driver id, never as a link', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => circuitProfileFixture(
          season: s,
          circuitId: id,
          lapRecord: const LapRecord(
            time: Duration(minutes: 1, seconds: 46, milliseconds: 286),
            year: 2018,
          ),
          lapRecordDriverName: null,
        ),
      );
      expect(find.text('Driver'), findsNothing);
      expect(find.text('Driver unavailable'), findsNothing);
      expect(find.text('1:46.286'), findsOneWidget);

      await _open(tester);
      final Finder holder = find.text('Valtteri Bottas');
      expect(holder, findsOneWidget);
      expect(
        find.ancestor(of: holder, matching: find.byType(GvPrimerFocusTarget)),
        findsNothing,
      );
      expect(find.textContaining('valtteri-bottas'), findsNothing);
    });

    testWidgets('an unresolved holder is secondary unavailable copy (PD-13a)', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => circuitProfileFixture(
          season: s,
          circuitId: id,
          lapRecord: const LapRecord(driverId: 'ghost-driver', year: 2004),
          lapRecordDriverName: null,
        ),
      );
      final Text holder = tester.widget(_key('circuit-lap-unavailable'));
      expect(holder.data, 'Driver unavailable');
      expect(holder.style!.color, GvPrimerRoles.dark.text.secondary);
      // A year-only record: no time, no rule.
      expect(find.text('Time'), findsNothing);
      expect(_key('circuit-lap-rule'), findsNothing);
      expect(find.text('2004'), findsOneWidget);
      expect(find.textContaining('ghost-driver'), findsNothing);
    });

    testWidgets('no lap record without a time or a year', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => circuitProfileFixture(
          season: s,
          circuitId: id,
          lapRecord: const LapRecord(driverId: 'valtteri-bottas'),
        ),
      );
      expect(find.text('Lap record'), findsNothing);
    });

    testWidgets('race distance, lap count and identifiers never appear', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester);
      expect(find.text('Laps'), findsNothing);
      expect(find.textContaining('spa-francorchamps'), findsNothing);
      final List<String> labels = _traversal(
        tester.getSemantics(find.byType(CircuitDetailScreen)),
      );
      expect(
        labels.where((String l) => l.contains('spa-francorchamps')),
        isEmpty,
      );
      handle.dispose();
    });
  });

  group('formatting', () {
    testWidgets('Spanish: decimal comma, localized date, unlocalized time', (
      WidgetTester tester,
    ) async {
      await _open(tester, locale: const Locale('es'));
      expect(find.text('7,004'), findsOneWidget);
      expect(find.text('km'), findsOneWidget);
      expect(find.text('1:46.286'), findsOneWidget);
      expect(find.text('24 jul 2026'), findsOneWidget);
      expect(find.text('Ronda'), findsOneWidget);
      expect(find.text('Temporada 2026'), findsOneWidget);
      expect(find.text('1950'), findsOneWidget);
    });

    testWidgets('the length is read as one value', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester);
      final List<String> labels = _traversal(
        tester.getSemantics(find.byType(CircuitDetailScreen)),
      );
      expect(labels, contains('Length\n7.004 km'));
      expect(labels, contains('Corners\n19'));
      expect(labels, contains('Direction\nClockwise'));
      expect(labels, contains('First Grand Prix\n1950'));
      handle.dispose();
    });
  });

  group('related Grand Prix', () {
    testWidgets('opens the exact season and round', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        currentSeason: 2024,
        profile: (int s, String id) => circuitProfileFixture(
          season: s,
          circuitId: id,
          related: relatedGrandPrix(season: s, round: 9),
        ),
      );
      await tester.tap(_link);
      await tester.pumpAndSettle();
      final GrandPrixDetailScreen gp = tester.widget(
        find.byType(GrandPrixDetailScreen),
      );
      expect((gp.season, gp.round), (2024, 9));
    });

    testWidgets('an unnamed event keeps navigation, secondary name', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(
        tester,
        profile: (int s, String id) => circuitProfileFixture(
          season: s,
          circuitId: id,
          related: relatedGrandPrix(season: s, name: null),
        ),
      );
      final Text name = tester.widget(_key('circuit-related-name'));
      expect(name.data, 'Grand Prix name unavailable');
      expect(name.style!.color, GvPrimerRoles.dark.text.secondary);
      expect(
        tester.getSemantics(_link).label,
        'Open Grand Prix name unavailable',
      );
      await tester.tap(_link);
      await tester.pumpAndSettle();
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
      handle.dispose();
    });

    testWidgets('chips only from present values; unknowns are dashed', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      expect(
        _chips(
          tester,
        ).map((GvPrimerStatusChip c) => (c.label, c.kind)).toList(),
        <(String, GvPrimerChipKind)>[
          ('Upcoming', GvPrimerChipKind.known),
          ('Sprint weekend', GvPrimerChipKind.context),
        ],
      );

      await _open(
        tester,
        profile: (int s, String id) => circuitProfileFixture(
          season: s,
          circuitId: id,
          related: relatedGrandPrix(
            season: s,
            status: EventStatus.unknown,
            format: WeekendFormat.unknown,
          ),
        ),
      );
      expect(
        _chips(
          tester,
        ).map((GvPrimerStatusChip c) => (c.label, c.kind)).toList(),
        <(String, GvPrimerChipKind)>[
          ('Status unknown', GvPrimerChipKind.unknown),
          ('Format unknown', GvPrimerChipKind.unknown),
        ],
      );

      await _open(
        tester,
        profile: (int s, String id) => circuitProfileFixture(
          season: s,
          circuitId: id,
          related: relatedGrandPrix(season: s, status: null, format: null),
        ),
      );
      expect(find.byType(GvPrimerStatusChip), findsNothing);
      expect(_key('circuit-related-chips'), findsNothing);
      expect(tester.getSize(_link).height, greaterThanOrEqualTo(96));
    });

    testWidgets('round figure, 4px seam within 48–76px, 44px disc', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      final Size seam = tester.getSize(_key('circuit-related-seam'));
      expect(seam.width, 4);
      expect(seam.height, inInclusiveRange(48, 76));
      expect(
        tester.getSize(find.byType(GvPrimerArrowDisc)),
        const Size(44, 44),
      );
      expect(find.text('Round'), findsOneWidget);
      expect(find.text('13'), findsOneWidget);
    });

    testWidgets('narrow at 200%: round, seam and disc on the first line', (
      WidgetTester tester,
    ) async {
      await loadArchivo(tester);
      await _open(tester, size: const Size(320, 2400), textScale: 2);
      final Rect round = tester.getRect(_key('circuit-related-round'));
      final Rect name = tester.getRect(_key('circuit-related-name'));
      final Rect disc = tester.getRect(find.byType(GvPrimerArrowDisc));
      expect(name.top, greaterThan(round.bottom));
      expect(disc.bottom, lessThanOrEqualTo(name.top));
      expect(name.left, round.left);
      expect(tester.takeException(), isNull);
    });
  });

  group('season and navigation', () {
    testWidgets('refresh is scoped to circuit:<id>:<season>', (
      WidgetTester tester,
    ) async {
      final (_, FakeCircuitRepository circuits) = await _open(
        tester,
        currentSeason: 2025,
      );
      expect(circuits.detailRefreshes, <DetailRefreshCall>[
        (entityId: 'spa-francorchamps', season: 2025),
      ]);
      expect(circuits.collectionRefreshCount, 0);
    });

    testWidgets('season unavailable requests nothing and offers retry', (
      WidgetTester tester,
    ) async {
      final (_, FakeCircuitRepository circuits) = await _open(
        tester,
        currentSeason: null,
      );
      expect(circuits.detailRefreshCount, 0);
      expect(find.text('Season unavailable'), findsOneWidget);
      expect(find.byType(GvPrimerButton), findsOneWidget);
    });

    testWidgets('a deep link resolves the current season and has no Back', (
      WidgetTester tester,
    ) async {
      final FakeCircuitRepository circuits = defaultFakeCircuits();
      await _reset(tester);
      await pumpApp(
        tester,
        initialLocation: _spa,
        surfaceSize: const Size(390, 2400),
        currentSeason: 2025,
        circuits: circuits,
      );
      expect(circuits.detailRefreshes.single.season, 2025);
      expect(_back, findsNothing);
      expect(find.text('2025 season'), findsOneWidget);
    });

    testWidgets('keyboard: Back then the related row by Tab and Enter', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      _nodeOf(tester, _back).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(FocusManager.instance.primaryFocus, _nodeOf(tester, _link));
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);

      await _open(tester);
      _nodeOf(tester, _back).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pumpAndSettle();
      expect(find.byType(CircuitDetailScreen), findsNothing);
    });

    testWidgets('focus rings: circular Back per theme, row ring on the link', (
      WidgetTester tester,
    ) async {
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.alwaysTraditional;
      addTearDown(
        () => FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.automatic,
      );
      for (final (AppThemePreference theme, double offset)
          in <(AppThemePreference, double)>[
            (AppThemePreference.dark, 3),
            (AppThemePreference.light, 1),
          ]) {
        await _open(tester, theme: theme);
        final GvPrimerFocusTarget back = tester.widget(_back);
        expect(back.geometry.offset, offset);
        expect(back.geometry.radius, 24);
        expect(
          tester.widget<GvPrimerFocusTarget>(_link).geometry,
          GvPrimerFocusGeometry.row,
        );
        for (final Finder target in <Finder>[_back, _link]) {
          _nodeOf(tester, target).requestFocus();
          await tester.pumpAndSettle();
          final CustomPaint ring = tester
              .widgetList<CustomPaint>(
                find.descendant(of: target, matching: find.byType(CustomPaint)),
              )
              .firstWhere(
                (CustomPaint p) =>
                    p.foregroundPainter is GvPrimerFocusRingPainter,
              );
          expect(
            (ring.foregroundPainter! as GvPrimerFocusRingPainter).visible,
            isTrue,
          );
        }
      }
    });
  });

  group('states and notices', () {
    List<String> messages(WidgetTester tester) => <String>[
      for (final GvPrimerNotice n in tester.widgetList(
        find.byType(GvPrimerNotice),
      ))
        n.message,
    ];

    testWidgets('N-1 / N-2: failure, stale, combined, partial', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      expect(messages(tester), isEmpty);
      await _open(tester, refresh: _offline);
      expect(messages(tester), <String>['Update failed']);
      await _open(tester, metadata: _stale);
      expect(messages(tester), <String>['Details may be outdated']);
      await _open(tester, metadata: _stale, refresh: _offline);
      expect(messages(tester), hasLength(1));
      expect(messages(tester).single, isNot('Update failed'));
      expect(find.text('Lap record'), findsOneWidget, reason: 'content kept');
      await _open(tester, metadata: _never, refresh: _offline);
      expect(messages(tester), <String>[
        'Update failed',
        'Some profile information is unavailable',
      ]);
      expect(_shownName(tester), 'Circuit de Spa-Francorchamps');
    });

    testWidgets('loading: the Circuit skeleton (PD-13c), announced once', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _reset(tester);
      final GoRouter router = await pumpApp(
        tester,
        surfaceSize: const Size(390, 844),
        circuits: FakeCircuitRepository(
          profileStream: (int s, String id) =>
              const Stream<CircuitProfile?>.empty(),
        ),
      );
      unawaited(router.push(_spa));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(CircuitDetailSkeleton), findsOneWidget);
      final List<Rect> blocks = <Rect>[
        for (final Element e in find.byType(GvPrimerSkeleton).evaluate())
          () {
            final RenderBox box = e.renderObject! as RenderBox;
            return box.localToGlobal(Offset.zero) & box.size;
          }(),
      ];
      expect(blocks, hasLength(5));
      expect(blocks[0].size, const Size(390, 232));
      expect(blocks[1].size, const Size(140, 18));
      expect(blocks[2].size, const Size(358, 88));
      expect(blocks[3].size, const Size(140, 18));
      expect(blocks[4].size, const Size(358, 88));
      expect(blocks[1].top - blocks[0].bottom, 48);
      expect(blocks[2].top - blocks[1].bottom, 14);
      expect(blocks[3].top - blocks[2].bottom, 24);
      expect(find.bySemanticsLabel('Loading'), findsOneWidget);
      expect(find.byType(PrimerDetailAppBar), findsOneWidget);
      handle.dispose();
    });

    testWidgets('full-page states keep the bar; first-load error retries', (
      WidgetTester tester,
    ) async {
      final (_, FakeCircuitRepository circuits) = await _open(
        tester,
        profile: (int s, String id) => null,
        refresh: _offline,
        size: const Size(320, 693),
        textScale: 2,
      );
      expect(find.byType(PrimerDetailAppBar), findsOneWidget);
      expect(find.byType(PrimerDetailMessage), findsOneWidget);
      expect(find.text("Can't load this profile"), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.byType(GvPrimerButton));
      await tester.pumpAndSettle();
      expect(circuits.detailRefreshCount, 2);

      await _open(
        tester,
        profile: (int s, String id) => null,
        refresh: _notFound,
      );
      expect(find.text('Not available'), findsOneWidget);
      expect(find.byType(GvPrimerButton), findsNothing);
    });
  });

  group('dimension ticks (Step 55C.11R)', () {
    double contrast(Color a, Color b) {
      final double la = a.computeLuminance();
      final double lb = b.computeLuminance();
      return ((la > lb ? la : lb) + 0.05) / ((la > lb ? lb : la) + 0.05);
    }

    test('Dark keeps Chalk; Light uses line.status at 3:1 or more', () {
      expect(
        CircuitDimensionLine.tickColor(GvPrimerRoles.dark),
        GvPrimerPalette.chalk100,
      );
      final GvPrimerRoles light = GvPrimerRoles.light;
      final Color tick = CircuitDimensionLine.tickColor(light);
      expect(tick, light.line.status);
      final Color band = light.surface.band;
      final double measured = contrast(Color.alphaBlend(tick, band), band);
      expect(measured, greaterThanOrEqualTo(3));
      // Secondary: lighter than the horizontal rule (text.secondary).
      expect(measured, lessThan(contrast(light.text.secondary, band)));
    });
  });

  group('media', () {
    testWidgets('no asset: no frame, no placeholder icon', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      expect(find.byType(CircuitMediaFrame), findsNothing);
      expect(find.byType(GvRemoteImage), findsNothing);
      expect(find.byType(GvImagePlaceholder), findsNothing);
    });

    testWidgets('a diagram reserves 16:9, is labelled, pending is empty', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester, profile: _withMedia);
      final Size frame = tester.getSize(_key('circuit-media-frame'));
      expect(frame.width, 358);
      expect(frame.height, closeTo(358 * 9 / 16, 0.5));
      expect(find.byKey(GvRemoteImage.pendingPlaceholderKey), findsOneWidget);
      expect(_key('circuit-media-failed'), findsNothing);
      expect(find.byType(GvImagePlaceholder), findsNothing);
      expect(
        find.bySemanticsLabel('Track layout of Circuit de Spa-Francorchamps'),
        findsOneWidget,
      );
      handle.dispose();
    });

    testWidgets('failure keeps the geometry and shows the route glyph', (
      WidgetTester tester,
    ) async {
      await _open(tester, profile: _withMedia);
      final Rect pending = tester.getRect(_key('circuit-media-frame'));
      final double facts = tester.getTopLeft(find.text('Circuit facts')).dy;
      await _open(
        tester,
        profile: _withMedia,
        mediaLoader: FakeMediaImageLoader(),
      );
      expect(find.byKey(GvRemoteImage.failedPlaceholderKey), findsOneWidget);
      expect(_key('circuit-media-failed'), findsOneWidget);
      expect(tester.getRect(_key('circuit-media-frame')), pending);
      expect(tester.getTopLeft(find.text('Circuit facts')).dy, facts);
    });

    testWidgets('a photograph is decorative', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(
        tester,
        profile: (int s, String id) =>
            _withMedia(s, id, category: MediaCategory.hero),
      );
      expect(find.byType(CircuitMediaFrame), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('Track layout')), findsNothing);
      handle.dispose();
    });
  });

  group('responsive', () {
    for (final AppThemePreference theme in <AppThemePreference>[
      AppThemePreference.dark,
      AppThemePreference.light,
    ]) {
      for (final (String lang, Size size, double scale)
          in <(String, Size, double)>[
            ('en', const Size(390, 844), 1),
            ('es', const Size(390, 844), 1),
            ('en', const Size(320, 693), 2),
            ('es', const Size(320, 693), 2),
          ]) {
        for (final (String label, CircuitProfile Function(int, String) p)
            in <(String, CircuitProfile Function(int, String))>[
              (
                'index',
                (int s, String id) =>
                    circuitProfileFixture(season: s, circuitId: id),
              ),
              ('long names', _long),
              ('media', _withMedia),
            ]) {
          testWidgets('${theme.wire} $lang ${size.width.toInt()} '
              '@${(scale * 100).toInt()}% $label: no overflow, no split word', (
            WidgetTester tester,
          ) async {
            await loadArchivo(tester);
            await _open(
              tester,
              profile: p,
              size: Size(size.width, 2400),
              textScale: scale,
              locale: Locale(lang),
              theme: theme,
            );
            expect(tester.takeException(), isNull);
            // The heading's words fit its box: never split mid-word. A
            // hyphenated word longer than 18 characters may break at its
            // hyphens (CSS `.nobr` keeps only the short ones whole).
            final Text name = tester.widget(_key('circuit-sheet-name'));
            final double box = tester.getSize(_key('circuit-sheet-name')).width;
            final TextStyle style = DefaultTextStyle.of(
              tester.element(_key('circuit-sheet-name')),
            ).style.merge(name.style);
            final List<String> words = <String>[
              for (final String w in name.data!.split(' '))
                if (w.contains('⁠')) w else ...w.split(RegExp('(?<=-)')),
            ];
            for (final String word in words) {
              final TextPainter painter = TextPainter(
                text: TextSpan(text: word, style: style),
                textDirection: TextDirection.ltr,
              )..layout();
              expect(painter.width, lessThanOrEqualTo(box + 0.5), reason: word);
              painter.dispose();
            }
            // The length value never wraps.
            expect(
              tester.getSize(_key('circuit-length-value')).height,
              lessThan(60),
            );
          });
        }
      }
    }

    testWidgets('a short hyphenated word is kept whole (.nobr)', (
      WidgetTester tester,
    ) async {
      expect(
        CircuitSheet.keepShortHyphenatedWords('Circuit de Spa-Francorchamps'),
        'Circuit de Spa-⁠Francorchamps',
      );
      expect(
        CircuitSheet.keepShortHyphenatedWords(
          'Extraordinarily-Long-Hyphenated',
        ),
        'Extraordinarily-Long-Hyphenated',
      );
      await loadArchivo(tester);
      await _open(tester);
      // Two lines: "Circuit de" / "Spa-Francorchamps".
      final Size box = tester.getSize(_key('circuit-sheet-name'));
      expect(box.height, closeTo(2 * 40 * 0.98, 2));
    });

    testWidgets('narrow sheet: 320dp switches the name and figure to 34px', (
      WidgetTester tester,
    ) async {
      expect(CircuitSheet.isNarrow(358, TextScaler.noScaling), isFalse);
      expect(CircuitSheet.isNarrow(288, TextScaler.noScaling), isTrue);
      expect(CircuitEventRow.isNarrow(390, TextScaler.noScaling), isFalse);
      expect(CircuitEventRow.isNarrow(320, TextScaler.noScaling), isFalse);
      expect(CircuitEventRow.isNarrow(390, const TextScaler.linear(2)), isTrue);
      await _open(tester, size: const Size(320, 2400));
      expect(
        tester.widget<Text>(_key('circuit-sheet-name')).style!.fontSize,
        34,
      );
    });
  });

  group('accessibility', () {
    testWidgets('reading order and headings', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester);
      final List<String> order = _traversal(
        tester.getSemantics(find.byType(CircuitDetailScreen)),
      );
      final List<int> positions = <int>[
        for (final String label in <String>[
          'Back',
          'Circuit',
          'Circuit de Spa-Francorchamps',
          'Stavelot, Belgium',
          'Circuit facts',
          'Length\n7.004 km',
          'Corners\n19',
          'Direction\nClockwise',
          'First Grand Prix\n1950',
          'Lap record',
          'Time\n1:46.286',
          'Driver\nValtteri Bottas',
          'Year\n2018',
          "This season's Grand Prix",
          '2026 season',
          'Open Belgian Grand Prix',
        ])
          order.indexOf(label),
      ];
      expect(positions, isNot(contains(-1)), reason: order.join(' | '));
      expect(positions, List<int>.of(positions)..sort());
      // XS-04 kept: round, date and chips are not announced separately.
      for (final String hidden in <String>[
        'Round',
        'Jul 24, 2026',
        'Upcoming',
      ]) {
        expect(order.contains(hidden), isFalse, reason: hidden);
      }
      expect(
        tester
            .getSemantics(_key('circuit-sheet-name'))
            .flagsCollection
            .isHeader,
        isTrue,
      );
      for (final String heading in <String>[
        'Circuit facts',
        'Lap record',
        "This season's Grand Prix",
      ]) {
        expect(
          tester.getSemantics(find.text(heading)).flagsCollection.isHeader,
          isTrue,
          reason: heading,
        );
      }
      final SemanticsNode link = tester.getSemantics(_link);
      expect(link.label, 'Open Belgian Grand Prix');
      expect(link.flagsCollection.isButton, isTrue);
      handle.dispose();
    });

    testWidgets('interaction targets meet 48dp', (WidgetTester tester) async {
      await _open(tester, size: const Size(320, 2400), textScale: 2);
      expect(tester.getSize(_back), const Size(48, 48));
      expect(tester.getSize(_link).width, 320);
      expect(tester.getSize(_link).height, greaterThanOrEqualTo(96));
    });

    testWidgets('system insets: the bar clears the top, the end the bottom', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        surfaceSize: const Size(390, 844),
        padding: const EdgeInsets.only(top: 24, bottom: 48),
      );
      unawaited(router.push(_spa));
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.byType(PrimerDetailAppBar)).dy, 24);
      final ListView list = tester.widget(_key('circuit-detail-list'));
      expect((list.padding! as EdgeInsets).bottom, 32 + 48);
    });
  });
}
