"""Generates the Explore prototype pages from one data set (Python 3 stdlib).

    python build.py

Writes index.html / index.es.html (Drivers, Teams, Circuits) and
states.html / states.es.html (development-only state fixtures).

Data: the canonical Explore read-model fixtures in
test/support/entity_fixtures.dart (seasonDriverCardsFixture,
seasonTeamCardsFixture, seasonCircuitCardsFixture), plus the synthetic long
roster in test/screens/explore_widget_test.dart (_longDrivers). These are
development test fixtures: not staging data, not real-world results.
UI copy comes verbatim from lib/l10n/app_en.arb / app_es.arb. The row rules
mirror lib/features/explore/presentation/explore_cards.dart: an absent value
is omitted, never shown as zero, and no stable identifier is ever displayed.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent

L10N = {
    "en": {
        "lang": "en", "title": "Explore", "season": "2026 season", "settings": "Open settings",
        "selector": "Explore category", "drivers": "Drivers", "teams": "Teams", "circuits": "Circuits",
        "nav": ("Home", "Calendar", "Standings", "Explore"),
        "f_number": "Number", "f_points": "Points", "f_position": "Position",
        "f_power": "Power unit", "f_length": "Length", "f_nationality": "Nationality",
        "km": "{} km", "decimal": ".",
        "months": ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"),
        "date": "{m} {d}, {y}",
        "update_failed": "Update failed",
        "empty": {
            "drivers": ("No drivers yet", "This season has no drivers listed yet. They will appear here as soon as they do."),
            "teams": ("No teams yet", "This season has no teams listed yet. They will appear here as soon as they do."),
            "circuits": ("No circuits yet", "This season has no circuits listed yet. They will appear here as soon as they do."),
        },
        "error_t": "Can't load the drivers", "error_generic": "Something went wrong.",
        "season_t": "Season unavailable",
        "season_m": "GridView could not determine the current season. Check your connection and try again.",
        "retry": "Try again", "loading": "Loading",
        "home": "../refinement-01/index.html", "calendar": "../calendar/index.html",
        "standings": "../standings/index.html", "index_href": "index.html",
    },
    "es": {
        "lang": "es", "title": "Explorar", "season": "Temporada 2026", "settings": "Abrir ajustes",
        "selector": "Categoría", "drivers": "Pilotos", "teams": "Equipos", "circuits": "Circuitos",
        "nav": ("Inicio", "Calendario", "Clasificaciones", "Explorar"),
        "f_number": "Número", "f_points": "Puntos", "f_position": "Posición",
        "f_power": "Unidad de potencia", "f_length": "Longitud", "f_nationality": "Nacionalidad",
        "km": "{} km", "decimal": ",",
        "months": ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"),
        "date": "{d} {m} {y}",
        "update_failed": "No se pudo actualizar",
        "empty": {
            "drivers": ("Todavía no hay pilotos", "Esta temporada aún no tiene pilotos publicados. Aparecerán aquí en cuanto los haya."),
            "teams": ("Todavía no hay equipos", "Esta temporada aún no tiene equipos publicados. Aparecerán aquí en cuanto los haya."),
            "circuits": ("Todavía no hay circuitos", "Esta temporada aún no tiene circuitos publicados. Aparecerán aquí en cuanto los haya."),
        },
        "error_t": "No se pueden cargar los pilotos", "error_generic": "Algo salió mal.",
        "season_t": "Temporada no disponible",
        "season_m": "GridView no ha podido determinar la temporada actual. Comprueba tu conexión e inténtalo de nuevo.",
        "retry": "Reintentar", "loading": "Cargando",
        "home": "../refinement-01/index.es.html", "calendar": "../calendar/index.es.html",
        "standings": "../standings/index.es.html", "index_href": "index.es.html",
    },
}


@dataclass(frozen=True)
class Driver:
    driver_id: str
    name: str
    short_code: str | None = None
    race_number: int | None = None
    nationality: str | None = None
    team_name: str | None = None
    team_color: str | None = None
    position: int | None = None
    points: float | None = None


@dataclass(frozen=True)
class Team:
    constructor_id: str
    display_name: str          # seasonName ?? shortName ?? stableName
    team_color: str | None = None
    power_unit: str | None = None
    position: int | None = None
    points: float | None = None
    lineup: tuple[str, ...] = field(default_factory=tuple)   # shortCode ?? name


@dataclass(frozen=True)
class Circuit:
    circuit_id: str
    name: str
    locality: str | None = None
    country: str | None = None
    length_m: int | None = None
    gp_name: str | None = None
    gp_start: str | None = None   # ISO calendar date


# test/support/entity_fixtures.dart — seasonDriverCardsFixture (delivered order)
DRIVERS = (
    Driver("max-verstappen", "Max Verstappen", "VER", 1, "Dutch", "Oracle Red Bull Racing", "#1E41FF", 2, 402.5),
    Driver("lando-norris", "Lando Norris", "NOR", 4, "British", "McLaren Formula 1 Team", "#FF8000", 1, 460.5),
    Driver("franco-colapinto", "Franco Colapinto", "COL", 43, None, "BWT Alpine Formula One Team", None, None, 0),
    Driver("unaffiliated-entrant", "Unaffiliated Entrant", race_number=55),   # unresolved team stub
    Driver("reserve-entrant", "Reserve Entrant"),                              # no standing at all
)
# seasonTeamCardsFixture (stable-name order: Alpine, McLaren, Red Bull)
TEAMS = (
    Team("alpine", "BWT Alpine Formula One Team", "#0093CC", "Renault", 6, 22, ("GAS", "DOO", "COL")),
    Team("mclaren", "McLaren Formula 1 Team", "#FF8000", "Mercedes", 1, 460.5, ("NOR",)),
    Team("red-bull", "Oracle Red Bull Racing", "#1E41FF", None, 2, 402.5, ("VER",)),
)
# seasonCircuitCardsFixture (calendar order: rounds 12, 13)
CIRCUITS = (
    Circuit("monza", "Autodromo Nazionale Monza", "Monza", "Italy", 5793, "Italian Grand Prix", "2026-07-10"),
    Circuit("spa-francorchamps", "Circuit de Spa-Francorchamps", "Stavelot", "Belgium", 7004,
            "Belgian Grand Prix", "2026-07-24"),
)
# test/screens/explore_widget_test.dart — _longDrivers (synthetic, 22 rows)
LONG_DRIVERS = tuple(
    Driver(f"driver-{i + 1}", f"Driver {i + 1}", race_number=i + 1, team_name=f"Team {i // 2 + 1}",
           position=i + 1, points=(22 - i) * 10)
    for i in range(22)
)


def fmt_number(value: float, t: dict) -> str:
    text = f"{value:.3f}".rstrip("0").rstrip(".")
    return text.replace(".", t["decimal"])


def fmt_date(iso: str | None, t: dict) -> str | None:
    if not iso:
        return None
    y, m, d = (int(p) for p in iso.split("-"))
    return t["date"].format(y=y, m=t["months"][m - 1], d=d)


def join(parts: list[str | None], sep: str = " · ") -> str | None:
    present = [p for p in parts if p and p.strip()]
    return sep.join(present) if present else None


ICONS = """<svg width="0" height="0" class="sprite" aria-hidden="true" focusable="false">
  <symbol id="i-settings" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></symbol>
  <symbol id="i-cloud-off" viewBox="0 0 24 24"><path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/></symbol>
  <symbol id="i-driver" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></symbol>
  <symbol id="i-circuit" viewBox="0 0 24 24"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></symbol>
  <symbol id="i-team" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></symbol>
  <symbol id="i-helmet" viewBox="0 0 24 24"><path d="M12 4a8 8 0 0 0-8 8v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3a9 9 0 0 0-8-9z"/><path d="M4 13h9a3 3 0 0 0 3-3V7"/></symbol>
  <symbol id="i-home" viewBox="0 0 24 24"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></symbol>
  <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></symbol>
  <symbol id="i-standings" viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></symbol>
  <symbol id="i-explore" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/></symbol>
</svg>"""


def head(t: dict, title: str, description: str, extra_css: str = "", scripts: tuple[str, ...] = ()) -> str:
    css = '<link rel="stylesheet" href="primer-core.css">\n<link rel="stylesheet" href="explore.css">'
    if extra_css:
        css += f'\n<link rel="stylesheet" href="{extra_css}">'
    js = "".join(f'\n<script src="{s}" defer></script>' for s in scripts)
    return f"""<!doctype html>
<html lang="{t['lang']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{escape(title)}</title>
<meta name="description" content="{escape(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" rel="stylesheet">
{css}{js}
</head>
<body>
<!-- Generated by build.py — edit the generator, not this file. -->

<!-- Icon sprite. Paths from Lucide (ISC licence), 24px grid, 1.75 stroke. -->
{ICONS}
"""


def datum(label: str, value: str) -> str:
    return (f'<span class="datum"><span class="datum__label">{escape(label)}</span>'
            f'<span class="datum__value">{escape(value)}</span></span>')


def media_slot(icon: str) -> str:
    # Placeholder only: no cleared media exists (content/media/media-rights.json is empty).
    return f'<span class="ent__media"><svg class="icon" aria-hidden="true"><use href="#{icon}"/></svg></span>'


def accent(color: str | None) -> str:
    return f' style="--accent: {escape(color)}"' if color else ""


def driver_row(d: Driver, t: dict) -> str:
    sub = join([d.team_name, d.nationality])
    points = None if d.points is None else fmt_number(d.points, t)
    data = []
    if d.position is not None:
        data.append(datum(t["f_position"], str(d.position)))
    if points is not None:
        data.append(datum(t["f_points"], points))
    number = None if d.race_number is None else str(d.race_number)
    label = join([
        d.name, d.team_name,
        *([f"{t['f_nationality']} {d.nationality}"] if d.nationality else []),
        *([f"{t['f_position']} {d.position}"] if d.position is not None else []),
        *([f"{t['f_points']} {points}"] if points is not None else []),
        *([f"{t['f_number']} {number}"] if number else []),
        d.short_code,
    ], ", ")
    fig = ""
    if number or d.short_code:
        num = f'<span class="ent__fig-num">{escape(number)}</span>' if number else ""
        cap = f'<span class="ent__fig-cap">{escape(d.short_code)}</span>' if d.short_code else ""
        fig = f'\n        <span class="ent__fig" aria-hidden="true">{num}{cap}</span>'
    sub_html = f'\n          <span class="ent__sub">{escape(sub)}</span>' if sub else ""
    data_html = f'\n          <span class="ent__data">{"".join(data)}</span>' if data else ""
    return f"""    <li class="ent ent--driver"{accent(d.team_color)}>
      <a class="ent__link" href="#drivers/{escape(d.driver_id)}" aria-label="{escape(label)}">
        {media_slot('i-driver')}
        <span class="ent__body">
          <span class="ent__name">{escape(d.name)}</span>{sub_html}{data_html}
        </span>{fig}
      </a>
    </li>"""


def team_row(tm: Team, t: dict) -> str:
    points = None if tm.points is None else fmt_number(tm.points, t)
    data = []
    if tm.position is not None:
        data.append(datum(t["f_position"], str(tm.position)))
    if points is not None:
        data.append(datum(t["f_points"], points))
    if tm.power_unit:
        data.append(datum(t["f_power"], tm.power_unit))
    lineup = " · ".join(tm.lineup) if tm.lineup else None
    label = join([
        tm.display_name,
        *([f"{t['f_position']} {tm.position}"] if tm.position is not None else []),
        *([f"{t['f_points']} {points}"] if points is not None else []),
        *([f"{t['f_power']} {tm.power_unit}"] if tm.power_unit else []),
        ", ".join(tm.lineup) if tm.lineup else None,
    ], ", ")
    codes = f'\n          <span class="ent__codes">{escape(lineup)}</span>' if lineup else ""
    data_html = f'\n          <span class="ent__data">{"".join(data)}</span>' if data else ""
    return f"""    <li class="ent ent--team"{accent(tm.team_color)}>
      <a class="ent__link" href="#constructors/{escape(tm.constructor_id)}" aria-label="{escape(label)}">
        {media_slot('i-shield')}
        <span class="ent__body">
          <span class="ent__name">{escape(tm.display_name)}</span>{codes}{data_html}
        </span>
      </a>
    </li>"""


def circuit_row(c: Circuit, t: dict) -> str:
    location = join([c.locality, c.country], ", ")
    date = fmt_date(c.gp_start, t)
    event = join([c.gp_name, date])
    km_value = None if c.length_m is None else fmt_number(c.length_m / 1000, t)
    km_text = None if km_value is None else t["km"].format(km_value)
    label = join([c.name, location, c.gp_name, date,
                  *([f"{t['f_length']} {km_text}"] if km_text else [])], ", ")
    fig = ""
    if km_value:
        unit = t["km"].format("").strip()
        fig = (f'\n        <span class="ent__fig" aria-hidden="true"><span class="ent__fig-num">{escape(km_value)}</span>'
               f'<span class="ent__fig-cap">{escape(unit)}</span></span>')
    loc_html = f'\n          <span class="ent__sub">{escape(location)}</span>' if location else ""
    # The date never breaks internally ("Jul / 10, 2026").
    event_html = ""
    if event:
        parts = [escape(c.gp_name)] if c.gp_name else []
        if date:
            parts.append(f'<span class="nowrap">{escape(date)}</span>')
        event_html = f'\n          <span class="ent__sub">{" · ".join(parts)}</span>'
    return f"""    <li class="ent ent--circuit">
      <a class="ent__link" href="#circuits/{escape(c.circuit_id)}" aria-label="{escape(label)}">
        {media_slot('i-circuit')}
        <span class="ent__body">
          <span class="ent__name">{escape(c.name)}</span>{loc_html}{event_html}
        </span>{fig}
      </a>
    </li>"""


def rows_list(rows, render, t: dict, labelled: str) -> str:
    return f'  <ol class="lib" aria-labelledby="{labelled}">\n' + "\n".join(render(r, t) for r in rows) + "\n  </ol>"


def nav(t: dict) -> str:
    home, cal, stand, expl = t["nav"]
    return f"""<nav class="tabbar">
  <a class="tab" href="{t['home']}"><span class="tab__icon"><svg class="icon" aria-hidden="true"><use href="#i-home"/></svg></span><span class="tab__label">{home}</span></a>
  <a class="tab" href="{t['calendar']}"><span class="tab__icon"><svg class="icon" aria-hidden="true"><use href="#i-calendar"/></svg></span><span class="tab__label">{cal}</span></a>
  <a class="tab" href="{t['standings']}"><span class="tab__icon"><svg class="icon" aria-hidden="true"><use href="#i-standings"/></svg></span><span class="tab__label">{stand}</span></a>
  <a class="tab is-selected" href="#explore" aria-current="page"><span class="tab__icon"><svg class="icon" aria-hidden="true"><use href="#i-explore"/></svg></span><span class="tab__label">{expl}</span></a>
</nav>"""


def index_page(t: dict) -> str:
    language = "English" if t["lang"] == "en" else "Spanish"
    out = head(t, f"GridView {t['title']}",
               f"GridView Explore, Primer V2 visual prototype ({language}). Development fixture data.",
               scripts=("nav-inset.js", "explore.js"))
    seg = "\n".join(
        f'    <button class="seg__btn" type="button" aria-pressed="{"true" if i == 0 else "false"}" '
        f'aria-controls="{key}" data-target="{key}"><span class="seg__label">{escape(t[key])}</span></button>'
        for i, key in enumerate(("drivers", "teams", "circuits"))
    )
    return out + f"""
<!-- App bar (Settings only: Explore has no refresh action) + season, then the
     category selector. The selected collection's status (progress line or
     "Update failed") would sit under the selector; none is active here. -->
<header class="appbar appbar--pinned">
  <div class="appbar__brand">
    <h1 class="wordmark">{escape(t['title'])}</h1>
  </div>
  <div class="appbar__actions">
    <button class="icon-btn" type="button" aria-label="{escape(t['settings'])}"><svg class="icon" aria-hidden="true"><use href="#i-settings"/></svg></button>
  </div>
  <p class="season" id="season">{escape(t['season'])}</p>
</header>
<div class="pinbar">
  <div class="seg" role="group" aria-label="{escape(t['selector'])}">
{seg}
  </div>
</div>

<main class="lib-page">

<!-- Drivers (ED01–ED09). Roster order: race number, unnumbered last, then name. -->
<section id="drivers" aria-label="{escape(t['drivers'])}">
{rows_list(DRIVERS, driver_row, t, 'season')}
</section>

<!-- Teams (ET01–ET07). Stable-name order. -->
<section id="teams" aria-label="{escape(t['teams'])}" hidden>
{rows_list(TEAMS, team_row, t, 'season')}
</section>

<!-- Circuits (EC01–EC07). Calendar order. -->
<section id="circuits" aria-label="{escape(t['circuits'])}" hidden>
{rows_list(CIRCUITS, circuit_row, t, 'season')}
</section>

</main>

{nav(t)}

</body>
</html>
"""


SPECIMENS = (
    ("Background refresh: thin progress line, cached rows stay", "ExploreCollectionReady(refreshing: true)", "refreshing"),
    ("Refresh failed: notice, cached rows stay", "ExploreCollectionReady(refreshError: …), exploreUpdateFailed", "failed"),
    ("Valid empty collection: Drivers", "ExploreCollectionEmpty, with the retry action", "empty-drivers"),
    ("Valid empty collection: Teams", "ExploreCollectionEmpty", "empty-teams"),
    ("Valid empty collection: Circuits", "ExploreCollectionEmpty", "empty-circuits"),
    ("First-load error", "ExploreCollectionFirstLoadError, resource failure (errorGeneric)", "error"),
    ("Season unavailable", "ExploreCollectionFirstLoadError, season unresolved", "season"),
    ("Loading, first load", "ExploreCollectionLoading, 6 placeholder rows", "loading"),
    ("Long roster: 22 drivers", "test/screens/explore_widget_test.dart: _longDrivers (synthetic)", "long"),
)


def specimen_body(kind: str, t: dict, index: int) -> str:
    if kind == "refreshing":
        return f'<div class="status pinbar-like"><div class="progress" role="progressbar" aria-label="{escape(t["loading"])}"></div></div>'
    if kind == "failed":
        return (f'<div class="status pinbar-like"><p class="notice" role="status"><svg class="icon" aria-hidden="true">'
                f'<use href="#i-cloud-off"/></svg><span>{escape(t["update_failed"])}</span></p></div>')
    if kind.startswith("empty-"):
        key = kind.split("-", 1)[1]
        title, msg = t["empty"][key]
        icon = {"drivers": "i-helmet", "teams": "i-team", "circuits": "i-circuit"}[key]
        return (f'<div class="empty"><svg class="icon" aria-hidden="true"><use href="#{icon}"/></svg>'
                f'<h3 class="empty__title">{escape(title)}</h3><p class="empty__msg">{escape(msg)}</p>'
                f'<button class="btn" type="button">{escape(t["retry"])}</button></div>')
    if kind in ("error", "season"):
        title, msg = (t["error_t"], t["error_generic"]) if kind == "error" else (t["season_t"], t["season_m"])
        return (f'<div class="empty"><svg class="icon" aria-hidden="true"><use href="#i-cloud-off"/></svg>'
                f'<h3 class="empty__title">{escape(title)}</h3><p class="empty__msg">{escape(msg)}</p>'
                f'<button class="btn" type="button">{escape(t["retry"])}</button></div>')
    if kind == "loading":
        row = ('<div class="skeleton__row"><div class="skeleton__slot"></div><div class="skeleton__lines">'
               '<div class="skeleton__line"></div><div class="skeleton__line"></div></div></div>')
        return f'<div class="skeleton" role="status" aria-label="{escape(t["loading"])}">{row * 6}</div>'
    return rows_list(LONG_DRIVERS, driver_row, t, f"spec-{index}")


def states_page(t: dict) -> str:
    out = head(t, "GridView Explore states",
               "Development-only Explore state fixtures. Not app UI, not production data.",
               extra_css="states.css")
    sections = []
    for i, (caption, source, kind) in enumerate(SPECIMENS, start=1):
        sections.append(f"""<section class="spec" aria-labelledby="spec-{i}">
  <div class="spec__cap"><h2 class="spec__title" id="spec-{i}">{i}. {escape(caption)}</h2><p class="spec__src">{escape(source)}</p></div>
  <div class="spec__frame">
{specimen_body(kind, t, i)}
  </div>
</section>""")
    return out + f"""
<header class="dev-head">
  <p class="dev-head__flag">Development fixtures. Not app UI, not production data</p>
  <h1 class="dev-head__title">Explore states</h1>
  <p class="dev-head__note">State copy comes from the ARB files; captions are prototype annotations. Missing, loading and failed images all render the same placeholder, so they need no separate specimen. <a href="{t['index_href']}">Back to the prototype</a></p>
</header>

<main class="specs">
{"".join(chr(10) * 2 + s for s in sections)}
</main>

</body>
</html>
"""


def main() -> None:
    for lang, t in L10N.items():
        suffix = "" if lang == "en" else ".es"
        (HERE / f"index{suffix}.html").write_text(index_page(t), encoding="utf-8", newline="\n")
        (HERE / f"states{suffix}.html").write_text(states_page(t), encoding="utf-8", newline="\n")
    print("wrote index.html, index.es.html, states.html, states.es.html")


if __name__ == "__main__":
    main()
