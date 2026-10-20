# Google Play Data safety — evidence for GridView 2.0.0

The answers below are what the reconstructed production app (`com.sejuma.gridview`,
versionName 2.0.0) does. Each one cites the evidence it rests on. They are the
**engineering input** to the Data safety form; the form is submitted in Play
Console by the owner after a privacy review. The review is needed because
classifying data for Play is a legal judgement, not an engineering one.

Prepared 2026-10-20 at `6aefcbf`. The transition sections (§1, §1.1-§1.4 and
§3.5) and the controller check (§6) were added the same day, before merge.

## 1. Why the current declaration must change

The live listing declares **"No data collected"** and **"No data shared"**
(public listing, read 2026-10-20).

- **Wrong for 1.2.1 today.** Version 1.2.1 shows Google AdMob banners on every
  page. It initializes the Google Mobile Ads SDK at startup, and that SDK
  collects and shares data (§3.5).
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
| versionCode 7, 1.2.1 | Production, full rollout | 21 | Google Mobile Ads SDK (§3.5) |
| versionCode 2, 1.x | Closed testing "Alpha" | not read | **Not verified.** Assumed to match 1.2.1 (Google Mobile Ads SDK) until inspected (§1.4 step 0). |
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
| **0 - now** | Only 1.x is distributed (today) | §3.5 only (1.x, AdMob) | **Yes** |
| **T - transition** | From its submission, just before 2.0.0 first reaches a non-internal track (closed, open or production), until no 1.x artifact is distributed on any non-internal track | The **union**: §3.2 (2.0.0, Firebase) **plus** §3.5 (1.x, AdMob) | **Yes** |
| **F - final** | 2.0.0 is the only distributed build: rollout at 100%, versionCode 7 not retained, Alpha closed or replaced | §3.2 only | **No** |

### 1.4 Order of the store steps

None of these steps is done; each is a separate, owner-authorized Play Console
or publishing step.

0. **Settle the Alpha build first, before steps 1 and 2.** The policy's
   section 3.4 and §3.5 here are evidenced from the 1.2.1 source only. Both
   the policy and the form must also be true of versionCode 2 while it is
   distributed.
   - **Either** inspect it: download it from Play Console (App bundle
     explorer) and check its SDKs and manifest against §3.5, then add any
     difference to both documents.
   - **Or** stop distributing it first: deactivate the Alpha track, or
     replace its build (D-T2).
1. **Publish the transition policy** (`privacy_policies.md` and `.html` in this
   PR) at https://gridview.netlify.app. It covers 1.x (section 3.4) and 2.0.0.
   Publish it **before** the 2.0.0 Data safety change and before the release is
   submitted. The 2.0.0-only draft must never replace the live page while 1.2.1
   is distributed, because 1.2.1 would then point at a policy that does not
   describe its ads.
2. **Correct the live form now (state 0).** The live "No data collected" is
   already inaccurate for 1.2.1, so declare §3.5 with Ads **Yes**. This does
   not depend on 2.0.0 or on the production Worker. Step 0 comes first.
3. **Submit state T** before 2.0.0 reaches any non-internal track (closed,
   open or production). State T includes the 2.0.0 API answer (§3.4), so it
   also waits for production logging to be verified off.
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
| Firebase, *Prepare your app for Google Play's Data safety section* (https://firebase.google.com/docs/android/play-data-disclosure, updated 2026-10-16) | Per-SDK data, purposes, HTTPS in transit, Performance's IP-to-country use |
| Firebase, *Privacy and Security in Firebase* (https://firebase.google.com/support/privacy, updated 2026-10-14) | Retention: Crashlytics 90 days; Performance 60 days (IP-linked events 30); installation IDs until deleted; Google acts as processor |
| Production-flavor profile APK built at `6aefcbf` (`aapt2 dump permissions`) | Permissions: `INTERNET`, `ACCESS_NETWORK_STATE` and the app's own non-exported receiver permission. No `AD_ID`, location, contacts, storage or camera permission |
| `lib/core/network/gridview_dio.dart` | API requests carry `Accept` and a random per-request `X-Request-Id`; no user or device identifier |
| `android/app/src/main/AndroidManifest.xml` | No `usesCleartextTraffic` or network-security override, so cleartext HTTP is blocked (target SDK 36) |
| `lib/core/legacy/`, `../technical/GridView_Preferences_And_Settings.md` | Preferences and the content cache stay on the device |

## 3. Proposed answers

### 3.1 Overview questions

| Question | Proposed answer | Basis |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Firebase collects the types in §3.2 |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | Firebase sends over HTTPS; the GridView API is HTTPS-only and cleartext is blocked by the platform |
| Do you provide a way for users to request that their data is deleted? | **Yes, by email**, once R3 is confirmed | The policy offers deletion requests at gridviewapp1@gmail.com; see R3 |

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
| App activity → **App interactions** | Firebase Sessions records when the app is foregrounded to start a session ("application metrics", Firebase disclosure). If production keeps Workers Logs (§3.4), the API also persists one `request.completed` line per request, with the route template (which resource was fetched), a random request ID and the outcome, but no IP, header or device identifier | Analytics; **App functionality** if the API logs are kept — **review item R8** |

"Analytics" is Play's purpose for monitoring app performance and diagnosing
problems. GridView uses this data for nothing else.

### 3.3 Not collected (2.0.0)

Personal info (name, email, user IDs, address, phone), financial info, health
and fitness, messages, photos and videos, audio, files and documents, calendar,
contacts, web browsing, and precise location. Of **app activity**, only these
are collected (both in the §3.2 row):

- the session start;
- if production keeps Workers Logs (§3.4, option (a)), the API's per-request
  route logs.

There is no screen-view, tap or search analytics, and the build forbids the
Analytics SDK.

### 3.4 GridView API traffic

Requests to the GridView API (Cloudflare Workers) expose the device IP address
to Cloudflare, as any network request does. GridView does not store or use it
beyond serving the request. This is ephemeral processing, provided the
production Worker keeps request logging off: `invocation_logs = false`, and no
application log line records an IP or a header.

**That condition is not enforced in this repository yet.**

- Today `services/edge-api/wrangler.toml` sets `invocation_logs = false` only
  for staging. Production has no such setting, and production is not
  deployed.
- PR #83's `docs/release/production-release-plan.md` gate W1 must commit it
  for `[env.production]`, and W3 checks it on the deployed Worker.
- **Do not submit this answer** (state T or F) until that production setting
  is committed and verified on the deployed Worker. State 0 (1.x only) does
  not include it.
- If the production configuration ever persists IP addresses, revisit this
  section (**review item R2**).

**Persisted application logs are a separate question.**

- `invocation_logs = false` turns off only Cloudflare's automatic invocation
  records.
- With Workers Logs enabled, as staging has it, each public request still
  persists the Worker's own `request.completed` line (`src/index.ts`): the
  route template, a random request ID, the cache outcome and the status. It
  has no IP, header or device identifier.
- Google Play may count the route template, which says which resource the app
  fetched, as **App interactions**. Production must take one of two routes
  before state T or F (owner decision with W1, review item R8):
  - **(a) Keep the logs** for operations, and declare them under App
    interactions with the App functionality purpose (§3.2).
  - **(b) Turn persisted logs off** for production with an **explicit**
    `[env.production.observability] enabled = false`.
    - Omitting the block is not enough: Cloudflare enables observability by
      default for new Workers.
    - Verify the setting on the deployed version, and that the Workers Logs
      dataset stays empty after test requests (PR #83, W3), before submitting.
    - The declaration then stays Firebase-only, and production operations
      rely on metrics and `wrangler tail`.

### 3.5 Versions 1.x (states 0 and T)

Evidence: the pre-reconstruction tree (`git show 7524998^:pubspec.yaml`, `lib/`
and `android/`), which declares `version: 1.2.1+7`.

- `google_mobile_ads: ^7.0.0` is initialized in `lib/main.dart`
  (`MobileAds.instance.initialize()`). Banner ads appear on the calendar,
  driver, Grand Prix, list and standings pages.
- The manifest carries `com.google.android.gms.ads.APPLICATION_ID`.
- There is no User Messaging Platform or other consent code.
- `unity_ads_plugin: ^0.3.24` is a dependency, but no Dart code references
  Unity Ads.
- There is no Firebase SDK dependency.

The Google Mobile Ads SDK disclosure
(developers.google.com/admob/android/privacy/play-data-disclosure, updated
2026-10-16) lists four data types as **collected and shared automatically**
for advertising, analytics and fraud prevention, all encrypted in transit.
State T adds these rows to §3.2:

| Play category → type | Collected | Shared | Purposes |
|---|---|---|---|
| Location → **Approximate location** (IP address) | yes | **yes** | Advertising or marketing; Analytics; Fraud prevention, security and compliance |
| App activity → **App interactions** | yes | **yes** | the same |
| App info and performance → **Diagnostics** | yes | **yes** | the same |
| Device or other IDs → **Device or other IDs** (advertising ID, app set ID) | yes | **yes** | the same |

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
- The SDK version in 1.2.1 resolves from `^7.0.0`. Google publishes the
  disclosure for its current SDK only, so the review should confirm that it
  applies (R5).

## 4. Review items for the privacy review

| # | Question | Engineering recommendation |
|---|---|---|
| R1 | Does Performance Monitoring's IP-to-country mapping count as **Approximate location**? | Declare it. Country-level location is coarser than Play's 3 km² threshold, so declaring is the conservative reading. Over-declaring is not a policy violation; under-declaring is. |
| R2 | Is Cloudflare's handling of the IP address ephemeral? It is still declared, under Approximate location with the App functionality purpose (§3.2) | Yes, but only once the production logging condition in §3.4 is committed (PR #83, W1) and verified on the deployed Worker (W3). Until then, do not submit the form. |
| R3 | Deletion-request answer | **"Yes", but only after the owner confirms the requests can be fulfilled.** The policy offers deletion requests at gridviewapp1@gmail.com, and Play's guidance prescribes no mechanism and accepts a dedicated email address. "No" would contradict the policy. GridView has no accounts, so Play's separate account-deletion requirement does not apply. To fulfil a request, the owner needs a way to locate the data (for example from the date and time of a crash, as the policy asks) and remove it in Firebase; otherwise it expires after 90, 60 or 30 days. If fulfilment cannot be committed to, remove the deletion promise from the policy instead of answering "No" while the policy says otherwise. |
| R4 | Is the data collection optional? | **Required.** No in-app switch exists. Adding one would be a product change. |
| R5 | State T rows for 1.x (§3.5) | Declare them as listed. Confirm the Google Mobile Ads disclosure applies to the SDK version 1.2.1 resolved. |
| R6 | 1.x requested ads with **no consent message** | This is a past and ongoing exposure for EEA and UK users. The policy now says so plainly (section 3.4) and does not claim a legal basis for it. The privacy review decides whether more is needed. Stopping 1.x distribution (§1.4 step 4: not retaining versionCode 7, and deactivating or replacing the Alpha build) limits it. |
| R7 | Controller identity (§6) | The policy now names the natural person shown on the Play listing. Confirm, or replace with a registered business name and address if one exists. |
| R8 | Does Firebase Sessions' session-start time count as **App interactions**? Do the API's persisted `request.completed` route logs (§3.4), if kept? | Declare the Sessions data: it is usage data about the app coming to the foreground, and over-declaring is not a violation. For the API logs, choose (a) keep and declare them with the App functionality purpose, or (b) turn them off in production (§3.4). |

## 5. Related store items

- **Privacy policy**: the 2.0.0 policy is `privacy_policies.md` / `privacy_policies.html`
  in this repository. It must be **published** at the listing's existing URL,
  https://gridview.netlify.app, before the release is submitted. Publishing is a
  separate, authorized step.
- **Ads declaration** (App content → Ads): keep **Yes** in state T, and change
  to **No** only in state F (§1.3).
- **App access, content rating, target audience**: unchanged by this release.

## 6. Controller identity and country (verified 2026-10-20)

| Source | Name | Country | Contact |
|---|---|---|---|
| Public Play listing, "About the developer" (`play.google.com/store/apps/details?id=com.sejuma.gridview`, read 2026-10-20) | **Sergio Arenas del Amo**; developer name **Sejuma** | **Spain** | gridviewapp1@gmail.com |
| Play Console (read 2026-10-20, earlier session) | developer account "Sejuma" | - | - |
| Live policy, last updated 2025-02-19 | "GridView" (the "Company"), no legal name | Spain | gridviewapp1@gmail.com |
| This PR's first draft | "the developer account Sejuma ... Sejuma is the data controller" | Spain | gridviewapp1@gmail.com |

- **Country and contact:** Spain and gridviewapp1@gmail.com agree in every
  source.
- **Identity:** "Sejuma" is the account's display name, not a legal person, so
  naming it as controller was imprecise. Play already shows the individual's
  legal name publicly, so the policy now names him as controller, publishing
  as Sejuma (R7).
- The same listing still shows **"Contains ads"**, Data safety **"No data
  collected / No data shared"**, "Updated on Apr 19, 2025", and the policy link
  https://gridview.netlify.app.
