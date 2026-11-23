"""Settings CONSOLIDATION PILOT: information screens (Python 3 stdlib only).

    python build.py           write the pilot pages into this folder
    python build.py --check   only verify that the approved generator still
                              reproduces the approved pages byte for byte, and
                              that the local information.js is identical

The approved generator ../../../settings/information/build.py is imported
read-only: its main() is not called and it writes nothing. It reads the ARB
files and content/attribution/data-sources.json itself, so the attribution
record comes from the repository source, never retyped. Each pilot page is
that generator's own output with one change: the head's ../primer-core.css
link becomes the shared-foundation links (../../../shared/), including the
shared notice, whose reading-width variant stays in the local
information.css. ../settings.css (the root pilot's copy) and the local
information.css / information.js keep their links. The back links
(../index.html, ../non-production.html) resolve to the root pilot, as the
approved pages resolve to the approved root.
"""

from __future__ import annotations

import importlib.util
import shutil
import sys

sys.dont_write_bytecode = True        # importing the approved generator must leave nothing behind
from pathlib import Path

HERE = Path(__file__).resolve().parent
APPROVED = HERE.parent.parent.parent / "settings" / "information"
_spec = importlib.util.spec_from_file_location("settings_information_approved", APPROVED / "build.py")
gen = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = gen          # its frozen dataclasses resolve their module through sys.modules
_spec.loader.exec_module(gen)          # read-only: main() is not called

SHARED = ["tokens.css", "base.css", "components/app-bar.css", "components/notice.css"]
CORE_LINK = '<link rel="stylesheet" href="../primer-core.css">'
COPIES = ("information.js",)


def shared_links(prefix: str) -> str:
    return ('<!-- Consolidation pilot: shared foundation in ../../../shared/ (see ../../../shared/README.md). -->\n'
            + "\n".join(f'<link rel="stylesheet" href="{prefix}shared/{f}">' for f in SHARED))


def swap(html: str, old: str, new: str) -> str:
    assert html.count(old) == 1, (old, html.count(old))
    return html.replace(old, new)


def to_pilot(html: str) -> str:
    return swap(html, CORE_LINK, shared_links("../../../"))


def pages() -> list[tuple[str, str]]:
    out = []
    for lang in gen.LANGS:
        sfx = ".es" if lang == "es" else ""
        out += [(f"{pg.stem}{sfx}.html", gen.page_html(lang, pg)) for pg in gen.PAGES]
        out.append((f"states{sfx}.html", gen.states_page(lang)))
    return out


def main() -> None:
    check_only = "--check" in sys.argv
    built = pages()
    for name, generated in built:
        same = (APPROVED / name).read_text(encoding="utf-8").replace("\r\n", "\n") == generated
        print(f"{'ok ' if same else 'DIFF'} approved generator reproduces settings/information/{name}")
        assert same, f"approved generator no longer reproduces {name}"
    if check_only:
        for f in COPIES:
            same = (HERE / f).exists() and (HERE / f).read_bytes() == (APPROVED / f).read_bytes()
            print(f"{'ok ' if same else 'DIFF'} local {f} identical to settings/information/{f}")
            assert same, f
        return
    for name, generated in built:
        (HERE / name).write_text(to_pilot(generated), encoding="utf-8", newline="\n")
    for f in COPIES:
        shutil.copyfile(APPROVED / f, HERE / f)
    print(f"wrote {len(built)} pages + {', '.join(COPIES)}")


if __name__ == "__main__":
    main()
