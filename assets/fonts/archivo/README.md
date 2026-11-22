# Archivo (bundled font): provenance

Primer V2 typeface, bundled in Step 55B.1 with owner authorisation. Not
declared as an asset itself; `OFL.txt` and the font file are.

| Field | Value |
|---|---|
| Family | Archivo, Version 2.001 (`name` table: `2.001;OMNI;Archivo-SemiBold`) |
| Designer | Omnibus-Type |
| Copyright | Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo) |
| Licence | SIL Open Font License, Version 1.1 (`OFL.txt`, unmodified). No Reserved Font Name is declared. OS/2 `fsType` 0 (installable embedding). |
| Source | Official google/fonts repository, `ofl/archivo/`, revision `95f4904fc8bcf26d3420fe315560c96417c6dec7` (2026-03-03) |
| Font URL | https://raw.githubusercontent.com/google/fonts/95f4904fc8bcf26d3420fe315560c96417c6dec7/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf |
| Licence URL | https://raw.githubusercontent.com/google/fonts/95f4904fc8bcf26d3420fe315560c96417c6dec7/ofl/archivo/OFL.txt |
| Upstream | Omnibus-Type/Archivo, commit `b5d63988ce19d044d3e10362de730af00526b672` (per google/fonts `METADATA.pb`) |

## Files

| Bundled file | Original name | Bytes | SHA-256 | Git blob (matches the GitHub API listing) |
|---|---|---|---|---|
| `Archivo-Variable.ttf` | `Archivo[wdth,wght].ttf` | 658596 | `0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053` | `cc64253d36665a5ca0d6719cdf1e32b3de453b51` |
| `OFL.txt` | `OFL.txt` | 4388 | `108b4e57c9c796d3d38d0428ca7ee39de47ad93187302718d9b2d8864b9b716b` | `8597481ebc941863ab228e79ea4305507cd73cc6` |

The font file is byte-identical to the source; only the file name changed
(brackets and commas are awkward in asset paths). Renaming the file is not a
modification of the Font Software under the OFL.

## Why one file

- Primer V2 uses intermediate weights (650, 750, 820, 830, 850) and the width
  axis (`wdth` 72–118 in the prototypes); only the variable font provides them.
- google/fonts ships only variable files for Archivo. The italic file is not
  bundled: no shared Primer V2 component uses italic.
- Axes: `wght` 100–900 (default 600), `wdth` 62–125 (default 100).
- Coverage: 653 code points (latin, latin-ext, vietnamese), including every
  Spanish letter and mark checked (á é í ó ú ü ñ Á É Í Ó Ú Ü Ñ ¿ ¡ « » € º ª).

## Licence availability

- `OFL.txt` is bundled as an asset and registered with Flutter's
  `LicenseRegistry` at startup (`lib/core/theme/gv_font_licenses.dart`), so it
  is listed with the package licences in any Flutter licence page.
- The font's own `name` table carries the copyright and licence notices.
- The app currently has no screen that opens the licence page; adding one is a
  separate decision (it needs new UI copy).

## Updating

Fetch from google/fonts at a pinned revision, compare the Git blob and SHA-256,
update this table, and review every Primer V2 rendering before committing.
