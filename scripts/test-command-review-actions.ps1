Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = Join-Path $Root "artifacts\post-milestone-ux12"
$OutputPath = Join-Path $Artifacts "command-review-actions.json"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("artifacts/post-milestone-ux12/command-review-actions.json");
const appSource = fs.readFileSync("apps/studio-desktop/src/renderer/App.tsx", "utf8");
const styleSource = fs.readFileSync("apps/studio-desktop/src/renderer/styles.css", "utf8");
const preloadSource = fs.readFileSync("apps/studio-desktop/src/preload/preload.cts", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

check(appSource.includes('type CommandReviewActionState = "available" | "blocked" | "complete" | "unavailable"'), "Renderer must define typed review action states.");
check(appSource.includes("type CommandReviewAction"), "Renderer must define review action shape.");
check(appSource.includes('readonly id: "approve" | "reject" | "open"'), "Review actions must cover approve, reject, and open.");
check(appSource.includes("function buildCommandReviewActions(plan: CommandPlan): readonly CommandReviewAction[]"), "Renderer must derive review action availability locally.");
check(appSource.includes('id: "approve"'), "Review actions must include approve.");
check(appSource.includes("Blocked until the command is revised"), "Approve action must explain blocked plans.");
check(appSource.includes("Available now"), "Approve action must explain availability.");
check(appSource.includes('id: "reject"'), "Review actions must include reject.");
check(appSource.includes("Available as the alternate decision"), "Reject action must explain availability.");
check(appSource.includes('id: "open"'), "Review actions must include open.");
check(appSource.includes("Approve before opening"), "Open action must explain draft plans.");
check(appSource.includes("Rejected plans cannot be opened"), "Open action must explain rejected plans.");
check(appSource.includes("const selectedCommandReviewActions = selectedCommandPlan ? buildCommandReviewActions(selectedCommandPlan) : []"), "Renderer must derive selected review actions.");
check(appSource.includes('className="command-review-action-strip"'), "Renderer must render review action strip.");
check(appSource.includes('aria-label="Command review actions"'), "Review action strip must be accessible.");
check(appSource.includes("selectedCommandReviewActions.map"), "Review action strip must render all actions.");
check(appSource.includes("className={action.state}"), "Review action items must expose state class.");
check(!appSource.includes("buildCommandReviewActions(selectedCommandPlan.id"), "Review action strip must not review or mutate plans.");
check(styleSource.includes(".command-review-action-strip"), "Review action strip CSS missing.");
check(styleSource.includes(".command-review-action-strip div.available"), "Available action CSS missing.");
check(styleSource.includes(".command-review-action-strip div.blocked"), "Blocked action CSS missing.");
check(styleSource.includes(".command-review-action-strip div.complete"), "Complete action CSS missing.");
check(styleSource.includes(".command-review-action-strip div.unavailable"), "Unavailable action CSS missing.");
check(preloadSource.includes("reviewCommandPlan"), "Review action strip must leave existing review bridge intact.");
check(!preloadSource.includes("shell."), "Preload bridge must not expose Electron shell access.");
check(!preloadSource.includes("require("), "Preload bridge must not expose CommonJS require.");
check(!preloadSource.includes("process."), "Preload bridge must not expose process access.");

const result = {
  checkedAt: new Date().toISOString(),
  actionStates: ["available", "blocked", "complete", "unavailable"],
  actions: ["approve", "reject", "open"],
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
            errors = @("Command review actions validation failed before writing output.")
            output = $output.Trim()
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    }
    Write-Output $output.Trim()
    exit $LASTEXITCODE
}

Write-Output $output.Trim()
