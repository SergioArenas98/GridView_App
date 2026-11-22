// XS-19 measurement probe (review evidence, not a test of record).
//
//   XS19_BATCHES="<batch dir>;<batch dir>" \
//     flutter test tool/primer_review/xs19_full_season_probe_test.dart
//
// Renders the production CalendarScreen with the **real** 2026 calendar of a
// private, owner-approved season batch (`<dir>/artifact.json`, read in place,
// never copied into the repository), opened with a stale-data notice so the
// N-6 notice-first positioning applies. For each batch × (EN 390×844 @100%,
// ES 320×693 @200%) × (Dark, Light) it writes the real rendered geometry to
// build/primer-review/xs19/<label>-<lang>-<viewport>-<theme>.json:
// the opening offset, the visible area, the notice, and every round row's
// content offset and height, plus restoration and laziness checks.
// Nothing in the batch is altered: statuses, formats, names, circuits,
// localities and classified-result flags are used exactly as delivered.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/calendar/presentation/widgets/calendar_event_row.dart';
import 'package:gridview/features/calendar/presentation/widgets/calendar_header.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';

import '../../test/support/domain_fixtures.dart';
import '../../test/support/fake_repository.dart';
import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

List<CalendarEntry> _entries(String dir) {
  final Map<String, dynamic> artifact =
      jsonDecode(File('$dir/artifact.json').readAsStringSync())
          as Map<String, dynamic>;
  final List<dynamic> docs = artifact['documents'] as List<dynamic>;
  Map<String, dynamic> doc(String name) => docs
      .cast<Map<String, dynamic>>()
      .firstWhere((Map<String, dynamic> d) => d['documentName'] == name);
  final Map<String, Map<String, dynamic>> circuits =
      <String, Map<String, dynamic>>{
        for (final dynamic c in doc('circuits')['data'] as List<dynamic>)
          (c as Map<String, dynamic>)['id'] as String: c,
      };
  return <CalendarEntry>[
    for (final dynamic raw in doc('calendar')['data'] as List<dynamic>)
      () {
        final Map<String, dynamic> e = raw as Map<String, dynamic>;
        final Map<String, dynamic>? c = circuits[e['circuitId']];
        return CalendarEntry(
          grandPrix: GrandPrix(
            id: e['id'] as String,
            season: e['season'] as int,
            round: e['round'] as int,
            eventSlug: e['eventSlug'] as String,
            name: e['name'] as String,
            circuitId: e['circuitId'] as String,
            status: EventStatus.fromWire(e['status'] as String?),
            format: WeekendFormat.values.firstWhere(
              (WeekendFormat f) => f.wire == e['format'],
              orElse: () => WeekendFormat.unknown,
            ),
            startDate: e['startDate'] as String?,
            endDate: e['endDate'] as String?,
            timezone: e['timezone'] as String?,
            hasResults: e['hasResults'] as bool,
            // The calendar document carries no sessions (they arrive with a
            // Grand Prix document), exactly as on a device that has not
            // opened the event.
            sessions: const [],
          ),
          circuit: c == null
              ? null
              : Circuit(
                  id: c['id'] as String,
                  name: c['name'] as String,
                  locality: c['locality'] as String?,
                  countryCode: c['countryCode'] as String?,
                ),
        );
      }(),
  ];
}

Finder get _list => find
    .descendant(
      of: find.byType(CalendarScreen),
      matching: find.byType(Scrollable),
    )
    .first;

void main() {
  final String? batches = Platform.environment['XS19_BATCHES'];
  if (batches == null || batches.isEmpty) {
    test('XS19_BATCHES not set', () {}, skip: 'no batch directories given');
    return;
  }
  final Directory out = Directory('build/primer-review/xs19')
    ..createSync(recursive: true);

  for (final String dir in batches.split(';')) {
    final String label = dir
        .replaceAll(r'\', '/')
        .split('/')
        .where((String s) => s.isNotEmpty)
        .toList()
        .reversed
        .take(2)
        .toList()
        .reversed
        .join('_');
    for (final (String lang, Size size, double scale)
        in const <(String, Size, double)>[
          ('en', Size(390, 844), 1),
          ('es', Size(320, 693), 2),
        ]) {
      for (final AppThemePreference theme in const <AppThemePreference>[
        AppThemePreference.dark,
        AppThemePreference.light,
      ]) {
        final String name =
            '$label-$lang-${size.width.toInt()}x${size.height.toInt()}'
            '-${(scale * 100).toInt()}-${theme.wire}';
        testWidgets(name, (WidgetTester tester) async {
          await loadArchivo(tester);
          final List<CalendarEntry> entries = _entries(dir);
          final GoRouter router = await pumpApp(
            tester,
            initialLocation: '/calendar',
            surfaceSize: size,
            locale: Locale(lang),
            textScale: scale,
            disableAnimations: true,
            preferences: AppPreferences.defaults.copyWith(theme: theme),
            // A stale calendar record: the N-6 notice-first opening.
            syncMetadata: (String key) =>
                syncedMetadata(key, staleAfter: DateTime.utc(2026, 7, 18, 11)),
            repository: FakeRaceWeekendRepository(
              home: homeViewFixture(),
              dashboard: homeDashboardFixture(),
              calendar: (int season) => entries,
              grandPrix: (int s, int r) => grandPrixDetailFixture(s, r),
            ),
          );
          final ScrollPosition position = tester
              .state<ScrollableState>(_list)
              .position;
          final Rect list = tester.getRect(_list);
          final Rect header = tester.getRect(find.byType(CalendarHeader));
          final Rect nav = tester.getRect(find.byType(GvPrimerBottomNav));
          final double opening = position.pixels;
          final Rect notice = tester.getRect(find.byType(GvPrimerNotice));
          final int builtAtOpening = find
              .byType(CalendarEventRow)
              .evaluate()
              .length;

          // Walk the whole list, half a viewport at a time, recording each
          // round row's content offset and height from real layout.
          final Map<int, Map<String, Object>> rows =
              <int, Map<String, Object>>{};
          double offset = 0;
          int maxBuilt = builtAtOpening;
          while (true) {
            position.jumpTo(offset.clamp(0, position.maxScrollExtent));
            await tester.pump();
            final int built = find.byType(CalendarEventRow).evaluate().length;
            if (built > maxBuilt) maxBuilt = built;
            for (final CalendarEntry e in entries) {
              final Finder row = find.byKey(
                ValueKey<String>('calendar-event-${e.round}'),
              );
              if (row.evaluate().isEmpty) continue;
              final Rect r = tester.getRect(row);
              final bool highlighted = tester
                  .widget<GvPrimerRaceRow>(
                    find.descendant(
                      of: row,
                      matching: find.byType(GvPrimerRaceRow),
                    ),
                  )
                  .highlighted;
              rows[e.round] = <String, Object>{
                'round': e.round,
                'name': e.grandPrix.name,
                'contentTop': r.top - list.top + position.pixels,
                'height': r.height,
                'highlighted': highlighted,
              };
            }
            if (position.pixels >= position.maxScrollExtent - 0.5 &&
                rows.length == entries.length) {
              break;
            }
            offset = position.pixels + position.viewportDimension / 2;
          }
          expect(tester.takeException(), isNull);
          final double maxExtent = position.maxScrollExtent;

          // Restoration with the full season: at the next round, switch tabs
          // and come back; open its Grand Prix and come back.
          final int next =
              rows.values.firstWhere(
                    (Map<String, Object> r) => r['highlighted'] == true,
                  )['round']!
                  as int;
          final Finder nextRow = find.byKey(
            ValueKey<String>('calendar-event-$next'),
          );
          position.jumpTo(0);
          await tester.pump();
          await tester.scrollUntilVisible(nextRow, 200, scrollable: _list);
          await tester.pumpAndSettle();
          final double atNext = position.pixels;
          router.go('/');
          await tester.pumpAndSettle();
          router.go('/calendar');
          await tester.pumpAndSettle();
          final double afterTab = tester
              .state<ScrollableState>(_list)
              .position
              .pixels;
          // Near the row's top: at 320 @200% the row is taller than the
          // viewport, so its centre can lie outside it.
          final Rect target = tester.getRect(nextRow);
          final double area = tester.getRect(_list).top;
          await tester.tapAt(
            Offset(
              target.left + 60,
              (target.top < area ? area : target.top) + 24,
            ),
          );
          await tester.pumpAndSettle();
          final bool detail = find
              .byType(GrandPrixDetailScreen)
              .evaluate()
              .isNotEmpty;
          // Back (locale-independent): what the back button does.
          router.pop();
          await tester.pumpAndSettle();
          final double afterDetail = tester
              .state<ScrollableState>(_list)
              .position
              .pixels;
          expect(tester.takeException(), isNull);

          File('${out.path}/$name.json').writeAsStringSync(
            const JsonEncoder.withIndent(' ').convert(<String, Object>{
              'batch': label,
              'lang': lang,
              'size': <double>[size.width, size.height],
              'textScale': scale,
              'theme': theme.wire,
              'listRect': <double>[list.top, list.bottom],
              'headerBottom': header.bottom,
              'navTop': nav.top,
              'viewport': position.viewportDimension,
              'openingOffset': opening,
              'maxScrollExtent': maxExtent,
              'noticeRect': <double>[notice.top, notice.bottom],
              'builtRowsAtOpening': builtAtOpening,
              'maxBuiltRows': maxBuilt,
              'nextRound': next,
              'restoration': <String, Object>{
                'atNext': atNext,
                'afterTabSwitch': afterTab,
                'openedDetail': detail,
                'afterDetailBack': afterDetail,
              },
              'rows': (rows.keys.toList()..sort())
                  .map((int k) => rows[k])
                  .toList(),
            }),
          );
        });
      }
    }
  }
}
