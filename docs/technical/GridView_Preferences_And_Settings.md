# GridView — Preferences, theming, time display and Settings (Phase 8A)

Source of truth for the user-preference domain, the two themes, the
presentation-time policy and the Settings information architecture delivered in
**Phase 8A**.

Phase 8 was split during execution:

| Sub-phase | Scope | State |
|---|---|---|
| **8A** | Preferences, theming, localization, time display, Settings | **Complete, local only** |
| **8B** | Media selection, loading, disk cache, rights register, R2 pipeline | Not started |
| **8C** | Observability boundary, broad accessibility/performance hardening, Phase 8 documentation and closure | Not started |

**Phase 8 as a whole is not complete.** This document closes 8A only.

Related: `GridView_Design_System.md` (tokens), `GridView_Navigation.md`
(routing), `GridView_Environments.md` (flavors, Firebase, advertising),
`GridView_Synchronization.md` (data and freshness).

---

## 1. The typed preference domain

Three preferences, one domain, one owner
(`lib/core/preferences/`).

| Preference | Type | Values | Default |
|---|---|---|---|
| Language | `AppLanguagePreference` | `system`, `english`, `spanish` | `system` |
| Theme | `AppThemePreference` | `system`, `dark`, `light` | `dark` |
| Time display | `TimeDisplayPreference` | `device`, `event`, `both` | `device` |

`AppPreferences` is an immutable snapshot of all three. The **whole snapshot is
replaced** on every change, so a widget can `select` exactly the field it needs
and no preference is ever half-applied.

One repository (`AppPreferencesRepository`) owns all three. A preference never
gets its own repository or controller, and **no widget ever touches
`SharedPreferences`**.

### 1.1 Persisted keys and stable wire tokens

| Preference | Key | Tokens |
|---|---|---|
| Language | `gv.preference.language` | `system` \| `english` \| `spanish` |
| Theme | `gv.preference.theme` | `system` \| `dark` \| `light` |
| Time display | `gv.preference.time_display` | `device` \| `event` \| `both` |

Every value persists a **stable wire token** — never a localized label and never
an enum index. Reordering an enum or translating a label must not be able to
change what a user previously chose. Renaming a key would silently reset a
user's choice, so the keys are frozen.

A wire token is **never shown as display copy**: `PreferenceLabels` maps each
value to localized text, and `settings_widget_test.dart` asserts that the rows
show localized copy rather than tokens.

### 1.2 Defaults

The documented safe defaults are `AppLanguagePreference.fallback = system`,
`AppThemePreference.fallback = dark` and `TimeDisplayPreference.fallback =
device`. Dark is the flagship GridView theme and stays the default; the light
theme is opt-in.

`AppPreferences.defaults` is the state a first launch — or a completely
unreadable store — renders with.

### 1.3 Corrupted, read-failure and write-failure behaviour

Persistence is a narrow seam (`PreferenceStore`) with **synchronous reads**, so
the shell resolves theme and locale in the same frame it is built and there is
no wrong-theme flash.

| Situation | Behaviour |
|---|---|
| Key absent | Normal first launch. Default applied. **No** diagnostic. |
| Key holds an unknown/corrupted token | Default applied; `corruptedValue` diagnostic carrying **only the key**; repaired on the next successful write. |
| Value stored under another type | Reported as absent (`read` swallows the type error), then repaired on the next write. |
| Store cannot be opened at all | **Not a launch failure.** Falls back to an in-memory store, renders documented defaults, raises `storeUnavailable`. |
| Write fails | `writeFailure` diagnostic; the visible value for **that key only** reverts to the last persisted value, so visible and stored state never diverge silently. An unrelated preference selected meanwhile is never erased. |

`PreferenceDiagnostic` carries the preference **key and never the stored text**,
so a corrupted value can never be echoed into a report or onto a screen. It is
the seam the Phase 8C observability boundary will consume; today it has no
production sink.

Writes apply to the visible snapshot immediately and persist through a **single
serialized lane** with a per-key generation counter. Overlapping writes to the
same preference coalesce so the **latest user selection wins**
(`PreferenceWriteOutcome.superseded` is a success, not a failure).

### 1.4 Bootstrap ordering

`bootstrap()` (`lib/app/bootstrap.dart`) awaits exactly two local, bounded
things before `runApp`:

1. `ensureTimeZonesInitialized()` — the IANA database, so session times can
   render in event-local time before any refresh completes;
2. `AppPreferencesRepository.open()` — so the **first frame already has the
   right theme and language** instead of flashing defaults and correcting
   itself.

No network client, Firebase, advertising or backend dependency is initialized
here. The repository is injected into the `ProviderScope` as an override of
`appPreferencesRepositoryProvider`, which is why `AppPreferencesController` can
return a full snapshot synchronously with no loading state.

`AppSyncLifecycleScope` is mounted at the same composition root and still
schedules its startup run **after the first frame** (ADR 0015 is unchanged).

### 1.5 A preference change is not a data event

`GridViewApp` watches only `language` and `themeMode`, so a preference change
rebuilds **only the root widget**. The router, the database and the
synchronization owner below it are untouched: navigation, scroll position and
cached content survive, and **no remote request is issued**
(`settings_navigation_test.dart`).

---

## 2. Language resolution

`resolveAppLocale(preference, platformLocales, supportedLocales)` is a **pure
function** — every rule is testable without a `MaterialApp`.

- An explicit `english`/`spanish` **pins** that language and ignores every later
  platform locale change.
- `system` resolves to Spanish **only** when a supported platform locale
  resolves to Spanish, and otherwise falls back to English.
- Only the **language subtag** is matched, so `es_419`, `es_MX` and `en_GB`
  resolve to their supported base language rather than falling through.
- The first supported entry of an ordered platform list wins.
- Resolution is **total**: no input throws, and every result is a supported
  locale. `kFallbackLocale = en` (the source ARB locale, always complete).

`GridViewApp` passes the pinned locale to `MaterialApp.locale` *and* the same
rule to `localeListResolutionCallback`, so the pinned case and the
follow-the-platform case cannot disagree.

**EN/ES parity is a CI gate**: `test/l10n/arb_parity_test.dart` fails if the two
ARB files diverge in keys or placeholders.

---

## 3. Theming

### 3.1 system / dark / light

`AppThemePreference.themeMode` maps directly onto `ThemeMode`. Both themes are
produced by **one builder from one component configuration**
(`_buildTheme(brightness, colors, text)`), so they cannot drift apart
structurally — only the palette differs.

Two theme extensions carry the whole design language:

- `GvSemanticColors` — every role a widget needs (surfaces, text, dividers,
  accents, status, hero scrim, on-accent foregrounds);
- `GvTextStyles` — the typographic scale, resolved per theme.

Widgets read `context.gvColors` / `context.gvText`. **No feature widget branches
on `Brightness`.** The dark instances are identical value for value to the
constants they replaced, which is why every unrelated dark golden stayed
byte-identical when the light theme landed.

The light palette uses cool off-white and light-neutral surfaces rather than
large areas of pure white (pure white is reserved for small elevated cards,
where it reads as elevation), keeps the same hierarchy and the same restrained
red emphasis, darkens the accents that cannot reach contrast on a light surface,
and inverts the system status/navigation bar icon brightness.

> **Testing note.** `ThemeMode.system` **cannot** be pinned from `MaterialApp`'s
> `builder:`. MaterialApp resolves system brightness from the MediaQuery *above*
> itself, so an override installed in `builder:` never reaches theme selection
> and every test silently resolves against the host default. Pin it on
> `tester.platformDispatcher.platformBrightnessTestValue` and clear it on
> teardown. This is a real defect that was fixed in `f4038ed`; before it, a
> system-theme assertion could pass for the wrong reason.

### 3.2 The intentional primary-button contrast change

The decorative red `GvColors.accentPrimary` (`#FF3B30`) measures **3.55:1**
against white — enough for the 3:1 required of a non-text UI component, but
**below AA** for the filled primary button's 15px label.

A dedicated role was therefore introduced:

```
GvColors.accentPrimaryStrong      = #DC2626   // 4.83:1 with white
GvColorsLight.accentPrimaryStrong = accentPrimary (#C62719, already 5.7:1)
```

`accentPrimaryStrong` is used **only** as `ElevatedButton.backgroundColor`.
The decorative red is untouched everywhere else — navigation selection, bars,
icons, chips and selection indicators all keep `accentPrimary`.

**This intentionally changed 11 pre-existing dark goldens.** They were
regenerated in `2d0d3c2` and re-verified pixel by pixel at closure: in every one
of them the changed pixels form a single band the height of one button, the
maximum per-channel delta anywhere in the image is exactly `0x23` (the R-channel
distance from `#FF3B30` to `#DC2626`), and the decorative red still occupies its
usual pixels. See §8.

Consequence to state plainly: **the final Phase 8A dark goldens are not
byte-identical to the Phase 7 baseline `e285ea1`.** Eleven of them differ, on
purpose, for accessibility.

### 3.3 Hero scrim semantic roles

`GvHeroCard` fades its background image toward the page background so hero text
always has a readable base. Both gradient stops used to be hardcoded dark
literals — correct for dark, wrong for light, where the scrim darkened the
bottom of the image exactly where near-black text is drawn.

They are now theme-owned roles:

| Role | Dark | Light |
|---|---|---|
| `heroScrimTop` | `0x33000000` | `0x33FFFFFF` |
| `heroScrimBottom` | `0xCC0B0D12` | `0xCCF1F4F9` |

The bottom stop is the theme background at 80%, which is what makes the fade
read as running *into the page* rather than as a grey wash over the image.

**The dark values are the previous literals, unchanged.** `4506a8d` therefore
touched no PNG at all, and every dark golden is byte-identical across that
commit. That is a statement about `4506a8d` only — it does **not** mean the
final Phase 8A dark goldens match the Phase 7 baseline, because the earlier
accessibility correction in §3.2 intentionally changed eleven of them.

### 3.4 Contrast methodology

`test/design_system/theme_contrast_test.dart` asserts WCAG 2.x relative-luminance
contrast ratios deterministically, for **both** palettes, from the semantic
tokens themselves (not from rendered pixels):

- `textPrimary` and `textSecondary` ≥ **4.5:1** on all four surfaces;
- `textMuted` ≥ **4.5:1** on the three main surfaces;
- status/emphasis accents used as text (`accentPrimary`, `accentSecondary`,
  `success`, `warning`, `info`, `stale`) ≥ **4.5:1** on `surfaceElevated`,
  because they carry small text;
- on-accent foregrounds ≥ 4.5:1 on their fill.

**Decorative team colours are deliberately exempt** from text contrast: they are
never the sole carrier of meaning. What *is* required is that any text placed on
a team accent goes through `GvTeamAccent.foregroundOn`, which measures both
candidate foregrounds against pure black/white and keeps the better one. The
previous implementation compared luminance against a fixed `0.45` threshold and
returned the wrong side for mid-luminance liveries (a saturated orange scored
2.35:1); that was fixed in `2d0d3c2`.

---

## 4. Presentation-time policy (Device / Event / Both)

`SessionTimePresenter` (`lib/core/time/session_time.dart`) is the **one**
presentation-time policy in the application. Widgets never convert instants
themselves.

| Preference | Behaviour |
|---|---|
| `device` | The device clock, always. |
| `event` | The event's **declared IANA zone**. A zone is never inferred from a country; a missing or unresolvable zone falls back to the device clock **and is labelled as the device clock**, so an event-zone value is never claimed that was not computed. |
| `both` | Event clock led, device clock as a second line — collapsing to a single value when the two coincide or when the event zone is unavailable, because identical output in two clocks is one fact, not two. |

`PresentedTime.crossesDay` keeps the full date visible on both lines when a
conversion moves a session into the previous or next day, so a day boundary is
never hidden.

Calendar-only dates are formatted from their **date components with no timezone
conversion at all**, so they never shift. A null instant stays null: a missing
time never becomes midnight. Time-of-day formatting uses `DateFormat.Hm`, which
follows the locale's own 12/24-hour convention — which is why there is no
separate 12/24-hour preference.

### 4.1 Every live surface that uses the policy

Session **instants** — all go through `sessionTimePresenterOf(context, ref)`,
which reads locale from `context` and preference + device zone from providers:

| Surface | Path |
|---|---|
| Home — next/live session block | `home_session_block.dart` → `SessionList`, and `HomeFormatter.time` (wired at `home_screen.dart:590`) |
| Grand Prix detail — session schedule | `grand_prix_detail_screen.dart:130` → `SessionList` |
| Shared session list | `shared/presentation/widgets/session_list.dart` |

Calendar-only **dates** — these construct a bare `SessionTimePresenter` for
`formatDateRange` only, which takes no preference and performs no conversion, so
they are preference-independent by construction:

| Surface | Path |
|---|---|
| Calendar event card | `calendar_event_card.dart` |
| Grand Prix hero | `grand_prix_hero.dart` |
| Grand Prix event info | `grand_prix_event_info.dart` |

---

## 5. Settings

### 5.1 Route hierarchy and origin restoration

Settings and **every** sub-screen live on the **root navigator**, above the
shell. Settings is therefore never a shell branch: opening it does not change
the active bottom-navigation branch, and Android back walks down through the
Settings stack and returns to the exact origin — including its scroll position —
rather than to a default tab. **Settings remains a secondary screen.**

```
/settings
├── /settings/language          language selection
├── /settings/theme             theme selection
├── /settings/time              time-display selection
├── /settings/data              data and updates (read-only)
├── /settings/acknowledgements  credits (read-only)
├── /settings/privacy           privacy and legal (read-only + optional action)
└── /settings/about             application information (read-only)
```

Each preference row shows its own current value in localized copy and pushes a
focused selection screen. Selection screens expose **radio-group semantics**, so
the selected option is not conveyed by colour alone.

> `go_router`'s `routeInformationProvider.value.uri` does **not** update on an
> imperative `push`, so Settings navigation tests assert on rendered screens
> rather than on the URL, and a branch below an opaque pushed route is offstage
> (`skipOffstage: false`).

### 5.2 Safe `PackageInfo` access

`AppInfoReader` is an injected seam; `PackageAppInfoReader` wraps
`package_info_plus`. `appInfoProvider` catches **any** failure and resolves to
`AppInfo.unknown`, whose `version`/`buildNumber` are empty strings. The About
screen then renders the field **empty rather than guessed**: a stale literal
version is worse than none, because it is confidently wrong. A failing platform
channel never breaks the Settings screen, and no test touches a real channel.

### 5.3 Development/staging vs production configuration visibility

One predicate governs both call sites:

```dart
bool showsConfigurationStatus(AppEnvironment e) => !e.isProduction;
```

Outside production, a missing policy URL or contact address is useful to whoever
is building the app, so a **localized, non-technical** status is shown — never a
build-define key or an internal configuration name
(`settings_widget_test.dart`: *"a non-production status note names no build
define"*).

In production it is not shown at all: a user cannot act on it, a row that
explains its own absence reads as a fault, and a tappable action that cannot
open anything is worse. The affordance is **omitted entirely**. The absence
itself is a release blocker tracked here (§7), not a runtime message.

Either way there is never a tappable control that cannot open anything.

The Developer section (component catalogue) exists only outside production.

### 5.4 Privacy and legal

The screen reports each platform service from the build's **real configuration**,
so it cannot claim a service that is not running. Today all three read
*disabled*: crash reporting, performance monitoring and advertising.

Privacy-policy behaviour:

| Environment | Policy configured | Rendered |
|---|---|---|
| dev / staging | yes | Tappable "open policy" row |
| dev / staging | no | Localized status paragraph explaining the absence |
| production | yes | Tappable "open policy" row |
| production | no | **Nothing** — no row, no status |

`PRIVACY_POLICY_URL` has **no default**, because inventing one would be a false
claim that a policy is hosted.

### 5.5 Feedback and contact

Feedback is an **action**, not a route. `SUPPORT_CONTACT` defaults to the address
already published in the application's privacy policy, so in a normal build the
row is a working `mailto` action rather than a dead end. With no valid contact,
production omits the row entirely and dev/staging state the status.

`ExternalLink` is an **allow-list by construction**: a link is either a validated
`https` URL (non-empty host, no embedded credentials, never cleartext `http`) or
a validated `mailto` address, and nothing else can be launched. **No URL that
arrives in API content is ever opened.** A launch failure is reported through a
localized snackbar **without exposing the URL** or any platform exception.

### 5.6 Acknowledgements

A pure read of locally persisted media metadata and the actually-configured data
source — it issues no request, so it works offline once the content manifest has
synchronised. Credits are deduplicated across size variants, and an asset with no
attribution simply does not appear: an absent credit is never rendered as a
credit for "unknown". Only the configured data source is acknowledged; no
third-party Formula 1 provider is named, because none is configured.

The stored credits are injectable through the test harness, so the populated
state is covered from repository-owned fixtures without opening Drift.

### 5.7 The Data screen is deliberately incurious

It reports environment, data source, API version and current season, and
**never** a base URL, query parameter, ETag, request id, resource key, entity
id, token or namespace. Opening Settings performs **no refresh**.

---

## 6. Platform decisions

### 6.1 Advertising — disabled for v1

- No `google_mobile_ads`, no consent SDK, **no ads dependency at all**.
- No ad unit IDs anywhere.
- The production **AdMob application ID** is preserved as a manifest
  `meta-data` entry in `android/app/src/production/AndroidManifest.xml` for the
  published app identity only. It is an identifier, not an SDK: nothing reads it
  and no advertisement is requested in any flavor. Dev and staging manifests do
  not carry it.
- `GvAdContainer` exists in the design system but is referenced **only** from
  the development component catalogue; it is unreachable from every live screen.
- No post-Phase-7 approval to ship advertising exists anywhere in the
  repository, so the default applies: **not retained for v1.**
- The Privacy screen therefore reports advertising as *disabled*, truthfully.

### 6.2 Firebase — activated in production only (Phase 8C-1)

- `android/app/src/production/google-services.json` is committed and genuine:
  project `gridview-fb20f`, android package `com.sejuma.gridview` — which
  matches the real production `applicationId` exactly, so the configuration is
  owned rather than fabricated. It declares only `appinvite_service`. The
  embedded key is an Android Firebase key (shipped in every APK by design), so
  its presence is **not** a secret leak. **Phase 8C-1 left it byte-identical.**
- There is still **no** dev or staging `google-services.json` and no
  `firebase_options.dart`. The Google services Gradle plugin is applied to every
  variant; only its `process<Variant>GoogleServices` task is enabled, for the
  production flavor alone.
- **Phase 8C-1 added the FlutterFire dependencies** (`firebase_core`,
  `firebase_crashlytics`, `firebase_performance`) behind a single application
  boundary. The **native components are packaged in every flavor** — Dart
  dependencies are not flavor-scoped — so it is wrong to say no Firebase SDK is
  initialized outside production. What is true: collection is disabled by
  manifest policy in all flavors, only an eligible production build turns it on
  at runtime, and only production initializes the Dart adapters.
- The Privacy screen no longer hardcodes these statuses, and no longer derives
  them from build eligibility either. It reads the live `ObservabilityStatus`
  (Disabled / Starting / Enabled / Unavailable), so it cannot claim diagnostics
  are running before activation has finished or after it has failed, and it
  discloses that diagnostic components ship in every version of the app while
  transmission is restricted by policy.
- **Crashlytics and Performance Monitoring must still not be claimed to
  *deliver*.** The code is complete and locally verified, but no event has been
  observed in Firebase Console; that needs an authorized release-like build and
  console access and remains an **external closure blocker** (§7). See
  `GridView_Observability.md`.

### 6.3 `package_info_plus` compatibility decision

Pinned to **`^10.2.1`**. Version 9.0.1 does **not** compile in this project: it
applies its own Kotlin Gradle Plugin and analysis of `PackageInfoPlugin.kt`
fails with `source must not be null`. **Do not downgrade.**

### 6.4 Dependencies added in Phase 8A

| Package | Used by 8A? | Note |
|---|---|---|
| `shared_preferences: ^2.5.5` | yes | The only preference persistence mechanism. Preferences never use Drift. |
| `package_info_plus: ^10.2.1` | yes | Real package metadata for About. See §6.3. |
| `url_launcher: ^6.3.2` | yes | Allow-listed `https`/`mailto` only. |
| `flutter_cache_manager: ^3.4.1` | **no** | Declared ahead of use for the Phase **8B** media byte cache. It has **zero call sites** today. Left in place deliberately rather than removed and re-added; if 8B slips, drop it. |

---

## 7. External blockers (cannot be closed from this repository)

1. **Firebase dev/staging projects** do not exist. Creating them requires
   account access and approval. Until then, observability cannot be activated
   outside production and crash/performance reporting is reported as off there.
   Production observability is implemented (Phase 8C-1) but **operationally
   unverified**: no crash, non-fatal or trace has been observed in Firebase
   Console, which needs an authorized release-like production build and console
   access. A green test suite is not evidence of delivery.
2. **Privacy policy URL** is unset (`PRIVACY_POLICY_URL`). A production build
   with no policy URL shows no policy affordance at all. Publishing a policy and
   supplying the URL is a **release blocker**, tracked here rather than surfaced
   to users at runtime.
3. **Advertising approval** does not exist. Absent an explicit decision,
   advertising stays out of v1.

---

## 8. Visual coverage

Phase 8A added **25** golden images and modified **11** pre-existing ones. No
golden was deleted.

| Group | Count | Theme |
|---|---|---|
| Light-theme screen goldens | 8 | light |
| Settings goldens | 16 | 13 dark, 1 light, 2 dark at 200% text |
| Light component sheet | 1 | light |
| **Added total** | **25** | |
| Pre-existing goldens modified by the button-contrast change | 11 | dark |

Every input to every image is pinned: theme preference, platform brightness,
locale, surface size, text scale, clock, device time zone, data-source mode,
package metadata, external-link configuration and synchronization metadata, with
animations disabled so no frame is captured mid-transition.

Media renders as placeholders because Phase 8B has not started.

**Baselines are authored on Linux.** After Phase 8A the whole golden corpus was
canonicalized on the CI platform: `07efdd5` changed a visible line break without
regenerating the affected baselines, and the 2% execution tolerance was large
enough to hide that ~1.7% drift locally until cross-platform variance exposed it
in CI. A Linux-only **canonical golden freshness** gate now requires zero drift,
and the **Render canonical goldens** workflow lets any developer author a baseline
without installing Linux. See `docs/testing/README.md`.

**The `flutter_test` font draws no real glyphs.** These images therefore verify
layout, colour, hierarchy, wrapping and clipping only. Visible copy — that a
preference value is localized rather than a wire token, that the Data screen
names no URL or token, that a status note names no build define, that the
"Sample data" banner appears only when the build really reads fixtures — is
asserted by widget and semantics matchers in `settings_widget_test.dart`, not by
goldens.

---

## 9. Phase 8A status and hand-off

**Phase 8A: complete.** Ten commits on `master`, verified locally.
**Phase 8 is not complete.**

Delivered: typed persisted preferences; light theme and the two theme
extensions; language preference and total locale resolution; the single
presentation-time policy; the Settings information architecture with seven
sub-routes; the EN/ES ARB parity gate; light-theme, Settings, theme and locale
visual and behavioural coverage.

### Hand-off to Phase 8B (media)

- Media is placeholder-only today. `GvImagePlaceholder` is proven visible on
  **both** palettes (the light component sheet exists to pin exactly that).
- `flutter_cache_manager` is already declared (§6.4) and owns the only intended
  media byte cache. **Image bytes must never enter Drift.**
- `MediaAttribution` and `mediaAttributionsProvider` already exist and already
  drive the Acknowledgements screen; 8B must populate them from the real rights
  register rather than replacing the read path.
- The media URL policy that `ExternalLink` mirrors (`https` only, non-empty
  host, no embedded credentials) is the policy 8B must apply to image URLs.

### Hand-off to Phase 8C (observability, hardening, closure)

- `PreferenceDiagnostic` is the ready-made, PII-free seam for the observability
  boundary: it already carries a kind and a key and never the stored value.
  Wire the boundary to it rather than inventing a second diagnostic channel.
- The boundary must be **platform-neutral**: Firebase cannot be activated
  (§6.2), so 8C delivers the abstraction plus a setup checklist, not a
  Crashlytics integration.
- Accessibility hardening beyond Settings, performance measurement, the
  advertising decision document and the Phase 8 documentation set all remain
  open.
- Known cleanup, deliberately **not** folded into Phase 8A:
  `lib/features/shared/presentation/placeholder/placeholder_content.dart` and
  its only two consumers, `widgets/event_row.dart` and `widgets/event_status.dart`,
  are dead code — nothing on a live screen references them. The §22 invariant
  ("no live screen imports `placeholder_content.dart`") holds, but the files
  should be deleted in a dedicated cleanup commit.
