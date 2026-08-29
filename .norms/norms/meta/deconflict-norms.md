---
id: meta.deconflict-norms
applies_to:
  - "**/*"
---

# Deconflict norms

Active norms must be mutually satisfiable. If norms contradict or create ambiguous requirements, identify the conflicting norm ids and behaviors, then ask the human for clarification before choosing a direction.

After clarification, update the canonical norms into one unambiguous result, preserve their intent where possible, and run `norms sync` and `norms check`. Never resolve a conflict silently by source, order, or personal preference.
