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
: > "$release/SHA256SUMS"
for file in "$asset" norms-meta-norms.json; do
  if command -v sha256sum >/dev/null 2>&1; then
    checksum="$(sha256sum "$release/$file" | awk '{ print $1 }')"
  else
    checksum="$(shasum -a 256 "$release/$file" | awk '{ print $1 }')"
  fi
  printf '%s  %s\n' "$checksum" "$file" >> "$release/SHA256SUMS"
done

NORMS_RELEASES_URL="file://$temporary/releases" NORMS_INSTALL_DIR="$temporary/bin" NORMS_CACHE_DIR="$temporary/cache" sh "$repository/install.sh" >/dev/null
[ "$("$temporary/bin/norms" --version)" = "norms test" ]
cmp "$release/norms-meta-norms.json" "$temporary/cache/meta-norms.json"

printf 'tampered\n' >> "$release/$asset"
if NORMS_RELEASES_URL="file://$temporary/releases" NORMS_INSTALL_DIR="$temporary/invalid" NORMS_CACHE_DIR="$temporary/invalid-cache" sh "$repository/install.sh" >/dev/null 2>&1; then
  printf 'Installer accepted a bad checksum.\n' >&2
  exit 1
fi

printf 'Installer test passed.\n'
