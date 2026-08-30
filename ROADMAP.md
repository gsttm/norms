# Roadmap

Current milestone: teams can share, apply, and govern norms across an organization without losing Git-backed reproducibility.

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
- [ ] Publish the VS Code extension to the Marketplace.
- [ ] Review reuse, previews, default-branch detection, and recovery.

## Organization sharing

### Foundation

- [ ] Define the hosted API, threat model, tenancy boundaries, and Git-backed data model.
- [ ] Sign in with GitHub or GitLab and map provider organizations, teams, repositories, and roles to Norms access.
- [ ] Keep Git canonical; store endpoint-derived norm snapshots as immutable, auditable versions pinned in `.norms/lock.json`.

### Team templates

- [ ] Let authorized maintainers publish versioned organization and team templates.
- [ ] Let `norms init` discover accessible templates, apply one or more, and record their sources and versions.
- [ ] Support organization defaults, team overrides, repository additions, and explicit conflict detection without hidden precedence.

### Hosted sources and sync

- [ ] Add authenticated endpoint sources to `.norms/config.yaml` alongside local and Git sources.
- [ ] Make `norms sync` resolve endpoint policies from organization, team, repository, and user context into a reproducible lockfile.
- [ ] Preserve lock-first offline operation; require explicit updates and recover the last valid state after endpoint failure.
- [ ] Verify snapshot integrity and expose provenance for every derived norm.

### Governance and rollout

- [ ] Enforce owner, maintainer, contributor, and reader privileges using GitHub or GitLab membership.
- [ ] Add review and approval workflows for template and shared-norm changes.
- [ ] Show repository adoption, pinned versions, drift, conflicts, failed syncs, and available updates.
- [ ] Automate cross-repository lockfile update reviews with staged rollout and rollback.
- [ ] Record an audit history for sign-in, access, publication, approval, and rollout events.

### Product integration

- [ ] Add organization, team, template, and rollout views to the VS Code extension.
- [ ] Support non-interactive service credentials for CI without weakening developer permissions.
- [ ] Add GitHub Enterprise Server and self-managed GitLab after hosted GitHub and GitLab are stable.

### Milestone acceptance

- [ ] A user signs in with GitHub or GitLab, initializes a repository from an authorized team template, and works offline from its lockfile.
- [ ] A maintainer publishes a shared change and rolls it out through reviewable updates across multiple repositories.
- [ ] Unauthorized users cannot discover, read, publish, approve, or apply restricted norms.
- [ ] Every active norm is traceable to its provider identity, source, version, approval, and repository lock.

Next: specify the hosted API, identity mapping, and immutable snapshot format.
