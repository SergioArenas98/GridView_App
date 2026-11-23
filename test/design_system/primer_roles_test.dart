import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/gv_primer_effects.dart';
import 'package:gridview/core/theme/gv_primer_role_groups.dart';
import 'package:gridview/core/theme/gv_primer_roles.dart';
import 'package:gridview/core/theme/tokens/gv_primer_metrics.dart';
import 'package:gridview/core/theme/tokens/gv_primer_palette.dart';

import '../support/contrast.dart';

/// Primer V2 theme foundation (Step 55A): the frozen role values resolve per
/// theme, contextual roles stay alphas of primitives, scopes swap the named
/// roles, and the approved ratios hold.
///
/// Expected values are literals copied from
/// `design-exploration/prototypes/primer-v2/CROSS-THEME-TOKEN-MAP.md`, not
/// re-read from the implementation, so a drift in either is caught.

/// A colour with alpha composited over an opaque surface (sRGB, as the
/// prototypes' browser composites it).
Color over(Color top, Color surface) => Color.from(
  alpha: 1,
  red: top.r * top.a + surface.r * (1 - top.a),
  green: top.g * top.a + surface.g * (1 - top.a),
  blue: top.b * top.a + surface.b * (1 - top.a),
);

/// Asserts that [role] is exactly [primitive] at [alpha]: a contextual role,
/// not a new colour.
void expectAlphaOf(Color role, Color primitive, double alpha) {
  expect(role.a, closeTo(alpha, 1e-9));
  expect(role.withValues(alpha: 1), primitive);
}

void main() {
  final GvPrimerRoles dark = GvPrimerRoles.dark;
  final GvPrimerRoles light = GvPrimerRoles.light;

  group('layer 1: raw values', () {
    test('the palette holds exactly the 15 approved primitives', () {
      expect(GvPrimerPalette.all, const <Color>[
        Color(0xFF101113),
        Color(0xFF141518),
        Color(0xFF1F2125),
        Color(0xFF2A2D32),
        Color(0xFF4F525A),
        Color(0xFFA9ABB1),
        Color(0xFFECEAE5),
        Color(0xFFE2DFD8),
        Color(0xFFEBECEE),
        Color(0xFFF7F7F8),
        Color(0xFFFFFFFF),
        Color(0xFFDCDDE1),
        Color(0xFFA03E2B),
        Color(0xFF7A2E21),
        Color(0xFFF08A6C),
      ]);
      expect(GvPrimerPalette.all.toSet(), hasLength(15));
    });

    test('contextual and superseded values are not primitives', () {
      for (final Color excluded in const <Color>[
        Color(0xFFB04633), // brand-gradient start, effect only (DK-6)
        Color(0xFF1B1D20), // Dark band lighting, effect only
        Color(0xFF0B0D12), // legacy GvColors.background
        Color(0xFFFF3B30), // legacy GvColors.accentPrimary
        Color(0xFFF1F4F9), // legacy GvColorsLight.background
        Color(0xFFC62719), // legacy GvColorsLight.accentPrimary
      ]) {
        expect(GvPrimerPalette.all, isNot(contains(excluded)));
      }
    });
  });

  group('layer 2: semantic roles', () {
    test('Dark resolves the token-map values', () {
      expect(dark.brightness, Brightness.dark);
      expect(dark.surface.page, const Color(0xFF141518));
      expect(dark.surface.band, const Color(0xFF1F2125));
      expect(dark.surface.raised, const Color(0xFF2A2D32));
      expect(dark.surface.card, isNull);
      expect(dark.surface.inverse.colors, const <Color>[
        Color(0xFFECEAE5),
        Color(0xFFE2DFD8),
      ]);
      expect(dark.text.primary, const Color(0xFFECEAE5));
      expect(dark.text.secondary, const Color(0xFFA9ABB1));
      expect(dark.text.accent, const Color(0xFFF08A6C));
      expect(dark.fill.brand.fill, const Color(0xFFA03E2B));
      expect(dark.fill.brand.on, const Color(0xFFECEAE5));
      expect(dark.fill.live.fill, const Color(0xFFF08A6C));
      expect(dark.fill.live.on, const Color(0xFF141518));
      expect(dark.fill.finalChip.fill, const Color(0xFFECEAE5));
      expect(dark.fill.finalChip.on, const Color(0xFF141518));
      expect(dark.fill.mark.fill, const Color(0xFFF08A6C));
      expect(dark.fill.mark.on, const Color(0xFF141518));
      expect(dark.fill.disc.fill, const Color(0xFFECEAE5));
      expect(dark.fill.button.fill, const Color(0xFFECEAE5));
      expect(dark.fill.button.on, const Color(0xFF141518));
      expect(dark.fill.buttonHover, const Color(0xFFE2DFD8));
      expect(dark.fill.snackbar.fill, const Color(0xFFECEAE5));
    });

    test('Light resolves the token-map values', () {
      expect(light.brightness, Brightness.light);
      expect(light.surface.page, const Color(0xFFEBECEE));
      expect(light.surface.band, const Color(0xFFF7F7F8));
      expect(light.surface.raised, const Color(0xFFDCDDE1));
      expect(light.surface.card, const Color(0xFFFFFFFF));
      expect(light.surface.inverse.angleDegrees, 170);
      expect(light.surface.inverse.colors, const <Color>[
        Color(0xFF1F2125),
        Color(0xFF141518),
      ]);
      expect(light.text.primary, const Color(0xFF141518));
      expect(light.text.secondary, const Color(0xFF4F525A));
      expect(light.text.accent, const Color(0xFFA03E2B));
      expect(light.fill.brand.fill, const Color(0xFFA03E2B));
      expect(light.fill.brand.on, const Color(0xFFECEAE5));
      expect(light.fill.live.fill, const Color(0xFFF08A6C));
      expect(light.fill.live.on, const Color(0xFF141518));
      expect(light.fill.finalChip.fill, const Color(0xFF141518));
      expect(light.fill.finalChip.on, const Color(0xFFECEAE5));
      expect(light.fill.mark.fill, const Color(0xFFA03E2B));
      expect(light.fill.mark.on, const Color(0xFFECEAE5));
      expect(light.fill.disc.fill, const Color(0xFF141518));
      expect(light.fill.button.fill, const Color(0xFF141518));
      expect(light.fill.button.on, const Color(0xFFECEAE5));
      expect(light.fill.buttonHover, const Color(0xFF1F2125));
      expect(light.fill.snackbar.fill, const Color(0xFF141518));
    });

    test('Red Oxide is the brand surface in both themes; Ember stays the '
        'Dark accent and the Live fill', () {
      expect(dark.fill.brand.fill, light.fill.brand.fill);
      expect(dark.fill.live.fill, light.fill.live.fill);
      expect(dark.text.accent, GvPrimerPalette.ember400);
      expect(light.text.accent, GvPrimerPalette.oxide600);
    });
  });

  group('layer 3: contextual alpha roles', () {
    test('Dark lines, states and nav are alphas of primitives', () {
      expectAlphaOf(dark.line.subtle, GvPrimerPalette.chalk100, 0.12);
      expectAlphaOf(dark.line.strong, GvPrimerPalette.chalk100, 0.22);
      expectAlphaOf(dark.line.status, GvPrimerPalette.chalk100, 0.45);
      expectAlphaOf(dark.line.statusInverse, GvPrimerPalette.graphite900, 0.55);
      expectAlphaOf(dark.line.unknown, GvPrimerPalette.chalk100, 0.60);
      expectAlphaOf(dark.line.inverse, GvPrimerPalette.graphite900, 0.14);
      expectAlphaOf(dark.state.hover, GvPrimerPalette.chalk100, 0.03);
      expectAlphaOf(dark.surface.nav, GvPrimerPalette.graphite950, 0.96);
      // XT-5: Dark pressed rows press to tray, controls to raised (opaque).
      expect(dark.state.pressedRow, GvPrimerPalette.graphite800);
      expect(dark.state.pressedControl, GvPrimerPalette.graphite700);
    });

    test('Light lines, states and nav are alphas of primitives', () {
      expectAlphaOf(light.line.subtle, GvPrimerPalette.graphite900, 0.14);
      expectAlphaOf(light.line.strong, GvPrimerPalette.graphite900, 0.26);
      expectAlphaOf(light.line.status, GvPrimerPalette.graphite900, 0.55);
      expectAlphaOf(light.line.statusInverse, GvPrimerPalette.chalk100, 0.45);
      expectAlphaOf(light.line.unknown, GvPrimerPalette.graphite900, 0.70);
      expectAlphaOf(light.line.inverse, GvPrimerPalette.chalk100, 0.12);
      expectAlphaOf(light.state.hover, GvPrimerPalette.graphite900, 0.03);
      expectAlphaOf(light.state.pressedRow, GvPrimerPalette.graphite900, 0.06);
      expect(light.state.pressedControl, GvPrimerPalette.neutralLightRaised);
      expectAlphaOf(light.surface.nav, GvPrimerPalette.neutralLightBand, 0.96);
    });

    test('no contextual role is confused with a raw value', () {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[dark, light]) {
        for (final Color contextual in <Color>[
          roles.line.subtle,
          roles.line.strong,
          roles.line.status,
          roles.line.statusInverse,
          roles.line.unknown,
          roles.line.inverse,
          roles.state.hover,
          roles.surface.nav,
        ]) {
          expect(contextual.a, lessThan(1));
          expect(GvPrimerPalette.all, isNot(contains(contextual)));
        }
      }
    });

    test('status outlines: solid known, dashed unknown, solid alert', () {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[dark, light]) {
        expect(roles.line.statusKnown.dashed, isFalse);
        expect(roles.line.statusKnownInverse.dashed, isFalse);
        expect(roles.line.statusUnknown.dashed, isTrue);
        expect(roles.line.statusAlert.dashed, isFalse);
        // Alert reuses the unknown alpha, solid (token map §3).
        expect(roles.line.statusAlert.color, roles.line.unknown);
      }
      expect(GvPrimerMetrics.statusOutlineWidth, 1.5);
    });

    test('focus rules per theme (DK-3, LT-4/5/15, XT-4)', () {
      expect(dark.focus.onPage, GvPrimerPalette.ember400);
      expect(dark.focus.onBrand, GvPrimerPalette.chalk100);
      expect(dark.focus.onInverse, GvPrimerPalette.oxide600);
      expect(dark.focus.crossingBacking, isFalse);
      expect(dark.focus.backButtonOffset, 3);

      expect(light.focus.onPage, GvPrimerPalette.graphite900);
      expect(light.focus.onBrand, GvPrimerPalette.chalk100);
      expect(light.focus.onInverse, GvPrimerPalette.ember400);
      expect(light.focus.crossingBacking, isTrue);
      expect(light.focus.backButtonOffset, 1);

      expect(GvPrimerMetrics.focusRingWidth, 2);
      expect(GvPrimerMetrics.focusBackingWidth, 5);
      expect(GvPrimerMetrics.focusOffsetDefault, 3);
      expect(GvPrimerMetrics.focusOffsetRow, -3);
      expect(GvPrimerMetrics.focusOffsetTeamLink, -2);
      expect(GvPrimerMetrics.focusOffsetHomeExplore, -4);
      expect(GvPrimerMetrics.focusOffsetLeaderRow, 2);
    });
  });

  group('approved ratios (computed, alpha composited)', () {
    test('text roles reach 4.5:1 on every page-family surface', () {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[dark, light]) {
        for (final Color surface in <Color>[
          roles.surface.page,
          roles.surface.band,
          roles.surface.raised,
          ?roles.surface.card,
        ]) {
          for (final Color text in <Color>[
            roles.text.primary,
            roles.text.secondary,
            roles.text.accent,
          ]) {
            expect(contrastRatio(text, surface), greaterThanOrEqualTo(4.5));
          }
        }
      }
      // Spot values recorded in the frozen documents.
      expect(
        contrastRatio(dark.text.primary, dark.surface.page),
        closeTo(15.19, 0.01),
      );
      expect(
        contrastRatio(light.text.primary, light.surface.page),
        closeTo(15.45, 0.01),
      );
      expect(
        contrastRatio(light.text.accent, light.surface.page),
        closeTo(5.52, 0.01),
      );
    });

    test('solid status outline ≥ 3:1 and the dashed unknown is stronger', () {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[dark, light]) {
        for (final Color surface in <Color>[
          roles.surface.page,
          roles.surface.band,
        ]) {
          final double known = contrastRatio(
            over(roles.line.status, surface),
            surface,
          );
          final double unknown = contrastRatio(
            over(roles.line.unknown, surface),
            surface,
          );
          expect(known, greaterThanOrEqualTo(3));
          expect(unknown, greaterThan(known));
        }
      }
      expect(
        contrastRatio(
          over(dark.line.status, dark.surface.page),
          dark.surface.page,
        ),
        closeTo(3.96, 0.01),
      );
      expect(
        contrastRatio(
          over(light.line.status, light.surface.page),
          light.surface.page,
        ),
        closeTo(3.86, 0.01),
      );
    });

    test('labels on fills reach 4.5:1', () {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[dark, light]) {
        for (final GvPrimerPair pair in <GvPrimerPair>[
          roles.fill.brand,
          roles.fill.live,
          roles.fill.finalChip,
          roles.fill.mark,
          roles.fill.disc,
          roles.fill.button,
          roles.fill.snackbar,
        ]) {
          expect(contrastRatio(pair.on, pair.fill), greaterThanOrEqualTo(4.5));
        }
      }
      // Chalk on oxide: 5.43 in both themes.
      expect(
        contrastRatio(dark.fill.brand.on, dark.fill.brand.fill),
        closeTo(5.43, 0.01),
      );
    });

    test('focus rings reach 3:1 against the surface they are drawn on', () {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[dark, light]) {
        for (final Color surface in <Color>[
          roles.surface.page,
          roles.surface.band,
          roles.surface.raised,
          over(roles.surface.nav, roles.surface.page),
        ]) {
          expect(
            contrastRatio(roles.focus.onPage, surface),
            greaterThanOrEqualTo(3),
          );
        }
        expect(
          contrastRatio(roles.focus.onBrand, roles.fill.brand.fill),
          greaterThanOrEqualTo(3),
        );
      }
      // Ring inside the inverse plane.
      expect(
        contrastRatio(dark.focus.onInverse, GvPrimerPalette.chalk100),
        greaterThanOrEqualTo(3),
      );
      expect(
        contrastRatio(light.focus.onInverse, GvPrimerPalette.graphite800),
        greaterThanOrEqualTo(3),
      );
    });

    test('the Dark selector slab limit is recorded, not hidden (XS-26)', () {
      // 2.47:1 against the tray container: a recorded design limit carried by
      // weight, label colour and semantics, not a compliance claim.
      expect(
        contrastRatio(dark.selector.selectedSlab, dark.selector.container),
        closeTo(2.47, 0.01),
      );
      expect(
        contrastRatio(light.selector.selectedSlab, light.selector.container),
        closeTo(6.09, 0.01),
      );
    });

    test('Chalk text on the brand gradient start stays ≥ 4.5:1 (DK-6)', () {
      final Color start = GvPrimerEffects.brandGradientHero.colors.first;
      expect(
        contrastRatio(GvPrimerPalette.chalk100, start),
        greaterThanOrEqualTo(4.5),
      );
    });
  });

  group('surface scopes (token map §6)', () {
    test('page is the theme itself', () {
      expect(dark.forScope(GvPrimerScope.page), same(dark));
      expect(light.forScope(GvPrimerScope.page), same(light));
    });

    test('Light inverse and graphite band apply the Dark roles', () {
      expect(light.forScope(GvPrimerScope.inverse), same(GvPrimerRoles.dark));
      expect(
        light.forScope(GvPrimerScope.graphiteBand),
        same(GvPrimerRoles.dark),
      );
      expect(
        dark.forScope(GvPrimerScope.graphiteBand),
        same(GvPrimerRoles.dark),
      );
    });

    test(
      'Dark inverse is the Chalk plane with only the named roles swapped',
      () {
        final GvPrimerRoles plane = dark.forScope(GvPrimerScope.inverse);
        expect(plane.text.primary, GvPrimerPalette.graphite900);
        expect(plane.text.secondary, GvPrimerPalette.slate600);
        expect(plane.text.accent, GvPrimerPalette.oxide600);
        expect(plane.line.status, dark.line.statusInverse);
        expect(plane.line.subtle, dark.line.inverse);
        expect(plane.focus.onPage, GvPrimerPalette.oxide600);
        // Untouched roles are inherited.
        expect(plane.fill.brand.fill, dark.fill.brand.fill);
        expect(plane.surface.page, dark.surface.page);
        // The team edge follows the plane's text colour (XT-3).
        expect(plane.teamEdge, GvPrimerPalette.graphite900);

        for (final Color chalk in <Color>[
          GvPrimerPalette.chalk100,
          GvPrimerPalette.chalk200,
        ]) {
          expect(
            contrastRatio(plane.text.primary, chalk),
            greaterThanOrEqualTo(4.5),
          );
          expect(
            contrastRatio(plane.text.secondary, chalk),
            greaterThanOrEqualTo(4.5),
          );
          expect(
            contrastRatio(plane.text.accent, chalk),
            greaterThanOrEqualTo(4.5),
          );
          expect(
            contrastRatio(over(plane.line.status, chalk), chalk),
            greaterThanOrEqualTo(3),
          );
        }
      },
    );
  });

  group('component roles (layer 4)', () {
    test('navigation (LT-9)', () {
      expect(dark.nav.selectedSlab, GvPrimerPalette.oxide600);
      expect(light.nav.selectedSlab, GvPrimerPalette.oxide600);
      expect(dark.nav.selectedIcon, GvPrimerPalette.chalk100);
      expect(light.nav.selectedIcon, GvPrimerPalette.chalk100);
      expect(dark.nav.selectedLabel, GvPrimerPalette.chalk100);
      expect(light.nav.selectedLabel, GvPrimerPalette.graphite900);
      expect(dark.nav.unselected, dark.text.secondary);
      expect(light.nav.unselected, light.text.secondary);
      expect(dark.nav.focus, GvPrimerPalette.ember400);
      expect(light.nav.focus, GvPrimerPalette.graphite900);
      expect(dark.nav.bar, dark.surface.nav);
    });

    test('selector (DK-3, LT-4)', () {
      expect(dark.selector.container, dark.surface.band);
      expect(dark.selector.selectedLabel, GvPrimerPalette.chalk100);
      expect(dark.selector.selectedFocus, GvPrimerPalette.chalk100);
      expect(dark.selector.unselectedFocus, GvPrimerPalette.chalk100);
      expect(dark.selector.unselectedFocusBacking, isNull);
      expect(light.selector.unselectedFocus, GvPrimerPalette.graphite900);
      expect(light.selector.unselectedFocusBacking, light.surface.band);
    });

    test('status chips, notices, actions and skeleton', () {
      for (final GvPrimerRoles roles in <GvPrimerRoles>[dark, light]) {
        expect(roles.statusChip.unknown.dashed, isTrue);
        expect(roles.statusChip.contextFill, roles.surface.raised);
        expect(roles.statusChip.winner.fill, GvPrimerPalette.oxide600);
        expect(roles.notice.fill, roles.surface.band);
        expect(roles.notice.border, roles.line.strong);
        expect(roles.notice.icon, roles.text.accent);
        expect(roles.action.link, roles.text.accent);
        expect(roles.action.linkUnderline, roles.line.strong);
        expect(roles.action.snackbarSeam, GvPrimerPalette.oxide600);
        expect(roles.skeleton.gradient.angleDegrees, 90);
        expect(roles.skeleton.gradient.colors, <Color>[
          roles.surface.band,
          roles.surface.raised,
          roles.surface.band,
        ]);
      }
    });
  });

  group('team-colour boundary (XT-3)', () {
    test('a boundary appears only below 3:1, in the surface text colour', () {
      const Color blue = Color(0xFF1E41FF);
      const Color orange = Color(0xFFFF8000);
      const Color cyan = Color(0xFF0093CC);

      // #1E41FF: 2.83 on the Dark page, 5.46 on the Light page.
      expect(
        dark.teamEdgeFor(blue, surface: dark.surface.page),
        GvPrimerPalette.chalk100,
      );
      expect(light.teamEdgeFor(blue, surface: light.surface.page), isNull);
      // #FF8000: 2.13 on the Light page; plain on the Dark page.
      expect(
        light.teamEdgeFor(orange, surface: light.surface.page),
        GvPrimerPalette.graphite900,
      );
      expect(dark.teamEdgeFor(orange, surface: dark.surface.page), isNull);
      // #0093CC: 2.94 on the Light page, 3.24 on the Light band.
      expect(
        light.teamEdgeFor(cyan, surface: light.surface.page),
        GvPrimerPalette.graphite900,
      );
      expect(light.teamEdgeFor(cyan, surface: light.surface.band), isNull);
    });
  });

  group('layer 5: decorative gradients', () {
    test('the retained brand gradients are recorded exactly (DK-6, LT-10)', () {
      for (final GvPrimerGradient g in <GvPrimerGradient>[
        GvPrimerEffects.brandGradientHero,
        GvPrimerEffects.brandGradientPlate,
      ]) {
        expect(g.angleDegrees, 165);
        expect(g.colors, const <Color>[
          Color(0xFFB04633),
          Color(0xFFA03E2B),
          Color(0xFF7A2E21),
        ]);
      }
      expect(GvPrimerEffects.brandGradientHero.stops, <double>[0, 0.45, 1]);
      expect(GvPrimerEffects.brandGradientPlate.stops, <double>[0, 0.55, 1]);
    });

    test('band lighting is Dark only; Light draws the flat band', () {
      expect(dark.bandLighting, same(GvPrimerEffects.bandLightingDark));
      expect(dark.bandLighting!.angleDegrees, 180);
      expect(dark.bandLighting!.colors, const <Color>[
        Color(0xFF1F2125),
        Color(0xFF1B1D20),
      ]);
      expect(light.bandLighting, isNull);
    });

    test('the CSS angle transform puts 0% and 100% on the CSS corners', () {
      const Rect box = Rect.fromLTWH(0, 0, 100, 60);
      final Matrix4 m = const GvCssAngleGradientTransform(165).transform(box)!;
      final Matrix4 inverse = Matrix4.inverted(m);
      double gradientX(Offset p) => MatrixUtils.transformPoint(inverse, p).dx;

      // 90° < θ < 180°: CSS starts at the top-left corner and ends bottom-right.
      expect(gradientX(box.topLeft), closeTo(box.left, 1e-6));
      expect(gradientX(box.bottomRight), closeTo(box.right, 1e-6));
      // Top-right projects to 30.87% of the CSS gradient line.
      expect(gradientX(box.topRight), closeTo(30.87, 0.01));
      // The transform does not change the gradient definition itself.
      final LinearGradient g = GvPrimerEffects.brandGradientHero.toGradient();
      expect(g.colors, GvPrimerEffects.brandGradientHero.colors);
      expect(g.stops, GvPrimerEffects.brandGradientHero.stops);
    });

    test('180° runs top to bottom and 90° left to right', () {
      const Rect box = Rect.fromLTWH(10, 20, 80, 40);
      double x(double angle, Offset p) {
        final Matrix4 inverse = Matrix4.inverted(
          GvCssAngleGradientTransform(angle).transform(box)!,
        );
        return MatrixUtils.transformPoint(inverse, p).dx;
      }

      expect(x(180, box.topCenter), closeTo(box.left, 1e-6));
      expect(x(180, box.bottomCenter), closeTo(box.right, 1e-6));
      expect(x(90, box.centerLeft), closeTo(box.left, 1e-6));
      expect(x(90, box.centerRight), closeTo(box.right, 1e-6));
    });
  });

  group('theme transitions', () {
    test(
      'lerp reaches each end and snaps non-colour rules at the midpoint',
      () {
        final GvPrimerRoles start = dark.lerp(light, 0);
        final GvPrimerRoles end = dark.lerp(light, 1);
        expect(start.surface.page, dark.surface.page);
        expect(end.surface.page, light.surface.page);
        expect(end.line.status, light.line.status);
        expect(end.surface.card, light.surface.card);
        expect(end.bandLighting, isNull);
        expect(dark.lerp(light, 0.49).focus.crossingBacking, isFalse);
        expect(dark.lerp(light, 0.5).focus.crossingBacking, isTrue);
        expect(dark.lerp(null, 0.5), same(dark));
      },
    );
  });
}
