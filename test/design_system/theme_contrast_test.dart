import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/gv_semantic_colors.dart';
import 'package:gridview/core/theme/gv_team_accent.dart';
import 'package:gridview/core/theme/gv_text_styles.dart';

import '../support/contrast.dart';

/// Deterministic contrast assertions for the semantic token pairs that carry
/// meaning in both themes.
///
/// Decorative team colours are deliberately **not** required to pass text
/// contrast — they are never the sole carrier of meaning. What is required is
/// that any text placed on a team accent goes through
/// [GvTeamAccent.foregroundOn], which is asserted separately below.
void main() {
  const Map<String, GvSemanticColors> themes = <String, GvSemanticColors>{
    'dark': GvSemanticColors.dark,
    'light': GvSemanticColors.light,
  };

  themes.forEach((String name, GvSemanticColors colors) {
    group('$name theme', () {
      test('primary and secondary text reach AA on every surface', () {
        for (final MapEntry<String, Color> surface in <String, Color>{
          'background': colors.background,
          'surface': colors.surface,
          'surfaceElevated': colors.surfaceElevated,
          'surfaceElevatedAlt': colors.surfaceElevatedAlt,
        }.entries) {
          expect(
            contrastRatio(colors.textPrimary, surface.value),
            greaterThanOrEqualTo(4.5),
            reason: 'textPrimary on ${surface.key}',
          );
          expect(
            contrastRatio(colors.textSecondary, surface.value),
            greaterThanOrEqualTo(4.5),
            reason: 'textSecondary on ${surface.key}',
          );
        }
      });

      test('muted text reaches AA on the main surfaces', () {
        for (final MapEntry<String, Color> surface in <String, Color>{
          'background': colors.background,
          'surface': colors.surface,
          'surfaceElevated': colors.surfaceElevated,
        }.entries) {
          expect(
            contrastRatio(colors.textMuted, surface.value),
            greaterThanOrEqualTo(4.5),
            reason: 'textMuted on ${surface.key}',
          );
        }
      });

      test('status accents used as text reach AA on the elevated surface', () {
        // These accents carry small text (status chip labels, selected
        // navigation labels, section emphasis), so they need the full 4.5:1.
        for (final MapEntry<String, Color> accent in <String, Color>{
          'accentPrimary': colors.accentPrimary,
          'accentSecondary': colors.accentSecondary,
          'success': colors.success,
          'warning': colors.warning,
          'info': colors.info,
          'stale': colors.stale,
        }.entries) {
          expect(
            contrastRatio(accent.value, colors.surfaceElevated),
            greaterThanOrEqualTo(4.5),
            reason: '${accent.key} as text on surfaceElevated',
          );
        }
      });

      test('the reserved tertiary accent clears the non-text threshold', () {
        // `tertiary` has no call site yet. It is held to the 3:1 required of a
        // non-text UI component; the test above is what it must satisfy before
        // it may ever carry small text.
        expect(
          contrastRatio(colors.tertiary, colors.surfaceElevated),
          greaterThanOrEqualTo(3.0),
        );
      });

      test('white on a filled primary surface reaches AA', () {
        // The filled primary button draws its 15px label on `accentPrimaryStrong`
        // rather than on the decorative `accentPrimary`, which only reaches
        // 3.55:1 with white in the dark theme.
        expect(
          contrastRatio(colors.onAccentPrimary, colors.accentPrimaryStrong),
          greaterThanOrEqualTo(4.5),
        );
      });

      test('the informational blue is only ever drawn as content, not as a '
          'fill behind white', () {
        // `accentSecondary` is used for icons, borders and text — never as a
        // filled surface — so the pair that matters is blue-on-surface. White on
        // this blue is only 3.68:1; should a filled variant ever be introduced it
        // must get its own `Strong` role, exactly as the red did.
        expect(
          contrastRatio(colors.accentSecondary, colors.surfaceElevated),
          greaterThanOrEqualTo(4.5),
        );
        expect(
          contrastRatio(colors.onAccentSecondary, colors.accentSecondary),
          greaterThanOrEqualTo(3.0),
        );
      });

      test('the decorative primary accent still clears the 3:1 UI floor', () {
        // Used for bars, icons and selection indicators — non-text components,
        // whose WCAG floor is 3:1.
        expect(
          contrastRatio(colors.accentPrimary, colors.background),
          greaterThanOrEqualTo(3.0),
        );
        expect(
          contrastRatio(colors.onAccentPrimary, colors.accentPrimary),
          greaterThanOrEqualTo(3.0),
        );
      });

      test('disabled text stays visible without competing with live text', () {
        final double disabled = contrastRatio(
          colors.textDisabled,
          colors.background,
        );
        expect(disabled, greaterThanOrEqualTo(3.0));
        expect(
          disabled,
          lessThan(contrastRatio(colors.textMuted, colors.background)),
          reason: 'disabled must read as weaker than muted',
        );
      });

      test('dividers are perceptible without becoming a border', () {
        final double ratio = contrastRatio(colors.divider, colors.background);
        expect(ratio, greaterThanOrEqualTo(1.25));
        expect(ratio, lessThan(4.5));
      });

      test('surface roles stay distinct from one another', () {
        final List<Color> surfaces = <Color>[
          colors.background,
          colors.surface,
          colors.surfaceElevated,
          colors.surfaceElevatedAlt,
        ];
        expect(surfaces.toSet(), hasLength(surfaces.length));
      });

      test('the typographic scale is fully tinted for this theme', () {
        final GvTextStyles text = GvTextStyles.from(colors);
        for (final TextStyle style in <TextStyle>[
          text.displayXl,
          text.displayL,
          text.pageTitle,
          text.sectionTitle,
          text.cardTitle,
          text.bodyL,
          text.bodyM,
          text.label,
          text.caption,
          text.statValue,
        ]) {
          expect(style.color, isNotNull);
          expect(
            contrastRatio(style.color!, colors.background),
            greaterThanOrEqualTo(4.5),
          );
        }
      });
    });
  });

  group('team accents', () {
    test('the contrast-safe foreground reaches AA on every team colour', () {
      // A spread of real Formula 1 team colours, light and dark.
      const List<String> teamColours = <String>[
        '#FF8000', // McLaren papaya
        '#E8002D', // Ferrari red
        '#00A19C', // Aston Martin green
        '#27F4D2', // Mercedes petronas
        '#0093CC', // Alpine blue
        '#B6BABD', // Haas silver
        '#FFFFFF', // a white livery
        '#000000', // a black livery
      ];
      for (final String hex in teamColours) {
        final Color? accent = GvTeamAccent.parse(hex);
        expect(accent, isNotNull, reason: hex);
        expect(
          contrastRatio(GvTeamAccent.foregroundOn(accent!), accent),
          greaterThanOrEqualTo(4.5),
          reason: 'contrast-safe foreground on $hex',
        );
      }
    });

    test('a malformed team colour yields no accent rather than a default', () {
      for (final String? hex in <String?>[
        null,
        '',
        'red',
        '#FFF',
        'FF8000',
        '#GGGGGG',
      ]) {
        expect(GvTeamAccent.parse(hex), isNull, reason: '$hex');
      }
    });
  });
}
