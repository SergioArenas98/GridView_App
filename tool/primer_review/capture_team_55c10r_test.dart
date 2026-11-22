// Step 55C.10R review captures (not goldens): the Team championship block
// with the frozen strip (before) and the opt-in content-aware lines
// (`GvPrimerStatStrip.fitContent`, after), side by side.
//
//   flutter test tool/primer_review/capture_team_55c10r_test.dart
//
// Output in build/primer-review/55c10r/, at device pixel ratio 2, never
// resized. Each PNG has four panels: Dark before | Dark after | Light before
// | Light after, 24px apart on grey. measurements.json records, per panel,
// the strip height, the top of each label and whether any paragraph wraps.
// The block is the production `TeamChampionship` widget, rendered alone at
// the screen's width (the candidate is not enabled in the Team screen).
// Every value is a development test fixture, not a real-world result.
// Rendered by the flutter_tester engine with the real Archivo font; not
// device validation.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/constructors/presentation/widgets/team_sections.dart';

import '../../test/support/primer_fonts.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c10r';
const double _gap = 24;

class _Case {
  const _Case(this.name, this.lang, this.width, this.scale, this.stats);

  final String name;
  final String lang;
  final double width;
  final double scale;
  final List<GvPrimerStat> stats;
}

List<GvPrimerStat> _stats(
  String lang,
  String position,
  String points,
  String wins,
) {
  final bool es = lang == 'es';
  return <GvPrimerStat>[
    GvPrimerStat(
      label: es ? 'Posición' : 'Position',
      value: position,
      kind: GvPrimerStatKind.lead,
    ),
    GvPrimerStat(label: es ? 'Puntos' : 'Points', value: points),
    GvPrimerStat(label: es ? 'Victorias' : 'Wins', value: wins),
  ];
}

final List<_Case> _cases = <_Case>[
  _Case('stress-en-390-100', 'en', 390, 1, _stats('en', '10', '1,234.5', '12')),
  _Case('stress-es-320-200', 'es', 320, 2, _stats('es', '10', '1.234,5', '12')),
  _Case('ordinary-en-390-100', 'en', 390, 1, _stats('en', '6', '22', '0')),
  _Case('ordinary-es-320-200', 'es', 320, 2, _stats('es', '6', '22', '0')),
  _Case('realistic-en-390-100', 'en', 390, 1, _stats('en', '10', '666', '21')),
  _Case('realistic-es-320-200', 'es', 320, 2, _stats('es', '10', '666', '21')),
];

const GlobalObjectKey<State<StatefulWidget>> _boundary = GlobalObjectKey(
  'capture',
);

Future<void> _pump(
  WidgetTester tester,
  _Case c,
  GvPrimerRoles roles, {
  required bool fit,
}) async {
  await tester.binding.setSurfaceSize(Size(c.width, 1200));
  await tester.pumpWidget(const SizedBox());
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: roles.brightness == Brightness.dark
          ? buildGridViewDarkTheme()
          : buildGridViewLightTheme(),
      themeAnimationDuration: Duration.zero,
      home: Builder(
        builder: (BuildContext context) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(c.scale),
            disableAnimations: true,
          ),
          child: GvPrimerSurface(
            kind: GvPrimerSurfaceKind.page,
            roles: roles,
            child: Scaffold(
              backgroundColor: roles.surface.page,
              // A scroll view, so the block takes its content height.
              body: SingleChildScrollView(
                child: RepaintBoundary(
                  key: _boundary,
                  child: ColoredBox(
                    color: roles.surface.page,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: TeamChampionship(
                        stats: c.stats,
                        standingsLabel: c.lang == 'es'
                            ? 'Ver clasificación de constructores'
                            : "View constructors' standings",
                        onOpenStandings: () {},
                        fitStats: fit,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

Map<String, Object> _measure(WidgetTester tester, _Case c) {
  final Rect strip = tester.getRect(find.byType(GvPrimerStatStrip));
  bool wrapped = false;
  for (final Element e
      in find
          .descendant(
            of: find.byType(GvPrimerStatStrip),
            matching: find.byType(RichText),
          )
          .evaluate()) {
    final RenderParagraph p = e.renderObject! as RenderParagraph;
    if (p.getMaxIntrinsicWidth(double.infinity) > p.size.width + 0.5) {
      wrapped = true;
    }
  }
  double r(double v) => (v * 10).roundToDouble() / 10;
  return <String, Object>{
    'stripHeight': r(strip.height),
    'labelTops': <double>[
      for (final GvPrimerStat s in c.stats)
        r(tester.getTopLeft(find.text(s.label)).dy - strip.top),
    ],
    'labelSizes': <List<double>>[
      for (final GvPrimerStat s in c.stats)
        <double>[
          r(tester.getSize(find.text(s.label)).width),
          r(tester.getSize(find.text(s.label)).height),
        ],
    ],
    'anyParagraphWrapped': wrapped,
  };
}

Future<ui.Image> _image(WidgetTester tester) async {
  final RenderRepaintBoundary b =
      _boundary.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  late ui.Image image;
  await tester.runAsync(() async {
    image = await b.toImage(pixelRatio: _dpr);
  });
  return image;
}

Future<void> _compose(
  WidgetTester tester,
  List<ui.Image> panels,
  String name,
) async {
  const double gap = _gap * _dpr;
  double w = 0;
  double h = 0;
  for (final ui.Image p in panels) {
    w += p.width + (w == 0 ? 0 : gap);
    h = h < p.height ? p.height.toDouble() : h;
  }
  final ui.PictureRecorder recorder = ui.PictureRecorder();
  final Canvas canvas = Canvas(recorder)
    ..drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = const Color(0xFF7F7F7F),
    );
  double at = 0;
  for (final ui.Image p in panels) {
    canvas.drawImage(p, Offset(at, 0), Paint());
    at += p.width + gap;
  }
  await tester.runAsync(() async {
    final ui.Image out = await recorder.endRecording().toImage(
      w.round(),
      h.round(),
    );
    final ByteData png = (await out.toByteData(
      format: ui.ImageByteFormat.png,
    ))!;
    File('$_out/$name.png')
      ..createSync(recursive: true)
      ..writeAsBytesSync(png.buffer.asUint8List());
  });
}

void main() {
  final Map<String, Object> measurements = <String, Object>{};

  for (final _Case c in _cases) {
    testWidgets('before/after: ${c.name}', (WidgetTester tester) async {
      await loadArchivo(tester);
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final List<ui.Image> panels = <ui.Image>[];
      for (final (GvPrimerRoles roles, String theme)
          in <(GvPrimerRoles, String)>[
            (GvPrimerRoles.dark, 'dark'),
            (GvPrimerRoles.light, 'light'),
          ]) {
        for (final bool fit in <bool>[false, true]) {
          await _pump(tester, c, roles, fit: fit);
          expect(tester.takeException(), isNull);
          measurements['${c.name}-$theme-${fit ? 'after' : 'before'}'] =
              _measure(tester, c);
          panels.add(await _image(tester));
        }
      }
      await _compose(tester, panels, 'strip-${c.name}');
    });
  }

  tearDownAll(() {
    File('$_out/measurements.json')
      ..createSync(recursive: true)
      ..writeAsStringSync(
        const JsonEncoder.withIndent(' ').convert(measurements),
      );
  });
}
