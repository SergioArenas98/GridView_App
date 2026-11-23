// Step 55C.13A review captures of the production Settings root and the
// Language, Theme and Time display screens (not goldens).
//
//   node tool/primer_review/capture_settings_55c13a_refs.mjs   (Chrome refs)
//   flutter test tool/primer_review/capture_settings_55c13a_test.dart
//
// Output in build/primer-review/55c13a/, every PNG at device pixel ratio 2
// and never resized. The real screens (router, Riverpod, the real preference
// repository over an in-memory store, l10n) are pumped on a surface tall
// enough for the whole page, then cropped to the screen's content.
// - set-<name>-<theme>-<lang>-<viewport>.png: the Flutter capture;
// - cmp-<name>-<theme>-<lang>-<viewport>.png: the Chrome reference (left)
//   next to it (right);
// - state-<name>.png: Flutter-only states, several panels each;
// - flutter-geometry.json: element boxes (logical px, from the top of the
//   capture) for the numeric comparison with ref-geometry.json.
//
// Known text differences from the references, by construction: the Light
// references are colour-only copies of the Dark pages, so they still show
// "Dark" as the chosen theme, while the Flutter Light captures have Light
// chosen (that is what makes them Light).
// Rendered by the flutter_tester engine; not device validation.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/preferences/preference_store.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/preferences/preferences_repository.dart';
import 'package:gridview/core/time/timezones.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/settings/application/external_links.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_app_bar.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_navigation_row.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_option_list.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_selection_mark.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_snackbar.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c13a';
const double _gap = 24;

class _Config {
  const _Config(this.theme, this.lang, this.width, this.height, this.scale);
  final AppThemePreference theme;
  final String lang;
  final double width;
  final double height;
  final double scale;

  String get viewport => '${width.toInt()}-${(scale * 100).toInt()}';
  String get name => '${theme.wire}-$lang-$viewport';
}

const AppThemePreference _d = AppThemePreference.dark;
const AppThemePreference _l = AppThemePreference.light;
const List<_Config> _all = <_Config>[
  _Config(_d, 'en', 390, 844, 1),
  _Config(_d, 'es', 390, 844, 1),
  _Config(_d, 'en', 320, 693, 2),
  _Config(_d, 'es', 320, 693, 2),
  _Config(_l, 'en', 390, 844, 1),
  _Config(_l, 'es', 390, 844, 1),
  _Config(_l, 'en', 320, 693, 2),
  _Config(_l, 'es', 320, 693, 2),
];
const List<_Config> _pair = <_Config>[
  _Config(_d, 'en', 390, 844, 1),
  _Config(_d, 'es', 320, 693, 2),
  _Config(_l, 'en', 390, 844, 1),
  _Config(_l, 'es', 320, 693, 2),
];
const List<_Config> _title = <_Config>[
  _Config(_d, 'es', 320, 693, 2),
  _Config(_d, 'es', 390, 844, 1),
  _Config(_l, 'es', 320, 693, 2),
  _Config(_l, 'es', 390, 844, 1),
];

/// Where a capture starts and ends.
enum _Crop {
  /// From the top of the window (environment strip included) to the end of
  /// the content.
  window,

  /// From the top of the Settings screen to the end of the content.
  screen,

  /// Below the app bar to the end of the content (the gallery frames have no
  /// app bar).
  belowBar,

  /// The app bar only.
  bar,

  /// The whole viewport (the snackbar sits at its bottom).
  viewport,
}

class _Scenario {
  const _Scenario({
    this.location = '/settings',
    this.environment = AppEnvironment.production,
    this.contact = true,
    this.badge = false,
    this.crop = _Crop.screen,
    this.focusRow,
    this.marks = false,
    this.saveFailure = false,
    this.title,
  });

  final String location;
  final AppEnvironment environment;
  final bool contact;
  final bool badge;
  final _Crop crop;

  /// Key of a root row to focus from the keyboard.
  final String? focusRow;

  /// States frame 2: System focused, Dark selected, Light pressed.
  final bool marks;

  /// States frame 3: the theme write fails after Light is chosen.
  final bool saveFailure;

  /// A Settings screen with this title is pushed above the root (title
  /// rule only).
  final String? title;
}

const Map<String, (_Scenario, List<_Config>)> _paired =
    <String, (_Scenario, List<_Config>)>{
      'root-a': (_Scenario(), _all),
      'root-no-contact': (_Scenario(contact: false), _pair),
      'root-dev': (
        _Scenario(
          environment: AppEnvironment.development,
          contact: false,
          badge: true,
          crop: _Crop.window,
        ),
        _pair,
      ),
      'language': (_Scenario(location: '/settings/language'), _pair),
      'theme': (_Scenario(location: '/settings/theme'), _pair),
      'time': (_Scenario(location: '/settings/time'), _pair),
      'focus-row': (_Scenario(focusRow: 'settings-theme'), _pair),
      'marks': (
        _Scenario(
          location: '/settings/theme',
          marks: true,
          crop: _Crop.belowBar,
        ),
        _pair,
      ),
      'save-failure': (
        _Scenario(
          location: '/settings/theme',
          saveFailure: true,
          crop: _Crop.viewport,
        ),
        _pair,
      ),
      'title': (_Scenario(title: 'Agradecimientos', crop: _Crop.bar), _title),
    };

class _Store implements PreferenceStore {
  _Store(this._values, {this.failing = const <String>{}});
  final Map<String, String> _values;
  final Set<String> failing;

  @override
  String? read(String key) => _values[key];

  @override
  Future<void> write(String key, String value) async {
    if (failing.contains(key)) throw StateError('Simulated failure for $key');
    _values[key] = value;
  }
}

Future<void> _loadMaterialIcons(WidgetTester tester) async {
  final String? root = Platform.environment['FLUTTER_ROOT'];
  if (root == null) return;
  final File file = File(
    '$root/bin/cache/artifacts/material_fonts/materialicons-regular.otf',
  );
  if (!file.existsSync()) return;
  await tester.runAsync(() async {
    final FontLoader loader = FontLoader('MaterialIcons')
      ..addFont(
        Future<ByteData>.value(ByteData.sublistView(file.readAsBytesSync())),
      );
    await loader.load();
  });
}

TestGesture? _held;

Future<void> _pump(WidgetTester tester, _Config config, _Scenario s) async {
  await _held?.cancel();
  _held = null;
  FocusManager.instance.highlightStrategy = s.focusRow != null || s.marks
      ? FocusHighlightStrategy.alwaysTraditional
      : FocusHighlightStrategy.automatic;
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  final bool viewport = s.crop == _Crop.viewport;
  final GoRouter router = await pumpApp(
    tester,
    // Opened from Home, as in the app, so the back action exists.
    initialLocation: '/',
    surfaceSize: Size(config.width, viewport ? config.height : 2400),
    locale: Locale(config.lang),
    textScale: config.scale,
    disableAnimations: true,
    environment: s.environment,
    environmentBadge: s.badge,
    linkConfig: s.contact
        ? ExternalLinkConfig(
            supportContact: ExternalLink.parse('support@example.org'),
          )
        : const ExternalLinkConfig(),
    preferenceStore: _Store(<String, String>{
      PreferenceKeys.language: AppLanguagePreference.system.wire,
      PreferenceKeys.theme: config.theme.wire,
      PreferenceKeys.timeDisplay: TimeDisplayPreference.device.wire,
    }, failing: s.saveFailure ? <String>{PreferenceKeys.theme} : <String>{}),
  );
  unawaited(router.push('/settings'));
  await tester.pumpAndSettle();
  if (s.location != '/settings') {
    unawaited(router.push(s.location));
    await tester.pumpAndSettle();
  }
  if (s.title case final String title) {
    final NavigatorState navigator = Navigator.of(
      tester.element(find.byType(SettingsAppBar)),
    );
    unawaited(
      navigator.push(
        MaterialPageRoute<void>(
          builder: (_) => SettingsPrimerScaffold(
            title: title,
            body: (_, _) => const SizedBox.shrink(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }
  if (s.focusRow case final String key) {
    final GvPrimerFocusTarget target = tester.widget<GvPrimerFocusTarget>(
      find.descendant(
        of: find.byKey(ValueKey<String>(key)),
        matching: find.byType(GvPrimerFocusTarget),
      ),
    );
    target.focusNode!.requestFocus();
    await tester.pumpAndSettle();
  }
  if (s.marks) {
    Focus.of(
      tester.element(
        find
            .descendant(
              of: find.byKey(
                const ValueKey<Object?>(
                  'preference-option-AppThemePreference.system',
                ),
              ),
              matching: find.byType(GestureDetector),
            )
            .first,
      ),
    ).requestFocus();
    await tester.pumpAndSettle();
    _held = await tester.startGesture(
      tester.getCenter(
        find.byKey(
          const ValueKey<Object?>('preference-option-AppThemePreference.light'),
        ),
      ),
    );
    await tester.pump();
  }
  if (s.saveFailure) {
    // The other theme is chosen, the write fails and the stored theme is
    // restored (states frame 3: Light tapped, Dark restored).
    final AppThemePreference other = config.theme == AppThemePreference.dark
        ? AppThemePreference.light
        : AppThemePreference.dark;
    await tester.tap(find.byKey(ValueKey<Object?>('preference-option-$other')));
    await tester.pumpAndSettle();
    expect(find.byType(SettingsSnackbarContent), findsOneWidget);
  }
  expect(tester.takeException(), isNull);
}

/// The bottom of the content: the last row or option plus the 40px end
/// padding.
double _contentBottom(WidgetTester tester) {
  double bottom = tester.getRect(find.byType(SettingsAppBar).last).bottom;
  for (final Element e
      in find
          .byWidgetPredicate(
            (Widget w) => w is SettingsNavigationRow || w is SettingsOption,
          )
          .evaluate()) {
    final RenderBox box = e.renderObject! as RenderBox;
    if (!box.hasSize) continue;
    final double b = box.localToGlobal(Offset(0, box.size.height)).dy;
    if (b > bottom) bottom = b;
  }
  return bottom + SettingsPrimerScaffold.endPadding;
}

Future<ui.Image> _capture(WidgetTester tester, _Crop crop) async {
  // The outermost repaint boundary below the view.
  RenderObject? boundary = tester.renderObject(
    find.byType(SettingsAppBar).last,
  );
  RenderRepaintBoundary? outermost;
  while (boundary != null) {
    if (boundary is RenderRepaintBoundary) outermost = boundary;
    boundary = boundary.parent;
  }
  final RenderRepaintBoundary root = outermost!;
  final Offset origin = root.localToGlobal(Offset.zero);
  final Rect bar = tester.getRect(find.byType(SettingsAppBar).last);
  final Size view = root.size;
  final (double top, double bottom) = switch (crop) {
    _Crop.window => (0, _contentBottom(tester)),
    _Crop.screen => (bar.top, _contentBottom(tester)),
    _Crop.belowBar => (bar.bottom, _contentBottom(tester)),
    _Crop.bar => (bar.top, bar.bottom),
    _Crop.viewport => (bar.top, view.height),
  };
  late ui.Image full;
  await tester.runAsync(() async {
    full = await root.toImage(pixelRatio: _dpr);
  });
  final Rect rect = Rect.fromLTRB(
    (0 - origin.dx) * _dpr,
    (top - origin.dy) * _dpr,
    (view.width - origin.dx) * _dpr,
    (bottom - origin.dy) * _dpr,
  );
  return _compose(tester, <(ui.Image, Rect)>[(full, rect)]);
}

Future<void> _write(WidgetTester tester, ui.Image image, String name) async {
  await tester.runAsync(() async {
    final ByteData png = (await image.toByteData(
      format: ui.ImageByteFormat.png,
    ))!;
    File('$_out/$name.png')
      ..createSync(recursive: true)
      ..writeAsBytesSync(png.buffer.asUint8List());
  });
}

Future<ui.Image?> _readRef(WidgetTester tester, String name) async {
  final File file = File('$_out/$name.png');
  if (!file.existsSync()) return null;
  ui.Image? image;
  await tester.runAsync(() async {
    final ui.Codec codec = await ui.instantiateImageCodec(
      file.readAsBytesSync(),
    );
    image = (await codec.getNextFrame()).image;
  });
  return image;
}

Future<ui.Image> _compose(
  WidgetTester tester,
  List<(ui.Image, Rect)> crops,
) async {
  const double gap = _gap * _dpr;
  double w = 0;
  double h = 0;
  for (final (ui.Image _, Rect r) in crops) {
    w += r.width + (w == 0 ? 0 : gap);
    h = h < r.height ? r.height : h;
  }
  final ui.PictureRecorder recorder = ui.PictureRecorder();
  final Canvas canvas = Canvas(recorder)
    ..drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = const Color(0xFF7F7F7F),
    );
  double at = 0;
  for (final (ui.Image image, Rect r) in crops) {
    canvas.drawImageRect(image, r, Offset(at, 0) & r.size, Paint());
    at += r.width + gap;
  }
  late ui.Image out;
  await tester.runAsync(() async {
    out = await recorder.endRecording().toImage(w.round(), h.round());
  });
  return out;
}

Rect _whole(ui.Image image) =>
    Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble());

/// Element boxes, from the top of the capture, for the comparison with the
/// Chrome geometry.
Map<String, Object> _geometry(WidgetTester tester, double top) {
  List<List<double>> boxes(Finder f) => <List<double>>[
    for (final Element e in f.evaluate())
      if ((e.renderObject as RenderBox?)?.hasSize ?? false)
        () {
          final RenderBox box = e.renderObject! as RenderBox;
          final Offset o = box.localToGlobal(Offset.zero);
          double r(double v) => (v * 10).roundToDouble() / 10;
          return <double>[
            r(o.dx),
            r(o.dy - top),
            r(box.size.width),
            r(box.size.height),
          ];
        }(),
  ];
  final Finder bar = find.byType(SettingsAppBar).last;
  return <String, Object>{
    '.dbar': boxes(bar),
    '.dbar__title': boxes(
      find.descendant(of: bar, matching: find.byType(RichText)),
    ),
    '.kicker': boxes(
      find.byWidgetPredicate(
        (Widget w) => w is Semantics && (w.properties.header ?? false),
      ),
    ),
    '.srow': boxes(find.byType(SettingsNavigationRow)),
    '.opt': boxes(find.byType(SettingsOption)),
    '.mark': boxes(find.byType(SettingsSelectionMark)),
    '.snack': boxes(find.byType(SettingsSnackbarContent)),
  };
}

double _captureTop(WidgetTester tester, _Crop crop) {
  final Rect bar = tester.getRect(find.byType(SettingsAppBar).last);
  return switch (crop) {
    _Crop.window => 0,
    _Crop.belowBar => bar.bottom,
    _ => bar.top,
  };
}

void main() {
  final Map<String, Object> geometry = <String, Object>{};

  // `tool/` has no flutter_test_config.dart: initialise the IANA database and
  // the date symbols as `test/flutter_test_config.dart` does, so the pinned
  // UTC device zone resolves instead of falling back to the host clock.
  setUpAll(() async {
    ensureTimeZonesInitialized();
    await initializeDateFormatting('en');
    await initializeDateFormatting('es');
  });

  tearDown(() async {
    await _held?.cancel();
    _held = null;
    FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  });

  for (final MapEntry<String, (_Scenario, List<_Config>)> entry
      in _paired.entries) {
    testWidgets('paired: ${entry.key}', (WidgetTester tester) async {
      await loadArchivo(tester);
      await _loadMaterialIcons(tester);
      final (_Scenario scenario, List<_Config> configs) = entry.value;
      for (final _Config config in configs) {
        await _pump(tester, config, scenario);
        geometry['${entry.key}-${config.name}'] = _geometry(
          tester,
          _captureTop(tester, scenario.crop),
        );
        final ui.Image image = await _capture(tester, scenario.crop);
        await _write(tester, image, 'set-${entry.key}-${config.name}');
        final ui.Image? ref = await _readRef(
          tester,
          'ref-${entry.key}-${config.theme.wire}-${config.lang}-'
          '${config.viewport}',
        );
        if (ref != null) {
          await _write(
            tester,
            await _compose(tester, <(ui.Image, Rect)>[
              (ref, _whole(ref)),
              (image, _whole(image)),
            ]),
            'cmp-${entry.key}-${config.name}',
          );
        }
      }
    });
  }

  // Theme switching while the Theme screen is open: Dark before, then Light
  // after choosing it on the same route (EN 390 @100%, ES 320 @200%).
  testWidgets('state: theme-switch', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    final List<(ui.Image, Rect)> panels = <(ui.Image, Rect)>[];
    for (final _Config config in <_Config>[_pair[0], _pair[1]]) {
      await _pump(tester, config, const _Scenario(location: '/settings/theme'));
      final ui.Image before = await _capture(tester, _Crop.screen);
      await tester.tap(
        find.byKey(
          const ValueKey<Object?>('preference-option-AppThemePreference.light'),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      final ui.Image after = await _capture(tester, _Crop.screen);
      panels
        ..add((before, _whole(before)))
        ..add((after, _whole(after)));
    }
    await _write(tester, await _compose(tester, panels), 'state-theme-switch');
  });

  tearDownAll(() {
    File('$_out/flutter-geometry.json')
      ..createSync(recursive: true)
      ..writeAsStringSync(const JsonEncoder.withIndent(' ').convert(geometry));
  });
}
