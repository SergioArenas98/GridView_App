import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';

import '../support/primer_fonts.dart';
import '../support/ring_probe.dart';

/// Step 55B.2.1: the inward navigation focus ring, the adaptive navigation
/// height, the approved status-icon progression and the two Primer glyphs.

const double _dpr = 2;

class NavConfig {
  const NavConfig(this.size, this.textScale, this.labels);
  final Size size;
  final double textScale;
  final List<String> labels;
}

const NavConfig en390 = NavConfig(Size(390, 844), 1, <String>[
  'Home',
  'Calendar',
  'Standings',
  'Explore',
]);
const NavConfig es320 = NavConfig(Size(320, 693), 2, <String>[
  'Inicio',
  'Calendario',
  'Clasificaciones',
  'Explorar',
]);

List<GvPrimerNavItem> itemsFor(List<String> labels) => <GvPrimerNavItem>[
  GvPrimerNavItem(label: labels[0], icon: Icons.home_outlined),
  GvPrimerNavItem(label: labels[1], icon: Icons.calendar_month_outlined),
  GvPrimerNavItem(label: labels[2], glyph: GvPrimerGlyph.standings),
  GvPrimerNavItem(label: labels[3], icon: Icons.explore_outlined),
];

Future<void> pumpNav(
  WidgetTester tester,
  GlobalKey key, {
  required NavConfig config,
  required ThemeData theme,
  double inset = 0,
  GvPrimerFocusGeometry geometry = GvPrimerFocusGeometry.navTab,
  Widget body = const SizedBox.expand(),
}) async {
  await tester.binding.setSurfaceSize(config.size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  // A fresh tree each time, so no focus carries over from a previous pump.
  await tester.pumpWidget(const SizedBox());
  await tester.pumpWidget(
    RepaintBoundary(
      key: key,
      child: MaterialApp(
        theme: theme,
        themeAnimationDuration: Duration.zero,
        home: Builder(
          builder: (BuildContext context) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: TextScaler.linear(config.textScale),
              padding: EdgeInsets.only(bottom: inset),
              viewPadding: EdgeInsets.only(bottom: inset),
              disableAnimations: true,
            ),
            child: Scaffold(
              body: body,
              bottomNavigationBar: GvPrimerBottomNav(
                items: itemsFor(config.labels),
                selectedIndex: 0,
                onSelect: (_) {},
                focusGeometry: geometry,
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

Finder tabFinder(String label) => find.ancestor(
  of: find.text(label),
  matching: find.byType(GvPrimerFocusTarget),
);

/// Focuses tab [index] by keyboard and measures its ring in a 2x render.
Future<RingVisibility> measureRing(
  WidgetTester tester,
  GlobalKey key,
  NavConfig config,
  int index,
  GvPrimerFocusGeometry geometry,
  Color ring,
) async {
  for (int i = 0; i <= index; i++) {
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
  }
  await tester.pump();
  final Rect tab = tester.getRect(tabFinder(config.labels[index]));
  late RingVisibility result;
  await tester.runAsync(() async {
    final ui.Image image =
        await (key.currentContext!.findRenderObject()! as RenderRepaintBoundary)
            .toImage(pixelRatio: _dpr);
    final ByteData bytes = (await image.toByteData())!;
    result = probeRing(
      bytes: bytes,
      imageWidth: image.width,
      imageHeight: image.height,
      pixelRatio: _dpr,
      ringCentre: geometry.ringPath(tab),
      ring: ring,
    );
    image.dispose();
  });
  return result;
}

void main() {
  setUp(
    () => FocusManager.instance.highlightStrategy =
        FocusHighlightStrategy.alwaysTraditional,
  );
  tearDown(
    () => FocusManager.instance.highlightStrategy =
        FocusHighlightStrategy.automatic,
  );

  group('navigation focus ring', () {
    test('the navigation ring sits 2px inside the tab; no other geometry '
        'changed', () {
      expect(GvPrimerFocusGeometry.navTab.offset, -2);
      expect(GvPrimerFocusGeometry.standard.offset, 3);
      expect(GvPrimerFocusGeometry.teamLink.offset, -2);
      expect(GvPrimerFocusGeometry.homeExplore.offset, -4);
      // Outer edge exactly on the tab edge: nothing leaves the tab.
      const Rect tab = Rect.fromLTWH(4, 782, 95.5, 62);
      expect(
        GvPrimerFocusGeometry.navTab.ringPath(tab).outerRect.inflate(1),
        tab,
      );
    });

    testWidgets('the whole ring is visible with ≥ 3:1 adjacent contrast: both '
        'themes, both viewports, insets 0 / 8 / 24, every destination', (
      WidgetTester tester,
    ) async {
      await loadArchivo(tester);
      final GlobalKey key = GlobalKey();
      for (final (ThemeData theme, Color ring) in <(ThemeData, Color)>[
        (buildGridViewDarkTheme(), GvPrimerPalette.ember400),
        (buildGridViewLightTheme(), GvPrimerPalette.graphite900),
      ]) {
        for (final NavConfig config in <NavConfig>[en390, es320]) {
          for (final double inset in <double>[0, 8, 24]) {
            for (int index = 0; index < 4; index++) {
              await pumpNav(
                tester,
                key,
                config: config,
                theme: theme,
                inset: inset,
              );
              final RingVisibility v = await measureRing(
                tester,
                key,
                config,
                index,
                GvPrimerFocusGeometry.navTab,
                ring,
              );
              final String where =
                  '${theme.brightness.name} ${config.size.width} inset $inset tab $index: $v';
              expect(v.fraction, 1.0, reason: where);
              expect(v.minContrast, greaterThanOrEqualTo(3), reason: where);
            }
          }
        }
      }
    });

    testWidgets('the superseded outward ring loses its bottom edge at zero '
        'inset (the defect this fixes)', (WidgetTester tester) async {
      await loadArchivo(tester);
      final GlobalKey key = GlobalKey();
      await pumpNav(
        tester,
        key,
        config: en390,
        theme: buildGridViewDarkTheme(),
        geometry: GvPrimerFocusGeometry.standard,
      );
      final RingVisibility v = await measureRing(
        tester,
        key,
        en390,
        3,
        GvPrimerFocusGeometry.standard,
        GvPrimerPalette.ember400,
      );
      expect(v.fraction, lessThan(0.9));
    });

    testWidgets('the ring keeps clear of the selected slab', (
      WidgetTester tester,
    ) async {
      await loadArchivo(tester);
      final GlobalKey key = GlobalKey();
      for (final NavConfig config in <NavConfig>[en390, es320]) {
        await pumpNav(
          tester,
          key,
          config: config,
          theme: buildGridViewDarkTheme(),
        );
        final Rect tab = tester.getRect(tabFinder(config.labels[0]));
        final Rect ringInner = GvPrimerFocusGeometry.navTab
            .ringPath(tab)
            .outerRect
            .deflate(1);
        final Finder slab = find.descendant(
          of: tabFinder(config.labels[0]),
          matching: find.byWidgetPredicate(
            (Widget w) => w is DecoratedBox && w.decoration is ShapeDecoration,
          ),
        );
        // The skewed slab reaches 32 · tan 12° / 2 beyond its box each side.
        final Rect box = tester.getRect(slab);
        final Rect slabBounds = Rect.fromLTRB(
          box.left - 3.41,
          box.top,
          box.right + 3.41,
          box.bottom,
        );
        expect(
          slabBounds.left - ringInner.left,
          greaterThanOrEqualTo(2),
          reason: '${config.size}',
        );
        expect(
          ringInner.right - slabBounds.right,
          greaterThanOrEqualTo(2),
          reason: '${config.size}',
        );
        expect(
          slabBounds.top - ringInner.top,
          greaterThanOrEqualTo(2),
          reason: '${config.size}',
        );
      }
    });

    testWidgets('targets and semantics are unchanged by the inward ring', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final GlobalKey key = GlobalKey();
      await pumpNav(
        tester,
        key,
        config: en390,
        theme: buildGridViewDarkTheme(),
      );
      final Size before = tester.getSize(tabFinder('Standings'));
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(tester.getSize(tabFinder('Standings')), before);
      expect(before.height, greaterThanOrEqualTo(56));
      expect(
        tester.getSemantics(tabFinder('Standings')),
        matchesSemantics(
          label: 'Standings',
          isButton: true,
          hasSelectedState: true,
          isFocusable: true,
          isFocused: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
          hasFocusAction: true,
        ),
      );
      handle.dispose();
    });
  });

  group('adaptive navigation height', () {
    testWidgets('one row: 68 at zero inset, 68 + inset otherwise; 2 × 2: '
        'content height + inset', (WidgetTester tester) async {
      await loadArchivo(tester);
      final GlobalKey key = GlobalKey();
      double navHeight() =>
          tester.getSize(find.byType(GvPrimerBottomNav)).height;

      await pumpNav(
        tester,
        key,
        config: en390,
        theme: buildGridViewDarkTheme(),
      );
      expect(navHeight(), 68);
      await pumpNav(
        tester,
        key,
        config: en390,
        theme: buildGridViewDarkTheme(),
        inset: 24,
      );
      expect(navHeight(), 92);

      await pumpNav(
        tester,
        key,
        config: es320,
        theme: buildGridViewDarkTheme(),
      );
      final double stackedContent = navHeight();
      await pumpNav(
        tester,
        key,
        config: es320,
        theme: buildGridViewDarkTheme(),
        inset: 24,
      );
      expect(navHeight(), stackedContent + 24);
      // Measured: 1 hairline + 4 top padding + 2 rows of 74 + 2 gap.
      expect(stackedContent, 155);
    });

    testWidgets('a focused body item scrolls clear of the 2 × 2 bar', (
      WidgetTester tester,
    ) async {
      final GlobalKey key = GlobalKey();
      await pumpNav(
        tester,
        key,
        config: es320,
        theme: buildGridViewDarkTheme(),
        inset: 24,
        body: ListView(
          children: <Widget>[
            for (int i = 0; i < 20; i++)
              GvPrimerFocusTarget(
                onActivate: () {},
                child: SizedBox(height: 56, child: Text('Item $i')),
              ),
          ],
        ),
      );
      final double navTop = tester.getRect(find.byType(GvPrimerBottomNav)).top;
      for (int i = 0; i < 12; i++) {
        await tester.sendKeyEvent(LogicalKeyboardKey.tab);
        await tester.pumpAndSettle();
      }
      final Rect focused = tester.getRect(
        find.ancestor(
          of: find.text('Item 11'),
          matching: find.byType(GvPrimerFocusTarget),
        ),
      );
      expect(focused.bottom, lessThanOrEqualTo(navTop));
    });
  });

  group('status icon progression (option B)', () {
    test('14px at 100%, 16px at 150%, 18px at 200%, capped at 18', () {
      expect(GvPrimerStatusChip.iconSizeFor(TextScaler.noScaling), 14);
      expect(
        GvPrimerStatusChip.iconSizeFor(const TextScaler.linear(1.5)),
        closeTo(16, 1e-9),
      );
      expect(
        GvPrimerStatusChip.iconSizeFor(const TextScaler.linear(2)),
        closeTo(18, 1e-9),
      );
      expect(GvPrimerStatusChip.iconSizeFor(const TextScaler.linear(3)), 18);
      expect(GvPrimerStatusChip.iconSizeFor(const TextScaler.linear(0.85)), 14);
    });

    test("follows the label's effective scale under non-linear scaling", () {
      // A non-linear scaler that enlarges 13px text by 1.75x, as Android does
      // more for small text than for large.
      const TextScaler nonLinear = _FixedSizeScaler(13, 22.75);
      expect(GvPrimerStatusChip.iconSizeFor(nonLinear), closeTo(17, 1e-9));
    });

    testWidgets('rendered at 100%, 150% and 200%: size, centring, semantics, '
        'label unchanged', (WidgetTester tester) async {
      await loadArchivo(tester);
      for (final (double scale, double expected) in <(double, double)>[
        (1, 14),
        (1.5, 16),
        (2, 18),
      ]) {
        final SemanticsHandle handle = tester.ensureSemantics();
        await tester.binding.setSurfaceSize(const Size(320, 693));
        await tester.pumpWidget(
          MaterialApp(
            theme: buildGridViewDarkTheme(),
            home: MediaQuery.withClampedTextScaling(
              minScaleFactor: scale,
              maxScaleFactor: scale,
              child: const Scaffold(
                body: Center(
                  child: SizedBox(
                    width: 200,
                    child: Wrap(
                      children: <Widget>[
                        GvPrimerStatusChip(
                          label: 'Cancelled',
                          kind: GvPrimerChipKind.cancelled,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        expect(tester.takeException(), isNull);
        expect(
          tester.getSize(find.byType(GvPrimerIcon)),
          Size.square(expected),
        );
        expect(
          (tester.getCenter(find.byType(GvPrimerIcon)).dy -
                  tester.getCenter(find.text('Cancelled')).dy)
              .abs(),
          lessThan(1),
        );
        final Text label = tester.widget<Text>(find.text('Cancelled'));
        expect(label.style!.fontSize, 13);
        expect(label.style!.fontWeight, FontWeight.w600);
        expect(
          tester.getSemantics(find.byType(GvPrimerStatusChip)),
          matchesSemantics(label: 'Cancelled'),
        );
        handle.dispose();
      }
      await tester.binding.setSurfaceSize(null);
    });
  });

  group('Primer glyphs', () {
    Future<(ByteData, int)> render(
      WidgetTester tester,
      GvPrimerGlyph glyph,
    ) async {
      final GlobalKey key = GlobalKey();
      await tester.pumpWidget(
        Center(
          child: RepaintBoundary(
            key: key,
            child: ColoredBox(
              color: const Color(0xFFFFFFFF),
              child: GvPrimerIcon(
                glyph,
                size: 48,
                color: const Color(0xFF000000),
              ),
            ),
          ),
        ),
      );
      late ByteData bytes;
      late int width;
      await tester.runAsync(() async {
        final ui.Image image =
            await (key.currentContext!.findRenderObject()!
                    as RenderRepaintBoundary)
                .toImage();
        width = image.width;
        bytes = (await image.toByteData())!;
        image.dispose();
      });
      return (bytes, width);
    }

    bool inked(ByteData b, int w, double x24, double y24) {
      final int x = (x24 * 2).round();
      final int y = (y24 * 2).round();
      return b.getUint8((y * w + x) * 4) < 128;
    }

    testWidgets('ban: the diagonal runs top-left to bottom-right', (
      WidgetTester tester,
    ) async {
      final (ByteData b, int w) = await render(tester, GvPrimerGlyph.ban);
      expect(inked(b, w, 8, 8), isTrue);
      expect(inked(b, w, 16, 16), isTrue);
      expect(inked(b, w, 16, 8), isFalse);
      expect(inked(b, w, 8, 16), isFalse);
      expect(inked(b, w, 12, 2), isTrue, reason: 'circle');
    });

    testWidgets('standings: three bars, short-tall-medium, from the baseline', (
      WidgetTester tester,
    ) async {
      final (ByteData b, int w) = await render(tester, GvPrimerGlyph.standings);
      expect(inked(b, w, 6, 19), isTrue);
      expect(inked(b, w, 6, 12), isFalse);
      expect(inked(b, w, 12, 5), isTrue);
      expect(inked(b, w, 18, 11), isTrue);
      expect(inked(b, w, 18, 7), isFalse);
      expect(inked(b, w, 9, 15), isFalse, reason: 'gap between bars');
    });

    testWidgets('Primer navigation uses the bar glyph for Standings; the chip '
        'uses the ban glyph for Cancelled', (WidgetTester tester) async {
      final GlobalKey key = GlobalKey();
      await pumpNav(
        tester,
        key,
        config: en390,
        theme: buildGridViewLightTheme(),
      );
      final GvPrimerIcon standings = tester.widget<GvPrimerIcon>(
        find.descendant(
          of: tabFinder('Standings'),
          matching: find.byType(GvPrimerIcon),
        ),
      );
      expect(standings.glyph, GvPrimerGlyph.standings);
      expect(standings.size, 24);
      expect(standings.strokeWidth, GvPrimerIconStroke.regular);
      expect(find.byIcon(Icons.emoji_events_outlined), findsNothing);

      await tester.pumpWidget(
        MaterialApp(
          theme: buildGridViewDarkTheme(),
          home: const Scaffold(
            body: Wrap(
              children: <Widget>[
                GvPrimerStatusChip(
                  label: 'Cancelled',
                  kind: GvPrimerChipKind.cancelled,
                ),
              ],
            ),
          ),
        ),
      );
      final GvPrimerIcon ban = tester.widget<GvPrimerIcon>(
        find.byType(GvPrimerIcon),
      );
      expect(ban.glyph, GvPrimerGlyph.ban);
      expect(ban.strokeWidth, GvPrimerIconStroke.small);
      expect(find.byIcon(Icons.block), findsNothing);
    });
  });
}

/// Maps exactly one font size to a given scaled size; others scale linearly
/// by the same factor. Enough to stand in for Android's non-linear scaler.
class _FixedSizeScaler extends TextScaler {
  const _FixedSizeScaler(this.from, this.to);
  final double from;
  final double to;

  @override
  double scale(double fontSize) =>
      fontSize == from ? to : fontSize * (to / from);

  @override
  // ignore: deprecated_member_use
  double get textScaleFactor => to / from;

  @override
  TextScaler clamp({
    double minScaleFactor = 0,
    double maxScaleFactor = double.infinity,
  }) => this;
}
