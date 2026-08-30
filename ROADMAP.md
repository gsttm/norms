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

- [x] Define the [initial architecture and trust boundaries](docs/specs/team-sharing.md).
- [ ] Publish versioned endpoint and snapshot schemas with conformance fixtures in this repository.
- [ ] Create the private hosted-service repository and implement tenant-isolated storage and deployment.
- [ ] Sign in with GitHub or GitLab and map stable provider organization, team, repository, and role ids to Norms access.
- [ ] Add GitHub App and GitLab integration flows with scoped repository access and verified webhooks.

### Team templates

- [ ] Connect or explicitly create one private team norms repository per organization.
- [ ] Define versioned template manifests that select canonical norm and asset paths.
- [ ] Let `norms init` discover authorized templates, apply one, and record its endpoint source and immutable snapshot.
- [ ] Compose team and repository norms additively with existing duplicate and conflict rules; add no implicit precedence.

### Hosted sources and sync

- [ ] Add `norms login` and `norms team connect` for GitHub and GitLab.
- [ ] Add authenticated endpoint sources to `.norms/config.yaml` alongside local and Git sources without storing credentials.
- [ ] Make `norms sync --update` resolve templates into content-addressed snapshots built from immutable Git commits.
- [ ] Preserve lock-first offline operation; require explicit updates and recover the last valid state after endpoint failure.
- [ ] Pin snapshot ids, digests, source commits, derivation inputs, and provenance in `.norms/lock.json`.

### Governance and rollout

- [ ] Enforce owner, maintainer, contributor, and reader privileges from current provider membership.
- [ ] Use provider pull or merge requests, `CODEOWNERS`, and branch protection for content approval.
- [ ] Show repository adoption, pinned versions, drift, conflicts, failed syncs, and available updates.
- [ ] Automate cross-repository lockfile update reviews with staged rollout and rollback.
- [ ] Record service audit events for sign-in, access, connection, resolution, and rollout; keep content history and approval canonical in Git.

### Product integration

- [ ] Add organization, team, template, and rollout views to the VS Code extension.
- [ ] Support non-interactive service credentials for CI without weakening developer permissions.
- [ ] Add GitHub Enterprise Server and self-managed GitLab after hosted GitHub and GitLab are stable.

### Milestone acceptance

- [ ] A user signs in with GitHub or GitLab, initializes a repository from an authorized team template, and works offline from its lockfile.
- [ ] A maintainer publishes a shared change and rolls it out through reviewable updates across multiple repositories.
- [ ] Unauthorized users cannot discover, read, publish, approve, or apply restricted norms.
- [ ] Every active norm is traceable to its provider identity, source, version, approval, and repository lock.

Next: publish the endpoint, template manifest, snapshot, and lockfile contracts with conformance fixtures.
