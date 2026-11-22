import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/dev/catalogue/component_catalogue_screen.dart';
import 'package:gridview/features/dev/catalogue/primer_catalogue_section.dart';
import 'package:gridview/l10n/app_localizations.dart';

import '../support/primer_fonts.dart';

/// Step 55B.1: surface contexts, status chips, the outline painter and the
/// focus primitives.

/// Pumps [child] in a minimal app on the [theme] (Dark by default).
Future<void> pumpPrimer(
  WidgetTester tester,
  Widget child, {
  ThemeData? theme,
  double textScale = 1,
  bool disableAnimations = false,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: theme ?? buildGridViewDarkTheme(),
      // A re-pump with another theme must not animate from the previous one.
      themeAnimationDuration: Duration.zero,
      home: MediaQuery.withClampedTextScaling(
        minScaleFactor: textScale,
        maxScaleFactor: textScale,
        child: Builder(
          builder: (BuildContext context) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(disableAnimations: disableAnimations),
            child: Scaffold(body: Center(child: child)),
          ),
        ),
      ),
    ),
  );
}

/// Captures the surface data a descendant resolves.
class _Probe extends StatelessWidget {
  const _Probe(this.onData);

  final void Function(GvPrimerSurfaceData) onData;

  @override
  Widget build(BuildContext context) {
    onData(GvPrimerSurface.of(context));
    return const SizedBox();
  }
}

Future<GvPrimerSurfaceData> resolve(
  WidgetTester tester,
  Widget Function(Widget probe) wrap, {
  ThemeData? theme,
}) async {
  late GvPrimerSurfaceData data;
  await pumpPrimer(
    tester,
    wrap(_Probe((GvPrimerSurfaceData d) => data = d)),
    theme: theme,
  );
  return data;
}

GvPrimerOutlinePainter? outlineOf(WidgetTester tester, Finder chip) {
  final Iterable<CustomPaint> paints = tester.widgetList<CustomPaint>(
    find.descendant(of: chip, matching: find.byType(CustomPaint)),
  );
  for (final CustomPaint p in paints) {
    if (p.foregroundPainter is GvPrimerOutlinePainter) {
      return p.foregroundPainter! as GvPrimerOutlinePainter;
    }
  }
  return null;
}

GvPrimerFocusRingPainter ringOf(WidgetTester tester, [Finder? within]) {
  final Finder paints = find.descendant(
    of: within ?? find.byType(GvPrimerFocusRing),
    matching: find.byType(CustomPaint),
  );
  return tester
          .widgetList<CustomPaint>(paints)
          .firstWhere(
            (CustomPaint p) => p.foregroundPainter is GvPrimerFocusRingPainter,
          )
          .foregroundPainter!
      as GvPrimerFocusRingPainter;
}

/// Renders the [key]ed boundary and returns its RGBA bytes and width.
Future<(ByteData, int)> capture(WidgetTester tester, GlobalKey key) async {
  late ByteData bytes;
  late int width;
  await tester.runAsync(() async {
    final RenderRepaintBoundary boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final ui.Image image = await boundary.toImage();
    width = image.width;
    bytes = (await image.toByteData())!;
    image.dispose();
  });
  return (bytes, width);
}

Color pixel(ByteData bytes, int width, int x, int y) {
  final int i = (y * width + x) * 4;
  return Color.fromARGB(
    bytes.getUint8(i + 3),
    bytes.getUint8(i),
    bytes.getUint8(i + 1),
    bytes.getUint8(i + 2),
  );
}

void main() {
  group('surface contexts', () {
    testWidgets('no surface: the active theme page', (
      WidgetTester tester,
    ) async {
      final GvPrimerSurfaceData d = await resolve(
        tester,
        (Widget p) => p,
        theme: buildGridViewLightTheme(),
      );
      expect(d.kind, GvPrimerSurfaceKind.page);
      expect(d.roles, same(GvPrimerRoles.light));
      expect(d.foreground, GvPrimerPalette.graphite900);
      expect(d.focusRing, GvPrimerPalette.graphite900);
    });

    testWidgets('Dark and Light pages from explicit preview roles, without '
        'ThemeData', (WidgetTester tester) async {
      for (final (GvPrimerRoles roles, Color text, Color ring)
          in <(GvPrimerRoles, Color, Color)>[
            (
              GvPrimerRoles.dark,
              GvPrimerPalette.chalk100,
              GvPrimerPalette.ember400,
            ),
            (
              GvPrimerRoles.light,
              GvPrimerPalette.graphite900,
              GvPrimerPalette.graphite900,
            ),
          ]) {
        final GvPrimerSurfaceData d = await resolve(
          tester,
          (Widget p) => GvPrimerSurface(
            kind: GvPrimerSurfaceKind.page,
            roles: roles,
            child: p,
          ),
        );
        expect(d.roles, same(roles));
        expect(d.foreground, text);
        expect(d.focusRing, ring);
      }
      // No nested Theme was introduced.
      expect(find.byType(Theme), findsOneWidget);
    });

    testWidgets('inverse plane: Dark Chalk plane, Light Graphite plane', (
      WidgetTester tester,
    ) async {
      final GvPrimerSurfaceData dark = await resolve(
        tester,
        (Widget p) =>
            GvPrimerSurface(kind: GvPrimerSurfaceKind.inverse, child: p),
      );
      expect(dark.foreground, GvPrimerPalette.graphite900);
      expect(dark.focusRing, GvPrimerPalette.oxide600);
      expect(dark.statusKnown.color, GvPrimerRoles.dark.line.statusInverse);

      final GvPrimerSurfaceData light = await resolve(
        tester,
        (Widget p) =>
            GvPrimerSurface(kind: GvPrimerSurfaceKind.inverse, child: p),
        theme: buildGridViewLightTheme(),
      );
      expect(light.foreground, GvPrimerPalette.chalk100);
      expect(light.focusRing, GvPrimerPalette.ember400);
      expect(light.statusKnown.color, GvPrimerRoles.light.line.statusInverse);
    });

    testWidgets('Light Graphite GP heading resolves the Dark roles', (
      WidgetTester tester,
    ) async {
      final GvPrimerSurfaceData d = await resolve(
        tester,
        (Widget p) =>
            GvPrimerSurface(kind: GvPrimerSurfaceKind.graphiteBand, child: p),
        theme: buildGridViewLightTheme(),
      );
      expect(d.roles, same(GvPrimerRoles.dark));
      expect(d.themeRoles, same(GvPrimerRoles.light));
      expect(d.statusUnknown.color, GvPrimerRoles.dark.line.unknown);
    });

    testWidgets('Red Oxide surface: Chalk content and ring, enclosing roles '
        'kept', (WidgetTester tester) async {
      final GvPrimerSurfaceData onLightPage = await resolve(
        tester,
        (Widget p) =>
            GvPrimerSurface(kind: GvPrimerSurfaceKind.brand, child: p),
        theme: buildGridViewLightTheme(),
      );
      expect(onLightPage.roles, same(GvPrimerRoles.light));
      expect(onLightPage.foreground, GvPrimerPalette.chalk100);
      expect(onLightPage.focusRing, GvPrimerPalette.chalk100);

      final GvPrimerSurfaceData inGraphiteBand = await resolve(
        tester,
        (Widget p) => GvPrimerSurface(
          kind: GvPrimerSurfaceKind.graphiteBand,
          child: GvPrimerSurface(kind: GvPrimerSurfaceKind.brand, child: p),
        ),
        theme: buildGridViewLightTheme(),
      );
      expect(inGraphiteBand.roles, same(GvPrimerRoles.dark));
      expect(inGraphiteBand.focusRing, GvPrimerPalette.chalk100);
    });

    testWidgets('a nested scope resolves from the theme, not the outer scope', (
      WidgetTester tester,
    ) async {
      final GvPrimerSurfaceData d = await resolve(
        tester,
        (Widget p) => GvPrimerSurface(
          kind: GvPrimerSurfaceKind.page,
          roles: GvPrimerRoles.light,
          child: GvPrimerSurface(
            kind: GvPrimerSurfaceKind.inverse,
            child: GvPrimerSurface(kind: GvPrimerSurfaceKind.page, child: p),
          ),
        ),
      );
      // Back on the page of the explicit Light preview, not the Dark app.
      expect(d.roles, same(GvPrimerRoles.light));
    });
  });

  group('status chips', () {
    Finder chip(String label) => find.ancestor(
      of: find.text(label),
      matching: find.byType(GvPrimerStatusChip),
    );

    testWidgets('known states are solid, unknown is dashed, alert is solid', (
      WidgetTester tester,
    ) async {
      await pumpPrimer(
        tester,
        const Wrap(
          children: <Widget>[
            GvPrimerStatusChip(label: 'Upcoming', kind: GvPrimerChipKind.known),
            GvPrimerStatusChip(
              label: 'Provisional',
              kind: GvPrimerChipKind.known,
            ),
            GvPrimerStatusChip(
              label: 'Completed',
              kind: GvPrimerChipKind.completed,
            ),
            GvPrimerStatusChip(
              label: 'Status unknown',
              kind: GvPrimerChipKind.unknown,
            ),
            GvPrimerStatusChip(
              label: 'Cancelled',
              kind: GvPrimerChipKind.cancelled,
            ),
            GvPrimerStatusChip(
              label: 'Postponed',
              kind: GvPrimerChipKind.postponed,
            ),
          ],
        ),
      );
      final GvPrimerRoles dark = GvPrimerRoles.dark;
      for (final String label in <String>[
        'Upcoming',
        'Provisional',
        'Completed',
      ]) {
        final GvPrimerOutlinePainter p = outlineOf(tester, chip(label))!;
        expect(p.outline.dashed, isFalse, reason: label);
        expect(p.outline.color, dark.line.status, reason: label);
        expect(p.strokeWidth, 1.5);
        expect(p.radius, 8);
      }
      final GvPrimerOutlinePainter unknown = outlineOf(
        tester,
        chip('Status unknown'),
      )!;
      expect(unknown.outline.dashed, isTrue);
      expect(unknown.outline.color, dark.line.unknown);
      for (final String label in <String>['Cancelled', 'Postponed']) {
        final GvPrimerOutlinePainter p = outlineOf(tester, chip(label))!;
        expect(p.outline.dashed, isFalse);
        expect(p.outline.color, dark.line.unknown);
      }
      // No dagger anywhere (VS-2 rejected).
      expect(find.textContaining('†'), findsNothing);
    });

    testWidgets('icons follow the approved vocabulary', (
      WidgetTester tester,
    ) async {
      await pumpPrimer(
        tester,
        const Wrap(
          children: <Widget>[
            GvPrimerStatusChip(label: 'Upcoming', kind: GvPrimerChipKind.known),
            GvPrimerStatusChip(
              label: 'Completed',
              kind: GvPrimerChipKind.completed,
            ),
            GvPrimerStatusChip(
              label: 'Final',
              kind: GvPrimerChipKind.finalResult,
            ),
            GvPrimerStatusChip(
              label: 'Cancelled',
              kind: GvPrimerChipKind.cancelled,
            ),
            GvPrimerStatusChip(
              label: 'Postponed',
              kind: GvPrimerChipKind.postponed,
            ),
          ],
        ),
      );
      IconData? iconOf(String label) {
        final Finder icons = find.descendant(
          of: chip(label),
          matching: find.byType(Icon),
        );
        return icons.evaluate().isEmpty
            ? null
            : tester.widget<Icon>(icons).icon;
      }

      expect(iconOf('Upcoming'), isNull);
      expect(iconOf('Completed'), Icons.check_rounded);
      expect(iconOf('Final'), Icons.check_rounded);
      // Cancelled uses the prototype's ban glyph, not Material's `block`
      // (opposite diagonal; Step 55B.2.1).
      expect(iconOf('Cancelled'), isNull);
      expect(
        tester
            .widget<GvPrimerIcon>(
              find.descendant(
                of: chip('Cancelled'),
                matching: find.byType(GvPrimerIcon),
              ),
            )
            .glyph,
        GvPrimerGlyph.ban,
      );
      expect(iconOf('Postponed'), Icons.pause_circle_outline);
    });

    testWidgets('filled chips: Final, Live and context resolve per theme', (
      WidgetTester tester,
    ) async {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[
        GvPrimerRoles.dark,
        GvPrimerRoles.light,
      ]) {
        await pumpPrimer(
          tester,
          GvPrimerSurface(
            kind: GvPrimerSurfaceKind.page,
            roles: roles,
            child: const Wrap(
              children: <Widget>[
                GvPrimerStatusChip(
                  label: 'Final',
                  kind: GvPrimerChipKind.finalResult,
                ),
                GvPrimerStatusChip(label: 'Live', kind: GvPrimerChipKind.live),
                GvPrimerStatusChip(
                  label: 'Sprint weekend',
                  kind: GvPrimerChipKind.context,
                ),
              ],
            ),
          ),
        );
        Color fillOf(String label) =>
            (tester
                        .widget<DecoratedBox>(
                          find
                              .descendant(
                                of: chip(label),
                                matching: find.byType(DecoratedBox),
                              )
                              .first,
                        )
                        .decoration
                    as BoxDecoration)
                .color!;
        Color textOf(String label) =>
            tester.widget<Text>(find.text(label)).style!.color!;

        expect(fillOf('Final'), roles.fill.finalChip.fill);
        expect(textOf('Final'), roles.fill.finalChip.on);
        expect(fillOf('Live'), roles.fill.live.fill);
        expect(textOf('Live'), roles.fill.live.on);
        expect(fillOf('Sprint weekend'), roles.surface.raised);
        expect(outlineOf(tester, chip('Final')), isNull);
      }
    });

    testWidgets('nested contexts: Light GP band and Dark leader plane', (
      WidgetTester tester,
    ) async {
      await pumpPrimer(
        tester,
        const GvPrimerSurface(
          kind: GvPrimerSurfaceKind.graphiteBand,
          child: Wrap(
            children: <Widget>[
              GvPrimerStatusChip(
                label: 'Status unknown',
                kind: GvPrimerChipKind.unknown,
              ),
              GvPrimerStatusChip(
                label: 'Final',
                kind: GvPrimerChipKind.finalResult,
              ),
            ],
          ),
        ),
        theme: buildGridViewLightTheme(),
      );
      // Inside the Graphite band: Dark values (token map §6 example).
      expect(
        outlineOf(tester, chip('Status unknown'))!.outline.color,
        GvPrimerRoles.dark.line.unknown,
      );
      expect(
        tester.widget<Text>(find.text('Status unknown')).style!.color,
        GvPrimerPalette.chalk100,
      );
      expect(
        tester.widget<Text>(find.text('Final')).style!.color,
        GvPrimerPalette.graphite900,
      );

      await pumpPrimer(
        tester,
        const GvPrimerSurface(
          kind: GvPrimerSurfaceKind.inverse,
          child: GvPrimerStatusChip(
            label: 'Provisional',
            kind: GvPrimerChipKind.known,
          ),
        ),
      );
      expect(
        outlineOf(tester, chip('Provisional'))!.outline.color,
        GvPrimerRoles.dark.line.statusInverse,
      );
      expect(
        tester.widget<Text>(find.text('Provisional')).style!.color,
        GvPrimerPalette.graphite900,
      );
    });

    testWidgets('one semantics node carrying the word only', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpPrimer(
        tester,
        const GvPrimerStatusChip(
          label: 'Completed',
          kind: GvPrimerChipKind.completed,
        ),
      );
      expect(
        tester.getSemantics(find.byType(GvPrimerStatusChip)),
        matchesSemantics(label: 'Completed'),
      );
      handle.dispose();
    });

    testWidgets('long labels wrap at 200% text without overflow; the outline '
        'follows the chip', (WidgetTester tester) async {
      await loadArchivo(tester);
      for (final double scale in <double>[1, 2]) {
        await pumpPrimer(
          tester,
          const SizedBox(
            width: 140,
            child: Wrap(
              children: <Widget>[
                GvPrimerStatusChip(
                  label: 'Formato desconocido',
                  kind: GvPrimerChipKind.unknown,
                ),
              ],
            ),
          ),
          textScale: scale,
        );
        expect(tester.takeException(), isNull);
        final Size size = tester.getSize(find.byType(GvPrimerStatusChip));
        expect(size.width, lessThanOrEqualTo(140));
        expect(size.height, greaterThanOrEqualTo(30));
        final RenderBox paintBox = tester.renderObject<RenderBox>(
          find
              .descendant(
                of: find.byType(GvPrimerStatusChip),
                matching: find.byType(CustomPaint),
              )
              .first,
        );
        expect(paintBox.size, size);
        if (scale == 2) {
          // 2 lines of 13px × 2 × 1.2 plus padding and stroke.
          expect(size.height, greaterThan(2 * 13 * 2 * 1.2));
        }
      }
    });
  });

  group('outline painter', () {
    test('dashes fit a whole number of cycles on any perimeter', () {
      const GvPrimerOutlinePainter p = GvPrimerOutlinePainter(
        outline: GvPrimerOutline(color: Color(0xFF000000), dashed: true),
        radius: 8,
      );
      for (final double length in <double>[37, 100, 213.7, 640.2]) {
        final ({int count, double dash, double gap}) fit = p.fitDashes(length);
        expect(fit.count * (fit.dash + fit.gap), closeTo(length, 1e-9));
        expect(fit.dash / fit.gap, closeTo(1, 1e-9));
        expect(fit.dash, closeTo(2.5, 0.5));
      }
    });

    test('the stroke lies inside the box and follows the outer radius', () {
      const GvPrimerOutlinePainter p = GvPrimerOutlinePainter(
        outline: GvPrimerOutline(color: Color(0xFF000000), dashed: false),
        radius: 8,
      );
      final RRect r = p.strokePath(const Size(100, 30));
      expect(r.left, 0.75);
      expect(r.top, 0.75);
      expect(r.right, 99.25);
      expect(r.tlRadiusX, 7.25);
    });

    testWidgets('rendered: the dashed edge alternates, the solid edge is '
        'continuous', (WidgetTester tester) async {
      final GlobalKey solidKey = GlobalKey();
      final GlobalKey dashedKey = GlobalKey();
      Widget box(GlobalKey key, bool dashed) => RepaintBoundary(
        key: key,
        child: CustomPaint(
          size: const Size(120, 30),
          painter: GvPrimerOutlinePainter(
            outline: GvPrimerOutline(
              color: const Color(0xFFFFFFFF),
              dashed: dashed,
            ),
            radius: 8,
          ),
        ),
      );
      await pumpPrimer(
        tester,
        ColoredBox(
          color: const Color(0xFF000000),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[box(solidKey, false), box(dashedKey, true)],
          ),
        ),
      );
      int transitions(ByteData bytes, int width) {
        int count = 0;
        bool? last;
        for (int x = 12; x < 108; x++) {
          final bool on = pixel(bytes, width, x, 0).a > 0.5;
          if (last != null && on != last) count++;
          last = on;
        }
        return count;
      }

      final (ByteData solid, int sw) = await capture(tester, solidKey);
      final (ByteData dashed, int dw) = await capture(tester, dashedKey);
      expect(transitions(solid, sw), 0);
      // 96px of edge at a ~5px period: about 38 transitions.
      expect(transitions(dashed, dw), greaterThan(25));
    });
  });

  group('focus indicator', () {
    testWidgets('keyboard focus shows the ring; Enter and Space activate; '
        'touch hides it', (WidgetTester tester) async {
      int activations = 0;
      await pumpPrimer(
        tester,
        GvPrimerFocusTarget(
          onActivate: () => activations++,
          child: const SizedBox(width: 48, height: 48),
        ),
      );
      expect(ringOf(tester).visible, isFalse);

      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(ringOf(tester).visible, isTrue);

      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();
      expect(activations, 2);

      await tester.tap(find.byType(GvPrimerFocusTarget));
      await tester.pump();
      expect(activations, 3);
      expect(ringOf(tester).visible, isFalse);
    });

    testWidgets('focus never changes the target size', (
      WidgetTester tester,
    ) async {
      await pumpPrimer(
        tester,
        GvPrimerFocusTarget(
          onActivate: () {},
          child: const SizedBox(width: 48, height: 48),
        ),
      );
      final Size before = tester.getSize(find.byType(GvPrimerFocusTarget));
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(tester.getSize(find.byType(GvPrimerFocusTarget)), before);
      expect(before, const Size(48, 48));
    });

    testWidgets('semantics: one node with role, label and tap action', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpPrimer(
        tester,
        GvPrimerFocusTarget(
          role: GvPrimerTargetRole.link,
          onActivate: () {},
          child: const SizedBox(height: 48, child: Text('Drivers')),
        ),
      );
      expect(
        tester.getSemantics(find.byType(GvPrimerFocusTarget)),
        matchesSemantics(
          label: 'Drivers',
          isLink: true,
          isFocusable: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
          hasFocusAction: true,
        ),
      );
      handle.dispose();
    });

    testWidgets('ring colour follows the surface it is drawn on', (
      WidgetTester tester,
    ) async {
      Future<Color> ringIn(GvPrimerSurfaceKind kind, ThemeData theme) async {
        await pumpPrimer(
          tester,
          GvPrimerSurface(
            kind: kind,
            child: const GvPrimerFocusRing(
              visible: true,
              child: SizedBox(width: 40, height: 40),
            ),
          ),
          theme: theme,
        );
        return ringOf(tester).color;
      }

      final ThemeData dark = buildGridViewDarkTheme();
      final ThemeData light = buildGridViewLightTheme();
      expect(
        await ringIn(GvPrimerSurfaceKind.page, dark),
        GvPrimerPalette.ember400,
      );
      expect(
        await ringIn(GvPrimerSurfaceKind.page, light),
        GvPrimerPalette.graphite900,
      );
      expect(
        await ringIn(GvPrimerSurfaceKind.brand, dark),
        GvPrimerPalette.chalk100,
      );
      expect(
        await ringIn(GvPrimerSurfaceKind.brand, light),
        GvPrimerPalette.chalk100,
      );
      expect(
        await ringIn(GvPrimerSurfaceKind.inverse, dark),
        GvPrimerPalette.oxide600,
      );
      expect(
        await ringIn(GvPrimerSurfaceKind.inverse, light),
        GvPrimerPalette.ember400,
      );
      expect(
        await ringIn(GvPrimerSurfaceKind.graphiteBand, light),
        GvPrimerPalette.ember400,
      );
    });

    testWidgets('contextual backing is painted in Light only', (
      WidgetTester tester,
    ) async {
      for (final (ThemeData theme, bool expected) in <(ThemeData, bool)>[
        (buildGridViewDarkTheme(), false),
        (buildGridViewLightTheme(), true),
      ]) {
        await pumpPrimer(
          tester,
          const GvPrimerFocusRing(
            visible: true,
            backingSurface: Color(0xFFF7F7F8),
            geometry: GvPrimerFocusGeometry.selector,
            child: SizedBox(width: 60, height: 40),
          ),
          theme: theme,
        );
        expect(ringOf(tester).backing != null, expected);
      }
    });

    test('approved geometries: inward rings stay inside the control', () {
      const Rect bounds = Rect.fromLTWH(0, 0, 100, 48);
      // XT-1: centre 3px in, outer edge 2px inside the link.
      expect(
        GvPrimerFocusGeometry.homeExplore.ringPath(bounds).outerRect,
        bounds.deflate(3),
      );
      // LT-17: centre 1px in, outer edge on the link edge.
      expect(
        GvPrimerFocusGeometry.teamLink.ringPath(bounds).outerRect,
        bounds.deflate(1),
      );
      expect(
        GvPrimerFocusGeometry.standard.ringPath(bounds).outerRect,
        bounds.inflate(4),
      );
      // XT-4: back button 3px Dark, 1px Light.
      expect(
        GvPrimerFocusGeometry.backButton(
          GvPrimerRoles.dark,
        ).ringPath(bounds).outerRect,
        bounds.inflate(4),
      );
      expect(
        GvPrimerFocusGeometry.backButton(
          GvPrimerRoles.light,
        ).ringPath(bounds).outerRect,
        bounds.inflate(2),
      );
    });

    testWidgets('rendered: the ring is painted above the control decoration', (
      WidgetTester tester,
    ) async {
      final GlobalKey key = GlobalKey();
      await pumpPrimer(
        tester,
        RepaintBoundary(
          key: key,
          child: const GvPrimerFocusRing(
            visible: true,
            geometry: GvPrimerFocusGeometry.row,
            color: Color(0xFFFF0000),
            child: ColoredBox(
              color: Color(0xFF0000FF),
              child: SizedBox(width: 80, height: 48),
            ),
          ),
        ),
      );
      final (ByteData bytes, int width) = await capture(tester, key);
      // Row ring spans 1px to 3px inside the edge: x = 2 is ring, x = 10 is fill.
      expect(pixel(bytes, width, 2, 24), const Color(0xFFFF0000));
      expect(pixel(bytes, width, 10, 24), const Color(0xFF0000FF));
    });

    testWidgets('reduced motion: the ring appears at once with no animation', (
      WidgetTester tester,
    ) async {
      await pumpPrimer(
        tester,
        GvPrimerFocusTarget(
          onActivate: () {},
          child: const SizedBox(width: 48, height: 48),
        ),
        disableAnimations: true,
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(ringOf(tester).visible, isTrue);
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('a disabled target is not focusable and shows no ring', (
      WidgetTester tester,
    ) async {
      await pumpPrimer(
        tester,
        const GvPrimerFocusTarget(
          onActivate: null,
          child: SizedBox(width: 48, height: 48),
        ),
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(ringOf(tester).visible, isFalse);
    });
  });

  group('catalogue', () {
    testWidgets('both theme panels render at 320 and 200% text without '
        'overflow', (WidgetTester tester) async {
      await loadArchivo(tester);
      await tester.binding.setSurfaceSize(const Size(320, 4000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      for (final double scale in <double>[1, 2]) {
        for (final GvPrimerRoles roles in <GvPrimerRoles>[
          GvPrimerRoles.dark,
          GvPrimerRoles.light,
        ]) {
          await tester.pumpWidget(
            MaterialApp(
              theme: buildGridViewDarkTheme(),
              home: MediaQuery.withClampedTextScaling(
                minScaleFactor: scale,
                maxScaleFactor: scale,
                child: Scaffold(
                  body: SingleChildScrollView(
                    child: PrimerThemePanel(name: 'x', roles: roles),
                  ),
                ),
              ),
            ),
          );
          expect(
            tester.takeException(),
            isNull,
            reason: 'scale $scale ${roles.brightness}',
          );
        }
      }
    });

    testWidgets('the catalogue ends with the Primer V2 section', (
      WidgetTester tester,
    ) async {
      // Same harness as component_catalogue_test.dart: its size, reduced
      // motion (skeletons never settle) and its one known 58px overflow.
      await tester.binding.setSurfaceSize(const Size(420, 2400));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        MaterialApp(
          theme: buildGridViewDarkTheme(),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (BuildContext context) => MediaQuery(
              data: MediaQuery.of(context).copyWith(disableAnimations: true),
              child: const ComponentCatalogueScreen(),
            ),
          ),
        ),
      );
      await tester.pump();
      final Object? known = tester.takeException();
      if (known != null) {
        expect(known.toString(), contains('overflowed by 58 pixels'));
      }
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey<String>('primer-panel-Light')),
        600,
        scrollable: find.byType(Scrollable).first,
      );
      expect(tester.takeException(), isNull);
      expect(find.byType(PrimerCatalogueSection), findsOneWidget);
    });
  });
}
