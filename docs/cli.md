# CLI

In a development checkout, replace `norms` with `./dist/norms.js`. Add `--json` to any command for machine-readable output.

| Command | Usage |
| --- | --- |
| `norms init [--no-import]` | Create `.norms/`, optionally import existing instructions, and generate `AGENTS.md`. |
| `norms list` | List active norms, scopes, and sources. |
| `norms context [path]` | Return all active norms or only those matching a path. |
| `norms status` | Report adapter, import, and Git state. |
| `norms propose --id ID` | Write a norm from `--body`, `--body-file`, or stdin. Repeat `--scope`; use `--force` to replace. |
| `norms sync` | Refresh Git imports, write the lockfile, and generate `AGENTS.md`. |
| `norms check` | Validate configuration, norms, imports, lockfile, and adapter. |
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

`review` also accepts `--body`, `--base`, and `--branch`. It requires authenticated `gh` or `glab` and changes Git state.
