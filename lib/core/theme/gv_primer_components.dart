import 'package:flutter/widgets.dart';

import 'gv_primer_effects.dart';
import 'gv_primer_role_groups.dart';

/// Primer V2 component roles: layer 4 of the frozen model
/// (`CROSS-THEME-TOKEN-MAP.md` §4).
///
/// A component role maps one component state to semantic and contextual
/// roles (layers 2 and 3). These classes hold no values of their own: they
/// are built on demand by `GvPrimerRoles` from its stored roles, so a theme can
/// never disagree with itself. They carry colours only; geometry (12° cut,
/// slab size, ring painting, dashed stroke) belongs to the shared widgets.

/// Bottom navigation (token map §4.2, LT-9).
@immutable
class GvPrimerNavRoles {
  const GvPrimerNavRoles({
    required this.bar,
    required this.selectedSlab,
    required this.selectedIcon,
    required this.selectedLabel,
    required this.unselected,
    required this.focus,
  });

  final Color bar;
  final Color selectedSlab;
  final Color selectedIcon;

  /// Chalk in Dark; Graphite in Light (LT-9, the one rule-level variant).
  final Color selectedLabel;

  /// Unselected icon and label.
  final Color unselected;
  final Color focus;
}

/// Segmented control / selector (token map §4.3).
@immutable
class GvPrimerSelectorRoles {
  const GvPrimerSelectorRoles({
    required this.container,
    required this.selectedSlab,
    required this.selectedLabel,
    required this.unselectedLabel,
    required this.selectedFocus,
    required this.unselectedFocus,
    required this.unselectedFocusBacking,
  });

  final Color container;
  final Color selectedSlab;
  final Color selectedLabel;
  final Color unselectedLabel;

  /// Chalk inset ring on the selected slab (both themes).
  final Color selectedFocus;

  /// Chalk in Dark (DK-3, crosses the slab tip); Graphite in Light (LT-4).
  final Color unselectedFocus;

  /// The 5px backing band under the unselected ring: the container colour in
  /// Light (LT-4), `null` in Dark.
  final Color? unselectedFocusBacking;
}

/// Status chips (token map §4.7). Words and accessible names stay with the
/// widget; these are the colours of each meaning.
@immutable
class GvPrimerStatusChipRoles {
  const GvPrimerStatusChipRoles({
    required this.known,
    required this.knownInverse,
    required this.unknown,
    required this.alert,
    required this.label,
    required this.live,
    required this.finalChip,
    required this.contextFill,
    required this.winner,
  });

  final GvPrimerOutline known;
  final GvPrimerOutline knownInverse;
  final GvPrimerOutline unknown;
  final GvPrimerOutline alert;

  /// Label colour of the outlined chips.
  final Color label;
  final GvPrimerPair live;
  final GvPrimerPair finalChip;

  /// Context chip ("Sprint weekend").
  final Color contextFill;

  /// Winner tag (flat oxide).
  final GvPrimerPair winner;
}

/// Notices (token map §4.8).
@immutable
class GvPrimerNoticeRoles {
  const GvPrimerNoticeRoles({
    required this.fill,
    required this.border,
    required this.icon,
    required this.text,
  });

  final Color fill;

  /// Decorative supporting boundary (LT-8); never the carrier of meaning.
  final Color border;

  /// Cause icon (alert, clock, help; VS-4).
  final Color icon;
  final Color text;
}

/// Text links and the actions that use inverse roles (token map §4.9).
@immutable
class GvPrimerActionRoles {
  const GvPrimerActionRoles({
    required this.link,
    required this.linkUnderline,
    required this.button,
    required this.buttonHover,
    required this.disc,
    required this.snackbar,
    required this.snackbarSeam,
  });

  final Color link;
  final Color linkUnderline;
  final GvPrimerPair button;
  final Color buttonHover;
  final GvPrimerPair disc;
  final GvPrimerPair snackbar;
  final Color snackbarSeam;
}

/// Loading placeholders (token map §4.10, LT-16): a static skeleton; no
/// animation is added.
@immutable
class GvPrimerSkeletonRoles {
  const GvPrimerSkeletonRoles({required this.gradient});

  /// `linear-gradient(90deg, band, raised, band)` in the active theme.
  final GvPrimerGradient gradient;
}
