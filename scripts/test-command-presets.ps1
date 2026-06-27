Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux6"
$OutputPath = Join-Path $Artifacts "command-presets.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux6/command-presets.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const errors = [];
const presetIds = ["backup", "package", "knowledge", "automation", "app-adapter", "computer-control", "chat"];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes("type CommandPreset"), "Renderer must define typed command presets.");
check(appSource.includes("const COMMAND_PRESETS"), "Renderer must define local command presets.");
for (const id of presetIds) {
  check(appSource.includes(`id: "${id}"`), `Command preset missing ${id}.`);
}
check(appSource.includes("async function createCommandPlan(commandOverride?: string): Promise<void>"), "Command planner must accept an optional preset command.");
check(appSource.includes("const command = commandOverride ?? commandText"), "Command planner must use preset override or typed command.");
check(appSource.includes("setCommandText(command)"), "Preset commands must populate the command input.");
check(appSource.includes('className="command-preset-grid"'), "Renderer must render command presets.");
check(appSource.includes('aria-label="Command presets"'), "Command preset grid must be accessible.");
check(appSource.includes("COMMAND_PRESETS.map"), "Renderer must render every command preset.");
check(appSource.includes("createCommandPlan(preset.command)"), "Preset buttons must create approval-gated draft plans.");
check(!appSource.includes("reviewCommandPlan(preset"), "Preset buttons must not approve plans.");
check(styleSource.includes(".command-preset-grid"), "Command preset CSS missing.");
check(preloadSource.includes("createCommandPlan"), "Preset flow must use existing createCommandPlan bridge.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  presetIds,
  approvalGated: true,
  localOnly: true,
  errors
};
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) {
  process.exitCode = 1;
}
'@

$output = $nodeScript | node --input-type=module 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    if (-not (Test-Path -LiteralPath $OutputPath)) {
        [ordered]@{
            checkedAt = (Get-Date).ToString("o")
            errors = @("Command preset validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
