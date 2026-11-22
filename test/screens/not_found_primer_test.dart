// Step 55C.14: NotFoundScreen in Primer V2 (Dark and Light).
//
// Presentation only. Owner decision D1: no NotFound prototype exists, so the
// screen is built from the approved Grand Prix Detail page-state precedent.
// Every assertion runs through the real router (`buildGridViewRouter` via
// `pumpApp`). That way the two kinds, root-versus-shell placement, Back and
// "Go to Home" are checked as the application produces them; nothing here
// constructs the screen directly.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/app/router/app_shell.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/shared/presentation/not_found_screen.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_app_bar.dart';

import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

// --- Locations ----------------------------------------------------------------

/// Unmatched: the router's `errorBuilder`, above everything, no shell.
const String _unknown = '/totally/unknown';

/// Invalid parameter on a root-level route with nothing beneath it.
const String _invalidDriver = '/drivers/BAD_ID';

/// Invalid parameter on Grand Prix Detail: the shell and Calendar sit below.
const String _invalidGrandPrix = '/calendar/notyear/3';

/// Invalid parameter inside the Standings branch of the shell.
const String _invalidStandings = '/standings/drivers/abc';

// --- Copy ---------------------------------------------------------------------

typedef _Copy = ({String title, String message, String home});

const Map<String, _Copy> _unknownCopy = <String, _Copy>{
  'en': (
    title: 'Screen not found',
    message: "We couldn't open this page. It may have moved or never existed.",
    home: 'Go to Home',
  ),
  'es': (
    title: 'Pantalla no encontrada',
    message:
        'No pudimos abrir esta página. Puede que se haya movido o que nunca '
        'existiera.',
    home: 'Ir a Inicio',
  ),
};

const Map<String, _Copy> _invalidCopy = <String, _Copy>{
  'en': (
    title: 'Invalid link',
    message: "This link points to something that doesn't exist.",
    home: 'Go to Home',
  ),
  'es': (
    title: 'Enlace no válido',
    message: 'Este enlace apunta a algo que no existe.',
    home: 'Ir a Inicio',
  ),
};

/// One case per kind: its location, icon, copy and body key.
typedef _Kind = ({
  String location,
  IconData icon,
  Map<String, _Copy> copy,
  String bodyKey,
});

const List<_Kind> _kinds = <_Kind>[
  (
    location: _unknown,
    icon: Icons.explore_off_outlined,
    copy: _unknownCopy,
    bodyKey: 'not-found-unknown',
  ),
  (
    location: _invalidDriver,
    icon: Icons.link_off_outlined,
    copy: _invalidCopy,
    bodyKey: 'not-found-invalid',
  ),
];

const List<AppThemePreference> _themes = <AppThemePreference>[
  AppThemePreference.dark,
  AppThemePreference.light,
];

// --- Finders ------------------------------------------------------------------

final Finder _screen = find.byType(NotFoundScreen);
final Finder _back = find.byKey(const ValueKey<String>('not-found-back'));
final Finder _home = find.byKey(const ValueKey<String>('not-found-home'));
final Finder _homeTarget = find.descendant(
  of: _home,
  matching: find.byType(GvPrimerFocusTarget),
);

Finder _inScreen(Finder matching) =>
    find.descendant(of: _screen, matching: matching);

FocusNode _nodeOf(WidgetTester tester, Finder target) => Focus.of(
  tester.element(
    find.descendant(of: target, matching: find.byType(GestureDetector)).first,
  ),
);

GvPrimerRoles _roles(WidgetTester tester) =>
    GvPrimerSurface.of(tester.element(find.byType(PrimerDetailAppBar))).roles;

bool _ringVisible(WidgetTester tester, Finder target) => tester
    .widgetList<CustomPaint>(
      find.descendant(of: target, matching: find.byType(CustomPaint)),
    )
    .map((CustomPaint p) => p.foregroundPainter)
    .whereType<GvPrimerFocusRingPainter>()
    .first
    .visible;

// --- Harness ------------------------------------------------------------------

Future<GoRouter> _open(
  WidgetTester tester, {
  String location = _unknown,
  AppThemePreference theme = AppThemePreference.dark,
  Locale locale = const Locale('en'),
  Size size = const Size(390, 844),
  double textScale = 1,
}) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  await loadArchivo(tester);
  final GoRouter router = await pumpApp(
    tester,
    initialLocation: location,
    surfaceSize: size,
    textScale: textScale,
    locale: locale,
    disableAnimations: true,
    preferences: AppPreferences.defaults.copyWith(theme: theme),
  );
  await tester.pumpAndSettle();
  return router;
}

/// Opens Home, then pushes [location] above it, as an in-app navigation.
Future<GoRouter> _pushOverHome(WidgetTester tester, String location) async {
  final GoRouter router = await _open(tester, location: '/');
  unawaited(router.push(location));
  await tester.pumpAndSettle();
  return router;
}

/// Exactly one shell, one bottom navigation and Home on stage, with nothing
/// left to pop on the root navigator.
void _expectSingleHomeShell(WidgetTester tester, GoRouter router) {
  expect(find.byType(HomeScreen), findsOneWidget);
  expect(_screen, findsNothing);
  expect(find.byType(AppShell, skipOffstage: false), findsOneWidget);
  expect(find.byType(GvPrimerBottomNav, skipOffstage: false), findsOneWidget);
  expect(shellLocation(router), '/');
  expect(router.canPop(), isFalse);
}

void main() {
  tearDown(() {
    FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  });

  group('both kinds in both themes (1, 2, 4)', () {
    for (final AppThemePreference theme in _themes) {
      for (final _Kind kind in _kinds) {
        testWidgets('${theme.name} ${kind.bodyKey}: Primer page, icon and '
            'pill', (WidgetTester tester) async {
          await _open(tester, location: kind.location, theme: theme);
          final GvPrimerRoles roles = _roles(tester);

          expect(_screen, findsOneWidget);
          expect(find.byKey(ValueKey<String>(kind.bodyKey)), findsOneWidget);
          // The page surface of this theme.
          final Scaffold scaffold = tester.widget(
            _inScreen(find.byType(Scaffold)),
          );
          expect(scaffold.backgroundColor, roles.surface.page);
          // Detail-size block (D3) with the kind's Material icon (D4) in
          // text.secondary.
          final GvPrimerEmptyState block = tester.widget(
            _inScreen(find.byType(GvPrimerEmptyState)),
          );
          expect(block.size, GvPrimerEmptySize.detail);
          expect(block.icon, kind.icon);
          expect(block.glyph, isNull);
          expect(block.announceTitle, isTrue);
          final Icon icon = tester.widget(_inScreen(find.byIcon(kind.icon)));
          expect(icon.color, roles.text.secondary);
          expect(icon.size, 28);
          // The app title in the shared detail bar (D2).
          expect(
            find.descendant(
              of: find.byType(PrimerDetailAppBar),
              matching: find.text('GridView'),
            ),
            findsOneWidget,
          );
          // The inverse pill without hover, as on Grand Prix Detail (D5).
          final GvPrimerButton button = tester.widget(_home);
          expect(button.hover, isFalse);
          final DecoratedBox pill = tester.widget(
            find
                .descendant(of: _home, matching: find.byType(DecoratedBox))
                .first,
          );
          expect(
            (pill.decoration as BoxDecoration).color,
            roles.action.button.fill,
          );
          expect(tester.takeException(), isNull);
        });
      }
    }

    testWidgets('Dark and Light pages differ', (WidgetTester tester) async {
      final List<Color?> pages = <Color?>[];
      for (final AppThemePreference theme in _themes) {
        await _open(tester, theme: theme);
        pages.add(
          tester
              .widget<Scaffold>(_inScreen(find.byType(Scaffold)))
              .backgroundColor,
        );
      }
      expect(pages.first, isNot(pages.last));
    });

    testWidgets('the kinds keep distinct icons', (WidgetTester tester) async {
      await _open(tester, location: _unknown);
      expect(_inScreen(find.byIcon(Icons.explore_off_outlined)), findsOne);
      expect(_inScreen(find.byIcon(Icons.link_off_outlined)), findsNothing);
      await _open(tester, location: _invalidDriver);
      expect(_inScreen(find.byIcon(Icons.link_off_outlined)), findsOne);
      expect(_inScreen(find.byIcon(Icons.explore_off_outlined)), findsNothing);
    });
  });

  group('localized copy (3)', () {
    for (final String lang in <String>['en', 'es']) {
      for (final _Kind kind in _kinds) {
        testWidgets('$lang ${kind.bodyKey}', (WidgetTester tester) async {
          await _open(tester, location: kind.location, locale: Locale(lang));
          final _Copy copy = kind.copy[lang]!;
          expect(_inScreen(find.text(copy.title)), findsOneWidget);
          expect(_inScreen(find.text(copy.message)), findsOneWidget);
          expect(_inScreen(find.text(copy.home)), findsOneWidget);
          expect(_inScreen(find.text('GridView')), findsOneWidget);
        });
      }
    }
  });

  group('semantics (4, 5)', () {
    for (final _Kind kind in _kinds) {
      testWidgets('${kind.bodyKey}: route heading, body heading as the one '
          'live region, separate message, icon hidden', (
        WidgetTester tester,
      ) async {
        final SemanticsHandle handle = tester.ensureSemantics();
        await _open(tester, location: kind.location);
        final _Copy copy = kind.copy['en']!;

        // App-bar title: names the route and is a heading (D6).
        expect(
          tester.getSemantics(find.text('GridView')),
          isSemantics(isHeader: true, namesRoute: true, isLiveRegion: false),
        );
        // Body title: a heading and the live region, announced on arrival.
        expect(
          tester.getSemantics(_inScreen(find.text(copy.title))),
          isSemantics(isHeader: true, isLiveRegion: true, label: copy.title),
        );
        // The message is its own node: not a heading, not announced again.
        expect(
          tester.getSemantics(_inScreen(find.text(copy.message))),
          isSemantics(
            isHeader: false,
            isLiveRegion: false,
            label: copy.message,
          ),
        );
        // Exactly one live region in the whole screen.
        final Iterable<Semantics> live = tester
            .widgetList<Semantics>(_inScreen(find.byType(Semantics)))
            .where((Semantics s) => s.properties.liveRegion ?? false);
        expect(live, hasLength(1));
        // The icon is decorative.
        expect(
          find.ancestor(
            of: _inScreen(find.byIcon(kind.icon)),
            matching: find.byType(ExcludeSemantics),
          ),
          findsWidgets,
        );
        // The recovery action is a button named by its visible label.
        expect(
          tester.getSemantics(_homeTarget),
          isSemantics(
            isButton: true,
            hasTapAction: true,
            isFocusable: true,
            label: copy.home,
          ),
        );
        handle.dispose();
      });
    }
  });

  group('recovery (6, 12, 13)', () {
    testWidgets('tap, Enter and Space each return to exactly one Home shell', (
      WidgetTester tester,
    ) async {
      for (final String mode in <String>['tap', 'enter', 'space']) {
        final GoRouter router = await _open(tester, location: _unknown);
        if (mode == 'tap') {
          await tester.tap(_home);
        } else {
          _nodeOf(tester, _homeTarget).requestFocus();
          await tester.pump();
          await tester.sendKeyEvent(
            mode == 'enter'
                ? LogicalKeyboardKey.enter
                : LogicalKeyboardKey.space,
          );
        }
        await tester.pumpAndSettle();
        _expectSingleHomeShell(tester, router);
      }
    });

    for (final String location in <String>[
      _unknown,
      _invalidDriver,
      _invalidGrandPrix,
      _invalidStandings,
    ]) {
      testWidgets('from a direct entry at $location', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await _open(tester, location: location);
        await tester.tap(_home);
        await tester.pumpAndSettle();
        _expectSingleHomeShell(tester, router);
      });
    }

    for (final String location in <String>[_unknown, _invalidDriver]) {
      testWidgets('from $location pushed above Home', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await _pushOverHome(tester, location);
        expect(_screen, findsOneWidget);
        await tester.tap(_home);
        await tester.pumpAndSettle();
        _expectSingleHomeShell(tester, router);
      });
    }
  });

  group('target and focus (7)', () {
    for (final AppThemePreference theme in _themes) {
      testWidgets('${theme.name}: 48dp pill with a visible ring', (
        WidgetTester tester,
      ) async {
        FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.alwaysTraditional;
        await _open(tester, theme: theme);
        final Size size = tester.getSize(_homeTarget);
        expect(size.height, greaterThanOrEqualTo(48));
        expect(size.width, greaterThanOrEqualTo(48));
        expect(
          tester.widget<GvPrimerFocusTarget>(_homeTarget).geometry,
          GvPrimerButton.focusGeometry,
        );
        expect(_ringVisible(tester, _homeTarget), isFalse);
        _nodeOf(tester, _homeTarget).requestFocus();
        await tester.pumpAndSettle();
        expect(_ringVisible(tester, _homeTarget), isTrue);
      });

      testWidgets('${theme.name}: circular Back ring when Back exists', (
        WidgetTester tester,
      ) async {
        FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.alwaysTraditional;
        await _open(tester, theme: theme, location: _invalidGrandPrix);
        final Finder back = find.descendant(
          of: _back,
          matching: find.byType(GvPrimerFocusTarget),
          matchRoot: true,
        );
        final GvPrimerFocusTarget target = tester.widget(back.first);
        expect(
          target.geometry.offset,
          theme == AppThemePreference.dark ? 3 : 1,
        );
        expect(target.geometry.radius, 24);
        expect(tester.getSize(back.first), const Size(48, 48));
        _nodeOf(tester, back.first).requestFocus();
        await tester.pumpAndSettle();
        expect(_ringVisible(tester, back.first), isTrue);
      });
    }

    testWidgets('keyboard order: Back, then Go to Home', (
      WidgetTester tester,
    ) async {
      await _open(tester, location: _invalidGrandPrix);
      _nodeOf(tester, _back).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(FocusManager.instance.primaryFocus, _nodeOf(tester, _homeTarget));
    });
  });

  group('Back follows the real stack (8, 9, 10)', () {
    for (final String location in <String>[_unknown, _invalidDriver]) {
      testWidgets('no Back on a root-only entry at $location', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await _open(tester, location: location);
        expect(_screen, findsOneWidget);
        expect(_back, findsNothing);
        expect(find.byType(PrimerDetailBackButton), findsNothing);
        expect(router.canPop(), isFalse);
        // The bar keeps its empty 48px back column, so the title never moves.
        expect(
          tester.getTopLeft(find.text('GridView')).dx,
          greaterThanOrEqualTo(6 + 48 + 4),
        );
      });
    }

    for (final String location in <String>[_unknown, _invalidDriver]) {
      for (final String how in <String>['app-bar Back', 'system Back']) {
        testWidgets('$location pushed above Home: $how returns to Home', (
          WidgetTester tester,
        ) async {
          final GoRouter router = await _pushOverHome(tester, location);
          expect(_screen, findsOneWidget);
          expect(_back, findsOneWidget);
          if (how == 'app-bar Back') {
            await tester.tap(_back);
          } else {
            await tester.binding.handlePopRoute();
          }
          await tester.pumpAndSettle();
          _expectSingleHomeShell(tester, router);
        });
      }
    }

    for (final String how in <String>['app-bar Back', 'system Back']) {
      testWidgets('invalid Grand Prix deep link: $how returns to Calendar', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await _open(
          tester,
          location: _invalidGrandPrix,
        );
        expect(_screen, findsOneWidget);
        expect(find.text('Invalid link'), findsOneWidget);
        expect(_back, findsOneWidget);
        if (how == 'app-bar Back') {
          await tester.tap(_back);
        } else {
          await tester.binding.handlePopRoute();
        }
        await tester.pumpAndSettle();
        expect(_screen, findsNothing);
        expect(find.byType(CalendarScreen), findsOneWidget);
        expect(shellLocation(router), '/calendar');
        expect(find.byType(AppShell, skipOffstage: false), findsOneWidget);
      });
    }
  });

  group('root versus shell placement (11)', () {
    for (final String location in <String>[
      _unknown,
      _invalidDriver,
      _invalidGrandPrix,
    ]) {
      testWidgets('$location sits above the shell, without navigation', (
        WidgetTester tester,
      ) async {
        await _open(tester, location: location);
        expect(_screen, findsOneWidget);
        expect(
          find.ancestor(of: _screen, matching: find.byType(AppShell)),
          findsNothing,
        );
        expect(find.byType(GvPrimerBottomNav), findsNothing);
      });
    }

    testWidgets('an invalid Standings season stays inside the shell', (
      WidgetTester tester,
    ) async {
      await _open(tester, location: _invalidStandings);
      expect(_screen, findsOneWidget);
      expect(find.text('Invalid link'), findsOneWidget);
      expect(
        find.ancestor(of: _screen, matching: find.byType(AppShell)),
        findsOneWidget,
      );
      expect(find.byType(GvPrimerBottomNav), findsOneWidget);
      expect(_back, findsNothing);
      // Same detail-size treatment as above the shell (D3).
      expect(
        tester
            .widget<GvPrimerEmptyState>(
              _inScreen(find.byType(GvPrimerEmptyState)),
            )
            .size,
        GvPrimerEmptySize.detail,
      );
      // The pill sits above the navigation, never under it.
      expect(
        tester.getRect(_home).bottom,
        lessThanOrEqualTo(tester.getRect(find.byType(GvPrimerBottomNav)).top),
      );
    });
  });

  group('responsive and text scale (14, 15)', () {
    for (final AppThemePreference theme in _themes) {
      for (final String lang in <String>['en', 'es']) {
        for (final _Kind kind in _kinds) {
          for (final (Size size, double scale) in <(Size, double)>[
            (const Size(390, 844), 1),
            (const Size(320, 693), 2),
          ]) {
            testWidgets('${theme.name} $lang ${kind.bodyKey} '
                '${size.width.toInt()}@${(scale * 100).toInt()}%', (
              WidgetTester tester,
            ) async {
              await _open(
                tester,
                location: kind.location,
                theme: theme,
                locale: Locale(lang),
                size: size,
                textScale: scale,
              );
              expect(tester.takeException(), isNull);
              _expectWholeContentReachable(tester, kind.copy[lang]!);
            });
          }
        }
      }
    }

    testWidgets('in the Standings shell at 320@200%, Spanish', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        location: _invalidStandings,
        locale: const Locale('es'),
        size: const Size(320, 693),
        textScale: 2,
        theme: AppThemePreference.light,
      );
      expect(tester.takeException(), isNull);
      _expectWholeContentReachable(tester, _invalidCopy['es']!);
      expect(
        tester.getRect(_home).bottom,
        lessThanOrEqualTo(tester.getRect(find.byType(GvPrimerBottomNav)).top),
      );
    });

    testWidgets('a short viewport scrolls to the whole message and the pill', (
      WidgetTester tester,
    ) async {
      // 320 x 480 @200%: the block is taller than the viewport.
      await _open(
        tester,
        locale: const Locale('es'),
        size: const Size(320, 480),
        textScale: 2,
      );
      expect(tester.takeException(), isNull);
      final Finder scrollable = _inScreen(find.byType(Scrollable));
      final ScrollPosition position = tester
          .state<ScrollableState>(scrollable)
          .position;
      expect(position.maxScrollExtent, greaterThan(0));
      await tester.scrollUntilVisible(_home, 80, scrollable: scrollable);
      await tester.pumpAndSettle();
      final Rect viewport = tester.getRect(scrollable);
      final Rect pill = tester.getRect(_home);
      expect(pill.top, greaterThanOrEqualTo(viewport.top));
      expect(pill.bottom, lessThanOrEqualTo(viewport.bottom));
      await tester.tap(_home);
      await tester.pumpAndSettle();
      expect(find.byType(HomeScreen), findsOneWidget);
    });
  });

  group('no legacy presentation (16)', () {
    for (final _Kind kind in _kinds) {
      testWidgets(kind.bodyKey, (WidgetTester tester) async {
        await _open(tester, location: kind.location);
        for (final Type legacy in <Type>[
          GvErrorState,
          GvEmptyState,
          GvAppBar,
          AppBar,
          BackButton,
          GvPrimaryButton,
          GvSecondaryButton,
        ]) {
          expect(
            _inScreen(find.byType(legacy)),
            findsNothing,
            reason: '$legacy',
          );
        }
        expect(_inScreen(find.byType(PrimerDetailAppBar)), findsOneWidget);
        expect(_inScreen(find.byType(GvPrimerEmptyState)), findsOneWidget);
        expect(_inScreen(find.byType(GvPrimerButton)), findsOneWidget);
        expect(_inScreen(find.byType(ListView)), findsOneWidget);
      });
    }
  });
}

/// The title, the whole message and the pill render without truncation and
/// can each be brought fully inside the scroll viewport.
void _expectWholeContentReachable(WidgetTester tester, _Copy copy) {
  final Finder scrollable = _inScreen(find.byType(Scrollable));
  expect(scrollable, findsOneWidget);
  final Rect viewport = tester.getRect(scrollable);
  for (final String text in <String>[copy.title, copy.message]) {
    final Text widget = tester.widget(_inScreen(find.text(text)));
    expect(widget.maxLines, isNull, reason: text);
    expect(widget.overflow, isNull, reason: text);
  }
  // Nothing is wider than the screen.
  final Rect screen = tester.getRect(_screen);
  for (final Finder f in <Finder>[
    _inScreen(find.text(copy.title)),
    _inScreen(find.text(copy.message)),
    _home,
  ]) {
    final Rect r = tester.getRect(f);
    expect(r.left, greaterThanOrEqualTo(screen.left));
    expect(r.right, lessThanOrEqualTo(screen.right));
  }
  // Whatever lies below the viewport is within the scroll extent, so the
  // pill is reachable (the short-viewport test scrolls to it).
  final ScrollPosition position = tester
      .state<ScrollableState>(scrollable)
      .position;
  final double hidden = tester.getRect(_home).bottom - viewport.bottom;
  expect(hidden, lessThanOrEqualTo(position.maxScrollExtent + 0.5));
}
