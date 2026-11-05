# Google Play Data safety — evidence for GridView 2.0.0

The answers below are what the reconstructed production app (`com.sejuma.gridview`,
versionName 2.0.0) does. Each one cites the evidence it rests on. They are the
**engineering input** to the Data safety form; the form is submitted in Play
Console by the owner after a privacy review. The review is needed because
classifying data for Play is a legal judgement, not an engineering one.

Prepared 2026-10-20 at `6aefcbf`. The transition sections (§1, §1.1-§1.4 and
§3.5) and the controller check (§6) were added the same day, before merge.
On 2026-10-21 the owner's controller and contact decisions were recorded
(§6), and §3.6 was added on ads that installed 1.x copies keep requesting.
On 2026-10-22 the API answers (§3.2-§3.4, R2, R8) were brought up to date
with master `ec19caf`. Production logging is now settled by ADR 0028 D8,
committed through PRs #85 and #86, so the earlier keep-or-disable choice
(D-L) no longer applies. Later on 2026-10-22 (master `e3c9f0f`) the Play
bundles for versionCodes 7 and 2 were inspected. They replace the imported
source tree as the 1.x evidence and show that 1.x also starts Firebase Cloud
Messaging (§3.5). The deletion question R3 was settled on the facts, and the
policy no longer promises deletion (§3.1, R3). Later still on 2026-10-22,
R9 was reworked as an evidence question. The bundles were read again for
notification code, the owner's statement on notifications was recorded, and
§3.6 now separates what the uploaded builds show from what only the imported
tree shows. R9 is now a privacy-review blocker, not an owner choice (§4).
Last on 2026-10-22 (master `8347adf`), §3.4, R2 and R8 record that W3
deployed and verified the production logging settings, and §3.5 and §4.2
record a read-only check of the Firebase Messaging campaign history, kept
separate from the owner's statement. On 2026-10-23 (master `eeca9bf`) four
owner decisions were recorded: D-A (archive the 1.x ad units before AU-7),
D-DEL (no in-app deletion control), C4 (email stays the only contact
channel) and AU-D3 (the policy's wording on the API's records). R4 is
recorded as a technical fact, and R5 was checked against archived copies of
Google's disclosure for SDK 23.6.0 (§3.5). These decisions do not answer R1,
R2, R5, R8 or R9, which stay open for the privacy review (§4, §4.1). Later
on 2026-10-23 the R5 crash-logs omission was closed on the engineering side.
The 23.6.0 disclosure names crash logs, and Play defines Crash logs as a
separate type. So states 0 and T gain a 1.x Crash logs row, and the policy's
1.x list names crash logs (§3.5). This was a recommendation awaiting the
owner's final sign-off.
On 2026-11-02 the owner's acceptances were recorded (§4, §4.1): R1 for the
draft, R5 including Crash logs, R8 for Firebase Sessions, and R2
conditionally, with confirmation of the complete processing scope still
open. R9, R6's remediation and the geographic-address question (§6.1) stay
unresolved.
On 2026-11-05 (master `d2d6df9`) two sections were brought up to date
without changing any answer. §3.4 records a re-check of the API's logging
since W3. §3.6 and §4.1 record the read-only AdMob inspection of
2026-11-04, which found the 1.x AdMob account and its units. The open
review questions and their evidence are collected for the reviewer in
`privacy-review-packet.md`.
Last on 2026-11-05, §3.5 and §4.2 record an emulator observation of the
Play-signed versionCode 7 APK: on a clean first launch, Firebase Messaging
initiated registration automatically and Google Play services logged
success. It replaces "inferred, not observed" for versionCode 7 only;
versionCode 2 was not tested. §1.2 records the owner's Play Console
screenshots of the same day. No answer, purpose or legal-basis question
changed.
Later on 2026-11-05 the owner recorded D-T1 (versionCode 7 is not
retained), D-T2 (the Alpha track is paused as part of the release plan)
and Ireland as the intended Play listing country, and kept D-A: the seven
active ad units are archived once the AdMob account's verification clears
(§1.4, §3.6, §4.1, §6.2). None of these steps is done, and none of them
answers a review question.
Also on 2026-11-05 the owner decided that no external legal or privacy
review will be commissioned, that 2.0.0 keeps Crashlytics and Performance
Monitoring, and that it ships no push notifications. The open items are
now the owner's decisions, set out with their options in `privacy-self-assessment.md`.
That change settles none of them. The 1.x FCM row now has a proposed
purpose, Developer communications, awaiting the owner's acceptance
(§3.5, §4).

## 1. Why the current declaration must change

The live listing declares **"No data collected"** and **"No data shared"**
(public listing, read 2026-10-20).

- **Wrong for 1.2.1 today.** Version 1.2.1 shows Google AdMob banners on every
  page. It initializes the Google Mobile Ads SDK at startup, and that SDK
  collects and shares data. It also starts Firebase Cloud Messaging, which
  sends a Firebase installation ID to Google (§3.5).
- **Wrong for 2.0.0.** It packages Firebase Crashlytics and Performance
  Monitoring and activates them in production builds
  (`../technical/GridView_Observability.md` §4, §7). Version 2.0.0 contains no
  advertising SDK (ADR 0018).

The **"Contains ads"** label is correct for 1.2.1. It may be removed only once
no 1.x build is distributed (§1.2).

### 1.1 Play's rule: the form covers every distributed version

Play Console Help, *Provide information for Google Play's Data safety section*
(support.google.com/googleplay/android-developer/answer/10787469, read
2026-10-20), says:

> "Your Data safety section describes the sum of your app's data collection and
> sharing across all its versions currently distributed on Google Play",
> "including apps on closed, open, or production testing tracks".

- Only apps active exclusively on the internal track are exempt.
- The only artifacts that may be excluded are those whose effective target SDK
  is below 21. Neither 1.x build qualifies.
- Data collected through third-party SDKs counts, and so does data sent to a
  third party through an SDK that builds advertising profiles.

### 1.2 What is distributed during the move to 2.0.0

| Artifact | Track (Play Console, read 2026-10-20) | minSdk | Data practices |
|---|---|---|---|
| versionCode 7, 1.2.1 | Production, full rollout | 21 | Google Mobile Ads SDK; Firebase Cloud Messaging and Installations; Unity Ads packaged, never started (§3.5) |
| versionCode 2, 1.0.0 | Closed testing "Alpha" | 21 | Inspected 2026-10-22: the same Google Mobile Ads and Firebase SDKs as versionCode 7, and no Unity Ads (§3.5) |
| versionCode 8, 2.0.0 | not yet uploaded | **24** (Flutter 3.44 default, `flutter.minSdkVersion`) | Firebase (§3.2) |

**Confirmed 2026-11-05 from the owner's Play Console screenshots** (kept by
the owner, not in this repository): Production shows 1.2.1 (versionCode 7)
available on Google Play, and closed testing "Alpha" shows 1.0.0
(versionCode 2) as active and available to selected testers. So versionCode 2
is distributed today, and states 0 and T cover it until the Alpha track is
paused (D-T2).

1.x builds stay distributed in any of these cases:

- a **staged rollout** of 2.0.0 below 100%, which keeps serving versionCode 7
  to the rest;
- versionCode 7 **retained** in the 2.0.0 production release, for Android 5.0
  to 6.0 (API 21 to 23) devices that cannot install 2.0.0;
- the closed "Alpha" track still serving versionCode 2.

### 1.3 Three declaration states

| State | When | Data safety | Ads declaration |
|---|---|---|---|
| **0 - now** | Only 1.x is distributed (today) | §3.5 only (1.x: AdMob and Firebase Cloud Messaging) | **Yes** |
| **T - transition** | From its submission, just before 2.0.0 first reaches a non-internal track (closed, open or production), until no 1.x artifact is distributed on any non-internal track | The **union**: §3.2 (2.0.0, Firebase) **plus** §3.5 (1.x: AdMob and Firebase Cloud Messaging) | **Yes** |
| **F - final** | 2.0.0 is the only distributed build: rollout at 100%, versionCode 7 not retained, Alpha closed or replaced | §3.2 only | **No** |

### 1.4 Order of the store steps

None of these steps is done; each is a separate, owner-authorized Play Console
or publishing step.

0. **The Alpha build: done 2026-10-22.** versionCode 2 was downloaded
   read-only from the App bundle explorer and inspected (§3.5). It has the
   same ads and Firebase SDKs as versionCode 7 and no Unity Ads, so the
   policy's section 3.4 and §3.5 here are true of it. Steps 1 and 2 no
   longer wait on it. Pausing the Alpha track (D-T2) was decided by the
   owner on 2026-11-05; it shortens state T.
1. **Publish the transition policy** (`privacy_policies.md` and `.html` in this
   PR) at https://gridview.netlify.app. It covers 1.x (section 3.4) and 2.0.0.
   Publish it **before** the 2.0.0 Data safety change and before the release is
   submitted. The 2.0.0-only draft must never replace the live page while 1.2.1
   is distributed, because 1.2.1 would then point at a policy that does not
   describe its ads.
2. **Correct the live form now (state 0).** The live "No data collected" is
   already inaccurate for 1.2.1, so declare §3.5 with Ads **Yes**. This does
   not depend on 2.0.0 or on the production Worker.
3. **Submit state T** before 2.0.0 reaches any non-internal track (closed,
   open or production). State T includes the 2.0.0 API answer (§3.4), so it
   also waits until the deployed production Worker's persisted logs are
   verified free of app traffic (§3.4).
4. **Release 2.0.0.** Owner decision D-T1 (2026-11-05): do **not** retain
   versionCode 7. The legacy backend is dead, so on API 21 to 23 1.2.1 can show
   ads but no Formula 1 data. Pause the closed "Alpha" track (owner decision
   D-T2, 2026-11-05).
5. **Once the rollout reaches 100%** and no 1.x artifact remains on any
   non-internal track, submit Data safety in state F and set Ads to **No**.
6. **Keep section 3.4 in the policy.** Devices that never update still run 1.x
   (policy §9).

## 2. Evidence sources

| Source | What it shows |
|---|---|
| `../technical/GridView_Observability.md` §2, §7 | Packaged Firebase components; what GridView adds to reports; what Firebase may process |
| `android/app/build.gradle`, `verify<Variant>FirebaseDependencies` | Resolved set: Crashlytics, Performance, Remote Config, ABT, Installations, Sessions. Forbidden and absent: Analytics, measurement, ads, ads-identifier, Messaging, Auth, Crashlytics NDK |
| Google Mobile Ads SDK, *Google Play's data disclosure requirements* (developers.google.com/admob/android/privacy/play-data-disclosure): Internet Archive captures `web.archive.org/web/20250108231607/` and `web.archive.org/web/20250211162031/` of that URL, and the live page read 2026-10-23 | Both captures say the page lists the data of "only the latest version (version 23.6.0)" of the SDK. The live page covers 25.5.0 of the "Google Mobile Ads SDK (Legacy)" (§3.5, R5) |
| Google Mobile Ads SDK for Android, release notes (developers.google.com/admob/android/rel-notes, read 2026-10-23) | 23.6.0 was released on 2024-12-03 and 24.0.0 on 2025-02-24, so 23.6.0 was the latest version when both captures were taken. 23.6.0's notes say nothing about data collection (R5) |
| Firebase, *Prepare your app for Google Play's Data safety section* (https://firebase.google.com/docs/android/play-data-disclosure, updated 2026-10-16) | Per-SDK data, purposes, HTTPS in transit, Performance's IP-to-country use |
| Firebase, *Privacy and Security in Firebase* (https://firebase.google.com/support/privacy, updated 2026-10-14) | Retention: Crashlytics 90 days; Performance 60 days (IP-linked events 30); installation IDs until deleted; Google acts as processor |
| Production-flavor profile APK built at `6aefcbf` (`aapt2 dump permissions`) | Permissions: `INTERNET`, `ACCESS_NETWORK_STATE` and the app's own non-exported receiver permission. No `AD_ID`, location, contacts, storage or camera permission |
| `lib/core/network/gridview_dio.dart` | API requests carry `Accept` and a random per-request `X-Request-Id`; no user or device identifier |
| `android/app/src/main/AndroidManifest.xml` | No `usesCleartextTraffic` or network-security override, so cleartext HTTP is blocked (target SDK 36) |
| `lib/core/legacy/`, `../technical/GridView_Preferences_And_Settings.md` | Preferences and the content cache stay on the device |
| Play bundles, versionCodes 7 and 2 (App bundle explorer, original uploads, read 2026-10-22) | What 1.x really ships (§3.5) |
| Firebase, *Manage Firebase installations* (https://firebase.google.com/docs/projects/manage-installations, updated 2026-10-22) and the Admin SDK `Installations.deleteInstallation` reference | Deleting an installation ID and its data; the 180-day removal (R3) |
| Crashlytics REST API, `projects.apps.users.deleteCrashReports` (v1alpha) | Crash-report deletion by a Crashlytics **user ID** only (R3) |
| Firebase, *Set up a Firebase Cloud Messaging client app on Android* (https://firebase.google.com/docs/cloud-messaging/android/client, updated 2026-10-22) | FCM auto-initialization uploads "the identifier and configuration data to Firebase" (§3.5) |
| `firebase-messaging` 24.1.0 `.aar` from Google's Maven repository, its `AndroidManifest.xml` | The SDK itself declares `POST_NOTIFICATIONS`, `WAKE_LOCK` and `c2dm.permission.RECEIVE` (§3.5) |
| Play Console Help, *Provide information for Google Play's Data safety section* (support.google.com/googleplay/android-developer/answer/10787469, read 2026-10-22 and 2026-10-23) | The purpose definitions used for R9: App functionality is "Used for features that are available in the app"; Developer communications is "Used to send news or notifications about the app or the developer". The data types used for R5: Crash logs is "Crash log data from your app. For example, the number of times your app has crashed, stack traces"; Diagnostics is "Information about the performance of your app. For example battery life, loading time, latency, framerate". Collection includes data "transmitted off device from your app by libraries and/or SDKs used in your app" |
| Emulator check, 2026-11-05: `fcm-1x-registration-check-2026-11-05/` in the owner's evidence store (redacted logcat excerpt; manifest `SHA256SUMS` = `235a973825fb5094c33459f49b5689c03913fb4c3bc34034e1708bb4bb331554`) | One clean first launch of the Play-signed versionCode 7 APK on an Android 16 (API 36) emulator with Google Play services, no Google account, installed by adb. What it observed and its limits are in §3.5 |
| Owner statement, 2026-10-22 | No push-notification feature was implemented, and no push notification was sent to 1.x users. Firebase was configured, but FCM was not intentionally used for any feature (§3.5) |

## 3. Proposed answers

### 3.1 Overview questions

| Question | Proposed answer | Basis |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Firebase collects the types in §3.2 |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | Firebase sends over HTTPS; the GridView API is HTTPS-only and cleartext is blocked by the platform |
| Do you provide a way for users to request that their data is deleted? | **No.** The owner decided on 2026-10-23 not to add an in-app deletion control (D-DEL, R3) | No verified way exists to identify and delete one installation's Firebase data (R3). The policy no longer offers deletion. It says that one installation's Firebase data cannot currently be found or deleted (policy section 6) |

### 3.2 Data types

Every row is: **collected** = yes, **shared** = no (Google processes it as GridView's
service provider, which Play does not count as sharing), **processed
ephemerally** = no, **required** (the user cannot turn it off in the app).

| Play category → type | Source | Purpose |
|---|---|---|
| App info and performance → **Crash logs** | Crashlytics stack traces and app state at crash | Analytics |
| App info and performance → **Diagnostics** | Performance Monitoring (start time, trace durations, CPU and memory); Sessions metrics | Analytics |
| Device or other IDs → **Device or other IDs** | Firebase installation ID; Crashlytics installation UUID | Analytics |
| Location → **Approximate location** | Performance Monitoring maps IP addresses to countries. The GridView API also receives the IP address with each request, to serve it; that part is ephemeral (§3.4), but Firebase's part is not, so the type as a whole is not | Analytics; **App functionality** (the API) — **R1 accepted for the draft; R2 conditionally accepted (§4.1)** |
| App activity → **App interactions** | Firebase Sessions records when the app is foregrounded to start a session ("application metrics", Firebase disclosure). The API's persisted logs add nothing here (§3.4) | Analytics — **R8 accepted for Sessions (§4.1)** |

"Analytics" is Play's purpose for monitoring app performance and diagnosing
problems. GridView uses this data for nothing else.

### 3.3 Not collected (2.0.0)

Personal info (name, email, user IDs, address, phone), financial info, health
and fitness, messages, photos and videos, audio, files and documents, calendar,
contacts, web browsing, and precise location. Of **app activity**, only the
session start is collected (§3.2). The API keeps no record of the app's
requests (§3.4). There is no screen-view, tap or search analytics,
and the build forbids the Analytics SDK.

### 3.4 GridView API traffic

Requests to the GridView API (Cloudflare Workers) expose the device IP address
to Cloudflare, as any network request does. GridView does not store or use it
beyond serving the request, so this is ephemeral processing (**R2,
conditionally accepted, with the complete processing scope still to be
confirmed; §4.1**). It holds only while no persisted record carries the IP
address or anything that links a request to an installation.

**What production persists (ADR 0028 D8, deployed and verified in W3 on
2026-10-22).**
`services/edge-api/wrangler.toml` `[env.production.observability]` has
`enabled = true` and `logs.persist = true`, with
`logs.invocation_logs = false`. Cloudflare's automatic invocation records,
which carry request metadata, are therefore off. Only the Worker's own lines
persist, for Cloudflare's 7-day retention. `src/logging/request-log.ts`
restricts those lines in production:

- A **public request the Worker answers** writes **no line**, whatever the
  status (`200`, `304`, `404`, `503` and so on). That covers all ordinary app
  traffic.
- A public request that hits an **unexpected internal error** (`500`) writes
  `request.failed`. The line holds the route template where known
  (otherwise `unknown`), the status, the duration and a closed failure
  category (`configuration` or `internal`). It holds **no request ID**: the
  app receives that ID and could keep it with a crash report. It also holds
  no IP address, header or device identifier.
- **Internal (operator) requests** keep both lines. An unauthenticated or
  unrouted internal request is logged as `/internal/*`, so no client-chosen
  path text is persisted.
- A caller's `X-Request-ID` is adopted only as an opaque token
  (`[0-9A-Za-z-]{1,64}`), so no free text reaches a response or a line.

**Consequence for the form.** No persisted line can be linked to a user, a
device or an installation, so the Worker's logs add no Data safety row (ADR
0028 D8). An internal-error line's route template is operational data about
the service and is not collected about the user (**review item R8**).

**Conditions before submitting state T or F.** State 0 (1.x only) does not
include this answer.
- The deployed version must carry these settings, and a Workers Logs query
  after a few public requests must show no invocation record and no line for
  those requests.
- **Done for W3 on 2026-10-22** (release plan W3): version `62bf40e9…`, in
  the bootstrap configuration, shows logs persisted with
  `invocation_logs = false`, and the dashboard's Workers Logs held no event
  for the public requests sent after the deploy. This is an engineering
  check. It did not approve the policy's wording; the owner accepted that
  wording separately on 2026-10-23 (AU-D3).
- The AU-7 deploy replaces that version, so AU-7 repeats both checks on its
  own version.
- **Re-checked in the code on 2026-11-05 at master `d2d6df9`** (no live
  check):
  - `src/logging/request-log.ts` is unchanged since W3's `8347adf`, so
    public requests still write no line.
  - Since then, the only new log lines come from two staging-only operator
    routes (`provider.egress_identity`, `provider.calendar_single_get`).
  - The existing provider lines gained bounded fields about Jolpica's
    answers: cache status, colo, ray, and a fingerprint of a `429`
    (header names from a fixed list, a title class, a body length and
    digest).
  - Those lines are written only in operator or scheduled runs, never for an
    app request, and carry no client value.
  - Workers Traces, which would record each request, are pinned off for
    staging and production in `wrangler.toml` (PR #101; live as
    `enabled: false` since W3).
  - Nothing in R2 or R8 changes.
- If production ever persists an IP address, a header, a public request's
  ID or a line per public request, revisit this section and §3.2 (R2, R8).

A live `wrangler tail` session, opened by the operator, streams request
metadata in real time and stores nothing. That is also ephemeral processing.
The release plan's W3 step notes that tail cannot prove what is persisted.

### 3.5 Versions 1.x (states 0 and T)

**Evidence: the Play bundles.** On 2026-10-22 the original uploads of
versionCode 7 (1.2.1, uploaded 2025-04-19) and versionCode 2 (1.0.0, uploaded
2025-03-04) were downloaded read-only from Play Console's App bundle explorer.
They were inspected without being installed or run:

- the dependency metadata
  (`BUNDLE-METADATA/com.android.tools.build.libraries/dependencies.pb`);
- the base manifest and resources;
- the strings and Flutter plugin channels in the Dart snapshot (`libapp.so`).

| | versionCode 7 (1.2.1) | versionCode 2 (1.0.0) |
|---|---|---|
| `.aab` SHA-256 | `560f5634…e3cd` | `1ef7d378…e9cf` |
| min / target SDK (Play Console) | 21 / 35 | 21 / 35 |
| Google Mobile Ads SDK | `play-services-ads` 23.6.0; seven banner ad unit IDs (§3.6) | 23.6.0; two ad unit IDs, one of them not among versionCode 7's seven (§3.6) |
| AdMob app ID (manifest) | `ca-app-pub-4763306780710624~5227286262` | the same |
| Consent SDK | User Messaging Platform 3.1.0, packaged by the ads plugin, never called | the same |
| Firebase | Cloud Messaging 24.1.0 and Installations 18.0.0 (BoM 33.9.0); project `gridview-fb20f`, the same Android app as 2.0.0's production `google-services.json` | the same |
| FlutterFire plugins | Android side only of `firebase_core` and `firebase_messaging` (classes in `classes.dex`, components in the manifest); no Dart side | the same |
| Notification permission | `POST_NOTIFICATIONS`, merged from the `firebase-messaging` manifest | the same |
| Unity Ads | 4.14.1, never started | absent |
| Ads permissions | `AD_ID`, `ACCESS_ADSERVICES_AD_ID`, `ACCESS_ADSERVICES_ATTRIBUTION`, `ACCESS_ADSERVICES_TOPICS` | the same |

**What they do.**

- **Ads.** The Dart snapshots use the ads plugin's channel, alongside
  `shared_preferences`, `url_launcher` and `path_provider`. Neither contains
  `ConsentInformation` or `ConsentRequest`. versionCode 2's snapshot is not
  obfuscated. It lists the ads plugin's `mobile_ads.dart`, `ad_containers.dart`
  and `request_configuration.dart`, and no consent source. So the consent SDK
  ships but is never called, and no consent message is shown.
  - versionCode 7's snapshot is obfuscated, so its call order cannot be read.
    The launch-time `MobileAds.instance.initialize()` (§3.6) comes from the
    imported tree.
- **Firebase Cloud Messaging.** Both manifests register `FirebaseInitProvider`,
  and the resources carry the `gridview-fb20f` values (`google_app_id`,
  `gcm_defaultSenderId`, `google_api_key`, `project_id`). The default Firebase
  app therefore starts with the process.
  - firebase-messaging 24.1.0 registers `FirebaseMessaging` as an always-eager
    component. This was checked in `FirebaseMessagingRegistrar`, in Google's
    published 24.1.0 artifact.
  - Neither manifest turns off `firebase_messaging_auto_init_enabled`.
  - So the SDK obtains a Firebase installation ID and an FCM registration
    token. Firebase's client guide says: "When a FCM registration is
    generated, the library uploads the identifier and configuration data to
    Firebase."
  - **Correction (2026-10-22, second reading).** The Android side of the
    FlutterFire `firebase_core` and `firebase_messaging` plugins is packaged.
    Both manifests register `FlutterFirebaseMessagingInitProvider`,
    `FlutterFirebaseMessagingService` (for `com.google.firebase.MESSAGING_EVENT`),
    `FlutterFirebaseMessagingReceiver` (for `c2dm.intent.RECEIVE`) and
    `FlutterFirebaseMessagingBackgroundService`. The earlier reading said only
    that no Dart code uses Firebase, which is still true: neither snapshot has
    a Firebase plugin channel, and versionCode 2's lists no `package:firebase_*`
    source. So the plugins were declared in the build, and the Dart compiler
    dropped their unused Dart code.
  - **Observed for versionCode 7 (2026-11-05).** One clean first launch of
    the Play-signed 1.2.1 APK (versionCode 7) on an Android 16 emulator
    with Google Play services, no Google account, nothing tapped and no
    registration call made by the tester:
    - Firebase started, and 60 ms later the app logged
      `FirebaseMessaging: Making new request for: <sender ID>`.
    - Google Play services logged a register request for
      `com.sejuma.gridview`, then `SUCCESSFUL`, the only response it
      logged before its next request.
    - The app exited about 2.4 s after launch, at Google Play's licence
      check for a copy not installed from Play, before it received the
      reply.
    - No notification was sent. The test did not capture what data was
      transmitted: the identifiers named in this section come from
      Firebase's documentation and the packaged SDKs, not from the test.
    - Evidence: `fcm-1x-registration-check-2026-11-05/` in the owner's evidence store (redacted logcat excerpt; manifest `SHA256SUMS` = `235a973825fb5094c33459f49b5689c03913fb4c3bc34034e1708bb4bb331554`).
  - **Not tested for versionCode 2.** It packages the same SDK versions, so
    the same behaviour is expected, but for it this remains inferred from
    the packaged SDKs and their documented behaviour.

**Notifications in 1.x.** The question is whether 1.x ever offered or used
notifications.

- **Observed in the bundles:**
  - The notification capability is packaged: the FCM service and receiver
    above, and `POST_NOTIFICATIONS`. The permission comes from the
    `firebase-messaging` 24.1.0 manifest, not from GridView's own manifest
    (see the sources table).
  - No GridView code uses it. Neither Dart snapshot reaches Firebase. Both
    package an unused `assets/images/icons/notifications.png`: the snapshots
    reference every other Settings icon path, but not this one.
  - The other `notification` strings in the snapshots are Flutter framework
    names (`NotificationListener`, `ChangeNotifier`'s "while dispatching
    notifications for"). There is also one bare "notifications" string whose
    source could not be attributed. Neither snapshot has a notification
    plugin channel.
- **Observed in the imported tree** (`f8a0ad4`, not the build source):
  - `lib/pages/settings_page.dart` has a "Notifications" Settings button with
    that icon, commented out. Its handler opened the updates dialog, not a
    notification setting.
  - `frontend/.firebaserc` names a second Firebase project ID,
    `notificationsgridview`, as its CLI default. Nothing in the bundles refers
    to it. The bundles use `gridview-fb20f`.
- **Owner statement (2026-10-22):**
  - "I never implemented a push-notification feature and never sent push
    notifications to 1.x users."
  - Firebase was configured in the project, but FCM was not intentionally
    used for an app feature.
- **Observed in the Firebase console (read-only, 2026-10-22, separate from
  the owner statement):**
  - `gridview-fb20f`, Messaging → Campaigns: the page opens on the
    first-campaign onboarding screen ("create your first campaign"). The
    console lists no campaign, so none was ever composed there.
  - `gridview-fb20f`, Messaging → Reports, Notification and All views, last
    90 days (2026-07-24 to 2026-10-22): no sent, received, impression or open
    data. The console offers no range longer than 90 days.
  - The signed-in Google account that can open the console lists only
    `gridview-fb20f`. For it, `notificationsgridview` does not exist or is
    not visible. The other signed-in account was stopped by Firebase's
    multi-factor enrolment requirement and was not used.
- **Not checked:**
  - Sends before 2026-07-24, and sends through the FCM HTTP API or an Admin
    SDK rather than a console campaign. Neither appears in the console views
    above.
  - `notificationsgridview`, from an account that can see it, if one exists.
- **Inferred, not tested:**
  - Had a notification campaign been sent from `gridview-fb20f`, the packaged
    FCM service would have displayed it while the app was in the background.
  - On Android 13 and later, a target-SDK-35 app shows notifications only after
    the user grants `POST_NOTIFICATIONS`. 1.x code never asks, so those
    devices would show nothing unless the user enabled notifications in
    Android settings.
  - On Android 12 and earlier, the permission is granted at install.
- **Conclusion:**
  - 1.x offered no notification feature. Its code never used FCM.
  - The SDK's automatic registration ran with no feature using it. For
    versionCode 7 this was observed on 2026-11-05: registration was
    initiated at first launch, and Google Play services logged success.
    For versionCode 2 it is inferred from the same packaged SDKs. What
    was transmitted was not captured; per Firebase's documentation it
    involves a Firebase installation ID, and Google issues a registration
    token for the installation.
  - "No notification was ever sent" rests on the owner's statement. The
    console is consistent with it: no campaign was ever created in
    `gridview-fb20f`, and no message was sent in the last 90 days. The
    console cannot show API sends or older reports, so it does not prove the
    statement.
- **Unity Ads (versionCode 7 only).** Its AndroidX Startup initializer,
  `AdsSdkInitializer`, runs at launch. In 4.14.1 it records the application
  context and start time and installs the Play services Cronet provider. The
  Dart snapshot has no Unity channel, so Unity Ads itself is never
  initialized.
- **Railway.** Both snapshots hold the dead `f1connectbackend-production`
  URLs.

**The imported tree is not the source of these builds.** Its `pubspec.lock`
pins google_mobile_ads 7.0.0 (published on pub.dev 2025-12-16) and
unity_ads_plugin 0.3.30 (2026-03-17), both later than the uploads. It also
declares no Firebase package. Earlier drafts of this section relied on it,
and the facts above replace it.

The Google Mobile Ads SDK disclosure
(developers.google.com/admob/android/privacy/play-data-disclosure) lists four
kinds of data as **collected and shared automatically** for advertising,
analytics and fraud prevention, all encrypted in transit. The page covers
only the SDK's latest version. The rows below therefore rest on two
Internet Archive captures of the page taken while 1.x's version, 23.6.0, was
the latest release (R5, below the tables). Its "Diagnostic information" maps
to two Play types, Crash logs and Diagnostics. State 0 declares these rows,
and state T adds them to §3.2:

| Play category → type | Collected | Shared | Purposes |
|---|---|---|---|
| Location → **Approximate location** (IP address) | yes | **yes** | Advertising or marketing; Analytics; Fraud prevention, security and compliance |
| App activity → **App interactions** | yes | **yes** | the same |
| App info and performance → **Crash logs** | yes | **yes** | the same |
| App info and performance → **Diagnostics** (app launch time, hang rate, energy usage) | yes | **yes** | the same |
| Device or other IDs → **Device or other IDs** (advertising ID, app set ID) | yes | **yes** | the same |

Firebase Cloud Messaging adds this row:

| Play category → type | Collected | Shared | Purposes |
|---|---|---|---|
| Device or other IDs → **Device or other IDs** (Firebase installation ID, FCM registration token) | yes | no (Google processes it for GridView) | **Proposed 2026-11-05: Developer communications**, the purpose Firebase states for the SDK's data ("to send messages to the client app"). Not yet accepted by the owner; the alternative is open (`privacy-self-assessment.md` Q1a) |

- These rows are **required**: 1.x has no switch, and it starts the SDK before
  showing anything. They are **not processed ephemerally**: Play says data
  used to build advertising profiles cannot be.
- Where a type is already declared in §3.2 (Approximate location, Crash
  logs, Diagnostics, Device or other IDs), state T marks it **shared**, adds
  the advertising and fraud purposes, and keeps Analytics. For Crash logs,
  2.0.0's Crashlytics row is not shared; the 1.x ads SDK's crash logs are.
- **App activity → App interactions** is also declared for 2.0.0 (Firebase
  Sessions, §3.2). State T marks it **shared** and adds the advertising and
  fraud purposes.
- In state T, "Is all user data encrypted in transit?" stays **Yes** (TLS for
  both SDKs, HTTPS to the API).
- The Firebase row adds no new type, because Device or other IDs is already
  declared, as shared, for the ads SDK. Play's form takes purposes per data
  type, not per SDK. So R9 asks whether that type's purposes must also cover
  the FCM registration, and if so, which purpose is true. It does not ask
  whether to declare the type.
- **R5, the SDK version (checked 2026-10-23).** Both bundles ship
  `play-services-ads` 23.6.0. Google released it on 2024-12-03 and 24.0.0 on
  2025-02-24 (SDK release notes). Two Internet Archive captures of the
  disclosure page fall in that window, 2025-01-08 23:16Z and 2025-02-11
  16:20Z, and their text is identical. Both say the page lists "the
  end-user data collected by only the latest version (version 23.6.0)" of
  the SDK. Both list the same four kinds of data, for advertising,
  analytics and fraud prevention, encrypted in transit with TLS. The live
  page (read 2026-10-23) covers 25.5.0 of the "Google Mobile Ads SDK
  (Legacy)". Apart from the product name, it differs in one example only.
  The saved copies were re-hashed on 2026-10-23 and match the SHA-256 values
  recorded when they were downloaded.
  - **Crash logs (accepted by the owner, R5, §4.1).** For 23.6.0,
    "Diagnostic information" "Collects information
    related to the performance of your app and the SDK, including crash
    logs, app launch time, hang rate, and energy usage". The live page no
    longer names crash logs, but 1.x ships 23.6.0. Play defines **Crash
    logs** as "Crash log data from your app" and **Diagnostics** as
    "Information about the performance of your app". So the crash logs map to
    App info and performance → Crash logs, and the rest of that entry (app
    launch time, hang rate, energy usage) to Diagnostics. The same section
    says the SDK "collects and shares" every listed type "automatically for
    advertising, analytics, and fraud prevention purposes". The Crash logs
    row above therefore carries collected, shared, those three purposes and
    TLS in transit, like the other ads rows. The policy's 1.x list
    (section 3.4) now names crash logs too.
  - **What the evidence is.** These are archived copies of Google's
    published disclosure for its SDK, taken by the Internet Archive while
    23.6.0 was current. They are not a Google document dated for that
    version, and they are not an observation of what 1.x sends: no 1.x
    traffic was captured. The bundles confirm the SDK and its version
    (§3.5). Nothing found contradicts the disclosure, and no implementation
    detail of 1.x is unresolved for these rows, so a traffic capture is not
    a prerequisite. 23.6.0's release notes say nothing about data collection
    either way.

### 3.6 Ads that installed 1.x copies keep requesting

Stopping **distribution** of 1.x on Play does not stop **installed** 1.x
copies from requesting ads. These Play steps change only what Play serves to
new installs and updates:

- pausing the Alpha track;
- not retaining versionCode 7 in the 2.0.0 release;
- unpublishing the app.

**What the uploaded builds show (observed).**

- **versionCode 7 (1.2.1):**
  - The Dart snapshot holds exactly seven ad unit IDs. They are the same
    seven that the imported tree's `lib/services/ad_provider.dart` hard-codes.
  - It also holds that file's two log literals, `" banner loaded"` and
    `" banner failed to load: "`, and `loadBannerAd`.
  - The snapshot is obfuscated, so which code calls these, in what order and
    how often cannot be read.
- **versionCode 2 (1.0.0):**
  - The snapshot holds two ad unit IDs, not seven: `/8267618237`, which
    versionCode 7 also uses, and `/8806674289`, which it does not (D-A
    inventory below).
  - Its unobfuscated names show a separate `_loadBannerAd` in four libraries
    and a `_loadAds` in one. This looks like banners loaded page by page.
    It does not match versionCode 7's splash-time sequence.
- **Both bundles:**
  - Neither has a Remote Config SDK or a consent call.
  - Both reach only the dead Railway URLs for data.

**What only the imported tree shows** (`f8a0ad4`, read as
`git show 7524998^:<path>`). It is not the source of either upload (§3.5): it
pins `google_mobile_ads` 7.0.0, published after both uploads. So the following
is an inference for versionCode 7, consistent with its strings but not
confirmed by them:

- `lib/main.dart` calls `MobileAds.instance.initialize()` on every launch,
  before the first frame, with no condition.
- `lib/pages/splash_page.dart` then loads the data and the ads in sequence.
  `GrandPrixProvider.fetchGrandsPrix()` catches every error, so the dead
  Railway server does not stop the next steps. Each cold start then requests
  the standings banner, and the six other banners in the background: seven
  banner requests per cold start.
- Each request is a plain `AdRequest()`. There is no `RequestConfiguration`
  and no consent code.

**What the wording may say.** That 1.x requests ads from Google's SDK at
launch and keeps doing so is supported. The Google Mobile Ads SDK and its
init provider ship in both builds, no switch exists, and versionCode 2 is
plainly page-driven. "Seven banner requests on every cold start" is an
inference for versionCode 7 only. It is not a fact about 1.x, and it is
wrong for versionCode 2. No policy text uses the figure.

**Consequence.** Nothing GridView controls, in the app or on a server, can
switch the ads off in an installed 1.x copy. The Firebase registration
(§3.5) also continues until the copy is updated or uninstalled. That traffic
goes to GridView's own Firebase project. Whether a project setting could stop
it without affecting 2.0.0, which uses the same project and Android app, was
not evaluated. Ad requests from a device end
only when it updates to 2.0.0 or the app is uninstalled. Devices on API 21
to 23 cannot update (2.0.0 has minSdk 24), so they keep requesting until the
app is uninstalled.

**What will stop ad serving** (owner decision **D-A**, accepted on
2026-10-23: archive the 1.x ad units before automatic production publication,
AU-7, accepting that it irreversibly ends 1.x ad revenue). The archiving
itself is a separate AdMob operation. It has not been done, and no AdMob
change was made. The current state of the account is in the read-only
inspection below:

- **Archive (remove) the 1.x ad units in AdMob.** Google's AdMob blog,
  *Archiving ad units* (2017-01-12), says "all ad serving and settings
  associated with the ad unit will be disabled". It is permanent, and Google
  recommends it for "legacy apps" that cannot be updated. The current AdMob
  interface may call it "remove", so check the current help before acting.
- **Before archiving**, check in AdMob (read-only) that these units belong
  only to GridView 1.x and that no other app uses them (the steps are in
  the D-A inventory below).
- **Effect:** banners stop showing, and 1.x ad revenue ends. 2.0.0 contains
  no ads code, so it is not affected.
- **What it does not do:** the SDK still initializes and still sends
  requests. The sources read do not say whether requests for an archived
  unit still reach Google, or what they carry. Archiving limits ad serving.
  It does not end data flow to Google; only the update or uninstall does.

**D-A inventory: the units to archive (read 2026-11-04, nothing changed).**
All eight belong to publisher `pub-4763306780710624` and were shipped with
AdMob app ID `ca-app-pub-4763306780710624~5227286262`.

| Ad unit ID (`ca-app-pub-4763306780710624/…`) | versionCode 7 (1.2.1) | versionCode 2 (1.0.0, Alpha) | Page key in the imported tree |
|---|---|---|---|
| `8267618237` | yes | yes | `standings` |
| `1331614142` | yes | no | `listPage` |
| `8550433073` | yes | no | `driverPage` |
| `8304813072` | yes | no | `teamPage` |
| `8079659788` | yes | no | `grandprixPage` |
| `9249271222` | yes | no | `calendarPage` |
| `9753702098` | yes | no | `grandprixlistPage` |
| `8806674289` | no | yes | none: not in the imported tree |

- **Sources.**
  - versionCode 2: a read-only scan of the owner's copy of the upload
    (SHA-256 `1ef7d378…e9cf`, the same bytes as the Play upload, §3.5). Each
    ABI's `libapp.so` holds exactly these two unit IDs. The manifest holds the
    app ID.
  - versionCode 7: the 2026-10-22 reading of the Play download found exactly
    seven unit IDs, the same seven as the imported tree's
    `lib/services/ad_provider.dart` (`git show 7524998^:…`). The IDs listed
    here are copied from that file. The downloaded copy was not kept, so they
    were not re-read from the bundle on 2026-11-04.
- **Not covered.** Bundles 1, 3, 5 and 6 are in the App bundle explorer but
  were never inspected. No track serves them now, but a device that never
  updated could still run one. Any unit they use appears in AdMob under the
  same app, so step 3 below finds it.
- **Account: found on 2026-11-04 (evening).** The AdMob account for
  `pub-4763306780710624` is held by the contact address,
  gridviewapp1@gmail.com. The Play Console account (sejuma18@gmail.com)
  holds a different, empty AdMob account (`pub-3203861803458300`, no apps,
  no requests), which is not GridView 1.x's. **Do not sign up** from another
  account: that creates a further, empty account.
**Read-only inspection, 2026-11-04 (evening).** Nothing was requested,
archived, created or saved; the "Request review" link was not used.
Screenshots and notes are kept outside the repository with SHA-256 sums
(`privacy-review-packet.md`, evidence E9).

| Check | Found |
|---|---|
| 1. Publisher ID | `pub-4763306780710624`. Status open; a "your account is being verified" notice; payments not set up |
| 2. App | One app: GridView, Android, `ca-app-pub-4763306780710624~5227286262`, linked to `com.sejuma.gridview`. Approval status "needs review", with **limited ad serving** |
| 3. Ad units | **Seven active units, exactly versionCode 7's seven** (all banners). `8806674289` (versionCode 2's "Calendar Native") is **already retired**, so seven units remain to archive, not eight. The retirement date was not shown. No extra unit |
| 4. Other apps, mediation | No other app. Six of the seven units are each in one active mediation group, which archiving changes; `9753702098` is in none |
| 5. Reports (all time, data from 2025-03-02 to 2026-10-02) | 49,983 requests, 1,607 matched, **594 impressions**, estimated revenue US$0.19. Regular serving ended in July 2025; the **last impression was on 2026-03-31**. Requests from GridView versions with SDK 23.6.0 are recorded until 2026-10-02 (a few a day), and no row exists after that date |

**Reading.**
- Ads are, in practice, no longer shown to installed 1.x copies: the last
  impression was on 2026-03-31, and the app's serving is limited.
- The SDK still asks for them. The absence of report rows after 2026-10-02
  is not evidence that installed copies stopped requesting.
- That fits Google's inactivity rule, under which an account that serves no
  ads for six months is deactivated, and serving does not resume without a
  per-app review (AdMob help 10491752, saved 2026-11-04). The deactivation
  date itself was not seen; it is inferred as early October 2026.
- **Not explained:** from March 2026 the reports show about 46,700 requests
  labelled app version "1.56.4" or no version, with no SDK version and no
  impressions. No GridView release is 1.56.4, and the source is not
  identified. It is recorded here, not attributed.
- **For D-A:** archiving the seven active units still ends serving with
  certainty, whatever the account's state. Not requesting the review keeps
  serving off while the units exist. Which of the two is the AU-7 gate
  was decision D-A′ (`privacy-review-packet.md`, section 4). **Decided by
  the owner on 2026-11-05: keep D-A.** The seven active units are archived
  once the account's verification notice clears; D-A′ is not adopted.
  The archive still needs the go-ahead in step 6 below.

- **Verification before the archive (repeat steps 3 to 5 on the day):**
  1. Account information shows publisher ID `pub-4763306780710624`.
  2. Apps: the GridView Android app shows app ID
     `ca-app-pub-4763306780710624~5227286262`. Record its store link, if
     any (`com.sejuma.gridview`).
  3. That app's ad units: record each one's name, ID and format. All eight
     IDs above must be there. Record any extra unit and bring it to the
     owner before acting: it is GridView's (2.0.0 has no ads), but the
     owner's D-A covered the units known then.
  4. No other app in the account lists any of the eight. Any mediation
     group naming one is recorded, since removing the unit changes the
     group.
  5. Reports, by ad unit, over the last 28 days: record requests and
     impressions per unit as the before-state. Units with no traffic are
     still archived.
  6. Save the screenshots or exports in a dated evidence folder. Only then,
     with the owner's separate go-ahead, archive (remove) the units one by
     one. Afterwards, re-read the ad-unit list and record each unit's state.

The Ads declaration still follows distribution, not serving. State F (Ads
**No**) waits until no 1.x artifact is distributed (§1.3), whether or not
the units are archived.

## 4. Review items for the privacy review

> **2026-11-05: no external review is planned** (owner decision). In §4,
> §4.1 and §4.2, "the review" now means the owner's decision on the
> evidence, recorded with its options in `privacy-self-assessment.md`.
> Dropping the external review settles none of the open items.

| # | Question | Engineering recommendation |
|---|---|---|
| R1 | Does Performance Monitoring's IP-to-country mapping count as **Approximate location**? | **Accepted by the owner for the draft (recorded 2026-11-02): declare Approximate location.** Firebase's own disclosure lists it for Performance Monitoring. Country-level location is coarser than Play's 3 km² threshold, and Play's "Approximate location" type covers that. Play requires the declaration to be accurate and complete and may act on any discrepancy, in either direction. The answer must therefore follow the review's finding, not a preference for declaring more. |
| R2 | Is Cloudflare's handling of the IP address ephemeral? It is still declared, under Approximate location with the App functionality purpose (§3.2) | **Conditionally accepted by the owner (recorded 2026-11-02): confirmation of the complete processing scope is still open.** The engineering answer is yes. The production logging condition in §3.4 is committed (W1, PR #85, then ADR 0028 D8, PR #86). W3 verified it on the deployed Worker on 2026-10-22 (§3.4), and AU-7 repeats the check on the version it deploys. Do not submit state T or F until the check has passed for the version deployed at the time. |
| R3 | Deletion-request answer | **Settled on the facts, 2026-10-22: no verified procedure exists.** Official Firebase documentation (read 2026-10-22) gives two routes. **(a) Delete the installation** by its Firebase installation ID, in the app (`FirebaseInstallations.delete()`) or on a server (Admin SDK `deleteInstallation(fid)`). The data tied to that ID is then removed "from live and backup systems of all Firebase services" within 180 days. **(b) Crashlytics `deleteCrashReports`** works only by a user ID set with the Crashlytics SDK. GridView sets none (`lib/core/observability/firebase/firebase_observability.dart`), so (b) cannot be used. Route (a) needs the installation ID, and the app shows it to nobody. A user's description of a crash (time, device model) does not yield it, and no console route from a crash to its installation ID was found or verified. Route (a)'s 180 days are longer than Crashlytics' 90-day and Performance Monitoring's 60- and 30-day retention, so for those it is no faster than expiry. It would remove the installation ID itself, which Firebase otherwise keeps until deleted. **Done:** the policy no longer promises deletion ("or until they are deleted at your request" is removed from section 6). It says one installation's Firebase data cannot currently be found or deleted. **Data safety:** answer **No**. **Owner decision D-DEL, decided 2026-10-23: no in-app deletion control.** 2.0.0 keeps its current functionality. The answer stays No, and the policy keeps saying that no verified procedure exists and one installation's data cannot be found or deleted. A control that calls `FirebaseInstallations.delete()` stays possible as a later product change. The remaining privacy obligations, such as how an erasure request is answered without a procedure, stay with the review. GridView has no accounts, so Play's separate account-deletion requirement does not apply. |
| R4 | Is the data collection optional? | **Required. A technical fact, not a classification:** no in-app switch exists, so the user cannot turn collection off. Adding one would be a product change. |
| R5 | The 1.x rows of states 0 and T (§3.5) | **Accepted by the owner (recorded 2026-11-02):** declare them as listed, including the 1.x **Crash logs** row (collected, shared; advertising, analytics and fraud prevention). **Evidence (§3.5):** two Internet Archive captures of Google's disclosure, taken while 23.6.0 was the latest release, say they cover version 23.6.0. Their "Diagnostic information" names crash logs, which Play's definitions place under Crash logs, and the rest under Diagnostics. **Limits:** archived copies of Google's published statement about its SDK, not observed 1.x traffic. Nothing contradicts them, so no traffic capture is required. |
| R6 | 1.x requests ads with **no consent message** | This is a past and ongoing exposure for EEA and UK users. The policy now says so plainly (section 3.4) and does not claim a legal basis for it. The privacy review decides whether more is needed. Stopping 1.x distribution (§1.4 step 4: not retaining versionCode 7 and pausing the Alpha track, both decided by the owner on 2026-11-05) limits new installs only. Installed copies keep requesting ads until they update or are uninstalled (§3.6). The owner decided on 2026-10-23 to archive the 1.x ad units in AdMob before AU-7 (D-A, §3.6). That will stop ads being served to installed copies, but not the SDK's requests. The archiving is a separate AdMob step and has not been done. |
| R7 | Controller identity (§6) | **Confirmed by the owner on 2026-10-20:** Sergio Arenas del Amo, an individual in Ireland, publishing as Sejuma, with no registered business. The contact address is gridviewapp1@gmail.com. **C4, decided 2026-10-23:** email stays the only contact channel (§6.1). One owner step remains: the Play listing still says Spain; on 2026-11-05 the owner recorded Ireland as the intended country (§6.2). Whether rules outside the privacy notice require a geographic address stays open for the review (§6.1). |
| R8 | Does Firebase Sessions' session-start time count as **App interactions**? Do the API's persisted lines (§3.4)? | **Sessions: accepted by the owner (recorded 2026-11-02), declare App interactions.** Firebase's disclosure lists it as application metrics, and it records the app coming to the foreground. As for R1, the answer must follow the review's finding: Play does not exempt over-declaration. **API lines (not part of that acceptance, §4.1):** no row. Production writes no line for a public request the Worker answers, and the line for one that hits an internal error carries no request ID, IP address or device identifier (ADR 0028 D8). This replaces the earlier keep-or-disable choice D-L. W3 verified it on the deployed Worker on 2026-10-22, and AU-7 repeats the check (§3.4). |
| R9 | 1.x Firebase Cloud Messaging (§3.5): the Data safety purpose for the FCM registration, and the legal basis | **Open. No external review is planned (2026-11-05), so this is now the owner's decision on the evidence; it is not engineering-settled** (`privacy-self-assessment.md` Q1a-Q1c). **Facts (§3.5):** 1.x had no notification feature. Its code never used FCM, and the owner states nothing was ever sent. Separately, the Firebase console (read 2026-10-22) shows no campaign ever created in `gridview-fb20f` and no message in the last 90 days; it cannot show API sends or older reports. The SDK still registered every install and sent an installation ID and a token to Google. **Purpose:** the earlier recommendation, App functionality, is **withdrawn**. Play defines it as "Used for features that are available in the app", and no 1.x feature used this data. Developer communications ("news or notifications") describes what FCM is for, but not what 1.x did. **Updated 2026-11-05:** Firebase's Data safety guidance states that purpose for the SDK's data ("to send messages to the client app"), and Play requires SDK collection to be reflected, so Developer communications is now the proposed answer, with the caveat that 1.x never used it. No other Play purpose fits. **Legal basis:** none can be substantiated from the facts. Legitimate interests needs an identified interest and necessity, and there was no purpose to be necessary for. The policy's section 4 therefore states no basis for it. It must not be published with one chosen to complete it. See §4.2 for the questions and the possible outcomes. |

### 4.1 Owner decisions and their options

The facts above are settled. On 2026-10-23 the owner decided D-A, D-DEL, C4
and AU-D3, and R4 is recorded as a technical fact. Those decisions do not
answer R1, R2, R5, R8 or R9. The owner's acceptances recorded on 2026-11-02
answer R1 for the draft, R5 and R8's Sessions part, and R2 conditionally.
**They do not answer R9, which needs the specific review in §4.2, and they do
not decide R6's remediation or whether the geographic-address rules apply
(§6.1).**

**Decided**

| # | Decision | Consequence |
|---|---|---|
| R4 | Not a decision: collection is **required**, because no in-app switch exists | No change needed. Making it optional would need a switch, a product change |
| R6, D-A | **2026-10-23: archive the 1.x ad units in AdMob** (§3.6) before automatic production publication (AU-7, `automatic-updates.md` AU-D2). The irreversible end of 1.x ad revenue is accepted | Once archived, ads stop being served to installed copies. The SDK's requests and the Firebase registration continue until update or uninstall. The archiving is a separate AdMob operation, not done yet. The account was found on 2026-11-04 (gridviewapp1@gmail.com). Seven active units remain, all versionCode 7's; `8806674289` is already retired. Serving is limited, and the last impression was on 2026-03-31 (§3.6). **Confirmed 2026-11-05:** archive the seven once the account's verification clears; D-A′ is not adopted. Whether anything more is needed for the ads served without a consent message stays with the review (R6) |
| D-DEL | **2026-10-23: no in-app deletion control.** 2.0.0 keeps its current functionality | Data safety answers No to deletion. The policy says no verified procedure exists and one installation's data cannot be found or deleted. The remaining privacy obligations stay with the review |
| D-T1 | **2026-11-05: versionCode 7 is not retained** in the 2.0.0 release (§1.4 step 4) | New installs on API 21 to 23 are no longer offered; installed 1.2.1 copies stay covered by policy section 3.4. The release step is separate, not done |
| D-T2 | **2026-11-05: pause the closed "Alpha" track** (versionCode 2) as part of the release plan | Ends Alpha distribution, which shortens state T. Existing Alpha installs keep 1.0.0. The pause is a separate Play Console step, not done |
| C4 | **2026-10-23: email (gridviewapp1@gmail.com) stays the only contact channel** | No policy change. Whether a geographic address is required by rules outside the privacy notice stays open for the review (§6.1) |
| AU-D3 | **2026-10-23: accept the policy's current wording** on the API (sections 2 and 3.2): no record of the app's normal requests, and a 7-day technical record of the API's own internal errors | No policy change. It accepts the wording only; the classification behind it is R2 and R8. W3's log check stands, and AU-7 repeats it on its own version |
| R1 | **Accepted for the draft (recorded 2026-11-02): declare Approximate location** for Performance Monitoring's IP-to-country mapping | The listing shows location collected. Matches Firebase's own disclosure |
| R5 | **Accepted (recorded 2026-11-02): the 1.x rows as listed (§3.5), including Crash logs** | States 0 and T declare what Google's 23.6.0 disclosure lists, mapped to Play's types. Rests on archived copies of Google's statement, not on observed 1.x traffic. It does not settle the purpose of the Firebase Cloud Messaging row, so both states still wait for R9 |
| R8 | **Accepted (recorded 2026-11-02): declare App interactions for Firebase Sessions** | Matches Firebase's disclosure of the session start. It names Sessions only, so the API's lines stay open below |

**Still open**

| # | Option | Consequence |
|---|---|---|
| R2 | **Conditionally accepted (recorded 2026-11-02):** the API's handling of the IP address is ephemeral (§3.2, §3.4). **Confirmation of the complete processing scope is still open** | Holds only once that scope is confirmed, and while the deployed Worker's logs pass the check (W3 done; AU-7 repeats it) |
| | If the scope is not confirmed | The review decides what changes. Approximate location is already declared as not ephemeral as a whole, because of Firebase's part (§3.2) |
| R8, API lines | No row for the API's persisted lines (engineering recommendation, §3.4). The acceptance above does not name them | If the review wants a row, it carries the API source and the App functionality purpose (release plan P3) |
| R6 | Whether more than disclosure and D-A is needed for the 1.x ads served without a consent message. Unresolved | The review decides (§4) |
| §6.1 | Whether a geographic address is required by rules outside the privacy notice. Unresolved | The review decides (§6.1) |
| R9 | Was a privacy-review blocker (§4.2). With no external review planned (2026-11-05), it is the owner's decision: the purpose has a proposed answer, Developer communications; the legal basis has no supportable answer (`privacy-self-assessment.md` Q1a-Q1c). Unresolved | Data safety states 0 and T, and the policy's publication, wait for it |

### 4.2 R9 privacy-review blocker: 1.x Firebase Cloud Messaging

**What is established.** These come from §3.5. Each is labelled with how it
is known.

- **Observed:** the bundles package FCM, Firebase Installations, the Android
  side of FlutterFire messaging and `POST_NOTIFICATIONS`. No GridView code
  uses any of them, and no notification UI exists.
- **Observed for versionCode 7, 2026-11-05:** on a clean first launch,
  Firebase Messaging initiated registration automatically and Google Play
  services logged success. The app exited before receiving the reply
  (§3.5).
- **Inferred:** the same for versionCode 2 (same SDKs, not tested); and what
  is transmitted, which the test did not capture. Per Firebase's
  documentation it is a Firebase installation ID and an FCM registration
  token issued for it, with the IP address, for project `gridview-fb20f`.
  That project is also 2.0.0's.
- **Owner statement:** no feature was implemented, and no notification was
  sent.
- **Observed in the Firebase console, read-only, 2026-10-22:** no campaign
  was ever created in `gridview-fb20f`, and its reports show no message in
  the last 90 days. This is consistent with the owner statement but does not
  prove it (§3.5).
- **Unchecked:** API sends, reports older than 90 days, and
  `notificationsgridview`.

**Questions for the review.**

1. **Data safety purpose.** Device or other IDs is declared anyway, for the
   ads SDK. Must its purposes also account for the FCM registration? If so,
   which Play purpose is accurate for data an SDK collected with no feature
   using it? Is "none of the purposes" an accurate answer for that part?
2. **Legal basis.** What basis, if any, covered the FCM registration for EEA,
   UK and Swiss users? A related question is whether storing and reading the
   installation ID on the device needed consent under the ePrivacy rules.
   This is a question for the review, not a finding.
3. **Remediation.** Is disclosure enough, or is more needed?

**Possible outcomes and their consequences.** The owner chooses (no external
review is planned); the proposed answers are in `privacy-self-assessment.md` §5. Nothing
here is selected.

| Outcome | Consequence |
|---|---|
| No purpose is added for FCM; the type keeps the ads SDK's purposes | The form describes only what the evidence shows. The review must accept that Play's purposes do not cover every collection of the type |
| Developer communications is added | It describes FCM's capability. It also tells users that 1.x sent, or could send, notifications, which the owner says never happened. It could be read as overstating use |
| App functionality is added | Not supported: no 1.x feature used the data. Shown only so it is not chosen by default |
| The policy states no basis for the FCM registration (as now) | Transparent. It records processing with no stated basis for the review to address |
| The policy states a basis the review identifies | Only with the review's reasoning. Legitimate interests is not substantiated by the current facts |
| Remediation measures are added (for example a Firebase-side measure for 1.x only, or deleting 1.x installation data) | Not evaluated. 1.x and 2.0.0 share one Firebase Android app, so any project setting must be checked against 2.0.0 first (§3.6) |

**What waits on it:**

- Data safety states 0 and T: the FCM part of the Device or other IDs
  purposes.
- Publishing the policy: section 4 now says, in the draft, that 1.x did not
  ask for consent to the FCM registration and that no legal basis is claimed
  for it (2026-11-05). The owner must accept that wording or choose another
  option (`privacy-self-assessment.md` Q1b).
- Merging PR #82.

**What the console check did not settle.** The Messaging campaign history of
`gridview-fb20f` was read on 2026-10-22 (§3.5). `notificationsgridview` was
not visible to the account that could open the console; whoever can open it,
if it exists, can read its Messaging pages read-only. None of this decides
R9: the review's questions are about the registration itself, which ran
whether or not anything was sent.

## 5. Related store items

- **Privacy policy**: the 2.0.0 policy is `privacy_policies.md` / `privacy_policies.html`
  in this repository. It must be **published** at the listing's existing URL,
  https://gridview.netlify.app, before the release is submitted. Publishing is a
  separate, authorized step.
- **Ads declaration** (App content → Ads): keep **Yes** in state T, and change
  to **No** only in state F (§1.3).
- **App access, content rating, target audience**: unchanged by this release.

## 6. Controller identity and country

**Owner decision, 2026-10-20.** The controller is **Sergio Arenas del Amo**,
acting as an individual from **Ireland**. No registered business stands
behind "Sejuma", which is only the developer name on Play. The privacy
contact is **gridviewapp1@gmail.com**, which the owner confirmed he uses and
can access. The policy's section 1 and its complaints item (section 6) now
say this.

Sources read before the decision:

| Source | Name | Country | Contact |
|---|---|---|---|
| Public Play listing, "About the developer" (`play.google.com/store/apps/details?id=com.sejuma.gridview`, read 2026-10-20) | **Sergio Arenas del Amo**; developer name **Sejuma** | **Spain** | gridviewapp1@gmail.com |
| Play Console (read 2026-10-20, earlier session) | developer account "Sejuma" | - | - |
| Live policy, last updated 2025-02-19 | "GridView" (the "Company"), no legal name | Spain | gridviewapp1@gmail.com |
| This PR before 2026-10-21 | Sergio Arenas del Amo, publishing as Sejuma | Spain | gridviewapp1@gmail.com |

The same listing still shows **"Contains ads"**, Data safety **"No data
collected / No data shared"**, "Updated on Apr 19, 2025", and the policy link
https://gridview.netlify.app.

### 6.1 Do the contact details meet the privacy-notice requirements?

Checked against GDPR Article 13 and the Article 29 Working Party's
*Guidelines on transparency* (WP260 rev.01, endorsed by the EDPB), Annex,
page 35. **No home address is assumed to be publishable.**

| Requirement | What the policy gives | Assessment |
|---|---|---|
| Art. 13(1)(a): "the identity and the contact details of the controller" | Full legal name, the developer name, the country and an email address | **Met.** Article 13 does not require a postal address, and email is a contact detail. |
| WP260 Annex on Art. 13(1)(a): the information "should allow for easy identification of the controller and preferably allow for different forms of communications with the data controller (e.g. phone number, email, postal address, etc.)" | One channel: email | **Meets the requirement, not the recommendation.** "Preferably" is guidance. **Owner decision C4, 2026-10-23: email stays the only channel.** No second channel is added, and no home address is published. |
| Art. 13(1)(a): the representative | None | **Not applicable.** Article 27 applies only to controllers not established in the EU. |
| Art. 13(1)(b): the data protection officer | None | Applies only where a DPO is designated. None is. |
| Art. 12(2) and (3): facilitate the exercise of rights; answer within one month | A mailbox the owner uses | **Met for receiving requests**, given the owner's confirmation. Fulfilling a deletion request is still open (R3). |
| Art. 13(2)(d) with Art. 77: the right to complain, "in particular in the Member State of his or her habitual residence, place of work or of an alleged infringement" (WP260 Annex) | That wording, and the Irish Data Protection Commission as the controller's authority | **Met.** The policy no longer names only the Spanish AEPD. |

**Not assessed here:** information duties outside the privacy notice, such
as the e-commerce rules on a service provider's "geographic address". C4
does not settle them. They
are for the privacy review.

### 6.2 Inconsistencies left for owner steps

- **The Play listing says Spain**, and the policy now says Ireland. Changing
  the developer account's country or address is a Play Console step. On
  2026-11-05 the owner recorded that Ireland is the intended country. The
  change itself was not done, and it was not authorised.
- **The live policy** (2025-02-19) still says Spain until P2 publishes this
  version.
