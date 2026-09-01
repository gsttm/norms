---
id: release.require-green-pipeline
applies_to:
  - "**/*"
---

# Require a green release pipeline

Before creating or pushing a release tag or publishing release artifacts, verify that every required CI job for the exact release commit has completed successfully.

Do not release while the pipeline is pending, skipped unexpectedly, cancelled, or failed. Fix the cause, push the fix, and verify a new green pipeline first. Local checks do not replace this requirement.
