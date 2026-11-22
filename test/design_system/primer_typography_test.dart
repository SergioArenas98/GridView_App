import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/gv_font_licenses.dart';
import 'package:gridview/core/theme/gv_primer_roles.dart';
import 'package:gridview/core/theme/tokens/gv_primer_typography.dart';
import 'package:gridview/features/dev/catalogue/primer_catalogue_section.dart';

import '../support/primer_fonts.dart';

/// Step 55B.1: the bundled Archivo, its weights and widths, Spanish glyphs and
/// licence registration.

const String _sample = 'Grand Prix Ñandú 2026';

double _width(TextStyle style, [String text = _sample]) {
  final TextPainter painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: TextDirection.ltr,
  )..layout();
  final double width = painter.width;
  painter.dispose();
  return width;
}

/// Total ink of [style] rendering the sample, black on white.
Future<int> _ink(WidgetTester tester, TextStyle style) async {
  final GlobalKey key = GlobalKey();
  await tester.pumpWidget(
    Directionality(
      textDirection: TextDirection.ltr,
      child: Center(
        child: RepaintBoundary(
          key: key,
          child: ColoredBox(
            color: const Color(0xFFFFFFFF),
            child: Text(
              _sample,
              style: style.copyWith(color: const Color(0xFF000000)),
            ),
          ),
        ),
      ),
    ),
  );
  int ink = 0;
  await tester.runAsync(() async {
    final RenderRepaintBoundary boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final ui.Image image = await boundary.toImage();
    final ByteData bytes = (await image.toByteData())!;
    for (int i = 0; i < bytes.lengthInBytes; i += 4) {
      ink += 255 - bytes.getUint8(i);
    }
    image.dispose();
  });
  return ink;
}

TextStyle _archivo(int weight, {double width = 100}) =>
    GvPrimerTypography.archivo(size: 20, weight: weight, width: width);

void main() {
  group('bundled asset', () {
    test('pubspec declares the Archivo family and its licence asset', () {
      final String pubspec = File('pubspec.yaml').readAsStringSync();
      expect(pubspec, contains('- family: Archivo'));
      expect(pubspec, contains('- asset: $archivoAsset'));
      expect(pubspec, contains('- $archivoLicenseAsset'));
      expect(pubspec, isNot(contains('google_fonts')));
    });

    test('the font file is the verified google/fonts file', () {
      final List<int> bytes = File(archivoAsset).readAsBytesSync();
      // Size recorded in assets/fonts/archivo/README.md with its SHA-256.
      expect(bytes.length, 658596);
      // TrueType outlines (sfnt version 0x00010000).
      expect(bytes.sublist(0, 4), <int>[0, 1, 0, 0]);
    });
  });

  group('style construction', () {
    test('standard weights use FontWeight only; intermediate weights add an '
        'explicit wght', () {
      final TextStyle w600 = GvPrimerTypography.archivo(size: 13, weight: 600);
      expect(w600.fontFamily, 'Archivo');
      expect(w600.fontWeight, FontWeight.w600);
      expect(w600.fontVariations, isEmpty);

      final TextStyle w750 = GvPrimerTypography.archivo(size: 13, weight: 750);
      expect(w750.fontWeight, FontWeight.w700);
      expect(w750.fontVariations, const <FontVariation>[
        FontVariation('wght', 750),
      ]);

      final TextStyle w850 = GvPrimerTypography.archivo(size: 13, weight: 850);
      expect(w850.fontWeight, FontWeight.w800);

      final TextStyle narrow = GvPrimerTypography.archivo(
        size: 13,
        weight: 800,
        width: 72,
      );
      expect(narrow.fontVariations, const <FontVariation>[
        FontVariation('wdth', 72),
      ]);
    });

    test('approved roles: chip label 13/600/1.2, body 15/400/1.45', () {
      expect(GvPrimerTypography.chipLabel.fontSize, 13);
      expect(GvPrimerTypography.chipLabel.fontWeight, FontWeight.w600);
      expect(GvPrimerTypography.chipLabel.height, 1.2);
      expect(GvPrimerTypography.body.fontSize, 15);
      expect(GvPrimerTypography.body.fontWeight, FontWeight.w400);
      expect(GvPrimerTypography.body.height, 1.45);
    });
  });

  group('rendering with the real font', () {
    testWidgets('weights and widths change the real glyphs', (
      WidgetTester tester,
    ) async {
      await loadArchivo(tester);
      final double w400 = _width(_archivo(400));
      final double w600 = _width(_archivo(600));
      final double w700 = _width(_archivo(700));
      final double w750 = _width(_archivo(750));
      final double w800 = _width(_archivo(800));
      expect(w600, greaterThan(w400));
      expect(w700, greaterThan(w600));
      expect(w750, allOf(greaterThan(w700), lessThan(w800)));
      // The width axis condenses and expands.
      expect(_width(_archivo(800, width: 72)), lessThan(w800 * 0.85));
      expect(_width(_archivo(700, width: 118)), greaterThan(w700 * 1.1));
    });

    testWidgets('w400 renders Regular, not the file default SemiBold', (
      WidgetTester tester,
    ) async {
      await loadArchivo(tester);
      final double regular = _width(_archivo(400));
      final double explicit400 = _width(
        const TextStyle(
          fontFamily: 'Archivo',
          fontSize: 20,
          fontVariations: <FontVariation>[FontVariation('wght', 400)],
        ),
      );
      final double defaultInstance = _width(
        const TextStyle(
          fontFamily: 'Archivo',
          fontSize: 20,
          fontVariations: <FontVariation>[FontVariation('wght', 600)],
        ),
      );
      expect(regular, explicit400);
      expect(regular, isNot(defaultInstance));
    });

    testWidgets('no synthetic bold: FontWeight and the wght axis give '
        'identical ink', (WidgetTester tester) async {
      await loadArchivo(tester);
      // If the engine emboldened FontWeight.w800 on top of the axis, the first
      // render would carry more ink than the axis-only render.
      final int byWeight = await _ink(
        tester,
        const TextStyle(
          fontFamily: 'Archivo',
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
      );
      final int byAxisOnly = await _ink(
        tester,
        const TextStyle(
          fontFamily: 'Archivo',
          fontSize: 20,
          fontVariations: <FontVariation>[FontVariation('wght', 800)],
        ),
      );
      final int regular = await _ink(tester, _archivo(400));
      expect(byWeight, byAxisOnly);
      expect(byWeight, greaterThan(regular));
    });

    testWidgets(
      'English and Spanish glyphs come from Archivo, not a fallback',
      (WidgetTester tester) async {
        await loadArchivo(tester);
        // The test engine's fallback glyph is a 1em square; an Archivo glyph at
        // 20px is never exactly 20px wide.
        const String glyphs = 'áéíóúüñÁÉÍÓÚÜÑ¿¡«»€ºªAZaz09';
        for (final String ch in glyphs.split('')) {
          expect(
            _width(_archivo(600), ch),
            isNot(20.0),
            reason: 'U+${ch.codeUnitAt(0).toRadixString(16)} fell back',
          );
        }
        expect(
          _width(const TextStyle(fontFamily: 'NoSuchFont', fontSize: 20), 'ñ'),
          20.0,
        );
      },
    );
  });

  group('catalogue preview', () {
    testWidgets('specimens request Archivo at the requested weights', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: PrimerThemePanel(name: 'Dark', roles: GvPrimerRoles.dark),
            ),
          ),
        ),
      );
      for (final (int weight, FontWeight expected) in <(int, FontWeight)>[
        (400, FontWeight.w400),
        (600, FontWeight.w600),
        (700, FontWeight.w700),
        (800, FontWeight.w800),
      ]) {
        final Text text = tester.widget<Text>(
          find.byKey(ValueKey<String>('primer-type-$weight-100')),
        );
        expect(text.style!.fontFamily, 'Archivo');
        expect(text.style!.fontWeight, expected);
      }
      final Text w750 = tester.widget<Text>(
        find.byKey(const ValueKey<String>('primer-type-750-100')),
      );
      expect(
        w750.style!.fontVariations,
        contains(const FontVariation('wght', 750)),
      );
      final Text narrow = tester.widget<Text>(
        find.byKey(const ValueKey<String>('primer-type-800-72')),
      );
      expect(
        narrow.style!.fontVariations,
        contains(const FontVariation('wdth', 72)),
      );
    });
  });

  group('licence registration', () {
    tearDown(() {
      LicenseRegistry.reset();
      debugResetBundledFontLicenses();
    });

    test('the Archivo OFL is listed with the app licences, once', () async {
      LicenseRegistry.reset();
      debugResetBundledFontLicenses();
      registerBundledFontLicenses();
      registerBundledFontLicenses(); // idempotent

      final List<LicenseEntry> entries = await LicenseRegistry.licenses
          .toList();
      final List<LicenseEntry> archivo = entries
          .where((LicenseEntry e) => e.packages.contains(archivoLicensePackage))
          .toList();
      expect(archivo, hasLength(1));
      final String text = archivo.single.paragraphs
          .map((LicenseParagraph p) => p.text)
          .join('\n');
      expect(text, contains('Copyright 2020 The Archivo Project Authors'));
      expect(text, contains('SIL OPEN FONT LICENSE Version 1.1'));
    });

    test('bootstrap registers the font licences before the app runs', () {
      final String source = File('lib/app/bootstrap.dart').readAsStringSync();
      final int register = source.indexOf('registerBundledFontLicenses();');
      expect(register, isNonNegative);
      expect(register, lessThan(source.indexOf('await runBootstrap(')));
    });
  });
}
