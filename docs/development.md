# Development

Requires Git and Bun 1.4 or newer.

```sh
bun install
bun run check
bun test
bun run build
./dist/norms.js --help
```

Use `bun run dev -- <args>` to run TypeScript directly. Use `bun run package` to compile the standalone `dist/norms` executable.

## Outputs

- `dist/norms.js`: bundled Bun CLI.
- `dist/norms`: compiled standalone CLI.
- `packages/vscode/dist/extension.js`: bundled VS Code extension.

Generated outputs and `node_modules/` are ignored. Run `bun run build` after CLI, UI, core, or extension changes.

## Verification

- `bun run check`: strict TypeScript validation.
- `bun test`: core, CLI, Git, and provider tests.
- `./dist/norms.js check --json`: repository Norms validation.
