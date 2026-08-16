# ADR 0018: Advertising is not retained for v1

- Status: Accepted
- Date: 2026-08-16

## Context

The legacy application shipped advertising. The reconstruction never decided
whether to keep it, and the ambiguity has been carried in the documentation ever
since as a conditional — "if ads remain", "when advertising is integrated
(Phase 8)" — which is not a decision.

The product requirement was always permissive rather than mandatory.
`GridView_PRD.md` §17 says advertising **may** remain part of the reconstructed
version, subject to constraints. "May" is an option, not an obligation; nothing
in the approved product scope requires GridView to serve an advertisement.

`GridView_Implementation_Plan.md` §25 lists advertising among the optional scope
decisions to close early, with the recommendation "retain only if revenue or
continuity justifies SDK and consent complexity" and the deadline **before
Phase 8 production integration**. Phase 8 production integration has been
reached and passed. No approval to integrate advertising was recorded, in the
repository or anywhere it references. The deadline expired without a decision to
retain, which under §25 is a decision not to.

The state of the code confirms it. What exists today is:

| Fact | Evidence |
|---|---|
| No advertising SDK dependency | `pubspec.yaml` and `pubspec.lock` contain no `google_mobile_ads` or equivalent |
| No consent / UMP SDK dependency | same |
| No advertising native library | `android/app/build.gradle` lists `com.google.android.gms:play-services-ads` and `play-services-ads-identifier` in its **forbidden** dependency set; `verify<Variant>FirebaseDependencies` fails the build if either is ever resolved into a variant |
| No ad unit ID anywhere | no `ca-app-pub-…/…` unit identifier exists in the repository |
| No ad request | no `MobileAds`, `AdRequest`, `BannerAd` or equivalent symbol appears in `lib/` or `test/` |
| No runtime initialization | nothing in `bootstrap.dart` or any provider initializes an ads SDK |
| Settings reports it truthfully | Settings → Privacy reports advertising as **Disabled**, which is a true statement about this build |

The one advertising artefact that does exist is a preserved identity value: the
production AdMob **application ID** `meta-data` in
`android/app/src/production/AndroidManifest.xml`. It is the published
application's own identifier, retained under the "preserve the published
application identity" principle (`GridView_Implementation_Plan.md` §2.6). It is
inert: an application ID is read by the Google Mobile Ads SDK at initialization,
and that SDK is neither packaged nor initialized, so nothing reads it. Dev and
staging manifests deliberately do not carry it.

`GvAdContainer` also exists in the design system. It reserves layout space and
performs no ad initialization. Its only construction site is the development
component catalogue, which `ComponentCatalogueScreen.open` refuses to navigate
to in production and which Settings hides outside development and staging. It is
unreachable from every live production route.

## Decision

**Advertising is not retained for v1.**

1. GridView v1 ships with no advertising SDK, no consent SDK, no ad unit, no ad
   request and no advertising runtime. This is the shipped state, not a
   temporary one.
2. The production AdMob application-ID `meta-data` stays exactly as it is. It is
   published-app identity, it is inert without the SDK, and removing it is a
   change to the published application's identity that this decision does not
   authorize.
3. `GvAdContainer` is retained as a **development catalogue component only**. It
   is documented as such, it is not placed on any live screen, and this ADR does
   not authorize placing it on one.
4. Dev and staging require **no test ad units**. The instruction to use Google
   test identifiers outside production presumed an integration; with no
   integration there is nothing to point at a test unit, and adding test units
   to a build that never requests an ad would create the appearance of an
   integration that does not exist.
5. Settings continues to report advertising as disabled. No change to Settings
   behaviour is authorized or needed — the report is already accurate.
6. `GridView_PRD.md` §17 is **not amended**. Its permissive wording
   ("advertising *may* remain") stays valid and is exactly what makes this
   decision available without a product change.

### Consequence for the Phase 8 exit criteria

`GridView_Implementation_Plan.md` §13.9 lists "Ads never block startup" as a
Phase 8 exit criterion. That criterion is now recorded as **not applicable
because advertising is not retained for v1**.

It is deliberately *not* recorded as satisfied. Marking it satisfied would claim
that an advertising integration was built and then shown not to delay startup.
Nothing of the kind was built or tested. "Not applicable" is the only honest
status: the risk the criterion guards against cannot occur, because the thing
that would cause it does not exist.

## Consequences

**Positive.** No third-party advertising SDK in the binary, so no advertising
identifier collection, no consent flow to design and test, no GDPR/UMP surface,
no additional Play Data Safety declaration for advertising, no additional
startup work, and one fewer SDK whose failure modes reach the first frame. The
privacy story stays simple and true: Settings says advertising is disabled and
it is.

**Negative.** No advertising revenue in v1. If revenue matters, this decision
must be revisited deliberately rather than drifted back into.

**Reversal path.** Reintroducing advertising is a new, reviewed phase — not an
incremental change to Phase 8. It requires, at minimum:

- an explicit architecture decision superseding this ADR;
- consent and privacy analysis, including UMP/GDPR handling and an updated Play
  Data Safety declaration;
- test ad identifiers for dev and staging, never production units outside
  production;
- placement, layout-reservation and startup-impact design consistent with
  `GridView_UI_UX_Design.md` §19 and the PRD §17 constraints;
- initialization after the first frame, with a demonstrated startup measurement
  rather than an assertion.

Until such a phase exists and is approved, any advertising work is out of scope.

## Alternatives considered

**Integrate advertising in Phase 8 as originally sketched.** Rejected: the §25
deadline passed with no approval, and §25's own recommendation was not to let
advertising delay core reconstruction. Building it now would add an SDK, a
consent flow and a privacy surface to a phase already carrying media,
localization, settings and observability.

**Remove the AdMob application-ID `meta-data` as well.** Rejected: it is
published-app identity protected by §2.6, it is inert without the SDK, and
changing it is a separate decision with store-side consequences that this one
does not need to take.

**Delete `GvAdContainer`.** Rejected as unnecessary. Unlike the Phase 3B
placeholder catalogue removed in the same phase, it is genuinely reachable —
from the development catalogue, where it documents the reserved-space pattern.
Deleting it would discard the one artefact that makes the reversal path cheap.
It stays, catalogue-only and documented as such.

**Leave the question open.** Rejected: that is the status quo this ADR replaces.
An unclosed optional-scope decision propagates conditional language into every
document that touches it, and leaves an exit criterion that can be neither
satisfied nor waived.

## References

- `GridView_PRD.md` §17 (unchanged; permissive wording)
- `GridView_Implementation_Plan.md` §13.6, §13.9, §25
- `GridView_Environments.md` — Advertising
- `GridView_UI_UX_Design.md` §19
- `GridView_Design_System.md` — component inventory
- `GridView_Preferences_And_Settings.md` §6.1 — Settings privacy reporting
