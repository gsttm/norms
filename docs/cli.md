# CLI

In a development checkout, replace `norms` with `./dist/norms.js`. Add `--json` to any command for machine-readable output.

| Command | Usage |
| --- | --- |
| `norms init [--no-import]` | Create `.norms/`, seed cached starter meta-norms, optionally import existing adapters, and regenerate them. |
| `norms list` | List active norms, scopes, and sources. |
| `norms context [path]` | Return all active norms or only those matching a path. |
| `norms explain <path>` | Diagnose every scope match and declared conflict for a path. |
| `norms lint [path...]` | Emit a deterministic agent-evaluated lint package for changed or explicit files. |
| `norms status` | Report adapter, import, and Git state. |
| `norms propose --id ID` | Write a norm from `--body`, `--body-file`, or stdin. Repeat `--scope` or `--conflicts-with`; use `--force` to replace. |
| `norms sync` | Restore locked imports and generate agent adapters; fetch only when a pinned commit is missing locally. |
| `norms sync --update` | Fetch configured refs, advance pins, and generate agent adapters. |
| `norms check` | Validate configuration, norms, imports, lockfile, and adapters. |
| `norms review --title TITLE` | Commit Norms files, push a branch, and open a GitHub PR or GitLab MR. |

## Propose

```sh
./dist/norms.js propose \
  --id backend.repository-access \
  --scope 'src/controllers/**' \
  --body-file proposal.md
./dist/norms.js sync
./dist/norms.js check
```

Use `norms explain src/index.ts --json` to inspect matched and unmatched scopes, applicable norm ids, missing conflict targets, and path-relevant conflict tasks.

`norms lint` uses staged, unstaged, and untracked files by default. Its package contains a fixed evaluation task, file-to-norm mappings, conflicts, unique norm text, and the tracked diff. Pass paths to lint clean or selected files. Norms does not evaluate or modify code itself.

Run `sync --update` after adding, removing, or changing a Git source. Plain `sync` preserves pins, migrates version-1 lockfiles, and restores the previous valid state if resolution fails.

`review` also accepts `--body`, `--base`, and `--branch`. It requires authenticated `gh` or `glab` and changes Git state.

`init` never overwrites project norms. It reads `meta-norms.json` from `NORMS_CACHE_DIR`, then `XDG_CACHE_HOME/norms`, then `~/.cache/norms`; a missing cache is rebuilt from the executable.

Existing `AGENTS.md`, `CLAUDE.md`, Cursor rules, and Copilot instructions are imported as local norms before generation. `sync` refuses to overwrite unimported handwritten adapters.
