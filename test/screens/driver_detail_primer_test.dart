// Step 55C.9: the production Driver Detail in Primer V2 (Dark and Light).
//
// Presentation only: route, origin season, participation selection, state,
// refresh and media contracts are the existing ones and are asserted here
// through the real router, providers and fakes. Every value is a test fixture.
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/media/media_image_loader.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/widgets/driver_detail_app_bar.dart';
import 'package:gridview/features/drivers/presentation/widgets/driver_detail_states.dart';
import 'package:gridview/features/drivers/presentation/widgets/driver_plate.dart';
import 'package:gridview/features/drivers/presentation/widgets/driver_stint_row.dart';
import 'package:gridview/features/shared/application/entity_detail_state.dart';
import 'package:gridview/features/shared/domain/entities/driver.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';
import 'package:gridview/l10n/app_localizations_en.dart';

import '../support/domain_fixtures.dart';
import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';
import '../support/fake_repository.dart';
import '../support/media_fixtures.dart';
import '../support/primer_fonts.dart';
import '../support/router_harness.dart';
import '../support/synthetic_png.dart';

const String _driver = '/drivers/max-verstappen';

ResourceSyncState? _never(String key) => null;
ResourceSyncState? _stale(String key) =>
    syncedMetadata(key, staleAfter: DateTime.utc(2000));
Future<RefreshResult> _offline(String id, int season) async =>
    const RefreshFailure(ApiFailure(kind: ApiFailureKind.networkUnavailable));

/// Unmounts the previous app, so a second scenario in the same test starts
/// with a fresh `ProviderScope` (a re-pumped scope keeps its container).
Future<void> _reset(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
}

/// Opens Driver Detail above Home, as from any origin, so the back action
/// exists.
Future<GoRouter> _open(
  WidgetTester tester, {
  DriverProfile? Function(int season, String id)? profile,
  Stream<DriverProfile?> Function(int season, String id)? profileStream,
  ResourceSyncState? Function(String key)? metadata,
  Future<RefreshResult> Function(String id, int season)? refresh,
  Size size = const Size(390, 2400),
  double textScale = 1,
  Locale locale = const Locale('en'),
  AppThemePreference theme = AppThemePreference.dark,
  MediaImageLoader? mediaLoader,
  bool disableAnimations = false,
}) async {
  await _reset(tester);
  final GoRouter router = await pumpApp(
    tester,
    surfaceSize: size,
    textScale: textScale,
    locale: locale,
    disableAnimations: disableAnimations,
    preferences: AppPreferences.defaults.copyWith(theme: theme),
    syncMetadata: metadata,
    mediaLoader: mediaLoader,
    drivers: FakeDriverRepository(
      profile: profileStream == null
          ? (profile ??
                (int s, String id) =>
                    driverProfileFixture(season: s, driverId: id))
          : null,
      profileStream: profileStream,
      onRefreshDetail: refresh,
    ),
  );
  unawaited(router.push(_driver));
  await tester.pumpAndSettle();
  return router;
}

List<String> _traversal(SemanticsNode node) => <String>[
  if (node.label.isNotEmpty) node.label,
  for (final SemanticsNode child in node.debugListChildrenInOrder(
    DebugSemanticsDumpOrder.traversalOrder,
  ))
    ..._traversal(child),
];

FocusNode _nodeOf(WidgetTester tester, Finder target) => Focus.of(
  tester.element(
    find.descendant(of: target, matching: find.byType(GestureDetector)).first,
  ),
);

Finder get _teamLink => find.descendant(
  of: find.byType(DriverStintRow).first,
  matching: find.byType(GvPrimerFocusTarget),
);

Finder get _standingsLink => find.descendant(
  of: find.byType(GvPrimerLinkRow),
  matching: find.byType(GvPrimerFocusTarget),
);

Finder get _back => find.byKey(const ValueKey<String>('driver-detail-back'));

List<GvPrimerNotice> _notices(WidgetTester tester) =>
    tester.widgetList<GvPrimerNotice>(find.byType(GvPrimerNotice)).toList();

DriverProfile _withMedia(int s, String id) {
  final DriverProfile p = driverProfileFixture(season: s, driverId: id);
  final Driver d = p.driver;
  return DriverProfile(
    driver: Driver(
      id: d.id,
      fullName: d.fullName,
      shortCode: d.shortCode,
      permanentNumber: d.permanentNumber,
      nationality: d.nationality,
      dateOfBirth: d.dateOfBirth,
      placeOfBirth: d.placeOfBirth,
      biography: d.biography,
      media: <MediaAsset>[portraitAsset(id: '$id-portrait-v1', owner: id)],
    ),
    season: p.season,
    participations: p.participations,
    standing: p.standing,
  );
}

DriverProfile _twoSpans(int s, String id) => driverProfileFixture(
  season: s,
  driverId: id,
  name: 'Synthetic Two-Span Driver',
  participations: <DriverParticipation>[
    participation(
      season: s,
      driverId: id,
      constructorId: 'alpine',
      teamName: 'BWT Alpine Formula One Team',
      teamColor: '#0093CC',
      raceNumber: 43,
      startRound: 7,
    ),
    participation(
      season: s,
      driverId: id,
      constructorId: 'williams',
      teamName: 'Williams Racing',
      teamColor: '#005AFF',
      raceNumber: 2,
      endRound: 6,
      entryId: 'span-2',
    ),
  ],
);

void main() {
  group('themes and responsive layouts', () {
    for (final AppThemePreference theme in <AppThemePreference>[
      AppThemePreference.dark,
      AppThemePreference.light,
    ]) {
      for (final (String lang, Size size, double scale, bool stacked)
          in <(String, Size, double, bool)>[
            ('en', const Size(390, 844), 1, false),
            ('es', const Size(390, 844), 1, false),
            ('en', const Size(320, 693), 2, true),
            ('es', const Size(320, 693), 2, true),
            // DD-06 Option B (Step 55C.9F): "Verstappen" does not fit beside
            // the one-digit board at 346 / 360dp, so the plate stacks; it
            // fits at 375dp, which keeps the wide plate.
            ('en', const Size(346, 800), 1, true),
            ('en', const Size(360, 800), 1, true),
            ('en', const Size(375, 812), 1, false),
          ]) {
        testWidgets(
          '${theme.wire} $lang ${size.width.toInt()} @${(scale * 100).toInt()}% '
          'lays out without overflow',
          (WidgetTester tester) async {
            // Real Archivo metrics: the stacking rule measures the name.
            await loadArchivo(tester);
            await _open(
              tester,
              size: size,
              textScale: scale,
              locale: Locale(lang),
              theme: theme,
            );
            expect(tester.takeException(), isNull);
            final Rect plate = tester.getRect(
              find.byKey(const ValueKey<String>('driver-plate')),
            );
            final Rect board = tester.getRect(
              find.byKey(const ValueKey<String>('driver-plate-board')),
            );
            final Rect name = tester.getRect(
              find.byKey(const ValueKey<String>('driver-plate-name')),
            );
            // The board runs to the right edge in both layouts.
            expect(board.right, plate.right);
            // No word of "Max Verstappen" is ever split: at most two lines.
            final double nameSize = tester
                .widget<Text>(
                  find.byKey(const ValueKey<String>('driver-plate-name')),
                )
                .style!
                .fontSize!;
            expect(name.height, lessThanOrEqualTo(2 * nameSize * 0.98 + 1));
            if (stacked) {
              // The name takes the full width; the board sits below it.
              expect(board.top, greaterThanOrEqualTo(name.bottom));
            } else {
              expect(plate.height, greaterThanOrEqualTo(DriverPlate.minHeight));
              expect(board.height, plate.height);
              expect(board.left, greaterThan(name.right));
            }
            // Every section is reachable by scrolling and nothing is clipped.
            await tester.dragUntilVisible(
              find.byType(GvPrimerLinkRow),
              find.byKey(const ValueKey<String>('driver-detail-list')),
              const Offset(0, -300),
            );
            expect(tester.takeException(), isNull);
          },
        );
      }
    }

    testWidgets('a two-digit board stacks below 30em; one digit does not', (
      WidgetTester tester,
    ) async {
      const DriverPlate one = DriverPlate(
        name: 'A',
        seasonLine: '2026 season',
        number: DriverPlateNumber(label: 'Race number', figure: '1'),
      );
      const DriverPlate two = DriverPlate(
        name: 'A',
        seasonLine: '2026 season',
        number: DriverPlateNumber(label: 'Race number', figure: '33'),
      );
      const DriverPlate codeOnly = DriverPlate(
        name: 'A',
        seasonLine: '2026 season',
        code: 'VER',
      );
      const DriverPlate bare = DriverPlate(name: 'A', seasonLine: 's');
      const TextScaler s1 = TextScaler.noScaling;
      expect(one.isStacked(390, s1), isFalse);
      expect(two.isStacked(390, s1), isTrue);
      expect(two.isStacked(451, s1), isFalse);
      expect(codeOnly.isStacked(390, s1), isTrue);
      expect(bare.isStacked(390, s1), isFalse);
      expect(one.isStacked(345, s1), isTrue);
      expect(one.isStacked(390, const TextScaler.linear(2)), isTrue);
    });

    testWidgets('DD-06 rule B: on in Driver Detail; stacks only a split word', (
      WidgetTester tester,
    ) async {
      await loadArchivo(tester);
      Future<bool> stacked(double width, {required bool ruleB}) async {
        await tester.pumpWidget(
          MaterialApp(
            theme: buildGridViewDarkTheme(),
            home: Scaffold(
              body: SingleChildScrollView(
                child: SizedBox(
                  width: width,
                  child: DriverPlate(
                    name: 'Max Verstappen',
                    seasonLine: '2026 season',
                    nationality: 'Dutch',
                    number: const DriverPlateNumber(
                      label: 'Race number',
                      figure: '1',
                    ),
                    code: 'VER',
                    stackForUnbrokenName: ruleB,
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        return tester
                .getRect(
                  find.byKey(const ValueKey<String>('driver-plate-board')),
                )
                .top >=
            tester
                .getRect(
                  find.byKey(const ValueKey<String>('driver-plate-name')),
                )
                .bottom;
      }

      // Driver Detail turns the approved Option B on (Step 55C.9F); the
      // widget's own default stays the plain container rule.
      expect(
        const DriverPlate(name: 'A', seasonLine: 's').stackForUnbrokenName,
        isFalse,
      );
      await _open(tester);
      expect(
        tester
            .widget<DriverPlate>(find.byType(DriverPlate))
            .stackForUnbrokenName,
        isTrue,
      );
      expect(await stacked(360, ruleB: false), isFalse);
      expect(await stacked(360, ruleB: true), isTrue);
      expect(await stacked(390, ruleB: false), isFalse);
      expect(await stacked(390, ruleB: true), isFalse);
    });

    testWidgets('a long name, nationality and constructor wrap, never clip', (
      WidgetTester tester,
    ) async {
      for (final (Size size, double scale) in <(Size, double)>[
        (const Size(390, 2400), 1),
        (const Size(320, 2400), 2),
      ]) {
        await _open(
          tester,
          size: size,
          textScale: scale,
          profile: (int s, String id) => driverProfileFixture(
            season: s,
            driverId: id,
            name: 'Synthetic Maximilian-Alexander Long-Surname Testdriver',
            nationality: 'Synthetic Extraordinarily Long Nationality',
            participations: <DriverParticipation>[
              participation(
                season: s,
                driverId: id,
                constructorId: 'synthetic',
                teamName:
                    'Synthetic Extremely Long Constructor Name Racing Team',
                teamColor: '#FFFFFF',
                raceNumber: 88,
              ),
            ],
          ),
        );
        expect(tester.takeException(), isNull);
        final Text name = tester.widget<Text>(
          find.byKey(const ValueKey<String>('driver-plate-name')),
        );
        expect(name.maxLines, isNull);
        expect(name.overflow, isNull);
        expect(
          find.text('Synthetic Extremely Long Constructor Name Racing Team'),
          findsOneWidget,
        );
      }
    });
  });

  group('season and navigation', () {
    testWidgets('a historical Standings origin keeps its season everywhere', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        initialLocation: '/standings/drivers/2024',
        surfaceSize: const Size(390, 2400),
        standings: FakeStandingsRepository(
          drivers: (int season) => driverStandingsFixture(season: season),
        ),
      );
      await tester.tap(find.text('Max Verstappen').first);
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
      expect(
        tester
            .widget<DriverDetailScreen>(find.byType(DriverDetailScreen))
            .originSeason,
        2024,
      );
      expect(find.text('2024 season'), findsOneWidget);
      expect(find.textContaining('2026'), findsNothing);

      // Team link: the exact season travels with the push.
      await tester.tap(_teamLink);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<ConstructorDetailScreen>(
              find.byType(ConstructorDetailScreen),
            )
            .originSeason,
        2024,
      );
      // Team → the same Driver collapses into a pop (loop prevention).
      await tester.pageBack();
      await tester.pumpAndSettle();

      await tester.tap(_standingsLink);
      await tester.pumpAndSettle();
      expect(find.byType(StandingsScreen), findsOneWidget);
      expect(shellLocation(router), '/standings/drivers/2024');
    });

    testWidgets('a deep link resolves the current season and has no Back', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: _driver,
        surfaceSize: const Size(390, 2400),
      );
      expect(find.text('2026 season'), findsOneWidget);
      // Nothing to pop to: the Material AppBar rule, unchanged. The back
      // column stays, so the title does not move.
      expect(_back, findsNothing);
      expect(find.byTooltip('Back'), findsNothing);
      expect(tester.getTopLeft(find.text('Driver')).dx, 6 + 48 + 4);
    });

    testWidgets('Back returns to the origin and keeps its scroll position', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings/drivers/2026',
        surfaceSize: const Size(390, 600),
        standings: FakeStandingsRepository(
          drivers: (int season) => driverStandingsFixture(season: season),
        ),
      );
      final Finder list = find
          .descendant(
            of: find.byType(StandingsScreen),
            matching: find.byType(Scrollable),
          )
          .last;
      await tester.drag(list, const Offset(0, -120));
      await tester.pumpAndSettle();
      final double offset = tester.state<ScrollableState>(list).position.pixels;
      await tester.tap(find.text('Lando Norris').first);
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsNothing);
      expect(tester.state<ScrollableState>(list).position.pixels, offset);
    });

    testWidgets('keyboard: Back, team and standings links by Tab and Enter', (
      WidgetTester tester,
    ) async {
      // Opened from the Drivers' Standings table, as a user would.
      Future<void> openFromStandings() async {
        await _reset(tester);
        await pumpApp(
          tester,
          initialLocation: '/standings/drivers/2026',
          surfaceSize: const Size(390, 2400),
          standings: FakeStandingsRepository(
            drivers: (int season) => driverStandingsFixture(season: season),
          ),
        );
        await tester.tap(find.text('Max Verstappen').first);
        await tester.pumpAndSettle();
        expect(find.byType(DriverDetailScreen), findsOneWidget);
      }

      await openFromStandings();
      _nodeOf(tester, _back).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(FocusManager.instance.primaryFocus, _nodeOf(tester, _teamLink));
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(
        FocusManager.instance.primaryFocus,
        _nodeOf(tester, _standingsLink),
      );
      // Enter on the standings link returns to the same-season table.
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsNothing);
      expect(
        tester.widget<StandingsScreen>(find.byType(StandingsScreen)).season,
        2026,
      );

      // Enter on the team link opens the team.
      await openFromStandings();
      _nodeOf(tester, _teamLink).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);

      // Space on Back pops to the origin.
      await openFromStandings();
      _nodeOf(tester, _back).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsNothing);
      expect(find.byType(StandingsScreen), findsOneWidget);
    });

    testWidgets('focus rings: row geometry on links, per-theme on Back', (
      WidgetTester tester,
    ) async {
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.alwaysTraditional;
      addTearDown(
        () => FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.automatic,
      );
      for (final (AppThemePreference theme, double backOffset)
          in <(AppThemePreference, double)>[
            (AppThemePreference.dark, 3),
            (AppThemePreference.light, 1),
          ]) {
        await _open(tester, theme: theme);
        expect(
          tester.widget<GvPrimerFocusTarget>(_teamLink).geometry,
          GvPrimerFocusGeometry.row,
        );
        expect(
          tester.widget<GvPrimerFocusTarget>(_back).geometry.offset,
          backOffset,
        );
        // Circular ring on the round button (Step 55C.9F).
        expect(tester.widget<GvPrimerFocusTarget>(_back).geometry.radius, 24);
        for (final Finder target in <Finder>[
          _back,
          _teamLink,
          _standingsLink,
        ]) {
          _nodeOf(tester, target).requestFocus();
          // The highlight callback rebuilds the target after the focus frame.
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

  group('participation spans', () {
    testWidgets('every span shows; only the relevant one links, by stable id', (
      WidgetTester tester,
    ) async {
      await _open(tester, profile: _twoSpans);
      expect(find.byType(DriverStintRow), findsNWidgets(2));
      final List<DriverStintRow> rows = tester
          .widgetList<DriverStintRow>(find.byType(DriverStintRow))
          .toList();
      expect(rows[0].onOpen, isNotNull);
      expect(rows[0].linkLabel, 'Open team BWT Alpine Formula One Team');
      expect(rows[0].dividerAbove, isFalse);
      expect(rows[1].onOpen, isNull);
      expect(rows[1].dividerAbove, isTrue);
      // The board shows the relevant span's race number, not the other's.
      expect(
        tester
            .widget<Text>(
              find.byKey(const ValueKey<String>('driver-plate-figure')),
            )
            .data,
        '43',
      );
      expect(find.text('From round\u00A07'), findsOneWidget);
      expect(find.text('Until round\u00A06'), findsOneWidget);
      // One tick: only the link row carries the team colour.
      expect(
        find.byKey(const ValueKey<String>('driver-stint-tick')),
        findsOneWidget,
      );

      await tester.tap(_teamLink);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<ConstructorDetailScreen>(
              find.byType(ConstructorDetailScreen),
            )
            .constructorId,
        'alpine',
      );
    });

    testWidgets('an unresolved team is localized copy, never a link or id', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => driverProfileFixture(
          season: s,
          driverId: id,
          participations: <DriverParticipation>[
            participation(season: s, driverId: id, constructorId: 'ghost-team'),
          ],
        ),
      );
      expect(find.text('Team unavailable'), findsOneWidget);
      expect(find.textContaining('ghost-team'), findsNothing);
      expect(
        tester.widget<DriverStintRow>(find.byType(DriverStintRow)).onOpen,
        isNull,
      );
    });

    testWidgets('the board names its number source (DR-03)', (
      WidgetTester tester,
    ) async {
      // Season race number.
      await _open(tester);
      expect(find.bySemanticsLabel('Race number 1 · VER'), findsOneWidget);
      // No season number: the permanent number, named as such.
      await _open(
        tester,
        profile: (int s, String id) => driverProfileFixture(
          season: s,
          driverId: id,
          participations: <DriverParticipation>[
            participation(
              season: s,
              driverId: id,
              constructorId: 'red-bull',
              teamName: 'Oracle Red Bull Racing',
            ),
          ],
        ),
      );
      expect(
        find.bySemanticsLabel('Permanent number 33 · VER'),
        findsOneWidget,
      );
      // No number and no code: no board at all.
      await _open(
        tester,
        profile: (int s, String id) => driverProfileFixture(
          season: s,
          driverId: id,
          shortCode: null,
          permanentNumber: null,
          participations: <DriverParticipation>[
            participation(season: s, driverId: id, constructorId: 'x'),
          ],
        ),
      );
      expect(
        find.byKey(const ValueKey<String>('driver-plate-board')),
        findsNothing,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('statistics and missing data', () {
    testWidgets('fractional points follow the locale; nothing is invented', (
      WidgetTester tester,
    ) async {
      await _open(tester, locale: const Locale('es'));
      expect(find.text('402,5'), findsOneWidget);
      expect(find.text('Temporada 2026'), findsOneWidget);
      await _open(tester);
      expect(find.text('402.5'), findsOneWidget);
      // Nationality once, in the plate (DRV-01 item 2).
      expect(find.text('Dutch'), findsOneWidget);
      expect(find.text('Nationality'), findsNothing);
    });

    testWidgets('unranked is a word; null is omitted; a zero stays', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => driverProfileFixture(
          season: s,
          driverId: id,
          standing: DriverStanding(season: s, driverId: id, points: 0, wins: 0),
        ),
      );
      final GvPrimerStatStrip strip = tester.widget(
        find.byType(GvPrimerStatStrip),
      );
      expect(strip.style, GvPrimerStatStripStyle.driver);
      expect(strip.stats.first.value, 'Unranked');
      expect(strip.stats.first.kind, GvPrimerStatKind.word);
      expect(strip.stats.last.value, '0');
      expect(find.textContaining('Wins', findRichText: true), findsOneWidget);
      expect(find.textContaining('Podiums', findRichText: true), findsNothing);
    });

    testWidgets('a provisional standing shows the known chip', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => driverProfileFixture(
          season: s,
          driverId: id,
          standing: DriverStanding(
            season: s,
            driverId: id,
            position: 3,
            points: 10,
            provisional: true,
          ),
        ),
      );
      final GvPrimerStatusChip chip = tester.widget(
        find.byType(GvPrimerStatusChip),
      );
      expect(chip.label, 'Provisional');
      expect(chip.kind, GvPrimerChipKind.known);
    });

    testWidgets('missing optional facts hide their sections entirely', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => driverProfileFixture(
          season: s,
          driverId: id,
          biography: '   ',
          dateOfBirth: null,
          placeOfBirth: null,
          nationality: null,
          permanentNumber: null,
          withStanding: false,
        ),
      );
      expect(find.text('Profile'), findsNothing);
      expect(find.text('About'), findsNothing);
      expect(find.text('Championship'), findsNothing);
      expect(find.byType(GvPrimerFactGrid), findsNothing);
      expect(
        find.byKey(const ValueKey<String>('driver-plate-nationality')),
        findsNothing,
      );
      expect(find.text('Season participation'), findsOneWidget);
    });
  });

  group('states and notices', () {
    test('notices: failure → stale → incomplete, N-2 for failure + stale', () {
      final AppLocalizationsEn l10n = AppLocalizationsEn();
      EntityDetailReady<Object?> ready({
        bool materialized = true,
        bool stale = false,
        bool failed = false,
        bool unavailable = false,
      }) => EntityDetailReady<Object?>(
        profile: null,
        season: 2026,
        materialized: materialized,
        freshness: stale ? FreshnessState.stale : FreshnessState.fresh,
        refreshError: failed
            ? const EntityDetailFailure.resource(
                ApiFailure(kind: ApiFailureKind.networkUnavailable),
              )
            : null,
        detailUnavailable: unavailable,
      );
      expect(driverDetailNotices(ready(), l10n), isEmpty);
      expect(driverDetailNotices(ready(failed: true), l10n), <DriverNoticeSpec>[
        DriverNoticeSpec(GvPrimerNoticeCause.failure, l10n.detailUpdateFailed),
      ]);
      expect(driverDetailNotices(ready(stale: true), l10n), <DriverNoticeSpec>[
        DriverNoticeSpec(GvPrimerNoticeCause.stale, l10n.detailCachedNotice),
      ]);
      expect(
        driverDetailNotices(ready(stale: true, failed: true), l10n),
        <DriverNoticeSpec>[
          DriverNoticeSpec(
            GvPrimerNoticeCause.failure,
            l10n.refreshFailedStaleNotice,
          ),
        ],
      );
      expect(
        driverDetailNotices(ready(materialized: false, failed: true), l10n),
        <DriverNoticeSpec>[
          DriverNoticeSpec(
            GvPrimerNoticeCause.failure,
            l10n.detailUpdateFailed,
          ),
          DriverNoticeSpec(
            GvPrimerNoticeCause.incomplete,
            l10n.detailPartialNotice,
          ),
        ],
      );
      expect(
        driverDetailNotices(ready(unavailable: true), l10n),
        <DriverNoticeSpec>[
          DriverNoticeSpec(
            GvPrimerNoticeCause.incomplete,
            l10n.detailPartialNotice,
          ),
        ],
      );
    });

    testWidgets('a failed refresh keeps the cached profile under its notice', (
      WidgetTester tester,
    ) async {
      await _open(tester, refresh: _offline);
      expect(_notices(tester).map((GvPrimerNotice n) => n.message), <String>[
        'Update failed',
      ]);
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(find.byType(GvPrimerStatStrip), findsOneWidget);
    });

    testWidgets('stale + failure combine; failure never hides partial', (
      WidgetTester tester,
    ) async {
      await _open(tester, metadata: _stale, refresh: _offline);
      expect(_notices(tester).map((GvPrimerNotice n) => n.message), <String>[
        "Couldn't refresh. Saved data may be out of date.",
      ]);
      await _open(
        tester,
        profile: (int s, String id) =>
            partialDriverProfileFixture(season: s, driverId: id),
        metadata: _never,
        refresh: _offline,
      );
      expect(
        _notices(tester).map((GvPrimerNotice n) => n.cause),
        <GvPrimerNoticeCause>[
          GvPrimerNoticeCause.failure,
          GvPrimerNoticeCause.incomplete,
        ],
      );
      await _open(tester, metadata: _stale);
      expect(_notices(tester).single.cause, GvPrimerNoticeCause.stale);
    });

    testWidgets('loading is one static skeleton, announced once', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profileStream: (int s, String id) =>
            const Stream<DriverProfile?>.empty(),
        disableAnimations: true,
      );
      expect(find.byType(DriverDetailSkeleton), findsOneWidget);
      expect(find.bySemanticsLabel('Loading'), findsOneWidget);
      expect(tester.getSize(find.byType(GvPrimerSkeleton).first).width, 390);
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('full-page states keep the app bar and offer retry', (
      WidgetTester tester,
    ) async {
      final FakeDriverRepository drivers = FakeDriverRepository(
        onRefreshDetail: _offline,
      );
      final GoRouter router = await pumpApp(
        tester,
        surfaceSize: const Size(320, 693),
        textScale: 2,
        drivers: drivers,
      );
      unawaited(router.push('/drivers/someone'));
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailAppBar), findsOneWidget);
      expect(find.text("Can't load this profile"), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.byType(GvPrimerButton));
      await tester.pumpAndSettle();
      expect(drivers.detailRefreshCount, 2);

      await _reset(tester);
      await pumpApp(
        tester,
        initialLocation: _driver,
        currentSeason: null,
        surfaceSize: const Size(390, 844),
      );
      expect(find.text('Season unavailable'), findsOneWidget);
      expect(find.byType(GvPrimerButton), findsOneWidget);
    });
  });

  group('media', () {
    Finder portraitIcon() => find.byWidgetPredicate(
      (Widget w) => w is Icon && w.icon == Icons.person_outline,
    );

    /// The plate's scrim over a portrait (`.dp__media::after`).
    Finder scrim() => find.descendant(
      of: find.byKey(const ValueKey<String>('driver-plate')),
      matching: find.byWidgetPredicate(
        (Widget w) =>
            w is DecoratedBox &&
            w.decoration is BoxDecoration &&
            (w.decoration as BoxDecoration).gradient is LinearGradient &&
            ((w.decoration as BoxDecoration).gradient! as LinearGradient)
                    .stops
                    ?.length ==
                3,
      ),
    );

    testWidgets('absent, pending and failed media: no icon, plate unmoved', (
      WidgetTester tester,
    ) async {
      Future<Rect> plate({bool media = false, MediaImageLoader? loader}) async {
        await _open(
          tester,
          profile: media ? _withMedia : null,
          mediaLoader: loader,
        );
        return tester.getRect(
          find.byKey(const ValueKey<String>('driver-plate')),
        );
      }

      final Rect none = await plate();
      expect(
        find.byKey(const ValueKey<String>('driver-plate-portrait')),
        findsNothing,
      );
      expect(scrim(), findsNothing);

      final Rect pending = await plate(media: true);
      expect(find.byKey(GvRemoteImage.pendingPlaceholderKey), findsOneWidget);
      expect(pending, none);

      final FakeMediaImageLoader loader = FakeMediaImageLoader();
      final Rect failed = await plate(media: true, loader: loader);
      expect(find.byKey(GvRemoteImage.failedPlaceholderKey), findsOneWidget);
      expect(failed, none);
      expect(loader.fetches, hasLength(1));

      // XS-15: no placeholder and no person icon in any of the three states.
      for (final (bool media, MediaImageLoader? l)
          in <(bool, MediaImageLoader?)>[
            (false, null),
            (true, null),
            (true, FakeMediaImageLoader()),
          ]) {
        await plate(media: media, loader: l);
        expect(find.byType(GvImagePlaceholder), findsNothing);
        expect(portraitIcon(), findsNothing);
      }
      // Decorative: no image node, no identifier on screen.
      expect(find.textContaining('portrait-v1'), findsNothing);
    });

    testWidgets('a loaded portrait fades in under the scrim with no flash', (
      WidgetTester tester,
    ) async {
      final Directory tmp = Directory.systemTemp.createTempSync('gv_dd_media');
      addTearDown(() => tmp.deleteSync(recursive: true));
      final File png = writePng(tmp, 'portrait.png', bandedPng(32, 32));

      // The request the plate resolves (no loader: nothing is fetched).
      final Rect none = await (() async {
        await _open(tester);
        return tester.getRect(
          find.byKey(const ValueKey<String>('driver-plate')),
        );
      })();
      await _open(tester, profile: _withMedia);
      final String key = tester
          .widget<GvRemoteImage>(
            find.byKey(const ValueKey<String>('driver-plate-portrait')),
          )
          .request!
          .cacheKey;

      await _reset(tester);
      final GoRouter router = await pumpApp(
        tester,
        surfaceSize: const Size(390, 2400),
        mediaLoader: FakeMediaImageLoader(
          loadedFiles: <String, File>{key: png},
        ),
        drivers: FakeDriverRepository(profile: _withMedia),
      );
      unawaited(router.push(_driver));
      // Every frame until settled: never a placeholder or an icon.
      for (int i = 0; i < 30; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(find.byType(GvImagePlaceholder), findsNothing);
        expect(portraitIcon(), findsNothing);
      }
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byKey(const ValueKey<String>('driver-plate-portrait')),
          matching: find.byType(Image),
        ),
        findsOneWidget,
      );
      expect(scrim(), findsOneWidget);
      expect(
        tester.getRect(find.byKey(const ValueKey<String>('driver-plate'))),
        none,
      );
    });
  });

  group('accessibility', () {
    testWidgets('reading order: heading, season, nationality, board', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester);
      final List<String> labels = _traversal(
        tester.getSemantics(find.byKey(const ValueKey<String>('driver-plate'))),
      );
      expect(labels, <String>[
        'Max Verstappen',
        '2026 season',
        'Nationality: Dutch',
        'Race number 1 · VER',
      ]);
      expect(
        tester.getSemantics(find.text('Max Verstappen')),
        isSemantics(isHeader: true),
      );
      expect(
        tester.getSemantics(find.text('Season participation')),
        isSemantics(isHeader: true),
      );
      handle.dispose();
    });

    testWidgets('links and Back carry useful names and roles', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester);
      expect(
        tester.getSemantics(
          find.bySemanticsLabel('Open team Oracle Red Bull Racing'),
        ),
        isSemantics(isLink: true, hasTapAction: true),
      );
      expect(
        tester.getSemantics(find.bySemanticsLabel("View drivers' standings")),
        isSemantics(isLink: true, hasTapAction: true),
      );
      expect(
        tester.getSemantics(find.bySemanticsLabel('Back')),
        isSemantics(isButton: true, hasTapAction: true),
      );
      expect(find.byTooltip('Back'), findsOneWidget);
      // The team name is said once, inside the link label.
      expect(find.bySemanticsLabel('Oracle Red Bull Racing'), findsNothing);
      // Hidden participation terms are read with their values.
      expect(
        find.bySemanticsLabel(RegExp(r'^Participation\nFrom season start$')),
        findsOneWidget,
      );
      handle.dispose();
    });

    testWidgets('interaction targets meet 48dp', (WidgetTester tester) async {
      await _open(tester, size: const Size(320, 2400), textScale: 2);
      expect(tester.getSize(_back), const Size(48, 48));
      expect(tester.getSize(_teamLink).height, greaterThanOrEqualTo(72));
      expect(tester.getSize(_standingsLink).height, greaterThanOrEqualTo(56));
      expect(tester.getSize(_teamLink).width, 320);
    });

    testWidgets('system insets: the bar clears the top, the end the bottom', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        surfaceSize: const Size(390, 844),
        padding: const EdgeInsets.only(top: 24, bottom: 48),
      );
      unawaited(router.push(_driver));
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.byType(DriverDetailAppBar)).dy, 24);
      final ListView list = tester.widget(
        find.byKey(const ValueKey<String>('driver-detail-list')),
      );
      expect((list.padding! as EdgeInsets).bottom, 32 + 48);
    });
  });
}
