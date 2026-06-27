Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux30"
$OutputPath = Join-Path $Artifacts "command-review-queue-summary.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux30/command-review-queue-summary.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const functionStart = appSource.indexOf("function buildCommandReviewQueueSummary");
const functionEnd = appSource.indexOf("function limitCommandDraft", functionStart);
const functionBlock = functionStart >= 0 && functionEnd > functionStart ? appSource.slice(functionStart, functionEnd) : "";
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const overviewIndex = appSource.indexOf('aria-label="Command queue overview"');
const summaryIndex = appSource.indexOf('aria-label="Command review queue summary"');
const filterIndex = appSource.indexOf('aria-label="Command plan filters"');

check(appSource.includes('type CommandReviewQueueTone = "empty" | "ready" | "blocked" | "complete"'), "Renderer must define typed review queue tones.");
check(appSource.includes("type CommandReviewQueueSummary"), "Renderer must define review queue summary shape.");
check(appSource.includes("readonly nextPlan: string"), "Review queue summary must include next plan.");
check(appSource.includes("readonly guard: string"), "Review queue summary must include guard.");
check(appSource.includes("function buildCommandReviewQueueSummary(plans: readonly CommandPlan[]): CommandReviewQueueSummary"), "Renderer must define review queue helper.");
check(functionBlock.includes('label: "No plans"'), "Review queue summary must cover empty state.");
check(functionBlock.includes('guard: "No handoff"'), "Review queue summary must block handoff when empty.");
check(functionBlock.includes("const readyDraft = plans.find"), "Review queue summary must find ready drafts first.");
check(functionBlock.includes('label: "Review ready"'), "Review queue summary must identify ready review.");
check(functionBlock.includes("Approve or reject after reading the plan."), "Review queue summary must explain decision step.");
check(functionBlock.includes("const blockedDraft = plans.find"), "Review queue summary must find blocked drafts.");
check(functionBlock.includes('label: "Revision needed"'), "Review queue summary must identify blocked revision state.");
check(functionBlock.includes('guard: "Approval blocked"'), "Review queue summary must preserve blocked approval.");
check(functionBlock.includes("const approvedPlan = plans.find"), "Review queue summary must find approved plans.");
check(functionBlock.includes('label: "Approved handoff"'), "Review queue summary must identify approved handoff.");
check(functionBlock.includes('label: "Queue complete"'), "Review queue summary must cover completed queue.");
check(!functionBlock.includes("createCommandPlan("), "Review queue helper must not create a plan.");
check(!functionBlock.includes("reviewCommandPlan("), "Review queue helper must not approve or reject a plan.");
check(!functionBlock.includes("setActiveWorkspace("), "Review queue helper must not open a workspace.");
check(appSource.includes("const commandReviewQueueSummary = buildCommandReviewQueueSummary(recentCommandPlans)"), "Renderer must derive review queue summary.");
check(appSource.includes('aria-label="Command review queue summary"'), "Review queue summary must be accessible.");
check(appSource.includes("commandReviewQueueSummary.nextPlan"), "Renderer must render next plan.");
check(appSource.includes("commandReviewQueueSummary.guard"), "Renderer must render guard.");
check(overviewIndex >= 0 && summaryIndex > overviewIndex, "Review queue summary must render after queue overview.");
check(summaryIndex >= 0 && filterIndex > summaryIndex, "Review queue summary must render before plan filters.");
check(styleSource.includes(".command-review-queue-summary"), "Review queue summary CSS missing.");
check(styleSource.includes(".command-review-queue-summary.ready"), "Ready queue summary CSS missing.");
check(styleSource.includes(".command-review-queue-summary.blocked"), "Blocked queue summary CSS missing.");
check(styleSource.includes(".command-review-queue-summary.complete"), "Complete queue summary CSS missing.");
check(styleSource.includes(".command-review-queue-summary.empty"), "Empty queue summary CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  tones: ["empty", "ready", "blocked", "complete"],
  priorities: ["ready-draft", "blocked-draft", "approved-handoff", "complete"],
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
            errors = @("Command review queue summary validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
