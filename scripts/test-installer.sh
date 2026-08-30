#!/bin/sh
set -eu

repository="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
temporary="$(mktemp -d "${TMPDIR:-/tmp}/norms-installer.XXXXXX")"
cleanup() {
  [ -n "${temporary:-}" ] && rm -rf "$temporary"
}
trap cleanup 0 HUP INT TERM

case "$(uname -s)" in
  Darwin) os="darwin" ;;
  Linux) os="linux" ;;
  *) printf 'Installer test skipped on %s.\n' "$(uname -s)"; exit 0 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64) arch="x64" ;;
  *) printf 'Installer test skipped on %s.\n' "$(uname -m)"; exit 0 ;;
esac

release="$temporary/releases/latest/download"
asset="norms-$os-$arch"
mkdir -p "$release"
printf '#!/bin/sh\nprintf "norms test\\n"\n' > "$release/$asset"
printf '{"version":1,"norms":[]}\n' > "$release/norms-meta-norms.json"
printf 'vsix test\n' > "$release/norms-vscode.vsix"
: > "$release/SHA256SUMS"
for file in "$asset" norms-meta-norms.json norms-vscode.vsix; do
  if command -v sha256sum >/dev/null 2>&1; then
    checksum="$(sha256sum "$release/$file" | awk '{ print $1 }')"
  else
    checksum="$(shasum -a 256 "$release/$file" | awk '{ print $1 }')"
  fi
  printf '%s  %s\n' "$checksum" "$file" >> "$release/SHA256SUMS"
done

NORMS_INSTALL_VSCODE=no NORMS_RELEASES_URL="file://$temporary/releases" NORMS_INSTALL_DIR="$temporary/bin" NORMS_CACHE_DIR="$temporary/cache" sh "$repository/install.sh" >/dev/null
[ "$("$temporary/bin/norms" --version)" = "norms test" ]
cmp "$release/norms-meta-norms.json" "$temporary/cache/meta-norms.json"

mkdir -p "$temporary/tools"
printf '#!/bin/sh\n[ "$NODE_NO_WARNINGS" = 1 ]\nprintf "simulated launcher warning\\n" >&2\n[ "$1" = "--install-extension" ]\n[ "${NORMS_CODE_FAIL:-0}" != 1 ] || exit 1\ncp "$2" "$NORMS_CODE_OUTPUT"\n[ "$3" = "--force" ]\n' > "$temporary/tools/code"
chmod +x "$temporary/tools/code"
NORMS_CODE_OUTPUT="$temporary/installed.vsix" NORMS_INSTALL_VSCODE=yes NORMS_RELEASES_URL="file://$temporary/releases" NORMS_INSTALL_DIR="$temporary/vscode-bin" NORMS_CACHE_DIR="$temporary/vscode-cache" PATH="$temporary/tools:$PATH" sh "$repository/install.sh" >"$temporary/installed.out" 2>&1
cmp "$release/norms-vscode.vsix" "$temporary/installed.vsix"
grep -q "│ norms test" "$temporary/installed.out"
grep -q "│ Installed the Norms VS Code extension." "$temporary/installed.out"
[ "$(tail -n 1 "$temporary/installed.out")" = "╰────────────────────────────────────────────────────────────────────────────╯" ]
if grep -q "simulated launcher warning" "$temporary/installed.out"; then
  printf 'Installer exposed successful VS Code launcher noise.\n' >&2
  exit 1
fi

NORMS_CODE_FAIL=1 NORMS_CODE_OUTPUT="$temporary/failed.vsix" NORMS_INSTALL_VSCODE=yes NORMS_RELEASES_URL="file://$temporary/releases" NORMS_INSTALL_DIR="$temporary/failed-bin" NORMS_CACHE_DIR="$temporary/failed-cache" PATH="$temporary/tools:$PATH" sh "$repository/install.sh" >"$temporary/failed.out" 2>&1
grep -q "extension installation failed; CLI remains installed" "$temporary/failed.out"
grep -q "simulated launcher warning" "$temporary/failed.out"
[ "$(tail -n 1 "$temporary/failed.out")" = "╰────────────────────────────────────────────────────────────────────────────╯" ]
[ "$("$temporary/failed-bin/norms" --version)" = "norms test" ]

NORMS_CODE_COMMAND="$temporary/missing-code" NORMS_INSTALL_VSCODE=yes NORMS_RELEASES_URL="file://$temporary/releases" NORMS_INSTALL_DIR="$temporary/no-code-bin" NORMS_CACHE_DIR="$temporary/no-code-cache" sh "$repository/install.sh" >"$temporary/no-code.out" 2>&1
grep -q "VS Code was not found; extension installation skipped" "$temporary/no-code.out"
[ "$("$temporary/no-code-bin/norms" --version)" = "norms test" ]

printf 'tampered\n' >> "$release/norms-vscode.vsix"
NORMS_CODE_OUTPUT="$temporary/tampered.vsix" NORMS_INSTALL_VSCODE=yes NORMS_RELEASES_URL="file://$temporary/releases" NORMS_INSTALL_DIR="$temporary/tampered-bin" NORMS_CACHE_DIR="$temporary/tampered-cache" PATH="$temporary/tools:$PATH" sh "$repository/install.sh" >"$temporary/tampered.out" 2>&1
grep -q "extension checksum failed; CLI remains installed" "$temporary/tampered.out"
[ "$("$temporary/tampered-bin/norms" --version)" = "norms test" ]
printf 'vsix test\n' > "$release/norms-vscode.vsix"

printf 'tampered\n' >> "$release/$asset"
if NORMS_INSTALL_VSCODE=no NORMS_RELEASES_URL="file://$temporary/releases" NORMS_INSTALL_DIR="$temporary/invalid" NORMS_CACHE_DIR="$temporary/invalid-cache" sh "$repository/install.sh" >/dev/null 2>&1; then
  printf 'Installer accepted a bad checksum.\n' >&2
  exit 1
fi

printf 'Installer test passed.\n'
