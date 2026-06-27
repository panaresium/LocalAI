Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone0"
$DotnetHome = Join-Path $Root "artifacts\dotnet"
$Project = Join-Path $Root "services\windows-control-broker\HermesLocalAI.WindowsBroker.csproj"
$NuGetConfig = Join-Path $Root "NuGet.Config"
$OutputPath = Join-Path $Artifacts "windows-broker.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null
New-Item -ItemType Directory -Force -Path $DotnetHome | Out-Null

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
    sdkAvailable = $false
    build = $null
    windowList = $null
    uiTree = $null
    errors = @()
}

$dotnet = Get-Command "dotnet" -ErrorAction SilentlyContinue
if ($null -eq $dotnet) {
    $result.errors += "dotnet command not found."
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    $result | ConvertTo-Json -Depth 8
    exit 1
}

$sdkOutput = & $dotnet.Source --list-sdks 2>&1 | Out-String
$result.sdkAvailable = -not [string]::IsNullOrWhiteSpace($sdkOutput)
if (-not $result.sdkAvailable) {
    $result.errors += ".NET SDK not installed. A .NET runtime is present, but building the broker requires SDK 8.x."
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    $result | ConvertTo-Json -Depth 8
    exit 1
}

$restoreOutput = & $dotnet.Source restore $Project --configfile $NuGetConfig 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    $result.build = [ordered]@{
        exitCode = $LASTEXITCODE
        output = $restoreOutput.Trim()
    }
    $result.errors += "Broker restore failed."
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    $result | ConvertTo-Json -Depth 8
    exit 1
}

$buildOutput = & $dotnet.Source build $Project --configuration Release --no-restore 2>&1 | Out-String
$result.build = [ordered]@{
    exitCode = $LASTEXITCODE
    output = ($restoreOutput.Trim() + "`n" + $buildOutput.Trim()).Trim()
}
if ($LASTEXITCODE -ne 0) {
    $result.errors += "Broker build failed."
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    $result | ConvertTo-Json -Depth 8
    exit 1
}

$binary = Join-Path $Root "services\windows-control-broker\bin\Release\net8.0-windows\HermesLocalAI.WindowsBroker.exe"
$windowListOutput = & $binary "window.list" 2>&1 | Out-String
$result.windowList = [ordered]@{
    exitCode = $LASTEXITCODE
    output = $windowListOutput.Trim()
}
if ($LASTEXITCODE -ne 0) {
    $result.errors += "window.list failed."
}

$uiTreeOutput = & $binary "ui.get_tree" "--max-depth" "2" "--max-nodes" "40" 2>&1 | Out-String
$result.uiTree = [ordered]@{
    exitCode = $LASTEXITCODE
    output = $uiTreeOutput.Trim()
}
if ($LASTEXITCODE -ne 0) {
    $result.errors += "ui.get_tree failed."
}

$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
$result | ConvertTo-Json -Depth 8

if ($result.errors.Count -gt 0) {
    exit 1
}
