param(
  [string]$Version = $env:NORMS_VERSION
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Fail([string]$Message) {
  throw "norms installer: $Message"
}

if (-not $Version) { $Version = "latest" }
if ($Version -ne "latest") {
  $Version = $Version.TrimStart("v")
  if ($Version -notmatch '^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$') { Fail "invalid version: $Version" }
  $Version = "v$Version"
}

$architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
$asset = switch ($architecture) {
  "X64" { "norms-windows-x64.exe" }
  "Arm64" { "norms-windows-arm64.exe" }
  default { Fail "unsupported architecture: $architecture" }
}

$base = if ($env:NORMS_RELEASES_URL) { $env:NORMS_RELEASES_URL.TrimEnd('/') } else { "https://github.com/gsttm/norms/releases" }
$release = if ($Version -eq "latest") { "$base/latest/download" } else { "$base/download/$Version" }
$installDir = if ($env:NORMS_INSTALL_DIR) { $env:NORMS_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "Programs\Norms" }
$cacheRoot = if ($env:NORMS_CACHE_DIR) { $env:NORMS_CACHE_DIR } else { Join-Path $env:LOCALAPPDATA "Norms\Cache" }
$temporary = Join-Path ([System.IO.Path]::GetTempPath()) ("norms." + [guid]::NewGuid())

function Download([string]$Name, [string]$Destination) {
  $source = "$release/$Name"
  if ($source -match '^https://') {
    Invoke-WebRequest -UseBasicParsing $source -OutFile $Destination
  } elseif (Test-Path (Join-Path $release $Name)) {
    Copy-Item (Join-Path $release $Name) $Destination
  } else {
    Fail "download URL must use HTTPS"
  }
}

try {
  New-Item -ItemType Directory -Force $temporary | Out-Null
  Download $asset (Join-Path $temporary $asset)
  Download "norms-meta-norms.json" (Join-Path $temporary "norms-meta-norms.json")
  Download "SHA256SUMS" (Join-Path $temporary "SHA256SUMS")

  $checksums = Get-Content (Join-Path $temporary "SHA256SUMS")
  foreach ($name in @($asset, "norms-meta-norms.json")) {
    $line = $checksums | Where-Object { $_ -match "^[0-9a-fA-F]{64}\s+\*?$([regex]::Escape($name))$" } | Select-Object -First 1
    if (-not $line) { Fail "missing checksum for $name" }
    $expected = ($line -split '\s+')[0].ToLowerInvariant()
    $actual = (Get-FileHash (Join-Path $temporary $name) -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { Fail "checksum verification failed for $name" }
  }

  New-Item -ItemType Directory -Force $installDir, $cacheRoot | Out-Null
  Copy-Item (Join-Path $temporary $asset) (Join-Path $installDir "norms.exe") -Force
  Copy-Item (Join-Path $temporary "norms-meta-norms.json") (Join-Path $cacheRoot "meta-norms.json") -Force

  if ($env:NORMS_UPDATE_PATH -ne "no") {
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $parts = @($userPath -split ';' | Where-Object { $_ })
    if ($parts -notcontains $installDir) {
      [Environment]::SetEnvironmentVariable("Path", (($parts + $installDir) -join ';'), "User")
    }
  }

  $installVSCode = if ($env:NORMS_INSTALL_VSCODE) { $env:NORMS_INSTALL_VSCODE } else { "ask" }
  if ($installVSCode -eq "ask") {
    $answer = Read-Host "Install the Norms VS Code extension? [y/N]"
    $installVSCode = if ($answer -match '^(y|yes)$') { "yes" } else { "no" }
  }
  if ($installVSCode -match '^(1|y|yes|true)$') {
    $code = Get-Command ($(if ($env:NORMS_CODE_COMMAND) { $env:NORMS_CODE_COMMAND } else { "code" })) -ErrorAction SilentlyContinue
    if (-not $code) {
      Write-Warning "VS Code was not found; extension installation skipped."
    } else {
      try {
        Download "norms-vscode.vsix" (Join-Path $temporary "norms-vscode.vsix")
        $line = $checksums | Where-Object { $_ -match '^[0-9a-fA-F]{64}\s+\*?norms-vscode\.vsix$' } | Select-Object -First 1
        if (-not $line) { Fail "missing checksum for norms-vscode.vsix" }
        $expected = ($line -split '\s+')[0].ToLowerInvariant()
        $actual = (Get-FileHash (Join-Path $temporary "norms-vscode.vsix") -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $expected) { Fail "checksum verification failed for norms-vscode.vsix" }
        & $code.Source --install-extension (Join-Path $temporary "norms-vscode.vsix") --force
        if ($LASTEXITCODE -ne 0) { throw "code exited with $LASTEXITCODE" }
        Write-Host "Installed the Norms VS Code extension."
      } catch {
        Write-Warning "VS Code extension installation failed; the CLI remains installed. $($_.Exception.Message)"
      }
    }
  }

  Write-Host "Installed Norms to $(Join-Path $installDir 'norms.exe')."
  Write-Host "Restart PowerShell, then run: norms --version"
} finally {
  if (Test-Path $temporary) { Remove-Item -Recurse -Force $temporary }
}
