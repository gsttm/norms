$ErrorActionPreference = "Stop"
$repository = Split-Path -Parent $PSScriptRoot
$temporary = Join-Path ([System.IO.Path]::GetTempPath()) ("norms-installer-test." + [guid]::NewGuid())

try {
  $release = Join-Path $temporary "releases\latest\download"
  New-Item -ItemType Directory -Force $release | Out-Null
  $architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
  $asset = if ($architecture -eq "Arm64") { "norms-windows-arm64.exe" } else { "norms-windows-x64.exe" }
  Set-Content -NoNewline (Join-Path $release $asset) "norms test"
  Set-Content -NoNewline (Join-Path $release "norms-meta-norms.json") '{"version":1,"norms":[]}'
  $lines = foreach ($name in @($asset, "norms-meta-norms.json")) {
    "$((Get-FileHash (Join-Path $release $name) -Algorithm SHA256).Hash.ToLowerInvariant())  $name"
  }
  Set-Content (Join-Path $release "SHA256SUMS") $lines

  $env:NORMS_RELEASES_URL = Join-Path $temporary "releases"
  $env:NORMS_INSTALL_DIR = Join-Path $temporary "bin"
  $env:NORMS_CACHE_DIR = Join-Path $temporary "cache"
  $env:NORMS_INSTALL_VSCODE = "no"
  $env:NORMS_UPDATE_PATH = "no"
  & (Join-Path $repository "install.ps1")

  if ((Get-Content -Raw (Join-Path $env:NORMS_INSTALL_DIR "norms.exe")) -ne "norms test") { throw "CLI asset mismatch" }
  if ((Get-Content -Raw (Join-Path $env:NORMS_CACHE_DIR "meta-norms.json")) -ne '{"version":1,"norms":[]}') { throw "cache asset mismatch" }

  Add-Content (Join-Path $release $asset) "tampered"
  $env:NORMS_INSTALL_DIR = Join-Path $temporary "invalid"
  try {
    & (Join-Path $repository "install.ps1")
    throw "Installer accepted a bad checksum"
  } catch {
    if ($_.Exception.Message -notmatch "checksum verification failed") { throw }
  }

  Write-Host "Windows installer test passed."
} finally {
  Remove-Item Env:NORMS_RELEASES_URL, Env:NORMS_INSTALL_DIR, Env:NORMS_CACHE_DIR, Env:NORMS_INSTALL_VSCODE, Env:NORMS_UPDATE_PATH -ErrorAction SilentlyContinue
  if (Test-Path $temporary) { Remove-Item -Recurse -Force $temporary }
}
