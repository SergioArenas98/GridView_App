import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/app.dart';
import 'package:gridview/l10n/app_localizations.dart';

void main() {
  testWidgets('shell renders the localized placeholder home screen', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const GridViewApp());
    await tester.pumpAndSettle();

    expect(find.text('GridView'), findsOneWidget);
    expect(find.text('GridView reconstruction'), findsOneWidget);
    expect(
      find.text('The new GridView experience is under construction.'),
      findsOneWidget,
    );
  });

  testWidgets('non-production builds show the environment badge', (
    WidgetTester tester,
  ) async {
    // Tests run without --dart-define=APP_ENV, so the environment falls back
    // to development and the badge must be visible.
    await tester.pumpWidget(const GridViewApp());
    await tester.pumpAndSettle();

    expect(find.text('DEV'), findsOneWidget);
  });

  test('Spanish localization loads and translates the shell strings', () async {
    final AppLocalizations es = await AppLocalizations.delegate.load(
      const Locale('es'),
    );

    expect(es.appTitle, 'GridView');
    expect(es.shellPlaceholderTitle, 'Reconstrucción de GridView');
    expect(
      es.shellPlaceholderMessage,
      'La nueva experiencia GridView está en construcción.',
    );
  });

  test('only English and Spanish are supported', () {
    expect(AppLocalizations.supportedLocales, const <Locale>[
      Locale('en'),
      Locale('es'),
    ]);
  });
}
