// Step 55C.12F: the GPD-12 content-sized team link under the flutter_test
// font, as the canonical goldens render it (this file deliberately never
// loads Archivo).
//
// The link measures its text to hug it; the rendered `Text` merges the
// ambient `DefaultTextStyle`. If the measurement used another style, the
// paragraph laid out again in the hugging box re-wrapped and clipped a word
// ("Red Bull Racing" → "Red" / "Bull"), which only this font exposed.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/grand_prix_review_fixtures.dart';
import '../support/router_harness.dart';

void main() {
  for (final (Size size, double scale) in <(Size, double)>[
    (const Size(390, 2400), 1),
    (const Size(320, 9000), 2),
  ]) {
    testWidgets('team links keep their measured lines at '
        '${size.width.toInt()}@${(scale * 100).toInt()}%', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/calendar/2026/13',
        surfaceSize: size,
        textScale: scale,
        disableAnimations: true,
        repository: FakeRaceWeekendRepository(
          home: homeViewFixture(),
          calendar: (int season) => calendarFixture(season: season),
          grandPrix: (int s, int r) => grandPrixDetailFixture(s, r),
          results: (int s, int r) => <RaceResult>[
            // A sprint document (its own id), so the race id stays unique.
            raceResultFixture(
              sessionType: SessionType.sprint,
              entries: const <RaceResultEntry>[
                RaceResultEntry(
                  driverId: 'max-verstappen',
                  constructorId: 'red-bull',
                  driverName: 'Max Verstappen',
                  constructorName: 'Red Bull Racing',
                  position: 1,
                  points: 25,
                  status: FinishStatus.finished,
                ),
              ],
            ),
            syntheticFullFieldRace(),
          ],
        ),
      );
      final Finder links = find.byType(GvPrimerTrailingChevronText);
      expect(links, findsWidgets);
      for (final Element link in links.evaluate()) {
        final RenderBox box = link.renderObject! as RenderBox;
        final String shown = (link.widget as GvPrimerTrailingChevronText).text;
        final RenderParagraph paragraph = tester.renderObject(
          find
              .descendant(
                of: find.byElementPredicate((Element e) => e == link),
                matching: find.byType(RichText),
              )
              .first,
        );
        expect(
          paragraph.textSize.height,
          lessThanOrEqualTo(box.size.height + 0.5),
          reason: '"$shown" was re-wrapped and clipped by its hugging box',
        );
      }
    });
  }
}
