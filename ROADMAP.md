# Roadmap

Goal: a new user can install Norms and complete a two-repository workflow without understanding its internals.

## Distribution

- [x] Cross-platform CI, standalone binaries, checksums, attestations, and one-line install.
- [x] Golden `init` → `propose` → `sync` → `check` → import end-to-end tests.
- [x] Lock-first offline sync, explicit updates, migrations, and recovery.
- [x] Polished `init` with a cached starter meta-norm pack.

## Agent experience

- [x] Conflict declarations, scope diagnostics, and `norms explain`.
- [x] Implement `norms lint` with agent-evaluated lint context without an embedded model.
- [x] Generated adapters for Claude, Cursor, and Copilot.

## Review and IDE

- [x] [Production VS Code extension](docs/vscode-extension.md) with multi-root tests.
- [ ] Publish the VS Code extension.
- [ ] Review reuse, previews, default-branch detection, and recovery.

## Teams

- [ ] Cross-repository lockfile update automation and rollout status.
- [ ] Optional service for access, notifications, and aggregate status; Git remains canonical.

Next: publish the VS Code extension.
