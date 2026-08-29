#!/bin/sh
set -eu

fail() {
  printf 'norms installer: %s\n' "$1" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required"

version="${NORMS_VERSION:-latest}"
if [ "$version" != "latest" ]; then
  version="${version#v}"
  printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$' || fail "invalid version: $version"
  version="v$version"
fi

case "$(uname -s)" in
  Darwin) os="darwin" ;;
  Linux) os="linux" ;;
  *) fail "unsupported operating system: $(uname -s)" ;;
esac

case "$(uname -m)" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64) arch="x64" ;;
  *) fail "unsupported architecture: $(uname -m)" ;;
esac

asset="norms-$os-$arch"
starter="norms-meta-norms.json"
base="${NORMS_RELEASES_URL:-https://github.com/gsttm/norms/releases}"
base="${base%/}"
if [ "$version" = "latest" ]; then
  release="$base/latest/download"
else
  release="$base/download/$version"
fi

temporary="$(mktemp -d "${TMPDIR:-/tmp}/norms.XXXXXX")"
cleanup() {
  [ -n "${temporary:-}" ] && rm -rf "$temporary"
}
trap cleanup 0 HUP INT TERM

download() {
  case "$1" in
    https://*) curl --proto '=https' --tlsv1.2 --retry 3 -fsSL "$1" -o "$2" ;;
    *) curl --retry 3 -fsSL "$1" -o "$2" ;;
  esac
}

download "$release/$asset" "$temporary/$asset"
download "$release/$starter" "$temporary/$starter"
download "$release/SHA256SUMS" "$temporary/SHA256SUMS"

verify() {
  expected="$(awk -v asset="$1" '$2 == asset { print $1 }' "$temporary/SHA256SUMS")"
  [ -n "$expected" ] || fail "checksum missing for $1"
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$temporary/$1" | awk '{ print $1 }')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$temporary/$1" | awk '{ print $1 }')"
  else
    fail "sha256sum or shasum is required"
  fi
  [ "$actual" = "$expected" ] || fail "checksum verification failed for $1"
}

verify "$asset"
verify "$starter"

install_dir="${NORMS_INSTALL_DIR:-${XDG_BIN_HOME:-${HOME:?HOME is required}/.local/bin}}"
mkdir -p "$install_dir"
install -m 0755 "$temporary/$asset" "$install_dir/norms"
cache_dir="${NORMS_CACHE_DIR:-${XDG_CACHE_HOME:-${HOME:?HOME is required}/.cache}/norms}"
mkdir -p "$cache_dir"
install -m 0644 "$temporary/$starter" "$cache_dir/meta-norms.json"
"$install_dir/norms" --version

case ":${PATH:-}:" in
  *":$install_dir:"*) ;;
  *) printf 'Add %s to PATH to run norms.\n' "$install_dir" >&2 ;;
esac
