Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux4"
$OutputPath = Join-Path $Artifacts "command-plan-review.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux4/command-plan-review.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes("selectedCommandPlanId"), "Renderer must track selected command plan.");
check(appSource.includes("setSelectedCommandPlanId(plan?.id ?? null)"), "New command plans must become selected.");
check(appSource.includes("const selectedCommandPlan = filteredCommandPlans.find"), "Renderer must derive selected command plan from the visible plan list.");
check(appSource.includes("?? filteredCommandPlans[0]"), "Renderer must fall back to the first visible plan.");
check(appSource.includes('className="admin-panel command-review-panel"'), "Renderer must include a command review panel.");
check(appSource.includes('aria-label="Command plan review"'), "Command review panel must be accessible.");
check(appSource.includes("selectedCommandPlan.steps.map"), "Command review must render plan steps.");
check(appSource.includes("step.requiresApproval ? \"approval required\" : \"ready\""), "Command review must show approval requirement per step.");
check(appSource.includes("command-blocked-reasons"), "Command review must render blocked reasons.");
check(appSource.includes("aria-pressed={selectedCommandPlan?.id === plan.id}"), "Review selector must expose pressed state.");
check(appSource.includes("selected-command-plan"), "Selected plan styling hook missing.");
check(styleSource.includes(".command-review-panel"), "Command review panel CSS missing.");
check(styleSource.includes(".command-step-list"), "Command step list CSS missing.");
check(styleSource.includes(".command-blocked-reasons"), "Blocked reason CSS missing.");
check(styleSource.includes(".selected-command-plan"), "Selected command plan CSS missing.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  reviewSurface: {
    selectedPlan: true,
    stepPreview: true,
    approvalRequirementPreview: true,
    blockedReasonPreview: true
  },
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
            errors = @("Command plan review validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
