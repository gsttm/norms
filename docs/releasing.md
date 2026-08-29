# Releasing

The root `package.json` version is the CLI release version. Tags must match it as `vX.Y.Z`.

```sh
bun ci
bun run check
bun test
bun run test:installer
bun run package:release
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

The tag workflow repeats verification, builds macOS, Linux, and Windows binaries plus the starter meta-norm pack, verifies `SHA256SUMS`, attests every asset, publishes the release, and tests the public installer.

Re-run an existing release without replacing its assets:

```sh
gh workflow run release.yml -f tag=vX.Y.Z
```

Verify a downloaded public release with:

```sh
gh attestation verify ./norms-darwin-arm64 -R gsttm/norms
```
