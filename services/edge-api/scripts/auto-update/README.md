# Automatic season-batch job (GitHub Actions -> staging ingest)

Design, policy mapping, failure handling, live test and recovery: [`docs/release/github-actions-updates.md`](../../../../docs/release/github-actions-updates.md).

| File             | Role                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `capture.mjs`    | The only Jolpica F1 client: fixed URLs, identified, paced, the first non-200 ends it, never retried, complete or absent                |
| `reconcile.ts`   | Pure: state, plan, the coordinated runtime's state machine (`dueSlot`, `applyClassificationCheck`, `classificationRevision`), the gate |
| `orchestrate.ts` | One run, every dependency injected                                                                                                     |
| `submit.mjs`     | The only credentialed calls: the cutover-status GET and the ingest POST, to the allow-listed staging origin                            |
| `run.mjs`        | The CLI the workflow runs. It bundles `entry.ts` and generates the batch in process; nothing is written but the state                  |

```text
node scripts/auto-update/run.mjs --state <file outside the repository> [--mode scheduled|bootstrap] [--submit]
```

Without `--submit` nothing credentialed is sent. Exit codes: 0 done, 1 internal error, 2 attention, 3 stopped for a human, 4 usage.

Tests (`test/auto-update/`) use only mocked responses. `scenarios.test.ts` drives the whole path through the real Worker entry point with the scoped token.
