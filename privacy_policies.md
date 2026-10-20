# GridView Privacy Policy

Last updated: 20 October 2026

This policy explains what information the GridView Android application
("GridView", "the app") processes, why, for how long, and what choices you
have. It covers **every version** of GridView:

- **version 2.0.0 and later** (sections 2 to 3.3); and
- **versions 1.x, up to and including 1.2.1** (section 3.4). They may stay
  installed on devices, and they may remain available on Google Play while
  version 2.0.0 is rolled out and for devices that cannot install it.

## 1. Who is responsible

GridView is an unofficial Formula 1 companion app. It is published on Google
Play under the developer name **Sejuma** by **Sergio Arenas del Amo**, an
individual developer based in **Spain**, who is the data controller for the
processing described here.

Contact: **gridviewapp1@gmail.com**

## 2. Summary

- GridView has **no user accounts** and never asks for your name, email address,
  phone number, contacts, photos, files or precise location.
- From version 2.0.0, GridView shows **no advertising** and contains no
  advertising or marketing SDK. Versions 1.x showed advertising banners from
  Google AdMob (section 3.4).
- GridView does **not** track which screens you open or what you tap.
- Your language and theme choices and the Formula 1 data the app downloads are
  stored **on your device**.
- To fix crashes and keep the app fast, GridView sends **crash reports and
  performance measurements** to Google's Firebase services. These are linked to
  a random installation identifier, not to you.
- To download Formula 1 data, the app contacts the **GridView API**, which runs
  on Cloudflare.

## 3. Information processed

### 3.1 Stored only on your device

| What | Why |
|---|---|
| Your language and theme choices | To show the app the way you chose |
| Formula 1 data downloaded from the GridView API (calendar, results, standings, drivers, teams, circuits) | To show it quickly and when you are offline |

This information is not sent to us. When you update from GridView 1.x, the app
reads the language and theme choices you made in the old version, keeps them,
and then deletes the old version's settings and cache.

If Android backup is turned on for your device, Android may include this app
data in your device backup with Google. That backup is controlled by your
device and Google account settings, not by GridView.

### 3.2 Requests to the GridView API

When the app downloads Formula 1 data, your device connects to the GridView API
over an encrypted connection (HTTPS). The API is hosted by **Cloudflare**, which
necessarily receives your device's **IP address** and standard request details
(time, requested resource and a random request number generated for each
request). Requests contain no account, device identifier or personal
information.

We use this only to deliver the data and to keep the service working and
secure. We do not use it to identify you or to build a profile, and any
operational logs are short-lived.

### 3.3 Crash reports and performance measurements (Firebase)

GridView uses **Firebase Crashlytics** and **Firebase Performance Monitoring**,
provided by Google, together with the Firebase components they need
(Installations, Sessions and Remote Config). They process:

- **Crash and error reports**: the stack trace, the state of the app when the
  problem happened, and a small set of fixed labels GridView adds (such as which
  feature was affected). GridView never adds your preferences' values, the
  content you viewed, web addresses or error messages to these reports.
- **Performance measurements**: for example app start time, the time taken by
  the app's own operations, and memory and processor use.
- **Device and app information**: device model and manufacturer, Android
  version, app version, language, country, time zone, available memory and
  storage, and network type.
- **Random installation identifiers**: a Firebase installation ID and a
  Crashlytics installation identifier. They identify an installation of the app,
  not a person, and are replaced when you clear the app's data.
- **IP address**: Firebase Performance Monitoring uses the IP address to work
  out which country a measurement comes from.

We use this information only to find and fix crashes and to improve
performance.

Retention, as published by Firebase: Crashlytics data is kept for 90 days.
Performance Monitoring keeps installation-linked performance data for 60 days
and IP-linked events for 30 days. Firebase installation identifiers are kept
until they are deleted.

### 3.4 GridView 1.x (version 1.2.1 and earlier)

Versions 1.x work differently from version 2.0.0. They contain no Firebase
Crashlytics or Performance Monitoring, and section 3.3 does not apply to them.
Instead:

- **Advertising (Google AdMob).** Versions 1.x show advertising banners through
  the **Google Mobile Ads SDK**, which starts when the app opens. Google
  collects and receives, through that SDK:
  - your device's **IP address**, from which an approximate location can be
    derived;
  - **app interactions** such as app launches, taps and ad views;
  - **diagnostic information** such as app launch time and performance;
  - **device identifiers**, including the Android **advertising ID** and app
    set ID.

  Google uses this information for advertising (including, where your
  settings allow, personalised ads), analytics and fraud prevention, under its
  own policies: https://policies.google.com/technologies/partner-sites.
  Versions 1.x **do not show a consent message** before ads are requested.
- **Unity Ads SDK.** Versions 1.x also include the Unity Ads SDK. The app's own
  code never starts it.
- **The 1.x data server.** Versions 1.x downloaded Formula 1 data from a
  separate GridView server hosted on Railway, which received your device's IP
  address with each request. That server has been shut down and no longer
  receives requests.
- **On the device.** Versions 1.x keep your settings and a cache of Formula 1
  data on your device. Updating to version 2.0.0 keeps your language and theme
  choices and deletes the rest (section 3.1).

**Your choices for versions 1.x:**

- Update to version 2.0.0 or later, which contains no advertising. It needs
  Android 7.0 or later.
- Reset or delete your advertising ID, or opt out of ad personalisation, in
  Android settings. Look for **Privacy → Ads** or **Google → Ads**, depending on
  your device.
- Uninstall the app.

## 4. Legal basis

For users in the European Economic Area, the United Kingdom and Switzerland, we
rely on our **legitimate interests** (Article 6(1)(f) GDPR):

- in delivering the Formula 1 data you ask the app to show (section 3.2); and
- in keeping the app stable and fast (section 3.3).

We have limited this processing to what those purposes need, as described
above.

The advertising in versions 1.x (section 3.4) is processed by Google for its
own purposes, as described in Google's policies. Versions 1.x did not ask for
consent to it. Version 2.0.0 removes it.

## 5. Who receives the information

We do not sell or rent your information. From version 2.0.0 we do not share it
for advertising or marketing. In versions 1.x, the advertising SDK sends the
information listed in section 3.4 to **Google**, which uses it for its own
advertising purposes: https://policies.google.com/technologies/partner-sites.

Information is processed on our behalf by these service providers, under their
data-processing terms:

- **Google** (Firebase Crashlytics and Performance Monitoring):
  https://firebase.google.com/support/privacy
- **Cloudflare** (hosting of the GridView API):
  https://www.cloudflare.com/privacypolicy/

These providers may process information outside your country, including in
the United States, under safeguards such as the European Commission's standard
contractual clauses or the EU-U.S. Data Privacy Framework.

We may also disclose information if the law requires it.

## 6. Your choices and rights

- **Stop all processing**: uninstall the app. Without the app, nothing is sent.
- **Reset the identifiers**: clear the app's data in Android settings. This
  gives the installation new random identifiers.
- **Your rights**: depending on where you live, you can ask for access to,
  correction or deletion of your information, or object to or restrict its
  processing. Write to gridviewapp1@gmail.com. Because GridView does not know
  who you are, we may need your help to find the information concerned (for
  example, the approximate date and time of a crash).
- **Complaints**: you can complain to a data protection authority. In Spain,
  this is the Agencia Española de Protección de Datos (https://www.aepd.es).

## 7. Children

GridView is a general-audience sports app. It is not directed at children, and
we do not knowingly collect personal information from children.

## 8. Links

The app can open your email app and web pages, such as this policy. Those apps
and websites have their own privacy policies.

## 9. Changes to this policy

If this policy changes, we will publish the new version at the same address and
update the date at the top. If a change materially affects how your information
is processed, we will also tell you in the app or on the GridView Google Play
page.

Section 3.4 stays in this policy for as long as versions 1.x are available on
Google Play or may still be in use.

## 10. Contact

Questions or requests about this policy: **gridviewapp1@gmail.com**
