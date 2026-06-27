Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux14"
$OutputPath = Join-Path $Artifacts "command-queue-overview.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux14/command-queue-overview.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes('type CommandQueueOverviewId = "total" | "ready" | "blocked" | "approved" | "rejected"'), "Renderer must define typed queue overview ids.");
check(appSource.includes('type CommandQueueOverviewTone = "neutral" | "ready" | "blocked" | "approved" | "rejected"'), "Renderer must define typed queue overview tones.");
check(appSource.includes("type CommandQueueOverviewItem"), "Renderer must define queue overview item shape.");
check(appSource.includes("readonly value: number"), "Queue overview item must include numeric value.");
check(appSource.includes("function buildCommandQueueOverview(plans: readonly CommandPlan[]): readonly CommandQueueOverviewItem[]"), "Renderer must build queue overview locally.");
check(appSource.includes('readyCount = plans.filter((plan) => plan.status === "draft" && plan.blockedReasons.length === 0).length'), "Queue overview must count approvable draft plans.");
check(appSource.includes("blockedCount = plans.filter((plan) => plan.blockedReasons.length > 0).length"), "Queue overview must count blocked plans.");
check(appSource.includes('approvedCount = plans.filter((plan) => plan.status === "approved").length'), "Queue overview must count approved plans.");
check(appSource.includes('rejectedCount = plans.filter((plan) => plan.status === "rejected").length'), "Queue overview must count rejected plans.");
check(appSource.includes('detail: "Can approve"'), "Ready count must explain approval readiness.");
check(appSource.includes('detail: "Needs revision"'), "Blocked count must explain revision need.");
check(appSource.includes('detail: "Can open"'), "Approved count must explain handoff availability.");
check(appSource.includes("const commandQueueOverview = buildCommandQueueOverview(recentCommandPlans)"), "Renderer must derive overview from recent plans.");
check(appSource.includes('aria-label="Command queue overview"'), "Queue overview must be accessible.");
check(appSource.includes("commandQueueOverview.map((item) =>"), "Queue overview must render all items.");
check(appSource.includes("className={item.tone}"), "Queue overview must render tone classes.");
check(appSource.indexOf('aria-label="Command queue overview"') > -1 && appSource.indexOf('aria-label="Command queue overview"') < appSource.indexOf('aria-label="Command plan filters"'), "Queue overview must render before filters.");
check(!appSource.includes("buildCommandQueueOverview(selectedCommandPlan"), "Queue overview must not derive from a selected review plan.");
check(!appSource.includes("buildCommandQueueOverview(reviewCommandPlan"), "Queue overview must not review or mutate plans.");
check(styleSource.includes(".command-queue-overview"), "Queue overview CSS missing.");
check(styleSource.includes(".command-queue-overview div.ready"), "Ready queue overview CSS missing.");
check(styleSource.includes(".command-queue-overview div.blocked"), "Blocked queue overview CSS missing.");
check(styleSource.includes(".command-queue-overview div.approved"), "Approved queue overview CSS missing.");
check(styleSource.includes(".command-queue-overview div.rejected"), "Rejected queue overview CSS missing.");
check(preloadSource.includes("reviewCommandPlan"), "Queue overview must leave existing review bridge intact.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  items: ["total", "ready", "blocked", "approved", "rejected"],
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
            errors = @("Command queue overview validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
