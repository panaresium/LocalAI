Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone7"
$CaptureDir = Join-Path $Artifacts "captures"
$DotnetHome = Join-Path $Root "artifacts\dotnet"
$Project = Join-Path $Root "services\windows-control-broker\HermesLocalAI.WindowsBroker.csproj"
$NuGetConfig = Join-Path $Root "NuGet.Config"
$OutputPath = Join-Path $Artifacts "windows-broker-observe.json"
New-Item -ItemType Directory -Force -Path $Artifacts,$CaptureDir,$DotnetHome | Out-Null

$env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = "1"
$env:NUGET_PACKAGES = Join-Path $DotnetHome "packages"
$env:NUGET_HTTP_CACHE_PATH = Join-Path $DotnetHome "http-cache"
$env:NUGET_SCRATCH = Join-Path $DotnetHome "scratch"
$env:APPDATA = Join-Path $DotnetHome "appdata"
$env:LOCALAPPDATA = Join-Path $DotnetHome "localappdata"
$env:TEMP = Join-Path $DotnetHome "temp"
$env:TMP = Join-Path $DotnetHome "temp"
New-Item -ItemType Directory -Force -Path $env:NUGET_PACKAGES,$env:NUGET_HTTP_CACHE_PATH,$env:NUGET_SCRATCH,$env:APPDATA,$env:LOCALAPPDATA,$env:TEMP | Out-Null

$result = [ordered]@{
    checkedAt = (Get-Date).ToString("o")
    project = $Project
    build = $null
    help = $null
    windowList = $null
    uiTree = $null
    screenCapture = $null
    highlight = $null
    blockedInput = $null
    errors = @()
}

function Write-ResultAndExit {
    param([int]$ExitCode)
    $result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    $result | ConvertTo-Json -Depth 10
    exit $ExitCode
}

$dotnet = Get-Command "dotnet" -ErrorAction SilentlyContinue
if ($null -eq $dotnet) {
    $result.errors += "dotnet command not found."
    Write-ResultAndExit 1
}

$restoreOutput = & $dotnet.Source restore $Project --configfile $NuGetConfig 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    $result.build = [ordered]@{
        exitCode = $LASTEXITCODE
        output = $restoreOutput.Trim()
    }
    $result.errors += "Broker restore failed."
    Write-ResultAndExit 1
}

$buildOutput = & $dotnet.Source build $Project --configuration Release --no-restore 2>&1 | Out-String
$result.build = [ordered]@{
    exitCode = $LASTEXITCODE
    output = ($restoreOutput.Trim() + "`n" + $buildOutput.Trim()).Trim()
}
if ($LASTEXITCODE -ne 0) {
    $result.errors += "Broker build failed."
    Write-ResultAndExit 1
}

$binary = Join-Path $Root "services\windows-control-broker\bin\Release\net8.0-windows\HermesLocalAI.WindowsBroker.exe"

function Invoke-Broker {
    param([string[]]$Arguments)
    $output = & $binary @Arguments 2>&1 | Out-String
    return [ordered]@{
        exitCode = $LASTEXITCODE
        output = $output.Trim()
    }
}

$result.help = Invoke-Broker -Arguments @("--help")
if ($result.help.exitCode -ne 0 -or $result.help.output -notmatch "screen.capture" -or $result.help.output -notmatch "ui.highlight") {
    $result.errors += "Broker help did not expose Milestone 7 observe commands."
}

$result.windowList = Invoke-Broker -Arguments @("window.list")
if ($result.windowList.exitCode -ne 0) {
    $result.errors += "window.list failed."
}
else {
    $windowPayload = $result.windowList.output | ConvertFrom-Json
    if ($windowPayload.observeOnly -ne $true -or $windowPayload.command -ne "window.list") {
        $result.errors += "window.list did not return observe-only metadata."
    }
}

$result.uiTree = Invoke-Broker -Arguments @("ui.get_tree", "--max-depth", "2", "--max-nodes", "40")
if ($result.uiTree.exitCode -ne 0) {
    $result.errors += "ui.get_tree failed."
}
else {
    $treePayload = $result.uiTree.output | ConvertFrom-Json
    if ($treePayload.observeOnly -ne $true -or $treePayload.command -ne "ui.get_tree" -or $null -eq $treePayload.nodes) {
        $result.errors += "ui.get_tree did not return observe-only nodes."
    }
}

$screenPath = Join-Path $CaptureDir "screen-capture.png"
$result.screenCapture = Invoke-Broker -Arguments @("screen.capture", "--output", $screenPath)
if ($result.screenCapture.exitCode -ne 0 -or -not (Test-Path -LiteralPath $screenPath) -or (Get-Item -LiteralPath $screenPath).Length -le 0) {
    $result.errors += "screen.capture did not create a PNG artifact."
}
else {
    $screenPayload = $result.screenCapture.output | ConvertFrom-Json
    if ($screenPayload.observeOnly -ne $true -or $screenPayload.command -ne "screen.capture") {
        $result.errors += "screen.capture did not return observe-only metadata."
    }
}

$highlightPath = Join-Path $CaptureDir "highlight-capture.png"
$result.highlight = Invoke-Broker -Arguments @("ui.highlight", "--bounds", "10", "10", "160", "90", "--output", $highlightPath)
if ($result.highlight.exitCode -ne 0 -or -not (Test-Path -LiteralPath $highlightPath) -or (Get-Item -LiteralPath $highlightPath).Length -le 0) {
    $result.errors += "ui.highlight did not create a PNG artifact."
}
else {
    $highlightPayload = $result.highlight.output | ConvertFrom-Json
    if ($highlightPayload.observeOnly -ne $true -or $highlightPayload.command -ne "ui.highlight" -or $null -eq $highlightPayload.highlightBounds) {
        $result.errors += "ui.highlight did not return observe-only highlight metadata."
    }
}

$result.blockedInput = Invoke-Broker -Arguments @("keyboard.type", "blocked")
if ($result.blockedInput.exitCode -eq 0) {
    $result.errors += "Active keyboard command was not rejected."
}

if ($result.errors.Count -gt 0) {
    Write-ResultAndExit 1
}

Write-ResultAndExit 0
