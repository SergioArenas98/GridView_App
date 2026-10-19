# Legacy storage fixtures

Representative on-device storage of the legacy app (`legacy-mobile-v1.2.1`,
versionCode 7), used by `test/legacy/`.

## `cache.hive`

A genuine Hive 2.2.3 box file (271 bytes, SHA-256
`d05114eb056454d32e75109b92728e39be45b526748a8d0eb9cb257e4d2e2ebd`) with the
layout `frontend/lib/services/api_service.dart` wrote: box `cache`, String
values under `grandprix_cache`, `drivers_cache`, `teams_cache` and an ISO-8601
`last_cache_update`. **All content is synthetic** — no provider or backend data.

The reconstruction never opens it and has no Hive dependency; the tests only
prove it is deleted (or left alone) as a file. It was produced by a throwaway
Dart program outside this repository, with `hive: 2.2.3`:

```dart
Hive.init(out);
final box = await Hive.openBox('cache');
await box.put('grandprix_cache', '[{"id":1,"name":"Synthetic Grand Prix","round":1}]');
await box.put('drivers_cache', '[{"id":1,"name":"Synthetic Driver","number":99}]');
await box.put('teams_cache', '[{"id":1,"name":"Synthetic Team"}]');
await box.put('last_cache_update', '2025-11-30T18:00:00.000');
await box.close();
```

`cache.lock` (empty, left when the legacy process was killed with the box open)
and `cache.hivec` (a compaction interrupted mid-rename) are created by the tests.

## Legacy preferences

The legacy app used `SharedPreferences.getInstance()` — the same package and
store as the reconstruction — and wrote only:

| Key | Type | Written when | Values |
|---|---|---|---|
| `languageCode` | String | the user picked a language | `en` `es` `it` `pt` `fr` `de` `ca` |
| `isDarkMode` | bool | the user toggled the theme switch | `true` dark, `false` light |

The tests seed these with `SharedPreferences.setMockInitialValues`, which
stores them under the same `flutter.` prefix the device file
(`shared_prefs/FlutterSharedPreferences.xml`) uses.
