"""Explore CONSOLIDATION PILOT pages (Python 3 stdlib only).

    python build.py           write the pilot pages into this folder
    python build.py --check   only verify that the approved generators still
                              reproduce the approved pages byte for byte

The approved sources are imported read-only and never written:
- ../../explore/comparison-missing-media/build.py (Alternative B, the approved
  visual reference, and the missing-media gallery), which itself imports
- ../../explore/build.py (the baseline generator: fixtures, rows, copy, labels,
  and the state-fixture gallery: refresh, failure, empty, error, loading).

Each page is the approved generator's own output with only the asset and
link paths rewritten for this folder: the shared foundation (../../shared/)
replaces primer-core.css and nav-inset.js, the screen files are local copies,
and the two gallery "back" links point to the same approved pages as before.
Markup, data, strings, labels and order are therefore Alternative B's (and
the galleries') by construction.
"""

from __future__ import annotations

import importlib.util
import sys

sys.dont_write_bytecode = True        # importing the approved generators must leave nothing behind
from pathlib import Path

HERE = Path(__file__).resolve().parent
APPROVED = HERE.parent.parent / "explore"
_spec = importlib.util.spec_from_file_location("explore_comparison", APPROVED / "comparison-missing-media" / "build.py")
cmp = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = cmp
_spec.loader.exec_module(cmp)          # read-only: main() is not called
base = cmp.base                        # ../../explore/build.py, loaded by the comparison generator

SHARED = [
    "tokens.css", "base.css", "components/app-bar.css", "components/chip.css", "components/nav.css",
    "components/notice.css", "components/selector.css", "components/empty-state.css",
]
SHARED_LINKS = ('<!-- Consolidation pilot: shared foundation in ../../shared/ (see ../../shared/README.md). -->\n'
                + "\n".join(f'<link rel="stylesheet" href="../../shared/{f}">' for f in SHARED))


def swap(html: str, old: str, new: str) -> str:
    assert html.count(old) == 1, (old, html.count(old))
    return html.replace(old, new)


def pilot_cue(html: str) -> str:
    """Alternative B page (approved at explore/comparison-missing-media/, same folder depth here)."""
    html = swap(html, '<link rel="stylesheet" href="../primer-core.css">', SHARED_LINKS)
    html = swap(html, '<link rel="stylesheet" href="../explore.css">', '<link rel="stylesheet" href="explore.css">')
    html = swap(html, '<script src="../nav-inset.js" defer></script>', '<script src="../../shared/nav-inset.js" defer></script>')
    # Step 48B: the title fit moved verbatim to ../../shared/title-fit.js; it loads before explore.js.
    return swap(html, '<script src="../explore.js" defer></script>',
                '<script src="../../shared/title-fit.js" defer></script>\n<script src="explore.js" defer></script>')


def pilot_media_states(html: str) -> str:
    """Missing-media gallery (approved at explore/comparison-missing-media/)."""
    html = swap(html, '<link rel="stylesheet" href="../primer-core.css">', SHARED_LINKS)
    html = swap(html, '<link rel="stylesheet" href="../explore.css">', '<link rel="stylesheet" href="explore.css">')
    html = swap(html, '<link rel="stylesheet" href="../states.css">', '<link rel="stylesheet" href="states.css">')
    # "Back to Alternative A": Alternative A is not part of the pilot; keep the same target.
    old = '<a href="index.html">' if 'href="index.html"' in html else '<a href="index.es.html">'
    return swap(html, old, old.replace('href="', 'href="../../explore/comparison-missing-media/'))


def pilot_states(html: str) -> str:
    """Baseline state-fixture gallery (approved at explore/, one level up)."""
    html = swap(html, '<link rel="stylesheet" href="primer-core.css">', SHARED_LINKS)
    old = '<a href="index.html">' if 'href="index.html"' in html else '<a href="index.es.html">'
    return swap(html, old, old.replace('href="', 'href="../../explore/'))


def pages() -> list[tuple[str, Path, str, callable]]:
    out = []
    for lang, t in base.L10N.items():
        sfx = "" if lang == "en" else ".es"
        out.append((f"cue{sfx}.html", APPROVED / "comparison-missing-media" / f"cue{sfx}.html", cmp.variant_page(t, "b"), pilot_cue))
        out.append((f"media-states{sfx}.html", APPROVED / "comparison-missing-media" / f"media-states{sfx}.html", cmp.states_page(t, lang), pilot_media_states))
        out.append((f"states{sfx}.html", APPROVED / f"states{sfx}.html", base.states_page(t), pilot_states))
    return out


def main() -> None:
    check_only = "--check" in sys.argv
    for name, approved, generated, to_pilot in pages():
        same = approved.read_text(encoding="utf-8").replace("\r\n", "\n") == generated
        print(f"{'ok ' if same else 'DIFF'} approved generator reproduces {approved.relative_to(APPROVED.parent)}")
        assert same, f"approved generator no longer reproduces {approved}"
        if not check_only:
            (HERE / name).write_text(to_pilot(generated), encoding="utf-8", newline="\n")
    if not check_only:
        print("wrote", ", ".join(n for n, *_ in pages()))


if __name__ == "__main__":
    main()
