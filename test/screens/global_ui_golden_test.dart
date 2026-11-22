import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/shared/domain/fixture_data_identity.dart';
import 'package:gridview/features/shared/presentation/widgets/mock_data_banner.dart';

import '../support/router_harness.dart';

// Step 55C.15F: isolated canonical goldens for the Primer V2 global surfaces
// (DD GI-1 to GI-11): the bottom navigation, the environment strip with its
// continuous badge, and the fixture-data banner.
//
// Each is captured through the real router and shell, cropped to the one
// surface, with theme, locale, viewport, text scale, insets and fixture data
// pinned and animations disabled.
//
// The canonical test font (Ahem) is kept (owner decision D2). Ahem draws
// every glyph as a 1em square, so each navigation label measures wider than
// in Archivo and the bar takes its 2 × 2 layout here even at 390 @100%, where
// the app shows one row. Real-font geometry is covered by the Archivo layout
// tests (`test/app/app_shell_primer_test.dart`,
// `test/app/short_viewport_primer_test.dart`) and the review captures.
//
// Each golden is cropped from the image of the surface's nearest repaint
// boundary to the surface's own rectangle: neither the navigation nor the
// strip is a repaint boundary, so a plain finder golden would record the
// whole screen. The navigation crop is the bar itself (its top hairline
// included); the outer shadow falls on the page above and is left out, so
// the golden does not depend on the content behind it.
//
// The navigation goldens select Standings, so they record the Primer bar
// glyph and the selected-label fallback (GI-2), unlike `primary_shell_nav`
// (Home selected).

Future<void> _pump(
  WidgetTester tester, {
  required String location,
  required AppThemePreference theme,
  Size size = const Size(390, 844),
  double textScale = 1,
  AppEnvironment environment = AppEnvironment.development,
  bool badge = false,
  bool mockData = false,
}) async {
  await pumpApp(
    tester,
    initialLocation: location,
    surfaceSize: size,
    textScale: textScale,
    locale: const Locale('en'),
    environment: environment,
    environmentBadge: badge,
    mockData: mockData,
    fixtureData: const SampleFixtureData(),
    padding: badge ? const EdgeInsets.only(top: 24) : EdgeInsets.zero,
    disableAnimations: true,
    preferences: AppPreferences.defaults.copyWith(theme: theme),
  );
  expect(tester.takeException(), isNull);
}

/// The [target]'s rectangle, cut from the image of its nearest repaint boundary at the
/// view's pixel ratio, as the other goldens are recorded. The strip sits
/// above the navigator, so its boundary is the root view; that one is
/// captured as `flutter_test` captures a whole screen.
Future<ui.Image> _crop(WidgetTester tester, Finder target) async {
  final Element element = tester.element(target);
  RenderObject node = element.renderObject!;
  while (!node.isRepaintBoundary) {
    node = node.parent!;
  }
  final RenderObject boundary = node;
  final Size boundarySize = boundary is RenderBox
      ? boundary.size
      : (boundary as RenderView).size;
  final Offset origin = boundary is RenderBox
      ? boundary.localToGlobal(Offset.zero)
      : Offset.zero;
  final Rect logical = tester.getRect(target).shift(-origin);
  final Rect clip = logical;
  final double ratio = tester.view.devicePixelRatio;
  late ui.Image out;
  await tester.runAsync(() async {
    final ui.Image full = boundary is RenderRepaintBoundary
        ? await boundary.toImage(pixelRatio: ratio)
        : await captureImage(element);
    final double scale = full.width / boundarySize.width;
    final Rect src = Rect.fromLTRB(
      (clip.left * scale).roundToDouble(),
      (clip.top * scale).roundToDouble(),
      (clip.right * scale).roundToDouble(),
      (clip.bottom * scale).roundToDouble(),
    );
    final ui.PictureRecorder recorder = ui.PictureRecorder();
    Canvas(recorder).drawImageRect(full, src, Offset.zero & src.size, Paint());
    out = await recorder.endRecording().toImage(
      src.width.round(),
      src.height.round(),
    );
    full.dispose();
  });
  return out;
}

void main() {
  group('bottom navigation (Standings selected)', () {
    for (final (String name, AppThemePreference theme, Size size, double scale)
        in <(String, AppThemePreference, Size, double)>[
          ('shell_nav_dark', AppThemePreference.dark, const Size(390, 844), 1),
          (
            'shell_nav_light',
            AppThemePreference.light,
            const Size(390, 844),
            1,
          ),
          (
            'shell_nav_dark_large_text',
            AppThemePreference.dark,
            const Size(320, 693),
            2,
          ),
          (
            'shell_nav_light_large_text',
            AppThemePreference.light,
            const Size(320, 693),
            2,
          ),
        ]) {
      testWidgets('golden: $name', (WidgetTester tester) async {
        await _pump(
          tester,
          location: '/standings',
          theme: theme,
          size: size,
          textScale: scale,
        );
        final ui.Image image = await _crop(
          tester,
          find.byType(GvPrimerBottomNav),
        );
        await expectLater(image, matchesGoldenFile('goldens/$name.png'));
      });
    }
  });

  group('environment strip (status-bar inset 24, Home)', () {
    for (final (
          String name,
          AppEnvironment environment,
          AppThemePreference theme,
        )
        in <(String, AppEnvironment, AppThemePreference)>[
          (
            'env_strip_dev_dark',
            AppEnvironment.development,
            AppThemePreference.dark,
          ),
          (
            'env_strip_dev_light',
            AppEnvironment.development,
            AppThemePreference.light,
          ),
          (
            'env_strip_staging_dark',
            AppEnvironment.staging,
            AppThemePreference.dark,
          ),
          (
            'env_strip_staging_light',
            AppEnvironment.staging,
            AppThemePreference.light,
          ),
        ]) {
      testWidgets('golden: $name', (WidgetTester tester) async {
        await _pump(
          tester,
          location: '/',
          theme: theme,
          environment: environment,
          badge: true,
        );
        final ui.Image image = await _crop(
          tester,
          find.byKey(const ValueKey<String>('environment-badge-strip')),
        );
        await expectLater(image, matchesGoldenFile('goldens/$name.png'));
      });
    }
  });

  group('fixture-data banner (sample data, Home)', () {
    for (final (String name, AppThemePreference theme)
        in <(String, AppThemePreference)>[
          ('mock_data_banner_dark', AppThemePreference.dark),
          ('mock_data_banner_light', AppThemePreference.light),
        ]) {
      testWidgets('golden: $name', (WidgetTester tester) async {
        await _pump(tester, location: '/', theme: theme, mockData: true);
        expect(find.byType(MockDataBanner), findsOneWidget);
        final ui.Image image = await _crop(tester, find.byType(MockDataBanner));
        await expectLater(image, matchesGoldenFile('goldens/$name.png'));
      });
    }
  });
}
