# Repository format

```text
.norms/
├── config.yaml
├── lock.json
├── norms/
├── assets/
└── imports/
```

- `config.yaml`: local and Git-backed sources.
- `lock.json`: version-2 imported commit pins. Version 1 migrates on `norms sync`.
- `norms/`: canonical local Markdown norms.
- `assets/`: Git-tracked files referenced by norms.
- `imports/`: ignored, materialized Git checkouts.

## Norm

```markdown
---
id: backend.repository-access
applies_to:
  - "src/controllers/**"
conflicts_with:
  - backend.direct-database-access
---

# Use repositories

Controllers access persistence through repositories.
```

Ids are stable lowercase words separated by `.`, `-`, or `_`. Omit `applies_to` to use `**/*`. `conflicts_with` lists norm ids that cannot coexist; one-sided declarations are sufficient.

## Sources

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

Git sources are read-only in consumers and reproducible through `lock.json`. Use `norms sync --update` to change pins; plain `norms sync` preserves them and repairs materialized imports.

`norms init` copies the installed starter meta-norms into `norms/meta/`. Those copies become ordinary canonical project norms.

## Generated adapters

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/norms.mdc`
- `.github/copilot-instructions.md`

All contain the same resolved norms. Cursor adds required rule metadata.
