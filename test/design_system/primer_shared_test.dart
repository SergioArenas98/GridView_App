import 'dart:ui' show Tristate;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/dev/catalogue/primer_catalogue_shared.dart';

import '../support/contrast.dart';
import '../support/primer_fonts.dart';

/// Step 55B.4: the remaining shared Primer V2 components (section title,
/// notice, facts and stat strip, team marks, actions, empty and loading
/// states). Widget-level checks in the flutter_tester engine; no device or
/// TalkBack claim.

const Size _en390 = Size(390, 844);
const Size _es320 = Size(320, 693);

Future<void> pumpShared(
  WidgetTester tester,
  Widget child, {
  GvPrimerRoles? roles,
  Size size = _en390,
  double scale = 1,
}) async {
  final GvPrimerRoles r = roles ?? GvPrimerRoles.dark;
  await loadArchivo(tester);
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(const SizedBox());
  await tester.pumpWidget(
    MaterialApp(
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
  );
  await tester.pump();
}

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

/// The font size of the [Text.rich] whose plain text is [text].
double? spanSize(WidgetTester tester, String text) {
  final RichText rich = tester.widget<RichText>(
    find.text(text, findRichText: true),
  );
  final InlineSpan inner = (rich.text as TextSpan).children!.first;
  return inner.style!.fontSize;
}

T painterIn<T>(WidgetTester tester, Finder of) => tester
    .widgetList<CustomPaint>(
      find.descendant(of: of, matching: find.byType(CustomPaint)),
    )
    .map((CustomPaint p) => p.painter)
    .whereType<T>()
    .first;

void main() {
  group('section title', () {
    testWidgets('20px heading, capped at 30, coloured by its surface', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      for (final GvPrimerRoles roles in <GvPrimerRoles>[
        GvPrimerRoles.dark,
        GvPrimerRoles.light,
      ]) {
        await pumpShared(
          tester,
          const GvPrimerSectionTitle('Sessions'),
          roles: roles,
        );
        final Text text = tester.widget<Text>(find.text('Sessions'));
        expect(text.style!.fontSize, 20);
        expect(text.style!.color, roles.text.primary);
        expect(
          tester.getSemantics(find.text('Sessions')).flagsCollection.isHeader,
          isTrue,
        );
      }
      await pumpShared(
        tester,
        const GvPrimerSectionTitle('Sesiones'),
        roles: GvPrimerRoles.light,
        size: _es320,
        scale: 2,
      );
      expect(tester.widget<Text>(find.text('Sesiones')).style!.fontSize, 30);
      // Inside the Light Graphite band the title takes the band's Chalk.
      await pumpShared(
        tester,
        const GvPrimerSurface(
          kind: GvPrimerSurfaceKind.graphiteBand,
          child: GvPrimerSectionTitle('Race results'),
        ),
        roles: GvPrimerRoles.light,
      );
      expect(
        tester.widget<Text>(find.text('Race results')).style!.color,
        GvPrimerPalette.chalk100,
      );
      handle.dispose();
    });
  });

  group('notice', () {
    testWidgets('cause icons (VS-4), notice roles, polite status, not '
        'focusable', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      for (final (GvPrimerNoticeCause cause, GvPrimerGlyph glyph)
          in <(GvPrimerNoticeCause, GvPrimerGlyph)>[
            (GvPrimerNoticeCause.failure, GvPrimerGlyph.alert),
            (GvPrimerNoticeCause.stale, GvPrimerGlyph.clock),
            (GvPrimerNoticeCause.incomplete, GvPrimerGlyph.help),
          ]) {
        for (final GvPrimerRoles roles in <GvPrimerRoles>[
          GvPrimerRoles.dark,
          GvPrimerRoles.light,
        ]) {
          await pumpShared(
            tester,
            GvPrimerNotice(cause: cause, message: 'Message'),
            roles: roles,
          );
          final GvPrimerIcon icon = tester.widget<GvPrimerIcon>(
            find.byType(GvPrimerIcon),
          );
          expect(icon.glyph, glyph);
          expect(icon.color, roles.notice.icon);
          expect(icon.size, 20);
          final BoxDecoration box =
              tester
                      .widget<DecoratedBox>(
                        find
                            .descendant(
                              of: find.byType(GvPrimerNotice),
                              matching: find.byType(DecoratedBox),
                            )
                            .first,
                      )
                      .decoration
                  as BoxDecoration;
          expect(box.color, roles.notice.fill);
          expect((box.border! as Border).top.color, roles.notice.border);
          final SemanticsNode node = tester.getSemantics(
            find.byType(GvPrimerNotice),
          );
          expect(node.label, 'Message');
          expect(node.flagsCollection.isLiveRegion, isTrue);
          expect(node.flagsCollection.isFocused, Tristate.none);
          // The icon is ≥ 3:1 on the fill (non-text contrast).
          expect(
            contrastRatio(roles.notice.icon, roles.notice.fill),
            greaterThanOrEqualTo(3),
          );
          expect(
            contrastRatio(roles.notice.text, roles.notice.fill),
            greaterThanOrEqualTo(4.5),
          );
        }
      }
      handle.dispose();
    });

    testWidgets('long Spanish text wraps at 200% without overflow', (
      WidgetTester tester,
    ) async {
      await pumpShared(
        tester,
        const Padding(
          padding: EdgeInsets.all(16),
          child: GvPrimerNotice(
            cause: GvPrimerNoticeCause.failure,
            message:
                'No se pudo actualizar. Los datos guardados pueden estar '
                'desactualizados.',
          ),
        ),
        size: _es320,
        scale: 2,
      );
      expect(tester.takeException(), isNull);
      expect(
        tester.getSize(find.byType(GvPrimerNotice)).height,
        greaterThan(100),
      );
    });
  });

  group('facts and stat strip', () {
    List<Widget> facts({bool unavailable = false}) => <Widget>[
      const GvPrimerFact(label: 'Date of birth', value: 'Sep 30, 1997'),
      const GvPrimerFact(label: 'Place of birth', value: 'Hasselt, Belgium'),
      GvPrimerFact(
        label: 'Permanent number',
        value: unavailable ? 'Not available' : '33',
        unavailable: unavailable,
      ),
    ];

    testWidgets('a fact reads label and value together; unavailable is '
        'secondary', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpShared(
        tester,
        GvPrimerFactGrid(children: facts(unavailable: true)),
      );
      final SemanticsNode node = tester.getSemantics(
        find.byType(GvPrimerFact).first,
      );
      expect(node.label, contains('Date of birth'));
      expect(node.label, contains('Sep 30, 1997'));
      final Text missing = tester.widget<Text>(find.text('Not available'));
      expect(missing.style!.color, GvPrimerRoles.dark.text.secondary);
      expect(
        tester.widget<Text>(find.text('Sep 30, 1997')).style!.fontSize,
        16,
      );
      handle.dispose();
    });

    test('auto-fit columns: fewer at large text, never below one', () {
      expect(
        GvPrimerFactGrid.columnsFor(358, TextScaler.noScaling),
        2, // 142.5px minimum + 20px gap
      );
      expect(GvPrimerFactGrid.columnsFor(288, const TextScaler.linear(2)), 1);
      expect(GvPrimerFactGrid.columnsFor(40, TextScaler.noScaling), 1);
      expect(
        GvPrimerFactGrid.columnsFor(358, TextScaler.noScaling, minEm: 10),
        2,
      );
    });

    testWidgets('the grid keeps column widths on a short last row and '
        'stacks at 200%', (WidgetTester tester) async {
      await pumpShared(
        tester,
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: GvPrimerFactGrid(children: facts()),
        ),
      );
      final Rect a = tester.getRect(find.byType(GvPrimerFact).at(0));
      final Rect c = tester.getRect(find.byType(GvPrimerFact).at(2));
      expect(a.width, closeTo((358 - 20) / 2, 0.5));
      expect(c.left, a.left);
      expect(c.top, greaterThan(a.bottom));
      await pumpShared(
        tester,
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: GvPrimerFactGrid(children: facts()),
        ),
        size: _es320,
        scale: 2,
      );
      final Rect b2 = tester.getRect(find.byType(GvPrimerFact).at(1));
      expect(b2.left, 16);
      expect(tester.takeException(), isNull);
    });

    GvPrimerStatStrip team() => const GvPrimerStatStrip(
      stats: <GvPrimerStat>[
        GvPrimerStat(
          label: 'Position',
          value: '6',
          kind: GvPrimerStatKind.lead,
        ),
        GvPrimerStat(label: 'Points', value: '22'),
        GvPrimerStat(label: 'Wins', value: '0'),
      ],
    );

    testWidgets('Team geometry: seams span the following cell; narrow drops '
        'the seam before the second cell', (WidgetTester tester) async {
      await pumpShared(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: team()),
      );
      Finder seams() => find.byWidgetPredicate(
        (Widget w) =>
            w is DecoratedBox &&
            w.decoration is ShapeDecoration &&
            (w.decoration as ShapeDecoration).shape is GvLiveryCut,
      );
      expect(seams(), findsNWidgets(2));
      final Rect strip = tester.getRect(find.byType(GvPrimerStatStrip));
      final Rect seam = tester.getRect(seams().first);
      expect(seam.height, lessThan(strip.height - 10));
      expect(seam.bottom, closeTo(strip.bottom, 0.5));
      expect(seam.width, 2);
      // Values share a bottom line.
      expect(
        tester.getRect(find.text('22')).bottom,
        closeTo(tester.getRect(find.text('0')).bottom, 0.5),
      );
      // 22px on each side of a seam, the seam inside the right-hand padding.
      final Rect pos = tester.getRect(find.text('Position'));
      final Rect points = tester.getRect(find.text('Points'));
      expect(points.left - seam.left, closeTo(22, 0.5));
      expect(points.left, greaterThan(pos.right));

      await pumpShared(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: team()),
        size: _es320,
        scale: 2,
      );
      expect(seams(), findsOneWidget);
      expect(
        tester.getRect(find.text('Points')).top,
        greaterThan(tester.getRect(find.text('6')).bottom),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('Driver geometry: one full-height seam column', (
      WidgetTester tester,
    ) async {
      await pumpShared(
        tester,
        const Padding(
          padding: EdgeInsets.all(16),
          child: GvPrimerStatStrip(
            style: GvPrimerStatStripStyle.driver,
            stats: <GvPrimerStat>[
              GvPrimerStat(
                label: 'Position',
                value: '2',
                kind: GvPrimerStatKind.lead,
              ),
              GvPrimerStat(label: 'Points', value: '402.5'),
            ],
          ),
        ),
      );
      final Finder seam = find.byWidgetPredicate(
        (Widget w) =>
            w is DecoratedBox &&
            w.decoration is ShapeDecoration &&
            (w.decoration as ShapeDecoration).shape is GvLiveryCut,
      );
      expect(
        tester.getRect(seam).height,
        closeTo(tester.getRect(find.byType(GvPrimerStatStrip)).height, 0.5),
      );
    });

    testWidgets('stat sizes, unit, word wrapping and semantics', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpShared(
        tester,
        const Padding(
          padding: EdgeInsets.all(16),
          child: GvPrimerStatStrip(
            stats: <GvPrimerStat>[
              GvPrimerStat(
                label: 'Position',
                value: 'Sin clasificar',
                kind: GvPrimerStatKind.word,
              ),
              GvPrimerStat(label: 'Points', value: '120', unit: 'pts'),
            ],
          ),
        ),
        size: _es320,
        scale: 2,
      );
      expect(tester.takeException(), isNull);
      expect(spanSize(tester, 'Sin clasificar'), 34);
      expect(find.text('120 pts', findRichText: true), findsOneWidget);
      final SemanticsNode points = tester.getSemantics(find.text('Points'));
      expect(points.label, contains('120'));
      handle.dispose();
      // The lead figure caps at 80.
      await pumpShared(tester, team(), scale: 2, size: const Size(800, 600));
      expect(spanSize(tester, '6'), 80);
    });
  });

  group('team marks (XT-3)', () {
    test('one geometry: tick 3, seam 2, bar 12, pinstripe 3', () {
      expect(GvPrimerTeamMark.thicknessOf(GvPrimerTeamShape.tick), 3);
      expect(GvPrimerTeamMark.thicknessOf(GvPrimerTeamShape.seam), 2);
      expect(GvPrimerTeamMark.thicknessOf(GvPrimerTeamShape.bar), 12);
      expect(GvPrimerTeamMark.thicknessOf(GvPrimerTeamShape.pinstripe), 3);
      // Bar: 12° leading cut, height-derived.
      final Rect bar = GvPrimerTeamMarkPainter.pathFor(
        GvPrimerTeamShape.bar,
        const Size(200, 12),
      ).getBounds();
      expect(bar, const Rect.fromLTWH(0, 0, 200, 12));
      final Path barPath = GvPrimerTeamMarkPainter.pathFor(
        GvPrimerTeamShape.bar,
        const Size(200, 12),
      );
      expect(barPath.contains(const Offset(0.5, 1)), isFalse);
      expect(barPath.contains(const Offset(0.5, 11)), isTrue);
      // Tick: both edges skewed about the centre.
      final Rect tick = GvPrimerTeamMarkPainter.pathFor(
        GvPrimerTeamShape.tick,
        const Size(3, 40),
      ).getBounds();
      expect(tick.width, closeTo(3 + 40 * GvLiveryCut.slope, 1e-3));
    });

    testWidgets('boundary only below 3:1 against the actual surface, in its '
        'text colour; the colour is never changed', (
      WidgetTester tester,
    ) async {
      const Color blue = Color(0xFF1E41FF);
      const Color orange = Color(0xFFFF8000);
      const Color cyan = Color(0xFF0093CC);
      Future<GvPrimerTeamMarkPainter> mark(
        GvPrimerRoles roles,
        Color colour, {
        Color? surface,
        GvPrimerTeamShape shape = GvPrimerTeamShape.tick,
      }) async {
        await pumpShared(
          tester,
          Center(
            child: GvPrimerTeamMark(
              shape: shape,
              color: colour,
              surface: surface,
              length: 40,
            ),
          ),
          roles: roles,
        );
        return painterIn<GvPrimerTeamMarkPainter>(
          tester,
          find.byType(GvPrimerTeamMark),
        );
      }

      // Dark page: blue 2.83 → Chalk edge; orange and cyan pass.
      GvPrimerTeamMarkPainter p = await mark(GvPrimerRoles.dark, blue);
      expect(p.edge, GvPrimerPalette.chalk100);
      expect(p.color, blue);
      expect((await mark(GvPrimerRoles.dark, orange)).edge, isNull);
      expect((await mark(GvPrimerRoles.dark, cyan)).edge, isNull);
      // Light page: orange 2.13, cyan 2.94 → Graphite edge; blue passes.
      p = await mark(GvPrimerRoles.light, orange);
      expect(p.edge, GvPrimerPalette.graphite900);
      expect(p.color, orange);
      expect((await mark(GvPrimerRoles.light, cyan)).edge, isNotNull);
      expect((await mark(GvPrimerRoles.light, blue)).edge, isNull);
      // Light band (banner): cyan 3.24 passes there, orange 2.35 does not.
      final Color band = GvPrimerRoles.light.surface.band;
      expect(
        (await mark(
          GvPrimerRoles.light,
          cyan,
          surface: band,
          shape: GvPrimerTeamShape.bar,
        )).edge,
        isNull,
      );
      expect(
        (await mark(
          GvPrimerRoles.light,
          orange,
          surface: band,
          shape: GvPrimerTeamShape.bar,
        )).edge,
        GvPrimerPalette.graphite900,
      );
      // Size never changes with the boundary.
      expect(tester.getSize(find.byType(GvPrimerTeamMark)).height, 12);
    });

    testWidgets('rendered: the boundary is 1px outside, the core keeps the '
        'team colour; hidden from semantics', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final GlobalKey key = GlobalKey();
      await pumpShared(
        tester,
        Center(
          child: RepaintBoundary(
            key: key,
            child: const ColoredBox(
              color: GvPrimerPalette.graphite900,
              child: Padding(
                padding: EdgeInsets.all(8),
                child: GvPrimerTeamMark(
                  shape: GvPrimerTeamShape.bar,
                  color: Color(0xFF1E41FF),
                  length: 100,
                ),
              ),
            ),
          ),
        ),
      );
      final RenderRepaintBoundary boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      late ByteData bytes;
      late int width;
      await tester.runAsync(() async {
        final image = await boundary.toImage();
        width = image.width;
        bytes = (await image.toByteData())!;
        image.dispose();
      });
      Color at(int x, int y) {
        final int i = (y * width + x) * 4;
        return Color.fromARGB(
          255,
          bytes.getUint8(i),
          bytes.getUint8(i + 1),
          bytes.getUint8(i + 2),
        );
      }

      // Row 7 is 1px above the 12px bar (rows 8–19): the Chalk edge.
      expect(at(60, 7), GvPrimerPalette.chalk100);
      expect(at(60, 14), const Color(0xFF1E41FF));
      expect(at(60, 5), GvPrimerPalette.graphite900);
      expect(find.bySemanticsLabel(RegExp('.')), findsNothing);
      handle.dispose();
    });
  });

  group('actions', () {
    testWidgets('arrow disc: 44px default, disc roles per theme, decorative', (
      WidgetTester tester,
    ) async {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[
        GvPrimerRoles.dark,
        GvPrimerRoles.light,
      ]) {
        await pumpShared(
          tester,
          const Center(child: GvPrimerArrowDisc()),
          roles: roles,
        );
        expect(
          tester.getSize(find.byType(GvPrimerArrowDisc)),
          const Size(44, 44),
        );
        final GvPrimerIcon icon = tester.widget<GvPrimerIcon>(
          find.byType(GvPrimerIcon),
        );
        expect(icon.glyph, GvPrimerGlyph.arrowRight);
        expect(icon.color, roles.action.disc.on);
        final BoxDecoration d =
            tester
                    .widget<Container>(
                      find.descendant(
                        of: find.byType(GvPrimerArrowDisc),
                        matching: find.byType(Container),
                      ),
                    )
                    .decoration!
                as BoxDecoration;
        expect(d.color, roles.action.disc.fill);
      }
    });

    testWidgets('pill button: ≥ 48, inverse roles, keyboard activation, '
        'pill ring outside, opt-in hover, disabled', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      int taps = 0;
      await pumpShared(
        tester,
        Center(
          child: GvPrimerButton(label: 'Try again', onPressed: () => taps++),
        ),
        roles: GvPrimerRoles.light,
      );
      final Finder button = find.byType(GvPrimerButton);
      expect(tester.getSize(button).height, greaterThanOrEqualTo(48));
      expect(
        tester.widget<Text>(find.text('Try again')).style!.color,
        GvPrimerRoles.light.action.button.on,
      );
      final SemanticsNode node = tester.getSemantics(find.text('Try again'));
      expect(node.flagsCollection.isButton, isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      final Finder target = find.descendant(
        of: button,
        matching: find.byType(GvPrimerFocusTarget),
      );
      expect(ringOf(tester, target).visible, isTrue);
      expect(ringOf(tester, target).geometry.offset, 3);
      expect(ringOf(tester, target).color, GvPrimerRoles.light.focus.onPage);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.tap(find.text('Try again'));
      expect(taps, 2);

      // Hover only when the screen opts in.
      final TestGesture mouse = await tester.createGesture(
        kind: PointerDeviceKind.mouse,
      );
      await mouse.addPointer(location: Offset.zero);
      addTearDown(mouse.removePointer);
      await mouse.moveTo(tester.getCenter(button));
      await tester.pump();
      // No hover fill unless the screen opts in.
      expect(fillOf(tester, target), isNull);
      await pumpShared(
        tester,
        Center(
          child: GvPrimerButton(
            label: 'Try again',
            onPressed: () {},
            hover: true,
          ),
        ),
        roles: GvPrimerRoles.light,
      );
      await mouse.moveTo(Offset.zero);
      await tester.pump();
      await mouse.moveTo(tester.getCenter(find.byType(GvPrimerButton)));
      await tester.pump();
      expect(
        fillOf(
          tester,
          find.descendant(
            of: find.byType(GvPrimerButton),
            matching: find.byType(GvPrimerFocusTarget),
          ),
        ),
        GvPrimerRoles.light.action.buttonHover,
      );
      handle.dispose();
    });

    testWidgets('link row: 56px, link semantics, row ring, pressed row role', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      int opened = 0;
      await pumpShared(
        tester,
        GvPrimerLinkRow(
          label: "View constructors' standings",
          onActivate: () => opened++,
        ),
      );
      final Finder row = find.byType(GvPrimerLinkRow);
      expect(tester.getSize(row).height, greaterThanOrEqualTo(56));
      final Finder target = find.descendant(
        of: row,
        matching: find.byType(GvPrimerFocusTarget),
      );
      expect(tester.getSemantics(target).flagsCollection.isLink, isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(ringOf(tester, target).geometry, GvPrimerFocusGeometry.row);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      expect(opened, 1);
      final TestGesture press = await tester.startGesture(
        tester.getCenter(row),
      );
      await tester.pump(kPressTimeout + const Duration(milliseconds: 10));
      expect(fillOf(tester, target), GvPrimerRoles.dark.state.pressedRow);
      await press.up();
      handle.dispose();
    });
  });

  group('Step 55B.4.1 refinements', () {
    GvPrimerStatStrip strip(GvPrimerStatStripStyle style) => GvPrimerStatStrip(
      style: style,
      stats: const <GvPrimerStat>[
        GvPrimerStat(
          label: 'Position',
          value: '2',
          kind: GvPrimerStatKind.lead,
        ),
        GvPrimerStat(label: 'Points', value: '402.5'),
      ],
    );

    test('the two strip styles carry the measured Team and Driver values', () {
      const GvPrimerStatStripStyle t = GvPrimerStatStripStyle.team;
      const GvPrimerStatStripStyle d = GvPrimerStatStripStyle.driver;
      expect(
        <Object>[
          t.figureCap,
          t.figureLineHeight,
          t.figureGap,
          t.wordGap,
          t.cellGap,
          t.rowGap,
          t.narrowEm,
          t.seamSpansRow,
        ],
        <Object>[44, 0.86, 8, 8, 22, 18, 20, false],
      );
      expect(
        <Object>[
          d.figureCap,
          d.figureLineHeight,
          d.figureGap,
          d.wordGap,
          d.cellGap,
          d.rowGap,
          d.narrowEm,
          d.seamSpansRow,
        ],
        <Object>[48, 0.9, 6, 10, 18, 16, 19, true],
      );
      expect(
        const GvPrimerStatStrip(stats: <GvPrimerStat>[]).style,
        GvPrimerStatStripStyle.team,
      );
    });

    for (final GvPrimerRoles roles in <GvPrimerRoles>[
      GvPrimerRoles.dark,
      GvPrimerRoles.light,
    ]) {
      testWidgets('points cap: Driver 48, Team 44 at 200%; Driver 40 at '
          '100% (${roles.brightness.name})', (WidgetTester tester) async {
        await pumpShared(
          tester,
          Padding(
            padding: const EdgeInsets.all(16),
            child: strip(GvPrimerStatStripStyle.driver),
          ),
          roles: roles,
          size: _es320,
          scale: 2,
        );
        expect(spanSize(tester, '402.5'), 48);
        expect(tester.takeException(), isNull);
        // Driver narrow: points under the position, no seam, 16px gap.
        final Rect pos = tester.getRect(find.text('2', findRichText: true));
        final Rect label = tester.getRect(find.text('Points'));
        expect(label.top, greaterThan(pos.bottom));
        await pumpShared(
          tester,
          Padding(
            padding: const EdgeInsets.all(16),
            child: strip(GvPrimerStatStripStyle.team),
          ),
          roles: roles,
          size: _es320,
          scale: 2,
        );
        expect(spanSize(tester, '402.5'), 44);
        await pumpShared(
          tester,
          Padding(
            padding: const EdgeInsets.all(16),
            child: strip(GvPrimerStatStripStyle.driver),
          ),
          roles: roles,
        );
        expect(spanSize(tester, '402.5'), 40);
        // Driver at 100%: the points sit 6px under their label, at the foot
        // of the row, which they share with the position figure.
        final RichText points = tester.widget<RichText>(
          find.text('402.5', findRichText: true),
        );
        expect((points.text as TextSpan).children!.first.style!.height, 0.9);
        final Rect strip100 = tester.getRect(find.byType(GvPrimerStatStrip));
        expect(
          tester.getRect(find.text('402.5', findRichText: true)).bottom,
          closeTo(strip100.bottom, 0.5),
        );
        expect(
          tester.getRect(find.text('402.5', findRichText: true)).top -
              tester.getRect(find.text('Points')).bottom,
          closeTo(6, 0.5),
        );
      });
    }

    testWidgets('fact values: 16px Driver default, 15px GP rail', (
      WidgetTester tester,
    ) async {
      await pumpShared(
        tester,
        const Column(
          children: <Widget>[
            GvPrimerFact(label: 'Place of birth', value: 'Hasselt'),
            GvPrimerFact(
              label: 'Location',
              value: 'Monza, Italy',
              size: GvPrimerFactSize.compact,
            ),
          ],
        ),
      );
      expect(tester.widget<Text>(find.text('Hasselt')).style!.fontSize, 16);
      expect(
        tester.widget<Text>(find.text('Monza, Italy')).style!.fontSize,
        15,
      );
    });

    for (final GvPrimerRoles roles in <GvPrimerRoles>[
      GvPrimerRoles.dark,
      GvPrimerRoles.light,
    ]) {
      testWidgets('pill button pressed: on-colour at 6% over the pill, '
          'legible, distinct from rest and hover; geometry, label and ring '
          'unchanged (${roles.brightness.name})', (WidgetTester tester) async {
        for (final (Size size, double scale) in <(Size, double)>[
          (_en390, 1),
          (_es320, 2),
        ]) {
          await pumpShared(
            tester,
            Center(
              child: GvPrimerButton(
                label: 'Reintentar',
                onPressed: () {},
                hover: true,
              ),
            ),
            roles: roles,
            size: size,
            scale: scale,
          );
          final Finder button = find.byType(GvPrimerButton);
          final Finder target = find.descendant(
            of: button,
            matching: find.byType(GvPrimerFocusTarget),
          );
          final Rect rest = tester.getRect(button);
          final Color overlay = roles.action.button.on.withValues(alpha: 0.06);
          // Without hover: the overlay over the pill. With hover (on here):
          // the overlay blended over the hover colour, one step beyond it.
          expect(
            GvPrimerButton.pressedFill(roles.action, hover: false),
            overlay,
          );
          final Color pressedFill = GvPrimerButton.pressedFill(
            roles.action,
            hover: true,
          );
          expect(
            pressedFill,
            Color.alphaBlend(overlay, roles.action.buttonHover),
          );
          for (final Color pressed in <Color>[
            Color.alphaBlend(overlay, roles.action.button.fill),
            pressedFill,
          ]) {
            expect(
              contrastRatio(roles.action.button.on, pressed),
              greaterThanOrEqualTo(4.5),
            );
            expect(
              contrastRatio(pressed, roles.action.button.fill),
              greaterThan(1.1),
            );
          }
          expect(
            contrastRatio(pressedFill, roles.action.buttonHover),
            greaterThan(1.08),
          );

          // Touch press: immediate fill while pressed, gone on release.
          TestGesture g = await tester.startGesture(tester.getCenter(button));
          await tester.pump(kPressTimeout + const Duration(milliseconds: 10));
          expect(fillOf(tester, target), pressedFill);
          expect(tester.getRect(button), rest);
          expect(find.text('Reintentar'), findsOneWidget);
          await g.up();
          await tester.pump();
          expect(fillOf(tester, target), isNull);

          // Keyboard focus, then a mouse press while hovering: pressed wins
          // over hover and the ring stays.
          await tester.sendKeyEvent(LogicalKeyboardKey.tab);
          await tester.pump();
          g = await tester.createGesture(kind: PointerDeviceKind.mouse);
          await g.addPointer(location: tester.getCenter(button));
          await tester.pump();
          expect(fillOf(tester, target), roles.action.buttonHover);
          await g.down(tester.getCenter(button));
          await tester.pump(kPressTimeout + const Duration(milliseconds: 10));
          expect(fillOf(tester, target), pressedFill);
          expect(ringOf(tester, target).visible, isTrue);
          expect(ringOf(tester, target).geometry.offset, 3);
          expect(tester.getRect(button), rest);
          await g.up();
          await g.removePointer();
          await tester.pump();
          expect(tester.takeException(), isNull);
        }
      });
    }
  });

  group('empty and loading states', () {
    testWidgets('list and detail sizes; glyph or icon; caller copy and '
        'action', (WidgetTester tester) async {
      await pumpShared(
        tester,
        GvPrimerEmptyState(
          size: GvPrimerEmptySize.list,
          icon: Icons.person_search_outlined,
          title: 'No drivers yet',
          message: 'Message',
          action: GvPrimerButton(label: 'Try again', onPressed: () {}),
        ),
      );
      expect(tester.widget<Icon>(find.byType(Icon)).size, 32);
      expect(
        tester.widget<Text>(find.text('No drivers yet')).style!.fontSize,
        20,
      );
      expect(find.byType(GvPrimerButton), findsOneWidget);
      await pumpShared(
        tester,
        const GvPrimerEmptyState(
          glyph: GvPrimerGlyph.alert,
          title: 'Season unavailable',
        ),
        size: _es320,
        scale: 2,
      );
      expect(tester.widget<GvPrimerIcon>(find.byType(GvPrimerIcon)).size, 28);
      expect(
        tester.widget<Text>(find.text('Season unavailable')).style!.fontSize,
        28,
      );
      expect(() => GvPrimerEmptyState(title: 'x'), throwsAssertionError);
    });

    testWidgets('skeleton keeps theme colours inside the Graphite band '
        '(LT-16); loading is announced once', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpShared(
        tester,
        const GvPrimerSurface(
          kind: GvPrimerSurfaceKind.graphiteBand,
          child: GvPrimerLoading(
            semanticLabel: 'Loading',
            child: Column(
              children: <Widget>[
                GvPrimerSkeleton(height: 18, width: 140),
                GvPrimerSkeleton(height: 72),
              ],
            ),
          ),
        ),
        roles: GvPrimerRoles.light,
      );
      final BoxDecoration d =
          tester
                  .widget<DecoratedBox>(
                    find
                        .descendant(
                          of: find.byType(GvPrimerSkeleton).first,
                          matching: find.byType(DecoratedBox),
                        )
                        .first,
                  )
                  .decoration
              as BoxDecoration;
      expect(
        (d.gradient! as LinearGradient).colors,
        GvPrimerRoles.light.skeleton.gradient.colors,
      );
      expect(find.bySemanticsLabel('Loading'), findsOneWidget);
      expect(
        tester
            .getSemantics(find.byType(GvPrimerLoading))
            .flagsCollection
            .isLiveRegion,
        isTrue,
      );
      handle.dispose();
    });
  });

  group('catalogue', () {
    for (final (String name, Size size, double scale, bool es)
        in <(String, Size, double, bool)>[
          ('EN 390 @100%', _en390, 1, false),
          ('ES 320 @200%', _es320, 2, true),
        ]) {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[
        GvPrimerRoles.dark,
        GvPrimerRoles.light,
      ]) {
        testWidgets('every specimen lays out unclipped: $name, '
            '${roles.brightness.name}', (WidgetTester tester) async {
          await pumpShared(
            tester,
            PrimerSharedComponentsSection(spanish: es),
            roles: roles,
            size: size,
            scale: scale,
          );
          expect(tester.takeException(), isNull);
          for (final RenderParagraph p
              in tester.allRenderObjects.whereType<RenderParagraph>()) {
            final Rect rect = MatrixUtils.transformRect(
              p.getTransformTo(null),
              Offset.zero & p.size,
            );
            expect(rect.left, greaterThanOrEqualTo(-0.5));
            expect(rect.right, lessThanOrEqualTo(size.width + 0.5));
          }
          for (final Element e in find.byType(GvPrimerFocusTarget).evaluate()) {
            final Size target = (e.renderObject! as RenderBox).size;
            expect(target.width, greaterThanOrEqualTo(48));
            expect(target.height, greaterThanOrEqualTo(48));
          }
        });
      }
    }
  });
}
