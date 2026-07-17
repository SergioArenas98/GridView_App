# GridView Project Instructions

The documents under `/docs` are the source of truth for the GridView reconstruction.

The current `/frontend` and `/backend` structures are legacy structures and may be reorganized or replaced according to the architecture defined in the project documents.

The production Android application ID must remain:

`com.sejuma.gridview`

Do not implement features outside the scope defined in the PRD.

Do not use the legacy Spring Boot, MySQL or scraper architecture as the foundation of the new application.

Before making implementation changes, follow the phases and acceptance criteria defined in `GridView_Implementation_Plan.md`.

## Google Play continuity - Non-negotiable requirements

The reconstructed application must be published as an update to the existing
GridView application.

- The production Android application ID must remain:
  `com.sejuma.gridview`

- Do not create a new Google Play application or introduce a different
  production package name.

- Do not replace or regenerate the Android project configuration blindly.
  The Flutter source code and project structure may be rebuilt, but the
  production application identity must be preserved.

- Keep the production signing configuration compatible with the existing app.

- Release signing credentials must be loaded from ignored local files or CI
  secrets. Never commit `.jks`, `.keystore`, `key.properties`, passwords or
  private certificates.

- Do not invent the next production `versionCode`. Before preparing a release,
  obtain the highest version code currently registered in Google Play Console
  and use a greater value.

- Do not change Firebase, AdMob or certificate fingerprints without first
  reviewing their relationship with the existing production application.

- Before making release-related Android changes, report:
  - Current `applicationId`
  - Current namespace
  - Current version name and version code
  - Signing configuration files used
  - Any proposed change that could affect update compatibility