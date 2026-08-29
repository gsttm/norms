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
- `lock.json`: resolved imported commit SHAs.
- `norms/`: canonical local Markdown norms.
- `assets/`: Git-tracked files referenced by norms.
- `imports/`: ignored, materialized Git checkouts.

## Norm

```markdown
---
id: backend.repository-access
applies_to:
  - "src/controllers/**"
---

# Use repositories

Controllers access persistence through repositories.
```

Ids are stable lowercase words separated by `.`, `-`, or `_`. Omit `applies_to` to use `**/*`.

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

Git sources are read-only in consumers and reproducible through `lock.json`.
