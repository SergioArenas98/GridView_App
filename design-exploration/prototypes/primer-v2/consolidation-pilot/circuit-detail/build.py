"""Circuit Detail CONSOLIDATION PILOT pages (Python 3 stdlib only).

    python build.py           write the pilot pages into this folder
    python build.py --check   only verify that the approved generator still
                              reproduces the approved pages byte for byte

The approved generator ../../circuit-detail/build.py is imported read-only:
its main() is not called and it writes nothing. Each pilot page is that
generator's own output (same functions, fixtures, copy and markup) with one
change: the head's primer-core.css link becomes the shared-foundation links
(../../shared/). cd.css and states.css are local, same file names, so their
links are unchanged. Every in-page link is a hash route (#back,
#calendar/<season>/<round>) or a sibling page
(index / partial / no-event / states), so it resolves exactly as in the approved folder.
"""

from __future__ import annotations

import importlib.util
import sys

sys.dont_write_bytecode = True        # importing the approved generator must leave nothing behind
from pathlib import Path

HERE = Path(__file__).resolve().parent
APPROVED = HERE.parent.parent / "circuit-detail"
_spec = importlib.util.spec_from_file_location("circuit_detail_approved", APPROVED / "build.py")
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)          # read-only: main() is not called

# Order keeps the core's cascade (tokens, base, app bar, section title, chips),
# then the shared components, then the screen stylesheet. Only what the pages use.
SHARED = [
    "tokens.css", "base.css", "components/app-bar.css", "components/detail-app-bar.css",
    "components/section-title.css", "components/chip.css", "components/notice.css",
    "components/empty-state.css", "components/empty-state-detail.css", "components/detail-page.css",
]
SHARED_LINKS = ('<!-- Consolidation pilot: shared foundation in ../../shared/ (see ../../shared/README.md). -->\n'
                + "\n".join(f'<link rel="stylesheet" href="../../shared/{f}">' for f in SHARED))
CORE_LINK = '<link rel="stylesheet" href="primer-core.css">'


def to_pilot(html: str) -> str:
    assert html.count(CORE_LINK) == 1, html.count(CORE_LINK)
    return html.replace(CORE_LINK, SHARED_LINKS)


def pages() -> list[tuple[str, str]]:
    """(file name, approved generator output) for every page build() writes."""
    out = []
    for lang, sfx in (("en", ""), ("es", ".es")):
        l = gen.L[lang]
        out.append((f"index{sfx}.html", gen.main_page(lang, gen.PROFILE_A, "A (complete)")))
        out.append((f"partial{sfx}.html", gen.main_page(lang, gen.PROFILE_B, "B (partial)", top_notice=l["partial"])))
        out.append((f"no-event{sfx}.html", gen.main_page(lang, gen.PROFILE_C, "C (no related Grand Prix)")))
        out.append((f"states{sfx}.html", gen.states_page(lang)))
    return out


def main() -> None:
    check_only = "--check" in sys.argv
    built: list[tuple[str, str]] = pages()
    for name, generated in built:
        approved = (APPROVED / name).read_text(encoding="utf-8").replace("\r\n", "\n")
        same = approved == generated
        print(f"{'ok ' if same else 'DIFF'} approved generator reproduces circuit-detail/{name}")
        assert same, f"approved generator no longer reproduces {name}"
        if not check_only:
            (HERE / name).write_text(to_pilot(generated), encoding="utf-8", newline="\n")
    if not check_only:
        print("wrote", ", ".join(n for n, _ in built))


if __name__ == "__main__":
    main()
