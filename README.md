# Norms

Git-backed engineering conventions for coding agents.

```sh
bun install
bun run build
./dist/norms.js init
```

Commands: `init`, `list`, `context`, `status`, `propose`, `sync`, `check`, and `review`. Add `--json` for machine-readable output.

Norms live in `.norms/norms/`. `.norms/config.yaml` composes local or imported Git sources; `.norms/lock.json` pins imported commits. `norms sync` refreshes imports and generates `AGENTS.md`.

```yaml
version: 1
sources:
  - name: repository
    path: norms
  - name: engineering
    git: git@github.com:acme/engineering-norms.git
    ref: main
    path: .norms/norms
```

See `SPEC.md` for the Phase 0 contract.
