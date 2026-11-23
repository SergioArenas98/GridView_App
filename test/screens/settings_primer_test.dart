// Step 55C.13A: the Settings root and the Language, Theme and Time display
// screens in Primer V2. The information screens (Data, Acknowledgements,
// Privacy, About) are Step 55C.13B: settings_information_primer_test.dart.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/preferences/preference_store.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/preferences/preferences_repository.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/settings/application/external_links.dart';
import 'package:gridview/features/settings/presentation/preference_choice_screen.dart';
import 'package:gridview/features/settings/presentation/preference_screens.dart';
import 'package:gridview/features/settings/presentation/settings_screen.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_app_bar.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_navigation_row.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_option_list.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_primer_text.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_rows_density.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_selection_mark.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_snackbar.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_app_bar.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

const Size _tall = Size(390, 1600);
const String _saveFailed = 'That setting could not be saved. Please try again.';
const String _openFailed = 'That link could not be opened.';

const ValueKey<String> _language = ValueKey<String>('settings-language');
const ValueKey<String> _theme = ValueKey<String>('settings-theme');
const ValueKey<String> _time = ValueKey<String>('settings-time');
const ValueKey<String> _feedback = ValueKey<String>('settings-feedback');
const ValueKey<String> _catalogue = ValueKey<String>('settings-catalogue');

ValueKey<Object?> _option(Object value) =>
    ValueKey<Object?>('preference-option-$value');

/// A store that can fail chosen keys and hold writes until released, so a
/// test drives the real repository's rollback and supersession.
class _ControlledStore implements PreferenceStore {
  _ControlledStore({
    Map<String, String>? initial,
    this.failing = const <String>{},
  }) : _values = <String, String>{...?initial};

  final Map<String, String> _values;
  Set<String> failing;
  Completer<void>? gate;
  int writes = 0;

  Map<String, String> get values => Map<String, String>.unmodifiable(_values);

  @override
  String? read(String key) => _values[key];

  @override
  Future<void> write(String key, String value) async {
    writes++;
    final Completer<void>? hold = gate;
    if (hold != null) await hold.future;
    if (failing.contains(key)) {
      throw StateError('Simulated preference write failure for "$key".');
    }
    _values[key] = value;
  }
}

Map<String, String> _seed(AppPreferences p) => <String, String>{
  PreferenceKeys.language: p.language.wire,
  PreferenceKeys.theme: p.theme.wire,
  PreferenceKeys.timeDisplay: p.timeDisplay.wire,
};

Future<GoRouter> _pump(
  WidgetTester tester, {
  String location = '/settings',
  AppEnvironment environment = AppEnvironment.development,
  ExternalLinkConfig linkConfig = const ExternalLinkConfig(),
  ExternalLinkLauncher? launcher,
  AppPreferences preferences = AppPreferences.defaults,
  PreferenceStore? store,
  double textScale = 1,
  Size size = _tall,
  Locale locale = const Locale('en'),
  FakeRaceWeekendRepository? repository,
}) async {
  await loadArchivo(tester);
  FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  return pumpApp(
    tester,
    initialLocation: location,
    environment: environment,
    linkConfig: linkConfig,
    linkLauncher: launcher,
    preferences: preferences,
    preferenceStore: store,
    textScale: textScale,
    surfaceSize: size,
    locale: locale,
    repository: repository,
    disableAnimations: true,
  );
}

GvPrimerRoles _roles(WidgetTester tester) =>
    GvPrimerSurface.of(tester.element(find.byType(SettingsAppBar).last)).roles;

Color _pageColour(WidgetTester tester) =>
    tester.widget<Scaffold>(find.byType(Scaffold).last).backgroundColor!;

FocusNode _rowNode(WidgetTester tester, Key key) => tester
    .widget<GvPrimerFocusTarget>(
      find.descendant(
        of: find.byKey(key),
        matching: find.byType(GvPrimerFocusTarget),
      ),
    )
    .focusNode!;

/// The focus node of a [GvPrimerFocusTarget] that owns its node.
FocusNode _targetNode(WidgetTester tester, Finder target) => Focus.of(
  tester.element(
    find.descendant(of: target, matching: find.byType(GestureDetector)).first,
  ),
);

bool _ringVisible(WidgetTester tester, Finder target) => tester
    .widget<GvPrimerFocusRing>(
      find.descendant(of: target, matching: find.byType(GvPrimerFocusRing)),
    )
    .visible;

/// Switches the focus highlight to keyboard mode, as a hardware key does.
Future<void> _keyboardMode(WidgetTester tester) async {
  await tester.sendKeyEvent(LogicalKeyboardKey.shiftLeft);
  await tester.pump();
  expect(FocusManager.instance.highlightMode, FocusHighlightMode.traditional);
}

Finder _checkedOption() =>
    find.byWidgetPredicate((Widget w) => w is SettingsOption && w.selected);

/// Every paragraph inside [screen] shows its whole text: no clipping, no
/// ellipsis, inside the screen, and (when [wholeWords]) no word broken
/// across lines.
void _expectAllTextVisible(
  WidgetTester tester,
  Finder screen, {
  bool wholeWords = true,
}) {
  expect(tester.takeException(), isNull);
  final Rect bounds = tester.getRect(screen);
  for (final Element e
      in find
          .descendant(of: screen, matching: find.byType(RichText))
          .evaluate()) {
    final RenderParagraph p = e.renderObject! as RenderParagraph;
    final String text = p.text.toPlainText();
    if (text.trim().isEmpty) continue;
    expect(p.didExceedMaxLines, isFalse, reason: text);
    expect(
      p.textSize.width,
      lessThanOrEqualTo(p.size.width + 0.5),
      reason: '"$text" is wider than its box',
    );
    expect(
      p.textSize.height,
      lessThanOrEqualTo(p.size.height + 0.5),
      reason: '"$text" is taller than its box',
    );
    final Rect box = p.localToGlobal(Offset.zero) & p.size;
    expect(box.left, greaterThanOrEqualTo(bounds.left - 0.5), reason: text);
    expect(box.right, lessThanOrEqualTo(bounds.right + 0.5), reason: text);
    if (!wholeWords) continue;
    for (final RegExpMatch m in RegExp(r'\S+').allMatches(text)) {
      final List<TextBox> boxes = p.getBoxesForSelection(
        TextSelection(baseOffset: m.start, extentOffset: m.end),
      );
      final Set<double> tops = <double>{
        for (final TextBox b in boxes) b.top.roundToDouble(),
      };
      expect(tops, hasLength(1), reason: '"${m[0]}" breaks inside "$text"');
    }
  }
}

/// The number of lines [p] lays its text out on.
int _lineCount(RenderParagraph p) => <double>{
  for (final TextBox b in p.getBoxesForSelection(
    TextSelection(baseOffset: 0, extentOffset: p.text.toPlainText().length),
  ))
    b.top.roundToDouble(),
}.length;

double _wdth(TextStyle? style) =>
    style?.fontVariations
        ?.where((FontVariation v) => v.axis == 'wdth')
        .map((FontVariation v) => v.value)
        .firstOrNull ??
    100;

GrandPrixDetailView _belgium() => GrandPrixDetailView(
  grandPrix: GrandPrix(
    id: '2026-belgian-grand-prix',
    season: 2026,
    round: 13,
    eventSlug: 'belgian-grand-prix',
    name: 'Belgian Grand Prix',
    circuitId: 'spa-francorchamps',
    status: EventStatus.upcoming,
    format: WeekendFormat.sprint,
    startDate: '2026-07-24',
    endDate: '2026-07-26',
    timezone: 'Europe/Brussels',
    sessions: belgianSprintSessions(),
    hasResults: false,
  ),
  circuit: circuitSpa(),
  freshness: freshness(
    generatedAt: DateTime.utc(2026, 7, 18, 12),
    staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
  ),
);

void main() {
  tearDown(() {
    FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  });

  group('root', () {
    testWidgets('scenario A: production with a contact keeps the groups, '
        'values and mail glyph, and no developer section', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        environment: AppEnvironment.production,
        linkConfig: ExternalLinkConfig(
          supportContact: ExternalLink.parse('support@example.org'),
        ),
      );
      expect(find.byType(SettingsScreen), findsOneWidget);
      // Primer chrome; the retired GvScreenScaffold drew the legacy bar.
      expect(find.byType(SettingsAppBar), findsOneWidget);
      expect(find.byType(GvAppBar), findsNothing);

      // The groups, in order.
      final List<double> kickers = <String>[
        'Preferences',
        'Data and application',
        'Privacy and support',
      ].map((String t) => tester.getTopLeft(find.text(t)).dy).toList();
      expect(kickers, orderedEquals(<double>[...kickers]..sort()));
      expect(find.text('Developer'), findsNothing);
      expect(find.byKey(_catalogue), findsNothing);

      // Each preference row: label above its current value, small mark.
      expect(find.byType(SettingsSelectionMark), findsNWidgets(3));
      expect(
        tester.getTopLeft(find.text('Language')).dy,
        lessThan(tester.getTopLeft(find.text('System default')).dy),
      );
      expect(find.text('Dark'), findsOneWidget);
      expect(find.text('Device time'), findsOneWidget);

      // Send feedback: the mail glyph replaces the chevron, once.
      final Finder feedback = find.byKey(_feedback);
      final Iterable<GvPrimerIcon> icons = tester.widgetList<GvPrimerIcon>(
        find.descendant(of: feedback, matching: find.byType(GvPrimerIcon)),
      );
      expect(icons.map((GvPrimerIcon i) => i.glyph), <GvPrimerGlyph>[
        GvPrimerGlyph.mail,
      ]);
      expect(
        find.descendant(
          of: feedback,
          matching: find.byType(GvPrimerRowChevron),
        ),
        findsNothing,
      );
      expect(find.byIcon(Icons.mail_outline), findsNothing);
      expect(
        tester
            .widgetList<GvPrimerIcon>(find.byType(GvPrimerIcon))
            .where((GvPrimerIcon i) => i.glyph == GvPrimerGlyph.mail),
        hasLength(1),
      );
    });

    testWidgets('production with no contact omits the feedback row', (
      WidgetTester tester,
    ) async {
      await _pump(tester, environment: AppEnvironment.production);
      expect(find.byKey(_feedback), findsNothing);
      expect(find.text('No contact address is configured.'), findsNothing);
      expect(find.text('Developer'), findsNothing);
      expect(find.byKey(const ValueKey<String>('settings-privacy')), findsOne);
    });

    testWidgets('non-production with no contact shows the static status row '
        'and the developer catalogue without a decorative icon', (
      WidgetTester tester,
    ) async {
      await _pump(tester, environment: AppEnvironment.staging);
      final Finder feedback = find.byKey(_feedback);
      expect(feedback, findsOneWidget);
      expect(
        find.descendant(
          of: feedback,
          matching: find.byType(GvPrimerFocusTarget),
        ),
        findsNothing,
      );
      expect(
        find.descendant(of: feedback, matching: find.byType(GvPrimerIcon)),
        findsNothing,
      );
      final Text title = tester.widget<Text>(
        find.descendant(of: feedback, matching: find.text('Send feedback')),
      );
      expect(title.style?.color, _roles(tester).text.secondary);

      final Finder catalogue = find.byKey(_catalogue);
      expect(find.text('Developer'), findsOneWidget);
      expect(
        find.descendant(of: catalogue, matching: find.byType(Icon)),
        findsNothing,
      );
      expect(
        tester
            .widgetList<GvPrimerIcon>(
              find.descendant(
                of: catalogue,
                matching: find.byType(GvPrimerIcon),
              ),
            )
            .map((GvPrimerIcon i) => i.glyph),
        <GvPrimerGlyph>[GvPrimerGlyph.chevronRight],
      );
    });

    testWidgets('development with a contact shows the working feedback row', (
      WidgetTester tester,
    ) async {
      final RecordingExternalLinkLauncher launcher =
          RecordingExternalLinkLauncher();
      await _pump(
        tester,
        linkConfig: ExternalLinkConfig(
          supportContact: ExternalLink.parse('support@example.org'),
        ),
        launcher: launcher,
      );
      expect(find.text('No contact address is configured.'), findsNothing);
      await tester.tap(find.byKey(_feedback));
      await tester.pumpAndSettle();
      expect(launcher.opened.single.scheme, 'mailto');
      expect(find.byType(SettingsSnackbarContent), findsNothing);
    });

    testWidgets('a failed feedback hand-off shows the Primer snackbar without '
        'the address', (WidgetTester tester) async {
      await _pump(
        tester,
        linkConfig: ExternalLinkConfig(
          supportContact: ExternalLink.parse('support@example.org'),
        ),
        launcher: RecordingExternalLinkLauncher(succeeds: false),
      );
      await tester.tap(find.byKey(_feedback));
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byType(SettingsSnackbarContent),
          matching: find.text(_openFailed),
        ),
        findsOneWidget,
      );
      expect(find.textContaining('example.org'), findsNothing);
      expect(find.textContaining('mailto'), findsNothing);
    });

    testWidgets('rows are at least 60dp (48dp target) and speak title, value '
        'and description as one button', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _pump(tester);
      for (final Key key in <Key>[
        _language,
        _theme,
        _time,
        const ValueKey<String>('settings-data'),
        const ValueKey<String>('settings-acknowledgements'),
        const ValueKey<String>('settings-about'),
        const ValueKey<String>('settings-privacy'),
        _feedback,
        _catalogue,
      ]) {
        expect(
          tester.getSize(find.byKey(key)).height,
          greaterThanOrEqualTo(SettingsNavigationRow.minHeight),
          reason: '$key',
        );
      }
      expect(
        tester.getSemantics(find.byKey(_time)),
        isSemantics(
          label: 'Time display, Device time',
          isButton: true,
          hasTapAction: true,
          isFocusable: true,
        ),
      );
      expect(
        tester.getSemantics(find.byKey(_catalogue)),
        isSemantics(
          label: 'Component catalogue, Development-only design-system gallery',
          isButton: true,
          hasTapAction: true,
        ),
      );
      expect(
        tester.getSemantics(find.byKey(_feedback)),
        isSemantics(label: 'Send feedback, No contact address is configured.'),
      );
      // The kicker and the app-bar title are headings; the title names the
      // route.
      expect(
        tester.getSemantics(find.text('Preferences')),
        isSemantics(label: 'Preferences', isHeader: true),
      );
      expect(
        tester.getSemantics(
          find.descendant(
            of: find.byType(SettingsAppBar),
            matching: find.text('Settings'),
          ),
        ),
        isSemantics(label: 'Settings', isHeader: true, namesRoute: true),
      );
      handle.dispose();
    });

    testWidgets('a pressed row fills with state.pressed.control', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      final Finder row = find.byKey(_language);
      final TestGesture gesture = await tester.startGesture(
        tester.getCenter(row),
      );
      await tester.pump();
      final Iterable<DecoratedBox> fills = tester
          .widgetList<DecoratedBox>(
            find.descendant(of: row, matching: find.byType(DecoratedBox)),
          )
          .where(
            (DecoratedBox b) =>
                (b.decoration as BoxDecoration?)?.color ==
                _roles(tester).state.pressedControl,
          );
      expect(fills, isNotEmpty);
      await gesture.cancel();
    });
  });

  group('preference screens', () {
    final Map<String, (Type, List<String>, String)> screens =
        <String, (Type, List<String>, String)>{
          '/settings/language': (
            LanguageSettingsScreen,
            <String>['System default', 'English', 'Español'],
            'System default',
          ),
          '/settings/theme': (
            ThemeSettingsScreen,
            <String>['System', 'Dark', 'Light'],
            'Dark',
          ),
          '/settings/time': (
            TimeDisplaySettingsScreen,
            <String>['Device time', 'Event time', 'Both'],
            'Device time',
          ),
        };

    for (final MapEntry<String, (Type, List<String>, String)> entry
        in screens.entries) {
      testWidgets('${entry.key}: options, one checked radio, no "Selected" '
          'suffix, explanation in the label', (WidgetTester tester) async {
        final SemanticsHandle handle = tester.ensureSemantics();
        await _pump(tester, location: entry.key);
        final (Type type, List<String> labels, String selected) = entry.value;
        expect(find.byType(type), findsOneWidget);
        expect(find.byType(SettingsOption), findsNWidgets(labels.length));
        for (final String label in labels) {
          final Finder option = find.ancestor(
            of: find.text(label),
            matching: find.byType(SettingsOption),
          );
          final SettingsOption widget = tester.widget<SettingsOption>(option);
          final String spoken = settingsSpokenLabel(<String?>[
            label,
            widget.description,
          ]);
          expect(spoken, isNot(contains('Selected')));
          expect(
            tester.getSemantics(option),
            isSemantics(
              label: spoken,
              isButton: true,
              hasCheckedState: true,
              isChecked: label == selected,
              isSelected: label == selected,
              isInMutuallyExclusiveGroup: true,
              hasTapAction: true,
              isFocusable: true,
            ),
            reason: label,
          );
          expect(
            tester.getSize(option).height,
            greaterThanOrEqualTo(SettingsOption.minHeight),
          );
        }
        expect(_checkedOption(), findsOneWidget);
        // The option explanation is part of the spoken name, not a hint.
        final SemanticsData data = tester
            .getSemantics(_checkedOption())
            .getSemanticsData();
        expect(data.hint, isEmpty);
        handle.dispose();
      });
    }

    testWidgets('the selected option is the filled mark with a check and '
        'weight 800; the others are outlined at 550', (
      WidgetTester tester,
    ) async {
      await _pump(tester, location: '/settings/theme');
      final Finder dark = find.byKey(_option(AppThemePreference.dark));
      final Finder light = find.byKey(_option(AppThemePreference.light));
      expect(
        find.descendant(of: dark, matching: find.byType(GvPrimerIcon)),
        findsOneWidget,
      );
      expect(
        find.descendant(of: light, matching: find.byType(GvPrimerIcon)),
        findsNothing,
      );
      FontWeight? weight(Finder option, String label) => tester
          .widget<Text>(find.descendant(of: option, matching: find.text(label)))
          .style
          ?.fontWeight;
      expect(weight(dark, 'Dark'), FontWeight.w800);
      expect(weight(light, 'Light'), FontWeight.w500);
    });

    testWidgets('choosing a theme applies it in place, without leaving the '
        'screen or resetting navigation', (WidgetTester tester) async {
      await _pump(tester);
      final Color darkPage = _pageColour(tester);
      await tester.tap(find.byKey(_theme));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(_option(AppThemePreference.light)));
      await tester.pumpAndSettle();

      expect(find.byType(ThemeSettingsScreen), findsOneWidget);
      expect(_pageColour(tester), isNot(darkPage));
      expect(_pageColour(tester), GvPrimerRoles.light.surface.page);
      expect(tester.widget<SettingsOption>(_checkedOption()).label, 'Light');
      // The light roles reach the open screen.
      expect(_roles(tester).brightness, Brightness.light);

      // Back returns to the same root, which now shows the new value.
      await tester.tap(find.byType(PrimerDetailBackButton));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(find.byType(ThemeSettingsScreen), findsNothing);
      expect(find.text('Light'), findsOneWidget);
    });

    testWidgets('choosing a language re-renders the open screen in place', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      await tester.tap(find.byKey(_language));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(_option(AppLanguagePreference.spanish)));
      await tester.pumpAndSettle();

      expect(find.byType(LanguageSettingsScreen), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(SettingsAppBar),
          matching: find.text('Idioma'),
        ),
        findsOneWidget,
      );
      expect(tester.widget<SettingsOption>(_checkedOption()).label, 'Español');

      await tester.tap(find.byType(PrimerDetailBackButton));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(find.text('Preferencias'), findsOneWidget);
      expect(find.text('Español'), findsOneWidget);
    });

    testWidgets('the time display choice reaches an open Grand Prix and '
        'Home', (WidgetTester tester) async {
      final GoRouter router = await _pump(
        tester,
        location: '/',
        repository: FakeRaceWeekendRepository(
          dashboard: homeDashboardFixture(),
          home: homeViewFixture(),
          calendar: (int season) => calendarFixture(season: season),
          grandPrix: (int s, int r) => _belgium(),
        ),
        size: const Size(390, 2400),
      );
      // Home: the device clock (UTC in the harness), no event zone.
      expect(find.textContaining('UTC'), findsWidgets);
      expect(find.textContaining('CEST'), findsNothing);

      // The Calendar's session times live on the Grand Prix route (the
      // list shows dates only, never converted).
      unawaited(router.push('/calendar/2026/13'));
      await tester.pumpAndSettle();
      expect(find.text('10:30 UTC'), findsOneWidget);
      expect(find.text('12:30 CEST'), findsNothing);

      unawaited(router.push('/settings/time'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(_option(TimeDisplayPreference.event)));
      await tester.pumpAndSettle();
      expect(find.byType(TimeDisplaySettingsScreen), findsOneWidget);

      await tester.tap(find.byType(PrimerDetailBackButton).last);
      await tester.pumpAndSettle();
      expect(find.text('12:30 CEST'), findsOneWidget);
      expect(find.text('10:30 UTC'), findsNothing);

      // Home, under the stack, follows the same preference.
      router.pop();
      await tester.pumpAndSettle();
      expect(find.byType(GrandPrixDetailScreen), findsNothing);
      expect(find.textContaining('CEST'), findsWidgets);
    });
  });

  group('persistence', () {
    testWidgets('a failed write restores the stored value and shows the '
        'Primer snackbar in a live region', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final _ControlledStore store = _ControlledStore(
        initial: _seed(AppPreferences.defaults),
        failing: <String>{PreferenceKeys.theme},
      );
      await _pump(tester, location: '/settings/theme', store: store);
      final Color darkPage = _pageColour(tester);

      await tester.tap(find.byKey(_option(AppThemePreference.light)));
      await tester.pumpAndSettle();

      // Rolled back: Dark is checked again and the page is Dark.
      expect(tester.widget<SettingsOption>(_checkedOption()).label, 'Dark');
      expect(_pageColour(tester), darkPage);
      expect(store.values[PreferenceKeys.theme], 'dark');

      // The existing message, in the Primer inverse snackbar.
      final Finder snack = find.byType(SettingsSnackbarContent);
      expect(snack, findsOneWidget);
      expect(
        find.descendant(of: snack, matching: find.text(_saveFailed)),
        findsOneWidget,
      );
      final DecoratedBox plane = tester.widget<DecoratedBox>(
        find.descendant(of: snack, matching: find.byType(DecoratedBox)).first,
      );
      expect(
        (plane.decoration as BoxDecoration).color,
        GvPrimerRoles.dark.fill.snackbar.fill,
      );
      final Text message = tester.widget<Text>(find.text(_saveFailed));
      expect(message.style?.color, GvPrimerRoles.dark.fill.snackbar.on);

      // Announced: the message is inside a live region.
      SemanticsNode? node = tester.getSemantics(find.text(_saveFailed));
      bool live = false;
      while (node != null) {
        if (node.getSemanticsData().flagsCollection.isLiveRegion) live = true;
        node = node.parent;
      }
      expect(live, isTrue);
      handle.dispose();
    });

    testWidgets('the snackbar takes the Light inverse plane in Light', (
      WidgetTester tester,
    ) async {
      final AppPreferences light = AppPreferences.defaults.copyWith(
        theme: AppThemePreference.light,
      );
      await _pump(
        tester,
        location: '/settings/time',
        store: _ControlledStore(
          initial: _seed(light),
          failing: <String>{PreferenceKeys.timeDisplay},
        ),
      );
      await tester.tap(find.byKey(_option(TimeDisplayPreference.both)));
      await tester.pumpAndSettle();
      final DecoratedBox plane = tester.widget<DecoratedBox>(
        find
            .descendant(
              of: find.byType(SettingsSnackbarContent),
              matching: find.byType(DecoratedBox),
            )
            .first,
      );
      expect(
        (plane.decoration as BoxDecoration).color,
        GvPrimerRoles.light.fill.snackbar.fill,
      );
      expect(
        tester.widget<Text>(find.text(_saveFailed)).style?.color,
        GvPrimerRoles.light.fill.snackbar.on,
      );
      expect(
        tester.widget<SettingsOption>(_checkedOption()).label,
        'Device time',
      );
    });

    testWidgets('a failure reverts only its own preference', (
      WidgetTester tester,
    ) async {
      final _ControlledStore store = _ControlledStore(
        initial: _seed(AppPreferences.defaults),
        failing: <String>{PreferenceKeys.theme},
      );
      await _pump(tester, store: store);
      await tester.tap(find.byKey(_time));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(_option(TimeDisplayPreference.event)));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsSnackbarContent), findsNothing);
      await tester.tap(find.byType(PrimerDetailBackButton));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(_theme));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(_option(AppThemePreference.light)));
      await tester.pumpAndSettle();
      expect(find.text(_saveFailed), findsOneWidget);
      await tester.tap(find.byType(PrimerDetailBackButton));
      await tester.pumpAndSettle();

      expect(find.text('Event time'), findsOneWidget);
      expect(find.text('Dark'), findsOneWidget);
      expect(store.values[PreferenceKeys.timeDisplay], 'event');
      expect(store.values[PreferenceKeys.theme], 'dark');
    });

    testWidgets('a superseded write is silent and the latest choice wins', (
      WidgetTester tester,
    ) async {
      final _ControlledStore store = _ControlledStore(
        initial: _seed(AppPreferences.defaults),
      )..gate = Completer<void>();
      await _pump(tester, location: '/settings/theme', store: store);

      // Light is written (held); System and then Dark queue behind it, so
      // the System write is superseded by Dark before it runs.
      await tester.tap(find.byKey(_option(AppThemePreference.light)));
      await tester.pump();
      await tester.tap(find.byKey(_option(AppThemePreference.system)));
      await tester.pump();
      await tester.tap(find.byKey(_option(AppThemePreference.dark)));
      await tester.pump();
      expect(tester.widget<SettingsOption>(_checkedOption()).label, 'Dark');

      store.gate!.complete();
      store.gate = null;
      await tester.pumpAndSettle();

      expect(find.byType(SettingsSnackbarContent), findsNothing);
      expect(find.text(_saveFailed), findsNothing);
      expect(tester.widget<SettingsOption>(_checkedOption()).label, 'Dark');
      expect(store.values[PreferenceKeys.theme], 'dark');
      // Light and Dark were written; System never reached the store.
      expect(store.writes, 2);
    });

    testWidgets('a failure after a language rebuild still reaches the '
        'messenger', (WidgetTester tester) async {
      final _ControlledStore store = _ControlledStore(
        initial: _seed(AppPreferences.defaults),
        failing: <String>{PreferenceKeys.language},
      )..gate = Completer<void>();
      await _pump(tester, location: '/settings/language', store: store);

      await tester.tap(find.byKey(_option(AppLanguagePreference.spanish)));
      await tester.pumpAndSettle();
      // The optimistic Spanish snapshot rebuilt the whole app.
      expect(find.text('Idioma'), findsOneWidget);

      store.gate!.complete();
      store.gate = null;
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Language'), findsOneWidget);
      expect(find.byType(LanguageSettingsScreen), findsOneWidget);
      expect(find.text(_saveFailed), findsOneWidget);
    });
  });

  group('keyboard', () {
    testWidgets('Enter and Space select; one focus stop per option; the '
        'ring shows only in keyboard mode', (WidgetTester tester) async {
      await _pump(tester, location: '/settings/theme');
      final Finder system = find.byKey(_option(AppThemePreference.system));
      final Finder light = find.byKey(_option(AppThemePreference.light));
      final Finder dark = find.byKey(_option(AppThemePreference.dark));

      await _keyboardMode(tester);
      _targetNode(tester, system).requestFocus();
      await tester.pumpAndSettle();
      expect(_ringVisible(tester, system), isTrue);

      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(tester.widget<SettingsOption>(_checkedOption()).label, 'System');

      // Tab moves to the next option: no stop inside an option.
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(_targetNode(tester, dark).hasPrimaryFocus, isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(_targetNode(tester, light).hasPrimaryFocus, isTrue);

      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pumpAndSettle();
      expect(tester.widget<SettingsOption>(_checkedOption()).label, 'Light');
      expect(_ringVisible(tester, light), isTrue);
    });

    testWidgets('a root row activates with Enter and with Space', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      await _keyboardMode(tester);
      _rowNode(tester, _time).requestFocus();
      await tester.pumpAndSettle();
      expect(_ringVisible(tester, find.byKey(_time)), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pumpAndSettle();
      expect(find.byType(TimeDisplaySettingsScreen), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.byType(TimeDisplaySettingsScreen), findsOneWidget);
    });
  });

  group('focus restoration', () {
    testWidgets('Back from a preference screen returns keyboard focus to the '
        'originating row', (WidgetTester tester) async {
      await _pump(tester);
      await _keyboardMode(tester);
      final FocusNode row = _rowNode(tester, _theme);
      row.requestFocus();
      await tester.pumpAndSettle();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.byType(ThemeSettingsScreen), findsOneWidget);
      expect(row.hasPrimaryFocus, isFalse);

      // Back through the app bar's back action, from the keyboard.
      _targetNode(
        tester,
        find.byKey(PreferenceChoiceScreen.backKey),
      ).requestFocus();
      await tester.pumpAndSettle();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.byType(ThemeSettingsScreen), findsNothing);
      expect(row.hasPrimaryFocus, isTrue);
      expect(_ringVisible(tester, find.byKey(_theme)), isTrue);
    });

    testWidgets('system Back after a change in place also restores focus', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      await _keyboardMode(tester);
      final FocusNode row = _rowNode(tester, _language);
      row.requestFocus();
      await tester.pumpAndSettle();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      // Change the language from the keyboard: the app rebuilds in Spanish.
      _targetNode(
        tester,
        find.byKey(_option(AppLanguagePreference.spanish)),
      ).requestFocus();
      await tester.pumpAndSettle();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.text('Idioma'), findsOneWidget);

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(find.text('Ajustes'), findsOneWidget);
      expect(_rowNode(tester, _language).hasPrimaryFocus, isTrue);
    });

    testWidgets('a touch round trip never forces focus onto the row', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      await tester.tap(find.byKey(_theme));
      await tester.pumpAndSettle();
      expect(find.byType(ThemeSettingsScreen), findsOneWidget);
      await tester.tap(find.byType(PrimerDetailBackButton));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(FocusManager.instance.highlightMode, FocusHighlightMode.touch);
      expect(_rowNode(tester, _theme).hasFocus, isFalse);
      expect(_ringVisible(tester, find.byKey(_theme)), isFalse);
    });

    testWidgets('a row activated from the keyboard but returned to by touch '
        'is not refocused', (WidgetTester tester) async {
      await _pump(tester);
      await _keyboardMode(tester);
      final FocusNode row = _rowNode(tester, _time);
      row.requestFocus();
      await tester.pumpAndSettle();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      await tester.tap(find.byType(PrimerDetailBackButton));
      await tester.pumpAndSettle();
      expect(FocusManager.instance.highlightMode, FocusHighlightMode.touch);
      expect(_ringVisible(tester, find.byKey(_time)), isFalse);
    });
  });

  group('rendering', () {
    final List<(AppThemePreference, Locale, Size, double)>
    configs = <(AppThemePreference, Locale, Size, double)>[
      (AppThemePreference.dark, const Locale('en'), const Size(390, 1600), 1),
      (AppThemePreference.dark, const Locale('es'), const Size(320, 3200), 2),
      (AppThemePreference.light, const Locale('en'), const Size(390, 1600), 1),
      (AppThemePreference.light, const Locale('es'), const Size(320, 3200), 2),
    ];
    for (final String route in <String>[
      '/settings',
      '/settings/language',
      '/settings/theme',
      '/settings/time',
    ]) {
      for (final (
            AppThemePreference theme,
            Locale locale,
            Size size,
            double scale,
          )
          in configs) {
        testWidgets('$route ${theme.wire} ${locale.languageCode} '
            '${size.width.toInt()} @${(scale * 100).toInt()}%: whole text, '
            'no overflow, no broken word', (WidgetTester tester) async {
          await _pump(
            tester,
            location: route,
            preferences: AppPreferences.defaults.copyWith(
              theme: theme,
              language: locale.languageCode == 'es'
                  ? AppLanguagePreference.spanish
                  : AppLanguagePreference.english,
            ),
            size: size,
            textScale: scale,
          );
          expect(
            _roles(tester).brightness,
            theme == AppThemePreference.dark
                ? Brightness.dark
                : Brightness.light,
          );
          expect(_pageColour(tester), _roles(tester).surface.page);
          final Finder screen = route == '/settings'
              ? find.byType(SettingsScreen)
              : find.byWidgetPredicate(
                  (Widget w) => w is PreferenceChoiceScreen,
                );
          _expectAllTextVisible(tester, screen);
        });
      }
    }

    testWidgets('the app-bar title wraps between words and narrows only an '
        'overlong single word', (WidgetTester tester) async {
      await loadArchivo(tester);
      Future<Text> title(String text, double width, double scale) async {
        await tester.binding.setSurfaceSize(Size(width, 400));
        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData(
              extensions: <ThemeExtension<dynamic>>[GvPrimerRoles.dark],
            ),
            home: MediaQuery(
              data: MediaQueryData(
                size: Size(width, 400),
                textScaler: TextScaler.linear(scale),
              ),
              child: Scaffold(
                body: Column(children: <Widget>[SettingsAppBar(title: text)]),
              ),
            ),
          ),
        );
        await tester.pump();
        return tester.widget<Text>(find.text(text));
      }

      addTearDown(() => tester.binding.setSurfaceSize(null));

      // A multi-word title wraps at the approved width and size.
      const String long = 'Hora de las sesiones del fin de semana de carrera';
      final Text wrapped = await title(long, 320, 2);
      expect(_wdth(wrapped.style), 88);
      expect(wrapped.style?.fontSize, 21);
      final RenderParagraph p = tester.renderObject(find.text(long));
      expect(p.size.height, greaterThan(21 * 2 * 1.25 * 1.5));
      _expectAllTextVisible(tester, find.byType(SettingsAppBar));

      // A single word that does not fit narrows the width axis, never the
      // size.
      // "Agradecimientos" at 320 @200% fits whole at wdth 62, as in the
      // approved S-2 reference, with the reference's normal tracking.
      final Text single = await title('Agradecimientos', 320, 2);
      expect(_wdth(single.style), 62);
      expect(single.style?.fontSize, 21);
      expect(single.style?.letterSpacing, 0);
      _expectAllTextVisible(tester, find.byType(SettingsAppBar));

      // At 390 @100% it keeps the approved width.
      final Text normal = await title('Agradecimientos', 390, 1);
      expect(_wdth(normal.style), 88);
    });
  });

  group('compact root rows (Step 55C.13AR)', () {
    test('the tier follows the reference container query in em of the '
        'list (Chrome measurement)', () {
      SettingsRowsDensity tier(double width, double scale) =>
          SettingsRowsDensity.of(width, TextScaler.linear(scale));
      // Chrome 55C.13AR: `.srows` is 15px x text size; tier 1 at <= 17em,
      // tier 2 at <= 12.5em.
      expect(tier(390, 1), SettingsRowsDensity.regular);
      expect(tier(390, 1.5), SettingsRowsDensity.regular);
      expect(tier(390, 2), SettingsRowsDensity.compact);
      expect(tier(360, 1.75), SettingsRowsDensity.compact);
      expect(tier(360, 2), SettingsRowsDensity.narrow);
      expect(tier(320, 1), SettingsRowsDensity.regular);
      expect(tier(320, 1.3), SettingsRowsDensity.compact);
      expect(tier(320, 1.5), SettingsRowsDensity.compact);
      expect(tier(320, 1.75), SettingsRowsDensity.narrow);
      expect(tier(320, 2), SettingsRowsDensity.narrow);
      // Inclusive boundaries, as `max-width`.
      expect(tier(255, 1), SettingsRowsDensity.compact);
      expect(tier(255.5, 1), SettingsRowsDensity.regular);
      expect(tier(187.5, 1), SettingsRowsDensity.narrow);
      expect(tier(double.infinity, 2), SettingsRowsDensity.regular);

      expect(SettingsRowsDensity.regular.titleWidths, <double>[100, 88, 70]);
      expect(SettingsRowsDensity.compact.titleWidths, <double>[88, 70]);
      expect(SettingsRowsDensity.narrow.titleWidths, <double>[70]);
      expect(SettingsRowsDensity.regular.valueWidths, <double>[92, 76, 66]);
      expect(SettingsRowsDensity.compact.valueWidths, <double>[76, 66]);
      expect(SettingsRowsDensity.narrow.valueWidths, <double>[66]);
      expect(
        SettingsRowsDensity.narrow.valueLetterSpacing(TextScaler.linear(2)),
        closeTo(-0.38, 1e-9),
      );
      expect(
        SettingsRowsDensity.compact.valueLetterSpacing(TextScaler.linear(2)),
        0,
      );
    });

    // Lines per title and value in the approved reference (Chrome,
    // set-index-dark[.es].html, 55C.13AR); every one not listed is 1 line.
    const Map<String, Map<String, int>> twoLines = <String, Map<String, int>>{
      'es 390@200': <String, int>{
        'Predeterminado del sistema': 2,
        'Datos y actualizaciones': 2,
        'Información de la aplicación': 2,
        'Privacidad y aviso legal': 2,
      },
      'es 360@175': <String, int>{
        'Predeterminado del sistema': 2,
        'Información de la aplicación': 2,
      },
      'es 320@150': <String, int>{
        'Predeterminado del sistema': 2,
        'Información de la aplicación': 2,
      },
      'es 320@200': <String, int>{
        'Predeterminado del sistema': 2,
        'Hora del dispositivo': 2,
        'Datos y actualizaciones': 2,
        'Información de la aplicación': 2,
        'Privacidad y aviso legal': 2,
      },
    };
    final List<(String, double, double, SettingsRowsDensity)> configs =
        <(String, double, double, SettingsRowsDensity)>[
          ('en', 390, 1, SettingsRowsDensity.regular),
          ('es', 390, 1, SettingsRowsDensity.regular),
          ('en', 390, 2, SettingsRowsDensity.compact),
          ('es', 390, 2, SettingsRowsDensity.compact),
          ('en', 360, 1.75, SettingsRowsDensity.compact),
          ('es', 360, 1.75, SettingsRowsDensity.compact),
          ('en', 320, 1.5, SettingsRowsDensity.compact),
          ('es', 320, 1.5, SettingsRowsDensity.compact),
          ('en', 320, 2, SettingsRowsDensity.narrow),
          ('es', 320, 2, SettingsRowsDensity.narrow),
        ];
    const List<Key> rowKeys = <Key>[
      _language,
      _theme,
      _time,
      ValueKey<String>('settings-data'),
      ValueKey<String>('settings-acknowledgements'),
      ValueKey<String>('settings-about'),
      ValueKey<String>('settings-privacy'),
      _feedback,
    ];
    for (final (String lang, double width, double scale, SettingsRowsDensity d)
        in configs) {
      final String name = '$lang ${width.toInt()}@${(scale * 100).toInt()}';
      testWidgets('$name: every row title and value takes the ${d.name} '
          'tier and wraps as the reference', (WidgetTester tester) async {
        final SemanticsHandle handle = tester.ensureSemantics();
        await _pump(
          tester,
          environment: AppEnvironment.production,
          linkConfig: ExternalLinkConfig(
            supportContact: ExternalLink.parse('support@example.org'),
          ),
          preferences: AppPreferences.defaults.copyWith(
            theme: AppThemePreference.dark,
          ),
          locale: Locale(lang),
          size: Size(width, 3200),
          textScale: scale,
        );
        final List<Text> texts = tester
            .widgetList<Text>(
              find.descendant(
                of: find.byType(SettingsNavigationRow),
                matching: find.byType(Text),
              ),
            )
            .toList();
        final List<Text> titles = texts
            .where((Text t) => t.style?.fontSize == SettingsType.rowTitle.size)
            .toList();
        final List<Text> values = texts
            .where((Text t) => t.style?.fontSize == SettingsType.rowValue.size)
            .toList();
        expect(titles, hasLength(5));
        expect(values, hasLength(3));
        final double valueTracking = d.valueLetterSpacing(
          TextScaler.linear(scale),
        );
        final Map<String, int> expected = twoLines[name] ?? <String, int>{};
        final List<String> spoken = <String>[
          for (final Key k in rowKeys) tester.getSemantics(find.byKey(k)).label,
        ];
        for (final Text t in <Text>[...titles, ...values]) {
          final bool isValue = values.contains(t);
          final String text = t.data!;
          // One width for every row in the list: no per-text narrowing.
          expect(
            _wdth(t.style),
            isValue ? d.valueWidth : d.titleWidth,
            reason: text,
          );
          expect(
            t.style?.letterSpacing,
            isValue ? valueTracking : 0,
            reason: text,
          );
          // The size is never reduced; the system text size scales it.
          expect(
            t.style?.fontSize,
            isValue ? SettingsType.rowValue.size : SettingsType.rowTitle.size,
          );
          final RenderParagraph p = tester.renderObject<RenderParagraph>(
            find.text(text),
          );
          expect(
            _lineCount(p),
            expected[text] ?? 1,
            reason: '"$text" lines at $name',
          );
          // Spoken in full, inside its row's single node.
          expect(
            spoken.where((String l) => l.contains(text)),
            hasLength(1),
            reason: text,
          );
        }
        // Labels and descriptions keep their own treatment.
        for (final Text t in texts.where(
          (Text t) => t.style?.fontSize == SettingsType.rowLabel.size,
        )) {
          expect(_wdth(t.style), 100, reason: t.data);
          expect(t.style?.letterSpacing, 0, reason: t.data);
        }
        // The mark-to-value gap follows the tier.
        final Finder language = find.byKey(_language);
        final double markRight = tester
            .getTopRight(
              find.descendant(
                of: language,
                matching: find.byType(SettingsSelectionMark),
              ),
            )
            .dx;
        final double valueLeft = tester
            .getTopLeft(
              find.descendant(
                of: language,
                matching: find.text(values.first.data!),
              ),
            )
            .dx;
        expect(valueLeft - markRight, closeTo(d.markGap, 0.01));
        for (final Key k in rowKeys) {
          expect(
            tester.getSize(find.byKey(k)).height,
            greaterThanOrEqualTo(SettingsNavigationRow.minHeight),
            reason: '$k',
          );
        }
        _expectAllTextVisible(tester, find.byType(SettingsScreen));
        handle.dispose();
      });
    }

    testWidgets('the preference-choice options keep their per-label fit '
        '(unchanged by the root tier)', (WidgetTester tester) async {
      await _pump(
        tester,
        location: '/settings/language',
        locale: const Locale('es'),
        size: const Size(320, 3200),
        textScale: 2,
      );
      final BuildContext context = tester.element(
        find.byType(SettingsOptionList),
      );
      for (final Text t in tester.widgetList<Text>(
        find.descendant(
          of: find.byType(SettingsOption),
          matching: find.byType(Text),
        ),
      )) {
        if (t.style?.fontSize != SettingsType.optionLabel.size) continue;
        final RenderParagraph p = tester.renderObject<RenderParagraph>(
          find.text(t.data!),
        );
        expect(
          _wdth(t.style),
          settingsFitWidth(
            text: t.data!,
            role: SettingsType.optionLabel,
            maxWidth: p.constraints.maxWidth,
            textScaler: MediaQuery.textScalerOf(context),
            ambient: DefaultTextStyle.of(context).style,
            weight: SettingsType.optionLabelSelectedWeight,
          ),
          reason: t.data,
        );
        expect(t.style?.letterSpacing, 0, reason: t.data);
      }
      // A short option label keeps the approved width where the root list
      // at the same size is narrow (70 / 66).
      expect(_wdth(tester.widget<Text>(find.text('Español')).style), 100);
      _expectAllTextVisible(
        tester,
        find.byWidgetPredicate((Widget w) => w is PreferenceChoiceScreen),
      );
    });
  });

  group('settingsFitWidth', () {
    testWidgets('returns the first step at which the longest word fits', (
      WidgetTester tester,
    ) async {
      await loadArchivo(tester);
      const TextScaler scaler = TextScaler.linear(2);
      expect(
        settingsFitWidth(
          text: 'Oscuro',
          role: SettingsType.rowValue,
          maxWidth: 233,
          textScaler: scaler,
        ),
        92,
      );
      expect(
        settingsFitWidth(
          text: 'Predeterminado del sistema',
          role: SettingsType.rowValue,
          maxWidth: 233,
          textScaler: scaler,
        ),
        lessThan(92),
      );
      // Nothing fits in 10px: the narrowest step, never a smaller size.
      expect(
        settingsFitWidth(
          text: 'Agradecimientos',
          role: SettingsType.appBarTitle,
          maxWidth: 10,
          textScaler: scaler,
        ),
        62,
      );
      // An unbounded width keeps the approved width.
      expect(
        settingsFitWidth(
          text: 'Agradecimientos',
          role: SettingsType.appBarTitle,
          maxWidth: double.infinity,
          textScaler: scaler,
        ),
        88,
      );
    });
  });

  test('the snackbar shadow follows the theme', () {
    expect(
      SettingsSnackbarContent.shadowFor(Brightness.dark).single.color,
      const Color(0xB3000000),
    );
    expect(
      SettingsSnackbarContent.shadowFor(Brightness.light).single.color,
      const Color(0x73141518),
    );
  });

  testWidgets('showSettingsSnackbar ignores an unmounted messenger', (
    WidgetTester tester,
  ) async {
    final GlobalKey<ScaffoldMessengerState> key =
        GlobalKey<ScaffoldMessengerState>();
    await tester.pumpWidget(
      MaterialApp(
        scaffoldMessengerKey: key,
        home: const Scaffold(body: SizedBox()),
      ),
    );
    final ScaffoldMessengerState messenger = key.currentState!;
    await tester.pumpWidget(const SizedBox());
    showSettingsSnackbar(messenger, _saveFailed);
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.text(_saveFailed), findsNothing);
  });

  // Keeps the shared repository contract visible from this file: the screens
  // only call it.
  test('PreferenceWriteOutcome values are unchanged', () {
    expect(PreferenceWriteOutcome.values, hasLength(3));
  });
}
