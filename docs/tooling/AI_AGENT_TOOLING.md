# AI agent tooling

Optional developer- and agent-assistance tooling used while working on this
repository. **None of it is application runtime, build, deployment, CI or
production dependency.** A contributor can ignore this file entirely and the
app still builds, tests and ships unchanged.

The tools never modify application code as part of their installation or
refresh. If a tool upgrade would change tool behaviour, that upgrade is a
deliberate, reviewed change - not something to apply silently.

## Graphify

A local knowledge-graph helper. It reads the source tree and produces a
queryable graph used to answer architecture questions.

- **Pinned version:** `0.9.55`
- **PyPI package name:** `graphifyy` (note the double `y`)
- **Install:**

  ```
  python -m pip install --user graphifyy==0.9.55
  ```

- **Licence:** Apache-2.0 (the package ships `LICENSE`, `LICENSE-MIT` and
  `NOTICE`).
- Do not silently replace the pinned version. Upgrades must be deliberate and
  version-reviewed.

### What Graphify generates locally (all git-ignored)

Running Graphify or its Claude Code integration may (re)generate:

- `graphify-out/` - the graph, `GRAPH_REPORT.md`, `graph.html` and the
  AST/semantic caches. This directory is **local and fully regenerable**. It
  contains absolute local paths, repository structure and token/cost usage
  telemetry, so it **must never be committed**. ~23 MB.
- `.claude/settings.json`, `.claude/settings.json.graphify-bak` and
  `.claude/skills/graphify/` - local Claude settings, hooks and a regenerable
  third-party copy of the Graphify skill. Machine-specific; recreated by
  installation. Not vendored here.

`.gitignore` already excludes all of the above. Regenerate any of it with a
fresh Graphify run; nothing needs to be restored from Git.

### Shared project guidance (tracked)

- `CLAUDE.md` and `.claude/CLAUDE.md` carry only Graphify usage instructions
  (query the graph before broad source reads; refresh it after code changes).
  These are safe to share and contain no local or machine-specific data.

## Ponytail

Enabled through the developer's own Claude Code plugin installation and
local/global settings (`enabledPlugins`). It contributes **no shared
repository artifact** - there is nothing to install from this repo.

## RKT-AI

Installed globally on the developer's machine as an output-filtering proxy for
shell commands. It contributes **no shared repository artifact**.

For security audits, exact Git inspection or any other forensic work, bypass
RKT-AI's output filtering with `rtk proxy <command>` so raw, unfiltered
command output is used.
