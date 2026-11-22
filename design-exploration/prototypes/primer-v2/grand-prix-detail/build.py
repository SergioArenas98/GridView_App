"""Generates the Grand Prix Detail prototype pages (Python 3 stdlib only).

    python build.py

Writes index.html / index.es.html (scenario A, upcoming), results.html /
results.es.html (scenario B, classification) and states.html / states.es.html
(development-only fixture gallery). Edit this generator, not the HTML.

Every value comes from an existing Flutter test fixture (see README.md,
"Fixture provenance"). Every label comes from lib/l10n/app_en.arb or
app_es.arb. Formatting mirrors lib/core/time/session_time.dart,
lib/features/shared/presentation/result_formatting.dart and intl's en/es
patterns (en: E "Fri", MMMd "Jul 24", MMMEd "Sun, Jul 26", Hm "HH:mm";
es: E "vie", MMMd "24 jul", MMMEd "dom, 26 jul", Hm "H:mm").
"""

from __future__ import annotations

import html
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

OUT = Path(__file__).parent

# --------------------------------------------------------------------------
# Strings (verbatim ARB copy; key names in comments)
# --------------------------------------------------------------------------

L = {
    "en": {
        "lang": "en",
        "back": "Back",  # Material back-button tooltip
        "gp_title": "Grand Prix",  # grandPrixTitle
        "round": "Round",  # roundLabel "Round {round}"
        "season": "{} season",  # seasonLabel
        "circuit": "Circuit",  # grandPrixCircuit / fieldCircuit
        "sessions": "Sessions",  # grandPrixSessions
        "results": "Results",  # grandPrixResults
        "race_results": "Race results",  # grandPrixRaceResults
        "view_circuit": "View circuit",  # grandPrixViewCircuit
        "dates": "Dates",  # fieldDates
        "location": "Location",  # fieldLocation
        "event_tz": "Event time zone",  # fieldEventTimeZone
        "device_tz": "Your time zone",  # fieldDeviceTimeZone
        "points_word": "Points",  # fieldPoints
        "pts": "{} pts",  # homePointsValue
        "winner": "Winner",  # homeWinnerLabel
        "event_status": {
            "upcoming": "Upcoming", "completed": "Completed", "scheduled": "Scheduled",
            "live": "Live", "postponed": "Postponed", "cancelled": "Cancelled",
            "unknown": "Status unknown",
        },
        "format": {"standard": "Standard weekend", "sprint": "Sprint weekend", "unknown": "Format unknown"},
        "session_status": {
            "scheduled": "Scheduled", "completed": "Completed", "live": "Live",
            "cancelled": "Cancelled", "postponed": "Postponed", "unknown": "Status unknown",
        },
        "session_unknown": "Session",  # sessionNameUnknown
        "no_sessions_title": "Schedule not available",
        "no_sessions_msg": "Session times for this weekend have not been published yet.",
        "results_unavail_title": "Results not available yet",
        "results_pending": "Results will appear once the session is complete.",
        "results_error_title": "Can't load results",
        "gp_error_title": "Can't load this Grand Prix",
        "gp_not_found_title": "Grand Prix not found",
        "gp_not_found_msg": "We couldn't find this Grand Prix on the calendar.",
        "go_home": "Go to Home",
        "retry": "Try again",
        "error_server": "The service is temporarily unavailable.",
        "error_offline": "You appear to be offline.",
        "stale": "This data may be out of date — showing the last saved version.",
        "refresh_failed": "Couldn't refresh — showing saved data.",
        "loading": "Loading",
        "result_status": {"final": "Final", "provisional": "Provisional", "unavailable": "Not available", "unknown": "Status unknown"},
        "finish": {
            "finished": "Finished", "lapped": "Lapped", "dnf": "DNF", "dns": "DNS",
            "dsq": "DSQ", "dnq": "DNQ", "unknown": "Status unknown",
        },
        "fastest": "Fastest lap",
        "laps_one": "+1 lap", "laps_other": "+{} laps",
        "driver_unavail": "Driver name unavailable",
        "team_unavail": "Team name unavailable",
        "open_team": "Open team {}",
        "open_team_unnamed": "Open team",
        "mock_banner": "Sample data — not live results",
        "wd": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "mon": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    },
    "es": {
        "lang": "es",
        "back": "Atrás",
        "gp_title": "Gran Premio",
        "round": "Ronda",
        "season": "Temporada {}",
        "circuit": "Circuito",
        "sessions": "Sesiones",
        "results": "Resultados",
        "race_results": "Resultados de la carrera",
        "view_circuit": "Ver circuito",
        "dates": "Fechas",
        "location": "Ubicación",
        "event_tz": "Zona horaria del evento",
        "device_tz": "Tu zona horaria",
        "points_word": "Puntos",
        "pts": "{} pts",
        "winner": "Ganador",
        "event_status": {
            "upcoming": "Próximo", "completed": "Finalizado", "scheduled": "Programado",
            "live": "En directo", "postponed": "Aplazado", "cancelled": "Cancelado",
            "unknown": "Estado desconocido",
        },
        "format": {"standard": "Fin de semana estándar", "sprint": "Fin de semana al sprint", "unknown": "Formato desconocido"},
        "session_status": {
            "scheduled": "Programada", "completed": "Finalizada", "live": "En directo",
            "cancelled": "Cancelado", "postponed": "Aplazado", "unknown": "Estado desconocido",
        },
        "session_unknown": "Sesión",
        "no_sessions_title": "Horario no disponible",
        "no_sessions_msg": "Los horarios de las sesiones de este fin de semana aún no se han publicado.",
        "results_unavail_title": "Resultados aún no disponibles",
        "results_pending": "Los resultados aparecerán cuando finalice la sesión.",
        "results_error_title": "No se pueden cargar los resultados",
        "gp_error_title": "No se puede cargar este Gran Premio",
        "gp_not_found_title": "Gran Premio no encontrado",
        "gp_not_found_msg": "No pudimos encontrar este Gran Premio en el calendario.",
        "go_home": "Ir a Inicio",
        "retry": "Reintentar",
        "error_server": "El servicio no está disponible temporalmente.",
        "error_offline": "Parece que no tienes conexión.",
        "stale": "Estos datos pueden estar desactualizados — mostrando la última versión guardada.",
        "refresh_failed": "No se pudo actualizar — mostrando datos guardados.",
        "loading": "Cargando",
        "result_status": {"final": "Definitivo", "provisional": "Provisional", "unavailable": "No disponible", "unknown": "Estado desconocido"},
        "finish": {
            "finished": "Finalizó", "lapped": "Doblado", "dnf": "DNF", "dns": "DNS",
            "dsq": "DSQ", "dnq": "DNQ", "unknown": "Estado desconocido",
        },
        "fastest": "Vuelta rápida",
        "laps_one": "+1 vuelta", "laps_other": "+{} vueltas",
        "driver_unavail": "Nombre del piloto no disponible",
        "team_unavail": "Nombre del equipo no disponible",
        "open_team": "Abrir el equipo {}",
        "open_team_unnamed": "Abrir el equipo",
        "mock_banner": "Datos de muestra — no son resultados reales",
        "wd": ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"],
        "mon": ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"],
    },
}

DEVICE_TZ = "UTC"  # test/support/router_harness.dart: deviceTimeZone = 'UTC'

# --------------------------------------------------------------------------
# Fixtures (copied verbatim from Flutter tests; see README provenance table)
# --------------------------------------------------------------------------


def utc(y, m, d, h, mi=0):
    return datetime(y, m, d, h, mi, tzinfo=timezone.utc)


def sess(sid, name, start, status, stype="race"):
    return {"id": sid, "name": name, "start": start, "status": status, "type": stype}


# test/support/domain_fixtures.dart: belgianSprintSessions()
BELGIAN_SESSIONS = [
    sess("2026-belgian-grand-prix-practice-1", "Practice 1", utc(2026, 7, 24, 10, 30), "scheduled", "practice_1"),
    sess("2026-belgian-grand-prix-sprint-qualifying", "Sprint Qualifying", utc(2026, 7, 24, 14, 30), "scheduled", "sprint_qualifying"),
    sess("2026-belgian-grand-prix-sprint", "Sprint", utc(2026, 7, 25, 10), "scheduled", "sprint"),
    sess("2026-belgian-grand-prix-qualifying", "Qualifying", utc(2026, 7, 25, 14), "scheduled", "qualifying"),
    sess("2026-belgian-grand-prix-race", "Race", utc(2026, 7, 26, 13), "scheduled", "race"),
]

SPA = {"id": "spa-francorchamps", "name": "Circuit de Spa-Francorchamps", "locality": "Spa", "country": "Belgium"}


def belgian(**over):
    """test/screens/grand_prix_widget_test.dart: _detail() defaults."""
    gp = {
        "name": "Belgian Grand Prix", "official": None, "round": 13, "season": 2026,
        "status": "upcoming", "format": "sprint", "start": "2026-07-24", "end": "2026-07-26",
        "tz": "Europe/Brussels", "circuit_id": "spa-francorchamps", "circuit": dict(SPA),
        "sessions": list(BELGIAN_SESSIONS),
    }
    gp.update(over)
    return gp


# Scenario A: 'shows identity, status, format, location and dates'
GP_A = belgian(official="Formula 1 Mock Belgian Grand Prix 2026")

# Scenario B: test/screens/screen_golden_test.dart _completedWeekend()
GP_B = {
    "name": "Italian Grand Prix", "official": None, "round": 12, "season": 2026,
    "status": "completed", "format": "standard", "start": "2026-07-10", "end": "2026-07-12",
    "tz": "Europe/Rome", "circuit_id": "monza",
    "circuit": {"id": "monza", "name": "Autodromo Nazionale Monza", "locality": "Monza", "country": "Italy"},
    "sessions": [
        sess("i-qualifying", "Qualifying", utc(2026, 7, 11, 14), "completed", "qualifying"),
        sess("i-race", "Race", utc(2026, 7, 12, 13), "completed", "race"),
    ],
}


def entry(did, cid, dname, cname, status="finished", position=None, points=None,
          elapsed_ms=None, gap_ms=None, laps_behind=None, gap_text=None, fastest=False):
    return {
        "driver_id": did, "constructor_id": cid, "driver": dname, "team": cname,
        "status": status, "position": position, "points": points, "elapsed": elapsed_ms,
        "gap": gap_ms, "laps_behind": laps_behind, "gap_text": gap_text, "fastest": fastest,
    }


def ms(h=0, m=0, s=0, milli=0):
    return ((h * 60 + m) * 60 + s) * 1000 + milli


# screen_golden_test.dart _raceDocument(): Final race classification, round 12
RESULTS_B = {
    "session": "race", "status": "final", "season": 2026, "fastest_driver": None,
    "entries": [
        entry("max-verstappen", "red-bull", "Max Verstappen", "Red Bull Racing", position=1, points=25,
              elapsed_ms=ms(1, 15, 12, 345)),
        entry("lando-norris", "mclaren", "Lando Norris", "McLaren", position=2, points=18,
              gap_ms=ms(s=3, milli=210)),
        # dnfReason 'Power unit' is stored but not rendered by Flutter
        entry("charles-leclerc", "ferrari", "Charles Leclerc", "Ferrari", status="dnf"),
    ],
}


def widget_race(entries=None, status="final", fastest_driver=None):
    """grand_prix_widget_test.dart: _race()."""
    return {
        "session": "race", "status": status, "season": 2026, "fastest_driver": fastest_driver,
        "entries": entries if entries is not None else [
            entry("max-verstappen", "red-bull", "Max Verstappen", "Red Bull Racing", position=1, points=25,
                  elapsed_ms=ms(1, 25, 3, 456)),
            entry("oscar-piastri", "mclaren", "Oscar Piastri", "McLaren", position=2, points=18.5,
                  gap_ms=ms(s=4, milli=120)),
        ],
    }


FINISH_ENTRIES = [  # 'DNF, DNS, DSQ, DNQ and lapped finishes all read as text'
    entry("a-driver", "a-team", "A Driver", "A Team", status="lapped", position=15, laps_behind=2),
    entry("b-driver", "b-team", "B Driver", "B Team", status="dnf"),
    entry("c-driver", "c-team", "C Driver", "C Team", status="dns"),
    entry("d-driver", "d-team", "D Driver", "D Team", status="dsq"),
    entry("e-driver", "e-team", "E Driver", "E Team", status="dnq"),
    entry("f-driver", "f-team", "F Driver", "F Team", status="unknown"),
]

DUPLICATE_ENTRIES = [  # 'duplicate displayed positions render as delivered' (no team names)
    entry("a-driver", "a-team", "A Driver", None, position=3),
    entry("b-driver", "b-team", "B Driver", None, position=3),
]

UNRESOLVED_ENTRIES = [  # 'both names unresolved stays readable and accessible'
    entry("unsynced-driver", "unsynced-team", None, None, position=1, points=25),
]

# --------------------------------------------------------------------------
# Formatting (mirrors the Dart presenters)
# --------------------------------------------------------------------------


def esc(s):
    return html.escape(str(s), quote=True)


def day_month(d, l):
    if l["lang"] == "en":
        return f"{l['mon'][d.month - 1]} {d.day}"
    return f"{d.day} {l['mon'][d.month - 1]}"


def day_label(dt, l):  # DisplayedTime.dayLabel = '$weekday $dayMonth'
    return f"{l['wd'][dt.weekday()]} {day_month(dt, l)}"


def hm(dt, l):  # DateFormat.Hm: en HH:mm, es H:mm
    return f"{dt.hour:02d}:{dt.minute:02d}" if l["lang"] == "en" else f"{dt.hour}:{dt.minute:02d}"


def date_range(start, end, l):  # SessionTimePresenter.formatDateRange
    s = date.fromisoformat(start) if start else None
    e = date.fromisoformat(end) if end else None
    if s is None and e is None:
        return None

    def mmmed(d):
        return f"{l['wd'][d.weekday()]}, {day_month(d, l)}"

    if s and e:
        if s == e:
            return mmmed(s)
        return f"{day_month(s, l)} – {mmmed(e)}"
    return mmmed(s or e)


def displayed(instant, zone, l):
    local = instant.astimezone(ZoneInfo(zone))
    return {"day": day_label(local, l), "time": hm(local, l), "zone": local.tzname() or "local"}


def present(instant, event_tz, mode, l):
    """SessionTimePresenter.present(); returns (primary, secondary, crosses_day)."""
    if instant is None:
        return None
    device = displayed(instant, DEVICE_TZ, l)
    event = displayed(instant, event_tz, l) if event_tz else None
    if mode == "device" or (mode == "event" and event is None):
        return device, None, False
    if mode == "event":
        return event, None, False
    if event is None or event == device:
        return (event or device), None, False
    return event, device, event["day"] != device["day"]


def fmt_points(v, l):
    if v is None:
        return None
    s = f"{v:g}" if isinstance(v, float) else str(v)
    return s.replace(".", ",") if l["lang"] == "es" else s


def fmt_elapsed(v):
    if v is None:
        return None
    h, rem = divmod(v, 3600000)
    m, rem = divmod(rem, 60000)
    s, milli = divmod(rem, 1000)
    tail = f"{s:02d}.{milli:03d}"
    return f"{h}:{m:02d}:{tail}" if h > 0 else f"{m}:{tail}"


def fmt_gap(v):
    if v is None:
        return None
    m, rem = divmod(v, 60000)
    s, milli = divmod(rem, 1000)
    return f"+{m}:{s:02d}.{milli:03d}" if m > 0 else f"+{s}.{milli:03d}"


def timing(e, l):  # GrandPrixResultSection._timing precedence
    t = fmt_elapsed(e["elapsed"])
    if t:
        return t
    t = fmt_gap(e["gap"])
    if t:
        return t
    n = e["laps_behind"]
    if n is not None and n > 0:
        return l["laps_one"] if n == 1 else l["laps_other"].format(n)
    return e["gap_text"]


def race_winner(doc):  # home_race_winner.dart: race only, exactly one P1, resolved name
    if doc["session"] != "race":
        return None
    p1 = [e for e in doc["entries"] if e["position"] == 1]
    if len(p1) != 1 or not p1[0]["driver"]:
        return None
    return p1[0]["driver_id"]


# --------------------------------------------------------------------------
# Icons (Lucide, ISC licence)
# --------------------------------------------------------------------------

SPRITE = """<svg width="0" height="0" class="sprite" aria-hidden="true" focusable="false">
  <symbol id="i-back" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></symbol>
  <symbol id="i-chevron" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
  <symbol id="i-flag" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></symbol>
  <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></symbol>
  <symbol id="i-event-x" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m14 14-4 4"/><path d="m10 14 4 4"/></symbol>
  <symbol id="i-cloud-off" viewBox="0 0 24 24"><path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/></symbol>
  <symbol id="i-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></symbol>
  <symbol id="i-ban" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></symbol>
  <symbol id="i-pause" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M10 15V9"/><path d="M14 15V9"/></symbol>
  <symbol id="i-timer" viewBox="0 0 24 24"><path d="M10 2h4"/><path d="m12 14 3-3"/><circle cx="12" cy="14" r="8"/></symbol>
</svg>"""


def icon(name, cls="icon"):
    return f'<svg class="{cls}" aria-hidden="true"><use href="#i-{name}"/></svg>'


# --------------------------------------------------------------------------
# Components
# --------------------------------------------------------------------------


def appbar(l, title):
    """GP01: back button + event name (single line, as Flutter's AppBar)."""
    return f"""<header class="dbar">
  <a class="icon-btn dbar__back" href="#back" aria-label="{esc(l['back'])}">{icon('back')}</a>
  <p class="dbar__title" title="{esc(title)}">{esc(title)}</p>
</header>"""


def notice(text, icon_name="cloud-off"):
    return f'<p class="notice" role="status">{icon(icon_name)}<span>{esc(text)}</span></p>'


EVENT_CHIP = {
    "upcoming": "chip--scheduled", "scheduled": "chip--scheduled", "completed": "chip--done",
    "live": "chip--live", "postponed": "chip--alert", "cancelled": "chip--alert", "unknown": "chip--unknown",
}
EVENT_ICON = {"completed": "check", "postponed": "pause", "cancelled": "ban"}


def chip(label, cls, icon_name=None):
    ic = icon(icon_name, "icon icon--sm") if icon_name else ""
    return f'<span class="chip {cls}">{ic}{esc(label)}</span>'


def location(gp):
    c = gp.get("circuit") or {}
    parts = [p for p in (c.get("locality"), c.get("country")) if p]
    return ", ".join(parts) if parts else None


def hero(l, gp):
    """GP02-GP09: identity header. Typographic; no image area (GP10)."""
    st = gp["status"]
    chips = chip(l["event_status"][st], EVENT_CHIP[st], EVENT_ICON.get(st)) + chip(
        l["format"][gp["format"]], "chip--context")
    official = gp.get("official")
    official_html = (f'\n      <p class="gp__official">{esc(official)}</p>'
                     if official and official != gp["name"] else "")
    facts = []
    dr = date_range(gp.get("start"), gp.get("end"), l)
    if dr:
        a, sep, b = dr.partition(" – ")
        val = (f'<span class="nw">{esc(a)}</span> – <span class="nw">{esc(b)}</span>' if sep
               else f'<span class="nw">{esc(dr)}</span>')
        facts.append(f'<div class="fact"><dt>{esc(l["dates"])}</dt><dd>{val}</dd></div>')
    loc = location(gp)
    if loc:
        facts.append(f'<div class="fact"><dt>{esc(l["location"])}</dt><dd>{esc(loc)}</dd></div>')
    facts_html = (f'\n  <dl class="gp__facts">\n    ' + "\n    ".join(facts) + "\n  </dl>") if facts else ""
    return f"""<section class="gp" aria-labelledby="gp-name">
  <div class="gp__chips chips">{chips}</div>
  <div class="gp__id">
    <p class="gp__round"><span class="gp__round-label">{esc(l['round'])}</span> <span class="gp__round-num num">{gp['round']}</span></p>
    <span class="gp__seam" aria-hidden="true"></span>
    <div class="gp__who">
      <p class="gp__season">{esc(l['season'].format(gp['season']))}</p>
      <h1 class="gp__name" id="gp-name">{esc(gp['name'])}</h1>{official_html}
    </div>
  </div>{facts_html}
</section>"""


def circuit_link(l, gp):
    """GP11 + GP17: one navigation row. Opens /circuits/:circuitId with the
    event's season as origin, even when the circuit name is unresolved."""
    name = (gp.get("circuit") or {}).get("name")
    label = f"{l['view_circuit']}, {name}" if name else l["view_circuit"]
    name_html = f'<span class="cx__name">{esc(name)}</span>' if name else ""
    return f"""<a class="cx" href="#circuits/{esc(gp['circuit_id'])}" aria-label="{esc(label)}">
  <span class="cx__text"><span class="cx__kicker">{esc(l['circuit'])}</span>{name_html}<span class="cx__action">{esc(l['view_circuit'])}</span></span>
  <span class="cx__disc">{icon('arrow')}</span>
</a>"""


def zones(l, gp):
    """GP12 (raw IANA id, only when present) + GP13 (always)."""
    rows = []
    if gp.get("tz"):
        rows.append(f'<div><dt>{esc(l["event_tz"])}</dt><dd>{esc(gp["tz"])}</dd></div>')
    rows.append(f'<div><dt>{esc(l["device_tz"])}</dt><dd>{esc(DEVICE_TZ)}</dd></div>')
    return '<dl class="zones">' + "".join(rows) + "</dl>"


SESSION_STATUS_CHIP = {"live": ("chip--live", None), "cancelled": ("chip--alert", "ban"),
                       "postponed": ("chip--alert", "pause")}


def session_name(l, s):
    if s.get("name"):
        return s["name"]
    if s["type"] == "unknown":
        return l["session_unknown"]
    return " ".join(w.capitalize() for w in s["type"].split("_"))


def session_row(l, s, shown):
    status = l["session_status"][s["status"]]
    if s["status"] in SESSION_STATUS_CHIP:
        cls, ic = SESSION_STATUS_CHIP[s["status"]]
        status_html = chip(status, f"{cls} chip--sm", ic)
    else:
        status_html = f'<span class="sess__state">{esc(status)}</span>'
    time_html = ""
    if shown:
        p, sec, crosses = shown
        t2 = ""
        if sec:
            day = f"{esc(sec['day'])} " if crosses else ""
            t2 = f'<span class="sess__t2">{day}<span class="num">{esc(sec["time"])}</span> {esc(sec["zone"])}</span>'
        time_html = (f'<span class="sess__t1"><span class="sess__hm num">{esc(p["time"])}</span> '
                     f'<span class="sess__zone">{esc(p["zone"])}</span></span>{t2}')
    return f"""<li class="sess">
          <p class="sess__time">{time_html}</p>
          <div class="sess__who"><p class="sess__name">{esc(session_name(l, s))}</p><p class="sess__status">{status_html}</p></div>
        </li>"""


def schedule(l, gp, mode, uid):
    """GP14 / S01-S05. Delivered order kept: consecutive sessions sharing a
    primary day label form one day group (run-length, never re-sorted)."""
    groups = []
    for s in gp["sessions"]:
        shown = present(s["start"], gp.get("tz"), mode, l)
        day = shown[0]["day"] if shown else None
        if groups and groups[-1][0] == day:
            groups[-1][1].append((s, shown))
        else:
            groups.append((day, [(s, shown)]))
    out = []
    for i, (day, items) in enumerate(groups):
        rows = "\n        ".join(session_row(l, s, sh) for s, sh in items)
        hid = f"{uid}-{mode}-d{i}"
        head = f'<h3 class="day__label" id="{hid}">{esc(day)}</h3>' if day else ""
        lab = f' aria-labelledby="{hid}"' if day else ""
        out.append(f"""<li class="day">
      {head}
      <ol class="sess-list"{lab}>
        {rows}
      </ol>
    </li>""")
    return f'<ol class="sched" data-mode="{mode}">\n    ' + "\n    ".join(out) + "\n  </ol>"


def empty_block(title, msg, icon_name, button=None, small=False):
    btn = f'\n    <button class="btn" type="button">{esc(button)}</button>' if button else ""
    cls = "empty empty--inline" if small else "empty"
    return f"""<div class="{cls}">
    {icon(icon_name)}
    <p class="empty__title">{esc(title)}</p>
    <p class="empty__msg">{esc(msg)}</p>{btn}
  </div>"""


def sessions_section(l, gp, uid, modes=("device", "event", "both")):
    if not gp["sessions"]:
        body = empty_block(l["no_sessions_title"], l["no_sessions_msg"], "clock", small=True)
    else:
        body = "\n  ".join(schedule(l, gp, m, uid) for m in modes)
    return f"""<section class="sec" aria-labelledby="{uid}-sessions">
  <h2 class="section-title sec__title" id="{uid}-sessions">{esc(l['sessions'])}</h2>
  {zones(l, gp)}
  {body}
</section>"""


RESULT_CHIP = {"final": ("chip--final", "check"), "provisional": ("chip--outline", None),
               "unavailable": ("chip--outline", None), "unknown": ("chip--unknown", None)}


def result_row(l, doc, e, winner_id):
    driver = e["driver"] or l["driver_unavail"]
    team = e["team"] or l["team_unavail"]
    status_label = l["finish"][e["status"]]
    pts = fmt_points(e["points"], l)
    t = timing(e, l)
    fastest = e["fastest"] or (doc["fastest_driver"] is not None and doc["fastest_driver"] == e["driver_id"])
    is_winner = winner_id is not None and e["driver_id"] == winner_id
    label = [str(e["position"])] if e["position"] is not None else []
    label += [driver, team, status_label]
    if pts is not None:
        label.append(f"{pts} {l['points_word']}")
    if t:
        label.append(t)
    if fastest:
        label.append(l["fastest"])
    if is_winner:
        label.append(l["winner"])
    team_label = l["open_team"].format(e["team"]) if e["team"] else l["open_team_unnamed"]
    val = []
    if pts is not None:
        num, _, unit = l["pts"].format(pts).partition(" ")
        val.append(f'<span class="cl__pts num">{esc(num)}<span class="cl__unit"> {esc(unit)}</span></span>')
    if t:
        val.append(f'<span class="cl__time num">{esc(t)}</span>')
    if e["status"] != "finished":
        val.append(chip(status_label, "chip--outline chip--sm"))
    if fastest:
        val.append(chip(l["fastest"], "chip--fastest chip--sm", "timer"))
    kicker = f'<span class="cl__kicker">{esc(l["winner"])}</span>' if is_winner else ""
    pos = str(e["position"]) if e["position"] is not None else "—"
    cls = "cl cl--winner" if is_winner else "cl"
    unresolved = " cl__name--fallback" if not e["driver"] else ""
    team_cls = " cl__team--fallback" if not e["team"] else ""
    return f"""<li class="{cls}">
      <a class="cl__hit" href="#drivers/{esc(e['driver_id'])}" aria-label="{esc(', '.join(label))}"></a>
      <span class="cl__pos num" aria-hidden="true">{pos}</span>
      <div class="cl__who">
        {kicker}<p class="cl__name{unresolved}" aria-hidden="true">{esc(driver)}</p>
        <a class="cl__team{team_cls}" href="#constructors/{esc(e['constructor_id'])}" aria-label="{esc(team_label)}">{team_text(team)}</a>
      </div>
      <div class="cl__val" aria-hidden="true">{''.join(val)}</div>
    </li>"""


def team_text(team: str) -> str:
    """Team name with the chevron bound to its last word, so the arrow never
    wraps onto a line of its own at large text."""
    head, _, last = team.rpartition(" ")
    lead = f"{esc(head)} " if head else ""
    return (f'<span>{lead}<span class="nw">{esc(last)}'
            f"{icon('chevron', 'icon cl__go')}</span></span>")


def classification(l, doc, uid, scoped_notice=None):
    """R01-R14. Delivered entry order; duplicates kept; absent values omitted."""
    title = l["race_results"] if doc["session"] == "race" else l["results"]
    cls, ic = RESULT_CHIP[doc["status"]]
    status = chip(l["result_status"][doc["status"]], cls, ic)
    winner = race_winner(doc)
    rows = "\n    ".join(result_row(l, doc, e, winner) for e in doc["entries"])
    note = f'\n  <div class="sec__notice">{notice(scoped_notice)}</div>' if scoped_notice else ""
    return f"""<section class="sec" aria-labelledby="{uid}-results">
  <div class="sec__head"><h2 class="section-title" id="{uid}-results">{esc(title)}</h2>{status}</div>{note}
  <ol class="cls" aria-labelledby="{uid}-results">
    {rows}
  </ol>
</section>"""


def results_area(l, state, uid, doc=None, scoped_notice=None, failure=None):
    """R15: the result area is independent of the weekend detail."""
    if state == "ready":
        return classification(l, doc, uid, scoped_notice)
    if state == "unavailable":
        body = empty_block(l["results_unavail_title"], l["results_pending"], "flag", small=True)
    elif state == "loading":
        body = (f'<div class="skel skel--rows" role="progressbar" aria-label="{esc(l["loading"])}">'
                '<span class="skel__row"></span><span class="skel__row"></span></div>')
    else:  # error
        body = empty_block(l["results_error_title"], failure or l["error_server"], "flag", l["retry"], small=True)
    return f"""<section class="sec" aria-labelledby="{uid}-results">
  <h2 class="section-title sec__title" id="{uid}-results">{esc(l['results'])}</h2>
  {body}
</section>"""


def detail_page_body(l, gp, uid, results_html, top_notice=None):
    note = f'\n<div class="page-notice">{notice(top_notice)}</div>' if top_notice else ""
    return f"""{note}
{hero(l, gp)}
{circuit_link(l, gp)}
{sessions_section(l, gp, uid)}
{results_html}"""


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
<link rel="stylesheet" href="gpd.css">{extra_css}
<script src="gpd.js"></script>
</head>
<body class="{body_cls}">
<!-- Generated by build.py - edit the generator, not this file. -->
"""


def page(lang, title, desc, body, body_cls="detail", extra_css=""):
    return HEAD.format(lang=lang, title=esc(title), desc=esc(desc), extra_css=extra_css,
                       body_cls=body_cls) + SPRITE + "\n\n" + body + "\n</body>\n</html>\n"


def main_page(lang, gp, results_html, scenario):
    l = L[lang]
    body = appbar(l, gp["name"]) + '\n<main class="page">' + detail_page_body(l, gp, "m", results_html) + "\n</main>"
    desc = (f"GridView Grand Prix Detail, Primer V2 visual prototype ({'English' if lang == 'en' else 'Spanish'}), "
            f"scenario {scenario}. Data copied from Flutter test fixtures; not real results.")
    return page(lang, f"GridView {gp['name']}", desc, body)


# --------------------------------------------------------------------------
# States gallery (development only)
# --------------------------------------------------------------------------

STATE_TEXT = {
    "en": {
        "flag": "Development fixtures. Not app UI, not race data",
        "title": "Grand Prix states",
        "note": "Each frame is copied from one Flutter test fixture and never merged with another. "
                "Captions are prototype annotations; everything inside a frame is app copy from the ARB files.",
        "links": [("index.html", "Scenario A: upcoming"), ("results.html", "Scenario B: results"),
                  ("index.html?time=event", "Event clock"), ("index.html?time=both", "Both clocks")],
    },
    "es": {
        "flag": "Fixtures de desarrollo. No es interfaz de la app ni datos de carreras",
        "title": "Estados del Gran Premio",
        "note": "Cada marco copia un único fixture de test de Flutter, sin mezclarlo con otros. "
                "Los rótulos son anotaciones del prototipo; el contenido de cada marco es texto de los ARB.",
        "links": [("index.es.html", "Escenario A: próximo"), ("results.es.html", "Escenario B: resultados"),
                  ("index.es.html?time=event", "Hora del evento"), ("index.es.html?time=both", "Ambas horas")],
    },
}

W = "test/screens/grand_prix_widget_test.dart"


def spec(n, title, src, inner):
    return f"""<section class="spec" aria-labelledby="spec-{n}">
  <div class="spec__cap"><h2 class="spec__title" id="spec-{n}">{n}. {esc(title)}</h2><p class="spec__src">{esc(src)}</p></div>
  <div class="spec__frame">
{inner}
  </div>
</section>"""


def detail_skeleton(l):
    return (f'<div class="skel" role="progressbar" aria-label="{esc(l["loading"])}">'
            '<span class="skel__hero"></span><span class="skel__label"></span>'
            '<span class="skel__row skel__row--48"></span><span class="skel__row skel__row--48"></span>'
            '<span class="skel__row skel__row--48"></span></div>')


def time_cell_only(l, instant, event_tz):
    shown = present(instant, event_tz, "both", l)
    s = {"name": None, "type": "unknown", "status": "unknown", "start": instant}
    row = session_row(l, s, shown)
    # Keep only the time cell: the presenter fixture has no session name or status.
    start = row.index('<p class="sess__time">')
    end = row.index("</p>", start) + 4
    return f'<div class="time-only"><p class="time-only__day">{esc(shown[0]["day"])}</p>{row[start:end]}</div>'


def states_page(lang):
    l = L[lang]
    t = STATE_TEXT[lang]
    gp_completed = belgian(status="completed")
    specs = []
    n = 0

    def add(title, src, inner):
        nonlocal n
        n += 1
        specs.append(spec(n, title, src, inner))

    add("Initial loading (detail skeleton; app bar shows the generic title)",
        "grand_prix_detail_screen.dart: _DetailSkeleton",
        appbar(l, l["gp_title"]) + "\n" + detail_skeleton(l))
    add("Confirmed not found", "grand_prix_detail_screen.dart: GrandPrixNotFound",
        appbar(l, l["gp_title"]) + "\n" + empty_block(l["gp_not_found_title"], l["gp_not_found_msg"], "event-x", l["go_home"]))
    add("First-load failure, no saved detail (serverUnavailable message shown as an example)",
        "grand_prix_detail_screen.dart: GrandPrixFirstLoadError",
        appbar(l, l["gp_title"]) + "\n" + empty_block(l["gp_error_title"], l["error_server"], "alert", l["retry"]))
    add("Stale detail: one screen-level notice, saved weekend kept",
        f"{W}: 'a stale detail shows a cached-data notice with its content'",
        f'<div class="page-notice">{notice(l["stale"])}</div>\n' + hero(l, belgian()))
    add("Detail refresh failed: failure wording wins, saved weekend kept",
        f"{W}: 'a detail failure keeps the cached weekend visible'",
        f'<div class="page-notice">{notice(l["refresh_failed"])}</div>\n' + hero(l, belgian()))
    gp_missing = belgian(circuit={"id": "spa-francorchamps", "name": "Spa"}, tz=None)
    add("Missing locality, country and event time zone simply vanish",
        f"{W}: 'a missing locality, country and timezone simply vanish'",
        hero(l, gp_missing) + "\n" + circuit_link(l, gp_missing) + "\n" + sessions_section(l, gp_missing, f"s{n + 1}", ("device",)))
    add("Unresolved circuit name: navigation stays available (GP17)",
        "grand_prix_event_info.dart: route uses circuitId when the name is unresolved",
        circuit_link(l, belgian(circuit=None)))
    add("Unknown event status and unknown format", f"{W}: 'an unknown event status still reads as a label'",
        hero(l, belgian(status="unknown", format="unknown")))
    unusual = belgian(sessions=[
        sess("s-unknown", None, utc(2026, 7, 24, 9), "unknown", "unknown"),
        sess("s-cancelled", "Practice 2", utc(2026, 7, 24, 14), "cancelled", "practice_2"),
        sess("s-postponed", "Qualifying", utc(2026, 7, 25, 14), "postponed", "qualifying"),
    ])
    add("Unknown, cancelled and postponed sessions stay visible",
        f"{W}: 'unknown, cancelled and postponed sessions stay visible'",
        sessions_section(l, unusual, f"s{n + 1}", ("device",)))
    add("Session without a start time shows no time at all",
        f"{W}: 'a session without a start time shows no time at all'",
        sessions_section(l, belgian(sessions=[sess("s-tbd", "Race", None, "scheduled")]), f"s{n + 1}", ("device",)))
    add("Weekend with no sessions", f"{W}: 'a weekend with no sessions shows a controlled empty state'",
        sessions_section(l, belgian(sessions=[]), f"s{n + 1}"))
    add("Time preference: Event clock (Europe/Brussels)",
        "Scenario A fixture; lib/core/time/session_time.dart (event mode)",
        sessions_section(l, GP_A, f"s{n + 1}", ("event",)))
    add("Time preference: Both clocks, event first, device second",
        "Scenario A fixture; session_time.dart (both mode, same day: no second date)",
        sessions_section(l, GP_A, f"s{n + 1}", ("both",)))
    add("Both clocks crossing a calendar day (time cell only)",
        "test/time/session_time_test.dart: 'a conversion that crosses midnight keeps both days visible' "
        "(presenter fixture: no session name or status exists, so only the time cell is shown)",
        time_cell_only(l, utc(2026, 7, 26, 23), "Asia/Tokyo"))
    add("Results loading (no saved classification)", "grand_prix_detail_screen.dart: GrandPrixResultsLoading",
        results_area(l, "loading", f"s{n + 1}"))
    add("Results not available yet (upcoming event)", f"{W}: 'an upcoming event shows a results-pending state, no error'",
        results_area(l, "unavailable", f"s{n + 1}"))
    add("Results failure with no saved classification, scoped to its section",
        f"{W}: 'a result failure with no cache is scoped to its section' (serverUnavailable)",
        results_area(l, "error", f"s{n + 1}"))
    add("Results refresh failed with a saved classification: scoped notice, rows kept",
        f"{W}: 'a result failure with cache keeps the classification' (_race())",
        results_area(l, "ready", f"s{n + 1}", widget_race(), scoped_notice=l["refresh_failed"]))
    add("Remote build, stale detail and stale results: one notice at the top, result section adds none",
        "grand_prix_detail_screen.dart: remoteFreshnessNoticesProvider (_detail(completed) + _race())",
        f'<div class="page-notice">{notice(l["stale"])}</div>\n' + hero(l, gp_completed) + "\n"
        + results_area(l, "ready", f"s{n + 1}", widget_race()))
    add("Provisional classification", f"{W}: 'a provisional classification says so'",
        results_area(l, "ready", f"s{n + 1}", widget_race(status="provisional")))
    add("Fastest lap marked without hiding anything else", f"{W}: 'a fastest lap is marked without hiding anything else'",
        results_area(l, "ready", f"s{n + 1}", widget_race(fastest_driver="oscar-piastri")))
    add("Lapped, DNF, DNS, DSQ, DNQ, unknown finish: text, no false zero, no points invented",
        f"{W}: 'DNF, DNS, DSQ, DNQ and lapped finishes all read as text'",
        results_area(l, "ready", f"s{n + 1}", widget_race(entries=FINISH_ENTRIES)))
    add("Duplicate displayed positions render as delivered (team names unresolved in the fixture)",
        f"{W}: 'duplicate displayed positions render as delivered'",
        results_area(l, "ready", f"s{n + 1}", widget_race(entries=DUPLICATE_ENTRIES)))
    add("Unresolved driver and team names: localized fallbacks, ids keep navigating, no winner claimed",
        f"{W}: 'both names unresolved stays readable and accessible'",
        results_area(l, "ready", f"s{n + 1}", widget_race(entries=UNRESOLVED_ENTRIES)))
    chips_html = "".join(chip(l["result_status"][k], RESULT_CHIP[k][0], RESULT_CHIP[k][1])
                         for k in ("final", "provisional", "unavailable", "unknown"))
    add("Classification status vocabulary (R02), chips only", "domain_status.dart: resultStatusLabel (ARB copy)",
        f'<div class="chip-row chips">{chips_html}</div>')
    add("Fixture builds only: sample-data banner above the content",
        "mock_data_banner.dart (usesMockDataProvider)",
        f'<div class="page-notice"><p class="banner">{esc(l["mock_banner"])}</p></div>')

    links = "".join(f'<a href="{h}">{esc(x)}</a>' for h, x in t["links"])
    body = f"""<header class="dev-head">
  <p class="dev-head__flag">{esc(t['flag'])}</p>
  <h1 class="dev-head__title">{esc(t['title'])}</h1>
  <p class="dev-head__note">{esc(t['note'])}</p>
  <nav class="dev-head__links" aria-label="Prototype pages">{links}</nav>
</header>

<main class="specs">
{chr(10).join(specs)}
</main>"""
    desc = "Development-only state fixtures for the GridView Grand Prix Detail prototype."
    return page(lang, f"GridView {t['title']}", desc, body, body_cls="detail states",
                extra_css='\n<link rel="stylesheet" href="states.css">')


def build():
    for lang, suffix in (("en", ""), ("es", ".es")):
        l = L[lang]
        a_results = results_area(l, "unavailable", "m")
        (OUT / f"index{suffix}.html").write_text(main_page(lang, GP_A, a_results, "A (upcoming)"), encoding="utf-8")
        b_results = results_area(l, "ready", "m", RESULTS_B)
        (OUT / f"results{suffix}.html").write_text(main_page(lang, GP_B, b_results, "B (results)"), encoding="utf-8")
        (OUT / f"states{suffix}.html").write_text(states_page(lang), encoding="utf-8")
    print("wrote", ", ".join(sorted(p.name for p in OUT.glob("*.html"))))


if __name__ == "__main__":
    build()
