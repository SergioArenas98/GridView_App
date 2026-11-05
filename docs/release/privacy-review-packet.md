# Privacy review packet: GridView 2.0.0 and the 1.x transition

> **2026-11-05: not to be sent.** The owner decided not to commission an
> external review. This packet is kept as the record of the questions.
> Their proposed answers, options and status are in `privacy-self-assessment.md`,
> and dropping the review settles none of them.

Prepared 2026-11-05 at master `d2d6df9`, and updated the same day with the
owner's release decisions of 2026-11-05 (sections 3 and 4). This packet is
for the qualified privacy reviewer.
- It collects what the review must answer, what is already decided, and the
  evidence each answer rests on.
- It adds no new finding about how the app handles data. The engineering
  facts are in `data-safety.md`, cited by section.
- The draft policy (`privacy_policies.md`, "Last updated: 23 October 2026")
  is **unpublished**.
- Nothing here changes Play Console, AdMob, Firebase or the published
  policy.

## 1. Scope

| Item | Value |
|---|---|
| Controller | Sergio Arenas del Amo, an individual in Ireland, publishing as Sejuma; no registered business (`data-safety.md` §6, R7) |
| Contact | gridviewapp1@gmail.com, the only channel (C4) |
| App | `com.sejuma.gridview`. 2.0.0 (versionCode 8, minSdk 24) replaces 1.2.1 (versionCode 7) |
| Versions in scope | 2.0.0, and every 1.x build Play still distributes or that remains installed (versionCodes 7 and 2; `data-safety.md` §1.2) |
| Processors and recipients | Google: Firebase Crashlytics, Performance Monitoring, Sessions and Installations in 2.0.0; AdMob and Firebase Cloud Messaging in 1.x. Cloudflare: the GridView API. Netlify: hosts the policy |
| Declarations | The Play Data safety form in three states: **0** (1.x only), **T** (transition), **F** (final) (`data-safety.md` §1.3, §3) |

## 2. What to read

1. `privacy_policies.md` (the HTML file mirrors it).
2. `data-safety.md` §3 (proposed answers), §4 (review items R1-R9), §4.2 (R9 in
   detail) and §6 (controller and contact).
3. This packet's evidence index (§6), for the items marked "evidence".

## 3. Already decided by the owner

These are recorded decisions. The review may comment on them; changing one is
the owner's choice.

| # | Decision (date) | Where |
|---|---|---|
| R1 | Declare Approximate location for Performance Monitoring's IP-to-country mapping (2026-11-02, for the draft) | §4, §4.1 |
| R3, D-DEL | No verified deletion procedure, so Data safety answers No; no in-app deletion control (2026-10-22 facts, 2026-10-23 decision) | §4 R3 |
| R4 | Collection is required: no in-app switch exists (a technical fact) | §4 |
| R5 | Declare the 1.x rows, including Crash logs (2026-11-02) | §3.5, §4 |
| R7, C4 | Controller identity as above; email as the only channel (2026-10-20, 2026-10-23) | §6 |
| R8 (Sessions) | Declare App interactions for Firebase Sessions (2026-11-02) | §4 |
| AU-D3 | The policy's wording on the API's records (2026-10-23) | §4.1 |
| D-A | Archive the 1.x ad units before automatic production publication; the end of 1.x ad revenue is accepted (2026-10-23). **Confirmed 2026-11-05:** archive the seven active units once the AdMob account's verification clears (section 4). **Not yet done** | §3.6 |
| D-T1 | versionCode 7 is not retained in the 2.0.0 release, so new installs on API 21-23 are no longer offered (2026-11-05). **Not yet done** (a release step) | §1.4 step 4, §4.1 |
| D-T2 | The closed "Alpha" track (versionCode 2) is paused as part of the release plan (2026-11-05). **Not yet done** | §1.4, §4.1 |
| Country | Ireland is the intended country on the Play listing, which still shows Spain (2026-11-05). **Not yet changed** | §6.2 |
| R2 | Conditionally accepted: the API's handling of the IP address is ephemeral, **subject to the review confirming the complete processing scope** (2026-11-02) | §3.2, §3.4 |

## 4. Owner decision outside the review that affects it

**D-A′: decided 2026-11-05, D-A kept.** On 2026-11-04 the AdMob account
was found in a reduced state:
- serving is limited;
- the last ad impression was on 2026-03-31;
- the account is being re-verified after an inactivity deactivation.

The owner has said they will not request the per-app review that would
restart serving (`data-safety.md` §3.6). The question was what counts as the
D-A gate before automatic production publication (AU-7):

| Option | What it means | Consequence |
|---|---|---|
| Keep D-A as decided: archive the seven active units before AU-7 | Ends serving with certainty, whatever the account's state | Needs the gridviewapp1@gmail.com session and a separate go-ahead. It is irreversible. Six of the seven units sit in a mediation group, which the archive changes |
| D-A′: treat "serving deactivated, no review requested" as the gate, and archive later | Relies on Google's rule that serving does not restart without a review | Faster. It depends on the owner never requesting the review and on Google's current rule; it is weaker evidence than an archive |

**Owner decision (2026-11-05):** keep D-A. The seven active units are
archived once the account's verification notice has cleared. The archive
gives a recorded end state that the review can rely on for R6. It still
needs the gridviewapp1@gmail.com session and a separate go-ahead, and it
is not done.

## 5. Questions for the reviewer

Each question names what waits on its answer.

| # | Question | Engineering input | Waits on it |
|---|---|---|---|
| Q1 (R9, **blocker**) | 1.x Firebase Cloud Messaging: (a) which Data safety purpose, if any, describes an SDK registration no feature used; (b) what legal basis, if any, covered it for EEA, UK and Swiss users, including whether the ePrivacy rules required consent to store and read the installation ID; (c) is disclosure enough, or is remediation needed? | Facts and possible outcomes in `data-safety.md` §4.2. No purpose or basis is supported by the evidence; nothing has been chosen | States 0 and T (the FCM part of Device or other IDs), publishing the policy (section 4), merging PR #82 |
| Q2 (R2 scope) | Is the complete processing scope of the API's IP handling confirmed as ephemeral? | `data-safety.md` §3.4: no persisted line for an app request; re-checked in code on 2026-11-05; live checks in W3 and repeated at AU-7 | States T and F |
| Q3 (R8, API lines) | Do the API's persisted lines need a Data safety row? | No row recommended. Production persists only the API's own internal-error lines, with no request ID, IP address or device identifier (§3.4) | States T and F |
| Q4 (R6) | 1.x requested ads with no consent message. Is more needed than the policy's disclosure and D-A? | Exposure is past and ongoing for installed copies. In practice serving has ended (last impression 2026-03-31), but the SDK still sends requests until each copy updates or is uninstalled (§3.6). D-T1 and D-T2 (2026-11-05) end 1.x distribution through Play; D-A ends serving once done | Publishing the policy |
| Q5 (§6.1) | Does any rule outside the privacy notice require a geographic address? | Email meets the notice's contact requirement; a home address is not proposed (§6.1) | Publishing the policy |
| Q6 (wording, new) | The policy says 1.x "show advertising banners" (section 3.4). Serving has effectively ended, while the SDK still requests ads. Should the wording describe requests as well as display? | The collection list is accurate either way. Changing the wording is a policy edit, so it is the owner's choice after the review | Publishing the policy |

Two related facts are context, not questions:

- **Unexplained AdMob traffic.** From March 2026, AdMob reports about 46,700
  requests with app version "1.56.4" or no version, no SDK version and no
  impressions. No GridView release is 1.56.4, and the source is not
  identified (§3.6). It is not attributed to GridView 1.x.
- **Inert manifest entry.** The 2.0.0 production manifest still carries the
  AdMob application ID as meta-data. No code reads it, and 2.0.0 ships no
  ads SDK (a build gate and a test forbid it). It is recorded so its
  presence is not mistaken for ads code.

## 6. Evidence index

The repository holds the analysis. The underlying evidence is kept outside
it, in the owner's evidence store (`~/.gridview/evidence/`), and is handed
to the reviewer on request. Each item is identified by its SHA-256 (a
folder by its `SHA256SUMS` manifest).

| # | Evidence | Supports | SHA-256 |
|---|---|---|---|
| E1 | Play upload of versionCode 2 (1.0.0, 2025-03-04), the owner's copy | §3.5, §3.6 (1.x SDKs, the two ad units) | `1ef7d378204aa57a78380828f8a198166d5760af05d46f16f87fd6e750cee9cf` |
| E2 | Play download of versionCode 7 (1.2.1), read 2026-10-22; the copy was not kept, so the reading is recorded in §3.5 | §3.5, §3.6 | `560f5634…e3cd` (as recorded) |
| E3 | Google's AdMob Play data disclosure for SDK 23.6.0: two Internet Archive captures plus the current page (`admob-disclosure-23.6.0-2026-10-23/`) | R5 | manifest `fc8ac7b7b635a8a623d251ac4f12c1e2b590c40d182d9725881f2705486a7e0d` |
| E4 | Firebase Messaging campaign history of `gridview-fb20f`, read-only (`fcm-campaign-history-2026-10-22/`) | R9 (§4.2) | record `ffb24e174ebdc0c554bcc53ec18c433a9326df1805f8cfb7f70b7bb8749ddf56` |
| E5 | W3 production deploy and log check (`w3-deploy-2026-10-22/`) | R2, R8 | record `a54db26d4f13cd16472c867ad9a49e47cd9aaaa4b5fe48d295ca370668b66faf` |
| E6 | R8 API-logging re-verification at `16ad1da` (`r8-api-logging-reverify-2026-11-03.md`) | R8 | `7595657b61f9fc825c12a705f0052d60547a069a2e0e76e25ae143506bdad0dc` |
| E7 | The 2026-11-05 code re-check at `d2d6df9` (`data-safety.md` §3.4, this repository) | R2, R8 | the commit itself |
| E8 | Owner decision pack of 2026-10-22 (`privacy-decision-pack-2026-10-22.md`) | §3 above | `15a0759bfb713649accf143a1af843f10d1253dc8095f010517299f80e35417e` |
| E9 | AdMob read-only inspections of 2026-11-04, with screenshots (`admob-d-a-prep-2026-11-04/`) | R6, D-A, §4 above | manifest `84d8da4bc78170376eb96e27d7d876b10cc8b40e39983350af4d4036eeb305bf` |
| E10 | Google AdMob help 10491752, "About deactivated AdMob accounts", saved 2026-11-04 (in E9) | D-A′ | `15b7d68fa41761ba191bc9d219fd5545fbcaf7b90dcf4fbbbb2c7a4b55366f9e` |

## 7. What happens after the review

1. The owner records the answers to Q1-Q6, and any change to the decisions
   in §3, in `data-safety.md` §4.1.
2. Any policy wording that changes is edited in this pull request, and the
   HTML is regenerated and checked against the Markdown.
3. PR #82 is merged only after Q1 is answered.
4. Publishing the policy (release plan P2) and each Data safety state
   (P0, P3, R7) are separate approvals in Play Console and Netlify.
