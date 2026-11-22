import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/shared/domain/fixture_data_identity.dart';
import 'package:gridview/features/shared/presentation/widgets/environment_badge.dart';
import 'package:gridview/features/shared/presentation/widgets/mock_data_banner.dart';

import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

/// The Primer V2 environment strip, environment badge and fixture-data banner
/// (Step 55C.15).
///
/// The environment logic is unchanged and covered by
/// `environment_badge_test.dart` and `environment_badge_layout_test.dart`;
/// this file checks the Primer presentation: roles in both themes, geometry,
/// semantics, enlarged text and coexistence with the bottom navigation.

final Finder _strip = find.byKey(
  const ValueKey<String>('environment-badge-strip'),
);
final Finder _badge = find.byType(GvEnvironmentBadge);
final Finder _banner = find.byType(MockDataBanner);
final Finder _nav = find.byType(GvPrimerBottomNav);

const List<AppThemePreference> _themes = <AppThemePreference>[
  AppThemePreference.dark,
  AppThemePreference.light,
];

Future<void> _open(
  WidgetTester tester, {
  String location = '/',
  AppEnvironment environment = AppEnvironment.development,
  bool badge = true,
  bool mockData = false,
  FixtureDataIdentity? fixtureData,
  AppThemePreference theme = AppThemePreference.dark,
  Locale locale = const Locale('en'),
  Size size = const Size(390, 844),
  double textScale = 1,
  EdgeInsets padding = EdgeInsets.zero,
}) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  await loadArchivo(tester);
  await pumpApp(
    tester,
    initialLocation: location,
    environment: environment,
    environmentBadge: badge,
    mockData: mockData,
    fixtureData: fixtureData,
    surfaceSize: size,
    textScale: textScale,
    locale: locale,
    padding: padding,
    disableAnimations: true,
    preferences: AppPreferences.defaults.copyWith(theme: theme),
  );
}

GvPrimerRoles _roles(WidgetTester tester, Finder at) =>
    GvPrimerSurface.of(tester.element(at)).roles;

GvPrimerOutlinePainter _outline(WidgetTester tester) => tester
    .widgetList<CustomPaint>(
      find.descendant(of: _badge, matching: find.byType(CustomPaint)),
    )
    .map((CustomPaint p) => p.foregroundPainter)
    .whereType<GvPrimerOutlinePainter>()
    .single;

void main() {
  group('environment badge and strip', () {
    for (final AppThemePreference theme in _themes) {
      testWidgets(
        '${theme.name}: continuous text.secondary pill (D3), Archivo 13/700 '
        'in text.primary, strip on the page surface',
        (WidgetTester tester) async {
          await _open(tester, theme: theme);
          final GvPrimerRoles roles = _roles(tester, _badge);
          final GvPrimerOutlinePainter outline = _outline(tester);
          // Owner decision D3: never dashed, which means "unknown value".
          expect(outline.outline.dashed, isFalse);
          expect(outline.outline.color, roles.text.secondary);
          expect(outline.strokeWidth, GvPrimerMetrics.statusOutlineWidth);
          final Text label = tester.widget<Text>(
            find.descendant(of: _badge, matching: find.text('DEV')),
          );
          expect(label.style!.fontFamily, GvPrimerFonts.archivo);
          expect(label.style!.fontSize, 13);
          expect(label.style!.fontWeight, FontWeight.w700);
          expect(label.style!.height, 1.3);
          expect(label.style!.letterSpacing, closeTo(0.26, 1e-9));
          expect(label.style!.color, roles.text.primary);
          expect(label.style!.decoration, isNull);
          expect(tester.widget<Material>(_strip).color, roles.surface.page);
        },
      );
    }

    testWidgets('DEV and STAGING are distinguished by their text', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      expect(find.text('DEV'), findsOneWidget);
      await _open(tester, environment: AppEnvironment.staging);
      expect(find.text('STAGING'), findsOneWidget);
      expect(find.text('DEV'), findsNothing);
    });

    testWidgets('production renders no strip and no badge', (
      WidgetTester tester,
    ) async {
      await _open(tester, environment: AppEnvironment.production);
      expect(_strip, findsNothing);
      expect(find.text('PRODUCTION'), findsNothing);
      expect(find.byType(EnvironmentBadgeOverlay), findsOneWidget);
    });

    testWidgets('one semantics node: "Build environment: DEV", read once', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester);
      expect(find.bySemanticsLabel('Build environment: DEV'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp(r'^DEV$')), findsNothing);
      handle.dispose();
    });

    for (final (double inset, double top) in <(double, double)>[
      (0, 6),
      (24, 24),
    ]) {
      testWidgets('top inset $inset: badge at max(6, inset), 2 × 10 padding '
          'inside the 1.5px outline, 6px below', (WidgetTester tester) async {
        await _open(tester, padding: EdgeInsets.only(top: inset));
        final Rect strip = tester.getRect(_strip);
        final Rect badge = tester.getRect(_badge);
        final Rect text = tester.getRect(find.text('DEV'));
        expect(strip.top, 0);
        expect(badge.top, closeTo(top, 0.01));
        expect(strip.bottom - badge.bottom, closeTo(6, 0.01));
        expect(text.top - badge.top, closeTo(3.5, 0.01));
        expect(text.left - badge.left, closeTo(11.5, 0.01));
        expect(badge.center.dx, closeTo(strip.center.dx, 0.01));
      });
    }

    for (final AppThemePreference theme in _themes) {
      for (final (Size size, double scale) in <(Size, double)>[
        (const Size(390, 844), 1),
        (const Size(320, 693), 2),
        (const Size(320, 480), 2),
      ]) {
        testWidgets('${theme.name} ${size.width.toInt()}x'
            '${size.height.toInt()} @${(scale * 100).toInt()}%: the strip '
            'and the navigation never overlap', (WidgetTester tester) async {
          await _open(
            tester,
            theme: theme,
            size: size,
            textScale: scale,
            environment: AppEnvironment.staging,
            locale: const Locale('es'),
            padding: const EdgeInsets.only(top: 24),
          );
          expect(tester.takeException(), isNull);
          final Rect strip = tester.getRect(_strip);
          final Rect nav = tester.getRect(_nav);
          expect(strip.bottom, lessThan(nav.top));
          expect(nav.bottom, size.height);
          final Rect badge = tester.getRect(_badge);
          expect(
            tester.getRect(find.text('STAGING')).bottom,
            lessThanOrEqualTo(badge.bottom),
          );
        });
      }
    }
  });

  group('fixture-data banner', () {
    for (final AppThemePreference theme in _themes) {
      testWidgets('${theme.name}: 1.5px text.accent outline, radius 8, '
          'Archivo 14/700 centred in text.accent, no icon', (
        WidgetTester tester,
      ) async {
        await _open(tester, badge: false, mockData: true, theme: theme);
        expect(_banner, findsOneWidget);
        final GvPrimerRoles roles = _roles(tester, _banner);
        final Container box = tester.widget(
          find.descendant(of: _banner, matching: find.byType(Container)),
        );
        final BoxDecoration d = box.decoration! as BoxDecoration;
        expect(d.color, isNull);
        expect(d.borderRadius, BorderRadius.circular(8));
        final Border border = d.border! as Border;
        expect(border.top.color, roles.text.accent);
        expect(border.top.width, 1.5);
        expect(
          box.padding,
          const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        );
        final Text text = tester.widget<Text>(
          find.descendant(of: _banner, matching: find.byType(Text)),
        );
        expect(text.data, 'Sample data — not live results');
        expect(text.textAlign, TextAlign.center);
        expect(text.style!.fontFamily, GvPrimerFonts.archivo);
        expect(text.style!.fontSize, 14);
        expect(text.style!.fontWeight, FontWeight.w700);
        expect(text.style!.color, roles.text.accent);
        expect(
          find.descendant(of: _banner, matching: find.byType(Icon)),
          findsNothing,
        );
      });
    }

    testWidgets('the wording follows the data identity and the language', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        badge: false,
        mockData: true,
        locale: const Locale('es'),
      );
      expect(
        find.descendant(
          of: _banner,
          matching: find.text('Datos de muestra — no son resultados reales'),
        ),
        findsOneWidget,
      );
      await _open(
        tester,
        badge: false,
        mockData: true,
        fixtureData: const UnverifiedFixtureData(),
      );
      expect(
        find.descendant(
          of: _banner,
          matching: find.text(
            'Test data of unverified origin — not live results',
          ),
        ),
        findsOneWidget,
      );
    });

    testWidgets('read once, as one node carrying the full label', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester, badge: false, mockData: true);
      expect(
        find.bySemanticsLabel('Sample data — not live results'),
        findsOneWidget,
      );
      handle.dispose();
    });

    testWidgets('not shown without fixture data', (WidgetTester tester) async {
      await _open(tester, badge: false);
      expect(_banner, findsNothing);
    });

    for (final AppThemePreference theme in _themes) {
      testWidgets('${theme.name} ES 320 @200% with the STAGING strip: the '
          'banner wraps, nothing overflows, nothing sits under the bar', (
        WidgetTester tester,
      ) async {
        await _open(
          tester,
          mockData: true,
          theme: theme,
          environment: AppEnvironment.staging,
          locale: const Locale('es'),
          size: const Size(320, 693),
          textScale: 2,
          padding: const EdgeInsets.only(top: 24),
        );
        expect(tester.takeException(), isNull);
        final Rect banner = tester.getRect(_banner);
        final Rect nav = tester.getRect(_nav);
        final Rect strip = tester.getRect(_strip);
        expect(banner.top, greaterThanOrEqualTo(strip.bottom));
        expect(banner.bottom, lessThanOrEqualTo(nav.top));
        expect(banner.width, lessThanOrEqualTo(320));
        final RenderParagraph p = tester.renderObject<RenderParagraph>(
          find.descendant(of: _banner, matching: find.byType(RichText)),
        );
        expect(p.didExceedMaxLines, isFalse);
      });
    }
  });
}
