"""Grand Prix Detail CONSOLIDATION PILOT pages (Python 3 stdlib only).

    python build.py           write the pilot pages into this folder
    python build.py --check   only verify that the approved generator still
                              reproduces the approved pages byte for byte

The approved generator ../../grand-prix-detail/build.py is imported
read-only: its build() is not called and it writes nothing. Each pilot page
is that generator's own output (same functions, fixtures, copy and markup)
with one change: the head's primer-core.css link becomes the
shared-foundation links (../../shared/). gpd.css, gpd.js and states.css are
local, same file names, so their links are unchanged. Every in-page link is
a hash route (#back, #circuits/<id>, #drivers/<id>, #constructors/<id>) or a
sibling page (index / results / states, with ?time=event|both).

DEVELOPMENT-ONLY TITLE STRESS TEST (stress-title/). No approved fixture has
an event name long enough to truncate the app-bar title at any tested size
(see REPORT.md). stress-title/ holds one gallery page per language, written
twice from the SAME markup and under the SAME file name, so in-page hash
links resolve identically: baseline/title[.es].html links the approved assets
(../../../../grand-prix-detail/: primer-core.css, gpd.css, states.css,
gpd.js), title[.es].html links the pilot's. Each frame renders the approved
appbar() and hero() with Scenario A's fixture and ONE substitution: the event
name, replaced by an existing 2026 event name from
content/registries/events.development.json ("Barcelona-Catalunya Grand
Prix", the longest; "United States Grand Prix"), and the official name
removed so it cannot be mistaken for that event's. It is not a fixture, not
race data and not a design proposal; it exists only to compare truncation in
both versions.
"""

from __future__ import annotations

import importlib.util
import sys

sys.dont_write_bytecode = True        # importing the approved generator must leave nothing behind
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
APPROVED = HERE.parent.parent / "grand-prix-detail"
_spec = importlib.util.spec_from_file_location("grand_prix_detail_approved", APPROVED / "build.py")
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)          # read-only: build() is not called

# Same shared files, in the same order, as the Driver, Team and Circuit pilots.
SHARED = [
    "tokens.css", "base.css", "components/app-bar.css", "components/detail-app-bar.css",
    "components/section-title.css", "components/chip.css", "components/notice.css",
    "components/empty-state.css", "components/empty-state-detail.css", "components/detail-page.css",
]
CORE_LINK = '<link rel="stylesheet" href="primer-core.css">'


def shared_links(prefix: str) -> str:
    return ('<!-- Consolidation pilot: shared foundation in ../../shared/ (see ../../shared/README.md). -->\n'
            + "\n".join(f'<link rel="stylesheet" href="{prefix}shared/{f}">' for f in SHARED))


def swap(html: str, old: str, new: str) -> str:
    assert html.count(old) == 1, (old, html.count(old))
    return html.replace(old, new)


def to_pilot(html: str) -> str:
    return swap(html, CORE_LINK, shared_links("../../"))


def pages() -> list[tuple[str, str]]:
    """(file name, approved generator output) for every page build() writes."""
    out = []
    for lang, sfx in (("en", ""), ("es", ".es")):
        l = gen.L[lang]
        out.append((f"index{sfx}.html", gen.main_page(lang, gen.GP_A, gen.results_area(l, "unavailable", "m"), "A (upcoming)")))
        out.append((f"results{sfx}.html", gen.main_page(lang, gen.GP_B, gen.results_area(l, "ready", "m", gen.RESULTS_B), "B (results)")))
        out.append((f"states{sfx}.html", gen.states_page(lang)))
    return out


# ---------------------------------------------------------------- stress test
LONG_NAMES = ("Barcelona-Catalunya Grand Prix", "United States Grand Prix")   # content/registries/events.development.json
STRESS_TEXT = {
    "en": {
        "flag": "Development-only stress test. Not app UI, not a fixture, not race data, not a design proposal",
        "title": "Long app-bar titles",
        "note": "No approved fixture has an event name long enough to truncate the app-bar title. Each frame renders "
                "Scenario A with one substitution: the event name, replaced by an existing 2026 event name from the "
                "project's event registry (source in each caption); the official name is removed. Every other value "
                "is Scenario A's fixture value and does not describe that event.",
        "frame": "App bar and identity band with the event name “{}” ({} characters)",
        "src": "grand-prix-detail/build.py appbar() + hero(), GP_A with the name from "
               "content/registries/events.development.json and no official name",
    },
    "es": {
        "flag": "Prueba de esfuerzo solo de desarrollo. No es interfaz de la app, ni un fixture, ni datos de carreras, ni una propuesta de diseño",
        "title": "Títulos largos en la barra",
        "note": "Ningún fixture aprobado tiene un nombre de evento lo bastante largo para recortar el título de la barra. "
                "Cada marco muestra el escenario A con una sola sustitución: el nombre del evento, sustituido por un nombre "
                "de evento de 2026 que ya existe en el registro de eventos del proyecto (fuente en cada rótulo); se quita el "
                "nombre oficial. Los demás valores son los del fixture del escenario A y no describen ese evento.",
        "frame": "Barra y banda de identidad con el nombre de evento “{}” ({} caracteres)",
        "src": "grand-prix-detail/build.py appbar() + hero(), GP_A con el nombre de "
               "content/registries/events.development.json y sin nombre oficial",
    },
}


def stress_page(lang: str) -> str:
    l, t = gen.L[lang], STRESS_TEXT[lang]
    frames = []
    for n, name in enumerate(LONG_NAMES, 1):
        gp = dict(gen.GP_A, name=name, official=None)          # a copy; GP_A itself is not modified
        frames.append(gen.spec(n, t["frame"].format(name, len(name)), t["src"],
                               gen.appbar(l, gp["name"]) + '\n<main class="page">\n' + gen.hero(l, gp) + "\n</main>"))
    body = f"""<header class="dev-head">
  <p class="dev-head__flag">{escape(t['flag'])}</p>
  <h1 class="dev-head__title">{escape(t['title'])}</h1>
  <p class="dev-head__note">{escape(t['note'])}</p>
</header>

<main class="specs">
{chr(10).join(frames)}
</main>"""
    return gen.page(lang, f"GridView {t['title']}", "Development-only title stress test for the Grand Prix Detail consolidation pilot.",
                    body, body_cls="detail states", extra_css='\n<link rel="stylesheet" href="states.css">')


def stress_variants(html: str) -> tuple[str, str]:
    """(baseline, pilot) heads for the same stress markup: stress-title/baseline/ and stress-title/."""
    base = html
    for f in ("primer-core.css", "gpd.css", "states.css"):
        base = swap(base, f'<link rel="stylesheet" href="{f}">', f'<link rel="stylesheet" href="../../../../grand-prix-detail/{f}">')
    base = swap(base, '<script src="gpd.js"></script>', '<script src="../../../../grand-prix-detail/gpd.js"></script>')
    pilot = swap(html, CORE_LINK, shared_links("../../../"))
    for f in ("gpd.css", "states.css"):
        pilot = swap(pilot, f'<link rel="stylesheet" href="{f}">', f'<link rel="stylesheet" href="../{f}">')
    pilot = swap(pilot, '<script src="gpd.js"></script>', '<script src="../gpd.js"></script>')
    return base, pilot


def main() -> None:
    check_only = "--check" in sys.argv
    built = pages()
    for name, generated in built:
        approved = (APPROVED / name).read_text(encoding="utf-8").replace("\r\n", "\n")
        same = approved == generated
        print(f"{'ok ' if same else 'DIFF'} approved generator reproduces grand-prix-detail/{name}")
        assert same, f"approved generator no longer reproduces {name}"
        if not check_only:
            (HERE / name).write_text(to_pilot(generated), encoding="utf-8", newline="\n")
    if check_only:
        return
    stress_dir = HERE / "stress-title"
    (stress_dir / "baseline").mkdir(parents=True, exist_ok=True)
    for lang, sfx in (("en", ""), ("es", ".es")):
        base, pilot = stress_variants(stress_page(lang))
        (stress_dir / "baseline" / f"title{sfx}.html").write_text(base, encoding="utf-8", newline="\n")
        (stress_dir / f"title{sfx}.html").write_text(pilot, encoding="utf-8", newline="\n")
    print("wrote", ", ".join(n for n, _ in built), "+ stress-title/[baseline/]title[.es].html")


if __name__ == "__main__":
    main()
