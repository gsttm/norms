# Roadmap

Goal: a new user can install Norms and complete a two-repository workflow without understanding its internals.

## Distribution

- [x] Cross-platform CI, standalone binaries, checksums, attestations, and one-line install.
- [ ] Golden `init` → `propose` → `sync` → `check` → import end-to-end tests.
- [ ] Lock-first offline sync, explicit updates, migrations, and recovery.
- [ ] Polished `init` and a diagnostic `doctor` command.

## Agent experience

- [ ] Conflict declarations, scope diagnostics, and `norms explain`.
- [ ] Optional MCP resources and explicit mutation tools.
- [ ] Generated adapters for Claude, Cursor, and Copilot.
- [ ] Agent-evaluated lint context without an embedded model.

## Review and IDE

- [ ] Production VS Code extension with multi-root tests and publishing.
- [ ] Review reuse, previews, default-branch detection, and recovery.

## Teams

- [ ] Cross-repository lockfile update automation and rollout status.
- [ ] Optional service for access, notifications, and aggregate status; Git remains canonical.

Next: end-to-end workflow tests, lock-first offline sync, then `init` and `doctor`.
