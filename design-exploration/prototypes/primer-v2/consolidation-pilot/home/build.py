"""Home consolidation pilot: write index.html / index.es.html from the approved
Home (../../refinement-01/, read only) with only the stylesheet and script
links changed, and verify the CSS ownership split.

    python build.py           write the two pages
    python build.py --check   verify pages and home.css without writing

Home has no generator: its two pages are hand-written. This script copies
them and swaps one link block; it never edits the approved files.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
APPROVED = HERE.parent.parent / "refinement-01"
SHARED_DIR = HERE.parent.parent / "shared"
PAGES = ["index.html", "index.es.html"]

# Shared files in the core's cascade order (shared/README.md, "Load order").
SHARED = [
    "tokens.css",
    "base.css",
    "components/app-bar.css",
    "components/section-title.css",
    "components/chip.css",
    "components/tag.css",
    "components/text-link.css",
    "components/nav.css",
]

APPROVED_LINKS = (
    '<link rel="stylesheet" href="styles.css">\n'
    '<script src="nav-inset.js" defer></script>\n'
)
PILOT_LINKS = (
    "<!-- Consolidation pilot: same markup as ../../refinement-01/; only the\n"
    "     stylesheet and script links differ (shared foundation in ../../shared/). -->\n"
    + "".join(f'<link rel="stylesheet" href="../../shared/{f}">\n' for f in SHARED)
    + '<link rel="stylesheet" href="home.css">\n'
    '<script src="../../shared/nav-inset.js" defer></script>\n'
)


def pilot_page(name: str) -> str:
    src = (APPROVED / name).read_text(encoding="utf-8")
    if src.count(APPROVED_LINKS) != 1:
        raise SystemExit(f"{name}: approved link block not found exactly once")
    return src.replace(APPROVED_LINKS, PILOT_LINKS)


def rules(css: str) -> list[str]:
    """Top-level rules, comments removed, whitespace normalised."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out, depth, start = [], 0, 0
    for i, ch in enumerate(css):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                out.append(" ".join(css[start : i + 1].split()))
                start = i + 1
    return out


def check_css() -> list[str]:
    problems = []
    approved = rules((APPROVED / "styles.css").read_text(encoding="utf-8"))
    shared = [r for f in SHARED for r in rules((SHARED_DIR / f).read_text(encoding="utf-8"))]
    local = rules((HERE / "home.css").read_text(encoding="utf-8"))
    extra = [r for r in shared if r not in approved]
    if extra != ["[hidden] { display: none !important; }"]:
        problems.append(f"shared rules not in the approved Home: {extra}")
    expected_local = [r for r in approved if r not in shared]
    if local != expected_local:
        problems.append("home.css is not the approved stylesheet minus the shared rules, in order")
    if sorted(local + [r for r in shared if r in approved]) != sorted(approved):
        problems.append("home.css + shared rules do not add up to the approved stylesheet")
    if not problems:
        print(f"css ok: approved {len(approved)} rules = shared {len(approved) - len(local)} + home.css {len(local)}"
              f" (shared adds only the [hidden] guard)")
    return problems


def main() -> None:
    check = "--check" in sys.argv
    problems = []
    for name in PAGES:
        page = pilot_page(name)
        target = HERE / name
        if check:
            if not target.exists() or target.read_text(encoding="utf-8") != page:
                problems.append(f"{name} differs from the approved page plus the link swap")
        else:
            target.write_text(page, encoding="utf-8", newline="\n")
            print(f"wrote {name}")
    if (SHARED_DIR / "nav-inset.js").read_bytes() != (APPROVED / "nav-inset.js").read_bytes():
        problems.append("shared/nav-inset.js differs from refinement-01/nav-inset.js")
    if (HERE / "home.css").exists():
        problems += check_css()
    if problems:
        raise SystemExit("\n".join(problems))
    if check:
        print("pages ok: both pages equal the approved markup plus the link swap; nav-inset.js identical")


if __name__ == "__main__":
    main()
