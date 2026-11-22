import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';

import '../support/primer_fonts.dart';

/// Step 55B.2: the 12° livery cut, the Primer V2 segmented selector, the
/// bottom navigation and the status-icon scaling comparison.

Future<void> pumpIn(
  WidgetTester tester,
  Widget child, {
  ThemeData? theme,
  Size size = const Size(390, 844),
  double textScale = 1,
  EdgeInsets padding = EdgeInsets.zero,
  bool scaffoldNav = false,
  Widget? nav,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      theme: theme ?? buildGridViewDarkTheme(),
      themeAnimationDuration: Duration.zero,
      home: Builder(
        builder: (BuildContext context) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(textScale),
            padding: padding,
            viewPadding: padding,
            disableAnimations: true,
          ),
          child: Scaffold(body: child, bottomNavigationBar: nav),
        ),
      ),
    ),
  );
  await tester.pump();
}

Future<(ByteData, int)> captureKey(WidgetTester tester, GlobalKey key) async {
  late ByteData bytes;
  late int width;
  await tester.runAsync(() async {
    final ui.Image image =
        await (key.currentContext!.findRenderObject()! as RenderRepaintBoundary)
            .toImage();
    width = image.width;
    bytes = (await image.toByteData())!;
    image.dispose();
  });
  return (bytes, width);
}

Color px(ByteData b, int w, int x, int y) {
  final int i = (y * w + x) * 4;
  return Color.fromARGB(
    b.getUint8(i + 3),
    b.getUint8(i),
    b.getUint8(i + 1),
    b.getUint8(i + 2),
  );
}

bool near(Color a, Color b, [int tolerance = 12]) =>
    ((a.r - b.r).abs() * 255) <= tolerance &&
    ((a.g - b.g).abs() * 255) <= tolerance &&
    ((a.b - b.b).abs() * 255) <= tolerance;

GvPrimerFocusRingPainter ringIn(WidgetTester tester, Finder target) =>
    tester
            .widgetList<CustomPaint>(
              find.descendant(of: target, matching: find.byType(CustomPaint)),
            )
            .firstWhere(
              (CustomPaint p) =>
                  p.foregroundPainter is GvPrimerFocusRingPainter,
            )
            .foregroundPainter!
        as GvPrimerFocusRingPainter;

Finder option(String label) => find.ancestor(
  of: find.text(label).last,
  matching: find.byType(GvPrimerFocusTarget),
);

const List<GvPrimerNavItem> navItems = <GvPrimerNavItem>[
  GvPrimerNavItem(icon: Icons.home_outlined, label: 'Home'),
  GvPrimerNavItem(icon: Icons.calendar_month_outlined, label: 'Calendar'),
  GvPrimerNavItem(glyph: GvPrimerGlyph.standings, label: 'Standings'),
  GvPrimerNavItem(icon: Icons.explore_outlined, label: 'Explore'),
];

const List<GvPrimerNavItem> navItemsEs = <GvPrimerNavItem>[
  GvPrimerNavItem(icon: Icons.home_outlined, label: 'Inicio'),
  GvPrimerNavItem(icon: Icons.calendar_month_outlined, label: 'Calendario'),
  GvPrimerNavItem(glyph: GvPrimerGlyph.standings, label: 'Clasificaciones'),
  GvPrimerNavItem(icon: Icons.explore_outlined, label: 'Explorar'),
];

void main() {
  final double slope = math.tan(12 * math.pi / 180);

  group('12° livery cut', () {
    test('both edges: skewX(-12deg) about the centre, height-derived run', () {
      const Rect r = Rect.fromLTWH(0, 0, 60, 32);
      final Path p = const GvLiveryCut().getOuterPath(r);
      final Rect b = p.getBounds();
      expect(b.left, closeTo(-slope * 16, 1e-6));
      expect(b.right, closeTo(60 + slope * 16, 1e-6));
      expect(b.top, 0);
      expect(b.bottom, 32);
      // "/" lean: the top-left corner is cut away, the bottom-left extends.
      expect(p.contains(const Offset(1, 1)), isFalse);
      expect(p.contains(const Offset(-1, 31)), isTrue);
      expect(p.contains(const Offset(61, 1)), isTrue);
      expect(p.contains(const Offset(59, 31)), isFalse);
    });

    test('the angle holds at every height', () {
      for (final double h in <double>[3, 12, 32, 48, 96, 160]) {
        expect(GvLiveryCut.runFor(h) / h, closeTo(slope, 1e-9));
        final Rect b = const GvLiveryCut()
            .getOuterPath(Rect.fromLTWH(0, 0, 100, h))
            .getBounds();
        // Path bounds are float32: 1e-4 is the engine's precision here.
        expect(b.width - 100, closeTo(slope * h, 1e-4));
      }
    });

    test('rounded corners skew with the box', () {
      const Rect r = Rect.fromLTWH(0, 0, 96, 48);
      final Path sharp = const GvLiveryCut().getOuterPath(r);
      final Path round = const GvLiveryCut(radius: 6).getOuterPath(r);
      // Just inside the sharp skewed top-left corner: inside the sharp path,
      // outside the rounded one.
      final Offset corner = Offset(slope * 24 + 1, 0.6);
      expect(sharp.contains(corner), isTrue);
      expect(round.contains(corner), isFalse);
      expect(
        const GvLiveryCut(radius: 6).scale(2),
        const GvLiveryCut(radius: 12),
      );
    });

    test('leading and trailing one-edge cuts', () {
      const Rect bar = Rect.fromLTWH(0, 0, 120, 12);
      final Path leading = const GvLiveryCut(
        edges: GvLiveryCutEdges.leading,
      ).getOuterPath(bar);
      expect(leading.contains(const Offset(1, 1)), isFalse);
      expect(leading.contains(const Offset(1, 11)), isTrue);
      expect(leading.contains(const Offset(119, 1)), isTrue);

      const Rect cell = Rect.fromLTWH(0, 0, 56, 48);
      final Path trailing = const GvLiveryCut(
        edges: GvLiveryCutEdges.trailing,
      ).getOuterPath(cell);
      expect(trailing.contains(const Offset(55, 1)), isTrue);
      expect(trailing.contains(const Offset(55, 47)), isFalse);
      expect(trailing.getBounds().right, 56);
    });
  });

  group('segmented control', () {
    Widget selector(
      ValueChanged<int> onChanged, {
      int selected = 0,
      List<String>? labels,
    }) => Padding(
      padding: const EdgeInsets.all(16),
      child: GvPrimerSegmentedControl(
        segments: labels ?? const <String>['Drivers', 'Constructors'],
        selectedIndex: selected,
        onChanged: onChanged,
      ),
    );

    testWidgets('semantics: one button per option with the selected flag', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpIn(tester, selector((_) {}));
      expect(
        tester.getSemantics(option('Drivers')),
        matchesSemantics(
          label: 'Drivers',
          isButton: true,
          hasSelectedState: true,
          isSelected: true,
          isFocusable: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
          hasFocusAction: true,
        ),
      );
      expect(
        tester.getSemantics(option('Constructors')),
        matchesSemantics(
          label: 'Constructors',
          isButton: true,
          hasSelectedState: true,
          isSelected: false,
          isFocusable: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
          hasFocusAction: true,
        ),
      );
      // The slab layer adds no semantics of its own.
      expect(find.bySemanticsLabel('Drivers'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('keyboard: Tab reaches each option; Enter and Space select', (
      WidgetTester tester,
    ) async {
      final List<int> changes = <int>[];
      await pumpIn(tester, selector(changes.add));
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(ringIn(tester, option('Constructors')).visible, isTrue);
      expect(ringIn(tester, option('Drivers')).visible, isFalse);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      expect(changes, <int>[1, 1]);
      await tester.tap(find.text('Drivers').last);
      expect(changes.last, 0);
    });

    testWidgets('selection: flat oxide slab cut at 12°, weight 800; no '
        'gradient', (WidgetTester tester) async {
      await pumpIn(tester, selector((_) {}));
      final ShapeDecoration slab = tester
          .widgetList<DecoratedBox>(find.byType(DecoratedBox))
          .map((DecoratedBox d) => d.decoration)
          .whereType<ShapeDecoration>()
          .single;
      expect(slab.color, GvPrimerPalette.oxide600);
      expect(slab.gradient, isNull);
      expect(slab.shape, const GvLiveryCut(radius: 6));
      final Text selected = tester.widget<Text>(find.text('Drivers').last);
      final Text unselected = tester.widget<Text>(
        find.text('Constructors').last,
      );
      expect(selected.style!.fontFamily, 'Archivo');
      expect(selected.style!.fontWeight, FontWeight.w800);
      expect(selected.style!.color, GvPrimerPalette.chalk100);
      expect(selected.style!.decoration, isNull);
      expect(unselected.style!.fontWeight, FontWeight.w600);
      expect(unselected.style!.color, GvPrimerRoles.dark.text.secondary);
    });

    testWidgets('focus colours: Chalk on the slab; unselected Chalk (Dark) or '
        'Graphite with backing (Light)', (WidgetTester tester) async {
      for (final (ThemeData theme, Color unselected, bool backing)
          in <(ThemeData, Color, bool)>[
            (buildGridViewDarkTheme(), GvPrimerPalette.chalk100, false),
            (buildGridViewLightTheme(), GvPrimerPalette.graphite900, true),
          ]) {
        await pumpIn(tester, selector((_) {}), theme: theme);
        expect(
          ringIn(tester, option('Drivers')).color,
          GvPrimerPalette.chalk100,
        );
        expect(ringIn(tester, option('Drivers')).backing, isNull);
        expect(ringIn(tester, option('Constructors')).color, unselected);
        expect(ringIn(tester, option('Constructors')).backing != null, backing);
        expect(ringIn(tester, option('Constructors')).geometry.offset, -3);
      }
    });

    testWidgets('rendered: the unselected ring and Light backing paint above '
        'the neighbouring slab tip', (WidgetTester tester) async {
      for (final (ThemeData theme, Color ring, Color atTip)
          in <(ThemeData, Color, Color)>[
            (
              buildGridViewDarkTheme(),
              GvPrimerPalette.chalk100,
              GvPrimerPalette.oxide600,
            ),
            (
              buildGridViewLightTheme(),
              GvPrimerPalette.graphite900,
              GvPrimerPalette.neutralLightBand,
            ),
          ]) {
        final GlobalKey key = GlobalKey();
        await pumpIn(
          tester,
          Center(
            child: RepaintBoundary(
              key: key,
              child: SizedBox(
                width: 300,
                child: GvPrimerSegmentedControl(
                  segments: const <String>['A', 'B'],
                  selectedIndex: 0,
                  onChanged: (_) {},
                ),
              ),
            ),
          ),
          theme: theme,
        );
        FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.alwaysTraditional;
        await tester.sendKeyEvent(LogicalKeyboardKey.tab);
        await tester.sendKeyEvent(LogicalKeyboardKey.tab);
        await tester.pump();
        final RenderBox root =
            key.currentContext!.findRenderObject()! as RenderBox;
        final Rect b = tester.getRect(option('B'));
        final Offset origin = root.localToGlobal(Offset.zero);
        final int midY = (b.center.dy - origin.dy).round();
        final int left = (b.left - origin.dx).round();
        final (ByteData bytes, int w) = await captureKey(tester, key);
        expect(
          near(px(bytes, w, left + 2, midY), ring),
          isTrue,
          reason: '${theme.brightness} ring',
        );
        // The slab overhang lies under x 0..4 of option B and the ring spans
        // x 1..3, so pixel 0 shows the tip (Dark) or the backing (Light).
        expect(
          near(px(bytes, w, left, midY), atTip),
          isTrue,
          reason: '${theme.brightness} tip',
        );
        FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.automatic;
      }
    });

    testWidgets('fit: regular at 390, stacked at 320 with 200% text; targets '
        'stay ≥ 48', (WidgetTester tester) async {
      await loadArchivo(tester);
      await pumpIn(tester, selector((_) {}));
      expect(
        tester.getRect(option('Drivers')).top,
        tester.getRect(option('Constructors')).top,
      );

      await pumpIn(
        tester,
        selector((_) {}, labels: const <String>['Pilotos', 'Constructores']),
        size: const Size(320, 693),
        textScale: 2,
      );
      expect(tester.takeException(), isNull);
      final Rect a = tester.getRect(option('Pilotos'));
      final Rect c = tester.getRect(option('Constructores'));
      expect(c.top, greaterThanOrEqualTo(a.bottom));
      for (final Rect r in <Rect>[a, c]) {
        expect(r.height, greaterThanOrEqualTo(48));
        expect(r.width, greaterThanOrEqualTo(48));
      }
    });

    testWidgets('fit chooses condensed between the two widths', (
      WidgetTester tester,
    ) async {
      await loadArchivo(tester);
      double widthAt(double wdth) {
        final TextPainter p = TextPainter(
          text: TextSpan(
            text: 'Constructors',
            style: GvPrimerTypography.archivo(
              size: 15,
              weight: 800,
              width: wdth,
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        return p.width;
      }

      final double regular = widthAt(100);
      final double condensed = widthAt(72);
      GvPrimerFit fit(double max) => gvPrimerChooseFit(
        labels: const <String>['Drivers', 'Constructors'],
        fontSize: 15,
        maxLabelWidth: max,
        textScaler: TextScaler.noScaling,
      );
      expect(fit(regular + 1), GvPrimerFit.regular);
      expect(fit((regular + condensed) / 2), GvPrimerFit.condensed);
      expect(fit(condensed - 2), GvPrimerFit.stacked);
    });

    testWidgets('the cut is decoration: a tap outside the slab still selects', (
      WidgetTester tester,
    ) async {
      final List<int> changes = <int>[];
      await pumpIn(tester, selector(changes.add, selected: 1));
      final Rect r = tester.getRect(option('Constructors'));
      await tester.tapAt(r.topRight + const Offset(-1, 1));
      await tester.tapAt(
        tester.getRect(option('Drivers')).topLeft + const Offset(1, 1),
      );
      expect(changes, <int>[1, 0]);
    });
  });

  group('bottom navigation', () {
    Widget bar(
      ValueChanged<int> onSelect, {
      List<GvPrimerNavItem> items = navItems,
      int selected = 0,
    }) => GvPrimerBottomNav(
      items: items,
      selectedIndex: selected,
      onSelect: onSelect,
    );

    Finder tab(String label) => find.ancestor(
      of: find.text(label),
      matching: find.byType(GvPrimerFocusTarget),
    );

    testWidgets('destinations in production order; one selected button each', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpIn(tester, const SizedBox(), nav: bar((_) {}));
      final List<double> xs = <double>[
        for (final GvPrimerNavItem i in navItems)
          tester.getCenter(tab(i.label)).dx,
      ];
      expect(xs, orderedEquals(<double>[...xs]..sort()));
      expect(
        tester.getSemantics(tab('Home')),
        matchesSemantics(
          label: 'Home',
          isButton: true,
          hasSelectedState: true,
          isSelected: true,
          isFocusable: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
          hasFocusAction: true,
        ),
      );
      expect(
        tester.getSemantics(tab('Calendar')).flagsCollection.isSelected,
        ui.Tristate.isFalse,
      );
      handle.dispose();
    });

    testWidgets(
      'selected roles: oxide 60×32 slab cut at 12°, Chalk icon; label '
      'Chalk (Dark) or Graphite (Light)',
      (WidgetTester tester) async {
        for (final (ThemeData theme, Color label) in <(ThemeData, Color)>[
          (buildGridViewDarkTheme(), GvPrimerPalette.chalk100),
          (buildGridViewLightTheme(), GvPrimerPalette.graphite900),
        ]) {
          await pumpIn(
            tester,
            const SizedBox(),
            nav: bar((_) {}),
            theme: theme,
          );
          final Finder slabBox = find.descendant(
            of: tab('Home'),
            matching: find.byWidgetPredicate(
              (Widget w) =>
                  w is DecoratedBox && w.decoration is ShapeDecoration,
            ),
          );
          expect(tester.getSize(slabBox), const Size(60, 32));
          final ShapeDecoration d =
              tester.widget<DecoratedBox>(slabBox).decoration
                  as ShapeDecoration;
          expect(d.color, GvPrimerPalette.oxide600);
          expect(d.shape, const GvLiveryCut(radius: 4));
          expect(
            tester.widget<Icon>(find.byIcon(Icons.home_outlined)).color,
            GvPrimerPalette.chalk100,
          );
          expect(tester.widget<Text>(find.text('Home')).style!.color, label);
          expect(
            tester.widget<Text>(find.text('Home')).style!.fontWeight,
            FontWeight.w800,
          );
          expect(
            tester.widget<Text>(find.text('Calendar')).style!.fontWeight,
            FontWeight.w600,
          );
        }
      },
    );

    testWidgets('safe area: the bar reaches the edge, content sits above the '
        'inset, height = 68 + inset', (WidgetTester tester) async {
      for (final double inset in <double>[0, 24, 48]) {
        await pumpIn(
          tester,
          const SizedBox(),
          nav: bar((_) {}),
          padding: EdgeInsets.only(bottom: inset),
        );
        final Rect navRect = tester.getRect(find.byType(GvPrimerBottomNav));
        expect(navRect.bottom, 844);
        expect(navRect.height, greaterThanOrEqualTo(68 + inset));
        expect(tester.getRect(tab('Home')).bottom, closeTo(844 - inset, 0.01));
      }
    });

    testWidgets('keyboard: Tab reaches each destination; Enter selects', (
      WidgetTester tester,
    ) async {
      final List<int> selections = <int>[];
      await pumpIn(tester, const SizedBox(), nav: bar(selections.add));
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(ringIn(tester, tab('Calendar')).visible, isTrue);
      expect(ringIn(tester, tab('Calendar')).color, GvPrimerPalette.ember400);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      expect(selections, <int>[1]);
    });

    testWidgets(
      'fit: one row at 390, 2 × 2 at 320 with 200% text; targets stay '
      '≥ 48',
      (WidgetTester tester) async {
        await loadArchivo(tester);
        await pumpIn(tester, const SizedBox(), nav: bar((_) {}));
        final double top = tester.getRect(tab('Home')).top;
        for (final GvPrimerNavItem i in navItems) {
          expect(tester.getRect(tab(i.label)).top, top);
        }

        await pumpIn(
          tester,
          const SizedBox(),
          nav: bar((_) {}, items: navItemsEs),
          size: const Size(320, 693),
          textScale: 2,
          padding: const EdgeInsets.only(bottom: 24),
        );
        expect(tester.takeException(), isNull);
        final Rect inicio = tester.getRect(tab('Inicio'));
        final Rect calendario = tester.getRect(tab('Calendario'));
        final Rect clasificaciones = tester.getRect(tab('Clasificaciones'));
        expect(calendario.top, inicio.top);
        expect(clasificaciones.top, greaterThanOrEqualTo(inicio.bottom));
        for (final GvPrimerNavItem i in navItemsEs) {
          final Rect r = tester.getRect(tab(i.label));
          expect(r.height, greaterThanOrEqualTo(48));
          expect(r.width, greaterThanOrEqualTo(48));
        }
      },
    );

    testWidgets('focus ring and the screen edge (XS-31): the inward navigation '
        'ring stays inside the tab and the screen at any inset', (
      WidgetTester tester,
    ) async {
      for (final double inset in <double>[0, 24]) {
        await pumpIn(
          tester,
          const SizedBox(),
          nav: bar((_) {}),
          padding: EdgeInsets.only(bottom: inset),
        );
        for (final String label in <String>['Home', 'Explore']) {
          final Rect tabRect = tester.getRect(tab(label));
          final Rect ring = GvPrimerFocusGeometry.navTab
              .ringPath(tabRect)
              .outerRect
              .inflate(1);
          expect(ring.bottom, lessThanOrEqualTo(844), reason: 'inset $inset');
          expect(ring.left, greaterThanOrEqualTo(0));
          expect(ring.right, lessThanOrEqualTo(390));
          expect(tabRect.contains(ring.center), isTrue);
        }
      }
    });

    testWidgets(
      'focus scrolling (XS-32): a focused body item is scrolled clear '
      'of the bar',
      (WidgetTester tester) async {
        await pumpIn(
          tester,
          ListView(
            children: <Widget>[
              for (int i = 0; i < 30; i++)
                GvPrimerFocusTarget(
                  onActivate: () {},
                  child: SizedBox(height: 56, child: Text('Item $i')),
                ),
            ],
          ),
          nav: bar((_) {}),
          padding: const EdgeInsets.only(bottom: 24),
        );
        final double navTop = tester
            .getRect(find.byType(GvPrimerBottomNav))
            .top;
        for (int i = 0; i < 16; i++) {
          await tester.sendKeyEvent(LogicalKeyboardKey.tab);
          await tester.pumpAndSettle();
        }
        final Rect focused = tester.getRect(
          find.ancestor(
            of: find.text('Item 15'),
            matching: find.byType(GvPrimerFocusTarget),
          ),
        );
        expect(focused.bottom, lessThanOrEqualTo(navTop));
        expect(focused.top, greaterThanOrEqualTo(0));
      },
    );

    testWidgets('the navigation shadow never paints inside the bar', (
      WidgetTester tester,
    ) async {
      final GlobalKey key = GlobalKey();
      await pumpIn(
        tester,
        Center(
          child: RepaintBoundary(
            key: key,
            child: const Padding(
              padding: EdgeInsets.all(20),
              child: SizedBox(
                width: 100,
                height: 40,
                child: CustomPaint(
                  painter: GvPrimerOuterShadowPainter(<BoxShadow>[
                    BoxShadow(color: Color(0xFF000000), offset: Offset(0, -10)),
                  ]),
                ),
              ),
            ),
          ),
        ),
      );
      final (ByteData bytes, int w) = await captureKey(tester, key);
      expect(px(bytes, w, 70, 15).a, greaterThan(0.9), reason: 'above the bar');
      expect(px(bytes, w, 70, 40).a, 0, reason: 'inside the bar');
    });
  });
}
