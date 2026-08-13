import '../entities/enums.dart';
import 'media_presentation.dart';

/// Which media categories each **approved** product slot will accept, in order.
///
/// Slot selection lives here, in one reviewable place, rather than in SQL or in a
/// widget. The DAO deliberately returns every asset an owner has; this states
/// which of them a given slot is allowed to show and in what order of
/// preference. Adding a category to a slot is therefore a visible, testable
/// product decision.
///
/// Every list is closed: a category not named for a slot is never rendered
/// there. In particular a `logo` never becomes a driver portrait, and a
/// `portrait` never becomes a team mark.
abstract final class MediaSlotPolicy {
  /// Driver portrait slots — the Explore driver row and the Driver detail hero.
  ///
  /// A portrait first. `hero` and `thumbnail` are accepted because they are
  /// category names the contract may use for a driver's own subject imagery.
  /// `logo` and `car` are excluded: neither depicts the driver.
  static const List<MediaCategory> driverPortrait = <MediaCategory>[
    MediaCategory.portrait,
    MediaCategory.hero,
    MediaCategory.thumbnail,
  ];

  /// Constructor mark slots — the Explore team row and the Team detail hero.
  ///
  /// A logo first, then a car image, then generic team imagery. This is the
  /// team's **stable** identity imagery; see `SeasonTeamCard.media` for why it is
  /// never presented as season livery.
  static const List<MediaCategory> constructorMark = <MediaCategory>[
    MediaCategory.logo,
    MediaCategory.car,
    MediaCategory.hero,
    MediaCategory.thumbnail,
  ];

  /// Circuit slots — the Explore circuit row and the Circuit detail hero.
  ///
  /// The layout diagram first, because it is the informative one, then
  /// environmental imagery.
  static const List<MediaCategory> circuitLayout = <MediaCategory>[
    MediaCategory.circuitLayout,
    MediaCategory.hero,
    MediaCategory.thumbnail,
  ];

  /// Event imagery owned by the Grand Prix itself.
  ///
  /// Kept separate from [circuitFallbackForEvent] so an event asset can never be
  /// confused with a circuit asset: the two are different owners and the
  /// distinction decides both what is shown and how it is labelled.
  static const List<MediaCategory> grandPrixEvent = <MediaCategory>[
    MediaCategory.hero,
    MediaCategory.thumbnail,
  ];

  /// The circuit-owned categories a Grand Prix hero may fall back to.
  ///
  /// Explicitly approved by the imagery strategy in
  /// `docs/product/GridView_UI_UX_Design.md` §12.3, which specifies the Grand
  /// Prix hero as a "circuit **or** event image". Because the fallback crosses
  /// owners it is never silent: [EventHeroMedia.isCircuitFallback] records which
  /// one was used so the semantics describe the image that is actually on screen.
  static const List<MediaCategory> circuitFallbackForEvent = <MediaCategory>[
    MediaCategory.hero,
    MediaCategory.circuitLayout,
    MediaCategory.thumbnail,
  ];
}

/// The hero image chosen for a Grand Prix, and which owner supplied it.
///
/// The Grand Prix hero is the one slot allowed to draw on two owners, so the
/// choice is made explicit rather than collapsed into a single nullable asset.
/// Presentation needs to know the difference: an event photograph and a circuit
/// layout diagram do not carry the same information and must not claim the same
/// accessible description.
class EventHeroMedia {
  const EventHeroMedia({required this.asset, required this.isCircuitFallback});

  final MediaPresentation asset;

  /// Whether [asset] came from the circuit rather than from the event.
  final bool isCircuitFallback;

  /// Resolves the Grand Prix hero from the event's own media first, falling back
  /// to the circuit's only when the event owns nothing suitable.
  ///
  /// Returns `null` when neither owner has a usable asset — the ordinary
  /// "show the neutral placeholder" outcome.
  static EventHeroMedia? resolve({
    EntityMedia? eventMedia,
    EntityMedia? circuitMedia,
  }) {
    final MediaPresentation? event = eventMedia?.preferred(
      MediaSlotPolicy.grandPrixEvent,
    );
    if (event != null) {
      return EventHeroMedia(asset: event, isCircuitFallback: false);
    }
    final MediaPresentation? circuit = circuitMedia?.preferred(
      MediaSlotPolicy.circuitFallbackForEvent,
    );
    if (circuit != null) {
      return EventHeroMedia(asset: circuit, isCircuitFallback: true);
    }
    return null;
  }
}
