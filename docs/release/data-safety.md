# Google Play Data safety — evidence for GridView 2.0.0

The answers below are what the reconstructed production app (`com.sejuma.gridview`,
versionName 2.0.0) does. Each one cites the evidence it rests on. They are the
**engineering input** to the Data safety form; the form is submitted in Play
Console by the owner after a privacy review. The review is needed because
classifying data for Play is a legal judgement, not an engineering one.

Prepared 2026-10-20 at `6aefcbf`.

## 1. Why the current declaration must change

The live 1.2.1 listing declares **"No data collected"** and **"No data shared"**
(public listing, read 2026-10-20). That is not true of 2.0.0, which packages
Firebase Crashlytics and Performance Monitoring and activates them in production
builds (`../technical/GridView_Observability.md` §4, §7). The 1.x app also
packaged Google Mobile Ads and Unity Ads, so its declaration was itself
questionable. Version 2.0.0 contains no advertising SDK (ADR 0018).

The listing's **"Contains ads"** label must also be removed.

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
| Do you provide a way for users to request that their data is deleted? | **Review item R3** | No account exists; see §4 |

### 3.2 Data types

Every row is: **collected** = yes, **shared** = no (Google processes it as GridView's
service provider, which Play does not count as sharing), **processed
ephemerally** = no, **required** (the user cannot turn it off in the app).

| Play category → type | Source | Purpose |
|---|---|---|
| App info and performance → **Crash logs** | Crashlytics stack traces and app state at crash | Analytics |
| App info and performance → **Diagnostics** | Performance Monitoring (start time, trace durations, CPU and memory); Sessions metrics | Analytics |
| Device or other IDs → **Device or other IDs** | Firebase installation ID; Crashlytics installation UUID | Analytics |
| Location → **Approximate location** | Performance Monitoring maps IP addresses to countries | Analytics — **review item R1** |

"Analytics" is Play's purpose for monitoring app performance and diagnosing
problems. GridView uses this data for nothing else.

### 3.3 Not collected

Personal info (name, email, user IDs, address, phone), financial info, health
and fitness, messages, photos and videos, audio, files and documents, calendar,
contacts, **app activity** (no screen-view, interaction or search analytics; the
Analytics SDK is forbidden by the build), web browsing, and precise location.

### 3.4 GridView API traffic

Requests to the GridView API (Cloudflare Workers) expose the device IP address
to Cloudflare, as any network request does. GridView does not store or use it
beyond serving the request. This is ephemeral processing, provided the
production Worker keeps request logging off: `invocation_logs = false`, and no
application log line records an IP or a header. That condition is part of the
production Worker configuration (`production-release-plan.md`, W2). If the
production configuration ever persists IPs, this section must be revisited
(**review item R2**).

## 4. Review items for the privacy review

| # | Question | Engineering recommendation |
|---|---|---|
| R1 | Does Performance Monitoring's IP-to-country mapping count as **Approximate location**? | Declare it. Country-level location is coarser than Play's 3 km² threshold, so declaring is the conservative reading. Over-declaring is not a policy violation; under-declaring is. |
| R2 | Is Cloudflare's handling of the IP address ephemeral? | Yes, if the production logging condition in §3.4 holds |
| R3 | Deletion-request answer | GridView has no accounts, so Play's account-deletion requirement does not apply. The policy offers requests by email and states automatic retention (90 / 60 / 30 days). Answer "No" unless the review decides a manual request path counts. |
| R4 | Is the data collection optional? | **Required.** No in-app switch exists. Adding one would be a product change. |

## 5. Related store items

- **Privacy policy**: the 2.0.0 policy is `privacy_policies.md` / `privacy_policies.html`
  in this repository. It must be **published** at the listing's existing URL,
  https://gridview.netlify.app, before the release is submitted. Publishing is a
  separate, authorized step.
- **Ads declaration** (App content → Ads): change to **No**.
- **App access, content rating, target audience**: unchanged by this release.
