# Norms

## Problem
As more work is delegated to AI agents, coders and teams need a way to define how those agents should behave. AGENTS.md is fine, but doesn't scale well across repos, teams, and coding languages. Norms is a simple attempt to make it really easy for you and your agents to create norms that persist.

## Summary
Norms is a toolchain for storing repo-specific agent instructions. It keeps track of agent norms in Markdown files in a local .norms/ folder, then auto-populates them into an AGENTS.md. 


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

Norm Markdown lives in `.norms/norms/`. `.norms/config.yaml` composes sources, `.norms/lock.json` pins imports, and `.norms/assets/` stores referenced files.

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
- [Roadmap](ROADMAP.md)
- [Phase 0 specification](docs/specs/phase-0.md)
