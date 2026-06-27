Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux33"
$OutputPath = Join-Path $Artifacts "command-focus-bar.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux33/command-focus-bar.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandFocusBar");
const functionEnd = appSource.indexOf("function pluralize", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const workspaceIndex = appSource.indexOf('aria-label="Command Center"');
const focusIndex = appSource.indexOf('aria-label="Command focus bar"');
const commandPanelIndex = appSource.indexOf('className="command-panel"');

check(appSource.includes('type CommandFocusBarTone = "idle" | "ready" | "review" | "blocked" | "handoff"'), "Renderer must define typed command focus bar tones.");
check(appSource.includes("type CommandFocusBar"), "Renderer must define command focus bar shape.");
check(appSource.includes("readonly objective: string"), "Focus bar must include objective.");
check(appSource.includes("readonly next: string"), "Focus bar must include next.");
check(appSource.includes("readonly review: string"), "Focus bar must include review.");
check(appSource.includes("readonly approval: string"), "Focus bar must include approval.");
check(appSource.includes("readonly handoff: string"), "Focus bar must include handoff.");
check(appSource.includes("function buildCommandFocusBar("), "Renderer must define focus bar helper.");
check(appSource.includes("): CommandFocusBar"), "Focus bar helper must return typed bar.");
check(functionBlock.includes('objective = command.trim() ? limitCommandDraft(command.trim(), 96) : "No command entered"'), "Focus bar must summarize the current command objective.");
check(functionBlock.includes('nextStep.tone === "blocked" || reviewQueue.tone === "blocked"'), "Focus bar must cover blocked command or review states.");
check(functionBlock.includes('tone: "blocked"'), "Focus bar must expose blocked tone.");
check(functionBlock.includes('selectedPlan?.status === "approved" || reviewQueue.label === "Approved handoff"'), "Focus bar must cover approved handoff states.");
check(functionBlock.includes('tone: "handoff"'), "Focus bar must expose handoff tone.");
check(functionBlock.includes('reviewQueue.tone === "ready"'), "Focus bar must cover review-ready queue state.");
check(functionBlock.includes('tone: "review"'), "Focus bar must expose review tone.");
check(functionBlock.includes('nextStep.tone === "ready"'), "Focus bar must cover ready-to-plan state.");
check(functionBlock.includes('tone: "ready"'), "Focus bar must expose ready tone.");
check(functionBlock.includes('tone: "idle"'), "Focus bar must expose idle fallback.");
check(!functionBlock.includes("createCommandPlan("), "Focus bar helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Focus bar helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Focus bar helper must not open a workspace.");
check(appSource.includes("const commandFocusBar = buildCommandFocusBar("), "Renderer must derive command focus bar.");
check(appSource.includes("commandText,\n    commandNextStep,\n    commandReviewQueueSummary,\n    selectedCommandPlan"), "Focus bar must derive from command, next step, queue, and selected plan.");
check(appSource.includes('aria-label="Command focus bar"'), "Focus bar must be accessible.");
check(appSource.includes("commandFocusBar.objective"), "Renderer must render focus objective.");
check(appSource.includes("commandFocusBar.next"), "Renderer must render focus next action.");
check(appSource.includes("commandFocusBar.review"), "Renderer must render focus review target.");
check(appSource.includes("commandFocusBar.approval"), "Renderer must render focus approval guard.");
check(appSource.includes("commandFocusBar.handoff"), "Renderer must render focus handoff state.");
check(workspaceIndex >= 0 && focusIndex > workspaceIndex, "Focus bar must render inside Command workspace.");
check(focusIndex >= 0 && commandPanelIndex > focusIndex, "Focus bar must render before the command panel.");
check(styleSource.includes(".command-focus-bar"), "Focus bar CSS missing.");
check(styleSource.includes("grid-column: 1 / -1"), "Focus bar must span the command workspace grid.");
check(styleSource.includes("repeat(auto-fit, minmax(150px, 1fr))"), "Focus bar must use responsive columns.");
check(styleSource.includes(".command-focus-bar.ready"), "Ready focus bar CSS missing.");
check(styleSource.includes(".command-focus-bar.review"), "Review focus bar CSS missing.");
check(styleSource.includes(".command-focus-bar.blocked"), "Blocked focus bar CSS missing.");
check(styleSource.includes(".command-focus-bar.handoff"), "Handoff focus bar CSS missing.");
check(styleSource.includes(".command-focus-bar.idle"), "Idle focus bar CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  tones: ["idle", "ready", "review", "blocked", "handoff"],
  fields: ["objective", "next", "review", "approval", "handoff"],
  displayOnly: true,
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
            errors = @("Command focus bar validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
