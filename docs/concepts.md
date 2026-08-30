# Concepts

## Model

Norms stores durable agent instructions in Git. Norms resolves applicable context; the user's agent performs reasoning and implementation.

`.norms/` is canonical. Generated adapters and imported checkouts are derived views.

## Norms

A norm is Markdown with a stable `id` and optional `applies_to` globs. Its body defines one reusable instruction. Every active norm matching a file must be followed.

Identical definitions of one id compose with combined provenance. Different definitions of one id are a conflict.

`source` records provenance, not priority. A norm may declare mutually exclusive ids with `conflicts_with`; `norms check` rejects declared pairs that coexist and emits a deterministic task for the calling agent. Missing targets remain valid for composition across sources. Semantic contradictions still require human clarification.

`norms explain <path>` reports why every norm applies or does not apply and filters declared conflicts to that path.

## Sources

`.norms/config.yaml` composes local and Git sources. `norms sync --update` resolves Git refs into `.norms/lock.json`; plain `norms sync` restores those exact pins and works offline when their objects are local.

Imported norms are changed in their source repository, then synced into consumers.

## Agent integration

`norms sync` generates `AGENTS.md` with universal usage guidance and active norms. Agents use `norms context [path] --json` for path-specific context and `norms propose` for reusable new instructions.

Norm changes use normal Git review and history.
