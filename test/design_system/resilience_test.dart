import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/widgets/widgets.dart';

import '../support/component_harness.dart';

const String _longEn =
    'A very long English driver and constructor label used to verify wrapping';
const String _longEs =
    'Una etiqueta muy larga en español para verificar el ajuste sin desbordar';

void main() {
  testWidgets('rows do not overflow on a narrow phone with long English text', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      const GvStandingsRow(
        position: '1',
        name: _longEn,
        team: _longEn,
        points: '210.5',
      ),
      surfaceSize: const Size(320, 200),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('rows do not overflow on a narrow phone with long Spanish text', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      const GvDriverRow(name: _longEs, team: _longEs, number: '16'),
      surfaceSize: const Size(320, 200),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('components render at 2.0x text scale without overflow', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      const GvStandingsRow(
        position: '1',
        name: 'Max Verstappen',
        team: 'Red Bull',
        points: '210.5',
      ),
      textScale: 2.0,
      surfaceSize: const Size(360, 400),
    );
    expect(tester.takeException(), isNull);
    expect(find.text('Max Verstappen'), findsOneWidget);
  });

  testWidgets('buttons render at large text scale without overflow', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      Row(
        children: <Widget>[
          Expanded(
            child: GvPrimaryButton(label: _longEn, onPressed: () {}),
          ),
        ],
      ),
      textScale: 1.6,
      surfaceSize: const Size(360, 200),
    );
    expect(tester.takeException(), isNull);
  });
}
