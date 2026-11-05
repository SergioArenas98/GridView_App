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
- **Updated later on 2026-11-05** with an emulator observation of the
  Play-signed versionCode 7 APK (§3.1) and the owner's Play Console
  screenshots (§3.2). Neither changes an answer or settles a question.
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
| **Automatic registration** | At launch, the packaged Firebase Messaging SDK initiates a messaging registration for Firebase project `gridview-fb20f`, with no feature using it and whether or not anything is ever sent. Per Firebase's documentation, it uses a Firebase installation ID, Google issues a registration token for the installation, the identifier and configuration data are uploaded to Firebase, and the registration is refreshed while the app is used | **versionCode 7: observed** on a clean first launch (§3.1): registration initiated automatically, and Google Play services logged success; the app exited before receiving the reply. **versionCode 2: not tested**; inferred from the same packaged SDKs. **What was transmitted: not captured**; the identifiers come from Firebase's documentation (`data-safety.md` §3.5) |
| **Sending notifications** | **Never happened.** 1.x had no notification feature and no code that used FCM. The owner never sent a notification | No-feature: observed in the bundles. Never sent: the owner's statement, consistent with the Firebase console (no campaign ever created; nothing in the last 90 days). The console cannot show API sends or older reports (`data-safety.md` §3.5) |

The policy draft (section 3.4) now presents these as two bullets, "What
happens automatically" and "What never happened", and adds the 270-day
expiry.

### 3.1 Emulator observation of versionCode 7 (2026-11-05)

- **Build:** the Play-signed 1.2.1 APK, versionCode 7, from Play Console's
  App bundle explorer. Signer certificate SHA-256 `98bd6c76…c3b5`, the app
  signing key.
- **Device:** the R3 test emulator, Android 16 (API 36), with Google Play
  services and no Google account. Clean install by adb; one launch from
  the launcher; nothing tapped; observed for two minutes.
- **Not done:** no registration call by the tester, no notification sent,
  no Firebase or Play Console change. Tokens and installation IDs were
  redacted before any log was written.

| Time (UTC) | Process | Redacted log line |
|---|---|---|
| 22:07:49.101 | GridView | `FirebaseInitProvider: FirebaseApp initialization successful` |
| 22:07:49.161 | GridView | `FirebaseMessaging: Making new request for: <sender ID>` |
| 22:07:50.397 | Google Play services | `c2dm: [19,com.sejuma.gridview:…,0,0]` (register request for GridView) |
| 22:07:51.228 | GridView | `System.exit called` (Google Play's licence check; the copy was not installed from Play) |
| 22:07:51.837 | Google Play services | `c2dm: [-19,SUCCESSFUL,0,0]`, the only response before its next request |

- **Why it is Messaging, not Firebase Installations:** the lines come from
  the Messaging SDK and from Google Play services' messaging registration
  log for GridView's package. In the same log, the Play Store app's
  identical request and `SUCCESSFUL` pair is followed by its own "Token
  successfully retrieved" and "FCM registered".
- **Limits:** one launch of one build on one emulator. The app exited
  before receiving the reply. The packet capture recorded only boot
  traffic, so what was transmitted is not known from the test. versionCode
  2 was not tested.
- **Evidence:** `fcm-1x-registration-check-2026-11-05/` in the owner's evidence store (redacted logcat excerpt; manifest `SHA256SUMS` = `235a973825fb5094c33459f49b5689c03913fb4c3bc34034e1708bb4bb331554`).

### 3.2 Play Console status (2026-11-05)

**Confirmed 2026-11-05 from the owner's Play Console screenshots** (kept by
the owner, not in this repository): Production shows 1.2.1 (versionCode 7)
available on Google Play. The closed "Alpha" track initially showed 1.0.0
(versionCode 2) as available to selected testers. The owner then paused
Alpha on the same day. The follow-up screenshot shows the track paused and
inactive, although the release card still displays its availability label.
The pause changes no proposed answer: states 0 and T still account for
versionCode 7 while Play distributes it (§4).

## 4. Proposed Data safety answers

These are draft answers, entered in Play Console only at the approved
steps (release plan P0, P3, R7). Every row is **required**
(no in-app switch) and **not processed ephemerally**, except as noted.

**Overview, all states:** collects or shares required data, **Yes**; all
data encrypted in transit, **Yes**; a way to request deletion, **No**
(D-DEL).

**State 0, now (Production 1.2.1, versionCode 7; `data-safety.md` §3.5).**
Alpha is paused. This worksheet is for review; do not submit it before
the approval steps below. In App content, the separate Ads declaration is
**Yes** for 1.2.1. In Data safety, use the overview answers above.

Play asks for the purposes of collection and sharing separately. In this
table, **ads purposes** means Advertising or marketing; Analytics; Fraud
prevention, security and compliance. Every listed type is collected and
shared, is not processed ephemerally, and its collection is required in
this draft.

| Play category → type | Why collected? | Why shared? |
|---|---|---|
| Location → Approximate location | Ads purposes | Ads purposes |
| App activity → App interactions | Ads purposes | Ads purposes |
| App info and performance → Crash logs | Ads purposes | Ads purposes |
| App info and performance → Diagnostics | Ads purposes | Ads purposes |
| Device or other IDs → Device or other IDs | Ads purposes; **Developer communications for the automatic Messaging registration only (Q1a)** | Ads purposes |

The sharing answers are for the ads SDK. Do not select Developer
communications under sharing: the Messaging entry concerns the
registration with Firebase as a service provider. Use the same
collection-only distinction for this purpose in the draft for state T.

**State T, transition (1.x and 2.0.0; `data-safety.md` §3.2 plus §3.5).
Ads: Yes.**

| Type | Collected | Shared | Purposes |
|---|---|---|---|
| Approximate location | yes | yes | Analytics; Advertising or marketing; Fraud prevention, security and compliance (no location derived by the GridView API; see Q2) |
| App interactions | yes | yes | Analytics; Advertising or marketing; Fraud prevention, security and compliance |
| Crash logs | yes | yes | the same |
| Diagnostics | yes | yes | the same |
| Device or other IDs | yes | yes | the same, **plus Developer communications for collection only (Q1a)** |

**State F, final (2.0.0 only; `data-safety.md` §3.2). Ads: No.** Crash
logs, Diagnostics, Device or other IDs and App interactions: collected, not
shared, Analytics. Approximate location: collected, not shared, Analytics
from Firebase Performance Monitoring (Q2 does not establish an additional
API location purpose). No Developer communications: 2.0.0 has no messaging
SDK.

"Shared" on a type comes from the 1.x ads SDK. Firebase's part is not
sharing (Google processes it for GridView), but Play's form takes one answer
per type.

## 5. Questions the owner must now decide

Q-numbers follow `privacy-review-packet.md`. "Supported" means the evidence
and the guidance in §2 support the answer; it is not a legal opinion.

### Q1a. Data safety purpose for the 1.x FCM registration

**Exact question:** The draft already includes Device or other IDs for the
ads SDK. Must its collection purposes also cover the Firebase installation ID and registration
token that the FCM and Installations SDKs collect, and if so, which Play
purpose is accurate when no 1.x feature used them?

| Option | Assessment |
|---|---|
| **Add Developer communications to collection only (accepted for the 1.2.1 draft)** | The closest available option for why Firebase Messaging automatically registered the installation. Firebase describes the SDK purpose as enabling message delivery, and Play requires SDK collection to be reflected. Play's guidance does not explicitly address registration without any messages sent. The policy distinguishes registration from sending, and the purpose is dropped in state F |
| Add no purpose for FCM | Weaker. The form would show only the ads purposes for the type, leaving the FCM collection unexplained. Play's help does not address collected-but-unused data, and can act on an inaccurate form |
| Add App functionality | Not supported: no 1.x feature used the data |

The 2026-11-05 observation (§3.1) shows the automatic Messaging
registration on versionCode 7, without identifying the transmitted data.
It does not settle which purpose is accurate, or establish a legal basis.

**Status: accepted by the owner for the 1.2.1 draft on 2026-11-05.**
Select Developer communications for collection of device or other IDs
only, not for sharing. The state T draft carries this answer forward for
1.2.1 while it is distributed. This does not approve either submission or
settle Q1b or Q1c.

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
| **(a) Disclose the observed behavior (unpublished draft)** | Sections 3.4 and 4 explain automatic registration, no push notifications sent, no consent prompt for the registration, and removal of Messaging in 2.0.0. The factual text does not state a legal basis or resolve whether the processing was permitted |
| (b) Claim legitimate interests | Not supported by the facts. Rejected |
| (c) Stay silent | Leaves Article 13's legal-basis element unanswered for this processing. Not recommended |

Options (a) and (c) do not cure the past processing; only Q1c reduces it
from now on.

The 2026-11-05 observation (§3.1) confirms for versionCode 7 that the
processing took place; it does not supply a basis.

**Status:** open. The project has not identified a supportable basis on the
current evidence. Keep the policy unpublished under P2. Accepting the
factual wording alone does not close Q1b or approve publication.

### Q1c. Reducing the ongoing FCM processing

**Exact question:** Beyond disclosure, can the registration that installed
1.x copies keep running be stopped or shortened?

| Option | Assessment |
|---|---|
| Release 2.0.0 (removes the SDK on every device that updates) | Effective for API 24 and later. Devices on API 21-23 cannot update (2.0.0 minSdk 24) and keep registering until uninstalled |
| A Firebase project setting that stops 1.x registration | **Not found.** No documented setting was identified that stops 1.x's FCM registration without touching Firebase Installations, which 2.0.0's Crashlytics and Performance need (same Firebase Android app). Any candidate would need testing before use, and it is an external setting change |
| Delete the 1.x registrations and installation IDs | Not possible on the current facts: GridView never stored any identifier, and deletion needs the installation ID (`data-safety.md` R3). FCM expires a registration unused for 270 days; that covers uninstalled and abandoned copies only |
| A 1.x update for API 21-23 that removes the SDKs | The only route to devices that cannot install 2.0.0. The imported tree is not the 1.x build source (`data-safety.md` §3.5), it contradicts D-T1, and it keeps a 1.x build distributed. Not recommended |

**Mitigation recorded:** pause Alpha (done), do not retain versionCode 7 in
Production after the 2.0.0 rollout, and remove Messaging on upgrade. There
is no additional test or Firebase setting change planned. Existing 1.x
copies may still register; this does not close Q1b.

### Q2. R2, the complete processing scope of the API's IP handling

**Exact question:** Is the GridView API's handling of the IP address
ephemeral across its complete processing scope?

**Worker scope reviewed.** The code does not store the connection IP or
derive location from it. W3 saw no persisted event for the ordinary public
requests tested. Cloudflare's own platform handling and retention for this
Worker are not established by those checks (`data-safety.md` §3.4).

**Draft recommendation:** do not rely on the ephemeral exemption for
Cloudflare's full scope or claim the API collects Approximate location based
on routing alone. Keep the non-ephemeral Approximate location declaration for
Firebase Performance Monitoring. **Status:** the earlier conditional
acceptance (2026-11-02) does not settle Cloudflare's processing scope or
the final classification of any additional use.

### Q3. R8, a Data safety row for the API's persisted lines

**Exact question:** Do the API's persisted internal-error lines need a Data
safety row?

**Draft answer:** no extra row for the fields GridView writes. The
application payload omits request ID, IP address and device identifier.
The 2026-11-05 read-only production check found no stored error to inspect,
and the owner declined a separate error test. The public draft describes
only GridView's technical error logs; it makes no assurance about metadata
Cloudflare may add (`data-safety.md` §3.4). **Status:** recorded for the draft;
Cloudflare-added error metadata was not verified. This does not settle Q2
or approve submission.

### Q4. R6, 1.x ads requested with no consent message

**Mitigation done:** on 2026-11-05 the owner removed the seven remaining
GridView AdMob units and supplied a screenshot confirming the removal
(`data-safety.md` §3.6). The draft discloses that 1.x did not show a consent
prompt and installed copies may still request ads. The 2.0.0 upgrade removes
the SDK. Removal neither changes installed code nor validates past or
continuing processing. Keep the 1.x disclosures while that version remains
in distribution.

### Q5. §6.1, a geographic address

**Exact question:** Does any rule outside the privacy notice require the
controller to publish a geographic address?

**Rules reviewed; application to GridView remains open.** Keep the draft
privacy contact as email (C4). That does not decide separate obligations
under Play's trader and identity rules or Irish e-commerce rules
(`data-safety.md` §6.1). On 2026-11-05 the owner reported that Play Console
shows **Non-trader** (Spanish: **No operador**). This records the account's
current declaration; it does not determine whether separate address duties
apply. No address or declaration was changed. **Status:** Play account
status recorded; the separate address question remains open.

### Q6. The policy's wording on 1.x ads

**Draft text updated:** the policy records the date the remaining units
were removed and distinguishes ad serving from the requests that installed
1.x copies can still make. No additional evidence collection is planned
for this wording.

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
| **O1, current plan:** state 0 now, state T before 2.0.0 leaves internal testing, 20 % then 100 % rollout, state F | Uses the recorded Q1a answer for 1.2.1 | Keeps the staged rollout. Recommended |
| **O2, straight to F:** skip states 0 and T; with Alpha already paused, release 2.0.0 to 100 % with versionCode 7 not retained, and submit state F with it | Avoids answering Q1a on the form | Leaves the current "No data collected" form, already inaccurate for 1.2.1, in place until then, including during internal testing. It drops the staged rollout. It depends on Data safety being published with the release, which is not confirmed (§2). Not recommended |
| **O3, no state T:** state 0 now, then 2.0.0 straight to 100 % with state F | Shortens the period with 1.x rows | Uses the recorded Q1a answer for state 0. Drops the staged rollout for a form state that costs nothing to keep. Not recommended |
| **Alpha paused** (D-T2, done before P0) | The owner paused the track on 2026-11-05 (§3.2) | The form does not change because versionCode 7 remains in Production |

**Conclusion:** reordering cannot answer the legal-basis questions. It can
avoid the Data safety purpose question only by leaving a known-inaccurate
form live (O2). What actually reduces the processing is releasing 2.0.0, the
completed D-A removal, and the completed Alpha pause.

## 7. What waits on each decision

| Step | Waits on |
|---|---|
| P2, publish the policy | Draft text ready for review. The basis for legacy registration (Q1b) and any separate address duty (Q5) are not established. AdMob removal is recorded; it does not resolve any consent or legal-basis question for past or remaining legacy requests (Q4). Publication remains separate |
| P0, state 0 | P2 and submission approval; Q1a is recorded for the draft |
| P3, state T | P2 and submission approval; retain the Q2 scope limit and Q3 draft answer. No separate error test is planned |
| R7, state F | 100% rollout, D-T1 and no 1.x artifact distributed on a non-internal track. Alpha is already paused. Apply the Q2/Q3 scope limits |
| PR #82 merge, A0 privacy item | Every item in §5 decided and recorded in `data-safety.md` §4.1 |
