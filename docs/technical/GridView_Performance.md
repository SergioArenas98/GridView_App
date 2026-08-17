# GridView - Performance

## Document information

- Product: GridView
- Document type: Performance evidence and status (implementation)
- Status: **Phase 8C-3 measurements taken on flagship reference hardware with no
  approved media.** Representative mid-range acceptance and real-media
  measurements are **deferred to Phase 10 and the media-publication owner**. No
  measurement below is an acceptance result.
- Related documents:
  - `GridView_TRD.md` §§ performance requirements (including the
    representative-device requirement, which is **not** weakened here)
  - `GridView_Media.md` §20 (the media performance protocol)
  - `GridView_Implementation_Plan.md` §13.2, §15 (Phase 10 performance tasks)
  - `GridView_Accessibility.md` (the sibling Phase 8C-3 evidence document)
- Document date: 2026-08-17

---

## 1. Measurement environment

| Aspect | Detail |
|---|---|
| Build | Staging **profile** APK, application ID `com.sejuma.gridview.staging` |
| Device | Authorized physical HONOR **DNP-NX9** |
| OS | Android 16 |
| SoC | Qualcomm Snapdragon 8 Gen 3 (`SM8650`), 8 cores |
| Memory | ≈ 11 GiB RAM |
| Display | 1280 × 2800, 60/90/120 Hz capable, device pixel ratio **3.5** |
| Tooling | Dart VM service driven over `adb`; JSON-RPC for scalars, a WebSocket client for timeline stream control |
| Not used | No browser, no DevTools UI, no permanent instrumentation, no runtime code added |
| Safety | Production package preserved and field-compared identical; staging package uninstalled afterwards |

> **The DNP-NX9 is flagship-class hardware. It is not a representative mid-range
> device.** A current flagship SoC, ≈ 11 GiB of RAM, a 120 Hz panel and a 3.5×
> pixel ratio place it at the top of the market. Every figure in this document is
> therefore a **best-case-hardware** observation and must never be read as a
> floor, nor as satisfying the TRD's representative-device requirement.

### 1.1 Refresh-rate ambiguity

The panel offers 60 / 90 / 120 Hz. During the runs the system reported an active
render frame rate of 120 Hz, while the application's own surface was observed
signalling a desired refresh rate of 60 Hz to the variable-refresh handler. The
applicable frame budget is therefore either **8.33 ms** or **16.67 ms**, so both
counts are reported throughout and neither is presented as the verdict.

**No janky-frame threshold is agreed for this project**, and none was invented.
The TRD asks for janky frames "below an agreed threshold"; that threshold does
not exist yet, so the numbers below are observations, not pass/fail results.

---

## 2. Media feasibility boundary

This is the single most important qualification on everything that follows.

- Collection endpoints supplied **no media descriptor at all**.
- Detail endpoints supplied **mock** descriptors pointing at
  `media.gridview.local`.
- That host **did not resolve**.
- The URLs nevertheless **passed `MediaUrlPolicy`** — HTTPS, non-empty host, no
  embedded credentials — so the application genuinely attempted the requests.
- **Zero image bytes were fetched.**
- **Zero images were decoded.**
- Flutter's `ImageCache` remained **empty** for the whole session.
- The on-disk media cache remained **empty**: zero objects, zero index rows.
- **No synthetic, substitute or unapproved media was introduced**, no local media
  server was used, and `MediaUrlPolicy` was never bypassed.

The rendered result — a stable placeholder in every media slot, with no broken
image, no error text and no layout shift — is the **correct fallback behaviour of
a working architecture**. It is emphatically **not** a media-performance success
result: nothing about decode cost, cache pressure or eviction was exercised,
because there was nothing to exercise it with.

---

## 3. P1–P10 status

| Item | Classification | What that means here |
|---|---|---|
| **P1** Explore scrolling | **Provisional** | One aggregate capture containing five fling cycles per category and cache state; flagship hardware; placeholder-only lists. Not representative mid-range acceptance. |
| **P2** Decode vs rendered size | **Blocked** | No approved remote media was decoded, so no decoded dimension exists to compare. |
| **P3** `ImageCache` occupancy | **Partial** | One empty-media observation. The three-process protocol was not completed. |
| **P4** Disk-cache footprint | **Partial** | Empty store measured exactly. Populated footprint and eviction blocked. |
| **P5** Repeated-navigation memory | **Complete, with a limitation** | Four journeys × three runs × twenty round trips = 240 round trips. No monotonic Dart-heap retention. No media pressure. |
| **P6** Rebuild scope | **Partial** | One aggregate measurement per change. Per-widget attribution unavailable in profile mode. |
| **P7 / P8** Startup | **Phase 10** | Not in Phase 8 scope. |
| **P9** Offstage prefetch | **Complete** | Permanently automated by commit `ae46ba9`. |
| **P10** | **Phase 10** | Not in Phase 8 scope. |

A partial or blocked measurement is **not** a pass and is never recorded as one.

---

## 4. Retained measurements

### 4.1 P1 — Explore scrolling (provisional, non-media baseline)

Journey: from the top of the category, five fling cycles of a fixed swipe and
its reverse, per category and cache state. Build mode profile. *Cold* means the
first visit of that category in a fresh process — there is no media cache to be
cold, so the label describes process and stream warm-up only.

Milliseconds. UI thread is the frame's build/layout/paint work; raster is the
raster thread. Over-budget counts take the worse of the two per frame.

| Run | Frames | UI med | UI p99 | UI worst | Raster med | Raster p99 | Raster worst | > 8.33 ms | > 16.67 ms | > 32 ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Drivers · cold | 310 | 0.65 | 1.19 | 1.97 | 3.34 | 5.64 | 7.59 | 0 | 0 | 0 |
| Drivers · warm | 330 | 0.64 | 1.25 | 1.36 | 3.45 | 5.81 | 21.02 | 1 | 1 | 0 |
| Teams · cold | 387 | 1.13 | 1.72 | 6.03 | 3.10 | 5.79 | 8.27 | 0 | 0 | 0 |
| Teams · warm | 338 | 0.96 | 1.38 | 1.62 | 3.22 | 5.51 | 19.62 | 2 | 1 | 0 |
| Circuits · cold | 353 | 0.95 | 1.76 | 6.86 | 2.84 | 5.38 | 11.98 | 1 | 0 | 0 |
| Circuits · warm | 307 | 0.83 | 1.19 | 1.28 | 3.12 | 4.86 | 5.50 | 0 | 0 | 0 |

2 025 frames across six runs. Both budget columns are reported because the
refresh-rate interpretation is ambiguous (§1.1).

**Repetition accounting.** Each row is **one aggregate capture that contains five
fling cycles**, not five independently reportable repetitions: the timeline was
cleared once before the journey and read once after, so per-cycle boundaries are
not delimited in the captured data. Describing this as "five repetitions" would
be wrong.

**Further limitation.** The collections hold 8, 6 and 5 rows against this
dataset, so the scroll extent is barely more than one screen. This is a small
placeholder-only baseline, not a scroll-heavy media list.

### 4.2 P2 — decode versus rendered dimensions

**Blocked.** Not executed. Recorded factually: the Explore row slot renders at 40
logical pixels square at a device pixel ratio of 3.5, so the physical requirement
is 140 pixels. Nothing beyond that is claimed — no decoded size is inferred from
a URL or from source metadata, and the variant the selector would choose is not
presented as a decode result.

### 4.3 P3 — Flutter `ImageCache` occupancy (empty-media observation)

Read from the allocation profile after visiting every Explore category and all
three detail types.

| Class | Instances | Accumulated | Meaning |
|---|---:|---:|---|
| `ImageCache` | 1 | 1 | the singleton exists |
| `_CachedImage` | 0 | **0** | `currentSize` and `currentSizeBytes` were 0 for the entire session |
| `_PendingImage` | 0 | 0 | nothing ever pending |
| `Codec` / `_Image` / `FrameInfo` | 0 | 0 | not one image was ever decoded |
| `FileImage` | 0 | 0 | no file provider ever resolved |
| `MediaImageRequest` | 5 | 5 | five media requests were genuinely formed |
| `CachedMediaImageLoader` | 1 | 1 | the production loader was installed, not a fake |

Because `_CachedImage` has **zero accumulated** instances, occupancy was not
merely zero at rest — it was never non-zero. **This is an empty-media
observation, never a cache-pressure measurement.** The protocol asked for three
repetitions in three fresh processes; **one** was recorded.

### 4.4 P4 — disk-cache footprint (empty store)

Read only from the staging package's own storage, created during the pass.
Production and dev storage were never opened.

| Item | Value |
|---|---|
| Media object store | **0 files** |
| Cache index rows | **0** |
| Cold state | empty |
| After the journey | still empty — zero bytes written |

**Populated footprint and eviction behaviour were not exercised** and are
blocked (§2).

### 4.5 P5 — repeated-navigation memory (complete, no media pressure)

Four journeys, three runs each, twenty detail round trips per run — **240 round
trips**. Each run: settle, forced GC, sample; twenty round trips; sample; forced
GC and settle; sample. Dart heap on the main isolate.

| Journey | Run | Before | After | After GC | Δ vs run 1 |
|---|---|---:|---:|---:|---:|
| Explore → driver detail | 1 | 18.92 MB | 22.46 MB | 18.91 MB | — |
| | 2 | 18.91 MB | 32.97 MB | 18.92 MB | +2.6 KB |
| | 3 | 18.92 MB | 21.59 MB | 18.92 MB | +3.2 KB |
| Explore → team detail | 1 | 18.73 MB | 19.69 MB | 18.71 MB | — |
| | 2 | 18.71 MB | 23.69 MB | 18.71 MB | +2.0 KB |
| | 3 | 18.71 MB | 20.53 MB | 18.71 MB | +2.7 KB |
| Explore → circuit detail | 1 | 18.60 MB | 23.05 MB | 18.66 MB | — |
| | 2 | 18.66 MB | 30.70 MB | 18.66 MB | +2.1 KB |
| | 3 | 18.74 MB | 20.58 MB | 18.64 MB | −22.2 KB |
| Standings → driver detail | 1 | 19.40 MB | 21.59 MB | 19.46 MB | — |
| | 2 | 19.46 MB | 20.81 MB | 19.46 MB | +2.0 KB |
| | 3 | 19.46 MB | 23.43 MB | 19.46 MB | +2.5 KB |

Post-GC external usage returned to its exact byte-level baseline every time.

**Growth is not monotonic** — one journey ended below its own baseline — and the
largest positive post-GC deviation across 240 round trips is approximately
**3 KB**, which is ordinary allocation noise rather than retention.

**Limitation:** measured with no images in play, so it says nothing about
behaviour under media pressure.

### 4.6 P6 — rebuild scope (aggregate cost only)

Each change measured in isolation: clear the timeline, perform exactly one
change, capture.

| Change | Frames | BUILD passes | Layout | Paint | UI total | Worst frame |
|---|---:|---:|---:|---:|---:|---:|
| Idle — no change, 3 s | **0** | 0 | 0 | 0 | 0.00 ms | — |
| Standings championship | 16 | 31 | 16 | 16 | 28.04 ms | 7.37 ms |
| Explore category | 55 | 73 | 55 | 55 | 78.11 ms | 12.31 ms |
| Theme | 66 | 265 | 66 | 66 | 215.52 ms | 14.48 ms |
| Language | 72 | 20 | 72 | 72 | 121.63 ms | 37.71 ms |
| Time display | 3 | 3 | 76 | 76 | 91.70 ms | 1.94 ms |

The most useful line is the first: **an idle application schedules literally zero
frames over three seconds** — no polling, no ticking animation, no repeating
timer. Among the changes, theme is the most build-heavy, which is expected since
it invalidates every themed widget; language costs fewer builds but more layout,
because every string is re-measured.

**Repetition accounting.** The protocol asked for three repetitions per change;
**one** was recorded.

**Per-widget attribution is unavailable in profile mode**, and this was verified
rather than assumed. Flutter registers the widget-inspector service extensions —
including rebuild and repaint tracking — from inside an `assert` block, which the
compiler strips in profile and release builds. The extensions therefore do not
exist in a profile build, even though the profile build does pass
`--track-widget-creation`. Obtaining attribution would require adding runtime
code, which was not permitted. Nothing was inferred from visual observation or
from overall build counts.

### 4.7 No thresholds exist

There is **no agreed project threshold** for janky frames, memory, disk-cache
bytes, image-cache occupancy or rebuild counts. None was invented for this
document, and no run is labelled pass or fail on an invented number.

---

## 5. Formal deferrals

Recorded as an explicit product-priority decision, not as satisfied work.

- **Representative mid-range performance acceptance moves to Phase 10.** The
  TRD's requirement — that performance be measured on at least one representative
  mid-range Android device, not only an emulator or a flagship phone — is
  **unchanged and not weakened**. Only its acceptance owner and phase are
  reassigned.
- **Startup measurements (P7 / P8) remain Phase 10.**
- **P1 must be repeated on representative mid-range hardware in Phase 10** if the
  requirement remains applicable, with independently identifiable repetitions.
- **P2 and populated P4 move to the media-publication owner** and must be
  repeated after approved media has actually been published. Media rights, R2
  provisioning, upload and manifest publication remain external prerequisites and
  are not marked complete anywhere.
- **P3 should be repeated under real media pressure at the same time**, so
  occupancy is measured against a populated cache rather than an empty one.
- **P6 per-widget rebuild counts may be measured in debug mode later**, if a real
  optimization investigation requires them — the inspector extensions do exist
  there. **Debug timings must never be used as performance timings**; only the
  counts would be meaningful.
- **The Phase 8C-3 figures in §4 remain provisional baseline observations.**

---

## 6. Conclusion

- **No production performance defect was demonstrated.**
- Placeholder-list scrolling and repeated navigation were **stable** on the
  reference device: sub-millisecond median UI-thread work, a handful of frames
  over budget across 2 025 frames, no monotonic heap retention across 240 round
  trips, and zero scheduled frames at rest.
- **This does not prove performance on mid-range hardware, and it does not prove
  performance with real images.** Both conditions were absent.
- Those missing conditions are **deferred, not satisfied** (§5).
- By explicit product-priority decision, they **no longer block Phase 8
  engineering closure**.
