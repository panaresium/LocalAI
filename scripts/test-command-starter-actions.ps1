Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux28"
$OutputPath = Join-Path $Artifacts "command-starter-actions.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux28/command-starter-actions.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function applyCommandStarter");
const functionEnd = appSource.indexOf("async function createCommandPlan", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const inputIndex = appSource.indexOf('className="text-field command-input"');
const starterIndex = appSource.indexOf('aria-label="Command starter actions"');
const safetyIndex = appSource.indexOf('aria-label="Command safety preview"');

check(appSource.includes("type CommandStarterAction"), "Renderer must define typed starter actions.");
check(appSource.includes('readonly id: "backup" | "knowledge" | "automation" | "app"'), "Starter actions must use fixed ids.");
check(appSource.includes("const COMMAND_STARTER_ACTIONS: readonly CommandStarterAction[]"), "Renderer must define starter action data.");
check(appSource.includes('command: "Create a backup and prepare a restore plan"'), "Starter actions must include backup command.");
check(appSource.includes('command: "Search local knowledge for project status"'), "Starter actions must include knowledge command.");
check(appSource.includes('command: "Schedule a dry-run automation for STATUS.md"'), "Starter actions must include automation command.");
check(appSource.includes('command: "Open an app adapter plan for the target desktop app"'), "Starter actions must include app adapter command.");
check(appSource.includes("function applyCommandStarter(starter: CommandStarterAction): void"), "Renderer must define starter apply helper.");
check(functionBlock.includes("setCommandText(starter.command)"), "Starter helper must fill command text.");
check(functionBlock.includes("setCommandMessage(`Loaded ${starter.label} starter"), "Starter helper must explain local load.");
check(functionBlock.includes("setCommandHandoffMessage(null)"), "Starter helper must clear stale handoff message.");
check(!functionBlock.includes("createCommandPlan("), "Starter helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Starter helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Starter helper must not open a workspace.");
check(appSource.includes('aria-label="Command starter actions"'), "Starter actions must be accessible.");
check(appSource.includes("COMMAND_STARTER_ACTIONS.map((starter) =>"), "Renderer must render starter actions.");
check(appSource.includes("onClick={() => applyCommandStarter(starter)}"), "Starter buttons must only apply starter commands.");
check(inputIndex >= 0 && starterIndex > inputIndex, "Starter actions must render after command input.");
check(starterIndex >= 0 && safetyIndex > starterIndex, "Starter actions must render before safety preview.");
check(styleSource.includes(".command-starter-actions"), "Starter action CSS missing.");
check(styleSource.includes(".command-starter-actions button"), "Starter action button CSS missing.");
check(styleSource.includes(".command-starter-actions button:hover"), "Starter action hover CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  starters: ["backup", "knowledge", "automation", "app"],
  fillsComposerOnly: true,
  approvalUnchanged: true,
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
            errors = @("Command starter actions validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
