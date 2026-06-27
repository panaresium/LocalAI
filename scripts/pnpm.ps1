<#
.SYNOPSIS
  Run the pinned project pnpm without requiring pnpm on PATH.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\pnpm.ps1 --version

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\pnpm.ps1 --filter @hermes-local-ai/studio-desktop start
#>
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$PnpmArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$nodeModules = (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules")
if (Test-Path -LiteralPath $nodeModules) {
    $env:NODE_PATH = $nodeModules
}

function Resolve-PnpmRunner {
    $pnpm = Get-Command "pnpm" -ErrorAction SilentlyContinue
    if ($null -ne $pnpm) {
        return [ordered]@{
            FilePath = $pnpm.Source
            ArgsPrefix = @()
            Label = $pnpm.Source
        }
    }

    $bundledPnpm = (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd")
    if (Test-Path -LiteralPath $bundledPnpm) {
        return [ordered]@{
            FilePath = $bundledPnpm
            ArgsPrefix = @()
            Label = $bundledPnpm
        }
    }

    if ($null -ne (Get-Command "corepack" -ErrorAction SilentlyContinue)) {
        return [ordered]@{
            FilePath = "corepack"
            ArgsPrefix = @("pnpm")
            Label = "corepack pnpm"
        }
    }

    throw "pnpm 11.7.0 is required but was not found. Run scripts\repair-milestone0-prereqs.ps1 -InstallNodeDeps or install pnpm 11.7.0."
}

$runner = Resolve-PnpmRunner
& $runner.FilePath @($runner.ArgsPrefix + $PnpmArgs)
exit $LASTEXITCODE
