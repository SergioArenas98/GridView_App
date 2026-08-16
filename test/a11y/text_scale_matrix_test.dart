import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/widgets/widgets.dart';

import '../support/a11y_harness.dart';
import '../support/router_harness.dart';

/// One cell of the matrix.
typedef Cell = ({double width, Locale locale, AppThemePreference theme});

/// The labels that must survive 200% text, per locale.
typedef Readable = ({List<String> en, List<String> es});

/// One screen under test: where it lives, what must stay readable, and whether
/// it carries the primary navigation.
typedef Screen = (String location, Readable readable, bool hasBottomNav);

/// Every screen family at 200% text, across widths, locales and themes.
///
/// 200% is the accessibility floor, not an extreme: it is what Android's
/// largest font setting produces, and it is where a fixed height clips a label
/// out of existence or a row overflows. The failure this is built to catch is
/// the silent one — a label still present in the widget tree but clipped out of
/// the *semantics* tree, so a screen reader stops reading it while the screen
/// still looks plausible to a sighted reviewer.
///
/// The matrix is bounded on purpose. The full Cartesian product
/// {320, 390} x {EN, ES} x {dark, light} runs for the four highest-risk
/// screens — Home (the densest), Standings (the widest rows), Settings (the
/// most text) and the driver detail (the one with a media slot). Every other
/// family runs a documented pairwise set of two cells in which each width, each
/// locale and each theme appears at least once. Running the product everywhere
/// would add minutes to every CI run to re-prove the same layout rules.
void main() {
  const double scale = 2.0;
  const List<double> widths = <double>[320, 390];
  const List<Locale> locales = <Locale>[Locale('en'), Locale('es')];
  const List<AppThemePreference> themes = <AppThemePreference>[
    AppThemePreference.dark,
    AppThemePreference.light,
  ];

  Cell cell(double width, Locale locale, AppThemePreference theme) =>
      (width: width, locale: locale, theme: theme);

  /// The complete product: 2 widths x 2 locales x 2 themes.
  final List<Cell> full = <Cell>[
    for (final double width in widths)
      for (final Locale locale in locales)
        for (final AppThemePreference theme in themes)
          cell(width, locale, theme),
  ];

  /// The documented pairwise set: two cells that between them cover both
  /// widths, both locales and both themes.
  final List<Cell> pairwise = <Cell>[
    cell(320, const Locale('en'), AppThemePreference.dark),
    cell(390, const Locale('es'), AppThemePreference.light),
  ];

  String describe(Cell c) =>
      '${c.width.toInt()}dp ${c.locale.languageCode} ${c.theme.name}';

  /// Pumps [location] at 200% text in one matrix cell and asserts the four
  /// things that must survive it.
  Future<void> assertUsable(
    WidgetTester tester,
    String location,
    Cell c, {
    required Readable readable,
    required bool hasBottomNav,
  }) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      initialLocation: location,
      surfaceSize: Size(c.width, 900),
      textScale: scale,
      locale: c.locale,
      preferences: AppPreferences.defaults.copyWith(theme: c.theme),
      disableAnimations: true,
    );
    final bool spanish = c.locale.languageCode == 'es';

    // 1. Nothing overflowed. A RenderFlex overflow surfaces as an exception in
    //    a test, so this is the real check rather than a proxy for one.
    expect(
      tester.takeException(),
      isNull,
      reason: 'overflow at ${describe(c)} on $location',
    );

    // 2. The important labels are still in the semantics tree. A clipped label
    //    leaves it, so this is what catches "still looks fine, reads like
    //    nothing".
    for (final String label in spanish ? readable.es : readable.en) {
      expect(
        labelOccurrences(tester, label),
        greaterThan(0),
        reason:
            '"$label" was clipped out of the semantics tree at '
            '${describe(c)} on $location',
      );
    }

    // 3. The primary controls are still reachable and still meet the target.
    if (hasBottomNav) {
      expect(find.byType(GvBottomNav), findsOneWidget);
      for (final String destination in <String>[
        spanish ? 'Inicio' : 'Home',
        spanish ? 'Calendario' : 'Calendar',
      ]) {
        final Finder target = find
            .ancestor(
              of: find.descendant(
                of: find.byType(GvBottomNav),
                matching: find.text(destination),
              ),
              matching: find.byType(ConstrainedBox),
            )
            .first;
        expect(
          tester.getSize(target).height,
          greaterThanOrEqualTo(48.0),
          reason:
              'the "$destination" destination shrank below 48dp at '
              '${describe(c)}',
        );
      }
    }

    // 4. The content is still scrollable, so anything the larger text pushed
    //    off the viewport can still be reached.
    expect(
      find.byType(Scrollable),
      findsWidgets,
      reason: 'no scrollable survived at ${describe(c)} on $location',
    );

    handle.dispose();
  }

  void runMatrix(
    String groupName,
    List<Cell> cells,
    Map<String, Screen> screens,
  ) {
    group(groupName, () {
      screens.forEach((String name, Screen spec) {
        final (String location, Readable readable, bool hasNav) = spec;
        for (final Cell c in cells) {
          testWidgets('$name at 200% — ${describe(c)}', (
            WidgetTester tester,
          ) async {
            await assertUsable(
              tester,
              location,
              c,
              readable: readable,
              hasBottomNav: hasNav,
            );
          });
        }
      });
    });
  }

  runMatrix(
    'full 2.0 matrix on the highest-risk screens',
    full,
    <String, Screen>{
      'Home': (
        '/',
        (
          en: <String>['GridView', 'Belgian Grand Prix'],
          es: <String>['GridView', 'Belgian Grand Prix'],
        ),
        true,
      ),
      'Standings': (
        '/standings/drivers/2026',
        (en: <String>['Max Verstappen'], es: <String>['Max Verstappen']),
        true,
      ),
      'Settings': (
        '/settings',
        (
          en: <String>['Settings', 'Language', 'Theme'],
          es: <String>['Ajustes', 'Idioma', 'Tema'],
        ),
        false,
      ),
      'Driver detail': (
        '/drivers/max-verstappen',
        (en: <String>['Max Verstappen'], es: <String>['Max Verstappen']),
        false,
      ),
    },
  );

  runMatrix('pairwise 2.0 matrix on the remaining families', pairwise, <
    String,
    Screen
  >{
    'Calendar': (
      '/calendar',
      (en: <String>['British Grand Prix'], es: <String>['British Grand Prix']),
      true,
    ),
    'Grand Prix': (
      '/calendar/2026/13',
      (en: <String>['Belgian Grand Prix'], es: <String>['Belgian Grand Prix']),
      false,
    ),
    'Standings constructors': (
      '/standings/constructors/2026',
      (en: <String>['McLaren'], es: <String>['McLaren']),
      true,
    ),
    'Explore drivers': (
      '/explore/drivers',
      (en: <String>['Max Verstappen'], es: <String>['Max Verstappen']),
      true,
    ),
    'Explore teams': (
      '/explore/teams',
      (
        en: <String>['BWT Alpine Formula One Team'],
        es: <String>['BWT Alpine Formula One Team'],
      ),
      true,
    ),
    'Explore circuits': (
      '/explore/circuits',
      (
        en: <String>['Autodromo Nazionale Monza'],
        es: <String>['Autodromo Nazionale Monza'],
      ),
      true,
    ),
    'Team detail': (
      '/constructors/alpine',
      (
        en: <String>['BWT Alpine Formula One Team'],
        es: <String>['BWT Alpine Formula One Team'],
      ),
      false,
    ),
    'Circuit detail': (
      '/circuits/spa-francorchamps',
      (
        en: <String>['Circuit de Spa-Francorchamps'],
        es: <String>['Circuit de Spa-Francorchamps'],
      ),
      false,
    ),
    'Settings language': (
      '/settings/language',
      (
        en: <String>['Language', 'English', 'Español'],
        es: <String>['Idioma', 'English', 'Español'],
      ),
      false,
    ),
    'Settings theme': (
      '/settings/theme',
      (
        en: <String>['Theme', 'Dark', 'Light'],
        es: <String>['Tema', 'Oscuro', 'Claro'],
      ),
      false,
    ),
    'Settings time': (
      '/settings/time',
      (
        en: <String>['Time display', 'Device time'],
        es: <String>['Horario mostrado', 'Hora del dispositivo'],
      ),
      false,
    ),
    'Settings data': (
      '/settings/data',
      (
        en: <String>['Data and updates', 'GridView'],
        es: <String>['Datos y actualizaciones', 'GridView'],
      ),
      false,
    ),
    'Settings acknowledgements': (
      '/settings/acknowledgements',
      (en: <String>['GridView'], es: <String>['GridView']),
      false,
    ),
    'Settings privacy': (
      '/settings/privacy',
      (en: <String>['GridView'], es: <String>['GridView']),
      false,
    ),
    'Settings about': (
      '/settings/about',
      (en: <String>['GridView'], es: <String>['GridView']),
      false,
    ),
  });

  group('the matrices are what they claim to be', () {
    test('the full matrix is the complete product', () {
      expect(full, hasLength(widths.length * locales.length * themes.length));
    });

    test('the pairwise set covers every width, locale and theme', () {
      expect(pairwise.map((Cell c) => c.width).toSet(), widths.toSet());
      expect(pairwise.map((Cell c) => c.locale).toSet(), locales.toSet());
      expect(pairwise.map((Cell c) => c.theme).toSet(), themes.toSet());
    });
  });
}
