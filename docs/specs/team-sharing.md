# Team Sharing — Initial Specification

Status: proposed.

## Outcome

A team connects a GitHub or GitLab organization, stores transferable norms in a dedicated repository, applies a team template during `norms init`, and receives reviewable updates across repositories. Every active norm remains reproducible from Git.

## Architecture

| Component | Visibility | Responsibility |
| --- | --- | --- |
| `norms` | Public | CLI, extension, file formats, endpoint contract, and conformance tests. |
| Team norms repository | Team-controlled | Canonical norms, templates, assets, ownership, reviews, approvals, and history. |
| Hosted service | Private | Provider identity, authorization, discovery, snapshot delivery, rollout state, notifications, and audit mirrors. |

The hosted service must not be required to reconstruct canonical norm content or history. Its public, versioned protocol belongs in this repository; its implementation belongs in a separate private repository.

## Team repository

During connection, an authorized user selects an existing repository or explicitly creates one. Private is the default. One repository per organization is the initial model; additional restricted sources may be connected later.

```text
team-norms/
├── .norms/
│   ├── norms/
│   │   ├── organization/
│   │   └── teams/
│   └── assets/
├── templates/
└── CODEOWNERS
```

A template is a versioned manifest that selects norm and asset paths. Composition is additive: source order grants no priority, different definitions of one id conflict, and overrides must be expressed as reviewed canonical changes rather than hidden precedence.

## Identity and access

- Use GitHub or GitLab OAuth to authenticate humans.
- Use a GitHub App or equivalent GitLab integration for scoped repository access, webhooks, and automation.
- Store provider ids, not mutable names, as identity keys.
- Revalidate organization, team, repository, and role membership before privileged operations.
- Map provider access to Norms roles: owner, maintainer, contributor, and reader.
- Keep credentials, sessions, and secrets out of repositories and lockfiles.

Content visibility follows provider repository access. Only owners and maintainers may connect sources, publish templates, approve rollouts, or change role mappings. Contributors propose changes through Git review. Readers may discover and apply authorized templates.

## Initialization

1. `norms login` authenticates with GitHub or GitLab.
2. `norms team connect` selects an organization and team norms repository.
3. `norms init` lists templates visible to the user.
4. The user selects a template; non-interactive use passes its stable id.
5. Norms records an endpoint source, resolves an immutable snapshot, writes the lockfile, materializes the source, and generates adapters.

Initialization must remain usable without a team. Existing local and Git source behavior is unchanged.

## Endpoint source

An endpoint source identifies the service, provider organization, and template. Authentication remains outside repository configuration.

```yaml
version: 2
sources:
  - name: repository
    path: norms
  - name: acme-engineering
    endpoint: https://api.norms.example/v1
    organization: github:123456
    template: engineering.backend
```

The public contract must initially support:

- listing accessible organizations and templates;
- resolving a template for provider, team, and repository context;
- downloading an immutable snapshot by id;
- reading rollout and update status;
- returning structured authentication, authorization, conflict, and recovery errors.

## Snapshots and lockfiles

The service derives a snapshot from explicit template composition at immutable Git commits. A snapshot contains:

- a stable snapshot id and format version;
- provider repository ids and commit hashes;
- selected template and derivation inputs;
- norm and asset files with paths and digests;
- one digest covering the complete manifest;
- provenance for every included norm.

Lockfile version 3 pins the snapshot id, manifest digest, source commits, and materialized location. Plain `norms sync` restores the pin and works offline when cached. `norms sync --update` resolves a new snapshot. Failed authentication, download, integrity, or validation must preserve the last valid state.

Snapshots are immutable and content-addressed. The service may cache them, but must be able to rebuild them from Git. Clients reject digest or provenance mismatches.

## Changes and rollout

1. A contributor changes the team norms repository through a pull or merge request.
2. Provider review, `CODEOWNERS`, and branch protection govern approval.
3. After merge, the service indexes the new commit and produces snapshots on demand.
4. A maintainer starts a rollout to selected repositories.
5. Automation opens lockfile update reviews; repositories retain their previous pins until merge.
6. Rollback opens reviews that restore a previous valid snapshot.

The service reports adoption, current and available snapshots, drift, conflicts, failed syncs, and rollout progress. Service audit events mirror operational actions; Git remains canonical for content approval and history.

## Security and reliability

- Isolate tenants by provider organization id and verify access on every request.
- Request the minimum provider permissions and encrypt credentials at rest.
- Verify webhook signatures and prevent arbitrary server-side Git or URL fetches.
- Never place provider tokens or private download URLs in generated files.
- Rate-limit authentication, resolution, publication, and rollout operations.
- Log actor, organization, repository, action, result, and provider references without norm content or secrets.
- Support credential revocation, repository disconnection, snapshot retention, and complete account deletion.

## Acceptance

- A GitHub or GitLab user initializes a repository from an authorized template and can restore it offline.
- A reviewed team-repository change rolls out through lockfile update reviews to multiple repositories.
- Removing provider access immediately prevents new discovery and updates without invalidating existing local pins.
- Unauthorized users cannot enumerate or retrieve private organizations, templates, snapshots, or rollout state.
- Every active shared norm is traceable to a template, provider repository, commit, snapshot, digest, and repository lock.
- Deleting the hosted account leaves the team with its complete canonical Git history and usable pinned state.

## Deferred

- GitHub Enterprise Server and self-managed GitLab.
- Billing, seat enforcement, and enterprise policy controls.
- A web editor for norm content.
- Implicit inheritance or precedence between organization, team, and repository norms.
