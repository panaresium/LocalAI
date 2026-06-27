<#
.SYNOPSIS
  Build and launch the Hermes Local AI Studio desktop shell.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\start-studio-desktop.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\start-studio-desktop.ps1 -NoBuild
#>
param(
    [switch]$NoBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$pnpmWrapper = Join-Path $PSScriptRoot "pnpm.ps1"

if (-not $NoBuild) {
    powershell -NoProfile -ExecutionPolicy Bypass -File $pnpmWrapper --filter "@hermes-local-ai/studio-desktop" build
    if ($LASTEXITCODE -ne 0) {
        throw "Desktop build failed."
    }
}

powershell -NoProfile -ExecutionPolicy Bypass -File $pnpmWrapper --filter "@hermes-local-ai/studio-desktop" start
exit $LASTEXITCODE
