Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux19"
$OutputPath = Join-Path $Artifacts "command-step-summary.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux19/command-step-summary.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandStepSummary");
const functionEnd = appSource.indexOf("function summarizeCommandDecision", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes('type CommandStepSummaryTone = "ready" | "blocked" | "approved" | "rejected"'), "Renderer must define typed step summary tones.");
check(appSource.includes("type CommandStepSummary"), "Renderer must define step summary shape.");
check(appSource.includes("readonly stepCount: number"), "Step summary must include step count.");
check(appSource.includes("readonly approvalCount: number"), "Step summary must include approval count.");
check(appSource.includes("function buildCommandStepSummary(plan: CommandPlan): CommandStepSummary"), "Renderer must build step summary locally.");
check(functionBlock.includes("const approvalCount = plan.steps.filter((step) => step.requiresApproval).length"), "Step summary must count approval steps.");
check(functionBlock.includes('const firstStep = plan.steps[0]?.title ?? "No steps"'), "Step summary must surface first step.");
check(functionBlock.includes("stepCount: plan.steps.length"), "Step summary must expose step count.");
check(functionBlock.includes("handoff: `Will open ${handoffWorkspace}`"), "Draft step summary must show future handoff.");
check(functionBlock.includes("handoff: `Open ${handoffWorkspace}`"), "Approved step summary must show open handoff.");
check(functionBlock.includes("handoff: `Target was ${handoffWorkspace}`"), "Rejected step summary must show prior target.");
check(functionBlock.includes("handoff: `Target: ${handoffWorkspace}`"), "Blocked step summary must show target.");
check(!functionBlock.includes("createCommandPlan("), "Step summary helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Step summary helper must not approve or reject a plan.");
check(appSource.includes("const selectedCommandStepSummary = selectedCommandPlan ? buildCommandStepSummary(selectedCommandPlan) : null"), "Renderer must derive selected step summary.");
check(appSource.includes('aria-label="Command step summary"'), "Step summary must be accessible.");
check(appSource.includes("selectedCommandStepSummary.stepCount"), "Step summary must render step count.");
check(appSource.includes("selectedCommandStepSummary.approvalCount"), "Step summary must render approval count.");
check(appSource.indexOf('aria-label="Command decision summary"') > -1 && appSource.indexOf('aria-label="Command decision summary"') < appSource.indexOf('aria-label="Command step summary"'), "Step summary must render after decision summary.");
check(appSource.indexOf('aria-label="Command step summary"') > -1 && appSource.indexOf('aria-label="Command step summary"') < appSource.indexOf('aria-label="Command approval checklist"'), "Step summary must render before approval checklist.");
check(styleSource.includes(".command-step-summary"), "Step summary CSS missing.");
check(styleSource.includes(".command-step-summary.blocked"), "Blocked step summary CSS missing.");
check(styleSource.includes(".command-step-summary.approved"), "Approved step summary CSS missing.");
check(styleSource.includes(".command-step-summary.rejected"), "Rejected step summary CSS missing.");
check(preloadSource.includes("reviewCommandPlan"), "Step summary must leave review bridge intact.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  summary: ["steps", "approval", "first", "handoff"],
  tones: ["ready", "blocked", "approved", "rejected"],
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
            errors = @("Command step summary validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
