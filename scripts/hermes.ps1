<#
.SYNOPSIS
  Run the installed Hermes Agent executable without requiring it on PATH.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\hermes.ps1 --version

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\hermes.ps1 model
#>
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$HermesArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$candidates = @(
    (Join-Path $env:LOCALAPPDATA "hermes\hermes-agent\venv\Scripts\hermes.exe"),
    (Join-Path $env:LOCALAPPDATA "hermes\hermes-agent\venv\Scripts\hermes.cmd")
)

$command = Get-Command "hermes" -ErrorAction SilentlyContinue
if ($null -ne $command) {
    & $command.Source @HermesArgs
    exit $LASTEXITCODE
}

foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
        & $candidate @HermesArgs
        exit $LASTEXITCODE
    }
}

Write-Error "Hermes was not found on PATH or under $env:LOCALAPPDATA\hermes\hermes-agent\venv\Scripts."
exit 1
