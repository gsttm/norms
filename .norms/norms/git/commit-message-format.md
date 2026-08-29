---
id: git.commit-message-format
applies_to:
  - "**/*"
---

# Format commit messages

Every commit message must use this structure, including the blank lines and six-hyphen separator:

```text
CONCISE SUMMARY SENTENCE.

------

1. Sub-feature: CONCISE SUMMARY
2. Sub-feature: CONCISE SUMMARY

Author: CURRENT_AUTHOR

Co-author: AI_MODEL
```

Use one or more numbered sub-feature lines. Replace the summary placeholders with concise text. Replace `CURRENT_AUTHOR` with the current human author's name, normally `git config user.name`. Replace `AI_MODEL` with the contributing model's identifier.
