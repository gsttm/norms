---
id: meta.respect-import-ownership
applies_to:
  - "**/*"
---

# Respect imported norm ownership

Treat imported norms as read-only in a consuming repository. Never edit materialized files under `.norms/imports/`.

Propose changes in the source repository, then run `norms sync` to update the pinned import. Do not create a local rule that silently contradicts an imported norm.
