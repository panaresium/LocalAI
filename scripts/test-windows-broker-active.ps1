Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone8"
$DotnetHome = Join-Path $Root "artifacts\dotnet"
$Project = Join-Path $Root "services\windows-control-broker\HermesLocalAI.WindowsBroker.csproj"
$NuGetConfig = Join-Path $Root "NuGet.Config"
$OutputPath = Join-Path $Artifacts "windows-broker-active.json"
New-Item -ItemType Directory -Force -Path $Artifacts,$DotnetHome | Out-Null

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
Remove-Item Env:HERMES_BROKER_APPROVAL_TOKEN -ErrorAction SilentlyContinue

$result = [ordered]@{
    checkedAt = (Get-Date).ToString("o")
    project = $Project
    build = $null
    help = $null
    tokenRejections = @()
    emergencyStop = $null
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
        args = $Arguments
        exitCode = $LASTEXITCODE
        output = $output.Trim()
    }
}

$result.help = Invoke-Broker -Arguments @("--help")
if (
    $result.help.exitCode -ne 0 -or
    $result.help.output -notmatch "activeCommandsRequireApprovalToken" -or
    $result.help.output -notmatch "ui.invoke" -or
    $result.help.output -notmatch "keyboard.type" -or
    $result.help.output -notmatch "mouse.click"
) {
    $result.errors += "Broker help did not expose Milestone 8 token-gated active commands."
}

$activeChecks = @(
    @("ui.invoke", "--name", "blocked"),
    @("ui.set_value", "--name", "blocked", "--text", "blocked"),
    @("keyboard.type", "--text", "blocked"),
    @("keyboard.chord", "--chord", "TAB"),
    @("mouse.click", "--bounds", "10", "10", "20", "20")
)

foreach ($arguments in $activeChecks) {
    $capture = Invoke-Broker -Arguments $arguments
    $result.tokenRejections += $capture
    if ($capture.exitCode -eq 0 -or $capture.output -notmatch "approval token") {
        $result.errors += "Active command '$($arguments[0])' was not rejected without an approval token."
    }
}

$result.emergencyStop = Invoke-Broker -Arguments @("emergency.stop")
if ($result.emergencyStop.exitCode -ne 0 -or $result.emergencyStop.output -notmatch "Emergency stop acknowledged") {
    $result.errors += "Emergency stop command did not acknowledge without an approval token."
}

if ($result.errors.Count -gt 0) {
    Write-ResultAndExit 1
}

Write-ResultAndExit 0
