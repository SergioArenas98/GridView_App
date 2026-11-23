"""Generates the Settings information-screen prototypes (Python 3 stdlib only).

    python build.py

Part 2 of the Settings prototype: Data and updates, Acknowledgements, Privacy
and legal, App information. English and Spanish (``*.es.html``), one static
page per scenario, plus a development-only state gallery (``states*.html``).

Edit this generator, not the HTML. Sources of every visible value:

- Product copy: ``lib/l10n/app_en.arb`` / ``app_es.arb`` (key kept on the
  element as ``data-k``). ICU placeholders are filled exactly as Flutter does.
- Data-source attribution: ``content/attribution/data-sources.json``, read
  at build time, never retyped. Provider values are shown as published.
- Scenario values: existing Flutter test fixtures and configuration only
  (see ``SCENARIOS`` and the README "Fixture provenance" table).

Strings that are not ARB copy: "Back" / "Atrás" (Material back tooltip); the
DEV / STAGING / PRODUCTION labels and "Build environment: ..." (hard-coded in
``AppEnvironment.label`` and ``environment_badge.dart``); prototype
annotations (``devnote``) and gallery captions, which are prototype chrome.

Rendering rules mirror ``lib/features/settings/presentation/
information_screens.dart``, ``acknowledgements_screen.dart``,
``widgets/data_source_attribution_card.dart``, ``widgets/settings_rows.dart``
(``GvSettingsField`` omits an empty value), ``widgets/fixture_data_label.dart``,
``lib/features/shared/domain/fixture_data_identity.dart`` (``captureDateLabel``)
and ``lib/features/shared/presentation/domain_status.dart``
(``mediaCategoryLabel``). It writes nothing outside this folder.
"""

from __future__ import annotations

import html
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).parent
REPO = OUT.parents[4]
ARB = {lang: json.loads((REPO / "lib" / "l10n" / f"app_{lang}.arb").read_text(encoding="utf-8"))
       for lang in ("en", "es")}
RECORD = json.loads((REPO / "content" / "attribution" / "data-sources.json").read_text(encoding="utf-8"))
MATERIAL = {"en": {"materialBack": "Back"}, "es": {"materialBack": "Atrás"}}
LANGS = ("en", "es")
E = html.escape

# kGridViewApiVersion (lib/core/network/api_config.dart).
API_VERSION = "1"
# AppEnvironment.label: not localized in Flutter.
ENV_LABEL = {"production": "PRODUCTION", "development": "DEV", "staging": "STAGING"}
# The frozen capture the reference-phone build carried
# (test/settings/settings_golden_test.dart `_frozenCapture`).
FROZEN_CAPTURED_AT = datetime(2026, 10, 7, 22, 41, 45, 852000, tzinfo=timezone.utc)
FROZEN_SOURCES = frozenset({"jolpica"})


def capture_date_label(instant: datetime) -> str:
    """captureDateLabel: the UTC calendar date, ISO 8601, not localized."""
    utc = instant.astimezone(timezone.utc)
    return f"{utc.year}-{utc.month:02d}-{utc.day:02d}"


FROZEN_DATE = capture_date_label(FROZEN_CAPTURED_AT)


def s(lang: str, key: str, **args: str) -> str:
    """The ARB value with ICU placeholders filled (plain string placeholders only)."""
    value = MATERIAL[lang].get(key) or ARB[lang][key]
    for name, arg in args.items():
        value = value.replace("{" + name + "}", arg)
    assert "{" not in value, (key, value)
    return value


def k(lang: str, key: str, tag: str = "span", cls: str = "", extra: str = "", **args: str) -> str:
    c = f' class="{cls}"' if cls else ""
    return f'<{tag}{c} data-k="{key}"{extra}>{E(s(lang, key, **args))}</{tag}>'


# ---------------------------------------------------------------------------
# Scenario model (mirrors the providers the screens watch)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Build:
    env: str = "production"                 # appEnvironmentProvider
    mode: str = "remote"                    # dataSourceModeProvider
    mock: bool = False                      # usesMockDataProvider
    fixture: str | None = None              # None | "sample" | "frozen" | "unverified"
    season: int | None = 2026               # currentSeasonProvider (router_harness default)


@dataclass(frozen=True)
class Privacy:
    policy: bool = False                    # ExternalLinkConfig.privacyPolicy configured
    activation: str = "notConfigured"       # ObservabilityActivation


@dataclass(frozen=True)
class AppInfo:
    app_name: str = "GridView"
    version: str = ""
    build_number: str = ""


APP_INFO_GOLDEN = AppInfo("GridView", "1.2.1", "7")   # settings_golden_test.dart `_appInfo`
APP_INFO_UNKNOWN = AppInfo()                           # AppInfo.unknown


@dataclass(frozen=True)
class Ack:
    sources: str = "loaded"                 # "loading" | "loaded" | "error"
    record: tuple = ()                      # parsed sources when loaded
    media: str = "empty"                    # "loading" | "empty" | "credits"  (stream error == loading)
    credits: tuple = ()


def is_production(b: Build) -> bool:
    return b.env == "production"


# --- Data and updates ------------------------------------------------------

def fixture_label(lang: str, b: Build) -> str | None:
    """fixtureDataSourceLabel."""
    if b.fixture == "frozen":
        return s(lang, "settingsDataSourceFrozen", date=FROZEN_DATE)
    if b.fixture == "unverified":
        return s(lang, "settingsDataSourceUnverified")
    return None


def data_source(lang: str, b: Build) -> tuple[str, str]:
    """DataSettingsScreen._dataSource -> (key, text)."""
    if b.mock:
        label = fixture_label(lang, b)
        if label is not None:
            return ("settingsDataSourceFrozen" if b.fixture == "frozen" else "settingsDataSourceUnverified", label)
        return ("settingsDataSourceSample", s(lang, "settingsDataSourceSample"))
    if b.mode == "remote":
        return ("settingsDataSourceRemote", s(lang, "settingsDataSourceRemote"))
    return ("settingsDataSourceUnavailable", s(lang, "settingsDataSourceUnavailable"))


def data_explanation(lang: str, b: Build) -> tuple[str, str]:
    """DataSettingsScreen._explanation -> (key, text)."""
    if b.mode == "remote" and not b.mock:
        return ("settingsDataOfflineExplanation", s(lang, "settingsDataOfflineExplanation"))
    if b.fixture == "frozen" and b.mock:
        return ("settingsDataFrozenExplanation", s(lang, "settingsDataFrozenExplanation", date=FROZEN_DATE))
    return ("settingsDataBundledExplanation", s(lang, "settingsDataBundledExplanation"))


# ---------------------------------------------------------------------------
# Markup helpers
# ---------------------------------------------------------------------------

ICONS = """<svg width="0" height="0" class="sprite" aria-hidden="true" focusable="false">
  <symbol id="i-back" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></symbol>
  <symbol id="i-open" viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></symbol>
  <symbol id="i-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.5h.01"/></symbol>
</svg>"""


def head(lang: str, title: str, desc: str) -> str:
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../primer-core.css">
<link rel="stylesheet" href="../settings.css">
<link rel="stylesheet" href="information.css">
</head>"""


def chrome(lang: str, env: str, title_key: str, back_href: str) -> str:
    """Environment strip (non-production only) above the detail bar (as ../build.py)."""
    strip = ""
    if env != "production":
        label = ENV_LABEL[env]
        strip = (f'\n  <div class="envstrip"><span class="envbadge" role="img" '
                 f'aria-label="Build environment: {label}">{label}</span></div>')
    return f"""<div class="chrome">{strip}
  <header class="dbar">
    <a class="icon-btn dbar__back" href="{back_href}" aria-label="{E(s(lang, 'materialBack'))}" data-k-label="materialBack"><svg class="icon" aria-hidden="true"><use href="#i-back"/></svg></a>
    {k(lang, title_key, "h1", "dbar__title", ' id="screen-title"')}
  </header>
</div>"""


def statement(lang: str) -> str:
    """settingsAboutUnofficial: the independence statement."""
    return k(lang, "settingsAboutUnofficial", "p", "lede")


def fact(lang: str, label_key: str, value: str | None, value_key: str | None = None,
         cls: str = "", value_lang: str | None = None, raw: bool = False) -> str:
    """GvSettingsField: label above value; an absent or empty value renders nothing."""
    if value is None or value == "":
        return ""
    vk = f' data-k="{value_key}"' if value_key else ""
    vl = f' lang="{value_lang}"' if value_lang else ""
    shown = value if raw else E(value)
    c = f"fact {cls}".strip()
    return (f'<div class="{c}"><dt data-k="{label_key}">{E(s(lang, label_key))}</dt>'
            f'<dd{vk}{vl}>{shown}</dd></div>')


def facts(rows: list[str], cls: str = "") -> str:
    body = "".join(r for r in rows if r)
    if not body:
        return ""
    c = f"facts {cls}".strip()
    return f'<dl class="{c}">{body}</dl>'


def section(lang: str, title_key: str, inner: str, uid: str, cls: str = "") -> str:
    c = f"isec {cls}".strip()
    return (f'<section class="{c}" aria-labelledby="h-{uid}">'
            f'{k(lang, title_key, "h2", "kicker", f" id=\"h-{uid}\"")}{inner}</section>')


def loading(lang: str) -> str:
    """GvLoadingSemantics(label: a11yLoading) around a 20px GvSkeletonBlock."""
    return (f'<div class="istate" role="status"><span class="sr-only" data-k="a11yLoading">'
            f'{E(s(lang, "a11yLoading"))}</span><span class="skel" aria-hidden="true"></span></div>')


def open_glyph() -> str:
    return '<svg class="icon srow__go xrow__glyph" aria-hidden="true"><use href="#i-open"/></svg>'


def keep_hyphenated(escaped: str, token: str) -> str:
    """Keep a short hyphenated licence token ("BY-NC-SA") on one line: spaces
    still break, the token's own hyphens do not. Text content is unchanged."""
    out = escaped
    for word in {w for w in token.split() if "-" in w}:
        w = E(word)
        out = out.replace(w, f'<span class="nobr">{w}</span>')
    return out


def display_link(url: str) -> str:
    """DataSourceAttributionCard.displayLink: host + path, no scheme, no trailing slash."""
    rest = url.split("://", 1)[1]
    host, _, path = rest.partition("/")
    path = "/" + path if path else ""
    path = path.split("?", 1)[0].split("#", 1)[0]
    if path.endswith("/"):
        path = path[:-1]
    return host + path


def ext_link(lang: str, title_key: str, url: str, value: str, desc: str | None = None,
             value_lang: str | None = None, desc_lang: str | None = None, mono: bool = False,
             keep: bool = False) -> str:
    """A GvSettingsRow with Icons.open_in_new: one focus stop, title, value, description."""
    vl = f' lang="{value_lang}"' if value_lang else ""
    dl = f' lang="{desc_lang}"' if desc_lang else ""
    vcls = "xrow__value xrow__value--link" if mono else "xrow__value"
    vsep = '<span class="sep">,</span>' if desc else ""
    d = f'<span class="srow__desc"{dl}>{E(desc)}</span>' if desc else ""
    return (f'<li><a class="srow xrow" href="{E(url)}" target="_blank" rel="noopener noreferrer" data-ext="link">'
            f'<span class="srow__text"><span class="srow__title"><span data-k="{title_key}">{E(s(lang, title_key))}</span>'
            f'<span class="sep">,</span></span><span class="{vcls}"{vl}>{keep_hyphenated(E(value), value) if keep else E(value)}{vsep}</span>{d}</span>'
            f'{open_glyph()}</a></li>')


# ---------------------------------------------------------------------------
# Data and updates
# ---------------------------------------------------------------------------

def data_main(lang: str, b: Build) -> str:
    src_key, src = data_source(lang, b)
    exp_key, exp = data_explanation(lang, b)
    season = str(b.season) if b.season is not None else s(lang, "settingsDataCurrentSeasonUnresolved")
    season_key = None if b.season is not None else "settingsDataCurrentSeasonUnresolved"
    rows = [
        fact(lang, "settingsDataEnvironment", ENV_LABEL[b.env]),
        fact(lang, "settingsDataSource", src, src_key),
        fact(lang, "settingsDataApiVersion", API_VERSION, cls="fact--num"),
        fact(lang, "settingsDataCurrentSeason", season, season_key,
             cls="fact--num" if b.season is not None else "fact--pending"),
    ]
    return (f'<main class="page info">{facts(rows)}'
            f'<p class="explain" data-k="{exp_key}">{E(exp)}</p></main>')


# ---------------------------------------------------------------------------
# Acknowledgements
# ---------------------------------------------------------------------------

def source_status(lang: str, src: dict, b: Build) -> tuple[str, str]:
    """DataSourceAttributionCard._status: a frozen build's own capture wins."""
    if b.fixture == "frozen" and src["sourceId"] in FROZEN_SOURCES:
        return ("settingsSourceStatusFrozen", s(lang, "settingsSourceStatusFrozen", date=FROZEN_DATE))
    key = {"dormant": "settingsSourceStatusDormant", "active": "settingsSourceStatusActive",
           "automatic": "settingsSourceStatusAutomatic"}[src["status"]]
    return (key, s(lang, key))


def source_block(lang: str, src: dict, b: Build, uid: str) -> str:
    sid = f'src-{src["sourceId"]}-{uid}'
    st_key, st = source_status(lang, src, b)
    name = E(src["name"])
    notices = (
        f'<p data-k="{st_key}">{E(st)}</p>'
        f'<p data-k="settingsSourceModified">{E(s(lang, "settingsSourceModified"))}</p>'
        f'<p data-k="settingsSourceLicenseNotice">{keep_hyphenated(E(s(lang, "settingsSourceLicenseNotice", source=src["name"], license=src["licenseName"])), src["licenseName"])}</p>'
        f'<p data-k="settingsSourceNotEndorsed">{E(s(lang, "settingsSourceNotEndorsed", source=src["name"]))}</p>'
    )
    # Licensor-supplied notices, verbatim; an absent one renders nothing.
    supplied = facts([
        fact(lang, "settingsSourceCredit", src["creatorDesignation"], cls="fact--prose"),
        fact(lang, "settingsSourceCopyright", src["copyrightNotice"], cls="fact--prose"),
        fact(lang, "settingsSourceNotice", src["warrantyDisclaimerNotice"], cls="fact--prose",
             value_lang="en" if lang != "en" else None),
    ], "facts--supplied")
    links = [ext_link(lang, "settingsSourceProject", src["sourceUrl"], display_link(src["sourceUrl"]), mono=True)]
    if src["termsUrl"] is not None:
        links.append(ext_link(lang, "settingsSourceTerms", src["termsUrl"], display_link(src["termsUrl"]), mono=True))
    links.append(ext_link(lang, "settingsSourceLicense", src["licenseUrl"], src["licenseName"], src["licenseTitle"],
                          desc_lang="en" if lang != "en" else None, keep=True))
    return (f'<article class="source" aria-labelledby="{sid}" data-source="{E(src["sourceId"])}">'
            f'<h3 class="source__name" id="{sid}">{name}</h3>'
            f'<div class="prose source__notices">{notices}</div>{supplied}'
            f'<ul class="srows xlinks">{"".join(links)}</ul></article>')


def ack_sources(lang: str, a: Ack, b: Build, uid: str) -> str:
    """AcknowledgementsScreen._sources: an empty record renders no section at all."""
    if a.sources == "loaded":
        if not a.record:
            return ""
        inner = "".join(source_block(lang, src, b, f"{uid}{i}") for i, src in enumerate(a.record))
        inner = f'<div class="sources">{inner}</div>'
    elif a.sources == "error":
        inner = (f'<p class="notice notice--unavailable" role="status"><svg class="icon" aria-hidden="true">'
                 f'<use href="#i-alert"/></svg>{k(lang, "settingsSourcesUnavailable")}</p>')
    else:
        inner = loading(lang)
    return section(lang, "settingsAcknowledgementsSources", inner, f"sources{uid}")


def ack_media(lang: str, a: Ack, uid: str) -> str:
    """AcknowledgementsScreen._credits: unknown (loading or stream error) is never 'empty'."""
    if a.media == "loading":
        inner = loading(lang)
    elif a.media == "empty":
        inner = k(lang, "settingsAcknowledgementsEmpty", "p", "istate istate--empty")
    else:
        cat = {"portrait": "mediaCategoryPortrait", "logo": "mediaCategoryLogo", "car": "mediaCategoryCar",
               "circuitLayout": "mediaCategoryCircuitLayout", "hero": "mediaCategoryHero",
               "thumbnail": "mediaCategoryThumbnail", "unknown": "mediaCategoryOther"}
        rows = [fact(lang, cat[c], " · ".join(p for p in (attr, lic) if p)) for c, attr, lic in a.credits]
        inner = facts(rows, "facts--credits")
    return section(lang, "settingsAcknowledgementsMedia", inner, f"media{uid}")


def ack_data_source(lang: str, b: Build) -> tuple[str, str]:
    """AcknowledgementsScreen: mock ? fixture label ?? sample : remote (no 'Not configured' here)."""
    if b.mock:
        label = fixture_label(lang, b)
        if label is not None:
            return ("settingsDataSourceFrozen" if b.fixture == "frozen" else "settingsDataSourceUnverified", label)
        return ("settingsDataSourceSample", s(lang, "settingsDataSourceSample"))
    return ("settingsDataSourceRemote", s(lang, "settingsDataSourceRemote"))


def ack_main(lang: str, b: Build, a: Ack, uid: str = "") -> str:
    key, value = ack_data_source(lang, b)
    data = section(lang, "settingsAcknowledgementsData", facts([fact(lang, "settingsDataSource", value, key)]),
                   f"data{uid}")
    return (f'<main class="page info">{statement(lang)}{data}{ack_sources(lang, a, b, uid)}'
            f'{ack_media(lang, a, uid)}</main>')


# ---------------------------------------------------------------------------
# Privacy and legal
# ---------------------------------------------------------------------------

def session_value(lang: str, b: Build, p: Privacy) -> tuple[str, str] | None:
    """PrivacySettingsScreen._sessionValue: omitted without a production policy or when notConfigured."""
    if not is_production(b):
        return None
    key = {"pending": "settingsPrivacyStarting", "active": "settingsPrivacySessionActive",
           "unavailable": "settingsPrivacySessionUnconfirmed"}.get(p.activation)
    return (key, s(lang, key)) if key else None


def privacy_main(lang: str, b: Build, p: Privacy, uid: str = "") -> str:
    policy_key = "settingsPrivacyConfigured" if is_production(b) else "settingsPrivacyDisabled"
    policy_value = s(lang, policy_key)
    build_rows = facts([
        fact(lang, "settingsPrivacyCrashReporting", policy_value, policy_key),
        fact(lang, "settingsPrivacyPerformance", policy_value, policy_key),
        fact(lang, "settingsPrivacyAdvertising", s(lang, "settingsPrivacyDisabled"), "settingsPrivacyDisabled"),
    ])
    sess = session_value(lang, b, p)
    session = ""
    if sess:
        session = facts([fact(lang, "settingsPrivacySessionReporting", sess[1], sess[0], cls="fact--session")],
                        "facts--session")
    note = k(lang, "settingsPrivacyDiagnosticsNote", "p", "note")
    action = ""
    if p.policy:
        action = (f'<ul class="srows xlinks xlinks--policy"><li><button type="button" class="srow xrow" '
                  f'data-ext="privacy-policy"><span class="srow__text">{k(lang, "settingsPrivacyPolicyOpen", cls="srow__title")}'
                  f'</span>{open_glyph()}</button></li></ul>'
                  '<p class="devnote" data-show="policy-opened" hidden>Prototype only: the configured privacy '
                  'policy would open in the device browser. Its address is build configuration and is not shown.</p>')
    elif not is_production(b):
        action = (f'<div class="srows xlinks xlinks--policy"><div class="srow srow--static"><span class="srow__text">'
                  f'{k(lang, "settingsPrivacyPolicyUnavailable", cls="srow__title")}</span></div></div>')
    disclosures = section(lang, "settingsPrivacy", build_rows + session + note, f"privacy{uid}")
    return f'<main class="page info">{statement(lang)}{disclosures}{action}</main>'


# ---------------------------------------------------------------------------
# App information
# ---------------------------------------------------------------------------

def about_main(lang: str, info: AppInfo) -> str:
    rows = [
        fact(lang, "settingsAboutApplication", info.app_name),
        fact(lang, "settingsVersion", info.version, cls="fact--num"),
        fact(lang, "settingsAboutBuild", info.build_number, cls="fact--num"),
    ]
    return f'<main class="page info">{facts(rows)}{statement(lang)}</main>'


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

SOURCES = tuple(RECORD["sources"])
PROD = Build()
DEV_SAMPLE = Build(env="development", mode="fixture", mock=True, fixture="sample")
DEV_FROZEN = Build(env="development", mode="fixture", mock=True, fixture="frozen")
DEV_UNVERIFIED = Build(env="development", mode="fixture", mock=True, fixture="unverified")


@dataclass(frozen=True)
class Page:
    stem: str
    screen: str           # data | acknowledgements | privacy | about
    title_key: str
    what: str             # scenario description (English, for metadata and README)
    build: Build = PROD
    privacy: Privacy = field(default_factory=Privacy)
    ack: Ack = field(default_factory=lambda: Ack(record=SOURCES))
    info: AppInfo = APP_INFO_GOLDEN


PAGES = [
    Page("data", "data", "settingsDataAndUpdates", "D1. Production build reading the GridView service; current season stored"),
    Page("data-sample", "data", "settingsDataAndUpdates", "D2. Development build serving the bundled sample data", DEV_SAMPLE),
    Page("data-frozen", "data", "settingsDataAndUpdates", "D3. Development build with the frozen provider capture of 2026-10-07", DEV_FROZEN),
    Page("data-unverified", "data", "settingsDataAndUpdates", "D4. Development build whose bundled descriptor cannot be read (unverified origin)", DEV_UNVERIFIED),
    Page("data-season-unavailable", "data", "settingsDataAndUpdates", "D5. Production build reading the GridView service; no current season stored yet", Build(season=None)),
    Page("acknowledgements", "acknowledgements", "settingsAcknowledgements", "A1. Production build: bundled record loaded, no media credits stored"),
    Page("acknowledgements-frozen", "acknowledgements", "settingsAcknowledgements", "A2. Development build with the frozen capture: the capture overrides the source status", DEV_FROZEN),
    Page("privacy", "privacy", "settingsPrivacyAndLegal", "P1. Production build, privacy policy configured, this session's reporting confirmed (Active)", PROD, Privacy(True, "active")),
    Page("privacy-starting", "privacy", "settingsPrivacyAndLegal", "P2. Production build, privacy policy configured, activation still in flight (Starting)", PROD, Privacy(True, "pending")),
    Page("privacy-unconfirmed", "privacy", "settingsPrivacyAndLegal", "P3. Production build, no privacy policy configured, activation did not succeed (Not confirmed)", PROD, Privacy(False, "unavailable")),
    Page("privacy-non-production", "privacy", "settingsPrivacyAndLegal", "P4. Development build: no diagnostics policy, no privacy policy configured", Build(env="development"), Privacy(False, "notConfigured")),
    Page("about", "about", "settingsAppInformation", "I1. Package metadata resolved (golden fixture 1.2.1, build 7)"),
    Page("about-unresolved", "about", "settingsAppInformation", "I2. Package metadata could not be read (AppInfo.unknown)", info=APP_INFO_UNKNOWN),
]


def main_for(lang: str, pg: Page, uid: str = "") -> str:
    if pg.screen == "data":
        return data_main(lang, pg.build)
    if pg.screen == "acknowledgements":
        return ack_main(lang, pg.build, pg.ack, uid)
    if pg.screen == "privacy":
        return privacy_main(lang, pg.build, pg.privacy, uid)
    return about_main(lang, pg.info)


def snackbar(lang: str) -> str:
    return (f'<div class="snack" role="status" aria-live="polite" data-msg="{E(s(lang, "settingsOpenFailed"))}">'
            '<p class="snack__msg"></p></div>')


def devnotes() -> str:
    return ('<div class="devnotes"><p class="devnote" data-show="openfail" hidden>Prototype only: development '
            'failure scenario. Every external link fails to open and the existing message is shown.</p></div>')


def page_html(lang: str, pg: Page) -> str:
    sfx = ".es" if lang == "es" else ""
    root = "index" if is_production(pg.build) else "non-production"
    title = f"GridView {s(lang, pg.title_key)}"
    main = main_for(lang, pg)
    main = main.replace("</main>", devnotes() + "</main>")
    return "\n".join([
        head(lang, title, f"GridView {s('en', pg.title_key)}, Primer V2 visual prototype "
                          f"({'Spanish' if lang == 'es' else 'English'}). {pg.what}. Copy from the ARB files; "
                          "attribution from content/attribution/data-sources.json; no production data."),
        f'<body class="settings info-screen" data-screen="{pg.screen}" data-scenario="{pg.stem}">',
        "<!-- Generated by build.py - edit the generator, not this file. -->",
        ICONS,
        chrome(lang, pg.build.env, pg.title_key, f"../{root}{sfx}.html"),
        main,
        snackbar(lang),
        '<script src="information.js"></script>\n</body>\n</html>\n',
    ])


# ---------------------------------------------------------------------------
# Development-only gallery
# ---------------------------------------------------------------------------

# Widget-test fixtures (test/settings/settings_widget_test.dart): an active
# source with supplied notices and no terms link, and a dormant source.
EXAMPLE_ACTIVE = {
    "sourceId": "example", "name": "Example Source", "sourceUrl": "https://example.org/project",
    "termsUrl": None, "licenseName": "CC BY-NC-SA 4.0", "licenseTitle": "Example licence title",
    "licenseUrl": "https://example.org/licence", "status": "active",
    "copyrightNotice": "(c) Example Contributors", "warrantyDisclaimerNotice": None,
    "creatorDesignation": "Example Creator",
}
EXAMPLE_DORMANT = EXAMPLE_ACTIVE | {"status": "dormant", "copyrightNotice": None, "creatorDesignation": None}
# Golden fixture 'acknowledgements populated' (settings_golden_test.dart).
GOLDEN_CREDITS = (("portrait", "Example Rights Holder", "CC BY 4.0"),
                  ("circuitLayout", "Second Rights Holder", None))

G = {
    "en": {
        "title": "GridView Settings information states",
        "h1": "Settings information screens: development-only states",
        "intro": "Prototype gallery, not an app screen. Frames are static snapshots of the same components. Frames marked “test fixture” use Flutter test data (Example Source, Example Rights Holder); they are not production data.",
        "hub": "Scenario pages",
        "f": [
            "1. Acknowledgements while the attribution record and the media credits are loading",
            "2. Attribution record unreadable: an explicit message, never an empty list; media credits known to be empty",
            "3. Attribution record with no sources: the Data sources section is omitted entirely (code path; no screen test renders it)",
            "4. Media credits not yet answered, or the credit stream failed: both stay a loading block (AC18), never “No attributions”",
            "5. Media credits populated (test fixture from the ‘acknowledgements populated’ golden)",
            "6. An active source with supplied credit and copyright notices and no terms link (test fixture)",
            "7. A dormant source (test fixture)",
            "8. A link could not be opened: the existing message, no URL, no exception",
            "9. Privacy in a production build whose diagnostics never activate (golden harness): no session line",
            "10. Data and updates in a production build configured for fixtures: “Not configured” (with Flutter's bundled-data explanation, see README)",
            "11. Staging build: the badge strip sits above the app bar",
        ],
    },
    "es": {
        "title": "GridView Información de ajustes estados",
        "h1": "Pantallas de información de Ajustes: estados solo para desarrollo",
        "intro": "Galería del prototipo, no es una pantalla de la aplicación. Los marcos son capturas estáticas de los mismos componentes. Los marcos marcados como «fixture de prueba» usan datos de prueba de Flutter (Example Source, Example Rights Holder); no son datos de producción.",
        "hub": "Páginas de escenarios",
        "f": [
            "1. Agradecimientos mientras se cargan el registro de atribución y los créditos de imágenes",
            "2. Registro de atribución ilegible: un mensaje explícito, nunca una lista vacía; créditos de imágenes vacíos y confirmados",
            "3. Registro de atribución sin fuentes: la sección Fuentes de datos se omite por completo (ruta de código; ninguna prueba de pantalla la muestra)",
            "4. Créditos de imágenes aún sin respuesta, o el flujo falló: ambos casos siguen como bloque de carga (AC18), nunca «Todavía no hay atribuciones»",
            "5. Créditos de imágenes con contenido (fixture de prueba del golden ‘acknowledgements populated’)",
            "6. Una fuente activa con créditos y derechos de autor proporcionados y sin enlace a condiciones (fixture de prueba)",
            "7. Una fuente inactiva (fixture de prueba)",
            "8. No se pudo abrir un enlace: el mensaje existente, sin URL ni excepción",
            "9. Privacidad en una compilación de producción cuyos diagnósticos nunca se activan (arnés de goldens): sin línea de sesión",
            "10. Datos y actualizaciones en producción configurada con fixtures: «Sin configurar» (con la explicación de datos incluidos de Flutter, ver README)",
            "11. Compilación de staging: la franja del distintivo queda encima de la barra",
        ],
    },
}


def mini_bar(lang: str, title_key: str, env: str = "production") -> str:
    strip = ""
    if env != "production":
        strip = f'<div class="envstrip"><span class="envbadge">{ENV_LABEL[env]}</span></div>'
    return (f'<div class="chrome chrome--frame">{strip}<div class="dbar"><span class="icon-btn dbar__back">'
            f'<svg class="icon" aria-hidden="true"><use href="#i-back"/></svg></span>'
            f'<p class="dbar__title">{E(s(lang, title_key))}</p></div></div>')


def unmain(markup: str) -> str:
    """Gallery frames are not landmarks: <main> becomes a <div>."""
    return markup.replace('<main class="page info">', '<div class="page info">').replace("</main>", "</div>")


def states_page(lang: str) -> str:
    g = G[lang]
    sfx = ".es" if lang == "es" else ""
    links = "\n".join(
        f'    <li><a class="hub__link" href="{pg.stem}{sfx}.html">{E(pg.what)}</a></li>' for pg in PAGES)
    links += (f'\n    <li><a class="hub__link" href="acknowledgements{sfx}.html?openfail=1">'
              f'{"Acknowledgements: every external link fails to open" if lang == "en" else "Agradecimientos: ningún enlace externo se puede abrir"}</a></li>')
    links += (f'\n    <li><a class="hub__link" href="privacy{sfx}.html?openfail=1">'
              f'{"Privacy: opening the privacy policy fails" if lang == "en" else "Privacidad: no se puede abrir la política de privacidad"}</a></li>')
    ack = "settingsAcknowledgements"
    f = g["f"]
    frames = [
        (f[0], mini_bar(lang, ack) + unmain(ack_main(lang, PROD, Ack(sources="loading", media="loading"), "g1")), ""),
        (f[1], unmain(ack_main(lang, PROD, Ack(sources="error", media="empty"), "g2")), ""),
        (f[2], unmain(ack_main(lang, PROD, Ack(sources="loaded", record=(), media="empty"), "g3")), ""),
        (f[3], f'<div class="page info">{ack_media(lang, Ack(media="loading"), "g4")}</div>', ""),
        (f[4], f'<div class="page info">{ack_media(lang, Ack(media="credits", credits=GOLDEN_CREDITS), "g5")}</div>', ""),
        (f[5], f'<div class="page info">{ack_sources(lang, Ack(record=(EXAMPLE_ACTIVE,)), PROD, "g6")}</div>', ""),
        (f[6], f'<div class="page info">{ack_sources(lang, Ack(record=(EXAMPLE_DORMANT,)), PROD, "g7")}</div>', ""),
        (f[7], f'<div class="page info">{ack_sources(lang, Ack(record=SOURCES), PROD, "g8")}</div>'
               f'<div class="snack is-shown"><p class="snack__msg">{E(s(lang, "settingsOpenFailed"))}</p></div>',
         " frame--snack"),
        (f[8], mini_bar(lang, "settingsPrivacyAndLegal") + unmain(privacy_main(lang, PROD, Privacy(False, "notConfigured"), "g9")), ""),
        (f[9], mini_bar(lang, "settingsDataAndUpdates") + unmain(data_main(lang, Build(mode="fixture"))), ""),
        (f[10], mini_bar(lang, ack, env="staging") + '<div class="frame__fade"></div>', ""),
    ]
    body = "\n".join(
        f'<figure class="frame"><figcaption class="frame__cap">{E(cap)}</figcaption>'
        f'<div class="frame__screen{cls}" inert>{inner}</div></figure>'
        for cap, inner, cls in frames)
    return "\n".join([
        head(lang, g["title"], "Development-only gallery for the Settings information-screen prototype. Not an app screen."),
        '<body class="settings gallery">\n<!-- Generated by build.py - edit the generator, not this file. -->\n' + ICONS,
        f'<main class="gallery__main">\n<h1 class="gallery__title">{E(g["h1"])}</h1>\n<p class="gallery__intro">{E(g["intro"])}</p>',
        f'<section class="hub" aria-labelledby="hub-t"><h2 class="kicker" id="hub-t">{E(g["hub"])}</h2>\n  <ul class="hub__list">\n{links}\n  </ul></section>',
        body,
        '</main>\n<script src="information.js"></script>\n</body>\n</html>\n',
    ])


def main() -> None:
    written: list[tuple[str, str]] = []
    for lang in LANGS:
        sfx = ".es" if lang == "es" else ""
        for pg in PAGES:
            written.append((f"{pg.stem}{sfx}.html", page_html(lang, pg)))
        written.append((f"states{sfx}.html", states_page(lang)))
    for name, text in written:
        (OUT / name).write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {len(written)} files")


if __name__ == "__main__":
    main()
