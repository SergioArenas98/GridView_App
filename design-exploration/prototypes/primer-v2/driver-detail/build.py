"""Generates the Driver Detail prototype pages (Python 3 stdlib only).

    python build.py

Writes index.html / index.es.html (scenario A, complete profile),
partial.html / partial.es.html (scenario B, collection-derived partial
profile) and states.html / states.es.html (development-only fixture gallery).
Edit this generator, not the HTML.

Every value comes from an existing Flutter test fixture (README.md, "Fixture
provenance"). Every label comes from lib/l10n/app_en.arb or app_es.arb.
Rendering rules mirror lib/features/drivers/presentation/driver_detail_screen.dart,
lib/features/shared/presentation/entity_formatting.dart and
lib/features/shared/presentation/widgets/entity_detail_scaffold.dart.
Dates: intl 0.20.2 yMMMd (en "MMM d, y", es "d MMM y").
"""

from __future__ import annotations

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
        "title": "Driver",  # driverTitle
        "season": "{} season",  # seasonLabel (as Circuit detail: seasonLabel('${ready.season}'))
        "open_team": "Open team {}",  # driverOpenTeam
        "team": "Team",  # fieldTeam
        "championship": "Championship",  # driverChampionshipSection
        "view_standings": "View drivers' standings",  # driverViewStandings
        "position": "Position",  # fieldPosition
        "points": "Points",  # fieldPoints
        "wins": "Wins",  # fieldWins
        "podiums": "Podiums",  # fieldPodiums
        "provisional": "Provisional",  # resultStatusProvisional
        "participation_sec": "Season participation",  # driverParticipationSection
        "team_unavailable": "Team unavailable",  # driverTeamUnavailable
        "role": "Role",  # fieldRole
        "race_number": "Race number",  # driverRaceNumber
        "participation": "Participation",  # fieldParticipation
        "profile": "Profile",  # driverProfileSection
        "nationality": "Nationality",  # fieldNationality
        "dob": "Date of birth",  # fieldDateOfBirth
        "pob": "Place of birth",  # fieldPlaceOfBirth
        "permanent": "Permanent number",  # driverPermanentNumber
        "about": "About",  # driverAbout
        "unranked": "Unranked",  # positionUnranked
        "roles": {"race": "Race driver", "reserve": "Reserve driver", "test": "Test driver",
                  None: "Role unavailable"},  # driverRole*
        "from_start": "From season start",  # participationFromSeasonStart
        "range": "Rounds {}–{}",  # participationRoundRange
        "from_round": "From round {}",  # participationFromRound
        "until_round": "Until round {}",  # participationUntilRound
        "season_unavail_title": "Season unavailable",
        "season_unavail_msg": "GridView could not determine which season to show. Check your connection and try again.",
        "retry": "Try again",
        "not_found_title": "Not available",
        "not_found_msg": "This profile is not available. It may have been removed, or the link may be out of date.",
        "load_error_title": "Can't load this profile",
        "error_generic": "Something went wrong.",
        "update_failed": "Update failed",  # detailUpdateFailed
        "partial": "Some profile information is unavailable",  # detailPartialNotice
        "cached": "Details may be outdated",  # detailCachedNotice
        "loading": "Loading",  # a11yLoading
        "mon": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    },
    "es": {
        "lang": "es",
        "back": "Atrás",  # Material back-button tooltip (es)
        "title": "Piloto",
        "season": "Temporada {}",
        "open_team": "Abrir el equipo {}",
        "team": "Equipo",
        "championship": "Campeonato",
        "view_standings": "Ver clasificación de pilotos",
        "position": "Posición",
        "points": "Puntos",
        "wins": "Victorias",
        "podiums": "Podios",
        "provisional": "Provisional",
        "participation_sec": "Participación en la temporada",
        "team_unavailable": "Equipo no disponible",
        "role": "Rol",
        "race_number": "Dorsal de la temporada",
        "participation": "Participación",
        "profile": "Perfil",
        "nationality": "Nacionalidad",
        "dob": "Fecha de nacimiento",
        "pob": "Lugar de nacimiento",
        "permanent": "Dorsal permanente",
        "about": "Biografía",
        "unranked": "Sin clasificar",
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
        "mon": ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"],
    },
}

# --------------------------------------------------------------------------
# Fixtures (test/support/entity_fixtures.dart, copied verbatim)
# --------------------------------------------------------------------------

MAX_BIO = "A four-time Formula 1 World Champion known for exceptional racecraft."


def participation(constructor_id, team=None, color=None, race_number=None, role="race",
                  start=None, end=None):
    """entity_fixtures.dart participation(): role defaults to DriverRole.race."""
    return {"constructor_id": constructor_id, "team": team, "color": color,
            "race_number": race_number, "role": role, "start": start, "end": end}


def driver_profile(**over):
    """entity_fixtures.dart driverProfileFixture() defaults."""
    p = {
        "season": 2026,  # driverProfileFixture({int season = 2026}) = EntityDetailReady.season
        "name": "Max Verstappen", "short": "VER", "permanent": 33, "nationality": "Dutch",
        "dob": "1997-09-30", "pob": "Hasselt, Belgium", "bio": MAX_BIO,
        "given": None, "family": None,
        "participations": [participation("red-bull", "Oracle Red Bull Racing", "#1E41FF", race_number=1)],
        "standing": {"position": 2, "points": 402.5, "wins": 7, "podiums": 14, "provisional": None},
    }
    p.update(over)
    return p


# Scenario A: the harness default (router_harness.dart defaultFakeDrivers),
# 'renders a complete profile with no placeholder data'.
PROFILE_A = driver_profile()

# Scenario B: partialDriverProfileFixture() under _neverSynced,
# 'a partial profile renders without claiming detail freshness'.
PROFILE_B = driver_profile(permanent=None, nationality=None, dob=None, pob=None, bio=None, standing=None)

# 'a span with no observed boundary never reads as a full season'
PROFILE_NO_BOUNDARY = driver_profile(
    participations=[participation("red-bull", "Oracle Red Bull Racing")], standing=None)

# 'mid-season spans are both shown, never flattened' (spans only; see README)
SPANS_MIDSEASON = [
    participation("alpine", "BWT Alpine Formula One Team", start=7),
    participation("williams", "Williams Racing", end=6),
]
# 'no team association shows no team section or fabricated name' (spans only)
SPANS_UNRESOLVED = [participation("not-synced-team")]
# 'a reserve role reads as a localized role, never blank' (spans only)
SPANS_RESERVE = [participation("alpine", "BWT Alpine Formula One Team", role="reserve")]
# 'an unranked entrant with zero statistics shows no false zero' (standing only)
STANDING_ZERO = {"position": None, "points": 0.0, "wins": 0, "podiums": None, "provisional": None}

# Plate-only frames from seasonDriverCardsFixture() (Explore collection cards).
# driverCard({int season = 2026}); `number` is SeasonDriverCard.raceNumber (the season number).
CARD_UNAFFILIATED = {"season": 2026, "name": "Unaffiliated Entrant", "short": None, "number": 55, "nationality": None}
CARD_RESERVE = {"season": 2026, "name": "Reserve Entrant", "short": None, "number": None, "nationality": None}

# --------------------------------------------------------------------------
# Formatting (EntityFormatter)
# --------------------------------------------------------------------------


def esc(s):
    return html.escape(str(s), quote=True)


def count(v):  # NumberFormat.decimalPattern; fixture values are all < 1000
    return None if v is None else str(v)


def points(v, l):  # ResultFormatter.points: decimalPattern, trailing zeros dropped
    if v is None:
        return None
    s = f"{v:g}"
    return s.replace(".", ",") if l["lang"] == "es" else s


def position(v, l):
    return l["unranked"] if v is None else str(v)


def span_text(start, end, l):  # EntityFormatter.participationSpan (ADR 0026 D6)
    """ARB copy unchanged; the space before a round number is rendered as a
    no-break space so the number never wraps away from its word."""
    nb = " "
    if start is None and end is None:
        return l["from_start"]
    if start is not None and end is not None:
        return l["range"].replace(" {}", nb + "{}").format(start, end)
    tpl = l["from_round"] if start is not None else l["until_round"]
    return tpl.replace(" {}", nb + "{}").format(start if start is not None else end)


def calendar_date(v, l):  # yMMMd, no time-zone conversion
    if not v:
        return None
    y, m, d = (int(x) for x in v.split("-"))
    mon = l["mon"][m - 1]
    return f"{mon} {d}, {y}" if l["lang"] == "en" else f"{d} {mon} {y}"


def has_profile_facts(p):  # DriverProfile.hasProfileFacts (permanent number excluded)
    return any([p["dob"], p["pob"], p["nationality"], (p["bio"] or "").strip(), p["given"], p["family"]])


# --------------------------------------------------------------------------
# Icons (Lucide, ISC licence; same symbols as Grand Prix Detail)
# --------------------------------------------------------------------------

SPRITE = """<svg width="0" height="0" class="sprite" aria-hidden="true" focusable="false">
  <symbol id="i-back" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></symbol>
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
    """EntityDetailScaffold title: always driverTitle, in every state."""
    return f"""<header class="dbar">
  <a class="icon-btn dbar__back" href="#back" aria-label="{esc(l['back'])}">{icon('back')}</a>
  <p class="dbar__title">{esc(l['title'])}</p>
</header>"""


def notice(text):
    """GvOfflineNotice: cloud-off icon, live region."""
    return f'<div class="page-notice"><p class="notice" role="status">{icon("cloud-off")}<span>{esc(text)}</span></p></div>'


def relevant(p):
    return p["participations"][0] if p["participations"] else None


def plate(l, name, number, number_kind, short, nationality, season, media=False):
    """D01-D06. number = relevant.raceNumber ?? permanentNumber (hero rule);
    number_kind says which of the two it is ("race" / "permanent"), so the
    board names its source with the existing field label (DD-03). season is
    EntityDetailReady.season, printed with seasonLabel (DD-01); the plate only
    exists in the ready state, so a season is always resolved here."""
    num = count(number)
    lab = None if num is None else (l["race_number"] if number_kind == "race" else l["permanent"])
    if num is None and not short:
        board = ""
        cls = "dp dp--bare"
    else:
        sr = " · ".join(x for x in (f"{lab} {num}" if num else None, short) if x)
        fig = (f'<span class="dp__lab">{esc(lab)}</span>'
               f'<span class="dp__num"><span class="dp__hash">#</span><span class="dp__fig num">{esc(num)}</span></span>'
               if num else "")
        code = f'<span class="dp__code">{esc(short)}</span>' if short else ""
        mod = " dp__plate--code" if not num else ""
        board = (f'\n    <p class="dp__plate{mod}"><span class="sr-only">{esc(sr)}</span>'
                 f'<span aria-hidden="true" class="dp__plate-in">{fig}{code}</span></p>')
        # A board wider than one digit (or a code-only board) stacks earlier.
        cls = "dp dp--wide" if (num is None or len(num) > 1) else "dp"
    # Shown once (difference 2); the Profile card's "Nationality" label stays
    # for screen readers.
    nat = (f'\n    <p class="dp__nat"><span class="sr-only">{esc(l["nationality"])}: </span>{esc(nationality)}</p>'
           if nationality else "")
    media_html = '\n  <div class="dp__media dp__media--dev" aria-hidden="true"></div>' if media else ""
    # Visually above the name (as Grand Prix Detail's season line); in the DOM
    # after the heading, so the heading still leads (difference 7) and the
    # season is announced just before the season number.
    season_html = f'\n    <p class="dp__season">{esc(l["season"].format(season))}</p>'
    # Nationality and board share one wrapper: display: contents on the wide
    # plate (unchanged grid), a wrapping row on the stacked plate, so a
    # labelled board never squeezes the nationality into a mid-word break.
    foot = f'\n    <div class="dp__foot">{nat}{board}\n    </div>' if (nat or board) else ""
    return f"""<section class="{cls}" aria-labelledby="dp-name">{media_html}
  <div class="dp__grid">
    <h1 class="dp__name" id="dp-name">{esc(name)}</h1>{season_html}{foot}
  </div>
</section>"""


def profile_plate(l, p, media=False):
    rel = relevant(p)
    number, kind = (rel["race_number"] if rel else None), "race"
    if number is None:
        number, kind = p["permanent"], "permanent"
    return plate(l, p["name"], number, kind, p["short"], p["nationality"], p["season"], media)


def stint(l, s, is_link):
    team = s["team"]
    facts = (f'<div><dt class="sr-only">{esc(l["participation"])}</dt><dd class="st__span">{esc(span_text(s["start"], s["end"], l))}</dd></div>'
             f'<div><dt class="sr-only">{esc(l["role"])}</dt><dd>{esc(l["roles"].get(s["role"], l["roles"][None]))}</dd></div>')
    if count(s["race_number"]) is not None:
        facts += f'<div><dt>{esc(l["race_number"])}</dt><dd class="st__v">{esc(count(s["race_number"]))}</dd></div>'
    if is_link:
        tick_style = f' style="--team: {esc(s["color"])}"' if s["color"] else ""
        return f"""<li class="st st--link">
      <a class="st__hit" href="#constructors/{esc(s['constructor_id'])}" aria-label="{esc(l['open_team'].format(team))}"></a>
      <span class="st__tick"{tick_style} aria-hidden="true"></span>
      <div class="st__body"><p class="st__team" aria-hidden="true">{esc(team)}</p><dl class="st__facts">{facts}</dl></div>
      <span class="disc" aria-hidden="true">{icon('arrow')}</span>
    </li>"""
    team_html = (f'<p class="st__team">{esc(team)}</p>' if team
                 else f'<p class="st__team st__team--fallback">{esc(l["team_unavailable"])}</p>')
    return f"""<li class="st">
      <span class="st__tick" aria-hidden="true"></span>
      <div class="st__body">{team_html}<dl class="st__facts">{facts}</dl></div>
    </li>"""


def participation_section(l, spans, uid):
    """D07-D09 + D15-D18. Spans arrive in relevance order; the first is the
    relevant one and is the team link only when its name resolves."""
    if not spans:
        return ""
    rows = "\n    ".join(stint(l, s, i == 0 and s["team"] is not None) for i, s in enumerate(spans))
    return f"""<section class="sec" aria-labelledby="{uid}-part">
  <h2 class="section-title sec__title" id="{uid}-part">{esc(l['participation_sec'])}</h2>
  <ul class="stints">
    {rows}
  </ul>
</section>"""


def championship_section(l, st, season, uid):
    """D10-D14 + D24. Absent without a standing; unranked is a word, never 0;
    a null statistic is omitted, a confirmed zero stays."""
    if st is None:
        return ""
    pos_cls = "ch__cell ch__pos ch__pos--word" if st["position"] is None else "ch__cell ch__pos"
    pos_num = "" if st["position"] is None else " num"
    more = []
    for key, label in (("wins", l["wins"]), ("podiums", l["podiums"])):
        v = count(st[key])
        if v is not None:
            more.append(f'<div><dt>{esc(label)}</dt><dd class="num">{esc(v)}</dd></div>')
    more_html = f'\n  <dl class="ch__more">{"".join(more)}</dl>' if more else ""
    prov = (f'\n  <p class="ch__prov"><span class="chip chip--outline">{esc(l["provisional"])}</span></p>'
            if st["provisional"] else "")
    return f"""<section class="sec" aria-labelledby="{uid}-champ">
  <h2 class="section-title sec__title" id="{uid}-champ">{esc(l['championship'])}</h2>
  <div class="ch">
  <dl class="ch__main">
    <div class="{pos_cls}"><dt>{esc(l['position'])}</dt><dd class="{pos_num.strip()}">{esc(position(st['position'], l))}</dd></div>
    <span class="ch__seam" aria-hidden="true"></span>
    <div class="ch__cell ch__pts"><dt>{esc(l['points'])}</dt><dd class="num">{esc(points(st['points'], l) or '')}</dd></div>
  </dl>{more_html}{prov}
  <a class="ch__link" href="#standings/drivers/{esc(season)}"><span>{esc(l['view_standings'])}</span>{icon('arrow')}</a>
  </div>
</section>"""


def profile_sections(l, p, uid):
    """D19-D22. Gated by hasProfileFacts; nationality is shown once, in the
    plate (difference 2). The permanent number alone never opens the card."""
    if not has_profile_facts(p):
        return ""
    fields = []
    for label, value in ((l["dob"], calendar_date(p["dob"], l)), (l["pob"], p["pob"]),
                         (l["permanent"], count(p["permanent"]))):
        if value is not None:
            fields.append(f'<div class="fact"><dt>{esc(label)}</dt><dd>{esc(value)}</dd></div>')
    out = ""
    if fields:
        out += f"""<section class="sec" aria-labelledby="{uid}-prof">
  <h2 class="section-title sec__title" id="{uid}-prof">{esc(l['profile'])}</h2>
  <dl class="facts">
    {chr(10).join('    ' + f for f in fields).strip()}
  </dl>
</section>
"""
    bio = (p["bio"] or "").strip()
    if bio:
        out += f"""<section class="sec" aria-labelledby="{uid}-about">
  <h2 class="section-title sec__title" id="{uid}-about">{esc(l['about'])}</h2>
  <p class="about">{esc(bio)}</p>
</section>"""
    return out


def body(l, p, uid, top_notice=None, media=False):
    note = notice(top_notice) if top_notice else ""
    return "\n".join(x for x in (
        note, profile_plate(l, p, media), participation_section(l, p["participations"], uid),
        championship_section(l, p["standing"], p["season"], uid), profile_sections(l, p, uid)) if x)


def empty_block(title, msg, icon_name, button=None):
    btn = f'\n    <button class="btn" type="button">{esc(button)}</button>' if button else ""
    return f"""<div class="empty">
    {icon(icon_name)}
    <p class="empty__title">{esc(title)}</p>
    <p class="empty__msg">{esc(msg)}</p>{btn}
  </div>"""


def skeleton(l):
    return (f'<div class="skel" role="progressbar" aria-label="{esc(l["loading"])}">'
            '<span class="skel__plate"></span><span class="skel__label"></span>'
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
<link rel="stylesheet" href="dd.css">{extra_css}
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
    desc = (f"GridView Driver Detail, Primer V2 visual prototype ({'English' if lang == 'en' else 'Spanish'}), "
            f"scenario {scenario}. Data copied from Flutter test fixtures; not real data.")
    return page(lang, f"GridView {p['name']}", desc, content)


# --------------------------------------------------------------------------
# States gallery (development only)
# --------------------------------------------------------------------------

STATE_TEXT = {
    "en": {
        "flag": "Development fixtures. Not app UI, not driver data",
        "title": "Driver states",
        "note": "Each frame is copied from one Flutter test fixture and never merged with another. "
                "Captions are prototype annotations; everything inside a frame is app copy from the ARB files.",
        "links": [("index.html", "Scenario A: complete"), ("partial.html", "Scenario B: partial")],
    },
    "es": {
        "flag": "Fixtures de desarrollo. No es interfaz de la app ni datos de pilotos",
        "title": "Estados del piloto",
        "note": "Cada marco copia un único fixture de test de Flutter, sin mezclarlo con otros. "
                "Los rótulos son anotaciones del prototipo; el contenido de cada marco es texto de los ARB.",
        "links": [("index.es.html", "Escenario A: completo"), ("partial.es.html", "Escenario B: parcial")],
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
        "entity_detail_scaffold.dart: EntityDetailLoading → _DetailSkeleton (4 blocks)",
        appbar(l) + "\n" + skeleton(l))
    add("Season unavailable: nothing requested, retry offered",
        f"{W}: 'with no resolvable season nothing is requested' (EntityDetailSeasonUnavailable)",
        appbar(l) + "\n" + empty_block(l["season_unavail_title"], l["season_unavail_msg"], "alert", l["retry"]))
    add("Confirmed not found, no local entity",
        f"{W}: 'a definitive not-found renders a controlled state'",
        appbar(l) + "\n" + empty_block(l["not_found_title"], l["not_found_msg"], "help"))
    add("First-load failure, no local entity: retry",
        f"{W}: 'a transient failure with no content offers a retry'",
        appbar(l) + "\n" + empty_block(l["load_error_title"], l["error_generic"], "alert", l["retry"]))
    add("Detail endpoint 404 with a real summary: content kept, partial notice",
        f"{W}: 'a 404 with a real summary keeps the content visible' (partialDriverProfileFixture)",
        notice(l["partial"]) + "\n" + profile_plate(l, PROFILE_B) + "\n"
        + participation_section(l, PROFILE_B["participations"], uid()))
    add("Refresh failed with cached content: content kept",
        f"{W}: 'a non-blocking failure keeps cached content visible'; golden entity_detail_cached_failure",
        notice(l["update_failed"]) + "\n" + profile_plate(l, PROFILE_A))
    add("Stale materialized detail: content kept, cached notice",
        "test/application/entity_detail_state_test.dart: 'a stale materialized detail stays visible and reports stale' "
        "(driverProfileFixture())",
        notice(l["cached"]) + "\n" + profile_plate(l, PROFILE_A))
    add("No season race number: the board falls back to the permanent number and says so; no observed "
        "span boundary; no standing",
        f"{W}: 'a span with no observed boundary never reads as a full season'",
        body(l, PROFILE_NO_BOUNDARY, uid()))
    add("Mid-season move: both spans, relevance order, only the relevant span links",
        f"{W}: 'mid-season spans are both shown, never flattened' (spans only: the test inherits "
        "Verstappen's identity defaults under another name, so its plate is not rendered)",
        participation_section(l, SPANS_MIDSEASON, uid()))
    add("Unresolved constructor: localized fallback, no link, no identifier",
        f"{W}: 'no team association shows no team section or fabricated name' (spans only)",
        participation_section(l, SPANS_UNRESOLVED, uid()))
    add("Reserve role reads as a localized role",
        f"{W}: 'a reserve role reads as a localized role, never blank' (spans only)",
        participation_section(l, SPANS_RESERVE, uid()))
    add("Unranked with confirmed zeros; podiums never supplied, so omitted",
        f"{W}: 'an unranked entrant with zero statistics shows no false zero' (standing only)",
        championship_section(l, STANDING_ZERO, PROFILE_A["season"], uid()))
    add("Provisional standing chip (no profile fixture sets provisional: chip only)",
        "driver_detail_screen.dart: GvStatusChip(resultStatusProvisional) when standing.provisional",
        f'<div class="chip-row chips"><span class="chip chip--outline">{esc(l["provisional"])}</span></div>')
    add("Plate with a number and no code or nationality",
        f"{F}: seasonDriverCardsFixture() 'Unaffiliated Entrant' (collection card; plate only)",
        plate(l, CARD_UNAFFILIATED["name"], CARD_UNAFFILIATED["number"], "race", CARD_UNAFFILIATED["short"],
              CARD_UNAFFILIATED["nationality"], CARD_UNAFFILIATED["season"]))
    add("Plate with no number, no code, no nationality",
        f"{F}: seasonDriverCardsFixture() 'Reserve Entrant' (collection card; plate only)",
        plate(l, CARD_RESERVE["name"], CARD_RESERVE["number"], "race", CARD_RESERVE["short"],
              CARD_RESERVE["nationality"], CARD_RESERVE["season"]))
    add("Portrait layer geometry only (dashed outline, development only). No cleared media: absent, loading and "
        "failed images all render the plate as Scenario A",
        "driver_detail_screen.dart _DriverHero: GvRemoteImage, decorative; content/media/media-rights.json is empty",
        profile_plate(l, PROFILE_A, media=True))

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
    desc = "Development-only state fixtures for the GridView Driver Detail prototype."
    return page(lang, f"GridView {t['title']}", desc, content, body_cls="detail states",
                extra_css='\n<link rel="stylesheet" href="states.css">')


def build():
    for lang, suffix in (("en", ""), ("es", ".es")):
        l = L[lang]
        (OUT / f"index{suffix}.html").write_text(main_page(lang, PROFILE_A, "A (complete)"), encoding="utf-8")
        (OUT / f"partial{suffix}.html").write_text(
            main_page(lang, PROFILE_B, "B (partial)", top_notice=l["partial"]), encoding="utf-8")
        (OUT / f"states{suffix}.html").write_text(states_page(lang), encoding="utf-8")
    print("wrote", ", ".join(sorted(p.name for p in OUT.glob("*.html"))))


if __name__ == "__main__":
    build()
