import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/tokens/tokens.dart';
import 'package:gridview/core/widgets/widgets.dart';

import '../support/component_harness.dart';

/// [GvSectionHeader]'s trailing action shares the row's width with the title
/// rather than taking its natural size, so a long localized label (or a large
/// text scale) ellipsizes instead of overflowing.
///
/// Ellipsis is a **visual** treatment only: the complete label stays available
/// to accessibility, the target keeps its minimum size, and the title keeps a
/// usable share of the row.
void main() {
  // The longest trailing actions Phase 7C introduces, in both locales.
  const String longEn = "View constructors' standings";
  const String longEs = 'Ver clasificación de constructores';
  const String longTitleEn = 'Constructors’ Championship summary';

  Future<void> pumpHeader(
    WidgetTester tester, {
    required String title,
    required String actionLabel,
    double textScale = 1.0,
    double width = 390,
  }) async {
    await pumpComponent(
      tester,
      SizedBox(
        width: width,
        child: GvSectionHeader(
          title: title,
          actionLabel: actionLabel,
          onAction: () {},
        ),
      ),
      textScale: textScale,
    );
  }

  group('layout', () {
    test('the widest Phase 7C labels are the ones under test', () {
      expect(longEs.length, greaterThan(longEn.length));
    });

    for (final (String locale, String label) in <(String, String)>[
      ('en', longEn),
      ('es', longEs),
    ]) {
      testWidgets('a long $locale action does not overflow at 1x', (
        WidgetTester tester,
      ) async {
        await pumpHeader(tester, title: longTitleEn, actionLabel: label);
        expect(tester.takeException(), isNull);
      });

      testWidgets('a long $locale action does not overflow at 2x text', (
        WidgetTester tester,
      ) async {
        await pumpHeader(
          tester,
          title: longTitleEn,
          actionLabel: label,
          textScale: 2.0,
        );
        expect(tester.takeException(), isNull);
      });

      testWidgets('a long $locale action does not overflow on a narrow phone', (
        WidgetTester tester,
      ) async {
        await pumpHeader(
          tester,
          title: longTitleEn,
          actionLabel: label,
          width: 320,
        );
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('the title keeps a usable share of the row', (
      WidgetTester tester,
    ) async {
      const double width = 390;
      await pumpHeader(
        tester,
        title: longTitleEn,
        actionLabel: longEs,
        width: width,
      );
      final Size titleSize = tester.getSize(find.text(longTitleEn));
      expect(
        titleSize.width,
        greaterThanOrEqualTo(width / 2 - 1),
        reason: 'the title and the action each get half the row at most',
      );
    });

    testWidgets('the action stays at least the minimum touch target', (
      WidgetTester tester,
    ) async {
      await pumpHeader(tester, title: longTitleEn, actionLabel: longEs);
      final Size action = tester.getSize(find.byType(TextButton));
      expect(action.height, greaterThanOrEqualTo(GvLayout.minTouchTarget));
      expect(action.width, greaterThanOrEqualTo(GvLayout.minTouchTarget));
    });

    testWidgets('a header without an action renders only its title', (
      WidgetTester tester,
    ) async {
      await pumpComponent(
        tester,
        const SizedBox(
          width: 390,
          child: GvSectionHeader(title: 'Championship'),
        ),
      );
      expect(find.byType(TextButton), findsNothing);
      expect(find.text('Championship'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('semantics', () {
    testWidgets('the complete action label survives visual truncation', (
      WidgetTester tester,
    ) async {
      await pumpHeader(
        tester,
        title: longTitleEn,
        actionLabel: longEs,
        width: 320,
      );

      // The painted glyphs are ellipsized, but the semantic label is the whole
      // string — an assistive technology reads the full action.
      final RenderParagraph paragraph = tester.renderObject<RenderParagraph>(
        find.text(longEs),
      );
      expect(paragraph.overflow, TextOverflow.ellipsis);
      expect(paragraph.text.toPlainText(), longEs);

      final SemanticsData data = tester
          .getSemantics(find.text(longEs))
          .getSemanticsData();
      expect(data.label, longEs);
    });

    testWidgets('the action exposes a button with a tap action', (
      WidgetTester tester,
    ) async {
      await pumpHeader(tester, title: longTitleEn, actionLabel: longEn);
      final SemanticsData data = tester
          .getSemantics(find.byType(TextButton))
          .getSemanticsData();
      expect(data.hasAction(SemanticsAction.tap), isTrue);
    });

    testWidgets('the header is announced as a heading', (
      WidgetTester tester,
    ) async {
      await pumpHeader(tester, title: 'Championship', actionLabel: longEn);
      expect(
        tester
            .getSemantics(find.byType(GvSectionHeader))
            .getSemanticsData()
            .flagsCollection
            .isHeader,
        isTrue,
      );
    });

    testWidgets('no tooltip is introduced for the trailing action', (
      WidgetTester tester,
    ) async {
      // The design system does not use tooltips for section actions, so an
      // ellipsized label must not silently acquire one.
      await pumpHeader(tester, title: longTitleEn, actionLabel: longEs);
      expect(find.byType(Tooltip), findsNothing);
    });
  });

  group('the action still works', () {
    testWidgets('tapping an ellipsized action invokes it', (
      WidgetTester tester,
    ) async {
      int taps = 0;
      await pumpComponent(
        tester,
        SizedBox(
          width: 320,
          child: GvSectionHeader(
            title: longTitleEn,
            actionLabel: longEs,
            onAction: () => taps++,
          ),
        ),
      );
      await tester.tap(find.byType(TextButton));
      await tester.pump();
      expect(taps, 1);
    });
  });
}
