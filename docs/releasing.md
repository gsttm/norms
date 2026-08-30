# Releasing

The root and VS Code package versions must match. Tags use `vX.Y.Z`.

```sh
bun ci
bun run check
bun test
bun run test:installer
bun run package:release
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

The tag workflow builds and attests platform binaries, the starter pack, and `norms-vscode.vsix`, then publishes them with `SHA256SUMS` and tests the public installer.

Re-run an existing release without replacing its assets:

```sh
gh workflow run release.yml -f tag=vX.Y.Z
```

Verify a downloaded public release with:

```sh
gh attestation verify ./norms-darwin-arm64 -R gsttm/norms
```
