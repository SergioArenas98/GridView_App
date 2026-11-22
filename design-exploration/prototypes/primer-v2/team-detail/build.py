"""Generates the Team Detail prototype pages (Python 3 stdlib only).

    python build.py

Writes index.html / index.es.html (scenario A, complete team with a mid-season
line-up change), returning.html / returning.es.html (scenario B, a driver who
leaves and returns: one row per span), partial.html / partial.es.html
(scenario C, collection-derived partial team) and states.html /
states.es.html (development-only fixture gallery). Edit this generator, not
the HTML.

Every value comes from an existing Flutter test fixture (README.md, "Fixture
provenance"). Every label comes from lib/l10n/app_en.arb or app_es.arb.
Rendering rules mirror
lib/features/constructors/presentation/constructor_detail_screen.dart,
lib/features/shared/domain/entities/entity_profile.dart (TeamProfile),
lib/features/shared/presentation/entity_formatting.dart and
lib/features/shared/presentation/widgets/entity_detail_scaffold.dart.
"""

from __future__ import annotations

import functools
import html
from pathlib import Path

OUT = Path(__file__).parent

# --------------------------------------------------------------------------
# Strings (verbatim ARB copy; key names in comments)
# --------------------------------------------------------------------------

L = {
    "en": {
        "lang": "en",
        "back": "Back",  # Material back-button tooltip
        "title": "Team",  # constructorTitle
        "season": "{} season",  # seasonLabel (Circuit detail: seasonLabel('${ready.season}'))
        "championship": "Championship",  # teamChampionshipSection
        "view_standings": "View constructors' standings",  # teamViewStandings
        "position": "Position",  # fieldPosition
        "points": "Points",  # fieldPoints
        "wins": "Wins",  # fieldWins
        "provisional": "Provisional",  # resultStatusProvisional
        "unranked": "Unranked",  # positionUnranked
        "lineup": "Drivers",  # teamLineupSection
        "open_driver": "Open driver {}",  # teamOpenDriver
        "race_number": "Race number",  # driverRaceNumber
        "role": "Role",  # fieldRole
        "participation": "Participation",  # fieldParticipation
        "facts": "Team details",  # teamFactsSection
        "power_unit": "Power unit",  # fieldPowerUnit
        "principal": "Team principal",  # fieldTeamPrincipal
        "base": "Base",  # fieldBase
        "chassis": "Chassis",  # fieldChassis
        "nationality": "Nationality",  # fieldNationality
        "team_field": "Team",  # fieldTeam (screen-reader term for the stable constructor name)
        "about": "About",  # teamAbout
        "roles": {"race": "Race driver", "reserve": "Reserve driver", "test": "Test driver",
                  None: "Role unavailable"},  # driverRole*
        "from_start": "From season start",  # participationFromSeasonStart
        "range": "Rounds {}–{}",  # participationRoundRange
        "from_round": "From round {}",  # participationFromRound
        "until_round": "Until round {}",  # participationUntilRound
        "season_unavail_title": "Season unavailable",  # detailSeasonUnavailableTitle
        "season_unavail_msg": "GridView could not determine which season to show. Check your connection and try again.",
        "retry": "Try again",  # retry
        "not_found_title": "Not available",  # detailNotFoundTitle
        "not_found_msg": "This profile is not available. It may have been removed, or the link may be out of date.",
        "load_error_title": "Can't load this profile",  # detailLoadErrorTitle
        "error_generic": "Something went wrong.",  # errorGeneric
        "update_failed": "Update failed",  # detailUpdateFailed
        "partial": "Some profile information is unavailable",  # detailPartialNotice
        "cached": "Details may be outdated",  # detailCachedNotice
        "loading": "Loading",  # a11yLoading
    },
    "es": {
        "lang": "es",
        "back": "Atrás",
        "title": "Equipo",
        "season": "Temporada {}",
        "championship": "Campeonato",
        "view_standings": "Ver clasificación de constructores",
        "position": "Posición",
        "points": "Puntos",
        "wins": "Victorias",
        "provisional": "Provisional",
        "unranked": "Sin clasificar",
        "lineup": "Pilotos",
        "open_driver": "Abrir el piloto {}",
        "race_number": "Dorsal de la temporada",
        "role": "Rol",
        "participation": "Participación",
        "facts": "Datos del equipo",
        "power_unit": "Unidad de potencia",
        "principal": "Director de equipo",
        "base": "Sede",
        "chassis": "Chasis",
        "nationality": "Nacionalidad",
        "team_field": "Equipo",
        "about": "Historia",
        "roles": {"race": "Piloto titular", "reserve": "Piloto reserva", "test": "Piloto de pruebas",
                  None: "Rol no disponible"},
        "from_start": "Desde el inicio de la temporada",
        "range": "Rondas {}–{}",
        "from_round": "Desde la ronda {}",
        "until_round": "Hasta la ronda {}",
        "season_unavail_title": "Temporada no disponible",
        "season_unavail_msg": "GridView no ha podido determinar qué temporada mostrar. Comprueba tu conexión e inténtalo de nuevo.",
        "retry": "Reintentar",
        "not_found_title": "No disponible",
        "not_found_msg": "Este perfil no está disponible. Puede que se haya eliminado o que el enlace esté desactualizado.",
        "load_error_title": "No se puede cargar este perfil",
        "error_generic": "Algo salió mal.",
        "update_failed": "No se pudo actualizar",
        "partial": "Parte de la información del perfil no está disponible",
        "cached": "Los detalles pueden estar desactualizados",
        "loading": "Cargando",
    },
}

# --------------------------------------------------------------------------
# Fixtures (test/support/entity_fixtures.dart, copied verbatim)
# --------------------------------------------------------------------------


def lineup_member(driver_id, name, season=2026, entry_id=None, short=None, number=None, role="race",
                  start=None, end=None):
    """lineupMember(): entry id `{season}-{driverId}`, suffixed with startRound
    when it is set (ADR 0026 D7); role defaults to DriverRole.race."""
    if entry_id is None:
        entry_id = f"{season}-{driver_id}" if start is None else f"{season}-{driver_id}-{start}"
    return {"entry_id": entry_id, "driver_id": driver_id, "name": name, "short": short,
            "number": number, "role": role, "start": start, "end": end}


def default_lineup(season=2026):
    return [
        lineup_member("pierre-gasly", "Pierre Gasly", season, short="GAS", number=10),
        lineup_member("jack-doohan", "Jack Doohan", season, short="DOO", number=7, end=6),
        lineup_member("franco-colapinto", "Franco Colapinto", season, short="COL", number=43, start=7),
    ]


def team_profile(season=2026, constructor_id="alpine", stable="Alpine",
                 season_name="BWT Alpine Formula One Team", nationality="French",
                 biography="The Enstone-based team competing as Alpine since 2021.",
                 power_unit="Renault", principal="Team Principal", base="Enstone, United Kingdom",
                 chassis="A526", standing=None, lineup=None):
    """teamProfileFixture() defaults. Constructor and season entry both carry
    colorPrimary '#0093CC'; season entry shortName = stableName."""
    return {
        "season": season, "id": constructor_id,
        "constructor": {"name": stable, "nationality": nationality, "country_code": None,
                        "color": "#0093CC", "bio": biography},
        "entry": {"full": season_name, "short": stable, "color": "#0093CC", "power_unit": power_unit,
                  "principal": principal, "base": base, "chassis": chassis},
        "standing": standing if standing is not None else
        {"position": 6, "points": 22.0, "wins": 0, "provisional": None},
        "lineup": lineup if lineup is not None else default_lineup(season),
    }


# Scenario A: router_harness defaultFakeConstructors() = teamProfileFixture();
# 'renders season branding, facts and the derived line-up'.
PROFILE_A = team_profile()

# Scenario B: 'a driver who returns to the team keeps one row per span'.
PROFILE_B = team_profile(lineup=[
    lineup_member("jack-doohan", "Jack Doohan", end=6),
    lineup_member("jack-doohan", "Jack Doohan", start=12),
])

# Scenario C: partialTeamProfileFixture() under _neverSynced;
# 'a partial team profile hides empty fact cards'. No standing, no line-up,
# no colour, no nationality, no biography, no season facts.
PROFILE_C = {
    "season": 2026, "id": "alpine",
    "constructor": {"name": "Alpine", "nationality": None, "country_code": None, "color": None, "bio": None},
    "entry": {"full": "BWT Alpine Formula One Team", "short": None, "color": None, "power_unit": None,
              "principal": None, "base": None, "chassis": None},
    "standing": None, "lineup": [],
}

# 'an incomplete line-up never invents a name': lineup empty.
PROFILE_EMPTY_LINEUP = team_profile(lineup=[])
# entity_detail_state_test 'a team whose branding equals its stable name shows
# no fallback': teamProfileFixture(seasonName: null) -> displayName 'Alpine'.
PROFILE_SAME_NAME = team_profile(season_name=None)
# entity_graph_navigation_test (Explore -> team -> driver): two members with
# no number, code or boundary.
PROFILE_PLAIN_LINEUP = team_profile(lineup=[
    lineup_member("pierre-gasly", "Pierre Gasly"),
    lineup_member("jack-doohan", "Jack Doohan"),
])
# 'the standings action carries the exact season' (currentSeason: 2024):
# the harness builds teamProfileFixture(season: 2024). Season-agnostic values.
PROFILE_2024 = team_profile(season=2024)

# seasonTeamCardsFixture() collection cards (Explore): banner and line-up
# frames. A card's line-up is the same participation-derived list a partial
# team profile carries; its position/points are not rendered here.
CARD_RED_BULL = {"season": 2026, "id": "red-bull",
                 "constructor": {"name": "Red Bull", "nationality": None, "country_code": None,
                                 "color": None, "bio": None},
                 "entry": {"full": "Oracle Red Bull Racing", "short": None, "color": "#1E41FF"},
                 "lineup": [lineup_member("max-verstappen", "Max Verstappen", short="VER", number=1)]}
CARD_MCLAREN = {"season": 2026, "id": "mclaren",
                "constructor": {"name": "McLaren", "nationality": None, "country_code": None,
                                "color": None, "bio": None},
                "entry": {"full": "McLaren Formula 1 Team", "short": None, "color": "#FF8000"},
                "lineup": [lineup_member("lando-norris", "Lando Norris", short="NOR", number=4)]}

# --------------------------------------------------------------------------
# TeamProfile getters and EntityFormatter
# --------------------------------------------------------------------------


def esc(s):
    return html.escape(str(s), quote=True)


def display_name(p):  # seasonEntry?.fullName ?? seasonEntry?.shortName ?? constructor.name
    e = p.get("entry") or {}
    return e.get("full") or e.get("short") or p["constructor"]["name"]


def stable_fallback(p):  # constructor.name, only when it differs from displayName
    name = p["constructor"]["name"]
    return None if name == display_name(p) else name


def accent(p):  # seasonEntry?.colorPrimary ?? constructor.colorPrimary
    return (p.get("entry") or {}).get("color") or p["constructor"]["color"]


def has_season_facts(p):
    e = p.get("entry") or {}
    return any(e.get(k) for k in ("power_unit", "principal", "base", "chassis"))


def count(v):
    return None if v is None else str(v)


def points(v, l):  # decimalPattern, trailing zeros dropped
    if v is None:
        return None
    s = f"{v:g}"
    return s.replace(".", ",") if l["lang"] == "es" else s


def position(v, l):
    return l["unranked"] if v is None else str(v)


def span_text(start, end, l):
    """EntityFormatter.participationSpan; ARB copy unchanged, the space before
    a round number rendered non-breaking (as Driver Detail)."""
    nb = " "
    if start is None and end is None:
        return l["from_start"]
    if start is not None and end is not None:
        return l["range"].replace(" {}", nb + "{}", 1).format(start, end)
    tpl = l["from_round"] if start is not None else l["until_round"]
    return tpl.replace(" {}", nb + "{}").format(start if start is not None else end)


def _by_roster_order(a, b):
    """competitor_dao.dart _byRosterOrder, the order the app's read model
    delivers the line-up in (the widget renders it as received):
    1. a member with a race number before one without;
    2. race number ascending;
    3. full name, Dart String.compareTo (UTF-16 code units);
    4. start round ascending, a null start counted as 0.
    Python's sort is stable and Dart's is not; members equal on all four keys
    cannot occur (overlapping spans are rejected before storage)."""
    na, nb = a["number"], b["number"]
    if (na is None) != (nb is None):
        return 1 if na is None else -1
    if na is not None and nb is not None and na != nb:
        return -1 if na < nb else 1
    ka, kb = a["name"].encode("utf-16-be"), b["name"].encode("utf-16-be")
    if ka != kb:
        return -1 if ka < kb else 1
    sa, sb = a["start"] or 0, b["start"] or 0
    return (sa > sb) - (sa < sb)


def roster_order(lineup):
    """A new list; the fixture list itself is not modified."""
    return sorted(lineup, key=functools.cmp_to_key(_by_roster_order))


# Surfaces the team colour sits on (primer-core.css): the banner (--tray) and
# the page (--ground). A supplied colour below 3:1 against its surface gets a
# Chalk edge (WCAG 1.4.11 non-text contrast), measured like GvTeamAccent's
# foregroundOn: by contrast ratio, not a luminance threshold.
TRAY, GROUND = "#1F2125", "#141518"


def _luminance(hex_color):
    h = hex_color.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    la, lb = sorted((_luminance(a), _luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def needs_edge(color, surface):
    return color is not None and contrast(color, surface) < 3.0


# --------------------------------------------------------------------------
# Icons (Lucide, ISC licence; same symbols as the other screens)
# --------------------------------------------------------------------------

SPRITE = """<svg width="0" height="0" class="sprite" aria-hidden="true" focusable="false">
  <symbol id="i-back" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></symbol>
  <symbol id="i-chevron" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
  <symbol id="i-cloud-off" viewBox="0 0 24 24"><path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/></symbol>
  <symbol id="i-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></symbol>
  <symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></symbol>
</svg>"""


def icon(name, cls="icon"):
    return f'<svg class="{cls}" aria-hidden="true"><use href="#i-{name}"/></svg>'


# --------------------------------------------------------------------------
# Components
# --------------------------------------------------------------------------


def appbar(l):
    """EntityDetailScaffold title: always constructorTitle, in every state."""
    return f"""<header class="dbar">
  <a class="icon-btn dbar__back" href="#back" aria-label="{esc(l['back'])}">{icon('back')}</a>
  <p class="dbar__title">{esc(l['title'])}</p>
</header>"""


def notice(text):
    """GvOfflineNotice: cloud-off icon, live region."""
    return f'<div class="page-notice"><p class="notice" role="status">{icon("cloud-off")}<span>{esc(text)}</span></p></div>'


def banner(l, p, media=False):
    """T01-T05. Entrant banner: season line, season-aware name (heading),
    stable name when it differs, nationality ?? country code, team colour as
    the livery rail. The heading leads in the DOM; the season line sits above
    it visually."""
    color = accent(p)
    style = f' style="--team: {esc(color)}"' if color else ""
    stable = stable_fallback(p)
    c = p["constructor"]
    # A term list: screen readers hear "Team: Alpine" and "Nationality:
    # French", so the stable name is never mistaken for a fact. Both terms are
    # visually hidden: no existing visible label names the stable identity
    # without implying that the heading is not the team (README, refinement).
    parts = []
    if stable:
        parts.append(f'<div class="tb__stable"><dt class="sr-only">{esc(l["team_field"])}</dt>'
                     f'<dd>{esc(stable)}</dd></div>')
    if c.get("nationality"):
        parts.append(f'<div class="tb__nat"><dt class="sr-only">{esc(l["nationality"])}</dt>'
                     f'<dd>{esc(c["nationality"])}</dd></div>')
    elif c.get("country_code"):  # Flutter's fallback; no "Nationality" term for a bare code
        parts.append(f'<div class="tb__nat"><dd>{esc(c["country_code"])}</dd></div>')
    # The 12° separator is drawn by CSS (.tb__stable + .tb__nat::before), so
    # the list holds only term groups.
    meta = f'\n  <dl class="tb__meta">{"".join(parts)}</dl>' if parts else ""
    rail = ('\n  <span class="tb__rail" aria-hidden="true"><span class="tb__pin"></span><span class="tb__bar"></span></span>'
            if color else "")
    media_html = '\n  <div class="tb__media tb__media--dev" aria-hidden="true"></div>' if media else ""
    mods = (" tb--color" if color else "") + (" tb--edge" if needs_edge(color, TRAY) else "")
    return f"""<section class="tb{mods}"{style} aria-labelledby="tb-name">{media_html}
  <h1 class="tb__name" id="tb-name">{esc(display_name(p))}</h1>
  <p class="tb__season">{esc(l['season'].format(p['season']))}</p>{meta}{rail}
</section>"""


def championship_section(l, p, uid):
    """T06-T09 + T22. Absent without a standing; a null position is the word
    "Unranked"; null points render empty (fmt.points ?? ''); wins only when
    non-null, a confirmed zero kept; provisional chip only when true."""
    st = p["standing"]
    if st is None:
        return ""
    pos_word = st["position"] is None
    pos_cls = "tc__cell tc__pos tc__pos--word" if pos_word else "tc__cell tc__pos"
    pos_dd = "<dd>" if pos_word else '<dd class="num">'
    cells = [
        f'<div class="{pos_cls}"><dt>{esc(l["position"])}</dt>{pos_dd}{esc(position(st["position"], l))}</dd></div>',
        f'<div class="tc__cell tc__pts"><dt>{esc(l["points"])}</dt><dd class="num">{esc(points(st["points"], l) or "")}</dd></div>',
    ]
    if count(st["wins"]) is not None:
        cells.append(f'<div class="tc__cell tc__wins"><dt>{esc(l["wins"])}</dt><dd class="num">{esc(count(st["wins"]))}</dd></div>')
    prov = (f'\n  <p class="tc__prov"><span class="chip chip--outline">{esc(l["provisional"])}</span></p>'
            if st["provisional"] else "")
    return f"""<section class="sec" aria-labelledby="{uid}-champ">
  <h2 class="section-title sec__title" id="{uid}-champ">{esc(l['championship'])}</h2>
  <div class="tcw">
  <dl class="tc">
    {''.join(cells)}
  </dl>{prov}
  <a class="dest" href="#standings/constructors/{esc(p['season'])}"><span>{esc(l['view_standings'])}</span>{icon('arrow')}</a>
  </div>
</section>"""


def lineup_row(l, m):
    """T10-T14. One row per participation span, keyed by entryId. The span is
    shown only when a boundary was observed (hasObservedBoundary): an open or
    unbounded span is never described as a full season."""
    car = ""
    if m["number"] is not None or m["short"]:
        num = (f'<p class="lu__num num"><span class="sr-only">{esc(l["race_number"])} </span>{esc(m["number"])}</p>'
               if m["number"] is not None else "")
        code = f'<p class="lu__code">{esc(m["short"])}</p>' if m["short"] else ""
        car = f'\n      <div class="lu__car">{num}{code}</div>'
    facts = ""
    if m["start"] is not None or m["end"] is not None:
        facts += (f'<div><dt class="sr-only">{esc(l["participation"])}</dt>'
                  f'<dd class="lu__span">{esc(span_text(m["start"], m["end"], l))}</dd></div>')
    facts += (f'<div><dt class="sr-only">{esc(l["role"])}</dt>'
              f'<dd>{esc(l["roles"].get(m["role"], l["roles"][None]))}</dd></div>')
    return f"""<li class="lu__row" data-entry="{esc(m['entry_id'])}">
      <a class="lu__hit" href="#drivers/{esc(m['driver_id'])}" aria-label="{esc(l['open_driver'].format(m['name']))}"></a>{car}
      <span class="lu__seam" aria-hidden="true"></span>
      <div class="lu__body"><p class="lu__name" aria-hidden="true">{esc(m['name'])}</p><dl class="lu__facts">{facts}</dl></div>
      {icon('chevron', 'icon lu__go')}
    </li>"""


def lineup_section(l, p, uid):
    """Absent when the line-up is empty. Rows in the app's roster order
    (_byRosterOrder, applied by the read model); every span is its own row."""
    if not p["lineup"]:
        return ""
    lineup = roster_order(p["lineup"])
    plain = not any(m["number"] is not None or m["short"] for m in lineup)
    color = accent(p)
    style = f' style="--team: {esc(color)}"' if color else ""
    mods = (" lu--plain" if plain else "") + (" lu--edge" if needs_edge(color, GROUND) else "")
    rows = "\n    ".join(lineup_row(l, m) for m in lineup)
    return f"""<section class="sec" aria-labelledby="{uid}-lineup">
  <h2 class="section-title sec__title" id="{uid}-lineup">{esc(l['lineup'])}</h2>
  <ul class="lu{mods}"{style}>
    {rows}
  </ul>
</section>"""


def facts_section(l, p, uid):
    """T15-T18: only present facts; the section only when at least one is."""
    if not has_season_facts(p):
        return ""
    e = p["entry"]
    rows = []
    for key, label in (("power_unit", l["power_unit"]), ("principal", l["principal"]),
                       ("base", l["base"]), ("chassis", l["chassis"])):
        if e.get(key):
            rows.append(f'<div class="sheet__row"><dt>{esc(label)}</dt><dd>{esc(e[key])}</dd></div>')
    return f"""<section class="sec" aria-labelledby="{uid}-facts">
  <h2 class="section-title sec__title" id="{uid}-facts">{esc(l['facts'])}</h2>
  <dl class="sheet">
    {chr(10).join('    ' + r for r in rows).strip()}
  </dl>
</section>"""


def about_section(l, p, uid):
    """T19-T20. Nationality is shown once, in the banner (difference 2, as
    Driver Detail), so the "Team information" card has no field left and is
    not rendered. About only with a non-blank biography."""
    bio = (p["constructor"].get("bio") or "").strip()
    if not bio:
        return ""
    return f"""<section class="sec" aria-labelledby="{uid}-about">
  <h2 class="section-title sec__title" id="{uid}-about">{esc(l['about'])}</h2>
  <p class="about">{esc(bio)}</p>
</section>"""


def body(l, p, uid, top_notice=None, media=False):
    note = notice(top_notice) if top_notice else ""
    return "\n".join(x for x in (
        note, banner(l, p, media), championship_section(l, p, uid), lineup_section(l, p, uid),
        facts_section(l, p, uid), about_section(l, p, uid)) if x)


def empty_block(title, msg, icon_name, button=None):
    btn = f'\n    <button class="btn" type="button">{esc(button)}</button>' if button else ""
    return f"""<div class="empty">
    {icon(icon_name)}
    <p class="empty__title">{esc(title)}</p>
    <p class="empty__msg">{esc(msg)}</p>{btn}
  </div>"""


def skeleton(l):
    return (f'<div class="skel" role="progressbar" aria-label="{esc(l["loading"])}">'
            '<span class="skel__banner"></span><span class="skel__label"></span>'
            '<span class="skel__row"></span><span class="skel__row"></span><span class="skel__row"></span></div>')


# --------------------------------------------------------------------------
# Pages
# --------------------------------------------------------------------------

HEAD = """<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="primer-core.css">
<link rel="stylesheet" href="td.css">{extra_css}
</head>
<body class="{body_cls}">
<!-- Generated by build.py - edit the generator, not this file. -->
"""


def page(lang, title, desc, content, body_cls="detail", extra_css=""):
    return HEAD.format(lang=lang, title=esc(title), desc=esc(desc), extra_css=extra_css,
                       body_cls=body_cls) + SPRITE + "\n\n" + content + "\n</body>\n</html>\n"


def main_page(lang, p, scenario, top_notice=None):
    l = L[lang]
    content = appbar(l) + '\n<main class="page">\n' + body(l, p, "m", top_notice) + "\n</main>"
    desc = (f"GridView Team Detail, Primer V2 visual prototype ({'English' if lang == 'en' else 'Spanish'}), "
            f"scenario {scenario}. Data copied from Flutter test fixtures; not real data.")
    return page(lang, f"GridView {display_name(p)}", desc, content)


# --------------------------------------------------------------------------
# States gallery (development only)
# --------------------------------------------------------------------------

STATE_TEXT = {
    "en": {
        "flag": "Development fixtures. Not app UI, not team data",
        "title": "Team states",
        "note": "Each frame is copied from one Flutter test fixture and never merged with another. "
                "Captions are prototype annotations; everything inside a frame is app copy from the ARB files.",
        "links": [("index.html", "A: complete"), ("returning.html", "B: returning driver"),
                  ("partial.html", "C: partial")],
    },
    "es": {
        "flag": "Fixtures de desarrollo. No es interfaz de la app ni datos de equipos",
        "title": "Estados del equipo",
        "note": "Cada marco copia un único fixture de test de Flutter, sin mezclarlo con otros. "
                "Los rótulos son anotaciones del prototipo; el contenido de cada marco es texto de los ARB.",
        "links": [("index.es.html", "A: completo"), ("returning.es.html", "B: piloto que vuelve"),
                  ("partial.es.html", "C: parcial")],
    },
}

W = "test/screens/entity_detail_widget_test.dart"
F = "test/support/entity_fixtures.dart"


def spec(n, title, src, inner):
    return f"""<section class="spec" aria-labelledby="spec-{n}">
  <div class="spec__cap"><h2 class="spec__title" id="spec-{n}">{n}. {esc(title)}</h2><p class="spec__src">{esc(src)}</p></div>
  <div class="spec__frame">
{inner}
  </div>
</section>"""


def states_page(lang):
    l = L[lang]
    t = STATE_TEXT[lang]
    specs = []
    n = 0

    def add(title, src, inner):
        nonlocal n
        n += 1
        specs.append(spec(n, title, src, inner))

    def uid():
        return f"s{n + 1}"

    add("Initial loading: skeleton, generic app-bar title",
        "entity_detail_scaffold.dart: EntityDetailLoading → _DetailSkeleton",
        appbar(l) + "\n" + skeleton(l))
    add("Season unavailable: nothing requested, retry offered",
        f"{W}: 'with no resolvable season nothing is requested' (shared EntityDetailSeasonUnavailable)",
        appbar(l) + "\n" + empty_block(l["season_unavail_title"], l["season_unavail_msg"], "alert", l["retry"]))
    add("Confirmed not found, no local entity",
        "entity_detail_scaffold.dart EntityDetailNotFound (shared; tested on Driver detail)",
        appbar(l) + "\n" + empty_block(l["not_found_title"], l["not_found_msg"], "help"))
    add("First-load failure, no local entity: retry",
        "entity_detail_scaffold.dart EntityDetailFirstLoadError (shared; tested on Driver detail)",
        appbar(l) + "\n" + empty_block(l["load_error_title"], l["error_generic"], "alert", l["retry"]))
    add("Refresh failed with cached content: content kept",
        "Shared notice rule (driver test 'a non-blocking failure keeps cached content visible'); "
        "teamProfileFixture() banner",
        notice(l["update_failed"]) + "\n" + banner(l, PROFILE_A))
    add("Stale materialized detail: content kept, cached notice",
        "Shared notice rule (entity_detail_state_test, driver fixture); teamProfileFixture() banner",
        notice(l["cached"]) + "\n" + banner(l, PROFILE_A))
    add("Empty line-up: no Drivers section, no invented name",
        f"{W}: 'an incomplete line-up never invents a name' (teamProfileFixture(lineup: []))",
        body(l, PROFILE_EMPTY_LINEUP, uid()))
    add("Line-up entries with both boundaries null: each still has its row (role only, no span, never a "
        "full-season claim); unnumbered rows ordered by name",
        "test/navigation/entity_graph_navigation_test.dart (Explore → team → driver): two lineupMember() "
        "with name only (line-up only; fixture order Gasly, Doohan; roster order Doohan, Gasly)",
        lineup_section(l, PROFILE_PLAIN_LINEUP, uid()))
    add("Season branding equals the stable name: no fallback line",
        "test/application/entity_detail_state_test.dart: 'a team whose branding equals its stable name "
        "shows no fallback' (teamProfileFixture(seasonName: null); banner only)",
        banner(l, PROFILE_SAME_NAME))
    add("Rebranded entrant with a dark team colour (2.5:1 on the banner): Chalk edge on the rail and seam",
        f"{F}: seasonTeamCardsFixture() Red Bull card, 'Oracle Red Bull Racing' / stable 'Red Bull', "
        "#1E41FF, line-up Max Verstappen VER #1 (collection card; banner and line-up)",
        banner(l, CARD_RED_BULL) + "\n" + lineup_section(l, CARD_RED_BULL, uid()))
    add("Light team colour (6.4:1): no edge needed; the rail never carries text",
        f"{F}: seasonTeamCardsFixture() McLaren card, 'McLaren Formula 1 Team' / 'McLaren', #FF8000, "
        "line-up Lando Norris NOR #4 (collection card; banner and line-up)",
        banner(l, CARD_MCLAREN) + "\n" + lineup_section(l, CARD_MCLAREN, uid()))
    add("Opened for another season: the season line and the standings action follow it",
        f"{W}: 'the standings action carries the exact season' (currentSeason: 2024 → "
        "teamProfileFixture(season: 2024)). The fixture's values are season-agnostic, not 2024 data",
        banner(l, PROFILE_2024) + "\n" + championship_section(l, PROFILE_2024, uid()))
    add("Provisional standing chip (no team fixture sets provisional: chip only)",
        "constructor_detail_screen.dart: GvStatusChip(resultStatusProvisional) when standing.provisional",
        f'<div class="chip-row chips"><span class="chip chip--outline">{esc(l["provisional"])}</span></div>')
    add("Media layer geometry only (dashed outline, development only). No cleared media: absent, loading and "
        "failed all render the banner as Scenario A",
        "constructor_detail_screen.dart _TeamHero: GvRemoteImage(constructorMark), stable imagery, decorative; "
        "content/media/media-rights.json is empty",
        banner(l, PROFILE_A, media=True))

    links = "".join(f'<a href="{h}">{esc(x)}</a>' for h, x in t["links"])
    content = f"""<header class="dev-head">
  <p class="dev-head__flag">{esc(t['flag'])}</p>
  <h1 class="dev-head__title">{esc(t['title'])}</h1>
  <p class="dev-head__note">{esc(t['note'])}</p>
  <nav class="dev-head__links" aria-label="Prototype pages">{links}</nav>
</header>

<main class="specs">
{chr(10).join(specs)}
</main>"""
    desc = "Development-only state fixtures for the GridView Team Detail prototype."
    return page(lang, f"GridView {t['title']}", desc, content, body_cls="detail states",
                extra_css='\n<link rel="stylesheet" href="states.css">')


def build():
    for lang, suffix in (("en", ""), ("es", ".es")):
        l = L[lang]
        (OUT / f"index{suffix}.html").write_text(main_page(lang, PROFILE_A, "A (complete)"),
                                                  encoding="utf-8", newline="\n")
        (OUT / f"returning{suffix}.html").write_text(main_page(lang, PROFILE_B, "B (returning driver)"),
                                                      encoding="utf-8", newline="\n")
        (OUT / f"partial{suffix}.html").write_text(
            main_page(lang, PROFILE_C, "C (partial)", top_notice=l["partial"]), encoding="utf-8", newline="\n")
        (OUT / f"states{suffix}.html").write_text(states_page(lang), encoding="utf-8", newline="\n")
    print("wrote", ", ".join(sorted(p.name for p in OUT.glob("*.html"))))


if __name__ == "__main__":
    build()
