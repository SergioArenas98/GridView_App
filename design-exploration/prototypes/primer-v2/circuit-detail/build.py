"""Generates the Circuit Detail prototype pages (Python 3 stdlib only).

    python build.py

Writes index.html / index.es.html (scenario A, complete circuit),
partial.html / partial.es.html (scenario B, partial circuit: no physical
facts, no lap record, no related event, never synced), no-event.html /
no-event.es.html (scenario C, complete circuit with no Grand Prix in the
selected season) and states.html / states.es.html (development-only fixture
gallery). Edit this generator, not the HTML.

Every value comes from an existing Flutter test fixture (README.md, "Fixture
provenance"). Every label comes from lib/l10n/app_en.arb or app_es.arb.
Rendering rules mirror
lib/features/circuits/presentation/circuit_detail_screen.dart,
lib/features/shared/domain/entities/entity_profile.dart (CircuitProfile),
lib/features/shared/presentation/entity_formatting.dart,
lib/features/shared/presentation/result_formatting.dart (elapsed),
lib/features/shared/presentation/domain_status.dart and
lib/features/shared/presentation/widgets/entity_detail_scaffold.dart.
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
        "title": "Circuit",  # circuitTitle
        "facts": "Circuit facts",  # circuitFactsSection
        "length": "Length",  # fieldLength
        "corners": "Corners",  # fieldCorners
        "direction": "Direction",  # fieldDirection
        "first_gp": "First Grand Prix",  # fieldFirstGrandPrix
        "km": "{} km",  # lengthKilometers
        "dir": {"clockwise": "Clockwise",  # circuitDirectionClockwise
                "counterClockwise": "Counter-clockwise",  # circuitDirectionCounterClockwise
                "unknown": "Direction unavailable"},  # circuitDirectionUnknown
        "lap": "Lap record",  # circuitLapRecordSection
        "lap_time": "Time",  # fieldLapRecordTime
        "lap_driver": "Driver",  # fieldLapRecordDriver
        "lap_year": "Year",  # fieldLapRecordYear
        "driver_unavailable": "Driver unavailable",  # circuitLapRecordDriverUnavailable
        "related": "This season's Grand Prix",  # circuitRelatedGrandPrix
        "no_related": "No Grand Prix this season",  # circuitNoRelatedGrandPrix
        "open_gp": "Open {}",  # circuitOpenGrandPrix
        "season": "{} season",  # seasonLabel
        "round": "Round {}",  # roundLabel
        "gp_unavailable": "Grand Prix name unavailable",  # grandPrixNameUnavailable
        "layout_image": "Track layout of {}",  # circuitLayoutImage
        "status": {"completed": "Completed", "live": "Live", "upcoming": "Upcoming",
                   "scheduled": "Scheduled", "postponed": "Postponed", "cancelled": "Cancelled",
                   "unknown": "Status unknown"},  # eventState*; requiredEventStatusLabel
        "format": {"standard": "Standard weekend", "sprint": "Sprint weekend",
                   "unknown": "Format unknown"},  # weekendFormat*
        "months": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        "date": "{m} {d}, {y}",  # DateFormat.yMMMd('en')
        "decimal": ".",
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
        "title": "Circuito",
        "facts": "Datos del circuito",
        "length": "Longitud",
        "corners": "Curvas",
        "direction": "Sentido",
        "first_gp": "Primer Gran Premio",
        "km": "{} km",
        "dir": {"clockwise": "Horario", "counterClockwise": "Antihorario",
                "unknown": "Sentido no disponible"},
        "lap": "Récord de vuelta",
        "lap_time": "Tiempo",
        "lap_driver": "Piloto",
        "lap_year": "Año",
        "driver_unavailable": "Piloto no disponible",
        "related": "El Gran Premio de esta temporada",
        "no_related": "Sin Gran Premio esta temporada",
        "open_gp": "Abrir {}",
        "season": "Temporada {}",
        "round": "Ronda {}",
        "gp_unavailable": "Nombre del Gran Premio no disponible",
        "layout_image": "Trazado de {}",
        "status": {"completed": "Finalizado", "live": "En directo", "upcoming": "Próximo",
                   "scheduled": "Programado", "postponed": "Aplazado", "cancelled": "Cancelado",
                   "unknown": "Estado desconocido"},
        "format": {"standard": "Fin de semana estándar", "sprint": "Fin de semana al sprint",
                   "unknown": "Formato desconocido"},
        "months": ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"],
        "date": "{d} {m} {y}",  # DateFormat.yMMMd('es')
        "decimal": ",",
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
# Fixtures (test/support/entity_fixtures.dart and the named tests, verbatim)
# --------------------------------------------------------------------------

BOTTAS_RECORD = {"driver_id": "valtteri-bottas", "time_ms": 1 * 60_000 + 46_000 + 286, "year": 2018}


def related_gp(season=2026, round_=13, name="Belgian Grand Prix", start="2026-07-24",
               end="2026-07-26", status="upcoming", fmt="sprint"):
    """relatedGrandPrix() defaults."""
    return {"season": season, "round": round_, "name": name, "start": start, "end": end,
            "status": status, "format": fmt}


def circuit_profile(season=2026, circuit_id="spa-francorchamps", name="Circuit de Spa-Francorchamps",
                    locality="Stavelot", country="Belgium", length_m=7004, corners=19,
                    direction="clockwise", first_gp=1950, lap_record=None, with_lap_record=True,
                    holder_name="Valtteri Bottas", related=None, with_related=True):
    """circuitProfileFixture() defaults. media is never set (no fixture
    profile carries circuit media; content/media/media-rights.json is empty)."""
    return {
        "season": season, "id": circuit_id, "name": name, "locality": locality, "country": country,
        "length_m": length_m, "corners": corners, "direction": direction, "first_gp": first_gp,
        "lap_record": (lap_record or BOTTAS_RECORD) if with_lap_record else None,
        "holder_name": holder_name,
        "related": (related or related_gp(season=season)) if with_related else None,
    }


# Scenario A: router_harness defaultFakeCircuits() = circuitProfileFixture();
# entity_detail_widget_test 'renders physical facts, the lap record and the
# event'; screen_golden_test 'golden: circuit detail complete'. Synced.
PROFILE_A = circuit_profile()

# Scenario B: screen_golden_test 'golden: circuit detail partial'
# (syncMetadata -> null: never synced, so the partial notice).
PROFILE_B = circuit_profile(circuit_id="monza", name="Autodromo Nazionale Monza", locality="Monza",
                            country="Italy", length_m=None, corners=None, direction=None, first_gp=None,
                            with_lap_record=False, with_related=False)

# Scenario C: entity_detail_widget_test 'no related event this season is a
# valid state' (circuitProfileFixture(withRelated: false), route /circuits/monza;
# the route id is never displayed, the profile is Spa's). Synced.
PROFILE_C = circuit_profile(circuit_id="monza", with_related=False)

# 'missing physical facts hide the card entirely': no facts, no lap record,
# the related event kept (default). Synced.
PROFILE_NO_FACTS = circuit_profile(circuit_id="monza", length_m=None, corners=None, direction=None,
                                   first_gp=None, with_lap_record=False)
# 'an unknown direction uses a safe localized fallback'.
PROFILE_UNKNOWN_DIR = circuit_profile(circuit_id="monza", direction="unknown")
# calendar_dao_test / entity_collection_read_model_test 'an unresolvable
# lap-record holder yields no name, never an id': LapRecord(driverId:
# 'ghost-driver', year: 2004), no time; lapRecordDriverName null.
GHOST_RECORD = {"record": {"driver_id": "ghost-driver", "time_ms": None, "year": 2004}, "holder_name": None}
# 'a missing lap-record driver uses localized copy, not an id': the default
# record with lapRecordDriverName null (the test renames the circuit
# 'Autodromo Nazionale Monza' over Spa's facts, so only the record is shown).
UNRESOLVED_RECORD = {"record": BOTTAS_RECORD, "holder_name": None}
# 'an unnamed related event uses localized unavailable copy'.
RELATED_UNNAMED = related_gp(name=None)
# seasonCircuitCardsFixture() Monza card: relatedGrandPrix(round: 12,
# 'Italian Grand Prix', 2026-07-10, standard); status keeps the fixture
# default (upcoming). A collection card's related summary, the same type.
RELATED_ITALIAN = related_gp(round_=12, name="Italian Grand Prix", start="2026-07-10", end="2026-07-12",
                             fmt="standard")

# --------------------------------------------------------------------------
# CircuitProfile getters and EntityFormatter
# --------------------------------------------------------------------------


def esc(s):
    return html.escape(str(s), quote=True)


def has_physical_facts(p):
    return any(p[k] is not None for k in ("length_m", "corners", "direction", "first_gp"))


def has_lap_record(p):  # record with a time or a year; a holder id alone is not enough
    r = p["lap_record"]
    return r is not None and (r["time_ms"] is not None or r["year"] is not None)


def location(p):  # joinDetails([locality, country], separator: ', ')
    parts = [x for x in (p["locality"], p["country"]) if x and x.strip()]
    return ", ".join(parts) or None


def km_value(metres, l):
    """kilometres(): NumberFormat.decimalPattern(locale).format(metres / 1000);
    at most three fraction digits, trailing zeros dropped. Returns the number
    part only; lengthKilometers supplies the unit."""
    if metres is None:
        return None
    s = f"{metres / 1000:.3f}".rstrip("0").rstrip(".")
    return s.replace(".", l["decimal"])


def count(v):  # decimalPattern; corner counts never reach a grouping
    return None if v is None else str(v)


def year(v):  # year(): no digit grouping
    return None if v is None else str(v)


def elapsed(ms):
    """ResultFormatter.elapsed: m:ss.mmm (h:mm:ss.mmm past an hour). Not
    localized: the same digits and separators in English and Spanish."""
    if ms is None:
        return None
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, millis = divmod(rem, 1000)
    tail = f"{s:02d}.{millis:03d}"
    return f"{h}:{m:02d}:{tail}" if h else f"{m}:{tail}"


def calendar_date(value, l):  # DateFormat.yMMMd(locale)
    if not value:
        return None
    y, m, d = (int(x) for x in value.split("-"))
    return l["date"].format(m=l["months"][m - 1], d=d, y=y)


# Chip vocabulary as Grand Prix Detail (gpd build.py STATUS_CHIP): outline for
# scheduled/upcoming/completed, Ember fill for live, strong outline for
# postponed/cancelled, dashed for an explicit unknown. Format: tray fill.
STATUS_CHIP = {"upcoming": "chip--scheduled", "scheduled": "chip--scheduled", "completed": "chip--done",
               "live": "chip--live", "postponed": "chip--alert", "cancelled": "chip--alert",
               "unknown": "chip--unknown"}

# --------------------------------------------------------------------------
# Icons (Lucide, ISC licence; same symbols as the other screens, plus
# rotate-cw / rotate-ccw for the direction and route for the media slot)
# --------------------------------------------------------------------------

SPRITE = """<svg width="0" height="0" class="sprite" aria-hidden="true" focusable="false">
  <symbol id="i-back" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></symbol>
  <symbol id="i-cloud-off" viewBox="0 0 24 24"><path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/></symbol>
  <symbol id="i-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></symbol>
  <symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></symbol>
  <symbol id="i-cw" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></symbol>
  <symbol id="i-ccw" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></symbol>
  <symbol id="i-route" viewBox="0 0 24 24"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></symbol>
</svg>"""


def icon(name, cls="icon"):
    return f'<svg class="{cls}" aria-hidden="true"><use href="#i-{name}"/></svg>'


# --------------------------------------------------------------------------
# Components
# --------------------------------------------------------------------------


def appbar(l):
    """EntityDetailScaffold title: always circuitTitle, in every state."""
    return f"""<header class="dbar">
  <a class="icon-btn dbar__back" href="#back" aria-label="{esc(l['back'])}">{icon('back')}</a>
  <p class="dbar__title">{esc(l['title'])}</p>
</header>"""


def notice(text):
    """GvOfflineNotice: cloud-off icon, live region."""
    return f'<div class="page-notice"><p class="notice" role="status">{icon("cloud-off")}<span>{esc(text)}</span></p></div>'


def media_slot(l, p, kind):
    """CI04. The circuit's own media, layout diagram preferred
    (MediaSlotPolicy.circuitLayout). Only rendered when an asset was
    selected, so its 16:9 geometry is reserved from the first frame and
    loading, loaded and failed never shift the page. No asset: no slot.
    - layout: informative, labelled circuitLayoutImage(name) (the diagram
      shows the track shape, which no adjacent text states);
    - photo: decorative (aria-hidden), like every other entity image;
    - loading: the empty frame; failed: Flutter's route placeholder icon,
      decorative. No cleared media exists: frames show geometry only."""
    if kind == "layout":
        return (f'\n  <div class="ch__media ch__media--dev" role="img" '
                f'aria-label="{esc(l["layout_image"].format(p["name"]))}"></div>')
    if kind == "photo":
        return '\n  <div class="ch__media ch__media--dev" aria-hidden="true"></div>'
    if kind == "loading":
        return '\n  <div class="ch__media ch__media--loading" aria-hidden="true"></div>'
    if kind == "failed":
        return f'\n  <div class="ch__media ch__media--failed" aria-hidden="true">{icon("route")}</div>'
    return ""


def length_dim(l, p):
    """CI05 as a dimension line: label, then the value set between two arms
    whose outer ends carry 12° ticks (the architectural dimension tick). The
    arms are full width regardless of the value: notation, not a scale."""
    v = km_value(p["length_m"], l)
    if v is None:
        return ""
    pre, post = l["km"].split("{}")
    return (f'<div class="dim"><dt>{esc(l["length"])}</dt>'
            f'<dd><span class="dim__arm dim__arm--start" aria-hidden="true"></span>'
            f'<span class="dim__val">{esc(pre)}<span class="dim__num num">{esc(v)}</span>'
            f'<span class="dim__unit">{esc(post)}</span></span>'
            f'<span class="dim__arm dim__arm--end" aria-hidden="true"></span></dd></div>')


def facts_row(l, p):
    """CI06-CI08: corners, direction (omitted only for null; unknown is
    the localized fallback), first Grand Prix year without grouping."""
    cells = []
    if count(p["corners"]) is not None:
        cells.append(f'<div class="fact"><dt>{esc(l["corners"])}</dt>'
                     f'<dd class="fact__fig num">{esc(count(p["corners"]))}</dd></div>')
    if p["direction"] is not None:
        d = p["direction"]
        glyph = {"clockwise": icon("cw", "icon fact__dir"),
                 "counterClockwise": icon("ccw", "icon fact__dir")}.get(d, "")
        cells.append(f'<div class="fact fact--word"><dt>{esc(l["direction"])}</dt>'
                     f'<dd class="fact__word">{glyph}<span>{esc(l["dir"][d])}</span></dd></div>')
    if year(p["first_gp"]) is not None:
        cells.append(f'<div class="fact"><dt>{esc(l["first_gp"])}</dt>'
                     f'<dd class="fact__fig num">{esc(year(p["first_gp"]))}</dd></div>')
    return f'<div class="facts">{"".join(cells)}</div>' if cells else ""


def facts_block(l, p, uid):
    """hasPhysicalFacts gate: no block, no heading, without any fact."""
    if not has_physical_facts(p):
        return ""
    return (f'\n  <section class="ch__facts" aria-labelledby="{uid}-facts">'
            f'\n    <h2 class="ch__kicker" id="{uid}-facts">{esc(l["facts"])}</h2>'
            f'\n    <dl class="spec">{length_dim(l, p)}{facts_row(l, p)}</dl>'
            f'\n  </section>')


def name_html(name):
    """Hyphenated words of up to 18 characters are kept whole (CSS
    .nobr); the text itself is unchanged."""
    return " ".join(f'<span class="nobr">{esc(w)}</span>' if "-" in w and len(w) <= 18 else esc(w)
                    for w in name.split(" "))


def header(l, p, uid="m", media=None):
    """CI01-CI08. The circuit sheet: the stable identity only (name,
    location, circuit-owned media, physical facts). Nothing season-scoped
    sits here."""
    loc = location(p)
    loc_html = f'\n  <p class="ch__loc">{esc(loc)}</p>' if loc else ""
    facts = facts_block(l, p, uid)
    mods = "" if facts else " ch--bare"
    return f"""<section class="ch{mods}" aria-labelledby="{uid}-name">
  <h1 class="ch__name" id="{uid}-name">{name_html(p['name'])}</h1>{loc_html}{media_slot(l, p, media)}{facts}
</section>"""


def lap_section(l, p, uid, record=None, holder_name=None, override=False):
    """CI09-CI11. Gate: a record with a time or a year. The holder row
    exists only when a driver id exists; an unresolved name is the localized
    unavailable copy, never the id. No navigation to the holder."""
    if override:
        p = dict(p, lap_record=record, holder_name=holder_name)
    if not has_lap_record(p):
        return ""
    r = p["lap_record"]
    time_html = ""
    if elapsed(r["time_ms"]) is not None:
        time_html = (f'\n    <div class="lap__time"><dt>{esc(l["lap_time"])}</dt>'
                     f'<dd class="num">{esc(elapsed(r["time_ms"]))}</dd></div>')
    by = []
    if r["driver_id"] is not None:
        name = p["holder_name"]
        cls = "" if name else ' class="is-unavailable"'
        by.append(f'<div><dt>{esc(l["lap_driver"])}</dt><dd{cls}>{esc(name or l["driver_unavailable"])}</dd></div>')
    if year(r["year"]) is not None:
        by.append(f'<div><dt>{esc(l["lap_year"])}</dt><dd class="num">{esc(year(r["year"]))}</dd></div>')
    by_html = f'\n    <div class="lap__by">{"".join(by)}</div>' if by else ""
    return f"""<section class="sec" aria-labelledby="{uid}-lap">
  <h2 class="section-title sec__title" id="{uid}-lap">{esc(l['lap'])}</h2>
  <dl class="lap{'' if time_html else ' lap--no-time'}">{time_html}{by_html}
  </dl>
</section>"""


def related_section(l, p, uid, event="profile"):
    """CI12-CI17. The season line (seasonLabel with the ready state's
    season) leads both states (proposal: Flutter shows it only in the
    no-event state). No event: the season-scoped statement, no card, no
    link. An event: one row link to its exact season and round."""
    ev = p["related"] if event == "profile" else event
    season_line = f'\n  <p class="rel__season">{esc(l["season"].format(p["season"]))}</p>'
    head = f"""<section class="sec rel" aria-labelledby="{uid}-rel">
  <h2 class="section-title sec__title" id="{uid}-rel">{esc(l['related'])}</h2>{season_line}"""
    if ev is None:
        return head + f'\n  <p class="rel__none">{esc(l["no_related"])}</p>\n</section>'
    name = ev["name"] or l["gp_unavailable"]
    unnamed = "" if ev["name"] else " rx__name--unavailable"
    pre, post = l["round"].split("{}")
    date = calendar_date(ev["start"], l)
    date_html = f'<span class="rx__date" id="{uid}-rx-date">{esc(date)}</span>' if date else ""
    chips = []
    if ev["status"] is not None:
        chips.append(f'<span class="chip {STATUS_CHIP[ev["status"]]}">{esc(l["status"][ev["status"]])}</span>')
    if ev["format"] is not None:
        chips.append(f'<span class="chip chip--context">{esc(l["format"][ev["format"]])}</span>')
    chips_html = f'<span class="rx__chips chips" id="{uid}-rx-chips">{"".join(chips)}</span>' if chips else ""
    described = " ".join(x for x in (f"{uid}-rx-round", f"{uid}-rx-date" if date else "",
                                      f"{uid}-rx-chips" if chips else "") if x)
    href = f"#calendar/{ev['season']}/{ev['round']}"
    return head + f"""
  <a class="rx" href="{esc(href)}" aria-label="{esc(l['open_gp'].format(name))}" aria-describedby="{described}">
    <span class="rx__round" id="{uid}-rx-round" aria-hidden="true"><span class="rx__round-label">{esc(pre.strip())}</span> <span class="rx__round-num num">{esc(ev['round'])}</span>{esc(post)}</span>
    <span class="rx__seam" aria-hidden="true"></span>
    <span class="rx__body" aria-hidden="true"><span class="rx__text"><span class="rx__name{unnamed}">{esc(name)}</span>{date_html}</span>{chips_html}</span>
    <span class="rx__disc" aria-hidden="true">{icon('arrow')}</span>
  </a>
</section>"""


def body(l, p, uid, top_notice=None, media=None):
    note = notice(top_notice) if top_notice else ""
    return "\n".join(x for x in (
        note, header(l, p, uid, media), lap_section(l, p, uid), related_section(l, p, uid)) if x)


def empty_block(title, msg, icon_name, button=None):
    btn = f'\n    <button class="btn" type="button">{esc(button)}</button>' if button else ""
    return f"""<div class="empty">
    {icon(icon_name)}
    <p class="empty__title">{esc(title)}</p>
    <p class="empty__msg">{esc(msg)}</p>{btn}
  </div>"""


def skeleton(l):
    return (f'<div class="skel" role="progressbar" aria-label="{esc(l["loading"])}">'
            '<span class="skel__head"></span><span class="skel__label"></span>'
            '<span class="skel__row"></span><span class="skel__label"></span><span class="skel__row"></span></div>')


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
<link rel="stylesheet" href="cd.css">{extra_css}
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
    desc = (f"GridView Circuit Detail, Primer V2 visual prototype ({'English' if lang == 'en' else 'Spanish'}), "
            f"scenario {scenario}. Data copied from Flutter test fixtures; not real data.")
    return page(lang, f"GridView {p['name']}", desc, content)


# --------------------------------------------------------------------------
# States gallery (development only)
# --------------------------------------------------------------------------

STATE_TEXT = {
    "en": {
        "flag": "Development fixtures. Not app UI, not circuit data",
        "title": "Circuit states",
        "note": "Each frame is copied from one Flutter test fixture and never merged with another. "
                "Captions are prototype annotations; everything inside a frame is app copy from the ARB files.",
        "links": [("index.html", "A: complete"), ("partial.html", "B: partial"),
                  ("no-event.html", "C: no Grand Prix this season")],
    },
    "es": {
        "flag": "Fixtures de desarrollo. No es interfaz de la app ni datos de circuitos",
        "title": "Estados del circuito",
        "note": "Cada marco copia un único fixture de test de Flutter, sin mezclarlo con otros. "
                "Los rótulos son anotaciones del prototipo; el contenido de cada marco es texto de los ARB.",
        "links": [("index.es.html", "A: completo"), ("partial.es.html", "B: parcial"),
                  ("no-event.es.html", "C: sin Gran Premio esta temporada")],
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


def vocab_row(items):
    return f'<div class="chip-row chips">{"".join(items)}</div>'


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
        "entity_detail_scaffold.dart: EntityDetailLoading → _DetailSkeleton (screen_skeletons_test '/circuits/northgate')",
        appbar(l) + "\n" + skeleton(l))
    add("Season unavailable: nothing requested, retry offered",
        "Shared EntityDetailSeasonUnavailable (circuitProfileProvider emits nothing without a season)",
        appbar(l) + "\n" + empty_block(l["season_unavail_title"], l["season_unavail_msg"], "alert", l["retry"]))
    add("Confirmed not found, no local entity",
        "entity_detail_scaffold.dart EntityDetailNotFound (circuitProfile() returns null for a missing row or an unresolved stub)",
        appbar(l) + "\n" + empty_block(l["not_found_title"], l["not_found_msg"], "help"))
    add("First-load failure, no local entity: retry",
        "entity_detail_scaffold.dart EntityDetailFirstLoadError (shared; tested on Driver detail)",
        appbar(l) + "\n" + empty_block(l["load_error_title"], l["error_generic"], "alert", l["retry"]))
    add("Refresh failed with cached content: content kept",
        "Shared notice rule ('golden: entity detail cached failure'); circuitProfileFixture() circuit sheet",
        notice(l["update_failed"]) + "\n" + header(l, PROFILE_A, uid()))
    add("Stale materialized detail: content kept, cached notice",
        "Shared notice rule (entity_detail_state_test); circuitProfileFixture() circuit sheet",
        notice(l["cached"]) + "\n" + header(l, PROFILE_A, uid()))
    add("No physical facts and no lap record, related event kept: no facts block, no record section",
        f"{W}: 'missing physical facts hide the card entirely' (circuitProfileFixture with every fact null, "
        "withLapRecord: false; synced)",
        body(l, PROFILE_NO_FACTS, uid()))
    add("Explicitly unknown direction: localized fallback, no direction glyph",
        f"{W}: 'an unknown direction uses a safe localized fallback' (direction: CircuitDirection.unknown; circuit sheet)",
        header(l, PROFILE_UNKNOWN_DIR, uid()))
    add("Unresolved record holder, year only: unavailable copy, no time, never the id",
        "test/database/entity_collection_read_model_test.dart: 'an unresolvable lap-record holder yields no "
        "name, never an id' (LapRecord(driverId: 'ghost-driver', year: 2004); record only)",
        lap_section(l, PROFILE_A, uid(), override=True, **GHOST_RECORD))
    add("Unresolved record holder with a time",
        f"{W}: 'a missing lap-record driver uses localized copy, not an id' (default record, "
        "lapRecordDriverName: null; record only: the test renames the circuit over Spa's facts)",
        lap_section(l, PROFILE_A, uid(), override=True, **UNRESOLVED_RECORD))
    add("Unnamed related event: localized name fallback; the link keeps the exact season and round",
        f"{W}: 'an unnamed related event uses localized unavailable copy' (relatedGrandPrix(name: null); "
        "related section only)",
        related_section(l, PROFILE_A, uid(), event=RELATED_UNNAMED))
    add("Related event, standard weekend, another round",
        f"{F}: seasonCircuitCardsFixture() Monza card's relatedGrandPrix (round 12, 'Italian Grand Prix', "
        "2026-07-10, standard; status keeps the fixture default, upcoming). Related section only",
        related_section(l, PROFILE_A, uid(), event=RELATED_ITALIAN))
    add("Event status vocabulary: explicit unknown is a dashed chip; a null status has no chip "
        "(no circuit fixture sets either; chips only)",
        "circuit_detail_screen.dart: requiredEventStatusLabel for any non-null status; domain_status.dart",
        vocab_row([f'<span class="chip chip--unknown">{esc(l["status"]["unknown"])}</span>',
                   f'<span class="chip chip--context">{esc(l["format"]["unknown"])}</span>']))
    add("Direction vocabulary (ARB values only, no circuit fixture is counter-clockwise)",
        "entity_formatting.dart direction(): clockwise, counter-clockwise, unknown",
        '<dl class="spec spec--vocab"><div class="facts">' + "".join(
            f'<div class="fact fact--word"><dt>{esc(l["direction"])}</dt><dd class="fact__word">'
            f'{icon(g, "icon fact__dir") if g else ""}<span>{esc(l["dir"][d])}</span></dd></div>'
            for d, g in (("clockwise", "cw"), ("counterClockwise", "ccw"), ("unknown", None))) + "</div></dl>")
    add("Media slot geometry only (dashed outline, development only): a selected layout diagram is "
        "informative and labelled. No cleared media: Scenario A has no slot",
        "_CircuitHero: GvRemoteImage(circuitLayout), decorative: !isLayoutDiagram, semanticLabel "
        "circuitLayoutImage(name); calendar_dao_test 'spa-layout-v1' is the asset shape (no image bytes)",
        header(l, PROFILE_A, uid(), media="layout"))
    add("Media loading, then failed: the reserved frame never shifts the page; failure shows the "
        "decorative route placeholder",
        "GvRemoteImage placeholderIcon: Icons.route_outlined for absent, loading, rejected, failed",
        header(l, PROFILE_A, uid(), media="loading") + "\n" + header(l, PROFILE_A, f"{uid()}b", media="failed"))

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
    desc = "Development-only state fixtures for the GridView Circuit Detail prototype."
    return page(lang, f"GridView {t['title']}", desc, content, body_cls="detail states",
                extra_css='\n<link rel="stylesheet" href="states.css">')


def build():
    for lang, suffix in (("en", ""), ("es", ".es")):
        l = L[lang]
        (OUT / f"index{suffix}.html").write_text(main_page(lang, PROFILE_A, "A (complete)"),
                                                  encoding="utf-8", newline="\n")
        (OUT / f"partial{suffix}.html").write_text(
            main_page(lang, PROFILE_B, "B (partial)", top_notice=l["partial"]), encoding="utf-8", newline="\n")
        (OUT / f"no-event{suffix}.html").write_text(main_page(lang, PROFILE_C, "C (no related Grand Prix)"),
                                                     encoding="utf-8", newline="\n")
        (OUT / f"states{suffix}.html").write_text(states_page(lang), encoding="utf-8", newline="\n")
    print("wrote", ", ".join(sorted(p.name for p in OUT.glob("*.html"))))


if __name__ == "__main__":
    build()
