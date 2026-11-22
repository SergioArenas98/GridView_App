"""Generates the Settings prototype pages (Python 3 stdlib only).

    python build.py

Writes, in English and Spanish (``*.es.html``):

- index.html                  Scenario A: production build, support contact
                              configured (the build default), default values.
- production-no-contact.html  Scenario A2: production build, no contact
                              configured: the feedback action is omitted.
- non-production.html         Scenario B: development build, no contact
                              configured (the Flutter golden harness):
                              DEV strip, feedback explanation, Developer.
- language.html, theme.html, time.html
                              The three preference selection screens.
- states.html                 Development-only gallery and scenario hub.
- strings.js                  The EN/ES strings the pages use, read from
                              lib/l10n/app_en.arb and app_es.arb.

Edit this generator, not the HTML. Every visible product string comes from
the ARB files (key names are kept on the elements as ``data-k``). The only
strings that are not ARB copy:
- "Back" / "Atras": Flutter's Material back-button tooltip
  (MaterialLocalizations), as in the other Primer V2 prototypes;
- "Build environment: DEV|STAGING" and the DEV / STAGING badge: hard-coded
  in lib/features/shared/presentation/widgets/environment_badge.dart and
  AppEnvironment.label (not localized in Flutter);
- prototype annotations (class ``devnote`` and the gallery captions), which
  are prototype chrome, never app copy.

Rendering rules mirror lib/features/settings/presentation/settings_screen.dart,
preference_choice_screen.dart, preference_screens.dart,
widgets/settings_rows.dart, lib/features/settings/domain/preference_labels.dart,
lib/features/settings/application/external_links.dart,
lib/core/preferences/preference_values.dart and
lib/features/shared/presentation/widgets/environment_badge.dart.
"""

from __future__ import annotations

import html
import json
from pathlib import Path

OUT = Path(__file__).parent
REPO = OUT.parents[3]
ARB = {lang: json.loads((REPO / "lib" / "l10n" / f"app_{lang}.arb").read_text(encoding="utf-8"))
       for lang in ("en", "es")}

KEYS = [
    "settingsTitle", "settingsSectionPreferences", "settingsLanguage", "settingsTheme",
    "settingsTimeDisplay", "settingsSectionDataApp", "settingsDataAndUpdates",
    "settingsAcknowledgements", "settingsAppInformation", "settingsSectionPrivacySupport",
    "settingsPrivacyAndLegal", "settingsFeedback", "settingsFeedbackUnavailable",
    "settingsSectionDeveloper", "settingsComponentCatalogue",
    "settingsComponentCatalogueDescription",
    "settingsLanguageSystem", "settingsLanguageSystemDescription",
    "settingsLanguageEnglish", "settingsLanguageSpanish",
    "settingsThemeSystem", "settingsThemeSystemDescription", "settingsThemeDark", "settingsThemeLight",
    "settingsTimeDevice", "settingsTimeDeviceDescription", "settingsTimeEvent",
    "settingsTimeEventDescription", "settingsTimeBoth", "settingsTimeBothDescription",
    "settingsSaveFailed", "settingsSelected",
]
# MaterialLocalizations backButtonTooltip (not in the ARB files).
MATERIAL = {"en": {"materialBack": "Back"}, "es": {"materialBack": "Atrás"}}

S = {lang: {k: ARB[lang][k] for k in KEYS} | MATERIAL[lang] for lang in ("en", "es")}

# Enum order = option order (AppLanguagePreference.values etc.). Defaults are
# the documented fallbacks: system / dark / device.
PREFS = {
    "language": {
        "title": "settingsLanguage", "page": "language", "default": "system",
        "values": [
            ("system", "settingsLanguageSystem", "settingsLanguageSystemDescription", None),
            # Shown in their own language (PreferenceLabels): lang attribute fixed.
            ("english", "settingsLanguageEnglish", None, "en"),
            ("spanish", "settingsLanguageSpanish", None, "es"),
        ],
    },
    "theme": {
        "title": "settingsTheme", "page": "theme", "default": "dark",
        "values": [
            ("system", "settingsThemeSystem", "settingsThemeSystemDescription", None),
            ("dark", "settingsThemeDark", None, None),
            ("light", "settingsThemeLight", None, None),
        ],
    },
    "time": {
        "title": "settingsTimeDisplay", "page": "time", "default": "device",
        "values": [
            ("device", "settingsTimeDevice", "settingsTimeDeviceDescription", None),
            ("event", "settingsTimeEvent", "settingsTimeEventDescription", None),
            ("both", "settingsTimeBoth", "settingsTimeBothDescription", None),
        ],
    },
}
DEFAULTS = {p: v["default"] for p, v in PREFS.items()}

ICONS = """<svg width="0" height="0" class="sprite" aria-hidden="true" focusable="false">
  <symbol id="i-back" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></symbol>
  <symbol id="i-chevron" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
  <symbol id="i-external" viewBox="0 0 24 24"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
</svg>"""

E = html.escape


def t(lang: str, key: str) -> str:
    return E(S[lang][key])


def k(lang: str, key: str, tag: str = "span", cls: str = "", extra: str = "") -> str:
    c = f' class="{cls}"' if cls else ""
    return f'<{tag}{c} data-k="{key}"{extra}>{t(lang, key)}</{tag}>'


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
<link rel="stylesheet" href="primer-core.css">
<link rel="stylesheet" href="settings.css">
</head>"""


def body_open(lang: str, page: str, state: dict, env: str, contact: str) -> str:
    sfx = ".es" if lang == "es" else ""
    attrs = " ".join(f'data-{p}="{v}"' for p, v in state.items())
    return (f'<body class="settings" data-page="{page}" data-suffix="{sfx}" {attrs} '
            f'data-env="{env}" data-contact="{contact}" data-device="{lang}">\n'
            "<!-- Generated by build.py - edit the generator, not this file. -->\n" + ICONS)


def chrome(lang: str, env: str, title_key: str, back_href: str, nav: str = "") -> str:
    """Environment strip (non-production only) above the app bar, never over it."""
    hidden = " hidden" if env == "production" else ""
    label = "STAGING" if env == "staging" else "DEV"
    navattr = f' data-nav="{nav}"' if nav else ""
    return f"""<div class="chrome">
  <div class="envstrip" data-show="nonprod"{hidden}><span class="envbadge" role="img" aria-label="Build environment: {label}">{label}</span></div>
  <header class="dbar">
    <a class="icon-btn dbar__back" href="{back_href}"{navattr} aria-label="{t(lang, 'materialBack')}" data-k-label="materialBack"><svg class="icon" aria-hidden="true"><use href="#i-back"/></svg></a>
    {k(lang, title_key, "h1", "dbar__title", ' id="screen-title"')}
  </header>
</div>"""


def devnotes() -> str:
    return """<div class="devnotes">
  <p class="devnote" data-show="fail" hidden>Prototype only: development failure scenario. Every save fails, the previous value is restored and the existing message is shown.</p>
  <p class="devnote" data-show="light" hidden>Prototype only: provisional light preview derived from Flutter's light tokens (GvColorsLight). Not the Primer V2 light design, which is still pending.</p>
</div>"""


def foot() -> str:
    return '<script src="strings.js"></script>\n<script src="settings.js"></script>\n</body>\n</html>\n'


# --------------------------------------------------------------------------
# Settings root
# --------------------------------------------------------------------------

def pref_row(lang: str, pref: str, value: str, live: bool = True) -> str:
    p = PREFS[pref]
    label_key = next(v[1] for v in p["values"] if v[0] == value)
    rid = f' id="row-{pref}"' if live else ""
    nav = f' data-nav="{p["page"]}"' if live else ""
    href = f'{p["page"]}{".es" if lang == "es" else ""}.html'
    return f"""<li><a class="srow srow--pref" href="{href}"{rid}{nav}>
      <span class="srow__text"><span class="srow__label">{k(lang, p["title"])}<span class="sep">,</span></span><span class="srow__value"><span class="mark mark--sm" aria-hidden="true"></span><span data-pref-value="{pref}" data-k="{label_key}">{t(lang, label_key)}</span></span></span>
      <svg class="icon srow__go" aria-hidden="true"><use href="#i-chevron"/></svg>
    </a></li>"""


def nav_row(lang: str, key: str, href: str, desc_key: str | None = None, external: bool = False,
            show: str = "", hidden: bool = False) -> str:
    comma = '<span class="sep">,</span>' if desc_key else ""
    icon = "i-external" if external else "i-chevron"
    sh = f' data-show="{show}"' if show else ""
    hd = " hidden" if hidden else ""
    return f"""<li{sh}{hd}><a class="srow" href="{href}">
      <span class="srow__text"><span class="srow__title">{k(lang, key)}{comma}</span>{k(lang, desc_key, cls="srow__desc") if desc_key else ""}</span>
      <svg class="icon srow__go{' srow__go--ext' if external else ''}" aria-hidden="true"><use href="#{icon}"/></svg>
    </a></li>"""


def root_main(lang: str, env: str, contact: str, values: dict, live: bool = True) -> str:
    prod = env == "production"
    show_contact = contact == "configured"
    show_explain = contact == "none" and not prod
    uid = "" if live else "-g"
    return f"""<main class="page">
<section class="sgroup" aria-labelledby="g-pref{uid}">
  {k(lang, "settingsSectionPreferences", "h2", "kicker", f' id="g-pref{uid}"')}
  <ul class="srows">
    {pref_row(lang, "language", values["language"], live)}
    {pref_row(lang, "theme", values["theme"], live)}
    {pref_row(lang, "time", values["time"], live)}
  </ul>
</section>
<section class="sgroup" aria-labelledby="g-data{uid}">
  {k(lang, "settingsSectionDataApp", "h2", "kicker", f' id="g-data{uid}"')}
  <ul class="srows">
    {nav_row(lang, "settingsDataAndUpdates", "#settings/data")}
    {nav_row(lang, "settingsAcknowledgements", "#settings/acknowledgements")}
    {nav_row(lang, "settingsAppInformation", "#settings/about")}
  </ul>
</section>
<section class="sgroup" aria-labelledby="g-privacy{uid}">
  {k(lang, "settingsSectionPrivacySupport", "h2", "kicker", f' id="g-privacy{uid}"')}
  <ul class="srows">
    {nav_row(lang, "settingsPrivacyAndLegal", "#settings/privacy")}
    {nav_row(lang, "settingsFeedback", "#feedback", external=True, show="contact", hidden=not show_contact)}
    <li data-show="nocontact-nonprod"{'' if show_explain else ' hidden'}><div class="srow srow--static">
      <span class="srow__text"><span class="srow__title">{k(lang, "settingsFeedback")}<span class="sep">,</span></span>{k(lang, "settingsFeedbackUnavailable", cls="srow__desc")}</span>
    </div></li>
  </ul>
</section>
<section class="sgroup sgroup--dev" aria-labelledby="g-dev{uid}" data-show="nonprod"{'' if not prod else ' hidden'}>
  {k(lang, "settingsSectionDeveloper", "h2", "kicker", f' id="g-dev{uid}"')}
  <ul class="srows">
    {nav_row(lang, "settingsComponentCatalogue", "#catalogue", "settingsComponentCatalogueDescription")}
  </ul>
</section>
{devnotes() if live else ''}
</main>"""


ROOTS = {
    "index": ("production", "configured", "Scenario A, production build with the default support contact"),
    "production-no-contact": ("production", "none", "Scenario A2, production build with no support contact configured"),
    "non-production": ("development", "none", "Scenario B, development build with no support contact configured"),
}


def root_page(lang: str, stem: str) -> str:
    env, contact, what = ROOTS[stem]
    title = f"GridView {S[lang]['settingsTitle']}"
    return "\n".join([
        head(lang, title, f"GridView Settings, Primer V2 visual prototype ({'Spanish' if lang == 'es' else 'English'}). {what}. Strings from the ARB files; no real data."),
        body_open(lang, "root", DEFAULTS, env, contact),
        chrome(lang, env, "settingsTitle", "#back"),
        root_main(lang, env, contact, DEFAULTS),
        foot(),
    ])


# --------------------------------------------------------------------------
# Preference selection screens
# --------------------------------------------------------------------------

def options(lang: str, pref: str, selected: str, live: bool = True, states: dict | None = None,
            gid: str = "g") -> str:
    p = PREFS[pref]
    rows = []
    for value, label_key, desc_key, own_lang in p["values"]:
        on = value == selected
        uid = f"{pref}-{value}" + ("" if live else f"-{gid}")
        lang_attr = f' lang="{own_lang}"' if own_lang else ""
        desc = k(lang, desc_key, cls="opt__desc", extra=f' id="d-{uid}"') if desc_key else ""
        described = f' aria-describedby="d-{uid}"' if desc_key else ""
        extra_cls = (states or {}).get(value, "")
        rows.append(
            f'<div class="opt{(" " + extra_cls) if extra_cls else ""}" role="radio" aria-checked="{"true" if on else "false"}" '
            f'tabindex="{"0" if on else "-1"}" data-value="{value}" aria-labelledby="l-{uid}"{described}>'
            f'<span class="mark" aria-hidden="true"><svg class="mark__check"><use href="#i-check"/></svg></span>'
            f'<span class="opt__text"><span class="opt__label" id="l-{uid}" data-k="{label_key}"{lang_attr}>{t(lang, label_key)}</span>{desc}</span>'
            f"</div>")
    labelled = "screen-title" if live else f"t-{pref}-{gid}"
    return (f'<div class="opts" role="radiogroup" aria-labelledby="{labelled}" data-pref="{pref}">\n  '
            + "\n  ".join(rows) + "\n</div>")


def choice_page(lang: str, pref: str) -> str:
    p = PREFS[pref]
    sfx = ".es" if lang == "es" else ""
    title = f"GridView {S[lang][p['title']]}"
    return "\n".join([
        head(lang, title, f"GridView {S['en'][p['title']]} selection, Primer V2 visual prototype ({'Spanish' if lang == 'es' else 'English'}). Selecting applies immediately; prototype state is presentation-only."),
        body_open(lang, pref, DEFAULTS, "production", "configured"),
        chrome(lang, "production", p["title"], f"index{sfx}.html", nav="back"),
        f'<main class="page page--choice">\n{options(lang, pref, p["default"])}\n{devnotes()}\n</main>',
        '<div class="snack" role="status" aria-live="polite"><p class="snack__msg"></p></div>',
        foot(),
    ])


# --------------------------------------------------------------------------
# Development-only gallery
# --------------------------------------------------------------------------

G = {
    "en": {
        "title": "GridView Settings states",
        "h1": "Settings: development-only states",
        "intro": "Prototype gallery, not an app screen. Frames are static snapshots of the same components; the links open the interactive pages with a scenario applied through URL parameters.",
        "hub": "Interactive scenarios",
        "links": [
            ("index.html", "A. Production, default support contact"),
            ("production-no-contact.html", "A2. Production, no contact configured (feedback omitted)"),
            ("non-production.html", "B. Development build, no contact configured"),
            ("index.html?env=staging&contact=configured", "B2. Staging build, contact configured"),
            ("language.html?fail=1", "Language: every save fails"),
            ("theme.html?fail=1", "Theme: every save fails"),
            ("time.html?fail=1", "Time display: every save fails"),
            ("language.html?device=es", "Language: device language Spanish (System default resolves to Español)"),
            ("theme.html?theme=light", "Theme: Light selected (provisional light preview)"),
        ],
        "f": [
            "1. Root with non-default values (English, System, Event time)",
            "2. Selection mark: unselected, selected, keyboard focus, pressed",
            "3. Save failure: Light was tapped, the write failed, Dark is restored and the existing message is shown",
            "4. Staging build: the badge strip sits above the app bar",
            "5. Provisional light preview of the Theme screen (derived from Flutter GvColorsLight; not approved, not the Primer V2 light design)",
        ],
    },
    "es": {
        "title": "GridView Ajustes estados",
        "h1": "Ajustes: estados solo para desarrollo",
        "intro": "Galería del prototipo, no es una pantalla de la aplicación. Los marcos son capturas estáticas de los mismos componentes; los enlaces abren las páginas interactivas con un escenario aplicado mediante parámetros de URL.",
        "hub": "Escenarios interactivos",
        "links": [
            ("index.es.html", "A. Producción, contacto de soporte predeterminado"),
            ("production-no-contact.es.html", "A2. Producción, sin contacto configurado (sin comentarios)"),
            ("non-production.es.html", "B. Compilación de desarrollo, sin contacto configurado"),
            ("index.es.html?env=staging&contact=configured", "B2. Compilación de staging, contacto configurado"),
            ("language.es.html?fail=1", "Idioma: todos los guardados fallan"),
            ("theme.es.html?fail=1", "Tema: todos los guardados fallan"),
            ("time.es.html?fail=1", "Horario mostrado: todos los guardados fallan"),
            ("language.es.html?device=en", "Idioma: dispositivo en inglés (Predeterminado del sistema se resuelve a English)"),
            ("theme.es.html?theme=light", "Tema: Claro seleccionado (vista clara provisional)"),
        ],
        "f": [
            "1. Raíz con valores no predeterminados (English, Sistema, Hora del evento)",
            "2. Marca de selección: sin seleccionar, seleccionada, foco de teclado, pulsada",
            "3. Fallo al guardar: se pulsó Claro, la escritura falló, se restaura Oscuro y se muestra el mensaje existente",
            "4. Compilación de staging: la franja del distintivo queda encima de la barra",
            "5. Vista clara provisional de la pantalla Tema (derivada de GvColorsLight de Flutter; no aprobada, no es el diseño claro de Primer V2)",
        ],
    },
}


def mini_bar(lang: str, title_key: str, env: str = "production") -> str:
    strip = ""
    if env != "production":
        label = "STAGING" if env == "staging" else "DEV"
        strip = f'<div class="envstrip"><span class="envbadge">{label}</span></div>'
    return (f'<div class="chrome chrome--frame">{strip}<div class="dbar"><span class="icon-btn dbar__back">'
            f'<svg class="icon" aria-hidden="true"><use href="#i-back"/></svg></span>'
            f'<p class="dbar__title">{t(lang, title_key)}</p></div></div>')


def states_page(lang: str) -> str:
    g = G[lang]
    links = "\n".join(f'    <li><a class="hub__link" href="{E(h)}">{E(label)}</a></li>' for h, label in g["links"])
    f = g["f"]
    frame1 = (mini_bar(lang, "settingsTitle")
              + root_main(lang, "production", "configured",
                          {"language": "english", "theme": "system", "time": "event"}, live=False))
    def choice_frame(gid: str, selected: str, states: dict | None = None, bar: bool = True) -> str:
        return ((mini_bar(lang, "settingsTheme") if bar else "")
                + f'<div class="page page--choice"><p class="sr-only" id="t-theme-{gid}">{t(lang, "settingsTheme")}</p>'
                + options(lang, "theme", selected, live=False, states=states, gid=gid) + "</div>")

    frame2 = choice_frame("g2", "dark", {"system": "is-focus", "light": "is-pressed"}, bar=False)
    frame3 = (choice_frame("g3", "dark")
              + f'<div class="snack is-shown"><p class="snack__msg">{t(lang, "settingsSaveFailed")}</p></div>')
    frame4 = mini_bar(lang, "settingsTitle", env="staging") + '<div class="frame__fade"></div>'
    frame5 = choice_frame("g5", "light")
    frames = [(f[0], frame1, ""), (f[1], frame2, ""), (f[2], frame3, " frame--snack"),
              (f[3], frame4, ""), (f[4], frame5, " is-light-provisional")]
    body = "\n".join(
        f'<figure class="frame"><figcaption class="frame__cap">{E(cap)}</figcaption>'
        f'<div class="frame__screen{cls}" inert>{inner}</div></figure>'
        for cap, inner, cls in frames)
    return "\n".join([
        head(lang, g["title"], "Development-only gallery for the Settings prototype. Not an app screen."),
        '<body class="settings gallery">\n<!-- Generated by build.py - edit the generator, not this file. -->\n' + ICONS,
        f'<main class="gallery__main">\n<h1 class="gallery__title">{E(g["h1"])}</h1>\n<p class="gallery__intro">{E(g["intro"])}</p>',
        f'<section class="hub" aria-labelledby="hub-t"><h2 class="kicker" id="hub-t">{E(g["hub"])}</h2>\n  <ul class="hub__list">\n{links}\n  </ul></section>',
        body,
        "</main>\n</body>\n</html>\n",
    ])


def strings_js() -> str:
    return ("// Generated by build.py from lib/l10n/app_en.arb and app_es.arb (plus the\n"
            "// Material back-button tooltip). Do not edit.\n"
            f"window.GV_STRINGS = {json.dumps(S, ensure_ascii=False, indent=1)};\n")


def main() -> None:
    written = []
    for lang in ("en", "es"):
        sfx = ".es" if lang == "es" else ""
        for stem in ROOTS:
            written.append((f"{stem}{sfx}.html", root_page(lang, stem)))
        for pref in PREFS:
            written.append((f"{PREFS[pref]['page']}{sfx}.html", choice_page(lang, pref)))
        written.append((f"states{sfx}.html", states_page(lang)))
    written.append(("strings.js", strings_js()))
    for name, text in written:
        (OUT / name).write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {len(written)} files")


if __name__ == "__main__":
    main()
