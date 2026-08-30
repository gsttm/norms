#!/bin/sh
set -eu

fail() {
  printf 'norms installer: %s\n' "$1" >&2
  exit 1
}

panel_border() {
  printf '%s' "$1"
  panel_count=0
  while [ "$panel_count" -lt 76 ]; do
    printf '─'
    panel_count=$((panel_count + 1))
  done
  printf '%s\n' "$2"
}

panel_line() {
  printf '│ %-74.74s │\n' "$1"
}

panel_log() {
  fold -w 74 "$1" | while IFS= read -r panel_log_line || [ -n "$panel_log_line" ]; do
    panel_line "$panel_log_line"
  done
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
vscode_asset="norms-vscode.vsix"
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

checksum_valid() {
  expected="$(awk -v asset="$1" '$2 == asset { print $1 }' "$temporary/SHA256SUMS")"
  [ -n "$expected" ] || return 1
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$temporary/$1" | awk '{ print $1 }')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$temporary/$1" | awk '{ print $1 }')"
  else
    fail "sha256sum or shasum is required"
  fi
  [ "$actual" = "$expected" ]
}

checksum_valid "$asset" || fail "checksum verification failed for $asset"
checksum_valid "$starter" || fail "checksum verification failed for $starter"

install_dir="${NORMS_INSTALL_DIR:-${XDG_BIN_HOME:-${HOME:?HOME is required}/.local/bin}}"
mkdir -p "$install_dir"
install -m 0755 "$temporary/$asset" "$install_dir/norms"
cache_dir="${NORMS_CACHE_DIR:-${XDG_CACHE_HOME:-${HOME:?HOME is required}/.cache}/norms}"
mkdir -p "$cache_dir"
install -m 0644 "$temporary/$starter" "$cache_dir/meta-norms.json"
installed_title="$("$install_dir/norms" --version)"
panel_border '╭' '╮'
panel_line "$installed_title"
panel_line ""

install_vscode="${NORMS_INSTALL_VSCODE:-ask}"
if [ "$install_vscode" = "ask" ]; then
  answer=""
  prompted="no"
  prompt='Install the Norms VS Code extension? [y/N] '
  if [ -t 0 ] && [ -t 1 ]; then
    printf '│ %s' "$prompt"
    if ! IFS= read -r answer; then answer=""; printf '\n'; fi
    printf '\033[1A\r'
    panel_line "$prompt$answer"
    prompted="yes"
  elif [ -t 1 ] && [ -r /dev/tty ]; then
    printf '│ %s' "$prompt"
    if IFS= read -r answer 2>/dev/null < /dev/tty; then
      prompted="yes"
    else
      answer=""
      printf '\n'
    fi
    printf '\033[1A\r'
    panel_line "$prompt$answer"
  fi
  if [ "$prompted" = "yes" ]; then
    case "$answer" in
      y|Y|yes|YES|Yes) install_vscode="yes" ;;
      *) install_vscode="no" ;;
    esac
  else
    install_vscode="no"
    extension_message="VS Code extension skipped: no interactive terminal."
  fi
fi

extension_details=""
extension_message="${extension_message:-}"
case "$install_vscode" in
  1|y|Y|yes|YES|true|TRUE)
    code_command="${NORMS_CODE_COMMAND:-}"
    if [ -z "$code_command" ]; then
      if command -v code >/dev/null 2>&1; then
        code_command="$(command -v code)"
      elif [ -x "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" ]; then
        code_command="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
      fi
    elif command -v "$code_command" >/dev/null 2>&1; then
      code_command="$(command -v "$code_command")"
    elif [ ! -x "$code_command" ]; then
      code_command=""
    fi
    if [ -z "$code_command" ]; then
      extension_message="VS Code was not found; extension installation skipped."
    elif ! download "$release/$vscode_asset" "$temporary/$vscode_asset" 2>"$temporary/vscode-download.log"; then
      extension_message="VS Code extension download failed; CLI remains installed."
      extension_details="$temporary/vscode-download.log"
    elif ! checksum_valid "$vscode_asset"; then
      extension_message="VS Code extension checksum failed; CLI remains installed."
    elif NODE_NO_WARNINGS=1 "$code_command" --install-extension "$temporary/$vscode_asset" --force >"$temporary/vscode-install.log" 2>&1; then
      extension_message="Installed the Norms VS Code extension."
    else
      extension_message="VS Code extension installation failed; CLI remains installed."
      extension_details="$temporary/vscode-install.log"
    fi
    ;;
  0|n|N|no|NO|false|FALSE)
    extension_message="VS Code extension skipped."
    ;;
  *) extension_message="Invalid VS Code option; extension installation skipped." ;;
esac

panel_line ""
panel_line "$extension_message"
if [ -n "$extension_details" ] && [ -s "$extension_details" ]; then
  panel_line "VS Code output:"
  panel_log "$extension_details"
fi
case ":${PATH:-}:" in
  *":$install_dir:"*) ;;
  *) panel_line "Add $install_dir to PATH to run norms." ;;
esac
panel_border '╰' '╯'
