import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/app.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/l10n/app_localizations.dart';

void main() {
  testWidgets('app boots into the Home branch with the pill navigation', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const GridViewApp());
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byType(GvBottomNav), findsOneWidget);
    // The four primary destinations are labelled.
    expect(find.text('Home'), findsWidgets);
    expect(find.text('Calendar'), findsOneWidget);
    expect(find.text('Standings'), findsOneWidget);
    expect(find.text('Explore'), findsOneWidget);
  });

  test('Spanish localization translates the navigation labels', () async {
    final AppLocalizations es = await AppLocalizations.delegate.load(
      const Locale('es'),
    );
    expect(es.appTitle, 'GridView');
    expect(es.navHome, 'Inicio');
    expect(es.navStandings, 'Clasificaciones');
    expect(es.settingsTitle, 'Ajustes');
  });

  test('only English and Spanish are supported', () {
    expect(AppLocalizations.supportedLocales, const <Locale>[
      Locale('en'),
      Locale('es'),
    ]);
  });
}
