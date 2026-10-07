import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/shared/domain/fixture_data_identity.dart';
import 'package:gridview/features/shared/presentation/widgets/mock_data_banner.dart';

import '../support/router_harness.dart';

const Size _tall = Size(400, 2400);

final FrozenCaptureData _frozen = FrozenCaptureData(
  capturedAt: DateTime.utc(2026, 10, 8, 12),
  season: 2026,
  sourceIds: const <String>{'jolpica'},
  manifestSha256: 'ab' * 32,
);

const String _frozenBanner =
    'Frozen test data captured 2026-10-08 — not live, no updates';
const String _sampleBanner = 'Sample data — not live results';
const String _dormant =
    'Not connected yet. GridView does not currently retrieve data from this '
    'source automatically.';
const String _frozenStatus =
    'This test build contains a fixed snapshot of data from this source, '
    'captured 2026-10-08. It receives no updates.';

List<String> _texts(WidgetTester tester) => tester
    .widgetList<Text>(find.byType(Text))
    .map((Text t) => t.data ?? t.textSpan?.toPlainText() ?? '')
    .toList(growable: false);

Future<void> _pump(
  WidgetTester tester, {
  String location = '/',
  bool mockData = true,
  FixtureDataIdentity? fixtureData,
  Locale locale = const Locale('en'),
}) async {
  await pumpApp(
    tester,
    initialLocation: location,
    mockData: mockData,
    fixtureData: fixtureData,
    locale: locale,
    surfaceSize: _tall,
    disableAnimations: true,
  );
  await tester.pumpAndSettle();
}

void main() {
  group('the fixture data banner', () {
    testWidgets('labels a frozen build with its capture date', (
      WidgetTester tester,
    ) async {
      await _pump(tester, fixtureData: _frozen);

      expect(find.byType(MockDataBanner), findsOneWidget);
      expect(find.text(_frozenBanner), findsOneWidget);
      expect(find.text(_sampleBanner), findsNothing);
      expect(
        tester
            .widgetList<Semantics>(
              find.descendant(
                of: find.byType(MockDataBanner),
                matching: find.byType(Semantics),
              ),
            )
            .map((Semantics s) => s.properties.label),
        contains(_frozenBanner),
      );
    });

    testWidgets('keeps the committed sample fixtures labelled as sample data', (
      WidgetTester tester,
    ) async {
      // No override: the real bundle is read, and it holds no descriptor.
      await _pump(tester);

      expect(find.text(_sampleBanner), findsOneWidget);
      expect(_texts(tester).join(' '), isNot(contains('Frozen test data')));
    });

    testWidgets('never presents a synthetic batch as captured data', (
      WidgetTester tester,
    ) async {
      await _pump(tester, fixtureData: const SampleFixtureData());

      expect(find.text(_sampleBanner), findsOneWidget);
      expect(_texts(tester).join(' '), isNot(contains('captured')));
    });

    testWidgets('names data of unverified origin as such', (
      WidgetTester tester,
    ) async {
      await _pump(tester, fixtureData: const UnverifiedFixtureData());

      expect(
        find.text('Test data of unverified origin — not live results'),
        findsOneWidget,
      );
      expect(find.text(_sampleBanner), findsNothing);
    });

    testWidgets('is absent from a build that does not serve fixtures', (
      WidgetTester tester,
    ) async {
      await _pump(tester, mockData: false);

      expect(find.byType(MockDataBanner), findsNothing);
    });

    testWidgets('is localized', (WidgetTester tester) async {
      await _pump(tester, fixtureData: _frozen, locale: const Locale('es'));

      expect(
        find.text(
          'Datos de prueba congelados capturados el 2026-10-08 — no son en '
          'directo ni se actualizan',
        ),
        findsOneWidget,
      );
    });
  });

  group('acknowledgements', () {
    testWidgets('a frozen build credits Jolpica and its licence as the source '
        'of its snapshot', (WidgetTester tester) async {
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        fixtureData: _frozen,
      );
      final String all = _texts(tester).join('\n');

      expect(all, contains('Frozen test data captured 2026-10-08'));
      expect(all, contains('Jolpica F1'));
      expect(all, contains(_frozenStatus));
      expect(
        all,
        contains('Data from Jolpica F1 is licensed under CC BY-NC-SA 4.0.'),
      );
      expect(
        all,
        contains('Jolpica F1 has not reviewed or endorsed GridView.'),
      );
      expect(all, contains('CC BY-NC-SA 4.0'));
      expect(
        all,
        contains(
          'Creative Commons Attribution-NonCommercial-ShareAlike 4.0 '
          'International',
        ),
      );
      // It neither denies serving the data nor claims live retrieval.
      expect(all, isNot(contains(_dormant)));
      expect(all, isNot(contains('GridView retrieves data from this source.')));
      expect(
        find.byKey(const ValueKey<String>('data-source-jolpica-license')),
        findsOneWidget,
      );
    });

    testWidgets('a sample-data build keeps the dormant credit', (
      WidgetTester tester,
    ) async {
      await _pump(tester, location: '/settings/acknowledgements');
      final String all = _texts(tester).join('\n');

      expect(all, contains('Sample data'));
      expect(all, contains(_dormant));
      expect(all, isNot(contains(_frozenStatus)));
    });

    testWidgets('the normal app keeps the dormant credit', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        mockData: false,
      );
      final String all = _texts(tester).join('\n');

      expect(all, contains('GridView service'));
      expect(all, contains(_dormant));
      expect(all, isNot(contains('Frozen test data')));
    });
  });

  group('data settings', () {
    testWidgets('names the frozen data source', (WidgetTester tester) async {
      await _pump(tester, location: '/settings/data', fixtureData: _frozen);

      expect(find.text('Frozen test data captured 2026-10-08'), findsOneWidget);
    });

    testWidgets('keeps sample data named as sample data', (
      WidgetTester tester,
    ) async {
      await _pump(tester, location: '/settings/data');

      expect(find.text('Sample data'), findsOneWidget);
    });
  });
}
