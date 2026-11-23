// Step 55C.10R: the opt-in content-aware lines of the shared championship
// strip (`GvPrimerStatStrip.fitContent`), measured with the real Archivo
// font. The default (off) layout is what every consumer renders today.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';

import '../support/primer_fonts.dart';

const Size _w390 = Size(390, 844);
const Size _w320 = Size(320, 693);

Future<void> _pump(
  WidgetTester tester,
  Widget strip, {
  GvPrimerRoles? roles,
  Size size = _w390,
  double scale = 1,
}) async {
  final GvPrimerRoles r = roles ?? GvPrimerRoles.dark;
  await loadArchivo(tester);
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(const SizedBox());
  await tester.pumpWidget(
    MaterialApp(
      theme: r.brightness == Brightness.dark
          ? buildGridViewDarkTheme()
          : buildGridViewLightTheme(),
      themeAnimationDuration: Duration.zero,
      home: Builder(
        builder: (BuildContext context) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(scale),
            disableAnimations: true,
          ),
          child: GvPrimerSurface(
            kind: GvPrimerSurfaceKind.page,
            roles: r,
            child: Scaffold(
              backgroundColor: r.surface.page,
              body: ListView(
                children: <Widget>[
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: GvPrimerLayout.gutter,
                    ),
                    child: strip,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

/// Team strip values: (label, value) per cell; the first is the lead.
List<GvPrimerStat> _team(
  String lang, {
  required String position,
  required String points,
  String? wins,
  bool unranked = false,
}) {
  final bool es = lang == 'es';
  return <GvPrimerStat>[
    GvPrimerStat(
      label: es ? 'Posición' : 'Position',
      value: position,
      kind: unranked ? GvPrimerStatKind.word : GvPrimerStatKind.lead,
    ),
    GvPrimerStat(label: es ? 'Puntos' : 'Points', value: points),
    if (wins != null)
      GvPrimerStat(label: es ? 'Victorias' : 'Wins', value: wins),
  ];
}

/// The value strings as the locale formats them (`EntityFormatter`).
String _num(String lang, String en) => lang == 'es'
    ? en.replaceAll(',', '#').replaceAll('.', ',').replaceAll('#', '.')
    : en;

/// Every text box in the strip, in paint order.
List<Rect> _boxes(WidgetTester tester) => <Rect>[
  for (final Element e
      in find
          .descendant(
            of: find.byType(GvPrimerStatStrip),
            matching: find.byType(RichText),
          )
          .evaluate())
    () {
      final RenderBox box = e.renderObject! as RenderBox;
      return box.localToGlobal(Offset.zero) & box.size;
    }(),
];

/// Whether any paragraph in the strip broke onto more than one line.
bool _anyWrapped(WidgetTester tester) {
  for (final Element e
      in find
          .descendant(
            of: find.byType(GvPrimerStatStrip),
            matching: find.byType(RichText),
          )
          .evaluate()) {
    final RenderParagraph p = e.renderObject! as RenderParagraph;
    // Needs more width than it got: it broke onto another line.
    if (p.getMaxIntrinsicWidth(double.infinity) > p.size.width + 0.5) {
      return true;
    }
  }
  return false;
}

/// Whether any paragraph is wider than its box (clipped or overflowing),
/// checked separately from wrapping for the record.
bool _anyOverflow(WidgetTester tester) {
  for (final Element e
      in find
          .descendant(
            of: find.byType(GvPrimerStatStrip),
            matching: find.byType(RichText),
          )
          .evaluate()) {
    final RenderParagraph p = e.renderObject! as RenderParagraph;
    if (p.getMaxIntrinsicWidth(double.infinity) > p.size.width + 0.5) {
      return true;
    }
  }
  return false;
}

List<double> _lineTops(
  WidgetTester tester,
  List<GvPrimerStat> stats,
) => <double>[
  for (final GvPrimerStat s in stats) tester.getTopLeft(find.text(s.label)).dy,
];

void main() {
  final List<(GvPrimerRoles, String)> themes = <(GvPrimerRoles, String)>[
    (GvPrimerRoles.dark, 'dark'),
    (GvPrimerRoles.light, 'light'),
  ];
  final List<(String, Size, double)> configs = <(String, Size, double)>[
    ('en', _w390, 1),
    ('es', _w390, 1),
    ('en', _w320, 2),
    ('es', _w320, 2),
  ];

  group('ordinary values: identical to the default layout', () {
    for (final (GvPrimerRoles roles, String theme) in themes) {
      for (final (String lang, Size size, double scale) in configs) {
        for (final (String label, List<GvPrimerStat> Function(String) stats)
            in <(String, List<GvPrimerStat> Function(String))>[
              (
                '22 pts, 0 wins',
                (String l) => _team(l, position: '6', points: '22', wins: '0'),
              ),
              (
                '666 pts, 21 wins',
                (String l) =>
                    _team(l, position: '10', points: '666', wins: '21'),
              ),
              (
                'unranked, 0 pts, no wins',
                (String l) => _team(
                  l,
                  position: l == 'es' ? 'Sin clasificar' : 'Unranked',
                  points: '0',
                  unranked: true,
                ),
              ),
              (
                'null points (empty), 0 wins',
                (String l) => _team(l, position: '6', points: '', wins: '0'),
              ),
            ]) {
          testWidgets('$theme $lang ${size.width.toInt()} '
              '@${(scale * 100).toInt()}% $label', (WidgetTester tester) async {
            await _pump(
              tester,
              GvPrimerStatStrip(stats: stats(lang)),
              roles: roles,
              size: size,
              scale: scale,
            );
            final List<Rect> before = _boxes(tester);
            await _pump(
              tester,
              GvPrimerStatStrip(stats: stats(lang), fitContent: true),
              roles: roles,
              size: size,
              scale: scale,
            );
            expect(_boxes(tester), before);
            expect(_anyWrapped(tester), isFalse);
            expect(tester.takeException(), isNull);
          });
        }
      }
    }

    testWidgets('Driver style: identical with ordinary values', (
      WidgetTester tester,
    ) async {
      for (final (Size size, double scale) in <(Size, double)>[
        (_w390, 1),
        (_w320, 2),
      ]) {
        const List<GvPrimerStat> stats = <GvPrimerStat>[
          GvPrimerStat(
            label: 'Position',
            value: '2',
            kind: GvPrimerStatKind.lead,
          ),
          GvPrimerStat(label: 'Points', value: '402.5'),
        ];
        await _pump(
          tester,
          const GvPrimerStatStrip(
            stats: stats,
            style: GvPrimerStatStripStyle.driver,
          ),
          size: size,
          scale: scale,
        );
        final List<Rect> before = _boxes(tester);
        await _pump(
          tester,
          const GvPrimerStatStrip(
            stats: stats,
            style: GvPrimerStatStripStyle.driver,
            fitContent: true,
          ),
          size: size,
          scale: scale,
        );
        expect(_boxes(tester), before);
      }
    });
  });

  group('stress: 1,234.5 points, 12 wins', () {
    for (final (GvPrimerRoles roles, String theme) in themes) {
      for (final (String lang, Size size, double scale) in configs) {
        testWidgets('$theme $lang ${size.width.toInt()} '
            '@${(scale * 100).toInt()}%: no split label, no clipped value, '
            'Position first', (WidgetTester tester) async {
          final List<GvPrimerStat> stats = _team(
            lang,
            position: '10',
            points: _num(lang, '1,234.5'),
            wins: '12',
          );
          await _pump(
            tester,
            GvPrimerStatStrip(stats: stats, fitContent: true),
            roles: roles,
            size: size,
            scale: scale,
          );
          expect(tester.takeException(), isNull);
          expect(_anyWrapped(tester), isFalse);
          expect(_anyOverflow(tester), isFalse);
          // Every box inside the strip's width.
          final Rect strip = tester.getRect(find.byType(GvPrimerStatStrip));
          for (final Rect r in _boxes(tester)) {
            expect(r.right, lessThanOrEqualTo(strip.right + 0.5));
          }
          // Position stays first and alone on its line, above the others.
          final List<double> tops = _lineTops(tester, stats);
          expect(tops[1], greaterThan(tops[0]));
          expect(tops[2], greaterThanOrEqualTo(tops[1]));
          // Sizes unchanged from the default strip.
          final RichText leadText = tester.widget<RichText>(
            find
                .descendant(
                  of: find.byType(GvPrimerStatStrip),
                  matching: find.byType(RichText),
                )
                .at(1),
          );
          final double lead =
              (leadText.text as TextSpan).children!.first.style!.fontSize!;
          expect(
            lead,
            GvPrimerTypography.cappedSize(TextScaler.linear(scale), 72, 80),
          );
        });
      }
    }

    testWidgets('the default strip keeps the frozen behaviour (before)', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        GvPrimerStatStrip(
          stats: _team('en', position: '10', points: '1,234.5', wins: '12'),
        ),
      );
      expect(_anyWrapped(tester), isTrue, reason: '"Wins" splits (frozen)');
    });

    test('lines: one, then Position alone, then one per line', () {
      // Pure arithmetic is font-independent only through the measurement,
      // so this checks the candidate order with a huge and a tiny width.
      final List<GvPrimerStat> stats = _team(
        'en',
        position: '10',
        points: '1,234.5',
        wins: '12',
      );
      List<int> at(double w, {bool narrow = false}) =>
          GvPrimerStatStrip.lineLengths(
            stats,
            w,
            TextScaler.noScaling,
            style: GvPrimerStatStripStyle.team,
            narrow: narrow,
          );
      expect(at(5000), <int>[3]);
      expect(at(5000, narrow: true), <int>[1, 2]);
      expect(at(10), <int>[1, 1, 1]);
      expect(
        GvPrimerStatStrip.lineLengths(
          stats.take(1).toList(),
          10,
          TextScaler.noScaling,
          style: GvPrimerStatStripStyle.team,
          narrow: false,
        ),
        <int>[1],
      );
    });
  });

  testWidgets('semantics: same names and order with and without fitting', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    List<String> labels() => <String>[
      for (final Element e
          in find
              .descendant(
                of: find.byType(GvPrimerStatStrip),
                matching: find.byType(MergeSemantics),
              )
              .evaluate())
        tester.getSemantics(find.byWidget(e.widget)).label,
    ];
    final List<GvPrimerStat> stats = _team(
      'es',
      position: '10',
      points: '1.234,5',
      wins: '12',
    );
    await _pump(tester, GvPrimerStatStrip(stats: stats), size: _w320, scale: 2);
    final List<String> before = labels();
    await _pump(
      tester,
      GvPrimerStatStrip(stats: stats, fitContent: true),
      size: _w320,
      scale: 2,
    );
    expect(labels(), before);
    expect(before, <String>[
      'Posición\n10',
      'Puntos\n1.234,5',
      'Victorias\n12',
    ]);
    handle.dispose();
  });
}
