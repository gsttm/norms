# VS Code extension specification

Status: initial

## Goal

Provide a fast, accessible view of repository norms and a safe way to create one without replacing `.norms/`, Git, or the CLI as canonical infrastructure.

## Principles

- Reuse core parsing, validation, scope, and serialization behavior.
- Use native VS Code controls and support keyboard, screen-reader, high-contrast, and zoom workflows.
- Follow `style.application-palette` for Norms-owned styling without overriding host accessibility behavior.
- Treat imported norms as read-only and generated adapters as derived; never edit either directly.
- Never modify Git history.
- Support every Norms repository in a multi-root workspace independently.

## Norm browser

Show every active norm in a scrollable tree. Group norms by focus; initially, focus is the first segment of the norm id, such as `docs`, `git`, or `style`.

```text
Norms
├── docs (3)
│   └── docs.code-structure
├── git (2)
│   └── git.commit-and-push
└── style (2)
    └── style.application-palette
```

- Sort groups and norms alphabetically.
- Make groups collapsible and preserve expansion, selection, and scroll position across refreshes.
- Provide text filtering without changing canonical state.
- Show norm id and source in each row.
- On selection, show body, `applies_to`, `conflicts_with`, source, and canonical file path.
- Open local canonical files from the detail view; identify imported norms as read-only.
- Never communicate state through color alone.

## New norm

Expose `Norms: New Norm` from the panel and Command Palette. Collect:

- `id`, required and lowercase;
- `applies_to`, defaulting to `**/*`;
- `conflicts_with`, optional;
- Markdown body, required;
- writable local source when more than one exists.

Use the same validation and path generation as `norms propose`. Show the target path and serialized preview before confirmation. Reject duplicate ids and invalid input; never overwrite without an explicit edit flow.

The primary action creates the norm, runs `norms sync`, and refreshes the panel. If sync fails, preserve the canonical proposal and show the exact recovery action. Never commit, push, or open a review automatically.

## States

- No repository: explain that a folder must be opened.
- Not initialized: explain Norms and offer `norms init`.
- Loading: retain the previous tree and show progress.
- Invalid state: show the exact file and error with retry and open-file actions.
- Untrusted workspace: allow inspection; disable writes and command execution.

Refresh after workspace-folder, active-editor, and `.norms/**` changes. Debounce repeated events.

## Acceptance

- Every active norm appears exactly once under a deterministic focus.
- Browsing and creation work without a mouse.
- Multi-root repositories remain isolated.
- A created norm passes core validation and appears in every generated adapter after sync.
- Imported norms cannot be edited through the extension.
- Extension-host tests cover browsing, filtering, creation, errors, refresh, accessibility labels, and multi-root workspaces.

## Non-goals

- Embedded AI or semantic compliance judgments.
- A custom Git review or collaboration system.
- Editing generated adapters.
