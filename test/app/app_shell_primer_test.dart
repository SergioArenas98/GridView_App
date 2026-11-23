import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/app/router/app_shell.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/settings/presentation/settings_screen.dart';
import 'package:gridview/features/shared/presentation/not_found_screen.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';

import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

/// The app shell with the Primer V2 bottom navigation (Step 55C.15).
///
/// The component itself is covered in `test/design_system/
/// primer_navigation_test.dart` and `primer_nav_focus_test.dart`; this file
/// checks it as the real shell renders it: destinations, selection per
/// branch, roles in both themes, keyboard use, targets and fit, and where the
/// bar is (and is not) shown.

const List<String> _en = <String>['Home', 'Calendar', 'Standings', 'Explore'];
const List<String> _es = <String>[
  'Inicio',
  'Calendario',
  'Clasificaciones',
  'Explorar',
];

const Map<String, Type> _branches = <String, Type>{
  '/': HomeScreen,
  '/calendar': CalendarScreen,
  '/standings': StandingsScreen,
  '/explore': ExploreScreen,
};

final Finder _nav = find.byType(GvPrimerBottomNav);

Finder _tab(String label) => find.ancestor(
  of: find.descendant(of: _nav, matching: find.text(label)),
  matching: find.byType(GvPrimerFocusTarget),
);

FocusNode _focusOf(WidgetTester tester, String label) => Focus.of(
  tester.element(
    find
        .descendant(of: _tab(label), matching: find.byType(GestureDetector))
        .first,
  ),
);

GvPrimerFocusRingPainter _ring(WidgetTester tester, String label) => tester
    .widgetList<CustomPaint>(
      find.descendant(of: _tab(label), matching: find.byType(CustomPaint)),
    )
    .map((CustomPaint p) => p.foregroundPainter)
    .whereType<GvPrimerFocusRingPainter>()
    .first;

Future<GoRouter> _open(
  WidgetTester tester, {
  String location = '/',
  AppThemePreference theme = AppThemePreference.dark,
  Locale locale = const Locale('en'),
  Size size = const Size(390, 844),
  double textScale = 1,
}) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  await loadArchivo(tester);
  return pumpApp(
    tester,
    initialLocation: location,
    surfaceSize: size,
    textScale: textScale,
    locale: locale,
    disableAnimations: true,
    preferences: AppPreferences.defaults.copyWith(theme: theme),
  );
}

void main() {
  tearDown(() {
    FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  });

  group('destinations', () {
    for (final (Locale locale, List<String> labels) in <(Locale, List<String>)>[
      (const Locale('en'), _en),
      (const Locale('es'), _es),
    ]) {
      testWidgets('${locale.languageCode}: four destinations in order, the '
          'Standings bar glyph, one shell', (WidgetTester tester) async {
        await _open(tester, locale: locale);
        expect(_nav, findsOneWidget);
        expect(find.byType(AppShell), findsOneWidget);
        final List<double> xs = <double>[
          for (final String l in labels) tester.getCenter(_tab(l)).dx,
        ];
        expect(xs, orderedEquals(<double>[...xs]..sort()));
        final GvPrimerBottomNav bar = tester.widget(_nav);
        expect(bar.items.map((GvPrimerNavItem i) => i.label), labels);
        expect(bar.items[2].glyph, GvPrimerGlyph.standings);
        expect(
          <IconData?>[for (final GvPrimerNavItem i in bar.items) i.icon],
          <IconData?>[
            Icons.home_outlined,
            Icons.calendar_month_outlined,
            null,
            Icons.explore_outlined,
          ],
        );
      });
    }

    for (final MapEntry<String, Type> branch in _branches.entries) {
      testWidgets('${branch.key}: its destination alone is selected', (
        WidgetTester tester,
      ) async {
        final SemanticsHandle handle = tester.ensureSemantics();
        await _open(tester, location: branch.key);
        expect(find.byType(branch.value), findsOneWidget);
        final int selected = _branches.keys.toList().indexOf(branch.key);
        expect(tester.widget<GvPrimerBottomNav>(_nav).selectedIndex, selected);
        for (int i = 0; i < _en.length; i++) {
          final SemanticsNode node = tester.getSemantics(_tab(_en[i]));
          expect(node.label, _en[i]);
          expect(node.flagsCollection.isButton, isTrue);
          expect(
            node.flagsCollection.isSelected,
            i == selected ? ui.Tristate.isTrue : ui.Tristate.isFalse,
          );
        }
        handle.dispose();
      });
    }

    testWidgets('each destination is announced once, with no duplicate '
        'label nodes', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester);
      for (final String label in _en) {
        expect(
          find.descendant(
            of: _nav,
            matching: find.bySemanticsLabel(RegExp('^$label\$')),
          ),
          findsOneWidget,
          reason: '"$label" must be one node',
        );
      }
      handle.dispose();
    });
  });

  group('themes', () {
    for (final AppThemePreference theme in <AppThemePreference>[
      AppThemePreference.dark,
      AppThemePreference.light,
    ]) {
      testWidgets('${theme.name}: the bar and the shell use the Primer roles', (
        WidgetTester tester,
      ) async {
        await _open(tester, theme: theme);
        final GvPrimerRoles roles = GvPrimerSurface.of(
          tester.element(_nav),
        ).roles;
        final Container bar = tester.widget(
          find.descendant(of: _nav, matching: find.byType(Container)).first,
        );
        expect((bar.decoration! as BoxDecoration).color, roles.nav.bar);
        expect(
          tester
              .widget<Scaffold>(
                find
                    .descendant(
                      of: find.byType(AppShell),
                      matching: find.byType(Scaffold),
                    )
                    .first,
              )
              .backgroundColor,
          roles.surface.page,
        );
        expect(
          tester.widget<Text>(find.text('Home')).style!.color,
          roles.nav.selectedLabel,
        );
        expect(
          tester.widget<Text>(find.text('Explore')).style!.color,
          roles.nav.unselected,
        );
      });
    }
  });

  group('keyboard', () {
    testWidgets('Tab moves through the destinations in order', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.alwaysTraditional;
      _focusOf(tester, 'Home').requestFocus();
      await tester.pump();
      for (final String next in _en.skip(1)) {
        await tester.sendKeyEvent(LogicalKeyboardKey.tab);
        await tester.pump();
        expect(_focusOf(tester, next).hasPrimaryFocus, isTrue, reason: next);
        expect(_ring(tester, next).visible, isTrue, reason: next);
      }
    });

    for (final LogicalKeyboardKey key in <LogicalKeyboardKey>[
      LogicalKeyboardKey.enter,
      LogicalKeyboardKey.space,
    ]) {
      testWidgets(
        '${key.debugName} on a focused destination opens its branch',
        (WidgetTester tester) async {
          final GoRouter router = await _open(tester);
          FocusManager.instance.highlightStrategy =
              FocusHighlightStrategy.alwaysTraditional;
          _focusOf(tester, 'Calendar').requestFocus();
          await tester.pump();
          await tester.sendKeyEvent(LogicalKeyboardKey.tab);
          await tester.pump();
          expect(_focusOf(tester, 'Standings').hasPrimaryFocus, isTrue);
          expect(_ring(tester, 'Standings').visible, isTrue);
          await tester.sendKeyEvent(key);
          await tester.pumpAndSettle();
          expect(shellLocation(router), '/standings');
          expect(find.byType(StandingsScreen), findsOneWidget);
        },
      );
    }

    testWidgets('the ring appears only while a destination has keyboard '
        'focus', (WidgetTester tester) async {
      await _open(tester);
      expect(_ring(tester, 'Calendar').visible, isFalse);
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.alwaysTraditional;
      _focusOf(tester, 'Home').requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(_ring(tester, 'Calendar').visible, isTrue);
      // Focus moves on: the ring moves with it.
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(_ring(tester, 'Calendar').visible, isFalse);
      expect(_ring(tester, 'Standings').visible, isTrue);
    });
  });

  group('targets and fit', () {
    for (final (String name, Size size, double scale, Locale locale)
        in <(String, Size, double, Locale)>[
          ('390 @100% EN', const Size(390, 844), 1, const Locale('en')),
          ('320 @200% EN', const Size(320, 693), 2, const Locale('en')),
          ('320 @200% ES', const Size(320, 693), 2, const Locale('es')),
          ('short 320x480 @200% ES', const Size(320, 480), 2, Locale('es')),
          (
            'short landscape 693x320 @100%',
            const Size(693, 320),
            1,
            Locale('en'),
          ),
        ]) {
      testWidgets('$name: no overflow, every target ≥ 48dp and inside the '
          'bar', (WidgetTester tester) async {
        await _open(
          tester,
          size: size,
          textScale: scale,
          locale: locale,
          location: '/standings',
        );
        expect(tester.takeException(), isNull);
        final Rect bar = tester.getRect(_nav);
        expect(bar.bottom, size.height);
        for (final String l in locale.languageCode == 'es' ? _es : _en) {
          final Rect t = tester.getRect(_tab(l));
          expect(t.height, greaterThanOrEqualTo(48), reason: l);
          expect(t.width, greaterThanOrEqualTo(48), reason: l);
          expect(bar.contains(t.center), isTrue, reason: l);
          expect(t.top, greaterThanOrEqualTo(bar.top), reason: l);
        }
      });
    }

    testWidgets('320 @200%: the stacked bar keeps the body above it', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        size: const Size(320, 693),
        textScale: 2,
        location: '/standings',
      );
      final Rect bar = tester.getRect(_nav);
      final Rect body = tester.getRect(find.byType(StandingsScreen));
      expect(body.bottom, lessThanOrEqualTo(bar.top));
    });
  });

  group('selected-label fallback (S-3)', () {
    Text label(WidgetTester tester, String text) => tester.widget<Text>(
      find.descendant(of: _nav, matching: find.text(text)),
    );
    double? wdth(Text t) => t.style!.fontVariations
        ?.where((ui.FontVariation v) => v.axis == 'wdth')
        .map((ui.FontVariation v) => v.value)
        .firstOrNull;

    testWidgets('Standings selected in the 2 × 2 bar: wdth 62, weight 700, '
        'one line', (WidgetTester tester) async {
      await _open(
        tester,
        location: '/standings',
        locale: const Locale('es'),
        size: const Size(320, 693),
        textScale: 2,
      );
      final Text t = label(tester, 'Clasificaciones');
      expect(t.style!.fontWeight, FontWeight.w700);
      expect(wdth(t), 62);
      final RenderParagraph p = tester.renderObject(
        find.descendant(of: _nav, matching: find.text('Clasificaciones')),
      );
      expect(
        p
            .getBoxesForSelection(
              const TextSelection(baseOffset: 0, extentOffset: 15),
            )
            .map((TextBox b) => b.top)
            .toSet(),
        hasLength(1),
        reason: 'the selected label never breaks inside the word',
      );
    });

    testWidgets('Explore selected in the 2 × 2 bar uses the fallback too', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        location: '/explore',
        size: const Size(320, 693),
        textScale: 2,
      );
      expect(label(tester, 'Explore').style!.fontWeight, FontWeight.w700);
      expect(wdth(label(tester, 'Explore')), 62);
    });

    testWidgets('Home and Calendar keep the regular selected label', (
      WidgetTester tester,
    ) async {
      for (final (String location, String text) in <(String, String)>[
        ('/', 'Inicio'),
        ('/calendar', 'Calendario'),
      ]) {
        await _open(
          tester,
          location: location,
          locale: const Locale('es'),
          size: const Size(320, 693),
          textScale: 2,
        );
        expect(label(tester, text).style!.fontWeight, FontWeight.w800);
        expect(wdth(label(tester, text)), 72);
      }
    });

    testWidgets('one regular row at 390 @100%: no fallback', (
      WidgetTester tester,
    ) async {
      await _open(tester, location: '/standings');
      expect(label(tester, 'Standings').style!.fontWeight, FontWeight.w800);
      expect(wdth(label(tester, 'Standings')), isNull);
    });
  });

  group('where the bar is shown', () {
    testWidgets('a Grand Prix above the shell hides it; Back restores the '
        'branch and its selection', (WidgetTester tester) async {
      final GoRouter router = await _open(tester, location: '/calendar');
      unawaited(router.push('/calendar/2026/13'));
      await tester.pumpAndSettle();
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
      expect(_nav, findsNothing);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/calendar');
      expect(tester.widget<GvPrimerBottomNav>(_nav).selectedIndex, 1);
      expect(find.byType(AppShell, skipOffstage: false), findsOneWidget);
    });

    testWidgets('Settings opens above the shell, without the bar', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _open(tester);
      unawaited(router.push('/settings'));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(_nav, findsNothing);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(_nav, findsOneWidget);
      expect(tester.widget<GvPrimerBottomNav>(_nav).selectedIndex, 0);
    });

    testWidgets('an invalid Standings season sits in the shell with '
        'Standings selected', (WidgetTester tester) async {
      await _open(tester, location: '/standings/drivers/abc');
      expect(find.byType(NotFoundScreen), findsOneWidget);
      expect(tester.widget<GvPrimerBottomNav>(_nav).selectedIndex, 2);
    });

    testWidgets('an unknown route sits above the shell, without the bar', (
      WidgetTester tester,
    ) async {
      await _open(tester, location: '/totally/unknown');
      expect(find.byType(NotFoundScreen), findsOneWidget);
      expect(_nav, findsNothing);
    });

    testWidgets('switching branches keeps one shell and restores each '
        'branch', (WidgetTester tester) async {
      final GoRouter router = await _open(tester, location: '/explore/teams');
      await tapNav(tester, 'Calendar');
      await tapNav(tester, 'Explore');
      expect(shellLocation(router), '/explore/teams');
      await tapNav(tester, 'Explore');
      expect(shellLocation(router), '/explore');
      expect(find.byType(AppShell, skipOffstage: false), findsOneWidget);
    });
  });
}
