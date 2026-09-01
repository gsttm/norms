---
id: meta.require-norms-installation
applies_to:
  - "**/*"
---

# Require Norms installation

When a repository contains `.norms/`, verify that the `norms` command is available before substantive work.

If it is unavailable, warn the user prominently that Norms is required to resolve, sync, and validate the repository instructions. Include this macOS/Linux installation command exactly:

```sh
curl -fsSL https://raw.githubusercontent.com/gsttm/norms/main/install.sh | sh
```

Do not proceed silently or claim that norms were resolved, synced, or validated.
