import 'dart:ui' as ui;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/dev/catalogue/primer_catalogue_rows.dart';

import '../support/contrast.dart';
import '../support/primer_fonts.dart';
import '../support/ring_probe.dart';

/// Step 55B.3: the shared Primer V2 editorial rows (GP results, Standings,
/// Calendar). Widget-level checks in the flutter_tester engine; no device or
/// TalkBack claim.

const Size _en390 = Size(390, 844);
const Size _es320 = Size(320, 693);

Future<void> pumpRows(
  WidgetTester tester,
  Widget child, {
  GvPrimerRoles? roles,
  Size size = _en390,
  double scale = 1,
  GlobalKey? boundary,
}) async {
  final GvPrimerRoles r = roles ?? GvPrimerRoles.dark;
  await loadArchivo(tester);
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(const SizedBox());
  await tester.pumpWidget(
    RepaintBoundary(
      key: boundary,
      child: MaterialApp(
        theme: r.brightness == Brightness.dark
            ? buildGridViewDarkTheme()
            : buildGridViewLightTheme(),
        themeAnimationDuration: Duration.zero,
        home: Builder(
          builder: (BuildContext context) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: TextScaler.linear(scale),
              disableAnimations: true,
            ),
            child: GvPrimerSurface(
              kind: GvPrimerSurfaceKind.page,
              roles: r,
              child: Scaffold(
                backgroundColor: r.surface.page,
                body: ListView(children: <Widget>[child]),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

Finder targetIn(Type rowType, {int row = 0, int target = 0}) => find
    .descendant(
      of: find.byType(rowType).at(row),
      matching: find.byType(GvPrimerFocusTarget),
    )
    .at(target);

GvPrimerFocusRingPainter ringOf(WidgetTester tester, Finder target) => tester
    .widgetList<CustomPaint>(
      find.descendant(of: target, matching: find.byType(CustomPaint)),
    )
    .map((CustomPaint p) => p.foregroundPainter)
    .whereType<GvPrimerFocusRingPainter>()
    .first;

Color? fillOf(WidgetTester tester, Finder target) =>
    (tester
                .widget<DecoratedBox>(
                  find
                      .descendant(
                        of: target,
                        matching: find.byType(DecoratedBox),
                      )
                      .first,
                )
                .decoration
            as BoxDecoration)
        .color;

FocusNode nodeOf(WidgetTester tester, Finder target) => Focus.of(
  tester.element(
    find.descendant(of: target, matching: find.byType(GestureDetector)).first,
  ),
);

Future<void> tabTo(WidgetTester tester, Finder target) async {
  final FocusNode node = nodeOf(tester, target);
  for (int i = 0; i < 60 && !node.hasPrimaryFocus; i++) {
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
  }
  expect(node.hasPrimaryFocus, isTrue);
}

GvPrimerStatusChip chipLabelled(WidgetTester tester, String label) => tester
    .widgetList<GvPrimerStatusChip>(find.byType(GvPrimerStatusChip))
    .firstWhere((GvPrimerStatusChip c) => c.label == label);

GvPrimerOutline outlineOf(WidgetTester tester, String label) => tester
    .widgetList<CustomPaint>(
      find.descendant(
        of: find.byWidgetPredicate(
          (Widget w) => w is GvPrimerStatusChip && w.label == label,
        ),
        matching: find.byType(CustomPaint),
      ),
    )
    .map((CustomPaint p) => p.foregroundPainter)
    .whereType<GvPrimerOutlinePainter>()
    .first
    .outline;

GvPrimerResultRow resultRow({
  bool winner = false,
  String? team = 'Red Bull Racing',
  String? points = '25',
  String? timing = '1:15:12.345',
  List<GvPrimerStatusLabel> statuses = const <GvPrimerStatusLabel>[],
  VoidCallback? onOpen,
  VoidCallback? onOpenTeam,
  String driver = 'Max Verstappen',
}) => GvPrimerResultRow(
  position: winner ? '1' : '2',
  driverName: driver,
  winner: winner,
  winnerLabel: winner ? 'Winner' : null,
  teamName: team,
  teamSemanticLabel: team == null ? null : 'Open team $team',
  onOpenTeam: onOpenTeam ?? () {},
  points: points,
  pointsUnit: 'pts',
  timing: timing,
  statuses: statuses,
  semanticLabel: '1, $driver, Red Bull Racing, Finished, 25 Points',
  onOpen: onOpen ?? () {},
  dividerAbove: false,
);

void main() {
  group('GP result row', () {
    testWidgets('winner: kicker, brand-gradient rail with the 12° cut', (
      WidgetTester tester,
    ) async {
      await pumpRows(tester, resultRow(winner: true));
      expect(find.text('Winner'), findsOneWidget);
      final GvPrimerRailCellPainter rail = tester
          .widgetList<CustomPaint>(find.byType(CustomPaint))
          .map((CustomPaint p) => p.painter)
          .whereType<GvPrimerRailCellPainter>()
          .single;
      expect(rail.winner, isTrue);
      final Text position = tester.widget<Text>(find.text('1'));
      expect(position.style!.color, GvPrimerRoles.dark.fill.brand.on);
      // A classified row keeps the band cell and primary figure.
      await pumpRows(tester, resultRow());
      expect(find.text('Winner'), findsNothing);
      expect(
        tester
            .widgetList<CustomPaint>(find.byType(CustomPaint))
            .map((CustomPaint p) => p.painter)
            .whereType<GvPrimerRailCellPainter>()
            .single
            .winner,
        isFalse,
      );
    });

    testWidgets('finish words: solid known chips; an unknown finish is '
        'dashed (VS-1)', (WidgetTester tester) async {
      await pumpRows(tester, const PrimerResultRowsSpecimen());
      for (final String word in <String>['DNF', 'DNS', 'DSQ', 'DNQ']) {
        expect(chipLabelled(tester, word).kind, GvPrimerChipKind.known);
        expect(chipLabelled(tester, word).size, GvPrimerChipSize.small);
        expect(outlineOf(tester, word).dashed, isFalse);
      }
      expect(chipLabelled(tester, 'Lapped').kind, GvPrimerChipKind.known);
      expect(find.text('+2 laps'), findsOneWidget);
      expect(
        chipLabelled(tester, 'Status unknown').kind,
        GvPrimerChipKind.unknown,
      );
      expect(outlineOf(tester, 'Status unknown').dashed, isTrue);
    });

    testWidgets('missing data: no false zero, no team line, still a 48px '
        'target', (WidgetTester tester) async {
      await pumpRows(tester, resultRow(team: null, points: null, timing: null));
      expect(find.text('0'), findsNothing);
      expect(find.text('pts'), findsNothing);
      expect(
        find.descendant(
          of: find.byType(GvPrimerResultRow),
          matching: find.byType(GvPrimerFocusTarget),
        ),
        findsOneWidget,
      );
      expect(
        tester.getSize(find.byType(GvPrimerResultRow)).height,
        greaterThanOrEqualTo(48),
      );
    });

    testWidgets('unresolved names render as the italic fallback', (
      WidgetTester tester,
    ) async {
      await pumpRows(tester, const PrimerResultRowsSpecimen());
      final Text fallback = tester.widget<Text>(
        find.descendant(
          of: find.byType(GvPrimerTrailingChevronText),
          matching: find.text('Team name unavailable'),
        ),
      );
      expect(fallback.style!.fontStyle, FontStyle.italic);
    });

    testWidgets('keyboard: the row then its team link; each ring only on '
        'primary focus; Enter activates', (WidgetTester tester) async {
      int driver = 0;
      int team = 0;
      await pumpRows(
        tester,
        resultRow(onOpen: () => driver++, onOpenTeam: () => team++),
      );
      final Finder row = targetIn(GvPrimerResultRow);
      final Finder link = targetIn(GvPrimerResultRow, target: 1);
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(nodeOf(tester, row).hasPrimaryFocus, isTrue);
      expect(ringOf(tester, row).visible, isTrue);
      expect(ringOf(tester, row).geometry.offset, -3);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      expect(driver, 1);

      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(nodeOf(tester, link).hasPrimaryFocus, isTrue);
      // The enclosing row still "has focus", but shows no ring.
      expect(ringOf(tester, row).visible, isFalse);
      expect(ringOf(tester, link).visible, isTrue);
      expect(ringOf(tester, link).geometry, GvPrimerFocusGeometry.teamLink);
      expect(ringOf(tester, link).color, GvPrimerRoles.dark.focus.onPage);
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      expect(team, 1);
      expect(driver, 1);
    });

    testWidgets('taps: the row opens the driver, the team line only the '
        'team', (WidgetTester tester) async {
      int driver = 0;
      int team = 0;
      await pumpRows(
        tester,
        resultRow(onOpen: () => driver++, onOpenTeam: () => team++),
      );
      await tester.tap(find.text('Max Verstappen'));
      await tester.tap(find.text('25 pts', findRichText: true));
      expect(driver, 2);
      await tester.tap(find.text('Red Bull Racing'));
      expect(team, 1);
      expect(driver, 2);
    });

    testWidgets('pressed (XT-5): the row presses to state.pressed.row; a '
        'press on the team link presses only the link', (
      WidgetTester tester,
    ) async {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[
        GvPrimerRoles.dark,
        GvPrimerRoles.light,
      ]) {
        await pumpRows(tester, resultRow(), roles: roles);
        final Finder row = targetIn(GvPrimerResultRow);
        final Finder link = targetIn(GvPrimerResultRow, target: 1);
        final Size before = tester.getSize(row);
        TestGesture g = await tester.startGesture(
          tester.getCenter(find.text('Max Verstappen')),
        );
        await tester.pump(kPressTimeout + const Duration(milliseconds: 10));
        expect(fillOf(tester, row), roles.state.pressedRow);
        expect(tester.getSize(row), before);
        expect(ringOf(tester, row).visible, isFalse);
        await g.up();
        await tester.pump();
        expect(fillOf(tester, row), isNull);

        g = await tester.startGesture(
          tester.getCenter(find.text('Red Bull Racing')),
        );
        await tester.pump(kPressTimeout + const Duration(milliseconds: 10));
        expect(fillOf(tester, row), isNull);
        expect(fillOf(tester, link), roles.state.pressedControl);
        await g.up();
        await tester.pump();
      }
    });

    testWidgets('semantics: one labelled link per row and per team link; '
        'visible text is not read twice', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpRows(tester, resultRow(winner: true));
      expect(
        find.bySemanticsLabel(
          '1, Max Verstappen, Red Bull Racing, Finished, '
          '25 Points',
        ),
        findsOneWidget,
      );
      expect(
        find.bySemanticsLabel('Open team Red Bull Racing'),
        findsOneWidget,
      );
      expect(find.bySemanticsLabel('Max Verstappen'), findsNothing);
      expect(find.bySemanticsLabel('Winner'), findsNothing);
      final SemanticsNode node = tester.getSemantics(
        targetIn(GvPrimerResultRow),
      );
      expect(node.flagsCollection.isLink, isTrue);
      handle.dispose();
    });

    testWidgets('winner ring crosses the gradient cell: Chalk in Dark, '
        'Graphite with the page backing in Light (DK-3, LT-5)', (
      WidgetTester tester,
    ) async {
      await pumpRows(tester, resultRow(winner: true));
      await tabTo(tester, targetIn(GvPrimerResultRow));
      GvPrimerFocusRingPainter ring = ringOf(
        tester,
        targetIn(GvPrimerResultRow),
      );
      expect(ring.color, GvPrimerRoles.dark.focus.onBrand);
      expect(ring.backing, isNull);

      await pumpRows(
        tester,
        resultRow(winner: true),
        roles: GvPrimerRoles.light,
      );
      await tabTo(tester, targetIn(GvPrimerResultRow));
      ring = ringOf(tester, targetIn(GvPrimerResultRow));
      expect(ring.color, GvPrimerRoles.light.focus.onPage);
      expect(ring.backing, GvPrimerRoles.light.surface.page);
    });

    testWidgets('narrow at or below 21em: values move under the name', (
      WidgetTester tester,
    ) async {
      await pumpRows(tester, resultRow());
      final Rect name = tester.getRect(find.text('Max Verstappen'));
      final Rect pts = tester.getRect(find.text('25 pts', findRichText: true));
      expect(pts.top, lessThan(name.bottom));
      expect(pts.left, greaterThan(name.right));

      await pumpRows(tester, resultRow(), size: _es320, scale: 2);
      final Rect name2 = tester.getRect(find.text('Max Verstappen'));
      final Rect pts2 = tester.getRect(find.text('25 pts', findRichText: true));
      expect(pts2.top, greaterThan(name2.bottom));
      expect(pts2.left, closeTo(name2.left, 0.5));
    });

    testWidgets('the team chevron stays with the last word', (
      WidgetTester tester,
    ) async {
      await pumpRows(
        tester,
        const PrimerResultRowsSpecimen(spanish: true, states: false),
        size: _es320,
        scale: 2,
      );
      final Finder chevronText = find.byType(GvPrimerTrailingChevronText).first;
      final Text text = tester.widget<Text>(
        find.descendant(of: chevronText, matching: find.byType(Text)),
      );
      // "Red Bull Racing" + chevron does not fit: "Racing" moves down with it.
      expect(text.data, 'Red Bull\nRacing');
      final Rect chevron = tester.getRect(
        find
            .descendant(
              of: chevronText,
              matching: find.byType(GvPrimerRowChevron),
            )
            .first,
      );
      final Rect box = tester.getRect(chevronText);
      expect(chevron.center.dy, greaterThan(box.center.dy));
      expect(chevron.right, lessThanOrEqualTo(box.right + 0.01));
      expect(chevron.width, 16);
    });
  });

  group('Standings row', () {
    GvPrimerStandingsRow leader({String label = 'Championship leader'}) =>
        GvPrimerStandingsRow(
          position: '1',
          name: 'Lando Norris',
          leaderLabel: label,
          details: const <String>['McLaren', '3 wins'],
          points: '120',
          pointsUnit: 'pts',
          semanticLabel: 'Position 1, Lando Norris, McLaren, 120 points',
          onOpen: () {},
        );

    testWidgets('leader card: inverse plane, accent figure, Red Oxide seam, '
        'ring 2px outside in the page focus colour', (
      WidgetTester tester,
    ) async {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[
        GvPrimerRoles.dark,
        GvPrimerRoles.light,
      ]) {
        await pumpRows(tester, leader(), roles: roles);
        final GvPrimerSurface scope = tester.widget<GvPrimerSurface>(
          find.descendant(
            of: find.byType(GvPrimerStandingsRow),
            matching: find.byType(GvPrimerSurface),
          ),
        );
        expect(scope.kind, GvPrimerSurfaceKind.inverse);
        final GvPrimerRoles plane = roles.forScope(GvPrimerScope.inverse);
        expect(
          tester.widget<Text>(find.text('1')).style!.color,
          plane.text.accent,
        );
        expect(
          tester.widget<Text>(find.text('Lando Norris')).style!.color,
          plane.text.primary,
        );
        final GvPrimerLeaderSeamPainter seam = tester
            .widgetList<CustomPaint>(find.byType(CustomPaint))
            .map((CustomPaint p) => p.painter)
            .whereType<GvPrimerLeaderSeamPainter>()
            .single;
        expect(seam.color, GvPrimerPalette.oxide600);
        expect(find.text('pts'), findsOneWidget);
        final Finder target = targetIn(GvPrimerStandingsRow);
        await tabTo(tester, target);
        final GvPrimerFocusRingPainter ring = ringOf(tester, target);
        expect(ring.color, roles.focus.onPage);
        expect(ring.geometry.offset, 2);
        expect(ring.geometry.radius, 14);
      }
    });

    testWidgets('ordinary and unranked rows: no leader treatment, no unit', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpRows(
        tester,
        GvPrimerStandingsRow(
          position: '—',
          name: 'Unranked Top',
          points: '999',
          pointsUnit: 'pts',
          semanticLabel: 'Unranked, Unranked Top, 999 points',
          onOpen: () {},
        ),
      );
      expect(
        find.descendant(
          of: find.byType(GvPrimerStandingsRow),
          matching: find.byType(GvPrimerSurface),
        ),
        findsNothing,
      );
      expect(find.text('pts'), findsNothing);
      expect(find.text('999'), findsOneWidget);
      expect(
        tester.widget<Text>(find.text('—')).style!.color,
        GvPrimerRoles.dark.text.secondary,
      );
      expect(
        find.bySemanticsLabel('Unranked, Unranked Top, 999 points'),
        findsOneWidget,
      );
      expect(find.bySemanticsLabel(RegExp('unavailable')), findsNothing);
      handle.dispose();
    });

    testWidgets('tied leaders: each a card; the second has no top margin', (
      WidgetTester tester,
    ) async {
      await pumpRows(tester, const PrimerStandingsRowsSpecimen());
      final Iterable<GvPrimerStandingsRow> tied = tester
          .widgetList<GvPrimerStandingsRow>(find.byType(GvPrimerStandingsRow))
          .where(
            (GvPrimerStandingsRow r) =>
                r.leaderLabel == 'Tied for the championship lead',
          );
      expect(tied.length, 2);
      expect(tied.last.followsLeader, isTrue);
      final Rect a = tester.getRect(find.byWidget(tied.first));
      final Rect b = tester.getRect(find.byWidget(tied.last));
      expect(b.top, a.bottom);
    });

    testWidgets('provisional marker: the word only, solid; inverse outline '
        'inside the leader card (VS-3, DK-1)', (WidgetTester tester) async {
      await pumpRows(tester, const PrimerStandingsRowsSpecimen());
      expect(find.textContaining('†'), findsNothing);
      final List<GvPrimerStatusChip> chips = tester
          .widgetList<GvPrimerStatusChip>(find.byType(GvPrimerStatusChip))
          .where((GvPrimerStatusChip c) => c.label == 'Provisional')
          .toList();
      expect(chips, hasLength(2));
      expect(
        chips.every((GvPrimerStatusChip c) => c.kind == GvPrimerChipKind.known),
        isTrue,
      );
      final List<GvPrimerOutline> outlines = tester
          .widgetList<CustomPaint>(
            find.descendant(
              of: find.byWidgetPredicate(
                (Widget w) =>
                    w is GvPrimerStatusChip && w.label == 'Provisional',
              ),
              matching: find.byType(CustomPaint),
            ),
          )
          .map((CustomPaint p) => p.foregroundPainter)
          .whereType<GvPrimerOutlinePainter>()
          .map((GvPrimerOutlinePainter p) => p.outline)
          .toList();
      expect(outlines.first.color, GvPrimerRoles.dark.line.statusInverse);
      expect(outlines.last.color, GvPrimerRoles.dark.line.status);
      expect(outlines.every((GvPrimerOutline o) => !o.dashed), isTrue);
    });

    testWidgets('details parts never split; lines break after " · "', (
      WidgetTester tester,
    ) async {
      await pumpRows(tester, leader(), size: _es320, scale: 2);
      final Text line = tester.widget<Text>(find.textContaining('McLaren'));
      expect(line.data, 'McLaren · 3 wins');
    });

    testWidgets('a part wider than a whole line wraps between its words, '
        'never inside a word (Step 55C.5)', (WidgetTester tester) async {
      // "Red Bull Racing" is wider than the leader card's name column at
      // 320 @200%: kept whole with no-break spaces it could only break
      // inside a word ("Red Bull Racin" / "g").
      await pumpRows(
        tester,
        GvPrimerStandingsRow(
          position: '1',
          name: 'Max Verstappen',
          leaderLabel: 'Líder del campeonato',
          details: const <String>['Red Bull Racing', '6 victorias'],
          points: '241',
          pointsUnit: 'pts',
          semanticLabel: 'Posición 1, Max Verstappen',
          onOpen: () {},
        ),
        size: _es320,
        scale: 2,
      );
      final Finder finder = find.textContaining('Red');
      final String data = tester.widget<Text>(finder).data!;
      // The long team keeps its ordinary spaces; the stat stays whole and the
      // separator stays with the part before it.
      expect(data, 'Red Bull Racing · 6 victorias');
      // The rendered paragraph laid out again at its own width and scale.
      final RenderParagraph paragraph = tester.renderObject(finder);
      final TextPainter painter = TextPainter(
        text: paragraph.text,
        textDirection: TextDirection.ltr,
        textScaler: paragraph.textScaler,
      )..layout(maxWidth: paragraph.size.width);
      addTearDown(painter.dispose);
      final Set<int> ends = <int>{
        for (int i = 0; i < data.length; i++)
          painter.getLineBoundary(TextPosition(offset: i)).end,
      };
      expect(ends.length, greaterThan(1), reason: 'the line must wrap');
      bool space(String c) => c == ' ' || c == ' ';
      for (final int end in ends.where((int e) => e < data.length)) {
        expect(
          space(data[end - 1]) || space(data[end]),
          isTrue,
          reason: 'a line ends inside a word: "${data.substring(0, end)}"',
        );
      }

      // At 100% the same parts fit and stay unbroken.
      await pumpRows(
        tester,
        GvPrimerStandingsRow(
          position: '1',
          name: 'Max Verstappen',
          leaderLabel: 'Championship leader',
          details: const <String>['Red Bull Racing', '6 wins'],
          points: '241',
          semanticLabel: 'Position 1, Max Verstappen',
          onOpen: () {},
        ),
      );
      expect(
        tester.widget<Text>(find.textContaining('Red')).data,
        'Red Bull Racing · 6 wins',
      );
    });

    testWidgets('narrow leader: a total too wide to share the line puts '
        'the unit under the figure, never an overflow (Step 55C.5)', (
      WidgetTester tester,
    ) async {
      GvPrimerStandingsRow card(String points) => GvPrimerStandingsRow(
        position: '1',
        name: 'Lando Norris',
        leaderLabel: 'Championship leader',
        // Layout test data, not a result.
        points: points,
        pointsUnit: 'pts',
        semanticLabel: 'Position 1, Lando Norris',
        onOpen: () {},
      );
      // An ordinary total keeps figure and unit on one baseline.
      await pumpRows(tester, card('120'), size: _es320, scale: 2);
      Rect figure = tester.getRect(find.text('120'));
      Rect unit = tester.getRect(find.text('pts'));
      expect(unit.left, greaterThan(figure.right));
      expect(unit.top, lessThan(figure.bottom));
      // A total wider than the line: the unit wraps below, nothing overflows.
      await pumpRows(tester, card('123456789.25'), size: _es320, scale: 2);
      expect(tester.takeException(), isNull);
      figure = tester.getRect(find.text('123456789.25'));
      unit = tester.getRect(find.text('pts'));
      expect(unit.top, greaterThanOrEqualTo(figure.bottom));
      expect(unit.left, closeTo(figure.left, 0.5));
    });

    testWidgets('narrow at or below 20em: points move under the name', (
      WidgetTester tester,
    ) async {
      await pumpRows(tester, leader());
      Rect name = tester.getRect(find.text('Lando Norris'));
      Rect pts = tester.getRect(find.text('120'));
      expect(pts.left, greaterThan(name.right));
      await pumpRows(tester, leader(), size: _es320, scale: 2);
      name = tester.getRect(find.text('Lando Norris'));
      pts = tester.getRect(find.text('120'));
      expect(pts.top, greaterThan(name.bottom));
    });

    testWidgets('pressed and hover: rows use the row roles; the leader card '
        'flattens to its plane colour', (WidgetTester tester) async {
      await pumpRows(tester, const PrimerStandingsRowsSpecimen(states: false));
      final Finder ordinary = targetIn(GvPrimerStandingsRow, row: 1);
      final TestGesture press = await tester.startGesture(
        tester.getCenter(ordinary),
      );
      await tester.pump(kPressTimeout + const Duration(milliseconds: 10));
      expect(fillOf(tester, ordinary), GvPrimerRoles.dark.state.pressedRow);
      await press.up();
      await tester.pump();

      final TestGesture mouse = await tester.createGesture(
        kind: PointerDeviceKind.mouse,
      );
      await mouse.addPointer(location: Offset.zero);
      addTearDown(mouse.removePointer);
      await mouse.moveTo(tester.getCenter(ordinary));
      await tester.pump();
      expect(fillOf(tester, ordinary), GvPrimerRoles.dark.state.hover);
      final Finder card = targetIn(GvPrimerStandingsRow);
      await mouse.moveTo(tester.getCenter(card));
      await tester.pump();
      expect(fillOf(tester, ordinary), isNull);
      expect(
        fillOf(tester, card),
        GvPrimerRoles.dark.surface.inverse.colors.first,
      );
    });

    test('pressedOverlay: the surface primary text at 6%; equals Light '
        'state.pressed.row; never the Dark tray on the Chalk card', () {
      expect(
        GvPrimerRoles.light.pressedOverlay,
        GvPrimerRoles.light.state.pressedRow,
      );
      final GvPrimerRoles darkPlane = GvPrimerRoles.dark.forScope(
        GvPrimerScope.inverse,
      );
      final GvPrimerRoles lightPlane = GvPrimerRoles.light.forScope(
        GvPrimerScope.inverse,
      );
      expect(
        darkPlane.pressedOverlay,
        GvPrimerPalette.graphite900.withValues(alpha: 0.06),
      );
      expect(
        lightPlane.pressedOverlay,
        GvPrimerPalette.chalk100.withValues(alpha: 0.06),
      );
      expect(
        darkPlane.pressedOverlay,
        isNot(GvPrimerRoles.dark.state.pressedRow),
      );
      // Text stays legible on the pressed plane (both gradient stops).
      for (final (GvPrimerRoles theme, GvPrimerRoles plane)
          in <(GvPrimerRoles, GvPrimerRoles)>[
            (GvPrimerRoles.dark, darkPlane),
            (GvPrimerRoles.light, lightPlane),
          ]) {
        for (final Color stop in theme.surface.inverse.colors) {
          final Color pressed = Color.alphaBlend(plane.pressedOverlay, stop);
          expect(contrastRatio(plane.text.primary, pressed), greaterThan(11));
          expect(
            contrastRatio(plane.text.secondary, pressed),
            greaterThanOrEqualTo(4.5),
          );
          expect(contrastRatio(pressed, stop), greaterThan(1.1));
        }
      }
    });

    testWidgets('leader card pressed: distinct from rest and hover, whole '
        'card, no layout change; the ring stays during a mouse press', (
      WidgetTester tester,
    ) async {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[
        GvPrimerRoles.dark,
        GvPrimerRoles.light,
      ]) {
        for (final (Size size, double scale) in <(Size, double)>[
          (_en390, 1),
          (_es320, 2),
        ]) {
          await pumpRows(
            tester,
            const PrimerStandingsRowsSpecimen(states: false),
            roles: roles,
            size: size,
            scale: scale,
          );
          final Finder card = targetIn(GvPrimerStandingsRow);
          final Rect rest = tester.getRect(card);
          final Rect name = tester.getRect(find.text('Lando Norris'));
          final Color overlay = roles
              .forScope(GvPrimerScope.inverse)
              .pressedOverlay;
          await tabTo(tester, card);
          final TestGesture mouse = await tester.createGesture(
            kind: PointerDeviceKind.mouse,
          );
          await mouse.addPointer(location: rest.center);
          await tester.pump();
          expect(fillOf(tester, card), roles.surface.inverse.colors.first);
          await mouse.down(rest.center);
          await tester.pump(kPressTimeout + const Duration(milliseconds: 10));
          expect(fillOf(tester, card), overlay);
          expect(
            fillOf(tester, card),
            isNot(roles.surface.inverse.colors.first),
          );
          // The fill covers the whole card, with the card's own corners.
          final DecoratedBox box = tester.widget<DecoratedBox>(
            find
                .descendant(of: card, matching: find.byType(DecoratedBox))
                .first,
          );
          expect(tester.getRect(find.byWidget(box)), rest);
          expect(
            (box.decoration as BoxDecoration).borderRadius,
            BorderRadius.circular(14),
          );
          expect(ringOf(tester, card).visible, isTrue);
          expect(tester.getRect(card), rest);
          expect(tester.getRect(find.text('Lando Norris')), name);
          await mouse.up();
          await tester.pump();
          expect(fillOf(tester, card), roles.surface.inverse.colors.first);
          await mouse.removePointer();
          await tester.pump();
        }
      }
    });

    testWidgets('leader card keyboard activation keeps the ring; touch input '
        'returns Flutter to touch highlight mode (ring hidden, like '
        ':focus-visible)', (WidgetTester tester) async {
      int opened = 0;
      await pumpRows(
        tester,
        GvPrimerStandingsRow(
          position: '1',
          name: 'Lando Norris',
          leaderLabel: 'Championship leader',
          points: '120',
          semanticLabel: 'Position 1, Lando Norris, 120 points',
          onOpen: () => opened++,
        ),
      );
      final Finder card = targetIn(GvPrimerStandingsRow);
      await tabTo(tester, card);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(opened, 1);
      expect(ringOf(tester, card).visible, isTrue);
      final TestGesture touch = await tester.startGesture(
        tester.getCenter(card),
      );
      await tester.pump(kPressTimeout + const Duration(milliseconds: 10));
      expect(ringOf(tester, card).visible, isFalse);
      await touch.up();
      await tester.pump();
      expect(opened, 2);
    });

    testWidgets('leader card touch press: pressed fill, then rest; a tap '
        'activates once', (WidgetTester tester) async {
      int opened = 0;
      await pumpRows(
        tester,
        GvPrimerStandingsRow(
          position: '1',
          name: 'Lando Norris',
          leaderLabel: 'Championship leader',
          points: '120',
          pointsUnit: 'pts',
          semanticLabel: 'Position 1, Lando Norris, 120 points',
          onOpen: () => opened++,
        ),
      );
      final Finder card = targetIn(GvPrimerStandingsRow);
      final TestGesture touch = await tester.startGesture(
        tester.getCenter(card),
      );
      await tester.pump(kPressTimeout + const Duration(milliseconds: 10));
      expect(
        fillOf(tester, card),
        GvPrimerRoles.dark.forScope(GvPrimerScope.inverse).pressedOverlay,
      );
      await touch.up();
      await tester.pump();
      expect(fillOf(tester, card), isNull);
      expect(opened, 1);
    });
  });

  group('Calendar race row', () {
    testWidgets('completed row: full opacity with the solid check chip '
        '(XT-2)', (WidgetTester tester) async {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[
        GvPrimerRoles.dark,
        GvPrimerRoles.light,
      ]) {
        await pumpRows(
          tester,
          const PrimerRaceRowsSpecimen(states: false),
          roles: roles,
        );
        expect(
          find.descendant(
            of: find.byType(GvPrimerRaceRow),
            matching: find.byType(Opacity),
          ),
          findsNothing,
        );
        expect(
          find.descendant(
            of: find.byType(GvPrimerRaceRow),
            matching: find.byType(FadeTransition),
          ),
          findsNothing,
        );
        expect(
          chipLabelled(tester, 'Completed').kind,
          GvPrimerChipKind.completed,
        );
        expect(outlineOf(tester, 'Completed').dashed, isFalse);
        expect(outlineOf(tester, 'Completed').color, roles.line.status);
        expect(
          tester.widget<Text>(find.text('Italian Grand Prix')).style!.color,
          roles.text.primary,
        );
      }
    });

    testWidgets('status vocabulary: unknown dashed, upcoming solid, '
        'cancelled alert', (WidgetTester tester) async {
      await pumpRows(tester, const PrimerRaceRowsSpecimen());
      expect(outlineOf(tester, 'Status unknown').dashed, isTrue);
      expect(
        chipLabelled(tester, 'Status unknown').size,
        GvPrimerChipSize.compact,
      );
      expect(outlineOf(tester, 'Upcoming').dashed, isFalse);
      expect(
        chipLabelled(tester, 'Cancelled').kind,
        GvPrimerChipKind.cancelled,
      );
    });

    testWidgets('next event: flat oxide block with the 12° edge, kicker and '
        'disc; ring Chalk in Dark, Graphite with band backing in Light', (
      WidgetTester tester,
    ) async {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[
        GvPrimerRoles.dark,
        GvPrimerRoles.light,
      ]) {
        await pumpRows(
          tester,
          const PrimerRaceRowsSpecimen(states: false),
          roles: roles,
        );
        expect(find.text('Next'), findsOneWidget);
        final GvPrimerRoundBlockPainter block = tester
            .widgetList<CustomPaint>(find.byType(CustomPaint))
            .map((CustomPaint p) => p.painter)
            .whereType<GvPrimerRoundBlockPainter>()
            .single;
        expect(block.color, GvPrimerPalette.oxide600);
        final Rect r = const Rect.fromLTWH(0, 0, 80, 68);
        final Rect bounds = GvPrimerRoundBlockPainter.blockPath(r).getBounds();
        expect(bounds.right, closeTo(80 + 68 * GvLiveryCut.slope, 1e-3));
        final Finder target = targetIn(GvPrimerRaceRow, row: 4);
        await tabTo(tester, target);
        final GvPrimerFocusRingPainter ring = ringOf(tester, target);
        if (roles.brightness == Brightness.dark) {
          expect(ring.color, GvPrimerPalette.chalk100);
          expect(ring.backing, isNull);
        } else {
          expect(ring.color, GvPrimerPalette.graphite900);
          expect(ring.backing, roles.surface.band);
        }
      }
    });

    testWidgets('next-event ring: 100% visible, ≥ 3:1 against adjacent '
        'pixels (Dark, rendered)', (WidgetTester tester) async {
      final GlobalKey key = GlobalKey();
      await pumpRows(
        tester,
        const PrimerRaceRowsSpecimen(states: false),
        boundary: key,
      );
      final Finder target = targetIn(GvPrimerRaceRow, row: 4);
      await tabTo(tester, target);
      final GvPrimerFocusRingPainter ring = ringOf(tester, target);
      final Rect bounds = tester.getRect(
        find
            .descendant(of: target, matching: find.byType(GvPrimerFocusRing))
            .first,
      );
      late ui.Image image;
      late ByteData bytes;
      await tester.runAsync(() async {
        image =
            await (key.currentContext!.findRenderObject()!
                    as RenderRepaintBoundary)
                .toImage(pixelRatio: 2);
        bytes = (await image.toByteData(format: ui.ImageByteFormat.rawRgba))!;
      });
      final RingVisibility v = probeRing(
        bytes: bytes,
        imageWidth: image.width,
        imageHeight: image.height,
        pixelRatio: 2,
        ringCentre: ring.geometry.ringPath(bounds),
        ring: ring.color,
      );
      image.dispose();
      expect(v.fraction, 1);
      expect(v.minContrast, greaterThanOrEqualTo(3));
    });

    testWidgets('number column min(4rem, 68px); hairline from the name '
        'column, from the gutter when narrow', (WidgetTester tester) async {
      await pumpRows(tester, const PrimerRaceRowsSpecimen(states: false));
      expect(GvPrimerRaceRow.numberColumn(TextScaler.noScaling), 64);
      expect(GvPrimerRaceRow.numberColumn(const TextScaler.linear(2)), 68);
      final GvPrimerRowDivider divider = tester.widget<GvPrimerRowDivider>(
        find.byType(GvPrimerRowDivider).first,
      );
      expect(divider.start, 16 + 64 + 16);
      final Rect number = tester.getRect(find.text('20'));
      final Rect name = tester.getRect(find.text('São Paulo Grand Prix'));
      expect(number.top, lessThan(name.bottom));

      await pumpRows(
        tester,
        const PrimerRaceRowsSpecimen(spanish: true, states: false),
        size: _es320,
        scale: 2,
      );
      expect(
        tester
            .widget<GvPrimerRowDivider>(find.byType(GvPrimerRowDivider).first)
            .start,
        16,
      );
      final Rect number2 = tester.getRect(find.text('20'));
      final Rect name2 = tester.getRect(find.text('São Paulo Grand Prix'));
      expect(number2.bottom, lessThanOrEqualTo(name2.top));
    });
  });

  group('shared', () {
    for (final (String name, Size size, double scale, bool es)
        in <(String, Size, double, bool)>[
          ('EN 390 @100%', _en390, 1, false),
          ('ES 320 @200%', _es320, 2, true),
        ]) {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[
        GvPrimerRoles.dark,
        GvPrimerRoles.light,
      ]) {
        testWidgets('every specimen lays out unclipped, no overflow: $name, '
            '${roles.brightness.name}', (WidgetTester tester) async {
          await pumpRows(
            tester,
            PrimerEditorialRowsSection(spanish: es),
            roles: roles,
            size: size,
            scale: scale,
          );
          expect(tester.takeException(), isNull);
          for (final RenderParagraph p
              in tester.allRenderObjects.whereType<RenderParagraph>()) {
            expect(p.didExceedMaxLines, isFalse);
            final Rect rect = MatrixUtils.transformRect(
              p.getTransformTo(null),
              Offset.zero & p.size,
            );
            expect(rect.left, greaterThanOrEqualTo(-0.5));
            expect(rect.right, lessThanOrEqualTo(size.width + 0.5));
          }
          // Every row and team link keeps a ≥ 48×48 target.
          for (final Element e in find.byType(GvPrimerFocusTarget).evaluate()) {
            final Size target = tester.getSize(
              find.byElementPredicate((Element x) => x == e),
            );
            expect(target.width, greaterThanOrEqualTo(48));
            expect(target.height, greaterThanOrEqualTo(48));
          }
        });
      }
    }

    test('focus geometries follow each component (offset, radius)', () {
      expect(GvPrimerFocusGeometry.row.offset, -3);
      expect(GvPrimerFocusGeometry.row.radius, 4);
      expect(GvPrimerFocusGeometry.teamLink.offset, -2);
      expect(GvPrimerFocusGeometry.teamLink.radius, 8);
      expect(GvPrimerFocusGeometry.leaderRow.offset, 2);
      expect(GvPrimerFocusGeometry.leaderRow.radius, 14);
    });

    test('rem and container lengths follow the effective text scale', () {
      expect(GvPrimerLayout.cappedRem(TextScaler.noScaling, 2.5, 44), 40);
      expect(GvPrimerLayout.cappedRem(const TextScaler.linear(2), 2.5, 44), 44);
      expect(GvPrimerLayout.containerEm(TextScaler.noScaling, 21), 315);
      expect(GvPrimerLayout.containerEm(const TextScaler.linear(2), 21), 630);
      expect(
        GvPrimerTypography.cappedSize(const TextScaler.linear(2), 24, 30),
        30,
      );
      expect(GvPrimerTypography.cappedSize(TextScaler.noScaling, 24, 30), 24);
    });

    testWidgets('compact chip: 26px minimum height (Calendar list rows)', (
      WidgetTester tester,
    ) async {
      await pumpRows(
        tester,
        const Align(
          alignment: Alignment.topLeft,
          child: GvPrimerStatusChip(
            label: 'Upcoming',
            kind: GvPrimerChipKind.known,
            size: GvPrimerChipSize.compact,
          ),
        ),
      );
      expect(
        tester.getSize(find.byType(GvPrimerStatusChip)).height,
        greaterThanOrEqualTo(26),
      );
    });

    testWidgets('disabled rows are not focusable and show no fill', (
      WidgetTester tester,
    ) async {
      await pumpRows(
        tester,
        const GvPrimerRaceRow(
          round: '1',
          name: 'Grand Prix A',
          semanticLabel: 'Round 1, Grand Prix A',
          onOpen: null,
        ),
      );
      final Finder target = targetIn(GvPrimerRaceRow);
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(nodeOf(tester, target).hasPrimaryFocus, isFalse);
      final TestGesture g = await tester.startGesture(tester.getCenter(target));
      await tester.pump(kPressTimeout + const Duration(milliseconds: 10));
      expect(fillOf(tester, target), isNull);
      await g.up();
    });
  });
}
