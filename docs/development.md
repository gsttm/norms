# Development

Requires Git and Bun 1.4 or newer.

```sh
bun install
bun run check
bun test
bun run test:vscode
bun run test:e2e
bun run test:installer
bun run build
./dist/norms.js --help
```

Use `bun run dev -- <args>` to run TypeScript directly. Set `NORMS_CACHE_DIR` to isolate init tests. `bun run package` compiles the local executable; `bun run package:release` builds every release target, the starter pack, VSIX, and checksums.

Use sibling `../norms_sandbox` as the sample consumer project for deployment and end-to-end tests. Inspect it before changing it.

## Outputs

- `dist/norms.js`: bundled Bun CLI.
- `dist/norms`: compiled standalone CLI.
- `dist/release/`: cross-platform binaries, starter pack, VSIX, and checksums.
- `packages/vscode/dist/extension.js`: bundled VS Code extension.
- `packages/vscode/dist/test/`: bundled extension-host tests.

Generated outputs and `node_modules/` are ignored. Run `bun run build` after CLI, UI, core, or extension changes.

## Verification

- `bun run check`: strict TypeScript hygiene and repository Norms validation.
- `bun test`: core, CLI, Git, and provider tests.
- `bun run test:vscode`: VS Code extension-host tests; downloads a cached test runtime on first use.
- `bun run test:e2e`: two-repository CLI workflow.
- `bun run test:installer`: installer selection and checksum tests.
- `./dist/norms.js check --json`: repository Norms validation.
