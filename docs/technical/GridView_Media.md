# GridView media architecture (Phase 8B)

Status: **code-complete, locally verified, operational media publication
blocked.** No Formula 1 media rights have been cleared for GridView, and no R2
media bucket is provisioned in any environment. Everything below is implemented
and tested; nothing below has published a real image.

## 1. The rule everything else follows

> **Domain data availability is not media availability.**

A failed, missing, invalid, expired, uncached or unauthorized image must never
turn otherwise valid Home, Calendar, Explore, Grand Prix or entity-detail content
into a partial or error state. Every design decision in this document falls out
of that sentence.

The flow is one direction, with one crossing point:

```
GridView API media metadata
  -> existing repository / synchronisation (unchanged)
  -> Drift media tables            (metadata only, never bytes)
  -> media presentation read model (EntityMedia / MediaPresentation)
  -> pure variant selection        (MediaVariantSelector)
  -> shared cache + image loader   (flutter_cache_manager)
  -> data-agnostic image widget    (GvRemoteImage)
```

**Image bytes never pass through Drift.** No cache path, no download state and
no download failure is stored in a domain row.

## 2. What the contract actually carries

Audited against `docs/api/gridview-api-v1.yaml` rather than assumed.

| Schema | Carries `media` |
| --- | --- |
| `Driver`, `Constructor`, `Circuit`, `GrandPrix` | **yes** |
| `SeasonDriverSummary`, `SeasonConstructorSummary`, `CircuitSummary`, `GrandPrixSummary` | no |
| `DriverSeasonEntry`, `ConstructorSeasonEntry` | no |
| `HomeData`, `BootstrapData`, `SeasonBootstrap` | no (they carry summaries) |

Three consequences follow, and they shape the whole feature:

1. **Media reaches the device only through the four detail resources.** Bootstrap
   and the list resources deliver none, so imagery on a collection screen is
   whatever previous detail synchronisations happened to persist. Every media
   read is therefore opportunistic and local.
2. **There is no seasonal media.** `ConstructorSeasonEntry` has no media field, so
   a stable constructor asset is never presented as this season's livery, and a
   portrait is never attached to a `DriverSeasonEntry`. No seasonal media table
   was added and no field was overloaded to fake one.
3. **There is no `MediaVariantName` enum on the wire.** `MediaAsset.variants` is an
   *object* keyed by `thumbnail` / `card` / `detail` / `hero`; the key is the
   name. `MediaVariantSlot` (Dart) and `MEDIA_VARIANT_SLOTS` (tooling) are the
   only places that fact is encoded.

### Content manifest

`/v1/content/manifest` is **version metadata only** — `contentVersion`,
`mediaVersion`, `supportedSeasons`, `attributionVersion`,
`minimumApiSchemaVersion`. It carries no asset inventory, and Phase 8B did not
give it one: publication tooling needs richer internal data, and that data lives
in validated repository content instead. The public contract remains
authoritative for what Flutter synchronises.

## 3. Local ownership

Schema v2, unchanged by Phase 8B. `media_assets` describes an image;
`media_variants` normalises its sizes; ownership is one FK-backed association
table per real owner (`driver_media`, `constructor_media`, `circuit_media`,
`grand_prix_media`), because SQLite cannot express one polymorphic foreign key
across four parents.

- A real asset has **at most one real owner**: `mediaId` is the primary key of
  each association table, and a write clears any prior association first, so a
  reassignment moves an asset rather than duplicating it.
- An asset's `entityType` must equal the owner table it is written under;
  a mismatch throws and rolls back.
- `placeholder` and `unknown` are **descriptors, not owners**. They never receive
  an association row, so they can never gain a foreign-key relationship.
  `EntityMedia.from` repeats the check at the presentation boundary, so a future
  caller cannot reintroduce a fabricated association.
- Variants cascade with their asset; replacing an owner's media removes obsolete
  assets, variants and associations in one transaction.

### Reads

| Method | Use |
| --- | --- |
| `MediaDao.mediaForOwner(type, id)` | one owner's media, in stored order |
| `MediaDao.mediaForOwners(type, ids)` | **batched**, for a collection screen |
| `MediaDao.readAttributions()` / `watchAttributions()` | credits for the acknowledgements screen |

`mediaForOwners` exists so a roster costs three queries rather than three per
row. It replaced `ownersWithMedia`, whose boolean answer the read models no
longer need.

## 4. Presentation read models

`MediaPresentation` describes one asset with its resolved owner;
`EntityMedia` groups everything one owner has locally.

Both carry `mediaId` and `ownerId` and both are **internal only**. They exist for
selection, caching and diagnostics. Neither is human-readable, and neither may
ever be rendered as copy or announced as a semantic label — display text comes
from localized strings and from the owning entity's own name. Initials are never
derived from an identifier.

`MediaSlotPolicy` states which categories each approved slot accepts, in order:

| Slot | Accepted categories, in order |
| --- | --- |
| Driver portrait | `portrait`, `hero`, `thumbnail` |
| Constructor mark | `logo`, `car`, `hero`, `thumbnail` |
| Circuit | `circuit_layout`, `hero`, `thumbnail` |
| Grand Prix (event) | `hero`, `thumbnail` |
| Grand Prix (circuit fallback) | `hero`, `circuit_layout`, `thumbnail` |

Every list is closed: a category not named for a slot is never rendered there, so
a logo never becomes a driver portrait. Selection lives here rather than in SQL
or in a widget, which makes adding a category a visible, testable product
decision. The DAO deliberately returns *everything* an owner has.

## 5. Live slots

| Slot | Media | Role | Semantics |
| --- | --- | --- | --- |
| Home hero | GP, else circuit | `hero` | decorative (event title adjacent) |
| Grand Prix header | GP, else circuit | `hero` | decorative, **or** informative when a circuit layout diagram is used |
| Explore driver row | driver | `thumbnail` at 40px | decorative (row is labelled) |
| Explore team row | constructor | `thumbnail` at 40px | decorative |
| Explore circuit row | circuit | `thumbnail` at 40px | decorative |
| Driver detail hero | driver | `detail` | decorative (name is the adjacent heading) |
| Team detail hero | constructor | `detail` | decorative |
| Circuit detail hero | circuit | `detail` | **informative** for a layout diagram, decorative for a photograph |
| Calendar rows | — | — | information-led by design; no media slot |
| Standings, results | — | — | dense data; no media slot |

Calendar, Standings and Results get nothing. Metadata existing is not a reason to
redesign a dense row.

### The Grand Prix hero draws on two owners

This is the only slot allowed to. `docs/product/GridView_UI_UX_Design.md` §12.3
specifies the Grand Prix hero as a "circuit **or** event image", so the fallback
is approved rather than convenient — and it is not silent:
`EventHeroMedia.isCircuitFallback` records which owner supplied the picture,
because a circuit layout diagram used as an event hero is still a diagram and
still carries information the adjacent text does not.

Home and the Grand Prix screen share `EventHeroImage`, so they cannot show
different pictures for the same event. They differ only in what *no* media means:

- **Home** has reserved a placeholder since Phase 7D, so it keeps one.
- **The Grand Prix header is typographic by approved design** and reserves no
  image area, so with no imagery it stays exactly as Phase 7 left it rather than
  gaining an empty placeholder and a scrim carrying no information.

Neither can shift layout: `GvHeroCard` takes its height from its own minimum, not
from whether a background was supplied.

## 6. Variant selection

`MediaVariantSelector` is pure: no request, no cache read, no widget work, no
clock.

The caller states what it is drawing — a `MediaDisplayRole`, the logical size and
the device pixel ratio — and the selector derives the physical target as
`logical size × DPR` rather than assuming one density.

Order of preference:

1. Candidates with a policy-valid URL and, where the slot states one, a compatible
   aspect ratio.
2. Among those, the **smallest measured candidate adequate for the target**. This
   is what stops a 40px row from downloading a hero.
3. When nothing measured is adequate, the **largest measured candidate** — an
   undersized image still beats no image.
4. When nothing is measured at all, the unmeasured candidate closest to the role's
   own slot. Unknown dimensions are never assumed adequate; this is an explicit
   last resort, not a size judgement.
5. Otherwise `null`, which is the ordinary "show the placeholder" answer.

**A variant name never outranks a measured dimension.** The slot name breaks ties
between identically sized candidates and supplies the unmeasured fallback,
nothing more, so a variant named `hero` that is actually 100px wide loses to a
960px `detail`. Because the size comparator falls through to the slot rank, which
is unique per candidate, the ordering is total: the sequence variants happen to
be stored in cannot change the answer. Version strings are never compared, so
lexical version order is irrelevant.

Width is decisive because every media slot in the product is width-constrained.
Height is consulted only when the slot constrains it *and* the candidate reports
one: a candidate that met the width target but declares no height is not
disqualified, because its height follows from the asset's own ratio rather than
from a missing field.

### Aspect-ratio tolerance

`kAspectRatioRoundingTolerance = 2%`, **derived rather than picked**. Stored
dimensions are integers, so a stored ratio is already rounded; at the smallest
size the pipeline emits (160px long edge) worst-case rounding is about 1.6% for
an extreme crop. 2% therefore covers rounding for every variant the pipeline can
produce, while anything beyond it is a genuinely different framing. When every
candidate fails the check the selector falls back to ratio-agnostic matching,
since a slightly wrong crop beats a placeholder over a valid image.

This number is unrelated to the golden comparator's 2% pixel tolerance. The two
coincide by arithmetic accident and are not linked.

## 7. URL security policy

`MediaUrlPolicy` is pure and synchronous, so it can be applied to every candidate
of every asset on the render path.

Staging and production accept **HTTPS only**, with a non-empty host and normal
public URL syntax. Refused: `http`, `file:`, `content:`, `data:`, `javascript:`,
`ftp:` and every other scheme, malformed URLs, relative URLs, a missing host,
embedded credentials (`user:password@host` *and* credentials smuggled into a
fragment), and control characters or whitespace — which is the shape a
header- or log-injection attempt takes; a legitimate URL arrives percent-encoded.

The single relaxation is `http` on loopback, and it must be **injected
explicitly** (`MediaUrlPolicy.developmentLoopback`). No environment inference
turns it on. Tests use a fake loader rather than relaxing the policy.

> A note on implementation: the policy tests `Uri.hasScheme`, not
> `Uri.isAbsolute`. Dart calls a URI absolute only when it has a scheme **and no
> fragment**, so `isAbsolute` reports a well-formed `https://host/a#b` as "not
> absolute" and hides the real reason it is refused.

### Diagnostics

`MediaUrlPolicy.describe` reduces a URL to scheme and host, marking the path and
dropping the query and fragment entirely. A media URL is the one place a
signed-delivery token would appear, so a failure has to be loggable without
becoming a credential leak. Rejection reasons are coarse and never carry the URL.
Nothing produced here is shown to a user.

The current contract's media URLs carry no credential-bearing query parameters,
and none is expected: published objects are immutable and public.

## 8. Cache

`flutter_cache_manager` was declared in Phase 8A with zero call sites. It is now
genuinely the implementation, and it is the **only** disk cache for image bytes.

`cached_network_image` was not added. Everything needed — persistent disk
storage, request de-duplication per key, eviction — is already in the declared
package, and a second package would mean a second store believing it owned
eviction of the same directory.

`MediaCache` is the abstraction; widgets never construct a `CacheManager`. One
shared instance, one namespace (`gridview_media`).

### Enforceable limits only

`Config` accepts `stalePeriod` and `maxNrOfCacheObjects` **and nothing else**.
There is no maximum-bytes setting in the package, so none is claimed.

| Limit | Value | Why |
| --- | --- | --- |
| `stalePeriod` | 30 days | Grand Prix weekends are roughly a fortnight apart, so 30 days keeps imagery for events a user follows warm across at least two weekends; anything untouched for a month is cheap to refetch. |
| `maxNrOfCacheObjects` | 400 | Expected v1 inventory is ~24 driver portraits, 10 team marks, 24 circuit layouts and 24 event heroes ≈ 82 assets, at up to three cached variants each ≈ 250 objects. 400 leaves headroom for a season boundary where two seasons are briefly resident. |

Total size stays bounded indirectly, through the object count and through variant
selection never fetching a hero for a row.

### Cache key

`mediaId | version | slot | url`.

Composite rather than the bare URL, so the three things that must never share an
entry are distinguished **by construction** rather than by trusting a URL to have
the right shape: the asset, its immutable version and the variant. `v1` and `v2`
of one asset therefore cannot collide, and neither can a thumbnail and a hero.
The URL is included as well, so republishing to a different URL without bumping
the version still produces a distinct entry instead of serving superseded bytes.
Nothing localized and nothing display-derived appears in a key.

### Behaviour

Cache persists across restart; an immutable version change is a distinct object;
one media failure clears nothing else; a rejected URL never enters the cache;
cancellation is not a failure; a cache read or write failure falls back to the
placeholder; no uncontrolled retry loop; **no app-wide cache clearing** exists,
and Phase 8B ships no user-facing "clear media cache" setting.

## 9. Loader boundary

`MediaImageLoader` is the single boundary between the widget and the
cache/network. One shared, data-agnostic service — not a provider per image, not
a repository per row.

It performs the HTTPS request for image bytes and **nothing else**. It never
calls `GridViewApi`, a Dio repository, `AppSyncCoordinator`, a detail refresh or a
content-manifest refresh. Media binary delivery is a separate system from
GridView JSON synchronisation, and this type is where that separation is
enforced.

It never throws: `SocketException`, `TimeoutException`, `HttpException`,
`FileSystemException` and any unclassifiable package error all become a typed
`MediaLoadOutcome`, so a package exception cannot escape into a widget build.
There is no retry beyond the underlying single request.

`MediaLoaderScope` supplies the loader. **A subtree with no scope renders
placeholders and issues no request** — so a widget test cannot accidentally reach
the network, and a forgotten scope degrades to the fallback instead of throwing.

## 10. Image component

`GvRemoteImage` accepts primitives only — a validated URL, a cache identity, a
size, a placeholder icon, a label. It knows nothing about `Driver`,
`Constructor`, `Circuit`, `GrandPrix`, `MediaAsset`, a repository, a Riverpod
`Ref`, a Drift row or a DTO.

- **Loading**: the final aspect ratio is held from the first frame, so there is no
  layout shift when bytes arrive or fail to. No blocking spinner, no infinite
  shimmer, and no repetitive "loading image" announcement.
- **Success**: decoded near the display width, so a 40px row does not retain
  detail-resolution pixels. A cached hit appears immediately and skips the fade,
  so scrolling back does not replay an animation; reduced motion skips it
  entirely.
- **Failure**: back to the stable placeholder. No broken-image icon, no error
  text, no exception, no URL and no identifier on screen; no page-level error; no
  effect on the surrounding text or navigation.

The widget tracks the cache key of the load it started, so a scroll, a theme
change or a parent `setState` cannot restart the same download. Only a genuinely
different image does.

### Fallback hierarchy

1. Suitable selected local / cached / remote media.
2. Category-specific placeholder glyph for the slot.
3. Neutral generic placeholder.

An unknown `fallbackCategory` resolves to the neutral placeholder. The wire token
is never shown, never title-cased into copy, and never turned into an
association. Placeholders work in both themes.

The three no-image states (`noMediaPlaceholderKey`, `pendingPlaceholderKey`,
`failedPlaceholderKey`) render **identically** — a user must not be able to tell a
failure from a slow load — and differ only by a key so tests can distinguish them
without changing a pixel.

## 11. Accessibility

Decided slot by slot rather than by marking every image informative.

- A driver portrait beside an already-labelled driver row → **decorative**.
  `_RowScaffold` already replaces child semantics with an explicit label naming
  the entity, so announcing the picture would repeat it.
- A team mark beside a labelled team row or heading → **decorative**.
- An event hero beside the event's own title → **decorative**.
- A **circuit layout diagram → informative**, because the shape of the track is
  information no adjacent text states. Labelled with `circuitLayoutImage`, which
  names the circuit — never an id, filename, URL or category token.
- A circuit *photograph* → decorative; it conveys nothing the name and location do
  not. The two are distinguished by the selected asset's own category rather than
  assumed.
- A diagram with no resolvable circuit name stays decorative: a labelless image
  node is worse than a decorative one.

Remote images are never focusable (they are not interactive), loading never spams
a screen reader, and the failure fallback keeps whatever the slot's semantics
were.

## 12. Freshness: metadata and bytes are separate systems

**Media metadata** follows the existing GridView synchronisation model unchanged.
No new freshness hierarchy was created. An individual resource ETag is never
fabricated from the content manifest, and media freshness is never fabricated
from image cache age.

**Image bytes** have no freshness at all in domain terms. Disk-cache age is not
GridView freshness: no "updated at" is derived from a cache file, no stale notice
comes from an old image, and no resource refresh is triggered by an expired cache
entry.

A **versioned immutable URL is the invalidation boundary**. When metadata changes
to a new version the loader naturally gets a new cache identity. Old bytes are
not purged eagerly on a new manifest; normal eviction removes them later, and in
the meantime they are simply unreachable because current metadata no longer
references them.

Nothing in the media path refreshes anything: no startup media prefetch, no
background download job, no global download queue, no second `AppSyncCoordinator`
and no additional lifecycle observer. Home's first useful render never waits on
an image.

## 13. Rights removal

A replacement snapshot makes newly published assets selectable and removes
obsolete ones transactionally, together with their variants and ownership
associations. The owning entity is untouched — removing imagery is not removing
data. Old bytes may remain physically in the disk cache until normal eviction but
are unreachable, because nothing references them. **No media rights removal
requires clearing the app database.**

The acknowledgements screen is a stream, so a credit whose asset was removed
stops being displayed on its own.

## 14. Acknowledgements

A pure local read: no request is made and none is triggered, so it works offline
as soon as media metadata has been persisted once.

The unit is the **credit**, not the asset and certainly not the size variant: one
asset in four sizes produces one line, and two assets from one rights holder
collapse into one. Genuinely distinct licences are preserved. An asset with no
attribution text contributes nothing — an absent credit is never rendered as a
credit for "unknown". Order is deterministic. The label is a localized category;
a media id, an owner id and a URL are never titles.

Three states, not two: `resolving`, `empty` and `credits`. "No attributions are
stored yet" is a statement *about stored data*, so it may only be made once the
read has answered; while it is in flight the screen renders a neutral reserved
block. A stream error is treated identically — unknown, never empty.

## 15. Rights register and the publication gate

`content/schemas/media-rights.schema.json` defines the register;
`content/media/media-rights.json` is the authoritative production inventory and
is **empty**.

Empty is the accurate state, and because the gate fails closed it means nothing
can be processed, uploaded or referenced from a manifest. That is the intended
behaviour, not a gap to work around. Automated tests use synthetic records built
in-test, never entries here.

The register records the *existence* of a permission, never its evidence: no
contract, credential or confidential document belongs in the repository, only a
reference to where the signed record is held.

### The gate refuses, absolutely, when

| Refusal | Meaning |
| --- | --- |
| `no-rights-record` | Absence is a refusal. |
| `duplicate-rights-record` | Two records are two different answers. |
| `not-approved` | Anything but `approved`. |
| `commercial-use-not-approved` | Commercial release without commercial permission. |
| `derivatives-not-permitted` | Every publication path resizes and converts. |
| `permission-expired` | Lapsed, or an expiry that cannot be parsed. |
| `attribution-missing` | Required credit absent. |
| `attribution-placement-unsupported` | See below. |
| `territory-not-permitted` | Release territory not covered. |
| `source-master-missing` / `source-master-invalid` | No usable master. |

None of these is a warning. The gate collects *every* applicable refusal rather
than stopping at the first, so an operator sees the whole problem.

**Adjacent attribution is refused outright.** GridView shows credits on a central
acknowledgements screen; treating that as satisfying a licence that requires
attribution beside the image would be a false compliance claim, so such an asset
is simply not publishable until adjacent attribution is explicitly implemented.

A list of individual countries is not a worldwide grant: a `WORLDWIDE` release
requires an explicit worldwide permission.

## 16. Processing

`services/edge-api/scripts/media/`, TypeScript on the existing Node toolchain,
using `sharp` — now pinned as a direct dev dependency (previously only a
transitive optional of `miniflare`). It is imported by tooling only, never by
Worker runtime code, so the Worker bundle is unaffected.

Steps: validate rights → validate source → normalise orientation → strip metadata
→ inspect dimensions → emit only non-upscaling variants → compute dimensions and
aspect ratio → hash → build immutable keys → emit the manifest fragment.

| Variant | Max width |
| --- | --- |
| thumbnail | 160 |
| card | 480 |
| detail | 960 |
| hero | 1440 |

**Maximum targets, not forced outputs.** A 700px master yields a thumbnail and a
card and simply has no detail or hero; a master too small for any variant is an
error rather than an upscale. Upscaling invents detail that was never
photographed.

WebP by default. PNG is preserved only for `logo` and `circuit_layout`, where line
art and transparency justify it. **No AVIF** — a third format costs storage and
encode time on every asset, and no measurement yet shows it is worth that.

Metadata is stripped from every output. An EXIF block carries GPS coordinates,
camera serial numbers and timestamps: none belongs in a published asset, and a
timestamp would make output bytes differ between runs.

### Determinism

Encoder options are pinned explicitly rather than left to defaults that move
between `sharp` releases. Repeated runs with the same input, rights record,
toolchain and configuration are asserted to produce identical variant dimensions,
metadata, object keys, content hashes and **bytes**.

**No cross-platform byte identity is claimed, because none has been measured.**
Native image tooling can differ between platforms, so **Linux CI is the canonical
processing environment**, exactly as it is for goldens.

## 17. Immutable object keys

```
media/<owner>/<stable-id>/<version>/<variant>.<ext>

media/drivers/max-verstappen/v1/card.webp
media/constructors/ferrari/v1/thumbnail.png
media/circuits/monza/v1/detail.png
media/grand-prix/2026-belgian-grand-prix/v1/hero.webp
```

A Grand Prix is keyed by its stable edition id, which is what
`grand_prix_media.grandPrixId` holds. The wire token is `grand_prix`; the path
segment is `grand-prix`.

Stable GridView identity only: no localized name, no display name, no provider
id, no secret, and **no timestamp acting as the version boundary** — a timestamp
would make two runs of one input produce two different keys, which is exactly
what immutability has to rule out. Segments are validated as lowercase kebab-case,
so nothing can escape the prefix.

An existing key whose content hash differs is a **conflict**: publication is
blocked and a version bump is required. Identical content at an existing key is a
no-op, so a re-run is idempotent, and a version bump publishes alongside the old
objects rather than over them.

## 18. Publication

Order is the design. Rights are decided for **every** asset first; then masters
are processed; then every object key is checked for a conflict; and only then is
anything written. A conflict discovered mid-upload would leave half a version
published, so it cannot be discovered mid-upload.

**One unapproved asset blocks the publication in full** rather than being skipped:
a partial publication against an inventory an operator believed was approved is
worse than none.

- The object store is an interface, so the pipeline runs in CI against a fake
  with no bucket, no credential and no network.
- `upload` defaults to `false`. The safe mode is the one you get by forgetting to
  think about it.
- **Production is refused by default** even when an upload is explicitly
  requested; reaching it takes a separate, deliberate authorisation.
- The public media base URL is always supplied by the operator and validated with
  the same HTTPS rule the app applies. **No production host is hardcoded
  anywhere**, because a fabricated host would put URLs into a manifest that
  nothing serves.
- No credential is printed.
- The existing versioned publication / active-pointer architecture is reused. No
  second active-pointer model was created, and no new public route, endpoint or
  payload was added.

### Dry-run

```bash
cd services/edge-api
npm run media:dry-run
```

Requires no Cloudflare credential, no bucket and no network. It validates rights,
processes approved masters, generates the manifest fragment and the object
inventory with hashes, and writes them to an ignored output directory. It never
uploads, and it is the only media path ordinary pull-request CI exercises.

The CLI refuses anything other than `dry-run`, because no media bucket is
provisioned in any environment and a working upload path would be untestable code
guarding an operation that cannot currently happen. `publishMedia` already
implements upload against an injected store; supplying a real one belongs with
the bucket.

## 19. Operational blockers

Both are **external and expected**, not code defects.

1. **No approved media inventory.** `content/media/media-rights.json` is
   authoritative and empty. No Formula 1 media rights have been cleared for
   GridView.
2. **No R2 media bucket.** `services/edge-api/wrangler.toml` provisions a KV
   namespace for staging and nothing else; production has no bindings at all.
   Neither a staging nor a production media bucket exists.

Consequently **no live R2 publication has been executed, and none is claimed.**

### Future operator checklist (currently unexecuted)

1. Record real permissions in the rights register.
2. `npm run media:dry-run` — validate rights, inspect generated variants, sizes,
   object keys, hashes and the manifest.
3. Provision a staging R2 bucket, with explicit user authorisation.
4. Upload approved variants to staging.
5. Publish the staging snapshot through the existing publication mechanism.
6. Verify the exact public URLs and the staging app.
7. Test rights removal: remove an asset, confirm it disappears locally and the
   owning entity is unaffected.
8. Test immutable overwrite refusal: republish different content at an existing
   key and confirm it is blocked.

## 20. Performance

Behaviour that is tested rather than benchmarked:

- No image blocks Home's first useful render.
- No startup prefetch, no background download job, no global queue.
- A list row constructs a row-sized request; a hero file is never fetched for a
  thumbnail.
- The cache manager is shared; a rebuild does not start a duplicate download; a
  cached image does not re-download on reconstruction.
- Off-screen cancellation and disposal are safe and are not failures.
- Decode target is close to display size; no manual unlimited memory-cache
  override; no full-resolution decode retained for a small row.

**No device-level numbers are given, because no representative device was
available.** Profiling Explore scrolling, repeated detail navigation and Home
first render with and without cached media is a Phase 8C / release-profiling task,
listed here rather than invented.

## 21. Phase 8C hand-off

Phase 8C owns: the platform-neutral observability boundary; Firebase setup and
activation handling; global crash and non-fatal capture; selected performance
traces; the full app-wide TalkBack and text-scale sweeps; the broader
reduced-motion audit; representative-device performance profiling; startup and
app-size measurement; the final cross-feature accessibility report; and final
Phase 8 documentation consolidation.

Phase 8C must **not**: replace the media cache; move media bytes into Drift; move
media selection into widgets; alter entity/media ownership; introduce seasonal
media ownership; make media required for text usability; expand OpenAPI casually;
add provider integration; or publish unapproved media.
