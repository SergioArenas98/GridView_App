"""Settings CONSOLIDATION PILOT: root and preference pages (Python 3 stdlib only).

    python build.py           write the pilot pages into this folder
    python build.py --check   only verify that the approved generator still
                              reproduces the approved pages (and strings.js)
                              byte for byte, and that the local script copies
                              are identical to the approved ones

The approved generator ../../settings/build.py is imported read-only: its
main() is not called and it writes nothing. Each pilot page is that
generator's own output (same functions, ARB strings, scenarios and markup)
with one change: the head's primer-core.css link becomes the shared-foundation
links (../../shared/). settings.css, settings.js and strings.js are local,
same file names, so their links are unchanged.

Root (index, production-no-contact, non-production) and preference pages
(language, theme, time) stay in ONE folder, as approved: settings.js builds
their links as same-folder file names (`index{sfx}.html`, `{page}{sfx}.html`),
so splitting them into two folders would need a JavaScript change. The
subgroups are separated in the regression configs and reports instead
(../tools/settings-root.config.mjs, settings-preferences.config.mjs).

The information screens are the sibling pilot ./information/ (own build.py).
"""

from __future__ import annotations

import importlib.util
import shutil
import sys

sys.dont_write_bytecode = True        # importing the approved generator must leave nothing behind
from pathlib import Path

HERE = Path(__file__).resolve().parent
APPROVED = HERE.parent.parent / "settings"
_spec = importlib.util.spec_from_file_location("settings_approved", APPROVED / "build.py")
gen = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = gen
_spec.loader.exec_module(gen)          # read-only: main() is not called

# Only the core files whose rules Settings uses (tokens, reset/type/focus/utilities/icons/[hidden],
# and .icon-btn for the back action), in the core's order. No detail-app-bar.css: Settings' bar is
# a variant (wraps, 21px, uncapped, chrome strip) and stays in settings.css.
SHARED = ["tokens.css", "base.css", "components/app-bar.css"]
CORE_LINK = '<link rel="stylesheet" href="primer-core.css">'
COPIES = ("settings.js",)              # copied verbatim; strings.js is regenerated and compared


def shared_links(prefix: str, files: list[str]) -> str:
    return ('<!-- Consolidation pilot: shared foundation in ../../shared/ (see ../../shared/README.md). -->\n'
            + "\n".join(f'<link rel="stylesheet" href="{prefix}shared/{f}">' for f in files))


def swap(html: str, old: str, new: str) -> str:
    assert html.count(old) == 1, (old, html.count(old))
    return html.replace(old, new)


def to_pilot(html: str) -> str:
    return swap(html, CORE_LINK, shared_links("../../", SHARED))


def pages() -> list[tuple[str, str]]:
    """(file name, approved generator output) for every page main() writes, in its order."""
    out = []
    for lang in ("en", "es"):
        sfx = ".es" if lang == "es" else ""
        out += [(f"{stem}{sfx}.html", gen.root_page(lang, stem)) for stem in gen.ROOTS]
        out += [(f"{gen.PREFS[p]['page']}{sfx}.html", gen.choice_page(lang, p)) for p in gen.PREFS]
        out.append((f"states{sfx}.html", gen.states_page(lang)))
    return out


def main() -> None:
    check_only = "--check" in sys.argv
    built = pages()
    for name, generated in built:
        same = (APPROVED / name).read_text(encoding="utf-8").replace("\r\n", "\n") == generated
        print(f"{'ok ' if same else 'DIFF'} approved generator reproduces settings/{name}")
        assert same, f"approved generator no longer reproduces {name}"
    strings = gen.strings_js()
    assert (APPROVED / "strings.js").read_text(encoding="utf-8").replace("\r\n", "\n") == strings, "strings.js"
    print("ok  approved generator reproduces settings/strings.js")
    if check_only:
        for f in COPIES + ("strings.js",):
            same = (HERE / f).exists() and (HERE / f).read_bytes() == (APPROVED / f).read_bytes()
            print(f"{'ok ' if same else 'DIFF'} local {f} identical to settings/{f}")
            assert same, f
        return
    for name, generated in built:
        (HERE / name).write_text(to_pilot(generated), encoding="utf-8", newline="\n")
    (HERE / "strings.js").write_text(strings, encoding="utf-8", newline="\n")
    for f in COPIES:
        shutil.copyfile(APPROVED / f, HERE / f)
    print(f"wrote {len(built)} pages + strings.js + {', '.join(COPIES)}")


if __name__ == "__main__":
    main()
