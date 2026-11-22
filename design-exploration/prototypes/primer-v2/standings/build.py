"""Generates the Standings prototype pages from one data set (Python 3 stdlib).

    python build.py

Writes index.html / index.es.html (frozen staging data, both championships)
and states.html / states.es.html (development-only state fixtures copied from
the Flutter tests). All UI copy comes from lib/l10n/app_en.arb / app_es.arb.
The row model mirrors lib/features/standings/presentation/standings_row_view.dart:
nothing is invented, a missing value is omitted, a missing position is "—".
"""
from __future__ import annotations

from dataclasses import dataclass
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent

# --------------------------------------------------------------------------
# Localized strings (verbatim from the ARB files)
# --------------------------------------------------------------------------
L10N = {
    "en": {
        "lang": "en", "title": "Standings", "season": "2026 season",
        "refresh": "Refresh standings", "settings": "Open settings",
        "selector": "Championship", "drivers": "Drivers", "constructors": "Constructors",
        "nav": ("Home", "Calendar", "Standings", "Explore"),
        "leader": "Championship leader", "tied": "Tied for the championship lead",
        "pos_sem": "Position {}", "unranked_sem": "Position unavailable", "unranked": "—",
        "points_sem": "{} points", "pts": "{} pts",
        "win1": "1 win", "wins": "{} wins",
        "provisional": "Provisional",
        "prov_notice": "These standings are provisional and may still change.",
        "name_unavailable": "Name unavailable",
        "refreshing": "Refreshing…", "last_check": "Last successful check: {}",
        "stale": "This data may be out of date — showing the last saved version.",
        "failed": "Couldn't refresh — showing saved data.",
        "drivers_empty_t": "No drivers' standings yet",
        "drivers_empty_m": "The drivers' championship has no classified entries for this season yet. They will appear here as soon as they do.",
        "drivers_error_t": "Can't load the drivers' standings",
        "error_server": "The service is temporarily unavailable.",
        "season_unavail_t": "Season unavailable",
        "season_unavail_m": "GridView could not determine the current season. Check your connection and try again.",
        "retry": "Try again", "loading": "Loading",
        "decimal": ".",
        "home": "../refinement-01/index.html", "calendar": "../calendar/index.html",
        "states_href": "states.html", "index_href": "index.html",
    },
    "es": {
        "lang": "es", "title": "Clasificaciones", "season": "Temporada 2026",
        "refresh": "Actualizar clasificaciones", "settings": "Abrir ajustes",
        "selector": "Campeonato", "drivers": "Pilotos", "constructors": "Constructores",
        "nav": ("Inicio", "Calendario", "Clasificaciones", "Explorar"),
        "leader": "Líder del campeonato", "tied": "Empatado en el liderato del campeonato",
        "pos_sem": "Posición {}", "unranked_sem": "Posición no disponible", "unranked": "—",
        "points_sem": "{} puntos", "pts": "{} pts",
        "win1": "1 victoria", "wins": "{} victorias",
        "provisional": "Provisional",
        "prov_notice": "Esta clasificación es provisional y todavía puede cambiar.",
        "name_unavailable": "Nombre no disponible",
        "refreshing": "Actualizando…", "last_check": "Comprobado: {}",
        "stale": "Estos datos pueden estar desactualizados — mostrando la última versión guardada.",
        "failed": "No se pudo actualizar — mostrando datos guardados.",
        "drivers_empty_t": "Aún no hay clasificación de pilotos",
        "drivers_empty_m": "El campeonato de pilotos todavía no tiene entradas clasificadas para esta temporada. Aparecerán aquí en cuanto las haya.",
        "drivers_error_t": "No se puede cargar la clasificación de pilotos",
        "error_server": "El servicio no está disponible temporalmente.",
        "season_unavail_t": "Temporada no disponible",
        "season_unavail_m": "GridView no ha podido determinar la temporada actual. Comprueba tu conexión e inténtalo de nuevo.",
        "retry": "Reintentar", "loading": "Cargando",
        "decimal": ",",
        "home": "../refinement-01/index.es.html", "calendar": "../calendar/index.es.html",
        "states_href": "states.es.html", "index_href": "index.es.html",
    },
}


@dataclass(frozen=True)
class Row:
    entity_id: str
    position: int | None
    name: str | None
    points: float
    team: str | None = None
    wins: int | None = None
    provisional: bool | None = None


# --------------------------------------------------------------------------
# Frozen staging data (owner screenshots). Not real-world results.
# --------------------------------------------------------------------------
STAGING_DRIVERS = (
    Row("lando-norris", 1, "Lando Norris", 120, team="McLaren", wins=3),
    Row("alexander-albon", 2, "Alexander Albon", 64, wins=1),  # team not established
    Row("fernando-alonso", 3, "Fernando Alonso", 40, team="Mercedes", wins=0),
    Row("andrea-kimi-antonelli", 4, "Andrea Kimi Antonelli", 7, team="Alpine", wins=0),
    Row("paul-aron", 5, "Paul Aron", 7, team="Alpine", wins=0),
)
STAGING_CONSTRUCTORS = (
    Row("mclaren", 1, "McLaren", 150),  # wins not confirmed: omitted
)


# --------------------------------------------------------------------------
# Formatting (mirrors StandingsFormatter)
# --------------------------------------------------------------------------
def fmt_points(value: float, t: dict) -> str:
    text = f"{value:.3f}".rstrip("0").rstrip(".")
    return text.replace(".", t["decimal"])


def fmt_wins(value: int | None, t: dict) -> str | None:
    if value is None:
        return None
    return t["win1"] if value == 1 else t["wins"].format(value)


def summarise_provisional(rows: tuple[Row, ...]) -> str:
    flags = [r.provisional for r in rows if r.provisional is not None]
    if not flags:
        return "unspecified"
    if all(flags):
        return "provisional"
    if not any(flags):
        return "notProvisional"
    return "mixed"


ICONS = """<svg width="0" height="0" class="sprite" aria-hidden="true" focusable="false">
  <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></symbol>
  <symbol id="i-settings" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></symbol>
  <symbol id="i-chevron" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
  <symbol id="i-cloud-off" viewBox="0 0 24 24"><path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/></symbol>
  <symbol id="i-trophy" viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></symbol>
  <symbol id="i-home" viewBox="0 0 24 24"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></symbol>
  <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></symbol>
  <symbol id="i-standings" viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></symbol>
  <symbol id="i-explore" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/></symbol>
</svg>"""


def head(t: dict, title: str, description: str, extra_css: str = "", scripts: tuple[str, ...] = ()) -> str:
    css = '<link rel="stylesheet" href="primer-core.css">\n<link rel="stylesheet" href="standings.css">'
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


# --------------------------------------------------------------------------
# Rows and tables
# --------------------------------------------------------------------------
def render_row(row: Row, t: dict, *, route: str, mark_provisional: bool, tied: bool) -> str:
    name = row.name or t["name_unavailable"]
    points = fmt_points(row.points, t)
    wins = fmt_wins(row.wins, t)
    leader = row.position == 1
    provisional = mark_provisional and row.provisional is True
    position = t["unranked"] if row.position is None else str(row.position)
    pos_sem = t["unranked_sem"] if row.position is None else t["pos_sem"].format(row.position)

    # Flutter's explicit reading order: position, name, team, points, wins, status.
    label_parts = [pos_sem, name, *([row.team] if row.team else []), t["points_sem"].format(points),
                   *([wins] if wins else [])]
    if leader:
        label_parts.append(t["tied"] if tied else t["leader"])
    if provisional:
        label_parts.append(t["provisional"])
    label = ", ".join(label_parts)

    details = [d for d in (row.team, wins) if d]
    meta = ""
    if details or provisional:
        # A statistic ("0 wins") never breaks between count and noun.
        inner = " · ".join(
            f'<span class="st__stat">{escape(d)}</span>' if d == wins else escape(d) for d in details
        )
        if provisional:
            badge = f'<span class="chip chip--provisional"><span class="dagger" aria-hidden="true">†</span>{escape(t["provisional"])}</span>'
            inner = f"<span>{inner}</span>{badge}" if inner else badge
        meta = f'\n          <span class="st__meta">{inner}</span>'
    kicker = ""
    if leader:
        kicker = f'\n          <span class="st__kicker">{escape(t["tied"] if tied else t["leader"])}</span>'
    pts = escape(points)
    if leader:
        unit = t["pts"].format("").strip()
        pts = f'{pts}<span class="st__unit">{escape(unit)}</span>'
    cls = "st st--leader" if leader else "st"
    return f"""    <li class="{cls}">
      <a class="st__link" href="#{route}/{escape(row.entity_id)}" aria-label="{escape(label)}">
        <span class="st__pos">{escape(position)}</span>
        <span class="st__who">{kicker}
          <span class="st__name">{escape(name)}</span>{meta}
        </span>
        <span class="st__pts">{pts}</span>
        <svg class="icon st__go" aria-hidden="true"><use href="#i-chevron"/></svg>
      </a>
    </li>"""


def render_table(rows: tuple[Row, ...], t: dict, *, route: str, labelled_by: str) -> str:
    summary = summarise_provisional(rows)
    tied = sum(1 for r in rows if r.position == 1) > 1
    body = "\n".join(
        render_row(r, t, route=route, mark_provisional=summary == "mixed", tied=tied) for r in rows
    )
    return f'  <ol class="table" aria-labelledby="{labelled_by}">\n{body}\n  </ol>'


def render_status(t: dict, *, last_check: str | None = None, refreshing: bool = False,
                  provisional_notice: bool = False, stale: bool = False, failed: bool = False) -> str:
    parts = []
    if refreshing:
        parts.append(f'<p class="status__line">{escape(t["refreshing"])}</p>')
    elif last_check:
        parts.append(f'<p class="status__line">{escape(t["last_check"].format(last_check))}</p>')
    if provisional_notice:
        parts.append(f'<p class="status__line">{escape(t["prov_notice"])}</p>')
    if failed or stale:
        msg = t["failed"] if failed else t["stale"]
        parts.append(f'<p class="notice" role="status"><svg class="icon" aria-hidden="true"><use href="#i-cloud-off"/></svg><span>{escape(msg)}</span></p>')
    if not parts:
        return ""
    return '<div class="status">' + "".join(parts) + "</div>"


def nav(t: dict) -> str:
    home, cal, stand, expl = t["nav"]
    return f"""<nav class="tabbar">
  <a class="tab" href="{t['home']}"><span class="tab__icon"><svg class="icon" aria-hidden="true"><use href="#i-home"/></svg></span><span class="tab__label">{home}</span></a>
  <a class="tab" href="{t['calendar']}"><span class="tab__icon"><svg class="icon" aria-hidden="true"><use href="#i-calendar"/></svg></span><span class="tab__label">{cal}</span></a>
  <a class="tab is-selected" href="#standings" aria-current="page"><span class="tab__icon"><svg class="icon" aria-hidden="true"><use href="#i-standings"/></svg></span><span class="tab__label">{stand}</span></a>
  <a class="tab" href="#explore"><span class="tab__icon"><svg class="icon" aria-hidden="true"><use href="#i-explore"/></svg></span><span class="tab__label">{expl}</span></a>
</nav>"""


# --------------------------------------------------------------------------
# Main page: frozen staging data
# --------------------------------------------------------------------------
def index_page(t: dict) -> str:
    language = "English" if t["lang"] == "en" else "Spanish"
    out = head(t, f"GridView {t['title']}",
               f"GridView Standings, Primer V2 visual prototype ({language}). Dark-first, frozen staging data.",
               scripts=("nav-inset.js", "standings.js"))
    out += f"""
<!-- App bar + season (ST01), then the championship selector (ST02) and the
     selected table's status (ST15–ST18): all fixed above the list, as in
     Flutter. At large text the app bar row scrolls away and only the selector
     stays pinned (standings.js, header budget). No table status is shown: the
     frozen data has no Standings check time and no provisional flags. -->
<header class="appbar appbar--pinned">
  <div class="appbar__brand">
    <h1 class="wordmark">{escape(t['title'])}</h1>
  </div>
  <div class="appbar__actions">
    <button class="icon-btn" type="button" aria-label="{escape(t['refresh'])}"><svg class="icon" aria-hidden="true"><use href="#i-refresh"/></svg></button>
    <button class="icon-btn" type="button" aria-label="{escape(t['settings'])}"><svg class="icon" aria-hidden="true"><use href="#i-settings"/></svg></button>
  </div>
  <p class="season" id="season">{escape(t['season'])}</p>
</header>
<div class="pinbar">
  <div class="seg" role="group" aria-label="{escape(t['selector'])}">
    <button class="seg__btn" type="button" aria-pressed="true" aria-controls="drivers" data-target="drivers"><span class="seg__label">{escape(t['drivers'])}</span></button>
    <button class="seg__btn" type="button" aria-pressed="false" aria-controls="constructors" data-target="constructors"><span class="seg__label">{escape(t['constructors'])}</span></button>
  </div>
</div>

<main class="stand">

<!-- Drivers' championship (ST03–ST08, ST14). Delivered order. Each row opens
     /drivers/:driverId with the table's season as navigation origin. -->
<section id="drivers" aria-label="{escape(t['drivers'])}">
{render_table(STAGING_DRIVERS, t, route='drivers', labelled_by='season')}
</section>

<!-- Constructors' championship (ST09–ST14). Only the confirmed staging row
     exists; the coverage limit is documented in README.md, not in the UI. -->
<section id="constructors" aria-label="{escape(t['constructors'])}" hidden>
{render_table(STAGING_CONSTRUCTORS, t, route='constructors', labelled_by='season')}
</section>

</main>

{nav(t)}

</body>
</html>
"""
    return out


# --------------------------------------------------------------------------
# Development-only state fixtures (copied from the Flutter tests)
# --------------------------------------------------------------------------
SPECIMENS = (
    ("Leader comes from a confirmed position 1 only · unranked row",
     "test/screens/standings_widget_test.dart: 'leader emphasis comes from a confirmed position 1 only'",
     dict(rows=(Row("unranked-top", None, "Unranked Top", 999), Row("real-leader", 1, "Real Leader", 10)))),
    ("Tied leaders",
     "test/screens/standings_widget_test.dart: 'several confirmed leaders are announced as tied'",
     dict(rows=(Row("tied-a", 1, "Tied A", 100), Row("tied-b", 1, "Tied B", 100)))),
    ("Delivered order is kept",
     "test/screens/standings_widget_test.dart: 'rows keep their delivered order'",
     dict(rows=(Row("first-delivered", 9, "First Delivered", 1), Row("second-delivered", 1, "Second Delivered", 500)))),
    ("Unresolved name",
     "test/screens/standings_widget_test.dart: 'an unresolved identity shows the localized fallback'",
     dict(rows=(Row("unsynced-driver", 1, None, 25),))),
    ("Unresolved team: no team line",
     "test/screens/standings_widget_test.dart: 'an unresolved team leaves the row without a team line'",
     dict(rows=(Row("known-driver", 1, "Known Driver", 25, wins=1),))),
    ("Decimal points (constructors)",
     "test/database/standings_dao_test.dart: 'fractional points round-trip exactly' (no display name in the fixture)",
     dict(rows=(Row("team-a", 1, None, 0.5),), route="constructors")),
    ("Provisional: every row agrees → one notice",
     "test/screens/standings_widget_test.dart: 'rows that all agree show one section-level notice'",
     dict(rows=(Row("row-a", 1, "Row A", 10, provisional=True), Row("row-b", 2, "Row B", 5, provisional=True)))),
    ("Provisional: rows disagree → row marker",
     "test/screens/standings_widget_test.dart: 'disagreeing rows are marked individually'",
     dict(rows=(Row("row-a", 1, "Row A", 10, provisional=True), Row("row-b", 2, "Row B", 5, provisional=False)))),
    ("Background refresh (cached rows stay below)",
     "Table status only: rows unchanged",
     dict(status=dict(refreshing=True))),
    ("Stale cached data",
     "Table status only: time from 'the selected table's own update time is shown' (09:05 UTC, shown in GMT)",
     dict(status=dict(last_check="09:05", stale=True))),
    ("Refresh failed, cached rows kept (failure wording wins)",
     "Table status only",
     dict(status=dict(last_check="09:05", stale=True, failed=True))),
    ("Valid empty table", "StandingsEmpty: drivers", dict(empty=True)),
    ("First-load error (resource)", "StandingsFirstLoadError: server failure copy", dict(error="resource")),
    ("Season unavailable", "StandingsFirstLoadError: season unresolved", dict(error="season")),
    ("Loading (first load, no cached rows)", "StandingsLoading: 6 placeholder rows", dict(loading=True)),
)


def specimen_body(spec: dict, t: dict, index: int) -> str:
    if "rows" in spec:
        rows = spec["rows"]
        summary = summarise_provisional(rows)
        status = render_status(t, provisional_notice=summary == "provisional")
        heading_id = f"spec-{index}"
        return f'{status}\n{render_table(rows, t, route=spec.get("route", "drivers"), labelled_by=heading_id)}'
    if "status" in spec:
        return render_status(t, **spec["status"])
    if spec.get("empty"):
        return f"""<div class="empty"><svg class="icon" aria-hidden="true"><use href="#i-trophy"/></svg>
<h3 class="empty__title">{escape(t['drivers_empty_t'])}</h3><p class="empty__msg">{escape(t['drivers_empty_m'])}</p></div>"""
    if spec.get("error"):
        title, msg = ((t["drivers_error_t"], t["error_server"]) if spec["error"] == "resource"
                      else (t["season_unavail_t"], t["season_unavail_m"]))
        return f"""<div class="empty"><svg class="icon" aria-hidden="true"><use href="#i-trophy"/></svg>
<h3 class="empty__title">{escape(title)}</h3><p class="empty__msg">{escape(msg)}</p>
<button class="btn" type="button">{escape(t['retry'])}</button></div>"""
    rows = "".join('<div class="skeleton__row"></div>' for _ in range(6))
    return f'<div class="skeleton" role="status" aria-label="{escape(t["loading"])}">{rows}</div>'


def states_page(t: dict) -> str:
    out = head(t, "GridView Standings states",
               "Development-only Standings state fixtures, copied from the Flutter tests. Not championship data.",
               extra_css="states.css")
    sections = []
    for i, (caption, source, spec) in enumerate(SPECIMENS, start=1):
        sections.append(f"""<section class="spec" aria-labelledby="spec-{i}">
  <div class="spec__cap"><h2 class="spec__title" id="spec-{i}">{i}. {escape(caption)}</h2><p class="spec__src">{escape(source)}</p></div>
  <div class="spec__frame">
{specimen_body(spec, t, i)}
  </div>
</section>""")
    joined = "\n\n".join(sections)
    return out + f"""
<header class="dev-head">
  <p class="dev-head__flag">Development fixtures. Not app UI, not championship data</p>
  <h1 class="dev-head__title">Standings states</h1>
  <p class="dev-head__note">Every row below is copied from a Flutter test fixture. Captions are prototype annotations; the app copy inside each frame comes from the ARB files. <a href="{t['index_href']}">Back to the prototype</a></p>
</header>

<main class="specs">
{joined}
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
