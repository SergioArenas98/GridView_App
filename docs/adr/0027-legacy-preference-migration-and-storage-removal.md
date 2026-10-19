# ADR 0027: Legacy preference migration and legacy storage removal

- Status: Accepted
- Date: 2026-10-19

## Context

The reconstruction installs as an update over the published legacy app
(`com.sejuma.gridview`, versionName 1.2.1, versionCode 7). ADR 0004 kept the
legacy Hive files untouched and deferred their removal to "a future ADR".
`GridView_Implementation_Plan.md` §15.2 asks Phase 10 to preserve language,
theme and — where legally reusable — consent, and to discard the legacy API
cache, image paths, synchronization timestamps, unsupported preferences and
provider-specific data.

What the legacy app actually stored was read from its source
(tag `legacy-mobile-v1.2.1`), not inferred from the plan:

| Storage | Legacy writer | Content |
|---|---|---|
| `SharedPreferences` `languageCode` (String) | `LanguageProvider.setLocale`, on user selection | `en` `es` `it` `pt` `fr` `de` `ca` |
| `SharedPreferences` `isDarkMode` (bool) | `ThemeProvider._saveThemeToPrefs`, on toggle | `true` dark / `false` light |
| Hive box `cache` in the documents directory (`cache.hive`, `cache.hivec`, `cache.lock`) | `ApiService` | raw backend responses under `grandprix_cache`, `drivers_cache`, `teams_cache`, and `last_cache_update` |

Nothing else was persisted: no consent state, no image paths (images were
bundled assets), no other preference. Both apps resolve the same
`shared_preferences` package (identical lockfile hash) through
`SharedPreferences.getInstance()`, so the legacy keys are in the store the
reconstruction already uses.

## Decision

1. **Language and theme are migrated once, before the preference repository
   opens**, so the first frame already shows them.
   - `languageCode` `en` → `english`, `es` → `spanish`. The legacy selector
     pinned the app to the chosen language regardless of the device locale,
     which is what the reconstruction's explicit values mean.
   - `it` `pt` `fr` `de` `ca` are not offered by the reconstruction and are
     **not** migrated; the new default (`system`) applies.
   - `isDarkMode` `true` → `dark`, `false` → `light`. The legacy app wrote the
     key only when the user flipped the switch, so both are explicit choices.
   - An **absent** legacy key is not migrated. The legacy defaults (English,
     light) were not user choices; the reconstruction's documented defaults
     (`system`, `dark`) apply.
   - Any other type or content is invalid and ignored. It never blocks
     startup and never raises a diagnostic: it is not a fault of this build.
2. **A reconstruction key that already holds a valid value is never
   overwritten.** A choice made in this app always wins over a legacy one. A
   reconstruction key holding a **corrupt** value (unknown token or wrong type)
   is not a choice — it would render as the default — so a valid legacy choice
   replaces it instead of being lost when the legacy key is cleaned up.
3. **Completion is recorded** by `gv.migration.legacy_preferences = v1`, written
   last. Its presence short-circuits later runs; without it, a rerun yields the
   same result (rule 2), so the migration is idempotent. A failed write leaves
   the migration incomplete and raises the existing `writeFailure` preference
   diagnostic; the next launch retries.
   **A failed read is not an absent key.** If the marker, a legacy key or a
   reconstruction key cannot be read, the migration stays incomplete, no marker
   is written, and therefore the cleanup removes nothing; the next launch
   retries.
4. **Consent is not migrated.** The legacy app never persisted any consent state
   (it initialized Mobile Ads without UMP), so there is no stored value whose
   legal meaning could be shown to be equivalent. The reconstruction ships no
   advertising and no consent SDK (ADR 0018). Any `IABTCF_*` or other keys an
   advertising SDK may have written are SDK-owned, not produced by legacy app
   code, and are left untouched pending a separate decision.
5. **Legacy storage is removed only after a completed migration and a rendered
   first frame.** Bootstrap schedules the cleanup as a post-frame callback; the
   cleanup does nothing unless the marker is stored. It deletes exactly
   `cache.hive`, `cache.hivec` and `cache.lock` in the documents directory and
   the two legacy keys. It keeps the marker, never touches
   `gridview_v2.sqlite` or any other file, and is retried on the next launch if
   any removal fails.
6. **The Hive box is never opened or read.** The reconstruction has no Hive
   dependency (enforced by `test/legacy/legacy_isolation_test.dart`), so no
   legacy API cache, timestamp or provider data can reach the Drift database.

## Consequences

- An upgraded user keeps an explicit English/Spanish and dark/light choice.
- A legacy user who never touched Settings moves from the legacy defaults
  (English, light) to the reconstruction defaults (device language, dark). A
  legacy user who picked Italian, Portuguese, French, German or Catalan gets
  the device language if it is Spanish, otherwise English.
- Production keeps Android Auto Backup enabled (as the legacy app did), so a
  restore can deliver legacy keys and Hive files to a device already running
  the reconstruction. The same migration and cleanup handle that case.
- Supersedes ADR 0004's "legacy files are not deleted" for the files listed
  above; ADR 0004's file-identity decision is unchanged.
- Advertising SDK residue of the legacy app (its own preference files and
  caches) is out of scope here and is not removed.

## Verification still owed

Unit and widget tests cover populated, empty, corrupt and repeated-upgrade
storage. They cannot prove the real upgrade path: installing the
Play-signed reconstruction over an installed Play-signed 1.2.1 on a device,
through Google Play, per the §15.3 upgrade matrix. That remains Phase 10 work.
