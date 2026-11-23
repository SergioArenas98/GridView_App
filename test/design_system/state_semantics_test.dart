import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/widgets/widgets.dart';

import '../support/a11y_harness.dart';
import '../support/component_harness.dart';

/// Accessibility behaviour of the shared *state* components: the loading frame,
/// the error state, the empty state and the offline notice.
///
/// These are the components a screen swaps in when it has nothing else to show,
/// so they are exactly the moments a screen-reader user most needs told what
/// happened — and exactly the moments a silent or doubled announcement is least
/// likely to be noticed by a sighted reviewer.
void main() {
  group('GvErrorState', () {
    testWidgets('exposes one live region that actually carries text', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(
        tester,
        GvErrorState(
          title: "Can't load Home",
          message: 'You appear to be offline.',
          retryLabel: 'Try again',
          onRetry: () {},
        ),
      );

      final List<SemanticsData> regions = liveRegions(tester);
      expect(regions, hasLength(1));
      expect(
        regions.single.label,
        isNotEmpty,
        reason: 'an unlabelled live region announces nothing',
      );
      handle.dispose();
    });

    testWidgets('keeps the visible title as a heading', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(
        tester,
        const GvErrorState(
          title: "Can't load Home",
          message: 'You appear to be offline.',
        ),
      );

      expect(
        nodeLabelled(tester, "Can't load Home").flagsCollection.isHeader,
        isTrue,
      );
      expect(headings(tester), hasLength(1));
      handle.dispose();
    });

    testWidgets('announces the title and the message once each', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(
        tester,
        GvErrorState(
          title: "Can't load Home",
          message: 'You appear to be offline.',
          retryLabel: 'Try again',
          onRetry: () {},
        ),
      );

      expect(labelOccurrences(tester, "Can't load Home"), 1);
      expect(labelOccurrences(tester, 'You appear to be offline.'), 1);
      expect(labelOccurrences(tester, 'Try again'), 1);
      handle.dispose();
    });
  });

  group('GvEmptyState', () {
    testWidgets('exposes one live region that actually carries text', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(
        tester,
        const GvEmptyState(
          title: 'Results not available yet',
          message: 'Classifications appear once the session is official.',
        ),
      );

      final List<SemanticsData> regions = liveRegions(tester);
      expect(regions, hasLength(1));
      expect(regions.single.label, isNotEmpty);
      handle.dispose();
    });

    testWidgets('keeps the visible title as a heading and never doubles the '
        'copy', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(
        tester,
        GvEmptyState(
          title: 'Results not available yet',
          message: 'Classifications appear once the session is official.',
          actionLabel: 'Try again',
          onAction: () {},
        ),
      );

      expect(
        nodeLabelled(
          tester,
          'Results not available yet',
        ).flagsCollection.isHeader,
        isTrue,
      );
      expect(labelOccurrences(tester, 'Results not available yet'), 1);
      expect(
        labelOccurrences(
          tester,
          'Classifications appear once the session is official.',
        ),
        1,
      );
      expect(labelOccurrences(tester, 'Try again'), 1);
      handle.dispose();
    });
  });

  group('GvOfflineNotice', () {
    const String message =
        'This data may be out of date — showing the last saved version.';

    testWidgets('carries its message on exactly one semantics node', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(tester, const GvOfflineNotice(message: message));

      expect(
        labelOccurrences(tester, message),
        1,
        reason: 'the parent label and the visible Text must not both speak',
      );
      handle.dispose();
    });

    testWidgets('keeps the notice a live region', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(tester, const GvOfflineNotice(message: message));

      final List<SemanticsData> regions = liveRegions(tester);
      expect(regions, hasLength(1));
      expect(regions.single.label, message);
      handle.dispose();
    });

    testWidgets('still renders the message visibly', (
      WidgetTester tester,
    ) async {
      await pumpComponent(tester, const GvOfflineNotice(message: message));

      expect(find.text(message), findsOneWidget);
    });
  });
}
