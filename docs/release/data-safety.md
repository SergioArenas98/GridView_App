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
R2, R5, R8 or R9, which stay open for the privacy review (§4, §4.1).

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
   longer wait on it. Pausing the Alpha track (D-T2) is still recommended,
   because it shortens state T.
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
4. **Release 2.0.0.** Recommendation (owner decision D-T1): do **not** retain
   versionCode 7. The legacy backend is dead, so on API 21 to 23 1.2.1 can show
   ads but no Formula 1 data. Also deactivate the closed "Alpha" track or
   replace its build (D-T2).
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
| Play Console Help, *Provide information for Google Play's Data safety section* (support.google.com/googleplay/android-developer/answer/10787469, read 2026-10-22) | The purpose definitions used for R9: App functionality is "Used for features that are available in the app"; Developer communications is "Used to send news or notifications about the app or the developer" |
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
| Location → **Approximate location** | Performance Monitoring maps IP addresses to countries. The GridView API also receives the IP address with each request, to serve it; that part is ephemeral (§3.4), but Firebase's part is not, so the type as a whole is not | Analytics; **App functionality** (the API) — **review items R1, R2** |
| App activity → **App interactions** | Firebase Sessions records when the app is foregrounded to start a session ("application metrics", Firebase disclosure). The API's persisted logs add nothing here (§3.4) | Analytics — **review item R8** |

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
beyond serving the request, so this is ephemeral processing (**review item
R2**). It holds only while no persisted record carries the IP address or
anything that links a request to an installation.

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
| Google Mobile Ads SDK | `play-services-ads` 23.6.0; seven banner ad unit IDs | 23.6.0; two ad unit IDs |
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
  - **This is inferred from the packaged SDKs and their documented behaviour.
    It was not observed on a device.**

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
  - The SDK's automatic registration still ran on every install. It
    processed a Firebase installation ID and a registration token, sent to
    Google, whether or not anything was ever sent. This is inferred from the
    packaged SDK, as above.
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
(developers.google.com/admob/android/privacy/play-data-disclosure) lists four data
types as **collected and shared automatically** for advertising, analytics
and fraud prevention, all encrypted in transit. The page covers only the
SDK's latest version. The rows below therefore rest on two Internet Archive
captures of the page taken while 1.x's version, 23.6.0, was the latest
release (R5, below the tables). State T adds these rows to §3.2:

| Play category → type | Collected | Shared | Purposes |
|---|---|---|---|
| Location → **Approximate location** (IP address) | yes | **yes** | Advertising or marketing; Analytics; Fraud prevention, security and compliance |
| App activity → **App interactions** | yes | **yes** | the same |
| App info and performance → **Diagnostics** | yes | **yes** | the same |
| Device or other IDs → **Device or other IDs** (advertising ID, app set ID) | yes | **yes** | the same |

Firebase Cloud Messaging adds this row:

| Play category → type | Collected | Shared | Purposes |
|---|---|---|---|
| Device or other IDs → **Device or other IDs** (Firebase installation ID, FCM registration token) | yes | no (Google processes it for GridView) | **Blocked: privacy review R9.** No purpose is supported by the evidence yet |

- These rows are **required**: 1.x has no switch, and it starts the SDK before
  showing anything. They are **not processed ephemerally**: Play says data
  used to build advertising profiles cannot be.
- Where a type is already declared in §3.2 (Approximate location, Diagnostics,
  Device or other IDs), state T marks it **shared**, adds the advertising and
  fraud purposes, and keeps Analytics.
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
  the SDK. Both list the four types above, for advertising, analytics and
  fraud prevention, encrypted in transit with TLS. The live page (read
  2026-10-23) covers 25.5.0 of the "Google Mobile Ads SDK (Legacy)". Apart
  from the product name, it differs in one example only.
  - **That difference.** For 23.6.0, "Diagnostic information" includes
    "crash logs, app launch time, hang rate, and energy usage". The live page
    no longer names crash logs. Play has a separate **Crash logs** type, and
    the rows above declare only Diagnostics for the ads SDK. Whether states 0
    and T also need App info and performance → Crash logs, collected and
    shared, with these purposes, is open under R5. Nothing is selected here.
    The policy's 1.x list (section 3.4) gives examples only ("such as") and
    is unchanged.
  - **Remaining gaps.** The captures are a third party's archive of
    Google's page, not a Google document published for that version. They
    are Google's statement about its SDK, not an observation of what 1.x
    sends: no 1.x traffic was captured. 23.6.0's release notes say nothing
    about data collection either way.

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
  - The snapshot holds two ad unit IDs, not seven.
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
change was made:

- **Archive (remove) the 1.x ad units in AdMob.** Google's AdMob blog,
  *Archiving ad units* (2017-01-12), says "all ad serving and settings
  associated with the ad unit will be disabled". It is permanent, and Google
  recommends it for "legacy apps" that cannot be updated. The current AdMob
  interface may call it "remove", so check the current help before acting.
- **Before archiving**, check in AdMob (read-only) that these units belong
  only to GridView 1.x and that no other app uses them.
- **Effect:** banners stop showing, and 1.x ad revenue ends. 2.0.0 contains
  no ads code, so it is not affected.
- **What it does not do:** the SDK still initializes and still sends
  requests. The sources read do not say whether requests for an archived
  unit still reach Google, or what they carry. Archiving limits ad serving.
  It does not end data flow to Google; only the update or uninstall does.

The Ads declaration still follows distribution, not serving. State F (Ads
**No**) waits until no 1.x artifact is distributed (§1.3), whether or not
the units are archived.

## 4. Review items for the privacy review

| # | Question | Engineering recommendation |
|---|---|---|
| R1 | Does Performance Monitoring's IP-to-country mapping count as **Approximate location**? | Declare it, if the review agrees it applies. Firebase's own disclosure lists it for Performance Monitoring. Country-level location is coarser than Play's 3 km² threshold, and Play's "Approximate location" type covers that. Play requires the declaration to be accurate and complete and may act on any discrepancy, in either direction. The answer must therefore follow the review's finding, not a preference for declaring more. |
| R2 | Is Cloudflare's handling of the IP address ephemeral? It is still declared, under Approximate location with the App functionality purpose (§3.2) | Yes. The production logging condition in §3.4 is committed (W1, PR #85, then ADR 0028 D8, PR #86). W3 verified it on the deployed Worker on 2026-10-22 (§3.4), and AU-7 repeats the check on the version it deploys. Do not submit state T or F until the check has passed for the version deployed at the time. |
| R3 | Deletion-request answer | **Settled on the facts, 2026-10-22: no verified procedure exists.** Official Firebase documentation (read 2026-10-22) gives two routes. **(a) Delete the installation** by its Firebase installation ID, in the app (`FirebaseInstallations.delete()`) or on a server (Admin SDK `deleteInstallation(fid)`). The data tied to that ID is then removed "from live and backup systems of all Firebase services" within 180 days. **(b) Crashlytics `deleteCrashReports`** works only by a user ID set with the Crashlytics SDK. GridView sets none (`lib/core/observability/firebase/firebase_observability.dart`), so (b) cannot be used. Route (a) needs the installation ID, and the app shows it to nobody. A user's description of a crash (time, device model) does not yield it, and no console route from a crash to its installation ID was found or verified. Route (a)'s 180 days are longer than Crashlytics' 90-day and Performance Monitoring's 60- and 30-day retention, so for those it is no faster than expiry. It would remove the installation ID itself, which Firebase otherwise keeps until deleted. **Done:** the policy no longer promises deletion ("or until they are deleted at your request" is removed from section 6). It says one installation's Firebase data cannot currently be found or deleted. **Data safety:** answer **No**. **Owner decision D-DEL, decided 2026-10-23: no in-app deletion control.** 2.0.0 keeps its current functionality. The answer stays No, and the policy keeps saying that no verified procedure exists and one installation's data cannot be found or deleted. A control that calls `FirebaseInstallations.delete()` stays possible as a later product change. The remaining privacy obligations, such as how an erasure request is answered without a procedure, stay with the review. GridView has no accounts, so Play's separate account-deletion requirement does not apply. |
| R4 | Is the data collection optional? | **Required. A technical fact, not a classification:** no in-app switch exists, so the user cannot turn collection off. Adding one would be a product change. |
| R5 | State T rows for 1.x (§3.5) | Declare them as listed, subject to the owner's sign-off in the review. **Evidence checked 2026-10-23 (§3.5):** two Internet Archive captures of Google's disclosure, taken while 23.6.0 was the latest release, say they cover version 23.6.0. They list the same four types and purposes as the rows. **Still open:** that text also names crash logs, which Play treats as a separate type, and no row declares it for the ads SDK. The evidence is also an archived copy of Google's statement, not observed 1.x traffic. |
| R6 | 1.x requests ads with **no consent message** | This is a past and ongoing exposure for EEA and UK users. The policy now says so plainly (section 3.4) and does not claim a legal basis for it. The privacy review decides whether more is needed. Stopping 1.x distribution (§1.4 step 4: not retaining versionCode 7, and deactivating or replacing the Alpha build) limits new installs only. Installed copies keep requesting ads until they update or are uninstalled (§3.6). The owner decided on 2026-10-23 to archive the 1.x ad units in AdMob before AU-7 (D-A, §3.6). That will stop ads being served to installed copies, but not the SDK's requests. The archiving is a separate AdMob step and has not been done. |
| R7 | Controller identity (§6) | **Confirmed by the owner on 2026-10-20:** Sergio Arenas del Amo, an individual in Ireland, publishing as Sejuma, with no registered business. The contact address is gridviewapp1@gmail.com. **C4, decided 2026-10-23:** email stays the only contact channel (§6.1). One owner step remains: the Play listing still says Spain (§6.2). Whether rules outside the privacy notice require a geographic address stays open for the review (§6.1). |
| R8 | Does Firebase Sessions' session-start time count as **App interactions**? Do the API's persisted lines (§3.4)? | **Sessions:** declare it, if the review agrees. Firebase's disclosure lists it as application metrics, and it records the app coming to the foreground. As for R1, the answer must follow the review's finding: Play does not exempt over-declaration. **API lines:** no row. Production writes no line for a public request the Worker answers, and the line for one that hits an internal error carries no request ID, IP address or device identifier (ADR 0028 D8). This replaces the earlier keep-or-disable choice D-L. W3 verified it on the deployed Worker on 2026-10-22, and AU-7 repeats the check (§3.4). |
| R9 | 1.x Firebase Cloud Messaging (§3.5): the Data safety purpose for the FCM registration, and the legal basis | **Blocked: specific privacy review. Not an owner choice, and not engineering-settled.** **Facts (§3.5):** 1.x had no notification feature. Its code never used FCM, and the owner states nothing was ever sent. Separately, the Firebase console (read 2026-10-22) shows no campaign ever created in `gridview-fb20f` and no message in the last 90 days; it cannot show API sends or older reports. The SDK still registered every install and sent an installation ID and a token to Google. **Purpose:** the earlier recommendation, App functionality, is **withdrawn**. Play defines it as "Used for features that are available in the app", and no 1.x feature used this data. Developer communications ("news or notifications") describes what FCM is for, but not what 1.x did. No other Play purpose fits. The evidence supports no purpose. **Legal basis:** none can be substantiated from the facts. Legitimate interests needs an identified interest and necessity, and there was no purpose to be necessary for. The policy's section 4 therefore states no basis for it. It must not be published with one chosen to complete it. See §4.2 for the questions and the possible outcomes. |

### 4.1 Owner decisions and their options

The facts above are settled. On 2026-10-23 the owner decided D-A, D-DEL, C4
and AU-D3, and R4 is recorded as a technical fact. **These decisions do not
answer R1, R2, R5, R8 or R9.** R1, R2, R5 and R8 still need the owner's
sign-off in the privacy review, and R9 needs the specific review in §4.2.

**Decided**

| # | Decision | Consequence |
|---|---|---|
| R4 | Not a decision: collection is **required**, because no in-app switch exists | No change needed. Making it optional would need a switch, a product change |
| R6, D-A | **2026-10-23: archive the 1.x ad units in AdMob** (§3.6) before automatic production publication (AU-7, `automatic-updates.md` AU-D2). The irreversible end of 1.x ad revenue is accepted | Once archived, ads stop being served to installed copies. The SDK's requests and the Firebase registration continue until update or uninstall. The archiving is a separate AdMob operation, not done yet. Whoever holds publisher `pub-4763306780710624` must first check that the units belong only to 1.x; that account was not reachable from either Google account signed in to Chrome on 2026-10-22. Whether anything more is needed for the ads served without a consent message stays with the review (R6) |
| D-DEL | **2026-10-23: no in-app deletion control.** 2.0.0 keeps its current functionality | Data safety answers No to deletion. The policy says no verified procedure exists and one installation's data cannot be found or deleted. The remaining privacy obligations stay with the review |
| C4 | **2026-10-23: email (gridviewapp1@gmail.com) stays the only contact channel** | No policy change. Whether a geographic address is required by rules outside the privacy notice stays open for the review (§6.1) |
| AU-D3 | **2026-10-23: accept the policy's current wording** on the API (sections 2 and 3.2): no record of the app's normal requests, and a 7-day technical record of the API's own internal errors | No policy change. It accepts the wording only; the classification behind it is R2 and R8. W3's log check stands, and AU-7 repeats it on its own version |

**Still open**

| # | Option | Consequence |
|---|---|---|
| R1 | Declare Approximate location (recommended if the review agrees that Performance Monitoring's IP-to-country mapping is location) | The listing shows location collected. Matches Firebase's own disclosure |
| | Do not declare it | Only if the review finds it is not location. Otherwise it is a discrepancy Play may act on |
| R2 | Accept that the API's handling of the IP address is ephemeral (§3.2, §3.4) | Holds only while the deployed Worker's logs pass the check (W3 done; AU-7 repeats it) |
| | Do not accept it | The review decides what changes. Approximate location is already declared as not ephemeral as a whole, because of Firebase's part (§3.2) |
| R5 | Declare the 1.x rows as listed (§3.5) | Rests on the archived 23.6.0 disclosure, not on observed 1.x traffic |
| | Also declare Crash logs, collected and shared, for the ads SDK | Follows the 23.6.0 text, which names crash logs. Only if the review finds that the SDK's crash logs are Play's Crash logs type |
| R8 | Declare App interactions for Sessions (recommended if the review agrees) | Matches Firebase's disclosure of the session start |
| | Do not declare it | Only if the review finds a session start is not an app interaction |
| R9 | Not an owner option. A privacy-review blocker (§4.2) | Data safety states 0 and T, and the policy's publication, wait for it |

### 4.2 R9 privacy-review blocker: 1.x Firebase Cloud Messaging

**What is established.** These come from §3.5. Each is labelled with how it
is known.

- **Observed:** the bundles package FCM, Firebase Installations, the Android
  side of FlutterFire messaging and `POST_NOTIFICATIONS`. No GridView code
  uses any of them, and no notification UI exists.
- **Inferred:** FCM auto-initializes at startup, so every 1.x install sends a
  Firebase installation ID, an FCM registration token and the IP address to
  Google, for project `gridview-fb20f`. That project is also 2.0.0's.
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

**Possible outcomes and their consequences.** The review chooses. Nothing
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
- Publishing the policy: section 4's silence on the FCM registration must be
  confirmed or replaced.
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
  the developer account's country or address is a Play Console step. It was
  not done, and it was not authorised.
- **The live policy** (2025-02-19) still says Spain until P2 publishes this
  version.
