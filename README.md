# Norms

## Summary
Define your coding rules once, store them in Git, and make every coding agent follow them.

Norms stores repo-level instructions as Markdown in `.norms/`, resolves them, and generates the rule files each coding agent expects. Write each instruction once instead of duplicating it across agents and prompts.


In practice, you’ll usually create and manage norms through your coding agent. Ask it to add or update a norm, and Norms handles the underlying Markdown and Git workflow.

You can also manage norms directly from the CLI: run `norms init` to set up a repo, `norms propose` to create a norm, and `norms sync` to generate instructions for your coding agents. Norms are just Markdown, so you can always edit them by hand.

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

## What norms can encode

Norms can encode any reusable instruction you want agents to follow. Because norms are just Markdown, they can also include images, diagrams, links, code snippets, tables, and other supporting context.

For example:

*  “All new API endpoints must include an integration test.”
* “Use uv for Python dependencies; don’t add requirements.txt.”
* “Keep React components under 300 lines and move shared state into hooks.”
* “Every merge request must explain what changed, why, and how it was tested.”
* “All buttons on this website should glow red like in this picture.”


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
