/// The internal representation of a **referential stub**: a competitor identity
/// row that exists only so a foreign key can be satisfied, before the
/// authoritative identity has synchronised.
///
/// ## Why a stub exists at all
///
/// Championship standings and race classifications reference drivers and
/// constructors by stable identifier, and both can legitimately be persisted
/// before the corresponding `drivers` / `constructors` collection has been
/// synchronised. The v2 foreign keys must still hold, and `drivers.full_name` /
/// `constructors.name` are `NOT NULL`, so a parent row has to carry *some*
/// value.
///
/// ## What that value is
///
/// [kUnresolvedIdentityName] — the empty string. It is deliberately **not**
/// derived from the identifier: a display name is never humanised out of a slug,
/// because once stored that would be indistinguishable from an authoritative
/// name and would put invented content in front of the user.
///
/// The encoding is:
///
/// - **deterministic** — one exact constant, compared only through
///   [isUnresolvedIdentityName], never a heuristic or a string pattern;
/// - **unambiguous** — [validateDisplayName] rejects an empty name on every
///   authoritative write, so an empty stored name means "unresolved" and nothing
///   else, and a real identity can never be mistaken for a stub;
/// - **safe to fail on** — it carries no characters, so even a hypothetical leak
///   past a read could only render as nothing. It can never read as a plausible
///   name, which a humanised identifier always does.
///
/// ## Rules
///
/// This is a **persistence-only** value. It is not a domain `Driver` or
/// `Constructor`, and it is not a display name:
///
/// - every DAO read that projects a competitor name goes through
///   [resolvedDisplayName], so a domain read model reports `null` and the
///   presentation layer shows its own localized "unavailable" copy — the stored
///   value itself never leaves the data layer;
/// - a stub is never a materialized driver/constructor **detail** and never
///   appears in a driver/constructor **collection** read;
/// - stubs are created with `INSERT OR IGNORE`, so a write that only needs the
///   foreign key can never downgrade or overwrite an identity that has already
///   synchronised, and repeating it is idempotent;
/// - the stable identifier on the referencing row is untouched, so identity and
///   routing keep working while the name is unavailable;
/// - a later authoritative upsert replaces the stub in place, which makes the
///   watching streams re-emit with the real name; no standings, season-entry or
///   metadata row is involved in that resolution.
library;

/// The stored value of an unresolved competitor display name.
///
/// Creation goes through `CompetitorDao.ensureDriverIdentity` /
/// `ensureConstructorIdentity` — the single write path for referential stubs —
/// so this constant is never assembled at a call site.
const String kUnresolvedIdentityName = '';

/// Whether [stored] is the referential-stub marker rather than a real name.
bool isUnresolvedIdentityName(String? stored) =>
    stored == kUnresolvedIdentityName;

/// The authoritative display name in [stored], or `null` when the identity is
/// still an unresolved referential stub.
///
/// Every DAO read that projects a competitor name goes through this, so no read
/// can leak the marker, a raw identifier or a humanised identifier.
String? resolvedDisplayName(String? stored) =>
    isUnresolvedIdentityName(stored) ? null : stored;
