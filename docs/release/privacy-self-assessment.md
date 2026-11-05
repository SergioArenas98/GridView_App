# Privacy self-assessment: GridView 1.x and the move to 2.0.0

Prepared 2026-11-05 on PR #82, after master `d2d6df9`. **Draft.**

- **No external review is planned.** The owner decided on 2026-11-05 not to
  commission one. This document replaces the external reviewer with the
  owner's own decisions, taken on the evidence already in PR #82 and on the
  official guidance in §2.
- Dropping the review **settles nothing**. Every question that was open is
  still open until the owner records a decision on it (§5). Where the
  evidence cannot support an answer, this document says so and lists the
  practical options.
- Nothing here is published or submitted. The policy draft
  (`privacy_policies.md`, "Last updated: 5 November 2026") is unpublished.
  No Play Console, AdMob, Firebase or Netlify setting was changed.
- `data-safety.md` holds the engineering facts. `privacy-review-packet.md`
  holds the questions as prepared for a reviewer; it was never sent.

## 1. Owner decisions of 2026-11-05

| # | Decision | Effect |
|---|---|---|
| S-0a | 2.0.0 keeps Firebase Crashlytics and Performance Monitoring | No change: these are the 2.0.0 rows of `data-safety.md` §3.2 and policy section 3.3 |
| S-0b | 2.0.0 ships no push notifications | No change to the build: the dependency check forbids Messaging (`data-safety.md` §2), and 2.0.0 has no `POST_NOTIFICATIONS` permission. The policy draft now says so in its summary |
| S-0c | No external legal or privacy review | §5 lists what the owner must now decide; release-plan P-R and A0 say the same |

## 2. Official guidance used (read 2026-11-05)

| Source | What it says that matters here |
|---|---|
| Firebase, *Prepare your app for Google Play's Data safety section* (https://firebase.google.com/docs/android/play-data-disclosure) | **Cloud Messaging** collects automatically the app version ("for topic subscription and unsubscription") and the Firebase user agent. Its purpose: "Cloud Messaging generally uses the other collected data … to send messages to the client app." It "has a dependency on the Firebase installations SDK … make sure to account for the end-user data collected automatically by that SDK". **Installations** "Generates and collects a per-installation identifier (FID)", used "to provide a unique identifier to identify app installations". "In your data disclosure, make sure to also account for how you specifically use the collected data." |
| Firebase, *Set up a Firebase Cloud Messaging client app on Android* (https://firebase.google.com/docs/cloud-messaging/android/client) | "When a FCM registration is generated, the library uploads the identifier and configuration data to Firebase." With auto-initialization on, "the FCM SDK automatically syncs with the FCM backend to keep the registration fresh". Preventing it needs `firebase_messaging_auto_init_enabled` (and Analytics collection) set to false in the manifest; 1.x does not set it (`data-safety.md` §3.5) |
| Firebase, *Best practices for FCM registration token management* (https://firebase.google.com/docs/cloud-messaging/manage-tokens) | On Android, "when a registration has been inactive for 270 days, FCM considers it expired and garbage collects it." |
| Play Console Help, *Provide information for Google Play's Data safety section* (https://support.google.com/googleplay/android-developer/answer/10787469) | "'Collect' means transmitting data from your app off a user's device", including by SDKs: "You must reflect data collection or sharing carried out by such third-party code". Developer communications is "Used to send news or notifications about the app or the developer"; App functionality is "Used for features that are available in the app". The section "describes the sum of your app's data collection and sharing across all its versions"; apps active on internal testing tracks are exempt. Misrepresentation can lead to "blocked updates or removal from Google Play". The help does not address data that an SDK collects but the app never uses |
| Play Console Help, *Control when app changes are reviewed and published* (https://support.google.com/googleplay/android-developer/answer/9859654) | Managed publishing holds back rollouts and "App content changes" until the developer publishes them together. The page does not name the Data safety form, so whether it is held back with a release is **not confirmed** |
| EDPB, *Guidelines 2/2023 on Technical Scope of Art. 5(3) of ePrivacy Directive*, version 2.0, adopted 7 October 2024 (PDF SHA-256 `dbc1d377…5b03`) | An SDK that makes the device proactively send stored information "triggers the applicability of Article 5(3)" (para. 34); collecting a unique identifier from a mobile application is a "gaining of access" to which Article 5(3) applies (para. 63). Article 5(3) allows such access on the basis of consent, unless an exemption applies; the guidelines do not analyse the exemptions (para. 56) |

Copies of all six sources, saved 2026-11-05, are in the owner's evidence
store (`privacy-self-assessment-guidance-2026-11-05/`, manifest
`SHA256SUMS` = `45ed62212fb8395758c8e5655a9520b4163a4fd70c738b1b5f8abbf0cee4bdfa`).

The EDPB guidelines interpret EU law; they are not a ruling on GridView.
Ireland implements Article 5(3) in S.I. No. 336 of 2011, Regulation 5. This
document applies the guidance to the facts. It is not legal advice.

## 3. Registration is not sending

1.x did two different things, and the documents keep them apart.

| | What happened | How it is known |
|---|---|---|
| **Automatic registration** | On every 1.x install, at launch, the packaged FCM and Installations SDKs created a Firebase installation ID, registered the installation for messaging (Google issues a registration token for it), and uploaded the identifier and configuration data to Firebase project `gridview-fb20f`. The registration is refreshed while the app is used. It ran whether or not anything was ever sent | Inferred from the packaged SDKs (versions, manifests, no auto-init opt-out) and Firebase's documentation; not observed on a device (`data-safety.md` §3.5) |
| **Sending notifications** | **Never happened.** 1.x had no notification feature and no code that used FCM. The owner never sent a notification | No-feature: observed in the bundles. Never sent: the owner's statement, consistent with the Firebase console (no campaign ever created; nothing in the last 90 days). The console cannot show API sends or older reports (`data-safety.md` §3.5) |

The policy draft (section 3.4) now presents these as two bullets, "What
happens automatically" and "What never happened", and adds the 270-day
expiry.

## 4. Proposed Data safety answers

These are proposals for the owner's acceptance, entered in Play Console only
at the approved steps (release plan P0, P3, R7). Every row is **required**
(no in-app switch) and **not processed ephemerally**, except as noted.

**Overview, all states:** collects or shares required data, **Yes**; all
data encrypted in transit, **Yes**; a way to request deletion, **No**
(D-DEL).

**State 0, now (1.x only; `data-safety.md` §3.5). Ads: Yes.**

| Type | Collected | Shared | Purposes |
|---|---|---|---|
| Approximate location | yes | yes | Advertising or marketing; Analytics; Fraud prevention, security and compliance |
| App interactions | yes | yes | the same |
| Crash logs | yes | yes | the same |
| Diagnostics | yes | yes | the same |
| Device or other IDs | yes | yes | the same, **plus Developer communications (proposed, Q1a)** |

**State T, transition (1.x and 2.0.0; `data-safety.md` §3.2 plus §3.5).
Ads: Yes.**

| Type | Collected | Shared | Purposes |
|---|---|---|---|
| Approximate location | yes | yes | Analytics; App functionality (the API, R2 conditional); Advertising or marketing; Fraud prevention, security and compliance |
| App interactions | yes | yes | Analytics; Advertising or marketing; Fraud prevention, security and compliance |
| Crash logs | yes | yes | the same |
| Diagnostics | yes | yes | the same |
| Device or other IDs | yes | yes | the same, **plus Developer communications (proposed, Q1a)** |

**State F, final (2.0.0 only; `data-safety.md` §3.2). Ads: No.** Crash
logs, Diagnostics, Device or other IDs and App interactions: collected, not
shared, Analytics. Approximate location: collected, not shared, Analytics
and App functionality. No Developer communications: 2.0.0 has no messaging
SDK.

"Shared" on a type comes from the 1.x ads SDK. Firebase's part is not
sharing (Google processes it for GridView), but Play's form takes one answer
per type.

## 5. Questions the owner must now decide

Q-numbers follow `privacy-review-packet.md`. "Supported" means the evidence
and the guidance in §2 support the answer; it is not a legal opinion.

### Q1a. Data safety purpose for the 1.x FCM registration

**Exact question:** Device or other IDs is already declared for the ads SDK.
Must its purposes also cover the Firebase installation ID and registration
token that the FCM and Installations SDKs collect, and if so, which Play
purpose is accurate when no 1.x feature used them?

| Option | Assessment |
|---|---|
| **Add Developer communications (proposed)** | Supported. Play requires SDK collection to be reflected. Firebase states the purpose of the SDK's data as "to send messages to the client app", which is Play's Developer communications. The capability was packaged and live, even though it was never used. The policy explains that no notification was sent. Drawback: the listing shows a purpose that 1.x never exercised. It is dropped in state F |
| Add no purpose for FCM | Weaker. The form would show only the ads purposes for the type, leaving the FCM collection unexplained. Play's help does not address collected-but-unused data, and can act on an inaccurate form |
| Add App functionality | Not supported: no 1.x feature used the data |

**Status:** proposed, awaiting the owner's acceptance. States 0 and T wait on
it.

### Q1b. Legal basis for the 1.x FCM registration

**Exact question:** For users in the EEA, the UK and Switzerland, what legal
basis (GDPR Article 6) covered the 1.x FCM registration, and did storing and
reading the installation identifier on the device need consent under
Article 5(3) of the ePrivacy Directive (in Ireland, S.I. 336/2011
Regulation 5)?

**Can it be supported? No.**
- Article 6: there was no purpose the processing served, so no legitimate
  interest or necessity can be shown. Consent was never asked.
- Article 5(3): the EDPB guidance in §2 places this access within Article
  5(3). The exemptions cover access needed to transmit a communication or
  strictly necessary for a service the user explicitly requested. No
  notification service existed, so nothing supports an exemption.

| Option | Assessment |
|---|---|
| **(a) State the facts and claim no basis (in the draft)** | Policy section 4 now says: the registration "served no feature, and we have not used it. Versions 1.x did not ask for consent to it, and we do not claim a legal basis for it. Version 2.0.0 removes it." Accurate and consistent with the ads paragraph. It openly records processing without a basis |
| (b) Claim legitimate interests | Not supported by the facts. Rejected |
| (c) Stay silent | Leaves Article 13's legal-basis element unanswered for this processing. Not recommended |

Options (a) and (c) do not cure the past processing; only Q1c reduces it
from now on.

**Status:** open. Publishing the policy (P2) waits on the owner's choice.

### Q1c. Reducing the ongoing FCM processing

**Exact question:** Beyond disclosure, can the registration that installed
1.x copies keep running be stopped or shortened?

| Option | Assessment |
|---|---|
| Release 2.0.0 (removes the SDK on every device that updates) | Effective for API 24 and later. Devices on API 21-23 cannot update (2.0.0 minSdk 24) and keep registering until uninstalled |
| A Firebase project setting that stops 1.x registration | **Not found.** No documented setting was identified that stops 1.x's FCM registration without touching Firebase Installations, which 2.0.0's Crashlytics and Performance need (same Firebase Android app). Any candidate would need testing before use, and it is an external setting change |
| Delete the 1.x registrations and installation IDs | Not possible on the current facts: GridView never stored any identifier, and deletion needs the installation ID (`data-safety.md` R3). FCM expires a registration unused for 270 days; that covers uninstalled and abandoned copies only |
| A 1.x update for API 21-23 that removes the SDKs | The only route to devices that cannot install 2.0.0. The imported tree is not the 1.x build source (`data-safety.md` §3.5), it contradicts D-T1, and it keeps a 1.x build distributed. Not recommended |

**Status:** open; no measure beyond releasing 2.0.0 is proposed.

### Q2. R2, the complete processing scope of the API's IP handling

**Exact question:** Is the GridView API's handling of the IP address
ephemeral across its complete processing scope?

**Supported in part.** The code, the W3 log check and the 2026-11-05
re-check show no persisted line for an app request (`data-safety.md` §3.4).
Not inspected: Cloudflare's own platform processing under its terms, beyond
the Worker's logs.

Options: accept R2 on the engineering evidence, recording that limit; or
keep it open and declare the API's IP use as not ephemeral. The type is
already declared as not ephemeral because of Firebase (§4), so the visible
form does not change either way. **Status:** conditionally accepted
(2026-11-02); scope still open.

### Q3. R8, a Data safety row for the API's persisted lines

**Exact question:** Do the API's persisted internal-error lines need a Data
safety row?

**Supported:** no row. The lines carry no request ID, IP address or device
identifier (`data-safety.md` §3.4, ADR 0028 D8). Options: accept "no row";
or add App interactions with the App functionality purpose (release plan
P3). **Status:** open.

### Q4. R6, 1.x ads requested with no consent message

**Exact question:** 1.x requested ads with no consent message. Is anything
more needed than the policy's disclosure and archiving the ad units (D-A)?

**Can it be supported? No.** The same Article 5(3) reasoning as Q1b applies
to the ads SDK, and 1.x never showed the consent form it packaged
(`data-safety.md` §3.5). The draft discloses this plainly and claims no
consent (policy sections 3.4 and 4).

Options: disclosure plus D-A (already decided, not done); disclosure plus D-A
and the fastest practical 2.0.0 rollout; a 1.x update for API 21-23 (as in
Q1c, not recommended). **Status:** open.

### Q5. §6.1, a geographic address

**Exact question:** Does any rule outside the privacy notice require the
controller to publish a geographic address?

**Not assessed.** Email meets the privacy-notice requirement (`data-safety.md`
§6.1). Options: keep email only (C4, decided 2026-10-23) and record the
question as unassessed; or assess the rules that might apply before
publication. **Status:** open.

### Q6. The policy's wording on 1.x ads

**Exact question:** Should the policy describe ad requests as well as
display, now that serving has effectively ended?

**Supported:** yes. The draft now says 1.x "request advertising banners …
and show them when Google serves one", and that installed copies "still
request them". **Status:** drafted; accepted with the policy text.

## 6. Does changing the order of legacy retirement help?

Two obligations behave differently:

- **The Data safety form follows distribution.** It describes the versions
  Play distributes, so the order of the store steps decides how long the 1.x
  rows must stay on it.
- **The policy follows processing.** Installed 1.x copies keep registering
  and requesting ads until they update or are uninstalled, whatever Play
  distributes. **No order removes Q1b or Q4.**

| Order | What changes | Assessment |
|---|---|---|
| **O1, current plan:** state 0 now, state T before 2.0.0 leaves internal testing, 20 % then 100 % rollout, state F | Needs Q1a for states 0 and T | Keeps the staged rollout. Recommended |
| **O2, straight to F:** skip states 0 and T; pause Alpha; release 2.0.0 to 100 % with versionCode 7 not retained, and submit state F with it | Avoids answering Q1a on the form | Leaves the current "No data collected" form, already inaccurate for 1.2.1, in place until then, including during internal testing. It drops the staged rollout. It depends on Data safety being published with the release, which is not confirmed (§2). Not recommended |
| **O3, no state T:** state 0 now, then 2.0.0 straight to 100 % with state F | Shortens the period with 1.x rows | Still needs Q1a for state 0. Drops the staged rollout for a form state that costs nothing to keep. Not recommended |
| **Pause Alpha now** (D-T2, before P0) | Ends versionCode 2's distribution earlier | Helps a little and depends on nothing. Same SDKs as versionCode 7, so the form's content does not change |

**Conclusion:** reordering cannot answer the legal-basis questions. It can
avoid the Data safety purpose question only by leaving a known-inaccurate
form live (O2). What actually reduces the processing is releasing 2.0.0, the
D-A archive, and pausing Alpha early.

## 7. What waits on each decision

| Step | Waits on |
|---|---|
| P2, publish the policy | Q1b, Q4, Q5, Q6 decided; the draft text accepted |
| P0, state 0 | P2; Q1a accepted |
| P3, state T | P2; Q1a; Q2 and Q3 decided |
| R7, state F | R6, D-T1, Alpha paused; Q2 and Q3 decided |
| PR #82 merge, A0 privacy item | Every item in §5 decided and recorded in `data-safety.md` §4.1 |
