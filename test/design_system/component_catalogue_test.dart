import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/dev/catalogue/component_catalogue_screen.dart';
import 'package:gridview/l10n/app_localizations.dart';

import '../support/a11y_harness.dart';

/// The development component catalogue is the only place in the app that
/// renders a [GvPrimaryButton] in its loading state, so it is the only place
/// where that state's accessibility can regress unnoticed. Until this file
/// existed the catalogue was never rendered by any test at all: the component
/// could be correct and its single real caller still wrong.
///
/// The catalogue is pumped rather than constructed piecemeal, so these
/// assertions fail if the call site stops supplying the localized state — which
/// is exactly how the gap this file closes was introduced.
void main() {
  /// Pumps [child] inside the app's theme and localizations.
  ///
  /// Deliberately not `pumpStandalone`: the catalogue renders a
  /// [CircularProgressIndicator] and pulsing skeletons, which never settle, so
  /// a harness that ends in `pumpAndSettle` cannot render this screen at all.
  /// Reduced motion is on for the same reason.
  Future<void> pumpDev(
    WidgetTester tester,
    Widget child, {
    Locale locale = const Locale('en'),
    Size surfaceSize = const Size(420, 2400),
  }) async {
    await tester.binding.setSurfaceSize(surfaceSize);
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildGridViewDarkTheme(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (BuildContext context) => MediaQuery(
            data: MediaQuery.of(context).copyWith(disableAnimations: true),
            child: child,
          ),
        ),
      ),
    );
    await tester.pump();
  }

  /// The catalogue's loading example, found through the widget it actually
  /// builds rather than by position.
  GvPrimaryButton catalogueLoadingButton(WidgetTester tester) => tester
      .widgetList<GvPrimaryButton>(find.byType(GvPrimaryButton))
      .firstWhere((GvPrimaryButton button) => button.isLoading);

  /// Consumes the catalogue's one known layout defect.
  ///
  /// Its error-state example is pinned to `SizedBox(height: 200)`, which is 58
  /// logical pixels shorter than a GvErrorState with a retry action needs. That
  /// overflow is byte-identical before and after the Phase 8C-3 accessibility
  /// work — verified against `gv_states.dart` at a87e80f — and belongs to the
  /// catalogue's own layout, which this pass may not change. It is consumed by
  /// exact measurement rather than blanket-ignored, so any *other* exception,
  /// or an overflow of any other size, still fails.
  void consumeKnownCatalogueOverflow(WidgetTester tester) {
    final Object? error = tester.takeException();
    if (error == null) return;
    expect(
      error.toString(),
      contains('overflowed by 58 pixels'),
      reason:
          'the only tolerated catalogue exception is its pre-existing '
          '58px error-state overflow',
    );
  }

  group('the catalogue loading example', () {
    testWidgets('keeps its accessible name and announces the English loading '
        'state', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpDev(tester, const ComponentCatalogueScreen());
      consumeKnownCatalogueOverflow(tester);

      // The example is named "Loading" and the English state is also
      // "Loading", so the composed name reads "Loading, Loading". Asserted as
      // an exact label rather than as a substring count, because a substring
      // count cannot tell the name apart from the state here.
      expect(
        renderedLabels(tester).where((String l) => l == 'Loading, Loading'),
        hasLength(1),
      );
      handle.dispose();
    });

    testWidgets('announces the Spanish loading state', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpDev(
        tester,
        const ComponentCatalogueScreen(),
        locale: const Locale('es'),
      );
      consumeKnownCatalogueOverflow(tester);

      // Spanish separates the two halves: the button's own name stays
      // "Loading" (catalogue copy, not translated) and the state is
      // "Cargando".
      expect(
        renderedLabels(tester).where((String l) => l == 'Loading, Cargando'),
        hasLength(1),
      );
      handle.dispose();
    });

    testWidgets('announces the loading state exactly once', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpDev(
        tester,
        const ComponentCatalogueScreen(),
        locale: const Locale('es'),
      );
      consumeKnownCatalogueOverflow(tester);

      // Spanish is used because it is unambiguous: any occurrence of
      // "Cargando" can only be the state.
      expect(labelOccurrences(tester, 'Cargando'), 1);
      handle.dispose();
    });

    testWidgets('supplies the localized value rather than a hard-coded '
        'string', (WidgetTester tester) async {
      await pumpDev(tester, const ComponentCatalogueScreen());
      consumeKnownCatalogueOverflow(tester);
      final BuildContext context = tester.element(
        find.byType(ComponentCatalogueScreen),
      );

      expect(
        catalogueLoadingButton(tester).loadingLabel,
        AppLocalizations.of(context).a11yLoading,
      );
    });

    testWidgets('keeps its visible copy, its spinner and its size', (
      WidgetTester tester,
    ) async {
      await pumpDev(tester, const ComponentCatalogueScreen());
      consumeKnownCatalogueOverflow(tester);

      // The rest of the Buttons section is untouched…
      expect(find.text('Primary'), findsOneWidget);
      expect(find.text('Disabled'), findsOneWidget);
      expect(find.text('Secondary'), findsOneWidget);
      // …and the loading example still shows a spinner in place of its label,
      // exactly as before.
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(
        tester.getSize(
          find
              .ancestor(
                of: find.byType(CircularProgressIndicator),
                matching: find.byType(SizedBox),
              )
              .first,
        ),
        const Size(GvIconSizes.md, GvIconSizes.md),
      );
      final Size english = tester.getSize(
        find.ancestor(
          of: find.byType(CircularProgressIndicator),
          matching: find.byType(ElevatedButton),
        ),
      );

      // A longer localized state must not move a pixel: the label is
      // semantics-only.
      await pumpDev(
        tester,
        const ComponentCatalogueScreen(),
        locale: const Locale('es'),
      );
      consumeKnownCatalogueOverflow(tester);
      expect(
        tester.getSize(
          find.ancestor(
            of: find.byType(CircularProgressIndicator),
            matching: find.byType(ElevatedButton),
          ),
        ),
        english,
      );
    });
  });

  group('the GvPrimaryButton loading contract', () {
    testWidgets('a loading button with no loading label fails during '
        'development', (WidgetTester tester) async {
      await pumpDev(
        tester,
        const Center(child: GvPrimaryButton(label: 'Retry', isLoading: true)),
      );

      expect(
        tester.takeException(),
        isAssertionError,
        reason:
            'a loading state a screen reader cannot hear is a defect, '
            'and it must not be possible to ship one silently',
      );
    });

    testWidgets('a loading button with a blank loading label fails during '
        'development', (WidgetTester tester) async {
      await pumpDev(
        tester,
        const Center(
          child: GvPrimaryButton(
            label: 'Retry',
            isLoading: true,
            loadingLabel: '   ',
          ),
        ),
      );

      expect(tester.takeException(), isAssertionError);
    });

    testWidgets('an ordinary button needs no loading label', (
      WidgetTester tester,
    ) async {
      await pumpDev(
        tester,
        Center(
          child: GvPrimaryButton(label: 'Retry', onPressed: () {}),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('a disabled button needs no loading label', (
      WidgetTester tester,
    ) async {
      await pumpDev(
        tester,
        const Center(child: GvPrimaryButton(label: 'Retry')),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Retry'), findsOneWidget);
    });
  });
}
