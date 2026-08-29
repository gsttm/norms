# Norms — Phase 0 Engineering Handoff

## 1. Product

**Norms** is a Git-native system for defining the conventions that AI agents should follow while working in a repository.

Examples of norms:

* coding conventions and architecture
* naming/style rules
* commit-message formats
* PR/MR structure
* documentation standards
* design/UI standards
* design-doc templates
* testing practices
* repository organization
* instructions referencing images, spreadsheets, diagrams, or other artifacts
* implementation conventions for TypeScript, Yoga, React, Ink, and Bun

The core idea:

> **A developer or team should be able to define how they build software once, version it in Git, and have every AI agent consistently follow it.**

Norms itself should **not** be an AI agent.

The user's existing agent—Codex, Claude Code, Cursor, etc.—does all AI reasoning.

Norms provides the deterministic structure that tells those agents what to read, what applies, how to propose changes, and how to verify/sync them.

---

# 2. Non-negotiable architecture principles

## Git is the database

All meaningful Norms state must live in Git.

Do **not** make a Norms server the source of truth for:

* norms
* versions
* approvals
* history
* provenance
* conflicts
* assets
* rule inheritance

A user must be able to stop paying for Norms and retain their complete policy history.

Git provides:

* versioning
* authorship
* diffs
* provenance
* rollback
* branches
* review
* approval
* collaboration

Use it.

A future Norms service may store only convenience/account data such as:

* authentication
* organizations
* billing
* seat counts
* repository connections
* optional aggregated status

It must never be required to reconstruct the norms themselves.

---

# 3. AI architecture

**Never ship a Norms-hosted LLM for coding/linting/syncing.**

If AI reasoning is needed, the developer's existing coding agent performs it.

Norms should expose simple deterministic primitives that agents can call:

```bash
norms context
norms list
norms status
norms propose
norms check
norms sync
norms lint
```

The CLI should be designed primarily for **AI agents**, even though humans can use it.

Assume roughly:

> 99% of new norm proposals will ultimately be written by an AI agent.

Therefore:

* formats must be trivial for LLMs to understand
* commands must work non-interactively
* stdout should be clean and machine-readable when requested
* errors should tell an agent exactly how to correct them
* the agent should not need an SDK
* generated instructions should be compatible with the interaction model of Claude Code and similar coding agents

Filesystem + CLI are the universal agent API.

---

# 4. Technology and implementation conventions

Everything in the Norms application should be written using the following stack and conventions:

* **TypeScript** for application and library code
* **Bun** for runtime, package management, scripts, testing, and packaging
* **React** for component-based interfaces
* **Ink** for terminal user interfaces and interactive CLI views
* **Yoga** for layout calculations and cross-platform interface layout, including Ink-compatible terminal layouts
* **Bun packaging** for distributing the CLI and related executable artifacts

The overall developer experience should feel like the **Claude Code application**:

* fast startup
* terminal-first interaction
* polished interactive CLI output
* clear streaming status
* composable commands
* excellent non-interactive behavior for agents and automation
* minimal installation friction
* a single cohesive executable experience where practical

Use React and Ink for terminal presentation rather than manually assembling complex terminal output.

Use Yoga-compatible layout primitives for responsive terminal layouts.

Use standard TypeScript modules and shared packages for core logic.

Do not introduce another primary language, runtime, UI framework, or package manager unless there is a compelling technical requirement that is documented and approved in the repository.

The default project commands should use Bun, for example:

```bash
bun install
bun run build
bun run test
bun run lint
bun run dev
```

The CLI should be packaged and distributed through Bun-compatible workflows.

---

# 5. Repository format

Use a `.norms/` directory.

Suggested structure:

```text
.norms/
├── config.yaml
├── norms/
│   ├── coding/
│   ├── git/
│   ├── docs/
│   ├── design/
│   └── testing/
├── assets/
├── imports/
└── lock.json
```

A norm should be **mostly natural-language Markdown with minimal structured metadata**.

Example:

```markdown
---
id: backend.database-access
applies_to:
  - "src/controllers/**"
---

# Database access

Controllers must never directly instantiate or access database clients.

All persistence must go through the repository layer.

## Why

This preserves separation between business logic and persistence and allows alternate implementations during testing.

## Examples

Good:

UserController → UserRepository → Postgres

Bad:

UserController → PostgresClient
```

Do not invent a large policy DSL in Phase 0.

### Stable identity

Every norm needs a stable `id`.

Everything else should rely on Git wherever possible.

Do not duplicate Git metadata such as author, timestamps, or version history unless technically necessary.

---

# 6. Assets

Norms must support non-textual references.

Example:

```text
.norms/assets/
├── dashboard-reference.png
├── api-format.xlsx
├── mechanical-layout.pdf
└── design-system.svg
```

Norm Markdown can reference these files normally:

```markdown
Use the layout conventions shown in:

../assets/dashboard-reference.png
```

Norms does not initially need to understand every asset format.

Its responsibility is to:

1. preserve it,
2. version it,
3. expose it as relevant context to the user's agent.

---

# 7. Multi-repository norms

Users must be able to have:

* personal/global norms
* shared organization norms
* stack-specific norms
* repository-specific norms

A repository should be able to compose multiple Git-backed sources.

Conceptually:

```text
Personal
   +
Engineering
   +
TypeScript
   +
React/Ink
   +
Bun
   +
Backend
   +
payments-repo
   =
active norms
```

Remote sources must be Git repositories or Git-tracked sources.

Example concept:

```yaml
sources:
  - name: engineering
    git: git@github.com:acme/engineering-norms.git

  - name: frontend
    git: git@github.com:acme/frontend-norms.git

  - name: bun-tooling
    git: git@github.com:acme/bun-tooling-norms.git

local:
  path: .norms/norms
```

Pin resolved sources by commit SHA in:

```text
.norms/lock.json
```

Materialize enough information locally that the state of the repository is reproducible without the Norms server.

---

# 8. AGENTS.md and agent adapters

`.norms/` is canonical.

`AGENTS.md`, `CLAUDE.md`, Cursor rules, Copilot instructions, etc. are **generated adapters**, not sources of truth.

For Phase 0, prioritize `AGENTS.md`.

`norms sync` should generate/update an `AGENTS.md` that:

1. explains Norms,
2. tells the agent how to obtain active norms,
3. exposes the relevant rules,
4. tells agents never to manually modify generated Norms output,
5. explains how to propose a new norm,
6. identifies the required TypeScript, Yoga, React, Ink, and Bun conventions,
7. encourages terminal-first workflows consistent with Claude Code.

Example meta-instruction:

```text
If the user corrects you in a way that expresses a reusable engineering convention, consider proposing a Norm.

Do not directly modify generated Norms files.

Use:

norms propose

Unless a repository-specific norm says otherwise, implement Norms code in TypeScript using Bun. Use React and Ink for terminal interfaces and Yoga-compatible layout primitives for terminal layout.
```

---

# 9. Creating norms

Humans must be able to do:

```bash
norms propose
```

But AI is the primary authoring flow.

Example:

```bash
norms propose \
  --id backend.database-access \
  --scope "src/controllers/**" \
  --body-file /tmp/proposed-norm.md
```

Or stdin:

```bash
cat proposal.md | norms propose --id backend.database-access
```

A proposal should create/edit normal Git files.

**Do not create a separate proposal database.**

---

# 10. Collaboration and approval

A new norm is just a Git change.

Required workflow:

```text
Agent/human proposes norm
        ↓
Git branch
        ↓
GitHub PR / GitLab MR
        ↓
Discussion occurs there
        ↓
Approval
        ↓
Merge
        ↓
Norm becomes canonical
```

Norms should make starting this workflow easy.

Example:

```bash
norms propose ...
norms review
```

`norms review` may:

* create a branch
* commit changes
* push
* open GitHub PR / GitLab MR
* return the review URL

**Do not build a proprietary comments/review interface.**

GitHub/GitLab is where people debate norms.

Provider-specific code should live behind a clean abstraction.

Support GitHub and GitLab.

---

# 11. VS Code extension

The extension's primary job is **visibility**, not becoming another IDE.

For the current repository, it should clearly show:

```text
NORMS

Active norms: 24

Organization       8
Backend             5
TypeScript          3
React/Ink           2
Bun                 2
Repository          4

✓ Synced
```

Selecting a file should make it possible to see:

> Which norms apply to this file?

The extension should display Git state:

```text
✓ canonical
● locally modified
↑ remote update available
◐ proposed in PR/MR
⚠ conflict
```

The extension should update immediately when `.norms/**` changes.

Git state is authoritative.

Avoid building custom collaboration infrastructure.

---

# 12. Conflicts

Canonical norms should never knowingly contradict one another.

Norms should detect obvious deterministic conflicts where possible.

Semantic conflicts require AI.

When one occurs, Norms should generate a structured deconfliction task for the **user's current AI agent**.

For example:

```text
Conflict detected:

backend.error-handling
company.error-handling

Resolve these into one unambiguous canonical policy.

Preserve the intent of both where possible.
Explain any behavior that must change.
Update the appropriate Norm files.
```

Norms itself must not call an LLM backend.

The user's agent resolves the conflict and produces a normal Git diff that is reviewed normally.

---

# 13. Linter behavior

Norms should eventually function like an AI-powered linter.

Example:

```bash
norms lint
```

The command determines:

* active norms
* relevant files
* relevant repository context

It then emits a deterministic task/context package for the **calling coding agent**.

The coding agent performs the reasoning and code changes.

Norms should never hide a low-quality proprietary model behind:

```bash
norms lint
```

The desired model is:

```text
Norms determines context
        ↓
User's agent evaluates code
        ↓
User's agent modifies code
        ↓
Norms checks/syncs state
        ↓
Git diff
```

The CLI presentation for these workflows should use React and Ink where an interactive terminal interface is appropriate, while preserving clean machine-readable output for non-interactive agent calls.

---

# 14. Installation

Installation must feel like installing a modern developer CLI.

Primary entry point:

```text
github.com/<org>/norms
```

with an obvious one-line install command.

Example desired UX:

```bash
curl -fsSL https://norms.dev/install | sh
norms init
```

or an equivalent Bun/package-manager installation.

First-run experience:

```bash
norms init
```

should:

1. detect the Git repository,
2. create `.norms/`,
3. optionally connect GitHub/GitLab,
4. optionally authenticate for team features,
5. discover existing `AGENTS.md` / agent rules,
6. offer to import them,
7. generate the first adapter,
8. leave the repository immediately usable.

Core local functionality should not require a paid account.

The packaged CLI should be built and distributed with Bun.

---

# 15. Business model constraint

Norms should be useful indefinitely without a subscription.

Potential paid features for teams above a seat threshold:

* organization management
* centralized repo status dashboard
* automated cross-repo rollout visibility
* GitHub/GitLab organization integration
* seat management
* notifications
* enterprise SSO
* audit aggregation
* policy compliance dashboards

However:

> **Stopping payment must never destroy or lock access to the actual norms.**

The files and history stay in Git.

---

# 16. Phase 0 implementation priority

Build the smallest end-to-end loop first.

## Required

### CLI

```text
norms init
norms list
norms context
norms status
norms propose
norms sync
norms check
```

The CLI must support both:

* polished interactive terminal experiences built with React, Ink, and Yoga-compatible layout
* deterministic non-interactive output suitable for AI agents and shell automation

### Git-backed storage

Implement:

* `.norms/`
* Markdown norm format
* assets
* config
* imports
* lockfile

### AGENTS.md generation

Make Norms immediately useful to Codex/Claude/etc.

### Git workflows

A norm can be:

```text
created → diffed → committed → reviewed → merged
```

### Multi-source composition

At least:

```text
shared Git norms + local repo norms
```

### VS Code extension

Initially only needs to:

* show active norms
* show where each norm came from
* show which norms apply to current file
* show Git state
* refresh when norms change

### Toolchain

The Phase 0 repository must include:

* TypeScript source
* Bun scripts
* Bun lockfile and package configuration
* React/Ink terminal components where interactive CLI output is needed
* Yoga-compatible layout handling for terminal interfaces
* Bun-based build and packaging commands

---

# 17. Explicit non-goals for Phase 0

Do **not** build:

* a custom AI model
* a hosted norm database
* collaborative Google-Docs editing
* proprietary code review
* a giant policy DSL
* analytics
* enterprise administration
* an elaborate web dashboard
* automatic semantic conflict resolution outside the user's agent
* support for every IDE
* a second runtime or package manager as a default
* a custom terminal UI framework when React, Ink, and Yoga are sufficient

Keep the architecture extensible, but do not implement these yet.

---

# 18. Suggested implementation structure

Use TypeScript, React, Ink, Yoga, and Bun as the default stack.

Use a monorepo:

```text
packages/
├── core/
│   ├── norm parsing
│   ├── source resolution
│   ├── scope matching
│   ├── conflict primitives
│   └── adapter generation
│
├── cli/
│   ├── command definitions
│   ├── non-interactive output
│   ├── React/Ink views
│   └── Yoga-compatible terminal layouts
│
├── git/
│
├── providers/
│   ├── github/
│   └── gitlab/
│
├── ui/
│   ├── shared React components
│   ├── Ink components
│   └── layout primitives
│
└── vscode/
```

Use Bun for:

* dependency installation
* workspace management
* scripts
* tests
* builds
* executable packaging
* release artifacts

`core` must have no dependency on VS Code or hosted Norms services.

The CLI and extension should call the same core APIs.

Terminal UI packages may depend on React, Ink, and Yoga-compatible layout utilities, but core domain logic must remain presentation-independent.

---

# 19. Phase 0 success test

The following workflow must work:

```text
1. Developer installs Norms.

2. Runs:
   norms init

3. Existing repository gets:
   .norms/
   AGENTS.md

4. The CLI starts quickly and presents interactive output using React, Ink, and Yoga-compatible layout where appropriate.

5. Codex or Claude Code starts working in the repository.

6. User says:
   "We never access the database directly from controllers.
    Always use repositories."

7. Codex recognizes this as reusable and runs:
   norms propose ...

8. A new Markdown norm appears under .norms/norms/.

9. `git diff` clearly shows the proposal.

10. Norms can open a GitHub PR / GitLab MR.

11. Team discusses and merges it.

12. Another repository imports the shared norm source.

13. `norms sync` updates that repo's active instructions.

14. Its coding agent now sees and follows the new rule.

15. VS Code clearly shows why that norm applies and where it came from.

16. The entire project can be installed, tested, built, and packaged with Bun.
```

If this loop feels excellent, Phase 0 is successful.

---

# 20. Guiding product principle

Whenever choosing between:

> putting intelligence inside Norms

and

> giving the user's AI agent a reliable structure for doing the intelligent work,

choose the second.

Whenever choosing between:

> storing state in Norms infrastructure

and

> representing that state in Git,

choose Git.

Whenever choosing between:

> adding a new runtime, framework, or package manager

and

> using TypeScript, React, Ink, Yoga, and Bun consistently,

choose the existing stack unless a documented technical constraint requires otherwise.

**Norms should be the Git-native protocol and tooling layer for persistent AI engineering conventions, implemented with the same fast, terminal-first, polished application model associated with Claude Code.**
