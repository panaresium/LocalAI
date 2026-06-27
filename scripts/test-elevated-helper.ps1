Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\milestone14"
$DotnetHome = Join-Path $Root "artifacts\dotnet"
$Project = Join-Path $Root "services\elevated-helper\HermesLocalAI.ElevatedHelper.csproj"
$NuGetConfig = Join-Path $Root "NuGet.Config"
$OutputPath = Join-Path $Artifacts "elevated-helper.json"
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

$dotnet = Get-Command "dotnet" -ErrorAction SilentlyContinue
if ($null -eq $dotnet) {
    [ordered]@{
        checkedAt = (Get-Date).ToString("o")
        errors = @("dotnet command not found.")
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    exit 1
}

$restoreOutput = & $dotnet.Source restore $Project --configfile $NuGetConfig 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    [ordered]@{
        checkedAt = (Get-Date).ToString("o")
        restore = $restoreOutput.Trim()
        errors = @("Elevated helper restore failed.")
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    exit 1
}

$buildOutput = & $dotnet.Source build $Project --configuration Release --no-restore 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    [ordered]@{
        checkedAt = (Get-Date).ToString("o")
        restore = $restoreOutput.Trim()
        build = $buildOutput.Trim()
        errors = @("Elevated helper build failed.")
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    exit 1
}

$binary = Join-Path $Root "services\elevated-helper\bin\Release\net8.0-windows\HermesLocalAI.ElevatedHelper.exe"
$probeOutput = & $binary "probe" 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    [ordered]@{
        checkedAt = (Get-Date).ToString("o")
        restore = $restoreOutput.Trim()
        build = $buildOutput.Trim()
        probe = $probeOutput.Trim()
        errors = @("Elevated helper probe failed.")
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    exit 1
}

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outputPath = path.resolve("artifacts/milestone14/elevated-helper.json");
const probe = JSON.parse(process.env.HERMES_ELEVATED_HELPER_PROBE);
const managerModulePath = pathToFileURL(path.resolve("apps/studio-desktop/dist/main/elevated-helper-manager.js")).href;
const { ElevatedHelperManager } = await import(managerModulePath);
const manager = new ElevatedHelperManager(path.resolve("."));
const errors = [];
function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(probe.command === "helper.probe", "Helper probe command mismatch.");
check(probe.manualUacStartupOnly === true, "Helper probe must require manual UAC startup.");
check(probe.silentElevationAllowed === false, "Helper must not allow silent elevation.");
check(probe.secureDesktopAutomationAllowed === false, "Helper must not allow secure desktop automation.");

let state = manager.probeHelper();
check(state.policy.milestone === 14, "Elevated helper policy milestone is not 14.");
check(state.policy.manualUacStartupOnly === true, "Manual UAC startup policy missing.");
check(state.policy.silentElevationAllowed === false, "Silent elevation must be blocked.");
check(state.policy.secureDesktopAutomationAllowed === false, "Secure desktop automation must be blocked.");
check(state.policy.requiresSignedHelperForTrustedSession === true, "Signed helper trust policy missing.");
check(state.helper.exists === true, "Elevated helper binary was not detected after build.");
check(state.helper.signatureStatus === "unsigned", "Development helper should be unsigned.");
check(state.helper.trustedForElevatedSession === false, "Unsigned helper must not be trusted.");

state = manager.prepareLaunch({
  purpose: "Inspect elevated app state after explicit user approval.",
  durationMinutes: 5
});
const pending = state.sessions[0];
check(pending.status === "pending-manual-start", "Prepared session should be pending manual start.");
check(state.launchInstruction?.requiresManualUac === true, "Launch instruction should require manual UAC.");
check(state.launchInstruction?.powershellCommand.includes("Start-Process"), "Launch command should use Start-Process.");
check(state.launchInstruction?.powershellCommand.includes("-Verb RunAs"), "Launch command should use manual RunAs.");
check(!state.launchInstruction?.powershellCommand.toLowerCase().includes("bypass"), "Launch command must not bypass UAC.");

state = manager.confirmSession({
  sessionId: pending.id,
  approvalCode: pending.approvalCode,
  helperProcessId: probe.processId,
  helperElevated: true
});
check(state.sessions[0]?.status === "rejected", "Unsigned helper confirmation should be rejected.");
check(state.sessions[0]?.rejectionReason?.includes("not signed"), "Unsigned rejection reason missing.");

state = manager.prepareLaunch({
  purpose: "Short administrative context inspection.",
  durationMinutes: 1
});
const revokable = state.sessions[0];
state = manager.revokeSession({ sessionId: revokable.id, reason: "Validation revoke." });
check(state.sessions[0]?.status === "revoked", "Helper revoke failed.");

state = manager.prepareLaunch({
  purpose: "Temporary elevated inspection window.",
  durationMinutes: 1
});
const expiring = state.sessions[0];
state = manager.getState(new Date(Date.parse(expiring.expiresAt) + 1000));
check(state.sessions[0]?.status === "expired", "Helper session did not expire.");

try {
  manager.prepareLaunch({
    purpose: "Enter password into admin prompt",
    durationMinutes: 5
  });
  errors.push("Sensitive elevated helper purpose was not blocked.");
} catch (error) {
  check(String(error.message || error).includes("Sensitive"), "Unexpected sensitive purpose error.");
}

check(state.audit.length >= 5, "Expected elevated helper audit events.");

const result = {
  checkedAt: new Date().toISOString(),
  build: {
    project: path.resolve("services/elevated-helper/HermesLocalAI.ElevatedHelper.csproj"),
    binary: path.resolve("services/elevated-helper/bin/Release/net8.0-windows/HermesLocalAI.ElevatedHelper.exe")
  },
  probe,
  state,
  errors
};

fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) {
  process.exitCode = 1;
}
'@

$env:HERMES_ELEVATED_HELPER_PROBE = $probeOutput.Trim()
$output = $nodeScript | node --input-type=module 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    if (-not (Test-Path -LiteralPath $OutputPath)) {
        [ordered]@{
            checkedAt = (Get-Date).ToString("o")
            restore = $restoreOutput.Trim()
            build = $buildOutput.Trim()
            probe = $probeOutput.Trim()
            errors = @("Elevated helper validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
