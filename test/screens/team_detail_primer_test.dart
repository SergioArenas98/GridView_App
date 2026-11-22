// Step 55C.10: the production Team Detail in Primer V2 (Dark and Light).
//
// Presentation only: route, origin season, line-up derivation and order,
// state, refresh and media contracts are the existing ones and are asserted
// here through the real router, providers and fakes. Every value is a test
// fixture; every name starting "Synthetic" is invented.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/media/media_image_loader.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/constructors/presentation/widgets/team_banner.dart';
import 'package:gridview/features/constructors/presentation/widgets/team_lineup.dart';
import 'package:gridview/features/constructors/presentation/widgets/team_sections.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/widgets/driver_detail_app_bar.dart';
import 'package:gridview/features/drivers/presentation/widgets/driver_detail_states.dart';
import 'package:gridview/features/shared/domain/entities/constructor.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/entities/season_entry.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_app_bar.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_notices.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_states.dart';
import 'package:gridview/features/standings/application/standings_state.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';

import '../support/domain_fixtures.dart';
import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';
import '../support/fake_repository.dart';
import '../support/media_fixtures.dart';
import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

const String _team = '/constructors/alpine';

ResourceSyncState? _never(String key) => null;
ResourceSyncState? _stale(String key) =>
    syncedMetadata(key, staleAfter: DateTime.utc(2000));
Future<RefreshResult> _offline(String id, int season) async =>
    const RefreshFailure(ApiFailure(kind: ApiFailureKind.networkUnavailable));

/// Unmounts the previous app, so a second scenario in the same test starts
/// with a fresh `ProviderScope`.
Future<void> _reset(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
}

/// Opens Team Detail above Home, as from any origin, so Back exists.
Future<GoRouter> _open(
  WidgetTester tester, {
  TeamProfile? Function(int season, String id)? profile,
  Stream<TeamProfile?> Function(int season, String id)? profileStream,
  ResourceSyncState? Function(String key)? metadata,
  Future<RefreshResult> Function(String id, int season)? refresh,
  Size size = const Size(390, 2400),
  double textScale = 1,
  Locale locale = const Locale('en'),
  AppThemePreference theme = AppThemePreference.dark,
  MediaImageLoader? mediaLoader,
  int? currentSeason = 2026,
}) async {
  await _reset(tester);
  final GoRouter router = await pumpApp(
    tester,
    surfaceSize: size,
    textScale: textScale,
    locale: locale,
    currentSeason: currentSeason,
    preferences: AppPreferences.defaults.copyWith(theme: theme),
    syncMetadata: metadata,
    mediaLoader: mediaLoader,
    constructors: FakeConstructorRepository(
      profile: profileStream == null
          ? (profile ??
                (int s, String id) =>
                    teamProfileFixture(season: s, constructorId: id))
          : null,
      profileStream: profileStream,
      onRefreshDetail: refresh,
    ),
  );
  unawaited(router.push(_team));
  await tester.pumpAndSettle();
  return router;
}

Finder _key(String k) => find.byKey(ValueKey<String>(k));
Finder get _back => _key('team-detail-back');
Finder get _rows => find.byType(TeamLineupRow);
Finder _rowLink(int i) => find.descendant(
  of: _rows.at(i),
  matching: find.byType(GvPrimerFocusTarget),
);
Finder get _standingsLink => find.descendant(
  of: find.byType(GvPrimerLinkRow),
  matching: find.byType(GvPrimerFocusTarget),
);

FocusNode _nodeOf(WidgetTester tester, Finder target) => Focus.of(
  tester.element(
    find.descendant(of: target, matching: find.byType(GestureDetector)).first,
  ),
);

List<String> _traversal(SemanticsNode node) => <String>[
  if (node.label.isNotEmpty) node.label,
  for (final SemanticsNode child in node.debugListChildrenInOrder(
    DebugSemanticsDumpOrder.traversalOrder,
  ))
    ..._traversal(child),
];

double _contrast(Color a, Color b) {
  final double la = a.computeLuminance();
  final double lb = b.computeLuminance();
  return ((la > lb ? la : lb) + 0.05) / ((la > lb ? lb : la) + 0.05);
}

TeamProfile _card(
  int s,
  String id, {
  required String stable,
  required String seasonName,
  required String color,
  required TeamLineupMember member,
}) => TeamProfile(
  constructor: Constructor(id: id, name: stable, colorPrimary: color),
  season: s,
  seasonEntry: ConstructorSeasonEntry(
    id: '$s-$id',
    season: s,
    constructorId: id,
    fullName: seasonName,
    shortName: stable,
    colorPrimary: color,
  ),
  lineup: <TeamLineupMember>[member],
);

TeamProfile _redBull(int s, String id) => _card(
  s,
  id,
  stable: 'Red Bull',
  seasonName: 'Oracle Red Bull Racing',
  color: '#1E41FF',
  member: lineupMember(
    driverId: 'max-verstappen',
    name: 'Max Verstappen',
    shortCode: 'VER',
    raceNumber: 1,
  ),
);

TeamProfile _mclaren(int s, String id) => _card(
  s,
  id,
  stable: 'McLaren',
  seasonName: 'McLaren Formula 1 Team',
  color: '#FF8000',
  member: lineupMember(
    driverId: 'lando-norris',
    name: 'Lando Norris',
    shortCode: 'NOR',
    raceNumber: 4,
  ),
);

TeamProfile _withMedia(int s, String id) {
  final TeamProfile p = teamProfileFixture(season: s, constructorId: id);
  final Constructor c = p.constructor;
  return TeamProfile(
    constructor: Constructor(
      id: c.id,
      name: c.name,
      nationality: c.nationality,
      colorPrimary: c.colorPrimary,
      biography: c.biography,
      media: <MediaAsset>[
        portraitAsset(
          id: '$id-logo-v1',
          owner: id,
          entityType: MediaEntityType.constructor,
          category: MediaCategory.logo,
        ),
      ],
    ),
    season: p.season,
    seasonEntry: p.seasonEntry,
    standing: p.standing,
    lineup: p.lineup,
  );
}

/// Long and rebranded names and long facts, realistic figures: synthetic.
TeamProfile _long(int s, String id) => TeamProfile(
  constructor: Constructor(
    id: id,
    name: 'Synthetic Heritage Constructors Engineering',
    nationality: 'Synthetic Extraordinarily Long Nationality',
    colorPrimary: '#FFFFFF',
    biography: 'Synthetic biography for layout testing only.',
  ),
  season: s,
  seasonEntry: ConstructorSeasonEntry(
    id: '$s-$id',
    season: s,
    constructorId: id,
    fullName:
        'Synthetic Extraordinarily Long Rebranded Title Sponsor Formula One '
        'Racing Team',
    colorPrimary: '#FFFFFF',
    powerUnit: 'Synthetic Hybrid Power Unit Manufacturer',
    base: 'Synthetic Municipality of the Very Long Place Name',
  ),
  standing: ConstructorStanding(
    season: s,
    constructorId: id,
    position: 10,
    points: 666,
    wins: 21,
  ),
  lineup: <TeamLineupMember>[
    lineupMember(
      driverId: 'synthetic-a',
      name: 'Synthetic Maximilian-Alexander Long-Surname Testdriver',
      shortCode: 'SYA',
      raceNumber: 88,
      endRound: 11,
    ),
    lineupMember(
      driverId: 'synthetic-b',
      name: 'Synthetic Second Driver',
      raceNumber: 99,
      startRound: 12,
      endRound: 23,
    ),
    lineupMember(driverId: 'synthetic-c', name: 'Synthetic Unnumbered Driver'),
  ],
);

void main() {
  group('structure', () {
    for (final AppThemePreference theme in <AppThemePreference>[
      AppThemePreference.dark,
      AppThemePreference.light,
    ]) {
      testWidgets('${theme.wire}: banner, then Championship before Drivers '
          '(TM-01), Team details and About', (WidgetTester tester) async {
        await _open(tester, theme: theme);
        expect(tester.takeException(), isNull);
        double top(Finder f) => tester.getTopLeft(f).dy;
        final List<double> order = <double>[
          top(_key('team-banner')),
          top(_key('team-section-championship')),
          top(_key('team-section-lineup')),
          top(_key('team-section-facts')),
          top(_key('team-section-about')),
        ];
        expect(order, List<double>.of(order)..sort());
        // The section gap is 32px; the redundant "Team information" card
        // is gone and the nationality is shown once, in the banner.
        expect(find.text('Team information'), findsNothing);
        expect(find.text('French'), findsOneWidget);
        // About is plain text on the page, no card.
        expect(find.byType(GvContentCard), findsNothing);
        // The heading band: the banner sits on `surface.band` (LT-13).
        final GvPrimerRoles roles = theme == AppThemePreference.dark
            ? GvPrimerRoles.dark
            : GvPrimerRoles.light;
        final ColoredBox band = tester.widget<ColoredBox>(
          find
              .descendant(
                of: _key('team-banner'),
                matching: find.byType(ColoredBox),
              )
              .first,
        );
        expect(band.color, roles.surface.band);
      });
    }

    testWidgets('the season line follows the ready season, never a guess', (
      WidgetTester tester,
    ) async {
      await _open(tester, currentSeason: 2024);
      expect(find.text('2024 season'), findsOneWidget);
      await _open(tester, locale: const Locale('es'));
      expect(find.text('Temporada 2026'), findsOneWidget);
    });

    testWidgets('the stable name shows only when it differs (TM-02)', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      expect(find.text('Alpine'), findsOneWidget);
      await _open(
        tester,
        profile: (int s, String id) =>
            teamProfileFixture(season: s, constructorId: id, seasonName: null),
      );
      expect(find.text('Alpine'), findsOneWidget, reason: 'the heading only');
      expect(_key('team-banner-meta-1'), findsNothing);
      // The nationality is the only meta part: a fact, not a name.
      final Text nat = tester.widget<Text>(_key('team-banner-meta-0'));
      expect(nat.data, 'French');
      expect(nat.style!.color, GvPrimerRoles.dark.text.secondary);
    });

    testWidgets('a stable name alone keeps its name style', (
      WidgetTester tester,
    ) async {
      await _open(tester, profile: _redBull);
      final Text stable = tester.widget<Text>(_key('team-banner-meta-0'));
      expect(stable.data, 'Red Bull');
      expect(stable.style!.color, GvPrimerRoles.dark.text.primary);
    });

    testWidgets('a country code alone is shown without a term', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(
        tester,
        profile: (int s, String id) => TeamProfile(
          constructor: Constructor(id: id, name: 'Alpine', countryCode: 'FR'),
          season: s,
        ),
      );
      expect(find.text('FR'), findsOneWidget);
      expect(find.bySemanticsLabel('FR'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('Nationality')), findsNothing);
      handle.dispose();
    });

    testWidgets('missing data hides whole sections, never invents values', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => TeamProfile(
          constructor: Constructor(id: id, name: 'Synthetic Missing Facts'),
          season: s,
        ),
      );
      expect(tester.takeException(), isNull);
      for (final String section in <String>[
        'championship',
        'lineup',
        'facts',
        'about',
      ]) {
        expect(_key('team-section-$section'), findsNothing);
      }
      expect(_key('team-banner-rail'), findsNothing);
      expect(find.text('0'), findsNothing);
    });

    testWidgets('unranked is a word, null wins are omitted, a zero stays', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => teamProfileFixture(
          season: s,
          constructorId: id,
          standing: ConstructorStanding(
            season: s,
            constructorId: id,
            points: 0,
          ),
        ),
      );
      final GvPrimerStatStrip strip = tester.widget(
        find.byType(GvPrimerStatStrip),
      );
      expect(strip.style, GvPrimerStatStripStyle.team);
      expect(strip.stats, hasLength(2));
      expect(strip.stats.first.kind, GvPrimerStatKind.word);
      expect(strip.stats.first.value, 'Unranked');
      await _open(tester);
      final GvPrimerStatStrip full = tester.widget(
        find.byType(GvPrimerStatStrip),
      );
      expect(full.stats.map((GvPrimerStat s) => s.value), <String>[
        '6',
        '22',
        '0',
      ]);
    });

    testWidgets('content-aware strip (Step 55C.10F): Team on, Driver off', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      expect(
        tester
            .widget<GvPrimerStatStrip>(find.byType(GvPrimerStatStrip))
            .fitContent,
        isTrue,
      );
      await _reset(tester);
      final GoRouter router = await pumpApp(
        tester,
        surfaceSize: const Size(390, 2400),
        drivers: FakeDriverRepository(
          profile: (int s, String id) =>
              driverProfileFixture(season: s, driverId: id),
        ),
      );
      unawaited(router.push('/drivers/max-verstappen'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<GvPrimerStatStrip>(find.byType(GvPrimerStatStrip))
            .fitContent,
        isFalse,
      );
    });

    for (final (String lang, Size size, double scale, int lines)
        in <(String, Size, double, int)>[
          ('en', const Size(390, 2400), 1, 2),
          ('es', const Size(320, 2400), 2, 3),
        ]) {
      testWidgets('stress figures stack instead of splitting a label '
          '($lang ${size.width.toInt()} @${(scale * 100).toInt()}%)', (
        WidgetTester tester,
      ) async {
        await loadArchivo(tester);
        for (final AppThemePreference theme in <AppThemePreference>[
          AppThemePreference.dark,
          AppThemePreference.light,
        ]) {
          await _open(
            tester,
            size: size,
            textScale: scale,
            locale: Locale(lang),
            theme: theme,
            profile: (int s, String id) => teamProfileFixture(
              season: s,
              constructorId: id,
              standing: ConstructorStanding(
                season: s,
                constructorId: id,
                position: 10,
                points: 1234.5,
                wins: 12,
              ),
            ),
          );
          expect(tester.takeException(), isNull);
          final Finder strip = find.byType(GvPrimerStatStrip);
          for (final Element e
              in find
                  .descendant(of: strip, matching: find.byType(RichText))
                  .evaluate()) {
            final RenderParagraph p = e.renderObject! as RenderParagraph;
            expect(
              p.getMaxIntrinsicWidth(double.infinity),
              lessThanOrEqualTo(p.size.width + 0.5),
              reason: 'no label or value wraps',
            );
          }
          final List<String> labels = lang == 'es'
              ? <String>['Posición', 'Puntos', 'Victorias']
              : <String>['Position', 'Points', 'Wins'];
          final Set<double> tops = <double>{
            for (final String l in labels)
              tester
                  .getTopLeft(
                    find.descendant(of: strip, matching: find.text(l)),
                  )
                  .dy,
          };
          expect(tops, hasLength(lines));
        }
      });
    }

    testWidgets('a provisional standing shows the known chip', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => teamProfileFixture(
          season: s,
          constructorId: id,
          standing: ConstructorStanding(
            season: s,
            constructorId: id,
            position: 6,
            points: 22,
            provisional: true,
          ),
        ),
      );
      final GvPrimerStatusChip chip = tester.widget(
        find.byType(GvPrimerStatusChip),
      );
      expect(chip.label, 'Provisional');
      expect(chip.kind, GvPrimerChipKind.known);
    });

    testWidgets('season facts are a spec sheet of present values only', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => teamProfileFixture(
          season: s,
          constructorId: id,
          teamPrincipal: null,
          chassis: '  ',
        ),
      );
      final TeamSpecSheet sheet = tester.widget(find.byType(TeamSpecSheet));
      expect(sheet.specs.map((TeamSpec s) => s.label), <String>[
        'Power unit',
        'Base',
      ]);
    });
  });

  group('line-up', () {
    testWidgets('order is the read model\'s; one row per participation span', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => teamProfileFixture(
          season: s,
          constructorId: id,
          lineup: <TeamLineupMember>[
            lineupMember(
              driverId: 'jack-doohan',
              name: 'Jack Doohan',
              shortCode: 'DOO',
              raceNumber: 7,
              endRound: 6,
            ),
            lineupMember(
              driverId: 'pierre-gasly',
              name: 'Pierre Gasly',
              shortCode: 'GAS',
              raceNumber: 10,
            ),
            lineupMember(
              driverId: 'jack-doohan',
              name: 'Jack Doohan',
              shortCode: 'DOO',
              raceNumber: 7,
              startRound: 12,
            ),
          ],
        ),
      );
      final List<String> keys = <String>[
        for (final Widget w in tester.widgetList(_rows))
          (w.key! as ValueKey<String>).value,
      ];
      expect(keys, <String>[
        'team-lineup-2026-jack-doohan',
        'team-lineup-2026-pierre-gasly',
        'team-lineup-2026-jack-doohan-12',
      ]);
      expect(find.text('Until round\u00A06'), findsOneWidget);
      expect(find.text('From round\u00A012'), findsOneWidget);
    });

    testWidgets('a row without an observed boundary claims no period', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      // Gasly: no boundary, so no span, only the role.
      expect(
        find.descendant(of: _rows.at(0), matching: _key('team-lineup-span')),
        findsNothing,
      );
      expect(
        find.descendant(of: _rows.at(0), matching: find.text('Race driver')),
        findsOneWidget,
      );
    });

    testWidgets('the observed span is in text.accent, legible in both themes', (
      WidgetTester tester,
    ) async {
      for (final (AppThemePreference theme, GvPrimerRoles roles)
          in <(AppThemePreference, GvPrimerRoles)>[
            (AppThemePreference.dark, GvPrimerRoles.dark),
            (AppThemePreference.light, GvPrimerRoles.light),
          ]) {
        await _open(tester, theme: theme);
        final Text span = tester.widget<Text>(_key('team-lineup-span').first);
        expect(span.style!.color, roles.text.accent);
        expect(span.style!.fontWeight, FontWeight.w700);
        // Ember on Graphite, Red Oxide on the light page: AA for 14px text.
        expect(
          _contrast(roles.text.accent, roles.surface.page),
          greaterThanOrEqualTo(4.5),
        );
      }
    });

    testWidgets('no number or code anywhere: no figure column, no seam', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) => teamProfileFixture(
          season: s,
          constructorId: id,
          lineup: <TeamLineupMember>[
            lineupMember(driverId: 'jack-doohan', name: 'Jack Doohan'),
            lineupMember(driverId: 'pierre-gasly', name: 'Pierre Gasly'),
          ],
        ),
      );
      expect(_key('team-lineup-seam'), findsNothing);
      expect(_key('team-lineup-number'), findsNothing);
      expect(
        tester.getTopLeft(_key('team-lineup-name').first).dx,
        GvPrimerLayout.gutter,
      );
    });

    testWidgets('narrow (320 @200%): figures share the chevron line, no seam', (
      WidgetTester tester,
    ) async {
      await _open(tester, size: const Size(320, 2400), textScale: 2);
      expect(tester.takeException(), isNull);
      expect(_key('team-lineup-seam'), findsNothing);
      final Rect number = tester.getRect(_key('team-lineup-number').first);
      final Rect name = tester.getRect(_key('team-lineup-name').first);
      expect(name.top, greaterThan(number.bottom));
    });

    testWidgets('the seam is the 2px XT-3 shape in the team colour', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      expect(tester.getSize(_key('team-lineup-seam').first).width, 2);
      final GvPrimerTeamMark mark = tester.widget(
        find.descendant(
          of: _key('team-lineup-seam').first,
          matching: find.byType(GvPrimerTeamMark),
        ),
      );
      expect(mark.shape, GvPrimerTeamShape.seam);
      expect(mark.color, const Color(0xFF0093CC));
      // Without a colour the seam is a hairline, not a team mark.
      await _open(
        tester,
        profile: (int s, String id) => TeamProfile(
          constructor: Constructor(id: id, name: 'Alpine'),
          season: s,
          lineup: <TeamLineupMember>[
            lineupMember(
              driverId: 'pierre-gasly',
              name: 'Pierre Gasly',
              raceNumber: 10,
            ),
          ],
        ),
      );
      expect(_key('team-lineup-seam'), findsOneWidget);
      expect(
        find.descendant(
          of: _key('team-lineup-seam'),
          matching: find.byType(GvPrimerTeamMark),
        ),
        findsNothing,
      );
    });
  });

  group('team colour (XT-3)', () {
    GvPrimerTeamMarkPainter painterIn(WidgetTester tester, Finder of) => tester
        .widgetList<CustomPaint>(
          find.descendant(of: of, matching: find.byType(CustomPaint)),
        )
        .map((CustomPaint p) => p.painter)
        .whereType<GvPrimerTeamMarkPainter>()
        .first;

    testWidgets('geometry: 3px pinstripe over 46%, 4px, 12px bar to the edge', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      final Rect banner = tester.getRect(_key('team-banner'));
      final Rect pin = tester.getRect(_key('team-banner-pinstripe'));
      final Rect bar = tester.getRect(_key('team-banner-bar'));
      expect(pin.height, 3);
      expect(bar.height, 12);
      expect(bar.top - pin.bottom, 4);
      expect(bar.left, GvPrimerLayout.gutter);
      expect(bar.right, banner.right);
      expect(bar.bottom, banner.bottom);
      expect(pin.right, banner.right);
      expect(pin.width, closeTo((banner.width - 16) * 0.46, 0.01));
    });

    for (final (
          String name,
          TeamProfile Function(int, String) profile,
          AppThemePreference theme,
          bool railEdge,
          bool seamEdge,
        )
        in <
          (
            String,
            TeamProfile Function(int, String),
            AppThemePreference,
            bool,
            bool,
          )
        >[
          // #1E41FF: 2.5 on the Dark band, 2.83 on the Dark page; passes
          // on both Light surfaces.
          ('Red Bull dark', _redBull, AppThemePreference.dark, true, true),
          ('Red Bull light', _redBull, AppThemePreference.light, false, false),
          // #FF8000: passes on Dark; 2.35 on the Light band, 2.13 on the page.
          ('McLaren dark', _mclaren, AppThemePreference.dark, false, false),
          ('McLaren light', _mclaren, AppThemePreference.light, true, true),
          // #0093CC: passes on Dark and on the Light band (3.24); 2.94 on
          // the Light page.
          (
            'Alpine light',
            (int s, String id) =>
                teamProfileFixture(season: s, constructorId: id),
            AppThemePreference.light,
            false,
            true,
          ),
        ]) {
      testWidgets('$name: boundary only where the colour fails 3:1', (
        WidgetTester tester,
      ) async {
        await _open(tester, profile: profile, theme: theme);
        final GvPrimerRoles roles = theme == AppThemePreference.dark
            ? GvPrimerRoles.dark
            : GvPrimerRoles.light;
        final GvPrimerTeamMarkPainter bar = painterIn(
          tester,
          _key('team-banner-bar'),
        );
        final GvPrimerTeamMarkPainter pin = painterIn(
          tester,
          _key('team-banner-pinstripe'),
        );
        final GvPrimerTeamMarkPainter seam = painterIn(
          tester,
          _key('team-lineup-seam'),
        );
        expect(bar.edge != null, railEdge);
        expect(pin.edge != null, railEdge);
        expect(seam.edge != null, seamEdge);
        for (final GvPrimerTeamMarkPainter p in <GvPrimerTeamMarkPainter>[
          bar,
          pin,
          seam,
        ]) {
          if (p.edge != null) expect(p.edge, roles.teamEdge);
        }
        // The supplied colour is never changed; the sizes never change.
        final Color supplied = GvTeamAccent.parse(
          profile(2026, 'x').seasonEntry!.colorPrimary,
        )!;
        expect(<Color>[
          bar.color,
          pin.color,
          seam.color,
        ], everyElement(supplied));
        expect(tester.getSize(_key('team-banner-bar')).height, 12);
        expect(tester.getSize(_key('team-banner-pinstripe')).height, 3);
        expect(tester.getSize(_key('team-lineup-seam').first).width, 2);
      });
    }

    testWidgets('no colour: no rail, the banner closes with its padding', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        profile: (int s, String id) =>
            partialTeamProfileFixture(season: s, constructorId: id),
        metadata: _never,
      );
      expect(_key('team-banner-rail'), findsNothing);
      final Rect banner = tester.getRect(_key('team-banner'));
      final Rect meta = tester.getRect(_key('team-banner-meta-0'));
      // The meta line's 1em margin plus the 24px padding.
      expect(banner.bottom - meta.bottom, closeTo(15 + 24, 0.5));
    });
  });

  group('season and navigation', () {
    testWidgets('a historical Standings origin keeps its season everywhere', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/standings/constructors/2024',
        surfaceSize: const Size(390, 2400),
        standings: FakeStandingsRepository(
          constructors: (int season) =>
              constructorStandingsFixture(season: season),
        ),
      );
      await tester.tap(find.text('McLaren Formula 1 Team').first);
      await tester.pumpAndSettle();
      final ConstructorDetailScreen screen = tester.widget(
        find.byType(ConstructorDetailScreen),
      );
      expect(screen.constructorId, 'mclaren');
      expect(screen.originSeason, 2024);
      expect(find.text('2024 season'), findsOneWidget);

      // Team → Driver carries the stable driver id and the season.
      await tester.tap(_rowLink(0));
      await tester.pumpAndSettle();
      final DriverDetailScreen driver = tester.widget(
        find.byType(DriverDetailScreen),
      );
      expect(driver.driverId, 'pierre-gasly');
      expect(driver.originSeason, 2024);

      // Back to the team, then its standings link returns to the 2024
      // table it came from (openBranchDestination), never a pushed copy.
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(_standingsLink);
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsNothing);
      final StandingsScreen standings = tester.widget(
        find.byType(StandingsScreen),
      );
      expect(standings.season, 2024);
      expect(standings.championship, StandingsChampionship.constructors);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a deep link resolves the current season and has no Back', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: _team,
        surfaceSize: const Size(390, 2400),
      );
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);
      expect(_back, findsNothing);
      expect(find.text('2026 season'), findsOneWidget);
      // The title stays in place behind the empty back column.
      expect(
        tester.getTopLeft(find.text('Team').first).dx,
        6 + GvPrimerLayout.minTarget + 4,
      );
    });

    testWidgets('keyboard: Back, rows and standings by Tab and Enter', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      _nodeOf(tester, _back).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(
        FocusManager.instance.primaryFocus,
        _nodeOf(tester, _standingsLink),
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(FocusManager.instance.primaryFocus, _nodeOf(tester, _rowLink(0)));
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(FocusManager.instance.primaryFocus, _nodeOf(tester, _rowLink(1)));
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<DriverDetailScreen>(find.byType(DriverDetailScreen))
            .driverId,
        'jack-doohan',
      );

      // Space on Back pops to the origin.
      await _open(tester);
      _nodeOf(tester, _back).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsNothing);
    });

    testWidgets('focus rings: circular Back per theme, row geometry on links', (
      WidgetTester tester,
    ) async {
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.alwaysTraditional;
      addTearDown(
        () => FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.automatic,
      );
      for (final (AppThemePreference theme, double backOffset)
          in <(AppThemePreference, double)>[
            (AppThemePreference.dark, 3),
            (AppThemePreference.light, 1),
          ]) {
        await _open(tester, theme: theme);
        final GvPrimerFocusTarget back = tester.widget(_back);
        expect(back.geometry.offset, backOffset);
        expect(back.geometry.radius, 24);
        expect(
          tester.widget<GvPrimerFocusTarget>(_rowLink(0)).geometry,
          GvPrimerFocusGeometry.row,
        );
        for (final Finder target in <Finder>[
          _back,
          _rowLink(0),
          _standingsLink,
        ]) {
          _nodeOf(tester, target).requestFocus();
          await tester.pumpAndSettle();
          final CustomPaint ring = tester
              .widgetList<CustomPaint>(
                find.descendant(of: target, matching: find.byType(CustomPaint)),
              )
              .firstWhere(
                (CustomPaint p) =>
                    p.foregroundPainter is GvPrimerFocusRingPainter,
              );
          expect(
            (ring.foregroundPainter! as GvPrimerFocusRingPainter).visible,
            isTrue,
          );
        }
      }
    });
  });

  group('states and notices', () {
    testWidgets('notices: failure, stale, combined, partial (N-1, N-2)', (
      WidgetTester tester,
    ) async {
      List<String> messages() => <String>[
        for (final GvPrimerNotice n in tester.widgetList(
          find.byType(GvPrimerNotice),
        ))
          n.message,
      ];
      await _open(tester);
      expect(messages(), isEmpty);
      await _open(tester, refresh: _offline);
      expect(messages(), <String>['Update failed']);
      await _open(tester, metadata: _stale, refresh: _offline);
      expect(messages(), hasLength(1));
      expect(find.text('Team details'), findsOneWidget, reason: 'content kept');
      await _open(
        tester,
        profile: (int s, String id) =>
            partialTeamProfileFixture(season: s, constructorId: id),
        metadata: _never,
        refresh: _offline,
      );
      expect(messages(), <String>[
        'Update failed',
        'Some profile information is unavailable',
      ]);
      expect(find.text('BWT Alpine Formula One Team'), findsOneWidget);
    });

    testWidgets('loading is the static Team skeleton, announced once', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _reset(tester);
      final GoRouter router = await pumpApp(
        tester,
        surfaceSize: const Size(390, 844),
        constructors: FakeConstructorRepository(
          profileStream: (int s, String id) =>
              const Stream<TeamProfile?>.empty(),
        ),
      );
      unawaited(router.push(_team));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(TeamDetailSkeleton), findsOneWidget);
      final List<Rect> blocks = <Rect>[
        for (final Element e in find.byType(GvPrimerSkeleton).evaluate())
          () {
            final RenderBox box = e.renderObject! as RenderBox;
            return box.localToGlobal(Offset.zero) & box.size;
          }(),
      ];
      expect(blocks.first.height, TeamDetailSkeleton.bannerHeight);
      expect(blocks.first.width, 390);
      expect(blocks[1].size, const Size(140, 18));
      expect(blocks.skip(2).map((Rect r) => r.height), <double>[72, 72, 72]);
      expect(find.bySemanticsLabel('Loading'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('full-page states keep the app bar and offer retry', (
      WidgetTester tester,
    ) async {
      final FakeConstructorRepository constructors = FakeConstructorRepository(
        profile: (int s, String id) => null,
        onRefreshDetail: _offline,
      );
      final GoRouter router = await pumpApp(
        tester,
        surfaceSize: const Size(320, 693),
        textScale: 2,
        constructors: constructors,
      );
      unawaited(router.push(_team));
      await tester.pumpAndSettle();
      expect(find.byType(PrimerDetailAppBar), findsOneWidget);
      expect(find.byType(PrimerDetailMessage), findsOneWidget);
      expect(find.text("Can't load this profile"), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.byType(GvPrimerButton));
      await tester.pumpAndSettle();
      expect(constructors.detailRefreshCount, 2);
    });
  });

  group('media', () {
    testWidgets('absent, pending and failed media: no icon, banner unmoved', (
      WidgetTester tester,
    ) async {
      Future<Rect> banner({
        bool media = false,
        MediaImageLoader? loader,
      }) async {
        await _open(
          tester,
          profile: media ? _withMedia : null,
          mediaLoader: loader,
        );
        return tester.getRect(_key('team-banner'));
      }

      final Rect none = await banner();
      expect(_key('team-banner-media'), findsNothing);

      final Rect pending = await banner(media: true);
      expect(find.byKey(GvRemoteImage.pendingPlaceholderKey), findsOneWidget);
      expect(pending, none);

      final FakeMediaImageLoader loader = FakeMediaImageLoader();
      final Rect failed = await banner(media: true, loader: loader);
      expect(find.byKey(GvRemoteImage.failedPlaceholderKey), findsOneWidget);
      expect(failed, none);
      expect(loader.fetches, hasLength(1));

      for (final (bool media, MediaImageLoader? l)
          in <(bool, MediaImageLoader?)>[
            (false, null),
            (true, null),
            (true, FakeMediaImageLoader()),
          ]) {
        await banner(media: media, loader: l);
        expect(find.byType(GvImagePlaceholder), findsNothing);
        expect(
          find.byWidgetPredicate(
            (Widget w) => w is Icon && w.icon == Icons.shield_outlined,
          ),
          findsNothing,
        );
      }
      // The stable imagery is decorative: no node, no identifier.
      final GvRemoteImage image = tester.widget(_key('team-banner-media'));
      expect(image.decorative, isTrue);
      expect(image.showPlaceholder, isFalse);
      expect(find.textContaining('logo-v1'), findsNothing);
    });
  });

  group('responsive', () {
    for (final AppThemePreference theme in <AppThemePreference>[
      AppThemePreference.dark,
      AppThemePreference.light,
    ]) {
      for (final (String lang, Size size, double scale)
          in <(String, Size, double)>[
            ('en', const Size(390, 844), 1),
            ('es', const Size(390, 844), 1),
            ('en', const Size(320, 693), 2),
            ('es', const Size(320, 693), 2),
          ]) {
        for (final (String label, TeamProfile Function(int, String) profile)
            in <(String, TeamProfile Function(int, String))>[
              (
                'index',
                (int s, String id) =>
                    teamProfileFixture(season: s, constructorId: id),
              ),
              ('long names', _long),
              ('dark colour', _redBull),
            ]) {
          testWidgets(
            '${theme.wire} $lang ${size.width.toInt()} @${(scale * 100).toInt()}% '
            '$label: no overflow, no split figure or word',
            (WidgetTester tester) async {
              await loadArchivo(tester);
              await _open(
                tester,
                profile: profile,
                size: size,
                textScale: scale,
                locale: Locale(lang),
                theme: theme,
              );
              expect(tester.takeException(), isNull);
              // A race number is always one line.
              for (final Element e in _key('team-lineup-number').evaluate()) {
                final Text t = e.widget as Text;
                expect(
                  tester.getSize(find.byWidget(t)).height,
                  lessThanOrEqualTo(t.style!.fontSize! * 0.9 + 1),
                );
              }
              // The heading's longest word fits its box: never split.
              final Text name = tester.widget(_key('team-banner-name'));
              final double box = tester.getSize(_key('team-banner-name')).width;
              final TextStyle style = DefaultTextStyle.of(
                tester.element(_key('team-banner-name')),
              ).style.merge(name.style);
              for (final String word in name.data!.split(' ')) {
                final TextPainter p = TextPainter(
                  text: TextSpan(text: word, style: style),
                  textDirection: TextDirection.ltr,
                )..layout();
                expect(p.width, lessThanOrEqualTo(box + 0.5), reason: word);
                p.dispose();
              }
              await tester.dragUntilVisible(
                find.byType(TeamLineup),
                _key('team-detail-list'),
                const Offset(0, -300),
              );
              expect(tester.takeException(), isNull);
            },
          );
        }
      }
    }

    testWidgets('balanced heading: the narrowest box with the same lines', (
      WidgetTester tester,
    ) async {
      await loadArchivo(tester);
      await _open(tester);
      final Text name = tester.widget(_key('team-banner-name'));
      final Size box = tester.getSize(_key('team-banner-name'));
      // Two lines at 390, the box narrower than the 358px text width.
      expect(box.height, closeTo(2 * 36 * 1.02, 2));
      expect(box.width, lessThan(358));
      expect(name.data, 'BWT Alpine Formula One Team');
      expect(TeamBanner.balancedWidth('Alpine', name.style!, 358), 358);
    });
  });

  group('accessibility', () {
    testWidgets('reading order: heading, season, meta, sections, row facts', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(
        tester,
        profile: (int s, String id) => teamProfileFixture(
          season: s,
          constructorId: id,
          lineup: <TeamLineupMember>[
            lineupMember(
              driverId: 'jack-doohan',
              name: 'Jack Doohan',
              shortCode: 'DOO',
              raceNumber: 7,
              endRound: 6,
            ),
            lineupMember(driverId: 'synthetic-x', name: 'Synthetic Bare'),
          ],
        ),
      );
      final List<String> order = _traversal(
        tester.getSemantics(find.byType(ConstructorDetailScreen)),
      );
      final List<int> positions = <int>[
        for (final String label in <String>[
          'Team',
          'BWT Alpine Formula One Team',
          '2026 season',
          'Team: Alpine',
          'Nationality: French',
          'Championship',
          "View constructors' standings",
          'Drivers',
          'Open driver Jack Doohan',
          'Race number 7',
          'DOO',
          'Participation\nUntil round\u00A06',
          'Open driver Synthetic Bare',
          'Team details',
          'About',
        ])
          order.indexOf(label),
      ];
      expect(positions, isNot(contains(-1)), reason: order.join(' | '));
      expect(
        positions,
        List<int>.of(positions)..sort(),
        reason: order.join(' | '),
      );
      // Each value exactly once; the visible name only in the link label.
      for (final String label in <String>[
        'Race number 7',
        'DOO',
        'Participation\nUntil round\u00A06',
        'Jack Doohan',
      ]) {
        expect(
          order.where((String l) => l == label).length,
          label == 'Jack Doohan' ? 0 : 1,
          reason: label,
        );
      }
      // The bare row: its link and its role, no number, code or span.
      final int bare = order.indexOf('Open driver Synthetic Bare');
      expect(order[bare + 1], 'Role\nRace driver');
      expect(
        order.where((String l) => l.startsWith('Race number')),
        hasLength(1),
      );
      handle.dispose();
    });

    testWidgets('headings, link roles and names', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester);
      final SemanticsNode heading = tester.getSemantics(
        _key('team-banner-name'),
      );
      expect(heading.flagsCollection.isHeader, isTrue);
      for (final String section in <String>[
        'Championship',
        'Drivers',
        'Team details',
        'About',
      ]) {
        expect(
          tester.getSemantics(find.text(section)).flagsCollection.isHeader,
          isTrue,
          reason: section,
        );
      }
      final SemanticsNode row = tester.getSemantics(_rowLink(0));
      expect(row.label, 'Open driver Pierre Gasly');
      expect(row.flagsCollection.isLink, isTrue);
      expect(tester.getSemantics(_back).label, 'Back');
      handle.dispose();
    });

    testWidgets('interaction targets meet 48dp', (WidgetTester tester) async {
      await _open(tester, size: const Size(320, 2400), textScale: 2);
      expect(tester.getSize(_back), const Size(48, 48));
      expect(tester.getSize(_rowLink(0)).height, greaterThanOrEqualTo(72));
      expect(tester.getSize(_rowLink(0)).width, 320);
      expect(tester.getSize(_standingsLink).height, greaterThanOrEqualTo(56));
    });

    testWidgets('system insets: the bar clears the top, the end the bottom', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await pumpApp(
        tester,
        surfaceSize: const Size(390, 844),
        padding: const EdgeInsets.only(top: 24, bottom: 48),
      );
      unawaited(router.push(_team));
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.byType(PrimerDetailAppBar)).dy, 24);
      final ListView list = tester.widget(_key('team-detail-list'));
      expect((list.padding! as EdgeInsets).bottom, 32 + 48);
    });
  });

  group('shared detail components (Step 55C.10 extraction)', () {
    test('Driver names are aliases of the shared components', () {
      expect(DriverDetailAppBar, PrimerDetailAppBar);
      expect(DriverNoticeSpec, DetailNoticeSpec);
    });

    testWidgets('Driver and Team render the same shared app bar and notices', (
      WidgetTester tester,
    ) async {
      await _open(tester, refresh: _offline);
      expect(find.byType(PrimerDetailAppBar), findsOneWidget);
      expect(find.byType(PrimerDetailNotices), findsOneWidget);
      expect(_key('team-detail-notices'), findsOneWidget);
      await _reset(tester);
      final GoRouter router = await pumpApp(
        tester,
        surfaceSize: const Size(390, 2400),
        drivers: FakeDriverRepository(
          profile: (int s, String id) =>
              driverProfileFixture(season: s, driverId: id),
          onRefreshDetail: _offline,
        ),
      );
      unawaited(router.push('/drivers/max-verstappen'));
      await tester.pumpAndSettle();
      expect(find.byType(PrimerDetailAppBar), findsOneWidget);
      expect(_key('driver-detail-back'), findsOneWidget);
      expect(_key('driver-detail-notices'), findsOneWidget);
      expect(find.byType(DriverDetailSkeleton), findsNothing);
    });
  });
}
