---
id: meta.norms-usage
applies_to:
  - "**/*"
---

# Use norms

Norms are Git-versioned repository instructions for agents. `.norms/` is canonical; generated adapters such as `AGENTS.md` are not. Active norms are resolved from configured sources.

Follow every active norm whose `applies_to` pattern matches the files in scope. Treat `id` as stable identity and `source` as provenance, not priority. Use `norms context [path] --json` for scoped context, `norms propose` for reusable instructions, `norms sync` after norm changes, and `norms check` to validate state. Review norm changes as normal Git changes. Never edit generated adapters manually.
