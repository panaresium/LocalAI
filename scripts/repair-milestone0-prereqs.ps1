<#
.SYNOPSIS
  Repair Milestone 0 prerequisites that cannot be fixed from the Codex sandbox.

.DESCRIPTION
  This script is intended to be run by the user in a normal PowerShell terminal
  from D:\LocalAI. It avoids secrets, destructive actions, elevation tricks, and
  autonomous credential/MFA/payment steps.

  By default it checks prerequisites and prints exact next steps. Use the opt-in
  switches to install Node dependencies and/or the .NET 8 SDK.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\repair-milestone0-prereqs.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\repair-milestone0-prereqs.ps1 -InstallNodeDeps -InstallDotNetSdk -RunValidation
#>
param(
    [switch]$InstallNodeDeps,
    [switch]$InstallDotNetSdk,
    [switch]$RunHermesProbe,
    [switch]$RunValidation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Test-Command {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    Write-Host "$FilePath $($Arguments -join ' ')" -ForegroundColor DarkGray
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
    }
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

    if (Test-Command "corepack") {
        Write-Host "pnpm is not on PATH. Trying Corepack without creating global shims..."
        & corepack prepare pnpm@11.7.0 --activate
        if ($LASTEXITCODE -eq 0) {
            & corepack pnpm --version | Out-Host
            if ($LASTEXITCODE -eq 0) {
                return [ordered]@{
                    FilePath = "corepack"
                    ArgsPrefix = @("pnpm")
                    Label = "corepack pnpm"
                }
            }
        }
    }

    if (Test-Command "npx") {
        Write-Host "pnpm is not on PATH. Falling back to npx pnpm@11.7.0 without global install..."
        return [ordered]@{
            FilePath = "npx"
            ArgsPrefix = @("--yes", "pnpm@11.7.0")
            Label = "npx --yes pnpm@11.7.0"
        }
    }

    throw "pnpm is not on PATH and no non-admin fallback was found. Install pnpm 11.7.0 or rerun PowerShell as Administrator only if you accept global Node shim changes."
}

function Invoke-Pnpm {
    param(
        [object]$Runner,
        [string[]]$Arguments
    )

    Invoke-Checked $Runner.FilePath @($Runner.ArgsPrefix + $Arguments)
}

Write-Step "Checking Node and pnpm"
if (-not (Test-Command "node")) {
    throw "Node.js is not on PATH. Install Node.js 24.x or run the Hermes installer dependency repair first."
}
node --version

$pnpmRunner = Resolve-PnpmRunner
Write-Host "Using pnpm runner: $($pnpmRunner.Label)"
Invoke-Pnpm $pnpmRunner @("--version")

if ($InstallNodeDeps) {
    Write-Step "Installing pinned Node dependencies"
    Invoke-Pnpm $pnpmRunner @("install", "--ignore-scripts")
}
else {
    Write-Host "Skipping pnpm install. Re-run with -InstallNodeDeps to install pinned dependencies."
}

Write-Step "Checking .NET SDK"
$sdkList = (& dotnet --list-sdks 2>$null | Out-String).Trim()
if ([string]::IsNullOrWhiteSpace($sdkList)) {
    Write-Host ".NET SDK is missing. Runtimes alone are not enough to build the Windows broker." -ForegroundColor Yellow
    if ($InstallDotNetSdk) {
        if (-not (Test-Command "winget")) {
            throw "winget is unavailable. Install the .NET 8 SDK manually from https://dotnet.microsoft.com/download/dotnet/8.0"
        }

        Write-Host "Installing Microsoft .NET 8 SDK through winget. This may show a normal installer/UAC prompt." -ForegroundColor Yellow
        Invoke-Checked "winget" @(
            "install",
            "--id", "Microsoft.DotNet.SDK.8",
            "--source", "winget",
            "--accept-source-agreements",
            "--accept-package-agreements"
        )
    }
    else {
        Write-Host "Re-run with -InstallDotNetSdk or install .NET 8 SDK manually." -ForegroundColor Yellow
    }
}
else {
    Write-Host $sdkList
}

Write-Step "Checking Hermes"
$hermesCandidates = @(
    "hermes",
    (Join-Path $env:LOCALAPPDATA "hermes\hermes-agent\venv\Scripts\hermes.exe")
)
$hermes = $null
foreach ($candidate in $hermesCandidates) {
    if ($candidate -eq "hermes") {
        $command = Get-Command "hermes" -ErrorAction SilentlyContinue
        if ($null -ne $command) {
            $hermes = $command.Source
            break
        }
        continue
    }

    if (Test-Path -LiteralPath $candidate) {
        $hermes = $candidate
        break
    }
}

if ($null -eq $hermes) {
    throw "Hermes was not found. Install with: iex (irm https://hermes-agent.nousresearch.com/install.ps1)"
}

Write-Host "Hermes: $hermes"
& $hermes --version
if ($LASTEXITCODE -ne 0) {
    throw "Hermes was found but did not run successfully."
}

if ($RunHermesProbe) {
    Write-Step "Running Hermes single-query probe"
    $env:HERMES_MILESTONE0_RUN_CHAT = "1"
    node packages\hermes-client\src\probe.mjs
    if ($LASTEXITCODE -ne 0) {
        throw "Hermes probe failed. Check Hermes provider/model configuration with hermes setup or hermes model."
    }
}
else {
    Write-Host "Skipping Hermes chat probe. Re-run with -RunHermesProbe after Hermes provider/model setup is confirmed."
}

if ($RunValidation) {
    Write-Step "Running full Milestone 0 validation"
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-milestone0.ps1
    if ($LASTEXITCODE -ne 0) {
        throw "Milestone 0 validation still has failures. See artifacts\milestone0\run-summary.json and STATUS.md."
    }
}
else {
    Write-Host "Skipping full validation. Re-run with -RunValidation when prerequisite repair is complete."
}

Write-Host "`nDone." -ForegroundColor Green
