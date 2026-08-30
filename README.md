# Norms

## Summary
Norms is repository-level memory for coding agents.

Norms stores Git-versioned agent instructions as Markdown in `.norms/`, resolves them by scope and source, and generates adapters for common coding agents. Instead of repeating instructions in prompts or maintaining separate rule files for every agent, you can write each reusable instruction once as a norm, then have your agent follow it as they would any other repo-wide instruction.

Run `norms init`, create norms with `norms propose` or edit the Markdown directly, then run `norms sync`. Sync resolves local and shared norms and regenerates the instruction files that agents read. Agents can also request rules for one path with `norms context <path>`. 

Practically, we expect that the majority of norms will be requested and managed through an agent, instead of through this CLI. 

## Canonical norm

Each norm has a stable id, optional path scopes, and one clear instruction. For example, `.norms/norms/testing/integration.md`:

```markdown
---
id: testing.integration
applies_to:
  - "packages/**"
---

# Test behavior

Cover user-visible behavior with integration tests.
```

## Install

On macOS or Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/gsttm/norms/main/install.sh | sh
```


## Quick development setup

```sh
git clone git@github.com:gsttm/norms.git
cd norms
bun install
bun test
bun run build
./dist/norms.js --help
```

In a development checkout, invoke Norms through `./dist/norms.js`. Building does not install the released `norms` command.

## Basics

Norm Markdown lives in `.norms/norms/` and `.norms/assets/` stores referenced files.

`norms sync` generates `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/norms.mdc`, and `.github/copilot-instructions.md`. Edit `.norms/`, never generated adapters.

| Command | Purpose |
| --- | --- |
| `norms init` | Initialize Norms, starter meta-norms, and existing agent instructions. |
| `norms list` | List active norms and sources. |
| `norms context [path]` | Return norms applicable to a path. |
| `norms explain <path>` | Explain scope matches and declared conflicts. |
| `norms lint [path...]` | Emit deterministic context for evaluation by your agent. |
| `norms status` | Show sync and Git state. |
| `norms propose` | Create or update a local norm. |
| `norms sync` | Restore pinned imports offline and generate agent adapters. |
| `norms sync --update` | Fetch configured refs and update import pins. |
| `norms check` | Validate config, norms, lockfile, and adapters. |
| `norms review` | Commit, push, and open a GitHub or GitLab review. |

Add `--json` for machine-readable output.

## Documentation

- [Concepts](docs/concepts.md)
- [CLI reference](docs/cli.md)
- [Repository format](docs/repository-format.md)
- [Code structure](docs/code-structure.md)
- [Development](docs/development.md)
- [Releasing](docs/releasing.md)
- [VS Code extension](docs/vscode-extension.md)
- [Roadmap](ROADMAP.md)
