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

The tag workflow repeats verification, builds macOS, Linux, and Windows binaries for x64 and arm64, writes `SHA256SUMS`, adds provenance attestations for public repositories, and publishes a GitHub Release.

Verify a downloaded public release with:

```sh
gh attestation verify ./norms-darwin-arm64 -R gsttm/norms
```
