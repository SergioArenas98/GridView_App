/**
 * Canonical GridView identities that are **derived** from another entity.
 *
 * Most identities in the contract are opaque slugs a curator or a mapping
 * assigns. A few are not: the domain model defines them as a function of their
 * parent and their kind, so the identity itself carries the relationship
 * (GridView_Domain_Model.md §6, §6.2). Those belong in one place - a rule
 * restated at each site is a rule that can disagree with itself, and here the
 * consequence of disagreement is a session published under the wrong Grand
 * Prix.
 *
 * Nothing here validates or repairs anything. These functions *construct* the
 * identity the contract defines; deciding whether a supplied identity equals it
 * is the caller's business.
 */

import type { SessionType } from './enums';

/**
 * The identity segment for one session type.
 *
 * The enum spells multi-word types with underscores (`sprint_qualifying`)
 * because that is the wire vocabulary; identities are hyphenated slugs
 * throughout the contract (`2026-belgian-grand-prix-sprint-qualifying`). The
 * translation is exactly this substitution and nothing else - no casing
 * change, no trimming and no abbreviation - so an identity and its type stay
 * mechanically derivable from one another.
 */
function sessionTypeSegment(sessionType: SessionType): string {
  return sessionType.replaceAll('_', '-');
}

/**
 * The canonical identity of one session: `{grandPrixId}-{sessionType}`.
 *
 * A session's identity is a primary key across the whole database, not per
 * event, and it is *derived from its parent event*. That makes it the one
 * place the parent relationship is recoverable from the row itself, which is
 * why a session whose identity names another Grand Prix is not a cosmetic
 * mismatch: it is a row filed under an event it does not belong to.
 */
export function canonicalSessionId(
  grandPrixId: string,
  sessionType: SessionType,
): string {
  return `${grandPrixId}-${sessionTypeSegment(sessionType)}`;
}
