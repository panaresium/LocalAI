Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux23"
$OutputPath = Join-Path $Artifacts "command-draft-summary.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux23/command-draft-summary.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandDraftSummary");
const functionEnd = appSource.indexOf("function pluralize", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const meterIndex = appSource.indexOf('aria-label="Command readiness meter"');
const summaryIndex = appSource.indexOf('aria-label="Command draft summary"');
const routeIndex = appSource.indexOf('aria-label="Command route preview"');

check(appSource.includes('type CommandDraftSummaryTone = "empty" | "blocked" | "ready"'), "Renderer must define typed draft summary tones.");
check(appSource.includes("type CommandDraftSummary"), "Renderer must define draft summary shape.");
check(appSource.includes("readonly objective: string"), "Draft summary must expose objective.");
check(appSource.includes("readonly target: string"), "Draft summary must expose target.");
check(appSource.includes("readonly approval: string"), "Draft summary must expose approval.");
check(appSource.includes("readonly execution: string"), "Draft summary must expose execution.");
check(appSource.includes("readonly handoff: string"), "Draft summary must expose handoff.");
check(appSource.includes("function buildCommandDraftSummary("), "Renderer must build draft summary locally.");
check(functionBlock.includes("const trimmedCommand = command.trim()"), "Draft summary must trim command text.");
check(functionBlock.includes("const targetWorkspace = workspaceLabel(routePreview.workspace)"), "Draft summary must show target workspace.");
check(functionBlock.includes("const hasBlockers = blockedTerms.length > 0"), "Draft summary must include blocker state.");
check(functionBlock.includes("const approval = hasBlockers"), "Draft summary must derive approval state.");
check(functionBlock.includes('"Approval blocked"'), "Draft summary must cover blocked approval.");
check(functionBlock.includes('"Approval required"'), "Draft summary must cover required approval.");
check(functionBlock.includes('"Approval policy unavailable"'), "Draft summary must cover missing approval policy.");
check(functionBlock.includes('const execution = silentExecutionAllowed ? "Silent execution allowed by policy" : "No automatic execution"'), "Draft summary must explain execution posture.");
check(functionBlock.includes('title: "Draft waiting"'), "Draft summary must cover empty command state.");
check(functionBlock.includes('objective: "Enter a command to preview plan"'), "Draft summary must explain empty command state.");
check(functionBlock.includes("title: `${routePreview.intentLabel} draft`"), "Draft summary must show route intent.");
check(functionBlock.includes("objective: limitCommandDraft(trimmedCommand, 96)"), "Draft summary must bound objective text.");
check(functionBlock.includes("handoff: hasBlockers || !requiresApproval ? \"No handoff until revised\" : `Open ${targetWorkspace} after approval`"), "Draft summary must explain handoff state.");
check(!functionBlock.includes("createCommandPlan("), "Draft summary helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Draft summary helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Draft summary helper must not open a workspace.");
check(appSource.includes("const commandDraftSummary = buildCommandDraftSummary("), "Renderer must derive draft summary.");
check(appSource.includes('aria-label="Command draft summary"'), "Draft summary must be accessible.");
check(appSource.includes("commandDraftSummary.objective"), "Draft summary must render objective.");
check(appSource.includes("commandDraftSummary.approval"), "Draft summary must render approval.");
check(appSource.includes("commandDraftSummary.execution"), "Draft summary must render execution.");
check(appSource.includes("commandDraftSummary.handoff"), "Draft summary must render handoff.");
check(meterIndex >= 0 && summaryIndex > meterIndex, "Draft summary must render after readiness meter.");
check(summaryIndex >= 0 && routeIndex > summaryIndex, "Draft summary must render before route preview.");
check(styleSource.includes(".command-draft-summary"), "Draft summary CSS missing.");
check(styleSource.includes(".command-draft-summary.ready"), "Ready draft summary CSS missing.");
check(styleSource.includes(".command-draft-summary.blocked"), "Blocked draft summary CSS missing.");
check(styleSource.includes(".command-draft-summary.empty"), "Empty draft summary CSS missing.");
check(styleSource.includes(".command-draft-summary-grid"), "Draft summary grid CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  summary: ["objective", "target", "approval", "execution", "handoff"],
  tones: ["empty", "blocked", "ready"],
  localOnly: true,
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
            errors = @("Command draft summary validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
