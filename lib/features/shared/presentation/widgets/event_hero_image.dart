import 'package:flutter/material.dart';

import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/entities/enums.dart';
import '../../domain/media/media_presentation.dart';
import '../../domain/media/media_slot_policy.dart';
import '../../domain/media/media_variant_selector.dart';
import '../media_slot.dart';

/// The image behind a Grand Prix hero, shared by Home and the Grand Prix screen so
/// the two can never disagree about which picture an event gets.
///
/// This is the only slot in the product allowed to draw on two owners: the event's
/// own imagery first, then the host circuit's. That fallback is approved by the
/// imagery strategy in `docs/product/GridView_UI_UX_Design.md` §12.3, which
/// specifies the Grand Prix hero as a "circuit **or** event image" — it is not a
/// convenience, and it is not silent.
///
/// The distinction between the two owners decides the accessibility treatment. An
/// event photograph beside the event's own title conveys nothing extra and is
/// decorative. A circuit **layout diagram** conveys the shape of the track, which
/// no adjacent text states, so it is labelled with the circuit's name. Guessing
/// one label for both would either lose real information or announce a photograph
/// twice.
class EventHeroImage extends StatelessWidget {
  /// A hero background that is **always** present, showing the layout-reserving
  /// placeholder when no imagery is available.
  ///
  /// For a slot whose approved design already reserves an image area — Home's
  /// featured-event hero, which has carried a placeholder since Phase 7D.
  const EventHeroImage({
    super.key,
    required this.eventMedia,
    required this.circuitMedia,
    this.circuitName,
    this.aspectRatio = _defaultAspectRatio,
  });

  static const double _defaultAspectRatio = 16 / 9;

  /// The hero background for an event, or `null` when neither the event nor its
  /// circuit has usable imagery.
  ///
  /// For a slot whose approved design is **typographic** and reserves no image
  /// area — the Grand Prix detail header. There, "no media" is not a missing
  /// image to apologise for with an empty placeholder and a scrim: the identity
  /// header is complete on its own, and that is the approved Phase 7 design. When
  /// imagery does exist the header gains it, which is what §12.3 permits.
  ///
  /// Returning `null` cannot shift the layout: `GvHeroCard` reserves its height
  /// from its own minimum, not from whether a background was supplied, so the
  /// hero is exactly the same size either way.
  static Widget? backgroundOrNull({
    required EntityMedia? eventMedia,
    required EntityMedia? circuitMedia,
    String? circuitName,
    double aspectRatio = _defaultAspectRatio,
  }) {
    final EventHeroMedia? hero = EventHeroMedia.resolve(
      eventMedia: eventMedia,
      circuitMedia: circuitMedia,
    );
    if (hero == null) return null;
    return EventHeroImage(
      eventMedia: eventMedia,
      circuitMedia: circuitMedia,
      circuitName: circuitName,
      aspectRatio: aspectRatio,
    );
  }

  /// The Grand Prix's own media, or `null` when it owns none.
  final EntityMedia? eventMedia;

  /// The host circuit's media, used only as the approved fallback.
  final EntityMedia? circuitMedia;

  /// The circuit's authoritative name, for the layout diagram's label. Never an
  /// identifier: when the circuit is unresolved this is `null` and the image stays
  /// decorative rather than being announced with a slug.
  final String? circuitName;

  final double aspectRatio;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final double width = MediaQuery.sizeOf(context).width;
    final EventHeroMedia? hero = EventHeroMedia.resolve(
      eventMedia: eventMedia,
      circuitMedia: circuitMedia,
    );

    final String? name = circuitName;
    // A circuit layout used as the event hero is still a diagram, and still
    // carries information. Anything else in this slot is scene-setting. It is
    // described only when there is a real circuit name to describe it with: a
    // labelless image node is worse than a decorative one.
    final bool describeAsDiagram =
        hero != null &&
        hero.isCircuitFallback &&
        hero.asset.category == MediaCategory.circuitLayout &&
        name != null;

    return GvRemoteImage(
      request: hero == null
          ? null
          : requestForAsset(
              context,
              asset: hero.asset,
              role: MediaDisplayRole.hero,
              logicalWidth: width,
            ),
      aspectRatio: aspectRatio,
      logicalWidth: width,
      placeholderIcon: Icons.flag_outlined,
      borderRadius: BorderRadius.zero,
      decorative: !describeAsDiagram,
      semanticLabel: describeAsDiagram ? l10n.circuitLayoutImage(name) : null,
    );
  }
}
