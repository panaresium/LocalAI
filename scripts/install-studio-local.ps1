param(
    [string]$TargetRoot = (Join-Path $env:LOCALAPPDATA "HermesLocalAIStudio"),
    [switch]$PlanOnly,
    [switch]$ConfirmInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Package = Get-Content -Raw -LiteralPath (Join-Path $Root "package.json") | ConvertFrom-Json
$Version = [string]$Package.version
$targetParent = Split-Path -Parent $TargetRoot
$targetLeaf = Split-Path -Leaf $TargetRoot
$resolvedParent = Resolve-Path -LiteralPath $targetParent -ErrorAction SilentlyContinue
$InstallRoot = if ($null -ne $resolvedParent) { Join-Path $resolvedParent.Path $targetLeaf } else { $TargetRoot }
$VersionRoot = Join-Path $InstallRoot $Version
$DistRoot = Join-Path $Root "apps\studio-desktop\dist"

function Get-StudioRelativePath {
    param(
        [string]$BasePath,
        [string]$FilePath
    )

    $baseFull = [System.IO.Path]::GetFullPath($BasePath).TrimEnd('\') + '\'
    $fileFull = [System.IO.Path]::GetFullPath($FilePath)
    if (-not $fileFull.StartsWith($baseFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "File is outside the Studio root: $FilePath"
    }
    return $fileFull.Substring($baseFull.Length)
}

if (-not (Test-Path -LiteralPath (Join-Path $DistRoot "main\main.js"))) {
    throw "Desktop build output is missing. Run the Milestone 16 packaging gate before installing."
}

$blockedRoots = @(
    $env:WINDIR,
    $env:ProgramFiles,
    ${env:ProgramFiles(x86)}
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { [System.IO.Path]::GetFullPath($_) }

$targetFullPath = [System.IO.Path]::GetFullPath($InstallRoot)
foreach ($blockedRoot in $blockedRoots) {
    if ($targetFullPath.StartsWith($blockedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "This local portable installer does not write to Windows or Program Files paths."
    }
}

$files = Get-ChildItem -LiteralPath $DistRoot -Recurse -File | ForEach-Object {
    $relative = Get-StudioRelativePath $Root.Path $_.FullName
    [ordered]@{
        source = $_.FullName
        destination = Join-Path $VersionRoot $relative
        sizeBytes = $_.Length
    }
}

$extraFiles = @(
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "scripts\start-studio-desktop.ps1"
)
foreach ($relative in $extraFiles) {
    $source = Join-Path $Root $relative
    if (Test-Path -LiteralPath $source) {
        $file = Get-Item -LiteralPath $source
        $files += [ordered]@{
            source = $file.FullName
            destination = Join-Path $VersionRoot $relative
            sizeBytes = $file.Length
        }
    }
}

$plan = [ordered]@{
    schemaVersion = 1
    appName = $Package.name
    version = $Version
    targetRoot = $InstallRoot
    versionRoot = $VersionRoot
    planOnly = [bool]$PlanOnly
    requiresUserConfirmation = $true
    silentInstallAllowed = $false
    destructiveDeleteAllowed = $false
    files = $files
}

if ($PlanOnly) {
    $plan | ConvertTo-Json -Depth 8
    exit 0
}

if (-not $ConfirmInstall) {
    throw "Refusing to install without -ConfirmInstall."
}

New-Item -ItemType Directory -Force -Path $VersionRoot | Out-Null
foreach ($file in $files) {
    $destinationDirectory = Split-Path -Parent $file.destination
    New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
    Copy-Item -LiteralPath $file.source -Destination $file.destination -Force
}

$manifestPath = Join-Path $VersionRoot "install-manifest.json"
$plan | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
[ordered]@{
    installed = $true
    manifestPath = $manifestPath
    versionRoot = $VersionRoot
} | ConvertTo-Json -Depth 4
