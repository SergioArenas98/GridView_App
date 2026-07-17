# ADR 0001: Retain Flutter for the reconstruction

- Status: Accepted
- Date: 2026-07-18

## Context

GridView exists as a published Flutter Android application with the Google
Play identity `com.sejuma.gridview`. The reconstruction replaces most of the
code, but the new version must be published as an update to the existing
application, preserving its application ID, signing compatibility and
monotonically increasing version codes.

## Decision

Keep Flutter as the UI framework for the reconstructed application. Rebuild
the app as a feature-first modular monolith following the architecture in
`docs/technical/GridView_TRD.md` (Riverpod, `go_router`, Dio, Drift), instead
of migrating to a different framework.

## Consequences

- The Android project identity and signing path carry over with minimal risk.
- Existing Flutter knowledge and the published listing are preserved.
- The legacy code style (provider singletons, Hive cache, splash-blocking
  startup) is replaced deliberately rather than incrementally patched.
- Android remains the only target platform for v1; other platform directories
  were removed.
