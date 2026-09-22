/**
 * Curated event display names, read from the same version-controlled registry
 * that owns the canonical `eventSlug`.
 *
 * The mapping registry resolves an **identity**; it deliberately indexes no
 * display text. The public `GrandPrix.name` still needs a value, and the only
 * admissible source is the curated registry the identity came from - never the
 * provider's `raceName`, which is a sponsor-mutable locator component and
 * never public content (ADR 0022 D5, amendment A1).
 *
 * Cached at module scope on the same terms as the mapping registry: the
 * content is immutable, derived from a reviewed repository change, holds no
 * request state and exposes no mutator.
 */

import eventsRegistry from '../../../../../content/registries/events.development.json';

export type CuratedEventNames = ReadonlyMap<string, string>;

let cached: CuratedEventNames | undefined;

/** The curated `eventSlug` to display-name lookup. */
export function curatedEventNames(): CuratedEventNames {
  cached ??= new Map(
    eventsRegistry.events.map((event) => [event.id, event.name]),
  );
  return cached;
}
